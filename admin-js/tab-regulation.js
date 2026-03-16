// ════════════════════════════════════════════════════════════════════════
// ═════════ LEX NOVA ADMIN: REGULATION DB (tab-regulation.js) ════════════
// ════════════════════════════════════════════════════════════════════════
// ADMIN.HTML PATCHES REQUIRED — add these to admin.html:
//
//  1. SIDEBAR NAV (between Syndicate and Engine Room sections):
//     <div class="sb-section">Intelligence</div>
//     <div class="nav-item" data-tab="regulation" onclick="if(typeof window.nav==='function')window.nav('regulation')">
//       <span class="nav-icon">📋</span> Regulation DB
//     </div>
//
//  2. TAB CONTENT DIV (inside #main, with other tab-content divs):
//     <div id="tab-regulation" class="tab-content"></div>
//
//  3. SETTINGS TAB — add Case Study URL field inside ev-settings:
//     <div class="fg"><label class="fl">Case Study Video URL (Standard)</label>
//     <input type="text" id="s-case-study" class="fi" placeholder="https://..."></div>
//
// ADMIN-CORE.JS PATCHES REQUIRED:
//  1. Add to headers object in nav():
//     'regulation':{ title:'Regulation DB', sub:'Master threat registry — 81 Lane A entries + Lane B.' }
//  2. Add to nav() routing:
//     if(tabId==='regulation' && typeof window.loadRegulation==='function') window.loadRegulation();
//  3. Add to init():
//     if(typeof window.loadRegulation==='function') window.loadRegulation();
// ════════════════════════════════════════════════════════════════════════
'use strict';

// ── STATE ──────────────────────────────────────────────────────────────
window.regulationEntries = [];
var regBuilt  = false;
var editingIdx = -1; // -1 = new entry

// ── INT/EXT taxonomy for the form ──────────────────────────────────────
const INT_OPTIONS = [
    { code:'UNIVERSAL', label:'UNIVERSAL — Applies to All Architectures' },
    { code:'INT.01',    label:'INT.01 — The Doer (Autonomous Actions)' },
    { code:'INT.02',    label:'INT.02 — The Orchestrator (API Gateway)' },
    { code:'INT.03',    label:'INT.03 — The Creator (Gen AI / Media)' },
    { code:'INT.04',    label:'INT.04 — The Companion (Social / Emotional AI)' },
    { code:'INT.05',    label:'INT.05 — The Reader (RAG / Data Ingestion)' },
    { code:'INT.06',    label:'INT.06 — The Translator (Biometrics / Voice)' },
    { code:'INT.07',    label:'INT.07 — The Judge (Predictive / HR / Scoring)' },
    { code:'INT.08',    label:'INT.08 — The Shield (Cyber Defense)' },
    { code:'INT.09',    label:'INT.09 — The Optimizer (Infrastructure / HFT)' },
    { code:'INT.10',    label:'INT.10 — The Mover (Robotics / Physical AI)' },
];

const EXT_OPTIONS = [
    { code:'EXT.01', label:'EXT.01 — EU/UK Jurisdiction' },
    { code:'EXT.02', label:'EXT.02 — California' },
    { code:'EXT.03', label:'EXT.03 — PII Processing' },
    { code:'EXT.04', label:'EXT.04 — Sensitive / Biometric Surface' },
    { code:'EXT.05', label:'EXT.05 — Financial Surface' },
    { code:'EXT.06', label:'EXT.06 — Minor Surface' },
    { code:'EXT.07', label:'EXT.07 — Employment Surface' },
    { code:'EXT.08', label:'EXT.08 — Consumer Public (B2C)' },
    { code:'EXT.09', label:'EXT.09 — Enterprise Private (B2B)' },
    { code:'EXT.10', label:'EXT.10 — Infrastructure Risk (API Wrappers)' },
];

const SEV_OPTIONS   = ['NUCLEAR','CRITICAL','HIGH','MEDIUM'];
const STAT_OPTIONS  = ['Active','Upcoming','Pending','Settlement Pending','Repealed'];
const VEL_OPTIONS   = ['Active Now','Immediate','High','Nuclear'];

// ── Badge helpers ──────────────────────────────────────────────────────
function sevBadge(s) {
    const cls={NUCLEAR:'b-red',CRITICAL:'b-red',HIGH:'b-yellow',MEDIUM:'b-ghost',LOW:'b-ghost'}[s]||'b-ghost';
    return `<span class="badge ${cls}" style="${s==='NUCLEAR'?'border-color:#ef4444;color:#ef4444':''}">${window.esc(s||'—')}</span>`;
}
function statBadge(s) {
    const cls={Active:'b-delivered',Upcoming:'b-warm',Pending:'b-intake','Settlement Pending':'b-hot',Repealed:'b-dead'}[s]||'b-ghost';
    return `<span class="badge ${cls}">${window.esc(s||'—')}</span>`;
}
function nowTs() { return new Date().toISOString(); }

// ════════════════════════════════════════════════════════════════════════
// ═════════ ENTRY POINT ════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
window.loadRegulation = async function() {
    if (!regBuilt) { buildRegulationHTML(); regBuilt=true; }
    await fetchRegulationEntries();
    renderRegulationTable(window.regulationEntries);
};

async function fetchRegulationEntries() {
    try {
        const snap = await window.db.collection('settings').doc('regulatory_radar').get();
        window.regulationEntries = snap.exists ? (snap.data().entries||snap.data().items||[]) : [];
        window.radarEntries = window.regulationEntries; // keep cache in sync
        updateRegCount();
    } catch(e) { console.error('Regulation fetch error:',e); }
}

async function saveAllEntries() {
    await window.db.collection('settings').doc('regulatory_radar').set({
        entries: window.regulationEntries,
        lastUpdated: nowTs()
    });
    window.radarEntries = window.regulationEntries;
    updateRegCount();
}

function updateRegCount() {
    const el = window.$('reg-count');
    if (el) el.textContent = window.regulationEntries.length + ' entries';
}

// ════════════════════════════════════════════════════════════════════════
// ═════════ SCAFFOLD HTML ══════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
function buildRegulationHTML() {
    const tab = window.$('tab-regulation');
    if (!tab) return;

    tab.innerHTML = `
    <!-- Top Bar -->
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:20px;">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <input type="text" class="fi" id="reg-search" placeholder="Search threats…" oninput="window.filterRegulations()" style="width:260px;">
            <select class="fi" id="reg-filter-sev" onchange="window.filterRegulations()" style="width:140px;">
                <option value="">All Severities</option>
                ${SEV_OPTIONS.map(s=>`<option>${s}</option>`).join('')}
            </select>
            <select class="fi" id="reg-filter-stat" onchange="window.filterRegulations()" style="width:140px;">
                <option value="">All Statuses</option>
                ${STAT_OPTIONS.map(s=>`<option>${s}</option>`).join('')}
            </select>
            <select class="fi" id="reg-filter-int" onchange="window.filterRegulations()" style="width:180px;">
                <option value="">INT Trigger: All</option>
                ${INT_OPTIONS.map(o=>`<option value="${o.code}">${o.code}</option>`).join('')}
            </select>
            <select class="fi" id="reg-filter-ext" onchange="window.filterRegulations()" style="width:180px;">
                <option value="">EXT Trigger: All</option>
                ${EXT_OPTIONS.map(o=>`<option value="${o.code}">${o.code}</option>`).join('')}
            </select>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
            <span id="reg-count" style="font-size:10px;color:var(--marble-dim);">— entries</span>
            <button class="btn btn-outline btn-sm" onclick="window.openImportPanel()">⬆ Import CSV</button>
            <button class="btn btn-primary"        onclick="window.openRegForm(-1)">+ Add Threat</button>
        </div>
    </div>

    <!-- Import Panel (hidden by default) -->
    <div id="reg-import-panel" style="display:none;background:var(--surface);border:1px solid var(--border2);padding:20px;margin-bottom:20px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
            <div style="font-size:10px;color:var(--gold);text-transform:uppercase;letter-spacing:.15em;font-weight:700;">Import Regulation Registry (TSV / CSV)</div>
            <button class="btn btn-ghost btn-sm" onclick="window.closeImportPanel()">✕ Close</button>
        </div>
        <div style="font-size:11px;color:var(--marble-dim);margin-bottom:12px;line-height:1.6;">
            Accepts the Lex Nova registry format: tab-separated, 11 columns.<br>
            <span style="font-family:monospace;font-size:9px;color:var(--marble-faint)">Threat_ID | Founder_Threat | Legal_Ammo | Int_Trigger | Ext_Trigger | Effective_Date | Status | Velocity | Severity | The_Pain | The_Fix</span><br>
            Lines starting with <code style="font-size:9px">//</code> are treated as comments and skipped. Threat_ID is preserved from file; blank IDs are auto-generated.
        </div>
        <div id="reg-drop-zone" style="border:2px dashed var(--border2);padding:32px;text-align:center;margin-bottom:12px;cursor:pointer;transition:border-color .2s;"
            onclick="window.$('reg-file-input').click()"
            ondragover="event.preventDefault();this.style.borderColor='var(--gold)'"
            ondragleave="this.style.borderColor='var(--border2)'"
            ondrop="event.preventDefault();this.style.borderColor='var(--border2)';window.handleRegDrop(event)">
            <div style="font-size:12px;color:var(--marble-dim);">Drop TSV file here, or click to browse</div>
            <div style="font-size:10px;color:var(--marble-faint);margin-top:6px;">Accepts .txt, .tsv, .csv</div>
        </div>
        <input type="file" id="reg-file-input" accept=".txt,.tsv,.csv" style="display:none" onchange="window.handleRegFileInput(this)">
        <div style="margin-bottom:10px;">
            <label class="fl">Or paste TSV content directly:</label>
            <textarea class="fi" id="reg-paste-input" rows="5" placeholder="Paste tab-separated content here…"></textarea>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
            <button class="btn btn-outline" onclick="window.previewImport()">Preview Import</button>
            <button class="btn btn-primary" id="reg-import-btn" style="display:none" onclick="window.executeImport()">Import All Entries</button>
            <span id="reg-import-status" style="font-size:11px;color:var(--marble-dim);"></span>
        </div>
        <div id="reg-import-preview" style="margin-top:14px;"></div>
    </div>

    <!-- Main Table -->
    <div class="tbl-wrap" id="reg-table-wrap">
        <table>
            <thead>
                <tr>
                    <th style="width:90px">Threat ID</th>
                    <th>Title / Legal Ammo</th>
                    <th style="width:70px">Severity</th>
                    <th style="width:80px">Status</th>
                    <th style="width:80px">Velocity</th>
                    <th style="width:90px">Eff. Date</th>
                    <th>Triggers</th>
                    <th style="width:80px">Fix</th>
                    <th style="width:70px">Actions</th>
                </tr>
            </thead>
            <tbody id="reg-tbody"><tr><td colspan="9" class="loading">Loading…</td></tr></tbody>
        </table>
    </div>

    <!-- Entry Form Panel (slide-in from right, full height) -->
    <div id="reg-form-panel" style="display:none;position:fixed;top:0;right:0;bottom:0;width:560px;max-width:95vw;background:var(--surface);border-left:1px solid var(--border2);z-index:300;overflow-y:auto;box-shadow:-8px 0 32px rgba(0,0,0,.5);">
        <div style="padding:20px 24px 0;border-bottom:1px solid var(--border);position:sticky;top:0;background:var(--surface);z-index:1;">
            <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:16px;">
                <div id="reg-form-title" style="font-family:'Cormorant Garamond',serif;font-size:20px;color:var(--marble);">Add Threat</div>
                <button class="btn btn-ghost btn-sm" onclick="window.closeRegForm()">✕ Close</button>
            </div>
        </div>
        <div style="padding:20px 24px;" id="reg-form-body"></div>
    </div>
    <div id="reg-overlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:299;" onclick="window.closeRegForm()"></div>`;
}

// ════════════════════════════════════════════════════════════════════════
// ═════════ TABLE RENDER & FILTER ══════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
function renderRegulationTable(list) {
    const tb = window.$('reg-tbody');
    if (!tb) return;
    if (!list.length) { tb.innerHTML='<tr><td colspan="9" class="tbl-empty">No entries. Add a threat or import the registry.</td></tr>'; return; }

    tb.innerHTML = list.map((reg, i) => {
        const intT = (reg.intTriggers||reg.target_int||[]);
        const extT = (reg.extTriggers||reg.target_ext||[]);
        const triggerHtml = [
            ...intT.map(t=>`<span style="font-size:8px;color:${t==='UNIVERSAL'?'#7ab88a':'var(--gold)'};font-weight:700;margin-right:3px;">${window.esc(t)}</span>`),
            ...extT.map(t=>`<span style="font-size:8px;color:#60a5fa;font-weight:700;margin-right:3px;">${window.esc(t)}</span>`)
        ].join('');
        const realIdx = window.regulationEntries.indexOf(reg);
        return `<tr>
            <td style="font-family:monospace;font-size:9px;color:var(--marble-dim);">${window.esc(reg.threatId||'—')}</td>
            <td>
                <div style="font-size:11px;font-weight:600;color:var(--marble);margin-bottom:2px;">${window.esc(reg.title||reg.Founder_Threat||'—')}</div>
                ${reg.legalAmmo?`<div style="font-size:9px;color:var(--marble-faint);font-style:italic;">${window.esc(reg.legalAmmo)}</div>`:''}
                ${reg.thePain?`<div style="font-size:10px;color:var(--marble-dim);margin-top:3px;">${window.esc(reg.thePain.substring(0,80))}${reg.thePain.length>80?'…':''}</div>`:''}
            </td>
            <td>${sevBadge(reg.severity)}</td>
            <td>${statBadge(reg.status)}</td>
            <td style="font-size:9px;color:var(--marble-dim);">${window.esc(reg.velocity||'—')}</td>
            <td style="font-size:10px;color:var(--marble-dim);">${window.esc(reg.effectiveDate||'—')}</td>
            <td>${triggerHtml||'<span style="font-size:9px;color:var(--marble-faint)">—</span>'}</td>
            <td style="font-family:monospace;font-size:9px;color:var(--gold);">${window.esc(reg.theFix||'—')}</td>
            <td onclick="event.stopPropagation()" style="white-space:nowrap;">
                <button class="btn btn-ghost btn-sm" onclick="window.openRegForm(${realIdx})">Edit</button>
                <button class="btn btn-danger btn-sm" onclick="window.deleteRegEntry(${realIdx})">Del</button>
            </td>
        </tr>`;
    }).join('');
}

window.filterRegulations = function() {
    const s    = (window.$('reg-search')?.value||'').toLowerCase();
    const sev  = window.$('reg-filter-sev')?.value||'';
    const stat = window.$('reg-filter-stat')?.value||'';
    const intF = window.$('reg-filter-int')?.value||'';
    const extF = window.$('reg-filter-ext')?.value||'';

    const list = window.regulationEntries.filter(reg => {
        const intT = reg.intTriggers||reg.target_int||[];
        const extT = reg.extTriggers||reg.target_ext||[];
        if (s && ![(reg.title||''),(reg.legalAmmo||''),(reg.thePain||''),(reg.threatId||'')].some(v=>v.toLowerCase().includes(s))) return false;
        if (sev  && reg.severity !== sev)  return false;
        if (stat && reg.status !== stat)   return false;
        if (intF && !intT.includes(intF))  return false;
        if (extF && !extT.includes(extF))  return false;
        return true;
    });
    renderRegulationTable(list);
};

// ════════════════════════════════════════════════════════════════════════
// ═════════ ENTRY FORM ══════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
window.openRegForm = function(idx) {
    editingIdx = idx;
    const reg  = idx >= 0 ? window.regulationEntries[idx] : {};
    const panel = window.$('reg-form-panel');
    const ovl   = window.$('reg-overlay');
    const title = window.$('reg-form-title');
    if (!panel) return;

    if (title) title.textContent = idx >= 0 ? 'Edit Threat' : 'Add Threat';

    const intT = reg.intTriggers||reg.target_int||[];
    const extT = reg.extTriggers||reg.target_ext||[];

    const intCheckboxes = INT_OPTIONS.map(o =>
        `<label style="display:flex;align-items:center;gap:8px;font-size:11px;cursor:pointer;padding:4px 0;">
            <input type="checkbox" class="reg-int-chk" value="${o.code}" ${intT.includes(o.code)?'checked':''} style="accent-color:var(--gold);">
            <span style="${o.code==='UNIVERSAL'?'color:#7ab88a;font-weight:700':''}">${window.esc(o.label)}</span>
        </label>`).join('');

    const extCheckboxes = EXT_OPTIONS.map(o =>
        `<label style="display:flex;align-items:center;gap:8px;font-size:11px;cursor:pointer;padding:4px 0;">
            <input type="checkbox" class="reg-ext-chk" value="${o.code}" ${extT.includes(o.code)?'checked':''} style="accent-color:var(--gold);">
            <span>${window.esc(o.label)}</span>
        </label>`).join('');

    window.$('reg-form-body').innerHTML = `
    <div class="fg"><label class="fl">Threat ID <span style="color:var(--marble-faint);font-size:8px">(auto-generated if blank)</span></label>
        <input type="text" class="fi" id="rf-threat-id" value="${window.esc(reg.threatId||'')}" placeholder="Auto: LNR-26-001" style="font-family:monospace;">
    </div>

    <div class="fg"><label class="fl">Title / Founder Threat *</label>
        <input type="text" class="fi" id="rf-title" value="${window.esc(reg.title||reg.Founder_Threat||'')}" placeholder="e.g. Browsewrap Invalidity">
    </div>

    <div class="fg"><label class="fl">Legal Ammo (Case / Statute)</label>
        <input type="text" class="fi" id="rf-legal-ammo" value="${window.esc(reg.legalAmmo||'')}" placeholder="e.g. Specht v. Netscape (2002)">
    </div>

    <div class="fi-row">
        <div class="fg"><label class="fl">Severity *</label>
            <select class="fi" id="rf-severity">
                ${SEV_OPTIONS.map(s=>`<option value="${s}" ${(reg.severity||'HIGH')===s?'selected':''}>${s}</option>`).join('')}
            </select>
        </div>
        <div class="fg"><label class="fl">Status *</label>
            <select class="fi" id="rf-status">
                ${STAT_OPTIONS.map(s=>`<option value="${s}" ${(reg.status||'Active')===s?'selected':''}>${s}</option>`).join('')}
            </select>
        </div>
    </div>

    <div class="fi-row">
        <div class="fg"><label class="fl">Velocity</label>
            <select class="fi" id="rf-velocity">
                ${VEL_OPTIONS.map(s=>`<option value="${s}" ${(reg.velocity||'Immediate')===s?'selected':''}>${s}</option>`).join('')}
            </select>
        </div>
        <div class="fg"><label class="fl">Effective Date</label>
            <input type="text" class="fi" id="rf-eff-date" value="${window.esc(reg.effectiveDate||'')}" placeholder="YYYY-MM-DD or DD-MM-YYYY">
        </div>
    </div>

    <div class="fg"><label class="fl">The Pain (Business Consequence)</label>
        <textarea class="fi" id="rf-pain" rows="3">${window.esc(reg.thePain||reg.description||'')}</textarea>
    </div>

    <div class="fg"><label class="fl">The Fix (Document Reference)</label>
        <input type="text" class="fi" id="rf-fix" value="${window.esc(reg.theFix||'')}" placeholder="e.g. DOC_TOS §1.1">
    </div>

    <div style="background:var(--surface2);border:1px solid var(--border);padding:14px;margin-bottom:16px;">
        <div style="font-size:9px;color:var(--gold);text-transform:uppercase;letter-spacing:.12em;font-weight:700;margin-bottom:10px;">INT Triggers (Archetypes)</div>
        <div style="columns:2;column-gap:16px;">${intCheckboxes}</div>
    </div>

    <div style="background:var(--surface2);border:1px solid var(--border);padding:14px;margin-bottom:20px;">
        <div style="font-size:9px;color:var(--gold);text-transform:uppercase;letter-spacing:.12em;font-weight:700;margin-bottom:10px;">EXT Triggers (Regulatory Surfaces)</div>
        <div style="columns:2;column-gap:16px;">${extCheckboxes}</div>
    </div>

    <div style="display:flex;gap:10px;">
        <button class="btn btn-primary" style="flex:1;padding:14px;" onclick="window.saveRegEntry()">💾 Save Threat</button>
        <button class="btn btn-outline" onclick="window.closeRegForm()">Cancel</button>
    </div>
    ${idx>=0?`<div style="text-align:center;margin-top:16px;border-top:1px dashed rgba(138,58,58,.3);padding-top:14px;"><button class="btn btn-danger btn-sm" onclick="window.deleteRegEntry(${idx});window.closeRegForm()">Delete This Entry</button></div>`:''}`;

    panel.style.display = 'flex';
    panel.style.flexDirection = 'column';
    if (ovl) ovl.style.display = 'block';
};

window.closeRegForm = function() {
    const p = window.$('reg-form-panel');
    const o = window.$('reg-overlay');
    if (p) p.style.display = 'none';
    if (o) o.style.display = 'none';
    editingIdx = -1;
};

window.saveRegEntry = async function() {
    const title = window.$('rf-title')?.value?.trim();
    if (!title) { if(window.toast) window.toast('Title is required','error'); return; }

    const intT = Array.from(document.querySelectorAll('.reg-int-chk:checked')).map(el=>el.value);
    const extT = Array.from(document.querySelectorAll('.reg-ext-chk:checked')).map(el=>el.value);

    let threatId = window.$('rf-threat-id')?.value?.trim();
    if (!threatId) threatId = await genThreatId();

    const entry = {
        threatId,
        title,
        legalAmmo:     window.$('rf-legal-ammo')?.value?.trim()||'',
        severity:      window.$('rf-severity')?.value||'HIGH',
        status:        window.$('rf-status')?.value||'Active',
        velocity:      window.$('rf-velocity')?.value||'Immediate',
        effectiveDate: normalizeDate(window.$('rf-eff-date')?.value?.trim()||''),
        thePain:       window.$('rf-pain')?.value?.trim()||'',
        theFix:        window.$('rf-fix')?.value?.trim()||'',
        intTriggers:   intT,
        extTriggers:   extT,
        // Backwards compat fields for old exposure matrix
        target_all:    intT.includes('UNIVERSAL'),
        target_int:    intT.filter(t=>t!=='UNIVERSAL'),
        target_ext:    extT,
        addedAt:       editingIdx>=0 ? (window.regulationEntries[editingIdx]?.addedAt||nowTs()) : nowTs(),
        updatedAt:     nowTs()
    };

    if (editingIdx >= 0) {
        window.regulationEntries[editingIdx] = entry;
    } else {
        window.regulationEntries.push(entry);
    }

    try {
        await saveAllEntries();
        window.closeRegForm();
        renderRegulationTable(window.regulationEntries);
        if(window.toast) window.toast(editingIdx>=0?'Threat updated':'Threat deployed to matrix');
    } catch(e) {
        console.error(e);
        if(window.toast) window.toast('Save failed','error');
    }
};

window.deleteRegEntry = async function(idx) {
    if (!confirm('Permanently delete this regulation entry?')) return;
    window.regulationEntries.splice(idx, 1);
    try {
        await saveAllEntries();
        renderRegulationTable(window.regulationEntries);
        if(window.toast) window.toast('Entry deleted');
    } catch(e) { console.error(e); if(window.toast) window.toast('Delete failed','error'); }
};

// ════════════════════════════════════════════════════════════════════════
// ═════════ AUTO THREAT ID ══════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
async function genThreatId() {
    const yr     = String(new Date().getFullYear()).slice(-2);
    const prefix = `LNR-${yr}-`;
    let max = 0;
    window.regulationEntries.forEach(e => {
        if (e.threatId && e.threatId.startsWith(prefix)) {
            const n = parseInt(e.threatId.split('-').pop(), 10);
            if (!isNaN(n) && n > max) max = n;
        }
    });
    return `${prefix}${String(max + 1).padStart(3,'0')}`;
}

// ════════════════════════════════════════════════════════════════════════
// ═════════ CSV / TSV IMPORT ════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
var importParsed = [];

window.openImportPanel  = () => { const p=window.$('reg-import-panel'); if(p) p.style.display='block'; };
window.closeImportPanel = () => { const p=window.$('reg-import-panel'); if(p) p.style.display='none'; importParsed=[]; const pr=window.$('reg-import-preview'); if(pr) pr.innerHTML=''; const s=window.$('reg-import-status'); if(s) s.textContent=''; const btn=window.$('reg-import-btn'); if(btn) btn.style.display='none'; };

window.handleRegDrop = function(event) {
    const file = event.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => { if(window.$('reg-paste-input')) window.$('reg-paste-input').value = e.target.result; window.previewImport(); };
    reader.readAsText(file);
};

window.handleRegFileInput = function(input) {
    const file = input.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = e => { if(window.$('reg-paste-input')) window.$('reg-paste-input').value = e.target.result; window.previewImport(); };
    reader.readAsText(file);
};

window.previewImport = async function() {
    const raw    = window.$('reg-paste-input')?.value?.trim()||'';
    const status = window.$('reg-import-status');
    const preview= window.$('reg-import-preview');
    const btn    = window.$('reg-import-btn');
    if (!raw) { if(status) status.textContent='No content to parse.'; return; }

    importParsed = parseRegistryTSV(raw);
    if (!importParsed.length) { if(status) status.textContent='⚠ No valid entries found. Check format.'; return; }

    // Show preview table
    const dupes    = importParsed.filter(e => window.regulationEntries.some(ex=>ex.threatId===e.threatId&&e.threatId));
    const newCount = importParsed.length - dupes.length;

    if(status) status.textContent = `${importParsed.length} entries parsed — ${newCount} new, ${dupes.length} will overwrite existing by Threat ID.`;
    if(btn) btn.style.display = 'inline-flex';

    if(preview) preview.innerHTML = `
    <div style="font-size:10px;color:var(--marble-dim);margin-bottom:8px;">Preview (first 10 entries):</div>
    <div class="tbl-wrap" style="max-height:250px;overflow-y:auto;">
    <table>
        <thead><tr><th>Threat ID</th><th>Title</th><th>Severity</th><th>Status</th><th>INT</th><th>EXT</th></tr></thead>
        <tbody>${importParsed.slice(0,10).map(e=>`<tr>
            <td style="font-family:monospace;font-size:9px">${window.esc(e.threatId||'(auto)')}</td>
            <td style="font-size:10px">${window.esc((e.title||'').substring(0,50))}</td>
            <td>${sevBadge(e.severity)}</td>
            <td>${statBadge(e.status)}</td>
            <td style="font-size:9px;color:var(--gold)">${(e.intTriggers||[]).join(', ')}</td>
            <td style="font-size:9px;color:#60a5fa">${(e.extTriggers||[]).join(', ')}</td>
        </tr>`).join('')}</tbody>
    </table></div>
    ${importParsed.length>10?`<div style="font-size:10px;color:var(--marble-faint);text-align:center;padding:6px;">…and ${importParsed.length-10} more</div>`:''}`;
};

window.executeImport = async function() {
    if (!importParsed.length) return;
    const btn = window.$('reg-import-btn');
    if(btn){btn.textContent='Importing…';btn.disabled=true;}

    let added=0, updated=0;

    for (const entry of importParsed) {
        // Assign auto Threat ID if missing
        if (!entry.threatId) entry.threatId = await genThreatId();

        const existingIdx = window.regulationEntries.findIndex(e=>e.threatId===entry.threatId);
        if (existingIdx >= 0) {
            window.regulationEntries[existingIdx] = entry;
            updated++;
        } else {
            window.regulationEntries.push(entry);
            added++;
        }
    }

    try {
        await saveAllEntries();
        renderRegulationTable(window.regulationEntries);
        if(window.toast) window.toast(`Import complete — ${added} added, ${updated} updated`);
        window.closeImportPanel();
    } catch(e) {
        console.error(e);
        if(window.toast) window.toast('Import failed — Firestore write error','error');
        if(btn){btn.textContent='Import All Entries';btn.disabled=false;}
    }
};

// ════════════════════════════════════════════════════════════════════════
// ═════════ TSV PARSER ══════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
function parseRegistryTSV(raw) {
    const lines = raw.split('\n')
        .map(l=>l.trim())
        .filter(l => l && !l.startsWith('//') && !l.startsWith('#'));

    // If first line looks like a header, skip it
    const start = lines[0]?.toLowerCase().includes('threat_id') ? 1 : 0;
    const entries = [];

    for (let i=start; i<lines.length; i++) {
        const cols = lines[i].split('\t');
        if (cols.length < 2) continue;

        const rawThreatId    = (cols[0]||'').trim();
        const title          = (cols[1]||'').trim();
        const legalAmmo      = (cols[2]||'').trim();
        const intRaw         = (cols[3]||'').trim();
        const extRaw         = (cols[4]||'').trim();
        const effectiveDate  = normalizeDate((cols[5]||'').trim());
        const status         = (cols[6]||'Active').trim();
        const velocity       = (cols[7]||'Immediate').trim();
        const severity       = (cols[8]||'HIGH').trim().toUpperCase();
        const thePain        = (cols[9]||'').trim();
        const theFix         = (cols[10]||'').trim();

        if (!title) continue;

        // Parse JSON arrays — handle ["INT.01"] and UNIVERSAL tags
        let intTriggers = [];
        let extTriggers = [];
        try { intTriggers = JSON.parse(intRaw); } catch {
            intTriggers = intRaw.replace(/[\[\]"]/g,'').split(',').map(s=>s.trim()).filter(Boolean);
        }
        try { extTriggers = JSON.parse(extRaw); } catch {
            extTriggers = extRaw.replace(/[\[\]"]/g,'').split(',').map(s=>s.trim()).filter(Boolean);
        }

        const isUniversal = intTriggers.some(t=>t.toUpperCase()==='UNIVERSAL'||t==='["UNIVERSAL"]');

        const entry = {
            threatId:      rawThreatId || '',  // blank → auto-generated on executeImport
            title,
            legalAmmo,
            severity:      SEV_OPTIONS.includes(severity) ? severity : 'HIGH',
            status:        STAT_OPTIONS.find(s=>s.toLowerCase()===status.toLowerCase()) || 'Active',
            velocity,
            effectiveDate,
            thePain,
            theFix,
            intTriggers,
            extTriggers,
            target_all:    isUniversal,
            target_int:    intTriggers.filter(t=>t.toUpperCase()!=='UNIVERSAL'),
            target_ext:    extTriggers,
            addedAt:       nowTs(),
            updatedAt:     nowTs()
        };
        entries.push(entry);
    }
    return entries;
}

// ── Date normalizer: accepts DD-MM-YYYY → returns YYYY-MM-DD ──────────
function normalizeDate(d) {
    if (!d) return '';
    // Already ISO
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    // DD-MM-YYYY
    const m = d.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    return d;
}
