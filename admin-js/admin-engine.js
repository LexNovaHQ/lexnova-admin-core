// ════════════════════════════════════════════════════════════════════════
// ═════════ LEX NOVA ADMIN: ENGINE ROOM (admin-engine.js) ════════════════
// ════════════════════════════════════════════════════════════════════════
'use strict';

var PLANS = { agentic_shield: 'Agentic Shield', workplace_shield: 'Workplace Shield', complete_stack: 'Complete Stack', flagship: 'Flagship' };
var PLAN_PRICES = { agentic_shield: 997, workplace_shield: 997, complete_stack: 2500, flagship: 15000 };
window.planLabel = function(k) { return PLANS[k] || k; };
window.planBadgeClass = function(p) { return { agentic_shield:'b-intake', workplace_shield:'b-warm', complete_stack:'b-production', flagship:'b-hot' }[p] || 'b-ghost'; };

window.allContent = [];
window.radarEntries = [];

window.setEngineView = function(view, el) {
    window.qsa('#tab-engine .view-btn').forEach(b => b.classList.remove('active'));
    if (el) el.classList.add('active');
    ['finance','radar','content','settings'].forEach(v => {
        const section = window.$('ev-' + v);
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
    window.loadFinance(); 
};

window.loadFinance = async function() {
  try {
    const snap = await window.db.collection('clients').get();
    const clients = []; snap.forEach(d => clients.push({ id: d.id, ...d.data() }));

    const paid  = clients.filter(c => c.status !== 'pending_payment');
    const maint = clients.filter(c => c.maintenanceActive);
    const mrr   = maint.length * 297;
    const total = paid.reduce((s,c) => s + (c.price || PLAN_PRICES[c.plan] || 0), 0);
    const avg   = paid.length ? Math.round(total / paid.length) : 0;

    window.setText('fin-mrr',       window.fmtMoney(mrr));
    window.setText('fin-mrr-sub',   `${maint.length} maintenance subscriptions`);
    window.setText('fin-arr',       window.fmtMoney(mrr * 12));
    window.setText('fin-total',     window.fmtMoney(total));
    window.setText('fin-total-sub', `${paid.length} paid clients`);
    window.setText('fin-avg',       window.fmtMoney(avg));

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
            <td><span class="badge ${window.planBadgeClass(k)}">${window.planLabel(k)}</span></td>
            <td>${v.count}</td>
            <td>${window.fmtMoney(v.rev)}</td>
            <td>${total > 0 ? Math.round(v.rev/total*100) + '%' : '—'}</td>
          </tr>`).join('')
        : '<tr><td colspan="4" class="loading">No paid clients yet</td></tr>';
      tbodies.forEach(tb => tb.innerHTML = html);
    }

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

window.loadRadarCache = async function() {
    try {
        const snap = await window.db.collection('settings').doc('regulatory_radar').get();
        window.radarEntries = snap.exists ? (snap.data().entries || snap.data().items || []) : [];
    } catch (e) { console.error('Radar cache load error:', e); }
};

window.loadRadar = async function() {
    await window.loadRadarCache();
    window.renderRadarList();
};

window.renderRadarList = function() {
    const el = window.$('rv-list');
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
};

window.openRadarCMS = function(idx) {
    const modal = window.$('modal-radar-cms');
    const overlay = window.$('overlay');
    if (!modal) return;
    
    window.$('cms-reg-title').value = '';
    window.$('cms-reg-date').value = '';
    window.$('cms-reg-jur').value = 'Global';
    window.$('cms-reg-sev').value = 'HIGH';
    window.$('cms-reg-desc').value = '';
    window.$('cms-target-all').checked = false;
    window.qsa('.cms-ext, .cms-int').forEach(el => el.checked = false);
    
    window.$('cms-reg-idx').value = idx;
    if (idx >= 0 && window.radarEntries[idx]) {
        const reg = window.radarEntries[idx];
        window.$('cms-reg-title').value = reg.title || '';
        window.$('cms-reg-date').value = reg.effectiveDate || '';
        window.$('cms-reg-jur').value = reg.jurisdiction || 'Global';
        window.$('cms-reg-sev').value = reg.severity || 'HIGH';
        window.$('cms-reg-desc').value = reg.description || '';
        
        if (reg.target_all) window.$('cms-target-all').checked = true;
        if (reg.target_ext) reg.target_ext.forEach(val => { const cb = document.querySelector(`.cms-ext[value="${val}"]`); if (cb) cb.checked = true; });
        if (reg.target_int) reg.target_int.forEach(val => { const cb = document.querySelector(`.cms-int[value="${val}"]`); if (cb) cb.checked = true; });
    }
    
    // Explicitly rip off the 'hidden' class and force display
    overlay.classList.add('open');
    overlay.style.display = 'block';
    
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
};

window.saveRadarCMS = async function() {
    const title = window.$('cms-reg-title').value.trim();
    if (!title) return window.toast ? window.toast('Law/Threat Title is required', 'error') : null;

    const entry = {
        title: title,
        effectiveDate: window.$('cms-reg-date').value,
        jurisdiction: window.$('cms-reg-jur').value,
        severity: window.$('cms-reg-sev').value,
        description: window.$('cms-reg-desc').value.trim(),
        target_all: window.$('cms-target-all').checked,
        target_ext: window.qsa('.cms-ext:checked').map(el => el.value),
        target_int: window.qsa('.cms-int:checked').map(el => el.value),
        addedAt: new Date().toISOString()
    };

    const idx = parseInt(window.$('cms-reg-idx').value);
    const entries = [...window.radarEntries];
    
    if (idx >= 0) {
        entry.addedAt = entries[idx].addedAt || entry.addedAt; 
        entries[idx] = entry;
    } else {
        entries.push(entry);
    }

    try {
        await window.db.collection('settings').doc('regulatory_radar').set({ entries: entries, lastUpdated: new Date().toISOString() });
        window.radarEntries = entries;
        window.$('modal-radar-cms').style.display = 'none';
        window.$('overlay').classList.remove('open');
        window.renderRadarList();
        if(window.toast) window.toast('Threat Deployed to Matrix');
    } catch(e) { console.error(e); if(window.toast) window.toast('Failed to save threat', 'error'); }
};

window.deleteRadarEntry = async function(idx) {
    if (!confirm('Permanently delete this regulation from the master database?')) return;
    const entries = window.radarEntries.filter((_, i) => i !== idx);
    try {
        await window.db.collection('settings').doc('regulatory_radar').set({ entries: entries, lastUpdated: new Date().toISOString() });
        window.radarEntries = entries;
        window.renderRadarList();
        if(window.toast) window.toast('Regulation Deleted');
    } catch(e) { console.error(e); if(window.toast) window.toast('Delete failed', 'error'); }
};

window.renderExposureMatrix = async function() {
    const tbodies = document.querySelectorAll('#rv-exposure-tbody');
    if (tbodies.length === 0) return;
    tbodies.forEach(tb => tb.innerHTML = '<tr><td colspan="6" class="loading">Calculating Threat Exposure…</td></tr>');
    
    try {
        const snap = await window.db.collection('clients').get();
        const clients = []; snap.forEach(d => clients.push({ id: d.id, ...d.data() }));

        const rows = clients.map(c => {
            let red = 0, yellow = 0;
            const b = c.baseline || {}; const a = c.architecture || {}; const scope = c.action_scopes || {};
            window.radarEntries.forEach(reg => {
                const clientJur = (c.registrationJurisdiction || b.hq || '').toLowerCase();
                const regJur = (reg.jurisdiction || '').toLowerCase();
                const jurMatch = (regJur === 'global' || regJur === 'us-all' || (clientJur && clientJur.includes(regJur)));
                if (!jurMatch) return;

                let isExposed = false;
                if (reg.target_all) isExposed = true;
                else {
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
                if (isExposed) { if (c.maintenanceActive) yellow++; else red++; }
            });
            return { ...c, _red: red, _yellow: yellow };
        }).filter(c => c._red > 0 || c._yellow > 0).sort((a,b) => b._red - a._red || b._yellow - a._yellow);

        const html = !rows.length ? '<tr><td colspan="6" class="loading">No exposures detected — all client architectures are currently secure.</td></tr>'
          : rows.map(c => `<tr onclick="window.openDetail('${window.esc(c.id)}'); window.detailTab('gap');">
                <td><div style="font-size:11px;font-weight:600;">${window.esc(c.baseline?.company || c.name || c.id)}</div></td>
                <td><span class="badge ${window.planBadgeClass(c.plan)}">${window.planLabel(c.plan)}</span></td>
                <td class="exp-flag-r">${c._red > 0 ? `🔴 ${c._red}` : '—'}</td>
                <td class="exp-flag-y">${c._yellow > 0 ? `🟡 ${c._yellow}` : '—'}</td>
                <td>${c.maintenanceActive ? '<span class="badge b-delivered">Active</span>' : '<span class="badge b-ghost">None</span>'}</td>
                <td onclick="event.stopPropagation()"><button class="btn btn-primary btn-sm" onclick="window.openDetail('${window.esc(c.id)}'); window.detailTab('gap');">Gap Review</button></td>
              </tr>`).join('');
        tbodies.forEach(tb => tb.innerHTML = html);
    } catch(e) { tbodies.forEach(tb => tb.innerHTML = '<tr><td colspan="6" class="loading" style="color:#d47a7a">Database Error</td></tr>'); }
};

window.loadContent = async function() {
  const tbodies = document.querySelectorAll('#ct-tbody');
  tbodies.forEach(tb => tb.innerHTML = '<tr><td colspan="5" class="loading">Loading…</td></tr>');
  try {
    const snap = await window.db.collection('content').orderBy('createdAt','desc').get();
    window.allContent = []; snap.forEach(d => window.allContent.push({ id: d.id, ...d.data() }));
    window.renderContent(window.allContent);
  } catch(e) { tbodies.forEach(tb => tb.innerHTML = '<tr><td colspan="5" class="loading" style="color:#d47a7a">Failed to load</td></tr>'); }
};

window.renderContent = function(list) {
  const tbodies = document.querySelectorAll('#ct-tbody');
  if (tbodies.length === 0) return;
  const sClass = { Idea:'b-ghost', Drafting:'b-cold', Scheduled:'b-intake', Posted:'b-delivered', Archived:'b-dead' };
  const html = !list.length ? '<tr><td colspan="5" class="loading">No content logged</td></tr>'
    : list.map(c => `<tr><td>${window.esc(c.topic||'—')}</td><td><span class="badge ${sClass[c.status]||'b-ghost'}">${window.esc(c.status||'—')}</span></td>
          <td class="dim">${window.esc(c.postedDate||'—')}</td><td class="dim">${window.esc(c.notes||'—')}</td>
          <td onclick="event.stopPropagation()" style="white-space:nowrap"><button class="btn btn-ghost btn-sm" onclick="window.openEditContent('${window.esc(c.id)}')">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="window.deleteContent('${window.esc(c.id)}')">Delete</button></td></tr>`).join('');
  tbodies.forEach(tb => tb.innerHTML = html);
};

window.contentModalBody = function(c) {
  const s = c || {}; const stats = ['Idea','Drafting','Scheduled','Posted','Archived'];
  return `<div class="fg"><label class="fl">Topic / Title</label><input type="text" class="fi" id="ct-topic" value="${window.esc(s.topic||'')}" placeholder="Post topic…"></div>
    <div class="fi-row"><div class="fg"><label class="fl">Status</label><select class="fi" id="ct-status-sel">${stats.map(x => `<option ${s.status===x?'selected':''}>${x}</option>`).join('')}</select></div>
    <div class="fg"><label class="fl">Posted Date</label><input type="date" class="fi" id="ct-date" value="${s.postedDate||''}"></div></div>
    <div class="fg"><label class="fl">Notes</label><textarea class="fi" id="ct-notes" rows="2">${window.esc(s.notes||'')}</textarea></div>`;
};

window.openAddContent = function() {
  if(typeof window.openModal !== 'function') return;
  window.openModal('Add Content', window.contentModalBody(null), `<button class="btn btn-outline btn-sm" onclick="window.closeModal()">Cancel</button><button class="btn btn-primary btn-sm" onclick="window.saveContent(null)">Add</button>`);
};

window.openEditContent = function(id) {
  const c = window.allContent.find(x => x.id === id); if (!c) return;
  window.openModal('Edit Content', window.contentModalBody(c), `<button class="btn btn-outline btn-sm" onclick="window.closeModal()">Cancel</button><button class="btn btn-primary btn-sm" onclick="window.saveContent('${id}')">Save</button>`);
};

window.saveContent = async function(id) {
  const data = { topic: window.$('ct-topic')?.value?.trim() || '', status: window.$('ct-status-sel')?.value || 'Idea', postedDate: window.$('ct-date')?.value || '', notes: window.$('ct-notes')?.value?.trim() || '', updatedAt: new Date().toISOString() };
  if (!data.topic) { if(window.toast) window.toast('Topic is required', 'error'); return; }
  try {
    if (id) { await window.db.collection('content').doc(id).set(data, { merge: true }); const idx = window.allContent.findIndex(c => c.id === id); if (idx !== -1) window.allContent[idx] = { ...window.allContent[idx], ...data }; } 
    else { data.createdAt = new Date().toISOString(); const ref = await window.db.collection('content').add(data); window.allContent.unshift({ id: ref.id, ...data }); }
    if(window.closeModal) window.closeModal(); window.renderContent(window.allContent); if(window.toast) window.toast('Content saved');
  } catch(e) { console.error(e); if(window.toast) window.toast('Save failed', 'error'); }
};

window.deleteContent = async function(id) {
  if (!confirm('Delete this entry?')) return;
  try { await window.db.collection('content').doc(id).delete(); window.allContent = window.allContent.filter(c => c.id !== id); window.renderContent(window.allContent); if(window.toast) window.toast('Deleted'); } catch(e) { console.error(e); }
};

window.loadSettings = async function() {
  try {
    const snap = await window.db.collection('settings').doc('config').get();
    if (snap.exists) { const d = snap.data(); window.setVal('wh-s2', d.webhookS2 || ''); window.setVal('wh-s3', d.webhookS3 || ''); window.setVal('wh-s4', d.webhookS4 || ''); window.setVal('s-capacity', d.capacityCap || 10); }
    await window.loadAdmins();
  } catch(e) { console.error(e); }
};

window.saveSettings = async function() {
  const data = { webhookS2: window.$('wh-s2')?.value?.trim() || '', webhookS3: window.$('wh-s3')?.value?.trim() || '', webhookS4: window.$('wh-s4')?.value?.trim() || '', capacityCap: parseInt(window.$('s-capacity')?.value) || 10, updatedAt: new Date().toISOString() };
  try { await window.db.collection('settings').doc('config').set(data, { merge: true }); if(window.toast) window.toast('Settings saved'); } catch(e) { console.error(e); }
};

window.loadAdmins = async function() {
  const tbodies = document.querySelectorAll('#s-admins'); if (tbodies.length === 0) return;
  try {
    const snap = await window.db.collection('admins').get();
    const admins = []; snap.forEach(d => admins.push({ id: d.id, ...d.data() }));
    const html = admins.length ? admins.map(a => `<tr><td>${window.esc(a.id)}</td><td class="dim" style="font-size:9px;">${window.esc((a.permissions||[]).join(', '))}</td><td onclick="event.stopPropagation()"><button class="btn btn-danger btn-sm" onclick="window.removeAdmin('${window.esc(a.id)}')">Remove</button></td></tr>`).join('') : '<tr><td colspan="3" class="loading">No admins</td></tr>';
    tbodies.forEach(tb => tb.innerHTML = html);
  } catch(e) { console.error(e); }
};

window.addAdmin = async function() {
  const email = window.$('s-new-admin')?.value?.trim().toLowerCase();
  const perms = Array.from(document.querySelectorAll('.adm-perm-chk:checked')).map(el => el.value);
  if (!email) return window.toast ? window.toast('Enter an email', 'error') : null;
  if (perms.length === 0) return window.toast ? window.toast('Select at least one permission phase', 'error') : null;
  try {
    await window.db.collection('admins').doc(email).set({ permissions: perms, addedAt: new Date().toISOString() });
    if (window.$('s-new-admin')) window.$('s-new-admin').value = '';
    document.querySelectorAll('.adm-perm-chk').forEach(el => el.checked = false);
    await window.loadAdmins(); if(window.toast) window.toast(`${email} added.`);
  } catch(e) { console.error(e); }
};

window.removeAdmin = async function(email) {
  if (!confirm(`Remove ${email}?`)) return;
  try { await window.db.collection('admins').doc(email).delete(); await window.loadAdmins(); if(window.toast) window.toast(`${email} removed.`); } catch(e) { console.error(e); }
};
