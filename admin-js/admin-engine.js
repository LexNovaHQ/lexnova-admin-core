// ════════════════════════════════════════════════════════════════════════
// ═════════ LEX NOVA ADMIN: ENGINE ROOM (admin-engine.js) V5.5 ═══════════
// ════════════════════════════════════════════════════════════════════════
// ADMIN.HTML PATCHES REQUIRED:
//   1. Engine Room "Regulation DB" view-btn: change onclick to
//      window.nav('regulation') instead of setEngineView('radar',this)
//   2. Remove the entire #modal-radar-cms div — CMS moved to tab-regulation.js
//   3. Engine Room view buttons: remove the "Regulation DB" button entirely
//      (regulation has its own sidebar tab now)
// ADMIN-CORE.JS PATCHES REQUIRED:
//   1. Add to nav() headers: 'regulation':{ title:'Regulation DB', sub:'...' }
//   2. Add to nav() routing: if(tabId==='regulation') window.loadRegulation?.()
//   3. Add 'regulation' case to init()
// ════════════════════════════════════════════════════════════════════════
'use strict';

// ── PLAN CONSTANTS (shared with panel-client.js via window) ───────────
var PLANS       = { agentic_shield:'Agentic Shield', workplace_shield:'Workplace Shield', complete_stack:'Complete Stack', flagship:'Flagship' };
var PLAN_PRICES = { agentic_shield:997, workplace_shield:997, complete_stack:2500, flagship:15000 };
window.planLabel      = k => PLANS[k] || k;
window.planBadgeClass = p => ({agentic_shield:'b-intake',workplace_shield:'b-warm',complete_stack:'b-production',flagship:'b-hot'}[p]||'b-ghost');

// ── GLOBAL STATE ──────────────────────────────────────────────────────
window.allContent    = [];
window.radarEntries  = [];

// ════════════════════════════════════════════════════════════════════════
// ═════════ INT / EXT → VAULT FIELD BRIDGE ════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
// Reads BOTH new vault schema (c.archetypes.*, c.compliance.*) AND
// old vault schema (c.action_scopes.*, c.architecture.*) for backwards compat.
// Also accepts old CMS field-name strings for legacy radar entries.
// ════════════════════════════════════════════════════════════════════════
const INT_VAULT_MAP = {
    // ── Canonical INT.XX codes (registry format) ──
    'INT.01': c => !!(c.archetypes?.is_doer        || c.action_scopes?.is_doer),
    'INT.02': c => !!(c.archetypes?.is_orchestrator || c.action_scopes?.is_orchestrator),
    'INT.03': c => !!(c.archetypes?.is_creator),
    'INT.04': c => !!(c.archetypes?.conversational_ui || c.action_scopes?.is_companion),
    'INT.05': c => !!(c.archetypes?.is_reader),
    'INT.06': c => !!(c.archetypes?.sens_bio),
    'INT.07': c => !!(c.archetypes?.is_judge        || c.action_scopes?.is_judge_hr || c.action_scopes?.is_judge_fin || c.action_scopes?.is_judge_legal),
    'INT.08': c => !!(c.archetypes?.is_shield),
    'INT.09': c => !!(c.archetypes?.is_optimizer),
    'INT.10': c => !!(c.archetypes?.is_mover),
    // ── Legacy CMS field-name strings (old radar entries) ──
    'is_doer':         c => !!(c.archetypes?.is_doer        || c.action_scopes?.is_doer),
    'is_orchestrator': c => !!(c.archetypes?.is_orchestrator || c.action_scopes?.is_orchestrator),
    'is_judge_hr':     c => !!(c.archetypes?.is_judge_hr    || c.action_scopes?.is_judge_hr),
    'is_judge_fin':    c => !!(c.archetypes?.is_judge_fin   || c.action_scopes?.is_judge_fin),
    'is_judge_legal':  c => !!(c.archetypes?.is_judge_legal || c.action_scopes?.is_judge_legal),
    'is_companion':    c => !!(c.archetypes?.conversational_ui || c.action_scopes?.is_companion),
    'finetuning':      c => c.architecture?.memory === 'finetuning',
    'selfhosted':      c => c.architecture?.models === 'selfhosted',
};

const EXT_VAULT_MAP = {
    // ── Canonical EXT.XX codes ──
    'EXT.01': c => !!(c.compliance?.eu_users      || c.baseline?.eu_users),
    'EXT.02': c => !!(c.compliance?.ca_users      || c.baseline?.ca_users),
    'EXT.03': c => !!(c.compliance?.processes_pii || c.compliance?.other_regions),
    'EXT.04': c => !!(c.archetypes?.sens_bio       || c.compliance?.sens_health),
    'EXT.05': c => !!(c.archetypes?.is_optimizer   || c.archetypes?.sens_fin || c.compliance?.sens_fin),
    'EXT.06': c => !!(c.compliance?.minors),
    'EXT.07': c => !!(c.archetypes?.is_judge_hr    || c.compliance?.sens_employment || c.action_scopes?.is_judge_hr),
    'EXT.08': c => ['b2c','hybrid'].includes(c.baseline?.market) || !c.baseline?.market,  // Consumer public
    'EXT.09': c => ['b2b','hybrid'].includes(c.baseline?.market) || !c.baseline?.market,  // Enterprise private
    'EXT.10': c => !c.architecture?.models || c.architecture?.models === 'thirdparty',     // Third-party API wrapper
    // ── Legacy CMS field-name strings ──
    'eu_users':       c => !!(c.compliance?.eu_users      || c.baseline?.eu_users),
    'ca_users':       c => !!(c.compliance?.ca_users      || c.baseline?.ca_users),
    'processes_pii':  c => !!(c.compliance?.processes_pii),
    'sensitive_data': c => !!(c.compliance?.sens_health || c.compliance?.sens_fin || c.compliance?.sens_employment || c.archetypes?.sens_bio),
};

// ── Core matching function — works with both old and new entry schemas ──
function clientMatchesRegulation(reg, c) {
    // UNIVERSAL: target_all flag OR UNIVERSAL in intTriggers
    if (reg.target_all) return true;
    const intT = reg.intTriggers || reg.target_int || [];
    const extT = reg.extTriggers || reg.target_ext || [];
    if (intT.includes('UNIVERSAL')) return true;

    for (const t of intT) {
        const fn = INT_VAULT_MAP[t];
        if (fn && fn(c)) return true;
    }
    for (const t of extT) {
        const fn = EXT_VAULT_MAP[t];
        if (fn && fn(c)) return true;
    }
    return false;
}

// ════════════════════════════════════════════════════════════════════════
// ═════════ ENGINE ROOM VIEW ROUTING ══════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
window.setEngineView = function(view, el) {
    window.qsa('#tab-engine .view-btn').forEach(b => b.classList.remove('active'));
    if (el) el.classList.add('active');
    ['finance','content','settings'].forEach(v => {
        const s = window.$('ev-'+v);
        if (s) s.classList.toggle('hidden', v !== view);
    });
    if (view === 'finance')  window.loadFinance();
    if (view === 'content')  window.loadContent();
    if (view === 'settings') window.loadSettings();
};

window.loadEngine = function() {
    window.setEngineView('finance', document.querySelector('#tab-engine .view-btn'));
};

window.loadSyndicate = async function() {
    await window.loadRadarCache();
    window.renderExposureMatrix();
    window.loadFinance();
};

// ════════════════════════════════════════════════════════════════════════
// ═════════ FINANCE TAB ═══════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
window.loadFinance = async function() {
    try {
        const snap = await window.db.collection('clients').get();
        const clients = []; snap.forEach(d => clients.push({id:d.id,...d.data()}));
        const paid  = clients.filter(c => c.status !== 'pending_payment');
        const maint = clients.filter(c => c.maintenanceActive);
        const mrr   = maint.length * 297;
        const total = paid.reduce((s,c)=>s+(c.price||PLAN_PRICES[c.plan]||0),0);
        const avg   = paid.length ? Math.round(total/paid.length) : 0;

        window.setText('fin-mrr',       window.fmtMoney(mrr));
        window.setText('fin-mrr-sub',   `${maint.length} maintenance subscriptions`);
        window.setText('fin-arr',       window.fmtMoney(mrr*12));
        window.setText('fin-total',     window.fmtMoney(total));
        window.setText('fin-total-sub', `${paid.length} paid clients`);
        window.setText('fin-avg',       window.fmtMoney(avg));

        const byPlan = {}; Object.keys(PLANS).forEach(k=>{byPlan[k]={count:0,rev:0};});
        paid.forEach(c => {
            if (!byPlan[c.plan]) byPlan[c.plan]={count:0,rev:0};
            byPlan[c.plan].count++;
            byPlan[c.plan].rev += (c.price||PLAN_PRICES[c.plan]||0);
        });
        const rows = Object.entries(byPlan).filter(([,v])=>v.count>0);
        const html = rows.length
            ? rows.map(([k,v])=>`<tr>
                <td><span class="badge ${window.planBadgeClass(k)}">${window.planLabel(k)}</span></td>
                <td>${v.count}</td><td>${window.fmtMoney(v.rev)}</td>
                <td>${total>0?Math.round(v.rev/total*100)+'%':'—'}</td>
              </tr>`).join('')
            : '<tr><td colspan="4" class="loading">No paid clients yet</td></tr>';
        document.querySelectorAll('#fin-by-plan').forEach(tb=>tb.innerHTML=html);

        // Syndicate maintenance list
        const concLists = document.querySelectorAll('#fin-conc-list');
        if (mrr > 0) {
            const mhtml = maint.map(c=>`<div class="conc-row"><span>${window.esc(c.baseline?.company||c.name||c.id)}</span><span style="color:var(--green)">$297/mo Active</span></div>`).join('');
            concLists.forEach(l=>l.innerHTML=mhtml||'<div class="loading">None</div>');
        } else {
            concLists.forEach(l=>l.innerHTML='<div class="loading">No maintenance revenue yet</div>');
        }
    } catch(e) { console.error(e); if(window.toast) window.toast('Finance load failed','error'); }
};

// ════════════════════════════════════════════════════════════════════════
// ═════════ RADAR CACHE (read-only — CRUD lives in tab-regulation.js) ══════
// ════════════════════════════════════════════════════════════════════════
window.loadRadarCache = async function() {
    try {
        const snap = await window.db.collection('settings').doc('regulatory_radar').get();
        window.radarEntries = snap.exists ? (snap.data().entries||snap.data().items||[]) : [];
    } catch(e) { console.error('Radar cache error:',e); }
};

// Engine Room read-only radar list (just a preview — full CRUD is in Regulation tab)
window.loadRadar = async function() {
    await window.loadRadarCache();
    const el = window.$('rv-list');
    if (!el) return;
    if (!window.radarEntries.length) {
        el.innerHTML = '<div class="tbl-empty">No regulations yet. <a onclick="window.nav(\'regulation\')" style="color:var(--gold);cursor:pointer">Open Regulation DB →</a></div>';
        return;
    }
    const sevClass = {NUCLEAR:'b-red',CRITICAL:'b-red',HIGH:'b-yellow',MEDIUM:'b-ghost'};
    el.innerHTML = `<div style="text-align:right;margin-bottom:12px;">
        <button class="btn btn-primary btn-sm" onclick="window.nav('regulation')">Open Full Regulation DB →</button>
    </div>` +
    window.radarEntries.slice(0,20).map((reg,i) => {
        const intT = (reg.intTriggers||reg.target_int||[]).join(', ')||'—';
        const extT = (reg.extTriggers||reg.target_ext||[]).join(', ')||'—';
        return `<div class="radar-entry">
            <div style="flex:1;min-width:0">
                <div class="radar-title">${window.esc(reg.title||reg.Founder_Threat||'—')}</div>
                <div class="radar-meta">${window.esc(reg.jurisdiction||reg.effectiveDate||'—')} · <span style="color:var(--marble-faint);font-family:monospace;font-size:8px">INT:[${window.esc(intT)}] EXT:[${window.esc(extT)}]</span></div>
            </div>
            <span class="badge ${sevClass[reg.severity]||'b-ghost'}">${window.esc(reg.severity||'—')}</span>
        </div>`;
    }).join('') +
    (window.radarEntries.length>20?`<div style="text-align:center;padding:12px;font-size:10px;color:var(--marble-faint)">Showing 20 of ${window.radarEntries.length}. Open Regulation DB for full list.</div>`:'');
};

// ════════════════════════════════════════════════════════════════════════
// ═════════ EXPOSURE MATRIX (V5.5 BRIDGE — SYNDICATE TAB) ════════════════
// ════════════════════════════════════════════════════════════════════════
window.renderExposureMatrix = async function() {
    const tbodies = document.querySelectorAll('#rv-exposure-tbody');
    if (!tbodies.length) return;
    tbodies.forEach(tb=>tb.innerHTML='<tr><td colspan="6" class="loading">Calculating Threat Exposure…</td></tr>');

    try {
        const snap = await window.db.collection('clients').get();
        const clients = []; snap.forEach(d=>clients.push({id:d.id,...d.data()}));

        const rows = clients.map(c => {
            let red=0, yellow=0;
            window.radarEntries.forEach(reg => {
                // Jurisdiction pre-filter
                const regJur = (reg.jurisdiction||'').toLowerCase();
                if (regJur && regJur!=='global' && regJur!=='us-all') {
                    const cJur = (c.registrationJurisdiction||c.baseline?.jurisdiction||c.baseline?.hq||'').toLowerCase();
                    if (cJur && !cJur.includes(regJur) && !regJur.includes(cJur)) return;
                }
                const match = clientMatchesRegulation(reg, c);
                if (match) { c.maintenanceActive ? yellow++ : red++; }
            });
            return {...c, _red:red, _yellow:yellow};
        }).filter(c=>c._red>0||c._yellow>0).sort((a,b)=>b._red-a._red||b._yellow-a._yellow);

        const html = !rows.length
            ? '<tr><td colspan="6" class="loading">No exposures detected — all architectures secure.</td></tr>'
            : rows.map(c=>`<tr onclick="window.openDetail&&window.openDetail('${window.esc(c.id)}');" style="cursor:pointer">
                <td><div style="font-size:11px;font-weight:600;">${window.esc(c.baseline?.company||c.name||c.id)}</div></td>
                <td><span class="badge ${window.planBadgeClass(c.plan)}">${window.planLabel(c.plan)}</span></td>
                <td class="exp-flag-r">${c._red>0?`🔴 ${c._red}`:'—'}</td>
                <td class="exp-flag-y">${c._yellow>0?`🟡 ${c._yellow}`:'—'}</td>
                <td>${c.maintenanceActive?'<span class="badge b-delivered">Active</span>':'<span class="badge b-ghost">None</span>'}</td>
                <td onclick="event.stopPropagation()"><button class="btn btn-primary btn-sm" onclick="window.openDetail&&window.openDetail('${window.esc(c.id)}');window.detailTab&&window.detailTab('gap');">Gap Review</button></td>
              </tr>`).join('');
        tbodies.forEach(tb=>tb.innerHTML=html);
    } catch(e) {
        tbodies.forEach(tb=>tb.innerHTML='<tr><td colspan="6" class="loading" style="color:#d47a7a">Database Error</td></tr>');
        console.error(e);
    }
};

// ════════════════════════════════════════════════════════════════════════
// ═════════ CONTENT TAB ═══════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
window.loadContent = async function() {
    document.querySelectorAll('#ct-tbody').forEach(tb=>tb.innerHTML='<tr><td colspan="5" class="loading">Loading…</td></tr>');
    try {
        const snap = await window.db.collection('content').orderBy('createdAt','desc').get();
        window.allContent=[]; snap.forEach(d=>window.allContent.push({id:d.id,...d.data()}));
        window.renderContent(window.allContent);
    } catch(e) { document.querySelectorAll('#ct-tbody').forEach(tb=>tb.innerHTML='<tr><td colspan="5" class="loading" style="color:#d47a7a">Failed</td></tr>'); }
};

window.renderContent = function(list) {
    const sClass={Idea:'b-ghost',Drafting:'b-cold',Scheduled:'b-intake',Posted:'b-delivered',Archived:'b-dead'};
    const html = !list.length ? '<tr><td colspan="5" class="loading">No content logged</td></tr>'
        : list.map(c=>`<tr>
            <td>${window.esc(c.topic||'—')}</td>
            <td><span class="badge ${sClass[c.status]||'b-ghost'}">${window.esc(c.status||'—')}</span></td>
            <td class="dim">${window.esc(c.postedDate||'—')}</td>
            <td class="dim">${window.esc(c.notes||'—')}</td>
            <td onclick="event.stopPropagation()" style="white-space:nowrap">
                <button class="btn btn-ghost btn-sm" onclick="window.openEditContent('${window.esc(c.id)}')">Edit</button>
                <button class="btn btn-danger btn-sm" onclick="window.deleteContent('${window.esc(c.id)}')">Delete</button>
            </td></tr>`).join('');
    document.querySelectorAll('#ct-tbody').forEach(tb=>tb.innerHTML=html);
};

function contentModalBody(c) {
    const s=c||{}; const stats=['Idea','Drafting','Scheduled','Posted','Archived'];
    return `<div class="fg"><label class="fl">Topic</label><input type="text" class="fi" id="ct-topic" value="${window.esc(s.topic||'')}"></div>
    <div class="fi-row"><div class="fg"><label class="fl">Status</label><select class="fi" id="ct-status-sel">${stats.map(x=>`<option ${s.status===x?'selected':''}>${x}</option>`).join('')}</select></div>
    <div class="fg"><label class="fl">Posted Date</label><input type="date" class="fi" id="ct-date" value="${s.postedDate||''}"></div></div>
    <div class="fg"><label class="fl">Notes</label><textarea class="fi" id="ct-notes" rows="2">${window.esc(s.notes||'')}</textarea></div>`;
}

window.openAddContent  = ()=>window.openModal('Add Content',contentModalBody(null),`<button class="btn btn-outline btn-sm" onclick="window.closeModal()">Cancel</button><button class="btn btn-primary btn-sm" onclick="window.saveContent(null)">Add</button>`);
window.openEditContent = id=>{ const c=window.allContent.find(x=>x.id===id); if(!c)return; window.openModal('Edit Content',contentModalBody(c),`<button class="btn btn-outline btn-sm" onclick="window.closeModal()">Cancel</button><button class="btn btn-primary btn-sm" onclick="window.saveContent('${id}')">Save</button>`); };

window.saveContent = async function(id) {
    const data={topic:window.$('ct-topic')?.value?.trim()||'',status:window.$('ct-status-sel')?.value||'Idea',postedDate:window.$('ct-date')?.value||'',notes:window.$('ct-notes')?.value?.trim()||'',updatedAt:new Date().toISOString()};
    if(!data.topic){if(window.toast)window.toast('Topic required','error');return;}
    try {
        if(id){await window.db.collection('content').doc(id).set(data,{merge:true});const idx=window.allContent.findIndex(c=>c.id===id);if(idx!==-1)window.allContent[idx]={...window.allContent[idx],...data};}
        else{data.createdAt=new Date().toISOString();const ref=await window.db.collection('content').add(data);window.allContent.unshift({id:ref.id,...data});}
        if(window.closeModal)window.closeModal(); window.renderContent(window.allContent); if(window.toast)window.toast('Saved');
    } catch(e){console.error(e);if(window.toast)window.toast('Save failed','error');}
};

window.deleteContent = async function(id) {
    if(!confirm('Delete?'))return;
    try{await window.db.collection('content').doc(id).delete();window.allContent=window.allContent.filter(c=>c.id!==id);window.renderContent(window.allContent);if(window.toast)window.toast('Deleted');}
    catch(e){console.error(e);}
};

// ════════════════════════════════════════════════════════════════════════
// ═════════ SETTINGS TAB ══════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
window.loadSettings = async function() {
    try {
        const snap = await window.db.collection('settings').doc('config').get();
        if(snap.exists){
            const d=snap.data();
            window.setVal('wh-s2',d.webhookS2||'');
            window.setVal('wh-s3',d.webhookS3||'');
            window.setVal('wh-s4',d.webhookS4||'');
            window.setVal('s-capacity',d.capacityCap||10);
            // Case study URL for hunt panel engagement assets
            window.setVal('s-case-study', d.caseStudyVideoUrl||'');
        }
        await window.loadAdmins();
    } catch(e){console.error(e);}
};

window.saveSettings = async function() {
    const data={
        webhookS2:        window.$('wh-s2')?.value?.trim()||'',
        webhookS3:        window.$('wh-s3')?.value?.trim()||'',
        webhookS4:        window.$('wh-s4')?.value?.trim()||'',
        capacityCap:      parseInt(window.$('s-capacity')?.value)||10,
        caseStudyVideoUrl:window.$('s-case-study')?.value?.trim()||'',
        updatedAt:        new Date().toISOString()
    };
    try{await window.db.collection('settings').doc('config').set(data,{merge:true});if(window.toast)window.toast('Settings saved');}
    catch(e){console.error(e);}
};

window.loadAdmins = async function() {
    const tbodies=document.querySelectorAll('#s-admins'); if(!tbodies.length)return;
    try {
        const snap=await window.db.collection('admins').get();
        const admins=[]; snap.forEach(d=>admins.push({id:d.id,...d.data()}));
        const html=admins.length
            ?admins.map(a=>`<tr><td>${window.esc(a.id)}</td><td class="dim" style="font-size:9px">${window.esc((a.permissions||[]).join(', '))}</td><td onclick="event.stopPropagation()"><button class="btn btn-danger btn-sm" onclick="window.removeAdmin('${window.esc(a.id)}')">Remove</button></td></tr>`).join('')
            :'<tr><td colspan="3" class="loading">No admins</td></tr>';
        tbodies.forEach(tb=>tb.innerHTML=html);
    } catch(e){console.error(e);}
};

window.addAdmin = async function() {
    const email=window.$('s-new-admin')?.value?.trim().toLowerCase();
    const perms=Array.from(document.querySelectorAll('.adm-perm-chk:checked')).map(el=>el.value);
    if(!email){if(window.toast)window.toast('Enter email','error');return;}
    if(!perms.length){if(window.toast)window.toast('Select at least one permission','error');return;}
    try{
        await window.db.collection('admins').doc(email).set({permissions:perms,addedAt:new Date().toISOString()});
        if(window.$('s-new-admin'))window.$('s-new-admin').value='';
        document.querySelectorAll('.adm-perm-chk').forEach(el=>el.checked=false);
        await window.loadAdmins(); if(window.toast)window.toast(`${email} added`);
    }catch(e){console.error(e);}
};

window.removeAdmin = async function(email) {
    if(!confirm(`Remove ${email}?`))return;
    try{await window.db.collection('admins').doc(email).delete();await window.loadAdmins();if(window.toast)window.toast(`${email} removed`);}
    catch(e){console.error(e);}
};
