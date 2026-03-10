// ════════════════════════════════════════════════════════════════════════
// ═════════ LEX NOVA ADMIN LOGIC 1 (v4.0) — THE FACTORY & DASHBOARD ══════
// ════════════════════════════════════════════════════════════════════════
'use strict';

// ════════════════════════════════════════════════════════════════════════
// ═════════ KNOWLEDGE BASE ENGINE (SOP) ══════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
const INFO_DICT = {
    mrr: "<strong>Monthly Recurring Revenue:</strong> Cash generated exclusively from Active Shields ($297/mo). Does not include one-off kit purchases.",
    capacity: "<strong>Production Bandwidth:</strong> The total number of active builds currently in 'The Forge' or 'Pre-Flight'. The hard cap is 50 before a VA must be deployed.",
    gaps: "<strong>Actionable Gaps:</strong> Clients who bought a kit, but whose jurisdictions now have new laws logged in the Regulatory Radar. These are prime targets for a $497 Gap Review.",
    sla: "<strong>SLA Danger Zone:</strong> Delivery builds that have less than 12 hours remaining on the strict 48-hour turnaround clock.",
    
    hunt_status: "<strong>Pipeline Status:</strong><br><br><strong>Cold:</strong> Target identified, no emails sent.<br><strong>Warm:</strong> Emails are actively firing.<br><strong>Replied:</strong> Manual intervention required.<br><strong>Hot:</strong> Severe Legal Gap identified OR Scanner clicked.<br><strong>Converted:</strong> Payment received.",
    scanner_flags: "<strong>The Tripwire System:</strong><br><br>🔥 (One Fire) = The target clicked the link in your cold email.<br>🔥🔥 (Two Fires) = The target completed the audit and saw their risk score.",
    
    magazine: "<strong>The Magazine:</strong> Cold leads. You have audited their legal gaps, drafted a personalized Spear Hook, and they are ready to be loaded into your email sender.",
    downrange: "<strong>Downrange:</strong> Active. Emails are currently firing to these targets. You are waiting for a Tripwire trigger.",
    engaged: "<strong>Engaged:</strong> They hit the Tripwire (🔥) by clicking the link in your email, or they replied. They are now aware of Lex Nova.",
    decision_desk: "<strong>Decision Desk:</strong> Hot leads. They completed the full scanner (🔥🔥) and saw their liability exposure, or you are actively quoting them a Flagship price.",
    
    intake_holding: "<strong>Phase 0 (Gatekeeper):</strong> Payment received, but waiting for the client to complete the secure Intake Vault.",
    the_forge: "<strong>Phase 1 & 2 (Production):</strong> Active legal engineering. Drafting Lane A (Agentic) or Lane B (Workplace) documents.",
    pre_flight: "<strong>Phase 4 (Death Checks):</strong> Mandatory final review. You must physically verify liability caps and disclaimers before generating the final Engagement Letter.",
    
    spear_hook: "<strong>The Spear:</strong> A hyper-personalized, 1-2 sentence hook for cold emails. It must identify exactly what AI they use and state the specific legal vulnerability (e.g. UETA Section 14) they face.",
    death_checks: "<strong>The Death Checks:</strong> Non-negotiable SOP locks. The system will physically prevent you from delivering the portal to the client if these boxes are not checked."
};

window.showInfo = function(key) {
    const text = INFO_DICT[key] || "Definition not found in SOP.";
    if (typeof openModal === 'function') {
        openModal("System Information", `<div style="font-size:13px; line-height:1.6; color:var(--marble);">${text}</div>`);
    } else {
        alert(text.replace(/<[^>]*>?/gm, '')); 
    }
};

// ════════════════════════════════════════════════════════════════════════
// ═════════ CONSTANTS & CONFIG ═══════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
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

// ════════════════════════════════════════════════════════════════════════
// ═════════ STATE & UTILITIES ════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
let allClients = []; let allLeads = []; let currentClient = null; let radarEntries = [];
let clientListener = null;

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

// ════════════════════════════════════════════════════════════════════════
// ═════════ UI: MODALS & GLOBAL LOGIC ════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
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

function init() { nav('dashboard'); }

function nav(tab) {
    qsa('.tab-content').forEach(p => p.classList.remove('active'));
    qsa('.nav-item').forEach(l => l.classList.remove('active'));
    $('tab-' + tab)?.classList.add('active');
    document.querySelector(`.nav-item[data-tab="${tab}"]`)?.classList.add('active');
    
    const subs = { dashboard: 'Command center', factory: 'Production pipeline', hunt: 'Acquisition', syndicate: 'Recurring Engine' };
    const sub = $('pageSub'); if (sub) sub.textContent = subs[tab] || tab;
    
    if (tab === 'dashboard') loadDashboard();
    if (tab === 'factory' || tab === 'clients') loadClients();
    if (tab === 'leads') loadLeads();
    
    if (tab === 'hunt' || tab === 'deals') {
        if (typeof loadOutreach === 'function') loadOutreach();
    }
    
    if (tab === 'syndicate') {
        if (typeof loadRadarCache === 'function') {
            loadRadarCache().then(() => {
                if (typeof renderExposureMatrix === 'function') renderExposureMatrix();
            });
        }
        if (typeof loadFinance === 'function') loadFinance();
    }
    
    if (tab === 'engine') {
        if (typeof loadFinance === 'function') loadFinance();
        if (typeof loadContent === 'function') loadContent();
        if (typeof loadSettings === 'function') loadSettings();
        if (typeof loadRadar === 'function') loadRadar();
    }
}

// ════════════════════════════════════════════════════════════════════════
// ═════════ THE COMMAND CENTER DASHBOARD ═════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
async function loadRadarCache() {
  try {
    const snap = await db.collection('settings').doc('regulatory_radar').get();
    radarEntries = snap.exists ? (snap.data().entries || snap.data().items || []) : [];
  } catch (e) { console.error('Radar cache:', e); }
}

async function loadDashboard() {
    try {
        const cSnap = await db.collection('clients').get();
        const clients = []; cSnap.forEach(d => clients.push({ id: d.id, ...d.data() }));

        const pSnap = await db.collection('prospects').get();
        const prospects = []; pSnap.forEach(d => prospects.push(d.data()));

        const lSnap = await db.collection('leads').where('source', '==', 'scanner').get();
        const leads = []; lSnap.forEach(d => leads.push(d.data()));

        await loadRadarCache();

        const maint = clients.filter(c => c.maintenanceActive);
        const mrr = maint.length * 297;
        setText('d-mrr', fmtMoney(mrr));
        setText('d-mrr-sub', `${maint.length} active maintenance`);

        const inProd = clients.filter(c => ['under_review', 'in_production'].includes(c.status));
        setText('d-cap-current', inProd.length);
        const capBar = $('d-cap-bar'); if (capBar) capBar.style.width = Math.min(100, (inProd.length/50)*100) + '%';
        setText('d-cap-label', `${inProd.length} / 50 slots`);

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

        const slaCrit = clients.filter(c => {
            if (!['intake_received', 'in_production'].includes(c.status)) return false;
            const startTs = c.intakeReceivedAt || c.intakeSentAt || c.productionStartedAt;
            return startTs && hoursSince(startTs) >= 36; 
        });
        setText('d-sla-crit', slaCrit.length);

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

// ════════════════════════════════════════════════════════════════════════
// ═════════ THE FACTORY ENGINE (CLIENTS) ═════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
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
    if (c.status === 'pending_payment' || c.status === 'payment_received') {
      cols[1].push(c); 
    } else if (c.status === 'intake_received' || c.status === 'under_review') {
      cols[2].push(c); 
    } else if (c.status === 'in_production') {
      cols[3].push(c); 
    } else if (c.status === 'delivered') {
      cols[4].push(c); 
    } else {
      cols[1].push(c); 
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
          
          if (c.status === 'delivered') {
              slaText = 'Deployed';
              slaStyle = 'color:var(--green);';
          } else if (startTs) {
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

        if (c.status === 'delivered') {
            slaClock = `<span style="color:var(--green)">Deployed</span>`;
        } else if (startTs && (c.status === 'intake_received' || c.status === 'in_production')) {
            const hRem = 48 - hoursSince(startTs);
            const cls = hRem <= 0 ? 'cd-over' : hRem <= 8 ? 'cd-warn' : 'cd-ok';
            slaClock = `<span class="countdown ${cls}">${hRem > 0 ? hRem + 'h left' : Math.abs(hRem) + 'h OVER'}</span>`;
        }
        
        return `<tr onclick="openDetail('${esc(c.id)}')">
            <td>
              <div style="font-size:11px;font-weight:600;">${esc(c.name||'—')}</div>
              <div style="font-size:9px;color:var(--gold);font-family:'Cormorant Garamond',serif;">${esc(c.engagementRef||'')}</div>
            </td>
            <td class="dim">${esc(c.company||'—')}</td>
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
    const list = allClients.filter(c => !s || (c.name||'').toLowerCase().includes(s) || (c.email||c.id).toLowerCase().includes(s) || (c.company||'').toLowerCase().includes(s) || (c.engagementRef||'').toLowerCase().includes(s));
    renderClientsTable(list);
}

function planBadgeClass(p) { return { agentic_shield:'b-intake', workplace_shield:'b-warm', complete_stack:'b-production', flagship:'b-hot' }[p] || 'b-ghost'; }
function statusBadgeClass(s) { return { pending_payment:'b-pending', payment_received: 'b-delivered', intake_received:'b-intake', under_review:'b-review', in_production:'b-production', delivered:'b-delivered' }[s] || 'b-ghost'; }

// ════════════════════════════════════════════════════════════════════════
// ═════════ THE INBOUND LEAD VIEWER ══════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
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

// ════════════════════════════════════════════════════════════════════════
// ═════════ CLIENT DETAIL PANEL (ROUTER) ═════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
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

// ═════════ TAB 1: OVERVIEW ═════════
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

// ═════════ TAB 2: INTAKE ═════════
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

// ═════════ TAB 3: CHECKLIST ═════════
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
        const iconInfo = isDeathCheck ? `<span class="info-icon" onclick="showInfo('death_checks')">ⓘ</span>` : '';

        html += `<div style="margin-top:16px; margin-bottom:8px; font-size:9px; letter-spacing:0.15em; text-transform:uppercase; color:${catColor}; border-bottom:1px solid ${isDeathCheck ? 'rgba(212,122,122,0.3)' : 'var(--border)'}; padding-bottom:4px;">${category} ${iconInfo}</div>`;
        
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

// ════════════════════════════════════════════════════════════════════════
// ═════════ TAB 4: DELIVERY & SCHEDULE A COMPILER ════════════════════════
// ════════════════════════════════════════════════════════════════════════
function populateDetailDocuments(c) {
    const container = $('docsContainer');
    if (!container) return;
    
    const videoInput = $('doc-video-link');
    if (videoInput) videoInput.value = c.walkthroughUrl || c.deliveryVideoUrl || '';

    // Pre-fill Scope Picker based on Plan
    $('sa-agentic').checked = ['agentic_shield', 'complete_stack', 'flagship'].includes(c.plan);
    $('sa-workplace').checked = ['workplace_shield', 'complete_stack', 'flagship'].includes(c.plan);
    $('sa-hallucination').checked = ['agentic_shield', 'complete_stack', 'flagship'].includes(c.plan);
    $('sa-disgorgement').checked = ['agentic_shield', 'complete_stack', 'flagship'].includes(c.plan);
    $('sa-ip').checked = ['workplace_shield', 'complete_stack', 'flagship'].includes(c.plan);
    
    $('sa-price').value = c.price || PLAN_PRICES[c.plan] || '';

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

    // ── GATHER VARIABLES FOR SCHEDULE A ──
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const engRef = currentClient.engagementRef || `LN-C-26-${Math.floor(Math.random() * 1000)}`;
    const clientCompany = currentClient.company || currentClient.name || "Client Company";
    const clientName = currentClient.name || "Client Contact";
    const clientEmail = currentClient.id || "";
    const planName = planLabel(currentClient.plan);
    
    const price = $('sa-price').value || PLAN_PRICES[currentClient.plan] || "____";
    const discount = $('sa-discount').value || "";
    
    // Logic Mapping based on Plan & Scope Picker
    let tierText = currentClient.plan === 'flagship' ? `Flagship ----------------------------------------------- $${price} USD` : `Kit -------------------------------------------------------- $${price} USD`;
    let laneText = 'Lane A — Builders';
    if ($('sa-workplace').checked && !$('sa-agentic').checked) laneText = 'Lane B — Users';
    if ($('sa-agentic').checked && $('sa-workplace').checked) laneText = 'Lane A & B (Complete Stack)';
    if (currentClient.plan === 'flagship') laneText = 'Lane C — Enterprise (Flagship)';

    let paymentStructure = currentClient.plan === 'flagship' ? "60% Deposit / 40% on Delivery" : "100% Upfront";
    let timeline = currentClient.plan === 'flagship' ? "As agreed in scope" : "48 hours from Intake Form submission";
    let revisions = currentClient.plan === 'flagship' ? "Throughout project duration" : "1 Round";

    // Build Deliverables Table
    let deliverablesList = "1\tDOC_TOS\tTerms of Service\tCore operating terms.\n";
    let index = 2;
    if ($('sa-agentic').checked) { deliverablesList += `${index++}\tDOC_AGT\tAgentic Addendum\tAutonomous action waiver.\n`; }
    if ($('sa-workplace').checked) { deliverablesList += `${index++}\tDOC_SOP\tInternal AI Policy\tEmployee AI usage guidelines.\n`; }
    if ($('sa-hallucination').checked) { deliverablesList += `${index++}\tDOC_WVR\tHallucination Waiver\tLimits liability for AI output errors.\n`; }
    if ($('sa-disgorgement').checked) { deliverablesList += `${index++}\tDOC_DPA\tData Processing\tGuards against algorithmic disgorgement.\n`; }
    if ($('sa-ip').checked) { deliverablesList += `${index++}\tDOC_IP\tIP Deed\tSecures AI-generated outputs.\n`; }

    // ── THE FULL VERBATIM LEGAL TEXT INJECTION ──
    const elTemplate = `LEX NOVA HQ ENGAGEMENT LETTER — LEGAL ARCHITECTURE MANDATE
Date: ${dateStr}
Engagement Reference: ${engRef}

To:
Client Name: ${clientCompany}
Attention: ${clientName}
Address: [CLIENT ADDRESS]
Primary Email: ${clientEmail}

From:
Lex Nova HQ | Shwetabh Singh, Principal Architect
Primary Email: shwetabh.singh@lexnovahq.com

Lex Nova HQ is the trading name of Shwetabh Singh, sole proprietor.
Entity registration (LLC/C-Corp) is pending and will be updated upon completion.
All obligations under this Letter are personally undertaken by the undersigned Principal Architect until such time as a registered entity assumes this agreement.

Dear ${clientName},

Thank you for choosing Lex Nova HQ. This Engagement Letter ("Letter"), together with Schedule A attached hereto, sets out the complete terms under which Lex Nova HQ ("Lex Nova," "we," "us," or "our") will provide services to ${clientCompany} ("Client," "you," or "your").

By signing this Letter, replying to the transmitting email with the words "I accept," or checking the acceptance box on the Configuration Intake Form, you agree to be bound by all terms contained herein.
This Letter is effective as of the date of acceptance ("Effective Date").

1. THE LEGAL ARCHITECTURE MANDATE
Lex Nova HQ is a business consultancy and commercial structure architecture.
We provide legal architecture, commercial structuring, deal architecture, negotiation leverage design, and operational logic.
Lex Nova is NOT a law firm. We do not practice law.
We do not provide legal advice, tax advice, financial advice, or any form of professional advice that requires licensure in any jurisdiction.
Nothing in this Letter, in any communication between the parties, or in any Deliverable produced under this engagement constitutes legal advice or establishes an attorney-client relationship.
We are Legal Architects. We design the structure. We do not stamp the compliance.
The distinction between Legal Architecture and Legal Practice is not a formality — it defines the nature, scope, and limitations of every service we provide.

2. THE REVIEW-READY STANDARD
All documents delivered under this engagement ("Deliverables") are delivered as "Review-Ready Drafts" — meaning they are approximately 95% complete structural architectures designed to bridge the gap between business intent and legal execution.
Deliverables are NOT final legal instruments. They are not ready for execution, filing, or enforcement without independent review by qualified legal counsel admitted to practice in the Client's operating jurisdiction(s).
Client's local counsel bears sole responsibility for: (a) confirming jurisdictional compliance; (b) validating enforceability under applicable local law; (c) making any modifications required by local statutory or regulatory requirements; and (d) approving the Deliverables for execution.
Each Deliverable is accompanied by Architect Notes addressed to the Client's local counsel or reviewing party, explaining the structural logic, clause rationale, and risk architecture.
These notes are for informational purposes only and do not constitute legal guidance.
Each Kit and Bundle engagement includes a video walkthrough (delivered via Clipchamp or equivalent) explaining the architecture and key clauses in plain language.

3. CLIENT REPRESENTATIONS
By entering into this engagement, Client represents and warrants that:
Client is a duly organized business entity (corporation, limited liability company, partnership, or sole proprietorship operating in a commercial capacity) and is not engaging Lex Nova as a consumer or for personal, family, or household purposes.
The individual signing or accepting this Letter has full authority to bind Client to its terms.
Client will use the Deliverables exclusively for Client's own internal business purposes and not for resale, redistribution, sublicensing, or provision to third parties.
Client understands and accepts that Lex Nova is not a law firm and that the Deliverables require independent legal review before use.

4. SCOPE OF ENGAGEMENT
The specific scope of this engagement — including the engagement tier, service pillar, lane, product name, deliverables, fee, payment structure, delivery timeline, and included revision rounds — is set out in Schedule A attached to this Letter.
Schedule A is incorporated into this Letter by reference and forms part of this agreement.
Lex Nova's obligations under this engagement are strictly limited to what is described in Schedule A. Any services, documents, analyses, calls, negotiations, or other work not explicitly listed in Schedule A are outside the scope of this engagement.

5. CHANGE ORDERS
Any request for work outside the scope defined in Schedule A requires a written Change Order signed by both parties before work begins.
Change Orders are priced at $250 USD per hour, or scoped as a new Kit, Bundle, or Flagship engagement at the applicable rate.
Requests made verbally, via email, via Slack, or through any informal channel do not constitute valid Change Orders and will not be acted upon without a signed written Change Order.
For clarity: "Just one more clause" is not included in the original scope unless Schedule A explicitly says otherwise.

6. REVISION ROUNDS
The number of revision rounds included in this engagement is specified in Schedule A.
A "revision" is defined as a modification to existing content within the Deliverables that does not alter the fundamental scope, structure, or purpose of the engagement.
Examples include: correcting typographical errors, adjusting defined terms, changing specific numerical parameters (e.g., adjusting a spend cap from $50 to $100), or modifying party names and details.
A request that requires rewriting a clause, adding a new clause not contemplated in the original scope, restructuring a document, or addressing a new legal issue is NOT a revision — it is a scope change and requires a Change Order under Section 5.
Revision requests must be submitted in writing (email) within 14 calendar days of delivery.
Revision requests received after this period will be treated as Change Orders.
Typographical errors attributable to Lex Nova (e.g., misspelling the Client's name) will be corrected immediately at no charge and do not count toward the included revision rounds.

7. DELIVERY
Lex Nova will use commercially reasonable efforts to deliver the Deliverables within the timeline specified in Schedule A, measured from the date the Client submits a complete Configuration Intake Form ("Tally Form").
Delivery timelines are targets and not guaranteed commitments. Lex Nova shall not be liable for delays in delivery provided it is exercising commercially reasonable efforts to meet the stated timeline.
Delivery is made exclusively via the Client's dedicated Notion portal (the "Deal Room").
Client will receive an email notification with the Deal Room access link upon delivery.
Deliverables are provided in PDF format (the "Reference Copy") and editable document format (the "Working Copy") for use by Client's local counsel.
Deliverables are deemed delivered when made available in the Deal Room.

8. CLIENT COOPERATION
Client is responsible for providing accurate, complete, and timely information via the Configuration Intake Form and any subsequent communications.
Lex Nova relies on Client-provided information to architect the Deliverables.
Delays, errors, omissions, or deficiencies in the Deliverables resulting from incomplete, inaccurate, or untimely Client inputs are not the responsibility of Lex Nova and do not constitute a breach of warranty or grounds for a refund.
If Lex Nova determines that Client-provided information is materially insufficient to produce Deliverables of acceptable quality, Lex Nova will notify Client and request clarification.
The delivery timeline will be extended by the number of days between the clarification request and Client's satisfactory response.

9. PAYMENT
All fees are stated in United States Dollars (USD). All payments must be made in USD.
Payment terms are as specified in Schedule A and are governed by the following rules:
Kit and Bundle engagements: 100% of the fee is due and payable before any work begins.
Work commences only upon receipt of cleared funds.
Flagship engagements: 60% of the fee is due before work begins ("Deposit").
The remaining 40% ("Balance") is due upon delivery of the Deliverables. The Deposit is non-refundable once paid.
Maintenance Subscriptions: Billed monthly in advance. The minimum subscription commitment is three (3) months.
After the initial three-month period, the subscription continues on a month-to-month basis and may be cancelled by either party with 30 calendar days' written notice.
Payment is accepted via wire transfer (Wise), PayPal Business, or such other methods as Lex Nova may specify on the invoice.
All fees are exclusive of any taxes, duties, or governmental charges.
Client is responsible for all such charges applicable in Client's jurisdiction.
All fees stated in Schedule A are gross amounts. If Client is required by law, regulation, or tax authority to withhold or deduct any taxes, duties, or levies from payments due to Lex Nova, Client shall gross up the payment amount so that Lex Nova receives the full fee as stated in Schedule A after any such withholding or deduction.
Client is solely responsible for determining and complying with any tax withholding obligations applicable in Client's jurisdiction.
Lex Nova will provide reasonable tax documentation (including IRS Form W-8BEN or equivalent) upon request.

10. THE 14-DAY INTAKE DEADLINE
Client must submit the Configuration Intake Form within fourteen (14) calendar days of payment ("Intake Deadline").
If the Configuration Intake Form is not submitted by the Intake Deadline, the engagement is deemed cancelled by Client.
Upon cancellation under this Section, Lex Nova will issue a refund of the fee paid minus a 15% administrative fee, which compensates Lex Nova for the engagement slot held and administrative processing.
Lex Nova will send a reminder to Client's primary email address at least three (3) calendar days before the Intake Deadline expires.

11. REFUND POLICY
Cancellation before payment: No engagement exists. Nothing is owed by either party.
Cancellation after payment but before Intake Form submission: Subject to Section 10 (the 14-Day Intake Deadline and 15% administrative fee).
Cancellation after Intake Form submission: No refunds. The Intake Form submission is the point of no return.
Upon submission, Lex Nova begins architectural work, allocates capacity, and reserves delivery resources.
No refunds will be issued for any reason after the Intake Form is submitted.
Cancellation of a Flagship engagement after the Deposit is paid: The Deposit is non-refundable.
If Client cancels before the Balance is due, Client owes nothing further.
Work in progress will be delivered in its then-current state with no obligation on Lex Nova to complete.
Maintenance Subscriptions: No refunds for any month in which the subscription was active, including partial months.
The minimum three-month commitment is non-refundable once the first monthly payment is made.

12. LATE PAYMENT
Payments not received within 7 calendar days of the due date are considered late.
Late payments accrue interest at the rate of 1.5% per month (or the maximum rate permitted by applicable law, whichever is lower), calculated from the original due date.
If any payment remains outstanding for more than 15 calendar days after the due date, Lex Nova may, at its sole discretion: (a) suspend all work under the engagement until payment is received;
(b) revoke Client's access to the Notion Deal Room portal; and (c) withhold delivery of any completed or in-progress Deliverables.
If payment remains outstanding for more than 30 calendar days after the due date, Lex Nova may terminate the engagement immediately upon written notice.
All fees owed remain due and payable notwithstanding termination.

13. INTELLECTUAL PROPERTY
Background IP. Lex Nova retains all right, title, and interest in and to its templates, clause libraries, structural frameworks, methodologies, processes, tools, know-how, and any other pre-existing intellectual property ("Background IP").
Nothing in this Letter transfers ownership of Background IP to Client.
License to Client. Subject to full payment of all fees, Lex Nova grants Client a non-exclusive, non-transferable, non-sublicensable, perpetual license to use the Deliverables solely for Client's own internal business purposes.
This license does not extend to the underlying Background IP except to the extent necessary to use the Deliverables as delivered.
Permitted Deployment. Client may deploy the Deliverables for their intended operational purpose, including but not limited to: publishing terms of service, privacy policies, and acceptable use policies on Client's website or application;
distributing employee handbooks, internal policies, and workplace guidelines to Client's personnel;
presenting contractual documents to Client's counterparties, investors, and business partners in the ordinary course of business;
and filing or submitting Deliverables to regulatory bodies as required.
Prohibited Redistribution. Client shall not reproduce, distribute, resell, sublicense, or otherwise make the Deliverables or any derivative works available to any third party for the purpose of reuse as a template, framework, or structural model.
The Deliverables are licensed for Client's own operational use, not for redistribution as legal architecture to other businesses.
Any such unauthorized redistribution constitutes a material breach of this Letter.
Structural Markers. Client acknowledges that the Deliverables contain proprietary structural markers, metadata, and architectural fingerprints that enable identification of their origin.
Client shall not remove, alter, or obscure any such markers, whether embedded in document metadata, formatting conventions, or clause structures.
Feedback Assignment. Any feedback, suggestions, ideas, enhancement requests, or other input provided by Client regarding the Deliverables, Lex Nova's services, or Lex Nova's templates and methodologies ("Feedback") shall become the sole property of Lex Nova.
Client irrevocably assigns to Lex Nova all right, title, and interest in such Feedback without obligation, compensation, or attribution.
No Implied Rights. Except for the express license granted in Section 13.2, no rights in any intellectual property are transferred or implied under this Letter.

14. CONFIDENTIALITY
"Confidential Information" means any non-public information disclosed by one party ("Disclosing Party") to the other party ("Receiving Party") in connection with this engagement, including but not limited to: business plans, financial data, client lists, technical specifications, product roadmaps, intake form responses, and the terms of this Letter.
The Receiving Party shall: (a) hold Confidential Information in strict confidence;
(b) not disclose it to any third party without the Disclosing Party's prior written consent;
and (c) use it only for the purposes of this engagement.
Confidential Information does not include information that: (a) is or becomes publicly available without breach of this Letter;
(b) was known to the Receiving Party prior to disclosure;
(c) is independently developed without reference to the Disclosing Party's information;
or (d) is required to be disclosed by law, regulation, or court order, provided the Receiving Party gives prompt written notice where legally permitted.
For clarity: Lex Nova's templates, clause libraries, structural frameworks, and Background IP constitute Lex Nova's Confidential Information.
Client's intake form responses, business data, and operational details constitute Client's Confidential Information.
This Section survives termination or expiration of this Letter for a period of three (3) years.

15. LIABILITY
Liability Cap. Lex Nova's total aggregate liability under this engagement — whether in contract, tort, negligence, strict liability, or otherwise — shall not exceed the total fees actually paid by Client under this specific engagement (as defined in Schedule A).
For Maintenance Subscriptions, liability shall not exceed the total fees paid in the twelve (12) months preceding the event giving rise to the claim.
EXCLUSION OF DAMAGES. IN NO EVENT SHALL LEX NOVA BE LIABLE FOR ANY INDIRECT, INCIDENTAL, CONSEQUENTIAL, SPECIAL, PUNITIVE, OR EXEMPLARY DAMAGES, INCLUDING BUT NOT LIMITED TO: LOSS OF PROFITS, LOSS OF REVENUE, LOSS OF BUSINESS, LOSS OF DATA, WASTED EXPENDITURE, COST OF SUBSTITUTE SERVICES, REGULATORY FINES, OR REPUTATIONAL HARM — HOWEVER CAUSED AND REGARDLESS OF THE THEORY OF LIABILITY, EVEN IF LEX NOVA HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
The limitations in this Section apply to the fullest extent permitted by applicable law and survive termination or expiration of this Letter.

16. WARRANTY
Lex Nova warrants that:
The Deliverables will be prepared with reasonable professional skill and care consistent with industry standards for commercial structuring services.
The Deliverables will substantially conform to the scope described in Schedule A.
The Deliverables will incorporate the specific clauses and structural elements identified through the Client's Configuration Intake Form responses, as applicable.
EXCEPT AS EXPRESSLY SET FORTH IN SECTION 16.1, LEX NOVA MAKES NO WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE.
LEX NOVA SPECIFICALLY DISCLAIMS ALL IMPLIED WARRANTIES, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
WITHOUT LIMITING THE FOREGOING, LEX NOVA DOES NOT WARRANT THAT:
THE DELIVERABLES WILL BE LEGALLY ENFORCEABLE IN ANY JURISDICTION;
THE DELIVERABLES WILL COMPLY WITH ANY SPECIFIC LAW, REGULATION, OR LEGAL STANDARD;
THE DELIVERABLES WILL PREVENT ANY CLAIM, LAWSUIT, REGULATORY ACTION, FINE, OR LIABILITY;
THE DELIVERABLES WILL ACHIEVE ANY SPECIFIC BUSINESS OUTCOME; OR
ANY THIRD PARTY, INCLUDING OPPOSING COUNSEL, REGULATORS, COURTS, OR THE CLIENT'S OWN EMPLOYEES, WILL RESPOND TO OR INTERPRET THE DELIVERABLES IN ANY PARTICULAR MANNER.
Warranty Cure. If the Deliverables fail to conform to the warranties in Section 16.1, Client must notify Lex Nova in writing within fourteen (14) calendar days of delivery, specifying the non-conformity in reasonable detail.
Lex Nova will, at its sole discretion, re-deliver a corrected version within a commercially reasonable timeframe.
This re-delivery is Client's sole and exclusive remedy for any warranty claim.
Warranty claims not raised within the 14-day notification period are deemed waived.

17. CLIENT INDEMNIFICATION
Client shall indemnify, defend, and hold harmless Lex Nova, its principal, agents, and affiliates from and against any and all claims, damages, losses, liabilities, costs, and expenses (including reasonable attorneys' fees) arising from or related to:
Client's modification of the Deliverables after delivery;
Client's use of the Deliverables without obtaining independent review by qualified local counsel;
Client's deployment or execution of the Deliverables as final legal instruments without the modifications recommended by local counsel;
Any inaccurate or incomplete information provided by Client through the Configuration Intake Form or other communications;
Client's breach of any representation, warranty, or obligation under this Letter.
This Section survives termination or expiration of this Letter indefinitely.

18. TERMINATION
Kit and Bundle Engagements. These engagements terminate naturally upon delivery of the Deliverables and completion of included revision rounds (or expiration of the 14-day revision request window, whichever occurs first).
Flagship Engagements. Either party may terminate a Flagship engagement for material breach by the other party, provided the terminating party: (a) delivers written notice specifying the breach in reasonable detail;
and (b) the breaching party fails to cure the breach within ten (10) business days of receiving such notice.
Flagship — Termination by Lex Nova for Cause. If Client fails to cooperate as required by Section 8, fails to make a payment when due, or otherwise materially breaches this Letter, Lex Nova may terminate the Flagship engagement after following the notice and cure procedure in Section 18.2.
Upon such termination, all fees paid are retained by Lex Nova and any Balance outstanding becomes immediately due.
Flagship — Termination by Client for Cause. If Lex Nova materially breaches this Letter and fails to cure within the notice period, Client may terminate.
Upon such termination, Lex Nova will issue a pro-rata refund of unearned fees (calculated based on the proportion of Deliverables not yet delivered), less a reasonable amount for work in progress.
Maintenance Subscriptions. Subject to the three (3) month minimum commitment, either party may terminate a Maintenance Subscription with thirty (30) calendar days' written notice.
No refunds are issued for months already paid.
Maintenance — Updated Terms. Lex Nova may update the terms of this Letter from time to time.
Updated terms will be provided to Client via email at least thirty (30) days before taking effect.
Continued payment of the Maintenance Subscription after the effective date constitutes acceptance of the updated terms.
If Client does not agree to the updated terms, Client may terminate the Maintenance Subscription in accordance with Section 18.5.

19. FORCE MAJEURE
Neither party shall be liable for any delay or failure to perform its obligations under this Letter if such delay or failure results from circumstances beyond the party's reasonable control, including but not limited to: acts of God, natural disasters, pandemics, government actions, internet outages, infrastructure failures, cyberattacks, or changes in law or regulation that materially affect the engagement.
The affected party shall notify the other party in writing as soon as reasonably practicable and shall use commercially reasonable efforts to mitigate the impact and resume performance.
If a Force Majeure event continues for more than thirty (30) calendar days, either party may terminate the engagement upon written notice.
In such event, Lex Nova will refund any fees paid for Deliverables not yet delivered.

20. DISPUTE RESOLUTION
Informal Resolution. The parties shall first attempt to resolve any dispute arising under or in connection with this Letter through good faith negotiation.
The complaining party shall send a written Dispute Notice to the other party's primary email address.
The parties shall have thirty (30) calendar days from the date of the Dispute Notice to reach an informal resolution.
Kit and Bundle Disputes (Total Engagement Fee Under $5,000 USD).
If informal resolution fails, disputes shall be submitted to binding arbitration administered by the American Arbitration Association ("AAA") under its Expedited Procedures.
The arbitration shall be conducted entirely through written submissions (no oral hearing) unless the arbitrator determines that an oral hearing is necessary.
The prevailing party shall be entitled to recover its reasonable arbitration costs and fees from the non-prevailing party.
Flagship and Maintenance Disputes (Total Engagement Fee $5,000 USD or Above).
If informal resolution fails, disputes shall be submitted to binding arbitration administered by the American Arbitration Association ("AAA") under its Commercial Arbitration Rules.
The arbitration shall be conducted via video conference. The arbitration shall be conducted by a single arbitrator.
Small Claims Carve-Out. Notwithstanding the above, either party may bring an action in any small claims court of competent jurisdiction for claims within such court's jurisdictional limits, provided the action is brought on an individual basis and not as part of a class action.
Equitable Relief Carve-Out. Nothing in this Section prevents either party from seeking injunctive or equitable relief in a court of competent jurisdiction to protect its intellectual property rights or Confidential Information.
The place of arbitration shall be Wilmington, Delaware, USA. The language of arbitration shall be English.

21. GOVERNING LAW
This Letter and any disputes arising out of or in connection with it shall be governed by and construed in accordance with the laws of the State of Delaware, United States of America, without regard to its conflict of laws principles.

22. LOGO AND TESTIMONIAL RIGHTS
Standard Engagements. Lex Nova may reference Client's company name and the general nature of the engagement (e.g., "AI Governance architecture for a SaaS startup") in its marketing materials, website, case studies, and proposals to prospective clients.
Lex Nova will not disclose Confidential Information in such references.
Client may opt out of this right by providing written notice at any time.
First Clients Protocol. Where Schedule A indicates that the engagement is subject to the First Clients Protocol, Client has agreed to provide, in exchange for the discounted fee: (a) a written testimonial within 30 days of delivery;
(b) permission to use Client's company logo on Lex Nova's website and marketing materials;
and (c) willingness to be referenced as a case study, subject to Client's reasonable approval of the case study content before publication.

23. NOTICES
All formal notices under this Letter (including Dispute Notices, termination notices, breach notices, and Change Order requests) shall be sent via email to the primary email address specified at the top of this Letter.
Notices are deemed received forty-eight (48) hours after sending, regardless of whether actually read, provided they are sent to the correct email address.
For Critical Notices — defined as notices of termination, breach, or dispute — if the sending party receives no acknowledgment within five (5) business days, the sending party shall make one additional reasonable attempt to contact the other party via the secondary email address or another available channel (e.g., LinkedIn, phone).
Each party is responsible for maintaining accurate email addresses and promptly notifying the other party of any changes.

24. ASSIGNMENT
Client may not assign, transfer, or delegate this Letter or any rights or obligations hereunder without the prior written consent of Lex Nova.
Lex Nova may assign this Letter to any successor entity, affiliate, or acquirer without Client's consent, provided the assignee assumes all obligations under this Letter.

25. ENTIRE AGREEMENT
This Letter, together with Schedule A, constitutes the entire agreement between the parties with respect to the subject matter hereof and supersedes all prior or contemporaneous negotiations, discussions, representations, proposals, and agreements, whether written or oral.
No amendment or modification to this Letter shall be effective unless made in writing and signed by both parties.
No verbal or informal commitment made during any sales call, email exchange, or other communication shall be binding unless incorporated into this Letter or a signed Change Order.

26. SEVERABILITY
If any provision of this Letter is held to be invalid, illegal, or unenforceable by a court or arbitrator of competent jurisdiction, such provision shall be modified to the minimum extent necessary to make it valid and enforceable, or if modification is not possible, severed from this Letter.
The remaining provisions shall continue in full force and effect.

27. NO WAIVER
The failure of either party to enforce any right or provision of this Letter shall not constitute a waiver of such right or provision.
Any waiver must be in writing and signed by the waiving party.
A waiver of any right on one occasion shall not be deemed a waiver of the same or any other right on any subsequent occasion.

28. SURVIVAL
The following Sections survive termination or expiration of this Letter for the period indicated:
Section 1 (Legal Architecture Mandate) — Indefinitely.
Section 2 (Review-Ready Standard) — Indefinitely.
Section 3 (Client Representations) — Indefinitely.
Section 13 (Intellectual Property) — Indefinitely.
Section 14 (Confidentiality) — Three (3) years post-termination.
Section 15 (Liability) — Indefinitely.
Section 16 (Warranty, including Disclaimer) — Indefinitely.
Section 17 (Client Indemnification) — Indefinitely.
Section 20 (Dispute Resolution) — Indefinitely.
Section 21 (Governing Law) — Indefinitely.
Section 24 (Assignment) — Indefinitely.
Section 26 (Severability) — Indefinitely.
Section 27 (No Waiver) — Indefinitely.
Any payment obligations outstanding at termination — Until fulfilled.

29. ELECTRONIC SIGNATURES
This Letter may be accepted and executed by electronic means, including: (a) email reply to the transmitting email containing the words "I accept" or substantially similar language indicating agreement;
(b) checking the acceptance checkbox on the Configuration Intake Form (Tally Form) that incorporates this Letter by reference;
or (c) electronic signature via a digital signature platform.
Electronic acceptance constitutes a valid and binding signature for all purposes under applicable law, including the United States Electronic Signatures in Global and National Commerce Act (E-SIGN), the Uniform Electronic Transactions Act (UETA), the EU Electronic Identification and Trust Services Regulation (eIDAS), and the Information Technology Act, 2000 (India), Sections 5 and 10A, as applicable.

30. ACCEPTANCE AND SIGNATURE
By signing or accepting below, the parties agree to all terms and conditions contained in this Engagement Letter and the attached Schedule A.

For LexNova: 
___________________________

For Client:
___________________________
This Letter may also be accepted by replying to the transmitting email with "I accept" or by checking the acceptance box on the Configuration Intake Form.
See Section 29.

════════════════════════════════════════════════════════════════
SCHEDULE A — ENGAGEMENT SCOPE
════════════════════════════════════════════════════════════════

Engagement Reference:  ${engRef}
Client Name:  ${clientCompany}
Effective Date:  ${dateStr}

ENGAGEMENT DETAILS
Engagement Tier: ${tierText}
Vertical: Lex Nova (Legal Architecture)
Pillar: AI Governance
Lane: ${laneText}

DELIVERABLES
Product Name: ${planName}

File ID       Document Name           Description
${deliverablesList}

COMMERCIAL TERMS
Total Fee: $${price} USD
Payment Structure: ${paymentStructure}
Delivery Timeline: ${timeline}
Revision Rounds Included: ${revisions}

FIRST CLIENTS PROTOCOL
Applicable?: ${discount ? 'Yes' : 'No'}
Discount Applied: ${discount || 'None'}
Obligations:
- Written testimonial within 30 days of delivery
- Logo usage permission for Lex Nova marketing
- Case study participation (subject to Client approval)

ADDITIONAL NOTES
This Schedule A is incorporated into and forms part of the Engagement Letter dated ${dateStr} between Lex Nova HQ and ${clientCompany}.

Acknowledged by Client: ___________________________ Date: _________________

[END OF DOCUMENT]`;

    const div = document.createElement('div');
    div.className = "doc-row border border-gold/30 p-4 mb-3 bg-[#0a0a0a] relative";
    div.innerHTML = `
        <div style="position:absolute; top:0; left:0; width:3px; height:100%; background:var(--gold);"></div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid rgba(197,160,89,0.3); padding-bottom:8px; padding-left:12px;">
            <input type="text" value="Engagement Letter (Stage 2) - ${planName}" class="doc-name fi" style="background:transparent; border:none; color:var(--gold); font-weight:bold; text-transform:uppercase; font-size:12px; width:70%; padding:0;">
            <span style="font-size:9px; color:var(--gold); text-transform:uppercase; letter-spacing:0.1em; opacity:0.6;">Automated Review</span>
        </div>
        <div class="fg" style="padding-left:12px;">
            <label class="fl" style="color:var(--gold);">Draft Review (Copy to PDF or Signature Platform)</label>
            <textarea class="doc-content fi" style="height:300px; line-height:1.6; font-size:11px; background:var(--void); border-color:var(--border2); color:var(--marble); font-family:monospace; white-space:pre-wrap;">${elTemplate}</textarea>
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

// ════════════════════════════════════════════════════════════════════════
// ═════════ TAB 5: RADAR & EXPOSURE MATRIX ═══════════════════════════════
// ════════════════════════════════════════════════════════════════════════
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

// ════════════════════════════════════════════════════════════════════════
// ═════════ TAB 6: GAP REVIEW ($497 UPSELLS) ═════════════════════════════
// ════════════════════════════════════════════════════════════════════════
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

// ════════════════════════════════════════════════════════════════════════
// ═════════ TAB 7: FINANCIALS & MAINTENANCE ══════════════════════════════
// ════════════════════════════════════════════════════════════════════════
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

// ════════════════════════════════════════════════════════════════════════
// ═════════ TAB 8: ACTIVITY LOG ══════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
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

// ════════════════════════════════════════════════════════════════════════
// ═════════ TAB 9: THE SYNDICATE (REFERRALS) ═════════════════════════════
// ════════════════════════════════════════════════════════════════════════
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

// ════════════════════════════════════════════════════════════════════════
// ═════════ TAB 10: DEPLOYMENT DEBRIEF ═══════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
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
