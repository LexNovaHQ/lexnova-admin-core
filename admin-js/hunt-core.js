/**
 * ═════════════════════════════════════════════════════════════
 * LEX NOVA CRM v6.0 — MODULE 1: CORE STATE & PIPELINE (V5.0 API)
 * ═════════════════════════════════════════════════════════════
 * This module establishes the master namespace and controls the 
 * single source of truth for the entire prospect database.
 */

// 1. Establish Safe Namespace
window.LexNova = window.LexNova || {};

// 2. Safe Property Assignment (Prevents wiping out Ingestion, Ops, or UI modules)
Object.assign(window.LexNova, {
    State: window.LexNova.State || {
        allProspects: [], 
        metrics: {
            total: 0, inSequence: 0, v5Intel: 0, unscheduled: 0, 
            archived: 0, bottleneck: 0, scansClicked: 0, 
            scansDropped: 0, scansCompleted: 0
        }
    },
    Core: window.LexNova.Core || {},
    Ingestion: window.LexNova.Ingestion || {},
    Ops: window.LexNova.Ops || {},
    Export: window.LexNova.Export || {},
    UI: window.LexNova.UI || {}
});

/**
 * ==========================================
 * MASTER FIREBASE LISTENER
 * ==========================================
 * Replaces the legacy onSnapshot from tab-hunt-deals.js.
 */
LexNova.Core.init = function() {
    if (!window.db) {
        console.error("[LexNova Core] Firebase DB not initialized.");
        return;
    }

    console.log("[LexNova Core] Initializing V5.0 Data Pipeline...");

    window.db.collection('prospects').onSnapshot(snapshot => {
        const prospects = [];
        snapshot.forEach(doc => {
            prospects.push({ id: doc.id, ...doc.data() });
        });

        // Update Master State
        LexNova.State.allProspects = prospects;
        
        // Maintain legacy global array so Calendar/Analytics tabs don't break
        window.allProspects = prospects; 

        // Compute Dash Math
        LexNova.Core.computeMetrics();

        // Broadcast State Change to the DOM
        LexNova.Core.broadcastUpdates();
    }, error => {
        console.error("[LexNova Core] Firebase Sync Error:", error);
    });
};

/**
 * ==========================================
 * PIPELINE MATHEMATICS
 * ==========================================
 * Calculates exact pipeline health, bottlenecks, and V5.0 adoption.
 */
LexNova.Core.computeMetrics = function() {
    const p = LexNova.State.allProspects;
    const m = LexNova.State.metrics;
    
    // Reset Math
    m.total = p.length;
    m.inSequence = 0;
    m.v5Intel = 0;
    m.unscheduled = 0;
    m.archived = 0;
    m.bottleneck = 0;
    m.scansClicked = 0;
    m.scansDropped = 0;
    m.scansCompleted = 0;

    const today = new Date();
    today.setHours(0,0,0,0);

    p.forEach(target => {
        // Core Status Arrays
        if (target.status === 'SEQUENCE') m.inSequence++;
        if (target.status === 'QUEUED' && !target.ceDate) m.unscheduled++;
        if (target.status === 'ARCHIVED') m.archived++;

        // V5.0 Intel Check (Does it have the new true_gaps array?)
        if (target.true_gaps && Array.isArray(target.true_gaps) && target.true_gaps.length > 0) {
            m.v5Intel++;
        }

        // Scanner Telemetry (Dual-read for camelCase and snake_case)
        const isClicked = target.scannerClicked === true || target.scanner_clicked === true;
        const isCompleted = target.scannerCompleted === true || target.scanner_completed === true;

        if (isClicked) {
            m.scansClicked++;
        }
        
        if (isCompleted) {
            m.scansCompleted++;
        }
        
        // DROPPED LOGIC: If they clicked but did NOT complete, they are dropped.
        if (isClicked && !isCompleted) {
            m.scansDropped++;
        }

        // Bottleneck Detection (Overdue Actions or Unhandled Replies)
        let isBottleneck = false;
        
        if (target.status === 'SEQUENCE') {
            // Check if replied but not moved to NEG/ENGAGED
            if (target.has_replied) {
                isBottleneck = true;
            } else {
                // Check if current action is overdue
                const nextActionDate = LexNova.Core.getNextActionDate(target);
                if (nextActionDate && new Date(nextActionDate) < today) {
                    isBottleneck = true;
                }
            }
        }
        if (isBottleneck) m.bottleneck++;
    });
};

/**
 * ==========================================
 * HELPER: GET NEXT ACTION DATE
 * ==========================================
 * Safely extracts the earliest required action timestamp from a sequence.
 */
LexNova.Core.getNextActionDate = function(target) {
    if (!target.ceDate) return null;
    
    // If CE sent but FU1 not sent, next is FU1
    if (target.ce_sent && !target.fu1_sent && target.fu1_date) return target.fu1_date;
    if (target.fu1_sent && !target.fu2_sent && target.fu2_date) return target.fu2_date;
    if (target.fu2_sent && !target.fu3_sent && target.fu3_date) return target.fu3_date;
    if (target.fu3_sent && !target.fu4_sent && target.fu4_date) return target.fu4_date;
    
    // If nothing sent yet, CE is next
    if (!target.ce_sent) return target.ceDate;
    
    return null; // Sequence complete
};

/**
 * ==========================================
 * CROSS-MODULE BROADCAST SYSTEM
 * ==========================================
 * Pushes the updated state to the UI rendering engines.
 */
LexNova.Core.broadcastUpdates = function() {
    // 1. Re-render the V5 Hunt Tables (If UI module is loaded)
    if (LexNova.UI && typeof LexNova.UI.renderTables === 'function') {
        LexNova.UI.renderTables();
        LexNova.UI.renderDashboards();
    }

   // 2. Re-render Legacy Operations Dash (loadDashboard in admin-core.js)
    if (typeof window.loadDashboard === 'function') {
        window.loadDashboard();
    }

    // 3. Re-render Batch Performance Math
    if (typeof window.renderBatchPerformance === 'function') {
        window.renderBatchPerformance();
    }

    // 4. Re-render Calendar UI
    if (typeof window.refreshCalendar === 'function') {
        window.refreshCalendar();
    }
};

/**
 * Auto-Initialize the pipeline when window.init fires from admin-core.js
 */
const legacyInit = window.init;
window.init = function() {
    if (typeof legacyInit === 'function') legacyInit();
    LexNova.Core.init();
};
