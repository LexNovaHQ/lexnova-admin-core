// admin-logic-1.js — Lex Nova HQ Admin Console (Part 1 — REBUILT)
// Covers: Constants · Utilities · Init · Nav · Dashboard · Clients · Leads · Full Detail Panel
// Requires: Firebase compat globals auth, db, firebase — initialised in admin.html

'use strict';

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const PLANS = {
  agentic_shield:   'Agentic Shield',
  workplace_shield: 'Workplace Shield',
  complete_stack:   'Complete Stack',
  flagship:          'Flagship'
};

const STATUS_CHAIN = [
  'pending_payment','payment_received','intake_received','under_review','in_production','delivered'
];

const STATUS_LABELS = {
  pending_payment:  'Pending Payment',
  payment_received: 'Payment Received',
  intake_received:  'Intake Received',
  under_review:      'Under Review',
  in_production:    'In Production',
  delivered:         'Delivered'
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
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
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

function toast(msg, type = 'success') {
  const t = $('toast');
  if (!t) return;
  t.textContent  = msg;
  t.className    = type;
  t.style.display = 'block';
  clearTimeout(t._t);
  t._t = setTimeout(() => { t.style.display = 'none'; }, 3000);
}

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

async function loadRadarCache() {
  if (radarEntries.length) return;
  try {
    const snap = await db.collection('settings').doc('regulatory_radar').get();
    radarEntries = snap.exists ? (snap.data().entries || []) : [];
  } catch (e) { console.error('Radar cache:', e); }
}

function init() { nav('dashboard'); }

function nav(tab) {
  qsa('.tab-content').forEach(p => p.classList.remove('active'));
  qsa('.nav-item').forEach(l => l.classList.remove('active'));
  $('tab-' + tab)?.classList.add('active');
  document.querySelector(`.nav-item[data-tab="${tab}"]`)?.classList.add('active');
  const subs = { dashboard: 'Command center', clients: 'Client management', leads: 'Lead management', outreach: 'Outreach CRM', flagship: 'Flagship pipeline', content: 'Content', radar: 'Regulatory radar', finance: 'Finance', settings: 'Settings' };
  const sub = $('pageSub');
  if (sub) sub.textContent = subs[tab] || tab;
  const loaders = { dashboard: loadDashboard, clients: loadClients, leads: loadLeads };
  if (loaders[tab]) loaders[tab]();
}

function planBadgeClass(plan) {
  return { agentic_shield:'b-intake', workplace_shield:'b-warm', complete_stack:'b-production', flagship:'b-hot' }[plan] || 'b-ghost';
}
function statusBadgeClass(status) {
  return { pending_payment:'b-pending', payment_received: 'b-delivered', intake_received:'b-intake', under_review:'b-review', in_production:'b-production', delivered:'b-delivered' }[status] || 'b-ghost';
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
    const clients = []; cSnap.forEach(d => clients.push({ id: d.id, ...d.data() }));
    const prospects = []; pSnap.forEach(d => prospects.push({ id: d.id, ...d.data() }));
    radarEntries = rSnap.exists ? (rSnap.data().entries || []) : [];
    const cap = cfgSnap.exists ? (cfgSnap.data().capacityCap || 10) : 10;

    const inProd = clients.filter(c => c.status === 'in_production');
    const maint = clients.filter(c => c.maintenanceActive);
    const paid = clients.filter(c => c.status !== 'pending_payment');
    const mrr = maint.length * 297;
    const total = paid.reduce((s,c) => s + (c.price || PLAN_PRICES[c.plan] || 0), 0);

    setText('d-mrr', fmtMoney(mrr));
    setText('d-mrr-sub', `${maint.length} active maintenance`);
    setText('d-total', fmtMoney(total));
    setText('d-clients-count', `${clients.length} total clients`);
    setText('d-active', inProd.length);

    const pct = Math.min(100, Math.round((inProd.length / cap) * 100));
    const col = pct >= 80 ? '#d47a7a' : pct >= 60 ? '#C5A059' : '#7ab88a';
    setText('d-cap-current', inProd.length);
    setText('d-cap-label', `${inProd.length} / ${cap} slots`);
    const bar = $('d-cap-bar');
    if (bar) { bar.style.width = pct + '%'; bar.style.background = col; }

    const rcTbody = $('d-recent-clients');
    if (rcTbody) {
      const sorted = [...clients].sort((a,b) => (b.createdAt?.toDate?.()?.getTime()||0) - (a.createdAt?.toDate?.()?.getTime()||0)).slice(0, 5);
      rcTbody.innerHTML = sorted.length ? sorted.map(c => `
        <tr onclick="openDetail('${esc(c.id)}');nav('clients')" style="cursor:pointer">
          <td>${esc(c.name||c.id)}</td>
          <td><span class="badge ${planBadgeClass(c.plan)}">${planLabel(c.plan)}</span></td>
          <td><span class="badge ${statusBadgeClass(c.status)}">${statusLabel(c.status)}</span></td>
          <td class="dim">${fmtDate(c.createdAt)}</td>
        </tr>`).join('') : '<tr><td colspan="4" class="loading">No clients yet</td></tr>';
    }
  } catch (e) { console.error('Dashboard:', e); }
}

// ── CLIENTS TABLE ─────────────────────────────────────────────────────────────
function loadClients() {
  const tbody = $('c-tbody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="9" class="loading">Loading…</td></tr>';
  db.collection('clients').orderBy('createdAt','desc').onSnapshot(async (snap) => {
    await loadRadarCache();
    allClients = [];
    snap.forEach(d => allClients.push({ id: d.id, ...d.data() }));
    renderClientsTable(allClients);
  });
}

function renderClientsTable(list) {
  const tbody = $('c-tbody');
  if (!tbody || !list.length) { if(tbody) tbody.innerHTML = '<tr><td colspan="9" class="loading">No clients found</td></tr>'; return; }
  tbody.innerHTML = list.map(c => {
    const elBadge = c.elAccepted ? `<span class="badge b-delivered">✓ Yes</span>` : `<span class="badge b-ghost">—</span>`;
    
    // SLA CLOCK: Check for intakeReceivedAt (Phase 5 field)
    let slaClock = '<span class="dim">—</span>';
    const startTs = c.intakeReceivedAt || c.intakeSentAt || c.productionStartedAt;

    if (startTs && (c.status === 'intake_received' || c.status === 'in_production')) {
        const hRemaining = 48 - hoursSince(startTs);
        const colorClass = hRemaining <= 0 ? 'cd-over' : hRemaining <= 8 ? 'cd-warn' : 'cd-ok';
        const label = hRemaining > 0 ? `${hRemaining}h left` : `${Math.abs(hRemaining)}h OVERDUE`;
        slaClock = `<span class="countdown ${colorClass}">${label}</span>`;
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
  const jurs = [c.registrationJurisdiction, ...(c.operatingJurisdictions||[])].filter(Boolean);
  const today = new Date();
  const delAt = c.deliveredAt ? (c.deliveredAt.toDate ? c.deliveredAt.toDate() : new Date(c.deliveredAt)) : null;
  let red = 0, yellow = 0, green = 0;
  radarEntries.forEach(reg => {
    const match = jurs.some(j => j && reg.jurisdiction && (j === reg.jurisdiction || reg.jurisdiction.toUpperCase().startsWith(j.toUpperCase()) || j.toUpperCase().startsWith(reg.jurisdiction.toUpperCase())));
    if (!match) return;
    const eff = reg.effectiveDate ? new Date(reg.effectiveDate) : null;
    if (!eff || eff > today) { yellow++; return; }
    if (reg.coveredByPlan?.includes(c.plan) && delAt && eff <= delAt) { green++; return; }
    if (c.maintenanceActive) { yellow++; return; }
    red++;
  });
  let dots = '';
  if (red) dots += `<span class="dot dot-red" title="${red} Exposed"></span>`;
  if (yellow) dots += `<span class="dot dot-yellow" title="${yellow} Scheduled"></span>`;
  if (green) dots += `<span class="dot dot-green" title="${green} Covered"></span>`;
  return dots || '<span class="dot dot-grey"></span>';
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
  } catch (e) { console.error(e); }
}

function renderLeadsTable(list) {
  const tbody = $('l-tbody');
  if (!tbody || !list.length) { if(tbody) tbody.innerHTML = '<tr><td colspan="10" class="loading">No leads found</td></tr>'; return; }
  tbody.innerHTML = list.map(l => {
    const tc = { warm_lead:'b-warm', hot_lead:'b-hot', ghost_lead:'b-ghost' }[l.leadType] || 'b-ghost';
    return `<tr>
      <td>${esc(l.name||'—')}</td>
      <td class="dim">${esc(l.email||l.id)}</td>
      <td class="dim">${esc(l.company||'—')}</td>
      <td><span class="badge ${tc}">${esc(l.leadType||'—')}</span></td>
      <td class="dim">${esc(l.status||'—')}</td>
      <td class="dim">${esc(l.source||'—')}</td>
      <td>${l.scannerExternalScore ?? '—'}</td>
      <td>${l.scannerInternalScore ?? '—'}</td>
      <td class="dim">${fmtDate(l.createdAt)}</td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn btn-primary btn-sm" onclick="convertLead('${esc(l.id)}')">Convert</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ── DETAIL PANEL LOGIC ────────────────────────────────────────────────────────
async function openDetail(email) {
  currentClient = null;
  $('detailPanel')?.classList.add('open');
  detailTab('overview', qsa('.sub-tab')[0]);
  try {
    await loadRadarCache();
    const doc = await db.collection('clients').doc(email).get();
    if (!doc.exists) return;
    currentClient = { id: doc.id, ...doc.data() };
    refreshDetailHeader();
    populateDetailOverview(currentClient);
  } catch (e) { console.error(e); }
}

function closeDetail() { $('detailPanel')?.classList.remove('open'); }

function showDetailSection(key) {
  ['overview','intake','checklist','documents','radar','gap','financials','activity','referrals'].forEach(s => $('dt-' + s)?.classList.toggle('hidden', s !== key));
}

function refreshDetailHeader() {
  if (!currentClient) return;
  setText('dp-name', currentClient.name || currentClient.id);
  setText('dp-email', currentClient.id);
  setText('dp-plan', planLabel(currentClient.plan));
}

async function detailTab(key, el) {
  if (!currentClient) return;
  qsa('.sub-tab').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
  showDetailSection(key);
  const loaders = { overview: populateDetailOverview, intake: populateDetailIntake, checklist: populateDetailChecklist, documents: populateDetailDocuments, radar: populateDetailRadar };
  if (loaders[key]) loaders[key](currentClient);
}

function populateDetailOverview(c) {
  setVal('dp-status', c.status || 'pending_payment');
  setText('dp-ref', c.engagementRef || '—');
  setVal('dp-reg-jur', c.registrationJurisdiction || '');
  setVal('dp-plan-sel', c.plan || 'agentic_shield');
  setVal('dp-notes', c.adminNotes || '');
}

async function saveOverview() {
  if (!currentClient) return;
  const updates = {
    status: $('dp-status')?.value,
    plan: $('dp-plan-sel')?.value,
    registrationJurisdiction: $('dp-reg-jur')?.value,
    adminNotes: $('dp-notes')?.value?.trim(),
    updatedAt: nowTs()
  };
  try {
    await db.collection('clients').doc(currentClient.id).update(updates);
    toast('Overview saved');
  } catch (e) { console.error(e); }
}

function populateDetailIntake(c) {
  const el = $('dp-intake-content');
  if (!el) return;
  const intake = c.intakeData || {};
  el.innerHTML = Object.entries(intake).map(([k,v]) => `<div style="display:flex;padding:8px 0;border-bottom:1px solid rgba(197,160,89,.06);font-size:11px"><span style="color:var(--marble-dim);width:160px;flex-shrink:0">${esc(k)}</span><span>${esc(v)}</span></div>`).join('');
}

function populateDetailChecklist(c) {
  const itemsEl = $('dp-checklist-items');
  const items = CHECKLIST_ITEMS[c.plan] || CHECKLIST_ITEMS.agentic_shield;
  const saved = c.checklist || {};
  itemsEl.innerHTML = items.map((item, i) => `<div class="chk-item"><div class="chk-box ${saved[i]?'done':''}" onclick="toggleChk(this,${i})"><span class="chk-tick">✓</span></div><span>${esc(item)}</span></div>`).join('');
}

function toggleChk(el, i) { el.classList.toggle('done'); }

async function saveChecklist() {
  if (!currentClient) return;
  const checklist = {};
  qsa('.chk-box').forEach((box, i) => { checklist[i] = box.classList.contains('done'); });
  await db.collection('clients').doc(currentClient.id).update({ checklist });
  toast('Checklist saved');
}

function populateDetailDocuments(c) {
  const container = $('docsContainer');
  container.innerHTML = (c.documents || []).map((d, i) => `<div class="doc-row"><span>${esc(d.name)}</span><a href="${d.pdfUrl}" target="_blank">PDF</a></div>`).join('');
}

function populateDetailRadar(c) {
  const el = $('dp-radar-list');
  el.innerHTML = '<div class="loading">Matched via Jurisdictions</div>';
}

async function convertLead(leadId) {
  if (!confirm('Convert to client?')) return;
  const doc = await db.collection('leads').doc(leadId).get();
  const l = doc.data();
  await db.collection('clients').doc(leadId).set({ name: l.name, email: l.email, status: 'payment_received', plan: 'agentic_shield', createdAt: nowTs() });
  await db.collection('leads').doc(leadId).update({ status: 'converted' });
  loadLeads();
  toast('Converted');
}
