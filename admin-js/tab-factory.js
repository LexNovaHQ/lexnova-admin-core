// ════════════════════════════════════════════════════════════════════════
// ═════════ LEX NOVA ADMIN: PRODUCTION FLOOR (tab-factory.js) ════════════
// ════════════════════════════════════════════════════════════════════════
// Description: Manages the Factory Kanban, SLA Table, and active builds.
// ════════════════════════════════════════════════════════════════════════
'use strict';

// ─── LOCAL UTILITIES & CONSTANTS ────────────────────────────────────────
const $ = id => document.getElementById(id);
const STATUS_LABELS = { 
    pending_payment: 'Pending Payment', 
    payment_received: 'Payment Received', 
    intake_received: 'Intake Received', 
    under_review: 'Under Review', 
    in_production: 'In Production', 
    delivered: 'Delivered' 
};
const planLabel = k => ({ agentic_shield: 'Agentic Shield', workplace_shield: 'Workplace Shield', complete_stack: 'Complete Stack', flagship: 'Flagship' }[k] || k);
const statusLabel = k => STATUS_LABELS[k] || k;

function hoursSince(ts) { 
    if (!ts) return null; 
    const d = ts.toDate ? ts.toDate() : new Date(ts); 
    return Math.floor((Date.now() - d.getTime()) / 3600000); 
}

function planBadgeClass(p) { return { agentic_shield:'b-intake', workplace_shield:'b-warm', complete_stack:'b-production', flagship:'b-hot' }[p] || 'b-ghost'; }
function statusBadgeClass(s) { return { pending_payment:'b-pending', payment_received: 'b-delivered', intake_received:'b-intake', under_review:'b-review', in_production:'b-production', delivered:'b-delivered' }[s] || 'b-ghost'; }


// ════════════════════════════════════════════════════════════════════════
// ═════════ GLOBAL STATE FOR FACTORY ═════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
window.allClients = [];
let clientListener = null;


// ════════════════════════════════════════════════════════════════════════
// ═════════ THE FACTORY ENGINE (DATA SYNC) ═══════════════════════════════
// ════════════════════════════════════════════════════════════════════════
window.loadFactory = function() {
    // Clear top actions
    const pageActions = $('pageActions');
    if (pageActions) pageActions.innerHTML = '';

    if (clientListener) clientListener();
    
    const tbodies = document.querySelectorAll('#c-tbody');
    tbodies.forEach(tb => tb.innerHTML = '<tr><td colspan="9" class="loading">Loading…</td></tr>');
    
    clientListener = window.db.collection('clients').orderBy('createdAt','desc').onSnapshot(async (snap) => {
        // Ensure Radar Cache is loaded for Dashboards if needed
        if (typeof window.loadRadarCache === 'function') await window.loadRadarCache();
        
        window.allClients = [];
        snap.forEach(d => window.allClients.push({ id: d.id, ...d.data() }));
        
        try { renderClientsTable(window.allClients); } catch(e) { console.error('Table Error:', e); }
        try { renderFactoryBoard(); } catch(e) { console.error('Kanban Error:', e); }
        
        // Update Command Center SLA metrics dynamically if Dashboard is active
        if (typeof window.loadDashboard === 'function' && document.getElementById('tab-dashboard').classList.contains('active')) {
            window.loadDashboard();
        }
    });
};


// ════════════════════════════════════════════════════════════════════════
// ═════════ SOP DELIVERY BOARD (KANBAN) ══════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
function renderFactoryBoard() {
  const cols = { 1: [], 2: [], 3: [], 4: [] };

  window.allClients.forEach(c => {
    if (c.status === 'pending_payment' || c.status === 'payment_received') {
      cols[1].push(c); 
    } else if (c.status === 'intake_received' || c.status === 'under_review') {
      cols[2].push(c); 
    } else if (c.status === 'in_production') {
      cols[3].push(c); 
    } else if (c.status === 'delivered') {
      cols[4].push(c); 
    } else {
      cols[1].push(c); 
    }
  });

  for (let i = 1; i <= 4; i++) {
    const els = document.querySelectorAll('#kf-col-' + i);
    const cnts = document.querySelectorAll('#kf-c' + i);
    if (els.length === 0) continue;
    
    cnts.forEach(c => c.innerText = cols[i].length);
    
    const html = cols[i].length === 0 
      ? '<div class="empty" style="padding:20px; border:none;">Empty</div>'
      : cols[i].map(c => {
          const name = window.esc(c.baseline?.company || c.name || c.id);
          const plan = planLabel(c.plan);
          
          let slaText = 'Awaiting Intake';
          let slaStyle = 'color:var(--marble-faint)';
          const startTs = c.intakeReceivedAt || c.intakeSentAt || c.productionStartedAt || c.submittedAt; // Added submittedAt for V5
          
          if (c.status === 'delivered') {
              slaText = 'Deployed';
              slaStyle = 'color:var(--green);';
          } else if (startTs && (c.status === 'intake_received' || c.status === 'under_review' || c.status === 'in_production')) {
              const hRem = 48 - hoursSince(startTs);
              if (hRem <= 0) { slaText = '⚠ OVERDUE'; slaStyle = 'color:#d47a7a; font-weight:600;'; }
              else if (hRem <= 12) { slaText = `⚠ ${hRem}h left`; slaStyle = 'color:#d47a7a;'; }
              else { slaText = `${hRem}h left`; slaStyle = 'color:var(--gold);'; }
          }

          return `
            <div class="k-card" onclick="window.openDetail('${window.esc(c.id)}')">
              <div class="k-name">${name}</div>
              <div class="k-comp" style="color:var(--gold)">${plan}</div>
              <div class="k-meta">
                <span style="${slaStyle}">${slaText}</span>
                <span>${c.elAccepted ? 'EL ✓' : 'EL ⏳'}</span>
              </div>
            </div>
          `;
        }).join('');
        
    els.forEach(el => el.innerHTML = html);
  }
}


// ════════════════════════════════════════════════════════════════════════
// ═════════ SLA TABLE VIEW (MASTER LIST) ═════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
function renderClientsTable(list) {
    const tbodies = document.querySelectorAll('#c-tbody');
    if (tbodies.length === 0) return;
    
    const html = list.map(c => {
        const elBadge = !!c.elAccepted ? `<span class="badge b-delivered">✓ Yes</span>` : `<span class="badge b-ghost">—</span>`;
        let slaClock = '<span class="dim">—</span>';
        const startTs = c.intakeReceivedAt || c.intakeSentAt || c.productionStartedAt || c.submittedAt;

        if (c.status === 'delivered') {
            slaClock = `<span style="color:var(--green)">Deployed</span>`;
        } else if (startTs && (c.status === 'intake_received' || c.status === 'under_review' || c.status === 'in_production')) {
            const hRem = 48 - hoursSince(startTs);
            const cls = hRem <= 0 ? 'cd-over' : hRem <= 8 ? 'cd-warn' : 'cd-ok';
            slaClock = `<span class="countdown ${cls}">${hRem > 0 ? hRem + 'h left' : Math.abs(hRem) + 'h OVER'}</span>`;
        }
        
        return `<tr onclick="window.openDetail('${window.esc(c.id)}')">
            <td>
              <div style="font-size:11px;font-weight:600;">${window.esc(c.baseline?.company || c.name || '—')}</div>
              <div style="font-size:9px;color:var(--gold);font-family:'Cormorant Garamond',serif;">${window.esc(c.engagementRef||'')}</div>
            </td>
            <td class="dim">${window.esc(c.company||'—')}</td>
            <td><span class="badge ${planBadgeClass(c.plan)}">${planLabel(c.plan)}</span></td>
            <td><span class="badge ${statusBadgeClass(c.status)}">${statusLabel(c.status)}</span></td>
            <td>${slaClock}</td><td>${elBadge}</td><td class="dim">${window.esc(c.registrationJurisdiction || c.baseline?.hq || '—')}</td>
            <td><div class="radar-dots">●</div></td>
            <td class="dim">${window.formatDate(c.createdAt)}</td>
        </tr>`;
    }).join('');
    
    tbodies.forEach(tb => tb.innerHTML = html);
}


// ════════════════════════════════════════════════════════════════════════
// ═════════ SEARCH FILTER ENGINE ═════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════
window.filterClients = function() {
    const s = ($('c-search')?.value||'').toLowerCase();
    const list = window.allClients.filter(c => 
        !s || 
        (c.name||'').toLowerCase().includes(s) || 
        (c.email||c.id).toLowerCase().includes(s) || 
        (c.company||'').toLowerCase().includes(s) || 
        (c.baseline?.company||'').toLowerCase().includes(s) || 
        (c.engagementRef||'').toLowerCase().includes(s)
    );
    renderClientsTable(list);
};
