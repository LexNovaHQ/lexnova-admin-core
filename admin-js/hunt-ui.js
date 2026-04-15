/**
 * ═════════════════════════════════════════════════════════════
 * LEX NOVA CRM v6.0 — MODULE 5: UI & DOM RENDERING ENGINE
 * ═════════════════════════════════════════════════════════════
 * Handles the Main Dash tables (with native header sorting) and 
 * the massive Full-Page ICP Intelligence Dossier.
 */

window.LexNova = window.LexNova || {};
LexNova.UI = LexNova.UI || {};

LexNova.UI.State = {
    currentTab: 'SEQUENCE',
    sortCol: 'last_updated',
    sortDesc: true
};

/**
 /**
 * ==========================================
 * SECTION 1: THE MAIN DASHBOARD & TABLES
 * ==========================================
 */
window.loadOutreach = function() { LexNova.UI.renderTables(); };
/**
 * Placeholder for auxiliary dashboard components.
 * Included to satisfy broadcastUpdates in hunt-core.js.
 */
LexNova.UI.renderDashboards = function() {
    console.log("[LexNova UI] Dashboard metrics refreshed.");
};

window.loadOutreach = function() { LexNova.UI.renderTables(); };
LexNova.UI.renderTables = function() {
    const container = document.getElementById('v5-crm-app') || document.getElementById('tab-body') || document.getElementById('tab-hunt');
    if (!container) return;

    // Pull metrics (defaulting to 0 if missing)
    const m = LexNova.State.metrics || { total: 0, inSequence: 0, v5Intel: 0, unscheduled: 0, archived: 0, bottleneck: 0, scansClicked: 0, scansDropped: 0, scansCompleted: 0 };
    const pList = LexNova.State.allProspects ? [...LexNova.State.allProspects] : [];

    // Filter by Tab Stage
    let filtered = pList.filter(p => p.status === LexNova.UI.State.currentTab);
    if (LexNova.UI.State.currentTab === 'QUEUED') {
        filtered = pList.filter(p => p.status === 'QUEUED' || !p.ceDate);
    }

    // NEW: Apply Search & Status Filter
    // 1. CAPTURE ALL FILTER INPUTS
    const searchVal = document.getElementById('cc-search')?.value.toLowerCase().trim() || '';
    const batchVal  = document.getElementById('cc-batch-filter')?.value || '';
    const statusVal = document.getElementById('cc-status-filter')?.value || '';
    const painVal   = document.getElementById('adv-pain')?.value || '';
    const archVal   = document.getElementById('adv-arch')?.value || '';
    const scanVal   = document.getElementById('adv-scan')?.value || '';
    const fundVal   = document.getElementById('adv-fund')?.value || '';
    const confVal   = document.getElementById('adv-conf')?.value || '';

    // 2. APPLY OMNI-SEARCH (Free search across all flat text values)
    if (searchVal) {
        filtered = filtered.filter(p => {
            const allValues = Object.values(p).map(v => typeof v === 'string' ? v.toLowerCase() : '').join(' ');
            return allValues.includes(searchVal);
        });
    }

    // 3. APPLY BATCH & STATUS FILTERS
    if (batchVal) filtered = filtered.filter(p => (p.batch || p.batchNumber) === batchVal);
    if (statusVal) filtered = filtered.filter(p => p.status === statusVal);

    // 4. APPLY ADVANCED FILTERS
    if (painVal) {
        filtered = filtered.filter(p => {
            const pTier = p.ghost_protection_global?.pain_tier || 'T9';
            return painVal === 'T1_T2' ? (pTier === 'T1' || pTier === 'T2') : pTier === painVal;
        });
    }
    if (archVal) filtered = filtered.filter(p => (p.archetypes || []).some(a => a.includes(archVal)));
    if (scanVal) {
        filtered = filtered.filter(p => {
            if (scanVal === 'COMPLETED') return p.scannerCompleted;
            if (scanVal === 'DROPPED') return p.scannerClicked && !p.scannerCompleted;
            if (scanVal === 'CLICKED') return p.scannerClicked;
            if (scanVal === 'NONE') return !p.scannerClicked;
            return true;
        });
    }
    if (fundVal) filtered = filtered.filter(p => p.fundingStage === fundVal);
    if (confVal) filtered = filtered.filter(p => (p.ghost_protection_global?.confidence_tier || 'N/A') === confVal);
    // NATIVE SORTING ENGINE (Driven by Central Dropdown, Directed by Header Toggle)
    filtered.sort((a, b) => {
        let valA = a[LexNova.UI.State.sortCol] || a[LexNova.UI.State.sortCol + 'Number'] || a[LexNova.UI.State.sortCol + 'Name'] || '';
        let valB = b[LexNova.UI.State.sortCol] || b[LexNova.UI.State.sortCol + 'Number'] || b[LexNova.UI.State.sortCol + 'Name'] || '';
        
        if (LexNova.UI.State.sortCol === 'confidence') {
            valA = a.ghost_protection_global?.confidence_score || 0;
            valB = b.ghost_protection_global?.confidence_score || 0;
        }

        if (valA < valB) return LexNova.UI.State.sortDesc ? 1 : -1;
        if (valA > valB) return LexNova.UI.State.sortDesc ? -1 : 1;
        return 0;
    });

    const scanPct = m.inSequence > 0 ? Math.round((m.scansClicked / m.inSequence) * 100) : 0;

    // GENERATE DYNAMIC BATCH OPTIONS
    const uniqueBatches = [...new Set(pList.map(p => p.batch || p.batchNumber).filter(Boolean))].sort();
    const currentBatchFilter = document.getElementById('cc-batch-filter')?.value || '';
    const batchOptionsHtml = uniqueBatches.map(b => `<option value="${b}" ${currentBatchFilter === b ? 'selected' : ''}>Batch: ${b}</option>`).join('');

    let html = `
    <div style="display:flex; gap:15px; margin-bottom: 15px;">
        <div class="card" style="flex:2;">
            <div style="font-size:10px; color:var(--gold); letter-spacing:0.1em; text-transform:uppercase;">PIPELINE HEALTH</div>
            <div style="display:flex; justify-content:space-between; margin-top:10px;">
                <div><span style="font-size:24px;">${m.total}</span><br><span style="font-size:9px; color:var(--marble-dim);">Total Targets</span></div>
                <div><span style="font-size:24px; color:var(--green);">${m.inSequence}</span><br><span style="font-size:9px; color:var(--marble-dim);">In Sequence</span></div>
                <div><span style="font-size:24px;">${m.v5Intel}</span><br><span style="font-size:9px; color:var(--marble-dim);">V5.0 Intel</span></div>
                <div><span style="font-size:24px;">${m.unscheduled}</span><br><span style="font-size:9px; color:var(--marble-dim);">Unscheduled</span></div>
                <div><span style="font-size:24px;">${m.archived}</span><br><span style="font-size:9px; color:var(--marble-dim);">Archived</span></div>
                <div><span style="font-size:24px; color:var(--red);">${m.bottleneck}</span><br><span style="font-size:9px; color:var(--marble-dim);">Bottleneck / Action Needed</span></div>
            </div>
        </div>
        
        <div class="card" style="flex:1;">
            <div style="font-size:10px; color:var(--gold); letter-spacing:0.1em; text-transform:uppercase;">SCANNER TELEMETRY</div>
            <div style="display:flex; justify-content:space-between; margin-top:10px;">
                <div><span style="font-size:24px;">${m.scansClicked}</span> <span style="font-size:12px; color:var(--gold);">(${scanPct}%)</span><br><span style="font-size:9px; color:var(--marble-dim);">Clicked</span></div>
                <div><span style="font-size:24px;">${m.scansDropped}</span><br><span style="font-size:9px; color:var(--marble-dim);">Dropped</span></div>
                <div><span style="font-size:24px; color:var(--green);">${m.scansCompleted}</span><br><span style="font-size:9px; color:var(--marble-dim);">Completed</span></div>
            </div>
        </div>
    </div>

    <div class="card" style="margin-bottom:15px; padding:15px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-end; gap:15px; flex-wrap:wrap; border-bottom:1px solid var(--border); padding-bottom:15px; margin-bottom:15px;">
            <div style="display:flex; gap:0;">
                <button class="view-btn ${LexNova.UI.State.currentTab === 'QUEUED' ? 'active' : ''}" onclick="LexNova.UI.setTab('QUEUED')">Unscheduled (${m.unscheduled})</button>
                <button class="view-btn ${LexNova.UI.State.currentTab === 'SEQUENCE' ? 'active' : ''}" onclick="LexNova.UI.setTab('SEQUENCE')">In Sequence (${m.inSequence})</button>
                <button class="view-btn ${LexNova.UI.State.currentTab === 'NEGOTIATING' ? 'active' : ''}" onclick="LexNova.UI.setTab('NEGOTIATING')">Negotiating</button>
            </div>
            <div style="display:flex; gap:10px;">
                <button class="btn btn-outline" onclick="LexNova.Export.copyList()">📋 Copy List</button>
                <button class="btn btn-primary" onclick="LexNova.Ingestion.openV5Modal()">📥 Add New ICP</button>
            </div>
        </div>

        <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
            <input type="text" class="fi" id="cc-search" placeholder="Omni-Search..." style="width:200px;" oninput="LexNova.UI.renderTables()">
            
            <select class="fi" id="cc-batch-filter" style="width:120px;" onchange="LexNova.UI.renderTables()">
                <option value="">All Batches</option>
                ${batchOptionsHtml}
            </select>

            <select class="fi" id="cc-status-filter" style="width:140px;" onchange="LexNova.UI.renderTables()">
                <option value="">All Statuses</option>
                <option value="QUEUED">QUEUED</option>
                <option value="SEQUENCE">SEQUENCE</option>
                <option value="ENGAGED">ENGAGED</option>
                <option value="NEGOTIATING">NEGOTIATING</option>
                <option value="CONVERTED">CONVERTED</option>
                <option value="ARCHIVED">ARCHIVED</option>
                <option value="DEAD">DEAD</option>
            </select>

            <select class="fi" style="width:160px;" onchange="LexNova.UI.setSortCol(this.value)">
                <option value="last_updated" ${LexNova.UI.State.sortCol === 'last_updated' ? 'selected' : ''}>Sort: Last Update Date</option>
                <option value="ceDate" ${LexNova.UI.State.sortCol === 'ceDate' ? 'selected' : ''}>Sort: CE Date</option>
                <option value="date_added" ${LexNova.UI.State.sortCol === 'date_added' ? 'selected' : ''}>Sort: Date Added</option>
                <option value="batch" ${LexNova.UI.State.sortCol === 'batch' ? 'selected' : ''}>Sort: Batch</option>
                <option value="company" ${LexNova.UI.State.sortCol === 'company' ? 'selected' : ''}>Sort: Company</option>
                <option value="confidence" ${LexNova.UI.State.sortCol === 'confidence' ? 'selected' : ''}>Sort: Confidence Score</option>
            </select>

            <button class="adv-toggle" onclick="window.toggleAdvFilters(this)">▾ Advanced Filters</button>
        </div>

       <div id="adv-filters-inner" class="adv-filters-inner hidden" style="margin-top:10px; border-top:1px dashed var(--border); padding-top:10px; display:flex; gap:10px; flex-wrap:wrap;">
            
            <select class="fi" id="adv-pain" onchange="LexNova.UI.renderTables()">
                <option value="">All Pain Tiers</option>
                <option value="T1_T2">T1 / T2 Only (Lethal)</option>
                <option value="T3">T3 Only</option>
                <option value="LEGACY">Legacy Mapped</option>
            </select>

            <select class="fi" id="adv-arch" onchange="LexNova.UI.renderTables()">
                <option value="">All Archetypes</option>
                <option value="INT">Any INT (Operational)</option>
                <option value="EXT">Any EXT (Jurisdictional)</option>
            </select>

            <select class="fi" id="adv-scan" onchange="LexNova.UI.renderTables()">
                <option value="">All Scan States</option>
                <option value="COMPLETED">Completed</option>
                <option value="DROPPED">Dropped</option>
                <option value="CLICKED">Clicked / Engaged</option>
                <option value="NONE">No Scan</option>
            </select>

            <select class="fi" id="adv-fund" onchange="LexNova.UI.renderTables()">
                <option value="">All Funding Stages</option>
                <option value="Bootstrapped">Bootstrapped</option>
                <option value="Seed">Seed / Pre-Seed</option>
                <option value="Series A">Series A</option>
                <option value="Series B">Series B</option>
                <option value="Series C+">Series C+ / Growth</option>
                <option value="Enterprise">Enterprise / Public</option>
                <option value="Unverified">Unverified</option>
            </select>

            <select class="fi" id="adv-ready" onchange="LexNova.UI.renderTables()">
                <option value="">All Readiness States</option>
                <option value="INTEL_READY">Intel Ready (V5 Gaps)</option>
                <option value="SCHEDULED">Scheduled (Has CE Date)</option>
                <option value="ACTION_NEEDED">Unverified / Action Needed</option>
            </select>

            <select class="fi" id="adv-conf" onchange="LexNova.UI.renderTables()">
                <option value="">All Confidence Tiers</option>
                <option value="HIGH">HIGH (0.7 - 1.0)</option>
                <option value="MEDIUM">MEDIUM (0.4 - 0.6)</option>
                <option value="LOW">LOW (0.0 - 0.3)</option>
                <option value="MAPPED">MAPPED (Legacy)</option>
            </select>

        </div>

    <div class="card" style="overflow-x:auto; padding:0;">
        <table style="width:100%; text-align:left; border-collapse:collapse; font-size:11px;">
            <thead style="background:var(--surface2);">
                <tr style="border-bottom:1px solid var(--border); color:var(--marble-dim); font-size:9px; letter-spacing:0.1em; text-transform:uppercase;">
                    <th style="padding:12px;">S.No</th>
                    <th style="padding:12px;">Target / PID</th>
                    <th style="padding:12px;">Batch</th>
                    <th style="padding:12px;">Intel Status</th>
                    ${LexNova.UI.State.currentTab === 'QUEUED' ? `
                        <th style="padding:12px;">Last Update</th>
                        <th style="padding:12px;">Aging / Days</th>
                        <th style="padding:12px; cursor:pointer; color:var(--gold);" onclick="LexNova.UI.toggleSortDir()">Toggle ASC/DSC ${LexNova.UI.getSortIcon()}</th>
                    ` : LexNova.UI.State.currentTab === 'NEGOTIATING' ? `
                        <th style="padding:12px;">Scanner Score</th>
                        <th style="padding:12px;">Lethal Threat Summary</th>
                        <th style="padding:12px;">Last Touch</th>
                        <th style="padding:12px; cursor:pointer; color:var(--gold);" onclick="LexNova.UI.toggleSortDir()">Toggle ASC/DSC ${LexNova.UI.getSortIcon()}</th>
                    ` : `
                        <th style="padding:12px;">Outreach Status</th>
                        <th style="padding:12px;">Scanner Status</th>
                        <th style="padding:12px; cursor:pointer; color:var(--gold);" onclick="LexNova.UI.toggleSortDir()">Toggle ASC/DSC ${LexNova.UI.getSortIcon()}</th>
                    `}
                </tr>
            </thead>
            <tbody>
                ${filtered.map((p, index) => LexNova.UI.buildRow(p, index + 1)).join('')}
            </tbody>
        </table>
        ${filtered.length === 0 ? '<div style="padding:40px; text-align:center; color:var(--marble-dim);">No targets in this pipeline stage.</div>' : ''}
    </div>
    `;

    container.innerHTML = html;
};

/**
 * ==========================================
 * SECTION 2: TABLE ROW GENERATOR (DUAL-READ)
 * ==========================================
 */
LexNova.UI.buildRow = function(p, index) {
    // 1. Dual-Read Identity
    const pId = p.id || p.prospectId || 'UNKNOWN_PID';
    const fName = p.founderName || p.name || 'Unknown';
    const fRole = p.founderRole || p.jobTitle || 'Unknown';
    const coName = p.company || p.companyName || 'Unknown';
    const batchVal = p.batch || p.batchNumber || 'N/A';
    
    // 2. Intel Status & Legacy Migration Mapping
    const isV5 = p.true_gaps && p.true_gaps.length > 0;
    const intelBadge = isV5 ? `<span style="color:var(--green); font-weight:bold;">V5.0</span>` : `<span style="background:rgba(212,122,122,0.15); color:var(--red); padding:2px 4px; border-radius:3px;">LEGACY</span>`;
    
    let confTier = p.ghost_protection_global?.confidence_tier || 'N/A';
    let liaColor = "var(--marble)";
    let lethalThreat = "N/A";

    if (isV5) {
        if (p.G1_category === "DIRECT_LIABILITY") liaColor = "var(--red)";
        else if (p.G1_category === "DUAL_EXPOSURE") liaColor = "var(--gold)";
        lethalThreat = p.true_gaps[0]?.Threat_Name || "N/A";
    } else {
        if (p.forensicGaps && p.forensicGaps.length > 0) {
            const topLegacy = p.forensicGaps[0];
            let mappedId = topLegacy.threatId;
            if (LexNova.Ingestion?.MIGRATION_MAP?.[mappedId]) mappedId = LexNova.Ingestion.MIGRATION_MAP[mappedId];
            
            const regEntry = LexNova.Ingestion?.REGISTRY?.[mappedId];
            if (regEntry) {
                if (regEntry.Pain_Tier === 'T1' || regEntry.Pain_Tier === 'T2') liaColor = "var(--red)";
                else liaColor = "var(--gold)";
                confTier = "MAPPED";
                lethalThreat = regEntry.Threat_Name;
            } else {
                lethalThreat = mappedId;
            }
        }
    }

    // 3. Conditional Column Rendering (By Tab)
    let dynamicCols = '';
    
    if (LexNova.UI.State.currentTab === 'QUEUED') {
        const dateAdd = new Date(p.date_added || p.createdAt || Date.now());
        const daysInQueue = Math.floor((Date.now() - dateAdd) / (1000 * 60 * 60 * 24));
        
        dynamicCols = `
            <td style="padding:12px; color:var(--marble-dim);">${p.last_updated ? p.last_updated.split('T')[0] : 'N/A'}</td>
            <td style="padding:12px;">
                <span style="color:${daysInQueue > 7 ? 'var(--red)' : 'var(--gold)'}; font-weight:bold;">${daysInQueue} Days Idle</span>
            </td>
            <td style="padding:12px;" onclick="event.stopPropagation();">
                <input type="date" class="fi" value="${p.ceDate || ''}" onchange="LexNova.Ops.updateInline('${pId}', 'ceDate', this.value)" style="width:120px; padding:4px;">
            </td>
        `;
    } else if (LexNova.UI.State.currentTab === 'NEGOTIATING') {
        let scanFlag = "⚪ NO SCAN";
if (p.scannerCompleted) {
    scanFlag = "✅ DUAL CONFIRMED";
} else if (p.scannerClicked && p.scannerStep && p.scannerStep !== 'page_loaded') {
    scanFlag = "🔴 DROPPED";
} else if (p.scannerClicked) {
    scanFlag = "🟡 ENGAGED";
}
        
        dynamicCols = `
            <td style="padding:12px;">
                <span style="font-family:'Cormorant Garamond',serif; font-size:16px; color:var(--gold);">Score: ${p.scanner_score || 'N/A'}</span><br>
                <span style="font-size:9px; color:var(--marble-dim);">${scanFlag}</span>
            </td>
            <td style="padding:12px; color:var(--marble); font-weight:bold;">${lethalThreat}</td>
            <td style="padding:12px; color:var(--gold);">${p.last_touch || 'N/A'}</td>
            <td style="padding:12px;" onclick="event.stopPropagation();">
                <div style="display:flex; flex-direction:column; gap:4px;">
                    <input type="text" class="fi" value="${p.deal_friction || ''}" placeholder="Next action / friction..." onchange="LexNova.Ops.updateInline('${pId}', 'deal_friction', this.value)" style="width:160px; padding:4px;">
                    <span style="font-size:10px; color:var(--marble-dim);">Value: ${p.deal_value || 'TBD'}</span>
                </div>
            </td>
        `;
    } else {
        // DEFAULT IN SEQUENCE
        let scanFlag = "⚪ None";
if (p.scannerCompleted) {
    scanFlag = "✅ Completed";
} else if (p.scannerClicked && p.scannerStep && p.scannerStep !== 'page_loaded') {
    // If they got past the initial page load but didn't complete
    scanFlag = `🔴 Dropped (${p.scannerStep})`;
} else if (p.scannerClicked) {
    scanFlag = "🟡 Clicked";
}
        
        dynamicCols = `
            <td style="padding:12px;">
                <span class="badge b-seq-active">${p.outreach_step || 'FU1'}</span><br>
                <span style="font-size:9px; color:var(--marble-dim);">${p.days_until_next || 'Due in 3 days'}</span>
            </td>
            <td style="padding:12px; font-size:10px;">${scanFlag}</td>
            <td style="padding:12px; color:var(--marble);">${p.ceDate ? p.ceDate : '<span style="color:var(--red);">Unscheduled</span>'}</td>
        `;
    }

    return `
    <tr style="border-bottom:1px solid var(--surface2); cursor:pointer; transition: background 0.2s;" onmouseover="this.style.background='var(--surface3)'" onmouseout="this.style.background='transparent'" onclick="LexNova.UI.openProspectPanel('${pId}')">
        <td style="padding:12px; color:var(--marble-dim);">${index}</td>
        <td style="padding:12px;">
            <strong style="color:var(--marble); font-size:12px;">${fName} &mdash; ${fRole}</strong><br>
            <span style="color:var(--gold); font-size:10px;">${coName}</span> <span style="color:var(--marble-faint); font-size:9px;">| ${pId}</span>
        </td>
        <td style="padding:12px; font-family:monospace; color:var(--marble-dim);">${batchVal}</td>
        <td style="padding:12px;">
            <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
                <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${liaColor};"></span>
                <span style="font-weight:bold; font-size:10px; color:var(--marble);">${confTier}</span>
            </div>
            ${intelBadge}
        </td>
        ${dynamicCols}
    </tr>
    `;
};

/**
 * ==========================================
 * SECTION 3: STATE HELPERS
 * ==========================================
 */
LexNova.UI.setTab = function(tab) {
    LexNova.UI.State.currentTab = tab;
    LexNova.UI.renderTables();
};

LexNova.UI.setSortCol = function(col) {
    LexNova.UI.State.sortCol = col;
    LexNova.UI.renderTables();
};

LexNova.UI.toggleSortDir = function() {
    LexNova.UI.State.sortDesc = !LexNova.UI.State.sortDesc;
    LexNova.UI.renderTables();
};

LexNova.UI.getSortIcon = function() {
    return LexNova.UI.State.sortDesc ? '↓' : '↑';
};

/**
 * ==========================================
 * SECTION 4: THE FULL-PAGE ICP DOSSIER 
 * ==========================================
 */
LexNova.UI.openProspectPanel = function(pid) {
    const p = LexNova.State.allProspects.find(x => x.id === pid || x.prospectId === pid);
    if (!p) return;

    // 1. DUAL-READ IDENTITY & LOGISTICS
    const isLegacy = !p.true_gaps || p.true_gaps.length === 0;
    const pId = p.id || p.prospectId;
    const scannerUrl = `https://lexnovahq.com/scanner.html?pid=${pId}`;
    
    const fName = p.founderName || p.name || '';
    const fRole = p.founderRole || p.jobTitle || '';
    const coName = p.company || p.companyName || '';
    const batchVal = p.batch || p.batchNumber || '';
    const email = p.email || '';
    const website = p.website || p.companyDomain || '';
    const linkedIn = p.linkedIn || p.linkedin || '';
    
    const jHQ = p.jurisdiction_hq || p.jurisdiction || p.registrationJurisdiction || p.geography || '';
    const jDP = p.jurisdiction_dp || '';
    const jSvc = p.jurisdiction_svc || '';

    // 2. MIGRATION MAPPING FOR THREAT MATRIX
    let displayGaps = [];
    if (isLegacy) {
        displayGaps = (p.forensicGaps || []).map(g => {
            let mappedId = g.threatId;
            if (LexNova.Ingestion?.MIGRATION_MAP?.[mappedId]) mappedId = LexNova.Ingestion.MIGRATION_MAP[mappedId];
            const stat = LexNova.Ingestion?.REGISTRY?.[mappedId] || {};
            return { Threat_ID: mappedId, Threat_Name: stat.Threat_Name || g.threatId, Pain_Tier: stat.Pain_Tier || 'T9', ...g, _isLegacy: true };
        });
    } else {
        displayGaps = [...(p.true_gaps || [])];
    }
    
    // Sort strictly T1 > T2 > T3
    displayGaps.sort((a, b) => (a.Pain_Tier || 'T9').localeCompare(b.Pain_Tier || 'T9'));

    const t1t2Count = displayGaps.filter(g => g.Pain_Tier === 'T1' || g.Pain_Tier === 'T2').length;
    const intCount = displayGaps.filter(g => (g.Threat_ID || '').startsWith('INT')).length;
    const uniCount = displayGaps.filter(g => (g.Threat_ID || '').startsWith('UNI') || (g.Threat_ID || '').startsWith('I0')).length;

    // 3. LEGAL STACK CHECKLIST PARSER
    const gapsText = JSON.stringify(displayGaps);
    const renderStackStatus = (docCode) => {
        return gapsText.includes(docCode) 
            ? `<span style="color:var(--red); font-weight:bold;">🔴 MISS</span>` 
            : `<span style="color:var(--green);">🟢 Exists</span>`;
    };

    // 4. LIVE TELEMETRY DASHBOARD (Aborted State Mapping)
    const stepMap = {
        'page_loaded': 'Hit Landing Page',
        'config_complete': 'Started Diagnostic',
        'quiz_midpoint': 'Midpoint / Q5',
        'quiz_complete': 'Finished Questions',
        'dashboard_viewed': 'Viewed Dashboard'
    };
    
    const isClicked = p.scannerClicked === true || p.scanner_clicked === true;
    const isCompleted = p.scannerCompleted === true || p.scanner_completed === true;
    
    let tClick = '<span style="color:var(--marble-dim)">Awaiting Action</span>';
    let tDrop = '<span style="color:var(--marble-dim)">None</span>';
    let tComp = '<span style="color:var(--marble-dim)">Pending</span>';

    if (isClicked) {
        tClick = `<span style="color:var(--green)">Clicked: ${p.scannerStepAt ? new Date(p.scannerStepAt.seconds ? p.scannerStepAt.toDate() : p.scannerStepAt).toLocaleString() : 'Yes'}</span>`;
        
        if (isCompleted) {
            tComp = `<span style="color:var(--green)">Completed: ${p.scannerStepAt ? new Date(p.scannerStepAt.seconds ? p.scannerStepAt.toDate() : p.scannerStepAt).toLocaleString() : 'Yes'}</span>`;
        } else if (p.scannerStep && p.scannerStep !== 'page_loaded') {
            const humanStep = stepMap[p.scannerStep] || p.scannerStep;
            tDrop = `<span style="color:var(--red)">Abandoned (${humanStep}): ${p.scannerStepAt ? new Date(p.scannerStepAt.seconds ? p.scannerStepAt.toDate() : p.scannerStepAt).toLocaleString() : ''}</span>`;
        }
    }

    // 5. FEATURE MAP FORMATTING
    let featureHtml = '<span style="color:var(--marble-dim);">No features mapped.</span>';
    if (p.featureMap) {
        featureHtml = '';
        (p.featureMap.core || []).forEach(f => {
            featureHtml += `<div style="margin-bottom:6px;"><strong>[${f.archetype}] ${f.feature_name}:</strong> ${f.feature_description}</div>`;
        });
        (p.featureMap.secondary || []).forEach(f => {
            featureHtml += `<div style="margin-bottom:6px; color:var(--marble-dim);"><strong>[${f.archetype}] ${f.feature_name}</strong> (Secondary)</div>`;
        });
    }

    const indictments = p.ghost_protection_global?.self_indictments || [];
    const panelContainer = document.getElementById('prospectPanel');
    if (!panelContainer) return;

    const bodyHtml = `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:15px 24px; border-bottom:1px solid var(--border); background:var(--surface); flex-shrink:0;">
        <div style="flex:1; display:flex; gap:20px; align-items:center;">
            <div>
                <div style="font-family:'Cormorant Garamond',serif; font-size:24px; color:var(--marble); line-height:1;">${coName}</div>
                <div style="font-size:11px; color:var(--gold); margin-top:4px;">${pId}</div>
            </div>
            <div style="border-left:1px solid var(--border2); padding-left:20px; font-size:12px; color:var(--marble-dim); line-height:1.4;">
                <strong style="color:var(--marble);">${fName}</strong> — ${fRole}<br>
                ${email} | HQ: ${jHQ || 'Unknown'}
            </div>
        </div>
    </div>

    <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 24px; border-bottom:1px solid var(--border); background:var(--surface2); flex-shrink:0;">
        <div style="display:flex; align-items:center; gap:10px;">
            <div style="background:var(--void); padding:4px 10px; border:1px solid var(--border); display:flex; align-items:center; gap:8px;">
                <span style="font-size:9px; color:var(--marble-dim);">Scanner:</span>
                <input type="text" id="pp-scan-link" value="${scannerUrl}" readonly style="width:220px; font-size:10px; background:transparent; border:none; color:var(--marble); outline:none;">
                <button class="btn btn-outline btn-sm" onclick="navigator.clipboard.writeText(document.getElementById('pp-scan-link').value); window.toast('Copied!', 'success');">📋 Copy</button>
            </div>
            <div style="font-size:9px; color:var(--marble-dim); margin-left:10px;">
                Added: ${p.date_added ? new Date(p.date_added).toLocaleDateString() : 'N/A'} <br>
                Updated: ${p.last_updated ? new Date(p.last_updated).toLocaleString() : 'N/A'}
            </div>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
            <button class="btn btn-primary" onclick="LexNova.Ingestion.openV5Modal('${pId}')">🔄 Hunter 5.0 JSON Update</button>
            <button class="btn btn-outline" onclick="LexNova.Export.copySpearReport('${pId}')">🎯 Copy Spear</button>
            <button class="btn btn-outline" onclick="LexNova.Export.copyDossier('${pId}')">📁 Full Dossier</button>
            <button class="btn btn-primary" style="background:#5a8a6a;" onclick="LexNova.UI.saveLogisticsFromPanel('${pId}')">💾 Save Dossier</button>
            <button class="btn btn-outline" style="border-color:var(--red); color:var(--red);" onclick="LexNova.Ops.deleteProspect('${pId}')">🗑️ Purge</button>
            <button class="btn btn-ghost" onclick="document.getElementById('prospectPanel').classList.remove('open')">✕ Close</button>
        </div>
    </div>

    <div style="display:flex; flex-direction:row; height:calc(100vh - 140px);">
        
        <div style="flex:65; padding:24px; overflow-y:auto; border-right:1px solid var(--border);">
            ${isLegacy ? `<div style="background:rgba(138,58,58,0.15); border:1px solid var(--red); color:#d47a7a; padding:10px; font-weight:bold; font-size:11px; text-align:center; margin-bottom:20px; animation: pulse 2s infinite;">⚠️ LEGACY V6/V7 DATA DETECTED. FULL V5.0 SCAN REQUIRED.</div>` : ''}
            
            <div class="card" style="margin-bottom:20px;">
                <div class="card-label">1. Product Architecture</div>
                <div style="font-size:12px; color:var(--marble); line-height:1.6;">
                    <div style="font-size:14px; color:var(--gold); margin-bottom:8px; padding-bottom:8px; border-bottom:1px solid var(--border);"><strong>"${p.primary_claim || 'N/A'}"</strong></div>
                    <strong>Product:</strong> ${p.primaryProduct?.product_name || '[Requires V5.0 Update]'} (Agent Brand: ${p.primaryProduct?.agent_brand_name || 'None'})<br>
                    <strong>Archetypes:</strong> ${(p.archetypes || []).join(', ') || '[Requires V5.0 Update]'}<br>
                    <strong>Jurisdictions:</strong> ${(p.jurisdictional_surface || []).join(', ') || '[Requires V5.0 Update]'}<br><br>
                    <div style="font-size:10px; color:var(--gold); text-transform:uppercase; margin-bottom:4px;">Feature Map</div>
                    <div style="background:var(--void); padding:10px; border:1px solid var(--border2);">${featureHtml}</div>
                </div>
            </div>

            <div class="card" style="margin-bottom:20px; border-left: 4px solid ${p.G1_category === 'DIRECT_LIABILITY' ? 'var(--red)' : p.G1_category === 'DUAL_EXPOSURE' ? 'var(--gold)' : 'var(--marble-dim)'};">
                <div class="card-label">2. Forensic Details</div>
                <div style="font-size:12px; color:var(--marble); display:flex; flex-direction:column; gap:12px;">
                    
                    <div style="display:flex; justify-content:space-between; align-items:center; background:var(--void); padding:10px; border:1px solid var(--border2);">
                        <div style="font-weight:bold; font-size:14px;">Liability Gate: ${p.G1_category || '[Requires V5.0 Update]'} <br><span style="font-weight:normal; font-size:11px; color:var(--marble-dim);">${p.G2_reason || ''}</span></div>
                        <div style="text-align:right;">
                            <strong>Confidence:</strong> ${p.ghost_protection_global?.confidence_tier || 'N/A'} <br>
                            <span style="font-size:11px; color:var(--gold);">Score: ${p.ghost_protection_global?.confidence_score || '0'}</span>
                        </div>
                    </div>
                    
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; font-size:11px;">
                        <div>
                            <div style="font-size:10px; color:var(--gold); text-transform:uppercase; margin-bottom:6px;">Legal Stack Forensics</div>
                            <div style="background:var(--surface2); padding:10px; border:1px solid var(--border); display:flex; flex-direction:column; gap:4px;">
                                <div style="display:flex; justify-content:space-between;"><span>Terms of Service (TOS):</span> ${renderStackStatus('DOC_TOS')}</div>
                                <div style="display:flex; justify-content:space-between;"><span>Privacy Policy (PP):</span> ${renderStackStatus('DOC_PP')}</div>
                                <div style="display:flex; justify-content:space-between;"><span>Data Proc. Agreement (DPA):</span> ${renderStackStatus('DOC_DPA')}</div>
                                <div style="display:flex; justify-content:space-between;"><span>Acceptable Use (AUP):</span> ${renderStackStatus('DOC_AUP')}</div>
                                <div style="display:flex; justify-content:space-between;"><span>Service Level (SLA):</span> ${renderStackStatus('DOC_SLA')}</div>
                                <div style="margin-top:6px; pt-2; border-top:1px solid var(--border2); color:var(--marble-dim);"><em>Analysis: ${p.ghost_protection_global?.legal_stack_alibi?.overall_inadequacy || 'N/A'}</em></div>
                            </div>
                        </div>
                        <div>
                            <div style="font-size:10px; color:var(--gold); text-transform:uppercase; margin-bottom:6px;">Ghost Protection Vector</div>
                            <div style="background:var(--void); padding:10px; border:1px solid var(--border2);">
                                <span style="color:var(--gold); font-size:14px; font-family:'Cormorant Garamond',serif;">"${p.ghost_protection_global?.ghost_protection_vector || '[Requires V5.0 Update]'}"</span>
                                <div style="margin-top:8px; color:var(--marble-dim);"><strong>Posture Defeat:</strong> ${p.ghost_protection_global?.posture_alibi?.argument || 'N/A'}</div>
                            </div>
                        </div>
                    </div>

                    ${indictments.length > 0 ? `
                    <div style="margin-top:10px;">
                        <div style="font-size:10px; color:var(--gold); text-transform:uppercase; margin-bottom:6px;">Self-Indictments</div>
                        <div style="display:grid; gap:8px;">
                            ${indictments.map((ind, i) => `
                                <div style="font-size:11px; background:var(--void); padding:10px; border-left:2px solid var(--gold);">
                                    <div style="color:var(--marble-dim); margin-bottom:4px;"><strong>Quote:</strong> "${ind.quote}"</div>
                                    <div style="color:var(--red);"><strong>Contradicts:</strong> ${ind.contradicts}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>` : ''}
                </div>
            </div>

            <div class="section-title" style="display:flex; justify-content:space-between; align-items:center;">
                3. Threat Matrix
                <div style="font-size:10px; font-weight:normal; display:flex; gap:10px;">
                    <span style="color:var(--red);">T1/T2: ${t1t2Count}</span>
                    <span style="color:var(--gold);">INT: ${intCount}</span>
                    <span style="color:var(--marble);">UNI: ${uniCount}</span>
                </div>
            </div>
            
            ${displayGaps.map((g, i) => {
                const isT1 = g.Pain_Tier === 'T1' || g.Pain_Tier === 'T2';
                const cardColor = isT1 ? 'var(--red)' : 'var(--gold)';
                return `
                <details class="card" style="margin-bottom:10px; border-left:3px solid ${cardColor}; padding:0;">
                    <summary style="padding:15px; cursor:pointer; font-size:14px; font-weight:bold; color:var(--marble); display:flex; justify-content:space-between; align-items:center;">
                        <div><span style="color:${cardColor}; margin-right:8px;">[${g.Pain_Tier || 'LEG'}]</span> ${g.Threat_Name || 'Unknown Threat'}</div>
                        <div style="font-size:10px; color:var(--marble-dim); font-weight:normal;">${g.Threat_ID} | ${g.Velocity || 'N/A'} ▾</div>
                    </summary>
                    <div style="padding:0 15px 15px 15px; font-size:11px; color:var(--marble); display:grid; gap:10px; line-height:1.5;">
                        ${g._isLegacy ? `
                            <div style="color:var(--marble-dim);"><em>Legacy Trace detected. Required mapping applied.</em></div>
                            <div><strong>Old Remediation:</strong> ${g.remediationPlan || 'N/A'}</div>
                        ` : `
                            <div style="display:flex; justify-content:space-between; background:var(--surface2); padding:8px; border:1px solid var(--border2);">
                                <span><strong>Feature Ref:</strong> ${g.feature_ref} (${g.feature_type})</span>
                                <span><strong>Depth:</strong> ${g.Pain_Depth}</span>
                            </div>
                            
                            <div style="background:var(--void); padding:10px; border-left:2px solid var(--gold);"><strong>Mechanism:</strong> ${g.FP_Mechanism}</div>
                            
                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                                <div><strong style="color:#d4a840;">Structural Absence:</strong><br>${g.structural_absence}</div>
                                <div><strong style="color:#d4a840;">Predator Signature:</strong><br>${g.predator_signature}</div>
                            </div>
                            
                            <div style="color:#d47a7a; padding:10px; background:rgba(212,122,122,0.05); border:1px solid rgba(212,122,122,0.2);">
                                <strong>Impact:</strong> ${g.FP_Impact}<br><br>
                                <strong>Stakes:</strong> ${g.FP_Stakes}
                            </div>
                            
                            <div style="background:var(--void); padding:10px; border-left:2px solid var(--red);">
                                <strong>Evidence (${g.governance_artifact_type}):</strong> 
                                ${g.proof_citation === 'NULL' ? '<em>NULL FLAG (No Quote)</em>' : `"${g.proof_citation}"`}<br>
                                <a href="${g.evidence_source}" target="_blank" style="color:var(--gold); text-decoration:underline;">Source Link</a>
                            </div>
                            
                            <div style="padding:10px; background:var(--surface2);"><strong>Lex Nova Fix:</strong> <span style="color:var(--green); font-family:monospace; font-size:12px;">${g.Lex_Nova_Fix}</span></div>
                        `}
                    </div>
                </details>
                `;
            }).join('')}
        </div>

        <div style="flex:35; padding:24px; overflow-y:auto; background:var(--surface2);">
            
            <div class="section-title" style="margin-top:0;">1A. Profile Data</div>
            <div class="card" style="margin-bottom:15px; padding:15px;">
                <div class="fg"><label class="fl">Company Name</label><input type="text" id="pp-co" class="fi" value="${coName}"></div>
                <div class="fi-row">
                    <div class="fg"><label class="fl">Founder Name</label><input type="text" id="pp-fname" class="fi" value="${fName}"></div>
                    <div class="fg"><label class="fl">Role/Title</label><input type="text" id="pp-role" class="fi" value="${fRole}"></div>
                </div>
                <div class="fg"><label class="fl">Email</label><input type="email" id="pp-email" class="fi" value="${email}"></div>
                <div class="fi-row">
                    <div class="fg"><label class="fl">Website</label><input type="text" id="pp-web" class="fi" value="${website}"></div>
                    <div class="fg"><label class="fl">LinkedIn</label><input type="text" id="pp-li" class="fi" value="${linkedIn}"></div>
                </div>
                <div class="fg"><label class="fl">Funding Stage</label><input type="text" id="pp-funding" class="fi" value="${p.fundingStage || ''}"></div>
            </div>

            <div class="card" style="margin-bottom:15px; padding:15px;">
                <div class="card-label">Tri-Jurisdiction</div>
                <div class="fg"><label class="fl">HQ (Incorporation)</label><input type="text" id="pp-jur-hq" class="fi" value="${jHQ}"></div>
                <div class="fi-row">
                    <div class="fg"><label class="fl">Data Processing</label><input type="text" id="pp-jur-dp" class="fi" value="${jDP}"></div>
                    <div class="fg"><label class="fl">Servicing</label><input type="text" id="pp-jur-svc" class="fi" value="${jSvc}"></div>
                </div>
            </div>

            <div class="section-title">1B. Lex Nova Index</div>
            <div class="card" style="margin-bottom:15px; padding:15px; border-color:var(--gold-mid);">
                <div class="fi-row">
                    <div class="fg"><label class="fl">Campaign Batch</label><input type="text" id="pp-batch" class="fi" value="${batchVal}" maxlength="3"></div>
                    <div class="fg">
                        <label class="fl">Pipeline Status</label>
                        <select id="pp-status" class="fi">
                            <option value="QUEUED" ${p.status === 'QUEUED' ? 'selected' : ''}>QUEUED</option>
                            <option value="SEQUENCE" ${p.status === 'SEQUENCE' ? 'selected' : ''}>SEQUENCE</option>
                            <option value="ENGAGED" ${p.status === 'ENGAGED' ? 'selected' : ''}>ENGAGED</option>
                            <option value="NEGOTIATING" ${p.status === 'NEGOTIATING' ? 'selected' : ''}>NEGOTIATING</option>
                            <option value="CONVERTED" ${p.status === 'CONVERTED' ? 'selected' : ''}>CONVERTED (Won)</option>
                            <option value="ARCHIVED" ${p.status === 'ARCHIVED' ? 'selected' : ''}>ARCHIVED</option>
                            <option value="DEAD" ${p.status === 'DEAD' ? 'selected' : ''}>DEAD</option>
                        </select>
                    </div>
                </div>
            </div>

            <div class="section-title">1C. Sequencing Engine</div>
            <div class="card" style="margin-bottom:15px; background:var(--void); padding:15px;">
                <div class="fi-row" style="margin-bottom:10px;">
                    <div class="fg"><label class="fl" style="color:var(--gold);">CE Date (Launch)</label><input type="date" id="pp-cedate" class="fi" value="${p.ceDate || ''}"></div>
                    <div class="fg">
                        <label class="fl">Outreach Mode</label>
                        <select id="pp-outreach-mode" class="fi">
                            <option value="COLD" ${p.outreach_mode === 'COLD' ? 'selected' : ''}>COLD</option>
                            <option value="NEGOTIATING" ${p.outreach_mode === 'NEGOTIATING' ? 'selected' : ''}>NEGOTIATING</option>
                        </select>
                    </div>
                </div>
                <div class="fg" style="margin-bottom:10px;">
                    <label class="fl">Last Prospect Response</label>
                    <input type="datetime-local" id="pp-last-response" class="fi" value="${p.last_response_date ? new Date(p.last_response_date).toISOString().slice(0,16) : ''}">
                </div>
                <div style="font-size:11px; color:var(--marble-dim); line-height:1.8; display:flex; justify-content:space-between; border-top:1px solid var(--border); padding-top:10px;">
                    <div><strong>FU1:</strong> ${p.fu1_date || '...'}</div>
                    <div><strong>FU2:</strong> ${p.fu2_date || '...'}</div>
                    <div><strong>FU3:</strong> ${p.fu3_date || '...'}</div>
                    <div><strong>FU4:</strong> ${p.fu4_date || '...'}</div>
                </div>
            </div>

            <div class="section-title">1D. Scanner Tracking (Telemetry)</div>
            <div class="card" style="background:var(--void); padding:15px; margin-bottom:15px;">
                <div style="font-size:11px; color:var(--marble); line-height:2;">
                    <div style="border-bottom:1px solid var(--border2); padding-bottom:5px;"><strong>Scan Opened:</strong><br>${tClick}</div>
                    <div style="border-bottom:1px solid var(--border2); padding:5px 0;"><strong>Left Before Completion:</strong><br>${tDrop}</div>
                    <div style="padding-top:5px;"><strong>Scan Submitted:</strong><br>${tComp}</div>
                </div>
            </div>
            
            <div class="section-title">1E. Scanner Dash (Client View)</div>
            <div class="card" style="background:var(--void); padding:15px;">
                <div style="font-size:11px; color:var(--marble); display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                    <div><strong>Final Score:</strong> <span style="color:var(--gold); font-size:14px;">${p.scannerScore || p.scanner_score || 'N/A'}</span></div>
                    <div><strong>Liability Tier:</strong> ${p.client_liability_tier || 'N/A'}</div>
                    <div><strong>Dual Confirmed:</strong> ${p.dual_confirmed_count || '0'}</div>
                    <div><strong>New Threats:</strong> ${p.new_threats_count || '0'}</div>
                </div>
            </div>

        </div>
    </div>
    `;

    panelContainer.innerHTML = bodyHtml;
    panelContainer.classList.add('open');
};

/**
 * ==========================================
 * SECTION 5: LOGISTICS SAVER
 * ==========================================
 */
LexNova.UI.saveLogisticsFromPanel = function(pid) {
    const payload = {
        company: document.getElementById('pp-co').value.trim(),
        founderName: document.getElementById('pp-fname').value.trim(),
        founderRole: document.getElementById('pp-role').value.trim(),
        email: document.getElementById('pp-email').value.trim(),
        website: document.getElementById('pp-web').value.trim(),
        linkedIn: document.getElementById('pp-li').value.trim(),
        fundingStage: document.getElementById('pp-funding').value.trim(),
        batch: document.getElementById('pp-batch').value.trim().toUpperCase(),
        status: document.getElementById('pp-status').value,
        ceDate: document.getElementById('pp-cedate').value,
        outreach_mode: document.getElementById('pp-outreach-mode').value,
        last_response_date: document.getElementById('pp-last-response').value ? new Date(document.getElementById('pp-last-response').value).toISOString() : null,
        jurisdiction_hq: document.getElementById('pp-jur-hq').value.trim(),
        jurisdiction_dp: document.getElementById('pp-jur-dp').value.trim(),
        jurisdiction_svc: document.getElementById('pp-jur-svc').value.trim(),
        last_updated: new Date().toISOString()
    };

    if (LexNova.Ops && typeof LexNova.Ops.saveProspect === 'function') {
        LexNova.Ops.saveProspect(payload, pid);
        if (typeof window.toast === 'function') window.toast("Dossier Saved Successfully", "success");
    } else {
        console.error("[LexNova UI] Ops.saveProspect not found.");
    }
};
