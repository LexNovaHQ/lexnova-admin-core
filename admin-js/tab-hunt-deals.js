// ════════════════════════════════════════════════════════════════════════
// ═════════ LEX NOVA ADMIN: THE CRM ENGINE (tab-hunt-deals.js) V7.0 ══════
// ════════════════════════════════════════════════════════════════════════
'use strict';

var PLANS = {
    agentic_shield:'Agentic Shield', workplace_shield:'Workplace Shield',
    complete_stack:'Complete Stack', flagship:'Flagship'
};
var STEP_NEXT      = { C:'FU1', FU1:'FU2', FU2:'FU3', FU3:'FU4', FU4:null };
var STEP_INTERVALS = { C:3, FU1:3, FU2:4, FU3:4, FU4:2 };
var STEP_LABELS    = { C:'Cold Email', FU1:'Follow-Up 1', FU2:'Follow-Up 2', FU3:'Follow-Up 3', FU4:'Follow-Up 4' };
var STATUSES       = ['QUEUED','SEQUENCE','ENGAGED','NEGOTIATING','CONVERTED','ARCHIVED','DEAD'];
var VELOCITY_DISPLAY = { 'Immediate':'Active Now', 'High':'This Year', 'Upcoming':'Incoming', 'Pending':'Watch' };

window.allProspects    = [];
window.allFlagship     = [];
window.currentProspect = null;
window.currentFlagship = null;
var outreachListener   = null;
var caseStudyUrl       = '';
var huntBuilt          = false;

// ── SORT STATE — asc/desc per column ─────────────────────────────────
var sortDir = {}; // e.g. { ceDate: 'asc', company: 'desc' }
var currentSortKey = 'ceDate';

var $h = id => document.getElementById(id);
function datePlusDays(n) { const d=new Date(); d.setDate(d.getDate()+n); return d.toISOString().split('T')[0]; }
function todayStr()      { return new Date().toISOString().split('T')[0]; }
function nowTs()         { return new Date().toISOString(); }
function currentQuarter(){ const m=new Date().getMonth(); return m<3?'Q1':m<6?'Q2':m<9?'Q3':'Q4'; }
function nextQuarter()   { const q=['Q1','Q2','Q3','Q4']; return q[(q.indexOf(currentQuarter())+1)%4]; }
function fmtMoney(n)     { return (n==null||isNaN(n))?'—':'$'+Number(n).toLocaleString(); }
function fmtDate(ts)     { if(!ts)return'—'; const d=ts.toDate?ts.toDate():new Date(ts); return isNaN(d)?'—':d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}); }
function fmtShort(ds)    { if(!ds)return'—'; const d=new Date(ds+'T00:00:00'); return isNaN(d)?'—':d.toLocaleDateString('en-GB',{day:'2-digit',month:'short'}); }
function daysDiff(ds)    { if(!ds)return null; return Math.round((new Date(ds+'T00:00:00')-new Date(todayStr()+'T00:00:00'))/86400000); }
function velDisplay(v)   { return VELOCITY_DISPLAY[v]||v||'—'; }
function planBadgeClass(p){ return {agentic_shield:'b-intake',workplace_shield:'b-warm',complete_stack:'b-production',flagship:'b-hot'}[p]||'b-ghost'; }

// ── V7.0: EXT helper — handles both array and legacy string ──────────
function fmtExtArr(val) {
    if (!val) return '—';
    if (Array.isArray(val)) return val.join(', ');
    return String(val);
}

// ── V7.0: Gap name — gapName (V7) or trap (V6 legacy) ────────────────
function getGapName(g) { return g.gapName || g.trap || '—'; }

// ── V7.0: Evidence text helpers ───────────────────────────────────────
function getEvidenceFound(g)  { return g.evidence?.found      || g.evidence?.source || '—'; }
function getEvidenceWhy(g)    { return g.evidence?.connection || g.evidence?.reason || '—'; }
function getEvidenceTrigger(g){ return g.evidence?.trigger    || '—'; }

// ── V7.0: Viability flag dual-read (V7 keys first, V6 fallback) ───────
function vfGet(vf, key) {
    const map = {
        productFit:      ['G1_productFit',    'gate1_productFit'],
        gapSeverity:     ['G2_gapSeverity',   'gate2_gapSeverity'],
        contactComplete: ['G3_contactComplete','gate3_contactComplete'],
        funding:         ['G4_fundingSignal',  'gate4_funding']
    };
    const keys = map[key] || [];
    for (const k of keys) { if (vf[k] !== undefined) return vf[k]; }
    return undefined;
}
function vfReason(vf, key) {
    const map = {
        productFit:      ['G1_reason','gate1_productFit'],
        gapSeverity:     ['G2_reason','gate2_gapSeverity'],
        contactComplete: ['G3_reason','gate3_contactComplete'],
        funding:         ['G4_reason','gate4_funding']
    };
    const keys = map[key] || [];
    for (const k of keys) { if (typeof vf[k] === 'string' && vf[k]) return vf[k]; }
    return '';
}

var BATCH_LIMIT = 25;
function getBatchCount(b) { if(!b)return 0; return window.allProspects.filter(p=>p.batchNumber===b&&p.status!=='DEAD').length; }
function isBatchFull(b)   { return getBatchCount(b)>=BATCH_LIMIT; }

function statusBadgeHtml(s) {
    const cls={QUEUED:'b-cold',SEQUENCE:'b-intake',ENGAGED:'b-warm',NEGOTIATING:'b-hot',CONVERTED:'b-delivered',ARCHIVED:'b-ghost',DEAD:'b-dead'}[s]||'b-ghost';
    return `<span class="badge ${cls}">${s}</span>`;
}

function getReadiness(p) {
    if (p.ceSent || (p.sequenceStep && p.sequenceStep !== 'C')) return 'ACTIVE';
    if (p.ceDate) return 'SCHEDULED';
    if ((p.forensicGaps&&p.forensicGaps.length)||(p.activeGaps&&p.activeGaps.length)) return 'INTEL READY';
    return 'UNVERIFIED';
}

function readinessBadge(p) {
    const r = getReadiness(p);
    const map = { 'ACTIVE':'b-seq-active', 'SCHEDULED':'b-scheduled', 'INTEL READY':'b-intel-ready', 'UNVERIFIED':'b-unverified' };
    return `<span class="badge ${map[r]||'b-unverified'}" style="font-size:8px">${r}</span>`;
}

function getIntelState(p) {
    if (p.forensicGaps&&p.forensicGaps.length) return 'verified';
    if (p.activeGaps&&p.activeGaps.length)     return 'scanner';
    return 'none';
}

function intelCell(p) {
    const st  = getIntelState(p);
    const dot = st==='verified' ? 'intel-dot-green' : st==='scanner' ? 'intel-dot-orange' : 'intel-dot-red';
    const lbl = st==='verified' ? 'Verified' : st==='scanner' ? 'Scanner' : 'No Intel';
    // V7.0: use primaryArchetype + internalCategory fallback
    const archs = (p.primaryArchetype||p.intArchetypes||[]).slice(0,2).join(', ') || p.internalCategory || '—';
    const top   = getAllGaps(p)[0];
    const tip   = `${archs}${top?' · '+getGapName(top):''}`;
    return `<div class="intel-dot-wrap" title="${window.esc(tip)}">
        <span class="intel-dot ${dot}"></span>
        <span style="font-size:9px;">${lbl}</span>
    </div>`;
}

function ceDateCell(p) {
    const d = p.ceDate;
    if (!d) return `<button class="cal-set-btn" onclick="event.stopPropagation();if(typeof window.calPromptCEDate==='function')window.calPromptCEDate('${window.esc(p.id)}')">Set</button>`;
    const diff = daysDiff(d);
    const style= diff<0?'color:#d47a7a;font-weight:600':diff===0?'color:var(--gold)':'color:var(--marble-dim)';
    const lbl  = diff<0?`⚠ ${fmtShort(d)}`:diff===0?'★ Today':fmtShort(d);
    return `<span style="${style};font-size:10px;">${lbl}</span>`;
}

// ── V7.0: getAllGaps — dedup key includes gapName ─────────────────────
function getAllGaps(p) {
    const active   = p.activeGaps  || [];
    const forensic = p.forensicGaps|| [];
    const merged   = [...active];
    forensic.forEach(fg => {
        const fgKey = fg.threatId || fg.gapName || fg.trap || '';
        if (!fgKey) { merged.push(fg); return; }
        if (!merged.find(ag => {
            const k = ag.threatId || ag.gapName || ag.trap || '';
            return k && k === fgKey;
        })) merged.push(fg);
    });
    const sw = {NUCLEAR:3,CRITICAL:2,HIGH:1};
    merged.sort((a,b)=>(sw[(b.severity||'').toUpperCase()]||0)-(sw[(a.severity||'').toUpperCase()]||0));
    return merged;
}

// ── V7.0: getEvidenceBackedGaps — handles V7 evidence.found + V6 evidence.source ──
function getEvidenceBackedGaps(p) {
    const fq = (p.forensicGaps||[]).filter(g =>
        ['NUCLEAR','CRITICAL'].includes((g.severity||'').toUpperCase()) &&
        (g.evidence?.found || g.evidence?.source) &&
        (g.evidence?.connection || g.evidence?.reason)
    );
    const t1 = fq.filter(g=>g.evidenceTier===1);
    const t2 = fq.filter(g=>g.evidenceTier===2);
    const t3 = fq.filter(g=>g.evidenceTier===3).slice(0,3);
    const covered = new Set([...t1,...t2,...t3].map(g=>g.threatId||g.gapName||g.trap||'').filter(Boolean));
    const scanOnly = (p.activeGaps||[]).filter(g =>
        ['NUCLEAR','CRITICAL'].includes((g.severity||'').toUpperCase()) &&
        !covered.has(g.threatId||'__none__') && !covered.has(g.gapName||'__none__') && !covered.has(g.trap||'__none__')
    );
    return [...t1,...t2,...t3,...scanOnly];
}

function getActionText(p) {
    const step = p.sequenceStep||'C';
    switch(p.status) {
        case 'QUEUED':      return 'Ready — send cold email';
        case 'SEQUENCE':    return `Send ${STEP_LABELS[step]||'next follow-up'}`;
        case 'ENGAGED':
            if (p.scannerCompleted) return 'Gate done — initiate negotiation';
            if (p.scannerClicked)   return 'Scanner clicked — chase payment';
            return 'Scanner link sent — follow up';
        case 'NEGOTIATING': return 'Send negotiation touch';
        default:            return 'Review prospect';
    }
}

// ════════════════════════════════════════════════════════════════════════
// ═════════ SORT DIRECTION ENGINE ════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════

// Toggle sort direction for a given key. Returns 'asc' or 'desc'.
function toggleSort(key) {
    if (currentSortKey === key) {
        sortDir[key] = sortDir[key] === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortKey = key;
        sortDir[key]   = sortDir[key] || 'asc'; // first click = asc
    }
    const sel = $h('op-sort');
    if (sel) sel.value = key;
    updateSortDirBtn();
    window.filterProspects();
}

function updateSortDirBtn() {
    const btn = $h('sort-dir-btn');
    if (!btn) return;
    const dir = sortDir[currentSortKey] || 'asc';
    btn.textContent = dir === 'asc' ? '↑ Asc' : '↓ Desc';
    btn.title = dir === 'asc' ? 'Currently ascending — click to flip' : 'Currently descending — click to flip';
}

window.flipSortDir = function() {
    sortDir[currentSortKey] = (sortDir[currentSortKey] === 'asc') ? 'desc' : 'asc';
    updateSortDirBtn();
    window.filterProspects();
};

// Sort comparator — respects current direction
function sortCmp(a, b, key) {
    const dir = sortDir[key] || 'asc';
    let va, vb;
    switch (key) {
        case 'ceDate':      va=a.ceDate||'9999';      vb=b.ceDate||'9999';      break;
        case 'nextDate':    va=a.nextActionDate||'9999'; vb=b.nextActionDate||'9999'; break;
        case 'dateAdded':   va=a.addedAt||'';          vb=b.addedAt||'';          break;
        case 'batch':       va=a.batchNumber||'ZZZ';   vb=b.batchNumber||'ZZZ';   break;
        case 'score':       va=a.scannerScore||0;       vb=b.scannerScore||0;       break;
        case 'emailsSent':  va=a.emailsSent||0;         vb=b.emailsSent||0;         break;
        case 'company':     va=(a.company||'').toLowerCase(); vb=(b.company||'').toLowerCase(); break;
        case 'status':      va=a.status||'';            vb=b.status||'';            break;
        case 'funding':     va=a.fundingStage||'';      vb=b.fundingStage||'';      break;
        case 'readiness': {
            const order = {'ACTIVE':0,'SCHEDULED':1,'INTEL READY':2,'UNVERIFIED':3};
            va=order[getReadiness(a)]??4; vb=order[getReadiness(b)]??4; break;
        }
        default: va=a[key]||''; vb=b[key]||''; break;
    }
    let cmp = 0;
    if (typeof va === 'number') cmp = va - vb;
    else cmp = String(va).localeCompare(String(vb));
    return dir === 'asc' ? cmp : -cmp;
}

// ════════════════════════════════════════════════════════════════════════
// ═════════ BUILD HUNT TAB HTML ══════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════

function buildHuntTabHTML() {
    if (huntBuilt) return;
    const wrap = $h('tab-hunt');
    if (!wrap) return;
    huntBuilt = true;

    wrap.innerHTML = `
    <div id="hunt-hot-queue" class="hot-queue hidden" style="margin-bottom:16px;">
        <div class="hot-queue-header">
            <div style="display:flex;align-items:center;gap:8px;">
                <span style="font-size:9px;color:#ef4444;font-weight:800;letter-spacing:.12em;text-transform:uppercase;">🔥 HOT QUEUE</span>
                <span class="k-count" id="hq-count" style="background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.3);color:#ef4444;">0</span>
            </div>
            <span style="font-size:9px;color:var(--marble-faint);">Scanner completed / replied — needs action</span>
        </div>
        <div id="hq-rows"></div>
    </div>

    <div style="margin-bottom:16px;">
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:8px;">
            <input type="text" class="fi" placeholder="Search targets…" id="op-search"
                oninput="if(typeof window.filterProspects==='function')window.filterProspects()"
                style="flex:1 1 auto;min-width:180px;">
            <select class="fi" id="op-batch" onchange="if(typeof window.filterProspects==='function')window.filterProspects()" style="flex:0 0 auto;">
                <option value="">All Batches</option>
            </select>
            <select class="fi" id="op-status" onchange="if(typeof window.filterProspects==='function')window.filterProspects()" style="flex:0 0 auto;">
                <option value="">All Statuses</option>
                ${STATUSES.map(s=>`<option>${s}</option>`).join('')}
            </select>
            <select class="fi" id="op-sort"
                style="border-color:var(--gold);color:var(--gold);flex:0 0 auto;"
                onchange="currentSortKey=this.value;if(!sortDir[this.value])sortDir[this.value]='asc';updateSortDirBtn();window.filterProspects();">
                <option value="ceDate">Sort: CE Date</option>
                <option value="nextDate">Sort: Next Action</option>
                <option value="dateAdded">Sort: Date Added</option>
                <option value="batch">Sort: Batch</option>
                <option value="score">Sort: Scanner Score</option>
                <option value="emailsSent">Sort: Emails Sent</option>
                <option value="company">Sort: Company</option>
                <option value="status">Sort: Status</option>
                <option value="funding">Sort: Funding</option>
                <option value="readiness">Sort: Readiness</option>
            </select>
            <button id="sort-dir-btn" class="btn btn-outline" onclick="window.flipSortDir()"
                style="padding:6px 10px;font-size:10px;border-color:var(--gold);color:var(--gold);flex:0 0 auto;"
                title="Toggle sort direction">↑ Asc</button>
            <button class="adv-toggle" id="adv-toggle-btn" onclick="window.toggleAdvFilters(this)">▾ Advanced</button>
            <button class="btn btn-primary" onclick="if(typeof window.openAddProspect==='function')window.openAddProspect()">+ Add Lead</button>
            <button class="btn btn-outline" onclick="window.copyICPTable()" style="border-color:var(--gold);color:var(--gold);">📋 Copy List</button>
        </div>
        <div id="adv-filters-inner" class="hidden adv-filters-inner">
            <select class="fi" id="op-gap" onchange="if(typeof window.filterProspects==='function')window.filterProspects()">
                <option value="">Severity: All</option>
                <option value="NUCLEAR">🔴 Nuclear</option>
                <option value="CRITICAL">🟠 Critical</option>
                <option value="HIGH">🟡 High</option>
            </select>
            <select class="fi" id="op-ai" onchange="if(typeof window.filterProspects==='function')window.filterProspects()">
                <option value="">Archetype: All</option>
                ${['The Doers','The Orchestrators','The Creators','The Companions','The Readers','The Translators','The Judges','The Shields','The Movers','The Optimizers'].map(c=>`<option value="${c}">${c}</option>`).join('')}
            </select>
            <select class="fi" id="op-scanner" onchange="if(typeof window.filterProspects==='function')window.filterProspects()">
                <option value="">Scanner: All</option>
                <option value="clicked">Clicked 🔥</option>
                <option value="completed">Completed 🔥🔥</option>
                <option value="none">Not Yet</option>
            </select>
            <select class="fi" id="op-funding" onchange="if(typeof window.filterProspects==='function')window.filterProspects()">
                <option value="">Funding: All</option>
                ${['Pre-seed','Seed','Series A','Series B+','Bootstrapped'].map(s=>`<option>${s}</option>`).join('')}
            </select>
            <select class="fi" id="op-readiness" onchange="if(typeof window.filterProspects==='function')window.filterProspects()">
                <option value="">Readiness: All</option>
                <option value="ACTIVE">Active</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="INTEL READY">Intel Ready</option>
                <option value="UNVERIFIED">Unverified</option>
            </select>
        </div>
    </div>

    <div class="tbl-box" id="pipeline-box">
        <table>
            <thead>
                <tr>
                    <th>#</th>
                    <th onclick="toggleSort('company')" style="cursor:pointer;" title="Sort by company">
                        Prospect <span id="th-company-dir" style="font-size:9px;color:var(--gold);"></span>
                    </th>
                    <th onclick="toggleSort('company')" style="cursor:pointer;" title="Sort by company">
                        Company <span style="font-size:9px;color:var(--gold);"></span>
                    </th>
                    <th onclick="toggleSort('batch')" style="cursor:pointer;" title="Sort by batch">
                        Batch <span id="th-batch-dir" style="font-size:9px;color:var(--gold);"></span>
                    </th>
                    <th onclick="toggleSort('readiness')" style="cursor:pointer;" title="Sort by readiness">
                        Readiness <span id="th-readiness-dir" style="font-size:9px;color:var(--gold);"></span>
                    </th>
                    <th onclick="toggleSort('status')" style="cursor:pointer;" title="Sort by status">
                        Status <span id="th-status-dir" style="font-size:9px;color:var(--gold);"></span>
                    </th>
                    <th>Intel</th>
                    <th>Scanner + Spear</th>
                    <th onclick="toggleSort('ceDate')" style="cursor:pointer;" title="Sort by CE date">
                        CE Date <span id="th-ceDate-dir" style="font-size:9px;color:var(--gold);"></span>
                    </th>
                    <th onclick="toggleSort('emailsSent')" style="cursor:pointer;" title="Sort by emails sent">
                        Emails <span id="th-emailsSent-dir" style="font-size:9px;color:var(--gold);"></span>
                    </th>
                </tr>
            </thead>
            <tbody id="op-tbody"><tr><td colspan="10" class="loading">Loading...</td></tr></tbody>
        </table>
    </div>

    <div id="hunt-unscheduled" style="margin-top:20px;"></div>`;
}

// Update column header direction indicators
function updateColHeaders() {
    const cols = ['company','batch','readiness','status','ceDate','emailsSent'];
    cols.forEach(key => {
        const el = $h(`th-${key}-dir`);
        if (!el) return;
        if (key === currentSortKey) {
            el.textContent = sortDir[key] === 'asc' ? '↑' : '↓';
        } else {
            el.textContent = '';
        }
    });
}

window.loadOutreach = function() {
    const pa = $h('pageActions');
    if (pa) pa.innerHTML = '';
    buildHuntTabHTML();
    window.db.collection('settings').doc('config').get()
        .then(snap => { if(snap.exists) caseStudyUrl = snap.data().caseStudyVideoUrl||''; })
        .catch(()=>{});
    if (outreachListener) outreachListener();
    outreachListener = window.db.collection('prospects').onSnapshot(snap => {
        window.allProspects = [];
        snap.forEach(d => window.allProspects.push({ id:d.id, ...d.data() }));
        try { populateCommandCenter(); }                      catch(e){ console.error('CC',e); }
        try { window.renderDealsBoard(); }                    catch(e){ console.error('Deals',e); }
        try { renderHotQueue(); }                             catch(e){ console.error('HQ',e); }
        try { window.filterProspects(); }                     catch(e){ console.error('Hunt',e); }
        try { populateBatchFilter(); }                        catch(e){ console.error('Batch',e); }
        try { if(typeof window.refreshCalendar==='function') window.refreshCalendar(); } catch(e){ console.error('Cal',e); }
    }, e => { console.error(e); if(window.toast) window.toast('Outreach sync failed','error'); });
};

function renderHotQueue() {
    const wrap = $h('hunt-hot-queue');
    const rows = $h('hq-rows');
    const cnt  = $h('hq-count');
    if (!wrap || !rows) return;
    const hot = window.allProspects.filter(p => {
        if (['CONVERTED','DEAD','ARCHIVED'].includes(p.status)) return false;
        if (p.scannerCompleted && !['NEGOTIATING','CONVERTED'].includes(p.status)) return true;
        if (p.repliedAt && p.status === 'ENGAGED') return true;
        return false;
    });
    if (!hot.length) { wrap.classList.add('hidden'); return; }
    wrap.classList.remove('hidden');
    if (cnt) cnt.textContent = hot.length;
    rows.innerHTML = hot.map(p => {
        const fire  = p.scannerCompleted ? '🔥🔥 Scanner Completed — start NEG' : '🔥 Replied — set NEG-1 date';
        const diff  = p.nextActionDate ? daysDiff(p.nextActionDate) : null;
        const urgent= diff!==null && diff<=0 ? '<span style="color:#d47a7a;font-size:9px;font-weight:700;margin-left:8px;">⚠ ACTION NOW</span>' : '';
        return `<div class="hot-queue-row" onclick="window.openPP('${window.esc(p.id)}')">
            <div style="flex:1;min-width:0;">
                <span style="font-size:11px;font-weight:600;color:var(--marble);">${window.esc(p.founderName||p.name||'—')}</span>
                <span style="color:var(--marble-dim);"> · ${window.esc(p.company||'—')}</span>
                <span style="color:var(--gold);margin-left:8px;font-size:10px;">${fire}</span>${urgent}
            </div>
            <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();window.openPP('${window.esc(p.id)}')">Open →</button>
        </div>`;
    }).join('');
}

function populateCommandCenter() {
    let clicks=0, comps=0, paid=0, fuToday=0, fuOver=0, liPending=0;
    const today = todayStr();
    window.allProspects.forEach(p => {
        if (p.scannerClicked||p.scannerCompleted) clicks++;
        if (p.scannerCompleted) comps++;
        if (p.status==='CONVERTED') paid++;
        if (!['CONVERTED','DEAD','ARCHIVED'].includes(p.status)) {
            if (p.nextActionDate===today) fuToday++;
            if (p.nextActionDate && p.nextActionDate<today) fuOver++;
            if (['pending','connected_no_reply'].includes(p.linkedinStatus)) liPending++;
        }
    });
    const setText = window.setText||((id,v)=>{const e=$h(id);if(e)e.textContent=String(v??'');});
    setText('sf-clicks',clicks); setText('sf-comps',comps); setText('sf-paid',paid);
    setText('sf-rate', clicks>0?Math.round((paid/clicks)*100)+'% Conversion':'— Conversion');
    let cold=0, warm=0, hot=0;
    window.allProspects.forEach(p=>{
        if(p.status==='QUEUED'||p.status==='SEQUENCE') cold++;
        else if(p.status==='ENGAGED')     warm++;
        else if(p.status==='NEGOTIATING') hot++;
    });
    setText('of-cold',cold); setText('of-warm',warm); setText('of-hot',hot); setText('of-replied',0); setText('of-neg',0);
    setText('aq-today',fuToday); setText('aq-over',fuOver); setText('aq-li',liPending);
    let mrr=0;
    window.allProspects.forEach(p=>{if(p.maintenanceActive)mrr+=297;});
    setText('d-mrr',window.fmtMoney?window.fmtMoney(mrr):'$'+mrr);
    window.db.collection('leads').where('status','in',['new','scanner_submitted']).get()
        .then(snap=>setText('aq-inbound',snap.size)).catch(()=>{});
    renderBatchPerformance();
}

window.populateBatchFilter = function() {
    const sel = $h('op-batch');
    if (!sel) return;
    const cur = sel.value;
    while (sel.options.length > 1) sel.remove(1);
    [...new Set(window.allProspects.map(p=>p.batchNumber).filter(Boolean))].sort().forEach(b => {
        const o=document.createElement('option'); o.value=b; o.textContent=b; sel.appendChild(o);
    });
    if (cur) sel.value = cur;
};

function renderBatchPerformance() {
    const tbodies = document.querySelectorAll('#oc-batches, #cc-batches');
    if (!tbodies.length) return;
    const batches = {};
    window.allProspects.forEach(p => {
        const b = p.batchNumber||'Unassigned';
        if (!batches[b]) batches[b]={p:0,e:0,cl:0,co:0,cv:0,rep:0};
        batches[b].p++;
        batches[b].e += p.emailsSent||0;
        if (p.scannerClicked||p.scannerCompleted) batches[b].cl++;
        if (p.scannerCompleted) batches[b].co++;
        if (p.status==='CONVERTED') batches[b].cv++;
        if (p.repliedAt) batches[b].rep++;
    });
    const keys = Object.keys(batches).sort();
    const html = !keys.length
        ? '<tr><td colspan="10" class="loading">No batches yet</td></tr>'
        : keys.map((b,i)=>{
            const r=batches[b];
            const roi  = r.co>0?Math.round((r.cv/r.co)*100)+'%':'0%';
            const repR = r.p>0?Math.round((r.rep/r.p)*100)+'%':'0%';
            const capC = r.p>=BATCH_LIMIT?'#ef4444':r.p>=BATCH_LIMIT-5?'#f97316':'var(--marble-dim)';
            const capT = r.p>=BATCH_LIMIT?'FULL':`${r.p}/${BATCH_LIMIT}`;
            return `<tr><td class="dim" style="font-size:10px;text-align:center;">${i+1}</td>
                <td>${window.esc(b)}</td>
                <td><span style="font-size:10px;font-weight:600;color:${capC}">${capT}</span></td>
                <td>${r.p}</td><td>${r.e}</td><td style="color:var(--marble-dim)">${repR}</td>
                <td>${r.cl}</td><td>${r.co}</td><td>${r.cv}</td>
                <td style="color:var(--gold)">${roi}</td></tr>`;
        }).join('');
    tbodies.forEach(tb=>tb.innerHTML=html);
}

function getFilteredSortedProspects() {
    const s   = ($h('op-search')?.value  ||'').toLowerCase();
    const st  = $h('op-status')?.value   ||'';
    const bt  = $h('op-batch')?.value    ||'';
    const fs  = $h('op-funding')?.value  ||'';
    const sc  = $h('op-scanner')?.value  ||'';
    const gap = $h('op-gap')?.value      ||'';
    const ai  = $h('op-ai')?.value       ||'';
    const rd  = $h('op-readiness')?.value||'';
    const srt = currentSortKey || ($h('op-sort')?.value || 'ceDate');

    let list = window.allProspects.filter(p => {
        if (p.status==='DEAD') return false;
        if (s && ![(p.founderName||''),(p.name||''),(p.company||''),(p.email||''),(p.prospectId||'')].some(v=>v.toLowerCase().includes(s))) return false;
        if (st && p.status!==st) return false;
        if (bt && p.batchNumber!==bt) return false;
        if (fs && p.fundingStage!==fs) return false;
        if (sc==='clicked'   && !(p.scannerClicked&&!p.scannerCompleted)) return false;
        if (sc==='completed' && !p.scannerCompleted) return false;
        if (sc==='none'      && (p.scannerClicked||p.scannerCompleted)) return false;
        if (gap) { if (!getAllGaps(p).some(g=>(g.severity||'').toUpperCase()===gap)) return false; }
        if (ai)  {
            // V7.0: check primaryArchetype + internalCategory + legacy intArchetypes
            const archs = [...(p.primaryArchetype||[]), ...(p.intArchetypes||[])];
            if (!archs.some(a=>a.toLowerCase().includes(ai.toLowerCase().replace('the ',''))) && p.internalCategory!==ai) return false;
        }
        if (rd && getReadiness(p)!==rd) return false;
        return true;
    });

    list.sort((a,b) => sortCmp(a, b, srt));
    return list;
}

window.filterProspects = function() {
    const list = getFilteredSortedProspects();
    renderPipeline(list);
    renderUnscheduled();
    updateColHeaders();
    updateSortDirBtn();
};

function renderPipeline(list) {
    const tbodies = document.querySelectorAll('#op-tbody');
    if (!tbodies.length) return;
    const filtered = list.filter(p=>p.status!=='DEAD');
    const html = !filtered.length
        ? '<tr><td colspan="10" class="loading">No prospects match the current filters</td></tr>'
        : filtered.map((p,i) => {
            const fire   = p.scannerCompleted?'🔥🔥':p.scannerClicked?'🔥':'';
            const nuclear= getAllGaps(p).some(g=>(g.severity||'').toUpperCase()==='NUCLEAR');
            const scanBadge = p.scannerCompleted
                ? `<span class="badge b-delivered" style="font-size:8px">Completed</span>`
                : p.scannerClicked
                    ? `<span class="badge b-warm" style="font-size:8px">Clicked</span>`
                    : `<span class="badge b-ghost" style="font-size:8px">—</span>`;
            const spearBtn = `<button class="btn btn-ghost btn-sm" style="padding:2px 6px;font-size:9px;color:var(--gold);"
                onclick="event.stopPropagation();window.copySpearReport('${window.esc(p.id)}')"
                title="${p.scannerCompleted?'NEG Mode':'COLD Mode'} Spear">🎯</button>`;
            return `<tr onclick="window.openPP('${window.esc(p.id)}')">
                <td class="dim" style="font-size:10px;text-align:center;">${i+1}</td>
                <td>
                    <div style="font-size:11px;font-weight:600;">${window.esc(p.founderName||p.name||'—')}${nuclear?' <span style="color:#ef4444;font-size:9px;">🔴</span>':''}</div>
                    <div style="font-size:9px;color:var(--gold);font-family:'Cormorant Garamond',serif;">${window.esc(p.prospectId||'')}</div>
                </td>
                <td class="dim" style="font-size:10px;">${window.esc(p.company||'—')}</td>
                <td class="dim" style="font-size:10px;">${window.esc(p.batchNumber||'—')}</td>
                <td>${readinessBadge(p)}</td>
                <td>${statusBadgeHtml(p.status)} ${p.sequenceStep?`<span class="badge b-ghost" style="font-size:8px">${p.sequenceStep}</span>`:''}</td>
                <td>${intelCell(p)}</td>
                <td style="white-space:nowrap;">${scanBadge} <span class="hot-flag">${fire}</span> ${spearBtn}</td>
                <td>${ceDateCell(p)}</td>
                <td class="dim">${p.emailsSent||0}</td>
            </tr>`;
        }).join('');
    tbodies.forEach(tb=>tb.innerHTML=html);
}

function renderUnscheduled() {
    const el = $h('hunt-unscheduled');
    if (!el) return;
    const unsch = window.allProspects.filter(p =>
        ['QUEUED','SEQUENCE'].includes(p.status) && !p.ceDate
    ).sort((a,b) => sortCmp(a,b,currentSortKey));
    if (!unsch.length) { el.innerHTML=''; return; }
    const rows = unsch.map((p,i) => `
    <div style="display:flex;align-items:center;gap:12px;padding:9px 14px;border-bottom:1px solid rgba(197,160,89,.05);font-size:11px;flex-wrap:wrap;cursor:pointer;" onclick="window.openPP('${window.esc(p.id)}')">
        <span style="color:var(--marble-faint);font-size:10px;width:24px;text-align:right;">${i+1}</span>
        <span style="font-weight:600;color:var(--marble);flex:1;">${window.esc(p.founderName||p.name||'—')}</span>
        <span class="dim" style="flex:1;">${window.esc(p.company||'—')}</span>
        <span class="dim" style="flex:1;">${window.esc(p.batchNumber||'—')}</span>
        ${readinessBadge(p)}
        <button class="btn btn-outline btn-sm" onclick="event.stopPropagation();if(typeof window.calPromptCEDate==='function')window.calPromptCEDate('${window.esc(p.id)}')">Set CE Date →</button>
    </div>`).join('');
    el.innerHTML = `
    <div class="cal-unscheduled-divider">UNSCHEDULED (${unsch.length})</div>
    <div style="border:1px solid var(--border);">${rows}</div>`;
}

window.renderDealsBoard = function() {
    const cols={1:[],2:[],3:[],4:[],5:[]};
    window.allProspects.forEach(p=>{
        if(p.status==='DEAD'||p.status==='ARCHIVED') return;
        if      (p.status==='CONVERTED')    cols[5].push(p);
        else if (p.status==='NEGOTIATING')  cols[4].push(p);
        else if (p.status==='ENGAGED')      cols[3].push(p);
        else if (p.status==='SEQUENCE')     cols[2].push(p);
        else                                cols[1].push(p);
    });
    if (window.allFlagship) {
        window.allFlagship.forEach(f=>{
            if(f.status==='Lost') return;
            if(f.status==='Won')             cols[5].push(f);
            else if(f.status==='Identified') cols[1].push(f);
            else                             cols[4].push(f);
        });
    }
    const today = todayStr();
    for (let i=1;i<=5;i++) {
        const els  = document.querySelectorAll('#kd-col-'+i);
        const cnts = document.querySelectorAll('#kd-c'+i);
        if (!els.length) continue;
        cnts.forEach(c=>c.innerText=cols[i].length);
        cols[i].sort((a,b)=>(a.nextActionDate||'9999').localeCompare(b.nextActionDate||'9999'));
        const html = !cols[i].length
            ? '<div class="empty" style="padding:20px;border:none">Empty</div>'
            : cols[i].map(c=>{
                const isFs=c.priceQuoted!==undefined;
                const nd=c.nextActionDate||'';
                const over=nd&&nd<today; const tod=nd===today;
                const ds=over?'color:#d47a7a;font-weight:600':tod?'color:var(--gold)':'color:var(--marble-faint)';
                const dt=over?'⚠ '+nd:tod?'★ Today':nd||'No date';
                const fn=isFs?`window.openFSP('${window.esc(c.id)}')`:`window.openPP('${window.esc(c.id)}')`;
                const fire=!isFs&&c.scannerCompleted?'🔥🔥 ':!isFs&&c.scannerClicked?'🔥 ':isFs?'◆ ':'';
                return `<div class="k-card" onclick="${fn}">
                    <div class="k-name">${fire}${window.esc(c.founderName||c.name||'Unknown')}</div>
                    <div class="k-comp">${window.esc(c.company||'—')}</div>
                    <div class="k-meta"><span style="${ds};font-size:9px">${window.esc(dt)}</span></div>
                </div>`;
            }).join('');
        els.forEach(el=>el.innerHTML=html);
    }
};

window.loadLeads = function() {
    const tbodies = document.querySelectorAll('#l-tbody');
    tbodies.forEach(tb=>tb.innerHTML='<tr><td colspan="11" class="loading">Loading inbound leads…</td></tr>');
    window.db.collection('leads').orderBy('updatedAt','desc').limit(100).get().then(snap=>{
        const leads=[]; snap.forEach(d=>leads.push({id:d.id,...d.data()}));
        const sClass={new:'b-ghost',scanner_submitted:'b-warm',hot_lead:'b-hot',converted:'b-delivered',cold_lead:'b-cold'};
        const html=!leads.length?'<tr><td colspan="11" class="loading">No inbound leads yet</td></tr>'
            :leads.map((l,i)=>`<tr>
                <td class="dim" style="font-size:10px;text-align:center;">${i+1}</td>
                <td>${window.esc(l.name||'—')}</td>
                <td class="dim">${window.esc(l.email||'—')}</td>
                <td class="dim">${window.esc(l.company||'—')}</td>
                <td><span class="badge b-ghost">${window.esc(l.leadType||'—')}</span></td>
                <td><span class="badge ${sClass[l.status]||'b-ghost'}">${window.esc(l.status||'—')}</span></td>
                <td class="dim">${window.esc(l.source||'—')}</td>
                <td class="dim">${l.scannerExternalScore||'—'}</td>
                <td class="dim">${l.scannerInternalScore||'—'}</td>
                <td class="dim">${fmtDate(l.updatedAt||l.createdAt)}</td>
                <td onclick="event.stopPropagation()" style="white-space:nowrap">
                    ${l.status!=='converted'
                        ?`<button class="btn btn-primary btn-sm" onclick="window.convertLead('${window.esc(l.id)}')">Convert</button>`
                        :'<span class="dim">Converted</span>'}
                </td>
            </tr>`).join('');
        tbodies.forEach(tb=>tb.innerHTML=html);
    }).catch(e=>{
        console.error(e);
        tbodies.forEach(tb=>tb.innerHTML='<tr><td colspan="11" class="loading" style="color:#d47a7a">Failed to load</td></tr>');
    });
};

window.openPP = function(id) {
    const p = window.allProspects.find(x=>x.id===id);
    if (!p) return;
    window.currentProspect = p;
    const pp = $h('prospectPanel');
    if (pp) { pp.style.maxWidth='100%'; pp.style.width='100%'; pp.style.left='0'; pp.classList.add('open'); }
    const setText = window.setText||((id,v)=>{const e=$h(id);if(e)e.textContent=String(v??'');});
    setText('pp-name', p.founderName||p.name||'—');
    setText('pp-meta', `${p.company||'—'} · ${p.email||'—'} · ${p.prospectId||'—'}`);
    renderPPBody(p);
};

window.closePP = function() { window.currentProspect=null; $h('prospectPanel')?.classList.remove('open'); };

// ════════════════════════════════════════════════════════════════════════
// ═════════ PROSPECT PANEL BODY — V7.0 PATCHED ═══════════════════════════
// ════════════════════════════════════════════════════════════════════════
function renderPPBody(p) {
    const body = $h('pp-body');
    if (!body) return;
    const scanLink = p.scannerLink||`https://lexnovahq.com/scanner.html?pid=${p.prospectId||''}`;
    const allGaps  = getAllGaps(p);
    const sevColor = g => (g.severity||'').toUpperCase()==='NUCLEAR'?'#ef4444':'#f97316';

    // ── V7.0: primary product callout ──────────────────────────────────
    let primaryProductHtml = '';
    if (p.primaryProduct) {
        primaryProductHtml = `
        <div style="padding:10px 12px;background:rgba(197,160,89,0.05);border:1px solid rgba(197,160,89,0.2);border-radius:4px;margin-bottom:8px;">
            <div style="font-size:9px;color:var(--gold);font-weight:700;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px;">Primary Product</div>
            <div style="font-size:11px;color:var(--marble);line-height:1.5;">${window.esc(p.primaryProduct)}</div>
        </div>`;
    }

    // ── V7.0: archetypes — primaryArchetype first, intArchetypes fallback ──
    const archetypesDisplay = (p.primaryArchetype||p.intArchetypes||[]).join(', ') || p.internalCategory || '—';

    // ── V7.0: EXT — externalCategory string first, extExposures array fallback ──
    const extDisplay = p.externalCategory || (p.extExposures||[]).join(', ') || '—';

    // ── V7.0: feature map — featureMap first, productSignal array fallback ──
    const featureArr = p.featureMap?.length > 0
        ? p.featureMap
        : Array.isArray(p.productSignal) ? p.productSignal : [];

    const psHtml = featureArr.length > 0
        ? featureArr.map(f=>`• ${window.esc(f.feature||'—')} <span style="color:#555;font-size:9px;">[${f.intCode||f.triggersInt||'—'}]</span>`).join('<br>')
        : typeof p.productSignal === 'string' ? window.esc(p.productSignal||'—') : '—';

    // ── V7.0: gaps html ────────────────────────────────────────────────
    let gapsHtml = '';
    if (allGaps.length) {
        const ks  = allGaps[0];
        const ksc = sevColor(ks);
        // V7.0: EXT display for kill shot
        const ksExt = fmtExtArr(ks.extSurfaces || ks.ext);
        gapsHtml += `
        <div style="border:1px solid ${ksc};background:rgba(239,68,68,0.04);padding:12px;border-left:4px solid ${ksc};margin-bottom:10px;border-radius:4px;">
            <div style="color:${ksc};font-size:9px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;margin-bottom:5px;">🎯 Kill Shot (${ks.severity})</div>
            <div style="font-size:12px;font-weight:700;color:var(--marble);margin-bottom:4px;">${window.esc(getGapName(ks))}</div>
            <div style="font-size:10px;color:var(--marble-dim);margin-bottom:3px;">${window.esc(ks.thePain||ks.plain||'—')}</div>
            ${ks.legalAmmo?`<div style="font-size:10px;color:var(--marble-faint);">${window.esc(ks.legalAmmo)}</div>`:''}
            ${(ks.evidence?.found||ks.evidence?.source||ks.evidence?.reason||ks.evidence?.connection) ? `
            <div style="font-size:10px;background:#050505;border:1px solid #1a1a1a;padding:7px;margin-top:7px;font-family:monospace;">
                ${(ks.evidence.found||ks.evidence.source)?`<div style="color:var(--gold);font-size:9px;">FOUND: ${window.esc(ks.evidence.found||ks.evidence.source)}</div>`:''}
                ${(ks.evidence.connection||ks.evidence.reason)?`<div style="color:#ccc;font-size:9px;margin-top:2px;">WHY: ${window.esc(ks.evidence.connection||ks.evidence.reason)}</div>`:''}
            </div>`:''}
            ${ks.feature_to_cite?`<div style="font-size:10px;padding:6px 8px;background:rgba(197,160,89,0.04);border:1px solid rgba(197,160,89,0.15);border-radius:3px;margin-top:6px;"><strong style="color:var(--gold)">Feature: </strong>${window.esc(ks.feature_to_cite)}</div>`:''}
            <div style="font-size:10px;color:${ksc};margin-top:7px;font-weight:600;">${window.esc(ksExt)} · ${velDisplay(ks.velocity)}</div>
        </div>`;

        if (allGaps.length>1) {
            gapsHtml+=`<div style="font-size:9px;color:var(--marble-dim);text-transform:uppercase;letter-spacing:.1em;margin-bottom:7px;">${allGaps.length-1} more gap${allGaps.length-1!==1?'s':''}</div>`;
            gapsHtml+=`<div style="max-height:260px;overflow-y:auto;display:flex;flex-direction:column;gap:5px;">`;
            allGaps.slice(1).forEach(g=>{
                const col=sevColor(g);
                const gExt=fmtExtArr(g.extSurfaces||g.ext);
                const src=g.source==='dual-verified'?'<span style="font-size:8px;color:#d47a7a;font-weight:700">DUAL</span>':
                    g.source==='scrape'||g.evidence?'<span style="font-size:8px;color:#60a5fa;font-weight:700">SCRAPE</span>':
                    '<span style="font-size:8px;color:var(--gold);font-weight:700">SCANNER</span>';
                gapsHtml+=`<div style="background:var(--surface2);border:1px solid var(--border);border-left:3px solid ${col};padding:9px;border-radius:3px;">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:3px;gap:6px;flex-wrap:wrap;">
                        <span style="font-size:10px;font-weight:600;color:var(--marble);flex:1;">${window.esc(getGapName(g))}</span>
                        <span style="display:flex;gap:4px;flex-shrink:0;">
                            <span style="font-size:9px;color:${col};font-weight:700">${g.severity||'—'}</span>${src}
                        </span>
                    </div>
                    <div style="font-size:10px;color:var(--marble-dim);">${window.esc(g.thePain||g.plain||'—')}</div>
                    <div style="font-size:9px;color:var(--marble-faint);margin-top:2px;">${window.esc(gExt)} · ${window.esc(g.theFix||g.doc||'—')} · ${velDisplay(g.velocity)}</div>
                    ${(g.evidence?.connection||g.evidence?.reason)?`<div style="font-size:9px;color:#777;margin-top:3px;font-style:italic;">${window.esc(g.evidence.connection||g.evidence.reason)}</div>`:''}
                    ${g.feature_to_cite?`<div style="font-size:9px;padding:4px 7px;background:rgba(197,160,89,0.04);border:1px solid rgba(197,160,89,0.12);border-radius:3px;margin-top:4px;color:#bbb;"><strong style="color:var(--gold)">Feature: </strong>${window.esc(g.feature_to_cite)}</div>`:''}
                </div>`;
            });
            gapsHtml+=`</div>`;
        }
    } else {
        gapsHtml=`<div class="empty" style="border:1px dashed var(--border);padding:14px;text-align:center;font-size:11px;">No gaps detected yet</div>`;
    }

    // ── V7.0: viability flags — dual-read ──────────────────────────────
    let viabilityHtml='';
    const vf=p.viabilityFlags;
    if (vf) {
        const gi=ok=>ok===true?'<span style="color:#7ab88a">✓</span>':ok===false?'<span style="color:#d47a7a">✗</span>':'<span style="color:var(--marble-faint)">?</span>';
        const rc=vf.recommendation==='PUSH'?'#7ab88a':'#d4a850';
        viabilityHtml=`<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);">
            <div style="font-size:9px;letter-spacing:.15em;color:var(--marble-faint);text-transform:uppercase;margin-bottom:7px;">Viability Gates</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;font-size:10px;margin-bottom:7px;">
                <div>${gi(vfGet(vf,'productFit'))} <span style="color:var(--marble-dim);">G1 Product Fit</span></div>
                <div>${gi(vfGet(vf,'gapSeverity'))} <span style="color:var(--marble-dim);">G2 Gap Severity</span></div>
                <div>${gi(vfGet(vf,'contactComplete'))} <span style="color:var(--marble-dim);">G3 Contact</span></div>
                <div style="font-size:9px;color:var(--marble-faint);">G4: ${window.esc(vfReason(vf,'funding')||'—')}</div>
            </div>
            <div style="font-size:10px;font-weight:700;color:${rc};">${window.esc(vf.recommendation||'—')}${vf.reason?' — '+window.esc(vf.reason):''}</div>
        </div>`;
    }

    const fuDisplay = p.fu1Date ? `
    <div style="font-size:10px;color:var(--marble-dim);margin-top:6px;line-height:1.9;background:var(--surface2);border:1px solid var(--border);padding:8px;">
        <span style="color:var(--marble-faint);font-size:9px;text-transform:uppercase;letter-spacing:.1em;">Auto-calc FU dates</span><br>
        FU1 <span style="color:var(--gold)">${fmtShort(p.fu1Date)}</span>
        &nbsp;·&nbsp; FU2 <span style="color:var(--gold)">${fmtShort(p.fu2Date)}</span>
        &nbsp;·&nbsp; FU3 <span style="color:var(--gold)">${fmtShort(p.fu3Date)}</span>
        &nbsp;·&nbsp; FU4 <span style="color:var(--gold)">${fmtShort(p.fu4Date)}</span>
    </div>` : '';

    const logRows = (p.emailLog||[]).slice().reverse().map(e=>
        `<div style="display:flex;gap:10px;padding:5px 0;border-bottom:1px solid rgba(197,160,89,.06);font-size:10px;flex-wrap:wrap;">
            <span style="color:var(--marble-faint);flex-shrink:0;width:76px">${window.esc(e.date||'—')}</span>
            <span style="color:var(--gold);flex-shrink:0;width:90px;font-weight:600">${window.esc(e.type||'—')}</span>
            <span style="color:var(--marble-dim);flex:1;word-break:break-word">${window.esc(e.notes||'')}</span>
        </div>`
    ).join('')||'<div style="font-size:10px;color:var(--marble-faint)">No emails logged</div>';

    const planSel   = Object.entries(PLANS).map(([k,v])=>`<option value="${k}" ${p.intendedPlan===k?'selected':''}>${v}</option>`).join('');
    const statusSel = STATUSES.map(s=>`<option value="${s}" ${p.status===s?'selected':''}>${s}</option>`).join('');

    body.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--border);gap:10px;flex-wrap:wrap;">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <input type="text" class="fi" id="pp-scanner-url" readonly value="${window.esc(scanLink)}" style="font-size:10px;color:var(--gold);width:280px;background:var(--void);border-color:var(--gold-mid);">
            <button class="btn btn-outline btn-sm" onclick="window.copyToClipboard('pp-scanner-url')">Copy</button>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button class="btn btn-outline btn-sm" onclick="window.copyHunterPayload('${window.esc(p.id)}')" title="Copy minimal payload for Hunter">🔍 Hunter</button>
            <button class="btn btn-outline btn-sm" onclick="window.copySpearReport('${window.esc(p.id)}')">🎯 Spear</button>
            <button class="btn btn-primary btn-sm" onclick="window.copyDossier('${window.esc(p.id)}')">📋 Dossier</button>
        </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;height:calc(100vh - 180px);overflow:hidden;">
        <div style="overflow-y:auto;padding-right:6px;display:flex;flex-direction:column;gap:12px;">
            <div class="card" style="padding:14px;">
                <div style="font-size:9px;color:var(--gold);text-transform:uppercase;letter-spacing:.1em;font-weight:700;margin-bottom:10px;">Intel Brief</div>
                ${primaryProductHtml}
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
                    <div><label class="fl">Core Archetypes</label>
                        <div style="font-size:10px;color:var(--marble);">${window.esc(archetypesDisplay)}</div>
                    </div>
                    <div><label class="fl">EXT Exposures</label>
                        <div style="font-size:10px;color:#ef4444;font-weight:600">${window.esc(extDisplay)}</div>
                    </div>
                </div>
                <div style="margin-bottom:8px;">
                    <label class="fl">Verdict</label>
                    <div style="font-size:10px;color:${p.verdict==='GREEN LIGHT'?'#7ab88a':p.verdict==='RED LIGHT'?'#d47a7a':'var(--gold)'};">
                        ${window.esc(p.verdict||'—')}${p.verdictReason?' — '+window.esc(p.verdictReason):''}
                    </div>
                </div>
                <div style="margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid var(--border);">
                    <label class="fl">Feature Map</label>
                    <div style="font-size:10px;color:var(--marble-dim);line-height:1.5;">${psHtml}</div>
                </div>
                ${viabilityHtml}
                <div style="font-size:9px;color:var(--marble-dim);text-transform:uppercase;letter-spacing:.1em;margin:10px 0 8px;">${allGaps.length} Gap${allGaps.length!==1?'s':''} Detected</div>
                ${gapsHtml}
            </div>
        </div>

        <div style="overflow-y:auto;padding-right:6px;display:flex;flex-direction:column;gap:12px;">
            <div class="card" style="padding:14px;">
                <div style="font-size:9px;color:var(--gold);text-transform:uppercase;letter-spacing:.1em;font-weight:700;margin-bottom:12px;">Logistics</div>
                <div class="fi-row" style="margin-bottom:10px;">
                    <div class="fg" style="margin:0;"><label class="fl">Status</label>
                        <select class="fi" id="pp-status" style="border-color:var(--gold);color:var(--gold);font-weight:600;">${statusSel}</select>
                    </div>
                    <div class="fg" style="margin:0;"><label class="fl">Plan</label>
                        <select class="fi" id="pp-plan">${planSel}</select>
                    </div>
                </div>
                <div class="fi-row" style="margin-bottom:8px;">
                    <div class="fg" style="margin:0;"><label class="fl">Founder</label><input type="text" class="fi" id="pp-name-edit" value="${window.esc(p.founderName||p.name||'')}"></div>
                    <div class="fg" style="margin:0;"><label class="fl">Company</label><input type="text" class="fi" id="pp-company-edit" value="${window.esc(p.company||'')}"></div>
                </div>
                <div class="fi-row" style="margin-bottom:8px;">
                    <div class="fg" style="margin:0;"><label class="fl">Email</label><input type="email" class="fi" id="pp-email-edit" value="${window.esc(p.email||'')}"></div>
                    <div class="fg" style="margin:0;"><label class="fl">LinkedIn</label><input type="text" class="fi" id="pp-linkedin-edit" value="${window.esc(p.linkedinUrl||'')}"></div>
                </div>
                <div class="fi-row" style="margin-bottom:8px;">
                    <div class="fg" style="margin:0;"><label class="fl">Funding</label>
                        <select class="fi" id="pp-funding-text">${['','Pre-seed','Seed','Series A','Series B+','Bootstrapped'].map(s=>`<option value="${s}" ${p.fundingStage===s?'selected':''}>${s||'—'}</option>`).join('')}</select>
                    </div>
                    <div class="fg" style="margin:0;"><label class="fl">Headcount</label><input type="text" class="fi" id="pp-headcount" value="${window.esc(p.headcount||'')}"></div>
                </div>
                <div class="fi-row" style="margin-bottom:8px;">
                    <div class="fg" style="margin:0;"><label class="fl">Batch</label><input type="text" class="fi" id="pp-batch-edit" value="${window.esc(p.batchNumber||'')}" placeholder="e.g. 03A"></div>
                    <div class="fg" style="margin:0;"><label class="fl">Geography</label><input type="text" class="fi" id="pp-geo-edit" value="${window.esc(p.jurisdiction||p.registrationJurisdiction||p.geography||'')}"></div>
                </div>
                <div style="border-top:1px solid var(--border);padding-top:10px;margin-top:4px;margin-bottom:10px;">
                    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:6px;">
                        <label class="fl" style="margin:0">CE Date</label>
                        <button class="btn btn-ghost btn-sm" style="font-size:9px;color:var(--gold);" onclick="window.ppRecalcFUDates()">↺ Recalc FU1–FU4</button>
                    </div>
                    <input type="date" class="fi" id="pp-ce-date" value="${p.ceDate||''}">
                    ${fuDisplay}
                </div>
                <div class="fg" style="margin-bottom:12px;"><label class="fl">Notes</label>
                    <textarea class="fi" id="pp-notes" rows="2">${window.esc(p.notes||'')}</textarea>
                </div>
                <button class="btn btn-primary btn-full" style="padding:12px;margin-bottom:8px;" onclick="window.saveProspect()">💾 Save Dossier</button>
                <div style="display:flex;gap:8px;margin-bottom:12px;">
                    <button class="btn btn-outline" style="flex:1;padding:9px;border-color:#d4a850;color:#d4a850;" onclick="window.pivotToFlagship()">💎 Flagship</button>
                    <button class="btn btn-outline" style="flex:1;padding:9px;border-color:#7ab88a;color:#7ab88a;" onclick="window.archiveProspect()">📦 Archive</button>
                </div>
                <div style="text-align:center;border-top:1px dashed rgba(138,58,58,.3);padding-top:10px;">
                    <button class="btn btn-danger btn-sm" onclick="window.deleteProspect('${window.esc(p.prospectId||p.id)}')">Permanently Delete</button>
                </div>
            </div>

            <div class="card" style="padding:14px;">
                <div style="font-size:9px;color:var(--gold);text-transform:uppercase;letter-spacing:.1em;font-weight:700;margin-bottom:10px;">Comm Log (${p.emailsSent||0} emails)</div>
                <div style="background:var(--void);border:1px solid var(--border);padding:8px;max-height:100px;overflow-y:auto;margin-bottom:10px;">${logRows}</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
                    <input type="date" class="fi" id="pp-log-date" value="${todayStr()}" style="padding:6px;font-size:10px;">
                    <select class="fi" id="pp-log-type" style="padding:6px;font-size:10px;">
                        ${Object.values(STEP_LABELS).concat(['Reply','Scanner Link Sent','NEG Touch','LinkedIn DM','Note']).map(t=>`<option>${t}</option>`).join('')}
                    </select>
                </div>
                <div style="display:flex;gap:8px;">
                    <input type="text" class="fi" id="pp-manual-log" placeholder="Quick log note…" style="padding:6px;font-size:10px;flex:1;">
                    <button class="btn btn-outline" style="padding:6px 12px;font-size:9px;" onclick="window.logEmail()">+ Log</button>
                </div>
            </div>
        </div>
    </div>`;
}

window.ppRecalcFUDates = function() {
    const p  = window.currentProspect;
    if (!p) return;
    const cd = $h('pp-ce-date')?.value;
    if (!cd) { if(window.toast) window.toast('Set CE date first','error'); return; }
    if (typeof window.calSetCEDate === 'function') {
        window.calSetCEDate(p.id, cd, false);
    } else {
        const add = (date, n) => { const x=new Date(date+'T00:00:00'); x.setDate(x.getDate()+n); return x.toISOString().split('T')[0]; };
        const fu1=add(cd,4), fu2=add(fu1,4), fu3=add(fu2,5), fu4=add(fu3,5);
        window.db.collection('prospects').doc(p.prospectId||p.id)
            .update({ ceDate:cd, fu1Date:fu1, fu2Date:fu2, fu3Date:fu3, fu4Date:fu4, nextActionDate:cd, updatedAt:nowTs() })
            .then(()=>{ Object.assign(p,{ceDate:cd,fu1Date:fu1,fu2Date:fu2,fu3Date:fu3,fu4Date:fu4}); renderPPBody(p); if(window.toast)window.toast('FU dates calculated'); })
            .catch(()=>{ if(window.toast)window.toast('Save failed','error'); });
    }
};

window.copyHunterPayload = async function(id) {
    const p = window.allProspects.find(x=>x.id===id);
    if (!p) return;
    const text = `COMPANY: ${p.company||'—'}\nWEBSITE: ${p.website||'—'}\nARCHETYPE HINT: ${(p.primaryArchetype||p.intArchetypes||[]).join(', ')||'—'}\nGEO: ${p.jurisdiction||p.registrationJurisdiction||p.geography||'—'}\nFUNDING: ${p.fundingStage||'—'}`;
    try { await navigator.clipboard.writeText(text); if(window.toast) window.toast('Hunter payload copied'); }
    catch { if(window.toast) window.toast('Copy failed','error'); }
};

window.advanceSequence = async function() {
    const p = window.currentProspect;
    if (!p) return;
    const currentStep = p.sequenceStep||'C';
    const sentLabel   = p.status==='QUEUED'?'Cold Email':(STEP_LABELS[currentStep]||currentStep);
    const nextStep    = STEP_NEXT[currentStep];
    const newDate     = nextStep ? datePlusDays(STEP_INTERVALS[currentStep]) : datePlusDays(2);
    const logEntry = { date:todayStr(), type:sentLabel, notes:`${sentLabel} sent` };
    const updates  = {
        sequenceStep: nextStep||currentStep, status:'SEQUENCE',
        emailsSent:   (p.emailsSent||0)+1,
        emailLog:     [...(p.emailLog||[]),logEntry],
        nextActionDate: newDate, updatedAt: nowTs()
    };
    if (!nextStep) {
        if (!confirm('FU4 sent. Archive for revival in '+nextQuarter()+'?')) return;
        await archiveProspectById(p.id); return;
    }
    try {
        await window.db.collection('prospects').doc(p.prospectId||p.id).update(updates);
        Object.assign(window.currentProspect, updates);
        const idx = window.allProspects.findIndex(x=>x.id===p.id);
        if (idx!==-1) window.allProspects[idx]=window.currentProspect;
        if(window.toast) window.toast(`${sentLabel} logged`);
        renderPPBody(window.currentProspect);
    } catch(e) { console.error(e); if(window.toast) window.toast('Advance failed','error'); }
};

window.logEmail = async function() {
    const p = window.currentProspect;
    if (!p) return;
    const note  = $h('pp-manual-log')?.value?.trim()||'Logged';
    const type  = $h('pp-log-type')?.value  ||'Cold Email';
    const date  = $h('pp-log-date')?.value  ||todayStr();
    const entry = { date, type, notes:note };
    try {
        await window.db.collection('prospects').doc(p.prospectId||p.id).update({
            emailLog:   firebase.firestore.FieldValue.arrayUnion(entry),
            emailsSent: (p.emailsSent||0)+1, updatedAt: nowTs()
        });
        window.currentProspect.emailLog   = [...(p.emailLog||[]),entry];
        window.currentProspect.emailsSent = (p.emailsSent||0)+1;
        if(window.toast) window.toast('Logged');
        if($h('pp-manual-log')) $h('pp-manual-log').value='';
        renderPPBody(window.currentProspect);
    } catch(e) { if(window.toast) window.toast('Log failed','error'); }
};

window.archiveProspect = async function() {
    if (!window.currentProspect) return;
    if (!confirm('Archive for next quarter?')) return;
    await archiveProspectById(window.currentProspect.id);
    window.closePP();
};

async function archiveProspectById(id) {
    const p = window.allProspects.find(x=>x.id===id);
    if (!p) return;
    const cq=currentQuarter(), nq=nextQuarter();
    const upd={status:'ARCHIVED',archivedAt:nowTs(),archivedQuarter:cq,revivalQuarter:nq,updatedAt:nowTs()};
    try {
        await window.db.collection('prospects').doc(p.prospectId||p.id).update(upd);
        const idx=window.allProspects.findIndex(x=>x.id===id);
        if(idx!==-1) Object.assign(window.allProspects[idx],upd);
        if(window.toast) window.toast(`Archived — revival set for ${nq}`);
        window.filterProspects();
        if(window.currentProspect?.id===id) window.closePP();
    } catch(e) { console.error(e); if(window.toast) window.toast('Archive failed','error'); }
}

window.reviveProspect = async function(id) {
    const p = window.allProspects.find(x=>x.id===id);
    if (!p) return;
    const upd={status:'QUEUED',sequenceStep:'C',revivalQuarter:null,archivedQuarter:null,nextActionDate:'',updatedAt:nowTs()};
    try {
        await window.db.collection('prospects').doc(p.prospectId||p.id).update(upd);
        const idx=window.allProspects.findIndex(x=>x.id===id);
        if(idx!==-1) Object.assign(window.allProspects[idx],{...upd,revivalQuarter:null,archivedQuarter:null});
        if(window.toast) window.toast('Revived → QUEUED');
    } catch(e) { if(window.toast) window.toast('Revival failed','error'); }
};

window.keepArchived = async function(id) {
    const p = window.allProspects.find(x=>x.id===id);
    if (!p) return;
    const q=['Q1','Q2','Q3','Q4'];
    const nxt=q[(q.indexOf(p.revivalQuarter||nextQuarter())+1)%4];
    try {
        await window.db.collection('prospects').doc(p.prospectId||p.id).update({revivalQuarter:nxt,updatedAt:nowTs()});
        const idx=window.allProspects.findIndex(x=>x.id===id);
        if(idx!==-1) window.allProspects[idx].revivalQuarter=nxt;
        if(window.toast) window.toast(`Kept archived. Next review: ${nxt}`);
    } catch(e) { if(window.toast) window.toast('Update failed','error'); }
};

window.saveProspect = async function() {
    const p = window.currentProspect;
    if (!p) return;
    const newCE = $h('pp-ce-date')?.value || p.ceDate || '';
    const ceChanged = newCE && newCE !== (p.ceDate||'');
    const updates = {
        founderName:  $h('pp-name-edit')?.value?.trim()    ||'',
        company:      $h('pp-company-edit')?.value?.trim() ||'',
        email:        $h('pp-email-edit')?.value?.trim().toLowerCase()||p.email,
        linkedinUrl:  $h('pp-linkedin-edit')?.value?.trim()||'',
        fundingStage: $h('pp-funding-text')?.value||'',
        headcount:    $h('pp-headcount')?.value   ||'',
        batchNumber:  $h('pp-batch-edit')?.value?.trim()||p.batchNumber||'',
        jurisdiction: $h('pp-geo-edit')?.value?.trim()||p.jurisdiction||p.registrationJurisdiction||p.geography||'',
        status:       $h('pp-status')?.value||p.status,
        intendedPlan: $h('pp-plan')?.value  ||'',
        notes:        $h('pp-notes')?.value?.trim()||'',
        ceDate:       newCE,
        updatedAt:    nowTs()
    };
    if (ceChanged && !p.fu1Date && newCE) {
        const add=(d,n)=>{ const x=new Date(d+'T00:00:00'); x.setDate(x.getDate()+n); return x.toISOString().split('T')[0]; };
        updates.fu1Date = add(newCE,3);
        updates.fu2Date = add(updates.fu1Date,3);
        updates.fu3Date = add(updates.fu2Date,4);
        updates.fu4Date = add(updates.fu3Date,4);
        updates.nextActionDate = newCE;
    }
    const batchChanged = updates.batchNumber && updates.batchNumber !== (p.batchNumber||'');
    if (batchChanged && isBatchFull(updates.batchNumber)) {
        if(window.toast) window.toast(`Batch ${updates.batchNumber} is full (${BATCH_LIMIT}/${BATCH_LIMIT}).`,'error');
        return;
    }
    if (updates.status==='ENGAGED' && p.status!=='ENGAGED' && !p.repliedAt) {
        updates.repliedAt = nowTs();
    }
    const isConverting = updates.status==='CONVERTED' && p.status!=='CONVERTED';
    if (isConverting) {
        if (!confirm('Migrate to Factory?')) return;
        const clientId=(p.prospectId||'').replace('LN-P-','LN-C-')||`LN-C-${Date.now()}`;
        const clientData={...p,...updates,id:updates.email,engagementRef:clientId,originalProspectId:p.prospectId,status:'payment_received',createdAt:nowTs(),plan:updates.intendedPlan||'agentic_shield'};
        await window.db.collection('clients').doc(updates.email).set(clientData);
        if(window.toast) window.toast(`Migrated → ${clientId}`,'success');
    }
    try {
        await window.db.collection('prospects').doc(p.prospectId||p.id).set(updates,{merge:true});
        Object.assign(window.currentProspect,updates);
        const idx=window.allProspects.findIndex(x=>x.id===p.id);
        if(idx!==-1) window.allProspects[idx]=window.currentProspect;
        if(!isConverting&&window.toast) window.toast('Dossier saved');
        if(isConverting) window.closePP();
        else renderPPBody(window.currentProspect);
    } catch(e) { console.error(e); if(window.toast) window.toast('Save failed','error'); }
};

window.deleteProspect = async function(docId) {
    if (!confirm('Permanently delete?')) return;
    try {
        await window.db.collection('prospects').doc(docId).delete();
        window.closePP();
        if(window.toast) window.toast('Deleted');
    } catch(e) { if(window.toast) window.toast('Delete failed','error'); }
};

// ════════════════════════════════════════════════════════════════════════
// ═════════ DOSSIER — V7.0 PATCHED ═══════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
window.copyDossier = async function(id) {
    const p = window.allProspects.find(x=>x.id===id);
    if (!p) return;
    const backedGaps = getEvidenceBackedGaps(p);
    const gapsText = backedGaps.length
        ? backedGaps.map(g=>
            `[${(g.severity||'').toUpperCase()}] [T${g.evidenceTier||'S'}] [${fmtExtArr(g.extSurfaces||g.ext)}] ${getGapName(g)}\n`+
            `  Pain:      ${g.thePain||g.plain||'—'}\n`+
            `  Source:    ${g.evidence?.found||g.evidence?.source||g.source||'scanner'}\n`+
            `  Why:       ${g.evidence?.connection||g.evidence?.reason||'Scanner confession'}\n`+
            `  Feature:   ${g.feature_to_cite||'—'}\n`+
            `  Fix:       ${g.theFix||g.doc||'—'}`
          ).join('\n\n')
        : 'No evidence-backed gaps detected';

    let scanSection='';
    if (p.scannerCompleted) {
        const top5=(p.activeGaps||[]).filter(g=>['NUCLEAR','CRITICAL'].includes((g.severity||'').toUpperCase())).slice(0,5)
            .map((g,i)=>`[${i+1}] ${g.severity} [${fmtExtArr(g.extSurfaces||g.ext)}] — ${getGapName(g)}\n    Pain: ${g.thePain||g.plain||'—'}\n    Fix: ${g.theFix||g.doc||'—'}`).join('\n\n');
        scanSection=`\n\n[SCANNER INTELLIGENCE]\nScore: ${p.scannerScore||0}\nUnsure: ${p.unsureFlag?'YES':'No'}\nSurfaces: ${(p.trippedSurfaces||[]).join(', ')||'None'}\n\n${top5||'None'}`;
    }

    // V7.0: featureMap first, productSignal fallback
    const featureArr = p.featureMap?.length > 0 ? p.featureMap
        : Array.isArray(p.productSignal) ? p.productSignal : [];
    const psSig = featureArr.length > 0
        ? featureArr.map(f=>`• "${f.feature||'—'}" [${f.intCode||f.triggersInt||'—'}] ${(f.exposesExt||[]).join(', ')}`).join('\n')
        : (p.productSignal||'—');

    // V7.0: viability dual-read
    const vf = p.viabilityFlags || {};
    const viabText = `G1 Product Fit: ${vfGet(vf,'productFit')===true?'✓':vfGet(vf,'productFit')===false?'✗':'?'} | G2 Gap Severity: ${vfGet(vf,'gapSeverity')===true?'✓':vfGet(vf,'gapSeverity')===false?'✗':'?'} | G3 Contact: ${vfGet(vf,'contactComplete')===true?'✓':vfGet(vf,'contactComplete')===false?'✗':'?'} | G4: ${vfReason(vf,'funding')||'—'}`;

    const text =
`[LEX NOVA FORENSIC DOSSIER — ${new Date().toLocaleDateString('en-GB')}]
ID: ${p.prospectId||'—'}
Target: ${p.founderName||p.name||'—'} ${p.jobTitle?'| '+p.jobTitle:''}
Company: ${p.company||'—'} ${p.website?'('+p.website+')':''}
Email: ${p.email||'—'} | LinkedIn: ${p.linkedinUrl||'—'}
Replied: ${p.repliedAt?new Date(p.repliedAt).toLocaleDateString('en-GB'):'Not yet'}

[PRODUCT INTELLIGENCE]
Primary Product: ${p.primaryProduct||'—'}
Core Archetypes: ${(p.primaryArchetype||p.intArchetypes||[]).join(', ')||p.internalCategory||'—'}
EXT Surfaces:    ${p.externalCategory||(p.extExposures||[]).join(', ')||'—'}
Geo:             ${p.jurisdiction||p.registrationJurisdiction||p.geography||'—'}
Funding:         ${p.fundingStage||'—'} | Headcount: ${p.headcount||'—'}
Verdict:         ${p.verdict||'—'} ${p.verdictReason?'— '+p.verdictReason:''}
Viability:       ${viabText}

[FEATURE MAP]
${psSig}

[EVIDENCE-BACKED GAPS — ${backedGaps.length} total]
${gapsText}${scanSection}

[SEQUENCE STATE]
Status: ${p.status||'—'} | Step: ${p.sequenceStep||'C'} | Emails: ${p.emailsSent||0}
CE: ${p.ceDate||'—'} | FU1: ${p.fu1Date||'—'} | FU2: ${p.fu2Date||'—'} | FU3: ${p.fu3Date||'—'} | FU4: ${p.fu4Date||'—'}
Plan: ${PLANS[p.intendedPlan]||p.intendedPlan||'—'}
Scanner: ${p.scannerCompleted?'COMPLETED 🔥🔥':p.scannerClicked?'CLICKED 🔥':'Not started'}`;

    try {
        await navigator.clipboard.writeText(text);
        if(window.toast) window.toast('Dossier copied — '+backedGaps.length+' evidence-backed gaps');
    } catch {
        const ta=document.createElement('textarea'); ta.value=text; document.body.appendChild(ta);
        ta.focus(); ta.select();
        try { document.execCommand('copy'); if(window.toast) window.toast('Dossier copied'); }
        catch { if(window.toast) window.toast('Copy failed','error'); }
        document.body.removeChild(ta);
    }
};

// ════════════════════════════════════════════════════════════════════════
// ═════════ SPEAR REPORT — V7.0 PATCHED ══════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
window.copySpearReport = async function(id) {
    const p = window.allProspects.find(x=>x.id===id);
    if (!p) return;
    const isNEG = !!p.scannerCompleted;

    function getConsequenceTier(fs) {
        if (!fs) return { tier:'MOMENTUM', rule:'Deal velocity language. $750 slot permitted in FU4.' };
        const f = fs.toLowerCase();
        if (f.includes('pre-seed')||f.includes('seed')||f.includes('bootstrap'))
            return { tier:'SURVIVAL', rule:'Existential language. Runway urgency. $750 slot permitted in FU4.' };
        if (f.includes('series a')||f.includes('series b'))
            return { tier:'MOMENTUM', rule:'Deal velocity language. $750 slot permitted in FU4.' };
        if (f.includes('series c')||f.includes('series d')||f.includes('series e')||f.includes('series f')||f.includes('late')||f.includes('public'))
            return { tier:'CREDIBILITY', rule:'Enterprise buyer rejection language. $750 SUPPRESSED — pure meet offer only in FU4.' };
        return { tier:'MOMENTUM', rule:'Deal velocity language. $750 slot permitted in FU4.' };
    }

    const gapPool = getEvidenceBackedGaps(p);
    if (!gapPool.length) {
        if(window.toast) window.toast('No NUCLEAR/CRITICAL evidence-backed gaps — run Hunter audit first','error');
        return;
    }

    // ── V7.0: EXT array helper — extSurfaces first, ext fallback ──────
    function getExtArray(g) {
        if (Array.isArray(g.extSurfaces) && g.extSurfaces.length) return g.extSurfaces;
        if (Array.isArray(g.ext)) return g.ext;
        if (typeof g.ext === 'string' && g.ext.trim()) return g.ext.split(',').map(e=>e.trim()).filter(Boolean);
        return [];
    }

    function getIntCode(threatId) {
        if (!threatId) return null;
        const m = threatId.match(/^INT(\d{2})/);
        if (!m) return null;
        return `INT.${m[1]}`;
    }

    // ── V7.0: feature signal — featureMap first, productSignal fallback ──
    const featureMapRaw = p.featureMap?.length > 0
        ? p.featureMap.map(f => ({
            feature:     f.feature,
            triggersInt: f.intCode || f.triggersInt,
            exposesExt:  f.exposesExt || [],
            source:      f.source
          }))
        : Array.isArray(p.productSignal) ? p.productSignal : [];

    // ── SOURCE VALIDATOR ──────────────────────────────────────────────
    const VALID_SOURCE_PATTERNS = [
        /homepage/i, /product/i, /blog/i, /docs/i, /documentation/i,
        /github/i, /pricing/i, /security/i, /api/i, /getting.started/i,
        /introduction/i, /features/i, /platform/i, /website/i,
        /marketing/i, /youtube/i, /changelog/i, /about/i, /faq/i
    ];
    const THIRD_PARTY_PATTERNS = [
        /techcrunch/i, /venturebeat/i, /forbes/i, /wired/i,
        /fundraise.insider/i, /siliconangle/i, /saas.news/i,
        /medium\.com/i, /towards.dev/i, /substack/i,
        /preqin/i, /crunchbase/i, /linkedin/i,
        /codebasics/i, /cloudron/i, /paraform/i,
        /aspiring.for.intelligence/i, /mlops/i,
        /ibm.*certificate/i, /udemy/i, /coursera/i
    ];
    function isValidSource(source) {
        if (!source || source === 'null' || source === '—') return false;
        if (THIRD_PARTY_PATTERNS.some(pt => pt.test(source))) return false;
        if (VALID_SOURCE_PATTERNS.some(pt => pt.test(source))) return true;
        return false;
    }
    const sanitizedFeatureMap = featureMapRaw.map(f => {
        if (!isValidSource(f.source)) return { ...f, source:'Homepage', _sourceSanitized:true };
        return f;
    });

    // ── FEATURE-TO-GAP LINKING ────────────────────────────────────────
    function findFeatureForGap(g) {
        if (!sanitizedFeatureMap.length) return null;
        const intCode = getIntCode(g.threatId);
        if (!intCode) return null;
        const candidates = sanitizedFeatureMap.filter(f => f.triggersInt === intCode);
        if (!candidates.length) return null;
        const gapExt = getExtArray(g);
        let best = null, bestScore = -1;
        candidates.forEach(f => {
            const fExt = Array.isArray(f.exposesExt) ? f.exposesExt : [];
            const overlap = gapExt.filter(e => fExt.includes(e)).length;
            if (overlap > bestScore || (overlap === bestScore && best && (f.feature||'').length > (best.feature||'').length)) {
                bestScore = overlap;
                best = f;
            }
        });
        return best || candidates[0];
    }

    // ── GAP MATRIX — V7.0 ─────────────────────────────────────────────
    const gapMatrix = gapPool.map((g, i) => {
        const extArr  = getExtArray(g);
        const intCode = getIntCode(g.threatId);
        const feature = g.feature_to_cite ? null : findFeatureForGap(g); // prefer gap's own feature_to_cite
        const dual    = g.source === 'dual-verified' ? ' [DUAL-VERIFIED]' : '';
        const tierLabel = {
            1:'TIER-1 (Legal Document)',
            2:'TIER-2 (Product Page)',
            3:'TIER-3 (Observable Absence)'
        }[g.evidenceTier] || 'TIER-S (Scanner Confession)';

        let productSource, evidenceSource;
        if (g.evidenceTier === 1) {
            productSource  = 'null';
            evidenceSource = g.evidence_source || g.evidence?.source || '—';
        } else if (g.evidenceTier === 2) {
            productSource  = g.product_source || g.evidence?.source || '—';
            evidenceSource = 'null';
        } else if (g.evidenceTier === 3) {
            productSource  = 'Website Footer / Homepage Copy';
            evidenceSource = 'null';
        } else {
            productSource  = 'null';
            evidenceSource = 'Scanner Confession';
        }

        // V7.0: feature_to_cite — prefer gap's own field, then linked feature
        const featureToCite = g.feature_to_cite || feature?.feature || null;
        const featureSource = g.product_source  || feature?.source  || null;

        const featureBlock = featureToCite
            ? `Feature to Cite: "${featureToCite}"\nFeature Source:  ${featureSource||'—'}${feature?._sourceSanitized?' [sanitized]':''}`
            : `Feature to Cite: null\nFeature Source:  null`;

        const sourceOverride = (featureToCite && productSource === 'null')
            ? `\nSOURCE OVERRIDE: Product Source is null (Tier 1 rule) but Feature to Cite exists.\n  Use Feature Source as product_source in JSON.\n  Use Evidence Source as evidence_source in JSON.`
            : '';

        // V7.0: evidence block — found/trigger/connection first, source/reason fallback
        const evidenceFound      = g.evidence?.found      || g.evidence?.source || '—';
        const evidenceTrigger    = g.evidence?.trigger    || '—';
        const evidenceConnection = g.evidence?.connection || g.evidence?.reason || '—';

        return [
            `── GAP ${i+1} ─────────────────────────────────────────`,
            `Severity:        ${(g.severity||'').toUpperCase()}`,
            `Evidence:        ${tierLabel}${dual}`,
            `Threat ID:       ${g.threatId||'—'}`,
            `INT Code:        ${intCode||'null (Universal Gap)'}`,
            `EXT Codes:       ${extArr.join(', ')||'—'}`,
            `Name:            ${getGapName(g)}`,
            `Velocity:        ${g.velocity||'—'}`,
            `Pain:            ${g.thePain||g.plain||'—'}`,
            `Fix:             ${g.theFix||g.doc||'—'}`,
            `Product Source:  ${productSource}`,
            `Evidence Source: ${evidenceSource}`,
            featureBlock,
            `Evidence Found:  ${evidenceFound}`,
            `Evidence Trigger:    ${evidenceTrigger}`,
            `Evidence Connection: ${evidenceConnection}`,
            sourceOverride
        ].filter(Boolean).join('\n');
    }).join('\n\n');

    // ── FEATURE MAP SECTION ───────────────────────────────────────────
    let featuresSection = '';
    if (sanitizedFeatureMap.length) {
        featuresSection = sanitizedFeatureMap.map(f =>
            `• [FEATURE]  "${f.feature}"\n  [INT]      ${f.triggersInt||'—'}\n  [EXT]      ${(f.exposesExt||[]).join(', ')||'—'}\n  [SOURCE]   ${f.source||'—'}${f._sourceSanitized?' [sanitized]':''}`
        ).join('\n\n');
    } else if (typeof p.productSignal === 'string' && p.productSignal.trim()) {
        featuresSection = p.productSignal;
    } else {
        featuresSection = '• [No feature map — run Hunter V7.0]';
    }

    // ── NEG MODE ──────────────────────────────────────────────────────
    let scanSection = '';
    if (isNEG) {
        const pw = { Uncapped:4, High:3, Medium:2, Low:1 };
        const top3 = [...(p.vaultInputs||[])]
            .sort((a,b) => (pw[b.penalty]||0) - (pw[a.penalty]||0))
            .slice(0,3)
            .map((v, i) => `[CONFESSION ${i+1}]\nPenalty:  ${v.penalty||'—'}\nQuestion: ${v.question||'—'}\nAnswer:   ${v.answer||'—'}`)
            .join('\n\n');
        scanSection = `

═══════════════════════════════════════
[SCANNER INTELLIGENCE — NEG MODE]
═══════════════════════════════════════
ARCHITECT NOTE: Promote any gap whose surface is directly confirmed by
a confession below to PRIORITY 0 — above all Tier 1 gaps.

Scanner Score: ${p.scannerScore||0}
Unsure Flags:  ${p.unsureFlag ? 'YES' : 'No'}
EXT Surfaces Tripped: ${(p.trippedSurfaces||[]).join(', ')||'None'}

TOP CONFESSIONS:
${top3||'None recorded'}`;
    }

    const { tier, rule } = getConsequenceTier(p.fundingStage);

    // V7.0: primary product + core archetypes in report header
    const primaryProductLine = p.primaryProduct
        ? `\nPrimary Product: ${p.primaryProduct}` : '';
    const primaryArchLine = (p.primaryArchetype||[]).length
        ? `\nCore Archetypes: ${p.primaryArchetype.join(', ')}` : '';
    const coreFeatureBlock = p.coreFeature && Object.keys(p.coreFeature).length
        ? '\n\nCORE FEATURES:\n' + Object.entries(p.coreFeature)
            .map(([k,v])=>`  [${k}] ${v}`).join('\n')
        : '';

    const report =
`═══════════════════════════════════════
[LEX NOVA SPEAR REPORT — ${new Date().toLocaleDateString('en-GB')}]
[MODE: ${isNEG ? 'NEG' : 'COLD'}]
═══════════════════════════════════════

[TARGET]
Founder:      ${p.founderName||p.name||'—'}
Company:      ${p.company||'—'}
Email:        ${p.email||'—'}
PID:          ${p.prospectId||'—'}
Scanner Link: ${p.scannerLink||`https://lexnovahq.com/scanner.html?pid=${p.prospectId||''}`}

═══════════════════════════════════════
[CONSEQUENCE TIER: ${tier}]
═══════════════════════════════════════
Funding Stage: ${p.fundingStage||'Unknown'}
Rule:          ${rule}

═══════════════════════════════════════
[PRODUCT INTELLIGENCE]
═══════════════════════════════════════${primaryProductLine}${primaryArchLine}
Lanes:        ${(p.lanes||[]).join(', ').toUpperCase()||'—'}
All Archetypes: ${(p.intArchetypes||[]).join(', ')||p.internalCategory||'—'}
EXT Surfaces: ${p.externalCategory||(p.extExposures||[]).join(', ')||'—'}
Geography:    ${p.jurisdiction||p.registrationJurisdiction||p.geography||'—'}
Jurisdiction: ${p.serviceJurisdictions||'—'}
Funding:      ${p.fundingStage||'—'} | Headcount: ${p.headcount||'—'}
Verdict:      ${p.verdict||'—'}${coreFeatureBlock}

FEATURE MAP:
${featuresSection}

═══════════════════════════════════════
[GAP MATRIX — ${gapPool.length} gaps]
═══════════════════════════════════════

${gapMatrix}${scanSection}

═══════════════════════════════════════
[SEQUENCE STATE]
═══════════════════════════════════════
Status:  ${p.status||'—'} | Step: ${p.sequenceStep||'C'}
Emails:  ${p.emailsSent||0}
CE Date: ${p.ceDate||'—'}
Plan:    ${p.intendedPlan||'agentic_shield'}`;

    try {
        await navigator.clipboard.writeText(report);
        if(window.toast) window.toast(`${isNEG?'NEG ':''}Spear Report copied — ${gapPool.length} gaps · ${tier}`);
    } catch {
        const ta = document.createElement('textarea');
        ta.value = report;
        document.body.appendChild(ta);
        ta.focus(); ta.select();
        try   { document.execCommand('copy'); if(window.toast) window.toast('Spear Report copied'); }
        catch { if(window.toast) window.toast('Copy failed','error'); }
        document.body.removeChild(ta);
    }
};

window.copyICPTable = function() {
    const list = getFilteredSortedProspects().filter(p=>p.status!=='DEAD');
    if (!list.length) { if(window.toast) window.toast('No prospects in current view','error'); return; }
    let sliced = list, offset = 0;
    const range = prompt('Enter S.No. range (e.g. 1-25) or leave blank for ALL:','');
    if (range) {
        const [s,e] = range.split('-').map(x=>parseInt(x.trim(),10));
        if (!isNaN(s)&&!isNaN(e)) { offset=s-1; sliced=list.slice(offset,e); }
        else if(window.toast) window.toast('Invalid format. Copying all.');
    }
    if (!sliced.length) { if(window.toast) window.toast('No rows in that range','error'); return; }
    const header = `S. No.\tBatch\tFounder\tCompany\tRole\tScanner Link\tEmail`;
    const rows   = sliced.map((p,i)=>{
        const sno  = offset+i+1;
        const link = p.scannerLink||`https://lexnovahq.com/scanner.html?pid=${p.prospectId||''}`;
        return `${sno}\t${p.batchNumber||'—'}\t${p.founderName||p.name||'—'}\t${p.company||'—'}\t${p.jobTitle||'—'}\t${link}\t${p.email||'—'}`;
    }).join('\n');
    const text = `${header}\n${rows}`;
    navigator.clipboard.writeText(text)
        .then(()=>{ if(window.toast) window.toast(`Copied rows ${offset+1}–${offset+sliced.length}`); })
        .catch(()=>{
            const ta=document.createElement('textarea'); ta.value=text; document.body.appendChild(ta);
            ta.focus(); ta.select();
            try { document.execCommand('copy'); if(window.toast) window.toast('Copied'); }
            catch { if(window.toast) window.toast('Copy failed','error'); }
            document.body.removeChild(ta);
        });
};

window.pivotToFlagship = async function() {
    if (!window.currentProspect) return;
    if (!confirm('Pivot to Flagship pipeline?')) return;
    const p    = window.currentProspect;
    const data = {
        founderName: p.founderName||p.name||'', email: p.email||'', company: p.company||'',
        preCallNotes: `Pivoted from pipeline.\nTop gap: ${getGapName(getAllGaps(p)[0]||{})}`,
        status:'Identified', addedAt:nowTs(), updatedAt:nowTs()
    };
    try {
        await window.db.collection('flagship').add(data);
        await window.db.collection('prospects').doc(p.prospectId||p.id).update({status:'DEAD',archivedAt:nowTs(),updatedAt:nowTs()});
        if(window.toast) window.toast('Pivoted to Flagship');
        window.closePP();
        if(typeof window.loadFlagship==='function') window.loadFlagship();
    } catch(e) { console.error(e); if(window.toast) window.toast('Pivot failed','error'); }
};

window.convertLead = async function(leadId) {
    if (!confirm('Convert to Pipeline Prospect?')) return;
    try {
        const snap=await window.db.collection('leads').doc(leadId).get();
        if(!snap.exists){if(window.toast)window.toast('Lead not found','error');return;}
        const l=snap.data();
        const month=String(new Date().getMonth()+1).padStart(2,'0');
        let batch=`${month}I`;
        if(isBatchFull(batch)){
            const letters='IJKLMNOP';
            for(let i=1;i<letters.length;i++){const t=`${month}${letters[i]}`;if(!isBatchFull(t)){batch=t;break;}}
            if(isBatchFull(batch)){if(window.toast)window.toast('All inbound batches full.','error');return;}
        }
        const pid=await window.genProspectId(batch);
        const data={
            founderName:l.name||'',email:l.email||leadId,company:l.company||'',
            linkedinUrl:l.linkedin||'',source:l.source||'scanner',batchNumber:batch,
            intendedPlan:l.plan||'agentic_shield',status:'QUEUED',sequenceStep:'C',
            prospectId:pid,scannerLink:`https://lexnovahq.com/scanner.html?pid=${pid}`,
            emailsSent:0,emailLog:[],
            scannerClicked:!!l.scannerClicked,scannerCompleted:!!l.scannerCompleted,
            activeGaps:l.activeGaps||[],forensicGaps:l.forensicGaps||[],
            primaryArchetype:l.primaryArchetype||[],
            internalCategory:l.internalCategory||'',
            externalCategory:l.externalCategory||'',
            featureMap:l.featureMap||[],
            primaryProduct:l.primaryProduct||'',
            addedAt:nowTs(),updatedAt:nowTs()
        };
        await window.db.collection('prospects').doc(pid).set(data,{merge:true});
        await window.db.collection('leads').doc(leadId).update({status:'converted',convertedAt:nowTs()});
        if(window.toast) window.toast(`Converted → ${pid}`);
        if(typeof window.loadLeads==='function') window.loadLeads();
    } catch(e){console.error(e);if(window.toast)window.toast('Conversion failed','error');}
};

window.openAddProspect = function() {
    const month = String(new Date().getMonth()+1).padStart(2,'0');
    const defBatch = `${month}A`;
    if (typeof window.openModal!=='function') return;
    window.openModal('Add Unverified Lead — Run Hunter Before Scheduling',`
    <div style="font-size:10px;color:#d4a850;background:rgba(212,168,80,.06);border:1px solid rgba(212,168,80,.2);padding:10px 14px;margin-bottom:16px;">
        ⚠ Hunter-verified leads push automatically. This form is for referrals and inbound leads only.
    </div>
    <div class="fi-row">
        <div class="fg"><label class="fl">Founder Name</label><input type="text" class="fi" id="ap-name" placeholder="Jane Smith"></div>
        <div class="fg"><label class="fl">Company</label><input type="text" class="fi" id="ap-company" placeholder="Acme AI"></div>
    </div>
    <div class="fg"><label class="fl">Email *</label><input type="email" class="fi" id="ap-email" placeholder="jane@acme.com"></div>
    <div class="fg">
        <label class="fl">Batch <span id="ap-batch-cap" style="font-size:9px;color:var(--marble-dim);margin-left:8px;">${getBatchCount(defBatch)}/${BATCH_LIMIT}</span></label>
        <input type="text" class="fi" id="ap-batch" value="${defBatch}" placeholder="e.g. 03A" oninput="
            const b=this.value.trim();
            const ct=window.allProspects.filter(p=>p.batchNumber===b&&p.status!=='DEAD').length;
            const el=document.getElementById('ap-batch-cap');
            if(el){el.textContent=ct+'/${BATCH_LIMIT}';el.style.color=ct>=${BATCH_LIMIT}?'#ef4444':ct>=${BATCH_LIMIT-5}?'#f97316':'var(--marble-dim)';}">
    </div>`,
    `<button class="btn btn-outline btn-sm" onclick="window.closeModal()">Cancel</button>
     <button class="btn btn-primary btn-sm" onclick="window.saveNewProspect()">Add Unverified Lead</button>`);
};

window.saveNewProspect = async function() {
    const email=$h('ap-email')?.value?.trim().toLowerCase();
    const batch=$h('ap-batch')?.value?.trim()||'01A';
    if(!email){if(window.toast)window.toast('Email required','error');return;}
    if(isBatchFull(batch)){if(window.toast)window.toast(`Batch ${batch} is full.`,'error');return;}
    try {
        const pid=await window.genProspectId(batch);
        await window.db.collection('prospects').doc(pid).set({
            founderName:$h('ap-name')?.value?.trim()||'',
            email, company:$h('ap-company')?.value?.trim()||'',
            prospectId:pid, batchNumber:batch,
            scannerLink:`https://lexnovahq.com/scanner.html?pid=${pid}`,
            status:'QUEUED', sequenceStep:'C',
            emailsSent:0, emailLog:[],
            addedAt:nowTs(), updatedAt:nowTs()
        });
        if(window.closeModal) window.closeModal();
        if(window.toast) window.toast(`${pid} added — run Hunter before scheduling`);
    } catch(e){console.error(e);if(window.toast)window.toast('Save failed','error');}
};

window.genProspectId = async function(batchCode) {
    try {
        const month=String(new Date().getMonth()+1).padStart(2,'0');
        const batch=batchCode||`${month}A`;
        const prefix=`LN-P-AI-26-${batch}-`;
        const snap=await window.db.collection('prospects').where('prospectId','>=',prefix).where('prospectId','<=',prefix+'\uf8ff').get();
        let max=0;
        snap.forEach(d=>{const n=parseInt((d.data().prospectId||'').split('-').pop(),10);if(n>max)max=n;});
        return `${prefix}${String(max+1).padStart(3,'0')}`;
    } catch { return `LN-P-AI-26-01A-001`; }
};

window.loadFlagship = async function() {
    const pa=$h('pageActions');
    if(pa) pa.innerHTML=`<button class="btn btn-primary" onclick="window.openAddFlagship()">+ Add Flagship</button>`;
    document.querySelectorAll('#fs-tbody').forEach(tb=>tb.innerHTML='<tr><td colspan="8" class="loading">Loading…</td></tr>');
    try {
        const snap=await window.db.collection('flagship').orderBy('addedAt','desc').get();
        window.allFlagship=[];
        snap.forEach(d=>window.allFlagship.push({id:d.id,...d.data()}));
        renderFlagshipTable(window.allFlagship);
        window.renderDealsBoard();
    } catch(e){document.querySelectorAll('#fs-tbody').forEach(tb=>tb.innerHTML='<tr><td colspan="8" class="loading" style="color:#d47a7a">Failed</td></tr>');}
};

function renderFlagshipTable(list) {
    const tbodies=document.querySelectorAll('#fs-tbody'); if(!tbodies.length)return;
    const sClass={'Identified':'b-cold','Discovery Scheduled':'b-intake','Discovery Done':'b-warm','Proposal Sent':'b-production','Negotiating':'b-hot','Won':'b-delivered','Lost':'b-dead'};
    const html=!list.length?'<tr><td colspan="8" class="loading">No flagship prospects</td></tr>'
        :list.map((fs,i)=>{
            let fu='';
            if(fs.proposalSentAt&&fs.status==='Proposal Sent'){const hrs=Math.floor((Date.now()-new Date(fs.proposalSentAt).getTime())/3600000);fu=hrs>24?` <span style="color:#d47a7a;font-size:9px">⚠ ${hrs}h</span>`:` <span style="color:var(--gold);font-size:9px">${hrs}h</span>`;}
            return `<tr onclick="window.openFSP('${window.esc(fs.id)}')">
                <td class="dim" style="font-size:10px;text-align:center;">${i+1}</td>
                <td>${window.esc(fs.founderName||fs.name||'—')}</td>
                <td class="dim">${window.esc(fs.company||'—')}</td>
                <td><span class="badge ${sClass[fs.status]||'b-ghost'}">${window.esc(fs.status||'—')}</span></td>
                <td class="dim">${fmtMoney(fs.priceQuoted)}</td>
                <td class="dim">${window.esc(fs.proposalSentDate||'—')}${fu}</td>
                <td class="dim">${window.esc(fs.nextStep||'—')}</td>
                <td class="dim">${fmtDate(fs.addedAt)}</td>
            </tr>`;
        }).join('');
    tbodies.forEach(tb=>tb.innerHTML=html);
}

window.openAddFlagship=function(){
    if(typeof window.openModal!=='function')return;
    window.openModal('Add Flagship Prospect',`
    <div class="fi-row"><div class="fg"><label class="fl">Founder</label><input type="text" class="fi" id="fsa-name"></div><div class="fg"><label class="fl">Company</label><input type="text" class="fi" id="fsa-company"></div></div>
    <div class="fg"><label class="fl">Email *</label><input type="email" class="fi" id="fsa-email"></div>
    <div class="fg"><label class="fl">Notes</label><textarea class="fi" id="fsa-notes" rows="2"></textarea></div>`,
    `<button class="btn btn-outline btn-sm" onclick="window.closeModal()">Cancel</button><button class="btn btn-primary btn-sm" onclick="window.saveNewFlagship()">Add</button>`);
};

window.saveNewFlagship=async function(){
    const email=$h('fsa-email')?.value?.trim().toLowerCase();
    if(!email){if(window.toast)window.toast('Email required','error');return;}
    const data={founderName:$h('fsa-name')?.value?.trim()||'',email,company:$h('fsa-company')?.value?.trim()||'',preCallNotes:$h('fsa-notes')?.value?.trim()||'',status:'Identified',addedAt:nowTs(),updatedAt:nowTs()};
    try{const ref=await window.db.collection('flagship').add(data);window.allFlagship.unshift({id:ref.id,...data});renderFlagshipTable(window.allFlagship);window.renderDealsBoard();if(window.closeModal)window.closeModal();if(window.toast)window.toast('Added');}
    catch(e){console.error(e);if(window.toast)window.toast('Save failed','error');}
};

window.openFSP=function(id){
    const fs=window.allFlagship.find(x=>x.id===id);if(!fs)return;
    window.currentFlagship=fs;
    $h('flagshipPanel')?.classList.add('open');
    const setText=window.setText||((id,v)=>{const e=$h(id);if(e)e.textContent=String(v??'');});
    setText('fsp-name',fs.founderName||fs.name||'—');setText('fsp-meta',fs.company||'—');
    renderFSPBody(fs);
};

window.closeFSP=function(){window.currentFlagship=null;$h('flagshipPanel')?.classList.remove('open');};

function renderFSPBody(fs){
    const body=$h('fsp-body');if(!body)return;
    const sOpts=['Identified','Discovery Scheduled','Discovery Done','Proposal Sent','Negotiating','Won','Lost'].map(s=>`<option ${fs.status===s?'selected':''}>${s}</option>`).join('');
    const pOpts=Object.entries(PLANS).map(([k,v])=>`<option value="${k}" ${fs.prescribedPlan===k?'selected':''}>${v}</option>`).join('');
    let fu='';
    if(fs.proposalSentAt){const hrs=Math.floor((Date.now()-new Date(fs.proposalSentAt).getTime())/3600000);const col=hrs>24?'#d47a7a':'#C5A059';fu=`<div style="font-size:10px;color:${col};margin-top:4px">⏱ ${hrs}h since proposal${hrs>24?' — OVERDUE':''}</div>`;}
    body.innerHTML=`<div style="padding:18px 20px">
    <div class="fg"><label class="fl">Status</label><select class="fi" id="fsp-status">${sOpts}</select></div>
    <div class="fg"><label class="fl">Pre-Call Notes</label><textarea class="fi" id="fsp-precall" rows="3">${window.esc(fs.preCallNotes||'')}</textarea></div>
    <div class="fg"><label class="fl">Post-Call Gap</label><textarea class="fi" id="fsp-postcall" rows="3">${window.esc(fs.postCallGap||'')}</textarea></div>
    <div class="fi-row"><div class="fg"><label class="fl">Plan</label><select class="fi" id="fsp-plan">${pOpts}</select></div><div class="fg"><label class="fl">Price Quoted</label><input type="number" class="fi" id="fsp-price" value="${fs.priceQuoted||''}"></div></div>
    <div class="fg"><label class="fl">Proposal Sent Date</label><input type="date" class="fi" id="fsp-prop-date" value="${fs.proposalSentDate||''}">${fu}</div>
    <div class="fg"><label class="fl">Next Step</label><textarea class="fi" id="fsp-next" rows="2">${window.esc(fs.nextStep||'')}</textarea></div>
    <button class="btn btn-primary btn-full" onclick="window.saveFSP()">Save</button>
    </div>`;
}

window.saveFSP=async function(){
    if(!window.currentFlagship)return;
    const propDate=$h('fsp-prop-date')?.value||'';
    const updates={status:$h('fsp-status')?.value||window.currentFlagship.status,preCallNotes:$h('fsp-precall')?.value?.trim()||'',postCallGap:$h('fsp-postcall')?.value?.trim()||'',prescribedPlan:$h('fsp-plan')?.value||'',priceQuoted:parseFloat($h('fsp-price')?.value)||null,proposalSentDate:propDate,nextStep:$h('fsp-next')?.value?.trim()||'',updatedAt:nowTs()};
    if(propDate&&!window.currentFlagship.proposalSentAt)updates.proposalSentAt=nowTs();
    try{
        await window.db.collection('flagship').doc(window.currentFlagship.id).set(updates,{merge:true});
        window.currentFlagship={...window.currentFlagship,...updates};
        const idx=window.allFlagship.findIndex(f=>f.id===window.currentFlagship.id);
        if(idx!==-1)window.allFlagship[idx]=window.currentFlagship;
        renderFlagshipTable(window.allFlagship);window.renderDealsBoard();
        if(window.toast)window.toast('Flagship saved');
    }catch(e){console.error(e);if(window.toast)window.toast('Save failed','error');}
};
