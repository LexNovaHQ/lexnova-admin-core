// ════════════════════════════════════════════════════════════════════════
// ═════════ LEX NOVA ADMIN LOGIC 2 (v5.2) — THE CRM & SYNDICATE ENGINE ═══
// ════════════════════════════════════════════════════════════════════════
'use strict';

// ════════════════════════════════════════════════════════════════════════
// ═════════ GLOBAL STATE ═════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
let allProspects    = [];
let allFlagship     = [];
let allContent      = [];
let currentProspect = null;
let currentFlagship = null;
let editingRegIdx   = -1;

// ════════════════════════════════════════════════════════════════════════
// ═════════ NAV PATCH (CONNECTING LOGIC 1 & 2) ═══════════════════════════
// ════════════════════════════════════════════════════════════════════════
(function patchNav() {
  const _nav = window.nav;
  window.nav = function(tab) {
    if (_nav) _nav(tab);
    const l2 = {
      outreach: loadOutreach, flagship: loadFlagship,
      content:  loadContent,  radar:    loadRadar,
      finance:  loadFinance,  settings: loadSettings,
      hunt:     loadOutreach, // Explicitly map 'hunt' to sync engine
      deals:    loadOutreach  // Explicitly map 'deals' to sync engine
    };
    if (l2[tab]) l2[tab]();
  };
})();

function setPageActions(html) {
  const el = $('pageActions');
  if (el) el.innerHTML = html;
}

// ════════════════════════════════════════════════════════════════════════
// ═════════ THE SUNDAY RITUAL ENGINE ═════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
window.loadRitual = async function() {
  try {
    const snap = await db.collection('settings').doc('ritual').get();
    if (snap.exists) {
      const d = snap.data();
      if ($('r-outreach')) $('r-outreach').value = d.outreach || '';
      if ($('r-replies')) $('r-replies').value = d.replies || '';
      if ($('r-tally')) $('r-tally').value = d.tally || '';
      if ($('r-deals')) $('r-deals').value = d.deals || '';
      if ($('r-pipeline')) $('r-pipeline').value = d.pipeline || '';
    }
  } catch(e) { console.error('Ritual load failed', e); }
};

window.saveRitual = async function() {
  const data = {
    outreach: parseInt($('r-outreach')?.value) || 0,
    replies: parseInt($('r-replies')?.value) || 0,
    updatedAt: new Date().toISOString()
  };
  try {
    await db.collection('settings').doc('ritual').set(data, { merge: true });
    toast('Ritual metrics updated');
  } catch(e) { toast('Error saving ritual', 'error'); }
};

// ════════════════════════════════════════════════════════════════════════
// ═════════ THE HUNTER CRM (OUTREACH SYNC) ═══════════════════════════════
// ════════════════════════════════════════════════════════════════════════
let outreachListener = null;

function loadOutreach() {
  setPageActions('');
  if (outreachListener) outreachListener(); 

  outreachListener = db.collection('prospects').onSnapshot((snap) => {
    try {
        allProspects = [];
        snap.forEach(d => allProspects.push({ id: d.id, ...d.data() }));
        
        try { populateCommandCenter(); } catch(e) { console.error('Command Center Render Error:', e); }
        try { if (typeof renderDealsBoard === 'function') renderDealsBoard(); } catch(e) { console.error('Deals Board Render Error:', e); }
        try { filterProspects(); } catch(e) { console.error('Hunt Pipeline Render Error:', e); }
        try { populateBatchFilter(); } catch(e) { console.error('Batch Filter Render Error:', e); }

    } catch (fatal) {
        console.error("Fatal Outreach Sync Error:", fatal);
    }
  }, (e) => {
    console.error(e);
    toast('Outreach Sync Failed', 'error');
  });
}

function setOutreachView(view, el) {
  qsa('#tab-outreach .view-btn').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
  ['command','pipeline','hot','followup','inbound','dead'].forEach(v => {
    $('ov-' + v)?.classList.toggle('hidden', v !== view);
  });
  if (view === 'pipeline')  { filterProspects(); populateBatchFilter(); }
  if (view === 'hot')       renderHot();
  if (view === 'followup')  renderFollowup();
  if (view === 'inbound')   renderInbound();
  if (view === 'dead')      renderDead();
}

function populateCommandCenter() {
  let totalEmails = 0, totalClicks = 0, totalComps = 0, totalPaid = 0, convEmailCount = 0;
  const todayStr = new Date().toISOString().split('T')[0];
  let fuToday = 0, fuOver = 0, liPending = 0;

  allProspects.forEach(p => {
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

  db.collection('leads').where('status','in',['new','scanner_submitted']).get()
    .then(snap => setText('aq-inbound', snap.size)).catch(() => {});

  renderBatchPerformance();
}

function renderBatchPerformance() {
  const tbodies = document.querySelectorAll('#oc-batches');
  if (tbodies.length === 0) return;

  const batches = {};
  allProspects.forEach(p => {
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
          <td>${esc(b)}</td><td>${r.prospects}</td><td>${r.emails}</td>
          <td>${r.clicks}</td><td>${r.comps}</td><td>${r.conv}</td><td style="color:var(--gold);">${roi}</td>
        </tr>`;
      }).join('');
      
  tbodies.forEach(tb => tb.innerHTML = html);
}

// ════════════════════════════════════════════════════════════════════════
// ═════════ ACTIVE DEALS / KANBAN BOARD ══════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
function renderDealsBoard() {
  const cols = { 1: [], 2: [], 3: [], 4: [], 5: [] };

  allProspects.forEach(p => {
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

  if (allFlagship && Array.isArray(allFlagship)) {
      allFlagship.forEach(f => {
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
          const name = esc(c.founderName || c.name || 'Unknown');
          const comp = esc(c.company || '—');
          
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

          const clickFn = isFlagship ? `openFSP('${esc(c.id)}')` : `openPP('${esc(c.id)}')`;

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
}

// ════════════════════════════════════════════════════════════════════════
// ═════════ THE IDENTIFIER TRIAD (SEARCH FILTER) V3 UPGRADE ══════════════
// ════════════════════════════════════════════════════════════════════════
function populateBatchFilter() {
  const sel = $('op-batch');
  if (!sel || sel.options.length > 1) return;
  [...new Set(allProspects.map(p => p.batchNumber).filter(Boolean))].sort().forEach(b => {
    const o = document.createElement('option'); o.value = b; o.textContent = b;
    sel.appendChild(o);
  });
}

function filterProspects() {
  const s   = ($('op-search')?.value || '').toLowerCase();
  const st  = $('op-status')?.value  || '';
  const bt  = $('op-batch')?.value   || '';
  const fs  = $('op-funding')?.value || '';
  const sc  = $('op-scanner')?.value || '';
  const gap = $('op-gap')?.value || ''; // V3: NUCLEAR, CRITICAL, HIGH, MEDIUM
  const ai  = $('op-ai')?.value || '';  // V3: Internal Categories (The Doers, etc)
  const li  = $('op-li-filter')?.value || '';
  const srt = $('op-sort')?.value || 'nextDate';

  let list = allProspects.filter(p => {
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
}

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

        return `<tr onclick="openPP('${esc(p.id)}')">
          <td>
            <div style="font-size:11px;font-weight:600;">${esc(p.founderName||p.name||'—')}${threatIcon}</div>
            <div style="font-size:9px;color:var(--gold);font-family:'Cormorant Garamond',serif;">${esc(p.prospectId||'')}</div>
          </td>
          <td class="dim">${esc(p.company||'—')}</td>
          <td class="dim">${esc(p.batchNumber||'—')}</td>
          <td><span class="badge ${sClass[p.status]||'b-ghost'}">${esc(p.status||'—')}</span></td>
          <td class="dim">${esc(p.internalCategory || p.followUpBranch || '—')}</td>
          <td>${scan} <span class="hot-flag">${fire}</span></td> <td class="dim">${esc(p.linkedinStatus||'—')}</td>
          <td class="dim">${esc(p.nextActionDate||'—')}</td>
          <td class="dim">${p.emailsSent||0}</td>
        </tr>`;
      }).join('');

  tbodies.forEach(tb => tb.innerHTML = html);
}

function renderHot() {
  const tbodies = document.querySelectorAll('#oh-tbody');
  if (tbodies.length === 0) return;
  const hot = allProspects.filter(p => (p.scannerClicked||p.scannerCompleted||p.hotFlag) && p.status !== 'Converted');
  
  const html = !hot.length 
    ? '<tr><td colspan="6" class="empty">No hot signals yet</td></tr>'
    : hot.map(p => `
        <tr onclick="openPP('${esc(p.id)}')">
          <td>${esc(p.founderName||p.name||'—')} ${p.scannerCompleted?'🔥🔥':(p.scannerClicked||p.hotFlag?'🔥':'')}</td>
          <td class="dim">${esc(p.company||'—')}</td>
          <td>${p.scannerCompleted ? 'Scanner Completed' : (p.scannerClicked ? 'Scanner Clicked' : 'Intelligence Match')}</td>
          <td>${p.scannerExternalScore ?? '—'}</td>
          <td><span class="badge b-${(p.status||'cold').toLowerCase()}">${esc(p.status||'—')}</span></td>
          <td class="dim">${esc(p.nextActionDate||'—')}</td>
        </tr>`).join('');
        
  tbodies.forEach(tb => tb.innerHTML = html);
}

function renderFollowup() {
  const tbodies = document.querySelectorAll('#ofu-tbody');
  if (tbodies.length === 0) return;
  const todayStr = new Date().toISOString().split('T')[0];
  const due = allProspects
    .filter(p => p.nextActionDate && p.nextActionDate <= todayStr && !['Converted','Dead'].includes(p.status))
    .sort((a,b) => (a.nextActionDate||'').localeCompare(b.nextActionDate||''));
    
  const html = !due.length 
    ? '<tr><td colspan="5" class="empty">No follow-ups due</td></tr>'
    : due.map(p => {
        const over = p.nextActionDate < todayStr;
        return `<tr onclick="openPP('${esc(p.id)}')">
          <td>${esc(p.founderName||p.name||'—')}</td>
          <td class="dim">${esc(p.company||'—')}</td>
          <td ${over?'style="color:#d47a7a"':''}>${esc(p.nextActionDate)} ${over?'⚠':''}</td>
          <td><span class="badge b-${(p.status||'cold').toLowerCase()}">${esc(p.status||'—')}</span></td>
          <td class="dim">${esc(p.nextAction||'—')}</td>
        </tr>`;
      }).join('');
      
  tbodies.forEach(tb => tb.innerHTML = html);
}

async function renderInbound() {
  const tbodies = document.querySelectorAll('#oin-tbody');
  if (tbodies.length === 0) return;
  try {
    const snap = await db.collection('leads')
      .where('leadType','in',['warm_lead','hot_lead'])
      .orderBy('createdAt','desc').get();
    const leads = [];
    snap.forEach(d => leads.push({ id: d.id, ...d.data() }));
    const active = leads.filter(l => !['converted','archived'].includes(l.status));
    
    const html = !active.length 
        ? '<tr><td colspan="6" class="empty">No inbound submissions</td></tr>'
        : active.map(l => `
          <tr>
            <td>${esc(l.name||'—')}</td>
            <td class="dim">${esc(l.email||l.id)}</td>
            <td class="dim">${esc(l.company||'—')}</td>
            <td>${l.scannerExternalScore ?? l.scannerScore ?? '—'}</td>
            <td class="dim">${fmtDate(l.createdAt)}</td>
            <td onclick="event.stopPropagation()">
              <button class="btn btn-primary btn-sm" onclick="convertLead('${esc(l.id)}')">Convert</button>
            </td>
          </tr>`).join('');
          
    tbodies.forEach(tb => tb.innerHTML = html);
  } catch(e) { console.error(e); tbodies.forEach(tb => tb.innerHTML = '<tr><td colspan="6" class="loading">Error loading</td></tr>'); }
}

function renderDead() {
  const tbodies = document.querySelectorAll('#od-tbody');
  if (tbodies.length === 0) return;
  const dead = allProspects.filter(p => p.status === 'Dead');
  
  const html = !dead.length 
    ? '<tr><td colspan="4" class="empty">No archived prospects</td></tr>'
    : dead.map(p => `
        <tr onclick="openPP('${esc(p.id)}')">
          <td>${esc(p.founderName||p.name||'—')}</td>
          <td class="dim">${esc(p.company||'—')}</td>
          <td class="dim">${esc(p.batchNumber||'—')}</td>
          <td class="dim">${fmtDate(p.archivedAt||p.updatedAt)}</td>
        </tr>`).join('');
        
  tbodies.forEach(tb => tb.innerHTML = html);
}

// ════════════════════════════════════════════════════════════════════════
// ═════════ INBOUND LEAD CONVERSION ══════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
window.convertLead = async function(leadId) {
  if (!confirm('Convert this Lead into a Pipeline Prospect?')) return;
  try {
    const leadDoc = await db.collection('leads').doc(leadId).get();
    if (!leadDoc.exists) { toast('Lead not found', 'error'); return; }
    const l = leadDoc.data();
    
    // Batch Logic: Month + Alpha
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const batch = `${month}I`; // 'I' for Inbound

    const pid  = await genProspectId(batch);
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
    await db.collection('prospects').doc(pid).set(prospectData, { merge: true });
    await db.collection('leads').doc(leadId).update({ status: 'converted', convertedAt: new Date().toISOString() });
    
    toast(`Lead converted to ${pid}`);
    if (typeof loadOutreach === 'function') loadOutreach(); 
    if (typeof loadLeads === 'function') loadLeads(); 
  } catch(e) { console.error(e); toast('Conversion failed', 'error'); }
};

// ════════════════════════════════════════════════════════════════════════
// ═════════ THE DOSSIER GENERATOR V5.2 ═══════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
window.copyDossier = async function(id) {
    const p = allProspects.find(x => x.id === id);
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
        toast('Dossier copied to clipboard!');
    } catch (err) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            toast('Dossier copied to clipboard!');
        } catch (err2) {
            toast('Failed to copy', 'error');
        }
        document.body.removeChild(textArea);
    }
};

window.copyToClipboard = function(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.select();
    document.execCommand('copy');
    toast('Copied to clipboard');
};

// ════════════════════════════════════════════════════════════════════════
// ═════════ THE V3 DOSSIER MODAL (FULL PAGE TAKEOVER V5.2) ═══════════════
// ════════════════════════════════════════════════════════════════════════
function openPP(id) {
  const p = allProspects.find(x => x.id === id);
  if (!p) return;
  currentProspect = p;

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
}

function closePP() {
  currentProspect = null;
  $('prospectPanel')?.classList.remove('open');
}

function renderPPBody(p) {
  const body = $('pp-body');
  if (!body) return;

  const sel = (opts, cur) => opts.map(o => `<option value="${o}" ${cur===o?'selected':''}>${o||'—'}</option>`).join('');
  const planSel = Object.entries(PLANS).map(([k,v]) =>
    `<option value="${k}" ${p.intendedPlan===k?'selected':''}>${v}</option>`).join('');
  
  const logRows = (p.emailLog||[]).slice().reverse().map(e =>
    `<div style="display:flex; gap:10px; padding:7px 0; border-bottom:1px solid rgba(197,160,89,.06); font-size:10px; flex-wrap:wrap;">
      <span style="color:var(--marble-faint);flex-shrink:0;width:80px">${esc(e.date||'—')}</span>
      <span style="color:var(--gold);flex-shrink:0;width:90px;font-weight:600;">${esc(e.type||'—')}</span>
      <span style="color:var(--marble-dim);flex:1;word-break:break-word;">${esc(e.notes||'')}</span>
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
              <div style="font-size:15px; font-weight:700; color:var(--marble); margin-bottom:8px;">${esc(ks.gapName)}</div>
              <div style="font-size:11px; color:var(--marble-dim); margin-bottom:4px;"><strong>Pain:</strong> ${esc(ks.pain)}</div>
              <div style="font-size:11px; color:var(--marble-dim); margin-bottom:4px;"><strong>Liability:</strong> ${esc(ks.liability)}</div>
              <div style="font-size:11px; color:${ksColor}; margin-top:8px; font-weight:bold;">Damage Ceiling: ${esc(ks.damage)}</div>
          </div>
      `;

      if (sorted.length > 1) {
          gapsHtml += `<div style="font-size:9px; color:var(--marble-dim); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:8px; margin-top:16px;">Secondary Exposures</div>`;
          gapsHtml += sorted.slice(1).map(g => {
              const col = g.severity === 'CRITICAL' ? '#f97316' : (g.severity === 'HIGH' ? 'var(--gold)' : 'var(--marble-dim)');
              return `
              <div style="background:var(--surface2); border:1px solid var(--border); padding:10px; border-left:3px solid ${col}; border-radius:4px; margin-bottom:8px;">
                  <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                      <span style="font-size:11px; font-weight:600; color:var(--marble);">${esc(g.gapName)}</span>
                      <span style="font-size:9px; color:${col}; font-weight:700;">${g.severity}</span>
                  </div>
                  <div style="font-size:10px; color:var(--marble-dim); line-height:1.3;">${esc(g.pain)}</div>
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
      gapsHtml = `<div class="empty" style="border: 1px dashed var(--border); border-radius:6px; padding:20px;">No V3 Matrix Gaps detected. Fallback: <br><br> ${(p.activeTraps||[]).map(t => `<span class="badge b-red">${esc(t)}</span>`).join(' ')}</div>`;
  }

  // 2. ASYNC TELEMETRY LOGIC (CONFESSIONS)
  let telemetryHtml = '';
  if (p.scannerCompleted || p.scannerClicked) {
      const confessionList = (p.vaultInputs || []).map(inp => `
          <div style="display:flex; justify-content:space-between; border-bottom:1px solid rgba(255,255,255,0.03); padding:6px 0; gap:10px;">
              <span style="font-size:10px; color:var(--marble-dim); flex:1;">${esc(inp.question)}</span>
              <span style="font-size:10px; color:var(--gold); font-weight:600;">${esc(inp.answer)}</span>
          </div>`).join('');

      telemetryHtml = `
          <div class="card" style="padding: 16px; border-color: #d47a7a; background: var(--surface2);">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                  <div style="font-size:10px; color:#d47a7a; text-transform:uppercase; letter-spacing:0.1em; font-weight:700;">Section 4: Async Telemetry (The Confessional)</div>
                  <span class="badge b-red">${p.scannerCompleted ? 'Completed 🔥🔥' : 'Clicked 🔥'}</span>
              </div>
              <div class="fi-row" style="margin-bottom:16px;">
                  <div class="fg" style="margin:0;"><label class="fl">Exposure Floor</label><div style="color:#ef4444; font-weight:bold; font-size:18px;">${esc(p.scannerExternalScore||'—')}</div></div>
                  <div class="fg" style="margin:0;"><label class="fl">Int Risk Score</label><div style="font-size:14px; font-weight:bold;">${esc(p.scannerInternalScore||'—')}</div></div>
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
        <button class="btn btn-primary btn-sm" onclick="copyDossier('${esc(p.id)}')">📋 Copy Full Dossier</button>
    </div>

    <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 32px; height: calc(100vh - 160px); overflow: hidden;">
        
        <div style="overflow-y: auto; padding-right: 12px; display: flex; flex-direction: column; gap: 20px;">
            
            <div class="card" style="padding: 20px;">
                <div style="font-size:10px; color:var(--gold); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:16px; font-weight:700;">Section 1: Company Intelligence</div>
                <div class="fi-row" style="margin-bottom:12px;">
                    <div class="fg" style="margin:0;"><label class="fl">INT-10 Archetype</label><input type="text" class="fi" id="pp-int-cat" value="${esc(p.internalCategory||'')}"></div>
                    <div class="fg" style="margin:0;"><label class="fl">EXT-6 Category</label><input type="text" class="fi" id="pp-ext-cat" value="${esc(p.externalCategory||'')}"></div>
                </div>
                <div class="fi-row" style="margin-bottom:16px;">
                    <div class="fg" style="margin:0;"><label class="fl">Liability Lane</label><div style="font-size:12px; color:var(--marble); font-weight:bold; margin-top:8px;">${esc(p.lane||'—')}</div></div>
                    <div class="fg" style="margin:0;"><label class="fl">Geography</label><input type="text" class="fi" id="pp-geo" value="${esc(p.geography||'')}"></div>
                </div>
                <div class="fi-row" style="margin-bottom:16px;">
                    <div class="fg" style="margin:0;"><label class="fl">Funding</label>
                        <select class="fi" id="pp-funding-text" style="padding:6px; font-size:11px;">${sel(['','Pre-seed','Seed','Series A','Series B+','Bootstrapped'], p.fundingStage)}</select>
                    </div>
                    <div class="fg" style="margin:0;"><label class="fl">Headcount</label><input type="text" class="fi" id="pp-headcount" value="${esc(p.headcount||'')}"></div>
                </div>

                <div style="padding-top:16px; border-top:1px solid var(--border);">
                    <div class="fi-row" style="margin-bottom:10px">
                        <div class="fg"><label class="fl">Founder Name</label><input type="text" class="fi" id="pp-name-edit" value="${esc(p.founderName||p.name||'')}"></div>
                        <div class="fg"><label class="fl">Company Name</label><input type="text" class="fi" id="pp-company-edit" value="${esc(p.company||'')}"></div>
                    </div>
                    <div class="fi-row" style="margin-bottom:10px">
                        <div class="fg"><label class="fl">Email</label><input type="email" class="fi" id="pp-email-edit" value="${esc(p.email||'')}"></div>
                        <div class="fg"><label class="fl">Job Title</label><input type="text" class="fi" id="pp-title" value="${esc(p.jobTitle||'')}"></div>
                    </div>
                    <div class="fi-row" style="margin-bottom:0">
                        <div class="fg" style="margin:0;"><label class="fl">LinkedIn URL</label><input type="text" class="fi" id="pp-linkedin-edit" value="${esc(p.linkedinUrl||'')}"></div>
                        <div class="fg" style="margin:0;"><label class="fl">Website</label><input type="text" class="fi" id="pp-website-edit" value="${esc(p.website||'')}"></div>
                    </div>
                </div>
            </div>

            <div class="card" style="padding: 20px;">
                <div style="font-size:10px; color:var(--gold); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:16px; font-weight:700;">Section 2: Forensic Matrix</div>
                <div class="fg" style="margin-bottom:16px;"><label class="fl">Product Signal (The Trigger)</label><div style="font-size:12px; color:var(--marble); line-height:1.5; padding:10px; background:var(--surface2); border:1px solid var(--border); border-radius:4px;">${esc(p.productSignal||'—')}</div></div>
                ${gapsHtml}
                ${businessImpactHtml}
            </div>
        </div>

        <div style="overflow-y: auto; padding-right: 12px; display: flex; flex-direction: column; gap: 20px;">
            
            <div class="card" style="padding: 20px;">
                <div style="font-size:10px; color:var(--gold); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:12px; font-weight:700;">Section 3: The Spear (Current Payload)</div>
                <div class="fg"><label class="fl">Subject Line</label><input type="text" class="fi" id="pp-subject" value="${esc(p.emailSubject||'')}" style="border-color:var(--gold-mid); font-family:monospace;"></div>
                <div class="fg" style="margin-bottom:0;"><label class="fl">Email Body</label><textarea class="fi" id="pp-hook" rows="6" style="border-color:var(--gold-mid); line-height:1.5;">${esc(p.personalizedHook||'')}</textarea></div>
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
                    <div class="fg" style="margin:0;"><label class="fl">Next Step Note</label><input type="text" class="fi" id="pp-next-note" value="${esc(p.nextAction||'')}" placeholder="e.g. Follow up on scanner"></div>
                </div>

                <div class="fg" style="margin-bottom:16px;">
                    <label class="fl">Internal Strategy Notes</label>
                    <textarea class="fi" id="pp-notes" rows="2" placeholder="Drop context here...">${esc(p.notes||'')}</textarea>
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
                    <button class="btn btn-danger btn-sm" onclick="deleteProspect('${esc(p.id)}')">Permanently Delete Target</button>
                </div>

                <input type="hidden" id="pp-batch-edit" value="${esc(p.batchNumber||'')}">
                <input type="hidden" id="pp-gap-status" value="${esc(p.legalGapStatus||'generic')}">
                <input type="hidden" id="pp-gap-text" value="${esc(p.legalGapAnalysis||'')}">
                <input type="hidden" id="pp-branch" value="${esc(p.followUpBranch||'')}">
                <input type="hidden" id="pp-li" value="${esc(p.linkedinStatus||'')}">
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
    if (!currentProspect) return;
    if (!confirm('Pivot this target to the Flagship pipeline? This will archive the current prospect and create a new Flagship deal.')) return;

    const fsData = {
        founderName: currentProspect.founderName || currentProspect.name || 'Unknown',
        email: currentProspect.email || '',
        company: currentProspect.company || '',
        preCallNotes: 'Pivoted from Automated V3 Pipeline.\nOriginal Gap Identified: ' + (currentProspect.productSignal || 'N/A'),
        status: 'Identified',
        addedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    try {
        await db.collection('flagship').add(fsData);
        await db.collection('prospects').doc(currentProspect.prospectId || currentProspect.id).update({
            status: 'Dead',
            archivedAt: new Date().toISOString(),
            notes: (currentProspect.notes || '') + '\n[SYSTEM] Pivoted to Flagship Pipeline.'
        });
        toast('Pivoted to Flagship successfully!', 'success');
        closePP();
        if (typeof loadFlagship === 'function') loadFlagship();
    } catch (e) {
        console.error(e);
        toast('Pivot failed', 'error');
    }
};

async function saveProspect() {
  if (!currentProspect) return;
  const updates = {
    founderName: $('pp-name-edit')?.value?.trim() || '',
    company: $('pp-company-edit')?.value?.trim() || '',
    email: $('pp-email-edit')?.value?.trim().toLowerCase() || currentProspect.email,
    internalCategory: $('pp-int-cat')?.value || currentProspect.internalCategory || '',
    externalCategory: $('pp-ext-cat')?.value || currentProspect.externalCategory || '',
    geography: $('pp-geo')?.value || currentProspect.geography || '',
    headcount: $('pp-headcount')?.value || currentProspect.headcount || '',
    fundingStage: $('pp-funding-text')?.value || currentProspect.fundingStage || '',
    status: $('pp-status')?.value || currentProspect.status,
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
  if (updates.status === 'Converted' && currentProspect.status !== 'Converted') {
      isConvertingToClient = true;
  }

  if (updates.status === 'Dead' && currentProspect.status !== 'Dead' && !isConvertingToClient) {
      updates.archivedAt = new Date().toISOString();
  }

  try {
    if (isConvertingToClient) {
        if (!confirm(`Initialize P→C Migration? This pushes target to The Factory (LN-C).`)) return;
        const clientId = (currentProspect.prospectId || '').replace('LN-P-', 'LN-C-') || ('LN-C-' + Date.now());
        const clientData = {
            ...currentProspect, ...updates,
            id: updates.email, 
            engagementRef: clientId,
            originalProspectId: currentProspect.prospectId,
            status: 'payment_received',
            createdAt: new Date().toISOString(),
            plan: updates.intendedPlan || 'agentic_shield'
        };
        await db.collection('clients').doc(updates.email).set(clientData);
        toast(`Migrated to The Factory as ${clientId}`, 'success');
        updates.status = 'Dead';
        updates.archivedAt = new Date().toISOString();
        updates.notes = (updates.notes || '') + `\n[SYSTEM] Deal Closed. Data migrated to Client ID: ${clientId}`;
    }

    const docKey = currentProspect.prospectId || currentProspect.id;
    await db.collection('prospects').doc(docKey).set(updates, { merge: true });
    
    currentProspect = { ...currentProspect, ...updates };
    if (!isConvertingToClient) toast('Prospect Dossier Saved');
    
    const idx = allProspects.findIndex(p => p.id === currentProspect.id);
    if (idx !== -1) allProspects[idx] = currentProspect;
    
    if (isConvertingToClient) closePP(); 
    else if (typeof filterProspects === 'function') filterProspects();

  } catch(e) { console.error(e); toast('Save failed', 'error'); }
}

async function deleteProspect(id) {
    if (!confirm(`WARNING: Permanently delete target?`)) return;
    try {
        await db.collection('prospects').doc(id).delete();
        closePP(); toast('Target Deleted', 'success');
    } catch(e) { toast('Delete failed', 'error'); }
}

async function logEmail() {
  if (!currentProspect) return;
  const note = $('pp-manual-log')?.value?.trim() || 'Logged manually';
  const type = $('pp-log-type')?.value || 'Cold Email';
  const date = $('pp-log-date')?.value || new Date().toISOString().split('T')[0];
  const entry = { date: date, type: type, notes: note };
  
  const docKey = currentProspect.prospectId || currentProspect.id;
  const newCount = (currentProspect.emailsSent||0) + 1;
  try {
    await db.collection('prospects').doc(docKey).update({ emailLog: firebase.firestore.FieldValue.arrayUnion(entry), emailsSent: newCount, updatedAt: new Date().toISOString() });
    currentProspect.emailLog = [...(currentProspect.emailLog||[]), entry];
    currentProspect.emailsSent = newCount;
    toast('Action Logged');
    renderPPBody(currentProspect);
  } catch(e) { toast('Log failed', 'error'); }
}

async function genProspectId(batchCode) {
  try {
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const searchBatch = batchCode || `${month}A`;
    const prefix = `LN-P-AI-26-${searchBatch}-`;
    const snap = await db.collection('prospects').where('prospectId', '>=', prefix).where('prospectId', '<=', prefix + '\uf8ff').get();
    let max = 0; snap.forEach(d => { const pid = d.data().prospectId || ''; const num = parseInt(pid.split('-').pop(), 10); if (num > max) max = num; });
    return `${prefix}${String(max + 1).padStart(3,'0')}`;
  } catch { return `LN-P-AI-26-03A-001`; }
}

// ════════════════════════════════════════════════════════════════════════
// ═════════ MANUAL ADD PROSPECT (V3 ALIGNED) ═════════════════════════════
// ════════════════════════════════════════════════════════════════════════
function openAddProspect() {
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const catOpts = ['The Doers','The Orchestrators','The Creators','The Companions','The Readers','The Translators','The Judges','The Shields','The Movers','The Optimizers'];
  
  openModal('Initialize Target Acquisition (V3 Manual)', `
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
}

async function saveNewProspect() {
  const email = $('ap-email')?.value?.trim().toLowerCase();
  const batch = $('ap-batch')?.value?.trim();
  if (!email) return toast('Email required', 'error');
  try {
    const pid = await genProspectId(batch);
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
    await db.collection('prospects').doc(pid).set(data);
    closeModal(); toast(`${pid} added.`);
  } catch(e) { console.error(e); toast('Save failed', 'error'); }
}

// ════════════════════════════════════════════════════════════════════════
// ═════════ FLAGSHIP CRM LOGIC ═══════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
async function loadFlagship() {
  setPageActions(`<button class="btn btn-primary" onclick="openAddFlagship()">+ Add Flagship Prospect</button>`);
  
  const tbodies = document.querySelectorAll('#fs-tbody');
  tbodies.forEach(tb => tb.innerHTML = '<tr><td colspan="7" class="loading">Loading…</td></tr>');
  
  try {
    const snap = await db.collection('flagship').orderBy('addedAt','desc').get();
    allFlagship = [];
    snap.forEach(d => allFlagship.push({ id: d.id, ...d.data() }));
    renderFlagshipTable(allFlagship);
    if (typeof renderDealsBoard === 'function') renderDealsBoard(); 
  } catch(e) {
    console.error(e);
    tbodies.forEach(tb => tb.innerHTML = '<tr><td colspan="7" class="loading" style="color:#d47a7a">Failed to load</td></tr>');
  }
}

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
        return `<tr onclick="openFSP('${esc(fs.id)}')">
          <td>${esc(fs.founderName||fs.name||'—')}</td>
          <td class="dim">${esc(fs.company||'—')}</td>
          <td><span class="badge ${sClass[fs.status]||'b-ghost'}">${esc(fs.status||'—')}</span></td>
          <td class="dim">${fmtMoney(fs.priceQuoted)}</td>
          <td class="dim">${esc(fs.proposalSentDate||'—')}${fuBadge}</td>
          <td class="dim">${esc(fs.nextStep||'—')}</td>
          <td class="dim">${fmtDate(fs.addedAt)}</td>
        </tr>`;
      }).join('');
      
  tbodies.forEach(tb => tb.innerHTML = html);
}

function filterFlagship() {
  const s  = ($('fs-search')?.value||'').toLowerCase();
  const st = $('fs-status')?.value || '';
  renderFlagshipTable(allFlagship.filter(f =>
    (!s  || (f.founderName||f.name||'').toLowerCase().includes(s) || (f.company||'').toLowerCase().includes(s)) &&
    (!st || f.status === st)
  ));
}

function openAddFlagship() {
  openModal('Add Flagship Prospect', `
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
}

async function saveNewFlagship() {
  const email = $('fsa-email')?.value?.trim().toLowerCase();
  if (!email) { toast('Email is required', 'error'); return; }
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
    const ref = await db.collection('flagship').add(data);
    allFlagship.unshift({ id: ref.id, ...data });
    renderFlagshipTable(allFlagship);
    if (typeof renderDealsBoard === 'function') renderDealsBoard(); 
    closeModal();
    toast('Flagship prospect added');
  } catch(e) { console.error(e); toast('Save failed', 'error'); }
}

function openFSP(id) {
  const fs = allFlagship.find(x => x.id === id);
  if (!fs) return;
  currentFlagship = fs;
  $('flagshipPanel')?.classList.add('open');
  setText('fsp-name', fs.founderName || fs.name || '—');
  setText('fsp-meta', fs.company || '—');
  renderFSPBody(fs);
}

function closeFSP() {
  currentFlagship = null;
  $('flagshipPanel')?.classList.remove('open');
}

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
      <textarea class="fi" id="fsp-precall" rows="3">${esc(fs.preCallNotes||'')}</textarea></div>
    <div class="fg"><label class="fl">Post-Call Gap Identified</label>
      <textarea class="fi" id="fsp-postcall" rows="3">${esc(fs.postCallGap||'')}</textarea></div>
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
      <textarea class="fi" id="fsp-next" rows="2">${esc(fs.nextStep||'')}</textarea></div>
    <button class="btn btn-primary btn-full" onclick="saveFSP()">Save</button>
  </div>`;
}

async function saveFSP() {
  if (!currentFlagship) return;
  const propDate = $('fsp-prop-date')?.value || '';
  const updates  = {
    status:           $('fsp-status')?.value         || currentFlagship.status,
    preCallNotes:      $('fsp-precall')?.value?.trim() || '',
    postCallGap:       $('fsp-postcall')?.value?.trim()|| '',
    prescribedPlan:    $('fsp-plan')?.value             || '',
    priceQuoted:       parseFloat($('fsp-price')?.value) || null,
    proposalSentDate: propDate,
    nextStep:          $('fsp-next')?.value?.trim()    || '',
    updatedAt:         new Date().toISOString()
  };
  if (propDate && !currentFlagship.proposalSentAt)
    updates.proposalSentAt = new Date().toISOString();

  try {
    await db.collection('flagship').doc(currentFlagship.id).set(updates, { merge: true });
    currentFlagship = { ...currentFlagship, ...updates };
    const idx = allFlagship.findIndex(f => f.id === currentFlagship.id);
    if (idx !== -1) allFlagship[idx] = currentFlagship;
    renderFlagshipTable(allFlagship);
    if (typeof renderDealsBoard === 'function') renderDealsBoard();
    toast('Flagship saved');
  } catch(e) { console.error(e); toast('Save failed', 'error'); }
}

// ════════════════════════════════════════════════════════════════════════
// ═════════ CONTENT ENGINE ═══════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
async function loadContent() {
  setPageActions(`<button class="btn btn-primary" onclick="openAddContent()">+ Add Post</button>`);
  const tbodies = document.querySelectorAll('#ct-tbody');
  tbodies.forEach(tb => tb.innerHTML = '<tr><td colspan="5" class="loading">Loading…</td></tr>');
  try {
    const snap = await db.collection('content').orderBy('createdAt','desc').get();
    allContent = [];
    snap.forEach(d => allContent.push({ id: d.id, ...d.data() }));
    renderContent(allContent);
  } catch(e) {
    console.error(e);
    tbodies.forEach(tb => tb.innerHTML = '<tr><td colspan="5" class="loading" style="color:#d47a7a">Failed to load</td></tr>');
  }
}

function renderContent(list) {
  const tbodies = document.querySelectorAll('#ct-tbody');
  if (tbodies.length === 0) return;
  const sClass = { Idea:'b-ghost', Drafting:'b-cold', Scheduled:'b-intake', Posted:'b-delivered', Archived:'b-dead' };
  
  const html = !list.length 
    ? '<tr><td colspan="5" class="loading">No content logged</td></tr>'
    : list.map(c => `
        <tr>
          <td>${esc(c.topic||'—')}</td>
          <td><span class="badge ${sClass[c.status]||'b-ghost'}">${esc(c.status||'—')}</span></td>
          <td class="dim">${esc(c.postedDate||'—')}</td>
          <td class="dim">${esc(c.notes||'—')}</td>
          <td onclick="event.stopPropagation()" style="white-space:nowrap">
            <button class="btn btn-ghost btn-sm" onclick="openEditContent('${esc(c.id)}')">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="deleteContent('${esc(c.id)}')">Delete</button>
          </td>
        </tr>`).join('');
        
  tbodies.forEach(tb => tb.innerHTML = html);
}

function filterContent() {
  const st = $('ct-status')?.value || '';
  renderContent(allContent.filter(c => !st || c.status === st));
}

function contentModalBody(c) {
  const s = c || {};
  const stats = ['Idea','Drafting','Scheduled','Posted','Archived'];
  return `
    <div class="fg"><label class="fl">Topic / Title</label>
      <input type="text" class="fi" id="ct-topic" value="${esc(s.topic||'')}" placeholder="Post topic…"></div>
    <div class="fi-row">
      <div class="fg"><label class="fl">Status</label>
        <select class="fi" id="ct-status-sel">
          ${stats.map(x => `<option ${s.status===x?'selected':''}>${x}</option>`).join('')}
        </select></div>
      <div class="fg"><label class="fl">Posted Date</label>
        <input type="date" class="fi" id="ct-date" value="${s.postedDate||''}"></div>
    </div>
    <div class="fg"><label class="fl">Notes</label>
      <textarea class="fi" id="ct-notes" rows="2">${esc(s.notes||'')}</textarea></div>`;
}

function openAddContent() {
  openModal('Add Content', contentModalBody(null), `
    <button class="btn btn-outline btn-sm" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary btn-sm" onclick="saveContent(null)">Add</button>
  `);
}

function openEditContent(id) {
  const c = allContent.find(x => x.id === id);
  if (!c) return;
  openModal('Edit Content', contentModalBody(c), `
    <button class="btn btn-outline btn-sm" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary btn-sm" onclick="saveContent('${id}')">Save</button>
  `);
}

async function saveContent(id) {
  const data = {
    topic:      $('ct-topic')?.value?.trim()  || '',
    status:     $('ct-status-sel')?.value     || 'Idea',
    postedDate: $('ct-date')?.value           || '',
    notes:      $('ct-notes')?.value?.trim()  || '',
    updatedAt:  new Date().toISOString()
  };
  if (!data.topic) { toast('Topic is required', 'error'); return; }
  try {
    if (id) {
      await db.collection('content').doc(id).set(data, { merge: true });
      const idx = allContent.findIndex(c => c.id === id);
      if (idx !== -1) allContent[idx] = { ...allContent[idx], ...data };
    } else {
      data.createdAt = new Date().toISOString();
      const ref = await db.collection('content').add(data);
      allContent.unshift({ id: ref.id, ...data });
    }
    closeModal();
    renderContent(allContent);
    toast('Content saved');
  } catch(e) { console.error(e); toast('Save failed', 'error'); }
}

async function deleteContent(id) {
  if (!confirm('Delete this entry?')) return;
  try {
    await db.collection('content').doc(id).delete();
    allContent = allContent.filter(c => c.id !== id);
    renderContent(allContent);
    toast('Deleted');
  } catch(e) { console.error(e); toast('Delete failed', 'error'); }
}

// ════════════════════════════════════════════════════════════════════════
// ═════════ THE REGULATORY RADAR ENGINE ══════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
window.openAddRegulation = function() {
  openRadarModal(-1);
};

async function loadRadar() {
  setPageActions('');
  await loadRadarCache();
  renderRadarList();
  $('rv-manage')?.classList.remove('hidden');
  $('rv-exposure')?.classList.add('hidden');
  qsa('#tab-radar .view-btn').forEach((b,i) => b.classList.toggle('active', i === 0));
  const badge = $('radar-badge');
  if (badge) {
    const n = radarEntries.filter(r => r.severity === 'CRITICAL').length;
    badge.textContent = n;
    badge.classList.toggle('hidden', n === 0);
  }
}

function setRadarView(view, el) {
  qsa('#tab-radar .view-btn').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
  $('rv-manage')?.classList.toggle('hidden',   view !== 'manage');
  $('rv-exposure')?.classList.toggle('hidden', view !== 'exposure');
  if (view === 'manage')   renderRadarList();
  if (view === 'exposure') renderExposureMatrix();
}

function renderRadarList() {
  const el = $('rv-list');
  if (!el) return;
  if (!radarEntries.length) {
    el.innerHTML = '<div class="tbl-empty">No regulations in radar yet</div>';
    return;
  }
  const sevOrder = { CRITICAL:0, HIGH:1, MEDIUM:2, LOW:3 };
  const sorted   = radarEntries.map((r,i) => ({ ...r, _i: i }))
    .sort((a,b) => (sevOrder[a.severity]??4) - (sevOrder[b.severity]??4));
  const sevClass = { CRITICAL:'b-red', HIGH:'b-yellow', MEDIUM:'b-warm', LOW:'b-ghost' };

  el.innerHTML = sorted.map(reg => {
    const plans = (reg.coveredByPlan||[])
      .map(p => `<span class="badge b-intake" style="margin-right:3px">${planLabel(p)}</span>`).join('');
    return `<div class="radar-entry">
      <div style="flex:1">
        <div class="radar-title">${esc(reg.title||'—')}</div>
        <div class="radar-meta">${esc(reg.jurisdiction||'—')} · Effective: ${esc(reg.effectiveDate||'—')}</div>
        ${plans ? `<div style="margin-top:6px">${plans}</div>` : ''}
        ${reg.description ? `<div style="font-size:10px;color:var(--marble-dim);margin-top:4px">${esc(reg.description)}</div>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;flex-shrink:0">
        <span class="badge ${sevClass[reg.severity]||'b-ghost'}">${esc(reg.severity||'—')}</span>
        <div class="radar-actions">
          <button class="btn btn-ghost btn-sm" onclick="openRadarModal(${reg._i})">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteRadarEntry(${reg._i})">Delete</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function openRadarModal(idx) {
  editingRegIdx = idx;
  const reg = idx >= 0 ? (radarEntries[idx] || {}) : {};
  const jurs = ['US-Federal','US-CA','US-NY','US-TX','US-CO','US-IL','EU','UK','Canada','Australia','Singapore','India','UAE','Global'];
  const jurOpts    = jurs.map(j => `<option ${reg.jurisdiction===j?'selected':''}>${j}</option>`).join('');
  const planChecks = Object.entries(PLANS).map(([k,v]) =>
    `<label style="display:flex;align-items:center;gap:8px;font-size:11px;margin-bottom:6px;cursor:pointer">
      <input type="checkbox" class="reg-plan-chk" value="${k}" ${(reg.coveredByPlan||[]).includes(k)?'checked':''}> ${v}
    </label>`).join('');

  openModal(idx >= 0 ? 'Edit Regulation' : 'Add Regulation', `
    <div class="fg"><label class="fl">Title *</label>
      <input type="text" class="fi" id="reg-title" value="${esc(reg.title||'')}"></div>
    <div class="fg"><label class="fl">Description</label>
      <textarea class="fi" id="reg-desc" rows="2">${esc(reg.description||'')}</textarea></div>
    <div class="fi-row">
      <div class="fg"><label class="fl">Jurisdiction</label>
        <select class="fi" id="reg-jur">${jurOpts}</select></div>
      <div class="fg"><label class="fl">Severity</label>
        <select class="fi" id="reg-sev">
          ${['CRITICAL','HIGH','MEDIUM','LOW'].map(s =>
            `<option ${reg.severity===s?'selected':''}>${s}</option>`).join('')}
        </select></div>
    </div>
    <div class="fg"><label class="fl">Effective Date</label>
      <input type="date" class="fi" id="reg-date" value="${reg.effectiveDate||''}"></div>
    <div class="fg"><label class="fl">Covered By Plan</label>${planChecks}</div>
  `, `
    <button class="btn btn-outline btn-sm" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary btn-sm" onclick="saveRadarEntry()">Save</button>
  `);
}

async function saveRadarEntry() {
  const entry = {
    title:         $('reg-title')?.value?.trim() || '',
    description:   $('reg-desc')?.value?.trim()  || '',
    jurisdiction:  $('reg-jur')?.value           || '',
    severity:      $('reg-sev')?.value           || 'MEDIUM',
    effectiveDate: $('reg-date')?.value          || '',
    coveredByPlan: qsa('.reg-plan-chk:checked').map(el => el.value)
  };
  if (!entry.title) { toast('Title is required', 'error'); return; }

  const entries = [...radarEntries];
  if (editingRegIdx >= 0) entries[editingRegIdx] = entry;
  else entries.push(entry);

  try {
    await db.collection('settings').doc('regulatory_radar').set({ 
        entries: entries,
        lastUpdated: new Date().toISOString()
    });
    radarEntries.length = 0;
    entries.forEach(e => radarEntries.push(e));
    const badge = $('radar-badge');
    if (badge) {
      const n = entries.filter(r => r.severity === 'CRITICAL').length;
      badge.textContent = n;
      badge.classList.toggle('hidden', n === 0);
    }
    closeModal();
    renderRadarList();
    toast('Regulation saved');
  } catch(e) { console.error(e); toast('Save failed', 'error'); }
}

async function deleteRadarEntry(idx) {
  if (!confirm('Delete this regulation?')) return;
  const entries = radarEntries.filter((_, i) => i !== idx);
  try {
    await db.collection('settings').doc('regulatory_radar').set({ 
        entries: entries,
        lastUpdated: new Date().toISOString()
    });
    radarEntries.length = 0;
    entries.forEach(e => radarEntries.push(e));
    
    const badge = $('radar-badge');
    if (badge) {
      const n = entries.filter(r => r.severity === 'CRITICAL').length;
      badge.textContent = n;
      badge.classList.toggle('hidden', n === 0);
    }

    renderRadarList();
    toast('Deleted');
  } catch(e) { console.error(e); toast('Delete failed', 'error'); }
}

async function renderExposureMatrix() {
  const tbodies = document.querySelectorAll('#rv-exposure-tbody');
  if (tbodies.length === 0) return;
  tbodies.forEach(tb => tb.innerHTML = '<tr><td colspan="6" class="loading">Calculating…</td></tr>');
  
  try {
    const snap = await db.collection('clients').get();
    const clients = [];
    snap.forEach(d => clients.push({ id: d.id, ...d.data() }));

    const rows = clients.map(c => {
      const jurs  = [c.registrationJurisdiction, ...(c.operatingJurisdictions||[])].filter(Boolean);
      let delAt = null;
      if (c.deliveredAt) {
          delAt = c.deliveredAt.toDate ? c.deliveredAt.toDate() : new Date(c.deliveredAt);
      } else if (c.status === 'delivered') {
          delAt = c.createdAt ? (c.createdAt.toDate ? c.createdAt.toDate() : new Date(c.createdAt)) : new Date(0);
      }
      let red = 0, yellow = 0;
      radarEntries.forEach(reg => {
        let regJurs = [];
        if (Array.isArray(reg.jurisdiction)) regJurs = reg.jurisdiction;
        else if (typeof reg.jurisdiction === 'string') regJurs = reg.jurisdiction.split(',').map(s=>s.trim().toLowerCase());

        const isGlobalReg = regJurs.some(r => r === 'global');
        const match = isGlobalReg || jurs.some(j => 
            j && regJurs.some(rj => rj && (j.toLowerCase() === rj || rj.startsWith(j.toLowerCase()) || j.toLowerCase().startsWith(rj)))
        );
        if (!match) return;
        const eff = reg.effectiveDate ? new Date(reg.effectiveDate) : null;
        const coveredByPlan = reg.coveredByPlan?.includes(c.plan);
        let isGap = false;
        if (!coveredByPlan) {
            isGap = true;
        } else if (coveredByPlan && c.status === 'delivered' && eff && eff > delAt) {
            isGap = true;
        }
        if (isGap) {
            if (c.maintenanceActive) yellow++;
            else red++;
        }
      });
      return { ...c, _red: red, _yellow: yellow };
    })
    .filter(c => c._red > 0 || c._yellow > 0)
    .sort((a,b) => b._red - a._red || b._yellow - a._yellow);

    const html = !rows.length 
      ? '<tr><td colspan="6" class="loading">No exposures detected — all clients covered</td></tr>'
      : rows.map(c => `
          <tr>
            <td>${esc(c.name||c.id)}</td>
            <td><span class="badge ${planBadgeClass(c.plan)}">${planLabel(c.plan)}</span></td>
            <td class="exp-flag-r">${c._red    > 0 ? `🔴 ${c._red}`    : '—'}</td>
            <td class="exp-flag-y">${c._yellow > 0 ? `🟡 ${c._yellow}` : '—'}</td>
            <td>${c.maintenanceActive
              ? '<span class="badge b-delivered">Active</span>'
              : '<span class="badge b-ghost">None</span>'}</td>
            <td onclick="event.stopPropagation()">
              <button class="btn btn-primary btn-sm"
                onclick="openDetail('${esc(c.id)}');nav('clients')">View</button>
            </td>
          </tr>`).join('');
          
    tbodies.forEach(tb => tb.innerHTML = html);
  } catch(e) {
    console.error(e);
    tbodies.forEach(tb => tb.innerHTML = '<tr><td colspan="6" class="loading" style="color:#d47a7a">Load error</td></tr>');
  }
}

// ════════════════════════════════════════════════════════════════════════
// ═════════ THE FINANCIAL ENGINE ═════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
async function loadFinance() {
  setPageActions('');
  try {
    const snap = await db.collection('clients').get();
    const clients = []; snap.forEach(d => clients.push({ id: d.id, ...d.data() }));

    const paid  = clients.filter(c => c.status !== 'pending_payment');
    const maint = clients.filter(c => c.maintenanceActive);
    const mrr   = maint.length * 297;
    const total = paid.reduce((s,c) => s + (c.price || PLAN_PRICES[c.plan] || 0), 0);
    const avg   = paid.length ? Math.round(total / paid.length) : 0;

    setText('fin-mrr',       fmtMoney(mrr));
    setText('fin-mrr-sub',   `${maint.length} maintenance subscriptions`);
    setText('fin-arr',       fmtMoney(mrr * 12));
    setText('fin-total',     fmtMoney(total));
    setText('fin-total-sub', `${paid.length} paid clients`);
    setText('fin-avg',       fmtMoney(avg));

    const byPlan = {};
    Object.keys(PLANS).forEach(k => { byPlan[k] = { count:0, rev:0 }; });
    paid.forEach(c => {
      if (!byPlan[c.plan]) byPlan[c.plan] = { count:0, rev:0 };
      byPlan[c.plan].count++;
      byPlan[c.plan].rev += (c.price || PLAN_PRICES[c.plan] || 0);
    });
    
    const tbodies = document.querySelectorAll('#fin-by-plan');
    if (tbodies.length > 0) {
      const rows = Object.entries(byPlan).filter(([,v]) => v.count > 0);
      const html = rows.length
        ? rows.map(([k,v]) => `<tr>
            <td><span class="badge ${planBadgeClass(k)}">${planLabel(k)}</span></td>
            <td>${v.count}</td>
            <td>${fmtMoney(v.rev)}</td>
            <td>${total > 0 ? Math.round(v.rev/total*100) + '%' : '—'}</td>
          </tr>`).join('')
        : '<tr><td colspan="4" class="loading">No paid clients yet</td></tr>';
      tbodies.forEach(tb => tb.innerHTML = html);
    }

    const concWarns = document.querySelectorAll('#fin-conc-warn');
    const concLists = document.querySelectorAll('#fin-conc-list');
    
    if (mrr > 0) {
      const rows = maint.map(c => ({ name: c.name||c.id, pct: Math.round(297/mrr*100) }));
      const breach = rows.some(r => r.pct > 30);
      concWarns.forEach(w => w.style.display = breach ? 'block' : 'none');
      const html = rows.map(r =>
          `<div class="conc-row">
            <span>${esc(r.name)}</span>
            <span ${r.pct > 30 ? 'class="conc-flag"' : ''}>${r.pct}%${r.pct>30?' ⚠':''}</span>
          </div>`).join('');
      concLists.forEach(l => l.innerHTML = html);
    } else {
      concWarns.forEach(w => w.style.display = 'none');
      concLists.forEach(l => l.innerHTML = '<div class="loading">No maintenance revenue yet</div>');
    }
  } catch(e) { console.error(e); toast('Finance load failed', 'error'); }
}

// ════════════════════════════════════════════════════════════════════════
// ═════════ SETTINGS & PHASE-LOCKED ADMINS ═══════════════════════════════
// ════════════════════════════════════════════════════════════════════════
async function loadSettings() {
  setPageActions('');
  try {
    const snap = await db.collection('settings').doc('config').get();
    if (snap.exists) {
      const d = snap.data();
      setVal('wh-s2',      d.webhookS2    || '');
      setVal('wh-s3',      d.webhookS3    || '');
      setVal('wh-s4',      d.webhookS4    || '');
      setVal('s-capacity', d.capacityCap  || 10);
    }
    await loadAdmins();
  } catch(e) { console.error(e); toast('Settings load failed', 'error'); }
}

async function saveSettings() {
  const data = {
    webhookS2:   $('wh-s2')?.value?.trim()       || '',
    webhookS3:   $('wh-s3')?.value?.trim()       || '',
    webhookS4:   $('wh-s4')?.value?.trim()       || '',
    capacityCap: parseInt($('s-capacity')?.value) || 10,
    updatedAt:   new Date().toISOString()
  };
  try {
    await db.collection('settings').doc('config').set(data, { merge: true });
    toast('Settings saved');
  } catch(e) { console.error(e); toast('Save failed', 'error'); }
}

async function loadAdmins() {
  const tbodies = document.querySelectorAll('#s-admins');
  if (tbodies.length === 0) return;
  try {
    const snap = await db.collection('admins').get();
    const admins = []; snap.forEach(d => admins.push({ id: d.id, ...d.data() }));
    const html = admins.length ? admins.map(a => `
        <tr>
            <td>${esc(a.id)}</td>
            <td class="dim" style="font-size:9px;">${esc((a.permissions||[]).join(', '))}</td>
            <td onclick="event.stopPropagation()"><button class="btn btn-danger btn-sm" onclick="removeAdmin('${esc(a.id)}')">Remove</button></td>
        </tr>`).join('') : '<tr><td colspan="3" class="loading">No admins</td></tr>';
    tbodies.forEach(tb => tb.innerHTML = html);
  } catch(e) { console.error(e); }
}

async function addAdmin() {
  const email = $('s-new-admin')?.value?.trim().toLowerCase();
  // We use Array.from to grab all checked permission boxes in the UI
  const perms = Array.from(document.querySelectorAll('.adm-perm-chk:checked')).map(el => el.value);
  
  if (!email) { toast('Enter an email', 'error'); return; }
  if (perms.length === 0) { toast('Select at least one permission phase', 'error'); return; }
  
  try {
    await db.collection('admins').doc(email).set({ 
        permissions: perms, 
        addedAt: new Date().toISOString() 
    });
    
    // Clear UI
    if ($('s-new-admin')) $('s-new-admin').value = '';
    document.querySelectorAll('.adm-perm-chk').forEach(el => el.checked = false);
    
    await loadAdmins();
    toast(`${email} added with custom access.`);
  } catch(e) { console.error(e); }
}

async function removeAdmin(email) {
  if (!confirm(`Remove ${email}?`)) return;
  try {
    await db.collection('admins').doc(email).delete();
    await loadAdmins();
    toast(`${email} removed.`);
  } catch(e) { console.error(e); }
}

document.addEventListener('DOMContentLoaded', () => {
  if (typeof loadRitual === 'function') loadRitual();
});
