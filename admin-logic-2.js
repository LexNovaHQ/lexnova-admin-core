// admin-logic-2.js — Lex Nova HQ Admin Panel Logic (Part 2)
// Handles Outreach CRM, Radar Upsell Engine, Finance, Settings, and Prospect Panel.

import { collection, doc, getDoc, getDocs, setDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const db = window.db;

// --- 1. OUTREACH CRM (THE ENGINE) ---
window.loadOutreach = async function(view = 'all') {
    const container = document.getElementById('render-outreach');
    container.innerHTML = `<p class="text-marble opacity-50 uppercase text-xs tracking-widest">Loading CRM Engine...</p>`;
    
    try {
        const snap = await getDocs(collection(db, 'prospects'));
        let prospects = [];
        let stats = { total: 0, cold: 0, warm: 0, hot: 0, converted: 0, dead: 0, emailsToday: 0 };
        
        snap.forEach(doc => {
            const p = doc.data();
            prospects.push(p);
            stats.total++;
            if(p.status === 'Converted') stats.converted++;
            else if(p.status === 'Dead') stats.dead++;
            else {
                if(p.scannerCompleted) stats.hot++;
                else if(p.scannerClicked) stats.warm++;
                else stats.cold++;
            }
            // Basic daily tracking (checks if email1 was sent today)
            if(p.email1SentAt && new Date(p.email1SentAt.toDate()).toDateString() === new Date().toDateString()) stats.emailsToday++;
        });

        // Apply View Filters
        if (view === 'hot') prospects = prospects.filter(p => (p.scannerClicked || p.scannerCompleted) && p.status !== 'Converted');
        if (view === 'inbound') prospects = prospects.filter(p => p.source === 'inbound_scanner');

        let html = `
            <div class="grid grid-cols-4 gap-6 mb-8">
                <div class="p-4 border border-shadow bg-[#0a0a0a]">
                    <p class="text-[10px] uppercase tracking-widest text-marble opacity-50">Active Pipeline</p>
                    <h3 class="text-2xl font-serif text-gold">${stats.total - stats.dead - stats.converted}</h3>
                </div>
                <div class="p-4 border border-shadow bg-[#0a0a0a]">
                    <p class="text-[10px] uppercase tracking-widest text-marble opacity-50">Hot Signals 🔥</p>
                    <h3 class="text-2xl font-serif text-gold">${stats.hot + stats.warm}</h3>
                </div>
                <div class="p-4 border border-shadow ${stats.emailsToday >= 50 ? 'border-red-500' : ''} bg-[#0a0a0a]">
                    <p class="text-[10px] uppercase tracking-widest text-marble opacity-50">Daily Volume</p>
                    <h3 class="text-2xl font-serif text-gold">${stats.emailsToday} / 50</h3>
                </div>
                <div class="p-4 border border-shadow bg-[#0a0a0a]">
                    <p class="text-[10px] uppercase tracking-widest text-marble opacity-50">Conversions</p>
                    <h3 class="text-2xl font-serif text-gold">${stats.converted}</h3>
                </div>
            </div>

            <div class="flex gap-4 mb-6 border-b border-shadow pb-4 items-center">
                <button onclick="window.loadOutreach('all')" class="text-xs uppercase tracking-widest ${view==='all'?'text-gold':'text-marble opacity-50 hover:opacity-100'}">All Prospects</button>
                <button onclick="window.loadOutreach('hot')" class="text-xs uppercase tracking-widest ${view==='hot'?'text-gold':'text-marble opacity-50 hover:opacity-100'}">Hot Signals 🔥</button>
                <button onclick="window.loadOutreach('inbound')" class="text-xs uppercase tracking-widest ${view==='inbound'?'text-gold':'text-marble opacity-50 hover:opacity-100'}">Inbound</button>
                <button onclick="window.showAddProspect()" class="text-xs uppercase tracking-widest text-gold ml-auto border border-gold px-3 py-1 hover:bg-gold hover:text-void transition-colors">+ Add Prospect</button>
            </div>

            <table class="w-full text-left text-sm">
                <thead>
                    <tr class="border-b border-shadow text-[10px] uppercase tracking-widest text-marble opacity-50">
                        <th class="py-3 font-normal">Target Entity</th>
                        <th class="py-3 font-normal">Funding / Size</th>
                        <th class="py-3 font-normal">Status</th>
                        <th class="py-3 font-normal text-right">Action</th>
                    </tr>
                </thead>
                <tbody>
        `;

        if(prospects.length === 0) {
            html += `<tr><td colspan="4" class="py-4 text-xs opacity-50 italic">No prospects found in this view. Load Apollo data.</td></tr>`;
        } else {
            // Sort: Hot signals first, then newer
            prospects.sort((a, b) => (b.scannerCompleted ? 1 : 0) - (a.scannerCompleted ? 1 : 0));
            
            prospects.forEach(p => {
                let fire = p.scannerCompleted && p.status !== 'Converted' ? '🔥🔥' : (p.scannerClicked ? '🔥' : '');
                html += `
                    <tr class="border-b border-shadow/50 hover:bg-[#0a0a0a] transition-colors cursor-pointer" onclick="window.openDetailPanel('${p.email}', 'prospect')">
                        <td class="py-4"><p class="text-gold font-serif text-lg">${p.companyName || 'Unknown'} ${fire}</p><p class="text-xs opacity-50">${p.founderName || 'No Name'} • ${p.email}</p></td>
                        <td class="py-4 uppercase text-[10px] tracking-widest">${p.fundingStage || '-'}</td>
                        <td class="py-4 uppercase text-[10px] tracking-widest border border-shadow px-2 py-1 inline-block mt-3">${p.status || 'Cold'}</td>
                        <td class="py-4 text-xs text-marble opacity-50 hover:opacity-100 text-right">Update →</td>
                    </tr>
                `;
            });
        }
        html += `</tbody></table>`;
        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = `<p class="text-red-500 text-xs">CRM Fault: ${e.message}</p>`;
    }
}

// --- 2. PROSPECT DETAIL PANEL (Slide-out) ---
window.renderProspectDetail = async function(email) {
    const content = document.getElementById('panel-content');
    const nav = document.getElementById('panel-nav');
    
    try {
        const snap = await getDoc(doc(db, 'prospects', email));
        if(!snap.exists()) return;
        const p = snap.data();

        document.getElementById('panel-title').innerText = p.companyName || p.email;
        nav.innerHTML = `<span class="py-4 border-b-2 border-gold text-gold">Prospect CRM Record</span>`;

        content.innerHTML = `
            <div class="space-y-6">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-[10px] uppercase tracking-widest opacity-50 mb-2">Status</label>
                        <select class="w-full bg-void border border-shadow p-3 text-sm text-marble focus:border-gold outline-none" onchange="window.updateProspectField('${email}', 'status', this.value)">
                            <option value="Cold" ${p.status==='Cold'?'selected':''}>Cold</option>
                            <option value="Warm" ${p.status==='Warm'?'selected':''}>Warm (Clicked)</option>
                            <option value="Hot" ${p.status==='Hot'?'selected':''}>Hot (Completed)</option>
                            <option value="Replied" ${p.status==='Replied'?'selected':''}>Replied</option>
                            <option value="Negotiating" ${p.status==='Negotiating'?'selected':''}>Negotiating</option>
                            <option value="Converted" ${p.status==='Converted'?'selected':''}>Converted</option>
                            <option value="Dead" ${p.status==='Dead'?'selected':''}>Dead / Archived</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-[10px] uppercase tracking-widest opacity-50 mb-2">Scanner Engagement</label>
                        <div class="p-3 border border-shadow bg-[#0a0a0a] text-sm">
                            ${p.scannerCompleted ? '✅ Completed (' + (p.scannerScore||'-') + ')' : (p.scannerClicked ? '🟡 Clicked, Dropped' : '❌ No Engagement')}
                        </div>
                    </div>
                </div>
                
                <div>
                    <label class="block text-[10px] uppercase tracking-widest opacity-50 mb-2">Personalization Note (Icebreaker)</label>
                    <textarea class="w-full bg-void border border-shadow p-3 text-sm text-marble focus:border-gold outline-none h-24" onblur="window.updateProspectField('${email}', 'personalizationNote', this.value)">${p.personalizationNote || ''}</textarea>
                </div>

                <div class="border-t border-shadow pt-6">
                    <h4 class="text-gold font-serif text-lg mb-4">Email Sequence Log</h4>
                    <button onclick="window.logEmailSent('${email}', 'email1SentAt')" class="text-xs uppercase tracking-widest border border-shadow px-4 py-2 hover:border-gold hover:text-gold transition-colors mr-2">Log Email 1 Sent</button>
                    <button onclick="window.logEmailSent('${email}', 'email2SentAt')" class="text-xs uppercase tracking-widest border border-shadow px-4 py-2 hover:border-gold hover:text-gold transition-colors">Log Email 2 Sent</button>
                    <p class="text-[10px] uppercase tracking-widest opacity-50 mt-4">Last action recorded: ${p.email1SentAt ? new Date(p.email1SentAt.toDate()).toLocaleString() : 'None'}</p>
                </div>
            </div>
        `;
    } catch (e) {
        content.innerHTML = `<p class="text-red-500">Error loading prospect: ${e.message}</p>`;
    }
}

window.updateProspectField = async function(email, field, value) {
    await updateDoc(doc(db, 'prospects', email), { [field]: value });
    window.showToast(`${field} updated.`);
    loadOutreach(); // refresh pipeline behind panel
}

window.logEmailSent = async function(email, field) {
    await updateDoc(doc(db, 'prospects', email), { [field]: serverTimestamp() });
    window.showToast(`${field} logged.`);
    window.renderProspectDetail(email);
    loadOutreach();
}

// --- 3. RADAR UPSELL ENGINE ---
window.loadRadar = async function() {
    const container = document.getElementById('render-radar');
    container.innerHTML = `<p class="text-marble opacity-50 uppercase text-xs tracking-widest">Compiling Exposure Matrix...</p>`;
    
    try {
        const radarSnap = await getDoc(doc(db, 'settings', 'regulatory_radar'));
        const regulations = radarSnap.exists() ? radarSnap.data().items || [] : [];
        const clientsSnap = await getDocs(collection(db, 'clients'));
        
        let matrixHtml = ``;

        clientsSnap.forEach(cDoc => {
            const c = cDoc.data();
            if(c.status !== 'delivered') return;

            let redCount = 0; let yellowCount = 0;
            const now = new Date();
            const deliveredAt = c.deliveredAt ? c.deliveredAt.toDate() : new Date(0);

            regulations.forEach(reg => {
                if(c.operatingJurisdictions?.includes(reg.jurisdiction) && reg.coveredByPlan?.includes(c.plan)) {
                    const effDate = new Date(reg.effectiveDate);
                    if(effDate > now) yellowCount++; // FUTURE OPENING
                    else if(effDate <= now && effDate > deliveredAt) {
                        if(c.maintenanceActive) yellowCount++; // SCHEDULED (Owed)
                        else redCount++; // EXPOSED (Upsell)
                    }
                }
            });

            if(redCount > 0 || yellowCount > 0) {
                matrixHtml += `
                    <div class="flex justify-between items-center border-b border-shadow py-3">
                        <div>
                            <p class="text-gold font-serif text-lg">${c.company || c.name}</p>
                            <p class="text-[10px] uppercase tracking-widest opacity-50">${c.plan?.replace('_',' ')} • Maintenance: ${c.maintenanceActive ? 'ACTIVE' : 'NONE'}</p>
                        </div>
                        <div class="flex gap-4">
                            ${redCount > 0 ? `<span class="bg-red-900 text-red-100 border border-red-500 px-2 py-1 text-xs font-bold">🔴 ${redCount} EXPOSED</span>` : ''}
                            ${yellowCount > 0 ? `<span class="bg-yellow-900 text-yellow-100 border border-yellow-500 px-2 py-1 text-xs font-bold">🟡 ${yellowCount} PENDING</span>` : ''}
                        </div>
                    </div>
                `;
            }
        });

        container.innerHTML = `
            <div class="grid grid-cols-2 gap-8">
                <div>
                    <div class="flex justify-between mb-4 border-b border-shadow pb-2">
                        <h3 class="text-lg font-serif text-gold">Master Regulations</h3>
                        <button class="text-[10px] uppercase tracking-widest text-gold hover:underline">Manage JSON (Phase 2)</button>
                    </div>
                    <p class="text-xs opacity-50">Total tracked entries: ${regulations.length}</p>
                    <p class="text-xs opacity-50 italic mt-4">Note: Add new regulations via Firebase /settings document array for now to ensure schema integrity.</p>
                </div>
                
                <div class="bg-[#0a0a0a] border border-shadow p-6">
                    <h3 class="text-lg font-serif text-gold mb-4 border-b border-shadow pb-2">Client Exposure Matrix</h3>
                    <p class="text-[10px] uppercase tracking-widest text-marble opacity-50 mb-4">Daily Upsell Hit List</p>
                    ${matrixHtml || '<p class="text-xs opacity-50 italic">All delivered clients are fully covered. No upsell triggers active.</p>'}
                </div>
            </div>
        `;
    } catch (e) {
        container.innerHTML = `<p class="text-red-500 text-xs">Radar fault: ${e.message}</p>`;
    }
}

// --- 4. SHELLS FOR SECONDARY TABS ---
window.loadFlagship = function() {
    document.getElementById('render-flagship').innerHTML = `
        <div class="p-8 border border-shadow bg-[#0a0a0a] text-center">
            <h3 class="text-xl font-serif text-gold mb-2">Flagship Deal Architecture</h3>
            <p class="text-xs uppercase tracking-widest opacity-50">Awaiting first $15k+ Enterprise Lead to activate pipeline.</p>
        </div>`;
}

window.loadContent = function() {
    document.getElementById('render-content-log').innerHTML = `
        <div class="p-8 border border-shadow bg-[#0a0a0a] text-center">
            <h3 class="text-xl font-serif text-gold mb-2">LinkedIn Content Engine</h3>
            <p class="text-xs uppercase tracking-widest opacity-50">Content logging disabled during launch sprint.</p>
        </div>`;
}

window.loadFinance = function() {
    document.getElementById('render-finance').innerHTML = `
        <div class="p-8 border border-shadow bg-[#0a0a0a]">
            <h3 class="text-xl font-serif text-gold mb-4">Q1 Stress Test Tracker</h3>
            <table class="w-full text-left text-sm border-t border-shadow">
                <tr class="border-b border-shadow/50"><td class="py-3">Q1 Kit Sales Target</td><td class="text-right text-gold">30</td></tr>
                <tr class="border-b border-shadow/50"><td class="py-3">Current Pipeline Converted</td><td class="text-right text-gold">0</td></tr>
                <tr class="border-b border-shadow/50"><td class="py-3">Runway Status</td><td class="text-right text-red-500 uppercase text-[10px] tracking-widest">Critical - Outbound Required</td></tr>
            </table>
        </div>`;
}

window.loadSettings = function() {
    document.getElementById('render-settings').innerHTML = `
        <div class="p-8 border border-shadow bg-[#0a0a0a]">
            <h3 class="text-xl font-serif text-gold mb-4">System Architecture</h3>
            <p class="text-xs opacity-50 mb-2">Core API endpoints mapped to Make.com Scenarios 1-3.</p>
            <p class="text-xs opacity-50 mb-6">Database Key: email (Enforced natively).</p>
            <div class="p-4 bg-void border border-shadow">
                <p class="text-[10px] uppercase tracking-widest text-gold mb-1">Pillar Discipline Mandate</p>
                <p class="text-xs opacity-80">Do not unlock Pillar 2 (SaaS Contracts) until Pillar 1 achieves $8,000 MRR.</p>
            </div>
        </div>`;
}

window.showAddProspect = function() {
    alert("Manual prospect addition triggered. Paste Apollo data directly into Firebase /prospects collection to maintain data integrity during V1 launch.");
}
