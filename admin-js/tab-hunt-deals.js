// ════════════════════════════════════════════════════════════════════════
// ═════════ LEX NOVA ADMIN: SALES CRM (tab-hunt-deals.js) ════════════════
// ════════════════════════════════════════════════════════════════════════
// Description: The Hunt pipeline, Active Deals Kanban, and Prospect Panel.
// ════════════════════════════════════════════════════════════════════════
'use strict';

// ─── LOCAL UTILITIES TO PRESERVE EXACT LEGACY CODE FUNCTIONALITY ────────
const $ = id => document.getElementById(id);
const qsa = sel => Array.from(document.querySelectorAll(sel));
function fmtDate(ts) { 
    if (!ts) return '—'; 
    const d = ts.toDate ? ts.toDate() : new Date(ts); 
    if (isNaN(d)) return '—'; 
    return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }); 
}
function fmtMoney(n) { return (n == null || isNaN(n)) ? '—' : '$' + Number(n).toLocaleString('en-US'); }
function setText(id, txt) { const el = $(id); if (el) el.textContent = String(txt ?? ''); }

const PLANS = { 
    agentic_shield: 'Agentic Shield', 
    workplace_shield: 'Workplace Shield', 
    complete_stack: 'Complete Stack', 
    flagship: 'Flagship' 
};


// ════════════════════════════════════════════════════════════════════════
// ═════════ GLOBAL STATE FOR CRM ═════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
window.allProspects    = [];
window.allFlagship     = [];
window.currentProspect = null;
window.currentFlagship = null;


// ════════════════════════════════════════════════════════════════════════
// ═════════ THE HUNTER CRM (OUTREACH SYNC) ═══════════════════════════════
// ════════════════════════════════════════════════════════════════════════
let outreachListener = null;

window.loadOutreach = function() {
  const pageActions = $('pageActions');
  if (pageActions) pageActions.innerHTML = '';
  
  if (outreachListener) outreachListener(); 

  outreachListener = window.db.collection('prospects').onSnapshot((snap) => {
    try {
        window.allProspects = [];
        snap.forEach(d => window.allProspects.push({ id: d.id, ...d.data() }));
        
        try { populateCommandCenter(); } catch(e) { console.error('Command Center Render Error:', e); }
        try { if (typeof renderDealsBoard === 'function') renderDealsBoard(); } catch(e) { console.error('Deals Board Render Error:', e); }
        try { filterProspects(); } catch(e) { console.error('Hunt Pipeline Render Error:', e); }
        try { populateBatchFilter(); } catch(e) { console.error('Batch Filter Render Error:', e); }

    } catch (fatal) {
        console.error("Fatal Outreach Sync Error:", fatal);
    }
  }, (e) => {
    console.error(e);
    if(window.toast) window.toast('Outreach Sync Failed', 'error');
  });
};

function populateCommandCenter() {
  let totalEmails = 0, totalClicks = 0, totalComps = 0, totalPaid = 0, convEmailCount = 0;
  const todayStr = new Date().toISOString().split('T')[0];
  let fuToday = 0, fuOver = 0, liPending = 0;

  window.allProspects.forEach(p => {
    totalEmails += (p.emailsSent || 0);
    if (p.scannerClicked || p.scannerCompleted) totalClicks++;
    if (p.scannerCompleted) totalComps++;
    if (p.status === 'Converted') {
        totalPaid++;
        convEmailCount += (p.emailsSent || 1);
    }
    if (!['Converted','Dead'].includes(p.status)) {
      if (p.nextActionDate === todayStr) fuToday++;
      if (p.nextActionDate < todayStr) fuOver++;
      if (['pending','connected_no_reply'].includes(p.linkedinStatus)) liPending++;
    }
  });

  setText('oc-emails-all', totalEmails);
  setText('oc-clicks-all', totalClicks);
  setText('oc-click-rate', totalEmails > 0 ? Math.round((totalClicks/totalEmails)*100) + '% click rate' : '0% click rate');
  setText('oc-comps-all', totalComps);
  setText('oc-comp-rate', totalClicks > 0 ? Math.round((totalComps/totalClicks)*100) + '% completion rate' : '0% completion rate');
  setText('oc-paid-all', totalPaid);
  setText('oc-close-rate', totalComps > 0 ? Math.round((totalPaid/totalComps)*100) + '% close rate' : '0% close rate');

  setText('aq-today', fuToday);
  setText('aq-over', fuOver);
  setText('aq-li', liPending);
  
  const avgFuEl = $('oc-avg-fu');
  if (avgFuEl) avgFuEl.textContent = totalPaid > 0 ? (convEmailCount / totalPaid).toFixed(1) : '—';

  window.db.collection('leads').where('status','in',['new','scanner_submitted']).get()
    .then(snap => setText('aq-inbound', snap.size)).catch(() => {});

  renderBatchPerformance();
}

function renderBatchPerformance() {
  const tbodies = document.querySelectorAll('#oc-batches');
  if (tbodies.length === 0) return;

  const batches = {};
  window.allProspects.forEach(p => {
    const b = p.batchNumber || 'Unassigned';
    if (!batches[b]) batches[b] = { prospects:0, emails:0, clicks:0, comps:0, conv:0 };
    batches[b].prospects++;
    batches[b].emails += p.emailsSent || 0;
    if (p.scannerClicked || p.scannerCompleted) batches[b].clicks++;
    if (p.scannerCompleted) batches[b].comps++;
    if (p.status === 'Converted') batches[b].conv++;
  });
  
  const keys = Object.keys(batches).sort();
  const html = !keys.length 
    ? '<tr><td colspan="7" class="loading">No batches yet</td></tr>'
    : keys.map(b => {
        const r = batches[b];
        const roi = r.comps > 0 ? Math.round((r.conv/r.comps)*100)+'%' : '0%';
        return `<tr>
          <td>${window.esc(b)}</td><td>${r.prospects}</td><td>${r.emails}</td>
          <td>${r.clicks}</td><td>${r.comps}</td><td>${r.conv}</td><td style="color:var(--gold);">${roi}</td>
        </tr>`;
      }).join('');
      
  tbodies.forEach(tb => tb.innerHTML = html);
}


// ════════════════════════════════════════════════════════════════════════
// ═════════ THE IDENTIFIER TRIAD (SEARCH FILTER) V3 UPGRADE ══════════════
// ════════════════════════════════════════════════════════════════════════
window.populateBatchFilter = function() {
  const sel = $('op-batch');
  if (!sel || sel.options.length > 1) return;
  [...new Set(window.allProspects.map(p => p.batchNumber).filter(Boolean))].sort().forEach(b => {
    const o = document.createElement('option'); o.value = b; o.textContent = b;
    sel.appendChild(o);
  });
};

window.filterProspects = function() {
  const s   = ($('op-search')?.value || '').toLowerCase();
  const st  = $('op-status')?.value  || '';
  const bt  = $('op-batch')?.value   || '';
  const fs  = $('op-funding')?.value || '';
  const sc  = $('op-scanner')?.value || '';
  const gap = $('op-gap')?.value || ''; // V3: NUCLEAR, CRITICAL, HIGH, MEDIUM
  const ai  = $('op-ai')?.value || '';  // V3: Internal Categories (The Doers, etc)
  const li  = $('op-li-filter')?.value || '';
  const srt = $('op-sort')?.value || 'nextDate';

  let list = window.allProspects.filter(p => {
    // 1. V3 Severity Gap Filter (Fallback to legacy legalGapStatus)
    let matchGap = false;
    if (!gap) matchGap = true;
    else if (p.detectedGaps && Array.isArray(p.detectedGaps)) {
        matchGap = p.detectedGaps.some(g => g.severity === gap);
    } else {
        matchGap = (p.legalGapStatus === gap);
    }

    // 2. V3 Category Filter (Fallback to legacy aiNative/externalAI)
    let matchAi = false;
    if (!ai) matchAi = true;
    else if (p.internalCategory === ai) matchAi = true;
    else if (!p.internalCategory) {
        matchAi = ((ai === 'native' && p.aiNative) || (ai === 'external' && p.externalAI));
    }

    return (!s  || (p.prospectId||'').toLowerCase().includes(s) ||
             (p.founderName||p.name||'').toLowerCase().includes(s) ||
             (p.company||'').toLowerCase().includes(s) ||
             (p.email||'').toLowerCase().includes(s)) &&
    (!st || p.status === st) &&
    (!bt || p.batchNumber === bt) &&
    (!fs || p.fundingStage === fs) &&
    (!li || p.linkedinStatus === li) &&
    matchGap &&
    matchAi &&
    (!sc || (sc==='clicked'   &&  p.scannerClicked && !p.scannerCompleted) ||
            (sc==='completed' &&  p.scannerCompleted) ||
            (sc==='none'      && !p.scannerClicked && !p.scannerCompleted));
  });

  if (srt === 'dateAdded') {
      list.sort((a,b) => (b.addedAt||'').localeCompare(a.addedAt||''));
  } else if (srt === 'score') {
      list.sort((a,b) => (b.scannerExternalScore||0) - (a.scannerExternalScore||0));
  } else if (srt === 'company') {
      list.sort((a,b) => (a.company||'').localeCompare(b.company||''));
  } else if (srt === 'emailsSent') {
      list.sort((a,b) => (b.emailsSent||0) - (a.emailsSent||0));
  } else {
      list.sort((a,b) => {
          const dateA = a.nextActionDate || '9999-99-99';
          const dateB = b.nextActionDate || '9999-99-99';
          return dateA.localeCompare(dateB);
      });
  }

  renderPipeline(list);
};

function renderPipeline(list) {
  const tbodies = document.querySelectorAll('#op-tbody');
  if (tbodies.length === 0) return;

  const rows = list.filter(p => p.status !== 'Dead');
  const sClass = { Cold:'b-cold', Warm:'b-warm', Hot:'b-hot', Replied:'b-intake', Negotiating:'b-production', Converted:'b-converted' };
                    
  const html = !rows.length 
    ? '<tr><td colspan="9" class="loading">No prospects found</td></tr>'
    : rows.map(p => {
        const fire = p.scannerCompleted ? '🔥🔥' : p.scannerClicked ? '🔥' : '';
        const scan = p.scannerCompleted ? '<span class="badge b-delivered">Completed</span>' : p.scannerClicked ? '<span class="badge b-warm">Clicked</span>' : '<span class="badge b-ghost">—</span>';
        
        // V3 Threat Indicator
        const isNuclear = p.detectedGaps && p.detectedGaps.some(g => g.severity === 'NUCLEAR');
        const threatIcon = isNuclear ? '<span style="color:#ef4444; font-size:10px; margin-left:4px;">🔴</span>' : '';

        return `<tr onclick="openPP('${window.esc(p.id)}')">
          <td>
            <div style="font-size:11px;font-weight:600;">${window.esc(p.founderName||p.name||'—')}${threatIcon}</div>
            <div style="font-size:9px;color:var(--gold);font-family:'Cormorant Garamond',serif;">${window.esc(p.prospectId||'')}</div>
          </td>
          <td class="dim">${window.esc(p.company||'—')}</td>
          <td class="dim">${window.esc(p.batchNumber||'—')}</td>
          <td><span class="badge ${sClass[p.status]||'b-ghost'}">${window.esc(p.status||'—')}</span></td>
          <td class="dim">${window.esc(p.internalCategory || p.followUpBranch || '—')}</td>
          <td>${scan} <span class="hot-flag">${fire}</span></td> <td class="dim">${window.esc(p.linkedinStatus||'—')}</td>
          <td class="dim">${window.esc(p.nextActionDate||'—')}</td>
          <td class="dim">${p.emailsSent||0}</td>
        </tr>`;
      }).join('');

  tbodies.forEach(tb => tb.innerHTML = html);
}


// ════════════════════════════════════════════════════════════════════════
// ═════════ ACTIVE DEALS / KANBAN BOARD ══════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
window.renderDealsBoard = function() {
  const cols = { 1: [], 2: [], 3: [], 4: [], 5: [] };

  window.allProspects.forEach(p => {
    if (p.status === 'Dead') return;

    if (p.status === 'Converted') {
      cols[5].push(p);
    } else if (p.status === 'Negotiating' || p.scannerCompleted || p.status === 'Hot' || p.hotFlag) {
      cols[4].push(p); 
    } else if (p.status === 'Replied' || p.scannerClicked) {
      cols[3].push(p); 
    } else if (p.emailsSent > 0 || p.status === 'Warm') {
      cols[2].push(p); 
    } else {
      cols[1].push(p); 
    }
  });

  if (window.allFlagship && Array.isArray(window.allFlagship)) {
      window.allFlagship.forEach(f => {
         if (f.status === 'Won') cols[5].push(f);
         else if (f.status === 'Lost') return;
         else if (f.status === 'Identified') cols[1].push(f);
         else cols[4].push(f); 
      });
  }

  const todayStr = new Date().toISOString().split('T')[0];

  for (let i = 1; i <= 5; i++) {
    const els = document.querySelectorAll('#kd-col-' + i);
    const cnts = document.querySelectorAll('#kd-c' + i);
    if (els.length === 0) continue;
    
    cnts.forEach(c => c.innerText = cols[i].length);
    
    cols[i].sort((a,b) => (a.nextActionDate || '9999').localeCompare(b.nextActionDate || '9999'));

    const html = cols[i].length === 0 
      ? '<div class="empty" style="padding:20px; border:none;">Empty</div>'
      : cols[i].map(c => {
          const isFlagship = c.priceQuoted !== undefined; 
          const name = window.esc(c.founderName || c.name || 'Unknown');
          const comp = window.esc(c.company || '—');
          
          let flags = '';
          if (!isFlagship) {
              if (c.scannerCompleted) flags += '🔥🔥 ';
              else if (c.scannerClicked || c.hotFlag) flags += '🔥 ';
          } else {
              flags += '<span style="color:var(--gold)">◆ </span>'; 
          }

          const nextDate = c.nextActionDate || '';
          const isOverdue = nextDate && nextDate < todayStr;
          const isToday = nextDate === todayStr;
          
          let dateStyle = 'color:var(--marble-faint)';
          let dateText = nextDate || 'No action set';
          
          if (isOverdue) { dateStyle = 'color:#d47a7a; font-weight:600;'; dateText = '⚠ ' + dateText; }
          else if (isToday) { dateStyle = 'color:var(--gold);'; dateText = '★ Today'; }

          const clickFn = isFlagship ? `openFSP('${window.esc(c.id)}')` : `openPP('${window.esc(c.id)}')`;

          return `
            <div class="k-card" onclick="${clickFn}">
              <div class="k-name">${flags}${name}</div>
              <div class="k-comp">${comp}</div>
              <div class="k-meta">
                <span style="${dateStyle}">${dateText}</span>
              </div>
            </div>
          `;
        }).join('');
        
    els.forEach(el => el.innerHTML = html);
  }
};


// ════════════════════════════════════════════════════════════════════════
// ═════════ INBOUND LEAD CONVERSION ══════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
window.convertLead = async function(leadId) {
  if (!confirm('Convert this Lead into a Pipeline Prospect?')) return;
  try {
    const leadDoc = await window.db.collection('leads').doc(leadId).get();
    if (!leadDoc.exists) { if(window.toast) window.toast('Lead not found', 'error'); return; }
    const l = leadDoc.data();
    
    // Batch Logic: Month + Alpha
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const batch = `${month}I`; // 'I' for Inbound

    const pid  = await window.genProspectId(batch);
    const email = l.email || leadId;
    const prospectData = {
      founderName:          l.name || '',
      email:                email,
      company:              l.company || '',
      linkedinUrl:          l.linkedin || '',
      website:              '',
      fundingStage:         '',
      location:             '',
      source:               l.source || 'scanner',
      batchNumber:          batch,
      intendedPlan:         'agentic_shield',
      notes:                'Converted from Lead ID: ' + leadId,
      status:               'Replied',
      prospectId:           pid,
      scannerLink:          `https://lexnovahq.com/scanner.html?pid=${pid}`,
      emailsSent:           0,
      emailLog:             [],
      scannerClicked:       true,
      scannerCompleted:     !!l.scannerScore || !!l.scannerExternalScore,
      scannerExternalScore: l.scannerExternalScore || l.scannerScore || null,
      scannerInternalScore: l.scannerInternalScore || null,
      vaultInputs:          l.vaultInputs || [],
      addedAt:              new Date().toISOString(),
      updatedAt:            new Date().toISOString(),
      legalGapStatus:       'generic',
      personalizedHook:     'Submitted via scanner.'
    };
    
    // Write using Prospect ID as Document Name
    await window.db.collection('prospects').doc(pid).set(prospectData, { merge: true });
    await window.db.collection('leads').doc(leadId).update({ status: 'converted', convertedAt: new Date().toISOString() });
    
    if(window.toast) window.toast(`Lead converted to ${pid}`);
    if (typeof window.loadOutreach === 'function') window.loadOutreach(); 
    if (typeof window.loadLeads === 'function') window.loadLeads(); 
  } catch(e) { console.error(e); if(window.toast) window.toast('Conversion failed', 'error'); }
};


// ════════════════════════════════════════════════════════════════════════
// ═════════ THE DOSSIER GENERATOR V5.2 ═══════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
window.copyDossier = async function(id) {
    const p = window.allProspects.find(x => x.id === id);
    if (!p) return;

    let gapsText = '';
    if (p.detectedGaps && p.detectedGaps.length > 0) {
        gapsText = p.detectedGaps.map((g, i) => `[${g.severity}] ${g.gapName} (Est. ${g.damage})\nPain: ${g.pain}\nLiability: ${g.liability}\n`).join('\n');
    } else {
        gapsText = (p.activeTraps && p.activeTraps.length) ? p.activeTraps.join(', ') : 'None detected';
    }
    
    const text = `[LEX NOVA FORENSIC DOSSIER]
ID: ${p.prospectId || '—'}
Target: ${p.founderName || p.name || '—'} ${p.jobTitle ? '| ' + p.jobTitle : ''}
Company: ${p.company || '—'} ${p.website ? '(' + p.website + ')' : ''}

[FORENSIC INTELLIGENCE]
Category: ${p.internalCategory || '—'} / ${p.externalCategory || '—'}
Lane: ${p.lane || '—'}
Geography: ${p.geography || '—'}
Headcount: ${p.headcount || '—'}
Product Signal: ${p.productSignal || '—'}

[DETECTED GAPS]
${gapsText}

[THE SPEAR (PAYLOAD)]
SUB: ${p.emailSubject || '—'}
BODY:
"${p.personalizedHook || '—'}"

[LOGISTICS]
Status: ${p.status || '—'}
Plan Match: ${PLANS[p.intendedPlan] || p.intendedPlan || '—'}
Funding: ${p.fundingStage || '—'}`;

    try {
        await navigator.clipboard.writeText(text);
        if(window.toast) window.toast('Dossier copied to clipboard!');
    } catch (err) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            if(window.toast) window.toast('Dossier copied to clipboard!');
        } catch (err2) {
            if(window.toast) window.toast('Failed to copy', 'error');
        }
        document.body.removeChild(textArea);
    }
};

window.copyToClipboard = function(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.select();
    document.execCommand('copy');
    if(window.toast) window.toast('Copied to clipboard');
};


// ════════════════════════════════════════════════════════════════════════
// ═════════ THE V3 DOSSIER MODAL (FULL PAGE TAKEOVER V5.2) ═══════════════
// ════════════════════════════════════════════════════════════════════════
window.openPP = function(id) {
  const p = window.allProspects.find(x => x.id === id);
  if (!p) return;
  window.currentProspect = p;

  const pp = $('prospectPanel');
  if (pp) {
      pp.style.maxWidth = '100%';
      pp.style.width = '100%';
      pp.style.left = '0';
      pp.classList.add('open');
  }

  setText('pp-name', p.founderName || p.name || '—');
  setText('pp-meta', `${p.company||'—'} · ${p.email||'—'} · ID: ${p.prospectId||'—'}`);
  renderPPBody(p);
};

window.closePP = function() {
  window.currentProspect = null;
  $('prospectPanel')?.classList.remove('open');
};

function renderPPBody(p) {
  const body = $('pp-body');
  if (!body) return;

  const sel = (opts, cur) => opts.map(o => `<option value="${o}" ${cur===o?'selected':''}>${o||'—'}</option>`).join('');
  const planSel = Object.entries(PLANS).map(([k,v]) =>
    `<option value="${k}" ${p.intendedPlan===k?'selected':''}>${v}</option>`).join('');
  
  const logRows = (p.emailLog||[]).slice().reverse().map(e =>
    `<div style="display:flex; gap:10px; padding:7px 0; border-bottom:1px solid rgba(197,160,89,.06); font-size:10px; flex-wrap:wrap;">
      <span style="color:var(--marble-faint);flex-shrink:0;width:80px">${window.esc(e.date||'—')}</span>
      <span style="color:var(--gold);flex-shrink:0;width:90px;font-weight:600;">${window.esc(e.type||'—')}</span>
      <span style="color:var(--marble-dim);flex:1;word-break:break-word;">${window.esc(e.notes||'')}</span>
    </div>`).join('') || '<div style="font-size:10px;color:var(--marble-faint)">No emails logged</div>';

  const scannerLink = p.scannerLink || `https://lexnovahq.com/scanner.html?pid=${p.prospectId || ''}`;

  // 1. DYNAMIC FORENSIC MATRIX LOGIC (THE KILL SHOT & BUSINESS IMPACT)
  let gapsHtml = ''; let businessImpactHtml = '';
  if (p.detectedGaps && p.detectedGaps.length > 0) {
      const sorted = [...p.detectedGaps].sort((a,b) => {
          const weights = { NUCLEAR: 3, CRITICAL: 2, HIGH: 1, MEDIUM: 0 };
          return (weights[b.severity]||0) - (weights[a.severity]||0);
      });
      const ks = sorted[0];
      const ksColor = ks.severity === 'NUCLEAR' ? '#ef4444' : '#f97316';
      
      gapsHtml += `
          <div style="border: 1px solid ${ksColor}; background: rgba(239,68,68,0.05); padding: 14px; border-radius: 6px; margin-bottom: 14px; border-left: 5px solid ${ksColor};">
              <div style="color:${ksColor}; font-size:10px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; margin-bottom:6px;">🎯 The Kill Shot (${ks.severity})</div>
              <div style="font-size:15px; font-weight:700; color:var(--marble); margin-bottom:8px;">${window.esc(ks.gapName)}</div>
              <div style="font-size:11px; color:var(--marble-dim); margin-bottom:4px;"><strong>Pain:</strong> ${window.esc(ks.pain)}</div>
              <div style="font-size:11px; color:var(--marble-dim); margin-bottom:4px;"><strong>Liability:</strong> ${window.esc(ks.liability)}</div>
              <div style="font-size:11px; color:${ksColor}; margin-top:8px; font-weight:bold;">Damage Ceiling: ${window.esc(ks.damage)}</div>
          </div>
      `;

      if (sorted.length > 1) {
          gapsHtml += `<div style="font-size:9px; color:var(--marble-dim); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:8px; margin-top:16px;">Secondary Exposures</div>`;
          gapsHtml += sorted.slice(1).map(g => {
              const col = g.severity === 'CRITICAL' ? '#f97316' : (g.severity === 'HIGH' ? 'var(--gold)' : 'var(--marble-dim)');
              return `
              <div style="background:var(--surface2); border:1px solid var(--border); padding:10px; border-left:3px solid ${col}; border-radius:4px; margin-bottom:8px;">
                  <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                      <span style="font-size:11px; font-weight:600; color:var(--marble);">${window.esc(g.gapName)}</span>
                      <span style="font-size:9px; color:${col}; font-weight:700;">${g.severity}</span>
                  </div>
                  <div style="font-size:10px; color:var(--marble-dim); line-height:1.3;">${window.esc(g.pain)}</div>
              </div>`;
          }).join('');
      }

      businessImpactHtml = `
          <div class="card" style="padding:16px; border-color:var(--gold-mid); background:var(--void); margin-top:20px;">
              <div style="font-size:10px; color:var(--gold); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:10px; font-weight:700;">Business Impact Analysis</div>
              <div style="font-size:11px; color:var(--marble); line-height:1.5;">Target exhibits a <strong>compound risk surface</strong> with ${sorted.length} detected Matrix Gaps. The lack of a <strong>${ks.gapName.split(' ')[0]}</strong> mechanism alone creates a ${ks.damage} liability hole.</div>
          </div>
      `;
  } else {
      gapsHtml = `<div class="empty" style="border: 1px dashed var(--border); border-radius:6px; padding:20px;">No V3 Matrix Gaps detected. Fallback: <br><br> ${(p.activeTraps||[]).map(t => `<span class="badge b-red">${window.esc(t)}</span>`).join(' ')}</div>`;
  }

  // 2. ASYNC TELEMETRY LOGIC (CONFESSIONS)
  let telemetryHtml = '';
  if (p.scannerCompleted || p.scannerClicked) {
      const confessionList = (p.vaultInputs || []).map(inp => `
          <div style="display:flex; justify-content:space-between; border-bottom:1px solid rgba(255,255,255,0.03); padding:6px 0; gap:10px;">
              <span style="font-size:10px; color:var(--marble-dim); flex:1;">${window.esc(inp.question)}</span>
              <span style="font-size:10px; color:var(--gold); font-weight:600;">${window.esc(inp.answer)}</span>
          </div>`).join('');

      telemetryHtml = `
          <div class="card" style="padding: 16px; border-color: #d47a7a; background: var(--surface2);">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                  <div style="font-size:10px; color:#d47a7a; text-transform:uppercase; letter-spacing:0.1em; font-weight:700;">Section 4: Async Telemetry (The Confessional)</div>
                  <span class="badge b-red">${p.scannerCompleted ? 'Completed 🔥🔥' : 'Clicked 🔥'}</span>
              </div>
              <div class="fi-row" style="margin-bottom:16px;">
                  <div class="fg" style="margin:0;"><label class="fl">Exposure Floor</label><div style="color:#ef4444; font-weight:bold; font-size:18px;">${window.esc(p.scannerExternalScore||'—')}</div></div>
                  <div class="fg" style="margin:0;"><label class="fl">Int Risk Score</label><div style="font-size:14px; font-weight:bold;">${window.esc(p.scannerInternalScore||'—')}</div></div>
              </div>
              <div style="max-height:150px; overflow-y:auto; padding-right:6px;">${confessionList || '<div class="dim">No specific vault inputs logged.</div>'}</div>
              <div style="font-size:10px; color:var(--marble-faint); font-style:italic; margin-top:10px;">Note: Telemetry inputs trigger SDR abandoned cart workflows.</div>
          </div>`;
  }

  body.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; gap:10px; padding-bottom:14px; border-bottom:1px solid var(--border);">
        <div style="display:flex; gap:8px; align-items:center;">
            <input type="text" class="fi" id="pp-scanner-url" readonly value="${scannerLink}" style="font-size:10px; color:var(--gold); width:350px; background:var(--void); border-color:var(--gold-mid);">
            <button class="btn btn-outline btn-sm" onclick="copyToClipboard('pp-scanner-url')">Copy Link</button>
        </div>
        <button class="btn btn-primary btn-sm" onclick="copyDossier('${window.esc(p.id)}')">📋 Copy Full Dossier</button>
    </div>

    <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 32px; height: calc(100vh - 160px); overflow: hidden;">
        
        <div style="overflow-y: auto; padding-right: 12px; display: flex; flex-direction: column; gap: 20px;">
            
            <div class="card" style="padding: 20px;">
                <div style="font-size:10px; color:var(--gold); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:16px; font-weight:700;">Section 1: Company Intelligence</div>
                <div class="fi-row" style="margin-bottom:12px;">
                    <div class="fg" style="margin:0;"><label class="fl">INT-10 Archetype</label><input type="text" class="fi" id="pp-int-cat" value="${window.esc(p.internalCategory||'')}"></div>
                    <div class="fg" style="margin:0;"><label class="fl">EXT-6 Category</label><input type="text" class="fi" id="pp-ext-cat" value="${window.esc(p.externalCategory||'')}"></div>
                </div>
                <div class="fi-row" style="margin-bottom:16px;">
                    <div class="fg" style="margin:0;"><label class="fl">Liability Lane</label><div style="font-size:12px; color:var(--marble); font-weight:bold; margin-top:8px;">${window.esc(p.lane||'—')}</div></div>
                    <div class="fg" style="margin:0;"><label class="fl">Geography</label><input type="text" class="fi" id="pp-geo" value="${window.esc(p.geography||'')}"></div>
                </div>
                <div class="fi-row" style="margin-bottom:16px;">
                    <div class="fg" style="margin:0;"><label class="fl">Funding</label>
                        <select class="fi" id="pp-funding-text" style="padding:6px; font-size:11px;">${sel(['','Pre-seed','Seed','Series A','Series B+','Bootstrapped'], p.fundingStage)}</select>
                    </div>
                    <div class="fg" style="margin:0;"><label class="fl">Headcount</label><input type="text" class="fi" id="pp-headcount" value="${window.esc(p.headcount||'')}"></div>
                </div>

                <div style="padding-top:16px; border-top:1px solid var(--border);">
                    <div class="fi-row" style="margin-bottom:10px">
                        <div class="fg"><label class="fl">Founder Name</label><input type="text" class="fi" id="pp-name-edit" value="${window.esc(p.founderName||p.name||'')}"></div>
                        <div class="fg"><label class="fl">Company Name</label><input type="text" class="fi" id="pp-company-edit" value="${window.esc(p.company||'')}"></div>
                    </div>
                    <div class="fi-row" style="margin-bottom:10px">
                        <div class="fg"><label class="fl">Email</label><input type="email" class="fi" id="pp-email-edit" value="${window.esc(p.email||'')}"></div>
                        <div class="fg"><label class="fl">Job Title</label><input type="text" class="fi" id="pp-title" value="${window.esc(p.jobTitle||'')}"></div>
                    </div>
                    <div class="fi-row" style="margin-bottom:0">
                        <div class="fg" style="margin:0;"><label class="fl">LinkedIn URL</label><input type="text" class="fi" id="pp-linkedin-edit" value="${window.esc(p.linkedinUrl||'')}"></div>
                        <div class="fg" style="margin:0;"><label class="fl">Website</label><input type="text" class="fi" id="pp-website-edit" value="${window.esc(p.website||'')}"></div>
                    </div>
                </div>
            </div>

            <div class="card" style="padding: 20px;">
                <div style="font-size:10px; color:var(--gold); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:16px; font-weight:700;">Section 2: Forensic Matrix</div>
                <div class="fg" style="margin-bottom:16px;"><label class="fl">Product Signal (The Trigger)</label><div style="font-size:12px; color:var(--marble); line-height:1.5; padding:10px; background:var(--surface2); border:1px solid var(--border); border-radius:4px;">${window.esc(p.productSignal||'—')}</div></div>
                ${gapsHtml}
                ${businessImpactHtml}
            </div>
        </div>

        <div style="overflow-y: auto; padding-right: 12px; display: flex; flex-direction: column; gap: 20px;">
            
            <div class="card" style="padding: 20px;">
                <div style="font-size:10px; color:var(--gold); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:12px; font-weight:700;">Section 3: The Spear (Current Payload)</div>
                <div class="fg"><label class="fl">Subject Line</label><input type="text" class="fi" id="pp-subject" value="${window.esc(p.emailSubject||'')}" style="border-color:var(--gold-mid); font-family:monospace;"></div>
                <div class="fg" style="margin-bottom:0;"><label class="fl">Email Body</label><textarea class="fi" id="pp-hook" rows="6" style="border-color:var(--gold-mid); line-height:1.5;">${window.esc(p.personalizedHook||'')}</textarea></div>
            </div>

            ${telemetryHtml}

            <div class="card" style="padding: 20px;">
                <div style="font-size:10px; color:var(--gold); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:16px; font-weight:700;">Section 5: War Room Status & Controls</div>
                
                <div class="fi-row" style="margin-bottom:14px;">
                    <div class="fg" style="margin:0;"><label class="fl">Funnel Status</label>
                        <select class="fi" id="pp-status" style="border-color:var(--gold); color:var(--gold); font-weight:bold;">
                            ${sel(['Cold','Warm','Hot','Replied','Negotiating','Converted','Dead'], p.status)}
                        </select>
                    </div>
                    <div class="fg" style="margin:0;"><label class="fl">Intended Plan</label><select class="fi" id="pp-plan">${planSel}</select></div>
                </div>

                <div class="fi-row" style="margin-bottom:16px; border-bottom:1px solid var(--border); padding-bottom:16px;">
                    <div class="fg" style="margin:0;"><label class="fl">Next Action Date</label><input type="date" class="fi" id="pp-next-date" value="${p.nextActionDate||''}"></div>
                    <div class="fg" style="margin:0;"><label class="fl">Next Step Note</label><input type="text" class="fi" id="pp-next-note" value="${window.esc(p.nextAction||'')}" placeholder="e.g. Follow up on scanner"></div>
                </div>

                <div class="fg" style="margin-bottom:16px;">
                    <label class="fl">Internal Strategy Notes</label>
                    <textarea class="fi" id="pp-notes" rows="2" placeholder="Drop context here...">${window.esc(p.notes||'')}</textarea>
                </div>

                <div style="margin-bottom:16px;">
                    <div style="font-size:9px; text-transform:uppercase; color:var(--marble-faint); margin-bottom:8px">Communication Log (Total: ${p.emailsSent||0})</div>
                    <div id="pp-email-log" style="background:var(--void); border:1px solid var(--border); padding:8px; max-height:100px; overflow-y:auto;">${logRows}</div>
                    <div class="fi-row" style="margin-bottom:6px; margin-top:8px;">
                        <input type="date" class="fi" id="pp-log-date" value="${new Date().toISOString().split('T')[0]}" style="padding:6px; font-size:10px;">
                        <select class="fi" id="pp-log-type" style="padding:6px; font-size:10px; border-color:var(--gold-mid);">
                            <option>Cold Email</option><option>Follow-up 1</option><option>Follow-up 2</option><option>Follow-up 3</option><option>Reply</option><option>LinkedIn DM</option>
                        </select>
                    </div>
                    <div style="display:flex; gap:8px;">
                        <input type="text" class="fi" id="pp-manual-log" placeholder="Quick log note..." style="padding:6px; font-size:10px; flex:1;">
                        <button class="btn btn-outline" style="padding:6px 12px; font-size:9px;" onclick="logEmail()">+ Log</button>
                    </div>
                </div>

                <div style="display:flex; gap:10px;">
                    <button class="btn btn-primary" style="flex:1; padding: 14px 0;" onclick="saveProspect()">💾 Save Dossier</button>
                    <button class="btn btn-outline" style="flex:1; padding: 14px 0; border-color:#d4a850; color:#d4a850;" onclick="pivotToFlagship()">💎 Pivot to Flagship</button>
                </div>
                <div style="text-align:center; margin-top:16px; border-top:1px dashed rgba(138,58,58,0.3); padding-top:16px;">
                    <button class="btn btn-danger btn-sm" onclick="deleteProspect('${window.esc(p.id)}')">Permanently Delete Target</button>
                </div>

                <input type="hidden" id="pp-batch-edit" value="${window.esc(p.batchNumber||'')}">
                <input type="hidden" id="pp-gap-status" value="${window.esc(p.legalGapStatus||'generic')}">
                <input type="hidden" id="pp-gap-text" value="${window.esc(p.legalGapAnalysis||'')}">
                <input type="hidden" id="pp-branch" value="${window.esc(p.followUpBranch||'')}">
                <input type="hidden" id="pp-li" value="${window.esc(p.linkedinStatus||'')}">
                <input type="hidden" id="pp-emails" value="${p.emailsSent||0}">
                <input type="checkbox" id="pp-sc" ${p.scannerClicked?'checked':''} style="display:none;">
                <input type="checkbox" id="pp-scomp" ${p.scannerCompleted?'checked':''} style="display:none;">
                <input type="checkbox" id="pp-chk-native" ${p.aiNative?'checked':''} style="display:none;">
                <input type="checkbox" id="pp-chk-ext" ${p.externalAI?'checked':''} style="display:none;">
            </div>
        </div>
    </div>`;
}


// ════════════════════════════════════════════════════════════════════════
// ═════════ THE P->C MIGRATION & SAVE ENGINE ═════════════════════════════
// ════════════════════════════════════════════════════════════════════════
window.pivotToFlagship = async function() {
    if (!window.currentProspect) return;
    if (!confirm('Pivot this target to the Flagship pipeline? This will archive the current prospect and create a new Flagship deal.')) return;

    const fsData = {
        founderName: window.currentProspect.founderName || window.currentProspect.name || 'Unknown',
        email: window.currentProspect.email || '',
        company: window.currentProspect.company || '',
        preCallNotes: 'Pivoted from Automated V3 Pipeline.\nOriginal Gap Identified: ' + (window.currentProspect.productSignal || 'N/A'),
        status: 'Identified',
        addedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    try {
        await window.db.collection('flagship').add(fsData);
        await window.db.collection('prospects').doc(window.currentProspect.prospectId || window.currentProspect.id).update({
            status: 'Dead',
            archivedAt: new Date().toISOString(),
            notes: (window.currentProspect.notes || '') + '\n[SYSTEM] Pivoted to Flagship Pipeline.'
        });
        if(window.toast) window.toast('Pivoted to Flagship successfully!', 'success');
        window.closePP();
        if (typeof window.loadFlagship === 'function') window.loadFlagship();
    } catch (e) {
        console.error(e);
        if(window.toast) window.toast('Pivot failed', 'error');
    }
};

window.saveProspect = async function() {
  if (!window.currentProspect) return;
  const updates = {
    founderName: $('pp-name-edit')?.value?.trim() || '',
    company: $('pp-company-edit')?.value?.trim() || '',
    email: $('pp-email-edit')?.value?.trim().toLowerCase() || window.currentProspect.email,
    internalCategory: $('pp-int-cat')?.value || window.currentProspect.internalCategory || '',
    externalCategory: $('pp-ext-cat')?.value || window.currentProspect.externalCategory || '',
    geography: $('pp-geo')?.value || window.currentProspect.geography || '',
    headcount: $('pp-headcount')?.value || window.currentProspect.headcount || '',
    fundingStage: $('pp-funding-text')?.value || window.currentProspect.fundingStage || '',
    status: $('pp-status')?.value || window.currentProspect.status,
    nextActionDate: $('pp-next-date')?.value || '',
    nextAction: $('pp-next-note')?.value?.trim() || '',
    notes: $('pp-notes')?.value?.trim() || '',
    jobTitle: $('pp-title')?.value?.trim() || '',
    personalizedHook: $('pp-hook')?.value?.trim() || '',
    emailSubject: $('pp-subject')?.value?.trim() || '',
    linkedinUrl: $('pp-linkedin-edit')?.value?.trim() || '',
    website: $('pp-website-edit')?.value?.trim() || '',
    intendedPlan: $('pp-plan')?.value || '',
    updatedAt: new Date().toISOString()
  };

  let isConvertingToClient = false;
  if (updates.status === 'Converted' && window.currentProspect.status !== 'Converted') {
      isConvertingToClient = true;
  }

  if (updates.status === 'Dead' && window.currentProspect.status !== 'Dead' && !isConvertingToClient) {
      updates.archivedAt = new Date().toISOString();
  }

  try {
    if (isConvertingToClient) {
        if (!confirm(`Initialize P→C Migration? This pushes target to The Factory (LN-C).`)) return;
        const clientId = (window.currentProspect.prospectId || '').replace('LN-P-', 'LN-C-') || ('LN-C-' + Date.now());
        const clientData = {
            ...window.currentProspect, ...updates,
            id: updates.email, 
            engagementRef: clientId,
            originalProspectId: window.currentProspect.prospectId,
            status: 'payment_received',
            createdAt: new Date().toISOString(),
            plan: updates.intendedPlan || 'agentic_shield'
        };
        await window.db.collection('clients').doc(updates.email).set(clientData);
        if(window.toast) window.toast(`Migrated to The Factory as ${clientId}`, 'success');
        updates.status = 'Dead';
        updates.archivedAt = new Date().toISOString();
        updates.notes = (updates.notes || '') + `\n[SYSTEM] Deal Closed. Data migrated to Client ID: ${clientId}`;
    }

    const docKey = window.currentProspect.prospectId || window.currentProspect.id;
    await window.db.collection('prospects').doc(docKey).set(updates, { merge: true });
    
    window.currentProspect = { ...window.currentProspect, ...updates };
    if (!isConvertingToClient && window.toast) window.toast('Prospect Dossier Saved');
    
    const idx = window.allProspects.findIndex(p => p.id === window.currentProspect.id);
    if (idx !== -1) window.allProspects[idx] = window.currentProspect;
    
    if (isConvertingToClient) window.closePP(); 
    else if (typeof window.filterProspects === 'function') window.filterProspects();

  } catch(e) { console.error(e); if(window.toast) window.toast('Save failed', 'error'); }
};

window.deleteProspect = async function(id) {
    if (!confirm(`WARNING: Permanently delete target?`)) return;
    try {
        await window.db.collection('prospects').doc(id).delete();
        window.closePP(); if(window.toast) window.toast('Target Deleted', 'success');
    } catch(e) { if(window.toast) window.toast('Delete failed', 'error'); }
};

window.logEmail = async function() {
  if (!window.currentProspect) return;
  const note = $('pp-manual-log')?.value?.trim() || 'Logged manually';
  const type = $('pp-log-type')?.value || 'Cold Email';
  const date = $('pp-log-date')?.value || new Date().toISOString().split('T')[0];
  const entry = { date: date, type: type, notes: note };
  
  const docKey = window.currentProspect.prospectId || window.currentProspect.id;
  const newCount = (window.currentProspect.emailsSent||0) + 1;
  try {
    await window.db.collection('prospects').doc(docKey).update({ 
        emailLog: firebase.firestore.FieldValue.arrayUnion(entry), 
        emailsSent: newCount, 
        updatedAt: new Date().toISOString() 
    });
    window.currentProspect.emailLog = [...(window.currentProspect.emailLog||[]), entry];
    window.currentProspect.emailsSent = newCount;
    if(window.toast) window.toast('Action Logged');
    renderPPBody(window.currentProspect);
  } catch(e) { if(window.toast) window.toast('Log failed', 'error'); }
};

window.genProspectId = async function(batchCode) {
  try {
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const searchBatch = batchCode || `${month}A`;
    const prefix = `LN-P-AI-26-${searchBatch}-`;
    const snap = await window.db.collection('prospects').where('prospectId', '>=', prefix).where('prospectId', '<=', prefix + '\uf8ff').get();
    let max = 0; snap.forEach(d => { const pid = d.data().prospectId || ''; const num = parseInt(pid.split('-').pop(), 10); if (num > max) max = num; });
    return `${prefix}${String(max + 1).padStart(3,'0')}`;
  } catch { return `LN-P-AI-26-03A-001`; }
};


// ════════════════════════════════════════════════════════════════════════
// ═════════ MANUAL ADD PROSPECT (V3 ALIGNED) ═════════════════════════════
// ════════════════════════════════════════════════════════════════════════
window.openAddProspect = function() {
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const catOpts = ['The Doers','The Orchestrators','The Creators','The Companions','The Readers','The Translators','The Judges','The Shields','The Movers','The Optimizers'];
  
  if (typeof window.openModal !== 'function') return;
  
  window.openModal('Initialize Target Acquisition (V3 Manual)', `
  <div class="modal-grid">
      <div>
          <div class="section-sub">Gate 0: Identity</div>
          <div class="fi-row">
              <div class="fg"><label class="fl">Founder</label><input type="text" class="fi" id="ap-name"></div>
              <div class="fg"><label class="fl">Company</label><input type="text" class="fi" id="ap-company"></div>
          </div>
          <div class="fg"><label class="fl">Email *</label><input type="email" class="fi" id="ap-email"></div>
          <div class="fi-row">
            <div class="fg"><label class="fl">INT-10 Archetype</label>
              <select class="fi" id="ap-int-cat">${catOpts.map(c=>`<option value="${c}">${c}</option>`).join('')}</select>
            </div>
            <div class="fg"><label class="fl">EXT-6 Category</label><input type="text" class="fi" id="ap-ext-cat" placeholder="e.g. Voice AI"></div>
          </div>
      </div>
      <div>
          <div class="section-sub">Gate 1: Target Logistics</div>
          <div class="fi-row">
            <div class="fg"><label class="fl">Geography</label><input type="text" class="fi" id="ap-geo" value="US"></div>
            <div class="fg"><label class="fl">Batch</label><input type="text" class="fi" id="ap-batch" value="${month}A"></div>
          </div>
          <div class="fg"><label class="fl">The Spear (Initial Hook)</label><textarea class="fi" id="ap-hook" rows="4"></textarea></div>
      </div>
  </div>`, `
    <button class="btn btn-outline btn-sm" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary btn-sm" onclick="saveNewProspect()">Commence Outreach</button>
  `);
};

window.saveNewProspect = async function() {
  const email = $('ap-email')?.value?.trim().toLowerCase();
  const batch = $('ap-batch')?.value?.trim();
  if (!email) return window.toast ? window.toast('Email required', 'error') : null;
  try {
    const pid = await window.genProspectId(batch);
    const data = { 
      founderName: $('ap-name').value, 
      email, 
      company: $('ap-company').value, 
      internalCategory: $('ap-int-cat').value, 
      externalCategory: $('ap-ext-cat').value, 
      geography: $('ap-geo').value, 
      personalizedHook: $('ap-hook').value, 
      prospectId: pid, 
      batchNumber: batch, 
      status: 'Cold', 
      addedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString() 
    };
    await window.db.collection('prospects').doc(pid).set(data);
    if(window.closeModal) window.closeModal(); 
    if(window.toast) window.toast(`${pid} added.`);
  } catch(e) { console.error(e); if(window.toast) window.toast('Save failed', 'error'); }
};


// ════════════════════════════════════════════════════════════════════════
// ═════════ FLAGSHIP CRM LOGIC ═══════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
window.loadFlagship = async function() {
  const pageActions = $('pageActions');
  if(pageActions) pageActions.innerHTML = `<button class="btn btn-primary" onclick="window.openAddFlagship()">+ Add Flagship Prospect</button>`;
  
  const tbodies = document.querySelectorAll('#fs-tbody');
  tbodies.forEach(tb => tb.innerHTML = '<tr><td colspan="7" class="loading">Loading…</td></tr>');
  
  try {
    const snap = await window.db.collection('flagship').orderBy('addedAt','desc').get();
    window.allFlagship = [];
    snap.forEach(d => window.allFlagship.push({ id: d.id, ...d.data() }));
    renderFlagshipTable(window.allFlagship);
    if (typeof window.renderDealsBoard === 'function') window.renderDealsBoard(); 
  } catch(e) {
    console.error(e);
    tbodies.forEach(tb => tb.innerHTML = '<tr><td colspan="7" class="loading" style="color:#d47a7a">Failed to load</td></tr>');
  }
};

function renderFlagshipTable(list) {
  const tbodies = document.querySelectorAll('#fs-tbody');
  if (tbodies.length === 0) return;
  
  const sClass = {
    'Identified':'b-cold', 'Discovery Scheduled':'b-intake', 'Discovery Done':'b-warm',
    'Proposal Sent':'b-production', 'Negotiating':'b-hot', 'Won':'b-delivered', 'Lost':'b-dead'
  };
  
  const html = !list.length 
    ? '<tr><td colspan="7" class="loading">No flagship prospects</td></tr>'
    : list.map(fs => {
        let fuBadge = '';
        if (fs.proposalSentAt && fs.status === 'Proposal Sent') {
          const hrs = Math.floor((Date.now() - new Date(fs.proposalSentAt).getTime()) / 3600000);
          fuBadge = hrs > 24 ? ` <span style="color:#d47a7a;font-size:9px">⚠ ${hrs}h</span>` : ` <span style="color:var(--gold);font-size:9px">${hrs}h</span>`;
        }
        return `<tr onclick="openFSP('${window.esc(fs.id)}')">
          <td>${window.esc(fs.founderName||fs.name||'—')}</td>
          <td class="dim">${window.esc(fs.company||'—')}</td>
          <td><span class="badge ${sClass[fs.status]||'b-ghost'}">${window.esc(fs.status||'—')}</span></td>
          <td class="dim">${fmtMoney(fs.priceQuoted)}</td>
          <td class="dim">${window.esc(fs.proposalSentDate||'—')}${fuBadge}</td>
          <td class="dim">${window.esc(fs.nextStep||'—')}</td>
          <td class="dim">${fmtDate(fs.addedAt)}</td>
        </tr>`;
      }).join('');
      
  tbodies.forEach(tb => tb.innerHTML = html);
}

window.openAddFlagship = function() {
  if (typeof window.openModal !== 'function') return;
  window.openModal('Add Flagship Prospect', `
    <div class="fi-row">
      <div class="fg"><label class="fl">Founder Name</label>
        <input type="text" class="fi" id="fsa-name" placeholder="John Smith"></div>
      <div class="fg"><label class="fl">Company</label>
        <input type="text" class="fi" id="fsa-company" placeholder="Acme Corp"></div>
    </div>
    <div class="fg"><label class="fl">Email *</label>
      <input type="email" class="fi" id="fsa-email" placeholder="john@acme.com"></div>
    <div class="fg"><label class="fl">Initial Notes</label>
      <textarea class="fi" id="fsa-notes" rows="2"></textarea></div>
  `, `
    <button class="btn btn-outline btn-sm" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary btn-sm" onclick="saveNewFlagship()">Add</button>
  `);
};

window.saveNewFlagship = async function() {
  const email = $('fsa-email')?.value?.trim().toLowerCase();
  if (!email) { if(window.toast) window.toast('Email is required', 'error'); return; }
  const data = {
    founderName: $('fsa-name')?.value?.trim()    || '',
    email,
    company:     $('fsa-company')?.value?.trim() || '',
    preCallNotes:$('fsa-notes')?.value?.trim()   || '',
    status:      'Identified',
    addedAt:     new Date().toISOString(),
    updatedAt:   new Date().toISOString()
  };
  try {
    const ref = await window.db.collection('flagship').add(data);
    window.allFlagship.unshift({ id: ref.id, ...data });
    renderFlagshipTable(window.allFlagship);
    if (typeof window.renderDealsBoard === 'function') window.renderDealsBoard(); 
    if(window.closeModal) window.closeModal();
    if(window.toast) window.toast('Flagship prospect added');
  } catch(e) { console.error(e); if(window.toast) window.toast('Save failed', 'error'); }
};

window.openFSP = function(id) {
  const fs = window.allFlagship.find(x => x.id === id);
  if (!fs) return;
  window.currentFlagship = fs;
  $('flagshipPanel')?.classList.add('open');
  setText('fsp-name', fs.founderName || fs.name || '—');
  setText('fsp-meta', fs.company || '—');
  renderFSPBody(fs);
};

window.closeFSP = function() {
  window.currentFlagship = null;
  $('flagshipPanel')?.classList.remove('open');
};

function renderFSPBody(fs) {
  const body = $('fsp-body');
  if (!body) return;
  const statuses = ['Identified','Discovery Scheduled','Discovery Done','Proposal Sent','Negotiating','Won','Lost'];
  const sOpts    = statuses.map(s => `<option ${fs.status===s?'selected':''}>${s}</option>`).join('');
  const pOpts    = Object.entries(PLANS).map(([k,v]) =>
    `<option value="${k}" ${fs.prescribedPlan===k?'selected':''}>${v}</option>`).join('');

  let fuTracker = '';
  if (fs.proposalSentAt) {
    const hrs = Math.floor((Date.now() - new Date(fs.proposalSentAt).getTime()) / 3600000);
    const col = hrs > 24 ? '#d47a7a' : '#C5A059';
    fuTracker = `<div style="font-size:10px;color:${col};margin-top:4px">
      ⏱ ${hrs}h since proposal${hrs > 24 ? ' — FOLLOW-UP OVERDUE' : ''}
    </div>`;
  }

  body.innerHTML = `<div style="padding:18px 20px">
    <div class="fg"><label class="fl">Status</label>
      <select class="fi" id="fsp-status">${sOpts}</select></div>
    <div class="fg"><label class="fl">Pre-Call Diagnostic Notes</label>
      <textarea class="fi" id="fsp-precall" rows="3">${window.esc(fs.preCallNotes||'')}</textarea></div>
    <div class="fg"><label class="fl">Post-Call Gap Identified</label>
      <textarea class="fi" id="fsp-postcall" rows="3">${window.esc(fs.postCallGap||'')}</textarea></div>
    <div class="fi-row">
      <div class="fg"><label class="fl">Plan Prescribed</label>
        <select class="fi" id="fsp-plan">${pOpts}</select></div>
      <div class="fg"><label class="fl">Price Quoted (USD)</label>
        <input type="number" class="fi" id="fsp-price" value="${fs.priceQuoted||''}"></div>
    </div>
    <div class="fg">
      <label class="fl">Proposal Sent Date</label>
      <input type="date" class="fi" id="fsp-prop-date" value="${fs.proposalSentDate||''}">
      ${fuTracker}
    </div>
    <div class="fg"><label class="fl">Next Step</label>
      <textarea class="fi" id="fsp-next" rows="2">${window.esc(fs.nextStep||'')}</textarea></div>
    <button class="btn btn-primary btn-full" onclick="saveFSP()">Save</button>
  </div>`;
}

window.saveFSP = async function() {
  if (!window.currentFlagship) return;
  const propDate = $('fsp-prop-date')?.value || '';
  const updates  = {
    status:           $('fsp-status')?.value         || window.currentFlagship.status,
    preCallNotes:      $('fsp-precall')?.value?.trim() || '',
    postCallGap:       $('fsp-postcall')?.value?.trim()|| '',
    prescribedPlan:    $('fsp-plan')?.value             || '',
    priceQuoted:       parseFloat($('fsp-price')?.value) || null,
    proposalSentDate: propDate,
    nextStep:          $('fsp-next')?.value?.trim()    || '',
    updatedAt:         new Date().toISOString()
  };
  if (propDate && !window.currentFlagship.proposalSentAt)
    updates.proposalSentAt = new Date().toISOString();

  try {
    await window.db.collection('flagship').doc(window.currentFlagship.id).set(updates, { merge: true });
    window.currentFlagship = { ...window.currentFlagship, ...updates };
    const idx = window.allFlagship.findIndex(f => f.id === window.currentFlagship.id);
    if (idx !== -1) window.allFlagship[idx] = window.currentFlagship;
    renderFlagshipTable(window.allFlagship);
    if (typeof window.renderDealsBoard === 'function') window.renderDealsBoard();
    if(window.toast) window.toast('Flagship saved');
  } catch(e) { console.error(e); if(window.toast) window.toast('Save failed', 'error'); }
};
