// admin-logic-1.js — Lex Nova HQ Admin Console (Part 1 — REBUILT)
// Covers: Constants · Utilities · Init · Nav · Dashboard · Clients · Leads · Full Detail Panel
// Requires: Firebase compat globals auth, db, firebase — initialised in admin.html
// Functions for outreach/flagship/content/radar/finance/settings → admin-logic-2.js

'use strict';

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const PLANS = {
  agentic_shield:   'Agentic Shield',
  workplace_shield: 'Workplace Shield',
  complete_stack:   'Complete Stack',
  flagship:         'Flagship'
};

const STATUS_CHAIN = [
  'pending_payment','payment_received','intake_received','under_review','in_production','delivered'
];

const STATUS_LABELS = {
  pending_payment:  'Pending Payment',
  payment_received: 'Payment Received', // ADD THIS LINE
  intake_received:  'Intake Received',
  under_review:     'Under Review',
  in_production:    'In Production',
  delivered:        'Delivered'
};

const PLAN_PRICES = {
  agentic_shield:   997,
  workplace_shield: 997,
  complete_stack:   2500,
  flagship:         15000
};

const CHECKLIST_ITEMS = {
  agentic_shield: [
    'EL (Stage 1) accepted and filed',
    'Intake vault reviewed',
    'Engagement Ref generated',
    'Operating jurisdictions confirmed',
    'DOC_TOS drafted','DOC_AGT drafted','DOC_AUP drafted',
    'DOC_SLA drafted','DOC_DPA drafted','DOC_PP drafted','DOC_PBK drafted',
    'Full EL (Stage 2) generated and sent',
    'Client portal access provisioned',
    'All documents delivered'
  ],
  workplace_shield: [
    'EL (Stage 1) accepted and filed',
    'Intake vault reviewed',
    'Engagement Ref generated',
    'Operating jurisdictions confirmed',
    'DOC_HND drafted','DOC_IP drafted','DOC_SCAN drafted',
    'DOC_SOP drafted','DOC_DPIA drafted',
    'Full EL (Stage 2) generated and sent',
    'Client portal access provisioned',
    'All documents delivered'
  ],
  complete_stack: [
    'EL (Stage 1) accepted and filed',
    'Intake vault reviewed',
    'Engagement Ref generated',
    'Operating jurisdictions confirmed',
    'All Lane A documents drafted (6 + PBK)',
    'All Lane B documents drafted (5)',
    'Full EL (Stage 2) generated and sent',
    'Client portal access provisioned',
    'All documents delivered'
  ],
  flagship: [
    'EL (Stage 1) accepted and filed',
    'Intake vault reviewed',
    'Discovery call completed',
    'Post-call gap analysis documented',
    'Proposal sent and accepted',
    'All documents drafted',
    'Full EL (Stage 2) generated and sent',
    'Client portal access provisioned',
    'All documents delivered'
  ]
};

// Matches dp-reg-jur <select> values exactly
const JURISDICTIONS = [
  { val:'us',     label:'United States' },
  { val:'eu',     label:'European Union' },
  { val:'uk',     label:'United Kingdom' },
  { val:'ca',     label:'Canada' },
  { val:'au',     label:'Australia' },
  { val:'sg',     label:'Singapore' },
  { val:'ae',     label:'UAE' },
  { val:'in',     label:'India' },
  { val:'global', label:'Global' }
];

// Matches Sunday Ritual input IDs in admin.html
const RITUAL_MAP = [
  { id:'r-outreach', key:'outreach' },
  { id:'r-replies',  key:'replies'  },
  { id:'r-tally',    key:'tally'    },
  { id:'r-deals',    key:'deals'    },
  { id:'r-pipeline', key:'pipeline' }
];

// ── STATE ─────────────────────────────────────────────────────────────────────
let allClients    = [];
let allLeads      = [];
let currentClient = null;
let radarEntries  = [];

// ── UTILITIES ─────────────────────────────────────────────────────────────────
const $   = id  => document.getElementById(id);
const qsa = sel => Array.from(document.querySelectorAll(sel));

const planLabel   = k => PLANS[k]         || k;
const statusLabel = k => STATUS_LABELS[k] || k;

function fmtDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
}

function fmtMoney(n) {
  if (n == null || isNaN(n)) return '—';
  return '$' + Number(n).toLocaleString('en-US');
}

function daysSince(ts) {
  if (!ts) return null;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

function hoursSince(ts) {
  if (!ts) return null;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return Math.floor((Date.now() - d.getTime()) / 3600000);
}

function nowTs() { return firebase.firestore.FieldValue.serverTimestamp(); }

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function setText(id, txt) {
  const el = $(id); if (el) el.textContent = String(txt ?? '');
}

function setVal(id, val) {
  const el = $(id); if (el) el.value = val ?? '';
}

async function genEngRef() {
  try {
    const snap = await db.collection('clients').get();
    let max = 0;
    snap.forEach(d => {
      const m = (d.data().engagementRef || '').match(/LN-\d{4}-(\d+)/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return `LN-${new Date().getFullYear()}-${String(max + 1).padStart(3,'0')}`;
  } catch { return `LN-${new Date().getFullYear()}-001`; }
}

// ── TOAST — uses existing #toast element in admin.html ────────────────────────
function toast(msg, type = 'success') {
  const t = $('toast');
  if (!t) return;
  t.textContent  = msg;
  t.className    = type;         // CSS: #toast.success / #toast.error
  t.style.display = 'block';
  clearTimeout(t._t);
  t._t = setTimeout(() => { t.style.display = 'none'; }, 3000);
}

// ── MODAL — uses #overlay + #modal in admin.html ──────────────────────────────
function openModal(title, bodyHTML, footerHTML = '') {
  const m = $('modal'), o = $('overlay');
  if (!m) return;
  const mt = $('modalTitle'), mb = $('modalBody'), mf = $('modalFooter');
  if (mt) mt.textContent  = title;
  if (mb) mb.innerHTML    = bodyHTML;
  if (mf) mf.innerHTML    = footerHTML;
  m.classList.add('open');
  if (o) o.classList.add('open');
}

function closeModal() {
  $('modal')?.classList.remove('open');
  $('overlay')?.classList.remove('open');
}

// ── RADAR CACHE ───────────────────────────────────────────────────────────────
async function loadRadarCache() {
  if (radarEntries.length) return;
  try {
    const snap = await db.collection('settings').doc('regulatory_radar').get();
    radarEntries = snap.exists ? (snap.data().entries || []) : [];
  } catch (e) { console.error('Radar cache:', e); }
}

// ── INIT — called by auth.onAuthStateChanged in admin.html ────────────────────
function init() {
  nav('dashboard');
}

// ── NAVIGATION ────────────────────────────────────────────────────────────────
function nav(tab) {
  qsa('.tab-content').forEach(p => p.classList.remove('active'));
  qsa('.nav-item').forEach(l => l.classList.remove('active'));

  $('tab-' + tab)?.classList.add('active');
  document.querySelector(`.nav-item[data-tab="${tab}"]`)?.classList.add('active');

  const subs = {
    dashboard: 'Command center',    clients:  'Client management',
    leads:     'Lead management',   outreach: 'Outreach CRM',
    flagship:  'Flagship pipeline', content:  'Content',
    radar:     'Regulatory radar',  finance:  'Finance',
    settings:  'Settings'
  };
  const sub = $('pageSub');
  if (sub) sub.textContent = subs[tab] || tab;

  // Tabs handled in this file
  const loaders = { dashboard: loadDashboard, clients: loadClients, leads: loadLeads };
  if (loaders[tab]) loaders[tab]();
  // outreach / flagship / content / radar / finance / settings → admin-logic-2.js
}

// ── BADGE HELPERS ─────────────────────────────────────────────────────────────
function planBadgeClass(plan) {
  return { agentic_shield:'b-intake', workplace_shield:'b-warm',
           complete_stack:'b-production', flagship:'b-hot' }[plan] || 'b-ghost';
}
function statusBadgeClass(status) {
  return { pending_payment:'b-pending', payment_received: 'b-delivered', intake_received:'b-intake',
           under_review:'b-review', in_production:'b-production',
           delivered:'b-delivered' }[status] || 'b-ghost';
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const [cSnap, pSnap, rSnap, ritSnap, cfgSnap] = await Promise.all([
      db.collection('clients').get(),
      db.collection('prospects').get(),
      db.collection('settings').doc('regulatory_radar').get(),
      db.collection('settings').doc('weeklyRitual').get(),
      db.collection('settings').doc('config').get()
    ]);

    const clients   = []; cSnap.forEach(d => clients.push({ id: d.id, ...d.data() }));
    const prospects = []; pSnap.forEach(d => prospects.push({ id: d.id, ...d.data() }));
    radarEntries    = rSnap.exists ? (rSnap.data().entries || []) : [];
    const cap       = cfgSnap.exists ? (cfgSnap.data().capacityCap || 10) : 10;

    // ── KPIs ──
    const inProd   = clients.filter(c => c.status === 'in_production');
    const maint    = clients.filter(c => c.maintenanceActive);
    const paid     = clients.filter(c => c.status !== 'pending_payment');
    const mrr      = maint.length * 297;
    const total    = paid.reduce((s,c) => s + (c.price || PLAN_PRICES[c.plan] || 0), 0);

    setText('d-mrr',           fmtMoney(mrr));
    setText('d-mrr-sub',       `${maint.length} active maintenance`);
    setText('d-total',         fmtMoney(total));
    setText('d-clients-count', `${clients.length} total clients`);
    setText('d-active',        inProd.length);

    // ── Concentration warning ──
    const concWarn = $('d-conc-warn');
    if (concWarn) {
      const breach = mrr > 0 && maint.some(() => (297 / mrr * 100) > 30);
      concWarn.classList.toggle('hidden', !breach);
    }

    // ── Prospect funnel (outreach statuses) ──
    const pc = { Cold:0, Warm:0, Hot:0, Replied:0, Converted:0 };
    prospects.forEach(p => { if (p.status && pc[p.status] !== undefined) pc[p.status]++; });
    setText('pf-cold', pc.Cold); setText('pf-warm', pc.Warm);
    setText('pf-hot',  pc.Hot);  setText('pf-replied', pc.Replied);
    setText('pf-conv', pc.Converted);

    // ── Capacity ──
    const pct = Math.min(100, Math.round((inProd.length / cap) * 100));
    const col = pct >= 80 ? '#d47a7a' : pct >= 60 ? '#C5A059' : '#7ab88a';
    setText('d-cap-current', inProd.length);
    setText('d-cap-label',   `${inProd.length} / ${cap} slots`);
    const bar = $('d-cap-bar');
    if (bar) { bar.style.width = pct + '%'; bar.style.background = col; }

    // ── Alert strip ──
    const strip  = $('alertStrip');
    const alerts = [];
    const today  = new Date();

    clients.forEach(c => {
      if (c.status === 'intake_received' && c.intakeSentAt) {
        const d = daysSince(c.intakeSentAt);
        if (d > 14) alerts.push(`⚠ ${c.name||c.id} — intake overdue ${d-14}d`);
      }
      if (c.status === 'in_production' && c.productionStartedAt) {
        const h = hoursSince(c.productionStartedAt);
        if (h > 48) alerts.push(`⚠ ${c.name||c.id} — delivery SLA exceeded (${h}h)`);
      }
    });
    clients.filter(c => c.status === 'delivered' && !c.maintenanceActive).forEach(c => {
      const jurs = [c.registrationJurisdiction, ...(c.operatingJurisdictions||[])].filter(Boolean);
      const delAt = c.deliveredAt ? (c.deliveredAt.toDate ? c.deliveredAt.toDate() : new Date(c.deliveredAt)) : null;
      radarEntries.forEach(reg => {
        const match = jurs.some(j => j && reg.jurisdiction &&
          (j === reg.jurisdiction || reg.jurisdiction.toUpperCase().startsWith(j.toUpperCase()) ||
           j.toUpperCase().startsWith(reg.jurisdiction.toUpperCase())));
        if (!match || reg.coveredByPlan?.includes(c.plan)) return;
        const eff = reg.effectiveDate ? new Date(reg.effectiveDate) : null;
        if (eff && eff <= today && (!delAt || eff > delAt))
          alerts.push(`🔴 EXPOSED: ${c.name||c.id} — ${reg.title}`);
      });
    });

    if (strip) {
      if (alerts.length) {
        strip.classList.remove('hidden');
        strip.innerHTML = alerts.map(a => `<div class="alert-chip">● ${esc(a)}</div>`).join('');
      } else {
        strip.classList.add('hidden');
      }
    }

    // ── Recent clients ──
    const rcTbody = $('d-recent-clients');
    if (rcTbody) {
      const sorted = [...clients]
        .sort((a,b) => (b.createdAt?.toDate?.()?.getTime()||0) - (a.createdAt?.toDate?.()?.getTime()||0))
        .slice(0, 5);
      rcTbody.innerHTML = sorted.length
        ? sorted.map(c => `
            <tr onclick="openDetail('${esc(c.id)}');nav('clients')" style="cursor:pointer">
              <td>${esc(c.name||c.id)}</td>
              <td><span class="badge ${planBadgeClass(c.plan)}">${planLabel(c.plan)}</span></td>
              <td><span class="badge ${statusBadgeClass(c.status)}">${statusLabel(c.status)}</span></td>
              <td class="dim">${fmtDate(c.createdAt)}</td>
            </tr>`).join('')
        : '<tr><td colspan="4" class="loading">No clients yet</td></tr>';
    }

    // ── Sunday Ritual ──
    if (ritSnap.exists) {
      const r = ritSnap.data();
      RITUAL_MAP.forEach(({ id, key }) => { const el = $(id); if (el && r[key] != null) el.value = r[key]; });
      if (r.tally != null) setText('d-forms', r.tally);
    }

  } catch (e) { console.error('Dashboard:', e); toast('Dashboard load failed', 'error'); }
}

async function saveRitual() {
  const data = {};
  RITUAL_MAP.forEach(({ id, key }) => { const el = $(id); if (el) data[key] = Number(el.value) || 0; });
  data.savedAt = new Date().toISOString();
  try {
    await db.collection('settings').doc('weeklyRitual').set(data, { merge: true });
    if (data.tally != null) setText('d-forms', data.tally);
    toast('Ritual saved');
  } catch (e) { console.error(e); toast('Save failed', 'error'); }
}

// ── CLIENTS TABLE ─────────────────────────────────────────────────────────────
function loadClients() {
  const tbody = $('c-tbody');
  // Update colspan to 9 because we added the SLA Clock column to the HTML
  if (tbody) tbody.innerHTML = '<tr><td colspan="9" class="loading">Loading…</td></tr>';
  
  // REAL-TIME LISTENER: This stays "awake" and refreshes the table automatically
  db.collection('clients').orderBy('createdAt','desc').onSnapshot(async (snap) => {
    await loadRadarCache();
    allClients = [];
    snap.forEach(d => allClients.push({ id: d.id, ...d.data() }));
    renderClientsTable(allClients);
  }, (e) => {
    console.error(e);
    if (tbody) tbody.innerHTML = '<tr><td colspan="9" class="loading" style="color:#d47a7a">Failed to load</td></tr>';
  });
}

function renderClientsTable(list) {
  const tbody = $('c-tbody');
  if (!tbody) return;
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="loading">No clients found</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(c => {
    const elBadge = c.elAccepted ? `<span class="badge b-delivered">✓ Yes</span>` : `<span class="badge b-ghost">—</span>`;
    
    // THE SLA CLOCK LOGIC
    let slaClock = '<span class="dim">—</span>';
    if (c.status === 'intake_received' || c.status === 'in_production') {
        const startTs = c.productionStartedAt || c.intakeSentAt;
        if (startTs) {
            const hRem = 48 - hoursSince(startTs);
            const colorClass = hRem <= 0 ? 'cd-over' : hRem <= 8 ? 'cd-warn' : 'cd-ok';
            slaClock = `<span class="countdown ${colorClass}">${hRem > 0 ? hRem + 'h left' : Math.abs(hRem) + 'h OVER'}</span>`;
        }
    }

    return `<tr onclick="openDetail('${esc(c.id)}')">
      <td>${esc(c.name||'—')}</td>
      <td class="dim">${esc(c.company||'—')}</td>
      <td><span class="badge ${planBadgeClass(c.plan)}">${planLabel(c.plan)}</span></td>
      <td><span class="badge ${statusBadgeClass(c.status)}">${statusLabel(c.status)}</span></td>
      <td>${slaClock}</td> 
      <td>${elBadge}</td>
      <td class="dim">${esc(c.registrationJurisdiction||'—')}</td>
      <td><div class="radar-dots">${getClientRadarDots(c)}</div></td>
      <td class="dim">${fmtDate(c.createdAt)}</td>
    </tr>`;
  }).join('');
}

function getClientRadarDots(c) {
  if (!radarEntries.length) return '<span class="dot dot-grey"></span>';
  const jurs    = [c.registrationJurisdiction, ...(c.operatingJurisdictions||[])].filter(Boolean);
  const today   = new Date();
  const delAt   = c.deliveredAt ? (c.deliveredAt.toDate ? c.deliveredAt.toDate() : new Date(c.deliveredAt)) : null;
  let red = 0, yellow = 0, green = 0;

  radarEntries.forEach(reg => {
    const match = jurs.some(j => j && reg.jurisdiction && (
      j === reg.jurisdiction ||
      reg.jurisdiction.toUpperCase().startsWith(j.toUpperCase()) ||
      j.toUpperCase().startsWith(reg.jurisdiction.toUpperCase())
    ));
    if (!match) return;
    const eff     = reg.effectiveDate ? new Date(reg.effectiveDate) : null;
    const covered = reg.coveredByPlan?.includes(c.plan);
    if (!eff || eff > today) { yellow++; return; }
    if (covered && delAt && eff <= delAt) { green++; return; }
    if (c.maintenanceActive) { yellow++; return; }
    red++;
  });

  let dots = '';
  if (red)    dots += `<span class="dot dot-red"    title="${red} Exposed"></span>`;
  if (yellow) dots += `<span class="dot dot-yellow" title="${yellow} Scheduled/Future"></span>`;
  if (green)  dots += `<span class="dot dot-green"  title="${green} Covered"></span>`;
  return dots || '<span class="dot dot-grey"></span>';
}

function filterClients() {
  const s   = ($('c-search')?.value||'').toLowerCase();
  const st  = $('c-status')?.value  || '';
  const pl  = $('c-plan')?.value    || '';
  const srt = $('c-sort')?.value    || 'date_desc';

  let list = allClients.filter(c =>
    (!s  || (c.name||'').toLowerCase().includes(s) ||
             (c.company||'').toLowerCase().includes(s) ||
             c.id.toLowerCase().includes(s)) &&
    (!st || c.status === st) &&
    (!pl || c.plan   === pl)
  );

  if (srt === 'date_asc') list.sort((a,b) => (a.createdAt?.toDate?.()?.getTime()||0) - (b.createdAt?.toDate?.()?.getTime()||0));
  else if (srt === 'status') list.sort((a,b) => (a.status||'').localeCompare(b.status||''));
  else if (srt === 'plan')   list.sort((a,b) => (a.plan||'').localeCompare(b.plan||''));
  else list.sort((a,b) => (b.createdAt?.toDate?.()?.getTime()||0) - (a.createdAt?.toDate?.()?.getTime()||0));

  renderClientsTable(list);
}

// ── CLIENT DETAIL PANEL ───────────────────────────────────────────────────────
// Uses #detailPanel, show/hide pre-built dt-* section divs — no innerHTML injection

async function openDetail(email) {
  currentClient = null;
  $('detailPanel')?.classList.add('open');

  // Reset to Overview sub-tab
  qsa('.sub-tab').forEach(b => b.classList.remove('active'));
  document.querySelector('.sub-tab')?.classList.add('active');
  showDetailSection('overview');

  setText('dp-name',  '…');
  setText('dp-email', '…');
  setText('dp-plan',  '…');

  try {
    await loadRadarCache();
    const doc = await db.collection('clients').doc(email).get();
    if (!doc.exists) { toast('Client not found', 'error'); return; }
    currentClient = { id: doc.id, ...doc.data() };
    refreshDetailHeader();
    populateDetailOverview(currentClient);
  } catch (e) { console.error(e); toast('Failed to load client', 'error'); }
}

function closeDetail() {
  currentClient = null;
  $('detailPanel')?.classList.remove('open');
}

function showDetailSection(key) {
  ['overview','intake','checklist','documents','radar','gap','financials','activity','referrals']
    .forEach(s => $('dt-' + s)?.classList.toggle('hidden', s !== key));
}

function refreshDetailHeader() {
  if (!currentClient) return;
  setText('dp-name',  currentClient.name  || currentClient.id);
  setText('dp-email', currentClient.id);
  setText('dp-plan',  planLabel(currentClient.plan));
}

// ── DETAIL TAB SWITCH ─────────────────────────────────────────────────────────
async function detailTab(key, el) {
  if (!currentClient) return;
  qsa('.sub-tab').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
  showDetailSection(key);
  // Refresh client data before populating
  try {
    const doc = await db.collection('clients').doc(currentClient.id).get();
    if (doc.exists) currentClient = { id: doc.id, ...doc.data() };
  } catch (e) { console.error('Refresh:', e); }
  const loaders = {
    overview: populateDetailOverview, intake: populateDetailIntake,
    checklist: populateDetailChecklist, documents: populateDetailDocuments,
    radar: populateDetailRadar, gap: populateDetailGap,
    financials: populateDetailFinancials, activity: populateDetailActivity,
    referrals: populateDetailReferrals
  };
  if (loaders[key]) loaders[key](currentClient);
}

// ── DETAIL — OVERVIEW ─────────────────────────────────────────────────────────
function populateDetailOverview(c) {
  // EL status rows
  const elStatus = $('dp-el-status');
  if (elStatus) {
    elStatus.textContent = c.elAccepted ? `✓ Accepted — ${fmtDate(c.elAcceptedAt)}` : 'Not Accepted';
    elStatus.className   = c.elAccepted ? 'el-status-ok' : 'el-status-miss';
  }
  const elFull = $('dp-el-full');
  if (elFull) {
    elFull.textContent = c.elFullGeneratedAt ? `✓ Generated — ${fmtDate(c.elFullGeneratedAt)}` : 'Not Generated';
    elFull.className   = c.elFullGeneratedAt ? 'el-status-ok' : 'el-status-miss';
  }
  const elLock = $('dp-el-lock');
  if (elLock) elLock.style.display = c.elAccepted ? 'none' : 'block';

  // Engagement ref (display div, not input)
  setText('dp-ref', c.engagementRef || '—');

  // Status select
  setVal('dp-status', c.status || 'pending_payment');

  // Countdowns
  const cdEl = $('dp-countdowns');
  if (cdEl) {
    let html = '';
    if (c.status === 'intake_received' && c.intakeSentAt) {
      const rem = 14 - daysSince(c.intakeSentAt);
      const cls = rem <= 0 ? 'cd-over' : rem <= 3 ? 'cd-warn' : 'cd-ok';
      html += `<div class="countdown ${cls}">⏱ Intake: ${rem > 0 ? rem+'d remaining' : Math.abs(rem)+'d OVERDUE'}</div>`;
    }
    if (c.status === 'in_production' && c.productionStartedAt) {
      const rem = 48 - hoursSince(c.productionStartedAt);
      const cls = rem <= 0 ? 'cd-over' : rem <= 8 ? 'cd-warn' : 'cd-ok';
      html += `<div class="countdown ${cls}">⏱ Delivery SLA: ${rem > 0 ? rem+'h remaining' : Math.abs(rem)+'h OVERDUE'}</div>`;
    }
    cdEl.innerHTML = html;
  }

  // Registration jurisdiction
  setVal('dp-reg-jur', c.registrationJurisdiction || '');

  // Plan select
  setVal('dp-plan-sel', c.plan || 'agentic_shield');

  // Operating jurisdiction tags
  const opEl = $('dp-op-jurs');
  if (opEl) {
    const active = c.operatingJurisdictions || [];
    opEl.innerHTML = JURISDICTIONS.map(j =>
      `<span class="j-tag ${active.includes(j.val)?'on':''}"
        onclick="this.classList.toggle('on')" data-val="${j.val}">${j.label}</span>`
    ).join('');
  }

  // Notes
  setVal('dp-notes', c.adminNotes || '');
}

// Called by dp-status onchange — placeholder; full save happens on saveOverview
function onStatusChange(val) {}

async function saveOverview() {
  if (!currentClient) return;
  let ref = currentClient.engagementRef || '';
  if (!ref) ref = await genEngRef();

  const opJuris  = qsa('#dp-op-jurs .j-tag.on').map(el => el.dataset.val).filter(Boolean);
  const newStatus = $('dp-status')?.value;

  const updates = {
    status:                   newStatus,
    plan:                     $('dp-plan-sel')?.value || currentClient.plan,
    registrationJurisdiction: $('dp-reg-jur')?.value || '',
    operatingJurisdictions:   opJuris,
    adminNotes:               $('dp-notes')?.value?.trim() || '',
    engagementRef:            ref,
    updatedAt:                nowTs()
  };

  // Status transition timestamps
  if (newStatus === 'intake_received'&& currentClient.status !== 'intake_received') updates.intakeSentAt       = nowTs();
  if (newStatus === 'in_production'  && currentClient.status !== 'in_production')  updates.productionStartedAt = nowTs();
  if (newStatus === 'delivered'      && currentClient.status !== 'delivered')       updates.deliveredAt         = nowTs();

  try {
    await db.collection('clients').doc(currentClient.id).set(updates, { merge: true });
    currentClient = { ...currentClient, ...updates, engagementRef: ref };
    setText('dp-ref', ref);
    refreshDetailHeader();
    await loadClients();
    toast('Overview saved');
  } catch (e) { console.error(e); toast('Save failed', 'error'); }
}

// ── DETAIL — INTAKE ───────────────────────────────────────────────────────────
function populateDetailIntake(c) {
  const el = $('dp-intake-content');
  if (!el) return;
  const intake  = c.intakeData || {};
  const laneA   = intake.laneA || {};
  const laneB   = intake.laneB || {};
  const flatKeys = Object.keys(intake).filter(k => k !== 'laneA' && k !== 'laneB');

  const rows = obj => Object.entries(obj).length
    ? Object.entries(obj).map(([k,v]) =>
        `<div style="display:flex;gap:12px;padding:8px 0;border-bottom:1px solid rgba(197,160,89,.06);font-size:11px">
          <span style="color:var(--marble-dim);width:160px;flex-shrink:0;text-transform:capitalize">${esc(k.replace(/_/g,' '))}</span>
          <span>${esc(Array.isArray(v) ? v.join(', ') : String(v||'—'))}</span>
        </div>`).join('')
    : '<div class="loading">No data</div>';

  if (flatKeys.length) {
    el.innerHTML = rows(intake);
  } else {
    const aLen = Object.keys(laneA).length, bLen = Object.keys(laneB).length;
    el.innerHTML = (aLen || bLen)
      ? `${aLen ? `<div style="margin-bottom:20px"><div class="detail-section-title">Lane A</div>${rows(laneA)}</div>` : ''}
         ${bLen ? `<div><div class="detail-section-title">Lane B</div>${rows(laneB)}</div>` : ''}`
      : '<div class="loading">No intake data submitted yet</div>';
  }
}

// ── DETAIL — CHECKLIST ────────────────────────────────────────────────────────
function populateDetailChecklist(c) {
  const lockEl  = $('dp-el-lock-chk');
  const itemsEl = $('dp-checklist-items');
  if (!itemsEl) return;
  const locked = !c.elAccepted;
  if (lockEl) lockEl.style.display = locked ? 'block' : 'none';
  const items = CHECKLIST_ITEMS[c.plan] || CHECKLIST_ITEMS.agentic_shield;
  const saved = c.checklist || {};
  itemsEl.innerHTML = items.map((item, i) => {
    const done = !!saved[i];
    return `<div class="chk-item">
      <div class="chk-box ${done?'done':''}" id="chk-box-${i}"
        onclick="${locked?'':'toggleChk(this,'+i+')'}">
        <span class="chk-tick">✓</span>
      </div>
      <span class="chk-label" id="chk-label-${i}"
        style="${done?'text-decoration:line-through;color:var(--marble-dim)':''}">${esc(item)}</span>
    </div>`;
  }).join('');
}

function toggleChk(el, i) {
  el.classList.toggle('done');
  const lbl = $(`chk-label-${i}`);
  if (lbl) {
    lbl.style.textDecoration = el.classList.contains('done') ? 'line-through' : '';
    lbl.style.color          = el.classList.contains('done') ? 'var(--marble-dim)' : 'var(--marble)';
  }
}

async function saveChecklist() {
  if (!currentClient) return;
  if (!currentClient.elAccepted) { toast('EL not accepted — locked', 'error'); return; }
  const items = CHECKLIST_ITEMS[currentClient.plan] || CHECKLIST_ITEMS.agentic_shield;
  const checklist = {};
  items.forEach((_, i) => { checklist[i] = $(`chk-box-${i}`)?.classList.contains('done') || false; });
  try {
    await db.collection('clients').doc(currentClient.id).set({ checklist, updatedAt: nowTs() }, { merge: true });
    toast('Checklist saved');
  } catch (e) { console.error(e); toast('Save failed', 'error'); }
}

// ── DETAIL — DOCUMENTS ────────────────────────────────────────────────────────
function populateDetailDocuments(c) {
  const container = $('docsContainer');
  if (!container) return;
  const elDoc = c.elDocument || null;
  let html = '';
  // EL Stage 2 — pinned at top
  if (elDoc) {
    html += `<div class="doc-row" style="border-color:var(--gold-mid);margin-bottom:14px">
      <div class="doc-row-hdr">
        <span class="doc-label">Engagement Letter — Full (Stage 2)</span>
        <label style="display:flex;align-items:center;gap:6px;font-size:10px;color:var(--marble-dim);cursor:pointer">
          <input type="checkbox" id="el-reviewed" ${elDoc.adminReviewed?'checked':''}
            onchange="saveELReviewed(this.checked)"> Admin Reviewed
        </label>
      </div>
      <div style="font-size:10px;color:var(--marble-faint);margin-bottom:8px">Generated: ${fmtDate(c.elFullGeneratedAt)}</div>
      <div style="display:flex;gap:8px">
        ${elDoc.pdfUrl  ? `<a href="${esc(elDoc.pdfUrl)}"  target="_blank" class="btn btn-outline btn-sm">PDF ↗</a>`  : ''}
        ${elDoc.docxUrl ? `<a href="${esc(elDoc.docxUrl)}" target="_blank" class="btn btn-outline btn-sm">DOCX ↗</a>` : ''}
      </div>
    </div>`;
  }
  (c.documents || []).forEach((d, i) => { html += buildDocRow(d, i); });
  container.innerHTML = html;
}

function buildDocRow(d, i) {
  return `<div class="doc-row" data-doc-index="${i}">
    <div class="doc-row-hdr">
      <span class="doc-label">${esc(d.name||'Document '+(i+1))}</span>
      <span class="doc-del" onclick="removeDocRow(this)">Remove</span>
    </div>
    <div class="doc-grid">
      <div class="fg"><label class="fl">Name</label>
        <input type="text" class="fi doc-name" value="${esc(d.name||'')}"></div>
      <div class="fg"><label class="fl">Purpose</label>
        <input type="text" class="fi doc-purpose" value="${esc(d.purpose||'')}"></div>
      <div class="fg"><label class="fl">PDF URL</label>
        <input type="text" class="fi doc-pdf" value="${esc(d.pdfUrl||'')}"></div>
      <div class="fg"><label class="fl">DOCX URL</label>
        <input type="text" class="fi doc-docx" value="${esc(d.docxUrl||'')}"></div>
    </div>
    <div class="fg" style="margin-top:4px"><label class="fl">Status</label>
      <select class="fi doc-status" style="width:160px">
        ${['draft','review','final','delivered'].map(s =>
          `<option value="${s}" ${d.status===s?'selected':''}>${s}</option>`).join('')}
      </select>
    </div>
  </div>`;
}

function addDocRow() {
  const c = $('docsContainer');
  if (!c) return;
  const i = c.querySelectorAll('.doc-row[data-doc-index]').length;
  const tmp = document.createElement('div');
  tmp.innerHTML = buildDocRow({ name:'', purpose:'', pdfUrl:'', docxUrl:'', status:'draft' }, i);
  c.appendChild(tmp.firstElementChild);
}

function removeDocRow(btn) { btn.closest('.doc-row').remove(); }

async function saveDocuments() {
  if (!currentClient) return;
  const docs = [];
  qsa('#docsContainer .doc-row[data-doc-index]').forEach(row => {
    docs.push({
      name:    row.querySelector('.doc-name')?.value?.trim()    || '',
      purpose: row.querySelector('.doc-purpose')?.value?.trim() || '',
      pdfUrl:  row.querySelector('.doc-pdf')?.value?.trim()     || '',
      docxUrl: row.querySelector('.doc-docx')?.value?.trim()    || '',
      status:  row.querySelector('.doc-status')?.value          || 'draft'
    });
  });
  try {
    await db.collection('clients').doc(currentClient.id).set({ documents: docs, updatedAt: nowTs() }, { merge: true });
    toast('Documents saved');
  } catch (e) { console.error(e); toast('Save failed', 'error'); }
}

async function saveELReviewed(checked) {
  if (!currentClient) return;
  try {
    await db.collection('clients').doc(currentClient.id)
      .update({ 'elDocument.adminReviewed': checked, updatedAt: nowTs() });
    toast(checked ? 'EL marked as reviewed' : 'Review mark removed');
  } catch (e) { console.error(e); toast('Save failed', 'error'); }
}

// ── DETAIL — RADAR (per-client) ───────────────────────────────────────────────
function populateDetailRadar(c) {
  const el = $('dp-radar-list');
  if (!el) return;
  const jurs = [c.registrationJurisdiction, ...(c.operatingJurisdictions||[])].filter(Boolean);
  if (!jurs.length) { el.innerHTML = '<div class="loading">No jurisdictions set — update Overview first</div>'; return; }
  if (!radarEntries.length) { el.innerHTML = '<div class="loading">No radar entries loaded</div>'; return; }

  const today = new Date();
  const delAt = c.deliveredAt
    ? (c.deliveredAt.toDate ? c.deliveredAt.toDate() : new Date(c.deliveredAt)) : null;

  const relevant = radarEntries.filter(reg =>
    jurs.some(j => j && reg.jurisdiction && (
      j.toLowerCase() === reg.jurisdiction.toLowerCase() ||
      reg.jurisdiction.toUpperCase().startsWith(j.toUpperCase()) ||
      j.toUpperCase().startsWith(reg.jurisdiction.toUpperCase())
    ))
  );
  if (!relevant.length) { el.innerHTML = '<div class="loading">No regulations matched for client jurisdictions</div>'; return; }

  el.innerHTML = relevant.map(reg => {
    const eff     = reg.effectiveDate ? new Date(reg.effectiveDate) : null;
    const covered = reg.coveredByPlan?.includes(c.plan);
    let icon, label;
    if (!eff || eff > today)                      { icon = '🟡'; label = 'FUTURE OPENING'; }
    else if (covered && delAt && eff <= delAt)    { icon = '🟢'; label = 'COVERED'; }
    else if (c.maintenanceActive)                 { icon = '🟡'; label = 'SCHEDULED'; }
    else                                          { icon = '🔴'; label = 'EXPOSED'; }
    return `<div class="comp-row">
      <div style="flex:1">
        <div class="comp-title">${esc(reg.title||'—')}</div>
        <div class="comp-meta">${esc(reg.jurisdiction||'—')} · Effective: ${esc(reg.effectiveDate||'—')}</div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:14px">${icon}</div>
        <div class="comp-status sev-${reg.severity||''}">${label}</div>
      </div>
    </div>`;
  }).join('');
}

// ── DETAIL — GAP REVIEW ───────────────────────────────────────────────────────
function populateDetailGap(c) {
  const g = c.gapReview || {};
  setVal('dp-gap-status',  g.status       || '');
  setVal('dp-gap-scope',   g.scopeSummary || '');
  setVal('dp-gap-invoice', g.invoiceUrl   || '');
  setVal('dp-gap-amount',  g.amount       || '');
}

async function saveGap() {
  if (!currentClient) return;
  const gapReview = {
    status:       $('dp-gap-status')?.value        || '',
    scopeSummary: $('dp-gap-scope')?.value?.trim() || '',
    invoiceUrl:   $('dp-gap-invoice')?.value?.trim()|| '',
    amount:       parseFloat($('dp-gap-amount')?.value) || null,
    updatedAt:    new Date().toISOString()
  };
  try {
    await db.collection('clients').doc(currentClient.id).set({ gapReview, updatedAt: nowTs() }, { merge: true });
    toast('Gap Review saved');
  } catch (e) { console.error(e); toast('Save failed', 'error'); }
}

// ── DETAIL — FINANCIALS ───────────────────────────────────────────────────────
function populateDetailFinancials(c) {
  setText('dp-price', fmtMoney(c.price || PLAN_PRICES[c.plan]));
  const cb = $('dp-maint');
  if (cb) cb.checked = !!c.maintenanceActive;
  const fields = $('dp-maint-fields');
  if (fields) fields.style.display = c.maintenanceActive ? 'block' : 'none';
  setVal('dp-maint-id',    c.subscriptionId       || '');
  setVal('dp-maint-start', c.maintenanceStartDate || '');
}

// Called by dp-maint checkbox onchange
function toggleMaint(checked) {
  const fields = $('dp-maint-fields');
  if (fields) fields.style.display = checked ? 'block' : 'none';
}

async function saveMaint() {
  if (!currentClient) return;
  const updates = {
    maintenanceActive:    $('dp-maint')?.checked || false,
    subscriptionId:       $('dp-maint-id')?.value?.trim()    || '',
    maintenanceStartDate: $('dp-maint-start')?.value          || '',
    updatedAt:            nowTs()
  };
  try {
    await db.collection('clients').doc(currentClient.id).set(updates, { merge: true });
    currentClient = { ...currentClient, ...updates };
    toast('Maintenance saved');
  } catch (e) { console.error(e); toast('Save failed', 'error'); }
}

// ── DETAIL — ACTIVITY ─────────────────────────────────────────────────────────
function populateDetailActivity(c) {
  const el = $('dp-activity-log');
  if (!el) return;
  const log = [...(c.activityLog||[])].sort((a,b) =>
    new Date(b.ts||0).getTime() - new Date(a.ts||0).getTime()
  );
  el.innerHTML = log.length
    ? log.map(e => `
        <div class="act-entry">
          <div class="act-dot"></div>
          <div style="flex:1">
            <div class="act-note">${esc(e.note||'')}</div>
            <div class="act-ts">${fmtDate(e.ts)} · ${esc(e.by||'admin')}</div>
          </div>
        </div>`).join('')
    : '<div class="loading">No activity logged yet</div>';
}

async function addActivityNote() {
  if (!currentClient) return;
  const noteEl = $('dp-new-note');
  const note   = noteEl?.value?.trim();
  if (!note) { toast('Note is empty', 'error'); return; }
  const entry = { note, ts: new Date().toISOString(), by: auth.currentUser?.email || 'admin' };
  try {
    await db.collection('clients').doc(currentClient.id).update({
      activityLog: firebase.firestore.FieldValue.arrayUnion(entry),
      updatedAt:   nowTs()
    });
    if (noteEl) noteEl.value = '';
    const doc = await db.collection('clients').doc(currentClient.id).get();
    currentClient = { id: doc.id, ...doc.data() };
    populateDetailActivity(currentClient);
    toast('Note added');
  } catch (e) { console.error(e); toast('Save failed', 'error'); }
}

// ── DETAIL — REFERRALS ────────────────────────────────────────────────────────
function populateDetailReferrals(c) {
  const el = $('dp-referrals-list');
  if (!el) return;
  const refs = c.referrals || [];
  el.innerHTML = refs.length
    ? refs.map(r => `
        <div style="display:flex;gap:20px;padding:9px 0;border-bottom:1px solid rgba(197,160,89,.06);font-size:11px">
          <span style="flex:1">${esc(r.company||'—')}</span>
          <span style="flex:1;color:var(--marble-dim)">${esc(r.email||'—')}</span>
          <span style="color:var(--marble-faint)">${esc(r.date||'—')}</span>
        </div>`).join('')
    : '<div class="loading">No referrals logged</div>';
}

async function addReferral() {
  if (!currentClient) return;
  const company = $('dp-ref-co')?.value?.trim();
  const email   = $('dp-ref-email')?.value?.trim();
  const date    = $('dp-ref-date')?.value;
  if (!company && !email) { toast('Enter company or email', 'error'); return; }
  const entry = { company, email, date, addedAt: new Date().toISOString() };
  try {
    await db.collection('clients').doc(currentClient.id).update({
      referrals: firebase.firestore.FieldValue.arrayUnion(entry),
      updatedAt: nowTs()
    });
    ['dp-ref-co','dp-ref-email','dp-ref-date'].forEach(id => { const el=$(id); if(el) el.value=''; });
    const doc = await db.collection('clients').doc(currentClient.id).get();
    currentClient = { id: doc.id, ...doc.data() };
    populateDetailReferrals(currentClient);
    toast('Referral added');
  } catch (e) { console.error(e); toast('Save failed', 'error'); }
}

// ── LEADS TABLE ───────────────────────────────────────────────────────────────
async function loadLeads() {
  const tbody = $('l-tbody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="10" class="loading">Loading…</td></tr>';
  try {
    const snap = await db.collection('leads').orderBy('createdAt','desc').get();
    allLeads = [];
    snap.forEach(d => allLeads.push({ id: d.id, ...d.data() }));
    renderLeadsTable(allLeads);
    // Badge
    const badge = $('leads-badge');
    if (badge) {
      const n = allLeads.filter(l => !l.status || l.status === 'new').length;
      badge.textContent = n;
      badge.classList.toggle('hidden', n === 0);
    }
  } catch (e) {
    console.error(e);
    const tb = $('l-tbody');
    if (tb) tb.innerHTML = '<tr><td colspan="10" class="loading" style="color:#d47a7a">Failed to load</td></tr>';
  }
}

function renderLeadsTable(list) {
  const tbody = $('l-tbody');
  if (!tbody) return;
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="10" class="loading">No leads found</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(l => {
    const tc = { warm_lead:'b-warm', hot_lead:'b-hot', ghost_lead:'b-ghost' }[l.leadType] || 'b-ghost';
    const extScore = l.scannerExternalScore ?? l.scannerScore ?? '—';
    const intScore = l.scannerInternalScore ?? '—';
    return `<tr>
      <td>${esc(l.name||'—')}</td>
      <td class="dim">${esc(l.email||l.id)}</td>
      <td class="dim">${esc(l.company||'—')}</td>
      <td><span class="badge ${tc}">${esc(l.leadType||'—')}</span></td>
      <td class="dim">${esc(l.status||'—')}</td>
      <td class="dim">${esc(l.source||'—')}</td>
      <td>${extScore}</td>
      <td>${intScore}</td>
      <td class="dim">${fmtDate(l.createdAt)}</td>
      <td onclick="event.stopPropagation()">
        <div style="display:flex;gap:6px">
          <button class="btn btn-primary btn-sm" onclick="convertLead('${esc(l.id)}')">Convert</button>
          <button class="btn btn-ghost   btn-sm" onclick="archiveLead('${esc(l.id)}')">Archive</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function filterLeads() {
  const s   = ($('l-search')?.value||'').toLowerCase();
  const lt  = $('l-type')?.value   || '';
  const src = $('l-source')?.value || '';
  const srt = $('l-sort')?.value   || 'date_desc';

  let list = allLeads.filter(l =>
    (!s   || (l.name||'').toLowerCase().includes(s) ||
              (l.email||l.id).toLowerCase().includes(s) ||
              (l.company||'').toLowerCase().includes(s)) &&
    (!lt  || l.leadType === lt) &&
    (!src || l.source   === src)
  );
  if (srt === 'score_desc') {
    list.sort((a,b) => (b.scannerExternalScore||b.scannerScore||0) - (a.scannerExternalScore||a.scannerScore||0));
  } else {
    list.sort((a,b) => (b.createdAt?.toDate?.()?.getTime()||0) - (a.createdAt?.toDate?.()?.getTime()||0));
  }
  renderLeadsTable(list);
}

async function convertLead(leadId) {
  if (!confirm('Convert this lead to a client record?')) return;
  try {
    const doc = await db.collection('leads').doc(leadId).get();
    if (!doc.exists) { toast('Lead not found', 'error'); return; }
    const l = { id: doc.id, ...doc.data() };
    const email = l.email || leadId;
    await db.collection('clients').doc(email).set({
      name: l.name||'', email, company: l.company||'',
      plan: l.intendedPlan||'agentic_shield',
      status: 'pending_payment',
      source: l.source||'lead_conversion',
      createdAt: nowTs(), updatedAt: nowTs()
    }, { merge: true });
    await db.collection('leads').doc(leadId).set(
      { status:'converted', convertedAt: nowTs() }, { merge: true }
    );
    await loadLeads();
    toast(`${l.name||email} converted to client`);
  } catch (e) { console.error(e); toast('Conversion failed', 'error'); }
}

async function archiveLead(leadId) {
  if (!confirm('Archive this lead?')) return;
  try {
    await db.collection('leads').doc(leadId).set(
      { status:'archived', archivedAt: nowTs() }, { merge: true }
    );
    await loadLeads();
    toast('Lead archived');
  } catch (e) { console.error(e); toast('Archive failed', 'error'); }
}
