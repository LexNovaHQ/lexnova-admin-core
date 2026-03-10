// admin-logic-2.js — Lex Nova HQ Admin Console (Part 2)
// Covers: Nav patch · Outreach CRM · Flagship · Content · Radar · Finance · Settings
// Requires: admin-logic-1.js loaded first

'use strict';

// ── STATE ─────────────────────────────────────────────────────────────────────
let allProspects    = [];
let allFlagship     = [];
let allContent      = [];
let currentProspect = null;
let currentFlagship = null;
let editingRegIdx   = -1;

// ── NAV PATCH — wire logic-2 tabs into nav() from logic-1 ────────────────────
(function patchNav() {
  const _nav = nav;
  window.nav = function(tab) {
    _nav(tab);
    const l2 = {
      outreach: loadOutreach, flagship: loadFlagship,
      content:  loadContent,  radar:    loadRadar,
      finance:  loadFinance,  settings: loadSettings,
      hunt:     loadOutreach, // Explicitly map 'hunt' to the sync engine
      deals:    loadOutreach  // Explicitly map 'deals' to the sync engine
    };
    if (l2[tab]) l2[tab]();
  };
})();

// ── PAGE ACTIONS HELPER ───────────────────────────────────────────────────────
function setPageActions(html) {
  const el = $('pageActions');
  if (el) el.innerHTML = html;
}

// ── SUNDAY RITUAL ─────────────────────────────────────────────────────────────
window.loadRitual = async function() {
  try {
    const snap = await db.collection('settings').doc('ritual').get();
    if (snap.exists) {
      const d = snap.data();
      if ($('r-outreach')) $('r-outreach').value = d.outreach || '';
      if ($('r-replies')) $('r-replies').value = d.replies || '';
      if ($('r-tally')) $('r-tally').value = d.tally || '';
      if ($('r-deals')) $('r-deals').value = d.deals || '';
      if ($('r-pipeline')) $('r-pipeline').value = d.pipeline || '';
    }
  } catch(e) { console.error('Ritual load failed', e); }
};

window.saveRitual = async function() {
  const data = {
    outreach: parseInt($('r-outreach')?.value) || 0,
    replies: parseInt($('r-replies')?.value) || 0,
    updatedAt: new Date().toISOString()
  };
  try {
    await db.collection('settings').doc('ritual').set(data, { merge: true });
    toast('Ritual metrics updated');
  } catch(e) { toast('Error saving ritual', 'error'); }
};

// ── OUTREACH (NUCLEAR SYNC ENGINE) ───────────────────────────────────────────
let outreachListener = null;

function loadOutreach() {
  setPageActions('');
  if (outreachListener) outreachListener(); 

  outreachListener = db.collection('prospects').onSnapshot((snap) => {
    try {
        allProspects = [];
        snap.forEach(d => allProspects.push({ id: d.id, ...d.data() }));
        
        // 1. Update Dashboard Funnel
        populateCommandCenter();
        
        // 2. FORCE RENDER THE WAR BOARD (Mid-Funnel)
        if (typeof renderDealsBoard === 'function') renderDealsBoard();

        // 3. FORCE RENDER THE HUNT TABLE (Acquisition Pipeline)
        // We remove the conditional check so it always populates op-tbody
        filterProspects(); 
        populateBatchFilter();

    } catch (err) {
        console.error("Outreach Render Error:", err);
    }
  }, (e) => {
    console.error("Firebase Sync Failed:", e);
    toast('Outreach Sync Failed', 'error');
  });
}

function setOutreachView(view, el) {
  // Legacy support for Outreach sub-tabs if needed
  qsa('.view-btn').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
  ['command','pipeline','hot','followup','inbound','dead'].forEach(v => {
    $('ov-' + v)?.classList.toggle('hidden', v !== view);
  });
  if (view === 'pipeline')  { filterProspects(); populateBatchFilter(); }
  if (view === 'hot')       renderHot();
  if (view === 'followup')  renderFollowup();
  if (view === 'inbound')   renderInbound();
  if (view === 'dead')      renderDead();
}

function populateCommandCenter() {
  let totalEmails = 0, totalClicks = 0, totalComps = 0, totalPaid = 0, convEmailCount = 0;
  const todayStr = new Date().toISOString().split('T')[0];
  let fuToday = 0, fuOver = 0, liPending = 0;

  allProspects.forEach(p => {
    totalEmails += (p.emailsSent || 0);
    if (p.scannerClicked || p.scannerCompleted) totalClicks++;
    if (p.scannerCompleted) totalComps++;
    if (p.status === 'Converted') {
        totalPaid++;
        convEmailCount += (p.emailsSent || 1);
    }
    if (!['Converted','Dead'].includes(p.status)) {
      if (p.nextActionDate === todayStr) fuToday++;
      if (p.nextActionDate < todayStr) fuOver++;
      if (['pending','connected_no_reply'].includes(p.linkedinStatus)) liPending++;
    }
  });

  setText('oc-emails-all', totalEmails);
  setText('oc-clicks-all', totalClicks);
  setText('oc-click-rate', totalEmails > 0 ? Math.round((totalClicks/totalEmails)*100) + '% click rate' : '0% click rate');
  setText('oc-comps-all', totalComps);
  setText('oc-comp-rate', totalClicks > 0 ? Math.round((totalComps/totalClicks)*100) + '% completion rate' : '0% completion rate');
  setText('oc-paid-all', totalPaid);
  setText('oc-close-rate', totalComps > 0 ? Math.round((totalPaid/totalComps)*100) + '% close rate' : '0% close rate');

  setText('aq-today', fuToday);
  setText('aq-over', fuOver);
  setText('aq-li', liPending);
  
  const avgFuEl = $('oc-avg-fu');
  if (avgFuEl) avgFuEl.textContent = totalPaid > 0 ? (convEmailCount / totalPaid).toFixed(1) : '—';

  db.collection('leads').where('status','in',['new','scanner_submitted']).get()
    .then(snap => setText('aq-inbound', snap.size)).catch(() => {});

  renderBatchPerformance();
}

function renderBatchPerformance() {
  const tbodies = document.querySelectorAll('#oc-batches');
  if (tbodies.length === 0) return;

  const batches = {};
  allProspects.forEach(p => {
    const b = p.batchNumber || 'Unassigned';
    if (!batches[b]) batches[b] = { prospects:0, emails:0, clicks:0, comps:0, conv:0 };
    batches[b].prospects++;
    batches[b].emails += p.emailsSent || 0;
    if (p.scannerClicked || p.scannerCompleted) batches[b].clicks++;
    if (p.scannerCompleted) batches[b].comps++;
    if (p.status === 'Converted') batches[b].conv++;
  });
  
  const keys = Object.keys(batches).sort();
  const html = !keys.length 
    ? '<tr><td colspan="7" class="loading">No batches yet</td></tr>'
    : keys.map(b => {
        const r = batches[b];
        const roi = r.comps > 0 ? Math.round((r.conv/r.comps)*100)+'%' : '0%';
        return `<tr>
          <td>${esc(b)}</td><td>${r.prospects}</td><td>${r.emails}</td>
          <td>${r.clicks}</td><td>${r.comps}</td><td>${r.conv}</td><td style="color:var(--gold);">${roi}</td>
        </tr>`;
      }).join('');
      
  tbodies.forEach(tb => tb.innerHTML = html);
}

// ── KANBAN BOARD LOGIC (ARMOR-PLATED) ─────────────────────────────────────────
function renderDealsBoard() {
  const cols = { 1: [], 2: [], 3: [], 4: [], 5: [] };

  // 1. Sort Prospects
  allProspects.forEach(p => {
    if (p.status === 'Dead') return;
    if (p.status === 'Converted') { cols[5].push(p); } 
    else if (p.status === 'Negotiating' || p.scannerCompleted || p.status === 'Hot' || p.hotFlag) { cols[4].push(p); } 
    else if (p.status === 'Replied' || p.scannerClicked) { cols[3].push(p); } 
    else if (p.emailsSent > 0 || p.status === 'Warm') { cols[2].push(p); } 
    else { cols[1].push(p); }
  });

  // 2. Merge Flagship Deals
  if (allFlagship && Array.isArray(allFlagship)) {
      allFlagship.forEach(f => {
         if (f.status === 'Won') cols[5].push(f);
         else if (f.status === 'Lost') return;
         else if (f.status === 'Identified') cols[1].push(f);
         else { cols[4].push(f); } // Mid-talk Flagship sits at Decision Desk
      });
  }

  const todayStr = new Date().toISOString().split('T')[0];

  for (let i = 1; i <= 5; i++) {
    const els = document.querySelectorAll('#kd-col-' + i);
    const cnts = document.querySelectorAll('#kd-c' + i);
    if (els.length === 0) continue;
    
    cnts.forEach(c => c.innerText = cols[i].length);
    
    cols[i].sort((a,b) => (a.nextActionDate || '9999').localeCompare(b.nextActionDate || '9999'));

    const html = cols[i].length === 0 
      ? '<div class="empty" style="padding:20px; border:none;">Empty</div>'
      : cols[i].map(c => {
          const isFlagship = c.priceQuoted !== undefined; 
          const name = esc(c.founderName || c.name || 'Unknown');
          const comp = esc(c.company || '—');
          const flags = isFlagship ? '<span style="color:var(--gold)">◆ </span>' : (c.scannerCompleted ? '🔥🔥 ' : (c.scannerClicked || c.hotFlag ? '🔥 ' : ''));
          const nextDate = c.nextActionDate || '';
          const dateCls = (nextDate && nextDate < todayStr) ? 'k-date-red' : (nextDate === todayStr ? 'k-date-gold' : '');
          const dateTxt = (nextDate && nextDate < todayStr) ? '⚠ Overdue' : (nextDate === todayStr ? '★ Today' : nextDate);

          const clickFn = isFlagship ? `openFSP('${esc(c.id)}')` : `openPP('${esc(c.id)}')`;

          return `
            <div class="k-card" onclick="${clickFn}">
              <div class="k-name">${flags}${name}</div>
              <div class="k-comp">${comp}</div>
              <div class="k-meta"><span class="${dateCls}">${dateTxt || '—'}</span></div>
            </div>`;
        }).join('');
        
    els.forEach(el => el.innerHTML = html);
  }
}

// ── THE HUNT TABLE (ARMOR-PLATED) ───────────────────────────────────────────
function populateBatchFilter() {
  const sel = $('op-batch');
  if (!sel || sel.options.length > 1) return;
  [...new Set(allProspects.map(p => p.batchNumber).filter(Boolean))].sort().forEach(b => {
    const o = document.createElement('option'); o.value = b; o.textContent = b;
    sel.appendChild(o);
  });
}

function filterProspects() {
  const s   = ($('op-search')?.value||'').toLowerCase();
  const st  = $('op-status')?.value  || '';
  const bt  = $('op-batch')?.value   || '';
  const br  = $('op-branch')?.value  || '';
  const fs  = $('op-funding')?.value || '';
  const sc  = $('op-scanner')?.value || '';
  const srt = $('op-sort')?.value    || 'nextDate';

  let list = allProspects.filter(p =>
    (!s  || (p.founderName||p.name||'').toLowerCase().includes(s) ||
             (p.company||'').toLowerCase().includes(s) ||
             (p.email||'').toLowerCase().includes(s)) &&
    (!st || p.status === st) &&
    (!bt || p.batchNumber === bt) &&
    (!br || p.followUpBranch === br) &&
    (!fs || p.fundingStage === fs) &&
    (!sc || (sc==='clicked'   &&  p.scannerClicked && !p.scannerCompleted) ||
            (sc==='completed' &&  p.scannerCompleted) ||
            (sc==='none'      && !p.scannerClicked))
  );

  if      (srt === 'dateAdded') list.sort((a,b) => (b.addedAt||'').localeCompare(a.addedAt||''));
  else if (srt === 'score')     list.sort((a,b) => (b.scannerExternalScore||0) - (a.scannerExternalScore||0));
  else if (srt === 'company')   list.sort((a,b) => (a.company||'').localeCompare(b.company||''));
  else list.sort((a,b) => (a.nextActionDate||'9999').localeCompare(b.nextActionDate||'9999'));

  renderPipeline(list);
}

function renderPipeline(list) {
  const tbodies = document.querySelectorAll('#op-tbody');
  if (tbodies.length === 0) return;
  
  const rows = list.filter(p => p.status !== 'Dead');
  const sClass = { Cold:'b-cold', Warm:'b-warm', Hot:'b-hot', Replied:'b-intake', Negotiating:'b-production', Converted:'b-converted' };
  
  const html = !rows.length 
    ? '<tr><td colspan="9" class="loading">No prospects found</td></tr>'
    : rows.map(p => {
        const fire = p.scannerCompleted ? '🔥🔥' : (p.scannerClicked || p.hotFlag ? '🔥' : '');
        const scan = p.scannerCompleted ? '<span class="badge b-delivered">Completed</span>' : p.scannerClicked ? '<span class="badge b-warm">Clicked</span>' : '<span class="badge b-ghost">—</span>';
        return `<tr onclick="openPP('${esc(p.id)}')">
          <td>${esc(p.founderName||p.name||'—')}</td>
          <td class="dim">${esc(p.company||'—')}</td>
          <td class="dim">${esc(p.batchNumber||'—')}</td>
          <td><span class="badge ${sClass[p.status]||'b-ghost'}">${esc(p.status||'—')}</span></td>
          <td class="dim">${esc(p.followUpBranch||'—')}</td>
          <td>${scan} <span class="hot-flag">${fire}</span></td> <td class="dim">${esc(p.linkedinStatus||'—')}</td>
          <td class="dim">${esc(p.nextActionDate||'—')}</td>
          <td class="dim">${p.emailsSent||0}</td>
        </tr>`;
      }).join('');

  tbodies.forEach(tb => tb.innerHTML = html);
}

function renderHot() {
  const tbodies = document.querySelectorAll('#oh-tbody');
  if (tbodies.length === 0) return;
  const hot = allProspects.filter(p => (p.scannerClicked||p.scannerCompleted||p.hotFlag) && p.status !== 'Converted');
  const html = !hot.length ? '<tr><td colspan="6" class="empty">No hot signals yet</td></tr>' : hot.map(p => `
        <tr onclick="openPP('${esc(p.id)}')">
          <td>${esc(p.founderName||p.name||'—')} ${p.scannerCompleted?'🔥🔥':(p.scannerClicked||p.hotFlag?'🔥':'')}</td>
          <td class="dim">${esc(p.company||'—')}</td>
          <td>${p.scannerCompleted ? 'Scanner Completed' : 'Scanner Clicked'}</td>
          <td>${p.scannerExternalScore ?? '—'}</td>
          <td><span class="badge b-${(p.status||'cold').toLowerCase()}">${esc(p.status||'—')}</span></td>
          <td class="dim">${esc(p.nextActionDate||'—')}</td>
        </tr>`).join('');
  tbodies.forEach(tb => tb.innerHTML = html);
}

function renderFollowup() {
  const tbodies = document.querySelectorAll('#ofu-tbody');
  if (tbodies.length === 0) return;
  const todayStr = new Date().toISOString().split('T')[0];
  const due = allProspects.filter(p => p.nextActionDate && p.nextActionDate <= todayStr && !['Converted','Dead'].includes(p.status)).sort((a,b) => (a.nextActionDate||'').localeCompare(b.nextActionDate||''));
  const html = !due.length ? '<tr><td colspan="5" class="empty">No follow-ups due</td></tr>' : due.map(p => `
        <tr onclick="openPP('${esc(p.id)}')">
          <td>${esc(p.founderName||p.name||'—')}</td>
          <td class="dim">${esc(p.company||'—')}</td>
          <td style="color:${p.nextActionDate < todayStr ? '#d47a7a' : 'inherit'}">${esc(p.nextActionDate)} ${p.nextActionDate < todayStr ? '⚠' : ''}</td>
          <td><span class="badge b-${(p.status||'cold').toLowerCase()}">${esc(p.status||'—')}</span></td>
          <td class="dim">${esc(p.nextAction||'—')}</td>
        </tr>`).join('');
  tbodies.forEach(tb => tb.innerHTML = html);
}

async function renderInbound() {
  const tbodies = document.querySelectorAll('#oin-tbody');
  if (tbodies.length === 0) return;
  try {
    const snap = await db.collection('leads').where('leadType','in',['warm_lead','hot_lead']).orderBy('createdAt','desc').get();
    const leads = []; snap.forEach(d => leads.push({ id: d.id, ...d.data() }));
    const active = leads.filter(l => !['converted','archived'].includes(l.status));
    const html = !active.length ? '<tr><td colspan="6" class="empty">No inbound submissions</td></tr>' : active.map(l => `
          <tr>
            <td>${esc(l.name||'—')}</td>
            <td class="dim">${esc(l.email||l.id)}</td>
            <td class="dim">${esc(l.company||'—')}</td>
            <td>${l.scannerExternalScore ?? l.scannerScore ?? '—'}</td>
            <td class="dim">${fmtDate(l.createdAt)}</td>
            <td onclick="event.stopPropagation()">
              <button class="btn btn-primary btn-sm" onclick="convertLead('${esc(l.id)}')">Convert</button>
            </td>
          </tr>`).join('');
    tbodies.forEach(tb => tb.innerHTML = html);
  } catch(e) { console.error(e); }
}

function renderDead() {
  const tbodies = document.querySelectorAll('#od-tbody');
  if (tbodies.length === 0) return;
  const dead = allProspects.filter(p => p.status === 'Dead');
  const html = !dead.length ? '<tr><td colspan="4" class="empty">No archived prospects</td></tr>' : dead.map(p => `
        <tr onclick="openPP('${esc(p.id)}')">
          <td>${esc(p.founderName||p.name||'—')}</td>
          <td class="dim">${esc(p.company||'—')}</td>
          <td class="dim">${esc(p.batchNumber||'—')}</td>
          <td class="dim">${fmtDate(p.archivedAt||p.updatedAt)}</td>
        </tr>`).join('');
  tbodies.forEach(tb => tb.innerHTML = html);
}

// ── LEAD CONVERSION ───────────────────────────────────────────────────────────
window.convertLead = async function(leadId) {
  if (!confirm('Convert this Lead into a Pipeline Prospect?')) return;
  try {
    const leadDoc = await db.collection('leads').doc(leadId).get();
    if (!leadDoc.exists) { toast('Lead not found', 'error'); return; }
    const l = leadDoc.data();
    const pid  = await genProspectId();
    const email = l.email || leadId;
    const prospectData = {
      founderName: l.name || '', email: email, company: l.company || '',
      linkedinUrl: l.linkedin || '', website: '', fundingStage: '', location: '', source: l.source || 'scanner',
      batchNumber: 'Inbound', intendedPlan: 'agentic_shield', notes: 'Converted from Lead ID: ' + leadId,
      status: 'Replied', prospectId: pid, emailsSent: 0, emailLog: [], scannerClicked: true,
      scannerCompleted: !!l.scannerScore || !!l.scannerExternalScore,
      scannerExternalScore: l.scannerExternalScore || l.scannerScore || null,
      scannerInternalScore: l.scannerInternalScore || null,
      addedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      legalGapStatus: 'generic', personalizedHook: 'Submitted via scanner.'
    };
    await db.collection('prospects').doc(email).set(prospectData, { merge: true });
    await db.collection('leads').doc(leadId).update({ status: 'converted', convertedAt: new Date().toISOString() });
    toast(`Lead converted to ${pid}`);
    loadOutreach();
  } catch(e) { console.error(e); toast('Conversion failed', 'error'); }
};

// ── PROSPECT PANEL ────────────────────────────────────────────────────────────
function openPP(id) {
  const p = allProspects.find(x => x.id === id);
  if (!p) return;
  currentProspect = p;
  $('prospectPanel')?.classList.add('open');
  setText('pp-name', p.founderName || p.name || '—');
  setText('pp-meta', `${p.company||'—'} · ${p.email||'—'}`);
  renderPPBody(p);
}

function closePP() {
  currentProspect = null;
  $('prospectPanel')?.classList.remove('open');
}

function renderPPBody(p) {
  const body = $('pp-body');
  if (!body) return;

  const sel = (opts, cur) => opts.map(o => `<option value="${o}" ${cur===o?'selected':''}>${o||'—'}</option>`).join('');
  const planSel = Object.entries(PLANS).map(([k,v]) => `<option value="${k}" ${p.intendedPlan===k?'selected':''}>${v}</option>`).join('');
  const logRows = (p.emailLog||[]).slice().reverse().map(e => `
    <div style="display:flex;gap:10px;padding:7px 0;border-bottom:1px solid rgba(197,160,89,.06);font-size:10px">
      <span style="color:var(--marble-faint);flex-shrink:0;width:80px">${esc(e.date||'—')}</span>
      <span style="color:var(--gold);flex-shrink:0;width:90px">${esc(e.type||'—')}</span>
      <span style="color:var(--marble-dim)">${esc(e.notes||'')}</span>
    </div>`).join('') || '<div style="font-size:10px;color:var(--marble-faint)">No emails logged</div>';

  body.innerHTML = `
    <div style="margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid var(--border)">
      <div style="font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:var(--marble-faint);margin-bottom:8px">Contact Identity</div>
      <div style="font-size:11px;color:var(--marble-dim);line-height:1.9">
        Email: <span style="color:var(--marble)">${esc(p.email||'—')}</span><br>
        Website: <span style="color:var(--marble)">${esc(p.website||'—')}</span><br>
        LinkedIn: <a href="${esc(p.linkedinUrl||'#')}" target="_blank" style="color:var(--gold)">${esc(p.linkedinUrl||'—')}</a><br>
        Prospect ID: <span style="color:var(--gold);font-family:'Cormorant Garamond',serif;font-size:14px">${esc(p.prospectId||'—')}</span>
      </div>
    </div>

    <div style="margin-bottom:18px; padding:12px; background:var(--surface2); border:1px solid var(--border)">
      <div style="font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:var(--gold);margin-bottom:12px">Gate Intelligence</div>
      <div class="fi-row" style="margin-bottom:10px">
         <div class="fg"><label class="fl">Gap Status</label>
           <select class="fi" id="pp-gap-status">
             <option value="exposure" ${p.legalGapStatus==='exposure'?'selected':''}>🔴 No Legal Page</option>
             <option value="generic" ${p.legalGapStatus==='generic'?'selected':''}>🟡 Generic SaaS</option>
             <option value="ai-lite" ${p.legalGapStatus==='ai-lite'?'selected':''}>🔵 AI-Lite</option>
             <option value="protected" ${p.legalGapStatus==='protected'?'selected':''}>⚪ Protected</option>
           </select>
         </div>
         <div class="fg"><label class="fl">Job Title</label>
            <input type="text" class="fi" id="pp-title" value="${esc(p.jobTitle||'')}">
         </div>
      </div>
      <div class="fg"><label class="fl">Legal Gap Analysis</label>
         <textarea class="fi" id="pp-gap-text" rows="2">${esc(p.legalGapAnalysis||'')}</textarea>
      </div>
      <div class="fg"><label class="fl" style="color:var(--gold)">Personalized Hook (The Spear)</label>
         <textarea class="fi" id="pp-hook" rows="3" style="border-color:var(--gold-mid)">${esc(p.personalizedHook||'')}</textarea>
      </div>
      <div style="display:flex; gap:15px">
        <label style="font-size:10px; display:flex; align-items:center; gap:5px">
          <input type="checkbox" id="pp-chk-native" ${p.aiNative?'checked':''}> AI-Native
        </label>
        <label style="font-size:10px; display:flex; align-items:center; gap:5px">
          <input type="checkbox" id="pp-chk-ext" ${p.externalAI?'checked':''}> External AI
        </label>
      </div>
    </div>

    <div style="margin-bottom:18px">
      <div style="font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:var(--marble-faint);margin-bottom:8px">Status & Routing</div>
      <div class="fi-row" style="margin-bottom:10px">
        <div class="fg"><label class="fl">Status</label>
          <select class="fi" id="pp-status">
            ${sel(['Cold','Warm','Hot','Replied','Negotiating','Converted','Dead'], p.status)}
          </select>
        </div>
        <div class="fg"><label class="fl">Follow-Up Branch</label>
          <select class="fi" id="pp-branch">
            ${sel(['','2A','2B','2C','2D'], p.followUpBranch)}
          </select>
        </div>
      </div>
      <div class="fi-row">
        <div class="fg"><label class="fl">Funding Stage</label>
          <select class="fi" id="pp-funding">
            ${sel(['','Pre-seed','Seed','Series A','Series B+','Bootstrapped'], p.fundingStage)}
          </select>
        </div>
        <div class="fg"><label class="fl">Intended Plan</label>
          <select class="fi" id="pp-plan">${planSel}</select>
        </div>
      </div>
    </div>

    <button class="btn btn-primary" style="width:100%;margin-bottom:20px" onclick="saveProspect()">Save Changes</button>

    <div style="border-top:1px solid var(--border);padding-top:16px;margin-bottom:10px">
      <div style="font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:var(--marble-faint);margin-bottom:10px">Email Log</div>
      <div id="pp-email-log" style="margin-bottom:12px">${logRows}</div>
      <div class="fi-row" style="margin-bottom:8px">
        <div class="fg"><label class="fl">Date</label>
          <input type="date" class="fi" id="pp-log-date" value="${new Date().toISOString().split('T')[0]}">
        </div>
        <div class="fg"><label class="fl">Type</label>
          <select class="fi" id="pp-log-type"><option>Cold Email</option><option>Follow-up 1</option><option>Follow-up 2</option><option>LinkedIn DM</option></select>
        </div>
      </div>
      <div class="fg"><label class="fl">Notes</label><textarea class="fi" id="pp-log-notes" rows="2"></textarea></div>
      <button class="btn btn-outline btn-sm" onclick="logEmail()">+ Log Email</button>
    </div>
  `;
}

async function saveProspect() {
  if (!currentProspect) return;
  const updates = {
    status: $('pp-status')?.value || currentProspect.status,
    followUpBranch: $('pp-branch')?.value || '',
    fundingStage: $('pp-funding')?.value || '',
    intendedPlan: $('pp-plan')?.value || '',
    jobTitle: $('pp-title')?.value?.trim() || '',
    legalGapStatus: $('pp-gap-status')?.value || 'generic',
    legalGapAnalysis: $('pp-gap-text')?.value?.trim() || '',
    personalizedHook: $('pp-hook')?.value?.trim() || '',
    aiNative: $('pp-chk-native')?.checked || false,
    externalAI: $('pp-chk-ext')?.checked || false,
    updatedAt: new Date().toISOString()
  };
  if (updates.legalGapStatus === 'exposure') updates.hotFlag = true;
  await db.collection('prospects').doc(currentProspect.id).set(updates, { merge: true });
  toast('Prospect saved');
}

async function logEmail() {
  if (!currentProspect) return;
  const entry = {
    date: $('pp-log-date')?.value || new Date().toISOString().split('T')[0],
    type: $('pp-log-type')?.value || 'Cold Email',
    notes: $('pp-log-notes')?.value?.trim() || ''
  };
  const newCount = (currentProspect.emailsSent||0) + 1;
  await db.collection('prospects').doc(currentProspect.id).update({
    emailLog: firebase.firestore.FieldValue.arrayUnion(entry),
    emailsSent: newCount, updatedAt: new Date().toISOString()
  });
  toast('Email logged');
  openPP(currentProspect.id);
}

async function genProspectId() {
  try {
    const snap = await db.collection('prospects').get();
    let max = 0;
    snap.forEach(d => {
      const m = (d.data().prospectId||'').match(/LN-P-(\d+)/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return `LN-P-${String(max + 1).padStart(3,'0')}`;
  } catch { return 'LN-P-001'; }
}

function openAddProspect() {
  const planOpts = Object.entries(PLANS).map(([k,v]) => `<option value="${k}">${v}</option>`).join('');
  openModal('Initialize Target Acquisition', `
    <div class="modal-grid">
      <div>
          <div class="section-sub">Gate 0: Identity</div>
          <div class="fi-row">
              <div class="fg"><label class="fl">Founder Name</label><input type="text" class="fi" id="ap-name"></div>
              <div class="fg"><label class="fl">Company</label><input type="text" class="fi" id="ap-company"></div>
          </div>
          <div class="fg"><label class="fl">Email *</label><input type="email" class="fi" id="ap-email"></div>
          <div class="fi-row">
              <div class="fg"><label class="fl">LinkedIn URL</label><input type="text" class="fi" id="ap-li"></div>
              <div class="fg"><label class="fl">Website</label><input type="text" class="fi" id="ap-web"></div>
          </div>
      </div>
      <div>
          <div class="section-sub">Gate 2: Audit & Hook</div>
          <div class="fg"><label class="fl">Legal Gap Status</label><select class="fi" id="ap-gap-status"><option value="exposure">🔴 No Legal Page</option><option value="generic" selected>🟡 Generic SaaS</option></select></div>
          <div class="fg"><label class="fl">Spear Hook *</label><textarea class="fi" id="ap-hook" rows="3"></textarea></div>
          <div class="fg"><label class="fl">Batch ID</label><input type="text" class="fi" id="ap-batch" value="Batch_01"></div>
      </div>
    </div>`, `
    <button class="btn btn-outline btn-sm" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary btn-sm" onclick="saveNewProspect()">Commence Outreach</button>`);
}

async function saveNewProspect() {
  const email = $('ap-email')?.value?.trim().toLowerCase();
  const hook  = $('ap-hook')?.value?.trim();
  if (!email || !hook) { toast('Email and Hook required', 'error'); return; }
  const pid = await genProspectId();
  const data = {
    founderName: $('ap-name')?.value?.trim() || '', email, company: $('ap-company')?.value?.trim() || '',
    linkedinUrl: $('ap-li')?.value?.trim() || '', website: $('ap-web')?.value?.trim() || '',
    legalGapStatus: $('ap-gap-status')?.value || 'generic', personalizedHook: hook, batchNumber: $('ap-batch')?.value || 'Batch_01',
    status: 'Cold', prospectId: pid, addedAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  };
  await db.collection('prospects').doc(email).set(data, { merge: true });
  closeModal();
  toast('Target added.');
}

async function loadAdmins() {
  const tbodies = document.querySelectorAll('#s-admins');
  if (tbodies.length === 0) return;
  try {
    const snap = await db.collection('admins').get();
    const admins = []; snap.forEach(d => admins.push({ id: d.id, ...d.data() }));
    const html = admins.length ? admins.map(a => `<tr><td>${esc(a.id)}</td><td class="dim">${esc(a.role||'superadmin')}</td><td onclick="event.stopPropagation()"><button class="btn btn-danger btn-sm" onclick="removeAdmin('${esc(a.id)}')">Remove</button></td></tr>`).join('') : '<tr><td colspan="3" class="loading">No admins</td></tr>';
    tbodies.forEach(tb => tb.innerHTML = html);
  } catch(e) { console.error(e); }
}

async function addAdmin() {
  const email = $('s-new-admin')?.value?.trim().toLowerCase();
  const role  = $('s-new-role')?.value || 'superadmin';
  if (!email) { toast('Enter an email', 'error'); return; }
  try {
    await db.collection('admins').doc(email).set({ role, addedAt: new Date().toISOString() });
    if ($('s-new-admin')) $('s-new-admin').value = '';
    await loadAdmins();
    toast(`${email} added.`);
  } catch(e) { console.error(e); }
}

async function removeAdmin(email) {
  if (!confirm(`Remove ${email}?`)) return;
  try {
    await db.collection('admins').doc(email).delete();
    await loadAdmins();
    toast(`${email} removed.`);
  } catch(e) { console.error(e); }
}

document.addEventListener('DOMContentLoaded', () => {
  if (typeof loadRitual === 'function') loadRitual();
});
