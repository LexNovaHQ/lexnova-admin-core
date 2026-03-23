// ════════════════════════════════════════════════════════════════════════
// ═════════ LEX NOVA ADMIN: THE CALENDAR (tab-calendar.js) V1.0 ══════════
// ════════════════════════════════════════════════════════════════════════
// READS:  window.allProspects (owned by tab-hunt-deals.js onSnapshot)
// WRITES: Firestore /prospects/{prospectId} — new calendar fields only
//         Firestore /settings/config — dailyProspectTarget
//
// NEW FIRESTORE FIELDS PER PROSPECT (added by this file):
//   ceDate, fu1Date, fu2Date, fu3Date, fu4Date  — string YYYY-MM-DD
//   ceSent, fu1Sent, fu2Sent, fu3Sent, fu4Sent  — boolean
//   neg1Date                                     — string YYYY-MM-DD
//
// SYNC ON MARK-SENT: writes new calendar fields AND advances existing
//   sequence engine fields (sequenceStep, emailsSent, emailLog,
//   nextActionDate) — single source of truth preserved.
//
// THREE VIEWS:
//   1. Daily Digest   — Overdue / Today / Upcoming / Hot Signals
//   2. Sequence Matrix— CE→FU4 date+checkbox grid + Replied + NEG-1
//   3. Daily Scorecard— 4 KPI cards + today's task list
// ════════════════════════════════════════════════════════════════════════
'use strict';

// ── STEP CONFIG ────────────────────────────────────────────────────────
// Maps calendar step key → Firestore field names + sequence engine values
var CAL_STEP_CFG = {
    CE:  { dateF:'ceDate',  sentF:'ceSent',  seqStep:'FU1', seqLabel:'Cold Email',    interval:3  },
    FU1: { dateF:'fu1Date', sentF:'fu1Sent', seqStep:'FU2', seqLabel:'Follow-Up 1',   interval:3  },
    FU2: { dateF:'fu2Date', sentF:'fu2Sent', seqStep:'FU3', seqLabel:'Follow-Up 2',   interval:4  },
    FU3: { dateF:'fu3Date', sentF:'fu3Sent', seqStep:'FU4', seqLabel:'Follow-Up 3',   interval:4  },
    FU4: { dateF:'fu4Date', sentF:'fu4Sent', seqStep:null,  seqLabel:'Follow-Up 4',   interval:0  }
};
var CAL_STEPS = ['CE','FU1','FU2','FU3','FU4'];

// ── STATE ──────────────────────────────────────────────────────────────
var calView        = 'digest';
var calBuilt       = false;
var calDailyTarget = 60; // loaded from Firestore on init

// ── HELPERS ────────────────────────────────────────────────────────────
var _$c = id => document.getElementById(id);

function _today() { return new Date().toISOString().split('T')[0]; }
function _nowTs() { return new Date().toISOString(); }
// _pct defined locally — tab-analytics.js defines its own copy but does
// not export it to window, so this file needs its own instance
function _pct(n, d) { return d > 0 ? Math.round((n / d) * 100) : 0; }

function _addDays(dateStr, n) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return d.toISOString().split('T')[0];
}

function _daysDiff(dateStr) {
    if (!dateStr) return null;
    const t = new Date(_today() + 'T00:00:00');
    const s = new Date(dateStr  + 'T00:00:00');
    return Math.round((s - t) / 86400000);
}

function _fmtShort(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T00:00:00');
    return isNaN(d) ? '—' : d.toLocaleDateString('en-GB', { day:'2-digit', month:'short' });
}

// Compute all 5 dates from a CE date
function _calcAllDates(ceDate) {
    const fu1 = _addDays(ceDate, 4);
    const fu2 = _addDays(fu1,   4);
    const fu3 = _addDays(fu2,   5);
    const fu4 = _addDays(fu3,   5);
    return { ceDate, fu1Date:fu1, fu2Date:fu2, fu3Date:fu3, fu4Date:fu4 };
}

// Firestore doc key — same convention as tab-hunt-deals.js
function _docKey(p) { return p.prospectId || p.id; }

function _esc(s) {
    if (typeof window.esc === 'function') return window.esc(s);
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _pros() { return window.allProspects || []; }

// ════════════════════════════════════════════════════════════════════════
// ═════════ ENTRY POINT ═══════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
window.loadCalendar = async function() {
    buildCalendarHTML();
    // Load daily target from settings
    try {
        const snap = await window.db.collection('settings').doc('config').get();
        if (snap.exists && snap.data().dailyProspectTarget) {
            calDailyTarget = parseInt(snap.data().dailyProspectTarget, 10) || 60;
        }
    } catch(e) { /* use default */ }
    renderCalView();
};

// Called by tab-hunt-deals.js onSnapshot to keep Calendar live
window.refreshCalendar = function() {
    if (calView === 'digest')    renderCalDigest();
    else if (calView === 'matrix')    window.renderCalMatrix();
    else if (calView === 'scorecard') renderCalScorecard();
};

// ════════════════════════════════════════════════════════════════════════
// ═════════ HTML SCAFFOLD ═════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
function buildCalendarHTML() {
    if (calBuilt) return;
    const wrap = _$c('tab-calendar');
    if (!wrap) return;
    calBuilt = true;
    wrap.innerHTML = `
    <div class="view-btns" style="margin-bottom:20px">
        <button class="view-btn active" id="btn-cal-digest" onclick="window.setCalView('digest',this)">Daily Digest</button>
        <button class="view-btn"        id="btn-cal-matrix" onclick="window.setCalView('matrix',this)">Sequence Matrix</button>
        <button class="view-btn"        id="btn-cal-score"  onclick="window.setCalView('scorecard',this)">Daily Scorecard</button>
    </div>
    <div id="cal-digest-view"></div>
    <div id="cal-matrix-view" class="hidden">
        <div class="filter-bar" style="margin-bottom:14px;">
            <input type="text" class="fi" id="cal-mat-search" placeholder="Search name or company…"
                oninput="window.renderCalMatrix()" style="flex:1 1 auto;min-width:180px;">
            <select class="fi" id="cal-mat-status" onchange="window.renderCalMatrix()" style="flex:0 0 auto;">
                <option value="">All Statuses</option>
                <option value="QUEUED">QUEUED</option>
                <option value="SEQUENCE">SEQUENCE</option>
                <option value="ENGAGED">ENGAGED</option>
                <option value="NEGOTIATING">NEGOTIATING</option>
            </select>
            <select class="fi" id="cal-mat-batch" onchange="window.renderCalMatrix()" style="flex:0 0 auto;">
                <option value="">All Batches</option>
            </select>
        </div>
        <div id="cal-matrix-wrap"></div>
    </div>
    <div id="cal-scorecard-view" class="hidden">
        <div id="cal-scorecard-wrap"></div>
    </div>`;
}

window.setCalView = function(view, el) {
    document.querySelectorAll('#tab-calendar .view-btn').forEach(b => b.classList.remove('active'));
    if (el) el.classList.add('active');
    calView = view;
    ['digest','matrix','scorecard'].forEach(v => {
        const el = _$c(`cal-${v}-view`);
        if (el) el.classList.toggle('hidden', v !== view);
    });
    renderCalView();
};

function renderCalView() {
    if (calView === 'digest')        renderCalDigest();
    else if (calView === 'matrix')   window.renderCalMatrix();
    else if (calView === 'scorecard') renderCalScorecard();
}

// ════════════════════════════════════════════════════════════════════════
// ═════════ VIEW 1: DAILY DIGEST ══════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
function renderCalDigest() {
    const el = _$c('cal-digest-view');
    if (!el) return;
    const today = _today();

    // For each active prospect, find what step is due
    const tasks = [];
    _pros().filter(p => !['CONVERTED','DEAD','ARCHIVED'].includes(p.status)).forEach(p => {
        CAL_STEPS.forEach(step => {
            const cfg  = CAL_STEP_CFG[step];
            const date = p[cfg.dateF];
            const sent = p[cfg.sentF];
            if (!date || sent) return;
            tasks.push({ p, step, date, label: cfg.seqLabel });
        });
        // NEG-1
        if (p.neg1Date && ['ENGAGED','NEGOTIATING'].includes(p.status)) {
            tasks.push({ p, step:'NEG1', date: p.neg1Date, label:'Send NEG-1' });
        }
    });

    const overdue  = tasks.filter(t => t.date < today).sort((a,b) => a.date.localeCompare(b.date));
    const todayT   = tasks.filter(t => t.date === today);
    const upcoming = tasks.filter(t => t.date > today).sort((a,b) => a.date.localeCompare(b.date));

    const noDateP  = _pros().filter(p =>
        !['CONVERTED','DEAD','ARCHIVED'].includes(p.status) &&
        !p.ceDate && !p.fu1Date && !p.fu2Date
    );

    const hot = _pros().filter(p =>
        (p.scannerClicked || p.scannerCompleted) &&
        !['CONVERTED','DEAD','ARCHIVED'].includes(p.status)
    ).slice(0, 10);

    const dateStr = new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
    const totalDue = overdue.length + todayT.length;

    const taskRow = t => {
        const diff   = _daysDiff(t.date);
        const isOver = diff !== null && diff < 0;
        const isToday= diff === 0;
        let dLabel   = _fmtShort(t.date);
        let dStyle   = 'color:var(--marble-dim)';
        if (isOver)  { dLabel = `⚠ ${Math.abs(diff)}d ago`; dStyle = 'color:#d47a7a;font-weight:600'; }
        if (isToday) { dLabel = 'Today';                     dStyle = 'color:var(--gold)'; }
        const btnId = t.step === 'NEG1' ? 'neg1' : t.step.toLowerCase();
        return `
        <div class="digest-row" style="align-items:center;">
            <div style="flex:1;min-width:0;">
                <div style="font-size:11px;font-weight:600;color:var(--marble);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                    ${_esc(t.p.founderName||t.p.name||'—')}
                    <span style="color:var(--marble-dim);font-weight:400"> · ${_esc(t.p.company||'—')}</span>
                </div>
                <div style="font-size:10px;color:var(--gold);margin-top:2px;">→ ${_esc(t.label)}</div>
            </div>
            <div style="display:flex;gap:8px;align-items:center;flex-shrink:0;">
                <span style="${dStyle};font-size:10px;">${dLabel}</span>
                ${t.step === 'NEG1'
                    ? `<button class="btn btn-outline btn-sm" onclick="window.calTaskCheckNeg1('${_esc(t.p.id)}')">✓ Mark Sent</button>`
                    : `<button class="btn btn-primary btn-sm"  onclick="window.calMarkSent('${_esc(t.p.id)}','${t.step}')">✓ Mark Sent</button>`
                }
            </div>
        </div>`;
    };

    const section = (label, color, count, rows, collapsed) => {
        const uid = `dig-${label.replace(/\W+/g,'_')}`;
        return `
        <div style="margin-bottom:20px;">
            <div style="font-size:9px;color:${color};text-transform:uppercase;letter-spacing:.15em;font-weight:700;margin-bottom:10px;display:flex;align-items:center;gap:8px;">
                ${label}
                <span style="background:${color}20;border:1px solid ${color}40;padding:2px 8px;border-radius:8px;color:${color};">${count}</span>
                ${collapsed ? `<button class="btn btn-ghost btn-sm" style="margin-left:auto;" onclick="const b=document.getElementById('${uid}');b.classList.toggle('hidden');this.textContent=b.classList.contains('hidden')?'Show':'Hide';">Show</button>` : ''}
            </div>
            <div class="digest-queue" id="${uid}" ${collapsed ? 'class="hidden"' : ''}>
                ${rows || `<div style="padding:12px 14px;font-size:10px;color:var(--marble-faint);">None</div>`}
            </div>
        </div>`;
    };

    let html = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:8px;">
        <div>
            <div style="font-family:'Cormorant Garamond',serif;font-size:22px;color:var(--marble);">${dateStr}</div>
            <div style="font-size:10px;color:var(--marble-dim);margin-top:2px;">${totalDue > 0 ? `${totalDue} action${totalDue!==1?'s':''} due` : 'All clear today'}</div>
        </div>
    </div>`;

    if (overdue.length) html += section('🔴 Overdue', '#d47a7a', overdue.length, overdue.map(taskRow).join(''), false);
    if (todayT.length)  html += section('🟡 Today',   'var(--gold)',  todayT.length, todayT.map(taskRow).join(''), false);

    if (!overdue.length && !todayT.length) {
        html += `<div style="text-align:center;padding:32px;border:1px solid var(--border);color:var(--marble-faint);font-size:11px;margin-bottom:20px;">✓ Nothing overdue or due today. You're ahead of the sequence.</div>`;
    }

    if (upcoming.length) html += section('⚪ Upcoming', 'var(--marble-dim)', upcoming.length, upcoming.slice(0,20).map(taskRow).join(''), true);

    if (noDateP.length) {
        const noDateRows = noDateP.slice(0,10).map(p => `
        <div class="digest-row" style="align-items:center;">
            <div style="flex:1;font-size:11px;color:var(--marble);">${_esc(p.founderName||p.name||'—')} · <span style="color:var(--marble-dim)">${_esc(p.company||'—')}</span></div>
            <button class="btn btn-outline btn-sm" onclick="window.calPromptCEDate('${_esc(p.id)}')">Set CE Date</button>
        </div>`).join('');
        html += section('📌 No CE Date Set', 'var(--marble-faint)', noDateP.length, noDateRows, true);
    }

    if (hot.length) {
        const hotRows = hot.map(p => {
            const fire = p.scannerCompleted ? '🔥🔥 Completed' : '🔥 Clicked';
            const diff = _daysDiff(p.nextActionDate);
            const urgency = diff !== null && diff <= 0 ? '<span style="color:#d47a7a;font-size:9px;font-weight:600;margin-left:8px;">⚠ ACTION NOW</span>' : '';
            return `
            <div class="digest-row" onclick="if(typeof window.openPP==='function')window.openPP('${_esc(p.id)}')" style="cursor:pointer;align-items:center;">
                <div style="flex:1;font-size:11px;">
                    <span style="font-weight:600;color:var(--marble);">${_esc(p.founderName||p.name||'—')}</span>
                    <span style="color:var(--marble-dim)"> · ${_esc(p.company||'—')}</span>
                    <span style="color:var(--gold);margin-left:8px;font-size:10px;">${fire}</span>${urgency}
                </div>
                <span style="font-size:10px;color:var(--marble-dim);">${p.nextActionDate ? _fmtShort(p.nextActionDate) : 'No date'}</span>
            </div>`;
        }).join('');
        html += section('🔥 Scanner Hot Signals', '#f97316', hot.length, hotRows, true);
    }

    el.innerHTML = html;
}

// ════════════════════════════════════════════════════════════════════════
// ═════════ VIEW 2: SEQUENCE MATRIX ══════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
window.renderCalMatrix = function() {
    const wrap = _$c('cal-matrix-wrap');
    if (!wrap) return;

    const search = (_$c('cal-mat-search')?.value || '').toLowerCase();
    const status = _$c('cal-mat-status')?.value  || '';
    const batch  = _$c('cal-mat-batch')?.value   || '';

    // Populate batch filter once
    const bSel = _$c('cal-mat-batch');
    if (bSel && bSel.options.length <= 1) {
        [...new Set(_pros().map(p => p.batchNumber).filter(Boolean))].sort().forEach(b => {
            const o = document.createElement('option'); o.value = b; o.textContent = b;
            bSel.appendChild(o);
        });
    }

    const active = _pros().filter(p => {
        if (!['QUEUED','SEQUENCE','ENGAGED','NEGOTIATING'].includes(p.status)) return false;
        if (status && p.status !== status) return false;
        if (batch  && p.batchNumber !== batch) return false;
        if (search && ![(p.founderName||''),(p.name||''),(p.company||'')].some(v => v.toLowerCase().includes(search))) return false;
        return true;
    }).sort((a,b) => (a.ceDate||'9999').localeCompare(b.ceDate||'9999'));

    const scheduled   = active.filter(p => p.ceDate);
    const unscheduled = active.filter(p => !p.ceDate);

    if (!active.length) {
        wrap.innerHTML = `<div class="empty">No active prospects match the current filters.</div>`;
        return;
    }

    // Build a step cell
    const stepCell = (p, step) => {
        const cfg    = CAL_STEP_CFG[step];
        const date   = p[cfg.dateF];
        const sent   = p[cfg.sentF];
        const hasReply = !!p.repliedAt;
        const stepIdx  = CAL_STEPS.indexOf(step);
        const curIdx   = CAL_STEPS.indexOf(p.sequenceStep||'CE');
        const alreadySent = sent || stepIdx < curIdx;

        // If replied and step not yet sent → grey strikethrough
        if (hasReply && !alreadySent) {
            return `<td style="padding:8px 10px;opacity:.35;text-decoration:line-through;pointer-events:none;">
                <div class="cal-step-cell"><span style="font-size:9px;color:var(--marble-faint);">${date ? _fmtShort(date) : '—'}</span></div>
            </td>`;
        }

        if (alreadySent) {
            return `<td style="padding:8px 10px;">
                <div class="cal-step-cell">
                    <span style="font-size:10px;color:#7ab88a;font-weight:700;">✓</span>
                    <span style="font-size:9px;color:#7ab88a;">${date ? _fmtShort(date) : ''}</span>
                </div>
            </td>`;
        }

        const diff    = date ? _daysDiff(date) : null;
        const isOver  = diff !== null && diff < 0;
        const isToday = diff === 0;
        const dStyle  = isOver ? 'color:#d47a7a;font-weight:600' : isToday ? 'color:var(--gold)' : 'color:var(--marble-dim)';
        const dLabel  = date
            ? (isOver ? `⚠ ${_fmtShort(date)}` : isToday ? '★ Today' : _fmtShort(date))
            : '—';

        return `<td style="padding:8px 10px;${isToday?'background:var(--gold-dim);':''}">
            <div class="cal-step-cell">
                ${date
                    ? `<span class="cal-date" style="${dStyle};cursor:pointer;" onclick="window.calInlineDate('${_esc(p.id)}','${step}',this)">${dLabel}</span>`
                    : `<button class="cal-set-btn" onclick="window.calInlineDate('${_esc(p.id)}','${step}',this)">Set</button>`
                }
                ${date ? `<span class="cal-chk" onclick="window.calMarkSent('${_esc(p.id)}','${step}')"></span>` : ''}
            </div>
        </td>`;
    };

    // Replied cell
    const repliedCell = p => {
        if (p.repliedAt) {
            return `<td style="padding:8px 10px;">
                <div class="cal-step-cell">
                    <span class="cal-chk checked" title="Replied"></span>
                    <span style="font-size:9px;color:#7ab88a;">${_fmtShort(p.repliedAt.split('T')[0])}</span>
                </div>
            </td>`;
        }
        return `<td style="padding:8px 10px;">
            <div class="cal-step-cell">
                <span class="cal-chk" onclick="window.calMarkReplied('${_esc(p.id)}')" title="Mark Replied"></span>
            </div>
        </td>`;
    };

    // NEG-1 cell
    const neg1Cell = p => {
        if (!p.repliedAt) {
            return `<td style="padding:8px 10px;"><span style="font-size:9px;color:var(--marble-faint);">—</span></td>`;
        }
        if (p.neg1Date) {
            const diff = _daysDiff(p.neg1Date);
            const style = diff < 0 ? 'color:#d47a7a;font-weight:600' : diff === 0 ? 'color:var(--gold)' : 'color:var(--marble-dim)';
            return `<td style="padding:8px 10px;">
                <span class="cal-date" style="${style};cursor:pointer;" onclick="window.calInlineDate('${_esc(p.id)}','NEG1',this)">${_fmtShort(p.neg1Date)}</span>
            </td>`;
        }
        return `<td style="padding:8px 10px;">
            <button class="cal-set-btn" onclick="window.calInlineDate('${_esc(p.id)}','NEG1',this)">Set NEG-1</button>
        </td>`;
    };

    // Build row
    const buildRow = (p, i) => {
        const fire = p.scannerCompleted ? '🔥🔥 ' : p.scannerClicked ? '🔥 ' : '';
        return `<tr>
            <td style="padding:8px 10px;font-size:10px;color:var(--marble-faint);text-align:center;">${i+1}</td>
            <td style="padding:8px 10px;">
                <div style="font-size:11px;font-weight:600;color:var(--marble);white-space:nowrap;">${fire}${_esc(p.founderName||p.name||'—')}</div>
                <div style="font-size:9px;color:var(--marble-faint);">${_esc(p.prospectId||'')}</div>
            </td>
            <td style="padding:8px 10px;font-size:10px;color:var(--marble-dim);white-space:nowrap;">${_esc(p.company||'—')}</td>
            ${CAL_STEPS.map(s => stepCell(p, s)).join('')}
            ${repliedCell(p)}
            ${neg1Cell(p)}
        </tr>`;
    };

    const thead = `
    <thead>
        <tr>
            <th style="padding:9px 10px;font-size:8px;letter-spacing:.18em;text-transform:uppercase;color:var(--marble-dim);background:var(--surface);border-bottom:1px solid var(--border);white-space:nowrap;">#</th>
            <th style="padding:9px 10px;font-size:8px;letter-spacing:.18em;text-transform:uppercase;color:var(--marble-dim);background:var(--surface);border-bottom:1px solid var(--border);">Founder</th>
            <th style="padding:9px 10px;font-size:8px;letter-spacing:.18em;text-transform:uppercase;color:var(--marble-dim);background:var(--surface);border-bottom:1px solid var(--border);">Company</th>
            <th style="padding:9px 10px;font-size:8px;letter-spacing:.18em;text-transform:uppercase;color:var(--gold);background:var(--surface);border-bottom:1px solid var(--border);">CE</th>
            <th style="padding:9px 10px;font-size:8px;letter-spacing:.18em;text-transform:uppercase;color:var(--marble-dim);background:var(--surface);border-bottom:1px solid var(--border);">FU1</th>
            <th style="padding:9px 10px;font-size:8px;letter-spacing:.18em;text-transform:uppercase;color:var(--marble-dim);background:var(--surface);border-bottom:1px solid var(--border);">FU2</th>
            <th style="padding:9px 10px;font-size:8px;letter-spacing:.18em;text-transform:uppercase;color:var(--marble-dim);background:var(--surface);border-bottom:1px solid var(--border);">FU3</th>
            <th style="padding:9px 10px;font-size:8px;letter-spacing:.18em;text-transform:uppercase;color:var(--marble-dim);background:var(--surface);border-bottom:1px solid var(--border);">FU4</th>
            <th style="padding:9px 10px;font-size:8px;letter-spacing:.18em;text-transform:uppercase;color:#7ab88a;background:var(--surface);border-bottom:1px solid var(--border);">Replied</th>
            <th style="padding:9px 10px;font-size:8px;letter-spacing:.18em;text-transform:uppercase;color:#f97316;background:var(--surface);border-bottom:1px solid var(--border);">NEG-1</th>
        </tr>
    </thead>`;

    let html = '';

    if (scheduled.length) {
        html += `<div style="overflow-x:auto;border:1px solid var(--border);margin-bottom:0;">
            <table style="width:100%;border-collapse:collapse;min-width:860px;font-size:11px;">
                ${thead}
                <tbody>${scheduled.map((p,i) => buildRow(p,i)).join('')}</tbody>
            </table>
        </div>`;
    }

    if (unscheduled.length) {
        html += `
        <div class="cal-unscheduled-divider" style="margin-top:20px;">UNSCHEDULED (${unscheduled.length})</div>
        <div style="overflow-x:auto;border:1px solid var(--border);border-top:none;">
            <table style="width:100%;border-collapse:collapse;min-width:860px;font-size:11px;">
                <thead><tr>
                    <th style="padding:8px 10px;font-size:8px;text-transform:uppercase;letter-spacing:.15em;color:var(--marble-faint);background:var(--surface2);border-bottom:1px solid var(--border);">#</th>
                    <th style="padding:8px 10px;font-size:8px;text-transform:uppercase;letter-spacing:.15em;color:var(--marble-faint);background:var(--surface2);border-bottom:1px solid var(--border);">Founder</th>
                    <th style="padding:8px 10px;font-size:8px;text-transform:uppercase;letter-spacing:.15em;color:var(--marble-faint);background:var(--surface2);border-bottom:1px solid var(--border);">Company</th>
                    <th colspan="7" style="padding:8px 10px;font-size:8px;text-transform:uppercase;letter-spacing:.15em;color:var(--marble-faint);background:var(--surface2);border-bottom:1px solid var(--border);">Sequence Dates</th>
                </tr></thead>
                <tbody>
                    ${unscheduled.map((p,i) => `
                    <tr>
                        <td style="padding:8px 10px;font-size:10px;color:var(--marble-faint);text-align:center;">${i+1}</td>
                        <td style="padding:8px 10px;font-size:11px;font-weight:600;color:var(--marble);">${_esc(p.founderName||p.name||'—')}</td>
                        <td style="padding:8px 10px;font-size:10px;color:var(--marble-dim);">${_esc(p.company||'—')}</td>
                        <td colspan="7" style="padding:8px 10px;">
                            <button class="btn btn-outline btn-sm" onclick="window.calPromptCEDate('${_esc(p.id)}')">Set CE Date → Auto-calc FU1–FU4</button>
                        </td>
                    </tr>`).join('')}
                </tbody>
            </table>
        </div>`;
    }

    wrap.innerHTML = html;
};

// ════════════════════════════════════════════════════════════════════════
// ═════════ VIEW 3: DAILY SCORECARD ═══════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
function renderCalScorecard() {
    const wrap = _$c('cal-scorecard-wrap');
    if (!wrap) return;
    const today = _today();

    // Card 1: Prospects Added
    const addedToday = _pros().filter(p => p.addedAt && p.addedAt.startsWith(today)).length;

    // Card 2: Cold Emails
    const ceQueue  = _pros().filter(p => p.ceDate && p.ceDate <= today && !p.ceSent).length;
    const ceDone   = _pros().filter(p => p.ceSent).length;
    const ceTotal  = ceQueue + ceDone;

    // Card 3: FUs Sent
    let fuQueue = 0, fuDone = 0;
    _pros().forEach(p => {
        ['FU1','FU2','FU3','FU4'].forEach(step => {
            const cfg = CAL_STEP_CFG[step];
            if (p[cfg.sentF]) fuDone++;
            else if (p[cfg.dateF] && p[cfg.dateF] <= today) fuQueue++;
        });
    });

    // Card 4: NEG / Replies
    const negQueue = _pros().filter(p => ['ENGAGED','NEGOTIATING'].includes(p.status)).length;
    const negDone  = _pros().filter(p => p.status === 'CONVERTED').length +
                     _pros().filter(p => p.status === 'NEGOTIATING').length;

    const pct   = (n,d)   => d > 0 ? Math.min(100, Math.round((n/d)*100)) : 0;
    const bar   = (val,max) => {
        const p = pct(val, max);
        const col = p >= 80 ? '#7ab88a' : p >= 40 ? 'var(--gold)' : '#d47a7a';
        return `<div style="height:4px;background:var(--surface2);border:1px solid var(--border);margin:6px 0;">
            <div style="height:100%;background:${col};width:${p}%;transition:width .5s"></div>
        </div>`;
    };

    const metricCard = (label, actual, queue, label2, label3, isEditable) => {
        const total = actual + queue;
        return `
        <div class="scorecard-card">
            <div class="scorecard-label">${label}</div>
            <div class="scorecard-nums" style="display:flex;align-items:baseline;gap:6px;">
                <span>${actual}</span>
                <span style="font-size:14px;color:var(--marble-faint);">/ ${total||'—'}</span>
                ${isEditable ? `<button class="scorecard-edit-btn" onclick="window.calEditTarget()" title="Edit target">✎</button>` : ''}
            </div>
            ${bar(actual, total || 1)}
            <div style="font-size:9px;color:var(--marble-dim);line-height:1.7;">
                <div>${label2}</div>
                <div>${label3}</div>
            </div>
        </div>`;
    };

    // Today's task list — all actions due today
    const taskItems = [];
    _pros().filter(p => !['CONVERTED','DEAD','ARCHIVED'].includes(p.status)).forEach(p => {
        CAL_STEPS.forEach(step => {
            const cfg  = CAL_STEP_CFG[step];
            const date = p[cfg.dateF];
            const sent = p[cfg.sentF];
            if (!date || sent) return;
            const diff = _daysDiff(date);
            if (diff !== null && diff <= 0) {
                taskItems.push({ p, step, diff, label:cfg.seqLabel, date });
            }
        });
        if (p.neg1Date && ['ENGAGED','NEGOTIATING'].includes(p.status)) {
            const diff = _daysDiff(p.neg1Date);
            if (diff !== null && diff <= 0) {
                taskItems.push({ p, step:'NEG1', diff, label:'Send NEG-1', date:p.neg1Date });
            }
        }
    });
    taskItems.sort((a,b) => a.diff - b.diff); // most overdue first

    const taskRows = taskItems.map(t => `
    <div class="task-row">
        <div class="cal-chk" onclick="
            if('${t.step}' === 'NEG1') { window.calTaskCheckNeg1('${_esc(t.p.id)}'); }
            else { window.calMarkSent('${_esc(t.p.id)}','${t.step}'); }
            this.classList.add('checked');
            this.closest('.task-row').classList.add('done');
        "></div>
        <div class="task-label">
            ${_esc(t.label)} — <strong>${_esc(t.p.founderName||t.p.name||'—')}</strong>
            <span style="color:var(--marble-dim)"> · ${_esc(t.p.company||'—')}</span>
        </div>
        <div class="task-type-tag">${t.step}</div>
        <div class="task-date-tag ${t.diff < 0 ? 'overdue' : t.diff===0 ? 'today' : ''}">${t.diff < 0 ? `⚠ ${_fmtShort(t.date)}` : '★ Today'}</div>
    </div>`).join('') || `<div style="padding:16px;font-size:11px;color:var(--marble-faint);">✓ No tasks overdue or due today.</div>`;

    wrap.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px;">
        <div>
            <div style="font-family:'Cormorant Garamond',serif;font-size:22px;color:var(--marble);">Daily Scorecard</div>
            <div style="font-size:10px;color:var(--marble-dim);margin-top:2px;">
                ${new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})}
            </div>
        </div>
        <div style="font-size:9px;color:var(--marble-faint);">Target: <strong style="color:var(--gold)">${calDailyTarget}</strong> prospects/day
            <button class="btn btn-ghost btn-sm" onclick="window.calEditTarget()">✎ Edit</button>
        </div>
    </div>

    <div class="scorecard-grid" style="margin-bottom:24px;">
        ${metricCard('Prospects Added',   addedToday, Math.max(0,calDailyTarget-addedToday), `Added today: ${addedToday}`, `Target: ${calDailyTarget}`, true)}
        ${metricCard('Cold Emails',       ceDone,     ceQueue, `Queue (due): ${ceQueue}`, `Sent (all-time): ${ceDone}`, false)}
        ${metricCard('Follow-Ups Sent',   fuDone,     fuQueue, `Queue (due): ${fuQueue}`, `Sent (all-time): ${fuDone}`, false)}
        ${metricCard('NEG / Replies',     negDone,    negQueue,`In negotiation/reply: ${negQueue}`, `Actioned: ${negDone}`, false)}
    </div>

    <div style="margin-bottom:8px;font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:var(--marble-dim);font-weight:700;">Today's Task List (${taskItems.length})</div>
    <div class="task-list">${taskRows}</div>`;
}

// ════════════════════════════════════════════════════════════════════════
// ═════════ FIRESTORE SYNC FUNCTIONS ══════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════

// Mark a sequence step as sent — advances sequence engine + writes calendar fields
window.calMarkSent = async function(id, step) {
    const p = _pros().find(x => x.id === id);
    if (!p) return;
    const cfg = CAL_STEP_CFG[step];
    if (!cfg) return;
    if (p[cfg.sentF]) return; // already sent, no-op

    const nextDate = cfg.seqStep ? (p[CAL_STEP_CFG[cfg.seqStep]?.dateF] || null) : null;
    const logEntry = { date: _today(), type: cfg.seqLabel, notes: `${cfg.seqLabel} sent — marked via Calendar` };

    const updates = {
        [cfg.sentF]:    true,
        sequenceStep:   cfg.seqStep || (p.sequenceStep || step),
        status:         ['QUEUED'].includes(p.status) ? 'SEQUENCE' : p.status,
        emailsSent:     (p.emailsSent||0) + 1,
        emailLog:       [...(p.emailLog||[]), logEntry],
        nextActionDate: nextDate || p.nextActionDate || '',
        updatedAt:      _nowTs()
    };

    if (step === 'FU4' || !cfg.seqStep) {
        // FU4 — archive prompt (same as sequence engine)
        const archive = confirm(`${cfg.seqLabel} sent. No more follow-ups remain.\nArchive this prospect for revival next quarter?`);
        if (archive) {
            await _archiveFromCalendar(p);
            return;
        }
    }

    try {
        await window.db.collection('prospects').doc(_docKey(p)).update(updates);
        const idx = (window.allProspects||[]).findIndex(x => x.id === id);
        if (idx !== -1) Object.assign(window.allProspects[idx], updates);
        if (window.toast) window.toast(`${cfg.seqLabel} marked sent`);
        renderCalView();
        if (typeof window.renderDealsBoard === 'function') window.renderDealsBoard();
    } catch(e) { console.error(e); if (window.toast) window.toast('Update failed', 'error'); }
};

// Archive helper — mirrors archiveProspectById in tab-hunt-deals.js
async function _archiveFromCalendar(p) {
    const q = ['Q1','Q2','Q3','Q4'];
    const m = new Date().getMonth();
    const cq = m<3?'Q1':m<6?'Q2':m<9?'Q3':'Q4';
    const nq = q[(q.indexOf(cq)+1)%4];
    const updates = { status:'ARCHIVED', archivedAt:_nowTs(), archivedQuarter:cq, revivalQuarter:nq, updatedAt:_nowTs() };
    try {
        await window.db.collection('prospects').doc(_docKey(p)).update(updates);
        const idx = (window.allProspects||[]).findIndex(x => x.id === p.id);
        if (idx !== -1) Object.assign(window.allProspects[idx], updates);
        if (window.toast) window.toast(`Archived — revival set for ${nq}`);
        renderCalView();
    } catch(e) { if (window.toast) window.toast('Archive failed', 'error'); }
}

// Set CE date + auto-calc all FU dates
window.calSetCEDate = async function(id, ceDate, force) {
    const p = _pros().find(x => x.id === id);
    if (!p) return;
    const dates = _calcAllDates(ceDate);

    // If FU dates already exist and not forced, prompt recalc
    if (!force && (p.fu1Date || p.fu2Date) && p.ceDate !== ceDate) {
        const recalc = confirm('Recalculate FU1–FU4 from new CE date? This will overwrite existing FU dates.');
        if (!recalc) {
            // Just update CE date, leave FU dates alone
            const updates = { ceDate, nextActionDate: ceDate, updatedAt: _nowTs() };
            try {
                await window.db.collection('prospects').doc(_docKey(p)).update(updates);
                const idx = (window.allProspects||[]).findIndex(x => x.id === id);
                if (idx !== -1) Object.assign(window.allProspects[idx], updates);
                if (window.toast) window.toast('CE date updated');
                renderCalView();
            } catch(e) { if (window.toast) window.toast('Update failed', 'error'); }
            return;
        }
    }

    const updates = { ...dates, nextActionDate: ceDate, updatedAt: _nowTs() };
    try {
        await window.db.collection('prospects').doc(_docKey(p)).update(updates);
        const idx = (window.allProspects||[]).findIndex(x => x.id === id);
        if (idx !== -1) Object.assign(window.allProspects[idx], updates);
        if (window.toast) window.toast('CE date set — FU1–FU4 auto-calculated');
        renderCalView();
    } catch(e) { console.error(e); if (window.toast) window.toast('Update failed', 'error'); }
};

// Set an individual step date (from inline edit in matrix)
window.calSetStepDate = async function(id, step, date) {
    const p = _pros().find(x => x.id === id);
    if (!p) return;

    let updates;
    if (step === 'CE') {
        // CE date change — use full recalc flow
        await window.calSetCEDate(id, date);
        return;
    } else if (step === 'NEG1') {
        updates = { neg1Date: date, updatedAt: _nowTs() };
    } else {
        const cfg = CAL_STEP_CFG[step];
        if (!cfg) return;
        updates = { [cfg.dateF]: date, updatedAt: _nowTs() };
    }

    try {
        await window.db.collection('prospects').doc(_docKey(p)).update(updates);
        const idx = (window.allProspects||[]).findIndex(x => x.id === id);
        if (idx !== -1) Object.assign(window.allProspects[idx], updates);
        if (window.toast) window.toast(`${step} date updated`);
        renderCalView();
    } catch(e) { if (window.toast) window.toast('Update failed', 'error'); }
};

// Inline date edit — replaces cell content with a date input, saves on change
window.calInlineDate = function(id, step, triggerEl) {
    const p = _pros().find(x => x.id === id);
    if (!p) return;
    const cfg  = step === 'NEG1' ? { dateF:'neg1Date' } : CAL_STEP_CFG[step];
    if (!cfg) return;
    const cur  = p[cfg.dateF] || _today();
    const cell = triggerEl?.closest('td') || triggerEl?.closest('.cal-step-cell');
    if (!cell) {
        // Fallback — prompt
        const d = prompt(`Set ${step} date (YYYY-MM-DD):`, cur);
        if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) window.calSetStepDate(id, step, d);
        return;
    }
    // Inject inline input
    const origHTML = cell.innerHTML;
    cell.innerHTML = `<input type="date" value="${cur}" style="width:110px;background:var(--surface2);border:1px solid var(--gold);color:var(--marble);padding:4px 6px;font-size:11px;font-family:inherit;"
        onchange="window.calSetStepDate('${_esc(id)}','${step}',this.value)"
        onblur="this.closest('td').innerHTML='${origHTML.replace(/'/g,"\\'")}';window.renderCalMatrix();"
        autofocus>`;
    cell.querySelector('input')?.focus();
};

// Prompt CE date (from digest "Set CE Date" button or unscheduled row)
window.calPromptCEDate = function(id) {
    const d = prompt('Enter Cold Email send date (YYYY-MM-DD):', _today());
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) window.calSetCEDate(id, d, true);
};

// Mark replied — status→ENGAGED, remaining FUs strikethrough
window.calMarkReplied = async function(id) {
    const p = _pros().find(x => x.id === id);
    if (!p) return;
    if (p.repliedAt) return; // already replied
    if (!confirm('Mark this prospect as replied? This will advance them to ENGAGED and disable remaining FU steps.')) return;
    const updates = { repliedAt: _nowTs(), status:'ENGAGED', updatedAt: _nowTs() };
    try {
        await window.db.collection('prospects').doc(_docKey(p)).update(updates);
        const idx = (window.allProspects||[]).findIndex(x => x.id === id);
        if (idx !== -1) Object.assign(window.allProspects[idx], updates);
        if (window.toast) window.toast('Marked replied → ENGAGED');
        renderCalView();
        if (typeof window.renderDealsBoard === 'function') window.renderDealsBoard();
    } catch(e) { if (window.toast) window.toast('Update failed', 'error'); }
};

// Mark NEG-1 as sent (logged touch, no sequence step advance)
window.calTaskCheckNeg1 = async function(id) {
    const p = _pros().find(x => x.id === id);
    if (!p) return;
    const entry = { date: _today(), type:'NEG-1 Touch', notes:'NEG-1 sent — marked via Calendar' };
    const updates = {
        status:     'NEGOTIATING',
        emailsSent: (p.emailsSent||0)+1,
        emailLog:   [...(p.emailLog||[]), entry],
        updatedAt:  _nowTs()
    };
    try {
        await window.db.collection('prospects').doc(_docKey(p)).update(updates);
        const idx = (window.allProspects||[]).findIndex(x => x.id === id);
        if (idx !== -1) Object.assign(window.allProspects[idx], updates);
        if (window.toast) window.toast('NEG-1 logged → NEGOTIATING');
        renderCalView();
    } catch(e) { if (window.toast) window.toast('Update failed', 'error'); }
};

// Edit daily prospect target — saves to /settings/config
window.calEditTarget = function() {
    const val = prompt(`Daily prospect target (current: ${calDailyTarget}):`, String(calDailyTarget));
    if (!val) return;
    const n = parseInt(val, 10);
    if (isNaN(n) || n < 1) { if (window.toast) window.toast('Invalid number', 'error'); return; }
    calDailyTarget = n;
    window.db.collection('settings').doc('config').set({ dailyProspectTarget: n }, { merge:true })
        .then(() => { if (window.toast) window.toast(`Target updated to ${n}`); renderCalScorecard(); })
        .catch(() => { if (window.toast) window.toast('Save failed', 'error'); });
};
