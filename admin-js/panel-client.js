// ════════════════════════════════════════════════════════════════════════
// ═════════ LEX NOVA ADMIN: FULFILLMENT ENGINE (panel-client.js) V5.5 ════
// ════════════════════════════════════════════════════════════════════════
// Schema aligned to vault.js V5.5 rebuild:
//   baseline.*        — Module 1 (company, products, jurisdiction, market,
//                        delivery, revenue, sla_type, integrations, threshold)
//   architecture.*    — Module 2 (memory, models, sub_processors, cloud/vector)
//   archetypes.*      — Module 3 (all 10 INT flags + agent limits)
//   compliance.*      — Module 4 (pii, eu/ca, sens_*, minors, distress)
//
// Backwards compat: falls back to old action_scopes.* and architecture.*
// fields so pre-V5.5 client records still render correctly.
//
// wh-s4 FIX: deployArchitecture() now reads webhookS4 from
//   /settings/config and fires it after Firestore status → delivered write.
// ════════════════════════════════════════════════════════════════════════
'use strict';

// ── LOCAL UTILITIES ────────────────────────────────────────────────────
var $c    = id => document.getElementById(id);
var qsac  = sel => Array.from(document.querySelectorAll(sel));
var nowTs = () => new Date().toISOString();

function fmtDateC(ts) {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return isNaN(d) ? '—' : d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
}
function fmtMoneyC(n) { return (n==null||isNaN(n)) ? '—' : '$'+Number(n).toLocaleString('en-US'); }
function setTextC(id,txt) { const el=$c(id); if(el) el.textContent=String(txt??''); }
function setValC(id,val)  { const el=$c(id); if(el) el.value=val??''; }

var planLabel = k => ({agentic_shield:'Agentic Shield',workplace_shield:'Workplace Shield',complete_stack:'Complete Stack',flagship:'Flagship'}[k]||k);
var PLAN_PRICES = {agentic_shield:997,workplace_shield:997,complete_stack:2500,flagship:15000};

// ── Schema helpers — read new schema, fall back to old ────────────────
function getB(c)     { return c.baseline      || {}; }
function getA(c)     { return c.architecture  || {}; }
function getArc(c)   { return c.archetypes    || {}; }
function getComp(c)  { return c.compliance    || {}; }
function getOld(c)   { return c.action_scopes || {}; } // legacy fallback

function isDoer(c)        { return !!(getArc(c).is_doer        || getOld(c).is_doer); }
function isOrch(c)        { return !!(getArc(c).is_orchestrator|| getOld(c).is_orchestrator); }
function isJudge(c)       { return !!(getArc(c).is_judge       || getOld(c).is_judge_hr || getOld(c).is_judge_fin || getOld(c).is_judge_legal); }
function isCompanion(c)   { return !!(getArc(c).conversational_ui || getOld(c).is_companion); }
function hasBio(c)        { return !!(getArc(c).sens_bio); }
function hasEU(c)         { return !!(getComp(c).eu_users   || getB(c).eu_users); }
function hasCA(c)         { return !!(getComp(c).ca_users   || getB(c).ca_users); }
function hasPII(c)        { return !!(getComp(c).processes_pii); }
function slaType(c)       { return getB(c).sla_type || (getOld(c)?.uptime !== 'none' ? 'standard' : 'no'); }
function finetuning(c)    { return getA(c).memory === 'finetuning'; }

// ════════════════════════════════════════════════════════════════════════
// ═════════ CORE PANEL ROUTING ════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
window.openDetail = async function(email) {
    const dp = $c('detailPanel');
    if (dp) { dp.style.maxWidth='100%'; dp.style.width='100%'; dp.style.left='0'; dp.classList.add('open'); }

    if (typeof window.loadRadarCache === 'function') await window.loadRadarCache();

    try {
        const docSnap = await window.db.collection('clients').doc(email).get();
        window.currentClient = { id:docSnap.id, ...docSnap.data() };
        const c = window.currentClient;

        setTextC('dp-name',  getB(c).company || c.name || c.id);
        setTextC('dp-email', `${c.id} · Ref: ${c.engagementRef||'—'}`);
        setTextC('dp-plan',  planLabel(c.plan));

        populateDetailOverview(c);
        populateDetailIntake(c);
        populateDetailChecklist(c);
        populateDetailDocuments(c);
        populateDetailRadar(c);
        populateDetailGap(c);
        populateDetailFinancials(c);
        populateDetailActivity(c);
        populateDetailReferrals(c);
        populateDetailDebrief(c);

        window.detailTab('overview');
    } catch(e) {
        console.error('Detail panel error:',e);
        if(window.toast) window.toast('Error loading client','error');
    }
};

window.closeDetail = function() {
    const dp=$c('detailPanel'); if(dp) dp.classList.remove('open');
    window.currentClient = null;
};

window.detailTab = function(key, el) {
    const tabs=['overview','intake','checklist','documents','radar','gap','financials','activity','referrals','debrief'];
    tabs.forEach(t => { const s=$c('dt-'+t); if(s) s.classList.add('hidden'); });
    const act=$c('dt-'+key); if(act) act.classList.remove('hidden');

    document.querySelectorAll('.sub-tab').forEach(b=>b.classList.remove('active'));
    if (el) { el.classList.add('active'); }
    else {
        const btn=document.querySelector(`.sub-tab[onclick*="'${key}'"]`);
        if(btn) btn.classList.add('active');
    }
};

// ════════════════════════════════════════════════════════════════════════
// ═════════ TAB 1: OVERVIEW ════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
function populateDetailOverview(c) {
    const sec = $c('dt-overview');
    if (!sec) return;

    const isAccepted = !!c.elAccepted;
    const b = getB(c); const arc=getArc(c);

    // All gaps — prefer scanner merged, fall back to Hunter forensicGaps
    const activeG  = c.activeGaps   || [];
    const forensicG= c.forensicGaps || [];
    const allGaps  = [...activeG];
    forensicG.forEach(fg=>{ if(!allGaps.find(ag=>ag.id===fg.id)) allGaps.push(fg); });
    allGaps.sort((a,b)=>({NUCLEAR:3,CRITICAL:2,HIGH:1}[b.severity]||0)-({NUCLEAR:3,CRITICAL:2,HIGH:1}[a.severity]||0));

    let gapHtml='';
    if (allGaps.length) {
        const ks=allGaps[0]; const ksc=ks.severity==='NUCLEAR'?'#ef4444':'#f97316';
        gapHtml=`<div style="border:1px solid ${ksc};background:rgba(239,68,68,.04);padding:12px;border-left:3px solid ${ksc};border-radius:3px;margin-bottom:10px;">
            <div style="color:${ksc};font-size:9px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;margin-bottom:5px;">🎯 Kill Shot (${ks.severity})</div>
            <div style="font-size:12px;font-weight:700;color:var(--marble);margin-bottom:4px;">${window.esc(ks.trap||ks.gapName||'—')}</div>
            <div style="font-size:10px;color:var(--marble-dim);">${window.esc(ks.plain||ks.pain||'—')}</div>
            <div style="font-size:10px;color:${ksc};margin-top:4px;font-weight:600;">Damage: ${window.esc(ks.damage||'Uncapped')}</div>
        </div>`;
    }

    sec.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;height:calc(100vh - 220px);overflow:hidden;">
        <div style="overflow-y:auto;padding-right:8px;display:flex;flex-direction:column;gap:16px;">
            <div class="card" style="padding:16px;">
                <div style="font-size:9px;color:var(--gold);text-transform:uppercase;letter-spacing:.1em;font-weight:700;margin-bottom:12px;">Intelligence Portfolio</div>
                <div style="margin-bottom:8px;"><label class="fl">INT Archetypes</label>
                    <div style="font-size:11px;color:var(--marble);">${window.esc((c.intArchetypes||[]).join(', ')||c.internalCategory||'—')}</div>
                </div>
                <div style="margin-bottom:8px;"><label class="fl">EXT Exposures</label>
                    <div style="font-size:11px;color:#ef4444;font-weight:600">${window.esc((c.extExposures||[]).join(', ')||'—')}</div>
                </div>
                <div style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid var(--border);">
                    <label class="fl">Product Signal</label>
                    <div style="font-size:11px;color:var(--marble-dim);line-height:1.5;">${window.esc(c.productSignal||'—')}</div>
                </div>
                ${gapHtml}
            </div>
        </div>

        <div style="overflow-y:auto;padding-right:8px;display:flex;flex-direction:column;gap:16px;">
            <div class="card" style="padding:16px;">
                <div style="font-size:9px;color:var(--gold);text-transform:uppercase;letter-spacing:.1em;font-weight:700;margin-bottom:12px;">Production Controls</div>

                <div class="el-status-block" style="margin-bottom:14px;">
                    <div class="el-status-row">
                        <span class="mono" style="font-size:8px">Pre-Payment EL</span>
                        <span class="${isAccepted?'el-status-ok':'el-status-miss'}">${isAccepted?'✓ Accepted':'Not Accepted'}</span>
                    </div>
                </div>
                ${!isAccepted?'<div class="el-lock" style="display:block;margin-bottom:12px;">⚠ EL not accepted — production locked.</div>':''}

                <div class="fi-row" style="margin-bottom:12px;">
                    <div class="fg"><label class="fl">Production Phase</label>
                        <select class="fi" id="dp-status" style="border-color:var(--gold);color:var(--gold);font-weight:600;">
                            <option value="payment_received"  ${c.status==='payment_received' ?'selected':''}>Payment Received</option>
                            <option value="intake_received"   ${c.status==='intake_received'  ?'selected':''}>Intake Received</option>
                            <option value="under_review"      ${c.status==='under_review'     ?'selected':''}>Under Review</option>
                            <option value="in_production"     ${c.status==='in_production'    ?'selected':''}>In Production</option>
                            <option value="delivered"         ${c.status==='delivered'        ?'selected':''}>Delivered</option>
                        </select>
                    </div>
                    <div class="fg"><label class="fl">Product Vertical</label>
                        <select class="fi" id="dp-plan-sel">
                            <option value="agentic_shield"  ${c.plan==='agentic_shield' ?'selected':''}>Agentic Shield</option>
                            <option value="workplace_shield"${c.plan==='workplace_shield'?'selected':''}>Workplace Shield</option>
                            <option value="complete_stack"  ${c.plan==='complete_stack' ?'selected':''}>Complete Stack</option>
                            <option value="flagship"        ${c.plan==='flagship'       ?'selected':''}>Flagship</option>
                        </select>
                    </div>
                </div>

                <div class="fg"><label class="fl">Architect Notes (Internal)</label>
                    <textarea class="fi" id="dp-notes" rows="4" placeholder="Production notes…">${window.esc(c.adminNotes||'')}</textarea>
                </div>

                <button class="btn btn-primary btn-full" style="margin-top:12px;padding:12px 0;" onclick="window.saveOverview()">💾 Update Production State</button>
            </div>
        </div>
    </div>`;
}

window.saveOverview = async function() {
    if (!window.currentClient) return;
    try {
        await window.db.collection('clients').doc(window.currentClient.id).update({
            status:     $c('dp-status')?.value,
            plan:       $c('dp-plan-sel')?.value,
            adminNotes: $c('dp-notes')?.value,
            updatedAt:  nowTs()
        });
        if(window.toast) window.toast('Client updated');
        if(typeof window.loadFactory==='function') window.loadFactory();
    } catch(e) { if(window.toast) window.toast('Update failed','error'); }
};

// ════════════════════════════════════════════════════════════════════════
// ═════════ TAB 2: INTAKE — V5.5 FULL 4-MODULE DISPLAY ═══════════════════
// ════════════════════════════════════════════════════════════════════════
function populateDetailIntake(c) {
    const el = $c('dp-intake-content');
    if (!el) return;

    const b    = getB(c);
    const a    = getA(c);
    const arc  = getArc(c);
    const comp = getComp(c);
    const old  = getOld(c);

    // Check if new vault data exists at all
    const hasNewVault = !!(b.company || arc.is_doer !== undefined || comp.eu_users !== undefined);
    const hasOldVault = !!old.uptime || !!c.architecture?.processes_pii;

    if (!hasNewVault && !hasOldVault) {
        el.innerHTML='<div class="loading">Waiting for client to submit the Vault.</div>'; return;
    }

    // ── WARNINGS ──
    let warn='';
    if (hasEU(c))     warn+=`<div style="font-size:11px;color:#d4a850;margin-bottom:6px;">⚠️ <strong>EU/UK Users:</strong> GDPR SCCs required → inject DOC_DPA §6.2/6.3/6.4 + Schedule D.</div>`;
    if (hasCA(c))     warn+=`<div style="font-size:11px;color:#d4a850;margin-bottom:6px;">⚠️ <strong>California Users:</strong> CCPA Service Provider shield → DOC_DPA §13.x + DOC_PP.</div>`;
    if (finetuning(c))warn+=`<div style="font-size:11px;color:#ef4444;margin-bottom:6px;">🔴 <strong>Fine-Tuning:</strong> Cannot mathematically delete user data. Override DPA deletion clauses.</div>`;
    if (isDoer(c))    warn+=`<div style="font-size:11px;color:#ef4444;margin-bottom:6px;">🔴 <strong>Autonomous Actions:</strong> UETA §14 agency liability. DOC_AGT required.</div>`;
    if (hasBio(c))    warn+=`<div style="font-size:11px;color:#ef4444;margin-bottom:6px;">🔴 <strong>Biometrics:</strong> BIPA strict liability. DOC_AUP §3.6 pass-through mandate required.</div>`;
    if (comp.minors)  warn+=`<div style="font-size:11px;color:#ef4444;margin-bottom:6px;">🔴 <strong>Minors:</strong> COPPA + CA SB 243 + NY S3008. Crisis escalation protocols required.</div>`;

    const row  = (label,val,gold) => `<div style="font-size:11px;margin-bottom:6px;"><span class="dim">${label}:</span> <strong ${gold?'style="color:var(--gold)"':''}>${window.esc(String(val??'—'))}</strong></div>`;
    const bool = (label,val)      => row(label, val?'Yes':'No', val);
    const sep  = title            => `<div style="font-size:9px;color:var(--gold);text-transform:uppercase;letter-spacing:.1em;border-bottom:1px solid var(--border);padding-bottom:5px;margin:14px 0 10px;">${title}</div>`;

    // Products array
    const products = b.products||[];
    const prodHtml = products.length
        ? products.map((p,i)=>`<div style="background:var(--surface2);border:1px solid var(--border);padding:8px 10px;margin-bottom:6px;border-radius:3px;"><div style="font-size:10px;font-weight:600;color:var(--marble);">${window.esc(p.name||`Product ${i+1}`)}</div>${p.desc?`<div style="font-size:9px;color:var(--marble-dim);margin-top:2px;">${window.esc(p.desc)}</div>`:''}</div>`).join('')
        : '<div style="font-size:11px;color:var(--marble-dim);">—</div>';

    // Sub-processors
    const sub = a.sub_processors||{};
    const subNames = ['openai','anthropic','google','cohere','mistral'].filter(k=>sub[k]).map(k=>k.charAt(0).toUpperCase()+k.slice(1));
    if (sub.other) subNames.push(sub.other);
    const subDisplay = subNames.length ? subNames.join(', ') : '—';

    // Integrations
    const ints = b.integrations||{};
    const intNames = Object.entries(ints).filter(([k,v])=>v&&k!=='none').map(([k])=>k);
    const intDisplay = intNames.length ? intNames.join(', ') : (ints.none?'None':'—');

    // Agent limits
    const lims = arc.agent_limits||{};

    el.innerHTML = `
    ${warn?`<div style="background:rgba(197,160,89,.08);border:1px solid var(--gold);padding:14px;margin-bottom:18px;">
        <div style="font-size:9px;color:var(--gold);text-transform:uppercase;letter-spacing:.1em;font-weight:700;margin-bottom:8px;">Architectural Tripwires Triggered</div>
        ${warn}
    </div>`:''}

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
        <div>
            ${sep('Module 1 — Baseline & Commercials')}
            ${row('Company',       b.company)}
            ${row('Entity Type',   b.entity_type)}
            ${row('Address',       b.address)}
            ${row('Legal Email',   b.legal_email)}
            ${row('Privacy Email', b.privacy_email)}
            ${row('Jurisdiction',  (b.jurisdiction?.state?b.jurisdiction.state+', ':'')+b.jurisdiction?.country)}
            ${row('Market',        b.market?.toUpperCase())}
            ${row('Delivery',      [b.delivery?.app?'App':'',b.delivery?.api?'API':''].filter(Boolean).join(' + ')||'—')}
            ${row('Revenue Model', b.revenue_model)}
            ${row('ACV',           b.acv?fmtMoneyC(b.acv):'—')}
            ${bool('Beta / Free Tier', b.has_beta)}
            ${row('Output Ownership', b.output_ownership)}
            ${row('SLA Type',     b.sla_type||'—')}
            ${row('Integrations', intDisplay)}
            ${row('Reliance Threshold', b.reliance_threshold?fmtMoneyC(b.reliance_threshold):'—')}

            <div style="margin-top:10px;"><label class="fl">Products</label>${prodHtml}</div>

            ${sep('Module 2 — Tech Stack & AI Memory')}
            ${row('AI Memory',     a.memory?.toUpperCase())}
            ${row('Model Infra',   a.models?.toUpperCase())}
            ${row('Sub-Processors', subDisplay)}
            ${sub.url?row('Sub-Processor URL', sub.url):''}
            ${row('Cloud Host',    a.cloud_host)}
            ${row('Vector DB',     a.vector_db)}
        </div>

        <div>
            ${sep('Module 3 — AI Archetypes')}
            ${bool('The Doer (Autonomous)',       isDoer(c))}
            ${isDoer(c)?`
                <div style="padding:8px 10px;background:var(--surface2);border:1px solid var(--border);margin-bottom:8px;font-size:10px;border-left:2px solid var(--gold);">
                    <div>↳ Session Cap: <strong>${window.esc(lims.session_cap||getOld(c).spend_limit||'—')}</strong></div>
                    <div>↳ Period Cap: <strong>${window.esc(lims.period_cap||'—')}</strong></div>
                    <div>↳ Retry Limit: <strong>${window.esc(lims.retry_limit||'—')}</strong></div>
                    <div>↳ Loop Threshold: <strong>${window.esc(lims.loop_threshold||'—')}</strong></div>
                </div>`:''}
            ${bool('The Orchestrator',            isOrch(c))}
            ${bool('The Creator (Gen Media)',      arc.is_creator)}
            ${bool('The Reader (RAG/Scraping)',    arc.is_reader)}
            ${bool('The Companion (Chatbot/Voice)',isCompanion(c))}
            ${bool('The Translator (Biometrics)',  hasBio(c))}
            ${bool('The Judge (High-Stakes)',       isJudge(c))}
            ${bool('The Optimizer',                arc.is_optimizer)}
            ${bool('The Shield (Cyber Defense)',   arc.is_shield)}
            ${bool('The Mover (Hardware)',         arc.is_mover)}
            ${bool('Catch-All (Generalist)',       arc.is_generalist)}

            ${sep('Module 4 — Compliance Exposures')}
            ${bool('Processes PII',                hasPII(c))}
            ${bool('EU / UK Users',                hasEU(c))}
            ${bool('California Users',             hasCA(c))}
            ${bool('Other Regions',                comp.other_regions)}
            ${bool('Medical / Biometric Data',     comp.sens_health)}
            ${bool('Financial Data',               comp.sens_fin)}
            ${bool('Employment / HR Data',         comp.sens_employment)}
            ${bool('Minors',                       comp.minors)}
            ${bool('Consumers in Distress',        comp.distress)}
        </div>
    </div>`;
}

// ════════════════════════════════════════════════════════════════════════
// ═════════ TAB 3: CHECKLIST — DYNAMIC DEATH CHECKS V5.5 ═════════════════
// ════════════════════════════════════════════════════════════════════════
function populateDetailChecklist(c) {
    const el=$c('dp-checklist-items'); if(!el)return;

    const arc=getArc(c); const comp=getComp(c); const b=getB(c); const a=getA(c);

    const core=[
        'Payment successfully captured.',
        'Pre-Payment Engagement Letter (Stage 1) accepted.',
        'Master ToS and Privacy Policy drafted.',
        'Client legal name and jurisdiction verified across all documents.'
    ];

    const death=[];
    if (hasEU(c))          death.push('DEATH CHECK: Verify GDPR SCCs injected into DOC_DPA §6.2/6.3/6.4 + Schedule D.');
    if (hasCA(c))          death.push('DEATH CHECK: Verify CCPA Service Provider clause in DOC_DPA §13.x and DOC_PP.');
    if (finetuning(c))     death.push('DEATH CHECK: Fine-Tuning detected — override DPA deletion clauses. Data cannot be mathematically removed from model weights.');
    if (isDoer(c)) {
        death.push('DEATH CHECK: Verify DOC_AGT (Agentic Addendum) generated.');
        const sc=arc.agent_limits?.session_cap||c.action_scopes?.spend_limit;
        death.push(`DEATH CHECK: Circuit Breaker hardcoded to ${sc||'Session Limit'} in DOC_AGT Schedule C.`);
        death.push('DEATH CHECK: Kill Switch (/terminate) requirement injected into DOC_AGT.');
    }
    if (isJudge(c))        death.push('DEATH CHECK: HITL disclaimer bolded in DOC_TOS §5.1. Mandatory bias audit burden shifted to deployer in DOC_AUP §3.4(a).');
    if (hasBio(c))         death.push('DEATH CHECK: BIPA pass-through prohibition injected into DOC_AUP §3.6. Written consent requirement explicit.');
    if (arc.is_creator)    death.push('DEATH CHECK: Output Conditional License injected into DOC_TOS §6.2. Thaler public domain risk disclosed.');
    if (arc.is_reader)     death.push('DEATH CHECK: RAG-Only Mandate injected into DOC_DPA §4.1. FTC disgorgement shield active.');
    if (arc.is_optimizer)  death.push('DEATH CHECK: Prohibited Reliance clause for critical infrastructure in DOC_TOS §5.4(f). Algo-ID traceability in DOC_AGT §6.4.');
    if (arc.is_mover)      death.push('DEATH CHECK: PLD Waiver in DOC_TOS §2.2 — AI software classified as licensed Service not Product.');
    if (arc.is_shield)     death.push('DEATH CHECK: False Negative liability cap in DOC_TOS §9.2. Immutable action logging in DOC_AGT §7.1.');
    if (comp.minors)       death.push('DEATH CHECK: COPPA + CA SB 243 + NY S3008 compliance injected into DOC_AUP §3.5. Crisis break protocols active.');
    if (comp.distress)     death.push('DEATH CHECK: Vulnerable users clause injected into DOC_TOS §5.5.');
    if (comp.sens_health)  death.push('DEATH CHECK: HIPAA AUP block injected — DOC_AUP §3.1.');
    if (comp.sens_fin)     death.push('DEATH CHECK: Financial surface restrictions in DOC_AUP §3.2.');
    if (comp.sens_employment) death.push('DEATH CHECK: Employment/HR restrictions in DOC_AUP §3.4.');
    if (b.sla_type && b.sla_type!=='no') death.push(`DEATH CHECK: DOC_SLA generated for SLA type [${b.sla_type.toUpperCase()}]. Verify uptime and TTFT targets populated in Schedule A.`);

    const saved=c.checklistState||{};
    let html=''; let idx=0;

    const renderSection=(title,items,isDeath)=>{
        if(!items.length)return;
        const col=isDeath?'#d47a7a':'var(--gold)';
        html+=`<div style="margin-top:14px;margin-bottom:8px;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:${col};border-bottom:1px solid ${isDeath?'rgba(212,122,122,.25)':'var(--border)'};padding-bottom:4px;">${title}</div>`;
        items.forEach(item=>{
            const done=!!saved[idx];
            html+=`<div class="chk-item" style="display:flex;align-items:flex-start;gap:10px;padding:7px 0;border-bottom:1px solid rgba(197,160,89,.05);">
                <div class="chk-box ${done?'done':''} ${isDeath?'death-check':''}" id="chk-box-${idx}" style="width:16px;height:16px;border:1px solid var(--border2);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px;${done?'background:var(--gold-dim);border-color:var(--gold);':''}" onclick="window.toggleChk(this,${idx})">
                    <span class="chk-tick" style="color:var(--gold);font-size:10px;display:${done?'block':'none'}">✓</span>
                </div>
                <span id="chk-label-${idx}" style="font-size:11px;line-height:1.4;${done?'color:var(--marble-dim);text-decoration:line-through;':'color:var(--marble);'}">${window.esc(item)}</span>
            </div>`;
            idx++;
        });
    };

    renderSection('Core Operations', core, false);
    renderSection('Death Checks (Conditional)', death, true);

    if (!death.length) html+=`<div class="dim" style="font-size:11px;padding:10px 0;">No severe Death Checks triggered. Standard deployment.</div>`;

    el.innerHTML=html;
}

window.toggleChk = function(el,i) {
    el.classList.toggle('done');
    const done=el.classList.contains('done');
    el.style.background=done?'var(--gold-dim)':'transparent';
    el.style.borderColor=done?'var(--gold)':'var(--border2)';
    el.querySelector('.chk-tick').style.display=done?'block':'none';
    const lbl=$c(`chk-label-${i}`);
    if(lbl){lbl.style.color=done?'var(--marble-dim)':'var(--marble)';lbl.style.textDecoration=done?'line-through':'none';}
    window.saveChecklistState();
};

window.saveChecklistState = async function() {
    if(!window.currentClient)return;
    const state={};
    qsac('.chk-box').forEach(box=>{const id=box.id.replace('chk-box-','');state[id]=box.classList.contains('done');});
    try{await window.db.collection('clients').doc(window.currentClient.id).update({checklistState:state});}
    catch(e){console.error('Checklist save failed:',e);}
};

// ════════════════════════════════════════════════════════════════════════
// ═════════ TAB 4: DOCUMENTS — V5.5 SCHEMA + wh-s4 FIX ═══════════════════
// ════════════════════════════════════════════════════════════════════════
function populateDetailDocuments(c) {
    const container=$c('docsContainer'); if(!container)return;
    container.innerHTML='';

    const isAgentic   = ['agentic_shield','complete_stack','flagship'].includes(c.plan);
    const isWorkplace = ['workplace_shield','complete_stack','flagship'].includes(c.plan);

    const arc=getArc(c); const b=getB(c); const a=getA(c);
    const files=c.files||{};

    container.innerHTML+=`
    <div class="card" style="margin-bottom:20px;border-color:var(--gold-mid);background:var(--void);">
        <div style="font-size:10px;color:var(--gold);text-transform:uppercase;letter-spacing:.1em;margin-bottom:10px;font-weight:700;">1. Architect's Walkthrough Video</div>
        <div class="fg" style="margin-bottom:0;"><label class="fl">Loom / Clipchamp URL</label>
            <input type="text" class="fi" id="doc-video-link" value="${window.esc(c.walkthroughUrl||'')}" placeholder="https://…">
        </div>
    </div>
    <div style="font-size:10px;color:var(--gold);text-transform:uppercase;letter-spacing:.1em;margin-bottom:12px;font-weight:700;margin-top:24px;">2. Document Payload</div>`;

    const slot=(docId,title,sub,req)=>{
        const val=files[docId]||'';
        return `<div class="doc-row" style="opacity:${req?1:.5};margin-bottom:10px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;flex-wrap:wrap;gap:8px;">
                <span style="color:var(--marble);font-weight:700;font-size:12px;">${docId} — ${title}</span>
                ${!req?'<span style="font-size:9px;color:var(--marble-dim);border:1px solid var(--border);padding:2px 6px;">Not Required</span>':''}
            </div>
            <div style="font-size:10px;color:var(--marble-dim);margin-bottom:${req?'12px':'0'};">${sub}</div>
            ${req?`<div class="fg" style="margin-bottom:0;">
                <label class="fl">Final PDF URL</label>
                <input type="text" class="fi payload-input" data-docid="${docId}" value="${window.esc(val)}" placeholder="https://…">
            </div>`:''}
        </div>`;
    };

    let html='';
    if (isAgentic) {
        html+=slot('DOC_TOS', 'Terms of Service',           'Core operating terms, liability limits, AI output disclaimers.',true);
        html+=slot('DOC_PP',  'Privacy Policy',             'Data collection, storage, global privacy law compliance.',true);
        html+=slot('DOC_AUP', 'Acceptable Use Policy',      'Prohibits prompt injection, jailbreaking, malicious use.',true);
        // Use new schema: compliance.processes_pii (fall back to architecture.processes_pii)
        const reqDPA = hasPII(c) !== false;
        html+=slot('DOC_DPA', 'Data Processing Agreement',  'GDPR/CCPA compliance, RAG-Only mandate, algorithmic disgorgement shield.',reqDPA);
        // New schema: archetypes.is_doer
        html+=slot('DOC_AGT', 'Agentic Addendum',           'Waives liability for autonomous actions, circuit breakers, kill switch.',isDoer(c));
        // New schema: baseline.sla_type
        const reqSLA = b.sla_type && b.sla_type!=='no';
        html+=slot('DOC_SLA', 'Service Level Agreement',    'Uptime and TTFT performance guarantees.',reqSLA);
        html+=slot('DOC_PBK_A','Negotiation Playbook',      'Enterprise procurement defense — exact scripts, concession limits.',true);
    }
    if (isWorkplace) {
        html+=slot('DOC_SCAN', 'Shadow AI Audit',           'Internal risk matrix mapping unauthorized AI tool usage.',true);
        html+=slot('DOC_HND',  'Employee AI Handbook',      'Corporate guidelines — permitted AI tools on company networks.',true);
        html+=slot('DOC_IP',   'IP Ownership Deed',         'Ensures company owns all AI-generated code, copy, and assets.',true);
        html+=slot('DOC_SOP',  'HITL Protocol',             'Human-in-the-loop verification SOPs before deploying AI outputs.',true);
        html+=slot('DOC_DPIA', 'Impact Assessment',         'Data Protection Impact Assessment for internal AI deployments.',true);
        html+=slot('DOC_PBK_B','Operations Playbook',       'Managerial deployment guide for Workplace Shield across teams.',true);
    }

    container.innerHTML+=html;
    container.innerHTML+=`
    <button class="btn btn-primary btn-full" style="margin-top:24px;padding:18px 0;font-size:13px;letter-spacing:.15em;font-weight:800;border:1px solid var(--gold);background:var(--gold-dim);color:var(--gold);" onclick="window.deployArchitecture()">
        🚀 DEPLOY ARCHITECTURE & CLOSE SLA
    </button>`;
}

// ── DEPLOY — with wh-s4 fix ───────────────────────────────────────────
window.deployArchitecture = async function() {
    if (!window.currentClient) return;

    // Validate Death Checks
    const deathBoxes=qsac('.death-check');
    if (deathBoxes.length) {
        const allDone=deathBoxes.every(b=>b.classList.contains('done'));
        if (!allDone) {
            if(window.toast) window.toast('Cannot deploy — Death Checks incomplete.','error');
            window.detailTab('checklist');
            return;
        }
    }

    // Collect file URLs
    const files={};
    qsac('.payload-input').forEach(inp=>{
        const id=inp.getAttribute('data-docid'); const url=inp.value.trim();
        if(url) files[id]=url;
    });
    const videoUrl=$c('doc-video-link')?.value?.trim()||'';
    const deliveredAt=nowTs();

    try {
        await window.db.collection('clients').doc(window.currentClient.id).update({
            files, walkthroughUrl:videoUrl, status:'delivered', deliveredAt
        });

        // ── wh-s4 FIX: read webhook URL from /settings/config, fire it ──
        try {
            const cfgSnap = await window.db.collection('settings').doc('config').get();
            const wh4 = cfgSnap.exists ? (cfgSnap.data().webhookS4||'') : '';
            if (wh4) {
                const c=window.currentClient; const b=getB(c);
                fetch(wh4, {
                    method:'POST',
                    headers:{'Content-Type':'application/json'},
                    body: JSON.stringify({
                        email:       c.id,
                        name:        c.name || b.company || '',
                        company:     b.company || c.company || '',
                        plan:        c.plan,
                        files,
                        walkthroughUrl: videoUrl,
                        deliveredAt,
                        engagementRef: c.engagementRef||'',
                        timestamp:   deliveredAt
                    })
                }).catch(e=>console.warn('wh-s4 fire failed (non-critical):',e));
            } else {
                console.warn('wh-s4 not configured — delivery email will not fire. Set it in Engine Room → Settings.');
            }
        } catch(e) { console.warn('wh-s4 settings read failed:',e); }

        if(window.toast) window.toast('Architecture Deployed. Portal Unlocked. Delivery email firing.');
        window.closeDetail();
        if(typeof window.loadFactory==='function') window.loadFactory();
    } catch(e) {
        console.error(e);
        if(window.toast) window.toast('Deployment failed','error');
    }
};

// ════════════════════════════════════════════════════════════════════════
// ═════════ TAB 5: RADAR — DATE DELTA ENGINE (Option B) ═══════════════════
// ════════════════════════════════════════════════════════════════════════
// GREEN  = effectiveDate <= deliveredAt   (kit was built covering it)
// RED    = effectiveDate > deliveredAt AND effectiveDate <= today  (active gap)
// YELLOW = effectiveDate > today          (upcoming — maintenance upsell)
// ════════════════════════════════════════════════════════════════════════
function populateDetailRadar(c) {
    const el=$c('dp-radar-list'); if(!el)return;
    el.innerHTML='<div class="loading">Calculating exposure…</div>';

    const radarEntries=window.radarEntries||[];
    if (!radarEntries.length) {
        el.innerHTML='<div class="empty">No regulations in database yet. Add entries in the Regulation DB tab.</div>';
        return;
    }

    const today      = new Date(); today.setHours(0,0,0,0);
    const deliveredAt = c.deliveredAt
        ? (c.deliveredAt.toDate ? c.deliveredAt.toDate() : new Date(c.deliveredAt))
        : null;
    const hasDelivery= !!(deliveredAt && !isNaN(deliveredAt));

    // Bridge function from admin-engine.js — use the same matching logic
    // (defined on window via admin-engine.js)
    const matchFn = typeof window._clientMatchesRegulation === 'function'
        ? window._clientMatchesRegulation
        : (reg, client) => {
            // Inline fallback so radar works even if admin-engine loads after
            if (reg.target_all) return true;
            const intT=reg.intTriggers||reg.target_int||[];
            const extT=reg.extTriggers||reg.target_ext||[];
            if (intT.includes('UNIVERSAL')) return true;
            const arc=getArc(client); const comp=getComp(client); const b2=getB(client); const a2=getA(client);
            const intMap={'INT.01':isDoer,'INT.02':isOrch,'INT.03':cl=>!!getArc(cl).is_creator,'INT.04':isCompanion,'INT.05':cl=>!!getArc(cl).is_reader,'INT.06':hasBio,'INT.07':isJudge,'INT.08':cl=>!!getArc(cl).is_shield,'INT.09':cl=>!!getArc(cl).is_optimizer,'INT.10':cl=>!!getArc(cl).is_mover,'is_doer':isDoer,'is_orchestrator':isOrch,'is_judge_hr':cl=>!!(getArc(cl).is_judge_hr||getOld(cl).is_judge_hr),'is_companion':isCompanion,'finetuning':finetuning,'selfhosted':cl=>getA(cl).models==='selfhosted'};
            const extMap={'EXT.01':hasEU,'EXT.02':hasCA,'EXT.03':hasPII,'EXT.04':hasBio,'EXT.06':cl=>!!getComp(cl).minors,'EXT.07':cl=>!!(getArc(cl).is_judge_hr||getComp(cl).sens_employment),'EXT.08':cl=>['b2c','hybrid'].includes(getB(cl).market)||!getB(cl).market,'EXT.09':cl=>['b2b','hybrid'].includes(getB(cl).market)||!getB(cl).market,'EXT.10':cl=>!getA(cl).models||getA(cl).models==='thirdparty','eu_users':hasEU,'ca_users':hasCA,'processes_pii':hasPII,'sensitive_data':cl=>!!(getComp(cl).sens_health||getComp(cl).sens_fin||getComp(cl).sens_employment||getArc(cl).sens_bio)};
            for(const t of intT){const fn=intMap[t];if(fn&&fn(client))return true;}
            for(const t of extT){const fn=extMap[t];if(fn&&fn(client))return true;}
            return false;
        };

    const relevant = radarEntries.filter(reg => matchFn(reg, c));
    if (!relevant.length) {
        el.innerHTML='<div class="empty">No regulations matched for this client\'s architecture.</div>';
        return;
    }

    const green=[], yellow=[], red=[];

    relevant.forEach(reg => {
        const effDate = reg.effectiveDate ? new Date(reg.effectiveDate) : null;
        if (!effDate || isNaN(effDate)) { yellow.push({reg,label:'Date Unknown'}); return; }
        effDate.setHours(0,0,0,0);

        if (!hasDelivery) {
            // Not delivered yet — bucket by effective date vs today
            if (effDate<=today) yellow.push({reg,label:'Active — pre-delivery'});
            else yellow.push({reg,label:`Activates ${Math.ceil((effDate-today)/86400000)}d from now`});
        } else {
            if (effDate<=deliveredAt) {
                const dBefore=Math.ceil((deliveredAt-effDate)/86400000);
                green.push({reg,label:`Covered — active ${dBefore}d before kit delivery`});
            } else if (effDate>today) {
                const dUntil=Math.ceil((effDate-today)/86400000);
                yellow.push({reg,label:`Activating in ${dUntil} days`});
            } else {
                const dAfter=Math.ceil((today-effDate)/86400000);
                const dFromDel=Math.ceil((effDate-deliveredAt)/86400000);
                red.push({reg,label:`Active. Came into force ${dFromDel}d after delivery (${dAfter}d ago)`});
            }
        }
    });

    const hasMaint = !!c.maintenanceActive;
    const needsMaint = red.length > 0 || yellow.length > 0;

    const renderCard=(item,bucket)=>{
        const reg=item.reg;
        const sev=reg.severity||'—';
        const intT=(reg.intTriggers||reg.target_int||[]).join(', ')||'—';
        const extT=(reg.extTriggers||reg.target_ext||[]).join(', ')||'—';
        const colors={GREEN:{bar:'#5a8a6a',bg:'rgba(90,138,106,.06)',badge:'b-green',lbl:'#7ab88a'},RED:{bar:'#8a3a3a',bg:'rgba(138,58,58,.08)',badge:'b-red',lbl:'#d47a7a'},YELLOW:{bar:'#9a8030',bg:'rgba(154,128,48,.08)',badge:'b-yellow',lbl:'#c4a840'}};
        const col=colors[bucket];
        return `<div style="background:${col.bg};border:1px solid ${col.bar}20;border-left:3px solid ${col.bar};padding:12px;margin-bottom:8px;border-radius:3px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:6px;margin-bottom:6px;">
                <div style="flex:1;">
                    <div style="font-size:11px;font-weight:600;color:var(--marble);">${window.esc(reg.title||reg.Founder_Threat||'—')}</div>
                    ${reg.legalAmmo?`<div style="font-size:9px;color:var(--marble-faint);font-style:italic;">${window.esc(reg.legalAmmo)}</div>`:''}
                </div>
                <span class="badge ${col.badge}" style="flex-shrink:0">${sev}</span>
            </div>
            <div style="font-size:10px;color:${col.lbl};font-weight:600;margin-bottom:6px;">${window.esc(item.label)}</div>
            ${reg.thePain?`<div style="font-size:10px;color:var(--marble-dim);margin-bottom:4px;">${window.esc(reg.thePain.substring(0,120))}${reg.thePain.length>120?'…':''}</div>`:''}
            <div style="font-size:9px;color:var(--marble-faint);font-family:monospace;">INT:[${window.esc(intT)}] EXT:[${window.esc(extT)}]</div>
            ${reg.theFix?`<div style="font-size:9px;color:var(--gold);margin-top:4px;font-weight:600;">Fix: ${window.esc(reg.theFix)}</div>`:''}
        </div>`;
    };

    let html='';

    // Stats bar
    html+=`<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;">
        <div style="background:rgba(138,58,58,.1);border:1px solid rgba(138,58,58,.3);padding:6px 14px;flex:1;min-width:80px;text-align:center;">
            <div style="font-size:20px;color:#d47a7a;font-family:'Cormorant Garamond',serif;">${red.length}</div>
            <div style="font-size:8px;color:#d47a7a;text-transform:uppercase;letter-spacing:.1em;">🔴 Exposed</div>
        </div>
        <div style="background:rgba(154,128,48,.08);border:1px solid rgba(154,128,48,.25);padding:6px 14px;flex:1;min-width:80px;text-align:center;">
            <div style="font-size:20px;color:#c4a840;font-family:'Cormorant Garamond',serif;">${yellow.length}</div>
            <div style="font-size:8px;color:#c4a840;text-transform:uppercase;letter-spacing:.1em;">🟡 Scheduled</div>
        </div>
        <div style="background:rgba(90,138,106,.08);border:1px solid rgba(90,138,106,.25);padding:6px 14px;flex:1;min-width:80px;text-align:center;">
            <div style="font-size:20px;color:#7ab88a;font-family:'Cormorant Garamond',serif;">${green.length}</div>
            <div style="font-size:8px;color:#7ab88a;text-transform:uppercase;letter-spacing:.1em;">✓ Covered</div>
        </div>
    </div>`;

    // Maintenance upsell if needed
    if (needsMaint && !hasMaint) {
        html+=`<div style="background:rgba(197,160,89,.06);border:1px solid var(--gold-mid);padding:14px;margin-bottom:16px;">
            <div style="font-size:10px;color:var(--gold);font-weight:700;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px;">⚡ Active Shields Recommended</div>
            <div style="font-size:11px;color:var(--marble-dim);margin-bottom:8px;">${red.length} exposed + ${yellow.length} incoming regulations. Client is not on maintenance. <strong>$297/month</strong> closes these gaps.</div>
            <button class="btn btn-primary btn-sm" onclick="window.detailTab('financials')">Activate Maintenance →</button>
        </div>`;
    } else if (hasMaint) {
        html+=`<div style="background:rgba(90,138,106,.06);border:1px solid rgba(90,138,106,.3);padding:10px 14px;margin-bottom:16px;font-size:10px;color:#7ab88a;">✓ Active Shields subscription active — maintenance patches cover incoming regulations.</div>`;
    }

    if (!hasDelivery) {
        html+=`<div style="background:rgba(90,90,150,.08);border:1px solid rgba(90,90,180,.2);padding:10px 14px;margin-bottom:16px;font-size:10px;color:#7a7ae0;">ⓘ Kit not yet delivered — date delta engine will activate on deployment. Showing current exposure status.</div>`;
    }

    if (red.length)    { html+=`<div style="font-size:9px;color:#d47a7a;text-transform:uppercase;letter-spacing:.1em;font-weight:700;margin-bottom:8px;">🔴 EXPOSED — Active After Delivery (${red.length})</div>`; red.forEach(it=>html+=renderCard(it,'RED')); }
    if (yellow.length) { html+=`<div style="font-size:9px;color:#c4a840;text-transform:uppercase;letter-spacing:.1em;font-weight:700;margin:14px 0 8px;">🟡 SCHEDULED — Upcoming (${yellow.length})</div>`; yellow.forEach(it=>html+=renderCard(it,'YELLOW')); }
    if (green.length) {
        html+=`<div style="font-size:9px;color:#7ab88a;text-transform:uppercase;letter-spacing:.1em;font-weight:700;margin:14px 0 8px;">✓ COVERED BY KIT (${green.length}) <button onclick="this.closest('div').nextElementSibling.classList.toggle('hidden');this.textContent=this.closest('div').nextElementSibling.classList.contains('hidden')?'Show':'Hide';" class="btn btn-ghost btn-sm" style="margin-left:8px;">Show</button></div>`;
        html+=`<div class="hidden">${green.map(it=>renderCard(it,'GREEN')).join('')}</div>`;
    }

    el.innerHTML=html;
}

// ════════════════════════════════════════════════════════════════════════
// ═════════ TABS 6-10: LEGACY (UNCHANGED SCHEMA) ══════════════════════════
// ════════════════════════════════════════════════════════════════════════
function populateDetailGap(c) {
    const g=c.gapReview||{};
    setValC('dp-gap-status',  g.status||'');
    setValC('dp-gap-scope',   g.scopeSummary||'');
    setValC('dp-gap-invoice', g.invoiceUrl||'');
}

window.saveGap = async function() {
    if(!window.currentClient)return;
    const gap={status:$c('dp-gap-status')?.value||'',scopeSummary:$c('dp-gap-scope')?.value?.trim()||'',invoiceUrl:$c('dp-gap-invoice')?.value?.trim()||'',updatedAt:nowTs()};
    try{await window.db.collection('clients').doc(window.currentClient.id).update({gapReview:gap});if(window.toast)window.toast('Gap Review saved ($497)');}
    catch(e){if(window.toast)window.toast('Save failed','error');}
};

function populateDetailFinancials(c) {
    const price=c.price||PLAN_PRICES[c.plan]||0;
    setTextC('dp-price',fmtMoneyC(price));
    const cb=$c('dp-maint'); if(cb) cb.checked=!!c.maintenanceActive;
    const fields=$c('dp-maint-fields'); if(fields) fields.style.display=c.maintenanceActive?'block':'none';
    setValC('dp-maint-id',    c.maintenanceSubscriptionId||c.subscriptionId||'');
    setValC('dp-maint-start', c.maintenanceStartDate||'');
}

window.toggleMaint = function(checked) {
    const f=$c('dp-maint-fields'); if(f) f.style.display=checked?'block':'none';
};

window.saveMaint = async function() {
    if(!window.currentClient)return;
    try{
        await window.db.collection('clients').doc(window.currentClient.id).update({
            maintenanceActive:          $c('dp-maint')?.checked,
            maintenanceSubscriptionId:  $c('dp-maint-id')?.value||'',
            maintenanceStartDate:       $c('dp-maint-start')?.value||'',
            updatedAt:nowTs()
        });
        if(window.toast)window.toast('Maintenance saved');
    }catch(e){if(window.toast)window.toast('Save failed','error');}
};

function populateDetailActivity(c) {
    const el=$c('dp-activity-log'); if(!el)return;
    const log=[...(c.activityLog||[])].sort((a,b)=>new Date(b.ts||0).getTime()-new Date(a.ts||0).getTime());
    el.innerHTML=log.length
        ?log.map(e=>`<div class="act-entry"><div class="act-dot"></div><div style="flex:1"><div class="act-note">${window.esc(e.note||'')}</div><div class="act-ts">${fmtDateC(e.ts)} · ${window.esc(e.by||'admin')}</div></div></div>`).join('')
        :'<div class="loading">No activity logged yet</div>';
}

window.addActivityNote = async function() {
    if(!window.currentClient)return;
    const noteEl=$c('dp-new-note'); const note=noteEl?noteEl.value.trim():'';
    if(!note){if(window.toast)window.toast('Note is empty','error');return;}
    const by=window.auth?.currentUser?.email||'admin';
    const entry={note,ts:nowTs(),by};
    try{
        await window.db.collection('clients').doc(window.currentClient.id).update({activityLog:firebase.firestore.FieldValue.arrayUnion(entry)});
        if(noteEl)noteEl.value='';
        if(window.toast)window.toast('Note added');
        window.openDetail(window.currentClient.id);
    }catch(e){if(window.toast)window.toast('Log failed','error');}
};

function populateDetailReferrals(c) {
    const wrap=$c('dp-ref-list'); if(!wrap)return;
    if(!c.referrals||!c.referrals.length){wrap.innerHTML='<div class="loading" style="padding:16px 0">No referrals yet.</div>';return;}
    wrap.innerHTML=c.referrals.map((r,idx)=>`
    <div style="background:rgba(255,255,255,.02);border:1px solid var(--border);padding:14px;display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:10px;">
        <div>
            <div style="font-size:13px;color:var(--marble);font-weight:600;margin-bottom:3px;">${window.esc(r.company||'—')}</div>
            <div style="font-size:10px;color:var(--marble-dim);">${window.esc(r.email||'—')} · ${fmtDateC(r.date||r.addedAt)}</div>
        </div>
        <div>${r.credited?'<span class="badge b-delivered">Credited</span>':`<button class="btn btn-primary btn-sm" onclick="window.creditReferral('${window.esc(c.id)}',${idx})">Mark Credited</button>`}</div>
    </div>`).join('');
}

window.addReferral = async function() {
    if(!window.currentClient)return;
    const co=$c('dp-ref-co')?.value?.trim()||'';
    const em=$c('dp-ref-email')?.value?.trim()||'';
    const dt=$c('dp-ref-date')?.value||'';
    if(!co&&!em){if(window.toast)window.toast('Enter company or email','error');return;}
    const entry={company:co,email:em,date:dt,addedAt:nowTs(),credited:false};
    try{
        await window.db.collection('clients').doc(window.currentClient.id).update({referrals:firebase.firestore.FieldValue.arrayUnion(entry)});
        if($c('dp-ref-co'))$c('dp-ref-co').value='';
        if($c('dp-ref-email'))$c('dp-ref-email').value='';
        if($c('dp-ref-date'))$c('dp-ref-date').value='';
        if(window.toast)window.toast('Referral added');
        window.openDetail(window.currentClient.id);
    }catch(e){if(window.toast)window.toast('Failed','error');}
};

window.creditReferral = async function(clientId,idx) {
    if(!confirm('Mark as credited?'))return;
    try{
        const ref=window.db.collection('clients').doc(clientId);
        const d=(await ref.get()).data();
        d.referrals[idx].credited=true;
        await ref.update({referrals:d.referrals});
        window.currentClient.referrals=d.referrals;
        populateDetailReferrals(window.currentClient);
        if(window.toast)window.toast('Credited');
    }catch(e){if(window.toast)window.toast('Error','error');}
};

function populateDetailDebrief(c) {
    const wrap=$c('dp-debrief-content'); if(!wrap)return;
    if(!c.debrief){wrap.innerHTML='<div class="loading" style="padding:16px 0">No debrief submitted yet.</div>';return;}
    const d=c.debrief;
    const consentColor=d.consent?'#7ab88a':'#d47a7a';
    wrap.innerHTML=`
    <div style="background:rgba(255,255,255,.02);border:1px solid var(--border);padding:20px;margin-bottom:14px;">
        <div style="margin-bottom:16px;"><div style="font-size:9px;color:var(--gold);text-transform:uppercase;margin-bottom:4px;">Verdict</div><div style="font-size:18px;font-weight:700;color:var(--gold);">${d.rating||'N/A'}/5 Stars</div></div>
        <div style="margin-bottom:14px;"><div style="font-size:9px;color:var(--gold);text-transform:uppercase;margin-bottom:4px;">The Catalyst</div><div style="font-size:12px;font-style:italic;">"${window.esc(d.catalyst||'')}"</div></div>
        <div style="margin-bottom:14px;"><div style="font-size:9px;color:var(--gold);text-transform:uppercase;margin-bottom:4px;">The Portal</div><div style="font-size:12px;font-style:italic;">"${window.esc(d.portal||'')}"</div></div>
        <div style="margin-bottom:16px;"><div style="font-size:9px;color:var(--gold);text-transform:uppercase;margin-bottom:4px;">The Result</div><div style="font-size:12px;font-style:italic;">"${window.esc(d.result||'')}"</div></div>
        <div style="display:flex;align-items:center;gap:8px;padding-top:14px;border-top:1px solid var(--border);">
            <div style="width:8px;height:8px;border-radius:50%;background:${consentColor}"></div>
            <div style="font-size:10px;color:var(--marble-dim);">${d.consent?'Authorized public marketing use.':'Did NOT authorize public use.'}</div>
        </div>
    </div>
    <div style="font-size:9px;text-transform:uppercase;color:var(--marble-dim);margin-bottom:6px;">Auto-Generated Marketing Copy</div>
    <textarea readonly style="width:100%;height:100px;background:var(--void);border:1px solid var(--border);color:var(--marble);padding:14px;font-size:12px;line-height:1.5;resize:none;">"Before Lex Nova, my biggest realization was ${window.esc((d.catalyst||'').toLowerCase())}. Now, ${window.esc((d.result||'').toLowerCase())}."</textarea>`;
}
