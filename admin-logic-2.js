'use strict';

let allProspects = [];
let outreachListener = null;

function loadOutreach() {
  if (outreachListener) outreachListener();

  outreachListener = db.collection('prospects').onSnapshot(snap => {
    console.log("Acquisition Data Received:", snap.size);
    allProspects = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    // Force render all views simultaneously
    renderHuntTable();
    renderDealsBoard();
    
    // Populate batch filter dropdown if it exists
    const sel = document.getElementById('op-batch');
    if (sel) {
        const batches = [...new Set(allProspects.map(p => p.batchNumber).filter(Boolean))];
        sel.innerHTML = '<option value="">All Batches</option>' + batches.map(b => `<option value="${b}">${b}</option>`).join('');
    }
  });
}

function renderHuntTable() {
  const tbody = document.getElementById('op-tbody');
  if (!tbody) return;

  if (allProspects.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty">No targets found.</td></tr>';
    return;
  }

  tbody.innerHTML = allProspects.map(p => `
    <tr onclick="openPP('${p.id}')">
      <td>${esc(p.founderName || p.name)}</td>
      <td>${esc(p.company)}</td>
      <td>${esc(p.batchNumber)}</td>
      <td><span class="badge b-cold">${esc(p.status)}</span></td>
      <td>${p.scannerClicked ? '🔥' : '—'}</td>
      <td class="dim">${esc(p.linkedinStatus)}</td>
      <td class="dim">${esc(p.nextActionDate || '—')}</td>
    </tr>`).join('');
}

function renderDealsBoard() {
  const cols = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  allProspects.forEach(p => {
    if (p.status === 'Converted') cols[5].push(p);
    else if (p.scannerCompleted || p.hotFlag) cols[4].push(p);
    else if (p.scannerClicked || p.status === 'Replied') cols[3].push(p);
    else if (p.emailsSent > 0) cols[2].push(p);
    else cols[1].push(p);
  });

  for (let i = 1; i <= 5; i++) {
    const el = document.getElementById('kd-col-' + i);
    const cnt = document.getElementById('kd-c' + i);
    if (!el || !cnt) continue;
    cnt.textContent = cols[i].length;
    el.innerHTML = cols[i].map(p => `
        <div class="k-card" onclick="openPP('${p.id}')">
            <div class="k-name">${esc(p.founderName)}</div>
            <div class="k-comp">${esc(p.company)}</div>
        </div>`).join('');
  }
}

function filterProspects() { renderHuntTable(); }
