/**
 * ═════════════════════════════════════════════════════════════
 * LEX NOVA CRM v6.0 — MODULE 5: UI & DOM RENDERING ENGINE
 * ═════════════════════════════════════════════════════════════
 * This module is completely decoupled from the database. It only 
 * reads LexNova.State and paints the DOM. It contains the Main Tables
 * and the massive V5.0 ICP Intelligence Panel.
 */

window.LexNova = window.LexNova || {};
LexNova.UI = LexNova.UI || {};

// Local UI State for Sorting and Filtering
LexNova.UI.State = {
    currentTab: 'SEQUENCE', // QUEUED, SEQUENCE, NEGOTIATING
    sortCol: 'last_updated',
    sortDesc: true
};

/**
 * ==========================================
 * 1. THE MAIN DASHBOARD & TABLES
 * ==========================================
 * Renders the top metrics and the active pipeline tables.
 * To use this, ensure your HTML has a <div id="v5-crm-app"></div> where the tab loads.
 */
LexNova.UI.renderTables = function() {
    const container = document.getElementById('v5-crm-app') || document.getElementById('tab-body');
    if (!container) return;

    const m = LexNova.State.metrics;
    const pList = [...LexNova.State.allProspects];

    // Filter by Active Tab
    let filtered = pList.filter(p => p.status === LexNova.UI.State.currentTab);
    if (LexNova.UI.State.currentTab === 'QUEUED') {
        filtered = pList.filter(p => p.status === 'QUEUED' || !p.ceDate);
    }

    // Sort Logic
    filtered.sort((a, b) => {
        let valA = a[LexNova.UI.State.sortCol] || '';
        let valB = b[LexNova.UI.State.sortCol] || '';
        
        // Handle specific nested/calculated sorts
        if (LexNova.UI.State.sortCol === 'confidence') {
            valA = a.ghost_protection_global?.confidence_score || 0;
            valB = b.ghost_protection_global?.confidence_score || 0;
        }

        if (valA < valB) return LexNova.UI.State.sortDesc ? 1 : -1;
        if (valA > valB) return LexNova.UI.State.sortDesc ? -1 : 1;
        return 0;
    });

    // Scanner Comparative %
    const scanPct = m.inSequence > 0 ? Math.round((m.scansClicked / m.inSequence) * 100) : 0;

    let html = `
    <div style="display:flex; gap:15px; margin-bottom: 20px;">
        <div class="card" style="flex:1;">
            <div style="font-size:10px; color:var(--gold);">PIPELINE HEALTH</div>
            <div style="display:flex; justify-content:space-between; margin-top:10px;">
                <div><span style="font-size:24px;">${m.total}</span><br><span style="font-size:9px; color:var(--marble-dim);">Total Targets</span></div>
                <div><span style="font-size:24px; color:var(--green);">${m.inSequence}</span><br><span style="font-size:9px; color:var(--marble-dim);">In Sequence</span></div>
                <div><span style="font-size:24px;">${m.v5Intel}</span><br><span style="font-size:9px; color:var(--marble-dim);">V5.0 Intel</span></div>
                <div><span style="font-size:24px; color:var(--red);">${m.bottleneck}</span><br><span style="font-size:9px; color:var(--marble-dim);">Bottlenecks</span></div>
            </div>
        </div>
        <div class="card" style="flex:1;">
            <div style="font-size:10px; color:var(--gold);">SCANNER TELEMETRY</div>
            <div style="display:flex; justify-content:space-between; margin-top:10px;">
                <div><span style="font-size:24px;">${m.scansClicked}</span> <span style="font-size:12px; color:var(--gold);">(${scanPct}%)</span><br><span style="font-size:9px; color:var(--marble-dim);">Clicked</span></div>
                <div><span style="font-size:24px;">${m.scansDropped}</span><br><span style="font-size:9px; color:var(--marble-dim);">Dropped</span></div>
                <div><span style="font-size:24px; color:var(--green);">${m.scansCompleted}</span><br><span style="font-size:9px; color:var(--marble-dim);">Completed</span></div>
            </div>
        </div>
    </div>

    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
        <div style="display:flex; gap:10px;">
            <button class="btn ${LexNova.UI.State.currentTab === 'QUEUED' ? 'btn-primary' : 'btn-outline'}" onclick="LexNova.UI.setTab('QUEUED')">Unscheduled (${m.unscheduled})</button>
            <button class="btn ${LexNova.UI.State.currentTab === 'SEQUENCE' ? 'btn-primary' : 'btn-outline'}" onclick="LexNova.UI.setTab('SEQUENCE')">In Sequence (${m.inSequence})</button>
            <button class="btn ${LexNova.UI.State.currentTab === 'NEGOTIATING' ? 'btn-primary' : 'btn-outline'}" onclick="LexNova.UI.setTab('NEGOTIATING')">Negotiating</button>
        </div>
        <div>
            <button class="btn btn-primary" onclick="LexNova.Ingestion.openV5Modal()">📥 Add New V5.0 ICP</button>
        </div>
    </div>

    <div class="card" style="overflow-x:auto;">
        <table style="width:100%; text-align:left; border-collapse:collapse; font-size:11px;">
            <thead>
                <tr style="border-bottom:1px solid var(--border); color:var(--gold);">
                    <th style="padding:10px; cursor:pointer;" onclick="LexNova.UI.setSort('id')">Target / PID ${LexNova.UI.getSortIcon('id')}</th>
                    <th style="padding:10px; cursor:pointer;" onclick="LexNova.UI.setSort('batch')">Batch ${LexNova.UI.getSortIcon('batch')}</th>
                    <th style="padding:10px; cursor:pointer;" onclick="LexNova.UI.setSort('confidence')">Intel Status ${LexNova.UI.getSortIcon('confidence')}</th>
                    <th style="padding:10px;">Pipeline State</th>
                    <th style="padding:10px; cursor:pointer;" onclick="LexNova.UI.setSort('ceDate')">CE / Next Action ${LexNova.UI.getSortIcon('ceDate')}</th>
                </tr>
            </thead>
            <tbody>
                ${filtered.map(p => LexNova.UI.buildRow(p)).join('')}
            </tbody>
        </table>
        ${filtered.length === 0 ? '<div style="padding:20px; text-align:center; color:var(--marble-dim);">No targets in this view.</div>' : ''}
    </div>
    `;

    container.innerHTML = html;
};

LexNova.UI.buildRow = function(p) {
    const isV5 = p.true_gaps && p.true_gaps.length > 0;
    const intelBadge = isV5 ? `<span style="color:var(--green);">V5.0</span>` : `<span style="color:var(--red);">LEGACY</span>`;
    const confTier = p.ghost_protection_global?.confidence_tier || 'N/A';
    
    // Liability color based on G1 category or gaps
    let liaColor = "var(--marble)";
    if (p.G1_category === "DIRECT_LIABILITY") liaColor = "var(--red)";
    else if (p.G1_category === "DUAL_EXPOSURE") liaColor = "var(--gold)";

    return `
    <tr style="border-bottom:1px solid var(--surface2); cursor:pointer;" onclick="LexNova.UI.openProspectPanel('${p.id}')">
        <td style="padding:10px;">
            <strong style="color:var(--marble); font-size:12px;">${p.founderName || 'Unknown'}</strong><br>
            <span style="color:var(--marble-dim);">${p.company || 'Unknown'} | ${p.id}</span>
        </td>
        <td style="padding:10px;">${p.batch || 'N/A'}</td>
        <td style="padding:10px;">
            <span style="font-weight:bold; color:${liaColor};">● ${confTier} ALIBI</span><br>
            <span style="font-size:9px;">${intelBadge}</span>
        </td>
        <td style="padding:10px;">
            <span class="b-ghost">${p.status}</span><br>
            <span style="font-size:9px; color:var(--marble-dim);">Scan: ${p.scanner_completed ? '✅' : (p.scanner_clicked ? 'Clicked' : 'Unopened')}</span>
        </td>
        <td style="padding:10px;">
            ${p.ceDate ? p.ceDate : '<span style="color:var(--red);">Unscheduled</span>'}<br>
            <span style="font-size:9px; color:var(--gold);">Updated: ${p.last_updated ? p.last_updated.split('T')[0] : 'N/A'}</span>
        </td>
    </tr>
    `;
};

// Sorting Helpers
LexNova.UI.setTab = function(tab) { LexNova.UI.State.currentTab = tab; LexNova.UI.renderTables(); };
LexNova.UI.setSort = function(col) {
    if (LexNova.UI.State.sortCol === col) LexNova.UI.State.sortDesc = !LexNova.UI.State.sortDesc;
    else { LexNova.UI.State.sortCol = col; LexNova.UI.State.sortDesc = true; }
    LexNova.UI.renderTables();
};
LexNova.UI.getSortIcon = function(col) {
    if (LexNova.UI.State.sortCol !== col) return '';
    return LexNova.UI.State.sortDesc ? '↓' : '↑';
};


/**
 * ==========================================
 * 2. THE ICP INTELLIGENCE MODAL (PANEL)
 * ==========================================
 * The massive split-screen view for deep target analysis.
 */
LexNova.UI.openProspectPanel = function(pid) {
    const p = LexNova.State.allProspects.find(x => x.id === pid);
    if (!p) return;

    const isLegacy = !p.true_gaps || p.true_gaps.length === 0;
    const scannerUrl = `https://lexnovahq.com/scanner.html?pid=${p.id}`;

    // Sort gaps T1 -> T3
    let displayGaps = isLegacy ? (p.forensicGaps || []) : (p.true_gaps || []);
    if (!isLegacy) {
        displayGaps.sort((a, b) => (a.Pain_Tier || 'T9').localeCompare(b.Pain_Tier || 'T9'));
    }

    const title = `Target Dossier: ${p.company || p.id}`;
    
    // I. Header & Action Bar
    const bodyHtml = `
    <div style="display:flex; justify-content:space-between; align-items:center; background:var(--surface2); padding:15px; border-radius:4px; margin-bottom:15px;">
        <div>
            <div style="font-size:18px; font-weight:bold; color:var(--marble);">${p.company || 'Unknown Company'}</div>
            <div style="font-size:11px; color:var(--gold);">${p.id} | ${p.founderName || 'No Founder'} - ${p.founderRole || 'No Role'}</div>
        </div>
        <div style="text-align:right;">
            <div style="font-size:10px; color:var(--marble-dim);">HQ: ${p.jurisdiction || 'N/A'}</div>
            <div style="font-size:10px; color:var(--marble-dim);">Added: ${p.date_added ? p.date_added.split('T')[0] : 'N/A'}</div>
        </div>
    </div>

    <div style="display:flex; gap:10px; margin-bottom:20px; align-items:center; background:var(--void); padding:10px; border:1px solid var(--border);">
        <div style="display:flex; align-items:center; gap:5px; flex:1;">
            <span style="font-size:10px; color:var(--gold);">Scanner:</span>
            <input type="text" id="pp-scan-link" value="${scannerUrl}" readonly style="width:200px; font-size:10px; background:var(--surface2); border:1px solid var(--border); color:var(--marble); padding:4px;">
            <button class="btn btn-outline" style="padding:4px 8px; font-size:10px;" onclick="navigator.clipboard.writeText(document.getElementById('pp-scan-link').value); window.toast('Copied!', 'success');">📋 Copy</button>
        </div>
        <button class="btn btn-outline" onclick="LexNova.Ingestion.openV5Modal('${p.id}')">🔄 V5.0 Update</button>
        <button class="btn btn-outline" onclick="LexNova.Export.copySpearReport('${p.id}')">🎯 Copy Spear</button>
        <button class="btn btn-outline" onclick="LexNova.Export.copyDossier('${p.id}')">📁 Copy Dossier</button>
        <button class="btn btn-primary" onclick="LexNova.UI.saveLogisticsFromPanel('${p.id}')">💾 Save Logistics</button>
        <button class="btn btn-outline" style="border-color:var(--red); color:var(--red);" onclick="LexNova.Ops.deleteProspect('${p.id}')">🗑️ Delete</button>
    </div>

    <div style="display:flex; gap:20px;">
        
        <div style="flex:2; height: 60vh; overflow-y:auto; padding-right:10px;">
            ${isLegacy ? `<div style="background:var(--red); color:#fff; padding:10px; font-weight:bold; font-size:11px; text-align:center; margin-bottom:15px; animation: pulse 2s infinite;">⚠️ LEGACY V6/V7 DATA DETECTED. FULL V5.0 SCAN REQUIRED.</div>` : ''}
            
            <div class="card" style="margin-bottom:15px;">
                <div class="card-label">Product Architecture</div>
                <div style="font-size:11px; color:var(--marble);">
                    <strong>Primary Claim:</strong> ${p.primary_claim || 'N/A'}<br>
                    <strong>Product:</strong> ${p.primaryProduct?.product_name || 'N/A'} <br>
                    <strong>Archetypes:</strong> ${(p.archetypes || []).join(', ')}<br>
                    <strong>Jurisdictions:</strong> ${(p.jurisdictional_surface || []).join(', ')}
                </div>
            </div>

            <div class="card" style="margin-bottom:15px; border-left: 3px solid ${p.G1_category === 'DIRECT_LIABILITY' ? 'var(--red)' : 'var(--gold)'};">
                <div class="card-label">Global Forensics & Alibis</div>
                <div style="font-size:11px; color:var(--marble); display:flex; flex-direction:column; gap:8px;">
                    <div><strong>Classification:</strong> ${p.G1_category || 'N/A'}</div>
                    <div><strong>Confidence:</strong> ${p.ghost_protection_global?.confidence_tier || 'N/A'} (${p.ghost_protection_global?.confidence_score || '0'})</div>
                    <div><strong>Ghost Hook:</strong> <span style="color:var(--gold);">${p.ghost_protection_global?.ghost_protection_vector || '[Requires V5.0 Update]'}</span></div>
                    <div><strong>Posture Alibi:</strong> ${p.ghost_protection_global?.posture_alibi?.argument || '[Requires V5.0 Update]'}</div>
                    <div><strong>Legal Stack Failure:</strong> ${p.ghost_protection_global?.legal_stack_alibi?.overall_inadequacy || 'N/A'}</div>
                </div>
            </div>

            <div style="font-size:14px; font-weight:bold; color:var(--gold); margin-bottom:10px;">Threat Matrix (${displayGaps.length} Gaps)</div>
            
            ${displayGaps.map((g, i) => {
                const isT1 = g.Pain_Tier === 'T1' || g.Pain_Tier === 'T2';
                const cardStyle = isT1 ? "border-color:var(--red);" : "border-color:var(--gold-mid);";
                return `
                <div class="card" style="margin-bottom:10px; padding:10px; ${cardStyle}">
                    <details>
                        <summary style="font-weight:bold; font-size:12px; cursor:pointer; color:var(--marble);">
                            <span style="color:${isT1 ? 'var(--red)' : 'var(--gold)'};">[${g.Pain_Tier || 'LEG'}]</span> 
                            ${g.Threat_Name || g.gapName || 'Unknown Threat'} 
                            <span style="font-size:9px; float:right; color:var(--marble-dim);">${g.Threat_ID || 'N/A'}</span>
                        </summary>
                        <div style="margin-top:10px; font-size:11px; color:var(--marble-dim); display:grid; grid-template-columns: 1fr; gap:6px;">
                            ${isLegacy ? `
                                <div><em>Legacy Note: This is an unhydrated older threat.</em></div>
                                <div><strong>Remediation:</strong> ${g.remediationPlan || 'N/A'}</div>
                            ` : `
                                <div><strong>Feature:</strong> ${g.feature_ref} (${g.feature_type})</div>
                                <div style="background:var(--void); padding:6px; border-left:2px solid var(--gold);"><strong>Coffee-Test Mechanism:</strong> ${g.FP_Mechanism}</div>
                                <div><strong>Impact:</strong> ${g.FP_Impact}</div>
                                <div><strong>Structural Absence:</strong> ${g.structural_absence}</div>
                                <div><strong>Predator Signature:</strong> ${g.predator_signature}</div>
                                <div style="background:var(--void); padding:6px; border-left:2px solid var(--red);">
                                    <strong>Evidence Quote:</strong> "${g.proof_citation}"<br>
                                    <a href="${g.evidence_source}" target="_blank" style="color:var(--gold);">Source Link</a>
                                </div>
                                <div><strong>Lex Nova Fix:</strong> <span style="color:var(--green);">${g.Lex_Nova_Fix}</span></div>
                            `}
                        </div>
                    </details>
                </div>
                `;
            }).join('')}
        </div>

        <div style="flex:1; height: 60vh; overflow-y:auto; border-left:1px solid var(--border); padding-left:20px;">
            <div class="card-label">Operations & Pipeline</div>
            
            <div class="fg"><label class="fl">Email</label><input type="email" id="pp-email" class="fi" value="${p.email || ''}"></div>
            <div class="fg"><label class="fl">Funding</label><input type="text" id="pp-funding" class="fi" value="${p.fundingStage || 'Unverified'}"></div>
            
            <hr style="border-color:var(--border); margin:15px 0;">
            
            <div class="fg"><label class="fl">Batch</label><input type="text" id="pp-batch" class="fi" value="${p.batch || ''}" maxlength="3"></div>
            <div class="fg">
                <label class="fl">Status</label>
                <select id="pp-status" class="fi">
                    <option value="QUEUED" ${p.status === 'QUEUED' ? 'selected' : ''}>QUEUED</option>
                    <option value="SEQUENCE" ${p.status === 'SEQUENCE' ? 'selected' : ''}>SEQUENCE</option>
                    <option value="ENGAGED" ${p.status === 'ENGAGED' ? 'selected' : ''}>ENGAGED</option>
                    <option value="NEGOTIATING" ${p.status === 'NEGOTIATING' ? 'selected' : ''}>NEGOTIATING</option>
                    <option value="CONVERTED" ${p.status === 'CONVERTED' ? 'selected' : ''}>CONVERTED (Trigger Factory)</option>
                    <option value="ARCHIVED" ${p.status === 'ARCHIVED' ? 'selected' : ''}>ARCHIVED</option>
                    <option value="DEAD" ${p.status === 'DEAD' ? 'selected' : ''}>DEAD</option>
                </select>
            </div>

            <div class="card" style="background:var(--void); margin-top:15px;">
                <div class="card-label" style="font-size:9px;">Sequence Dates (Auto-Skips Weekends)</div>
                <div class="fg"><label class="fl">CE Date (Launch)</label><input type="date" id="pp-cedate" class="fi" value="${p.ceDate || ''}"></div>
                <div style="font-size:10px; color:var(--marble-dim);">
                    FU1: ${p.fu1_date || '...'} <br>
                    FU2: ${p.fu2_date || '...'} <br>
                    FU3: ${p.fu3_date || '...'} <br>
                    FU4: ${p.fu4_date || '...'}
                </div>
            </div>

            <div class="card" style="background:var(--void); margin-top:15px;">
                <div class="card-label" style="font-size:9px;">Scanner Telemetry</div>
                <label style="font-size:10px; display:block;"><input type="checkbox" id="pp-scan-click" ${p.scanner_clicked ? 'checked' : ''}> Clicked</label>
                <label style="font-size:10px; display:block; margin-top:5px;"><input type="checkbox" id="pp-scan-drop" ${p.scanner_dropped ? 'checked' : ''}> Dropped</label>
                <label style="font-size:10px; display:block; margin-top:5px;"><input type="checkbox" id="pp-scan-comp" ${p.scanner_completed ? 'checked' : ''}> Completed</label>
            </div>

        </div>
    </div>
    `;

    // Empty footer as actions are in the command bar
    if(typeof window.openModal === 'function') window.openModal('', bodyHtml, '');
};

/**
 * ==========================================
 * 3. LOGISTICS SAVER
 * ==========================================
 * Scrapes the inputs from the right column of the ICP panel and updates Firebase.
 */
LexNova.UI.saveLogisticsFromPanel = function(pid) {
    const payload = {
        email: document.getElementById('pp-email').value.trim(),
        fundingStage: document.getElementById('pp-funding').value.trim(),
        batch: document.getElementById('pp-batch').value.trim().toUpperCase(),
        status: document.getElementById('pp-status').value,
        ceDate: document.getElementById('pp-cedate').value,
        scanner_clicked: document.getElementById('pp-scan-click').checked,
        scanner_dropped: document.getElementById('pp-scan-drop').checked,
        scanner_completed: document.getElementById('pp-scan-comp').checked,
        last_updated: new Date().toISOString()
    };

    if (LexNova.Ops && typeof LexNova.Ops.saveProspect === 'function') {
        LexNova.Ops.saveProspect(payload, pid);
    }
};

/**
 * Ensure Dashboards re-render when the core updates
 */
LexNova.UI.renderDashboards = function() {
    // This is handled inside renderTables() now to keep DOM manipulation centralized.
    LexNova.UI.renderTables();
};
