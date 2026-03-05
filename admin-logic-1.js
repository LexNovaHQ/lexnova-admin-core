// admin-logic-1.js — Lex Nova HQ Admin Console (COMPLETE REBUILD)
'use strict';

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const PLANS = { 
    agentic_shield: 'Agentic Shield', 
    workplace_shield: 'Workplace Shield', 
    complete_stack: 'Complete Stack', 
    flagship: 'Flagship' 
};

const STATUS_LABELS = { 
    pending_payment: 'Pending Payment', 
    payment_received: 'Payment Received', 
    intake_received: 'Intake Received', 
    under_review: 'Under Review', 
    in_production: 'In Production', 
    delivered: 'Delivered' 
};

const PLAN_PRICES = { 
    agentic_shield: 997, 
    workplace_shield: 997, 
    complete_stack: 2500, 
    flagship: 15000 
};

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
    agentic_shield: ['EL Stage 1 Accepted','Intake Reviewed','Engagement Ref Gen','TOS Drafted','AUP Drafted','SLA Drafted','DPA Drafted','EL Stage 2 Sent','Portal Open','Delivered'],
    workplace_shield: ['EL Stage 1 Accepted','Intake Reviewed','IP Protection Set','Audit Framework','HITL Protocols','Policy Drafted','EL Stage 2 Sent','Portal Open','Delivered']
};

// ── STATE ─────────────────────────────────────────────────────────────────────
let allClients = []; 
let allLeads = []; 
let currentClient = null; 
let radarEntries = [];

// ── UTILITIES ─────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const qsa = sel => Array.from(document.querySelectorAll(sel));
const planLabel = k => PLANS[k] || k;
const statusLabel = k => STATUS_LABELS[k] || k;
const nowTs = () => firebase.firestore.FieldValue.serverTimestamp();

function esc(str) { 
    if (!str) return ''; 
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); 
}

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

function hoursSince(ts) { 
    if (!ts) return null; 
    const d = ts.toDate ? ts.toDate() : new Date(ts); 
    return Math.floor((Date.now() - d.getTime()) / 3600000); 
}

function daysSince(ts) {
    if (!ts) return null;
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return Math.floor((Date.now() - d.getTime()) / 86400000);
}

function setText(id, txt) { const el = $(id); if (el) el.textContent = String(txt ?? ''); }
function setVal(id, val) { const el = $(id); if (el) el.value = val ?? ''; }

function toast(msg, type = 'success') { 
    const t = $('toast'); 
    if (!t) return; 
    t.textContent = msg; 
    t.className = type; 
    t.style.display = 'block'; 
    setTimeout(() => { t.style.display = 'none'; }, 3000); 
}

// ── NAVIGATION & INIT ──────────────────────────────────────────────────────────
function init() { nav('dashboard'); }

function nav(tab) {
    qsa('.tab-content').forEach(p => p.classList.remove('active'));
    qsa('.nav-item').forEach(l => l.classList.remove('active'));
    $('tab-' + tab)?.classList.add('active');
    document.querySelector(`.nav-item[data-tab="${tab}"]`)?.classList.add('active');
    const subs = { 
        dashboard: 'Command center', clients: 'Client management', 
        leads: 'Lead management', outreach: 'Outreach CRM' 
    };
    const sub = $('pageSub');
    if (sub) sub.textContent = subs[tab] || tab;
    if (tab === 'dashboard') loadDashboard();
    if (tab === 'clients') loadClients();
    if (tab === 'leads') loadLeads();
}

// ── DASHBOARD KPIs ────────────────────────────────────────────────────────────
async function loadDashboard() {
    try {
        const cSnap = await db.collection('clients').get();
        const clients = []; cSnap.forEach(d => clients.push({ id: d.id, ...d.data() }));
        
        const inProd = clients.filter(c => c.status === 'in_production');
        const maint = clients.filter(c => c.maintenanceActive);
        const mrr = maint.length * 297;
        
        setText('d-mrr', fmtMoney(mrr));
        setText('d-active', inProd.length);
        setText('d-clients-count', `${clients.length} Total`);

        const rcTbody = $('d-recent-clients');
        if (rcTbody) {
            const sorted = [...clients].sort((a,b) => (b.createdAt?.toDate?.()?.getTime()||0) - (a.createdAt?.toDate?.()?.getTime()||0)).slice(0, 5);
            rcTbody.innerHTML = sorted.map(c => `
                <tr onclick="openDetail('${esc(c.id)}');nav('clients')">
                    <td>${esc(c.name||c.id)}</td>
                    <td><span class="badge ${planBadgeClass(c.plan)}">${planLabel(c.plan)}</span></td>
                    <td><span class="badge ${statusBadgeClass(c.status)}">${statusLabel(c.status)}</span></td>
                </tr>`).join('');
        }
    } catch (e) { console.error('Dash Error:', e); }
}

// ── CLIENTS TABLE (REAL-TIME) ──────────────────────────────────────────────────
function loadClients() {
    const tbody = $('c-tbody');
    db.collection('clients').orderBy('createdAt','desc').onSnapshot((snap) => {
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
            <td>${esc(c.name||'—')}</td>
            <td><span class="badge ${planBadgeClass(c.plan)}">${planLabel(c.plan)}</span></td>
            <td><span class="badge ${statusBadgeClass(c.status)}">${statusLabel(c.status)}</span></td>
            <td>${slaClock}</td>
            <td>${elBadge}</td>
            <td class="dim">${fmtDate(c.createdAt)}</td>
        </tr>`;
    }).join('');
}

function planBadgeClass(p) { return { agentic_shield:'b-intake', workplace_shield:'b-warm', complete_stack:'b-production', flagship:'b-hot' }[p] || 'b-ghost'; }
function statusBadgeClass(s) { return { pending_payment:'b-pending', payment_received: 'b-delivered', intake_received:'b-intake', under_review:'b-review', in_production:'b-production', delivered:'b-delivered' }[s] || 'b-ghost'; }

// ── DETAIL PANEL ──────────────────────────────────────────────────────────────
async function openDetail(email) {
    $('detailPanel')?.classList.add('open');
    const doc = await db.collection('clients').doc(email).get();
    currentClient = { id: doc.id, ...doc.data() };
    refreshDetailHeader();
    detailTab('overview');
}

function closeDetail() { $('detailPanel')?.classList.remove('open'); }

function refreshDetailHeader() {
    setText('dp-name', currentClient.name || currentClient.id);
    setText('dp-email', currentClient.id);
    setText('dp-plan', planLabel(currentClient.plan));
}

function detailTab(key) {
    qsa('.sub-tab').forEach(b => b.classList.remove('active'));
    qsa(`.sub-tab[onclick*="'${key}'"]`).forEach(b => b.classList.add('active'));
    ['overview','intake','checklist','documents','financials'].forEach(s => $('dt-' + s)?.classList.toggle('hidden', s !== key));
    
    if (key === 'overview') populateDetailOverview(currentClient);
    if (key === 'intake') populateDetailIntake(currentClient);
    if (key === 'checklist') populateDetailChecklist(currentClient);
    if (key === 'documents') populateDetailDocuments(currentClient);
    if (key === 'financials') populateDetailFinancials(currentClient);
}

function populateDetailOverview(c) {
    const isAccepted = !!c.elAccepted;
    const elStatus = $('dp-el-status');
    if (elStatus) { 
        elStatus.textContent = isAccepted ? '✓ Accepted' : 'Not Accepted'; 
        elStatus.className = isAccepted ? 'el-status-ok' : 'el-status-miss'; 
    }
    setVal('dp-status', c.status || 'pending_payment');
    setVal('dp-plan-sel', c.plan || 'agentic_shield');
    setText('dp-ref', c.engagementRef || '—');
    setVal('dp-notes', c.adminNotes || '');
}

async function saveOverview() {
    const updates = {
        status: $('dp-status').value,
        plan: $('dp-plan-sel').value,
        adminNotes: $('dp-notes').value,
        updatedAt: nowTs()
    };
    await db.collection('clients').doc(currentClient.id).update(updates);
    toast('Overview saved');
    loadClients();
}

function populateDetailIntake(c) {
    const el = $('dp-intake-content');
    if (!el) return;
    const intake = c.intakeData || {};
    el.innerHTML = Object.entries(intake).map(([k,v]) => `
        <div class="border-b border-shadow py-2 flex text-xs">
            <span class="w-1/3 opacity-50 uppercase">${esc(k)}</span>
            <span class="w-2/3">${esc(v)}</span>
        </div>`).join('');
}

function populateDetailChecklist(c) {
    const el = $('dp-checklist-items');
    const items = CHECKLIST_ITEMS[c.plan] || CHECKLIST_ITEMS.agentic_shield;
    const saved = c.checklist || {};
    el.innerHTML = items.map((item, i) => `
        <div class="flex items-center gap-2 mb-2">
            <input type="checkbox" id="chk-${i}" ${saved[i]?'checked':''} onchange="saveChecklist()">
            <label class="text-xs" for="chk-${i}">${item}</label>
        </div>`).join('');
}

async function saveChecklist() {
    const checklist = {};
    qsa('#dp-checklist-items input').forEach((chk, i) => { checklist[i] = chk.checked; });
    await db.collection('clients').doc(currentClient.id).update({ checklist });
}

function populateDetailFinancials(c) {
    setText('dp-price', fmtMoney(c.price || PLAN_PRICES[c.plan] || 0));
    const cb = $('dp-maint'); if (cb) cb.checked = !!c.maintenanceActive;
}

// ── DELIVERY ENGINE ───────────────────────────────────────────────────────────

function populateDetailDocuments(c) {
    const container = $('docsContainer');
    if (!container) return;
    container.innerHTML = ''; // Fresh render
    
    (c.documents || []).forEach(d => {
        const div = document.createElement('div');
        div.className = "doc-row";
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

    // Async Gathering of Variables
    const scope       = PLAN_SCOPES[currentClient.plan] || "AI Advisory Scope.";
    const clientName  = currentClient.name || "Client Name";
    const companyName = currentClient.company || "Company Name";
    const planName    = planLabel(currentClient.plan);
    const dateStr     = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    // The Pre-filled Template
    const elTemplate = `ENGAGEMENT LETTER (STAGE 2) - FINAL SCOPE & DELIVERY\n\nDATE: ${dateStr}\nCLIENT: ${clientName} (${companyName})\nPLAN: ${planName}\n\n1. SCOPE OF SERVICES\nBased on the intake diagnostics, Lex Nova HQ will deliver the following:\n${scope}\n\n2. DELIVERY TIMELINE\nWork will commence immediately upon execution of this document and will be delivered via the secure client portal.\n\n3. FEES & MAINTENANCE\nMaintenance phase begins upon final delivery of the items scoped above.`;

    const div = document.createElement('div');
    div.className = "doc-row";
    div.style.position = "relative";
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
            <div class="fg" style="margin-bottom:0">
                <label class="fl" style="color:var(--gold);">Final PDF URL (Signature Link)</label>
                <input type="text" placeholder="https://..." class="fi doc-pdf" style="border-color:rgba(197,160,89,0.4);">
            </div>
            <div class="fg" style="margin-bottom:0">
                <label class="fl">DOCX URL (Optional)</label>
                <input type="text" placeholder="https://..." class="fi doc-docx">
            </div>
        </div>
    `;
    $('docsContainer').prepend(div); // Pops up at the very top
};

window.addDocRow = function() {
    const div = document.createElement('div');
    div.className = "doc-row";
    div.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid var(--border); padding-bottom:8px;">
            <input type="text" placeholder="DOCUMENT NAME (E.G. AI USAGE POLICY)" class="doc-name fi" style="background:transparent; border:none; color:var(--gold); font-weight:bold; text-transform:uppercase; font-size:12px; width:70%; padding:0;">
            <button onclick="this.closest('.doc-row').remove()" style="color:#d47a7a; font-size:10px; text-transform:uppercase; background:none; border:none; cursor:pointer;">Remove</button>
        </div>
        
        <div class="fg">
            <label class="fl">Purpose / Notes</label>
            <input type="text" placeholder="Brief description of this document..." class="fi doc-purpose">
        </div>
        
        <div class="doc-grid">
            <div class="fg" style="margin-bottom:0">
                <label class="fl">PDF Link ↗</label>
                <input type="text" placeholder="https://..." class="fi doc-pdf">
            </div>
            <div class="fg" style="margin-bottom:0">
                <label class="fl">DOCX Link ↗</label>
                <input type="text" placeholder="https://..." class="fi doc-docx">
            </div>
        </div>
    `;
    $('docsContainer').appendChild(div);
};

window.saveDocuments = async function() {
    if (!currentClient) return;
    const docs = [];
    
    qsa('#docsContainer .doc-row').forEach(row => {
        const nameInput = row.querySelector('.doc-name');
        // Handle both input fields (new docs) and hidden fields (saved docs)
        const name = nameInput ? nameInput.value : null; 
        
        if (name) { 
            docs.push({
                name: name,
                purpose: row.querySelector('.doc-purpose')?.value || '',
                content: row.querySelector('.doc-content')?.value || '',
                pdfUrl: row.querySelector('.doc-pdf')?.value || '',
                docxUrl: row.querySelector('.doc-docx')?.value || '',
                status: 'delivered'
            });
        }
    });

    try {
        await db.collection('clients').doc(currentClient.id).update({ 
            documents: docs, 
            status: 'delivered', 
            elFullGeneratedAt: nowTs(), // Tags the overview status
            deliveredAt: nowTs() // Kills the SLA clock
        });
        toast("Work Delivered. Client Portal Updated.");
        closeDetail();
    } catch (e) {
        console.error(e);
        toast("Save Failed", "error");
    }
};

// ── LEADS ─────────────────────────────────────────────────────────────────────
async function loadLeads() {
    const tbody = $('l-tbody');
    if (!tbody) return;
    const snap = await db.collection('leads').orderBy('createdAt','desc').get();
    tbody.innerHTML = '';
    snap.forEach(d => {
        const l = d.data();
        tbody.innerHTML += `<tr><td>${esc(l.name||'—')}</td><td>${esc(l.email||d.id)}</td><td class="dim">${esc(l.company||'—')}</td><td><span class="badge b-ghost">${esc(l.leadType||'—')}</span></td><td>${esc(l.status||'—')}</td><td class="dim">${esc(l.source||'—')}</td><td>${l.scannerExternalScore ?? '—'}</td><td>${l.scannerInternalScore ?? '—'}</td><td class="dim">${fmtDate(l.createdAt)}</td><td><button class="btn btn-outline btn-sm" onclick="convertLead('${esc(d.id)}')">Convert</button></td></tr>`;
    });
}
