// admin-logic-1.js — Lex Nova HQ Admin Panel Core Logic
// Handles Auth, Navigation, Dashboard, Clients, Leads, and the Detail Panel shell.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, updateDoc, setDoc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- 1. FIREBASE CONFIGURATION & INIT ---
const firebaseConfig = {
    apiKey: "AIzaSyDO4s_W8_87XnsLnuAfyUqgsF8BgaHRYWA",
    authDomain: "lexnova-hq.firebaseapp.com",
    projectId: "lexnova-hq",
    storageBucket: "lexnova-hq.firebasestorage.app",
    messagingSenderId: "539475214055",
    appId: "1:539475214055:web:c01a99ec94ff073a9b6c42"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Export to window so admin-logic-2.js can access them
window.db = db;
window.auth = auth;

// --- 2. AUTHENTICATION SHIELD ---
const loginOverlay = document.getElementById('login-overlay');
const mainContent = document.getElementById('main-content');
const sidebar = document.getElementById('sidebar');

onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Enforce RBAC: Verify user exists in /admins
        const adminRef = doc(db, 'admins', user.email.toLowerCase());
        const adminSnap = await getDoc(adminRef);
        
        if (adminSnap.exists()) {
            document.getElementById('currentUser').innerText = user.email;
            loginOverlay.classList.add('hidden');
            mainContent.classList.remove('hidden');
            sidebar.classList.remove('hidden');
            loadDashboard(); // Default Route
        } else {
            auth.signOut();
            showLoginError("UNAUTHORIZED: Not recognized as Lex Nova Admin.");
        }
    } else {
        loginOverlay.classList.remove('hidden');
        mainContent.classList.add('hidden');
        sidebar.classList.add('hidden');
    }
});

document.getElementById('loginBtn').addEventListener('click', async () => {
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPassword').value;
    document.getElementById('loginBtn').innerText = "Authenticating...";
    try {
        await signInWithEmailAndPassword(auth, email, pass);
        document.getElementById('loginBtn').innerText = "Authenticate";
    } catch (e) {
        document.getElementById('loginBtn').innerText = "Authenticate";
        showLoginError("Invalid credentials or access denied.");
    }
});

document.getElementById('logoutBtn').addEventListener('click', () => signOut(auth));

function showLoginError(msg) {
    const err = document.getElementById('loginError');
    err.innerText = msg;
    err.classList.remove('hidden');
}

// --- 3. NAVIGATION & ROUTING ---
document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
        // UI Reset
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active', 'border-l', 'border-gold', 'text-gold'));
        e.target.classList.add('active', 'border-l', 'border-gold', 'text-gold');
        
        const targetId = e.target.getAttribute('data-target');
        document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
        document.getElementById(targetId).classList.add('active');

        // Route Controller
        if (targetId === 'tab-dashboard') loadDashboard();
        if (targetId === 'tab-clients') loadClients();
        if (targetId === 'tab-leads') loadLeads();
        if (targetId === 'tab-outreach') window.loadOutreach && window.loadOutreach('all');
        if (targetId === 'tab-flagship') window.loadFlagship && window.loadFlagship();
        if (targetId === 'tab-content') window.loadContent && window.loadContent();
        if (targetId === 'tab-radar') window.loadRadar && window.loadRadar();
        if (targetId === 'tab-finance') window.loadFinance && window.loadFinance();
        if (targetId === 'tab-settings') window.loadSettings && window.loadSettings();
    });
});

// --- 4. DASHBOARD (COMMAND CENTRE) ---
async function loadDashboard() {
    const container = document.getElementById('render-dashboard');
    container.innerHTML = `<p class="text-marble opacity-50 uppercase text-xs tracking-widest">Compiling firm telemetry...</p>`;
    
    try {
        const clientsSnap = await getDocs(collection(db, 'clients'));
        const leadsSnap = await getDocs(collection(db, 'leads'));
        
        let mrr = 0;
        let totalRev = 0;
        let activeClients = 0;
        let alerts = [];
        
        clientsSnap.forEach(doc => {
            const data = doc.data();
            if (data.status !== 'delivered' && data.status !== 'dead') activeClients++;
            if (data.maintenanceActive) mrr += 297;
            totalRev += Number(data.price) || 0;

            // Alert Triggers
            if (data.status === 'intake_received') {
                const hours = (new Date() - (data.intakeSentAt?.toDate() || new Date())) / 36e5;
                if (hours > 48) alerts.push(`SLA BREACH: ${data.company || data.email} stuck in intake >48h.`);
            }
        });

        const alertHtml = alerts.length > 0 
            ? alerts.map(a => `<div class="p-4 bg-red-900 border border-red-500 text-red-100 text-xs tracking-widest uppercase mb-2">${a}</div>`).join('')
            : `<div class="p-4 border border-shadow bg-[#0a0a0a] text-marble opacity-50 text-xs tracking-widest uppercase mb-8">No SLA Breaches — All clear.</div>`;

        container.innerHTML = `
            <div class="grid grid-cols-4 gap-6 mb-8">
                <div class="p-6 border border-shadow bg-[#0a0a0a]">
                    <p class="text-[10px] uppercase tracking-widest text-marble opacity-50 mb-2">Total Collected</p>
                    <h3 class="text-3xl font-serif text-gold">$${totalRev.toLocaleString()}</h3>
                </div>
                <div class="p-6 border border-shadow bg-[#0a0a0a]">
                    <p class="text-[10px] uppercase tracking-widest text-marble opacity-50 mb-2">MRR (Maintenance)</p>
                    <h3 class="text-3xl font-serif text-gold">$${mrr.toLocaleString()}</h3>
                </div>
                <div class="p-6 border ${activeClients >= 5 ? 'border-red-500' : 'border-shadow'} bg-[#0a0a0a]">
                    <p class="text-[10px] uppercase tracking-widest text-marble opacity-50 mb-2">Active Production</p>
                    <h3 class="text-3xl font-serif ${activeClients >= 5 ? 'text-red-500' : 'text-gold'}">${activeClients} / 5</h3>
                </div>
                <div class="p-6 border border-shadow bg-[#0a0a0a]">
                    <p class="text-[10px] uppercase tracking-widest text-marble opacity-50 mb-2">Total Leads</p>
                    <h3 class="text-3xl font-serif text-gold">${leadsSnap.size}</h3>
                </div>
            </div>
            
            <h3 class="text-lg font-serif text-gold mb-4 border-b border-shadow pb-2">System Alerts</h3>
            ${alertHtml}
        `;
    } catch (e) {
        container.innerHTML = `<p class="text-red-500 text-xs">Dashboard fault: ${e.message}</p>`;
    }
}

// --- 5. CLIENTS HUB ---
async function loadClients() {
    const container = document.getElementById('render-clients');
    container.innerHTML = `<p class="text-marble opacity-50 uppercase text-xs tracking-widest">Fetching client pipeline...</p>`;
    
    try {
        const snap = await getDocs(collection(db, 'clients'));
        if (snap.empty) {
            container.innerHTML = `<p class="text-marble opacity-50 text-sm italic">Pipeline empty. You have 0 clients. Get to work.</p>`;
            return;
        }

        let html = `
            <table class="w-full text-left text-sm">
                <thead>
                    <tr class="border-b border-shadow text-[10px] uppercase tracking-widest text-marble opacity-50">
                        <th class="py-3 font-normal">Client Entity</th>
                        <th class="py-3 font-normal">Plan</th>
                        <th class="py-3 font-normal">Status</th>
                        <th class="py-3 font-normal">EL Lock</th>
                        <th class="py-3 font-normal text-right">Action</th>
                    </tr>
                </thead>
                <tbody>
        `;

        snap.forEach(doc => {
            const c = doc.data();
            html += `
                <tr class="border-b border-shadow/50 hover:bg-[#0a0a0a] transition-colors cursor-pointer" onclick="openDetailPanel('${c.email}', 'client')">
                    <td class="py-4"><p class="text-gold font-serif text-lg">${c.company || c.name || 'Unknown'}</p><p class="text-xs opacity-50">${c.email}</p></td>
                    <td class="py-4 text-xs uppercase tracking-widest">${c.plan?.replace('_', ' ') || 'N/A'}</td>
                    <td class="py-4 uppercase text-[10px] tracking-widest text-gold border border-gold px-2 py-1 inline-block mt-3">${c.status || 'pending_payment'}</td>
                    <td class="py-4 text-xs">${c.elAccepted ? '✅ Signed' : '❌ Pending'}</td>
                    <td class="py-4 text-xs text-marble opacity-50 hover:opacity-100 text-right">Manage →</td>
                </tr>
            `;
        });
        html += `</tbody></table>`;
        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = `<p class="text-red-500 text-xs">Error: ${e.message}</p>`;
    }
}

// --- 6. LEADS HUB ---
async function loadLeads() {
    const container = document.getElementById('render-leads');
    container.innerHTML = `<p class="text-marble opacity-50 uppercase text-xs tracking-widest">Fetching leads...</p>`;
    
    try {
        const snap = await getDocs(collection(db, 'leads'));
        if (snap.empty) {
            container.innerHTML = `<p class="text-marble opacity-50 text-sm italic">No leads. Run outbound.</p>`;
            return;
        }

        let html = `
            <table class="w-full text-left text-sm">
                <thead>
                    <tr class="border-b border-shadow text-[10px] uppercase tracking-widest text-marble opacity-50">
                        <th class="py-3 font-normal">Lead Identity</th>
                        <th class="py-3 font-normal">Type</th>
                        <th class="py-3 font-normal">Tracker (Source)</th>
                        <th class="py-3 font-normal text-right">Conversion</th>
                    </tr>
                </thead>
                <tbody>
        `;

        snap.forEach(doc => {
            const l = doc.data();
            html += `
                <tr class="border-b border-shadow/50 hover:bg-[#0a0a0a] transition-colors">
                    <td class="py-4"><p class="text-marble">${l.name || 'Anonymous'}</p><p class="text-xs opacity-50">${l.email}</p></td>
                    <td class="py-4 uppercase text-[10px] tracking-widest ${l.leadType === 'warm_lead' ? 'text-gold' : 'text-marble opacity-50'}">${l.leadType}</td>
                    <td class="py-4 uppercase text-[10px] tracking-widest opacity-50">${l.source || 'Unknown'}</td>
                    <td class="py-4 text-right">
                        ${l.status !== 'converted' 
                            ? `<button onclick="window.convertToProspect('${l.email}')" class="text-xs border border-shadow px-3 py-1 hover:border-gold hover:text-gold transition-colors">→ Prospect CRM</button>` 
                            : `<span class="text-xs opacity-30 uppercase tracking-widest">Converted</span>`}
                    </td>
                </tr>
            `;
        });
        html += `</tbody></table>`;
        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = `<p class="text-red-500 text-xs">Error: ${e.message}</p>`;
    }
}

// --- 7. GLOBAL DETAIL PANEL LOGIC ---
window.openDetailPanel = async function(docId, type) {
    const panel = document.getElementById('detail-panel');
    const title = document.getElementById('panel-title');
    const nav = document.getElementById('panel-nav');
    const content = document.getElementById('panel-content');
    
    content.innerHTML = `<p class="text-xs opacity-50 uppercase tracking-widest">Mounting Data...</p>`;
    panel.classList.add('open');

    if (type === 'client') {
        const snap = await getDoc(doc(db, 'clients', docId));
        if (!snap.exists()) return;
        const c = snap.data();
        title.innerText = c.company || c.name || c.email;

        // The 9-Tab Nav Shell
        nav.innerHTML = `
            <button class="py-4 border-b-2 border-gold text-gold" onclick="window.renderSubTab('overview', '${docId}')">Overview</button>
            <button class="py-4 border-b-2 border-transparent hover:border-gold hover:text-gold opacity-50" onclick="window.renderSubTab('intake', '${docId}')">Intake</button>
            <button class="py-4 border-b-2 border-transparent hover:border-gold hover:text-gold opacity-50" onclick="window.renderSubTab('checklist', '${docId}')">Checklist</button>
            <button class="py-4 border-b-2 border-transparent hover:border-gold hover:text-gold opacity-50" onclick="window.renderSubTab('documents', '${docId}')">Docs & EL</button>
            <button class="py-4 border-b-2 border-transparent hover:border-gold hover:text-gold opacity-50" onclick="window.renderSubTab('radar', '${docId}')">Radar</button>
            <button class="py-4 border-b-2 border-transparent hover:border-gold hover:text-gold opacity-50" onclick="window.renderSubTab('gap', '${docId}')">Gap Rev.</button>
            <button class="py-4 border-b-2 border-transparent hover:border-gold hover:text-gold opacity-50" onclick="window.renderSubTab('finance', '${docId}')">Finance</button>
        `;
        window.renderSubTab('overview', docId); 
    } else if (type === 'prospect') {
        // Prospect logic is handled via admin-logic-2.js, but routed here.
        if (window.renderProspectDetail) window.renderProspectDetail(docId);
    }
};

document.getElementById('close-panel').addEventListener('click', () => {
    document.getElementById('detail-panel').classList.remove('open');
});

// --- 8. SUB-TAB RENDERERS ---
window.renderSubTab = async function(tab, docId) {
    const content = document.getElementById('panel-content');
    const snap = await getDoc(doc(db, 'clients', docId));
    const c = snap.data();

    document.querySelectorAll('#panel-nav button').forEach(b => {
        b.classList.remove('border-gold', 'text-gold');
        b.classList.add('border-transparent', 'opacity-50');
        if (b.innerText.toLowerCase().includes(tab.substring(0,3))) {
            b.classList.remove('border-transparent', 'opacity-50');
            b.classList.add('border-gold', 'text-gold');
        }
    });

    if (tab === 'overview') {
        content.innerHTML = `
            <div class="space-y-6">
                <div>
                    <label class="block text-[10px] uppercase tracking-widest opacity-50 mb-2">Canonical Status</label>
                    <select class="w-full bg-void border border-shadow p-3 text-sm text-marble focus:border-gold outline-none" onchange="window.updateClientField('${docId}', 'status', this.value)">
                        <option value="pending_payment" ${c.status === 'pending_payment' ? 'selected' : ''}>Pending Payment</option>
                        <option value="payment_received" ${c.status === 'payment_received' ? 'selected' : ''}>Payment Received (No Intake)</option>
                        <option value="intake_received" ${c.status === 'intake_received' ? 'selected' : ''}>Intake Received</option>
                        <option value="under_review" ${c.status === 'under_review' ? 'selected' : ''}>Under Review</option>
                        <option value="in_production" ${c.status === 'in_production' ? 'selected' : ''}>In Production</option>
                        <option value="delivered" ${c.status === 'delivered' ? 'selected' : ''}>Delivered</option>
                    </select>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-[10px] uppercase tracking-widest opacity-50 mb-2">Plan</label>
                        <p class="text-sm bg-[#0a0a0a] border border-shadow p-3">${c.plan || 'UNKNOWN'}</p>
                    </div>
                    <div>
                        <label class="block text-[10px] uppercase tracking-widest opacity-50 mb-2">Engagement Ref</label>
                        <p class="text-sm bg-[#0a0a0a] border border-shadow p-3">${c.engagementRef || 'Pending Generator'}</p>
                    </div>
                </div>
                <div>
                    <label class="block text-[10px] uppercase tracking-widest opacity-50 mb-2">Contract Law (Reg. Jurisdiction)</label>
                    <p class="text-sm bg-[#0a0a0a] border border-shadow p-3 uppercase">${c.registrationJurisdiction || 'N/A'}</p>
                </div>
            </div>
        `;
    } else {
        content.innerHTML = `<p class="text-xs opacity-50 italic">Sub-tab [${tab}] structure mounted. Waiting for advanced data from admin-logic-2.</p>`;
    }
};

// --- 9. GLOBAL HELPERS ---
window.updateClientField = async function(docId, field, value) {
    try {
        await updateDoc(doc(db, 'clients', docId), { [field]: value });
        window.showToast(`${field} updated successfully.`);
        if(field === 'status') loadClients();
    } catch (e) {
        alert("DB Write Failed: " + e.message);
    }
};

window.convertToProspect = async function(email) {
    if(!confirm('Convert this lead to a Prospect in the CRM?')) return;
    try {
        const snap = await getDoc(doc(db, 'leads', email));
        if(!snap.exists()) return;
        const l = snap.data();
        
        // Write to Prospects
        await setDoc(doc(db, 'prospects', email), {
            email: l.email,
            founderName: l.name || '',
            companyName: l.company || '',
            scannerCompleted: l.leadType === 'warm_lead',
            source: 'inbound_scanner',
            status: 'Hot',
            createdAt: serverTimestamp()
        }, { merge: true });

        // Update Lead status
        await updateDoc(doc(db, 'leads', email), { status: 'converted' });
        
        window.showToast("Converted to Prospect.");
        loadLeads();
    } catch (e) {
        alert("Conversion Failed: " + e.message);
    }
}

window.showToast = function(msg) {
    const t = document.getElementById('toast');
    t.innerText = msg;
    t.classList.remove('hidden');
    setTimeout(() => t.classList.add('hidden'), 3000);
}
