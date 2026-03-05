// admin-logic-2.js — Lex Nova HQ Admin Console (Part 2)
// Covers: Nav patch · Outreach CRM · Flagship · Content · Radar · Finance · Settings
// Requires: admin-logic-1.js loaded first (globals: $, qsa, esc, fmtDate, fmtMoney,
//           fmtDate, setText, setVal, toast, openModal, closeModal, planLabel,
//           planBadgeClass, statusBadgeClass, PLANS, PLAN_PRICES, nowTs, auth, db,
//           firebase, radarEntries, loadRadarCache, openDetail, convertLead)

'use strict';

// ── STATE ─────────────────────────────────────────────────────────────────────
let allProspects    = [];
let allFlagship     = [];
let allContent      = [];
let currentProspect = null;
let currentFlagship = null;
let editingRegIdx   = -1;

// ── NAV PATCH — wire logic-2 tabs into nav() from logic-1 ────────────────────
// Runs immediately; by this point nav() from logic-1 is already in scope.
(function patchNav() {
  const _nav = nav;
  window.nav = function(tab) {
    _nav(tab);
    const l2 = {
      outreach: loadOutreach, flagship: loadFlagship,
      content:  loadContent,  radar:    loadRadar,
      finance:  loadFinance,  settings: loadSettings
    };
    if (l2[tab]) l2[tab]();
  };
})();

// ── PAGE ACTIONS HELPER ───────────────────────────────────────────────────────
function setPageActions(html) {
  const el = $('pageActions');
  if (el) el.innerHTML = html;
}

// ── OUTREACH ──────────────────────────────────────────────────────────────────
let outreachListener = null;

function loadOutreach() {
  setPageActions('');
  // Kill any old listener before starting a new one to prevent memory leaks
  if (outreachListener) outreachListener(); 

  // REAL-TIME LISTENER: This stays "awake" for your 50 VP leads
  outreachListener = db.collection('prospects').onSnapshot((snap) => {
    allProspects = [];
    snap.forEach(d => allProspects.push({ id: d.id, ...d.data() }));
    
    // Auto-refresh the active view
    populateCommandCenter();
    
    // Detect which sub-tab is open and refresh its table
    const activeView = qsa('#tab-outreach .view-btn.active')[0]?.textContent?.toLowerCase();
    if (activeView?.includes('pipeline')) filterProspects();
    if (activeView?.includes('hot')) renderHot();
    if (activeView?.includes('follow-up')) renderFollowup();
  }, (e) => {
    console.error(e);
    toast('Outreach Sync Failed', 'error');
  });
}

function setOutreachView(view, el) {
  qsa('#tab-outreach .view-btn').forEach(b => b.classList.remove('active'));
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
  const today     = new Date(); today.setHours(0,0,0,0);
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const todayStr  = today.toISOString().split('T')[0];

  // Email counters from per-prospect email logs
  let emailsToday = 0, emailsWeek = 0;
  allProspects.forEach(p => {
    (p.emailLog||[]).forEach(e => {
      const d = new Date(e.date||0); d.setHours(0,0,0,0);
      if (d.getTime() === today.getTime()) emailsToday++;
      if (d >= weekStart) emailsWeek++;
    });
  });
  setText('oc-today', emailsToday);
  setText('oc-week',  emailsWeek);

  // Scanner counts from leads collection
  db.collection('leads').where('source','==','scanner').get().then(snap => {
    let all = 0, week = 0;
    snap.forEach(d => {
      all++;
      const ts = d.data().createdAt;
      const dt = ts ? (ts.toDate ? ts.toDate() : new Date(ts)) : null;
      if (dt && dt >= weekStart) week++;
    });
    setText('oc-scanner-all',  all);
    setText('oc-scanner-week', week);
  }).catch(() => {});

  // Pipeline funnel
  const fc = { Cold:0, Warm:0, Hot:0, Replied:0, Negotiating:0, Converted:0 };
  allProspects.forEach(p => { if (fc[p.status] !== undefined) fc[p.status]++; });
  setText('ocf-cold',    fc.Cold);
  setText('ocf-warm',    fc.Warm);
  setText('ocf-hot',     fc.Hot);
  setText('ocf-replied', fc.Replied);
  setText('ocf-neg',     fc.Negotiating);
  setText('ocf-conv',    fc.Converted);

  // Action queue
  let fuToday = 0, fuOver = 0, liPending = 0;
  allProspects.filter(p => !['Converted','Dead'].includes(p.status)).forEach(p => {
    if (p.nextActionDate) {
      if (p.nextActionDate === todayStr) fuToday++;
      if (p.nextActionDate  < todayStr) fuOver++;
    }
    if (['pending','connected_no_reply'].includes(p.linkedinStatus)) liPending++;
  });
  setText('aq-today', fuToday);
  setText('aq-over',  fuOver);
  setText('aq-li',    liPending);

  db.collection('leads').where('status','in',['new','scanner_submitted']).get()
    .then(snap => setText('aq-inbound', snap.size))
    .catch(()  => setText('aq-inbound', '—'));

  renderBatchPerformance();
}

function renderBatchPerformance() {
  const tbody = $('oc-batches');
  if (!tbody) return;
  const batches = {};
  allProspects.forEach(p => {
    const b = p.batchNumber || 'Unassigned';
    if (!batches[b]) batches[b] = { prospects:0, emails:0, replies:0, clicks:0, completions:0, conv:0 };
    batches[b].prospects++;
    batches[b].emails      += p.emailsSent || 0;
    if (['Replied','Negotiating'].includes(p.status)) batches[b].replies++;
    if (p.scannerClicked)    batches[b].clicks++;
    if (p.scannerCompleted)  batches[b].completions++;
    if (p.status === 'Converted') batches[b].conv++;
  });
  const keys = Object.keys(batches).sort();
  if (!keys.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="loading">No batches yet</td></tr>';
    return;
  }
  tbody.innerHTML = keys.map(b => {
    const r = batches[b];
    return `<tr>
      <td>${esc(b)}</td><td>${r.prospects}</td><td>${r.emails}</td>
      <td>${r.replies}</td><td>${r.clicks}</td><td>${r.completions}</td><td>${r.conv}</td>
    </tr>`;
  }).join('');
}

// ── PIPELINE TABLE ────────────────────────────────────────────────────────────
function populateBatchFilter() {
  const sel = $('op-batch');
  if (!sel || sel.options.length > 1) return;
  [...new Set(allProspects.map(p => p.batchNumber).filter(Boolean))].sort().forEach(b => {
    const o = document.createElement('option'); o.value = b; o.textContent = b;
    sel.appendChild(o);
  });
}

function renderPipeline(list) {
  const tbody = $('op-tbody');
  if (!tbody) return;
  const rows = list.filter(p => p.status !== 'Dead');
  if (!rows.length) { tbody.innerHTML = '<tr><td colspan="9" class="loading">No prospects found</td></tr>'; return; }
  const sClass = { Cold:'b-cold', Warm:'b-warm', Hot:'b-hot', Replied:'b-intake',
                   Negotiating:'b-production', Converted:'b-converted' };
  tbody.innerHTML = rows.map(p => {
    const fire = p.scannerCompleted ? '🔥🔥' : p.scannerClicked ? '🔥' : '';
    const scan = p.scannerCompleted
      ? '<span class="badge b-delivered">Completed</span>'
      : p.scannerClicked
      ? '<span class="badge b-warm">Clicked</span>'
      : '<span class="badge b-ghost">—</span>';
    return `<tr onclick="openPP('${esc(p.id)}')">
      <td>${esc(p.founderName||p.name||'—')}${fire ? ` <span class="hot-flag">${fire}</span>` : ''}</td>
      <td class="dim">${esc(p.company||'—')}</td>
      <td class="dim">${esc(p.batchNumber||'—')}</td>
      <td><span class="badge ${sClass[p.status]||'b-ghost'}">${esc(p.status||'—')}</span></td>
      <td class="dim">${esc(p.followUpBranch||'—')}</td>
      <td>${scan}</td>
      <td class="dim">${esc(p.linkedinStatus||'—')}</td>
      <td class="dim">${esc(p.nextActionDate||'—')}</td>
      <td class="dim">${p.emailsSent||0}</td>
    </tr>`;
  }).join('');
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

function renderHot() {
  const tbody = $('oh-tbody');
  if (!tbody) return;
  const hot = allProspects.filter(p => (p.scannerClicked||p.scannerCompleted) && p.status !== 'Converted');
  if (!hot.length) { tbody.innerHTML = '<tr><td colspan="6" class="loading">No hot signals yet</td></tr>'; return; }
  tbody.innerHTML = hot.map(p => `
    <tr onclick="openPP('${esc(p.id)}')">
      <td>${esc(p.founderName||p.name||'—')} ${p.scannerCompleted?'🔥🔥':'🔥'}</td>
      <td class="dim">${esc(p.company||'—')}</td>
      <td>${p.scannerCompleted ? 'Scanner Completed' : 'Scanner Clicked'}</td>
      <td>${p.scannerExternalScore ?? '—'}</td>
      <td><span class="badge b-${(p.status||'cold').toLowerCase()}">${esc(p.status||'—')}</span></td>
      <td class="dim">${esc(p.nextActionDate||'—')}</td>
    </tr>`).join('');
}

function renderFollowup() {
  const tbody = $('ofu-tbody');
  if (!tbody) return;
  const todayStr = new Date().toISOString().split('T')[0];
  const due = allProspects
    .filter(p => p.nextActionDate && p.nextActionDate <= todayStr && !['Converted','Dead'].includes(p.status))
    .sort((a,b) => (a.nextActionDate||'').localeCompare(b.nextActionDate||''));
  if (!due.length) { tbody.innerHTML = '<tr><td colspan="5" class="loading">No follow-ups due</td></tr>'; return; }
  tbody.innerHTML = due.map(p => {
    const over = p.nextActionDate < todayStr;
    return `<tr onclick="openPP('${esc(p.id)}')">
      <td>${esc(p.founderName||p.name||'—')}</td>
      <td class="dim">${esc(p.company||'—')}</td>
      <td ${over?'style="color:#d47a7a"':''}>${esc(p.nextActionDate)} ${over?'⚠':''}</td>
      <td><span class="badge b-${(p.status||'cold').toLowerCase()}">${esc(p.status||'—')}</span></td>
      <td class="dim">${esc(p.nextAction||'—')}</td>
    </tr>`;
  }).join('');
}

async function renderInbound() {
  const tbody = $('oin-tbody');
  if (!tbody) return;
  try {
    const snap = await db.collection('leads')
      .where('leadType','in',['warm_lead','hot_lead'])
      .orderBy('createdAt','desc').get();
    const leads = [];
    snap.forEach(d => leads.push({ id: d.id, ...d.data() }));
    const active = leads.filter(l => !['converted','archived'].includes(l.status));
    if (!active.length) { tbody.innerHTML = '<tr><td colspan="6" class="loading">No inbound submissions</td></tr>'; return; }
    tbody.innerHTML = active.map(l => `
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
  } catch(e) { console.error(e); tbody.innerHTML = '<tr><td colspan="6" class="loading">Error loading</td></tr>'; }
}

function renderDead() {
  const tbody = $('od-tbody');
  if (!tbody) return;
  const dead = allProspects.filter(p => p.status === 'Dead');
  if (!dead.length) { tbody.innerHTML = '<tr><td colspan="4" class="loading">No archived prospects</td></tr>'; return; }
  tbody.innerHTML = dead.map(p => `
    <tr onclick="openPP('${esc(p.id)}')">
      <td>${esc(p.founderName||p.name||'—')}</td>
      <td class="dim">${esc(p.company||'—')}</td>
      <td class="dim">${esc(p.batchNumber||'—')}</td>
      <td class="dim">${fmtDate(p.archivedAt||p.updatedAt)}</td>
    </tr>`).join('');
}

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
  const planSel = Object.entries(PLANS).map(([k,v]) =>
    `<option value="${k}" ${p.intendedPlan===k?'selected':''}>${v}</option>`).join('');
  const logRows = (p.emailLog||[]).slice().reverse().map(e =>
    `<div style="display:flex;gap:10px;padding:7px 0;border-bottom:1px solid rgba(197,160,89,.06);font-size:10px">
      <span style="color:var(--marble-faint);flex-shrink:0;width:80px">${esc(e.date||'—')}</span>
      <span style="color:var(--gold);flex-shrink:0;width:90px">${esc(e.type||'—')}</span>
      <span style="color:var(--marble-dim)">${esc(e.notes||'')}</span>
    </div>`).join('') || '<div style="font-size:10px;color:var(--marble-faint)">No emails logged</div>';

  body.innerHTML = `
    <div style="margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid var(--border)">
      <div style="font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:var(--marble-faint);margin-bottom:8px">Contact</div>
      <div style="font-size:11px;color:var(--marble-dim);line-height:1.9">
        Email: <span style="color:var(--marble)">${esc(p.email||'—')}</span><br>
        Location: <span style="color:var(--marble)">${esc(p.location||'—')}</span><br>
        LinkedIn: <a href="${esc(p.linkedinUrl||'#')}" target="_blank" style="color:var(--gold)">${esc(p.linkedinUrl||'—')}</a><br>
        Prospect ID: <span style="color:var(--gold);font-family:'Cormorant Garamond',serif;font-size:14px">${esc(p.prospectId||'—')}</span>
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

    <div style="margin-bottom:18px">
      <div style="font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:var(--marble-faint);margin-bottom:8px">Outreach Tracking</div>
      <div class="fi-row" style="margin-bottom:10px">
        <div class="fg"><label class="fl">LinkedIn Status</label>
          <select class="fi" id="pp-li">
            ${sel(['','connected','pending','connected_no_reply','replied'], p.linkedinStatus)}
          </select>
        </div>
        <div class="fg"><label class="fl">Emails Sent</label>
          <input type="number" class="fi" id="pp-emails" value="${p.emailsSent||0}" min="0">
        </div>
      </div>
      <div style="display:flex;gap:24px;margin-bottom:10px;font-size:11px">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
          <input type="checkbox" id="pp-sc" ${p.scannerClicked?'checked':''}> Scanner Clicked 🔥
        </label>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
          <input type="checkbox" id="pp-scomp" ${p.scannerCompleted?'checked':''}> Completed 🔥🔥
        </label>
      </div>
      <div class="fi-row">
        <div class="fg"><label class="fl">Ext Score</label>
          <input type="number" class="fi" id="pp-ext" value="${p.scannerExternalScore||''}">
        </div>
        <div class="fg"><label class="fl">Int Score</label>
          <input type="number" class="fi" id="pp-int" value="${p.scannerInternalScore||''}">
        </div>
      </div>
    </div>

    <div style="margin-bottom:18px">
      <div style="font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:var(--marble-faint);margin-bottom:8px">Next Action</div>
      <div class="fg"><label class="fl">Date</label>
        <input type="date" class="fi" id="pp-next-date" value="${p.nextActionDate||''}">
      </div>
      <div class="fg"><label class="fl">Note</label>
        <textarea class="fi" id="pp-next-note" rows="2">${esc(p.nextAction||'')}</textarea>
      </div>
    </div>

    <div class="fg" style="margin-bottom:18px">
      <label class="fl">Internal Notes</label>
      <textarea class="fi" id="pp-notes" rows="3">${esc(p.notes||'')}</textarea>
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
          <select class="fi" id="pp-log-type">
            <option>Cold Email</option><option>Follow-up 1</option><option>Follow-up 2</option>
            <option>Follow-up 3</option><option>Reply</option><option>LinkedIn DM</option>
          </select>
        </div>
      </div>
      <div class="fg"><label class="fl">Notes</label>
        <textarea class="fi" id="pp-log-notes" rows="2" placeholder="Subject / notes…"></textarea>
      </div>
      <button class="btn btn-outline btn-sm" onclick="logEmail()">+ Log Email</button>
    </div>
  `;
}

async function saveProspect() {
  if (!currentProspect) return;
  const updates = {
    status:               $('pp-status')?.value             || currentProspect.status,
    followUpBranch:       $('pp-branch')?.value             || '',
    fundingStage:         $('pp-funding')?.value            || '',
    intendedPlan:         $('pp-plan')?.value               || '',
    linkedinStatus:       $('pp-li')?.value                 || '',
    emailsSent:           parseInt($('pp-emails')?.value)   || 0,
    scannerClicked:       $('pp-sc')?.checked               || false,
    scannerCompleted:     $('pp-scomp')?.checked            || false,
    scannerExternalScore: parseFloat($('pp-ext')?.value)    || null,
    scannerInternalScore: parseFloat($('pp-int')?.value)    || null,
    nextActionDate:       $('pp-next-date')?.value          || '',
    nextAction:           $('pp-next-note')?.value?.trim()  || '',
    notes:                $('pp-notes')?.value?.trim()      || '',
    updatedAt:            new Date().toISOString()
  };
  if (updates.status === 'Dead' && currentProspect.status !== 'Dead')
    updates.archivedAt = new Date().toISOString();

  try {
    await db.collection('prospects').doc(currentProspect.id).set(updates, { merge: true });
    currentProspect = { ...currentProspect, ...updates };
    const idx = allProspects.findIndex(p => p.id === currentProspect.id);
    if (idx !== -1) allProspects[idx] = currentProspect;
    toast('Prospect saved');
  } catch(e) { console.error(e); toast('Save failed', 'error'); }
}

async function logEmail() {
  if (!currentProspect) return;
  const entry = {
    date:  $('pp-log-date')?.value  || new Date().toISOString().split('T')[0],
    type:  $('pp-log-type')?.value  || 'Cold Email',
    notes: $('pp-log-notes')?.value?.trim() || ''
  };
  const newCount = (currentProspect.emailsSent||0) + 1;
  try {
    await db.collection('prospects').doc(currentProspect.id).update({
      emailLog:   firebase.firestore.FieldValue.arrayUnion(entry),
      emailsSent: newCount,
      updatedAt:  new Date().toISOString()
    });
    currentProspect.emailLog   = [...(currentProspect.emailLog||[]), entry];
    currentProspect.emailsSent = newCount;
    if ($('pp-emails')) $('pp-emails').value = newCount;
    if ($('pp-log-notes')) $('pp-log-notes').value = '';
    // Refresh log in panel
    const logEl = $('pp-email-log');
    if (logEl) {
      logEl.innerHTML = currentProspect.emailLog.slice().reverse().map(e =>
        `<div style="display:flex;gap:10px;padding:7px 0;border-bottom:1px solid rgba(197,160,89,.06);font-size:10px">
          <span style="color:var(--marble-faint);flex-shrink:0;width:80px">${esc(e.date)}</span>
          <span style="color:var(--gold);flex-shrink:0;width:90px">${esc(e.type)}</span>
          <span style="color:var(--marble-dim)">${esc(e.notes)}</span>
        </div>`).join('');
    }
    toast('Email logged');
  } catch(e) { console.error(e); toast('Log failed', 'error'); }
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
  openModal('Add Prospect', `
    <div class="fi-row">
      <div class="fg"><label class="fl">Founder Name</label>
        <input type="text" class="fi" id="ap-name" placeholder="Jane Smith"></div>
      <div class="fg"><label class="fl">Company</label>
        <input type="text" class="fi" id="ap-company" placeholder="Acme AI"></div>
    </div>
    <div class="fg"><label class="fl">Email *</label>
      <input type="email" class="fi" id="ap-email" placeholder="jane@acme.ai"></div>
    <div class="fi-row">
      <div class="fg"><label class="fl">LinkedIn URL</label>
        <input type="text" class="fi" id="ap-li" placeholder="https://linkedin.com/in/…"></div>
      <div class="fg"><label class="fl">Website</label>
        <input type="text" class="fi" id="ap-web" placeholder="https://acme.ai"></div>
    </div>
    <div class="fi-row">
      <div class="fg"><label class="fl">Funding Stage</label>
        <select class="fi" id="ap-fund">
          <option>Pre-seed</option><option>Seed</option>
          <option>Series A</option><option>Series B+</option><option>Bootstrapped</option>
        </select></div>
      <div class="fg"><label class="fl">Location</label>
        <input type="text" class="fi" id="ap-loc" placeholder="San Francisco, CA"></div>
    </div>
    <div class="fi-row">
      <div class="fg"><label class="fl">Source</label>
        <select class="fi" id="ap-source">
          <option value="yc">YC Directory</option><option value="product_hunt">Product Hunt</option>
          <option value="indiehackers">IndieHackers</option><option value="wellfound">Wellfound</option>
          <option value="linkedin">LinkedIn</option><option value="direct">Direct</option>
          <option value="other">Other</option>
        </select></div>
      <div class="fg"><label class="fl">Batch #</label>
        <input type="text" class="fi" id="ap-batch" placeholder="B001"></div>
    </div>
    <div class="fg"><label class="fl">Intended Plan</label>
      <select class="fi" id="ap-plan">${planOpts}</select></div>
    <div class="fg"><label class="fl">Notes</label>
      <textarea class="fi" id="ap-notes" rows="2"></textarea></div>
  `, `
    <button class="btn btn-outline btn-sm" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary btn-sm" onclick="saveNewProspect()">Add Prospect</button>
  `);
}

async function saveNewProspect() {
  const email = $('ap-email')?.value?.trim().toLowerCase();
  if (!email) { toast('Email is required', 'error'); return; }
  try {
    const pid  = await genProspectId();
    const data = {
      founderName:          $('ap-name')?.value?.trim()    || '',
      email,
      company:              $('ap-company')?.value?.trim() || '',
      linkedinUrl:          $('ap-li')?.value?.trim()      || '',
      website:              $('ap-web')?.value?.trim()     || '',
      fundingStage:         $('ap-fund')?.value            || '',
      location:             $('ap-loc')?.value?.trim()     || '',
      source:               $('ap-source')?.value          || '',
      batchNumber:          $('ap-batch')?.value?.trim()   || '',
      intendedPlan:         $('ap-plan')?.value            || 'agentic_shield',
      notes:                $('ap-notes')?.value?.trim()   || '',
      status:               'Cold',
      prospectId:           pid,
      emailsSent:           0,
      emailLog:             [],
      scannerClicked:       false,
      scannerCompleted:     false,
      addedAt:              new Date().toISOString(),
      updatedAt:            new Date().toISOString()
    };
    await db.collection('prospects').doc(email).set(data, { merge: true });
    allProspects.push({ id: email, ...data });
    closeModal();
    toast(`${pid} added`);
  } catch(e) { console.error(e); toast('Save failed', 'error'); }
}

// ── FLAGSHIP ──────────────────────────────────────────────────────────────────
async function loadFlagship() {
  setPageActions(`<button class="btn btn-primary" onclick="openAddFlagship()">+ Add Flagship Prospect</button>`);
  const tbody = $('fs-tbody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="loading">Loading…</td></tr>';
  try {
    const snap = await db.collection('flagship').orderBy('addedAt','desc').get();
    allFlagship = [];
    snap.forEach(d => allFlagship.push({ id: d.id, ...d.data() }));
    renderFlagshipTable(allFlagship);
  } catch(e) {
    console.error(e);
    const tb = $('fs-tbody');
    if (tb) tb.innerHTML = '<tr><td colspan="7" class="loading" style="color:#d47a7a">Failed to load</td></tr>';
  }
}

function renderFlagshipTable(list) {
  const tbody = $('fs-tbody');
  if (!tbody) return;
  if (!list.length) { tbody.innerHTML = '<tr><td colspan="7" class="loading">No flagship prospects</td></tr>'; return; }
  const sClass = {
    'Identified':'b-cold', 'Discovery Scheduled':'b-intake', 'Discovery Done':'b-warm',
    'Proposal Sent':'b-production', 'Negotiating':'b-hot', 'Won':'b-delivered', 'Lost':'b-dead'
  };
  tbody.innerHTML = list.map(fs => {
    let fuBadge = '';
    if (fs.proposalSentAt && fs.status === 'Proposal Sent') {
      const hrs = Math.floor((Date.now() - new Date(fs.proposalSentAt).getTime()) / 3600000);
      fuBadge = hrs > 24
        ? ` <span style="color:#d47a7a;font-size:9px">⚠ ${hrs}h</span>`
        : ` <span style="color:var(--gold);font-size:9px">${hrs}h</span>`;
    }
    return `<tr onclick="openFSP('${esc(fs.id)}')">
      <td>${esc(fs.founderName||fs.name||'—')}</td>
      <td class="dim">${esc(fs.company||'—')}</td>
      <td><span class="badge ${sClass[fs.status]||'b-ghost'}">${esc(fs.status||'—')}</span></td>
      <td class="dim">${fmtMoney(fs.priceQuoted)}</td>
      <td class="dim">${esc(fs.proposalSentDate||'—')}${fuBadge}</td>
      <td class="dim">${esc(fs.nextStep||'—')}</td>
      <td class="dim">${fmtDate(fs.addedAt)}</td>
    </tr>`;
  }).join('');
}

function filterFlagship() {
  const s  = ($('fs-search')?.value||'').toLowerCase();
  const st = $('fs-status')?.value || '';
  renderFlagshipTable(allFlagship.filter(f =>
    (!s  || (f.founderName||f.name||'').toLowerCase().includes(s) || (f.company||'').toLowerCase().includes(s)) &&
    (!st || f.status === st)
  ));
}

function openAddFlagship() {
  openModal('Add Flagship Prospect', `
    <div class="fi-row">
      <div class="fg"><label class="fl">Founder Name</label>
        <input type="text" class="fi" id="fsa-name" placeholder="John Smith"></div>
      <div class="fg"><label class="fl">Company</label>
        <input type="text" class="fi" id="fsa-company" placeholder="Acme Corp"></div>
    </div>
    <div class="fg"><label class="fl">Email *</label>
      <input type="email" class="fi" id="fsa-email" placeholder="john@acme.com"></div>
    <div class="fg"><label class="fl">Initial Notes</label>
      <textarea class="fi" id="fsa-notes" rows="2"></textarea></div>
  `, `
    <button class="btn btn-outline btn-sm" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary btn-sm" onclick="saveNewFlagship()">Add</button>
  `);
}

async function saveNewFlagship() {
  const email = $('fsa-email')?.value?.trim().toLowerCase();
  if (!email) { toast('Email is required', 'error'); return; }
  const data = {
    founderName: $('fsa-name')?.value?.trim()    || '',
    email,
    company:     $('fsa-company')?.value?.trim() || '',
    preCallNotes:$('fsa-notes')?.value?.trim()   || '',
    status:      'Identified',
    addedAt:     new Date().toISOString(),
    updatedAt:   new Date().toISOString()
  };
  try {
    const ref = await db.collection('flagship').add(data);
    allFlagship.unshift({ id: ref.id, ...data });
    renderFlagshipTable(allFlagship);
    closeModal();
    toast('Flagship prospect added');
  } catch(e) { console.error(e); toast('Save failed', 'error'); }
}

function openFSP(id) {
  const fs = allFlagship.find(x => x.id === id);
  if (!fs) return;
  currentFlagship = fs;
  $('flagshipPanel')?.classList.add('open');
  setText('fsp-name', fs.founderName || fs.name || '—');
  setText('fsp-meta', fs.company || '—');
  renderFSPBody(fs);
}

function closeFSP() {
  currentFlagship = null;
  $('flagshipPanel')?.classList.remove('open');
}

function renderFSPBody(fs) {
  const body = $('fsp-body');
  if (!body) return;
  const statuses = ['Identified','Discovery Scheduled','Discovery Done','Proposal Sent','Negotiating','Won','Lost'];
  const sOpts    = statuses.map(s => `<option ${fs.status===s?'selected':''}>${s}</option>`).join('');
  const pOpts    = Object.entries(PLANS).map(([k,v]) =>
    `<option value="${k}" ${fs.prescribedPlan===k?'selected':''}>${v}</option>`).join('');

  let fuTracker = '';
  if (fs.proposalSentAt) {
    const hrs = Math.floor((Date.now() - new Date(fs.proposalSentAt).getTime()) / 3600000);
    const col = hrs > 24 ? '#d47a7a' : '#C5A059';
    fuTracker = `<div style="font-size:10px;color:${col};margin-top:4px">
      ⏱ ${hrs}h since proposal${hrs > 24 ? ' — FOLLOW-UP OVERDUE' : ''}
    </div>`;
  }

  body.innerHTML = `<div style="padding:18px 20px">
    <div class="fg"><label class="fl">Status</label>
      <select class="fi" id="fsp-status">${sOpts}</select></div>
    <div class="fg"><label class="fl">Pre-Call Diagnostic Notes</label>
      <textarea class="fi" id="fsp-precall" rows="3">${esc(fs.preCallNotes||'')}</textarea></div>
    <div class="fg"><label class="fl">Post-Call Gap Identified</label>
      <textarea class="fi" id="fsp-postcall" rows="3">${esc(fs.postCallGap||'')}</textarea></div>
    <div class="fi-row">
      <div class="fg"><label class="fl">Plan Prescribed</label>
        <select class="fi" id="fsp-plan">${pOpts}</select></div>
      <div class="fg"><label class="fl">Price Quoted (USD)</label>
        <input type="number" class="fi" id="fsp-price" value="${fs.priceQuoted||''}"></div>
    </div>
    <div class="fg">
      <label class="fl">Proposal Sent Date</label>
      <input type="date" class="fi" id="fsp-prop-date" value="${fs.proposalSentDate||''}">
      ${fuTracker}
    </div>
    <div class="fg"><label class="fl">Next Step</label>
      <textarea class="fi" id="fsp-next" rows="2">${esc(fs.nextStep||'')}</textarea></div>
    <button class="btn btn-primary btn-full" onclick="saveFSP()">Save</button>
  </div>`;
}

async function saveFSP() {
  if (!currentFlagship) return;
  const propDate = $('fsp-prop-date')?.value || '';
  const updates  = {
    status:           $('fsp-status')?.value         || currentFlagship.status,
    preCallNotes:     $('fsp-precall')?.value?.trim() || '',
    postCallGap:      $('fsp-postcall')?.value?.trim()|| '',
    prescribedPlan:   $('fsp-plan')?.value            || '',
    priceQuoted:      parseFloat($('fsp-price')?.value) || null,
    proposalSentDate: propDate,
    nextStep:         $('fsp-next')?.value?.trim()    || '',
    updatedAt:        new Date().toISOString()
  };
  if (propDate && !currentFlagship.proposalSentAt)
    updates.proposalSentAt = new Date().toISOString();

  try {
    await db.collection('flagship').doc(currentFlagship.id).set(updates, { merge: true });
    currentFlagship = { ...currentFlagship, ...updates };
    const idx = allFlagship.findIndex(f => f.id === currentFlagship.id);
    if (idx !== -1) allFlagship[idx] = currentFlagship;
    renderFlagshipTable(allFlagship);
    toast('Flagship saved');
  } catch(e) { console.error(e); toast('Save failed', 'error'); }
}

// ── CONTENT ───────────────────────────────────────────────────────────────────
async function loadContent() {
  setPageActions(`<button class="btn btn-primary" onclick="openAddContent()">+ Add Post</button>`);
  const tbody = $('ct-tbody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="loading">Loading…</td></tr>';
  try {
    const snap = await db.collection('content').orderBy('createdAt','desc').get();
    allContent = [];
    snap.forEach(d => allContent.push({ id: d.id, ...d.data() }));
    renderContent(allContent);
  } catch(e) {
    console.error(e);
    const tb = $('ct-tbody');
    if (tb) tb.innerHTML = '<tr><td colspan="5" class="loading" style="color:#d47a7a">Failed to load</td></tr>';
  }
}

function renderContent(list) {
  const tbody = $('ct-tbody');
  if (!tbody) return;
  if (!list.length) { tbody.innerHTML = '<tr><td colspan="5" class="loading">No content logged</td></tr>'; return; }
  const sClass = { Idea:'b-ghost', Drafting:'b-cold', Scheduled:'b-intake', Posted:'b-delivered', Archived:'b-dead' };
  tbody.innerHTML = list.map(c => `
    <tr>
      <td>${esc(c.topic||'—')}</td>
      <td><span class="badge ${sClass[c.status]||'b-ghost'}">${esc(c.status||'—')}</span></td>
      <td class="dim">${esc(c.postedDate||'—')}</td>
      <td class="dim">${esc(c.notes||'—')}</td>
      <td onclick="event.stopPropagation()" style="white-space:nowrap">
        <button class="btn btn-ghost btn-sm" onclick="openEditContent('${esc(c.id)}')">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteContent('${esc(c.id)}')">Delete</button>
      </td>
    </tr>`).join('');
}

function filterContent() {
  const st = $('ct-status')?.value || '';
  renderContent(allContent.filter(c => !st || c.status === st));
}

function contentModalBody(c) {
  const s = c || {};
  const stats = ['Idea','Drafting','Scheduled','Posted','Archived'];
  return `
    <div class="fg"><label class="fl">Topic / Title</label>
      <input type="text" class="fi" id="ct-topic" value="${esc(s.topic||'')}" placeholder="Post topic…"></div>
    <div class="fi-row">
      <div class="fg"><label class="fl">Status</label>
        <select class="fi" id="ct-status-sel">
          ${stats.map(x => `<option ${s.status===x?'selected':''}>${x}</option>`).join('')}
        </select></div>
      <div class="fg"><label class="fl">Posted Date</label>
        <input type="date" class="fi" id="ct-date" value="${s.postedDate||''}"></div>
    </div>
    <div class="fg"><label class="fl">Notes</label>
      <textarea class="fi" id="ct-notes" rows="2">${esc(s.notes||'')}</textarea></div>`;
}

function openAddContent() {
  openModal('Add Content', contentModalBody(null), `
    <button class="btn btn-outline btn-sm" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary btn-sm" onclick="saveContent(null)">Add</button>
  `);
}

function openEditContent(id) {
  const c = allContent.find(x => x.id === id);
  if (!c) return;
  openModal('Edit Content', contentModalBody(c), `
    <button class="btn btn-outline btn-sm" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary btn-sm" onclick="saveContent('${id}')">Save</button>
  `);
}

async function saveContent(id) {
  const data = {
    topic:      $('ct-topic')?.value?.trim()  || '',
    status:     $('ct-status-sel')?.value     || 'Idea',
    postedDate: $('ct-date')?.value           || '',
    notes:      $('ct-notes')?.value?.trim()  || '',
    updatedAt:  new Date().toISOString()
  };
  if (!data.topic) { toast('Topic is required', 'error'); return; }
  try {
    if (id) {
      await db.collection('content').doc(id).set(data, { merge: true });
      const idx = allContent.findIndex(c => c.id === id);
      if (idx !== -1) allContent[idx] = { ...allContent[idx], ...data };
    } else {
      data.createdAt = new Date().toISOString();
      const ref = await db.collection('content').add(data);
      allContent.unshift({ id: ref.id, ...data });
    }
    closeModal();
    renderContent(allContent);
    toast('Content saved');
  } catch(e) { console.error(e); toast('Save failed', 'error'); }
}

async function deleteContent(id) {
  if (!confirm('Delete this entry?')) return;
  try {
    await db.collection('content').doc(id).delete();
    allContent = allContent.filter(c => c.id !== id);
    renderContent(allContent);
    toast('Deleted');
  } catch(e) { console.error(e); toast('Delete failed', 'error'); }
}

// ── RADAR ─────────────────────────────────────────────────────────────────────
async function loadRadar() {
  setPageActions('');
  await loadRadarCache();
  renderRadarList();
  // Ensure manage view is visible
  $('rv-manage')?.classList.remove('hidden');
  $('rv-exposure')?.classList.add('hidden');
  qsa('#tab-radar .view-btn').forEach((b,i) => b.classList.toggle('active', i === 0));
  // Radar badge — CRITICAL count
  const badge = $('radar-badge');
  if (badge) {
    const n = radarEntries.filter(r => r.severity === 'CRITICAL').length;
    badge.textContent = n;
    badge.classList.toggle('hidden', n === 0);
  }
}

function setRadarView(view, el) {
  qsa('#tab-radar .view-btn').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
  $('rv-manage')?.classList.toggle('hidden',   view !== 'manage');
  $('rv-exposure')?.classList.toggle('hidden', view !== 'exposure');
  if (view === 'manage')   renderRadarList();
  if (view === 'exposure') renderExposureMatrix();
}

function renderRadarList() {
  const el = $('rv-list');
  if (!el) return;
  const addBtn = `<div style="margin-bottom:16px;text-align:right">
    <button class="btn btn-primary btn-sm" onclick="openRadarModal(-1)">+ Add Regulation</button>
  </div>`;
  if (!radarEntries.length) {
    el.innerHTML = addBtn + '<div class="tbl-empty">No regulations in radar yet</div>';
    return;
  }
  const sevOrder = { CRITICAL:0, HIGH:1, MEDIUM:2, LOW:3 };
  const sorted   = radarEntries.map((r,i) => ({ ...r, _i: i }))
    .sort((a,b) => (sevOrder[a.severity]??4) - (sevOrder[b.severity]??4));
  const sevClass = { CRITICAL:'b-red', HIGH:'b-yellow', MEDIUM:'b-warm', LOW:'b-ghost' };

  el.innerHTML = addBtn + sorted.map(reg => {
    const plans = (reg.coveredByPlan||[])
      .map(p => `<span class="badge b-intake" style="margin-right:3px">${planLabel(p)}</span>`).join('');
    return `<div class="radar-entry">
      <div style="flex:1">
        <div class="radar-title">${esc(reg.title||'—')}</div>
        <div class="radar-meta">${esc(reg.jurisdiction||'—')} · Effective: ${esc(reg.effectiveDate||'—')}</div>
        ${plans ? `<div style="margin-top:6px">${plans}</div>` : ''}
        ${reg.description ? `<div style="font-size:10px;color:var(--marble-dim);margin-top:4px">${esc(reg.description)}</div>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;flex-shrink:0">
        <span class="badge ${sevClass[reg.severity]||'b-ghost'}">${esc(reg.severity||'—')}</span>
        <div class="radar-actions">
          <button class="btn btn-ghost btn-sm" onclick="openRadarModal(${reg._i})">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteRadarEntry(${reg._i})">Delete</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function openRadarModal(idx) {
  editingRegIdx = idx;
  const reg = idx >= 0 ? (radarEntries[idx] || {}) : {};
  const jurs = ['US-Federal','US-CA','US-NY','US-TX','US-CO','US-IL','EU','UK','Canada','Australia','Singapore','India','UAE','Global'];
  const jurOpts   = jurs.map(j => `<option ${reg.jurisdiction===j?'selected':''}>${j}</option>`).join('');
  const planChecks = Object.entries(PLANS).map(([k,v]) =>
    `<label style="display:flex;align-items:center;gap:8px;font-size:11px;margin-bottom:6px;cursor:pointer">
      <input type="checkbox" class="reg-plan-chk" value="${k}" ${(reg.coveredByPlan||[]).includes(k)?'checked':''}> ${v}
    </label>`).join('');

  openModal(idx >= 0 ? 'Edit Regulation' : 'Add Regulation', `
    <div class="fg"><label class="fl">Title *</label>
      <input type="text" class="fi" id="reg-title" value="${esc(reg.title||'')}"></div>
    <div class="fg"><label class="fl">Description</label>
      <textarea class="fi" id="reg-desc" rows="2">${esc(reg.description||'')}</textarea></div>
    <div class="fi-row">
      <div class="fg"><label class="fl">Jurisdiction</label>
        <select class="fi" id="reg-jur">${jurOpts}</select></div>
      <div class="fg"><label class="fl">Severity</label>
        <select class="fi" id="reg-sev">
          ${['CRITICAL','HIGH','MEDIUM','LOW'].map(s =>
            `<option ${reg.severity===s?'selected':''}>${s}</option>`).join('')}
        </select></div>
    </div>
    <div class="fg"><label class="fl">Effective Date</label>
      <input type="date" class="fi" id="reg-date" value="${reg.effectiveDate||''}"></div>
    <div class="fg"><label class="fl">Covered By Plan</label>${planChecks}</div>
  `, `
    <button class="btn btn-outline btn-sm" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary btn-sm" onclick="saveRadarEntry()">Save</button>
  `);
}

async function saveRadarEntry() {
  const entry = {
    title:         $('reg-title')?.value?.trim() || '',
    description:   $('reg-desc')?.value?.trim()  || '',
    jurisdiction:  $('reg-jur')?.value            || '',
    severity:      $('reg-sev')?.value            || 'MEDIUM',
    effectiveDate: $('reg-date')?.value           || '',
    coveredByPlan: qsa('.reg-plan-chk:checked').map(el => el.value)
  };
  if (!entry.title) { toast('Title is required', 'error'); return; }

  const entries = [...radarEntries];
  if (editingRegIdx >= 0) entries[editingRegIdx] = entry;
  else entries.push(entry);

  try {
    // Full replace — entries array is the single source of truth
    await db.collection('settings').doc('regulatory_radar').set({ entries });
    radarEntries.length = 0;
    entries.forEach(e => radarEntries.push(e));
    const badge = $('radar-badge');
    if (badge) {
      const n = entries.filter(r => r.severity === 'CRITICAL').length;
      badge.textContent = n;
      badge.classList.toggle('hidden', n === 0);
    }
    closeModal();
    renderRadarList();
    toast('Regulation saved');
  } catch(e) { console.error(e); toast('Save failed', 'error'); }
}

async function deleteRadarEntry(idx) {
  if (!confirm('Delete this regulation?')) return;
  const entries = radarEntries.filter((_, i) => i !== idx);
  try {
    await db.collection('settings').doc('regulatory_radar').set({ entries });
    radarEntries.length = 0;
    entries.forEach(e => radarEntries.push(e));
    renderRadarList();
    toast('Deleted');
  } catch(e) { console.error(e); toast('Delete failed', 'error'); }
}

async function renderExposureMatrix() {
  const tbody = $('rv-exposure-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" class="loading">Calculating…</td></tr>';
  try {
    const snap = await db.collection('clients').get();
    const clients = [];
    snap.forEach(d => clients.push({ id: d.id, ...d.data() }));
    const today = new Date();

    const rows = clients.map(c => {
      const jurs  = [c.registrationJurisdiction, ...(c.operatingJurisdictions||[])].filter(Boolean);
      const delAt = c.deliveredAt ? (c.deliveredAt.toDate ? c.deliveredAt.toDate() : new Date(c.deliveredAt)) : null;
      let red = 0, yellow = 0;

      radarEntries.forEach(reg => {
        const match = jurs.some(j => j && reg.jurisdiction && (
          j.toLowerCase() === reg.jurisdiction.toLowerCase() ||
          reg.jurisdiction.toUpperCase().startsWith(j.toUpperCase()) ||
          j.toUpperCase().startsWith(reg.jurisdiction.toUpperCase())
        ));
        if (!match) return;
        const eff     = reg.effectiveDate ? new Date(reg.effectiveDate) : null;
        const covered = reg.coveredByPlan?.includes(c.plan);
        if (!eff || eff > today)                   { yellow++; return; }
        if (covered && delAt && eff <= delAt)      { return; }          // COVERED — green, no count
        if (c.maintenanceActive)                   { yellow++; return; } // SCHEDULED
        red++;                                                            // EXPOSED
      });

      return { ...c, _red: red, _yellow: yellow };
    })
    .filter(c => c._red > 0 || c._yellow > 0)
    .sort((a,b) => b._red - a._red || b._yellow - a._yellow);

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="loading">No exposures detected — all clients covered</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(c => `
      <tr>
        <td>${esc(c.name||c.id)}</td>
        <td><span class="badge ${planBadgeClass(c.plan)}">${planLabel(c.plan)}</span></td>
        <td class="exp-flag-r">${c._red    > 0 ? `🔴 ${c._red}`    : '—'}</td>
        <td class="exp-flag-y">${c._yellow > 0 ? `🟡 ${c._yellow}` : '—'}</td>
        <td>${c.maintenanceActive
          ? '<span class="badge b-delivered">Active</span>'
          : '<span class="badge b-ghost">None</span>'}</td>
        <td onclick="event.stopPropagation()">
          <button class="btn btn-primary btn-sm"
            onclick="openDetail('${esc(c.id)}');nav('clients')">View</button>
        </td>
      </tr>`).join('');
  } catch(e) {
    console.error(e);
    tbody.innerHTML = '<tr><td colspan="6" class="loading" style="color:#d47a7a">Load error</td></tr>';
  }
}

// ── FINANCE ───────────────────────────────────────────────────────────────────
async function loadFinance() {
  setPageActions('');
  try {
    const snap = await db.collection('clients').get();
    const clients = []; snap.forEach(d => clients.push({ id: d.id, ...d.data() }));

    const paid  = clients.filter(c => c.status !== 'pending_payment');
    const maint = clients.filter(c => c.maintenanceActive);
    const mrr   = maint.length * 297;
    const total = paid.reduce((s,c) => s + (c.price || PLAN_PRICES[c.plan] || 0), 0);
    const avg   = paid.length ? Math.round(total / paid.length) : 0;

    setText('fin-mrr',       fmtMoney(mrr));
    setText('fin-mrr-sub',   `${maint.length} maintenance subscriptions`);
    setText('fin-arr',       fmtMoney(mrr * 12));
    setText('fin-total',     fmtMoney(total));
    setText('fin-total-sub', `${paid.length} paid clients`);
    setText('fin-avg',       fmtMoney(avg));

    // Revenue by plan
    const byPlan = {};
    Object.keys(PLANS).forEach(k => { byPlan[k] = { count:0, rev:0 }; });
    paid.forEach(c => {
      if (!byPlan[c.plan]) byPlan[c.plan] = { count:0, rev:0 };
      byPlan[c.plan].count++;
      byPlan[c.plan].rev += (c.price || PLAN_PRICES[c.plan] || 0);
    });
    const planTbody = $('fin-by-plan');
    if (planTbody) {
      const rows = Object.entries(byPlan).filter(([,v]) => v.count > 0);
      planTbody.innerHTML = rows.length
        ? rows.map(([k,v]) => `<tr>
            <td><span class="badge ${planBadgeClass(k)}">${planLabel(k)}</span></td>
            <td>${v.count}</td>
            <td>${fmtMoney(v.rev)}</td>
            <td>${total > 0 ? Math.round(v.rev/total*100) + '%' : '—'}</td>
          </tr>`).join('')
        : '<tr><td colspan="4" class="loading">No paid clients yet</td></tr>';
    }

    // Concentration
    const concWarn = $('fin-conc-warn');
    const concList = $('fin-conc-list');
    if (mrr > 0) {
      const rows = maint.map(c => ({ name: c.name||c.id, pct: Math.round(297/mrr*100) }));
      const breach = rows.some(r => r.pct > 30);
      if (concWarn) concWarn.style.display = breach ? 'block' : 'none';
      if (concList) {
        concList.innerHTML = rows.map(r =>
          `<div class="conc-row">
            <span>${esc(r.name)}</span>
            <span ${r.pct > 30 ? 'class="conc-flag"' : ''}>${r.pct}%${r.pct>30?' ⚠':''}</span>
          </div>`).join('');
      }
    } else {
      if (concWarn) concWarn.style.display = 'none';
      if (concList) concList.innerHTML = '<div class="loading">No maintenance revenue yet</div>';
    }
  } catch(e) { console.error(e); toast('Finance load failed', 'error'); }
}

// ── SETTINGS ──────────────────────────────────────────────────────────────────
async function loadSettings() {
  setPageActions('');
  try {
    const snap = await db.collection('settings').doc('config').get();
    if (snap.exists) {
      const d = snap.data();
      setVal('wh-s2',      d.webhookS2    || '');
      setVal('wh-s3',      d.webhookS3    || '');
      setVal('wh-s4',      d.webhookS4    || '');
      setVal('s-capacity', d.capacityCap  || 10);
    }
    await loadAdmins();
  } catch(e) { console.error(e); toast('Settings load failed', 'error'); }
}

async function saveSettings() {
  const data = {
    webhookS2:   $('wh-s2')?.value?.trim()       || '',
    webhookS3:   $('wh-s3')?.value?.trim()        || '',
    webhookS4:   $('wh-s4')?.value?.trim()        || '',
    capacityCap: parseInt($('s-capacity')?.value) || 10,
    updatedAt:   new Date().toISOString()
  };
  try {
    await db.collection('settings').doc('config').set(data, { merge: true });
    toast('Settings saved');
  } catch(e) { console.error(e); toast('Save failed', 'error'); }
}

async function loadAdmins() {
  const tbody = $('s-admins');
  if (!tbody) return;
  try {
    const snap = await db.collection('admins').get();
    const admins = []; snap.forEach(d => admins.push({ id: d.id, ...d.data() }));
    tbody.innerHTML = admins.length
      ? admins.map(a => `<tr>
          <td>${esc(a.id)}</td>
          <td class="dim">${esc(a.role||'superadmin')}</td>
          <td onclick="event.stopPropagation()">
            <button class="btn btn-danger btn-sm" onclick="removeAdmin('${esc(a.id)}')">Remove</button>
          </td>
        </tr>`).join('')
      : '<tr><td colspan="3" class="loading">No admins</td></tr>';
  } catch(e) { console.error(e); toast('Failed to load admins', 'error'); }
}

async function addAdmin() {
  const email = $('s-new-admin')?.value?.trim().toLowerCase();
  const role  = $('s-new-role')?.value || 'superadmin';
  if (!email) { toast('Enter an email', 'error'); return; }
  try {
    await db.collection('admins').doc(email).set({ role, addedAt: new Date().toISOString() });
    if ($('s-new-admin')) $('s-new-admin').value = '';
    await loadAdmins();
    toast(`${email} added as ${role}`);
  } catch(e) { console.error(e); toast('Failed to add admin', 'error'); }
}

async function removeAdmin(email) {
  if (!confirm(`Remove ${email} from admins?`)) return;
  if (email === auth.currentUser?.email) { toast('Cannot remove yourself', 'error'); return; }
  try {
    await db.collection('admins').doc(email).delete();
    await loadAdmins();
    toast(`${email} removed`);
  } catch(e) { console.error(e); toast('Remove failed', 'error'); }
}
