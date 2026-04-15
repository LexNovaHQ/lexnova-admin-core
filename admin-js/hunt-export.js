/**
 * ═════════════════════════════════════════════════════════════
 * LEX NOVA CRM v6.0 — MODULE 4: EXPORT & SPEAR COPY COMPILER
 * ═════════════════════════════════════════════════════════════
 * This module translates the hydrated V5.0 JSON object into the 
 * exact, unformatted plaintext structure required for outreach drafting.
 */

window.LexNova = window.LexNova || {};
LexNova.Export = LexNova.Export || {};

/**
 * ==========================================
 * 1. THE SPEAR COPY GENERATOR
 * ==========================================
 * Compiles the 4-Part Blueprint directly to the clipboard.
 */
LexNova.Export.copySpearReport = async function(pid) {
    if (!LexNova.State || !LexNova.State.allProspects) return;

    const p = LexNova.State.allProspects.find(x => x.id === pid);
    if (!p) {
        if(typeof window.toast === 'function') window.toast("Target not found.", "error");
        return;
    }

    // Default fallbacks for deeply nested objects
    const profile = p.ghost_protection_global || {};
    const indictments = profile.self_indictments || [];
    const gaps = p.true_gaps || [];
    const scannerLink = `https://lexnovahq.com/scanner.html?pid=${p.id}`;

    let text = "";

    // ── PART I: TARGET LOGISTICS ──────────────────────────────
    text += `=== TARGET LOGISTICS ===\n`;
    text += `Company: ${p.company || 'Unknown'}\n`;
    text += `PID: ${p.id}\n`;
    text += `Founder: ${p.founderName || 'Unknown'}\n`;
    text += `Role: ${p.founderRole || 'Unknown'}\n`;
    text += `Email: ${p.email || 'Unknown'}\n`;
    text += `HQ Jurisdiction: ${p.jurisdiction || 'Unknown'}\n`;
    text += `Funding Stage: ${p.fundingStage || 'Unverified'}\n`;
    text += `Scanner Link: ${scannerLink}\n\n`;

    // ── PART II: PRODUCT ARCHITECTURE (Raw JSON Dumps) ────────
    text += `=== PRODUCT ARCHITECTURE ===\n`;
    text += `primary_claim: ${p.primary_claim || 'N/A'}\n`;
    text += `primaryProduct: ${p.primaryProduct ? JSON.stringify(p.primaryProduct, null, 2) : 'N/A'}\n`;
    text += `primaryArchetype: ${p.archetypes ? JSON.stringify(p.archetypes, null, 2) : 'N/A'}\n`;
    text += `featureMap: ${p.featureMap ? JSON.stringify(p.featureMap, null, 2) : 'N/A'}\n`;
    text += `jurisdictional_surface: ${p.jurisdictional_surface ? JSON.stringify(p.jurisdictional_surface, null, 2) : 'N/A'}\n\n`;

    // ── PART III: GLOBAL FORENSICS & ALIBIS ───────────────────
    text += `=== GLOBAL FORENSICS ===\n`;
    text += `confidence_score: ${profile.confidence_score !== undefined ? profile.confidence_score : 'N/A'}\n`;
    text += `confidence_tier: ${profile.confidence_tier || 'N/A'}\n`;
    text += `ghost_protection_vector: ${profile.ghost_protection_vector || 'N/A'}\n`;
    
    // Deep object paths require safe navigation
    text += `posture_alibi_argument: ${profile.posture_alibi?.argument || 'N/A'}\n`;
    text += `legal_stack_alibi: ${profile.legal_stack_alibi?.overall_inadequacy || 'N/A'}\n`;
    text += `velocity_signal_score: ${profile.velocity_signal?.score || 'N/A'}\n`;
    text += `velocity_signal_trigger: ${profile.velocity_signal?.trigger || 'N/A'}\n`;
    text += `velocity_signal_window: ${profile.velocity_signal?.window || 'N/A'}\n\n`;

    // ── SELF INDICTMENTS ──
    indictments.forEach((ind, index) => {
        text += `-- SELF INDICTMENT ${index + 1} --\n`;
        text += `Quote: "${ind.quote || ''}"\n`;
        text += `Contradicts: ${ind.contradicts || ''}\n\n`;
    });

    // ── PART IV: THE GAP MATRIX (20 Fields) ───────────────────
    gaps.forEach((g, index) => {
        text += `=== THREAT ${index + 1}: ${g.Threat_ID} ===\n`;
        text += `Threat_Name: ${g.Threat_Name || 'N/A'}\n`;
        text += `Pain_Tier: ${g.Pain_Tier || 'N/A'}\n`;
        text += `Velocity: ${g.Velocity || 'N/A'}\n`;
        text += `feature_ref: ${g.feature_ref || 'N/A'}\n`;
        text += `feature_type: ${g.feature_type || 'N/A'}\n`;
        text += `FP_Mechanism: ${g.FP_Mechanism || 'N/A'}\n`;
        text += `FP_Trigger: ${g.FP_Trigger || 'N/A'}\n`;
        text += `structural_absence: ${g.structural_absence || 'N/A'}\n`;
        text += `predator_signature: ${g.predator_signature || 'N/A'}\n`;
        text += `Legal_Pain: ${g.Legal_Pain || 'N/A'}\n`;
        text += `FP_Impact: ${g.FP_Impact || 'N/A'}\n`;
        text += `FP_Stakes: ${g.FP_Stakes || 'N/A'}\n`;
        text += `governance_artifact_type: ${g.governance_artifact_type || 'N/A'}\n`;
        text += `evidence_source: ${g.evidence_source || 'N/A'}\n`;
        
        // If proof citation exists and isn't a NULL flag, wrap in quotes. Otherwise print exact text.
        const citation = g.proof_citation;
        if (!citation) {
            text += `proof_citation: N/A\n`;
        } else if (typeof citation === 'string' && citation.toUpperCase().startsWith("NULL")) {
            text += `proof_citation: ${citation}\n`;
        } else {
            text += `proof_citation: "${citation}"\n`;
        }
        
        text += `Lex_Nova_Fix: ${g.Lex_Nova_Fix || 'N/A'}\n`;
        text += `Status: ${g.Status || 'N/A'}\n`;
        text += `Effective_Date: ${g.Effective_Date || 'N/A'}\n`;
        text += `Pain_Depth: ${g.Pain_Depth || 'N/A'}\n\n`;
    });

    // Execute Clipboard Write
    try {
        await navigator.clipboard.writeText(text);
        if(typeof window.toast === 'function') window.toast("Spear Report Copied (Verbatim)", "success");
    } catch (err) {
        console.error("Failed to copy text: ", err);
        if(typeof window.toast === 'function') window.toast("Clipboard copy failed. Check console.", "error");
    }
};

/**
 * ==========================================
 * 2. FULL DOSSIER EXPORT
 * ==========================================
 * Dumps the entire unformatted JSON for the Dossier/Architect view.
 */
LexNova.Export.copyDossier = async function(pid) {
    if (!LexNova.State || !LexNova.State.allProspects) return;

    const p = LexNova.State.allProspects.find(x => x.id === pid);
    if (!p) {
        if(typeof window.toast === 'function') window.toast("Target not found.", "error");
        return;
    }

    try {
        await navigator.clipboard.writeText(JSON.stringify(p, null, 2));
        if(typeof window.toast === 'function') window.toast("Full Dossier JSON Copied", "success");
    } catch (err) {
        console.error("Failed to copy dossier: ", err);
        if(typeof window.toast === 'function') window.toast("Clipboard copy failed. Check console.", "error");
    }
};
