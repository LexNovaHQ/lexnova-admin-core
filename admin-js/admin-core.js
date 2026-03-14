// ════════════════════════════════════════════════════════════════════════
// ═════════ LEX NOVA ADMIN: CORE MODULE (admin-core.js) ══════════════════
// ════════════════════════════════════════════════════════════════════════
// Description: Master router, global utilities, modals, and initialization.
// ════════════════════════════════════════════════════════════════════════
'use strict';

// ════════════════════════════════════════════════════════════════════════
// ═════════ 1. THE KNOWLEDGE BASE (TOOLTIPS & DEFINITIONS) ═══════════════
// ════════════════════════════════════════════════════════════════════════
const INFO_DICT = {
    mrr: "<strong>Monthly Recurring Revenue:</strong> Cash generated exclusively from Active Shields ($297/mo). Does not include one-off kit purchases.",
    capacity: "<strong>Production Bandwidth:</strong> The total number of active builds currently in 'The Forge' or 'Pre-Flight'. The hard cap is 50 before a VA must be deployed.",
    gaps: "<strong>Actionable Gaps:</strong> Clients who bought a kit, but whose jurisdictions now have new laws logged in the Regulatory Radar. These are prime targets for a $497 Gap Review.",
    sla: "<strong>SLA Danger Zone:</strong> Delivery builds that have less than 12 hours remaining on the strict 48-hour turnaround clock.",
    
    hunt_status: "<strong>V3 Pipeline Status:</strong><br><br><strong>Cold:</strong> Target identified, no emails sent.<br><strong>Warm:</strong> Emails actively firing.<br><strong>Replied:</strong> Manual intervention required.<br><strong>Hot/Engaged:</strong> NUCLEAR gap identified or Scanner clicked.<br><strong>Negotiating:</strong> Contract out.<br><strong>Converted:</strong> Payment received.",
    scanner_flags: "<strong>Scanner Telemetry:</strong><br><br>🔥 = Prospect clicked the Scanner link in your email.<br>🔥🔥 = Prospect completed the Scanner, giving you their exact architectural footprint.",
    
    magazine: "<strong>The Magazine:</strong> Active targets currently being sequenced in Lemlist/Instantly.",
    downrange: "<strong>Downrange:</strong> Prospects who have replied and are engaged in active conversation.",
    engaged: "<strong>Engaged (Tripwire):</strong> Prospects who have triggered a critical radar gap or completed the Scanner.",
    decision_desk: "<strong>Decision Desk:</strong> High-probability deals. Contract is out for signature or awaiting payment.",
    
    intake_holding: "<strong>Intake Holding:</strong> Client has paid, but hasn't submitted their 13-question Vault yet.",
    the_forge: "<strong>The Forge:</strong> Vault received. Documents need to be drafted.",
    pre_flight: "<strong>Pre-Flight Review:</strong> Documents drafted. Waiting for final 'Death Checks' before deployment."
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
// ═════════ 2. GLOBAL UTILITIES (SECURITY & FORMATTING) ══════════════════
// ════════════════════════════════════════════════════════════════════════

// XSS Prevention: Sanitizes user inputs before rendering to the DOM
window.esc = function(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

// Standard Date Formatter
window.formatDate = function(isoString) {
    if (!isoString) return '—';
    try {
        const d = new Date(isoString);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) {
        return '—';
    }
};

// Toast Notification System
window.toast = function(msg, type = 'success') {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.className = type;
    t.style.display = 'block';
    
    // Clear existing timeout to prevent flickering
    if (window.toastTimer) clearTimeout(window.toastTimer);
    window.toastTimer = setTimeout(() => {
        t.style.display = 'none';
    }, 3500);
};

// Universal Modal Closer
window.closeModal = function() {
    document.getElementById('overlay').classList.remove('open');
    document.getElementById('modal').classList.remove('open');
    const radarCms = document.getElementById('modal-radar-cms');
    if (radarCms) radarCms.style.display = 'none';
};


// ════════════════════════════════════════════════════════════════════════
// ═════════ 3. MASTER ROUTER (TAB NAVIGATION) ════════════════════════════
// ════════════════════════════════════════════════════════════════════════
window.nav = function(tabId) {
    // 1. Update Sidebar UI
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const activeNav = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
    if (activeNav) activeNav.classList.add('active');

    // 2. Hide all tab content
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));

    // 3. Show target tab
    const targetTab = document.getElementById(`tab-${tabId}`);
    if (targetTab) targetTab.classList.add('active');

    // 4. Update Header Strings
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
    
    if (headers[tabId]) {
        titleEl.textContent = headers[tabId].title;
        subEl.textContent = headers[tabId].sub;
    }

    // 5. Fire Domain-Specific Loaders (Hooking into the other modules)
    // We use safe checks so the router doesn't crash if a module isn't loaded yet
    try {
        if (tabId === 'dashboard') {
            if (typeof window.loadDashboard === 'function') window.loadDashboard();
        } 
        else if (tabId === 'hunt') {
            if (typeof window.loadOutreach === 'function') window.loadOutreach();
        } 
        else if (tabId === 'deals') {
            if (typeof window.loadDeals === 'function') window.loadDeals();
            if (typeof window.loadFlagship === 'function') window.loadFlagship();
        } 
        else if (tabId === 'factory') {
            if (typeof window.loadFactory === 'function') window.loadFactory();
        } 
        else if (tabId === 'syndicate') {
            if (typeof window.loadSyndicate === 'function') window.loadSyndicate();
        } 
        else if (tabId === 'engine') {
            if (typeof window.loadEngine === 'function') window.loadEngine();
        }
    } catch (e) {
        console.error("Router execution error for tab:", tabId, e);
    }
};


// ════════════════════════════════════════════════════════════════════════
// ═════════ 4. GLOBAL INITIALIZATION (APP BOOTSTRAP) ═════════════════════
// ════════════════════════════════════════════════════════════════════════
// This function is explicitly called from admin.html after Firebase Auth verifies the admin.
window.init = function() {
    console.log("[SYSTEM] Admin verified. Bootstrapping ERP modules...");
    
    // Start by routing to the Command Center
    window.nav('dashboard');

    // Optional: Pre-fetch massive collections in the background if needed by other modules
    if (typeof window.backgroundSync === 'function') {
        window.backgroundSync();
    }
};
