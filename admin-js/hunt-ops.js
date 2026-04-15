/**
 * ═════════════════════════════════════════════════════════════
 * LEX NOVA CRM v6.0 — MODULE 3: PIPELINE OPS & DATABASE ROUTING
 * ═════════════════════════════════════════════════════════════
 * This module handles immutable PID generation, the Business-Day
 * sequence calculator, and all direct writes to Firestore.
 */

window.LexNova = window.LexNova || {};
LexNova.Ops = LexNova.Ops || {};

/**
 * ==========================================
 * 1. THE PID GENERATOR
 * ==========================================
 * Generates immutable IDs based on the batch: LN-P-AI-26-[BATCH]-XXX
 */
LexNova.Ops.generatePID = function(batch) {
    if (!batch || batch.length !== 3) return `LN-P-AI-26-UNK-${Date.now().toString().slice(-3)}`;
    
    // Find all prospects in this specific batch
    const batchProspects = LexNova.State.allProspects.filter(p => 
        p.batch === batch && 
        p.id && 
        p.id.startsWith(`LN-P-AI-26-${batch}-`)
    );

    let maxIndex = 0;

    batchProspects.forEach(p => {
        const parts = p.id.split('-');
        if (parts.length >= 6) {
            const num = parseInt(parts[5], 10);
            if (!isNaN(num) && num > maxIndex) {
                maxIndex = num;
            }
        }
    });

    const nextIndex = String(maxIndex + 1).padStart(3, '0');
    return `LN-P-AI-26-${batch}-${nextIndex}`;
};

/**
 * ==========================================
 * 2. BUSINESS-DAY SEQUENCE CALCULATOR
 * ==========================================
 * Standardizes follow-up intervals by skipping Saturdays and Sundays.
 * Example: Adds 'daysToAdd' business days to the 'startDateStr'.
 */
LexNova.Ops.addBusinessDays = function(startDateStr, daysToAdd) {
    if (!startDateStr) return null;
    
    let date = new Date(startDateStr);
    let addedDays = 0;

    while (addedDays < daysToAdd) {
        date.setDate(date.getDate() + 1);
        const dayOfWeek = date.getDay();
        // 0 = Sunday, 6 = Saturday. Only count if it's a weekday.
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            addedDays++;
        }
    }
    
    return date.toISOString().split('T')[0];
};

/**
 * Recalculates the entire sequence cascade based on a new CE Date.
 * Base cadence: CE + 3 Biz Days, + 6 Biz Days, + 11 Biz Days, + 16 Biz Days.
 */
LexNova.Ops.calculateSequence = function(ceDateStr) {
    if (!ceDateStr) return {};

    return {
        ceDate: ceDateStr,
        fu1_date: LexNova.Ops.addBusinessDays(ceDateStr, 3),
        fu2_date: LexNova.Ops.addBusinessDays(ceDateStr, 6),
        fu3_date: LexNova.Ops.addBusinessDays(ceDateStr, 11),
        fu4_date: LexNova.Ops.addBusinessDays(ceDateStr, 16)
    };
};

/**
 * ==========================================
 * 3. THE MASTER SAVE ROUTER
 * ==========================================
 * Merges UI payloads, generates missing data, and writes to Firestore.
 */
LexNova.Ops.saveProspect = async function(payload, existingPid = null) {
    if (!window.db) {
        console.error("[LexNova Ops] Database not connected.");
        if (typeof window.toast === 'function') window.toast("Database connection error.", "error");
        return;
    }

    let targetPid = existingPid;
    let isNew = false;

    // 1. Generate PID if new
    if (!targetPid) {
        targetPid = LexNova.Ops.generatePID(payload.batch);
        payload.id = targetPid;
        payload.date_added = new Date().toISOString();
        isNew = true;
    } else {
        // Ensure existing records maintain their ID tag in the document during a merge
        payload.id = targetPid;
    }

    // 2. Schedule Calculator (If CE Date was updated in the Ops panel later)
    // Note: The ingestion modal doesn't capture ceDate, so this protects against overriding.
    if (payload.ceDate) {
        const schedule = LexNova.Ops.calculateSequence(payload.ceDate);
        Object.assign(payload, schedule);
    }

    // 3. The Factory Handoff Trap
    if (payload.status === 'CONVERTED') {
        LexNova.Ops.executeFactoryHandoff(targetPid, payload);
    }

    try {
        // 4. Write to Firestore
        await window.db.collection('prospects').doc(targetPid).set(payload, { merge: true });
        
        if (typeof window.toast === 'function') {
            window.toast(isNew ? `New Target Queued: ${targetPid}` : `Updated: ${targetPid}`, "success");
        }

        // Close any active side panels to reset the view
        if (typeof window.closePP === 'function') window.closePP();

    } catch (error) {
        console.error("[LexNova Ops] Save Error:", error);
        if (typeof window.toast === 'function') window.toast("Failed to save prospect.", "error");
    }
};

/**
 * ==========================================
 * 4. THE FACTORY HANDOFF
 * ==========================================
 * Migrates a won deal into the 'clients' collection (tab-factory.js).
 */
LexNova.Ops.executeFactoryHandoff = async function(pid, updatedPayload) {
    // Fetch the absolute latest state from memory
    const fullTarget = LexNova.State.allProspects.find(p => p.id === pid) || updatedPayload;
    
    // Generate the Fulfillment ID
    const factoryId = `LN-C-${Date.now().toString().slice(-6)}`;
    
    const clientPayload = {
        id: factoryId,
        origin_pid: pid,
        company: fullTarget.company || "Unknown Entity",
        founderName: fullTarget.founderName || "Unknown",
        email: fullTarget.email || "Unknown",
        status: "INTAKE", // Drops them into the first column of the Factory board
        date_converted: new Date().toISOString(),
        product_architecture: fullTarget.primaryProduct || null,
        jurisdiction: fullTarget.jurisdiction || null
    };

    try {
        await window.db.collection('clients').doc(factoryId).set(clientPayload);
        console.log(`[LexNova Ops] Factory Handoff Complete: ${factoryId}`);
    } catch (error) {
        console.error("[LexNova Ops] Factory Handoff Failed:", error);
    }
};

/**
 * ==========================================
 * 5. INLINE TABLE UPDATER
 * ==========================================
 * Handles direct field edits from the dashboard tables (e.g., CE Date, Friction).
 */
LexNova.Ops.updateInline = async function(pid, field, value) {
    if (!pid || !field || !window.db) return;

    let payload = { [field]: value, last_updated: new Date().toISOString() };

    // If they changed the CE Date from the table, auto-calculate the follow-ups
    if (field === 'ceDate' && value) {
        const schedule = LexNova.Ops.calculateSequence(value);
        Object.assign(payload, schedule);
    }

    try {
        await window.db.collection('prospects').doc(pid).set(payload, { merge: true });
        if (typeof window.toast === 'function') window.toast(`Updated ${field}`, "success");
    } catch (error) {
        console.error("[LexNova Ops] Inline Update Error:", error);
        if (typeof window.toast === 'function') window.toast("Failed to update.", "error");
    }
};

/**
 * ==========================================
 * 6. DESTRUCTIVE OPERATIONS
 * ==========================================
 */
LexNova.Ops.deleteProspect = async function(pid) {
    if (!confirm(`WARNING: Permanently delete target ${pid}? This cannot be undone.`)) return;

    try {
        await window.db.collection('prospects').doc(pid).delete();
        if (typeof window.toast === 'function') window.toast(`Target ${pid} purged.`, "success");
        if (typeof window.closePP === 'function') window.closePP();
    } catch (error) {
        console.error("[LexNova Ops] Delete Error:", error);
        if (typeof window.toast === 'function') window.toast("Failed to delete target.", "error");
    }
};
