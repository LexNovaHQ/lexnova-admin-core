// ════════════════════════════════════════════════════════════════════════
// ═════════ LEX NOVA ADMIN: CORE MODULE (admin-core.js) V5.6 ═════════════
// ════════════════════════════════════════════════════════════════════════
// V5.6 CHANGES FROM V5.5:
//   + calendar case added to nav() switch — calls window.loadCalendar()
//   + calendar entry added to headers{} map
//   + 'calendar' added to pageActions clear exclusion list
//     (calendar sets no page actions, but listed for explicitness)
//   All other code unchanged from V5.5
// ════════════════════════════════════════════════════════════════════════
'use strict';

// ════════════════════════════════════════════════════════════════════════
// ═════════ 1. GLOBAL UTILITIES ═══════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
window.$       = id  => document.getElementById(id);
window.qsa     = sel => Array.from(document.querySelectorAll(sel));
window.setText = (id, txt) => { const el = window.$(id); if (el) el.textContent = String(txt ?? ''); };
window.setVal  = (id, val) => { const el = window.$(id); if (el) el.value = val ?? ''; };

window.esc = function(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;')
        .replace(/'/g,'&#39;');
};

window.fmtDate = function(ts) {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    if (isNaN(d)) return '—';
    return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
};

window.fmtMoney = function(n) {
    return (n == null || isNaN(n)) ? '—' : '$' + Number(n).toLocaleString('en-US');
};

window.copyToClipboard = function(inputId) {
    const el = window.$(inputId);
    if (!el) return;
    el.select?.();
    try {
        navigator.clipboard.writeText(el.value)
            .then(()=>{ if(window.toast) window.toast('Copied'); })
            .catch(()=>{ document.execCommand('copy'); if(window.toast) window.toast('Copied'); });
    } catch { document.execCommand('copy'); if(window.toast) window.toast('Copied'); }
};

// ════════════════════════════════════════════════════════════════════════
// ═════════ 2. MODALS & TOASTS ════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
window.toast = function(msg, type = 'success') {
    const t = window.$('toast');
    if (!t) return;
    t.textContent   = msg;
    t.className     = type;
    t.style.display = 'block';
    if (window._toastTimer) clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(() => { t.style.display = 'none'; }, 3500);
};

window.openModal = function(title, bodyHtml, footerHtml) {
    window.$('modalTitle').textContent = title;
    window.$('modalBody').innerHTML    = bodyHtml;
    window.$('modalFooter').innerHTML  = footerHtml || '';

    const overlay = window.$('overlay');
    const modal   = window.$('modal');
    if (overlay) { overlay.classList.add('open');  overlay.style.display = 'block'; }
    if (modal)   { modal.classList.remove('hidden'); modal.classList.add('open'); modal.style.display = 'flex'; }
};

window.closeModal = function() {
    const overlay = window.$('overlay');
    const modal   = window.$('modal');
    if (overlay) { overlay.classList.remove('open'); overlay.style.display = 'none'; }
    if (modal)   { modal.classList.remove('open');   modal.style.display   = 'none'; }
};

// ════════════════════════════════════════════════════════════════════════
// ═════════ 3. KNOWLEDGE BASE (TOOLTIPS) ══════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
const INFO_DICT = {
    mrr:
        "<strong>Monthly Recurring Revenue:</strong> Cash generated exclusively from Active Shields ($297/mo maintenance subscriptions).",
    capacity:
        "<strong>Production Bandwidth:</strong> Active builds currently in 'The Forge' (intake_received / under_review / in_production).",
    gaps:
        "<strong>Actionable Gaps:</strong> Delivered clients exposed to new regulations in the Regulation DB. Each = $497 Gap Review opportunity.",
    sla:
        "<strong>SLA Danger Zone:</strong> Builds with less than 12 hours remaining on the 48-hour delivery clock.",
    hunt_status:
        "<strong>Pipeline Statuses (V6.1):</strong><br>" +
        "<strong>QUEUED:</strong> Hunter pushed. No cold email sent yet.<br>" +
        "<strong>SEQUENCE:</strong> Active cold sequence firing (C / FU1–FU4). Step tracked separately.<br>" +
        "<strong>ENGAGED:</strong> Replied. Scanner link sent. Waiting for click or payment.<br>" +
        "<strong>NEGOTIATING:</strong> Didn't convert on scanner. Active close in progress.<br>" +
        "<strong>CONVERTED:</strong> Paid. Auto-migrated to The Factory.<br>" +
        "<strong>ARCHIVED:</strong> Hit FU4 no reply. Parked for next quarter revival.<br>" +
        "<strong>DEAD:</strong> Hard no. Never revive.",
    scanner_flags:
        "<strong>Scanner Telemetry:</strong><br>🔥 = Scanner link clicked.<br>🔥🔥 = Gate form completed.",
    intake_holding:
        "<strong>Intake Holding:</strong> Client paid but has not yet submitted the Vault form in their portal.",
    the_forge:
        "<strong>The Forge:</strong> Vault received. Documents being architected.",
    pre_flight:
        "<strong>Pre-Flight Review:</strong> Documents drafted. Waiting for Death Checks to be cleared.",
    magazine:
        "<strong>The Magazine:</strong> QUEUED and SEQUENCE prospects — loaded and ready to fire.",
    downrange:
        "<strong>Downrange:</strong> SEQUENCE prospects with at least one email sent — actively in flight.",
    engaged:
        "<strong>Engaged (Tripwire):</strong> ENGAGED prospects — replied, scanner link sent, or scanner clicked/completed.",
    decision_desk:
        "<strong>Decision Desk:</strong> NEGOTIATING prospects — high-probability deals in active close."
};

window.showInfo = function(key) {
    const text = INFO_DICT[key] || "Definition not found.";
    window.openModal(
        "Lex Nova Intelligence",
        `<div style="font-size:14px;line-height:1.7;color:var(--marble);padding:10px">${text}</div>`,
        ""
    );
};

// ════════════════════════════════════════════════════════════════════════
// ═════════ 4. DASHBOARD ENGINE ═══════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
window.loadDashboard = async function() {
    let mrr=0, cap=0, gapOpps=0, gapPipe=0, slaCrit=0;
    let slaRows='';
    const now = Date.now();

    try {
        const snap = await window.db.collection('clients').get();
        snap.forEach(d => {
            const c = d.data();

            if (c.maintenanceActive) mrr += 297;

            if (['intake_received','under_review','in_production'].includes(c.status)) {
                cap++;
                const startTs = c.intakeReceivedAt || c.intakeSentAt
                    || c.productionStartedAt   || c.submittedAt
                    || c.baseline?.submittedAt || c.createdAt;
                if (startTs) {
                    const dObj = startTs.toDate ? startTs.toDate() : new Date(startTs);
                    const hrs  = (now - dObj.getTime()) / 3600000;
                    if (hrs > 36) {
                        slaCrit++;
                        const companyName = c.baseline?.company || c.name || d.id;
                        const hLeft = Math.max(0, 48 - Math.round(hrs));
                        slaRows += `<tr>
                            <td>${window.esc(companyName)}</td>
                            <td><span class="badge b-production">${window.esc(c.status)}</span></td>
                            <td style="color:#d47a7a">${hLeft}h left</td>
                        </tr>`;
                    }
                }
            }

            if (c.status === 'delivered' && !c.maintenanceActive) {
                const hasExposure = (c._red > 0) || (c._yellow > 0)
                    || (c.activeGaps   && c.activeGaps.length   > 0)
                    || (c.forensicGaps && c.forensicGaps.length > 0);
                if (hasExposure) { gapOpps++; gapPipe += 497; }
            }
        });

        window.setText('d-mrr',      window.fmtMoney(mrr));
        window.setText('d-mrr-sub',  `${Math.round(mrr/297)||0} active maintenance`);
        window.setText('d-cap-current', cap);
        window.setText('d-gaps',     gapOpps);
        window.setText('d-gaps-sub', `${window.fmtMoney(gapPipe)} Upsell Pipeline`);
        window.setText('d-sla-crit', slaCrit);

        let mCap = 10;
        try {
            const cfg = await window.db.collection('settings').doc('config').get();
            if (cfg.exists && cfg.data().capacityCap) mCap = cfg.data().capacityCap;
        } catch(_) {}
        window.setText('d-cap-label', `${cap} / ${mCap} slots`);
        const bar = window.$('d-cap-bar');
        if (bar) {
            const pct = Math.min(100, (cap / mCap) * 100);
            bar.style.width      = pct + '%';
            bar.style.background = pct > 90 ? '#d47a7a' : 'var(--gold)';
        }

        const dSla = window.$('d-sla-table');
        if (dSla) dSla.innerHTML = slaRows ||
            '<tr><td colspan="3" class="dim" style="text-align:center;padding:20px">✓ All SLAs secure</td></tr>';

        if (window.allProspects) {
            let clicks=0, comps=0, paid=0;
            window.allProspects.forEach(p => {
                if (p.scannerClicked||p.scannerCompleted) clicks++;
                if (p.scannerCompleted) comps++;
                if (p.status==='CONVERTED') paid++;
            });
            window.setText('sf-clicks', clicks);
            window.setText('sf-comps',  comps);
            window.setText('sf-paid',   paid);
            window.setText('sf-rate',   clicks>0 ? Math.round((paid/clicks)*100)+'% Conversion' : '— Conversion');
        }

        window.loadRitual();

    } catch(e) { console.error("Dashboard render failed:", e); }
};

// ════════════════════════════════════════════════════════════════════════
// ═════════ 5. SUNDAY RITUAL ENGINE ═══════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
window.loadRitual = async function() {
    try {
        const snap = await window.db.collection('settings').doc('ritual').get();
        if (snap.exists) {
            window.setVal('r-outreach', snap.data().outreachVolume  || '');
            window.setVal('r-replies',  snap.data().repliesReceived || '');
        }

        const oneWeek = Date.now() - (7 * 24 * 60 * 60 * 1000);
        let weekForms=0, weekDeals=0, pipeValue=0;

        if (window.allProspects) {
            window.allProspects.forEach(p => {
                const updTs = new Date(p.updatedAt||p.addedAt||0).getTime();
                if (p.scannerCompleted && updTs > oneWeek)     weekForms++;
                if (p.status==='CONVERTED' && updTs > oneWeek) weekDeals++;
                if (['NEGOTIATING','ENGAGED'].includes(p.status)) pipeValue += 997;
            });
        }

        if (window.allFlagship) {
            window.allFlagship.forEach(f => {
                if (['Proposal Sent','Negotiating'].includes(f.status))
                    pipeValue += (f.priceQuoted || 15000);
            });
        }

        window.setText('r-auto-forms', weekForms);
        window.setText('r-auto-deals', weekDeals);
        window.setText('r-auto-pipe',  window.fmtMoney(pipeValue));

    } catch(e) { console.error("Ritual load failed:", e); }
};

window.saveRitual = async function() {
    try {
        await window.db.collection('settings').doc('ritual').set({
            outreachVolume:  parseInt(window.$('r-outreach')?.value) || 0,
            repliesReceived: parseInt(window.$('r-replies')?.value)  || 0,
            updatedAt:       new Date().toISOString()
        }, { merge: true });
        window.toast('Ritual metrics updated');
    } catch(e) { console.error(e); }
};

// ════════════════════════════════════════════════════════════════════════
// ═════════ 6. MASTER ROUTER ══════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
window.nav = function(tabId) {
    // Hide all tab contents, deactivate all nav items
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    // Activate target tab
    const targetTab = document.getElementById(`tab-${tabId}`);
    if (targetTab) targetTab.classList.add('active');

    const activeNav = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
    if (activeNav) activeNav.classList.add('active');

    // ── PAGE HEADER MAP ───────────────────────────────────────────────
    const headers = {
        dashboard:  { title:'Command Center',  sub:'Global metrics and operating intelligence.' },
        hunt:       { title:'The Hunt',         sub:'Phase 1: Target acquisition, forensic pipeline, and daily action queue.' },
        // ── V5.6: calendar added ──
        calendar:   { title:'The Calendar',     sub:'Phase 1: Sequence execution — daily digest, sequence matrix, and scorecard.' },
        deals:      { title:'Active Deals',     sub:'Phase 2: The War Board and lead conversions.' },
        factory:    { title:'The Factory',      sub:'Phase 3: Legal architecture production line.' },
        syndicate:  { title:'The Syndicate',    sub:'Phase 4: Risk exposure tracking and referral engine.' },
        regulation: { title:'Regulation DB',    sub:'Master threat registry — INT.10 Archetypes × EXT.10 Tripwires.' },
        engine:     { title:'Engine Room',      sub:'Finance, Content, and System configuration.' }
    };

    if (headers[tabId]) {
        window.setText('pageTitle', headers[tabId].title);
        window.setText('pageSub',   headers[tabId].sub);
    }

    // Clear page actions (individual loaders set their own when needed)
    const pa = window.$('pageActions');
    if (pa && !['factory','deals'].includes(tabId)) pa.innerHTML = '';

    // ── ROUTE TO LOADER ───────────────────────────────────────────────
    try {
        switch (tabId) {
            case 'dashboard':
                window.loadDashboard();
                break;
            case 'hunt':
                if (typeof window.loadOutreach === 'function') window.loadOutreach();
                break;
            // ── V5.6: calendar case added ──
            case 'calendar':
                if (typeof window.loadCalendar === 'function') window.loadCalendar();
                break;
            case 'deals':
                if (typeof window.loadOutreach === 'function') window.loadOutreach();
                if (typeof window.loadFlagship === 'function') window.loadFlagship();
                break;
            case 'factory':
                if (typeof window.loadFactory === 'function') window.loadFactory();
                break;
            case 'syndicate':
                if (typeof window.loadSyndicate === 'function') window.loadSyndicate();
                break;
            case 'regulation':
                if (typeof window.loadRegulation === 'function') window.loadRegulation();
                break;
            case 'engine':
                if (typeof window.loadEngine === 'function') window.loadEngine();
                break;
        }
    } catch(e) { console.error("Router error:", e); }
};

// ════════════════════════════════════════════════════════════════════════
// ═════════ 7. INIT ═══════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
window.init = function() {
    // Warm up outreach listener first — allProspects must be populated
    // before dashboard, calendar, or analytics try to read it
    if (typeof window.loadOutreach === 'function') window.loadOutreach();
    if (typeof window.loadFactory  === 'function') window.loadFactory();
    if (typeof window.loadFlagship === 'function') window.loadFlagship();

    // Regulation DB pre-cache (populates radarEntries for exposure matrix)
    if (typeof window.loadRadarCache === 'function') window.loadRadarCache();

    // Land on dashboard
    window.nav('dashboard');
};
