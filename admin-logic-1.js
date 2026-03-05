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

const CHECKLIST_ITEMS = {
  agentic_shield: [
    'EL (Stage 1) accepted and filed', 'Intake vault reviewed', 'Engagement Ref generated', 
    'Operating jurisdictions confirmed', 'DOC_TOS drafted', 'DOC_AGT drafted', 'DOC_AUP drafted', 
    'DOC_SLA drafted', 'DOC_DPA drafted', 'DOC_PP drafted', 'DOC_PBK drafted', 
    'Full EL (Stage 2) generated and sent', 'Client portal access provisioned', 'All documents delivered'
  ],
  workplace_shield: [
    'EL (Stage 1) accepted and filed', 'Intake vault reviewed', 'Engagement Ref generated',
    'Operating jurisdictions confirmed', 'DOC_HND drafted', 'DOC_IP drafted', 'DOC_SCAN drafted',
    'DOC_SOP drafted', 'DOC_DPIA drafted', 'Full EL (Stage 2) generated', 'All documents delivered'
  ],
  complete_stack: [
    'EL (Stage 1) accepted', 'Intake vault reviewed', 'Engagement Ref generated',
    'All Lane A documents drafted', 'All Lane B documents drafted', 'Full EL (Stage 2) sent', 'All delivered'
  ],
  flagship: [
    'EL (Stage 1) accepted', 'Discovery call completed', 'Post-call gap analysis documented',
    'Proposal sent and accepted', 'Bespoke documents drafted', 'Delivered'
  ]
};

// ── STATE ─────────────────────────────────────────────────────────────────────
let allClients = []; let allLeads = []; let currentClient = null; let radarEntries = [];

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
    const subs = { dashboard: 'Command center', clients: 'Client management', leads: 'Lead management' };
    const sub = $('pageSub'); if (sub) sub.textContent = subs[tab] || tab;
    if (tab === 'dashboard') loadDashboard();
    if (tab === 'clients') loadClients();
    if (tab === 'leads') loadLeads();
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
    const cSnap = await db.collection('clients').get();
    const clients = []; cSnap.forEach(d => clients.push({ id: d.id, ...d.data() }));
    const inProd = clients.filter(c => c.status === 'in_production');
    const maint = clients.filter(c => c.maintenanceActive);
    setText('d-mrr', fmtMoney(maint.length * 297));
    setText('d-mrr-sub', `${maint.length} active maintenance`);
    setText('d-active', inProd.length);
    setText('d-clients-count', `${clients.length} total clients`);
}

// ── CLIENTS TABLE ─────────────────────────────────────────────────────────────
function loadClients() {
    $('c-tbody').innerHTML = '<tr><td colspan="9" class="loading">Loading…</td></tr>';
    db.collection('clients').orderBy('createdAt','desc').onSnapshot(async (snap) => {
        await loadRadarCache();
        allClients = [];
        snap.forEach(d => allClients.push({ id: d.id, ...d.data() }));
        renderClientsTable(allClients);
    });
}

function renderClientsTable(list) {
    const tbody = $('c-tbody');
    if (!tbody) return;
    tbody.innerHTML = list.map(c => {
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
}
function planBadgeClass(p) { return { agentic_shield:'b-intake', workplace_shield:'b-warm', complete_stack:'b-production', flagship:'b-hot' }[p] || 'b-ghost'; }
function statusBadgeClass(s) { return { pending_payment:'b-pending', payment_received: 'b-delivered', intake_received:'b-intake', under_review:'b-review', in_production:'b-production', delivered:'b-delivered' }[s] || 'b-ghost'; }

// ── LEADS TABLE ───────────────────────────────────────────────────────────────
async function loadLeads() {
    const snap = await db.collection('leads').orderBy('createdAt','desc').get();
    const tbody = $('l-tbody');
    tbody.innerHTML = '';
    snap.forEach(d => {
        const l = d.data();
        tbody.innerHTML += `<tr><td>${esc(l.name||'—')}</td><td>${esc(l.email||d.id)}</td><td class="dim">${esc(l.company||'—')}</td><td><span class="badge b-ghost">${esc(l.leadType||'—')}</span></td><td>${esc(l.status||'—')}</td><td class="dim">${esc(l.source||'—')}</td><td>${l.scannerExternalScore ?? '—'}</td><td>${l.scannerInternalScore ?? '—'}</td><td class="dim">${fmtDate(l.createdAt)}</td><td><button class="btn btn-outline btn-sm">Convert</button></td></tr>`;
    });
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
    detailTab('overview');
}

function closeDetail() { $('detailPanel').classList.remove('open'); }

function detailTab(key) {
    qsa('.sub-tab').forEach(b => b.classList.remove('active'));
    qsa(`.sub-tab[onclick*="'${key}'"]`).forEach(b => b.classList.add('active'));
    ['overview','intake','checklist','documents','radar','gap','financials','activity','referrals'].forEach(s => $('dt-' + s)?.classList.toggle('hidden', s !== key));
    
    if (key === 'overview') populateDetailOverview(currentClient);
    if (key === 'intake') populateDetailIntake(currentClient);
    if (key === 'checklist') populateDetailChecklist(currentClient);
    if (key === 'documents') populateDetailDocuments(currentClient);
    if (key === 'radar') populateDetailRadar(currentClient);
    if (key === 'gap') populateDetailGap(currentClient);
    if (key === 'financials') populateDetailFinancials(currentClient);
    if (key === 'activity') populateDetailActivity(currentClient);
    if (key === 'referrals') populateDetailReferrals(currentClient);
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

window.onStatusChange = function(val) {}; // Placeholder for manual trigger if needed

// ── 2. INTAKE TAB ─────────────────────────────────────────────────────────────
function populateDetailIntake(c) {
    const el = $('dp-intake-content');
    const intake = c.intakeData || {};
    if (Object.keys(intake).length === 0) {
        el.innerHTML = '<div class="loading">No intake data submitted yet</div>';
        return;
    }
    el.innerHTML = Object.entries(intake).map(([k,v]) => `<div class="border-b border-shadow py-2 flex text-xs"><span class="w-1/3 opacity-50 uppercase">${esc(k)}</span><span class="w-2/3">${esc(Array.isArray(v) ? v.join(', ') : v)}</span></div>`).join('');
}

// ── 3. CHECKLIST TAB ──────────────────────────────────────────────────────────
function populateDetailChecklist(c) {
    const el = $('dp-checklist-items');
    if (!el) return;
    const items = CHECKLIST_ITEMS[c.plan] || CHECKLIST_ITEMS.agentic_shield;
    const saved = c.checklist || {};
    
    el.innerHTML = items.map((item, i) => `
        <div class="chk-item" style="display:flex; align-items:center; gap:10px; padding:9px 0; border-bottom:1px solid rgba(197,160,89,.06);">
            <div class="chk-box ${saved[i] ? 'done' : ''}" id="chk-box-${i}" style="width:16px; height:16px; border:1px solid var(--border2); cursor:pointer; display:flex; align-items:center; justify-content:center; ${saved[i] ? 'background:var(--gold-dim); border-color:var(--gold);' : ''}" onclick="toggleChk(this, ${i})">
                <span class="chk-tick" style="color:var(--gold); font-size:10px; display:${saved[i] ? 'block' : 'none'};">✓</span>
            </div>
            <span class="chk-label" id="chk-label-${i}" style="font-size:11px; ${saved[i] ? 'color:var(--marble-dim); text-decoration:line-through;' : 'color:var(--marble);'}">${esc(item)}</span>
        </div>
    `).join('');
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
    const items = CHECKLIST_ITEMS[currentClient.plan] || CHECKLIST_ITEMS.agentic_shield;
    const checklist = {};
    items.forEach((_, i) => { checklist[i] = $(`chk-box-${i}`)?.classList.contains('done') || false; });
    await db.collection('clients').doc(currentClient.id).update({ checklist, updatedAt: nowTs() });
    toast('Checklist saved');
};

// ── 4. DELIVERY ENGINE (DOCUMENTS & VIDEO) ────────────────────────────────────
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
            ${d.content ? `<div style="font-size:10px; color:var(--marble-dim); margin-bottom:12px; background:var(--void); padding:8px; border:1px solid var(--border); opacity:0.8;"><strong>EL Preview:</strong> ${esc(d.content.substring(0,100))}...</div>` : ''}
            
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

// ── 5. RADAR TAB ──────────────────────────────────────────────────────────────
function populateDetailRadar(c) {
    const el = $('dp-radar-list');
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

// ── 6. GAP REVIEW TAB ─────────────────────────────────────────────────────────
function populateDetailGap(c) {
    const g = c.gapReview || {};
    setVal('dp-gap-status',  g.status || '');
    setVal('dp-gap-scope',   g.scopeSummary || '');
    setVal('dp-gap-invoice', g.invoiceUrl || '');
    setVal('dp-gap-amount',  g.amount || '');
}

window.saveGap = async function() {
    if (!currentClient) return;
    const gapReview = {
        status: $('dp-gap-status')?.value || '',
        scopeSummary: $('dp-gap-scope')?.value?.trim() || '',
        invoiceUrl: $('dp-gap-invoice')?.value?.trim() || '',
        amount: parseFloat($('dp-gap-amount')?.value) || null,
        updatedAt: new Date().toISOString()
    };
    await db.collection('clients').doc(currentClient.id).update({ gapReview });
    toast('Gap Review saved');
};

// ── 7. FINANCIALS TAB ─────────────────────────────────────────────────────────
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

// ── 8. ACTIVITY TAB ───────────────────────────────────────────────────────────
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
    openDetail(currentClient.id); // refresh
};

// ── 9. REFERRALS TAB ──────────────────────────────────────────────────────────
function populateDetailReferrals(c) {
    const el = $('dp-referrals-list');
    if (!el) return;
    const refs = c.referrals || [];
    el.innerHTML = refs.length ? refs.map(r => `<div style="display:flex;gap:20px;padding:9px 0;border-bottom:1px solid rgba(197,160,89,.06);font-size:11px"><span style="flex:1">${esc(r.company||'—')}</span><span style="flex:1;color:var(--marble-dim)">${esc(r.email||'—')}</span><span style="color:var(--marble-faint)">${esc(r.date||'—')}</span></div>`).join('') : '<div class="loading">No referrals logged</div>';
}

window.addReferral = async function() {
    if (!currentClient) return;
    const company = $('dp-ref-co')?.value?.trim();
    const email = $('dp-ref-email')?.value?.trim();
    const date = $('dp-ref-date')?.value;
    if (!company && !email) { toast('Enter company or email', 'error'); return; }
    const entry = { company, email, date, addedAt: new Date().toISOString() };
    await db.collection('clients').doc(currentClient.id).update({ referrals: firebase.firestore.FieldValue.arrayUnion(entry) });
    $('dp-ref-co').value = ''; $('dp-ref-email').value = ''; $('dp-ref-date').value = '';
    toast('Referral added');
    openDetail(currentClient.id); // refresh
};
