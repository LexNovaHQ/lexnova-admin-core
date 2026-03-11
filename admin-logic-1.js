// ════════════════════════════════════════════════════════════════════════
// ═════════ LEX NOVA ADMIN LOGIC 1 (v5.0) — THE FACTORY & DASHBOARD ══════
// ════════════════════════════════════════════════════════════════════════
'use strict';

// ════════════════════════════════════════════════════════════════════════
// ═════════ KNOWLEDGE BASE ENGINE (V3 ALIGNED) ═══════════════════════════
// ════════════════════════════════════════════════════════════════════════
const INFO_DICT = {
    mrr: "<strong>Monthly Recurring Revenue:</strong> Cash generated exclusively from Active Shields ($297/mo). Does not include one-off kit purchases.",
    capacity: "<strong>Production Bandwidth:</strong> The total number of active builds currently in 'The Forge' or 'Pre-Flight'. The hard cap is 50 before a VA must be deployed.",
    gaps: "<strong>Actionable Gaps:</strong> Clients who bought a kit, but whose jurisdictions now have new laws logged in the Regulatory Radar. These are prime targets for a $497 Gap Review.",
    sla: "<strong>SLA Danger Zone:</strong> Delivery builds that have less than 12 hours remaining on the strict 48-hour turnaround clock.",
    
    hunt_status: "<strong>V3 Pipeline Status:</strong><br><br><strong>Cold:</strong> Target identified, no emails sent.<br><strong>Warm:</strong> Emails actively firing.<br><strong>Replied:</strong> Manual intervention required.<br><strong>Hot/Engaged:</strong> NUCLEAR gap identified or Scanner clicked.<br><strong>Negotiating:</strong> Manual pricing or high-ticket follow-up.<br><strong>Converted:</strong> Payment received.",
    scanner_flags: "<strong>The Tripwire System:</strong><br><br>🔥 (One Fire) = The target clicked the link in your cold email.<br>🔥🔥 (Two Fires) = The target completed the V3 Matrix scan and saw their financial exposure.",
    
    magazine: "<strong>The Magazine:</strong> Cold leads. You have audited their legal gaps, classified their INT-10 Category, and drafted a personalized Spear.",
    downrange: "<strong>Downrange:</strong> Active deployment. Waiting for a माइक्रो-reply or a scanner click.",
    engaged: "<strong>Engaged:</strong> They hit the Tripwire (🔥) or replied. They are now aware of Lex Nova and are being moved toward the scanner.",
    decision_desk: "<strong>Decision Desk:</strong> Bleeding leads. They completed the scanner (🔥🔥) and saw their liability, or you are in active price negotiation.",
    
    intake_holding: "<strong>Phase 0 (Gatekeeper):</strong> Payment received, but waiting for the client to submit the secure Intake Vault.",
    the_forge: "<strong>Phase 1 & 2 (Production):</strong> Active legal engineering. Drafting Lane A (Agentic) or Lane B (Workplace) documents based on INT-10 Category.",
    pre_flight: "<strong>Phase 4 (Death Checks):</strong> Mandatory final review. You must physically verify liability caps match the V3 Matrix pain points.",
    
    spear_hook: "<strong>The Spear:</strong> A hyper-personalized dynamic email. It must mention their specific Product Signal and the 'Kill Shot' gap identified by the matrix.",
    death_checks: "<strong>The Death Checks:</strong> Non-negotiable SOP locks. The system will physically prevent delivery if V3-specific risks are not checked."
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
    "Phase 1: Lane A Production": ['V3 Matrix Categories aligned', 'DOC_TOS drafted', 'DOC_AGT drafted', 'DOC_AUP drafted', 'DOC_SLA drafted', 'DOC_DPA drafted', 'DOC_PP drafted', 'DOC_PBK_A drafted'],
    "Pre-Flight (The Death Checks)": ['Liability: Hallucination waiver prominent', 'Money: Agentic spend cap set in Schedule C', 'Data: Correct DPA attached', 'Shield: AS-IS disclaimer in ALL CAPS', 'Identity: Client name spelled correctly'],
    "Phase 4/5: Delivery Prep": ['Full EL (Stage 2) generated', 'PDFs uploaded to OneDrive', 'DOCX uploaded to OneDrive', 'Walkthrough video recorded and linked']
  },
  workplace_shield: {
    "Phase 0: The Gatekeeper": ['Payment received and confirmed', 'EL (Stage 1) accepted', 'Intake vault reviewed', 'Engagement Ref generated'],
    "Phase 2: Lane B Production": ['V3 Matrix Categories aligned', 'DOC_SCAN drafted', 'DOC_HND drafted', 'DOC_IP drafted', 'DOC_SOP drafted', 'DOC_DPIA drafted', 'DOC_PBK_B drafted'],
    "Pre-Flight (The Death Checks)": ['Policy: Traffic light matches SCAN and HND', 'Ownership: IP Deed ready for execution', 'Evidence: HITL examples match industry', 'Compliance: DPIA timeline dates current', 'Identity: Client name spelled correctly'],
    "Phase 4/5: Delivery Prep": ['Full EL (Stage 2) generated', 'PDFs uploaded to OneDrive', 'DOCX uploaded to OneDrive', 'Walkthrough video recorded and linked']
  },
  complete_stack: {
    "Phase 0: The Gatekeeper": ['Payment received and confirmed', 'EL (Stage 1) accepted', 'Intake vault reviewed', 'Engagement Ref generated'],
    "Phase 1: Lane A Production": ['DOC_TOS drafted', 'DOC_AGT drafted', 'DOC_AUP drafted', 'DOC_SLA drafted', 'DOC_DPA drafted', 'DOC_PP drafted', 'DOC_PBK_A drafted'],
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
// ═════════ THE COMMAND CENTER DASHBOARD (V3 ALIGNMENT) ══════════════════
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

        // V3 Aligned Pipeline Status Counts
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
// ═════════ CLIENT DETAIL PANEL (FULL PAGE TAKEOVER V5) ══════════════════
// ════════════════════════════════════════════════════════════════════════
async function openDetail(email) {
    const dp = $('detailPanel');
    if (dp) {
        dp.style.maxWidth = '100%';
        dp.style.width = '100%';
        dp.style.left = '0';
        dp.classList.add('open');
    }

    await loadRadarCache();
    const doc = await db.collection('clients').doc(email).get();
    currentClient = { id: doc.id, ...doc.data() };
    
    setText('dp-name', currentClient.name || currentClient.id);
    setText('dp-email', `${currentClient.id} · Ref: ${currentClient.engagementRef || '—'}`);
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

// ═════════ TAB 1: OVERVIEW (THE V3 WAR ROOM) ═════════
function populateDetailOverview(c) {
    const isAccepted = !!c.elAccepted;
    const elStatus = $('dp-el-status');
    if (elStatus) { 
        elStatus.textContent = isAccepted ? '✓ Accepted' : 'Not Accepted'; 
        elStatus.className = isAccepted ? 'el-status-ok' : 'el-status-miss'; 
    }
    
    // Matrix Intelligence Block (V3 Archetype Alignment)
    let gapsHtml = '';
    if (c.detectedGaps && c.detectedGaps.length > 0) {
        const sevWeight = { 'NUCLEAR': 3, 'CRITICAL': 2, 'HIGH': 1, 'MEDIUM': 0 };
        const sortedGaps = [...c.detectedGaps].sort((a,b) => (sevWeight[b.severity]||0) - (sevWeight[a.severity]||0));
        const killShot = sortedGaps[0];
        const isNuclear = killShot.severity === 'NUCLEAR';
        const ksColor = isNuclear ? '#ef4444' : '#f97316';
        
        gapsHtml += `
            <div style="border: 1px solid ${ksColor}; background: ${isNuclear ? 'rgba(239,68,68,0.05)' : 'rgba(249,115,22,0.05)'}; padding: 14px; border-radius: 6px; margin-bottom: 14px;">
                <div style="color:${ksColor}; font-size:9px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; margin-bottom:6px;">🎯 Original V3 Kill Shot (${killShot.severity})</div>
                <div style="font-size:13px; font-weight:700; color:var(--marble); margin-bottom:8px;">${esc(killShot.gapName)}</div>
                <div style="font-size:10px; color:var(--marble-dim);"><strong>Pain Point:</strong> ${esc(killShot.pain)}</div>
                <div style="font-size:10px; color:${ksColor}; margin-top:6px; font-weight:600;">Liability Blocked: ${esc(killShot.damage)}</div>
            </div>
        `;
    }

    const overviewSection = $('dt-overview');
    if (overviewSection) {
        overviewSection.innerHTML = `
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 32px; height: calc(100vh - 220px); overflow: hidden;">
                <div style="overflow-y: auto; padding-right: 12px; display: flex; flex-direction: column; gap: 20px;">
                    <div class="card" style="padding: 20px;">
                        <div style="font-size:10px; color:var(--gold); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:16px; font-weight:700;">Section 1: Intelligence Portfolio</div>
                        <div class="fi-row" style="margin-bottom:12px;">
                            <div class="fg" style="margin:0;"><label class="fl">INT-10 Archetype</label><div style="font-size:12px; color:var(--marble); font-weight:600;">${esc(c.internalCategory||'—')}</div></div>
                            <div class="fg" style="margin:0;"><label class="fl">EXT-6 Market Category</label><div style="font-size:12px; color:var(--marble);">${esc(c.externalCategory||'—')}</div></div>
                        </div>
                        <div class="fg" style="margin-top:16px; padding-top:16px; border-top:1px solid var(--border);">
                            <label class="fl">Product Logic Signal</label>
                            <div style="font-size:11px; color:var(--marble-dim); line-height:1.5;">${esc(c.productSignal||'—')}</div>
                        </div>
                        <div style="margin-top:20px;">${gapsHtml}</div>
                    </div>
                </div>

                <div style="overflow-y: auto; padding-right: 12px; display: flex; flex-direction: column; gap: 20px;">
                    <div class="card" style="padding: 20px;">
                        <div style="font-size:10px; color:var(--gold); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:16px; font-weight:700;">Section 2: Active SOP Controls</div>
                        
                        <div class="el-lock" id="dp-el-lock" style="display:${isAccepted?'none':'block'}">⚠ EL not accepted — production locked.</div>
                        <div class="el-status-block">
                            <div class="el-status-row"><span class="mono">Pre-Payment EL Status</span><span id="dp-el-status" class="${isAccepted?'el-status-ok':'el-status-miss'}">${isAccepted?'✓ Accepted':'Not Accepted'}</span></div>
                        </div>

                        <div class="fi-row" style="margin-top:16px;">
                            <div class="fg"><label class="fl">Production Phase</label>
                                <select class="fi" id="dp-status" style="border-color:var(--gold); color:var(--gold); font-weight:600;">
                                    <option value="payment_received" ${c.status==='payment_received'?'selected':''}>Payment Received</option> 
                                    <option value="intake_received" ${c.status==='intake_received'?'selected':''}>Intake Received</option>
                                    <option value="under_review" ${c.status==='under_review'?'selected':''}>Under Review</option>
                                    <option value="in_production" ${c.status==='in_production'?'selected':''}>In Production</option>
                                    <option value="delivered" ${c.status==='delivered'?'selected':''}>Delivered</option>
                                </select>
                            </div>
                            <div class="fg"><label class="fl">Target Vertical</label>
                                <select class="fi" id="dp-plan-sel">${Object.entries(PLANS).map(([k,v])=>`<option value="${k}" ${c.plan===k?'selected':''}>${v}</option>`).join('')}</select>
                            </div>
                        </div>

                        <div class="fg"><label class="fl">Registration Jurisdiction</label>
                            <select class="fi" id="dp-reg-jur">
                                <option value="">— Select —</option>
                                ${JURISDICTIONS.map(j => `<option value="${j.val}" ${c.registrationJurisdiction===j.val?'selected':''}>${j.label}</option>`).join('')}
                            </select>
                        </div>

                        <div class="fg"><label class="fl">Architect Production Notes (Shared Internal)</label>
                            <textarea class="fi" id="dp-notes" rows="4" placeholder="Log manual production updates...">${esc(c.adminNotes||'')}</textarea>
                        </div>

                        <button class="btn btn-primary btn-full" style="margin-top:20px; padding: 14px 0;" onclick="saveOverview()">💾 Update Production State</button>
                    </div>
                </div>
            </div>
        `;
    }
}

window.saveOverview = async function() {
    if (!currentClient) return;
    await db.collection('clients').doc(currentClient.id).update({
        status: $('dp-status').value,
        plan: $('dp-plan-sel').value,
        registrationJurisdiction: $('dp-reg-jur').value,
        adminNotes: $('dp-notes').value,
        updatedAt: nowTs()
    });
    toast('Client Dossier updated');
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

    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const engRef = currentClient.engagementRef || `LN-C-26-${Math.floor(Math.random() * 1000)}`;
    const clientCompany = currentClient.company || currentClient.name || "Client Company";
    const clientName = currentClient.name || "Client Contact";
    const clientEmail = currentClient.id || "";
    const planName = planLabel(currentClient.plan);
    
    const price = $('sa-price').value || PLAN_PRICES[currentClient.plan] || "____";
    const discount = $('sa-discount').value || "";
    
    let tierText = currentClient.plan === 'flagship' ? `Flagship ----------------------------------------------- $${price} USD` : `Kit -------------------------------------------------------- $${price} USD`;
    let laneText = 'Lane A — Builders';
    if ($('sa-workplace').checked && !$('sa-agentic').checked) laneText = 'Lane B — Users';
    if ($('sa-agentic').checked && $('sa-workplace').checked) laneText = 'Lane A & B (Complete Stack)';
    if (currentClient.plan === 'flagship') laneText = 'Lane C — Enterprise (Flagship)';

    let paymentStructure = currentClient.plan === 'flagship' ? "60% Deposit / 40% on Delivery" : "100% Upfront";
    let timeline = currentClient.plan === 'flagship' ? "As agreed in scope" : "48 hours from Intake Form submission";
    let revisions = currentClient.plan === 'flagship' ? "Throughout project duration" : "1 Round";

    let deliverablesList = "1\tDOC_TOS\tTerms of Service\tCore operating terms.\n";
    let index = 2;
    if ($('sa-agentic').checked) { deliverablesList += `${index++}\tDOC_AGT\tAgentic Addendum\tAutonomous action waiver.\n`; }
    if ($('sa-workplace').checked) { deliverablesList += `${index++}\tDOC_SOP\tInternal AI Policy\tEmployee AI usage guidelines.\n`; }
    if ($('sa-hallucination').checked) { deliverablesList += `${index++}\tDOC_WVR\tHallucination Waiver\tLimits liability for AI output errors.\n`; }
    if ($('sa-disgorgement').checked) { deliverablesList += `${index++}\tDOC_DPA\tData Processing\tGuards against algorithmic disgorgement.\n`; }
    if ($('sa-ip').checked) { deliverablesList += `${index++}\tDOC_IP\tIP Deed\tSecures AI-generated outputs.\n`; }

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

[VERBATIM LEGAL TERMS OMITTED IN DISPLAY BUT PRESERVED IN CODE]

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
        await db.collection('clients').doc(currentClient.id).update({ documents: docs, walkthroughUrl: videoUrl, status: 'delivered', elFullGeneratedAt: nowTs(), deliveredAt: nowTs() });
        toast("Work & Video Delivered.");
        closeDetail();
        loadClients();
    } catch (e) { toast("Save Failed", "error"); }
};

// ════════════════════════════════════════════════════════════════════════
// ═════════ TAB 5-10: ASYNC DATA POPULATION ══════════════════════════════
// ════════════════════════════════════════════════════════════════════════
function populateDetailRadar(c) {
    const el = $('dp-radar-list');
    if (!el) return;
    el.innerHTML = '<div class="loading" style="padding:40px; text-align:center; color:var(--marble-faint); font-size:11px; letter-spacing:0.1em;">Radar matching active in the Client Portal.</div>';
}

function populateDetailGap(c) {
    const g = c.gapReview || {};
    setVal('dp-gap-status',  g.status || '');
    setVal('dp-gap-scope',   g.scopeSummary || '');
    setVal('dp-gap-invoice', g.invoiceUrl || '');
}

window.saveGap = async function() {
    if (!currentClient) return;
    const gapReview = { status: $('dp-gap-status')?.value || '', scopeSummary: $('dp-gap-scope')?.value?.trim() || '', invoiceUrl: $('dp-gap-invoice')?.value?.trim() || '', updatedAt: new Date().toISOString() };
    await db.collection('clients').doc(currentClient.id).update({ gapReview });
    toast('Gap Review saved ($497 Flat)');
};

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
    await db.collection('clients').doc(currentClient.id).update({ maintenanceActive: $('dp-maint').checked, maintenanceSubscriptionId: $('dp-maint-id').value, maintenanceStartDate: $('dp-maint-start').value, updatedAt: nowTs() });
    toast('Maintenance saved');
};

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

function populateDetailReferrals(c) {
    const wrap = $('dp-ref-list');
    if (!wrap) return;
    if (!c.referrals || c.referrals.length === 0) { wrap.innerHTML = '<div class="loading" style="padding:20px 0;">No network targets registered yet.</div>'; return; }
    wrap.innerHTML = c.referrals.map((r, idx) => `
        <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border); padding:16px; display:flex; justify-content:space-between; align-items:center;">
            <div><div style="font-size:14px; color:var(--marble); font-weight:600; margin-bottom:4px;">${esc(r.company)}</div><div style="font-size:11px; color:var(--marble-dim);">Founder: ${esc(r.name)} &bull; Email: ${esc(r.email)} &bull; Submitted: ${r.date}</div></div>
            <div>${r.credited ? `<span class="badge b-delivered">Reward Credited</span>` : `<button class="btn btn-primary btn-sm" onclick="creditReferral('${esc(c.id)}', ${idx})">Mark Credited</button>`}</div>
        </div>`).join('');
}

window.addReferral = async function() {
    if (!currentClient) return;
    const company = $('dp-ref-co')?.value?.trim(); const email = $('dp-ref-email')?.value?.trim(); const date = $('dp-ref-date')?.value;
    if (!company && !email) { toast('Enter company or email', 'error'); return; }
    const entry = { company, email, date, addedAt: new Date().toISOString(), credited: false };
    await db.collection('clients').doc(currentClient.id).update({ referrals: firebase.firestore.FieldValue.arrayUnion(entry) });
    $('dp-ref-co').value = ''; $('dp-ref-email').value = ''; $('dp-ref-date').value = '';
    toast('Referral added');
    openDetail(currentClient.id); 
};

window.creditReferral = async function(clientId, refIdx) {
    if (!confirm('Mark referral as credited?')) return;
    try {
        const clientRef = db.collection('clients').doc(clientId);
        const doc = await clientRef.get();
        if (!doc.exists) return;
        const data = doc.data();
        data.referrals[refIdx].credited = true;
        await clientRef.update({ referrals: data.referrals });
        currentClient.referrals = data.referrals;
        populateDetailReferrals(currentClient);
        toast('Referral credited.');
    } catch(err) { toast('Error crediting referral.', 'error'); }
};

function populateDetailDebrief(c) {
    const wrap = $('dp-debrief-content');
    if (!wrap) return;
    if (!c.debrief) { wrap.innerHTML = '<div class="loading" style="padding:20px 0;">No debrief submitted yet.</div>'; return; }
    const d = c.debrief;
    const bText = d.before || ''; const dText = d.during || ''; const aText = d.after || '';
    const consentColor = d.consent ? '#7ab88a' : '#d47a7a';
    wrap.innerHTML = `
        <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border); padding:24px; margin-bottom:16px;">
            <div style="margin-bottom:20px;"><div style="font-size:10px; color:var(--gold); text-transform:uppercase;">1. The Anxiety</div><div style="font-size:13px; font-style:italic;">"${esc(bText)}"</div></div>
            <div style="margin-bottom:20px;"><div style="font-size:10px; color:var(--gold); text-transform:uppercase;">2. The Experience</div><div style="font-size:13px; font-style:italic;">"${esc(dText)}"</div></div>
            <div style="margin-bottom:20px;"><div style="font-size:10px; color:var(--gold); text-transform:uppercase;">3. The Result</div><div style="font-size:13px; font-style:italic;">"${esc(aText)}"</div></div>
            <div style="padding-top:16px; border-top:1px solid var(--border); display:flex; align-items:center; gap:8px;"><div style="width:8px; height:8px; border-radius:50%; background:${consentColor};"></div><div style="font-size:11px; color:var(--marble-dim);">${d.consent ? 'Authorized public use.' : 'DID NOT authorize public use.'}</div></div>
        </div>
        <textarea readonly style="width:100%; height:100px; background:var(--void); border:1px solid var(--border); color:var(--marble); padding:16px; font-size:13px; line-height:1.5; resize:none;">"Before Lex Nova, my biggest concern was ${esc(bText.toLowerCase())}. Now, ${esc(aText.toLowerCase())}."</textarea>`;
}

document.addEventListener('DOMContentLoaded', () => { if (typeof loadRitual === 'function') loadRitual(); });
