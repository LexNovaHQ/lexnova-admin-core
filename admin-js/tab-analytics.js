// ════════════════════════════════════════════════════════════════════════
// ═════════ LEX NOVA ADMIN: ANALYTICS (tab-analytics.js) V1.0 ════════════
// ════════════════════════════════════════════════════════════════════════
// READS:  window.allProspects (owned by tab-hunt-deals.js onSnapshot)
// WRITES: Nothing — pure read + compute
//
// RENDERS INTO: #cc-analytics (Command Center Analytics view)
//   Triggered by setDashView('analytics') in admin.html inline script
//
// SIX SECTIONS:
//   1. Funnel Overview      — 7 KPI cards (Tier 1 — live from day one)
//   2. Sequence Analysis    — step reply rates + drop-off (Tier 2 — placeholder
//                             until first ceSent exists in data)
//   3. Archetype Performance— leaderboard + top 3 prioritization
//   4. Segmentation Grids   — Funding | Geography | Job Title
//   5. Batch Performance    — renders into #cc-batches (already in CC HTML)
//   6. Lane & Plan Intel    — lane table + time-to-convert
//
// AUTO-INSIGHTS: plain JS string templates — no API calls
// ALL TIER 1 metrics compute from existing Firestore fields (no Calendar
//   fields required). TIER 2 metrics compute from ceDate/fu1Date-fu4Date
//   and fuNSent fields written by tab-calendar.js.
// ════════════════════════════════════════════════════════════════════════
'use strict';

// ── HELPERS ────────────────────────────────────────────────────────────
function _pros()     { return window.allProspects || []; }
function _pct(n, d)  { return d > 0 ? Math.round((n/d)*100) : 0; }
function _pctStr(n, d) { return d > 0 ? Math.round((n/d)*100)+'%' : '—'; }
function _days(ts1, ts2) {
    if (!ts1||!ts2) return null;
    const a = new Date(ts1), b = new Date(ts2);
    if (isNaN(a)||isNaN(b)) return null;
    return Math.round(Math.abs(b-a)/86400000);
}
function _escA(s) {
    if (typeof window.esc === 'function') return window.esc(s);
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── BAR COMPONENT ─────────────────────────────────────────────────────
// val = actual, max = denominator, color optional
function _bar(val, max, color) {
    const p   = _pct(val, max||1);
    const col = color || (p >= 70 ? '#7ab88a' : p >= 35 ? 'var(--gold)' : '#d47a7a');
    return `<div style="height:4px;background:var(--surface2);border:1px solid var(--border);margin:5px 0;">
        <div style="height:100%;background:${col};width:${p}%;transition:width .6s;"></div>
    </div>`;
}

// ── ANALYTICS BAR ROW (horizontal bar inside a panel) ─────────────────
function _abar(label, n, d, extra) {
    const p = _pct(n, d||1);
    return `<div class="analytics-bar-row">
        <span class="analytics-bar-label">${_escA(label)}</span>
        <div class="analytics-bar-wrap"><div class="analytics-bar-fill" style="width:${p}%"></div></div>
        <span class="analytics-bar-pct">${_pctStr(n,d)}</span>
        <span class="analytics-bar-n">${extra||''}</span>
    </div>`;
}

// ── PENDING PLACEHOLDER ────────────────────────────────────────────────
function _pending(msg) {
    return `<div class="analytics-pending">
        <div class="analytics-pending-icon">⏳</div>
        <div class="analytics-pending-label">${msg||'Awaiting data'}</div>
    </div>`;
}

// ════════════════════════════════════════════════════════════════════════
// ═════════ ENTRY POINT ═══════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
window.renderAnalytics = function() {
    const wrap = document.getElementById('cc-analytics');
    if (!wrap) return;
    const pros = _pros();
    if (!pros.length) {
        wrap.innerHTML = _pending('No prospect data loaded yet. Outreach listener is initialising.');
        return;
    }
    wrap.innerHTML = `
        <div id="an-funnel"></div>
        <div id="an-sequence"></div>
        <div id="an-archetype"></div>
        <div id="an-segments"></div>
        <div id="an-lane"></div>`;

    _renderFunnelKPIs(pros);
    _renderSequenceAnalysis(pros);
    _renderArchetypeGrid(pros);
    _renderSegmentationGrids(pros);
    _renderLaneIntelligence(pros);
    // Batch performance renders into #cc-batches — already called by
    // renderBatchPerformance() in tab-hunt-deals.js on every snapshot.
};

// ════════════════════════════════════════════════════════════════════════
// ═════════ SECTION 1 — FUNNEL OVERVIEW ═══════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
function _renderFunnelKPIs(pros) {
    const el = document.getElementById('an-funnel');
    if (!el) return;

    const total     = pros.filter(p => p.status !== 'DEAD').length;
    const emailsSent= pros.reduce((s,p)=>s+(p.emailsSent||0),0);
    const replied   = pros.filter(p=>p.repliedAt).length;
    const clicked   = pros.filter(p=>p.scannerClicked||p.scannerCompleted).length;
    const completed = pros.filter(p=>p.scannerCompleted).length;
    const converted = pros.filter(p=>p.status==='CONVERTED').length;
    // withEmails = prospects that have received at least 1 email
    const withEmails= pros.filter(p=>(p.emailsSent||0)>0).length;

    const kpi = (label, val, sub, color) => `
    <div class="analytics-kpi-card">
        <div class="analytics-kpi-label">${label}</div>
        <div class="analytics-kpi-value" style="color:${color||'var(--marble)'};">${val}</div>
        <div class="analytics-kpi-sub">${sub}</div>
    </div>`;

    el.innerHTML = `
    <div class="section-title" style="margin-top:0">Funnel Overview</div>
    <div class="section-sub">Live from outreach data · all non-dead prospects</div>
    <div class="analytics-kpi-strip">
        ${kpi('Total ICPs',        total,       'All non-dead prospects')}
        ${kpi('Emails Sent',       emailsSent,  `Across ${withEmails} prospects`)}
        ${kpi('Reply Rate',        _pctStr(replied, withEmails), `${replied} replied of ${withEmails} emailed`)}
        ${kpi('Scanner Click %',   _pctStr(clicked, total),    `${clicked} clicked`)}
        ${kpi('Scanner Complete %',_pctStr(completed, total),  `${completed} completed`)}
        ${kpi('Converted %',       _pctStr(converted, total),  `${converted} paid`)}
        ${kpi('Close Rate',        _pctStr(converted, completed||1), 'Scanner → Paid', 'var(--gold)')}
    </div>`;
}

// ════════════════════════════════════════════════════════════════════════
// ═════════ SECTION 2 — SEQUENCE STEP ANALYSIS (TIER 2) ═══════════════════
// ════════════════════════════════════════════════════════════════════════
function _renderSequenceAnalysis(pros) {
    const el = document.getElementById('an-sequence');
    if (!el) return;

    // Gate: Tier 2 needs Calendar field data (ceSent must exist on at least one prospect)
    const hasCalData = pros.some(p => p.ceSent);

    el.innerHTML = `
    <div class="section-title">Sequence Step Analysis</div>
    <div class="section-sub">Reply rates and drop-off per sequence step · requires Calendar data</div>
    <div class="analytics-grid-2" style="margin-bottom:24px;">
        <div class="analytics-panel">
            <div class="analytics-panel-title">Step Reply Rates</div>
            ${!hasCalData ? _pending('Awaiting Calendar sequence data.<br>Available after first batch completes through the Calendar sequence.') : _calcStepReplyRates(pros)}
        </div>
        <div class="analytics-panel">
            <div class="analytics-panel-title">Sequence Drop-off Funnel</div>
            ${!hasCalData ? _pending('Awaiting Calendar sequence data.') : _calcDropOff(pros)}
        </div>
    </div>`;
}

function _calcStepReplyRates(pros) {
    // For each step, compute: sent count + how many replied between this step date and next step date
    const steps = [
        { key:'CE',  sentF:'ceSent',  dateF:'ceDate',  nextDateF:'fu1Date', label:'Cold Email' },
        { key:'FU1', sentF:'fu1Sent', dateF:'fu1Date', nextDateF:'fu2Date', label:'Follow-Up 1' },
        { key:'FU2', sentF:'fu2Sent', dateF:'fu2Date', nextDateF:'fu3Date', label:'Follow-Up 2' },
        { key:'FU3', sentF:'fu3Sent', dateF:'fu3Date', nextDateF:'fu4Date', label:'Follow-Up 3' },
        { key:'FU4', sentF:'fu4Sent', dateF:'fu4Date', nextDateF:null,      label:'Follow-Up 4' }
    ];

    let bestStep='', bestRate=0;
    const rows = steps.map(s => {
        const sent    = pros.filter(p=>p[s.sentF]).length;
        const replied = pros.filter(p => {
            if (!p.repliedAt || !p[s.sentF]) return false;
            const rDate = p.repliedAt.split('T')[0];
            const from  = p[s.dateF] || '';
            const to    = s.nextDateF ? (p[s.nextDateF]||'9999') : '9999';
            return rDate >= from && rDate < to;
        }).length;
        const rate = _pct(replied, sent||1);
        if (sent > 0 && rate > bestRate) { bestRate=rate; bestStep=s.label; }
        return _abar(s.label, replied, sent||1, `${replied}/${sent} sent`);
    }).join('');

    const insight = bestStep
        ? `<div class="analytics-insight">🎯 ${_escA(bestStep)} is your highest-reply step at ${bestRate}%.</div>`
        : '';
    return rows + insight;
}

function _calcDropOff(pros) {
    const total     = pros.filter(p=>p.status!=='DEAD').length;
    const ceSent    = pros.filter(p=>p.ceSent).length;
    const fu1Sent   = pros.filter(p=>p.fu1Sent).length;
    const fu2Sent   = pros.filter(p=>p.fu2Sent).length;
    const fu3Sent   = pros.filter(p=>p.fu3Sent).length;
    const fu4Sent   = pros.filter(p=>p.fu4Sent).length;
    const replied   = pros.filter(p=>p.repliedAt).length;
    const converted = pros.filter(p=>p.status==='CONVERTED').length;

    const stages = [
        ['ICPs Added', total],['CE Sent', ceSent],['FU1 Sent', fu1Sent],
        ['FU2 Sent', fu2Sent],['FU3 Sent', fu3Sent],['FU4 Sent', fu4Sent],
        ['Replied', replied],['Converted', converted]
    ];
    return stages.map(([label, n]) => _abar(label, n, total, `${n} · ${_pctStr(n,total)}`)).join('');
}

// ════════════════════════════════════════════════════════════════════════
// ═════════ SECTION 3 — ARCHETYPE PERFORMANCE ═════════════════════════════
// ════════════════════════════════════════════════════════════════════════
function _renderArchetypeGrid(pros) {
    const el = document.getElementById('an-archetype');
    if (!el) return;

    // Map prospects to their primary archetype
    const archetypeMap = {};
    pros.forEach(p => {
        const archs = p.intArchetypes||[];
        const primary = archs.length
            ? archs[0].replace(/\[INT\.\d+\]\s*/,'').replace(/^The /,'')
            : (p.internalCategory||'Unknown');
        if (!archetypeMap[primary]) archetypeMap[primary]={total:0,replied:0,scanComp:0,converted:0};
        archetypeMap[primary].total++;
        if (p.repliedAt) archetypeMap[primary].replied++;
        if (p.scannerCompleted) archetypeMap[primary].scanComp++;
        if (p.status==='CONVERTED') archetypeMap[primary].converted++;
    });

    // Score = (Reply% × 0.3) + (ScanComplete% × 0.4) + (Converted% × 0.3)
    const rows = Object.entries(archetypeMap)
        .filter(([,v]) => v.total >= 2) // min sample size
        .map(([name, v]) => {
            const replyPct = _pct(v.replied,   v.total);
            const scanPct  = _pct(v.scanComp,  v.total);
            const convPct  = _pct(v.converted, v.total);
            const score    = Math.round(replyPct*0.3 + scanPct*0.4 + convPct*0.3);
            return { name, ...v, replyPct, scanPct, convPct, score };
        })
        .sort((a,b) => b.score - a.score);

    if (!rows.length) {
        el.innerHTML = `<div class="section-title">Archetype Performance</div>${_pending('Minimum 2 prospects per archetype required for analysis.')}`;
        return;
    }

    // Score thresholds: high = top 30th percentile, low = bottom 30th
    const scores = rows.map(r=>r.score).sort((a,b)=>b-a);
    const highThresh = scores[Math.floor(scores.length*0.3)]||70;
    const lowThresh  = scores[Math.floor(scores.length*0.7)]||30;

    const tableRows = rows.map(r => {
        const flag = r.score >= highThresh ? '<span style="color:#7ab88a;font-weight:700">🟢 High</span>'
            : r.score <= lowThresh ? '<span style="color:#d47a7a;font-weight:700">🔴 Low</span>'
            : '<span style="color:var(--gold);font-weight:700">🟡 Mid</span>';
        return `<tr>
            <td>${_escA(r.name)}</td>
            <td class="dim">${r.total}</td>
            <td class="dim">${r.replyPct}%</td>
            <td class="dim">${r.scanPct}%</td>
            <td class="dim">${r.convPct}%</td>
            <td>${flag} <span style="font-size:9px;color:var(--marble-faint)">${r.score}</span></td>
        </tr>`;
    }).join('');

    // Top 3 recommendation cards
    const top3 = rows.slice(0,3);
    const medals = ['🥇','🥈','🥉'];
    const recCards = top3.map((r,i) => {
        const action = i===0?'Prioritize in next batch':i===1?'Maintain allocation':'Test larger sample';
        return `<div style="background:var(--surface2);border:1px solid var(--border);padding:12px;flex:1 1 200px;">
            <div style="font-size:18px;margin-bottom:4px">${medals[i]}</div>
            <div style="font-size:11px;font-weight:700;color:var(--marble);margin-bottom:4px">${_escA(r.name)}</div>
            <div style="font-size:9px;color:var(--marble-faint);margin-bottom:8px">Score: ${r.score} · Reply: ${r.replyPct}% · Conv: ${r.convPct}%</div>
            <div style="font-size:10px;color:var(--gold)">→ ${action}</div>
        </div>`;
    }).join('');

    // Auto-insight
    const best = rows[0];
    const overall = _pct(pros.filter(p=>p.repliedAt).length, pros.filter(p=>(p.emailsSent||0)>0).length||1);
    const insight = best && best.replyPct > overall
        ? `${_escA(best.name)}s reply at ${best.replyPct}% — ${Math.round(best.replyPct/(overall||1)*10)/10}× your baseline. Increase allocation next batch.`
        : `${_escA(best?.name||'Top archetype')} leads your performance at score ${best?.score||0}.`;

    el.innerHTML = `
    <div class="section-title">Archetype Performance</div>
    <div class="section-sub">Minimum 2 prospects per archetype · Score = Reply×0.3 + Scan×0.4 + Conv×0.3</div>
    <div class="analytics-grid-2" style="margin-bottom:24px;">
        <div class="analytics-panel">
            <div class="analytics-panel-title">Archetype Leaderboard</div>
            <div class="tbl-wrap" style="border:none;margin:0">
                <table style="min-width:0">
                    <thead><tr>
                        <th>Archetype</th><th>n</th><th>Reply%</th><th>Scan%</th><th>Conv%</th><th>Score</th>
                    </tr></thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>
            <div class="analytics-insight">${insight}</div>
        </div>
        <div class="analytics-panel">
            <div class="analytics-panel-title">Top Archetypes to Prioritize</div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">${recCards||_pending('Insufficient data for ranking.')}</div>
        </div>
    </div>`;
}

// ════════════════════════════════════════════════════════════════════════
// ═════════ SECTION 4 — SEGMENTATION GRIDS ════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
function _renderSegmentationGrids(pros) {
    const el = document.getElementById('an-segments');
    if (!el) return;

    // ── Funding Stage ──
    const fundingGroups = {};
    pros.forEach(p => {
        const f = p.fundingStage||'Unknown';
        if (!fundingGroups[f]) fundingGroups[f]={total:0,replied:0,scan:0,conv:0};
        fundingGroups[f].total++;
        if(p.repliedAt) fundingGroups[f].replied++;
        if(p.scannerCompleted) fundingGroups[f].scan++;
        if(p.status==='CONVERTED') fundingGroups[f].conv++;
    });

    const overallConvRate = _pct(pros.filter(p=>p.status==='CONVERTED').length, pros.length||1);
    const bestFunding = Object.entries(fundingGroups)
        .filter(([,v])=>v.total>=3)
        .sort((a,b)=>_pct(b[1].conv,b[1].total)-_pct(a[1].conv,a[1].total))[0];

    const fundingRows = Object.entries(fundingGroups)
        .sort((a,b)=>b[1].total-a[1].total)
        .map(([stage,v])=>`<tr>
            <td>${_escA(stage)}</td>
            <td class="dim">${v.total}</td>
            <td class="dim">${_pctStr(v.replied,v.total)}</td>
            <td class="dim">${_pctStr(v.scan,v.total)}</td>
            <td class="dim">${_pctStr(v.conv,v.total)}</td>
        </tr>`).join('');

    const fundingInsight = bestFunding && _pct(bestFunding[1].conv,bestFunding[1].total) > overallConvRate
        ? `${_escA(bestFunding[0])} converts at ${_pctStr(bestFunding[1].conv,bestFunding[1].total)} — ${Math.round(_pct(bestFunding[1].conv,bestFunding[1].total)/(overallConvRate||1)*10)/10}× your overall rate.`
        : 'Insufficient conversion data for funding stage recommendation.';

    // ── Geography ──
    const geoGroups = {};
    pros.forEach(p => {
        const raw = p.registrationJurisdiction||p.geography||'Unknown';
        // Normalise to short geo labels
        const g = raw.length<=5 ? raw.toUpperCase()
            : raw.toLowerCase().includes('unit') ? 'US'
            : raw.toLowerCase().includes('uk')||raw.toLowerCase().includes('kingdom') ? 'UK'
            : raw.toLowerCase().includes('canada') ? 'Canada'
            : raw.toLowerCase().includes('austr') ? 'AU'
            : raw.length>12 ? raw.split(/[\s,]/)[0] : raw;
        if (!geoGroups[g]) geoGroups[g]={total:0,replied:0,scan:0,conv:0};
        geoGroups[g].total++;
        if(p.repliedAt) geoGroups[g].replied++;
        if(p.scannerCompleted) geoGroups[g].scan++;
        if(p.status==='CONVERTED') geoGroups[g].conv++;
    });

    const geoRows = Object.entries(geoGroups)
        .sort((a,b)=>b[1].total-a[1].total)
        .slice(0,8)
        .map(([geo,v])=>`<tr>
            <td>${_escA(geo)}</td>
            <td class="dim">${v.total}</td>
            <td class="dim">${_pctStr(v.replied,v.total)}</td>
            <td class="dim">${_pctStr(v.scan,v.total)}</td>
            <td class="dim">${_pctStr(v.conv,v.total)}</td>
        </tr>`).join('');

    const bestGeo = Object.entries(geoGroups)
        .filter(([,v])=>v.total>=3)
        .sort((a,b)=>_pct(b[1].conv,b[1].total)-_pct(a[1].conv,a[1].total))[0];
    const geoInsight = bestGeo
        ? `${_escA(bestGeo[0])} is your highest-converting geo at ${_pctStr(bestGeo[1].conv,bestGeo[1].total)} — ${bestGeo[1].total} prospects tested.`
        : 'No geo with 3+ prospects has converted yet.';

    // ── Job Title ──
    const titleBuckets = { 'CEO/Founder':{total:0,replied:0,scan:0,conv:0}, 'CTO/CPO':{total:0,replied:0,scan:0,conv:0}, 'Head of/Dir':{total:0,replied:0,scan:0,conv:0}, 'Other':{total:0,replied:0,scan:0,conv:0} };
    pros.forEach(p => {
        const t = (p.jobTitle||'').toLowerCase();
        let bucket = 'Other';
        if (t.match(/\b(ceo|founder|co-founder|cofounder|owner|president|managing director)\b/)) bucket='CEO/Founder';
        else if (t.match(/\b(cto|cpo|vp (of )?engineering|vp (of )?product|chief (technology|product))\b/)) bucket='CTO/CPO';
        else if (t.match(/\b(head of|director|vp|vice president)\b/)) bucket='Head of/Dir';
        titleBuckets[bucket].total++;
        if(p.repliedAt) titleBuckets[bucket].replied++;
        if(p.scannerCompleted) titleBuckets[bucket].scan++;
        if(p.status==='CONVERTED') titleBuckets[bucket].conv++;
    });

    const titleRows = Object.entries(titleBuckets)
        .filter(([,v])=>v.total>0)
        .map(([title,v])=>`<tr>
            <td>${_escA(title)}</td>
            <td class="dim">${v.total}</td>
            <td class="dim">${_pctStr(v.replied,v.total)}</td>
            <td class="dim">${_pctStr(v.scan,v.total)}</td>
            <td class="dim">${_pctStr(v.conv,v.total)}</td>
        </tr>`).join('');

    const ceoBucket = titleBuckets['CEO/Founder'];
    const dirBucket = titleBuckets['Head of/Dir'];
    const titleInsight = ceoBucket.total>3 && dirBucket.total>3
        ? `Founders reply at ${_pctStr(ceoBucket.replied,ceoBucket.total)} vs ${_pctStr(dirBucket.replied,dirBucket.total)} for Directors. Target decision-makers only.`
        : 'Insufficient data for title comparison.';

    const segGrid = (title, insight, rows) => `
    <div class="analytics-panel">
        <div class="analytics-panel-title">${title}</div>
        <div class="tbl-wrap" style="border:none;margin:0;">
            <table style="min-width:0">
                <thead><tr><th>Segment</th><th>n</th><th>Reply%</th><th>Scan%</th><th>Conv%</th></tr></thead>
                <tbody>${rows||'<tr><td colspan="5" class="loading" style="padding:12px">No data</td></tr>'}</tbody>
            </table>
        </div>
        <div class="analytics-insight">${insight}</div>
    </div>`;

    el.innerHTML = `
    <div class="section-title">Segmentation Grids</div>
    <div class="section-sub">Reply, scanner completion, and conversion rates by segment</div>
    <div class="analytics-grid-2" style="margin-bottom:12px;">
        ${segGrid('Funding Stage', fundingInsight, fundingRows)}
        ${segGrid('Geography',     geoInsight,     geoRows)}
    </div>
    <div style="margin-bottom:24px;">
        ${segGrid('Job Title', titleInsight, titleRows)}
    </div>`;
}

// ════════════════════════════════════════════════════════════════════════
// ═════════ SECTION 6 — LANE & PLAN INTELLIGENCE ══════════════════════════
// ════════════════════════════════════════════════════════════════════════
function _renderLaneIntelligence(pros) {
    const el = document.getElementById('an-lane');
    if (!el) return;

    // ── Lane Performance ──
    const laneMap = { commercial:{total:0,replied:0,scan:0,conv:0,rev:0}, operational:{total:0,replied:0,scan:0,conv:0,rev:0}, both:{total:0,replied:0,scan:0,conv:0,rev:0} };
    const planPrices = { agentic_shield:997, workplace_shield:997, complete_stack:2000, flagship:15000 };

    pros.forEach(p => {
        const lanes = p.lanes||[];
        let key = 'commercial';
        if (lanes.includes('commercial')&&lanes.includes('operational')) key='both';
        else if (lanes.includes('operational')) key='operational';
        if (!laneMap[key]) laneMap[key]={total:0,replied:0,scan:0,conv:0,rev:0};
        laneMap[key].total++;
        if(p.repliedAt) laneMap[key].replied++;
        if(p.scannerCompleted) laneMap[key].scan++;
        if(p.status==='CONVERTED') {
            laneMap[key].conv++;
            laneMap[key].rev += planPrices[p.intendedPlan||p.plan||'agentic_shield']||0;
        }
    });

    const laneLabels = { commercial:'Lane A (Agentic)', operational:'Lane B (Workplace)', both:'Complete Stack' };
    const laneRows = Object.entries(laneMap)
        .filter(([,v])=>v.total>0)
        .map(([k,v])=>`<tr>
            <td>${_escA(laneLabels[k]||k)}</td>
            <td class="dim">${v.total}</td>
            <td class="dim">${_pctStr(v.replied,v.total)}</td>
            <td class="dim">${_pctStr(v.scan,v.total)}</td>
            <td class="dim">${_pctStr(v.conv,v.total)}</td>
            <td style="color:var(--gold);">${v.rev?'$'+v.rev.toLocaleString():'—'}</td>
        </tr>`).join('');

    // ── Plan Performance ──
    const planMap = {};
    pros.forEach(p => {
        const plan = p.intendedPlan||p.plan||'agentic_shield';
        if (!planMap[plan]) planMap[plan]={total:0,replied:0,scan:0,conv:0};
        planMap[plan].total++;
        if(p.repliedAt) planMap[plan].replied++;
        if(p.scannerCompleted) planMap[plan].scan++;
        if(p.status==='CONVERTED') planMap[plan].conv++;
    });

    const planNames = { agentic_shield:'Agentic Shield', workplace_shield:'Workplace Shield', complete_stack:'Complete Stack', flagship:'Flagship' };
    const planRows = Object.entries(planMap)
        .sort((a,b)=>b[1].total-a[1].total)
        .map(([k,v])=>`<tr>
            <td>${_escA(planNames[k]||k)}</td>
            <td class="dim">${v.total}</td>
            <td class="dim">${_pctStr(v.replied,v.total)}</td>
            <td class="dim">${_pctStr(v.scan,v.total)}</td>
            <td class="dim">${_pctStr(v.conv,v.total)}</td>
        </tr>`).join('');

    // ── Time to Convert ──
    const converted = pros.filter(p=>p.status==='CONVERTED'&&p.addedAt&&p.repliedAt);
    let timeHtml='';
    if (converted.length >= 2) {
        const avgAddedToReply = Math.round(
            converted.reduce((s,p)=>s+(_days(p.addedAt,p.repliedAt)||0),0)/converted.length
        );
        const avgRepliedToConv = Math.round(
            converted.filter(p=>p.repliedAt&&p.updatedAt).reduce((s,p)=>s+(_days(p.repliedAt,p.updatedAt)||0),0)/converted.length
        );
        timeHtml = `
        <div class="analytics-panel" style="margin-top:0;">
            <div class="analytics-panel-title">Time to Convert (${converted.length} data points)</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;">
                <div>
                    <div style="font-size:9px;color:var(--marble-faint);text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px;">Added → Reply</div>
                    <div style="font-family:'Cormorant Garamond',serif;font-size:28px;color:var(--marble)">${avgAddedToReply}<span style="font-size:14px;color:var(--marble-dim)"> days</span></div>
                </div>
                <div>
                    <div style="font-size:9px;color:var(--marble-faint);text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px;">Reply → Converted</div>
                    <div style="font-family:'Cormorant Garamond',serif;font-size:28px;color:var(--marble)">${avgRepliedToConv}<span style="font-size:14px;color:var(--marble-dim)"> days</span></div>
                </div>
                <div>
                    <div style="font-size:9px;color:var(--marble-faint);text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px;">Total Sales Cycle</div>
                    <div style="font-family:'Cormorant Garamond',serif;font-size:28px;color:var(--gold)">${avgAddedToReply+avgRepliedToConv}<span style="font-size:14px;color:var(--marble-dim)"> days</span></div>
                </div>
            </div>
        </div>`;
    } else {
        timeHtml = `<div class="analytics-panel" style="margin-top:0">${_pending(`Available after ${Math.max(0,2-converted.length)} more conversion${2-converted.length!==1?'s':''}.`)}</div>`;
    }

    el.innerHTML = `
    <div class="section-title">Lane & Plan Intelligence</div>
    <div class="section-sub">Performance by product lane and plan type</div>
    <div class="analytics-grid-2" style="margin-bottom:12px;">
        <div class="analytics-panel">
            <div class="analytics-panel-title">Lane Performance</div>
            <div class="tbl-wrap" style="border:none;margin:0;">
                <table style="min-width:0">
                    <thead><tr><th>Lane</th><th>n</th><th>Reply%</th><th>Scan%</th><th>Conv%</th><th>Revenue</th></tr></thead>
                    <tbody>${laneRows||'<tr><td colspan="6" class="loading">No lane data</td></tr>'}</tbody>
                </table>
            </div>
        </div>
        <div class="analytics-panel">
            <div class="analytics-panel-title">Plan Distribution</div>
            <div class="tbl-wrap" style="border:none;margin:0;">
                <table style="min-width:0">
                    <thead><tr><th>Plan</th><th>n</th><th>Reply%</th><th>Scan%</th><th>Conv%</th></tr></thead>
                    <tbody>${planRows||'<tr><td colspan="5" class="loading">No plan data</td></tr>'}</tbody>
                </table>
            </div>
        </div>
    </div>
    ${timeHtml}
    <div style="height:32px;"></div>`; // bottom breathing room
}
