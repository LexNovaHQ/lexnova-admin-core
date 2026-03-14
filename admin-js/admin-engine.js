// ════════════════════════════════════════════════════════════════════════
// ═════════ LEX NOVA ADMIN: ENGINE ROOM (admin-engine.js) ════════════════
// ════════════════════════════════════════════════════════════════════════
// Description: Finance, Settings, Content, and the V5 Threat CMS.
// ════════════════════════════════════════════════════════════════════════
'use strict';

// ─── LOCAL UTILITIES ────────────────────────────────────────────────────
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
function setVal(id, val) { const el = $(id); if (el) el.value = val ?? ''; }

const PLANS = { agentic_shield: 'Agentic Shield', workplace_shield: 'Workplace Shield', complete_stack: 'Complete Stack', flagship: 'Flagship' };
const PLAN_PRICES = { agentic_shield: 997, workplace_shield: 997, complete_stack: 2500, flagship: 15000 };
function planLabel(k) { return PLANS[k] || k; }
function planBadgeClass(p) { return { agentic_shield:'b-intake', workplace_shield:'b-warm', complete_stack:'b-production', flagship:'b-hot' }[p] || 'b-ghost'; }


// ════════════════════════════════════════════════════════════════════════
// ═════════ GLOBAL ENGINE STATE ══════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
window.allContent = [];
window.radarEntries = [];


// ════════════════════════════════════════════════════════════════════════
// ═════════ SUB-TAB ROUTERS ══════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
window.setEngineView = function(view, el) {
    qsa('#tab-engine .view-btn').forEach(b => b.classList.remove('active'));
    if (el) el.classList.add('active');
    
    ['finance','radar','content','settings'].forEach(v => {
        const section = $('ev-' + v);
        if (section) section.classList.toggle('hidden', v !== view);
    });

    if (view === 'finance') window.loadFinance();
    if (view === 'radar') window.loadRadar();
    if (view === 'content') window.loadContent();
    if (view === 'settings') window.loadSettings();
};

window.loadEngine = function() {
    window.setEngineView('finance', document.querySelector('#tab-engine .view-btn'));
};

window.loadSyndicate = async function() {
    await window.loadRadarCache();
    window.renderExposureMatrix();
    // Re-use financial logic to populate the Active Shields list
    window.loadFinance(); 
};


// ════════════════════════════════════════════════════════════════════════
// ═════════ 1. THE FINANCIAL ENGINE ══════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
window.loadFinance = async function() {
  try {
    const snap = await window.db.collection('clients').get();
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

    // Syndicate Tab: Active Maintenance List
    const concLists = document.querySelectorAll('#fin-conc-list');
    if (mrr > 0) {
      const rows = maint.map(c => ({ name: c.baseline?.company || c.name || c.id, pct: Math.round(297/mrr*100) }));
      const html = rows.map(r =>
          `<div class="conc-row">
            <span>${window.esc(r.name)}</span>
            <span ${r.pct > 30 ? 'class="conc-flag"' : ''} style="color:var(--safe)">$297/mo Active</span>
          </div>`).join('');
      concLists.forEach(l => l.innerHTML = html);
    } else {
      concLists.forEach(l => l.innerHTML = '<div class="loading">No maintenance revenue yet</div>');
    }
  } catch(e) { console.error(e); if(window.toast) window.toast('Finance load failed', 'error'); }
};


// ════════════════════════════════════════════════════════════════════════
// ═════════ 2. V5 REGULATORY RADAR CMS ═══════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
window.loadRadarCache = async function() {
    try {
        const snap = await window.db.collection('settings').doc('regulatory_radar').get();
        window.radarEntries = snap.exists ? (snap.data().entries || snap.data().items || []) : [];
    } catch (e) { 
        console.error('Radar cache load error:', e); 
    }
};

window.loadRadar = async function() {
    await window.loadRadarCache();
    renderRadarList();
};

function renderRadarList() {
    const el = $('rv-list');
    if (!el) return;
    if (!window.radarEntries.length) {
        el.innerHTML = '<div class="tbl-empty">No regulations in radar yet. Add a threat to trigger Heatmaps.</div>';
        return;
    }

    const sevClass = { CRITICAL:'b-red', HIGH:'b-yellow' };

    el.innerHTML = window.radarEntries.map((reg, i) => {
        let targets = [];
        if (reg.target_all) targets.push('All Architectures');
        if (reg.target_ext && reg.target_ext.length) targets.push(...reg.target_ext);
        if (reg.target_int && reg.target_int.length) targets.push(...reg.target_int);
        
        return `<div class="radar-entry">
            <div style="flex:1">
                <div class="radar-title">${window.esc(reg.title||'—')}</div>
                <div class="radar-meta">${window.esc(reg.jurisdiction||'—')} · Effective: ${window.esc(reg.effectiveDate||'—')}</div>
                <div style="font-size:9px; color:var(--gold); margin-top:6px; font-family:monospace;">TARGETS: [${window.esc(targets.join(', '))}]</div>
                ${reg.description ? `<div style="font-size:10px; color:var(--marble-dim); margin-top:4px;">${window.esc(reg.description)}</div>` : ''}
            </div>
            <div style="display:flex; flex-direction:column; align-items:flex-end; gap:8px; flex-shrink:0">
                <span class="badge ${sevClass[reg.severity]||'b-ghost'}">${window.esc(reg.severity||'—')}</span>
                <div class="radar-actions">
                    <button class="btn btn-ghost btn-sm" onclick="window.openRadarCMS(${i})">Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="window.deleteRadarEntry(${i})">Delete</button>
                </div>
            </div>
        </div>`;
    }).join('');
}

window.openRadarCMS = function(idx) {
    const modal = $('modal-radar-cms');
    const overlay = $('overlay');
    if (!modal) return;
    
    // Reset Form
    $('cms-reg-title').value = '';
    $('cms-reg-date').value = '';
    $('cms-reg-jur').value = 'Global';
    $('cms-reg-sev').value = 'HIGH';
    $('cms-reg-desc').value = '';
    $('cms-target-all').checked = false;
    qsa('.cms-ext, .cms-int').forEach(el => el.checked = false);
    
    // Load Data if Editing
    $('cms-reg-idx').value = idx;
    if (idx >= 0 && window.radarEntries[idx]) {
        const reg = window.radarEntries[idx];
        $('cms-reg-title').value = reg.title || '';
        $('cms-reg-date').value = reg.effectiveDate || '';
        $('cms-reg-jur').value = reg.jurisdiction || 'Global';
        $('cms-reg-sev').value = reg.severity || 'HIGH';
        $('cms-reg-desc').value = reg.description || '';
        
        if (reg.target_all) $('cms-target-all').checked = true;
        if (reg.target_ext) reg.target_ext.forEach(val => { const cb = document.querySelector(`.cms-ext[value="${val}"]`); if (cb) cb.checked = true; });
        if (reg.target_int) reg.target_int.forEach(val => { const cb = document.querySelector(`.cms-int[value="${val}"]`); if (cb) cb.checked = true; });
    }
    
    overlay.classList.add('open');
    modal.style.display = 'flex';
};

window.saveRadarCMS = async function() {
    const title = $('cms-reg-title').value.trim();
    if (!title) return window.toast ? window.toast('Law/Threat Title is required', 'error') : null;

    const entry = {
        title: title,
        effectiveDate: $('cms-reg-date').value,
        jurisdiction: $('cms-reg-jur').value,
        severity: $('cms-reg-sev').value,
        description: $('cms-reg-desc').value.trim(),
        target_all: $('cms-target-all').checked,
        target_ext: qsa('.cms-ext:checked').map(el => el.value),
        target_int: qsa('.cms-int:checked').map(el => el.value),
        addedAt: new Date().toISOString()
    };

    const idx = parseInt($('cms-reg-idx').value);
    const entries = [...window.radarEntries];
    
    if (idx >= 0) {
        entry.addedAt = entries[idx].addedAt || entry.addedAt; // Preserve original timestamp
        entries[idx] = entry;
    } else {
        entries.push(entry);
    }

    try {
        await window.db.collection('settings').doc('regulatory_radar').set({ 
            entries: entries,
            lastUpdated: new Date().toISOString()
        });
        window.radarEntries = entries;
        $('modal-radar-cms').style.display = 'none';
        $('overlay').classList.remove('open');
        renderRadarList();
        if(window.toast) window.toast('Threat Deployed to Matrix');
    } catch(e) {
        console.error(e);
        if(window.toast) window.toast('Failed to save threat', 'error');
    }
};

window.deleteRadarEntry = async function(idx) {
    if (!confirm('Permanently delete this regulation from the master database?')) return;
    const entries = window.radarEntries.filter((_, i) => i !== idx);
    try {
        await window.db.collection('settings').doc('regulatory_radar').set({ 
            entries: entries,
            lastUpdated: new Date().toISOString()
        });
        window.radarEntries = entries;
        renderRadarList();
        if(window.toast) window.toast('Regulation Deleted');
    } catch(e) { console.error(e); if(window.toast) window.toast('Delete failed', 'error'); }
};


// ════════════════════════════════════════════════════════════════════════
// ═════════ 3. SYNDICATE EXPOSURE MATRIX (V5 CROSS-REFERENCE) ════════════
// ════════════════════════════════════════════════════════════════════════
window.renderExposureMatrix = async function() {
    const tbodies = document.querySelectorAll('#rv-exposure-tbody');
    if (tbodies.length === 0) return;
    tbodies.forEach(tb => tb.innerHTML = '<tr><td colspan="6" class="loading">Calculating Threat Exposure…</td></tr>');
    
    try {
        const snap = await window.db.collection('clients').get();
        const clients = [];
        snap.forEach(d => clients.push({ id: d.id, ...d.data() }));

        const rows = clients.map(c => {
            let red = 0, yellow = 0;
            const b = c.baseline || {};
            const a = c.architecture || {};
            const scope = c.action_scopes || {};

            window.radarEntries.forEach(reg => {
                // 1. Check Jurisdiction
                const clientJur = (c.registrationJurisdiction || b.hq || '').toLowerCase();
                const regJur = (reg.jurisdiction || '').toLowerCase();
                const jurMatch = (regJur === 'global' || regJur === 'us-all' || (clientJur && clientJur.includes(regJur)));
                
                if (!jurMatch) return;

                // 2. Check Tripwires
                let isExposed = false;
                if (reg.target_all) {
                    isExposed = true;
                } else {
                    if (reg.target_ext?.includes('eu_users') && b.eu_users) isExposed = true;
                    if (reg.target_ext?.includes('ca_users') && b.ca_users) isExposed = true;
                    if (reg.target_ext?.includes('processes_pii') && a.processes_pii) isExposed = true;
                    if (reg.target_ext?.includes('sensitive_data') && (a.sensitive_health || a.sensitive_bio || a.sensitive_fin)) isExposed = true;
                    if (reg.target_ext?.includes('finetuning') && a.memory === 'finetuning') isExposed = true;
                    if (reg.target_ext?.includes('selfhosted') && a.models === 'selfhosted') isExposed = true;
                    
                    if (reg.target_int?.includes('is_doer') && scope.is_doer) isExposed = true;
                    if (reg.target_int?.includes('is_judge_hr') && scope.is_judge_hr) isExposed = true;
                    if (reg.target_int?.includes('is_judge_fin') && scope.is_judge_fin) isExposed = true;
                    if (reg.target_int?.includes('is_judge_legal') && scope.is_judge_legal) isExposed = true;
                    if (reg.target_int?.includes('is_companion') && scope.is_companion) isExposed = true;
                    if (reg.target_int?.includes('is_orchestrator') && scope.is_orchestrator) isExposed = true;
                }

                if (isExposed) {
                    if (c.maintenanceActive) yellow++; // Covered by shield
                    else red++; // Exposed Gap
                }
            });
            return { ...c, _red: red, _yellow: yellow };
        })
        .filter(c => c._red > 0 || c._yellow > 0)
        .sort((a,b) => b._red - a._red || b._yellow - a._yellow);

        const html = !rows.length 
          ? '<tr><td colspan="6" class="loading">No exposures detected — all client architectures are currently secure.</td></tr>'
          : rows.map(c => `
              <tr onclick="window.openDetail('${window.esc(c.id)}'); window.detailTab('gap');">
                <td>
                    <div style="font-size:11px;font-weight:600;">${window.esc(c.baseline?.company || c.name || c.id)}</div>
                </td>
                <td><span class="badge ${planBadgeClass(c.plan)}">${planLabel(c.plan)}</span></td>
                <td class="exp-flag-r">${c._red > 0 ? `🔴 ${c._red}` : '—'}</td>
                <td class="exp-flag-y">${c._yellow > 0 ? `🟡 ${c._yellow}` : '—'}</td>
                <td>${c.maintenanceActive ? '<span class="badge b-delivered">Active</span>' : '<span class="badge b-ghost">None</span>'}</td>
                <td onclick="event.stopPropagation()">
                  <button class="btn btn-primary btn-sm" onclick="window.openDetail('${window.esc(c.id)}'); window.detailTab('gap');">Gap Review</button>
                </td>
              </tr>`).join('');
              
        tbodies.forEach(tb => tb.innerHTML = html);
    } catch(e) {
        console.error(e);
        tbodies.forEach(tb => tb.innerHTML = '<tr><td colspan="6" class="loading" style="color:#d47a7a">Database Error</td></tr>');
    }
};


// ════════════════════════════════════════════════════════════════════════
// ═════════ 4. CONTENT ENGINE ════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
window.loadContent = async function() {
  const tbodies = document.querySelectorAll('#ct-tbody');
  tbodies.forEach(tb => tb.innerHTML = '<tr><td colspan="5" class="loading">Loading…</td></tr>');
  try {
    const snap = await window.db.collection('content').orderBy('createdAt','desc').get();
    window.allContent = [];
    snap.forEach(d => window.allContent.push({ id: d.id, ...d.data() }));
    renderContent(window.allContent);
  } catch(e) {
    console.error(e);
    tbodies.forEach(tb => tb.innerHTML = '<tr><td colspan="5" class="loading" style="color:#d47a7a">Failed to load</td></tr>');
  }
};

function renderContent(list) {
  const tbodies = document.querySelectorAll('#ct-tbody');
  if (tbodies.length === 0) return;
  const sClass = { Idea:'b-ghost', Drafting:'b-cold', Scheduled:'b-intake', Posted:'b-delivered', Archived:'b-dead' };
  
  const html = !list.length 
    ? '<tr><td colspan="5" class="loading">No content logged</td></tr>'
    : list.map(c => `
        <tr>
          <td>${window.esc(c.topic||'—')}</td>
          <td><span class="badge ${sClass[c.status]||'b-ghost'}">${window.esc(c.status||'—')}</span></td>
          <td class="dim">${window.esc(c.postedDate||'—')}</td>
          <td class="dim">${window.esc(c.notes||'—')}</td>
          <td onclick="event.stopPropagation()" style="white-space:nowrap">
            <button class="btn btn-ghost btn-sm" onclick="window.openEditContent('${window.esc(c.id)}')">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="window.deleteContent('${window.esc(c.id)}')">Delete</button>
          </td>
        </tr>`).join('');
        
  tbodies.forEach(tb => tb.innerHTML = html);
}

function contentModalBody(c) {
  const s = c || {};
  const stats = ['Idea','Drafting','Scheduled','Posted','Archived'];
  return `
    <div class="fg"><label class="fl">Topic / Title</label>
      <input type="text" class="fi" id="ct-topic" value="${window.esc(s.topic||'')}" placeholder="Post topic…"></div>
    <div class="fi-row">
      <div class="fg"><label class="fl">Status</label>
        <select class="fi" id="ct-status-sel">
          ${stats.map(x => `<option ${s.status===x?'selected':''}>${x}</option>`).join('')}
        </select></div>
      <div class="fg"><label class="fl">Posted Date</label>
        <input type="date" class="fi" id="ct-date" value="${s.postedDate||''}"></div>
    </div>
    <div class="fg"><label class="fl">Notes</label>
      <textarea class="fi" id="ct-notes" rows="2">${window.esc(s.notes||'')}</textarea></div>`;
}

window.openAddContent = function() {
  if(typeof window.openModal !== 'function') return;
  window.openModal('Add Content', contentModalBody(null), `
    <button class="btn btn-outline btn-sm" onclick="window.closeModal()">Cancel</button>
    <button class="btn btn-primary btn-sm" onclick="window.saveContent(null)">Add</button>
  `);
};

window.openEditContent = function(id) {
  const c = window.allContent.find(x => x.id === id);
  if (!c) return;
  window.openModal('Edit Content', contentModalBody(c), `
    <button class="btn btn-outline btn-sm" onclick="window.closeModal()">Cancel</button>
    <button class="btn btn-primary btn-sm" onclick="window.saveContent('${id}')">Save</button>
  `);
};

window.saveContent = async function(id) {
  const data = {
    topic:      $('ct-topic')?.value?.trim()  || '',
    status:     $('ct-status-sel')?.value     || 'Idea',
    postedDate: $('ct-date')?.value           || '',
    notes:      $('ct-notes')?.value?.trim()  || '',
    updatedAt:  new Date().toISOString()
  };
  if (!data.topic) { if(window.toast) window.toast('Topic is required', 'error'); return; }
  try {
    if (id) {
      await window.db.collection('content').doc(id).set(data, { merge: true });
      const idx = window.allContent.findIndex(c => c.id === id);
      if (idx !== -1) window.allContent[idx] = { ...window.allContent[idx], ...data };
    } else {
      data.createdAt = new Date().toISOString();
      const ref = await window.db.collection('content').add(data);
      window.allContent.unshift({ id: ref.id, ...data });
    }
    if(window.closeModal) window.closeModal();
    renderContent(window.allContent);
    if(window.toast) window.toast('Content saved');
  } catch(e) { console.error(e); if(window.toast) window.toast('Save failed', 'error'); }
};

window.deleteContent = async function(id) {
  if (!confirm('Delete this entry?')) return;
  try {
    await window.db.collection('content').doc(id).delete();
    window.allContent = window.allContent.filter(c => c.id !== id);
    renderContent(window.allContent);
    if(window.toast) window.toast('Deleted');
  } catch(e) { console.error(e); if(window.toast) window.toast('Delete failed', 'error'); }
};


// ════════════════════════════════════════════════════════════════════════
// ═════════ 5. SETTINGS & ADMIN CONTROL ══════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
window.loadSettings = async function() {
  try {
    const snap = await window.db.collection('settings').doc('config').get();
    if (snap.exists) {
      const d = snap.data();
      setVal('wh-s2',      d.webhookS2    || '');
      setVal('wh-s3',      d.webhookS3    || '');
      setVal('wh-s4',      d.webhookS4    || '');
      setVal('s-capacity', d.capacityCap  || 10);
    }
    await window.loadAdmins();
  } catch(e) { console.error(e); if(window.toast) window.toast('Settings load failed', 'error'); }
};

window.saveSettings = async function() {
  const data = {
    webhookS2:   $('wh-s2')?.value?.trim()       || '',
    webhookS3:   $('wh-s3')?.value?.trim()       || '',
    webhookS4:   $('wh-s4')?.value?.trim()       || '',
    capacityCap: parseInt($('s-capacity')?.value) || 10,
    updatedAt:   new Date().toISOString()
  };
  try {
    await window.db.collection('settings').doc('config').set(data, { merge: true });
    if(window.toast) window.toast('Settings saved');
  } catch(e) { console.error(e); if(window.toast) window.toast('Save failed', 'error'); }
};

window.loadAdmins = async function() {
  const tbodies = document.querySelectorAll('#s-admins');
  if (tbodies.length === 0) return;
  try {
    const snap = await window.db.collection('admins').get();
    const admins = []; snap.forEach(d => admins.push({ id: d.id, ...d.data() }));
    const html = admins.length ? admins.map(a => `
        <tr>
            <td>${window.esc(a.id)}</td>
            <td class="dim" style="font-size:9px;">${window.esc((a.permissions||[]).join(', '))}</td>
            <td onclick="event.stopPropagation()"><button class="btn btn-danger btn-sm" onclick="window.removeAdmin('${window.esc(a.id)}')">Remove</button></td>
        </tr>`).join('') : '<tr><td colspan="3" class="loading">No admins</td></tr>';
    tbodies.forEach(tb => tb.innerHTML = html);
  } catch(e) { console.error(e); }
};

window.addAdmin = async function() {
  const email = $('s-new-admin')?.value?.trim().toLowerCase();
  const perms = Array.from(document.querySelectorAll('.adm-perm-chk:checked')).map(el => el.value);
  
  if (!email) return window.toast ? window.toast('Enter an email', 'error') : null;
  if (perms.length === 0) return window.toast ? window.toast('Select at least one permission phase', 'error') : null;
  
  try {
    await window.db.collection('admins').doc(email).set({ 
        permissions: perms, 
        addedAt: new Date().toISOString() 
    });
    
    if ($('s-new-admin')) $('s-new-admin').value = '';
    document.querySelectorAll('.adm-perm-chk').forEach(el => el.checked = false);
    
    await window.loadAdmins();
    if(window.toast) window.toast(`${email} added with custom access.`);
  } catch(e) { console.error(e); }
};

window.removeAdmin = async function(email) {
  if (!confirm(`Remove ${email}?`)) return;
  try {
    await window.db.collection('admins').doc(email).delete();
    await window.loadAdmins();
    if(window.toast) window.toast(`${email} removed.`);
  } catch(e) { console.error(e); }
};
