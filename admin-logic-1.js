'use strict';

const PLANS = { agentic_shield: 'Agentic Shield', workplace_shield: 'Workplace Shield', complete_stack: 'Complete Stack', flagship: 'Flagship' };
const STATUS_LABELS = { pending_payment: 'Pending Payment', payment_received: 'Payment Received', intake_received: 'Intake Received', under_review: 'Under Review', in_production: 'In Production', delivered: 'Delivered' };

let allClients = [];
let clientListener = null;

function init() { nav('dashboard'); }

function nav(tab) {
    document.querySelectorAll('.tab-content').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(l => l.classList.remove('active'));
    
    const targetTab = document.getElementById('tab-' + tab);
    const targetNav = document.querySelector(`.nav-item[data-tab="${tab}"]`);
    if(targetTab) targetTab.classList.add('active');
    if(targetNav) targetNav.classList.add('active');

    // Tab-specific loaders
    if (tab === 'dashboard') loadDashboard();
    if (tab === 'factory') loadClients();
    
    // NEW: Trigger Logic 2 Sync if on Hunt or Deals
    if ((tab === 'hunt' || tab === 'deals') && typeof loadOutreach === 'function') {
        loadOutreach();
    }
}

function loadClients() {
    if (clientListener) clientListener();
    clientListener = db.collection('clients').onSnapshot(snap => {
        allClients = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderFactoryBoard();
    });
}

function renderFactoryBoard() {
    const cols = { 1: [], 2: [], 3: [], 4: [] };
    allClients.forEach(c => {
        if (c.status === 'delivered') cols[4].push(c);
        else if (c.status === 'in_production') cols[3].push(c);
        else if (c.status === 'intake_received') cols[2].push(c);
        else cols[1].push(c);
    });

    for (let i = 1; i <= 4; i++) {
        const el = document.getElementById('kf-col-' + i);
        const cnt = document.getElementById('kf-c' + i);
        if (!el || !cnt) continue;
        cnt.textContent = cols[i].length;
        el.innerHTML = cols[i].map(c => `<div class="k-card" onclick="openDetail('${c.id}')"><div class="k-name">${esc(c.name)}</div></div>`).join('');
    }
}
