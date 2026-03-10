'use strict';

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const PLANS = { agentic_shield: 'Agentic Shield', workplace_shield: 'Workplace Shield', complete_stack: 'Complete Stack', flagship: 'Flagship' };
const STATUS_LABELS = { pending_payment: 'Pending Payment', payment_received: 'Payment Received', intake_received: 'Intake Received', under_review: 'Under Review', in_production: 'In Production', delivered: 'Delivered' };
const PLAN_PRICES = { agentic_shield: 997, workplace_shield: 997, complete_stack: 2500, flagship: 15000 };
const PLAN_SCOPES = {
    agentic_shield: "Lane A: Agentic Framework, AI Terms of Service, User Consent Architecture, DPA, and LLM Hallucination Disclaimers.",
    workplace_shield: "Lane B: Internal AI Usage Policy, Employee IP Protection, Shadow AI Audit Framework, and HITL Protocols.",
    complete_stack: "Full Lane A & B: End-to-end product liability shielding and internal operational AI governance.",
    flagship: "Bespoke Architect Mandate: Full custom legal engineering and ongoing regulatory representation."
};
const JURISDICTIONS = [
    { val:'us', label:'United States' }, { val:'eu', label:'European Union' }, 
    { val:'uk', label:'United Kingdom' }, { val:'ca', label:'Canada' }, 
    { val:'au', label:'Australia' }, { val:'sg', label:'Singapore' }, 
    { val:'ae', label:'UAE' }, { val:'in', label:'India' }, { val:'global', label:'Global' }
];

// MASTER SOP CATEGORIES
const CHECKLIST_ITEMS = {
  agentic_shield: {
    "Phase 0: The Gatekeeper": ['Payment received and confirmed', 'EL (Stage 1) accepted', 'Intake vault reviewed', 'Engagement Ref generated'],
    "Phase 1: Lane A Production": ['Injection logic evaluated', 'DOC_TOS drafted', 'DOC_AGT drafted', 'DOC_AUP drafted', 'DOC_SLA drafted', 'DOC_DPA drafted', 'DOC_PP drafted', 'DOC_PBK_A drafted'],
    "Pre-Flight (The Death Checks)": ['Liability: Hallucination waiver prominent', 'Money: Agentic spend cap set in Schedule C', 'Data: Correct DPA attached', 'Shield: AS-IS disclaimer in ALL CAPS', 'Identity: Client name spelled correctly'],
    "Phase 4/5: Delivery Prep": ['Full EL (Stage 2) generated', 'PDFs uploaded to OneDrive', 'DOCX uploaded to OneDrive', 'Walkthrough video recorded and linked']
  },
  workplace_shield: {
    "Phase 0: The Gatekeeper": ['Payment received and confirmed', 'EL (Stage 1) accepted', 'Intake vault reviewed', 'Engagement Ref generated'],
    "Phase 2: Lane B Production": ['Injection logic evaluated', 'DOC_SCAN drafted', 'DOC_HND drafted', 'DOC_IP drafted', 'DOC_SOP drafted', 'DOC_DPIA drafted', 'DOC_PBK_B drafted'],
    "Pre-Flight (The Death Checks)": ['Policy: Traffic light matches SCAN and HND', 'Ownership: IP Deed ready for execution', 'Evidence: HITL examples match industry', 'Compliance: DPIA timeline dates current', 'Identity: Client name spelled correctly'],
    "Phase 4/5: Delivery Prep": ['Full EL (Stage 2) generated', 'PDFs uploaded to OneDrive', 'DOCX uploaded to OneDrive', 'Walkthrough video recorded and linked']
  },
  complete_stack: {
    "Phase 0: The Gatekeeper": ['Payment received and confirmed', 'EL (Stage 1) accepted', 'Intake vault reviewed', 'Engagement Ref generated'],
    "Phase 1: Lane A Production": ['Injection logic evaluated', 'DOC_TOS drafted', 'DOC_AGT drafted', 'DOC_AUP drafted', 'DOC_SLA drafted', 'DOC_DPA drafted', 'DOC_PP drafted', 'DOC_PBK_A drafted'],
    "Phase 2: Lane B Production": ['DOC_SCAN drafted', 'DOC_HND drafted', 'DOC_IP drafted', 'DOC_SOP drafted', 'DOC_DPIA drafted', 'DOC_PBK_B drafted'],
    "Pre-Flight (The Death Checks)": ['Lane A Death Checks passed', 'Lane B Death Checks passed', 'Consistency: IP and Data rules match across lanes', 'Completeness: All 13 deliverables present'],
    "Phase 4/5: Delivery Prep": ['Full EL (Stage 2) generated', 'PDFs uploaded to OneDrive', 'DOCX uploaded to OneDrive', 'Walkthrough video recorded and linked']
  },
  flagship: {
    "Phase 0: The Gatekeeper": ['EL (Stage 1) accepted', 'Discovery call completed'],
    "Production": ['Post-call gap analysis documented', 'Proposal sent and accepted', 'Bespoke documents drafted'],
    "Delivery": ['Delivered']
  }
};

// ── STATE ─────────────────────────────────────────────────────────────────────
let allClients = []; let allLeads = []; let currentClient = null; let radarEntries = [];
let clientListener = null;

// ── UTILITIES ─────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const qsa = sel => Array.from(document.querySelectorAll(sel));
const planLabel = k => PLANS[k] || k;
const statusLabel = k => STATUS_LABELS[k] || k;
const nowTs = () => firebase.firestore.FieldValue.serverTimestamp();
const esc = str => !str ? '' : String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
function fmtDate(ts) { if (!ts) return '—'; const d = ts.toDate ? ts.toDate() : new Date(ts); if (isNaN(d)) return '—'; return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }); }
function fmtMoney(n) { return (n == null || isNaN(n)) ? '—' : '$' + Number(n).toLocaleString('en-US'); }
function hoursSince(ts) { if (!ts) return null; const d = ts.toDate ? ts.toDate() : new Date(ts); return Math.floor((Date.now() - d.getTime()) / 3600000); }
function setText(id, txt) { const el = $(id); if (el) el.textContent = String(txt ?? ''); }
function setVal(id, val) { const el = $(id); if (el) el.value = val ?? ''; }
function toast(msg, type = 'success') { const t = $('toast'); if (!t) return; t.textContent = msg; t.className = type; t.style.display = 'block'; setTimeout(() => { t.style.display = 'none'; }, 3000); }

// ── MODAL ─────────────────────────────────────────────────────────────────────
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

// ── INIT & NAV ─────────────────────────────────────────────────────────────────
function init() { nav('dashboard'); }

function nav(tab) {
    qsa('.tab-content').forEach(p => p.classList.remove('active'));
    qsa('.nav-item').forEach(l => l.classList.remove('active'));
    $('tab-' + tab)?.classList.add('active');
    document.querySelector(`.nav-item[data-tab="${tab}"]`)?.classList.add('active');
    
    const subs = { dashboard: 'Command center', factory: 'Production pipeline', hunt: 'Acquisition', syndicate: 'Recurring Engine' };
    const sub = $('pageSub'); if (sub) sub.textContent = subs[tab] || tab;
    
    // Loaders for Logic 1
    if (tab === 'dashboard') loadDashboard();
    if (tab === 'factory' || tab === 'clients') loadClients();
    if (tab === 'leads') loadLeads();
    
    // Cross-file hooks into Logic 2
    if (tab === 'hunt' || tab === 'deals') {
        if (typeof loadOutreach === 'function') loadOutreach();
    }
    if (tab === 'syndicate') {
        if (typeof loadRadar === 'function') loadRadar();
    }
    if (tab === 'engine') {
        if (typeof loadFinance === 'function') loadFinance();
        if (typeof loadContent === 'function') loadContent();
        if (typeof loadSettings === 'function') loadSettings();
    }
}

// ── RADAR CACHE ───────────────────────────────────────────────────────────────
async function loadRadarCache() {
  try {
    const snap = await db.collection('settings').doc('regulatory_radar').get();
    radarEntries = snap.exists ? (snap.data().entries || snap.data().items || []) : [];
  } catch (e) { console.error('Radar cache:', e); }
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
async function loadDashboard() {
    try {
        const cSnap = await db.collection('clients').get();
        const clients = []; cSnap.forEach(d => clients.push({ id: d.id, ...d.data() }));

        const pSnap = await db.collection('prospects').get();
        const prospects = []; pSnap.forEach(d => prospects.push(d.data()));

        const lSnap = await db.collection('leads').where('source', '==', 'scanner').get();
        const leads = []; lSnap.forEach(d => leads.push(d.data()));

        await loadRadarCache();

        // ── 1. ROW 1: MONEY & URGENCY ──
        const maint = clients.filter(c => c.maintenanceActive);
        const mrr = maint.length * 297;
        setText('d-mrr', fmtMoney(mrr));
        setText('d-mrr-sub', `${maint.length} active maintenance`);

        const inProd = clients.filter(c => ['under_review', 'in_production'].includes(c.status));
        setText('d-cap-current', inProd.length);
        const capBar = $('d-cap-bar'); if (capBar) capBar.style.width = Math.min(100, (inProd.length/50)*100) + '%';
        setText('d-cap-label', `${inProd.length} / 50 slots`);

        // Calculate Actionable Gaps
        let gapCount = 0;
        clients.forEach(c => {
            if (c.maintenanceActive) return; 
            const jurs = [c.registrationJurisdiction, ...(c.operatingJurisdictions||[])].filter(Boolean);
            const delAt = c.deliveredAt ? (c.deliveredAt.toDate ? c.deliveredAt.toDate() : new Date(c.deliveredAt)) : (c.status==='delivered' ? new Date(0) : null);
            
            let isExposed = false;
            radarEntries.forEach(reg => {
                let rJurs = Array.isArray(reg.jurisdiction) ? reg.jurisdiction : (typeof reg.jurisdiction==='string' ? reg.jurisdiction.split(',').map(s=>s.trim().toLowerCase()) : []);
                if (!rJurs.some(r => r==='global') && !jurs.some(j => j && rJurs.some(rj => rj && (j.toLowerCase()===rj || rj.startsWith(j.toLowerCase()))))) return;
                
                const eff = reg.effectiveDate ? new Date(reg.effectiveDate) : null;
                const covered = reg.coveredByPlan?.includes(c.plan);
                if (!covered || (covered && c.status==='delivered' && eff && eff > delAt)) isExposed = true;
            });
            if (isExposed) gapCount++;
        });
        setText('d-gaps', gapCount);
        setText('d-gaps-sub', `${fmtMoney(gapCount * 497)} Upsell Pipeline`);

        // SLA Critical
        const slaCrit = clients.filter(c => {
            if (!['intake_received', 'in_production'].includes(c.status)) return false;
            const startTs = c.intakeReceivedAt || c.intakeSentAt || c.productionStartedAt;
            return startTs && hoursSince(startTs) >= 36; 
        });
        setText('d-sla-crit', slaCrit.length);

        // ── 2. ROW 2: FUNNELS ──
        const clicks = prospects.filter(p => p.scannerClicked || p.scannerCompleted).length;
        const comps = leads.length;
        const paid = prospects.filter(p => p.status === 'Converted').length;
        setText('sf-clicks', clicks);
        setText('sf-comps', comps);
        setText('sf-paid', paid);
        setText('sf-rate', comps > 0 ? Math.round((paid/comps)*100)+'% Conversion' : '0% Conversion');

        const fc = { Cold:0, Warm:0, Hot:0, Replied:0, Negotiating:0 };
        prospects.forEach(p => { if (fc[p.status] !== undefined) fc[p.status]++; });
        Object.keys(fc).forEach(k => setText('of-' + k.toLowerCase(), fc[k]));

        // ── 3. ROW 3: ACTION LISTS ──
        const slaTbody = $('d-sla-table');
        if (slaTbody) {
            const activeBuilds = clients.filter(c => ['intake_received', 'under_review', 'in_production'].includes(c.status));
            slaTbody.innerHTML = activeBuilds.length ? activeBuilds.map(c => {
                const startTs = c.intakeReceivedAt || c.intakeSentAt || c.productionStartedAt;
                const hRem = startTs ? 48 - hoursSince(startTs) : 48;
                const col = hRem <= 12 ? '#d47a7a' : 'var(--marble)';
                return `<tr onclick="openDetail('${esc(c.id)}');nav('factory')">
                    <td>${esc(c.name||c.id)}</td>
                    <td><span class="badge ${statusBadgeClass(c.status)}">${statusLabel(c.status)}</span></td>
                    <td style="color:${col}">${hRem}h left</td>
                </tr>`;
            }).join('') : '<tr><td colspan="3" class="empty">No active builds</td></tr>';
        }

        const rcTbody = $('d-recent-clients');
        if (rcTbody) {
            const sortedC = [...clients].sort((a,b) => (b.createdAt?.toDate?.()?.getTime()||0) - (a.createdAt?.toDate?.()?.getTime()||0)).slice(0, 5);
            rcTbody.innerHTML = sortedC.length ? sortedC.map(c => `
                <tr onclick="openDetail('${esc(c.id)}');nav('factory')">
                    <td>${esc(c.name||c.id)}</td>
                    <td><span class="badge ${planBadgeClass(c.plan)}">${planLabel(c.plan)}</span></td>
                    <td><span class="badge ${statusBadgeClass(c.status)}">${statusLabel(c.status)}</span></td>
                </tr>`).join('') : '<tr><td colspan="3" class="empty">No engagements yet</td></tr>';
        }

        // ── 4. ROW 4: AUTO RITUALS ──
        const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay()); weekStart.setHours(0,0,0,0);
        let weekForms = 0; leads.forEach(l => { const d = l.createdAt?.toDate ? l.createdAt.toDate() : new Date(l.createdAt||0); if (d >= weekStart) weekForms++; });
        let weekDeals = 0; clients.forEach(c => { const d = c.createdAt?.toDate ? c.createdAt.toDate() : new Date(c.createdAt||0); if (d >= weekStart) weekDeals++; });
        let pipeValue = 0; prospects.filter(p => !['Converted','Dead'].includes(p.status)).forEach(p => pipeValue += (PLAN_PRICES[p.intendedPlan] || 0));
        setText('r-auto-forms', weekForms);
        setText('r-auto-deals', weekDeals);
        setText('r-auto-pipe', fmtMoney(pipeValue));

        if (typeof loadRitual === 'function') loadRitual();

    } catch (e) { console.error('Dash Error:', e); }
}

// ── CLIENTS / FACTORY BOARD (ARMOR-PLATED) ───────────────────────────────────
function loadClients() {
    if (clientListener) clientListener();
    
    const tbodies = document.querySelectorAll('#c-tbody');
    tbodies.forEach(tb => tb.innerHTML = '<tr><td colspan="9" class="loading">Loading…</td></tr>');
    
    clientListener = db.collection('clients').orderBy('createdAt','desc').onSnapshot(async (snap) => {
        await loadRadarCache();
        allClients = [];
        snap.forEach(d => allClients.push({ id: d.id, ...d.data() }));
        renderClientsTable(allClients);
        renderFactoryBoard(); 
    });
}

function renderFactoryBoard() {
  const cols = { 1: [], 2: [], 3: [], 4: [] };

  allClients.forEach(c => {
    if (c.status === 'delivered') return; 

    if (c.status === 'pending_payment' || c.status === 'payment_received') {
      cols[1].push(c); 
    } else if (c.status === 'intake_received' || c.status === 'under_review') {
      cols[2].push(c); 
    } else if (c.status === 'in_production') {
      cols[3].push(c); 
    } else {
      cols[4].push(c); 
    }
  });

  for (let i = 1; i <= 4; i++) {
    const els = document.querySelectorAll('#kf-col-' + i);
    const cnts = document.querySelectorAll('#kf-c' + i);
    if (els.length === 0) continue;
    
    cnts.forEach(c => c.innerText = cols[i].length);
    
    const html = cols[i].length === 0 
      ? '<div class="empty" style="padding:20px; border:none;">Empty</div>'
      : cols[i].map(c => {
          const name = esc(c.name || c.id);
          const plan = planLabel(c.plan);
          
          let slaText = 'Awaiting Intake';
          let slaStyle = 'color:var(--marble-faint)';
          const startTs = c.intakeReceivedAt || c.intakeSentAt || c.productionStartedAt;
          
          if (startTs) {
              const hRem = 48 - hoursSince(startTs);
              if (hRem <= 0) { slaText = '⚠ OVERDUE'; slaStyle = 'color:#d47a7a; font-weight:600;'; }
              else if (hRem <= 12) { slaText = `⚠ ${hRem}h left`; slaStyle = 'color:#d47a7a;'; }
              else { slaText = `${hRem}h left`; slaStyle = 'color:var(--gold);'; }
          }

          return `
            <div class="k-card" onclick="openDetail('${esc(c.id)}')">
              <div class="k-name">${name}</div>
              <div class="k-comp" style="color:var(--gold)">${plan}</div>
              <div class="k-meta">
                <span style="${slaStyle}">${slaText}</span>
                <span>${c.elAccepted ? 'EL ✓' : 'EL ⏳'}</span>
              </div>
            </div>
          `;
        }).join('');
        
    els.forEach(el => el.innerHTML = html);
  }
}

function renderClientsTable(list) {
    const tbodies = document.querySelectorAll('#c-tbody');
    if (tbodies.length === 0) return;
    
    const html = list.map(c => {
        const elBadge = !!c.elAccepted ? `<span class="badge b-delivered">✓ Yes</span>` : `<span class="badge b-ghost">—</span>`;
        let slaClock = '<span class="dim">—</span>';
        const startTs = c.intakeReceivedAt || c.intakeSentAt || c.productionStartedAt;

        if (startTs && (c.status === 'intake_received' || c.status === 'in_production')) {
            const hRem = 48 - hoursSince(startTs);
            const cls = hRem <= 0 ? 'cd-over' : hRem <= 8 ? 'cd-warn' : 'cd-ok';
            slaClock = `<span class="countdown ${cls}">${hRem > 0 ? hRem + 'h left' : Math.abs(hRem) + 'h OVER'}</span>`;
        }
        return `<tr onclick="openDetail('${esc(c.id)}')">
            <td>${esc(c.name||'—')}</td><td class="dim">${esc(c.company||'—')}</td>
            <td><span class="badge ${planBadgeClass(c.plan)}">${planLabel(c.plan)}</span></td>
            <td><span class="badge ${statusBadgeClass(c.status)}">${statusLabel(c.status)}</span></td>
            <td>${slaClock}</td><td>${elBadge}</td><td class="dim">${esc(c.registrationJurisdiction||'—')}</td>
            <td><div class="radar-dots">●</div></td><td class="dim">${fmtDate(c.createdAt)}</td>
        </tr>`;
    }).join('');
    
    tbodies.forEach(tb => tb.innerHTML = html);
}

function filterClients() {
    const s = ($('c-search')?.value||'').toLowerCase();
    const list = allClients.filter(c => !s || (c.name||'').toLowerCase().includes(s) || (c.email||c.id).toLowerCase().includes(s) || (c.company||'').toLowerCase().includes(s));
    renderClientsTable(list);
}

function planBadgeClass(p) { return { agentic_shield:'b-intake', workplace_shield:'b-warm', complete_stack:'b-production', flagship:'b-hot' }[p] || 'b-ghost'; }
function statusBadgeClass(s) { return { pending_payment:'b-pending', payment_received: 'b-delivered', intake_received:'b-intake', under_review:'b-review', in_production:'b-production', delivered:'b-delivered' }[s] || 'b-ghost'; }

// ── LEADS TABLE ───────────────────────────────────────────────────────────────
async function loadLeads() {
    const snap = await db.collection('leads').orderBy('createdAt','desc').get();
    const tbodies = document.querySelectorAll('#l-tbody');
    if (tbodies.length === 0) return;
    
    const html = snap.docs.map(d => {
        const l = d.data();
        return `<tr><td>${esc(l.name||'—')}</td><td>${esc(l.email||d.id)}</td><td class="dim">${esc(l.company||'—')}</td><td><span class="badge b-ghost">${esc(l.leadType||'—')}</span></td><td>${esc(l.status||'—')}</td><td class="dim">${esc(l.source||'—')}</td><td>${l.scannerExternalScore ?? '—'}</td><td>${l.scannerInternalScore ?? '—'}</td><td class="dim">${fmtDate(l.createdAt)}</td><td><button class="btn btn-outline btn-sm">Convert</button></td></tr>`;
    }).join('');
    
    tbodies.forEach(tb => tb.innerHTML = html);
}

// ── DETAIL PANEL ROUTER ───────────────────────────────────────────────────────
async function openDetail(email) {
    $('detailPanel').classList.add('open');
    await loadRadarCache();
    const doc = await db.collection('clients').doc(email).get();
    currentClient = { id: doc.id, ...doc.data() };
    setText('dp-name', currentClient.name || currentClient.id);
    setText('dp-email', currentClient.id);
    setText('dp-plan', planLabel(currentClient.plan));
    
    try {
        populateDetailOverview(currentClient);
        populateDetailIntake(currentClient);
        populateDetailChecklist(currentClient);
        populateDetailDocuments(currentClient);
        populateDetailRadar(currentClient);
        populateDetailGap(currentClient);
        populateDetailFinancials(currentClient);
        populateDetailActivity(currentClient);
        populateDetailReferrals(currentClient);
        populateDetailDebrief(currentClient);
    } catch(e) {
        console.error("Error populating detail panel:", e);
    }
    
    detailTab('overview');
}

function closeDetail() { $('detailPanel').classList.remove('open'); }

function detailTab(key, el) {
    const tabs = ['overview','intake','checklist','documents','radar','gap','financials','activity','referrals','debrief'];
    tabs.forEach(t => {
        const section = $('dt-'+t);
        if(section) section.classList.add('hidden');
    });
    const act = $('dt-'+key);
    if(act) act.classList.remove('hidden');

    if(el) {
        document.querySelectorAll('.sub-tab').forEach(b => b.classList.remove('active'));
        el.classList.add('active');
    }
}

// ── 1. OVERVIEW TAB ───────────────────────────────────────────────────────────
function populateDetailOverview(c) {
    const isAccepted = !!c.elAccepted;
    const elStatus = $('dp-el-status');
    if (elStatus) { elStatus.textContent = isAccepted ? '✓ Accepted' : 'Not Accepted'; elStatus.className = isAccepted ? 'el-status-ok' : 'el-status-miss'; }
    setVal('dp-status', c.status || 'pending_payment');
    setVal('dp-plan-sel', c.plan || 'agentic_shield');
    setVal('dp-reg-jur', c.registrationJurisdiction || '');
    setText('dp-ref', c.engagementRef || '—');
    setVal('dp-notes', c.adminNotes || '');
}

window.saveOverview = async function() {
    await db.collection('clients').doc(currentClient.id).update({
        status: $('dp-status').value,
        plan: $('dp-plan-sel').value,
        registrationJurisdiction: $('dp-reg-jur').value,
        adminNotes: $('dp-notes').value,
        updatedAt: nowTs()
    });
    toast('Overview saved');
    loadClients();
};

window.onStatusChange = function(val) {};

// ── 2. INTAKE TAB ─────────────────────────────────────────────────────────────
function populateDetailIntake(c) {
    const el = $('dp-intake-content');
    if (!el) return;
    const intake = c.intakeData || {};
    if (Object.keys(intake).length === 0) {
        el.innerHTML = '<div class="loading">No intake data submitted yet</div>';
        return;
    }
    
    let warningsHTML = '';
    const warnings = [];
    if (intake.processesEUData === 'Yes') warnings.push('⚠ EU Data Detected: Inject DOC_DPA and reference SCCs.');
    if (intake.usesFreelancers === 'Yes') warnings.push('⚠ Freelancers Detected: Inject Contractor IP Assignment limits.');
    
    if (warnings.length > 0) {
        warningsHTML = `<div style="background:rgba(197,160,89,0.1); border:1px solid var(--gold); padding:12px; margin-bottom:16px;">
            <div style="color:var(--gold); font-size:10px; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:6px;">Injection Verdicts</div>
            ${warnings.map(w => `<div style="font-size:11px; color:var(--marble); margin-bottom:4px;">${w}</div>`).join('')}
        </div>`;
    }

    const dataHTML = Object.entries(intake).map(([k,v]) => `<div style="border-bottom:1px solid var(--border); padding:8px 0; display:flex; font-size:11px;"><span style="width:35%; opacity:0.6; text-transform:uppercase;">${esc(k)}</span><span style="width:65%;">${esc(Array.isArray(v) ? v.join(', ') : v)}</span></div>`).join('');
    
    el.innerHTML = warningsHTML + dataHTML;
}

// ── 3. CHECKLIST TAB ──────────────────────────────────────
function populateDetailChecklist(c) {
    const el = $('dp-checklist-items');
    if (!el) return;
    const catMap = CHECKLIST_ITEMS[c.plan] || CHECKLIST_ITEMS.agentic_shield;
    const saved = c.checklist || {};
    
    let html = '';
    let globalIndex = 0; 

    Object.keys(catMap).forEach(category => {
        const isDeathCheck = category.includes("Death Check");
        const catColor = isDeathCheck ? '#d47a7a' : 'var(--gold)';

        html += `<div style="margin-top:16px; margin-bottom:8px; font-size:9px; letter-spacing:0.15em; text-transform:uppercase; color:${catColor}; border-bottom:1px solid ${isDeathCheck ? 'rgba(212,122,122,0.3)' : 'var(--border)'}; padding-bottom:4px;">${category}</div>`;
        
        catMap[category].forEach(item => {
            html += `
                <div class="chk-item" style="display:flex; align-items:flex-start; gap:10px; padding:7px 0; border-bottom:1px solid rgba(197,160,89,.04);">
                    <div class="chk-box ${saved[globalIndex] ? 'done' : ''} ${isDeathCheck ? 'death-check' : ''}" id="chk-box-${globalIndex}" style="width:16px; height:16px; border:1px solid var(--border2); cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:2px; ${saved[globalIndex] ? 'background:var(--gold-dim); border-color:var(--gold);' : ''}" onclick="toggleChk(this, ${globalIndex})">
                        <span class="chk-tick" style="color:var(--gold); font-size:10px; display:${saved[globalIndex] ? 'block' : 'none'};">✓</span>
                    </div>
                    <span class="chk-label" id="chk-label-${globalIndex}" style="font-size:11px; line-height:1.4; ${saved[globalIndex] ? 'color:var(--marble-dim); text-decoration:line-through;' : 'color:var(--marble);'}">${esc(item)}</span>
                </div>
            `;
            globalIndex++;
        });
    });

    el.innerHTML = html;
}

window.toggleChk = function(el, i) {
    el.classList.toggle('done');
    const isDone = el.classList.contains('done');
    el.style.background = isDone ? 'var(--gold-dim)' : 'transparent';
    el.style.borderColor = isDone ? 'var(--gold)' : 'var(--border2)';
    el.querySelector('.chk-tick').style.display = isDone ? 'block' : 'none';
    const lbl = $(`chk-label-${i}`);
    if (lbl) {
        lbl.style.color = isDone ? 'var(--marble-dim)' : 'var(--marble)';
        lbl.style.textDecoration = isDone ? 'line-through' : 'none';
    }
};

window.saveChecklist = async function() {
    if (!currentClient) return;
    const checklist = {};
    const boxes = qsa('.chk-box');
    boxes.forEach((box) => {
        const idStr = box.id.replace('chk-box-', '');
        checklist[idStr] = box.classList.contains('done');
    });
    await db.collection('clients').doc(currentClient.id).update({ checklist, updatedAt: nowTs() });
    toast('Master SOP Checklist saved');
};

// ── 4. DELIVERY ENGINE ────────────────────────────────────────────────────────
function populateDetailDocuments(c) {
    const container = $('docsContainer');
    if (!container) return;
    
    const videoInput = $('doc-video-link');
    if (videoInput) videoInput.value = c.walkthroughUrl || c.deliveryVideoUrl || '';

    container.innerHTML = ''; 
    
    (c.documents || []).forEach(d => {
        const div = document.createElement('div');
        div.className = "doc-row border border-shadow p-4 mb-3 bg-void";
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <span style="color:var(--gold); font-weight:bold; text-transform:uppercase; font-size:11px;">${esc(d.name)}</span>
                <button onclick="this.closest('.doc-row').remove()" style="color:#d47a7a; font-size:10px; text-transform:uppercase; background:none; border:none; cursor:pointer;">Remove</button>
            </div>
            ${d.purpose ? `<div style="font-size:10px; color:var(--marble-dim); margin-bottom:12px;"><strong>Purpose:</strong> ${esc(d.purpose)}</div>` : ''}
            
            <div class="doc-grid">
                <div class="fg" style="margin-bottom:0">
                    <label class="fl">PDF Link</label>
                    <input type="text" class="fi doc-pdf" value="${esc(d.pdfUrl || '')}">
                </div>
                <div class="fg" style="margin-bottom:0">
                    <label class="fl">DOCX Link</label>
                    <input type="text" class="fi doc-docx" value="${esc(d.docxUrl || '')}">
                </div>
            </div>
            <input type="hidden" class="doc-name" value="${esc(d.name)}">
            <input type="hidden" class="doc-purpose" value="${esc(d.purpose || '')}">
            <textarea class="doc-content hidden" style="display:none;">${esc(d.content || '')}</textarea>
        `;
        container.appendChild(div);
    });
}

window.generateELForDelivery = function() {
    if (!currentClient) { toast("No client selected.", "error"); return; }

    const deathChecks = qsa('.death-check');
    if (deathChecks.length > 0) {
        const allPassed = deathChecks.every(box => box.classList.contains('done'));
        if (!allPassed) {
            toast("SOP VIOLATION: Pre-Flight Death Checks incomplete. Cannot generate EL.", "error");
            detailTab('checklist');
            return;
        }
    }

    const scope = PLAN_SCOPES[currentClient.plan] || "AI Advisory Scope.";
    const clientName = currentClient.name || "Client Name";
    const companyName = currentClient.company || "Company Name";
    const planName = planLabel(currentClient.plan);
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const elTemplate = `ENGAGEMENT LETTER (STAGE 2) - FINAL SCOPE & DELIVERY\n\nDATE: ${dateStr}\nCLIENT: ${clientName} (${companyName})\nPLAN: ${planName}\n\n1. SCOPE OF SERVICES\nBased on the intake diagnostics, Lex Nova HQ will deliver the following:\n${scope}\n\n2. DELIVERY TIMELINE\nWork will commence immediately upon execution of this document and will be delivered via the secure client portal.\n\n3. FEES & MAINTENANCE\nMaintenance phase begins upon final delivery of the items scoped above.`;

    const div = document.createElement('div');
    div.className = "doc-row border border-gold/30 p-4 mb-3 bg-[#0a0a0a] relative";
    div.innerHTML = `
        <div style="position:absolute; top:0; left:0; width:3px; height:100%; background:var(--gold);"></div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid rgba(197,160,89,0.3); padding-bottom:8px; padding-left:12px;">
            <input type="text" value="Engagement Letter (Stage 2) - ${planName}" class="doc-name fi" style="background:transparent; border:none; color:var(--gold); font-weight:bold; text-transform:uppercase; font-size:12px; width:70%; padding:0;">
            <span style="font-size:9px; color:var(--gold); text-transform:uppercase; letter-spacing:0.1em; opacity:0.6;">Async Review</span>
        </div>
        <div class="fg" style="padding-left:12px;">
            <label class="fl" style="color:var(--gold);">Draft Review (Edit before publishing)</label>
            <textarea class="doc-content fi" style="height:200px; line-height:1.6; font-size:11px; background:var(--void); border-color:var(--border2); color:var(--marble);">${elTemplate}</textarea>
        </div>
        <div class="doc-grid" style="padding:12px; background:var(--void); border:1px solid var(--border); margin-left:12px;">
            <div class="fg" style="margin-bottom:0"><label class="fl" style="color:var(--gold);">Final PDF URL (Signature Link)</label><input type="text" placeholder="https://..." class="fi doc-pdf" style="border-color:rgba(197,160,89,0.4);"></div>
            <div class="fg" style="margin-bottom:0"><label class="fl">DOCX URL (Optional)</label><input type="text" placeholder="https://..." class="fi doc-docx"></div>
        </div>
    `;
    $('docsContainer').prepend(div);
};

window.addDocRow = function() {
    const div = document.createElement('div');
    div.className = "doc-row border border-shadow p-4 mb-3 bg-[#0a0a0a]";
    div.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid var(--border); padding-bottom:8px;">
            <input type="text" placeholder="DOCUMENT NAME (E.G. AI USAGE POLICY)" class="doc-name fi" style="background:transparent; border:none; color:var(--gold); font-weight:bold; text-transform:uppercase; font-size:12px; width:70%; padding:0;">
            <button onclick="this.closest('.doc-row').remove()" style="color:#d47a7a; font-size:10px; text-transform:uppercase; background:none; border:none; cursor:pointer;">Remove</button>
        </div>
        <div class="fg"><label class="fl">Purpose / Notes</label><input type="text" placeholder="Brief description of this document..." class="fi doc-purpose"></div>
        <div class="doc-grid">
            <div class="fg" style="margin-bottom:0"><label class="fl">PDF Link ↗</label><input type="text" placeholder="https://..." class="fi doc-pdf"></div>
            <div class="fg" style="margin-bottom:0"><label class="fl">DOCX Link ↗</label><input type="text" placeholder="https://..." class="fi doc-docx"></div>
        </div>
    `;
    $('docsContainer').appendChild(div);
};

window.saveDocuments = async function() {
    if (!currentClient) return;

    const deathChecks = qsa('.death-check');
    if (deathChecks.length > 0) {
        const allPassed = deathChecks.every(box => box.classList.contains('done'));
        if (!allPassed) {
            toast("SOP VIOLATION: Cannot deliver while Death Checks are incomplete.", "error");
            return;
        }
    }

    const docs = [];
    qsa('#docsContainer .doc-row').forEach(row => {
        const nameInput = row.querySelector('.doc-name');
        const name = nameInput ? nameInput.value : null; 
        if (name) { 
            docs.push({
                name: name,
                purpose: row.querySelector('.doc-purpose')?.value || '',
                content: row.querySelector('.doc-content')?.value || '',
                pdfUrl: row.querySelector('.doc-pdf')?.value || '',
                docxUrl: row.querySelector('.doc-docx')?.value || '',
                status: 'ready'
            });
        }
    });

    const videoUrl = $('doc-video-link')?.value || '';

    try {
        await db.collection('clients').doc(currentClient.id).update({ 
            documents: docs, 
            walkthroughUrl: videoUrl,
            status: 'delivered', 
            elFullGeneratedAt: nowTs(), 
            deliveredAt: nowTs() 
        });
        toast("Work & Video Delivered.");
        closeDetail();
        loadClients();
    } catch (e) {
        console.error(e);
        toast("Save Failed", "error");
    }
};

// ── RADAR TAB ──────────────────────────────────────────────────────────────
function populateDetailRadar(c) {
    const el = $('dp-radar-list');
    if (!el) return;
    el.innerHTML = '<div class="loading" style="padding:40px; text-align:center; color:var(--marble-faint); font-size:11px; letter-spacing:0.1em;">Radar matching happens in the Client Portal based on Vault Intake parameters.</div>';
}

window.openAddRegulation = function() {
    const html = `
        <div class="fg"><label class="fl">Title</label><input type="text" id="reg-title" class="fi" placeholder="e.g. EU AI Act"></div>
        <div class="fg"><label class="fl">Jurisdictions (comma separated)</label><input type="text" id="reg-jur" class="fi" placeholder="eu, global"></div>
        <div class="fg"><label class="fl">Effective Date</label><input type="date" id="reg-date" class="fi"></div>
        <div class="fg"><label class="fl">Severity</label><select id="reg-sev" class="fi"><option>CRITICAL</option><option>HIGH</option><option>MEDIUM</option><option>LOW</option></select></div>
        <div class="fg"><label class="fl">Summary / Impact</label><textarea id="reg-summary" class="fi"></textarea></div>
    `;
    const footer = `<button class="btn btn-primary" onclick="saveRegulation()">Save Regulation</button>`;
    openModal('Add Regulation', html, footer);
};

window.saveRegulation = async function() {
    const newReg = {
        id: 'reg_' + Date.now(),
        title: $('reg-title').value,
        jurisdiction: $('reg-jur').value.split(',').map(s=>s.trim().toLowerCase()),
        effectiveDate: $('reg-date').value,
        severity: $('reg-sev').value,
        description: $('reg-summary').value,
        addedAt: new Date().toISOString()
    };
    
    radarEntries.push(newReg);
    try {
        await db.collection('settings').doc('regulatory_radar').set({ entries: radarEntries }, { merge: true });
        closeModal();
        toast('Regulation added to Radar');
    } catch (e) { toast('Error saving regulation', 'error'); }
};

// ── GAP REVIEW TAB ─────────────────────────────────────────────────────────
function populateDetailGap(c) {
    const g = c.gapReview || {};
    setVal('dp-gap-status',  g.status || '');
    setVal('dp-gap-scope',   g.scopeSummary || '');
    setVal('dp-gap-invoice', g.invoiceUrl || '');
}

window.saveGap = async function() {
    if (!currentClient) return;
    const gapReview = {
        status: $('dp-gap-status')?.value || '',
        scopeSummary: $('dp-gap-scope')?.value?.trim() || '',
        invoiceUrl: $('dp-gap-invoice')?.value?.trim() || '',
        updatedAt: new Date().toISOString()
    };
    await db.collection('clients').doc(currentClient.id).update({ gapReview });
    toast('Gap Review saved ($497 Flat)');
};

// ── FINANCIALS TAB ─────────────────────────────────────────────────────────
function populateDetailFinancials(c) {
    const price = c.price || PLAN_PRICES[c.plan] || 0;
    setText('dp-price', fmtMoney(price));
    const cb = $('dp-maint'); if (cb) cb.checked = !!c.maintenanceActive;
    const fields = $('dp-maint-fields'); if (fields) fields.style.display = c.maintenanceActive ? 'block' : 'none';
    setVal('dp-maint-id', c.maintenanceSubscriptionId || c.subscriptionId || '');
    setVal('dp-maint-start', c.maintenanceStartDate || '');
}

window.toggleMaint = function(checked) {
    const fields = $('dp-maint-fields');
    if (fields) fields.style.display = checked ? 'block' : 'none';
};

window.saveMaint = async function() {
    if (!currentClient) return;
    await db.collection('clients').doc(currentClient.id).update({
        maintenanceActive: $('dp-maint').checked,
        maintenanceSubscriptionId: $('dp-maint-id').value,
        maintenanceStartDate: $('dp-maint-start').value,
        updatedAt: nowTs()
    });
    toast('Maintenance saved');
};

// ── ACTIVITY TAB ───────────────────────────────────────────────────────────
function populateDetailActivity(c) {
    const el = $('dp-activity-log');
    if (!el) return;
    const log = [...(c.activityLog||[])].sort((a,b) => new Date(b.ts||0).getTime() - new Date(a.ts||0).getTime());
    el.innerHTML = log.length ? log.map(e => `<div class="act-entry"><div class="act-dot"></div><div style="flex:1"><div class="act-note">${esc(e.note||'')}</div><div class="act-ts">${fmtDate(e.ts)} · ${esc(e.by||'admin')}</div></div></div>`).join('') : '<div class="loading">No activity logged yet</div>';
}

window.addActivityNote = async function() {
    if (!currentClient) return;
    const note = $('dp-new-note')?.value?.trim();
    if (!note) { toast('Note is empty', 'error'); return; }
    const entry = { note, ts: new Date().toISOString(), by: auth.currentUser?.email || 'admin' };
    await db.collection('clients').doc(currentClient.id).update({ activityLog: firebase.firestore.FieldValue.arrayUnion(entry) });
    $('dp-new-note').value = '';
    toast('Note added');
    openDetail(currentClient.id); 
};

// ── REFERRALS TAB (THE SYNDICATE) ──────────────────────────────────────────
function populateDetailReferrals(c) {
    const wrap = $('dp-ref-list');
    if (!wrap) return;
    if (!c.referrals || c.referrals.length === 0) {
        wrap.innerHTML = '<div class="loading" style="padding:20px 0;">No network targets registered yet.</div>';
        return;
    }
    
    wrap.innerHTML = c.referrals.map((r, idx) => `
        <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border); padding:16px; display:flex; justify-content:space-between; align-items:center;">
            <div>
                <div style="font-size:14px; color:var(--marble); font-weight:600; margin-bottom:4px;">${esc(r.company)}</div>
                <div style="font-size:11px; color:var(--marble-dim);">Founder: ${esc(r.name)} &bull; Email: ${esc(r.email)} &bull; Submitted: ${r.date}</div>
            </div>
            <div>
                ${r.credited 
                    ? `<span class="badge b-delivered">Reward Credited</span>`
                    : `<button class="btn btn-primary btn-sm" onclick="creditReferral('${esc(c.id)}', ${idx})">Mark Credited</button>`
                }
            </div>
        </div>
    `).join('');
}

window.addReferral = async function() {
    if (!currentClient) return;
    const company = $('dp-ref-co')?.value?.trim();
    const email = $('dp-ref-email')?.value?.trim();
    const date = $('dp-ref-date')?.value;
    if (!company && !email) { toast('Enter company or email', 'error'); return; }
    const entry = { company, email, date, addedAt: new Date().toISOString(), credited: false };
    await db.collection('clients').doc(currentClient.id).update({ referrals: firebase.firestore.FieldValue.arrayUnion(entry) });
    $('dp-ref-co').value = ''; $('dp-ref-email').value = ''; $('dp-ref-date').value = '';
    toast('Referral added');
    openDetail(currentClient.id); 
};

window.creditReferral = async function(clientId, refIdx) {
    if (!confirm('Mark this referral as credited? Ensure you have manually granted their reward (e.g., pushed their maintenance billing date).')) return;
    try {
        const clientRef = db.collection('clients').doc(clientId);
        const doc = await clientRef.get();
        if (!doc.exists) return;
        const data = doc.data();
        data.referrals[refIdx].credited = true;
        await clientRef.update({ referrals: data.referrals });
        
        currentClient.referrals = data.referrals;
        populateDetailReferrals(currentClient);
        toast('Referral reward marked as credited.');
    } catch(err) {
        console.error(err);
        toast('Error crediting referral.', 'error');
    }
};

// ── 10. DEPLOYMENT DEBRIEF (TESTIMONIALS) ─────────────────────────────────────
function populateDetailDebrief(c) {
    const wrap = $('dp-debrief-content');
    if (!wrap) return;
    if (!c.debrief) {
        wrap.innerHTML = '<div class="loading" style="padding:20px 0;">Client has not submitted a deployment debrief yet.</div>';
        return;
    }
    
    const d = c.debrief;
    const consentColor = d.consent ? '#7ab88a' : '#d47a7a';
    const consentText = d.consent ? 'Client authorized public use of this testimonial.' : 'Client DID NOT authorize public use.';
    
    const bText = d.before || '';
    const dText = d.during || '';
    const aText = d.after || '';
    
    wrap.innerHTML = `
        <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border); padding:24px; margin-bottom:16px;">
            <div style="margin-bottom:20px;">
                <div style="font-size:10px; color:var(--gold); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:6px;">1. The Anxiety (Before)</div>
                <div style="font-size:13px; color:var(--marble); line-height:1.6; font-style:italic;">"${esc(bText)}"</div>
            </div>
            <div style="margin-bottom:20px;">
                <div style="font-size:10px; color:var(--gold); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:6px;">2. The Experience (During)</div>
                <div style="font-size:13px; color:var(--marble); line-height:1.6; font-style:italic;">"${esc(dText)}"</div>
            </div>
            <div style="margin-bottom:20px;">
                <div style="font-size:10px; color:var(--gold); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:6px;">3. The Result (After)</div>
                <div style="font-size:13px; color:var(--marble); line-height:1.6; font-style:italic;">"${esc(aText)}"</div>
            </div>
            <div style="padding-top:16px; border-top:1px solid var(--border); display:flex; align-items:center; gap:8px;">
                <div style="width:8px; height:8px; border-radius:50%; background:${consentColor};"></div>
                <div style="font-size:11px; color:var(--marble-dim);">${consentText}</div>
            </div>
        </div>
        
        <div>
            <div style="font-size:10px; color:var(--marble-dim); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:8px;">Generated Landing Page Copy</div>
            <textarea readonly style="width:100%; height:100px; background:var(--void); border:1px solid var(--border); color:var(--marble); padding:16px; font-family:sans-serif; font-size:13px; line-height:1.5; resize:none;">"Before Lex Nova, my biggest concern was ${esc(bText.toLowerCase())}. The experience working with The Architect was ${esc(dText.toLowerCase())}. Now, ${esc(aText.toLowerCase())}."</textarea>
            <p style="font-size:9px; color:var(--marble-dim); margin-top:6px;">Copy and paste this stitched testimonial directly to your landing page.</p>
        </div>
    `;
}
