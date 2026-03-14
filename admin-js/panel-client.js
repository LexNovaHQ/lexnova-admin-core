// ════════════════════════════════════════════════════════════════════════
// ═════════ LEX NOVA ADMIN: FULFILLMENT ENGINE (panel-client.js) ═════════
// ════════════════════════════════════════════════════════════════════════
// Description: Controls the Client Detail Panel, Dynamic Death Checks, 
// and the Document Payload Deployment.
// ════════════════════════════════════════════════════════════════════════
'use strict';

// ─── LOCAL UTILITIES ────────────────────────────────────────────────────
var $ = id => document.getElementById(id);
var qsa = sel => Array.from(document.querySelectorAll(sel));
var fmtDate = function(ts) { 
    if (!ts) return '—'; 
    const d = ts.toDate ? ts.toDate() : new Date(ts); 
    if (isNaN(d)) return '—'; 
    return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }); 
};
var fmtMoney = function(n) { return (n == null || isNaN(n)) ? '—' : '$' + Number(n).toLocaleString('en-US'); };
var setText = function(id, txt) { const el = $(id); if (el) el.textContent = String(txt ?? ''); };
var setVal = function(id, val) { const el = $(id); if (el) el.value = val ?? ''; };
var nowTs = () => new Date().toISOString(); 
var planLabel = k => ({ agentic_shield: 'Agentic Shield', workplace_shield: 'Workplace Shield', complete_stack: 'Complete Stack', flagship: 'Flagship' }[k] || k);

// ════════════════════════════════════════════════════════════════════════
// ═════════ CORE PANEL ROUTING ═══════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
window.openDetail = async function(email) {
    const dp = $('detailPanel');
    if (dp) {
        dp.style.maxWidth = '100%';
        dp.style.width = '100%';
        dp.style.left = '0';
        dp.classList.add('open');
    }

    if (typeof window.loadRadarCache === 'function') await window.loadRadarCache();
    
    try {
        const doc = await window.db.collection('clients').doc(email).get();
        window.currentClient = { id: doc.id, ...doc.data() };
        
        setText('dp-name', window.currentClient.baseline?.company || window.currentClient.name || window.currentClient.id);
        setText('dp-email', `${window.currentClient.id} · Ref: ${window.currentClient.engagementRef || '—'}`);
        setText('dp-plan', planLabel(window.currentClient.plan));
        
        populateDetailOverview(window.currentClient);
        populateDetailIntake(window.currentClient);      // V5 Dynamic Upgrade
        populateDetailChecklist(window.currentClient);   // V5 Dynamic Upgrade
        populateDetailDocuments(window.currentClient);   // V5 Dynamic Upgrade
        populateDetailRadar(window.currentClient);
        populateDetailGap(window.currentClient);
        populateDetailFinancials(window.currentClient);
        populateDetailActivity(window.currentClient);
        populateDetailReferrals(window.currentClient);
        populateDetailDebrief(window.currentClient);
        
        window.detailTab('overview');
    } catch(e) {
        console.error("Error populating detail panel:", e);
        if(window.toast) window.toast("Error loading client data", "error");
    }
};

window.closeDetail = function() { 
    const dp = $('detailPanel');
    if (dp) dp.classList.remove('open'); 
    window.currentClient = null;
};

window.detailTab = function(key, el) {
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
    } else {
        document.querySelectorAll('.sub-tab').forEach(b => b.classList.remove('active'));
        const targetBtn = document.querySelector(`.sub-tab[onclick*="'${key}'"]`);
        if (targetBtn) targetBtn.classList.add('active');
    }
};


// ════════════════════════════════════════════════════════════════════════
// ═════════ TAB 1: OVERVIEW (THE V3 WAR ROOM) ════════════════════════════
// ════════════════════════════════════════════════════════════════════════
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
                <div style="font-size:13px; font-weight:700; color:var(--marble); margin-bottom:8px;">${window.esc(killShot.gapName)}</div>
                <div style="font-size:10px; color:var(--marble-dim);"><strong>Pain Point:</strong> ${window.esc(killShot.pain)}</div>
                <div style="font-size:10px; color:${ksColor}; margin-top:6px; font-weight:600;">Liability Blocked: ${window.esc(killShot.damage)}</div>
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
                            <div class="fg" style="margin:0;"><label class="fl">INT-10 Archetype</label><div style="font-size:12px; color:var(--marble); font-weight:600;">${window.esc(c.internalCategory||'—')}</div></div>
                            <div class="fg" style="margin:0;"><label class="fl">EXT-6 Market Category</label><div style="font-size:12px; color:var(--marble);">${window.esc(c.externalCategory||'—')}</div></div>
                        </div>
                        <div class="fg" style="margin-top:16px; padding-top:16px; border-top:1px solid var(--border);">
                            <label class="fl">Product Logic Signal</label>
                            <div style="font-size:11px; color:var(--marble-dim); line-height:1.5;">${window.esc(c.productSignal||'—')}</div>
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
                                <select class="fi" id="dp-plan-sel">
                                    <option value="agentic_shield" ${c.plan==='agentic_shield'?'selected':''}>Agentic Shield</option>
                                    <option value="workplace_shield" ${c.plan==='workplace_shield'?'selected':''}>Workplace Shield</option>
                                    <option value="complete_stack" ${c.plan==='complete_stack'?'selected':''}>Complete Stack</option>
                                    <option value="flagship" ${c.plan==='flagship'?'selected':''}>Flagship</option>
                                </select>
                            </div>
                        </div>

                        <div class="fg"><label class="fl">Architect Production Notes (Shared Internal)</label>
                            <textarea class="fi" id="dp-notes" rows="4" placeholder="Log manual production updates...">${window.esc(c.adminNotes||'')}</textarea>
                        </div>

                        <button class="btn btn-primary btn-full" style="margin-top:20px; padding: 14px 0;" onclick="window.saveOverview()">💾 Update Production State</button>
                    </div>
                </div>
            </div>
        `;
    }
}

window.saveOverview = async function() {
    if (!window.currentClient) return;
    try {
        await window.db.collection('clients').doc(window.currentClient.id).update({
            status: $('dp-status').value,
            plan: $('dp-plan-sel').value,
            adminNotes: $('dp-notes').value,
            updatedAt: nowTs()
        });
        if(window.toast) window.toast('Client Dossier updated');
        if (typeof window.loadClients === 'function') window.loadClients();
    } catch(e) {
        if(window.toast) window.toast('Failed to update overview', 'error');
    }
};


// ════════════════════════════════════════════════════════════════════════
// ═════════ TAB 2: INTAKE (THE ARCHITECT's BRIEF - V5 UPGRADE) ═══════════
// ════════════════════════════════════════════════════════════════════════
function populateDetailIntake(c) {
    const el = $('dp-intake-content');
    if (!el) return;
    
    // If they haven't submitted the new Vault, show legacy or pending state
    if (!c.baseline && !c.architecture) {
        el.innerHTML = '<div class="loading">Waiting for Client to submit the 13-Question Vault in their Portal.</div>';
        return;
    }

    const b = c.baseline || {};
    const a = c.architecture || {};
    const scope = c.action_scopes || {};
    const comm = c.commercials || {};

    let warningsHTML = '';
    
    // Flash Critical Warnings based on Vault
    if (b.eu_users) warningsHTML += `<div style="font-size:11px; color:#d4a850; margin-bottom:6px;">⚠️ <strong>EU/UK Users Checked:</strong> GDPR Mandate. Inject Standard Contractual Clauses (SCCs) into DOC_DPA.</div>`;
    if (b.ca_users) warningsHTML += `<div style="font-size:11px; color:#d4a850; margin-bottom:6px;">⚠️ <strong>California Users Checked:</strong> CCPA Mandate. Inject 'Service Provider' shield into DOC_DPA and DOC_PP.</div>`;
    if (a.memory === 'finetuning') warningsHTML += `<div style="font-size:11px; color:#ef4444; margin-bottom:6px;">🔴 <strong>FINE-TUNING DETECTED:</strong> High Algorithmic Disgorgement Risk. Override standard DPA deletion clauses.</div>`;
    if (scope.is_doer) warningsHTML += `<div style="font-size:11px; color:#ef4444; margin-bottom:6px;">🔴 <strong>AUTONOMOUS ACTIONS DETECTED:</strong> UETA §14 agency liability active. Must generate DOC_AGT (Agentic Addendum).</div>`;

    el.innerHTML = `
        ${warningsHTML ? `<div style="background:rgba(197,160,89,0.1); border:1px solid var(--gold); padding:16px; margin-bottom:24px;">
            <div style="color:var(--gold); font-size:10px; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:10px; font-weight:bold;">Architectural Tripwires Triggered</div>
            ${warningsHTML}
        </div>` : ''}

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 32px;">
            <div>
                <div style="font-size:10px; color:var(--gold); text-transform:uppercase; border-bottom:1px solid var(--border); padding-bottom:6px; margin-bottom:12px;">Phase 1: The Baseline</div>
                <div style="font-size:11px; margin-bottom:6px;"><span class="dim">Company Legal Name:</span> <strong>${window.esc(b.company)}</strong></div>
                <div style="font-size:11px; margin-bottom:6px;"><span class="dim">HQ Location:</span> <strong>${window.esc(b.hq)}</strong></div>
                <div style="font-size:11px; margin-bottom:6px;"><span class="dim">EU/UK Users:</span> <strong>${b.eu_users ? 'Yes' : 'No'}</strong></div>
                <div style="font-size:11px; margin-bottom:16px;"><span class="dim">CA Users:</span> <strong>${b.ca_users ? 'Yes' : 'No'}</strong></div>

                <div style="font-size:10px; color:var(--gold); text-transform:uppercase; border-bottom:1px solid var(--border); padding-bottom:6px; margin-bottom:12px;">Phase 2: Data Architecture</div>
                <div style="font-size:11px; margin-bottom:6px;"><span class="dim">Processes PII:</span> <strong>${a.processes_pii ? 'Yes' : 'No'}</strong></div>
                <div style="font-size:11px; margin-bottom:6px;"><span class="dim">Sensitive (Health/Med):</span> <strong>${a.sensitive_health ? 'Yes' : 'No'}</strong></div>
                <div style="font-size:11px; margin-bottom:6px;"><span class="dim">Sensitive (Biometric):</span> <strong>${a.sensitive_bio ? 'Yes' : 'No'}</strong></div>
                <div style="font-size:11px; margin-bottom:6px;"><span class="dim">Sensitive (Financial):</span> <strong>${a.sensitive_fin ? 'Yes' : 'No'}</strong></div>
                <div style="font-size:11px; margin-bottom:6px;"><span class="dim">AI Memory Engine:</span> <strong>${window.esc(a.memory || '—').toUpperCase()}</strong></div>
                <div style="font-size:11px; margin-bottom:16px;"><span class="dim">Model Infra:</span> <strong>${window.esc(a.models || '—').toUpperCase()}</strong></div>
            </div>
            
            <div>
                <div style="font-size:10px; color:var(--gold); text-transform:uppercase; border-bottom:1px solid var(--border); padding-bottom:6px; margin-bottom:12px;">Phase 3: Action Scopes (INT. 10)</div>
                <div style="font-size:11px; margin-bottom:6px;"><span class="dim">The Doer (Autonomous):</span> <strong>${scope.is_doer ? 'Yes' : 'No'}</strong></div>
                ${scope.is_doer ? `
                    <div style="font-size:11px; margin-bottom:2px; padding-left:12px; color:var(--gold);">↳ Session Spend Limit: <strong>${window.esc(scope.spend_limit)}</strong></div>
                    <div style="font-size:11px; margin-bottom:6px; padding-left:12px; color:var(--gold);">↳ Rate Limit / Min: <strong>${window.esc(scope.rate_limit)}</strong></div>
                ` : ''}
                <div style="font-size:11px; margin-bottom:6px;"><span class="dim">The Judge (HR):</span> <strong>${scope.is_judge_hr ? 'Yes' : 'No'}</strong></div>
                <div style="font-size:11px; margin-bottom:6px;"><span class="dim">The Judge (Financial):</span> <strong>${scope.is_judge_fin ? 'Yes' : 'No'}</strong></div>
                <div style="font-size:11px; margin-bottom:6px;"><span class="dim">The Judge (Legal):</span> <strong>${scope.is_judge_legal ? 'Yes' : 'No'}</strong></div>
                <div style="font-size:11px; margin-bottom:6px;"><span class="dim">The Companion:</span> <strong>${scope.is_companion ? 'Yes' : 'No'}</strong></div>
                <div style="font-size:11px; margin-bottom:16px;"><span class="dim">The Orchestrator:</span> <strong>${scope.is_orchestrator ? 'Yes' : 'No'}</strong></div>

                <div style="font-size:10px; color:var(--gold); text-transform:uppercase; border-bottom:1px solid var(--border); padding-bottom:6px; margin-bottom:12px;">Phase 4: Commercials (SLA)</div>
                <div style="font-size:11px; margin-bottom:6px;"><span class="dim">Uptime Guarantee:</span> <strong>${window.esc(comm.uptime)}</strong></div>
                <div style="font-size:11px; margin-bottom:6px;"><span class="dim">Time-To-First-Token (TTFT):</span> <strong>${window.esc(comm.ttft)}</strong></div>
            </div>
        </div>
    `;
}


// ════════════════════════════════════════════════════════════════════════
// ═════════ TAB 3: CHECKLIST (DYNAMIC DEATH CHECKS - V5 UPGRADE) ═════════
// ════════════════════════════════════════════════════════════════════════
function populateDetailChecklist(c) {
    const el = $('dp-checklist-items');
    if (!el) return;
    
    // Core Ops that always apply
    const coreOps = [
        "Payment successfully captured.",
        "Pre-Payment Engagement Letter (Stage 1) accepted.",
        "Master ToS and Privacy Policy drafted.",
        "Client legal name and jurisdiction verified across all documents."
    ];

    // Dynamic Death Checks based on Vault
    const deathChecks = [];
    const b = c.baseline || {};
    const a = c.architecture || {};
    const scope = c.action_scopes || {};
    const comm = c.commercials || {};

    if (b.eu_users) deathChecks.push("DEATH CHECK: Verify GDPR Standard Contractual Clauses (SCCs) are injected into DOC_DPA.");
    if (a.memory === 'finetuning') deathChecks.push("DEATH CHECK: Algorithmic Disgorgement Risk! Verify DOC_DPA strictly limits training data deletion requests.");
    
    if (scope.is_doer) {
        deathChecks.push("DEATH CHECK: Verify DOC_AGT (Agentic Addendum) is generated.");
        deathChecks.push(`DEATH CHECK: Verify Circuit Breaker is hardcoded to ${scope.spend_limit || 'Session Limit'} in Schedule C.`);
        deathChecks.push("DEATH CHECK: Verify Kill Switch (/terminate API) requirement is injected.");
    }

    if (scope.is_judge_hr || scope.is_judge_fin || scope.is_judge_legal) {
        deathChecks.push("DEATH CHECK: Verify 'Human-in-the-Loop' (HITL) disclaimer is bolded in DOC_TOS.");
    }

    if (comm.uptime !== 'none' || comm.ttft !== 'none') {
        deathChecks.push(`DEATH CHECK: Verify DOC_SLA is generated matching Uptime [${comm.uptime}] and TTFT [${comm.ttft}].`);
    }

    const saved = c.checklistState || {};
    let html = '';
    let globalIndex = 0;

    const renderSection = (title, items, isDeathCheck) => {
        if (items.length === 0) return;
        const catColor = isDeathCheck ? '#d47a7a' : 'var(--gold)';
        html += `<div style="margin-top:16px; margin-bottom:8px; font-size:9px; letter-spacing:0.15em; text-transform:uppercase; color:${catColor}; border-bottom:1px solid ${isDeathCheck ? 'rgba(212,122,122,0.3)' : 'var(--border)'}; padding-bottom:4px;">${title}</div>`;
        
        items.forEach(item => {
            const isDone = !!saved[globalIndex];
            html += `
                <div class="chk-item" style="display:flex; align-items:flex-start; gap:10px; padding:7px 0; border-bottom:1px solid rgba(197,160,89,.04);">
                    <div class="chk-box ${isDone ? 'done' : ''} ${isDeathCheck ? 'death-check' : ''}" id="chk-box-${globalIndex}" style="width:16px; height:16px; border:1px solid var(--border2); cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:2px; ${isDone ? 'background:var(--gold-dim); border-color:var(--gold);' : ''}" onclick="window.toggleChk(this, ${globalIndex})">
                        <span class="chk-tick" style="color:var(--gold); font-size:10px; display:${isDone ? 'block' : 'none'};">✓</span>
                    </div>
                    <span class="chk-label" id="chk-label-${globalIndex}" style="font-size:11px; line-height:1.4; ${isDone ? 'color:var(--marble-dim); text-decoration:line-through;' : 'color:var(--marble);'}">${window.esc(item)}</span>
                </div>
            `;
            globalIndex++;
        });
    };

    renderSection("Core Operations", coreOps, false);
    renderSection("The Death Checks (Conditional)", deathChecks, true);

    if (deathChecks.length === 0) {
        html += `<div class="dim" style="font-size:11px; padding:10px 0;">No severe architectural Death Checks triggered. Proceed with standard deployment.</div>`;
    }

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
    window.saveChecklistState(); // Auto-save on click
};

window.saveChecklistState = async function() {
    if (!window.currentClient) return;
    const checklistState = {};
    qsa('.chk-box').forEach((box) => {
        const idStr = box.id.replace('chk-box-', '');
        checklistState[idStr] = box.classList.contains('done');
    });
    try {
        await window.db.collection('clients').doc(window.currentClient.id).update({ checklistState });
    } catch(e) { console.error("Checklist auto-save failed"); }
};


// ════════════════════════════════════════════════════════════════════════
// ═════════ TAB 4: DOCUMENTS (DYNAMIC PAYLOAD BUILDER) ═══════════════════
// ════════════════════════════════════════════════════════════════════════
function populateDetailDocuments(c) {
    const container = $('docsContainer');
    if (!container) return;
    container.innerHTML = '';
    
    const isAgentic = ['agentic_shield', 'complete_stack', 'flagship'].includes(c.plan);
    const isWorkplace = ['workplace_shield', 'complete_stack', 'flagship'].includes(c.plan);
    
    // Architect's Walkthrough Video
    container.innerHTML += `
        <div class="card" style="margin-bottom:20px; border-color:var(--gold-mid); background:var(--void);">
            <div style="font-size:10px; color:var(--gold); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:12px; font-weight:700;">1. The Architect's Walkthrough</div>
            <div class="fg" style="margin-bottom:0;"><label class="fl">Loom/Clipchamp Video URL</label><input type="text" class="fi" id="doc-video-link" value="${window.esc(c.walkthroughUrl || '')}" placeholder="https://..."></div>
        </div>
        <div style="font-size:10px; color:var(--gold); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:12px; font-weight:700; margin-top:30px;">2. The Document Payload</div>
    `;

    const existingFiles = c.files || {};
    const a = c.architecture || {};
    const scope = c.action_scopes || {};
    const comm = c.commercials || {};

    const renderSlot = (docId, title, subtext, isRequired) => {
        const val = existingFiles[docId] || '';
        const opacity = isRequired ? '1' : '0.5';
        const reqLabel = isRequired ? '' : '<span style="font-size:9px; color:var(--marble-dim); text-transform:uppercase; border:1px solid var(--border); padding:2px 6px; border-radius:3px;">Not Required by Architecture</span>';
        
        return `
            <div class="doc-row border border-shadow p-4 mb-3 bg-[#0a0a0a]" style="opacity:${opacity};">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                    <span style="color:var(--marble); font-weight:bold; font-size:12px;">${docId} — ${title}</span>
                    ${reqLabel}
                </div>
                <div style="font-size:10px; color:var(--marble-dim); margin-bottom:16px;"><strong>Purpose:</strong> ${subtext}</div>
                ${isRequired ? `
                    <div class="fg" style="margin-bottom:0">
                        <label class="fl">Final PDF URL (Google Drive / OneDrive Link)</label>
                        <input type="text" class="fi payload-input" data-docid="${docId}" value="${window.esc(val)}" placeholder="https://...">
                    </div>
                ` : `<div style="font-size:10px; color:var(--marble-faint); font-style:italic;">Skipped based on Vault payload.</div>`}
            </div>
        `;
    };

    let html = '';

    if (isAgentic) {
        html += renderSlot('DOC_TOS', 'Terms of Service', 'Core operating terms governing user rights, liability limits, and general AI output disclaimers.', true);
        html += renderSlot('DOC_PP', 'Privacy Policy', 'Details how user data is collected, stored, and handled to comply with global privacy laws.', true);
        html += renderSlot('DOC_AUP', 'Acceptable Use Policy', 'Strictly prohibits prompt injection, jailbreaking, reverse-engineering, and malicious use of your AI models.', true);
        
        const reqDPA = a.processes_pii !== false; // Default to true if missing for safety
        html += renderSlot('DOC_DPA', 'Data Processing Agreement', 'Guards against algorithmic disgorgement and fulfills GDPR/CCPA vendor compliance.', reqDPA);
        
        const reqAGT = scope.is_doer === true;
        html += renderSlot('DOC_AGT', 'Agentic Addendum', 'Waives liability for autonomous actions, API calls, and enforces financial circuit breakers.', reqAGT);
        
        const reqSLA = (comm.uptime && comm.uptime !== 'none') || (comm.ttft && comm.ttft !== 'none');
        html += renderSlot('DOC_SLA', 'Service Level Agreement', 'Defines hard uptime and Time-To-First-Token performance targets.', reqSLA);

        html += renderSlot('DOC_PBK_A', 'Negotiation Playbook', 'Your enterprise procurement defense guide. Contains exact scripts, maximum concessions, and walk-away lines to defend your AI architecture during enterprise contract negotiations.', true);
    }

    if (isWorkplace) {
        html += renderSlot('DOC_SCAN', 'Shadow AI Audit', 'Internal risk assessment matrix mapping employee AI usage to uncover unauthorized data leaks.', true);
        html += renderSlot('DOC_HND', 'Employee AI Handbook', 'Strict corporate guidelines dictating which AI tools employees can legally use on company networks.', true);
        html += renderSlot('DOC_IP', 'IP Ownership Deed', 'Contractual mechanism ensuring the company explicitly owns all AI-generated code, copy, and assets.', true);
        html += renderSlot('DOC_SOP', 'HITL Protocols', 'Standard Operating Procedures mandating human-in-the-loop verification before deploying AI outputs.', true);
        html += renderSlot('DOC_PBK_B', 'Operations Playbook', 'The managerial deployment guide for enforcing the Workplace Shield across your internal teams.', true);
    }

    container.innerHTML += html;

    container.innerHTML += `
        <button class="btn btn-primary btn-full" style="margin-top:30px; padding: 20px 0; font-size:14px; letter-spacing:0.2em; font-weight:800; border:1px solid var(--gold); background:var(--gold-dim); color:var(--gold);" onclick="window.deployArchitecture()">🚀 DEPLOY ARCHITECTURE & CLOSE SLA</button>
    `;
}

window.deployArchitecture = async function() {
    if (!window.currentClient) return;

    // 1. Validate Death Checks
    const deathChecks = qsa('.death-check');
    if (deathChecks.length > 0) {
        const allPassed = deathChecks.every(box => box.classList.contains('done'));
        if (!allPassed) {
            if(window.toast) window.toast("SOP VIOLATION: Cannot deploy while Death Checks are incomplete.", "error");
            window.detailTab('checklist');
            return;
        }
    }

    // 2. Extract Document Payloads
    const files = {};
    qsa('.payload-input').forEach(input => {
        const docId = input.getAttribute('data-docid');
        const url = input.value.trim();
        if (url) files[docId] = url;
    });

    const videoUrl = $('doc-video-link')?.value?.trim() || '';

    // 3. Database Execution
    try {
        await window.db.collection('clients').doc(window.currentClient.id).update({ 
            files: files, 
            walkthroughUrl: videoUrl,
            status: 'delivered', 
            deliveredAt: nowTs() 
        });
        if(window.toast) window.toast("Architecture Deployed. Vault Unlocked.");
        window.closeDetail();
        if (typeof window.loadClients === 'function') window.loadClients();
    } catch (e) {
        console.error(e);
        if(window.toast) window.toast("Deployment Failed", "error");
    }
};


// ════════════════════════════════════════════════════════════════════════
// ═════════ TAB 5-10: LEGACY PRESERVATION ════════════════════════════════
// ════════════════════════════════════════════════════════════════════════

function populateDetailRadar(c) {
    const el = $('dp-radar-list');
    if (!el) return;
    el.innerHTML = '<div class="loading" style="padding:40px; text-align:center; color:var(--marble-faint); font-size:11px; letter-spacing:0.1em;">Radar matching active in the Client Portal based on EXT.6/INT.10 Matrix.</div>';
}

function populateDetailGap(c) {
    const g = c.gapReview || {};
    setVal('dp-gap-status',  g.status || '');
    setVal('dp-gap-scope',   g.scopeSummary || '');
    setVal('dp-gap-invoice', g.invoiceUrl || '');
}

window.saveGap = async function() {
    if (!window.currentClient) return;
    const gapReview = { 
        status: $('dp-gap-status')?.value || '', 
        scopeSummary: $('dp-gap-scope')?.value?.trim() || '', 
        invoiceUrl: $('dp-gap-invoice')?.value?.trim() || '', 
        updatedAt: nowTs() 
    };
    try {
        await window.db.collection('clients').doc(window.currentClient.id).update({ gapReview });
        if(window.toast) window.toast('Gap Review saved ($497 Flat)');
    } catch(e) { if(window.toast) window.toast('Save failed', 'error'); }
};

function populateDetailFinancials(c) {
    const PLAN_PRICES = { agentic_shield: 997, workplace_shield: 997, complete_stack: 2500, flagship: 15000 };
    const price = c.price || PLAN_PRICES[c.plan] || 0;
    setText('dp-price', fmtMoney(price));
    const cb = $('dp-maint'); 
    if (cb) cb.checked = !!c.maintenanceActive;
    const fields = $('dp-maint-fields'); 
    if (fields) fields.style.display = c.maintenanceActive ? 'block' : 'none';
    setVal('dp-maint-id', c.maintenanceSubscriptionId || c.subscriptionId || '');
    setVal('dp-maint-start', c.maintenanceStartDate || '');
}

window.toggleMaint = function(checked) {
    const fields = $('dp-maint-fields');
    if (fields) fields.style.display = checked ? 'block' : 'none';
};

window.saveMaint = async function() {
    if (!window.currentClient) return;
    try {
        await window.db.collection('clients').doc(window.currentClient.id).update({ 
            maintenanceActive: $('dp-maint').checked, 
            maintenanceSubscriptionId: $('dp-maint-id').value, 
            maintenanceStartDate: $('dp-maint-start').value, 
            updatedAt: nowTs() 
        });
        if(window.toast) window.toast('Maintenance saved');
    } catch(e) { if(window.toast) window.toast('Save failed', 'error'); }
};

function populateDetailActivity(c) {
    const el = $('dp-activity-log');
    if (!el) return;
    const log = [...(c.activityLog||[])].sort((a,b) => new Date(b.ts||0).getTime() - new Date(a.ts||0).getTime());
    el.innerHTML = log.length 
        ? log.map(e => `<div class="act-entry"><div class="act-dot"></div><div style="flex:1"><div class="act-note">${window.esc(e.note||'')}</div><div class="act-ts">${fmtDate(e.ts)} · ${window.esc(e.by||'admin')}</div></div></div>`).join('') 
        : '<div class="loading">No activity logged yet</div>';
}

window.addActivityNote = async function() {
    if (!window.currentClient) return;
    const noteEl = $('dp-new-note');
    const note = noteEl ? noteEl.value.trim() : '';
    if (!note) { 
        if(window.toast) window.toast('Note is empty', 'error'); 
        return; 
    }
    const email = window.auth ? (window.auth.currentUser?.email || 'admin') : 'admin';
    const entry = { note, ts: nowTs(), by: email };
    try {
        await window.db.collection('clients').doc(window.currentClient.id).update({ 
            activityLog: firebase.firestore.FieldValue.arrayUnion(entry) 
        });
        if (noteEl) noteEl.value = '';
        if(window.toast) window.toast('Note added');
        window.openDetail(window.currentClient.id); 
    } catch(e) { if(window.toast) window.toast('Log failed', 'error'); }
};

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
                <div style="font-size:14px; color:var(--marble); font-weight:600; margin-bottom:4px;">${window.esc(r.company)}</div>
                <div style="font-size:11px; color:var(--marble-dim);">Founder: ${window.esc(r.name)} &bull; Email: ${window.esc(r.email)} &bull; Submitted: ${r.date || r.addedAt ? fmtDate(r.date || r.addedAt) : '—'}</div>
            </div>
            <div>
                ${r.credited 
                    ? `<span class="badge b-delivered">Reward Credited</span>` 
                    : `<button class="btn btn-primary btn-sm" onclick="window.creditReferral('${window.esc(c.id)}', ${idx})">Mark Credited</button>`
                }
            </div>
        </div>`).join('');
}

window.addReferral = async function() {
    if (!window.currentClient) return;
    const companyEl = $('dp-ref-co');
    const emailEl = $('dp-ref-email');
    const dateEl = $('dp-ref-date');
    
    const company = companyEl ? companyEl.value.trim() : ''; 
    const email = emailEl ? emailEl.value.trim() : ''; 
    const date = dateEl ? dateEl.value : '';
    
    if (!company && !email) { 
        if(window.toast) window.toast('Enter company or email', 'error'); 
        return; 
    }
    const entry = { company, email, date, addedAt: nowTs(), credited: false };
    try {
        await window.db.collection('clients').doc(window.currentClient.id).update({ 
            referrals: firebase.firestore.FieldValue.arrayUnion(entry) 
        });
        
        if (companyEl) companyEl.value = ''; 
        if (emailEl) emailEl.value = ''; 
        if (dateEl) dateEl.value = '';
        
        if(window.toast) window.toast('Referral added');
        window.openDetail(window.currentClient.id); 
    } catch(e) { if(window.toast) window.toast('Failed to add referral', 'error'); }
};

window.creditReferral = async function(clientId, refIdx) {
    if (!confirm('Mark referral as credited?')) return;
    try {
        const clientRef = window.db.collection('clients').doc(clientId);
        const doc = await clientRef.get();
        if (!doc.exists) return;
        const data = doc.data();
        data.referrals[refIdx].credited = true;
        await clientRef.update({ referrals: data.referrals });
        window.currentClient.referrals = data.referrals;
        populateDetailReferrals(window.currentClient);
        if(window.toast) window.toast('Referral credited.');
    } catch(err) { 
        if(window.toast) window.toast('Error crediting referral.', 'error'); 
    }
};

function populateDetailDebrief(c) {
    const wrap = $('dp-debrief-content');
    if (!wrap) return;
    if (!c.debrief) { 
        wrap.innerHTML = '<div class="loading" style="padding:20px 0;">No debrief submitted yet.</div>'; 
        return; 
    }
    const d = c.debrief;
    const rating = d.rating || 'N/A';
    const cText = d.catalyst || ''; 
    const pText = d.portal || ''; 
    const rText = d.result || '';
    const consentColor = d.consent ? '#7ab88a' : '#d47a7a';
    wrap.innerHTML = `
        <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border); padding:24px; margin-bottom:16px;">
            <div style="margin-bottom:20px;">
                <div style="font-size:10px; color:var(--gold); text-transform:uppercase;">1. The Verdict</div>
                <div style="font-size:14px; font-weight:bold; color:var(--gold);">${rating}/5 Stars</div>
            </div>
            <div style="margin-bottom:20px;">
                <div style="font-size:10px; color:var(--gold); text-transform:uppercase;">2. The Catalyst</div>
                <div style="font-size:13px; font-style:italic;">"${window.esc(cText)}"</div>
            </div>
            <div style="margin-bottom:20px;">
                <div style="font-size:10px; color:var(--gold); text-transform:uppercase;">3. The Portal</div>
                <div style="font-size:13px; font-style:italic;">"${window.esc(pText)}"</div>
            </div>
            <div style="margin-bottom:20px;">
                <div style="font-size:10px; color:var(--gold); text-transform:uppercase;">4. The Result</div>
                <div style="font-size:13px; font-style:italic;">"${window.esc(rText)}"</div>
            </div>
            <div style="padding-top:16px; border-top:1px solid var(--border); display:flex; align-items:center; gap:8px;">
                <div style="width:8px; height:8px; border-radius:50%; background:${consentColor};"></div>
                <div style="font-size:11px; color:var(--marble-dim);">${d.consent ? 'Authorized public marketing use.' : 'DID NOT authorize public use.'}</div>
            </div>
        </div>
        <div style="font-size:9px; text-transform:uppercase; color:var(--marble-dim); margin-bottom:6px;">Auto-Generated Marketing Copy</div>
        <textarea readonly style="width:100%; height:120px; background:var(--void); border:1px solid var(--border); color:var(--marble); padding:16px; font-size:13px; line-height:1.5; resize:none;">"Before Lex Nova, my biggest realization was ${window.esc(cText.toLowerCase())}. Now, ${window.esc(rText.toLowerCase())}. The ${window.esc(pText.toLowerCase())} feature gave me total peace of mind."</textarea>
    `;
}
