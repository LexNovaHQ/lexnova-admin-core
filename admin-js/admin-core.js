// ════════════════════════════════════════════════════════════════════════
// ═════════ LEX NOVA ADMIN: CORE MODULE (admin-core.js) ══════════════════
// ════════════════════════════════════════════════════════════════════════
// Description: Master router, global utilities, modals, and dashboard math.
// ════════════════════════════════════════════════════════════════════════
'use strict';

// ════════════════════════════════════════════════════════════════════════
// ═════════ 1. GLOBAL UTILITIES (DATE, MONEY, SECURITY) ══════════════════
// ════════════════════════════════════════════════════════════════════════

// XSS Prevention
window.esc = function(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
};

// Robust Date Formatter (Handles Firebase Timestamps natively)
window.fmtDate = function(ts) { 
    if (!ts) return '—'; 
    const d = ts.toDate ? ts.toDate() : new Date(ts); 
    if (isNaN(d)) return '—'; 
    return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }); 
};

// Currency Formatter
window.fmtMoney = function(n) { 
    return (n == null || isNaN(n)) ? '—' : '$' + Number(n).toLocaleString('en-US'); 
};

// Toast Notifications
window.toast = function(msg, type = 'success') {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.className = type;
    t.style.display = 'block';
    if (window.toastTimer) clearTimeout(window.toastTimer);
    window.toastTimer = setTimeout(() => { t.style.display = 'none'; }, 3500);
};

// Universal Modal Closer
window.closeModal = function() {
    document.getElementById('overlay')?.classList.remove('open');
    document.getElementById('modal')?.classList.remove('open');
    const radarCms = document.getElementById('modal-radar-cms');
    if (radarCms) radarCms.style.display = 'none';
};


// ════════════════════════════════════════════════════════════════════════
// ═════════ 2. THE KNOWLEDGE BASE (TOOLTIPS) ═════════════════════════════
// ════════════════════════════════════════════════════════════════════════
const INFO_DICT = {
    mrr: "<strong>Monthly Recurring Revenue:</strong> Cash generated exclusively from Active Shields ($297/mo). Does not include one-off kit purchases.",
    capacity: "<strong>Production Bandwidth:</strong> Active builds currently in 'The Forge' or 'Pre-Flight'. Hard cap is 50.",
    gaps: "<strong>Actionable Gaps:</strong> Clients exposed to new regulations logged in the Radar. Target these for $497 Gap Reviews.",
    sla: "<strong>SLA Danger Zone:</strong> Builds with < 12 hours remaining on the 48-hour delivery clock.",
    hunt_status: "<strong>Pipeline Status:</strong><br><strong>Cold:</strong> No emails sent.<br><strong>Warm:</strong> Emails actively firing.<br><strong>Replied:</strong> Manual intervention required.<br><strong>Hot:</strong> Gap identified or Scanner clicked.<br><strong>Negotiating:</strong> Contract out.",
    scanner_flags: "<strong>Scanner Telemetry:</strong><br>🔥 = Clicked.<br>🔥🔥 = Completed.",
    intake_holding: "<strong>Intake Holding:</strong> Client paid, waiting for Vault submission.",
    the_forge: "<strong>The Forge:</strong> Vault received. Documents being drafted.",
    pre_flight: "<strong>Pre-Flight Review:</strong> Drafted. Waiting for Death Checks.",
    magazine: "<strong>The Magazine:</strong> Active targets currently being sequenced.",
    downrange: "<strong>Downrange:</strong> Prospects engaged in conversation.",
    engaged: "<strong>Engaged:</strong> Triggered a gap or completed Scanner.",
    decision_desk: "<strong>Decision Desk:</strong> High-probability deals."
};

window.showInfo = function(key) {
    const text = INFO_DICT[key] || "Definition not found.";
    document.getElementById('modalTitle').textContent = "Lex Nova Intelligence";
    document.getElementById('modalBody').innerHTML = `<div style="font-size:14px; line-height:1.6; color:var(--marble); padding:10px;">${text}</div>`;
    document.getElementById('modalFooter').innerHTML = '';
    document.getElementById('overlay').classList.add('open');
    document.getElementById('modal').classList.add('open');
};


// ════════════════════════════════════════════════════════════════════════
// ═════════ 3. DASHBOARD & SUNDAY RITUAL ENGINE ══════════════════════════
// ════════════════════════════════════════════════════════════════════════
const $ = id => document.getElementById(id);
const setText = (id, txt) => { const el = $(id); if (el) el.textContent = String(txt ?? ''); };
const setVal = (id, val) => { const el = $(id); if (el) el.value = val ?? ''; };

window.loadDashboard = async function() {
    let mrr = 0, cap = 0;
    let gapOpps = 0, gapPipe = 0, slaCrit = 0;
    let cTbl = '';
    const now = Date.now();

    try {
        const snap = await window.db.collection('clients').get();
        snap.forEach(d => {
            const c = d.data();
            
            // MRR & Concentration
            if (c.maintenanceActive) mrr += 297;
            
            // Capacity
            if (['intake_received','under_review','in_production'].includes(c.status)) {
                cap++;
                // SLA Math
                const startTs = c.intakeReceivedAt || c.intakeSentAt || c.productionStartedAt || c.submittedAt;
                if (startTs) {
                    const dObj = startTs.toDate ? startTs.toDate() : new Date(startTs);
                    const hrs = (now - dObj.getTime()) / 3600000;
                    if (hrs > 36) { // < 12 hours left out of 48
                        slaCrit++;
                        cTbl += `<tr>
                            <td>${window.esc(c.baseline?.company || c.name || d.id)}</td>
                            <td><span class="badge b-production">${c.status}</span></td>
                            <td style="color:#d47a7a">${Math.max(0, 48 - Math.round(hrs))}h left</td>
                        </tr>`;
                    }
                }
            }

            // Gaps (Legacy fallback + V5)
            const hasExposures = c._red > 0 || c._yellow > 0 || (c.detectedGaps && c.detectedGaps.length > 0);
            if (hasExposures && !c.maintenanceActive) {
                gapOpps++;
                gapPipe += 497;
            }
        });
        
        setText('d-mrr', window.fmtMoney(mrr));
        setText('d-cap-current', cap);
        
        // Capacity Limit Logic
        let mCap = 10;
        const config = await window.db.collection('settings').doc('config').get();
        if (config.exists && config.data().capacityCap) mCap = config.data().capacityCap;
        
        setText('d-cap-label', `${cap} / ${mCap} slots`);
        const pct = Math.min(100, (cap / mCap) * 100);
        const bar = $('d-cap-bar');
        if (bar) { 
            bar.style.width = pct + '%'; 
            bar.style.background = pct > 90 ? '#d47a7a' : 'var(--gold)'; 
        }
        
        setText('d-gaps', gapOpps);
        setText('d-gaps-sub', `${window.fmtMoney(gapPipe)} Upsell Pipeline`);
        setText('d-sla-crit', slaCrit);
        
        const dSla = $('d-sla-table');
        if (dSla) dSla.innerHTML = cTbl || '<tr><td colspan="3" class="dim" style="text-align:center;padding:20px;">All SLAs secure</td></tr>';
        
        // Run Sunday Ritual Load
        window.loadRitual();

    } catch(e) { 
        console.error("Dashboard render failed", e); 
    }
};

window.loadRitual = async function() {
    try {
        const snap = await window.db.collection('settings').doc('ritual').get();
        if (snap.exists) {
            setVal('r-outreach', snap.data().outreachVolume || '');
            setVal('r-replies', snap.data().repliesReceived || '');
        }

        // Auto-Calculations for the week
        const now = Date.now();
        const oneWeek = now - (7 * 24 * 60 * 60 * 1000);
        let weekForms = 0, weekDeals = 0, pipeValue = 0;

        if (window.allProspects && window.allProspects.length > 0) {
            window.allProspects.forEach(p => {
                if (p.scannerCompleted) {
                    const ts = new Date(p.updatedAt || p.addedAt).getTime();
                    if (ts > oneWeek) weekForms++;
                }
                if (p.status === 'Converted') {
                    const ts = new Date(p.updatedAt || p.addedAt).getTime();
                    if (ts > oneWeek) weekDeals++;
                }
                if (['Negotiating','Hot','Replied'].includes(p.status)) pipeValue += 997;
            });
        }

        if (window.allFlagship && window.allFlagship.length > 0) {
            window.allFlagship.forEach(f => {
                if (['Proposal Sent','Negotiating'].includes(f.status)) pipeValue += (f.priceQuoted || 15000);
            });
        }

        setText('r-auto-forms', weekForms);
        setText('r-auto-deals', weekDeals);
        setText('r-auto-pipe', window.fmtMoney(pipeValue));

    } catch(e) { console.error("Ritual load failed", e); }
};

window.saveRitual = async function() {
    try {
        await window.db.collection('settings').doc('ritual').set({
            outreachVolume: parseInt($('r-outreach').value) || 0,
            repliesReceived: parseInt($('r-replies').value) || 0,
            updatedAt: new Date().toISOString()
        }, { merge: true });
        window.toast('Ritual metrics updated');
    } catch(e) { console.error(e); }
};


// ════════════════════════════════════════════════════════════════════════
// ═════════ 4. MASTER ROUTER & INIT ══════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
// Using your exact router logic, generalized for the new modules
window.nav = function(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    const targetTab = document.getElementById(`tab-${tabId}`);
    if (targetTab) targetTab.classList.add('active');

    const activeNav = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
    if (activeNav) activeNav.classList.add('active');

    // Header Strings
    const titleEl = document.getElementById('pageTitle');
    const subEl = document.getElementById('pageSub');
    const headers = {
        'dashboard': { title: 'Command Center', sub: 'Global metrics and Sunday Ritual inputs.' },
        'hunt':      { title: 'The Hunt', sub: 'Phase 1: Prospect identification and pipeline.' },
        'deals':     { title: 'Active Deals', sub: 'Phase 2: The War Board and conversions.' },
        'factory':   { title: 'The Factory', sub: 'Phase 3: Legal architecture production line.' },
        'syndicate': { title: 'The Syndicate', sub: 'Phase 4: Risk exposure tracking and referrals.' },
        'engine':    { title: 'Engine Room', sub: 'System configuration and Regulation CMS.' }
    };
    if (headers[tabId]) { titleEl.textContent = headers[tabId].title; subEl.textContent = headers[tabId].sub; }

    // Domain Specific Loads
    try {
        if (tabId === 'dashboard') window.loadDashboard();
        if (tabId === 'hunt' && typeof window.loadOutreach === 'function') window.loadOutreach();
        if (tabId === 'deals' && typeof window.loadOutreach === 'function') { window.loadOutreach(); if(typeof window.loadFlagship==='function') window.loadFlagship(); }
        if (tabId === 'factory' && typeof window.loadFactory === 'function') window.loadFactory();
        if (tabId === 'syndicate' && typeof window.loadSyndicate === 'function') window.loadSyndicate();
        if (tabId === 'engine' && typeof window.loadEngine === 'function') window.loadEngine();
    } catch (e) {
        console.error("Router error:", e);
    }
};

window.init = function() {
    console.log("[SYSTEM] Admin verified. Bootstrapping ERP modules...");
    
    // Force pre-load of background data to ensure metrics are accurate
    if (typeof window.loadOutreach === 'function') window.loadOutreach();
    if (typeof window.loadFactory === 'function') window.loadFactory();
    if (typeof window.loadFlagship === 'function') window.loadFlagship();
    
    window.nav('dashboard');
};
