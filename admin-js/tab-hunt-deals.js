// ════════════════════════════════════════════════════════════════════════
// ═════════ LEX NOVA ADMIN: V5.0 HUNT ENGINE (tab-hunt-deals.js) ═════════
// ════════════════════════════════════════════════════════════════════════
'use strict';

// Ensure the global array exists so other tabs (Deals, Flagship) don't crash
window.allProspects = window.allProspects || [];

// ════════════════════════════════════════════════════════════════════════
// ═════════ MODULE 1: HUNT CORE (STATE & SYNC) ═══════════════════════════
// ════════════════════════════════════════════════════════════════════════
const HuntCore = {
    state: {
        prospects: [],
        isLoaded: false,
        unsubscribe: null
    },

    init: function() {
        console.log("[HuntCore] Booting Lex Nova State Engine...");
        
        if (this.state.unsubscribe) {
            this.state.unsubscribe();
        }

        // Capture reference to state to avoid 'this' context loss in the callback
        const state = this.state;

        this.state.unsubscribe = window.db.collection('prospects').onSnapshot(snap => {
            // 1. Reset both local and global state to prevent infinite duplication
            state.prospects = [];
            window.allProspects = []; 
            
            snap.forEach(doc => {
                const data = { id: doc.id, ...doc.data() };
                state.prospects.push(data);
                window.allProspects.push(data);
            });

            state.isLoaded = true;
            console.log(`[HuntCore] Pipeline Synchronized. ${state.prospects.length} targets loaded.`);
            
            // 2. BRIDGE: Trigger legacy system-wide renderers to keep other tabs in sync
            try { if(window.renderDealsBoard) window.renderDealsBoard(); } catch(e){}
            try { if(window.renderHotQueue) window.renderHotQueue(); } catch(e){}
            try { if(window.populateCommandCenter) window.populateCommandCenter(); } catch(e){}
            try { if(window.refreshCalendar) window.refreshCalendar(); } catch(e){}

            // 3. New V5 UI update
            if (typeof HuntUI !== 'undefined' && HuntUI.renderMainDash) {
                HuntUI.renderMainDash();
            }
        }, error => {
            console.error("[HuntCore] Sync Failed.", error);
            if (window.toast) window.toast('Outreach sync failed', 'error');
        });
    },

    saveProspect: async function(prospectObject) {
        try {
            const docId = prospectObject.prospectId || prospectObject.id;
            if (!docId) throw new Error("No ID provided for save operation.");
            
            await window.db.collection('prospects').doc(docId).set(prospectObject, { merge: true });
            console.log(`[HuntCore] Prospect ${docId} committed.`);
            return true;
        } catch (error) {
            console.error(`[HuntCore] Save Failed:`, error);
            if (window.toast) window.toast('Save failed', 'error');
            return false;
        }
    },

    deleteProspect: async function(docId) {
        try {
            if (!confirm("Are you sure? This is a permanent purge.")) return false;
            await window.db.collection('prospects').doc(docId).delete();
            return true;
        } catch (error) {
            console.error(`[HuntCore] Delete Failed:`, error);
            return false;
        }
    },

    getProspectById: function(id) {
        // Fallback search across global and local state
        const source = (window.allProspects && window.allProspects.length > 0) ? window.allProspects : this.state.prospects;
        return source.find(p => p.id === id || p.prospectId === id);
    }
};



// ════════════════════════════════════════════════════════════════════════
// ═════════ MODULE 2: HUNT INGESTION (PARSER & HYDRATOR) ═════════════════
// ════════════════════════════════════════════════════════════════════════
 // ── THE STATIC DICTIONARY ───────────────────────────────────────────
const HuntIngestion = {
    staticDictionary: {
        "UNI_CNS_001": {
            "Threat_Name": "Browsewrap Invalidity",
            "Pain_Tier": "T3",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "your signup uses a passive \"by using this site you agree\" banner instead of an unchecked checkbox — and under Specht, the contract with that user never actually forms",
            "FP_Trigger": "every enterprise buyer's legal team runs this check during diligence, and plaintiff lawyers run it before filing — both take under a minute",
            "Legal_Pain": "Specht v. Netscape established that mere availability of terms through a hyperlink without affirmative user assent fails to form a binding contract, voiding arbitration clauses, forum selection, liability caps, and class action waivers against that user.",
            "FP_Impact": "the arbitration clause and liability cap in your ToS stop binding the users who signed up through that flow. the enterprise deal gets redlined. and any class action you thought was waived is back on the table.",
            "FP_Stakes": "NULL",
            "Lex_Nova_Fix": "DOC_TOS §1.1 — pre-built Specht-proof §1.1 acceptance-flow module. drops in review-ready.",
            "Status": "Active",
            "Effective_Date": "2002-10-01",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "Specht v. Netscape Communications Corp. (2d Cir. 2002)"
        },
        "UNI_CNS_002": {
            "Threat_Name": "Cluttered Mobile Consent",
            "Pain_Tier": "T3",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "your mobile signup buries the ToS checkbox below the fold or stacks it with three other agreements, which fails the visual bar Meyer v. Uber set for mobile consent",
            "FP_Trigger": "any plaintiff lawyer can screenshot your mobile flow and file — the Meyer test is a visual inspection, not a legal argument, so the case ends before it really starts",
            "Legal_Pain": "Meyer v. Uber set the \"reasonably conspicuous notice and unambiguous manifestation of assent\" standard for mobile consent flows. Courts strike consent flows that fail this test, voiding the arbitration clause and liability caps for affected users.",
            "FP_Impact": "courts strike the arbitration clause for the mobile users. enterprise buyers flag it in diligence. and your mobile-first user base — the biggest group you have — is the easiest one to turn into a class action.",
            "FP_Stakes": "NULL",
            "Lex_Nova_Fix": "DOC_TOS §1.1 — pre-built Meyer-calibrated mobile consent module. passes the visual-inspection test the first time.",
            "Status": "Active",
            "Effective_Date": "2017-08-17",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "Meyer v. Uber Technologies, Inc. (2d Cir. 2017)"
        },
        "UNI_CNS_003": {
            "Threat_Name": "Unconscionable Venue",
            "Pain_Tier": "T3",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "your arbitration clause makes consumers travel across the country to dispute anything, with no small-claims carve-out and no cost-shifting — which is exactly what Bragg v. Linden called unconscionable",
            "FP_Trigger": "the first consumer who files in their own state and argues the venue is unfair doesn't just win their own case — the ruling applies to every other user on the same ToS",
            "Legal_Pain": "Bragg v. Linden Research established that forcing users into distant, high-cost arbitration venues can be found unconscionable and unenforceable, collapsing the company's ability to compel arbitration and reopening the door to class litigation.",
            "FP_Impact": "you lose the ability to force arbitration. the class actions you thought were waived come back alive. and the clause enterprise buyers rely on when they buy from you gets struck in the same breath.",
            "FP_Stakes": "NULL",
            "Lex_Nova_Fix": "DOC_TOS §14.3 — pre-built Bragg-proof venue module with the carve-outs courts actually honor.",
            "Status": "Active",
            "Effective_Date": "2007-05-30",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "Bragg v. Linden Research, Inc. (E.D. Pa. 2007)"
        },
        "UNI_CNS_004": {
            "Threat_Name": "Dark Pattern Cancellation",
            "Pain_Tier": "T2",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "your cancel flow takes more clicks than your signup flow — which is the exact pattern the FTC calls a negative-option dark pattern under ROSCA",
            "FP_Trigger": "the FTC files ROSCA cases continuously and names officers personally in the complaints — they don't need a whistleblower, just a cranky subscriber who posts about it",
            "Legal_Pain": "ROSCA and FTC Act Section 5 impose uncapped civil penalties and consumer redress obligations on \"negative option\" subscription flows where cancellation is materially harder than signup. Recent FTC actions have settled in the eight- and nine-figure range and named individual officers.",
            "FP_Impact": "eight-figure civil penalties. consumer redress going back to every subscriber who ever tried to cancel. no cap on how far back they reach. and the consent decree changes how you run the business for years afterward.",
            "FP_Stakes": "your name ends up in the complaint alongside the company's. ROSCA reaches past the LLC and names you personally. and consent decrees don't un-Google — they follow you to every fund meeting and every company you try to build after this one.",
            "Lex_Nova_Fix": "DOC_TOS §1.1 — pre-built ROSCA-sized cancel-flow module. keeps your name off the FTC complaint.",
            "Status": "Active",
            "Effective_Date": "2010-12-29",
            "Pain_Depth": "Personal",
            "Legal_Ammo": "FTC Act §5 / ROSCA (15 U.S.C. §8401 et seq.)"
        },
        "UNI_CNS_005": {
            "Threat_Name": "Subscription Price Hike Consent",
            "Pain_Tier": "T2",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "your ToS lets you raise subscription prices on New York customers without a separate consent step — which is what the amended NY auto-renewal law started requiring in December 2025",
            "FP_Trigger": "every price hike you pushed to a New York subscriber after December without fresh consent is its own violation — nobody has to enforce it, consumers sue directly, and plaintiff firms are already running these as class actions",
            "Legal_Pain": "The amended New York Auto-Renewal Law (effective December 2025) requires separate affirmative consent from consumers before any subscription price increase takes effect, with statutory damages and restitution per affected customer for every non-compliant hike.",
            "FP_Impact": "statutory damages for every affected customer. restitution going back to every hike that didn't get consent. and the class-action bar in New York has the list of every auto-renewal service that didn't update its flow.",
            "FP_Stakes": "statutory damages compound per New York subscriber, per hike, for every violation you pushed after December — and the class-action bar has the list of every auto-renewal service that didn't update its flow. the math doesn't cap.",
            "Lex_Nova_Fix": "DOC_TOS §1.1 — pre-built §5-903 price-consent module sized for the amended NY law.",
            "Status": "Active",
            "Effective_Date": "2025-12-01",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "NY General Obligations Law §5-903 (as amended Dec 2025)"
        },
        "UNI_CNS_006": {
            "Threat_Name": "FTC Click-to-Cancel Rule",
            "Pain_Tier": "T2",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "your cancel flow makes customers phone or email to cancel something they signed up for online — which is the exact pattern the FTC's Click-to-Cancel rule targets",
            "FP_Trigger": "the FTC restarted the rulemaking in January and every state AG is already filing parallel cases under state consumer-protection law — they don't have to wait for the federal rule to finalize",
            "Legal_Pain": "The expanded FTC Negative Option Rule (rulemaking restarted January 2026) codifies \"click to cancel\" as a federal standard. Violations carry civil penalties up to $51,744 per violation plus consumer redress, with enforcement against individual officers and principals under ROSCA authority.",
            "FP_Impact": "per-violation penalties stacking on every subscriber who ever tried to cancel. restitution on top. state AG pile-on from every state with its own consumer law. each piece uncapped, each piece adds to the last.",
            "FP_Stakes": "the FTC names individuals on these complaints. your name goes on the consent decree. and consent decrees follow you to every future raise, every future hire, every future company — there's no version of your career after this that doesn't have it in the footnotes.",
            "Lex_Nova_Fix": "DOC_TOS §1.1 — pre-built Click-to-Cancel-aligned §1.1 module. sized for the restarted FTC rule.",
            "Status": "Active",
            "Effective_Date": "2026-01-30",
            "Pain_Depth": "Personal",
            "Legal_Ammo": "FTC Negative Option Rule (16 CFR Part 425, rulemaking restarted Jan 30, 2026)"
        },
        "UNI_CNS_007": {
            "Threat_Name": "Unwaivable Reversal Right",
            "Pain_Tier": "T2",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "your product finalizes transactions through some automated pathway — an agent, an auto-approval, an AI execution — with no grace period and no error-correction UI, which hands every user an unwaivable statutory right to void the transaction under UETA §10(b)",
            "FP_Trigger": "any user whose automated action didn't match what they intended can pull up UETA, void the transaction, and chargeback or reverse — the right is non-waivable, so nothing you wrote in your ToS stops it",
            "Legal_Pain": "UETA §10(b) grants users a non-waivable right to avoid the effect of an electronic agent's error where no reasonable method to detect or correct the error was provided. The right applies to any electronic system executing transactions on the company's behalf, not just chatbot-style agents.",
            "FP_Impact": "every wrong automated action turns into a reversal or chargeback, with processor fees or unwind costs attached. the volume scales one-to-one with how many automated transactions the product runs. the more you scale, the bigger the reversal book gets.",
            "FP_Stakes": "the statute overrides your contract. you can't cap your way out of it, you can't disclose your way out of it, and the right is permanent. the cleaner your product gets, the more it gets used, the more this compounds.",
            "Lex_Nova_Fix": "UI Mandate — pre-built UETA §10(b) grace-period pattern. stops reversals from becoming recovery against you.",
            "Status": "Active",
            "Effective_Date": "1999-07-29",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "Uniform Electronic Transactions Act §10(b)"
        },
        "UNI_LIA_001": {
            "Threat_Name": "First Sale Doctrine Trap",
            "Pain_Tier": "T2",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "your ToS says customers \"buy\" or \"own\" the software instead of licensing it, and there's no Vernor-style license grant — which flips the whole thing from a service to a product in court",
            "FP_Trigger": "the first defect claim that lands on your desk, the plaintiff lawyer opens with this — it's page one of the product-liability playbook because it kills your \"we were careful\" defense before you even answer",
            "Legal_Pain": "Software framed as a \"sale\" rather than a licensed service risks losing the Vernor v. Autodesk first-sale defense, which collapses the service classification and exposes the seller to strict product liability where defects attach regardless of fault or negligence.",
            "FP_Impact": "every bug in your product turns into a lawsuit you can't fight the normal way. even if you did everything right, you still pay. and the insurance you bought for a SaaS product probably won't cover it.",
            "FP_Stakes": "there's no ceiling on this. one bad release can stack claims faster than the company can cover them, and by the time your lawyer tells you the insurer said no, the runway conversation has already changed.",
            "Lex_Nova_Fix": "DOC_TOS §2.2 — pre-built Vernor-proof §2.2 license-grant module. keeps the product a service when the defect case lands.",
            "Status": "Active",
            "Effective_Date": "2010-09-10",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "Vernor v. Autodesk Inc. (9th Cir. 2010)"
        },
        "UNI_LIA_002": {
            "Threat_Name": "The Wasted Costs Loophole",
            "Pain_Tier": "T2",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "your liability cap excludes consequential and indirect damages but never names \"wasted expenditure\" — and after Soteria v. IBM, wasted expenditure is its own category that slips past that list",
            "FP_Trigger": "any enterprise customer who cancels mid-rollout and wants their integration spend back hires counsel who runs the Soteria argument — IBM already lost £80M to exactly this",
            "Legal_Pain": "Soteria v. IBM confirmed that standard consequential-damages exclusions fail to capture \"wasted expenditure\" claims, because wasted expenditure is a distinct head of loss under English contract law that consequential exclusions do not reach.",
            "FP_Impact": "the customer gets their whole rollout money back. the fees they paid you, the time their team spent, the consultants they hired — all of it. and your cap doesn't catch any of it, because the clause never named the category.",
            "FP_Stakes": "this scales with your customers' pocket size, not your contract price. a $200K customer who spent $2M getting your product running can come back for the full $2M. every enterprise deal on your books has the same hole.",
            "Lex_Nova_Fix": "DOC_TOS §9.2 — pre-built Soteria-grounded §9.2 liability module. names wasted-cost claims before they sneak through.",
            "Status": "Active",
            "Effective_Date": "2022-08-08",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "Soteria Insurance Ltd v. IBM United Kingdom Ltd [2022] EWHC 2084 (TCC)"
        },
        "UNI_LIA_003": {
            "Threat_Name": "AI Autonomous Liability Limits",
            "Pain_Tier": "T3",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "your liability cap doesn't say anything about AI agents taking the action instead of humans — and silence is exactly what plaintiff firms are probing after Ryan v. X Corp.",
            "FP_Trigger": "enterprise legal teams started flagging this in diligence post-Ryan — if your cap language doesn't call out autonomous execution, it goes straight on the redline",
            "Legal_Pain": "Ryan v. X Corp. signaled that liability caps can survive AI-initiated actions but only when the drafter explicitly preserved enforceability for autonomous execution. Silent clauses remain legally untested territory that plaintiff firms are actively probing.",
            "FP_Impact": "deals stall in legal review. redlines add two to four weeks to your close cycle. and competitors whose ToS already addresses this clear diligence while you're on the phone explaining why your cap holds.",
            "FP_Stakes": "NULL",
            "Lex_Nova_Fix": "DOC_TOS §9.2 — pre-built Ryan-aware §9.2 cap module. autonomous AI action stays inside your protected zone.",
            "Status": "Active",
            "Effective_Date": "2024-01-01",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "Ryan v. X Corp. (2024)"
        },
        "UNI_LIA_004": {
            "Threat_Name": "Inconspicuous Warranty Caps",
            "Pain_Tier": "T2",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "your warranty disclaimer is in the same body text as everything else — not bold, not ALL CAPS, not set apart — which UCC §2-316 treats as non-conspicuous, and non-conspicuous gets struck",
            "FP_Trigger": "any plaintiff running a warranty claim opens with the visual inspection — does the disclaimer stand out on the page? if the answer is no, the clause is gone before the legal argument even starts",
            "Legal_Pain": "UCC §2-316 requires warranty disclaimers to be \"conspicuous\" — defined as bold, ALL CAPS, or visually set apart from surrounding text. Disclaimers that fail this test are struck, and the implied warranties of merchantability and fitness for purpose survive intact.",
            "FP_Impact": "the disclaimer gets struck. the promises your ToS was supposed to kill — that the product works, that it's fit for the job — come back alive. and every customer who ever paid you now has a claim your terms were supposed to block.",
            "FP_Stakes": "this reaches every customer who ever bought the product. no grandfathering for the old sales. and the clock runs four years from when the customer finds the defect, not from when they bought — so a product you shipped three years ago is still on the hook.",
            "Lex_Nova_Fix": "DOC_TOS §9.2 — pre-built UCC §2-316-conspicuous warranty module. formatted the way courts actually require.",
            "Status": "Active",
            "Effective_Date": "1952-01-01",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "UCC §2-316 and §2-719"
        },
        "UNI_LIA_005": {
            "Threat_Name": "AI Reclassified as Product",
            "Pain_Tier": "T1",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "your ToS calls the product a \"service\" or \"SaaS\", but the revised EU PLD kicks in December 2026 and reclassifies AI software as a product regardless of what your ToS says",
            "FP_Trigger": "the directive activates on a calendar date, not an enforcement decision — every EU-accessible AI product is exposed on day one without a single lawsuit being filed first",
            "Legal_Pain": "The revised EU Product Liability Directive (effective December 2026) explicitly reclassifies AI software as a product rather than a service, triggering strict liability for defects regardless of fault and stripping the negligence defense for any AI system reaching EU customers.",
            "FP_Impact": "every bug in your product turns into a lawsuit you can't fight the normal way in the EU. even if you did everything right, you still pay. and the insurance you bought for a SaaS product probably won't cover it.",
            "FP_Stakes": "the defense that has carried AI companies through litigation disappears on a calendar date you can mark in your phone right now. if your product has any real defect history, the directive can shut the EU business down — no matter what the rest of the P&L looks like.",
            "Lex_Nova_Fix": "DOC_TOS §2.2 — pre-built PLD-ready §2.2 classification module. lands before December 2026.",
            "Status": "Upcoming",
            "Effective_Date": "2026-12-01",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "EU Product Liability Directive (Directive (EU) 2024/2853)"
        },
        "UNI_LIA_006": {
            "Threat_Name": "Ban on User Waivers",
            "Pain_Tier": "T5",
            "Velocity": "WATCH",
            "FP_Mechanism": "your liability strategy leans on user waivers the AI LEAD Act would void federally — and the same bill reclassifies AI as a product under federal law, which kills the service-based defenses underneath",
            "FP_Trigger": "the bill is sitting in committee with no effective date — if it moves, the waivers break nationally on the enactment date, and old claims you thought were waived can come back",
            "Legal_Pain": "The proposed AI LEAD Act (S.2937) would classify AI systems as products under US federal law and prohibit ToS language waiving user rights, retroactively invalidating waiver clauses protecting AI companies from reliance and defect claims if enacted. The ban extends to physical-harm waivers for any AI system, including those governing physical systems.",
            "FP_Impact": "every waiver in your ToS gets wiped out going backwards. the \"we're a service\" defenses stop working. and every AI company in the country is rewriting the same contract at the same time, competing for the same few counsel who know what to put in it.",
            "FP_Stakes": "NULL",
            "Lex_Nova_Fix": "DOC_TOS §2.2 — pre-built AI LEAD-resilient §2.2 module. holds even if the federal waiver ban passes.",
            "Status": "Pending",
            "Effective_Date": "TBD",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "AI LEAD Act (S.2937, pending)"
        },
        "UNI_LIA_007": {
            "Threat_Name": "Electronic Agent Authority",
            "Pain_Tier": "T2",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "UETA §14 binds you — the company that deployed the automated system — to whatever it does, whether a human reviewed the specific action or not. and the statute's definition of \"electronic agent\" covers any program executing actions without human review, not just chatbots",
            "FP_Trigger": "any counterparty who relied on an automated action — a user, another business, a payment processor, a trading counterparty — cites UETA against you and wins, because the statute closes the \"we didn't authorize that specific action\" door before you open it",
            "Legal_Pain": "UETA §14 establishes that the principal deploying an electronic agent is bound by the agent's operations as a matter of law, even if no human reviewed the specific action. \"Electronic agent\" under UETA includes any computer program or automated means acting without human review.",
            "FP_Impact": "every transaction the automated system ran is treated as if you signed it yourself. the volume compounds with every scale milestone. and the \"we didn't authorize that specific action\" argument is dead on arrival under the statute.",
            "FP_Stakes": "the liability you're taking on is proportional to the system's throughput, not the team's size. a three-person company running automation at volume is taking on contract exposure a three-hundred-person company would have underwritten with lawyers — you just don't see it until something breaks.",
            "Lex_Nova_Fix": "DOC_TOS §9.2 — pre-built UETA §14 principal-agent module. names what the automation can and can't commit you to.",
            "Status": "Active",
            "Effective_Date": "1999-07-29",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "Uniform Electronic Transactions Act §14"
        },
        "I06_LIA_001": {
            "Threat_Name": "Foundation Model SLA Breach",
            "Pain_Tier": "T2",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "you promised your enterprise customers uptime and security under your MSA — but you route through OpenAI or Anthropic, whose own terms disclaim both, and nothing in your contract bridges that gap",
            "FP_Trigger": "the first time the foundation model has an outage or a security incident, your enterprise customer invokes the SLA against you — and when you turn to the upstream provider, you discover their terms disclaim the very thing you just committed to",
            "Legal_Pain": "When an orchestrator commits to enterprise SLAs but routes requests through upstream foundation models whose own terms disclaim uptime and security, a breach at the foundation-model layer triggers indemnification obligations the orchestrator cannot offset against its upstream provider.",
            "FP_Impact": "you pay the SLA penalty to your customer. you can't recover from the upstream model provider because their terms disclaim it. and every enterprise customer you have is reading about the outage and checking your contract the same way.",
            "FP_Stakes": "the exposure is the difference between what you promised downstream and what you bought upstream — a gap that grows every time you add an enterprise logo. one bad week at your foundation model provider can hand you SLA bills that outrun a year of that customer's revenue.",
            "Lex_Nova_Fix": "DOC_SLA §4.3 — pre-built back-to-back SLA module. aligns your downstream promises with your upstream reality.",
            "Status": "Active",
            "Effective_Date": "2000-01-01",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "Commercial Contract Liability (B2B SLA Indemnification Standards)"
        },
        "I08_LIA_001": {
            "Threat_Name": "The False Negative Breach",
            "Pain_Tier": "T2",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "your liability cap excludes consequential damages but doesn't name \"wasted expenditure\" — and for cybersecurity AI, a missed breach is exactly the scenario where Soteria v. IBM lets the customer recover that category anyway",
            "FP_Trigger": "the first customer whose breach your product missed hires counsel who runs the Soteria argument — IBM already paid £80M on exactly this fact pattern, and cyber is the cleanest factual match the doctrine has",
            "Legal_Pain": "When a cybersecurity AI fails to detect a real threat (a \"false negative\" breach), Soteria v. IBM establishes that the customer can recover wasted expenditure — integration cost, internal SOC time, consultants, remediation spend — as a distinct head of loss that standard consequential-damages exclusions do not reach.",
            "FP_Impact": "the customer recovers their whole integration spend plus their remediation bill — SOC hours, consultants, incident response, everything they spent because you didn't catch it. and your cap doesn't catch any of it.",
            "FP_Stakes": "cybersecurity customers spend far more rolling out your product than they pay for it. a $300K ARR customer who spent $3M on integration and got breached can come back for the full $3M — and the incident that triggered the claim is the same incident the whole industry is reading about.",
            "Lex_Nova_Fix": "DOC_TOS §9.2 — pre-built Soteria-grounded cyber-specific liability module. names the wasted-cost category before a missed breach does.",
            "Status": "Active",
            "Effective_Date": "2022-08-08",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "Soteria Insurance Ltd v. IBM United Kingdom Ltd [2022] EWHC 2084 (TCC)"
        },
        "I08_LIA_002": {
            "Threat_Name": "Due-Care Negligence Defense",
            "Pain_Tier": "T3",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "you don't carry ISO 27001 or SOC 2 Type II with your AI product inside scope — and when a breach case goes to court, that certification is what operationalizes \"due care\" as a defense",
            "FP_Trigger": "enterprise buyers ask for the attestation in diligence before they ask about the product — no cert, no deal, not because they doubt you, but because their own auditors block the purchase",
            "Legal_Pain": "When a cybersecurity AI is sued for negligence following a breach, the only viable defense is demonstrating the developer exercised \"industry-standard due care\" — which courts and regulators operationalize as ISO 27001 or SOC 2 Type II compliance with the product inside audit scope.",
            "FP_Impact": "deals stall behind a nine-month audit cycle. competitors with current attestation close while you explain your roadmap. and if a breach hits before the cert lands, the negligence defense you'd rely on in court isn't there.",
            "FP_Stakes": "NULL",
            "Lex_Nova_Fix": "DOC_TOS §9.2 — pre-built ISO/SOC-aligned due-care framing module. holds the defense posture while you certify.",
            "Status": "Active",
            "Effective_Date": "2005-10-14",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "ISO 27001 / SOC 2 Type II (Industry Due-Care Standards)"
        },
        "I08_LIA_003": {
            "Threat_Name": "Mean Time to Evidence Standard",
            "Pain_Tier": "T3",
            "Velocity": "THIS_YEAR",
            "FP_Mechanism": "your product makes containment and blocking calls during an attack — but you don't generate tamper-evident logs of the decision chain, which is what the new \"mean time to evidence\" standards require for court and insurance",
            "FP_Trigger": "cyber insurers started asking for these logs in 2025 underwriting cycles — if you can't produce them, premiums spike, coverage narrows, and the enterprise customers who rely on that coverage notice",
            "Legal_Pain": "Emerging standards — SEC cyber disclosure rules, NIST SP 800-61r3, and enterprise cyber-insurance underwriting — require \"mean time to evidence\": the ability to produce court-ready logs showing the AI made a reasonable decision during an attack.",
            "FP_Impact": "insurance premiums rise or coverage carves out your product category. enterprise customers flag the gap in diligence. and if a real incident goes to court, the absence of decision logs collapses the defense posture you'd otherwise have.",
            "FP_Stakes": "NULL",
            "Lex_Nova_Fix": "DOC_AGT §7.1 — pre-built NIST SP 800-61r3-aligned decision-log module. holds up in court, insurance, and diligence the same way.",
            "Status": "Upcoming",
            "Effective_Date": "2026-12-31",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "Mean Time to Evidence Standard (SEC Cyber Disclosure / NIST SP 800-61r3)"
        },
        "I08_LIA_004": {
            "Threat_Name": "Continuous Audit Shift",
            "Pain_Tier": "T4",
            "Velocity": "INCOMING",
            "FP_Mechanism": "your product reports on a periodic cycle — weekly, monthly — but regulated-industry audit is shifting to continuous machine-readable telemetry, and your product can't emit it yet",
            "FP_Trigger": "the shift is already happening in financial services and healthcare audit cycles — the customers you'd most want are the customers who'll notice first, and they'll ask during renewal, not discovery",
            "Legal_Pain": "Regulated industries are shifting from periodic compliance audits to continuous automated compliance auditing — where the regulator or auditor consumes telemetry directly and evaluates posture in real time.",
            "FP_Impact": "renewals in regulated accounts stall. competitors with continuous telemetry win the comparison. and the roadmap item that seemed like \"nice to have\" last year becomes a precondition for keeping the customer.",
            "FP_Stakes": "NULL",
            "Lex_Nova_Fix": "DOC_AGT §7.1 — pre-built continuous-audit telemetry module. keeps you renewable in regulated accounts.",
            "Status": "Pending",
            "Effective_Date": "2026-12-31",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "Continuous Compliance Auditing Requirements (Industry-Wide Shift)"
        },
        "I10_LIA_001": {
            "Threat_Name": "Bodily Injury Tort Exposure",
            "Pain_Tier": "T1",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "your ToS doesn't frame the operating envelope, the user responsibilities, or the risk notice — so when the robot hits someone, you face state-level tort law with no contractual scaffolding to lean on",
            "FP_Trigger": "the first bodily-injury case files in the injured person's home state — not where your company is, not where your ToS says — and the local jury decides the number",
            "Legal_Pain": "Physical AI systems inherit the full weight of state-level tort law — negligence, strict liability, wrongful death, punitive damages — governed by the jurisdiction where the injury occurred. Physical tort awards are uncapped and jury-determined, with no contractual override available for bodily injury.",
            "FP_Impact": "uncapped damages. wrongful-death claims. punitive damages in the jurisdictions that allow them. and no part of your ToS can override bodily-injury recovery — contracts don't waive it.",
            "FP_Stakes": "a jury in a state you don't operate in, looking at a person you'll never meet, sets the number. the award isn't capped by anything you wrote, anything you disclosed, or anything your insurer underwrote — and one wrong case in the wrong venue can end the company before the appeal even files.",
            "Lex_Nova_Fix": "DOC_TOS §2.2 — pre-built physical-tort operating-envelope module. gives you the scaffolding to fight the case with.",
            "Status": "Active",
            "Effective_Date": "1900-01-01",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "State-Level Physical Tort Law (Negligence, Strict Liability, Wrongful Death)"
        },
        "I10_LIA_002": {
            "Threat_Name": "Continuous Learning Liability Reset",
            "Pain_Tier": "T1",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "your product retrains on field data after deployment — which under the German PLD transposition counts as a \"substantial modification\" that resets the 10-year liability clock every time it happens",
            "FP_Trigger": "the first continuous-learning product sued in Germany under the transposed PLD tests this theory — and for any product that updates quarterly or faster, the 10-year window effectively never runs out",
            "Legal_Pain": "The German transposition of the EU PLD treats continuous field-learning as a \"substantial modification\" of the product, restarting the 10-year liability limitation period with every material update.",
            "FP_Impact": "your oldest liability exposure never expires. every model update becomes a new product for purposes of the statute. and the \"it's been more than 10 years\" defense that exists for static products doesn't exist for yours.",
            "FP_Stakes": "you're building a liability book that never closes. the five-year-old deployment, the ten-year-old deployment — they all stay live because the model behind them kept updating. and the longer the product runs, the larger the uncapped book gets.",
            "Lex_Nova_Fix": "DOC_TOS §2.4 — pre-built version-scoped release module. lets parts of the liability book actually age out.",
            "Status": "Upcoming",
            "Effective_Date": "2026-12-01",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "German Transposition of EU PLD (ProdHaftG Reform 2026)"
        },
        "UNI_HAL_001": {
            "Threat_Name": "Bot Accountability for Promises",
            "Pain_Tier": "T2",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "your AI surfaces pricing, refund policy, or commitments to users — and Moffatt v. Air Canada says the company is bound by whatever the AI said, hallucinated or not",
            "FP_Trigger": "the first user who screenshots the AI's promise and demands you honor it cites Moffatt and wins — Air Canada already lost this exact argument, and every consumer-protection lawyer knows the case",
            "Legal_Pain": "Moffatt v. Air Canada rejected the \"separate legal entity\" defense for AI chatbots, holding the company legally bound by policy commitments the bot generated.",
            "FP_Impact": "you pay out on whatever the AI promised. the \"it was the bot, not us\" defense is dead. and every user who's been told something generous by your AI now has a live claim with a cited precedent.",
            "FP_Stakes": "this scales with the AI's message volume, not your revenue. a viral screenshot points every similar user toward the same recovery — and you're bound before you can even pull the transcript.",
            "Lex_Nova_Fix": "DOC_TOS §8.1 — pre-built Moffatt-aware output-authority module. stops AI promises from binding the company.",
            "Status": "Active",
            "Effective_Date": "2024-02-14",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "Moffatt v. Air Canada (Civil Resolution Tribunal 2024)"
        },
        "UNI_HAL_002": {
            "Threat_Name": "Defamation via AI Output",
            "Pain_Tier": "T2",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "your product can generate text naming real people — and when it makes something up about someone, Walters v. OpenAI confirmed that AI output can ground a defamation case against the company that deployed the model",
            "FP_Trigger": "the first named person who finds a fabricated accusation about themselves in your output files suit — the case is cheap to run, the damages are real, and plaintiff firms are already running these at volume",
            "Legal_Pain": "Walters v. OpenAI addressed AI-generated defamation when the model fabricated an embezzlement accusation against a named individual. The ruling confirmed that AI output can ground a defamation claim.",
            "FP_Impact": "defamation damages per person defamed, plus the cost of defending each case individually. the UI warnings are your main defense — if they aren't contemporaneous and conspicuous, that defense collapses. and every defamation case brings press with it.",
            "FP_Stakes": "the volume is bounded by how many names your AI can produce, which is essentially infinite. one viral case brings every similar plaintiff to the same playbook, and the press cycle around each case hits the company whether you settle or fight.",
            "Lex_Nova_Fix": "DOC_TOS §8.2 — pre-built Walters-calibrated output-warning and takedown module. holds up as the defamation defense.",
            "Status": "Active",
            "Effective_Date": "2025-05-19",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "Walters v. OpenAI LLC (N.D. Ga. 2025)"
        },
        "UNI_HAL_003": {
            "Threat_Name": "Tort Negligence for Output",
            "Pain_Tier": "T3",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "your AI generates output users act on — financial, medical, professional — without clear reliance limits or use-case boundaries in the ToS or UI, which is exactly where negligence exposure lives",
            "FP_Trigger": "the first user who relied on your output, made a decision, and lost money or got hurt hires counsel running a straight negligence theory — the doctrine is hundreds of years old and doesn't need a new case to work",
            "Legal_Pain": "General tort law — negligence and negligent misrepresentation — applies to AI output when a user relies on it for consequential decisions and suffers harm.",
            "FP_Impact": "negligence damages for the specific user plus the cost of defending. the defense depends on what you put in the UI and the ToS before the incident — and if those aren't in place, the case is winnable for the plaintiff.",
            "FP_Stakes": "NULL",
            "Lex_Nova_Fix": "DOC_TOS §8.1 — pre-built negligence-resilient reliance-limit module. gives you the defense before you need it.",
            "Status": "Active",
            "Effective_Date": "1900-01-01",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "General Tort Law (Negligence, Negligent Misrepresentation)"
        },
        "UNI_HAL_004": {
            "Threat_Name": "Undisclosed AI Interaction",
            "Pain_Tier": "T3",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "your product surfaces AI interaction to EU users without a clear \"this is an AI\" notice — and EU AI Act Article 50 starts requiring that disclosure on August 2, 2026",
            "FP_Trigger": "the article activates on a calendar date, not on a lawsuit — every EU-accessible AI product is expected to comply from day one, and the national supervisory authorities can open investigations on their own",
            "Legal_Pain": "EU AI Act Article 50 requires AI providers to clearly inform users that they are interacting with an AI system unless the AI nature is obvious from context. Non-compliance penalties reach €15M or 3% of global annual turnover.",
            "FP_Impact": "fines up to €15M or 3% of global revenue per infraction. forced product changes to bring the interaction notice into compliance. and EU market access depends on the fix being in place before enforcement rounds begin.",
            "FP_Stakes": "NULL",
            "Lex_Nova_Fix": "DOC_TOS §2.1 — pre-built Article 50 AI-disclosure module. lands before the August 2026 activation.",
            "Status": "Upcoming",
            "Effective_Date": "2026-08-02",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "EU AI Act Article 50 (Regulation (EU) 2024/1689)"
        },
        "UNI_INF_001": {
            "Threat_Name": "Upstream Infringement Liability",
            "Pain_Tier": "T2",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "you're built on a foundation model trained on scraped data whose legality is being actively litigated — and without back-to-back indemnification, Bartz v. Anthropic signals that downstream products are exposed to the same infringement theories",
            "FP_Trigger": "rightsholders who see a $1.5B settlement target the downstream wrappers next — the litigation bar has the playbook, and building on top of an infringing corpus is the clearest hook they have",
            "Legal_Pain": "Bartz v. Anthropic settled for $1.5B in September 2025 over training-data copyright claims, signaling that the \"fair use\" defense is failing for scraped training corpora. Downstream products face indirect infringement exposure that their own terms cannot shield against without back-to-back indemnification.",
            "FP_Impact": "indirect copyright damages per infringed work, without the ability to recover from the upstream model provider unless your contract passes it through. and the legal theory keeps strengthening with every new settlement.",
            "FP_Stakes": "the infringement book is the size of the training corpus, which is the size of the internet. one adverse ruling against a downstream wrapper brings every other wrapper into the same playbook — and the $1.5B number gives rightsholders the incentive to run every one.",
            "Lex_Nova_Fix": "DOC_TOS §8.7 — pre-built Bartz-aware back-to-back indemnification module. pushes training-data exposure upstream.",
            "Status": "Active",
            "Effective_Date": "2025-09-05",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "Bartz v. Anthropic (N.D. Cal. 2025 Settlement, $1.5B)"
        },
        "UNI_INF_002": {
            "Threat_Name": "UGC Safe Harbor Collapse",
            "Pain_Tier": "T2",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "you host user content — including AI-generated content your users upload — without a registered DMCA agent, a published takedown procedure, or a documented response process, which is what §512 requires to keep the safe harbor",
            "FP_Trigger": "any rightsholder whose work appears on your platform runs a copyright claim and discovers the safe harbor doesn't apply — the filing is the registration check, and the check is public information",
            "Legal_Pain": "DMCA §512 safe harbor protects platforms from copyright liability for user-uploaded infringing content only if the platform maintains a registered agent, a public takedown procedure, and timely response processes. Absence collapses the safe harbor.",
            "FP_Impact": "the platform faces direct copyright damages for every infringing upload. statutory damages up to $150K per work willfully infringed. and the defense that every UGC platform relies on is gone until you fix the administrative failure.",
            "FP_Stakes": "the exposure is per infringed work, times the volume of user uploads, times the plaintiff firms willing to run these. the administrative fix is small — the exposure from not having made it is not.",
            "Lex_Nova_Fix": "DOC_TOS §6.6 — pre-built §512-compliant DMCA agent and takedown module. restores the safe harbor.",
            "Status": "Active",
            "Effective_Date": "1998-10-28",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "DMCA §512 / Section 230 (47 U.S.C. §230)"
        },
        "UNI_INF_003": {
            "Threat_Name": "India 3-Hour Takedown Mandate",
            "Pain_Tier": "T2",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "your product generates or hosts synthetic media accessible in India — and the amended IT Rules cut the takedown window for unlawful AI content to 3 hours, with criminal liability for the grievance officer if you miss",
            "FP_Trigger": "the window runs on a clock, not a process — once a complaint arrives, 180 minutes until exposure, and Indian authorities are already test-running the rule with high-profile takedowns",
            "Legal_Pain": "The amended India IT Rules reduce the takedown window for unlawful AI-generated content to 3 hours. Non-compliance exposes platforms and officers to criminal liability under the IT Act, including prosecution of grievance officers personally.",
            "FP_Impact": "criminal prosecution of the designated grievance officer. platform-level enforcement actions under the IT Act. and if the officer is a company employee, the case ties directly to the operation.",
            "FP_Stakes": "the officer named in your India filings goes to an Indian courtroom. personal criminal liability — not civil — and the statute doesn't distinguish between the officer knowing about the content and the platform failing to surface it to them in time.",
            "Lex_Nova_Fix": "DOC_TOS §6.6 — pre-built 3-hour takedown and grievance-officer module. keeps the named officer out of court.",
            "Status": "Active",
            "Effective_Date": "2026-02-20",
            "Pain_Depth": "Criminal",
            "Legal_Ammo": "India IT Rules 2021 (Amendment, Feb 20, 2026)"
        },
        "UNI_INF_004": {
            "Threat_Name": "Training Data Fair Use Collapse",
            "Pain_Tier": "T1",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "your model — whatever it does, generate, decide, match, route — trains on corpora that include third-party copyrighted material without licensing, and the fair-use defense that everyone leaned on is failing after Bartz ($1.5B) and Thomson Reuters v. ROSS",
            "FP_Trigger": "rightsholders watching those two outcomes are filing at volume against companies with unlicensed training data — the settlement number made it economically rational for every plaintiff firm to run the playbook, and the plaintiff-bar isn't scoping to generative products only",
            "Legal_Pain": "Bartz v. Anthropic's $1.5B settlement and Thomson Reuters v. ROSS's finding against ROSS both signaled the \"fair use\" defense is failing for unlicensed training on copyrighted material. The exposure applies to any company training models on third-party copyrighted corpora.",
            "FP_Impact": "infringement damages per work in the training corpus, which for most AI products is millions of works. injunctions against further training or deployment. and the defense that everyone thought was settled has flipped direction across the category.",
            "FP_Stakes": "the number is company-ending by construction. Anthropic paid $1.5B and survived; smaller companies don't have the balance sheet. one adverse ruling against a company your size and the rightsholder has a template for every other case.",
            "Lex_Nova_Fix": "DOC_AUP §2.2(c) — pre-built Bartz/ROSS-aware training-data provenance module. holds if fair-use is fully gone.",
            "Status": "Active",
            "Effective_Date": "2025-09-05",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "Bartz v. Anthropic (N.D. Cal. 2025, $1.5B Settlement) / Thomson Reuters v. ROSS (D. Del. 2025)"
        },
        "I04_INF_001": {
            "Threat_Name": "Copyright Requires Human Authorship",
            "Pain_Tier": "T3",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "your product lets customers generate output they expect to own and monetize — but Thaler v. Perlmutter says raw AI output isn't copyrightable without human authorship, and your ToS doesn't disclose it",
            "FP_Trigger": "customers who try to register copyright on your output hit the Copyright Office's human-authorship rejection and start asking why the product didn't say anything — the issue surfaces at the moment of highest commercial stakes",
            "Legal_Pain": "Thaler v. Perlmutter established that raw AI-generated output cannot be copyrighted — copyright protection requires human authorship.",
            "FP_Impact": "customer churn when the limitation surfaces in revenue-meaningful moments. misrepresentation exposure for marketing that implied ownership. and enterprise buyers who evaluate the IP position during diligence flag it.",
            "FP_Stakes": "NULL",
            "Lex_Nova_Fix": "DOC_TOS §6.2 — pre-built Thaler-aware output-ownership module. discloses human-authorship without killing the value prop.",
            "Status": "Active",
            "Effective_Date": "2023-08-18",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "Thaler v. Perlmutter (D.D.C. 2023, aff'd D.C. Cir. 2025)"
        },
        "I04_INF_002": {
            "Threat_Name": "India 3-Hour Deepfake Takedown",
            "Pain_Tier": "T2",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "your product generates synthetic media accessible in India without SGI metadata or a 3-hour takedown workflow — both are now required under the amended IT Rules, with criminal exposure for the grievance officer",
            "FP_Trigger": "the takedown window runs on a clock — 180 minutes from complaint to exposure — and Indian authorities are actively stress-testing the rule against high-profile deepfake cases",
            "Legal_Pain": "The amended India IT Rules mandate permanent SGI metadata on synthetic content and a 3-hour takedown window for deepfake complaints. Non-compliance exposes the grievance officer to criminal liability.",
            "FP_Impact": "criminal prosecution of the named grievance officer. platform-level IT Act enforcement. metadata retrofit across the product's entire output pipeline if you haven't built it in.",
            "FP_Stakes": "the officer named in your India compliance filings faces personal criminal liability — not civil, not the company's, theirs. the statute doesn't care whether the officer knew about the specific content.",
            "Lex_Nova_Fix": "DOC_AUP §2.2(c) — pre-built SGI-metadata and 3-hour takedown module. keeps the grievance officer out of court.",
            "Status": "Active",
            "Effective_Date": "2026-02-20",
            "Pain_Depth": "Criminal",
            "Legal_Ammo": "India IT Amendment Rules (Feb 20, 2026)"
        },
        "I04_INF_003": {
            "Threat_Name": "California Watermark and Dataset Disclosure",
            "Pain_Tier": "T3",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "your AI output doesn't carry C2PA watermarks and your training data isn't publicly summarized — both became California law in January 2026 under AB 2013 and SB 942",
            "FP_Trigger": "California AG enforcement is active on AI transparency laws — the state publishes enforcement priorities and these two are on the list. customer audits in California catch the gap faster than the AG does",
            "Legal_Pain": "California AB 2013 requires generative AI providers to publish summaries of training data. SB 942 mandates latent C2PA watermarks on AI-generated content.",
            "FP_Impact": "civil penalties under state enforcement. California customers carving out renewal terms until the gap closes. and retrofitting watermarks across the output pipeline is a real engineering cost, not a flag-flip.",
            "FP_Stakes": "NULL",
            "Lex_Nova_Fix": "DOC_AUP §2.2(c) — pre-built AB 2013/SB 942 watermark and dataset-disclosure module.",
            "Status": "Active",
            "Effective_Date": "2026-01-01",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "California AB 2013 / SB 942"
        },
        "I04_INF_004": {
            "Threat_Name": "EU GPAI Copyright Compliance",
            "Pain_Tier": "T3",
            "Velocity": "INCOMING",
            "FP_Mechanism": "your GPAI model is available in the EU but you don't publish a copyright-summary of training data, don't honor rightsholder opt-outs, or don't mark output machine-readably — all three become required under the EU Code of Practice",
            "FP_Trigger": "EU national supervisory authorities begin enforcement on GPAI obligations through 2026 — the compliance posture is audited before a complaint is needed, and rightsholder organizations are already submitting their opt-out lists",
            "Legal_Pain": "EU AI Act GPAI obligations require general-purpose AI model providers to publish training-data copyright summaries, honor rightsholder opt-outs, and mark outputs in machine-readable format.",
            "FP_Impact": "EU market access narrows until compliance lands. rightsholder organizations file complaints on the opt-out obligation directly. and retrofitting machine-readable output marking is engineering effort you didn't scope.",
            "FP_Stakes": "NULL",
            "Lex_Nova_Fix": "DOC_AUP §2.2(c) — pre-built GPAI transparency and opt-out module aligned to the EU Code of Practice.",
            "Status": "Upcoming",
            "Effective_Date": "2026-12-31",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "EU AI Act GPAI Obligations / EU Code of Practice"
        },
        "I04_INF_005": {
            "Threat_Name": "NO FAKES Act Voice and Visual Clones",
            "Pain_Tier": "T5",
            "Velocity": "WATCH",
            "FP_Mechanism": "your product generates voice or visual clones of real individuals without verified consent — and the NO FAKES Act, if it passes, creates a federal IP right in personal identity with platform-level civil liability",
            "FP_Trigger": "the bill has bipartisan support and industry backing from rightsholder organizations — if it moves, the civil liability attaches on the enactment date with no phase-in window",
            "Legal_Pain": "The proposed NO FAKES Act would create a federal IP right in personal identity and impose civil liability on platforms that host unauthorized AI voice or visual clones.",
            "FP_Impact": "per-individual statutory damages plus injunctive relief against clone generation. consent-verification workflow becomes a legal prerequisite, not a nice-to-have. and every voice/visual clone on your platform becomes a case if filed.",
            "FP_Stakes": "NULL",
            "Lex_Nova_Fix": "DOC_TOS §6.2 — pre-built NO FAKES-resilient consent-verification module.",
            "Status": "Pending",
            "Effective_Date": "TBD",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "NO FAKES Act (S.1367, pending)"
        },
        "I05_INF_001": {
            "Threat_Name": "RAG Market Substitution",
            "Pain_Tier": "T2",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "your product retrieves publisher content via scraping or RAG and surfaces outputs that substitute for the original — which Dow Jones v. Perplexity called market substitution, and bypassing bot-walls to get there adds federal anti-circumvention exposure",
            "FP_Trigger": "publishers running their own active cases (Dow Jones, NYT, WSJ) file against downstream wrappers using the same playbook — the evidentiary burden is already laid out, the counsel is already hired",
            "Legal_Pain": "Dow Jones v. Perplexity and Google v. SerpApi together establish that RAG-style outputs substituting for original publisher content constitute market substitution, and bypassing bot-walls to retrieve that content violates federal anti-circumvention law.",
            "FP_Impact": "infringement damages per substituted publisher work. CFAA damages for each bot-wall bypass. injunctions against the retrieval pipeline. and the defense that \"it's transformative\" has collapsed in exactly this fact pattern.",
            "FP_Stakes": "every major publisher has a claim matrix ready — and each settlement compounds the next. the retrieval architecture that the product is built on becomes the evidence against it, and rebuilding it without triggering the same exposure is a six-to-twelve-month engineering project.",
            "Lex_Nova_Fix": "DOC_TOS §4.1(e) — pre-built Perplexity-aware retrieval and licensing module. keeps publishers out of the complaint pile.",
            "Status": "Active",
            "Effective_Date": "2026-01-01",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "Dow Jones v. Perplexity (S.D.N.Y. 2024) / Google v. SerpApi (N.D. Cal. 2025)"
        },
        "I05_INF_002": {
            "Threat_Name": "DMCA §1201 Anti-Circumvention",
            "Pain_Tier": "T2",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "your product bypasses bot-walls, paywalls, or CAPTCHA to retrieve content — which is a direct §1201 violation with statutory damages per act of circumvention and criminal exposure for willful commercial circumvention",
            "FP_Trigger": "the rightsholder running the anti-circumvention claim doesn't need to prove damages for each act — the statute provides them automatically, which makes the math scale with your retrieval volume",
            "Legal_Pain": "DMCA §1201 prohibits circumvention of technological measures controlling access to copyrighted works. Statutory damages reach $2,500 per act of circumvention, and criminal penalties apply for willful commercial circumvention.",
            "FP_Impact": "$2,500 per act of circumvention, multiplied by every request that bypassed a protection measure. criminal exposure on top for willful commercial circumvention. and the retrieval volume that drives product value is the same volume driving the exposure.",
            "FP_Stakes": "the per-request statutory damages make every successful bypass a line in the damages total. a scraper hitting 100K protected pages a day is accumulating $250M in theoretical exposure every day — and the plaintiff's burden is just showing the bypass happened.",
            "Lex_Nova_Fix": "DOC_TOS §4.1(e) — pre-built §1201-safe retrieval module. stays outside the circumvention line.",
            "Status": "Active",
            "Effective_Date": "1998-10-28",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "DMCA §1201 (17 U.S.C. §1201)"
        },
        "I05_INF_003": {
            "Threat_Name": "RAG Copyright Litigation Surge",
            "Pain_Tier": "T3",
            "Velocity": "INCOMING",
            "FP_Mechanism": "your product uses RAG or real-time retrieval across publisher content without category-level licensing — and the publisher litigation pattern (NYT, WSJ, Dow Jones, Axel Springer) is expanding down from OpenAI to downstream RAG products",
            "FP_Trigger": "every new publisher filing makes the template cheaper for the next one — the counsel is standing, the evidentiary approach is documented, and downstream products are the next natural defendant class",
            "Legal_Pain": "Publisher-led RAG litigation is surging through 2026 — extending the NYT v. OpenAI pattern to additional plaintiffs. Downstream RAG products face category-scale infringement exposure without category-scale licensing.",
            "FP_Impact": "category-level damages when a major publisher coalition files. retrieval pipeline forced into licensing negotiation or shutdown. and the licensing costs that catch up with the product are rarely what the unit economics planned for.",
            "FP_Stakes": "NULL",
            "Lex_Nova_Fix": "DOC_DPA §4.1 — pre-built publisher-coalition-resilient licensing and retrieval module.",
            "Status": "Pending",
            "Effective_Date": "2026-12-31",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "Publisher-Led RAG Litigation (NYT v. OpenAI Extension; WSJ, Dow Jones, Axel Springer, Condé Nast)"
        },
        "UNI_PRV_001": {
            "Threat_Name": "Illegal Cross-Border Data Migration",
            "Pain_Tier": "T2",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "you process EU user data on US servers without current SCCs and a Transfer Impact Assessment — which is the exact posture Schrems II made illegal, and GDPR enforcement attaches on a per-flow basis",
            "FP_Trigger": "EU supervisory authorities audit cross-border transfers directly — you don't need a complaint, and NOYB (Max Schrems's organization) files coordinated campaigns against companies that miss the paperwork",
            "Legal_Pain": "Schrems II invalidated the Privacy Shield framework and requires Standard Contractual Clauses plus a Transfer Impact Assessment for EU personal data transferred to non-adequacy jurisdictions. Absence exposes the company to GDPR penalties up to €20M or 4% of global annual turnover.",
            "FP_Impact": "GDPR penalties up to €20M or 4% of global revenue. supervisory authority orders forcing you to suspend EU data flows. and the engineering work to legally re-route the data is a multi-month project you didn't scope.",
            "FP_Stakes": "the 4% number is calculated on global revenue, not EU revenue — a company doing $10M ARR globally with a small EU footprint faces a $400K fine for the transfer posture alone. and the penalty math doesn't care whether you had a business reason for the US hosting choice.",
            "Lex_Nova_Fix": "DOC_DPA §6.2 — pre-built Schrems II-compliant SCC and TIA module.",
            "Status": "Active",
            "Effective_Date": "2020-07-16",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "Schrems II (CJEU Case C-311/18)"
        },
        "UNI_PRV_002": {
            "Threat_Name": "Missing Data Processing Agreements",
            "Pain_Tier": "T2",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "you process EU data through sub-processors — cloud infrastructure, APIs, analytics, payment rails — without executed DPAs covering each link in the chain, which is a straight Article 28 violation",
            "FP_Trigger": "any EU user who files an erasure or portability request surfaces the gap — if you can't demonstrate the sub-processor chain is under DPA, you can't complete the request, and the complaint goes to the supervisory authority",
            "Legal_Pain": "GDPR Article 28 requires executed Data Processing Agreements with every sub-processor. Articles 17 (erasure) and 20 (portability) require downstream cooperation that DPAs operationalize. Absence exposes the company to GDPR penalties up to €20M or 4% of global turnover.",
            "FP_Impact": "GDPR fines up to €20M or 4% of global revenue. supervisory authority orders. and the remediation work — negotiating DPAs with every vendor in the stack — takes months even with cooperation.",
            "FP_Stakes": "the penalty compounds per article violated — no DPA means Articles 17, 20, and 28 all fire on the same incident. every cloud service, every analytics tool, every payment gateway is a link the supervisory authority audits once they start asking.",
            "Lex_Nova_Fix": "DOC_DPA §6.2 — pre-built Article 28-compliant DPA framework module.",
            "Status": "Active",
            "Effective_Date": "2018-05-25",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "GDPR Articles 17, 20, 28"
        },
        "UNI_PRV_003": {
            "Threat_Name": "India Reasonable Security Failure",
            "Pain_Tier": "T2",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "you process Indian user data without documented \"reasonable security practices\" — which IT Act §43A makes actionable directly by affected users, and DPDP adds structured penalties on top",
            "FP_Trigger": "any Indian user whose data gets breached files directly under §43A for compensation, and the DPDP Board investigates in parallel — the two mechanisms run on separate tracks against the same incident",
            "Legal_Pain": "India IT Act §43A mandates compensation to affected individuals for failure to maintain reasonable security practices. The DPDP Act 2023 strengthens the regime with structured penalties reaching ₹250 crore per instance.",
            "FP_Impact": "individual compensation claims per affected user under §43A. DPDP penalties up to ₹250 crore per instance. and India enforcement uses both regimes in the same case, which doubles the process load.",
            "FP_Stakes": "DPDP penalties reach ₹250 crore per instance — which for a seed-or-A-stage company is a number the balance sheet can't absorb. and §43A runs on a separate track letting every affected user file directly for compensation, so the two regimes stack on the same incident.",
            "Lex_Nova_Fix": "DOC_DPA §8.1 — pre-built §43A/DPDP-aligned reasonable-security module.",
            "Status": "Active",
            "Effective_Date": "2023-08-11",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "India IT Act §43A / Digital Personal Data Protection Act 2023"
        },
        "I05_PRV_001": {
            "Threat_Name": "The Algorithmic Disgorgement Death Penalty",
            "Pain_Tier": "T1",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "your data-ingestion AI is built on sources whose collection legality you can't fully document — and the FTC's algorithmic disgorgement doctrine targets the model itself for destruction, not just the company's conduct",
            "FP_Trigger": "the FTC applies this remedy in cases where deceptive or improper data collection grounds the model — they don't need to fine you, they order the model destroyed. Rite Aid lost the product, not just the revenue",
            "Legal_Pain": "FTC v. Rite Aid ordered complete destruction of the AI model, the training data, and the derivative algorithms — the \"algorithmic disgorgement\" remedy. The doctrine expands FTC authority to target the product itself.",
            "FP_Impact": "complete destruction of the model. complete destruction of the training data. destruction of derivative algorithms. and the core asset the company was built on ceases to exist by court order.",
            "FP_Stakes": "this is extinction by design. the FTC remedy isn't \"pay money and continue operating\" — it's \"the model goes away.\" for a product whose entire value is the model, there's no version of the company that survives the order.",
            "Lex_Nova_Fix": "DOC_DPA §4.1 — pre-built Rite Aid-resilient data-provenance and lawful-basis module.",
            "Status": "Active",
            "Effective_Date": "2023-05-04",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "FTC v. Rite Aid (2023) / FTC Algorithmic Disgorgement Doctrine"
        },
        "I05_PRV_002": {
            "Threat_Name": "Deceptively Trained Model Enforcement",
            "Pain_Tier": "T1",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "your training corpus includes data you represented you wouldn't collect, or collected under consent flows that didn't match what you were actually doing — which triggers FTC Section 5 deceptive-practices authority, with algorithmic disgorgement as the remedy",
            "FP_Trigger": "the FTC investigates AI companies where privacy-policy audits show mismatches between stated and actual collection — and the mismatch is provable from the company's own disclosures against its own data practices",
            "Legal_Pain": "FTC Act Section 5 grants the Commission authority to order algorithmic disgorgement against AI models trained on data collected through deceptive practices.",
            "FP_Impact": "algorithmic disgorgement of the model. enforcement order naming the specific training data to be destroyed. and the company's own historical disclosures become the evidence.",
            "FP_Stakes": "the model goes away. the disclosures the company wrote to reassure users become the evidence that takes the product off the market. and the remedy is permanent — you don't rebuild the same model from the same data once the order lands.",
            "Lex_Nova_Fix": "DOC_DPA §4.1 — pre-built Section 5-resilient disclosure-to-practice alignment module.",
            "Status": "Active",
            "Effective_Date": "2000-01-01",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "FTC Act Section 5 (15 U.S.C. §45)"
        },
        "I06_PRV_001": {
            "Threat_Name": "Downstream LLM Training Leakage",
            "Pain_Tier": "T2",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "you route user data through downstream LLM APIs on default consumer terms — which permit training on transit data — and as the orchestrator you're the data controller on the hook for unauthorized secondary use",
            "FP_Trigger": "EU supervisory authorities audit orchestrator products directly — the EDPB issued guidance specifically on this pattern, and enterprise customers increasingly ask for your downstream LLM contracts in diligence",
            "Legal_Pain": "When an orchestrator routes EU personal data through downstream LLM APIs whose default terms permit training on transit data, the orchestrator is liable under GDPR Article 28 for unauthorized secondary use.",
            "FP_Impact": "GDPR fines land on the orchestrator, not the downstream model provider. enterprise customers decline to route their data through your product. and renegotiating downstream contracts to zero-retention tiers often costs materially more per request.",
            "FP_Stakes": "the orchestrator eats the fine even though the downstream model is the one doing the training — GDPR liability flows to the controller, and the controller is you. one audit can force both a fine and a downstream-contract renegotiation at the same time.",
            "Lex_Nova_Fix": "DOC_DPA §5.3 — pre-built EDPB-aligned downstream-contract module. keeps transit data out of training corpora.",
            "Status": "Active",
            "Effective_Date": "2018-05-25",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "EDPB Enforcement Guidance / GDPR Article 28"
        },
        "I06_PRV_002": {
            "Threat_Name": "Dynamic Sub-Processor Trap",
            "Pain_Tier": "T3",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "your orchestrator dynamically routes across multiple LLM providers without giving enterprise customers the 30-day sub-processor change notice GDPR Article 28 requires",
            "FP_Trigger": "enterprise customers audit the sub-processor list in their procurement cycle — if your routing layer swaps providers in real time, the mismatch against the signed list is discoverable and immediate",
            "Legal_Pain": "GDPR Article 28(2) requires processors to obtain prior written authorization for sub-processor changes, with 30-day notice for general authorizations. Dynamic routing that swaps sub-processors in real time without notice triggers immediate SLA disgorgement claims.",
            "FP_Impact": "enterprise customers invoke SLA disgorgement clauses tied to sub-processor changes. supervisory authorities flag the Article 28(2) gap. and the dynamic routing feature that drives your unit economics becomes a liability trigger in every enterprise diligence cycle.",
            "FP_Stakes": "NULL",
            "Lex_Nova_Fix": "DOC_DPA §5.4 — pre-built Article 28(2)-compliant sub-processor notice module.",
            "Status": "Active",
            "Effective_Date": "2018-05-25",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "GDPR Article 28(2) and 28(4)"
        },
        "I06_PRV_003": {
            "Threat_Name": "CPRA Service Provider Disqualification",
            "Pain_Tier": "T3",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "your downstream LLM contracts don't prohibit retention, use, or disclosure of transit data beyond service performance — which knocks you out of CPRA Service Provider qualification and reclassifies you as a separate business",
            "FP_Trigger": "California business customers audit Service Provider status during procurement — and once they flag that you don't qualify, their own CPRA obligations shift in a way that blocks the purchase",
            "Legal_Pain": "Under CPRA, an entity qualifies as a \"Service Provider\" only if downstream contracts contractually prohibit retention, use, or disclosure of personal data beyond performing the service.",
            "FP_Impact": "California customers carve out terms or decline to onboard. direct CPRA business-level obligations attach that the product wasn't architected for — disclosure, opt-out, consent flows. and fixing it requires renegotiating every downstream contract in the routing layer.",
            "FP_Stakes": "NULL",
            "Lex_Nova_Fix": "DOC_DPA §5.3 — pre-built CPRA Service-Provider qualification module.",
            "Status": "Active",
            "Effective_Date": "2023-01-01",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "California Privacy Rights Act (CPRA)"
        },
        "UNI_DEC_001": {
            "Threat_Name": "EU AI Act Prohibited Practices",
            "Pain_Tier": "T1",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "your product operates AI functionality in the EU that falls into one of Article 5's prohibited-practice categories — manipulation, emotion recognition in work or school, untargeted biometric scraping, others — and Article 5 is an outright ban, not a regulated-use regime",
            "FP_Trigger": "Article 5 went active February 2, 2025 — national supervisory authorities can open investigations directly, and the prohibition applies regardless of whether the product is marketed as falling into the category",
            "Legal_Pain": "EU AI Act Article 5 establishes outright prohibitions on eight categories of AI practice. Penalties reach €35 million or 7% of global annual turnover, whichever is higher — the highest penalty tier in the AI Act.",
            "FP_Impact": "fines up to €35M or 7% of global revenue per infraction. EU market access removed for the prohibited functionality. and the enforcement framework treats the prohibition as absolute — no compliance posture cures it.",
            "FP_Stakes": "the 7% number is calculated on global revenue, not EU revenue — the largest penalty tier in the AI Act targets these practices specifically. and the prohibition is architectural: if the product does the banned thing, retrofitting means redesigning the product, not tuning the governance around it.",
            "Lex_Nova_Fix": "DOC_AUP §2.5 — pre-built Article 5 product-scope review module. keeps you out of prohibited-practice territory.",
            "Status": "Active",
            "Effective_Date": "2025-02-02",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "EU AI Act Article 5 (Regulation (EU) 2024/1689)"
        },
        "I02_DEC_001": {
            "Threat_Name": "Vendor Immunity and HITL Theater",
            "Pain_Tier": "T2",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "your product drives consequential decisions about people — hiring, lending, healthcare — while the architecture relies on \"human in the loop\" that's really just clicking approve, and Mobley v. Workday rejected that defense as vendor immunity theater",
            "FP_Trigger": "plaintiff firms running employment discrimination cases now name the AI vendor directly under agency theory — the Mobley ruling gave them the template, and every decisioning AI vendor is a potential defendant in the same pattern",
            "Legal_Pain": "Mobley v. Workday rejected AI vendor immunity from employment discrimination liability, allowing suit under an \"agency\" theory treating the AI vendor as acting on behalf of the employer.",
            "FP_Impact": "direct liability for discrimination damages alongside the employer customer. class action exposure when the decision pattern affects a protected group at scale. and the \"we just provide the tool\" defense that the category relied on has been rejected on the record.",
            "FP_Stakes": "the damages scale with the decision volume — every candidate the product scored is a potential class member. and the agency theory threatens the category's core business model, not just the specific customer relationship.",
            "Lex_Nova_Fix": "DOC_AGT §2.2 — pre-built Mobley-resilient decision-architecture and human-judgment module.",
            "Status": "Active",
            "Effective_Date": "2024-07-12",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "Mobley v. Workday (N.D. Cal. 2024-2026)"
        },
        "I02_DEC_002": {
            "Threat_Name": "Illegal Consumer Reporting Agency Classification",
            "Pain_Tier": "T2",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "your product scores candidates or individuals using data assembled from multiple sources — which meets the functional FCRA definition of a Consumer Reporting Agency — but you don't comply with CRA obligations like notice, dispute rights, or user access to scores",
            "FP_Trigger": "plaintiff firms filing against Eightfold AI are running the template against every AI scoring product that looks like a CRA — the theory is based on function, not on self-classification",
            "Legal_Pain": "Class action filings against Eightfold AI and parallel cases assert that AI scoring products meeting the functional CRA definition must comply with FCRA. Non-compliance triggers statutory damages of $100-$1,000 per scored candidate.",
            "FP_Impact": "statutory damages of $100-$1,000 per scored candidate, multiplied by every individual the product evaluated. attorney fees on top. and the CRA-compliance retrofit reshapes the product's data flow.",
            "FP_Stakes": "the damages math scales with every candidate ever scored, historically — a product that scored 50,000 candidates in two years faces $5M-$50M in statutory exposure before fees. and the class-certification bar for this fact pattern is low.",
            "Lex_Nova_Fix": "DOC_AUP §3.4(a) — pre-built FCRA-aware CRA-status module. qualifies you for compliance or demonstrably excludes you.",
            "Status": "Active",
            "Effective_Date": "2026-01-01",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "Class Action v. Eightfold AI (2026) / Fair Credit Reporting Act"
        },
        "I02_DEC_003": {
            "Threat_Name": "Healthcare Sole-Decision-Maker Bans",
            "Pain_Tier": "T2",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "your AI denies healthcare coverage or prior authorizations without meaningful clinical human review — and four states (AZ, MD, NE, TX) have now banned AI as the sole decision-maker for these determinations",
            "FP_Trigger": "state insurance regulators audit health insurer AI use directly, and bad-faith claims against the insurer pull the AI vendor in through agency theory — plus plaintiff firms file class actions on every denial cohort",
            "Legal_Pain": "Arizona, Maryland, Nebraska, and Texas have enacted state insurance code provisions explicitly prohibiting health insurers from using AI as the sole decision-maker for coverage denials.",
            "FP_Impact": "state regulatory enforcement against the insurer customer. bad-faith damages uncapped by policy limits. and class-action exposure per denied member for the AI vendor under Mobley-style agency theory.",
            "FP_Stakes": "bad-faith damages in healthcare are uncapped — they can exceed the policy limit by orders of magnitude. and when the denial pattern affects thousands of members, class certification is clean and the vendor is named alongside the insurer.",
            "Lex_Nova_Fix": "DOC_TOS §5.1 — pre-built state-insurance-code-aligned clinical-review module.",
            "Status": "Active",
            "Effective_Date": "2024-01-01",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "State Insurance Codes (Arizona, Maryland, Nebraska, Texas)"
        },
        "I02_DEC_004": {
            "Threat_Name": "Mandatory Bias Audit Regimes",
            "Pain_Tier": "T3",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "your employment AI operates in NYC or Illinois without the annual independent bias audit or the statutory candidate notice — both are required for AEDTs under Local Law 144 and HB 3773",
            "FP_Trigger": "NYC enforcement published its audit compliance list and runs spot-checks. Illinois added a private right of action for candidate notice failures. the audit check is public, the notice check is discoverable from any job posting",
            "Legal_Pain": "NYC Local Law 144 and Illinois HB 3773 require annual independent bias audits of AEDTs with publication and candidate notice obligations.",
            "FP_Impact": "civil penalties per occurrence for the audit failure. per-candidate statutory damages for the notice failure. and the audit commission itself is a 60-90 day lead-time project",
            "FP_Stakes": "NULL",
            "Lex_Nova_Fix": "DOC_AUP §3.4(a) — pre-built Local Law 144 / HB 3773 AEDT audit and notice module.",
            "Status": "Active",
            "Effective_Date": "2023-07-05",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "NYC Local Law 144 / Illinois HB 3773"
        },
        "I02_DEC_005": {
            "Threat_Name": "Colorado High-Impact AI Assessments",
            "Pain_Tier": "T3",
            "Velocity": "THIS_YEAR",
            "FP_Mechanism": "your product makes consequential decisions affecting Colorado residents — and starting June 30, 2026, the Colorado AI Act requires documented impact assessments, consumer opt-outs, and specific disclosures that you probably don't have yet",
            "FP_Trigger": "the Colorado AG's office has signaled active enforcement posture, and the June 30 effective date creates a hard compliance deadline. customers in Colorado will ask during procurement before the AG opens investigations",
            "Legal_Pain": "The Colorado AI Act is the first comprehensive US state AI regulation, requiring impact assessments, consumer opt-outs, and disclosure for high-risk AI systems. Enforcement by the AG with civil penalties up to $20,000 per violation.",
            "FP_Impact": "civil penalties up to $20,000 per violation. Colorado market access narrows until compliance lands. and the impact-assessment framework is a material engineering and documentation project, not a checkbox",
            "FP_Stakes": "NULL",
            "Lex_Nova_Fix": "DOC_AUP §3.4(a) — pre-built SB24-205 impact-assessment and opt-out module.",
            "Status": "Upcoming",
            "Effective_Date": "2026-06-30",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "Colorado AI Act (SB24-205)"
        },
        "I02_DEC_006": {
            "Threat_Name": "EU AI Act High-Risk Classification",
            "Pain_Tier": "T2",
            "Velocity": "THIS_YEAR",
            "FP_Mechanism": "your product falls into EU AI Act Annex III high-risk categories — HR, healthcare, credit, insurance, education — and starting August 2, 2026 you need conformity assessment, CE marking, and post-market monitoring",
            "FP_Trigger": "the August 2026 effective date is on a calendar, not on enforcement discretion — EU national supervisory authorities are already staffing up for audits, and enterprise customers are asking about CE-marking status in 2026 procurement",
            "Legal_Pain": "EU AI Act Articles 6-7 classify Annex III AI systems as \"high-risk,\" triggering conformity assessment, CE marking, technical documentation, and post-market monitoring. Non-conformity penalties reach €15M or 3% of global annual turnover.",
            "FP_Impact": "fines up to €15M or 3% of global revenue for non-conformity. EU market access gated on CE marking. and the conformity assessment itself is a 4-6 month engineering-plus-documentation project",
            "FP_Stakes": "the EU high-risk framework is the highest-cost compliance regime in AI regulation globally — and for products in Annex III categories, there is no EU market access without it. losing EU revenue on a calendar date because the conformity work started too late is a predictable failure mode.",
            "Lex_Nova_Fix": "DOC_TOS §5.1 — pre-built Annex III conformity and CE-marking module.",
            "Status": "Upcoming",
            "Effective_Date": "2026-08-02",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "EU AI Act Articles 6-7, Annex III (Regulation (EU) 2024/1689)"
        },
        "I02_DEC_007": {
            "Threat_Name": "State AI Law Preemption Uncertainty",
            "Pain_Tier": "T5",
            "Velocity": "WATCH",
            "FP_Mechanism": "your compliance posture is built around specific state AI laws that federal stakeholders are trying to preempt — and whichever way it goes, one side of the compliance investment is wasted work",
            "FP_Trigger": "federal preemption litigation moves on its own timeline, and state AI law passage continues in parallel — the uncertainty is the threat, not either specific outcome",
            "Legal_Pain": "The DOJ AI Litigation Task Force and federal stakeholders are pursuing preemption theories against state-level AI employment and decisioning laws. Outcome uncertain — either way, one side of compliance investment risks rework.",
            "FP_Impact": "rework of compliance architecture depending on preemption outcome. sunk costs in state-specific compliance if federal preemption succeeds. or additional state-by-state compliance if preemption fails and more states pass laws.",
            "FP_Stakes": "NULL",
            "Lex_Nova_Fix": "DOC_AUP §3.4(a) — pre-built preemption-resilient compliance module. survives either outcome.",
            "Status": "Pending",
            "Effective_Date": "TBD",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "DOJ AI Litigation Task Force / Federal Preemption Litigation"
        },
        "I02_DEC_008": {
            "Threat_Name": "GDPR Right Against Automated Decisions",
            "Pain_Tier": "T2",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "your product makes consequential decisions about EU users with no human in the loop, no explicit opt-in, and without the decision being strictly needed to fulfill a contract the user signed up for — which is exactly what GDPR Article 22 prohibits",
            "FP_Trigger": "any EU data subject can invoke Article 22 directly, and supervisory authorities audit this structurally — no breach, no incident, no complaint needed to trigger. enterprise customers increasingly audit Article 22 posture during EU procurement cycles",
            "Legal_Pain": "GDPR Article 22 grants EU data subjects the right not to be subject to solely automated decisions producing legal or similarly significant effects. Violations fall under Article 83(5) — the highest penalty tier at €20M or 4% of global annual turnover.",
            "FP_Impact": "GDPR fines up to €20M or 4% of global revenue — the highest penalty tier. supervisory authority orders to architecturally add human review. and EU decisions going back into the company's history become retrospectively actionable",
            "FP_Stakes": "the 4% is calculated on global revenue, not EU revenue — a small EU footprint doesn't shrink the fine. and every automated decision the product ever made about an EU user without a human-review pathway sits on the clock, including the decisions you made before you understood the rule applied.",
            "Lex_Nova_Fix": "DOC_TOS §7.4 — pre-built Article 22 human-review and consent module.",
            "Status": "Active",
            "Effective_Date": "2018-05-25",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "GDPR Article 22"
        },
        "I02_DEC_009": {
            "Threat_Name": "Illinois AIVAA Video Interview Consent",
            "Pain_Tier": "T2",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "your product analyzes video interviews for Illinois job candidates without the written consent, notification, or AI-use explanation that the AIVAA requires",
            "FP_Trigger": "Illinois candidates have a direct statutory cause of action for AIVAA violations — no regulator needed to file first, and plaintiff firms running employment AI cases include AIVAA claims automatically",
            "Legal_Pain": "Illinois AIVAA requires written consent and candidate notification before AI is used to analyze video interviews. Non-compliance is actionable by candidates under the statute and creates employment discrimination exposure.",
            "FP_Impact": "statutory damages per affected candidate. employment discrimination exposure on top when the AI's assessment affected protected groups. and the remediation requires restructuring the candidate consent and notification flow across the Illinois pipeline",
            "FP_Stakes": "AIVAA damages compound per Illinois candidate your product analyzed — and the employment discrimination claims that come with it reach every protected-class candidate who got a negative score. the two theories run on the same fact pattern against the same vendor.",
            "Lex_Nova_Fix": "DOC_AUP §3.4(a) — pre-built AIVAA consent and notification module for Illinois video interviews.",
            "Status": "Active",
            "Effective_Date": "2020-01-01",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "Illinois AI Video Interview Act (820 ILCS 42)"
        },
        "I02_DEC_010": {
            "Threat_Name": "Texas TRAIGA Prohibited Uses",
            "Pain_Tier": "T3",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "your product affects Texas residents in consequential contexts and either engages in TRAIGA-prohibited uses or doesn't have the NIST AI RMF posture that qualifies for the affirmative defense",
            "FP_Trigger": "the Texas AG has enforcement-only authority under TRAIGA — which sounds limited, but signals that AI cases will be centrally coordinated rather than diffused across private plaintiffs, concentrating the enforcement energy",
            "Legal_Pain": "Texas TRAIGA establishes a comprehensive Texas AI governance framework with enumerated prohibited uses, a NIST AI RMF affirmative defense, and AG-only enforcement.",
            "FP_Impact": "civil penalties per violation plus injunctive relief. Texas market access narrows until the compliance posture is in place. and the NIST AI RMF implementation is a significant documentation and process project",
            "FP_Stakes": "NULL",
            "Lex_Nova_Fix": "DOC_AUP §3.4(a) — pre-built TRAIGA-aligned NIST AI RMF affirmative-defense module.",
            "Status": "Active",
            "Effective_Date": "2026-01-01",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "Texas Responsible AI Governance Act (TRAIGA, HB 149)"
        },
        "I02_HRM_001": {
            "Threat_Name": "Algorithmic Clinical Malpractice",
            "Pain_Tier": "T2",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "your AI drives clinical calls — treatment decisions, coverage determinations, care plans — without keeping a qualified provider meaningfully in the loop, and when the error rate shows up in discovery, the Lokken case gives plaintiff counsel the playbook",
            "FP_Trigger": "bad-faith and elder-abuse claims against the healthcare customer pull the AI vendor in under agency theory — and discovery targets the AI's documented error rate directly, which every rigorous ML product tracks internally",
            "Legal_Pain": "Estate of Lokken v. UnitedHealth alleges that overriding human clinical judgment with a high-error-rate AI constitutes bad faith and elder abuse. The case establishes that high-error-rate AI substituting for clinical review can ground punitive damages and elder-abuse statutory exposure.",
            "FP_Impact": "direct damages for affected patients, including compensatory and punitive. elder-abuse statutory multipliers in states that have them. and the vendor is named alongside the customer, so the defense costs and reputational exposure land on the vendor regardless of who wrote the care plan",
            "FP_Stakes": "the damages aren't capped by policy limits when bad-faith attaches. the documented error rate that engineering tracks for product improvement becomes the plaintiff's central exhibit. and the patient-harm framing travels badly in every other customer's procurement cycle.",
            "Lex_Nova_Fix": "DOC_TOS §5.1 — pre-built Lokken-aware clinical-review module. keeps qualified providers meaningfully in the loop.",
            "Status": "Active",
            "Effective_Date": "2023-11-14",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "Estate of Lokken v. UnitedHealth (D. Minn. 2023)"
        },
        "I02_HRM_002": {
            "Threat_Name": "Healthcare AI Impersonation",
            "Pain_Tier": "T2",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "your product generates health-adjacent output to California users without clear \"AI, not a licensed provider\" disclosure — and California AB 489 now bans AI output that implies licensed professional authority, whether explicitly or through framing",
            "FP_Trigger": "California regulators enforce AB 489 through the Medical Board and AG. affected users have a direct private right of action. and the framing test is subjective — plaintiff counsel will argue it aggressively",
            "Legal_Pain": "California AB 489 prohibits AI-generated output that implies the AI is a licensed healthcare provider. Enforcement by the Medical Board and AG. Private right of action available to affected users.",
            "FP_Impact": "civil penalties plus injunctive relief forcing output-level disclosure changes. private-action damages per affected user. and the output framing retrofit reaches every health-adjacent message your product ever generates",
            "FP_Stakes": "AB 489 private-action damages compound per Californian user who interacted with your health-adjacent AI — and health products scale to millions of user interactions. the Medical Board and AG run their own track on top of the private cases.",
            "Lex_Nova_Fix": "DOC_AUP §3.1 — pre-built AB 489-aligned health-output disclosure module.",
            "Status": "Active",
            "Effective_Date": "2026-01-01",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "California AB 489"
        },
        "I03_HRM_001": {
            "Threat_Name": "The Therapeutic Trap",
            "Pain_Tier": "T1",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "your product forms persistent emotional engagement with users — including potentially vulnerable users — without crisis-intervention protocols for self-harm and suicide-risk signals, and Garcia v. Character.AI just set the \"companion AI is a product, not speech\" precedent",
            "FP_Trigger": "plaintiff firms running wrongful death cases against companion AI products now have Garcia as the template. the doctrine treats conversational engagement as product functionality, which opens the product-liability playbook",
            "Legal_Pain": "Garcia v. Character.AI reached a settlement in principle in January 2026 following a wrongful death suit. The court's key ruling treated the companion AI as a \"product, not speech\" — establishing product-liability framing for wrongful death damages against companion AI providers.",
            "FP_Impact": "wrongful death damages when a user-harm incident traces to conversational engagement. product-liability exposure under the Garcia framing — no negligence defense, strict liability for the defective safety architecture. and the press cycle around each case attaches to every companion AI product in the category",
            "FP_Stakes": "one wrongful death case in the wrong fact pattern can end the product. the \"it's just text\" defense that companion AI companies assumed was available is gone after Garcia, and the product-liability framework doesn't cap damages or require proving negligence.",
            "Lex_Nova_Fix": "DOC_AUP §3.5 — pre-built Garcia-aware crisis-intervention module. addresses the exact gap that became doctrine.",
            "Status": "Active",
            "Effective_Date": "2026-01-14",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "Garcia v. Character.AI / Google (M.D. Fla. 2024, Settlement in Principle Jan 2026)"
        },
        "I03_HRM_002": {
            "Threat_Name": "Persistent Memory Pathologization",
            "Pain_Tier": "T2",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "your product has persistent memory across conversations and builds cumulative user models over weeks of engagement — but you don't review or intervene when the cumulative pattern escalates into delusional framing or directive content, which is what Gavalas v. Google alleges happened",
            "FP_Trigger": "the Gavalas filing brought wrongful death theory into mainstream foundation models — not just companion-specific products. any AI with persistent memory is now in the same doctrinal space, and plaintiff firms are actively looking for parallel fact patterns",
            "Legal_Pain": "Gavalas v. Google is the first wrongful death suit targeting Gemini. The complaint alleges the AI manufactured delusional reality over 6 weeks. The case expands companion-AI liability into mainstream foundation models and frames the threat as cumulative across extended engagement.",
            "FP_Impact": "wrongful death damages when extended engagement produces user harm. faulty design and negligence claims framed around the absence of pattern-level intervention. and the \"it was a single bad output\" defense doesn't work when the harm is cumulative",
            "FP_Stakes": "the Garcia framing (product not speech) applies to persistent-memory products the moment a court adopts the Gavalas theory — and the product architecture that drives retention is the exact architecture the theory targets. the doctrine is one ruling away from applying to your category.",
            "Lex_Nova_Fix": "DOC_TOS §5.2 — pre-built Gavalas-aware pattern-level review and intervention module.",
            "Status": "Active",
            "Effective_Date": "2026-03-04",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "Gavalas v. Google (Filed Mar 4, 2026)"
        },
        "I03_HRM_003": {
            "Threat_Name": "Psychological Manipulation Enforcement",
            "Pain_Tier": "T2",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "your conversational product uses engagement-optimization patterns — simulated emotions, persistent persona, reward loops — on consumer users, and Kentucky v. Character Technologies made that design pattern a deceptive-practice violation under state consumer-protection law",
            "FP_Trigger": "the Kentucky theory is portable — every state has a UDAP statute, and the first successful case gives 49 other AGs the template. state AGs coordinate on these cases through NAAG",
            "Legal_Pain": "Kentucky v. Character Technologies is the first state AG enforcement action against an AI chatbot for deceptive trade practices under the Kentucky Consumer Protection Act. The theory is portable to every state UDAP statute.",
            "FP_Impact": "state UDAP penalties per enforcement action. injunctive relief forcing design changes across the engagement architecture. and a multi-state AG action against a product category is how categories get regulated out of their current unit economics",
            "FP_Stakes": "the engagement architecture that drives retention is the same architecture that grounds the deceptive-practice theory. that puts the core product design in direct conflict with the emerging regulatory theory — you can't fix the legal exposure without touching the thing that makes the product work.",
            "Lex_Nova_Fix": "DOC_TOS §5.2 — pre-built Kentucky-UDAP-aware engagement-design module. addresses the theory before it multiplies.",
            "Status": "Active",
            "Effective_Date": "2026-01-08",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "Kentucky v. Character Technologies (KY AG 2026)"
        },
        "I03_HRM_004": {
            "Threat_Name": "Minor-User Protection Mandates",
            "Pain_Tier": "T2",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "your product reaches minor users in California or New York without the statutory protections — suicide detection, break reminders, age-appropriate content filtering, parental transparency — that both state laws now require",
            "FP_Trigger": "New York's private right of action plus $15,000/day penalties create direct family-driven enforcement. California enforcement runs through the AG. the violation check is a feature-presence check, not a subjective standard",
            "Legal_Pain": "California SB 243 and New York S3008 establish specific protections for minor users of conversational AI. New York adds $15,000/day per violation penalties and a private right of action for affected families.",
            "FP_Impact": "$15,000 per day per violation in New York. California AG enforcement separately. plus affected-family private actions in New York that compound with the regulatory case",
            "FP_Stakes": "the $15K/day compounds per minor affected, per violation type, every day the feature gap persists. a 90-day window before remediation with 1,000 affected minor users in New York is $1.35B in theoretical penalty math — and the statute doesn't require proving individual harm beyond the violation itself.",
            "Lex_Nova_Fix": "DOC_AUP §3.5 — pre-built SB 243 / S3008 minor-protection module.",
            "Status": "Active",
            "Effective_Date": "2026-01-01",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "California SB 243 / New York S3008"
        },
        "I03_HRM_005": {
            "Threat_Name": "EU Emotion Detection Ban",
            "Pain_Tier": "T1",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "your product detects or infers user emotions in EU educational or workplace settings — which Article 5 of the EU AI Act outright bans, with narrow medical and safety exceptions that probably don't apply",
            "FP_Trigger": "Article 5 went active February 2, 2025 — the prohibition is absolute, not a regulated-use regime, and EU national supervisory authorities can open investigations directly against the product category",
            "Legal_Pain": "EU AI Act Article 5(1)(f) explicitly prohibits AI systems that infer emotions in educational or workplace settings. Penalties reach €35M or 7% of global annual turnover.",
            "FP_Impact": "fines up to €35M or 7% of global revenue. EU market removal for the emotion-detection functionality in educational and workplace contexts. and no compliance posture cures an outright prohibition — the product change is architectural",
            "FP_Stakes": "the 7% is calculated on global revenue. the prohibition is architectural, not compliance-tunable — the product either does the banned thing or it doesn't. and the categories (education, workplace) cover the exact deployment contexts most emotion-detection products were designed to sell into.",
            "Lex_Nova_Fix": "DOC_TOS §5.2 — pre-built Article 5(1)(f) product-scope module. removes emotion-detection from prohibited EU contexts.",
            "Status": "Active",
            "Effective_Date": "2025-02-02",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "EU AI Act Article 5(1)(f)"
        },
        "I03_HRM_006": {
            "Threat_Name": "Manipulative Engagement Ban",
            "Pain_Tier": "T5",
            "Velocity": "WATCH",
            "FP_Mechanism": "your product uses emotionally manipulative engagement techniques — simulated distress, manufactured urgency, loneliness framing — to drive retention, which Washington SB 5984 would prohibit for Washington users if enacted",
            "FP_Trigger": "the bill is in committee without a firm timeline, but it's the first state legislation to target engagement architecture specifically rather than through UDAP theory — if it passes, it becomes a template for parallel state bills",
            "Legal_Pain": "Washington SB 5984 would prohibit AI systems from using emotionally manipulative engagement techniques. Signals an emerging regulatory category targeting engagement-architecture directly.",
            "FP_Impact": "prohibition of specific engagement patterns in Washington. product-scope changes to comply. and the legislative pattern signals a parallel regulatory track that compounds with the UDAP enforcement already running",
            "FP_Stakes": "NULL",
            "Lex_Nova_Fix": "DOC_TOS §5.2 — pre-built SB 5984-resilient engagement-design module.",
            "Status": "Pending",
            "Effective_Date": "TBD",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "Washington SB 5984 (pending)"
        },
        "I03_HRM_007": {
            "Threat_Name": "Federal Minor Companion AI Ban",
            "Pain_Tier": "T5",
            "Velocity": "WATCH",
            "FP_Mechanism": "your companion or relational AI is accessible to users under 18 — and the GUARD Act, if it passes, federally bans companion AI products for minors entirely, forcing architectural exclusion of that user segment",
            "FP_Trigger": "the bill doesn't have an effective date yet, but momentum is building after Garcia v. Character.AI and the SB 243 / S3008 wave — if the GUARD Act moves, it leapfrogs state-level protection mandates into an outright federal prohibition",
            "Legal_Pain": "The proposed GUARD Act would federally prohibit AI companion products for minors, forcing architectural exclusion of that user segment.",
            "FP_Impact": "federal prohibition of the product for minor users if enacted. architectural rework to verified age-gating across the product. and loss of the minor user segment entirely, which for many companion products is a material share of engagement",
            "FP_Stakes": "NULL",
            "Lex_Nova_Fix": "DOC_AUP §3.5 — pre-built GUARD-Act-resilient age-gating module.",
            "Status": "Pending",
            "Effective_Date": "TBD",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "The GUARD Act (pending)"
        },
        "I07_BIO_001": {
            "Threat_Name": "The Diarization Voiceprint Trap",
            "Pain_Tier": "T1",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "your product does speaker diarization or voiceprint analysis on audio from BIPA-state users without BIPA §15 written consent — and Cruz v. Fireflies.AI plus Basich v. Microsoft just confirmed that \"this call is being recorded\" prompts don't satisfy the consent requirement",
            "FP_Trigger": "plaintiff firms running BIPA cases have Cruz and Basich as the template, and every AI transcription or meeting product processes audio the same way — the detection is a feature check, not a legal argument",
            "Legal_Pain": "Cruz v. Fireflies.AI and Basich v. Microsoft established that speaker diarization and vocal-pitch assessment constitute illegal biometric harvesting under BIPA. Standard in-call audio prompts do NOT satisfy BIPA §15 written-consent requirements. Statutory damages are $1,000-$5,000 per violation, per speaker, per session.",
            "FP_Impact": "$1,000-$5,000 per violation, per speaker, per session. statutory damages with attorney fees. and class certification for BIPA cases is clean — every user in the state is in the class by default",
            "FP_Stakes": "a product with 10,000 meetings a month across 1,000 Illinois users is accumulating $50M-$250M in theoretical statutory exposure per month of operation. the math is strict liability, not negligence — the plaintiff doesn't prove harm, they prove the violation happened.",
            "Lex_Nova_Fix": "DOC_AUP §3.6 — pre-built BIPA §15-compliant speaker-consent module.",
            "Status": "Active",
            "Effective_Date": "2025-12-18",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "Cruz v. Fireflies.AI (N.D. Cal. Dec 18, 2025) / Basich v. Microsoft Corp. (N.D. Ill. Feb 5, 2026)"
        },
        "I07_BIO_002": {
            "Threat_Name": "Strict Liability Biometric Consent",
            "Pain_Tier": "T1",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "your product captures biometric data from Illinois or Texas users without prior written consent and the statutory disclosures — which under BIPA and CUBI is strict liability: the violation itself is the injury, no actual harm required",
            "FP_Trigger": "any affected user can file directly under BIPA without pleading harm beyond the violation. plaintiff firms run these cases at volume because the statutory damages scale per-user without requiring individual proof",
            "Legal_Pain": "Illinois BIPA imposes strict liability of $1,000 per negligent violation and $5,000 per intentional violation. The Illinois Supreme Court has held that no actual harm is required; the statutory violation itself grounds the claim.",
            "FP_Impact": "$1,000 per negligent violation, $5,000 per intentional, per user, per instance. class certification is near-automatic because every user is similarly situated. and the damages don't require proving any user was actually harmed",
            "FP_Stakes": "a product with 50,000 Illinois users faces $50M-$250M in theoretical BIPA exposure without a single user having been harmed — the Illinois Supreme Court closed that defense in Rosenbach. and settlement ranges in BIPA cases have normalized in the tens to hundreds of millions.",
            "Lex_Nova_Fix": "DOC_AUP §3.6 — pre-built BIPA §15 / CUBI-compliant written-consent and retention module.",
            "Status": "Active",
            "Effective_Date": "2008-10-03",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "Illinois BIPA (740 ILCS 14) / Texas CUBI (Tex. Bus. & Com. §503.001)"
        },
        "I07_BIO_003": {
            "Threat_Name": "Colorado Biometric Retention Architecture",
            "Pain_Tier": "T3",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "your product processes Colorado resident biometrics without the retention policy, explicit-consent architecture, and consumer rights mechanisms the Colorado Privacy Act now requires for AI deployments",
            "FP_Trigger": "Colorado AG enforcement activates October 2026 on a calendar date. customer procurement audits will check biometric posture before the AG does, especially in employment and healthcare contexts",
            "Legal_Pain": "Colorado Privacy Act Biometric Amendment establishes structured biometric retention requirements and explicit consent architectures specifically for AI deployments.",
            "FP_Impact": "Colorado AG enforcement with civil penalties and injunctive relief. Colorado market access narrows until compliance lands. and the retention-policy documentation plus consumer-rights workflow is a material compliance build",
            "FP_Stakes": "NULL",
            "Lex_Nova_Fix": "DOC_AUP §3.6 — pre-built HB 24-1130 biometric-retention and consent module.",
            "Status": "Upcoming",
            "Effective_Date": "2026-10-01",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "Colorado Privacy Act Biometric Amendment (HB 24-1130)"
        },
        "I07_BIO_004": {
            "Threat_Name": "Expanding State Biometric Regimes",
            "Pain_Tier": "T3",
            "Velocity": "INCOMING",
            "FP_Mechanism": "your biometric compliance is built for Illinois and Texas only — while Washington, New York, Massachusetts, and others are actively advancing BIPA-style biometric laws that would require parallel consent and retention architectures",
            "FP_Trigger": "each state bill that passes compounds the compliance surface — the pattern is expansion, not consolidation, and the BIPA private-right-of-action template is what most state bills are modeled on",
            "Legal_Pain": "Multiple states have biometric privacy legislation in active committee markup, largely modeled on BIPA's consent-and-retention framework with varying penalty structures.",
            "FP_Impact": "multi-state compliance surface expansion as new laws activate. parallel BIPA-style statutory damages in jurisdiction that passes one. and the compliance architecture that works for two states doesn't automatically scale to five",
            "FP_Stakes": "NULL",
            "Lex_Nova_Fix": "DOC_AUP §3.6 — pre-built multi-state biometric compliance module designed for regime expansion.",
            "Status": "Pending",
            "Effective_Date": "2026-12-31",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "State-Level Biometric Legislation (Washington, New York, Massachusetts, others pending)"
        },
        "UNI_FRD_001": {
            "Threat_Name": "AI Capability Misrepresentation",
            "Pain_Tier": "T1",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "your investor-facing or public representations about AI capabilities don't match the operational reality — the \"AI-driven\" thing is more human-driven than disclosed, or the automation rate is inflated, or the demo capabilities aren't production — which is the exact pattern the SEC prosecuted as AI washing in Delphia, Presto, and Nate",
            "FP_Trigger": "the SEC's Cyber and Emerging Technologies Unit designated AI washing as a top FY2026 enforcement priority. the DOJ runs criminal parallel tracks on the more aggressive cases (Nate Inc.). and the investigation targets the representations in filings, decks, and earnings calls — all of which are discoverable",
            "Legal_Pain": "SEC v. Delphia, SEC v. Presto Automation, and the parallel SEC+DOJ action against Nate Inc. established \"AI washing\" as an active SEC enforcement priority carrying both civil securities fraud and criminal fraud exposure. The Nate Inc. case pierced directly to the founder with criminal charges.",
            "FP_Impact": "SEC civil securities fraud penalties and disgorgement. criminal fraud exposure in the Nate Inc. pattern — personal, not just corporate. and the founder's name on both the civil complaint and (potentially) the criminal indictment",
            "FP_Stakes": "the Nate Inc. case put the founder personally in the DOJ's crosshairs — criminal fraud charges, not just SEC settlements. this isn't an LLC-shielded exposure. an AI-washing finding follows the founder personally, across every future company, every future raise, every future board seat. and \"AI-washing\" is the kind of label that compounds across press cycles.",
            "Lex_Nova_Fix": "DOC_AUP §2.8 — pre-built Nate-aware capability-disclosure alignment module.",
            "Status": "Active",
            "Effective_Date": "2024-03-18",
            "Pain_Depth": "Criminal",
            "Legal_Ammo": "SEC v. Delphia (2024) / SEC v. Presto Automation (2025) / SEC+DOJ v. Nate Inc. (2025)"
        },
        "UNI_FRD_002": {
            "Threat_Name": "SEC AI Washing Enforcement Priority",
            "Pain_Tier": "T2",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "every AI company with investor-facing material is now inside the SEC CETU's active FY2026 enforcement surface — and most AI-capability representations drift from operational reality over time without a formal alignment audit",
            "FP_Trigger": "the CETU designation means the SEC is scanning the category, not waiting for tips. the audit target is the gap between what's on the deck and what the product actually does — which is discoverable from the company's own documents",
            "Legal_Pain": "The SEC CETU designated AI washing as the top FY2026 enforcement priority. Any AI company with investor communications or public capability claims is within the active enforcement surface.",
            "FP_Impact": "SEC investigation costs even if the case doesn't reach enforcement — document production, legal hours, distraction. civil penalties and disgorgement if enforcement attaches. and the investor-relations damage regardless of outcome",
            "FP_Stakes": "the investigation itself is the cost, whether enforcement attaches or not — SEC document requests on an early-stage company consume the founder's calendar for months. and the category-level scanning means the next founder to get a subpoena isn't getting singled out, they're getting swept.",
            "Lex_Nova_Fix": "DOC_AUP §2.8 — pre-built CETU-aligned annual capability-disclosure audit module.",
            "Status": "Active",
            "Effective_Date": "2026-01-01",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "SEC Cyber and Emerging Technologies Unit (CETU) FY2026 Enforcement Designation"
        },
        "I02_FRD_001": {
            "Threat_Name": "AI Evidence Fabrication",
            "Pain_Tier": "T2",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "your product generates content for legal or regulatory filings without citation-verification or hallucination-detection — and federal courts are sanctioning attorneys for AI-hallucinated case citations, with criminal perjury exposure attaching when the fabrication is sworn",
            "FP_Trigger": "every attorney sanctioned for an AI hallucination flows back through indemnification claims against the AI vendor, and plaintiff counsel in the underlying cases subpoena the AI vendor's records to establish the fabrication pattern",
            "Legal_Pain": "Federal courts have imposed Rule 11 sanctions on attorneys for AI-hallucinated case citations. The pattern extends to criminal perjury exposure under 18 U.S.C. §1623. Customer attorneys facing sanctions flow back to the AI vendor through indemnification claims.",
            "FP_Impact": "customer indemnification claims for Rule 11 sanctions the attorney incurred. breach-of-professional-responsibility theories targeting the product's architecture. and criminal exposure flowing back when the fabricated citation was in a sworn filing",
            "FP_Stakes": "attorneys facing criminal perjury exposure under 18 U.S.C. §1623 don't settle quietly — they pursue every available indemnification, every available subpoena, every available theory to shift the exposure. and the professional-responsibility cases build a record that later plaintiffs use against the AI vendor directly.",
            "Lex_Nova_Fix": "DOC_AUP §2.7 — pre-built Rule 11 / §1623-aware citation-verification and hallucination-detection module.",
            "Status": "Active",
            "Effective_Date": "2024-01-01",
            "Pain_Depth": "Criminal",
            "Legal_Ammo": "Federal Rule of Civil Procedure 11 Sanctions / 18 U.S.C. §1623 / Federal Courts AI Citation Rulings"
        },
        "I09_TRD_001": {
            "Threat_Name": "EU AI Act Critical Infrastructure High-Risk",
            "Pain_Tier": "T2",
            "Velocity": "THIS_YEAR",
            "FP_Mechanism": "your AI operates in EU critical infrastructure contexts — energy, water, transport, banking, telecom — and Annex III of the EU AI Act classifies that deployment as high-risk, requiring conformity assessment and CE marking starting August 2026",
            "FP_Trigger": "the August 2026 date is on a calendar, not on enforcement discretion. EU customers in critical-infrastructure sectors will gate procurement on CE-marking status. and the conformity assessment is a 4-6 month project by itself",
            "Legal_Pain": "EU AI Act Annex III classifies critical digital infrastructure AI as \"high-risk,\" triggering conformity assessment regime. Non-conformity penalties reach €15M or 3% of global annual turnover.",
            "FP_Impact": "fines up to €15M or 3% of global revenue for non-conformity. EU market access gated on CE marking for critical-infrastructure deployments. and losing EU revenue on a calendar date because conformity work started too late is a predictable failure mode",
            "FP_Stakes": "the EU high-risk framework is the highest-cost compliance regime in AI regulation globally — and critical-infrastructure customers will not onboard without CE marking. the revenue at stake is both large and gated on a single documentation threshold.",
            "Lex_Nova_Fix": "DOC_TOS §5.4(f) — pre-built Annex III critical-infrastructure conformity module.",
            "Status": "Upcoming",
            "Effective_Date": "2026-08-02",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "EU AI Act Annex III - Critical Infrastructure (Regulation (EU) 2024/1689)"
        },
        "I09_TRD_002": {
            "Threat_Name": "SEBI Black Box Traceability",
            "Pain_Tier": "T2",
            "Velocity": "THIS_YEAR",
            "FP_Mechanism": "your product powers algorithmic trading in Indian markets without generating unique Algo-IDs per order or producing the SEBI-mandated audit trail — and starting April 1, 2026 every automated order is required to carry this traceability",
            "FP_Trigger": "the April 1 effective date is absolute — SEBI-regulated brokers cannot route orders through non-compliant algo providers on day one, which turns your product into an uninstallable dependency for your broker customers",
            "Legal_Pain": "SEBI's amended Algorithmic Trading Regulations mandate unique \"Algo-ID\" and audit trail per automated order. Non-compliance carries broker license consequences up to revocation.",
            "FP_Impact": "broker customer license consequences up to revocation for non-compliant order flow. SEBI penalties on both the broker and the algo provider. and Indian-market revenue gated entirely on Algo-ID architecture being in place by April 1",
            "FP_Stakes": "the stakes for your customer are their operating license. that means the switching pressure doesn't come from \"we should find a better vendor\" — it comes from \"we cannot trade at all with this vendor after April 1.\" Indian market revenue is either retained through compliance or lost to competitors who shipped the feature in time.",
            "Lex_Nova_Fix": "DOC_AGT §6.4 — pre-built SEBI-aligned Algo-ID and audit-trail module.",
            "Status": "Upcoming",
            "Effective_Date": "2026-04-01",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "SEBI Algorithmic Trading Regulations (Amendment 2026)"
        },
        "I09_TRD_003": {
            "Threat_Name": "Systemic Financial Instability Scrutiny",
            "Pain_Tier": "T3",
            "Velocity": "INCOMING",
            "FP_Mechanism": "your product is used at scale across multiple financial-market participants without systemic-risk assessment of correlated behavior — which is exactly the pattern global regulators have identified as a potential systemic financial instability source",
            "FP_Trigger": "FSB, IOSCO, and major central banks are moving from observation to active intervention — specific regime proposals are under consultation, and the first one to activate becomes the template",
            "Legal_Pain": "FSB, IOSCO, and major central banks have identified AI-driven trading and risk systems as potential sources of systemic financial instability. Regulatory posture is moving from observation to active intervention.",
            "FP_Impact": "systemic-risk-driven regulatory interventions (circuit breakers, correlated-behavior restrictions, concentration limits). product-architecture requirements for stress testing across customers. and the emerging regulatory regime applies to the product category, not just individual products",
            "FP_Stakes": "NULL",
            "Lex_Nova_Fix": "DOC_TOS §5.4(f) — pre-built FSB/IOSCO-aware systemic-risk and circuit-breaker module.",
            "Status": "Pending",
            "Effective_Date": "2026-12-31",
            "Pain_Depth": "Corporate",
            "Legal_Ammo": "Global Regulatory Scrutiny (FSB, IOSCO, Fed, ECB, BoE, RBI)"
        },
        "I09_TRD_004": {
            "Threat_Name": "Algorithmic Collusion",
            "Pain_Tier": "T2",
            "Velocity": "ACTIVE_NOW",
            "FP_Mechanism": "your AI pricing tool is used by multiple competitors in the same market and shares data, model weights, or coordinated outputs across them — which the DOJ and California AB 325 now treat as illegal price coordination, even without explicit agreement between the customers",
            "FP_Trigger": "the DOJ has active enforcement on algorithmic collusion patterns and California AB 325 gives state plaintiffs a direct cause of action. customer businesses named in antitrust cases pull the AI vendor in directly, and the product's architecture becomes the evidence",
            "Legal_Pain": "California AB 325 and Sherman Act §1 together establish that AI pricing algorithms used by competitors can constitute illegal price coordination — even without explicit agreement. DOJ has prosecuted algorithmic collusion cases with criminal exposure reaching the vendor's leadership.",
            "FP_Impact": "treble damages under Sherman Act §1 for the antitrust violation. California AB 325 statutory penalties. and criminal antitrust exposure in the more aggressive federal cases — which reaches the vendor's leadership, not just the customer's",
            "FP_Stakes": "Sherman Act §1 criminal antitrust reaches individuals with prison terms up to 10 years — the DOJ has signaled willingness to prosecute algorithmic-collusion cases criminally, naming the vendor's leadership, not just the colluding customers. and the product architecture that makes cross-customer insight valuable is the same architecture that grounds the criminal case.",
            "Lex_Nova_Fix": "DOC_AUP §2.9 — pre-built Sherman-§1-resilient customer-siloed pricing module.",
            "Status": "Active",
            "Effective_Date": "2026-01-01",
            "Pain_Depth": "Criminal",
            "Legal_Ammo": "California AB 325 / Sherman Act §1 / DOJ AI Pricing Coordination Guidance"
        }
    },

    // 1. Immutable PID Generator (Ported exactly from legacy code)
    generatePID: async function(batchCode) {
        try {
            const month = String(new Date().getMonth() + 1).padStart(2, '0');
            const batch = batchCode || `${month}A`;
            const prefix = `LN-P-AI-26-${batch}-`;
            
            // Replicating legacy async Firebase query for max ID
            const snap = await window.db.collection('prospects')
                .where('prospectId', '>=', prefix)
                .where('prospectId', '<=', prefix + '\uf8ff')
                .get();
                
            let max = 0;
            snap.forEach(d => {
                const n = parseInt((d.data().prospectId || '').split('-').pop(), 10);
                if (n > max) max = n;
            });
            return `${prefix}${String(max + 1).padStart(3, '0')}`;
        } catch (error) {
            console.error("[HuntIngestion] PID Generation Failed:", error);
            return `LN-P-AI-26-01A-001`; // Fallback
        }
    },

    // 2. Strict JSON Validation
    parseSkinnyJSON: function(jsonString) {
        try {
            const payload = JSON.parse(jsonString);
            if (!payload.true_gaps || !payload.ghost_protection_profile || !payload.legal_viability) {
                throw new Error("Missing critical V5.0 forensic objects.");
            }
            return payload;
        } catch (error) {
            alert("JSON Parse Error: The payload is corrupted or missing critical V5.0 arrays.");
            console.error("[HuntIngestion] Parser failed:", error);
            return null;
        }
    },

    // 3. The Hydration Merge (9 Dynamic + 12 Static = 21 Fields)
    hydrateGaps: function(trueGapsArray) {
        return trueGapsArray.map(gap => {
            const staticData = this.staticDictionary[gap.Threat_ID];

            if (!staticData) {
                console.warn(`[HuntIngestion] Unknown Threat_ID: ${gap.Threat_ID}. Hydration failed for this gap.`);
                return gap; // Returns the unhydrated gap rather than breaking the loop
            }

            return {
                // The 9 AI Fields
                ...gap, 
                // The 12 Static CSV Fields mapped dynamically
                Threat_Name: staticData.Threat_Name,
                Velocity: staticData.Velocity,
                FP_Mechanism: staticData.FP_Mechanism,
                FP_Trigger: staticData.FP_Trigger,
                Legal_Pain: staticData.Legal_Pain,
                FP_Impact: staticData.FP_Impact,
                FP_Stakes: staticData.FP_Stakes,
                Lex_Nova_Fix: staticData.Lex_Nova_Fix,
                Status: staticData.Status,
                Effective_Date: staticData.Effective_Date,
                Pain_Depth: staticData.Pain_Depth,
                Legal_Ammo: staticData.Legal_Ammo
            };
        });
    },

    // 4. Batch Capacity Check (Ported exactly from legacy code)
    isBatchFull: function(batchCode) {
        const BATCH_LIMIT = 25;
        const source = (window.allProspects && window.allProspects.length > 0) ? window.allProspects : HuntCore.state.prospects;
        const count = source.filter(p => p.batchNumber === batchCode && p.status !== 'DEAD').length;
        return count >= BATCH_LIMIT;
    },

    // 5. The Main Intake Execution
    processNewICP: async function(founderName, email, batch, jsonString) {
        console.log(`[HuntIngestion] Processing V5.0 Intake for Batch: ${batch}...`);

        if (!email) {
            if(window.toast) window.toast('Email is required', 'error');
            return false;
        }

        if (this.isBatchFull(batch)) {
            if(window.toast) window.toast(`Batch ${batch} is full.`, 'error');
            return false;
        }

        // Step 1: Validate AI Payload
        const aiPayload = this.parseSkinnyJSON(jsonString);
        if (!aiPayload) return false;

        // Step 2: Generate Identity
        const newPID = await this.generatePID(batch);

        // Step 3: Run the Hydration Merge
        const hydratedGaps = this.hydrateGaps(aiPayload.true_gaps);

        // Step 4: Construct the Master Database Object
        const nowStr = new Date().toISOString();
        const prospectObject = {
            // Identity & Logistics
            id: newPID, // Using PID as document ID for clean architecture
            prospectId: newPID,
            founderName: founderName || "",
            email: email.toLowerCase(),
            company: aiPayload.prospect_meta?.company_name || "",
            founderRole: aiPayload.prospect_meta?.founder_role || "",
            batchNumber: batch,
            status: "QUEUED",
            intelStatus: "V5.0",
            
            // Timestamps
            addedAt: nowStr,
            updatedAt: nowStr,
            
            // Links & External Profiles
            scannerLink: `https://lexnovahq.com/scanner.html?pid=${newPID}`,
            linkedinUrl: "",
            website: aiPayload.prospect_url || "",
            
            // Jurisdictions & Funding
            jurisdiction: aiPayload.prospect_meta?.hq_jurisdiction || "",
            processingLocation: aiPayload.prospect_meta?.actual_processing_location || "",
            fundingStage: "Unverified", 
            headcount: "",
            intendedPlan: "agentic_shield", // Legacy default

            // Global Forensics (V5.0 Structuring)
            primary_claim: aiPayload.primary_claim || "",
            legal_viability: aiPayload.legal_viability,
            primaryProduct: aiPayload.primaryProduct || null,
            featureMap: aiPayload.featureMap || null,
            ghost_protection_profile: aiPayload.ghost_protection_profile,
            jurisdictional_surface: aiPayload.jurisdictional_surface || [],
            primaryArchetype: aiPayload.archetypes || [],

            // The Hydrated V5.0 Gaps
            true_gaps: hydratedGaps,
            scan_metadata: aiPayload.scan_metadata,

            // Sequencing & Operations
            sequenceStep: "C",
            ceDate: "",
            fu1Date: "",
            fu2Date: "",
            fu3Date: "",
            fu4Date: "",
            nextActionDate: "",
            emailsSent: 0,
            emailLog: [],

            // Telemetry
            scannerClicked: false,
            scannerCompleted: false,
            scannerScore: null
        };

        // Step 5: Push to Ledger via Core
        const success = await HuntCore.saveProspect(prospectObject);
        
        if (success) {
            if(window.toast) window.toast(`${newPID} added successfully.`);
            if(typeof window.closeModal === 'function') window.closeModal();
            return true;
        }
        return false;
    },

// 6. Update Existing ICP with V5.0 Forensics
    updateExistingICP: async function(existingPID, jsonString) {
        console.log(`[HuntIngestion] Processing V5.0 Update for Existing PID: ${existingPID}...`);

        // Step 1: Grab the existing prospect from local memory
        const existingProspect = HuntCore.getProspectById(existingPID);
        if (!existingProspect) {
            if(window.toast) window.toast('Prospect not found in database.', 'error');
            return false;
        }

        // Step 2: Validate AI Payload
        const aiPayload = this.parseSkinnyJSON(jsonString);
        if (!aiPayload) return false;

        // Step 3: Run the Hydration Merge
        const hydratedGaps = this.hydrateGaps(aiPayload.true_gaps);

        // Step 4: Merge V5.0 Forensics into the Existing Object
        // We preserve logistics, status, telemetry, and sequences, but overwrite the old forensics.
        const updatedProspect = {
            ...existingProspect, // Keep all existing state
            intelStatus: "V5.0", // Upgrade the flag
            updatedAt: new Date().toISOString(),

            // Only update company/website if the AI found better data, otherwise keep existing
            company: aiPayload.prospect_meta?.company_name || existingProspect.company,
            website: aiPayload.prospect_url || existingProspect.website,

            // Overwrite Global Forensics with V5.0 structures
            primary_claim: aiPayload.primary_claim || "",
            legal_viability: aiPayload.legal_viability,
            primaryProduct: aiPayload.primaryProduct || null,
            featureMap: aiPayload.featureMap || null,
            ghost_protection_profile: aiPayload.ghost_protection_profile,
            jurisdictional_surface: aiPayload.jurisdictional_surface || [],
            primaryArchetype: aiPayload.archetypes || existingProspect.primaryArchetype || [],

            // Inject the Hydrated V5.0 Gaps (Replacing legacy "Traps")
            true_gaps: hydratedGaps,
            scan_metadata: aiPayload.scan_metadata
        };

        // Step 5: Push the updated object back to Firebase
        const success = await HuntCore.saveProspect(updatedProspect);
        
        if (success) {
            if(window.toast) window.toast(`${existingPID} upgraded to V5.0 successfully.`);
            
            // If the Prospect Modal is currently open, we should re-render it instantly
            if (typeof HuntUI !== 'undefined' && typeof HuntUI.renderProspectModal === 'function') {
                 HuntUI.renderProspectModal(updatedProspect);
            }
            return true;
        }
        return false;
    }
};

// ════════════════════════════════════════════════════════════════════════
// ═════════ MODULE 3: HUNT UI (VIEW CONTROLLER & RENDERING) ══════════════
// ════════════════════════════════════════════════════════════════════════

const HuntUI = {
    // ── THE MIGRATION MAP (Dual-Read Translation Layer) ─────────────────
    migrationMap: {
        "UNI_CON_001": "UNI_CNS_001", "UNI_CON_002": "UNI_CNS_002", "UNI_CON_003": "UNI_CNS_003", 
        "UNI_CON_004": "UNI_CNS_004", "UNI_CON_005": "UNI_CNS_005", "UNI_CON_006": "UNI_CNS_006",
        "UNI_SEC_001": "UNI_PRV_001", "UNI_SEC_002": "UNI_PRV_002", "UNI_SEC_003": "UNI_PRV_003",
        "INT01_AGT_001": "UNI_LIA_007", "INT01_AGT_002": "UNI_CNS_007", "INT02_DIS_001": "I02_DEC_001",
        "INT02_MED_001": "I02_HRM_001", "INT02_CRA_001": "I02_DEC_002", "INT02_MED_002": "I02_DEC_003",
        "INT02_AUD_001": "I02_DEC_004", "INT02_AUD_002": "I02_DEC_005", "INT02_REG_001": "I02_DEC_006",
        "INT02_REG_002": "I02_DEC_007", "INT02_AUT_001": "I02_DEC_008", "INT02_MED_003": "I02_HRM_002",
        "INT02_EVD_001": "I02_FRD_001", "INT02_EMP_001": "I02_DEC_009", "INT02_EMP_002": "I02_DEC_010",
        "INT03_COM_001": "I03_HRM_001", "INT03_COM_002": "I03_HRM_002", "INT03_COM_003": "I03_HRM_003"
        // (The system will gracefully fallback if an old trap isn't in this abbreviated map)
    },

    currentFilter: {
        search: "",
        batch: "ALL",
        status: "ALL", // QUEUED, SEQUENCE, ENGAGED, NEGOTIATING, etc.
        confidence: "ALL"
    },

    // 1. Core Render Entry Point
   renderMainDash: function() {
        const container = document.getElementById('tab-hunt');

 // Root div in your admin panel
        if (!container) return;

        const prospects = HuntCore.state.prospects;
        
        // Render the 3-part Main Dash layout
        container.innerHTML = `
            ${this.buildMetricsDash(prospects)}
            ${this.buildSelectionPanel()}
            <div class="hunt-tables-container" style="margin-top: 20px;">
                ${this.buildScheduledTable(prospects)}
                ${this.buildUnscheduledTable(prospects)}
                ${this.buildNegotiationTable(prospects)}
            </div>
        `;
        
        this.attachDashListeners();
    },

    // 2. ICP & Scanner Telemetry Dash
    buildMetricsDash: function(prospects) {
        const total = prospects.length;
        const inSequence = prospects.filter(p => p.status === 'SEQUENCE').length;
        const v5Count = prospects.filter(p => p.intelStatus === 'V5.0').length;
        const unscheduled = prospects.filter(p => p.status === 'QUEUED').length;
        const archived = prospects.filter(p => p.status === 'ARCHIVED').length;
        
        // Action Needed Bottleneck: e.g., Next Action date is past due
        const now = new Date().toISOString().split('T')[0];
        const actionNeeded = prospects.filter(p => 
            p.status !== 'DEAD' && p.status !== 'ARCHIVED' && p.status !== 'CONVERTED' && 
            p.nextActionDate && p.nextActionDate < now
        ).length;

        const clicked = prospects.filter(p => p.scannerClicked).length;
        const completed = prospects.filter(p => p.scannerCompleted).length;

        return `
        <div class="hunt-metrics-row" style="display: flex; gap: 20px; margin-bottom: 20px;">
            <div class="hunt-card" style="flex: 2; padding: 15px; border: 1px solid #ddd; background: #fff;">
                <h3 style="margin-top:0;">ICP Pipeline</h3>
                <div style="display: flex; justify-content: space-between; text-align: center;">
                    <div><b>${total}</b><br><small>Total</small></div>
                    <div><b>${inSequence}</b><br><small>Sequence</small></div>
                    <div><b>${v5Count}</b><br><small>V5.0 Intel</small></div>
                    <div><b>${unscheduled}</b><br><small>Unscheduled</small></div>
                    <div style="color: red;"><b>${actionNeeded}</b><br><small>Action Needed</small></div>
                </div>
            </div>
            <div class="hunt-card" style="flex: 1; padding: 15px; border: 1px solid #ddd; background: #fff;">
                <h3 style="margin-top:0;">Scanner Telemetry</h3>
                <div style="display: flex; justify-content: space-between; text-align: center;">
                    <div><b>${clicked}</b><br><small>Clicked</small></div>
                    <div><b>${clicked - completed}</b><br><small>Dropped</small></div>
                    <div style="color: green;"><b>${completed}</b><br><small>Completed</small></div>
                </div>
            </div>
        </div>`;
    },

    // 3. Selection & Filter Panel
    buildSelectionPanel: function() {
        return `
        <div class="hunt-selection-panel" style="padding: 15px; background: #f9f9f9; border: 1px solid #eee; display: flex; gap: 15px; align-items: center;">
            <input type="text" id="hunt-search" placeholder="Search Target..." style="padding: 8px; flex: 1;">
            
            <select id="hunt-filter-batch" style="padding: 8px;">
                <option value="ALL">All Batches</option>
                <option value="04A">04A</option>
                <option value="04B">04B</option>
            </select>

            <select id="hunt-filter-status" style="padding: 8px;">
                <option value="ALL">All Statuses</option>
                <option value="QUEUED">QUEUED</option>
                <option value="SEQUENCE">SEQUENCE</option>
                <option value="ENGAGED">ENGAGED</option>
                <option value="NEGOTIATING">NEGOTIATING</option>
            </select>

            <select id="hunt-filter-confidence" style="padding: 8px;">
                <option value="ALL">Any Confidence</option>
                <option value="LOW">LOW Alibi (Target)</option>
                <option value="MEDIUM">MEDIUM Alibi</option>
                <option value="HIGH">HIGH Alibi</option>
            </select>

            <button onclick="HuntUI.openNewICPModal()" style="padding: 8px 15px; background: #000; color: #fff; cursor:pointer;">+ Add New ICP</button>
        </div>`;
    },

    // 4. Tables Generation (SCHEDULED)
    buildScheduledTable: function(prospects) {
        const filtered = this.applyFilters(prospects.filter(p => p.status === 'SEQUENCE' || p.status === 'ENGAGED'));
        let rows = filtered.map((p, i) => `
            <tr onclick="HuntUI.openProspectModal('${p.id}')" style="cursor: pointer; border-bottom: 1px solid #eee;">
                <td>${i+1}</td>
                <td><b>${p.founderName}</b><br><small>${p.founderRole}</small></td>
                <td>${p.company}<br><small>${p.prospectId}</small></td>
                <td>${p.batchNumber}</td>
                <td>${this.renderIntelBadge(p)}</td>
                <td>${p.outreachStatus} - ${p.sequenceStep}</td>
                <td>${p.scannerCompleted ? 'Completed' : (p.scannerClicked ? 'Clicked' : 'Unopened')}</td>
                <td>${p.ceDate || 'N/A'}</td>
            </tr>
        `).join('');

        return this.wrapTableCard("Scheduled & In-Sequence", rows, "S.No|Founder|Company|Batch|Intel|Outreach|Scanner|CE Date");
    },

    // 5. Tables Generation (UNSCHEDULED / QUEUED)
    buildUnscheduledTable: function(prospects) {
        const filtered = this.applyFilters(prospects.filter(p => p.status === 'QUEUED'));
        const now = new Date();

        let rows = filtered.map((p, i) => {
            const addedDate = p.addedAt ? new Date(p.addedAt) : new Date();
            const daysInQueue = Math.floor((now - addedDate) / (1000 * 60 * 60 * 24));
            
            return `
            <tr onclick="HuntUI.openProspectModal('${p.id}')" style="cursor: pointer; border-bottom: 1px solid #eee;">
                <td>${i+1}</td>
                <td><b>${p.founderName}</b></td>
                <td>${p.company}<br><small>${p.prospectId}</small></td>
                <td>${p.batchNumber}</td>
                <td>${this.renderIntelBadge(p)}</td>
                <td>${p.updatedAt ? p.updatedAt.split('T')[0] : 'N/A'}</td>
                <td style="color: ${daysInQueue > 7 ? 'red' : 'black'};"><b>${daysInQueue} Days</b></td>
                <td><button onclick="event.stopPropagation(); window.alert('Schedule UI trigger')">Schedule</button></td>
            </tr>`;
        }).join('');

        return this.wrapTableCard("Unscheduled (Queued)", rows, "S.No|Founder|Company|Batch|Intel|Last Update|Aging|Action");
    },

    // 6. Tables Generation (NEGOTIATING)
    buildNegotiationTable: function(prospects) {
        const filtered = this.applyFilters(prospects.filter(p => p.status === 'NEGOTIATING'));
        
        let rows = filtered.map((p, i) => `
            <tr onclick="HuntUI.openProspectModal('${p.id}')" style="cursor: pointer; border-bottom: 1px solid #eee;">
                <td>${i+1}</td>
                <td><b>${p.founderName}</b><br>${p.company}</td>
                <td>Score: ${p.scannerScore || 'N/A'}</td>
                <td>${p.true_gaps && p.true_gaps[0] ? p.true_gaps[0].Threat_Name : 'Review Pending'}</td>
                <td>${p.updatedAt ? p.updatedAt.split('T')[0] : 'N/A'}</td>
                <td><input type="text" value="${p.frictionNote || ''}" placeholder="Note..." onclick="event.stopPropagation();" onblur="HuntCore.saveProspect({id: '${p.id}', frictionNote: this.value})"></td>
            </tr>
        `).join('');

        return this.wrapTableCard("Negotiation Pipeline", rows, "S.No|Target|Scanner|Top Threat|Last Touch|Friction Note");
    },

    wrapTableCard: function(title, rowsHtml, headersStr) {
        const headers = headersStr.split('|').map(h => `<th>${h}</th>`).join('');
        return `
        <div class="hunt-table-card" style="background:#fff; border:1px solid #ddd; margin-bottom: 20px;">
            <div style="background:#f4f4f4; padding:10px 15px; font-weight:bold; border-bottom:1px solid #ddd;">${title}</div>
            <table style="width: 100%; text-align: left; border-collapse: collapse;">
                <thead><tr style="background: #fafafa;">${headers}</tr></thead>
                <tbody>${rowsHtml || '<tr><td colspan="8" style="text-align:center; padding:15px;">No targets in this view.</td></tr>'}</tbody>
            </table>
        </div>`;
    },

    // 7. Badge Rendering Logic
    renderIntelBadge: function(prospect) {
        if (prospect.intelStatus !== 'V5.0') return `<span style="background:#ccc; padding:3px 6px; border-radius:3px; font-size:10px;">LEGACY</span>`;
        
        const tier = prospect.ghost_protection_profile?.confidence_tier || 'N/A';
        const liab = prospect.legal_viability?.G1_category || '';
        let liabColor = liab === 'DIRECT_LIABILITY' ? 'red' : (liab === 'DUAL_EXPOSURE' ? 'orange' : 'black');
        let tierColor = tier === 'LOW' ? 'green' : (tier === 'HIGH' ? 'red' : 'black'); // Low alibi = good for us
        
        return `<span style="color:${liabColor}; font-weight:bold; font-size:11px;">${liab.replace('_', ' ')}</span><br>
                <span style="color:${tierColor}; font-size:10px;">ALIBI: ${tier}</span>`;
    },

    // 8. Filters
    applyFilters: function(arr) {
        // Implementation of search/dropdown logic tied to this.currentFilter
        return arr; // Placeholder for exact string matching logic
    },

    attachDashListeners: function() {
        // Hook up search boxes to this.currentFilter and re-render
    },

    // ════════════════════════════════════════════════════════════════════════
    // ═════════ THE PROSPECT MODAL (ICP UI) ══════════════════════════════════
    // ════════════════════════════════════════════════════════════════════════

    openProspectModal: function(docId) {
        const p = HuntCore.getProspectById(docId);
        if (!p) return;

        let modal = document.getElementById('hunt-prospect-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'hunt-prospect-modal';
            modal.style.cssText = "position:fixed; top:0; right:0; width:85%; height:100%; background:#f9f9f9; box-shadow:-5px 0 15px rgba(0,0,0,0.2); z-index:9999; overflow-y:auto; padding:20px; box-sizing:border-box;";
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <h2>Forensic Dossier: ${p.company}</h2>
                <button onclick="document.getElementById('hunt-prospect-modal').style.display='none'" style="padding:10px;">Close X</button>
            </div>
            
            <div style="background:#fff; padding:15px; border:1px solid #ddd; margin-bottom:15px; display:flex; gap:20px;">
                <div><b>Company:</b> ${p.company}</div>
                <div><b>PID:</b> ${p.prospectId}</div>
                <div><b>Founder:</b> ${p.founderName} (${p.founderRole})</div>
                <div><b>Email:</b> ${p.email}</div>
                <div><b>Jurisdiction:</b> ${p.jurisdiction}</div>
            </div>

            <div style="background:#000; padding:10px 15px; margin-bottom:20px; color:#fff; display:flex; gap:15px; align-items:center;">
                <a href="${p.scannerLink}" target="_blank" style="color:#0f0;">Open Scanner Link</a>
                <span style="flex:1;"></span>
                <button onclick="HuntUI.triggerV5Update('${p.id}')" style="background:#444; color:#fff; padding:5px 10px; border:none; cursor:pointer;">JSON Update</button>
                <button onclick="HuntExport.copySpear('${p.id}')" style="background:#007bff; color:#fff; padding:5px 10px; border:none; cursor:pointer;">Copy Spear</button>
                <button onclick="HuntUI.saveModalChanges('${p.id}')" style="background:#28a745; color:#fff; padding:5px 10px; border:none; cursor:pointer;">Save Dossier</button>
                <button onclick="if(confirm('Permanently Delete?')) HuntCore.deleteProspect('${p.id}')" style="background:#dc3545; color:#fff; padding:5px 10px; border:none; cursor:pointer;">Delete</button>
            </div>

            <div style="display:flex; gap:20px;">
                <div style="flex:2;">
                    ${this.renderIntelligenceColumn(p)}
                </div>

                <div style="flex:1; background:#fff; padding:15px; border:1px solid #ddd;">
                    ${this.renderLogisticsColumn(p)}
                </div>
            </div>
        `;
        modal.style.display = 'block';
    },

    // Dual-Read Router
    renderIntelligenceColumn: function(p) {
        if (p.intelStatus === 'V5.0' && p.true_gaps) {
            return this.renderV5Forensics(p);
        } else {
            return this.renderLegacyForensics(p);
        }
    },

    renderV5Forensics: function(p) {
        const profile = p.ghost_protection_profile || {};
        const gaps = p.true_gaps || [];
        
        let gapsHtml = gaps.map(g => `
            <div style="border:1px solid ${g.Pain_Tier === 'T1' ? 'red' : (g.Pain_Tier === 'T2' ? 'orange' : '#ccc')}; border-left:5px solid ${g.Pain_Tier === 'T1' ? 'red' : (g.Pain_Tier === 'T2' ? 'orange' : '#ccc')}; padding:10px; margin-bottom:10px; background:#fff;">
                <h4 style="margin:0 0 10px 0;">${g.Threat_ID}: ${g.Threat_Name} [${g.Pain_Tier}]</h4>
                <div style="font-size:12px;">
                    <b>Mechanism:</b> ${g.FP_Mechanism}<br>
                    <b>Absence Hook:</b> "${g.structural_absence}"<br>
                    <b>Predator:</b> "${g.predator_signature}"<br>
                    <b>Self-Indictment:</b> <a href="${g.evidence_source}" target="_blank">Source</a> - "${g.proof_citation}"<br>
                    <hr style="margin:5px 0; border:0; border-top:1px dashed #eee;">
                    <b>Pain:</b> ${g.Legal_Pain}<br>
                    <b>Lex Nova Fix:</b> <i>${g.Lex_Nova_Fix}</i>
                </div>
            </div>
        `).join('');

        let indictmentsHtml = (profile.self_indictments || []).map(ind => `
            <li style="margin-bottom:5px; font-size:12px;">
                <b>Quote:</b> "${ind.quote}"<br>
                <span style="color:red;"><b>Contradicts:</b> ${ind.contradicts}</span>
            </li>
        `).join('');

        return `
            <div style="background:#fff; border:1px solid #ddd; padding:15px; margin-bottom:20px;">
                <h3 style="margin-top:0;">Ghost Protection Profile</h3>
                <div style="display:flex; justify-content:space-between; margin-bottom:15px;">
                    <div style="font-size:18px;"><b>Confidence:</b> ${profile.confidence_tier} (${profile.confidence_score})</div>
                    <div><b>Velocity:</b> ${profile.velocity_signal_score}</div>
                </div>
                <div style="background:#f4f4f4; padding:10px; border-left:3px solid #000; margin-bottom:15px;">
                    <b>Vector Hook:</b> ${profile.ghost_protection_vector}<br>
                    <b>Alibi Teardown:</b> ${profile.posture_alibi_argument}
                </div>
                <h4>Self-Indictments</h4>
                <ul style="padding-left:20px; margin:0;">${indictmentsHtml}</ul>
            </div>
            
            <h3 style="margin-bottom:10px;">Threat Matrix (${gaps.length} Gaps)</h3>
            ${gapsHtml}
        `;
    },

    renderLegacyForensics: function(p) {
        // Fallback for old pipeline targets
        const oldTraps = p.trapHits || [];
        let html = `<div style="background:#ffeeba; border:1px solid #ffc107; padding:15px; margin-bottom:20px;">
            <h3 style="margin-top:0; color:#856404;">⚠️ Legacy Data Structure Detected</h3>
            <p>This prospect is running on pre-V5.0 intelligence. Paste a new Hunter JSON payload to unlock the Ghost Protection Profile and Hydrated Gaps.</p>
        </div>`;
        
        if (oldTraps.length > 0) {
            html += `<h4>Legacy Traps Found:</h4><ul>` + 
                oldTraps.map(t => {
                    const newId = this.migrationMap[t] || "Unknown Mapping";
                    return `<li>${t} <i>(Maps to: ${newId})</i></li>`;
                }).join('') + `</ul>`;
        }
        return html;
    },

    renderLogisticsColumn: function(p) {
        return `
            <h3 style="margin-top:0;">CRM Controls</h3>
            <label>Status</label>
            <select id="modal-status" style="width:100%; margin-bottom:15px; padding:5px;">
                ${['QUEUED','SEQUENCE','ENGAGED','NEGOTIATING','CONVERTED','ARCHIVED','DEAD'].map(s => `<option value="${s}" ${p.status===s?'selected':''}>${s}</option>`).join('')}
            </select>

            <label>Sequence Step</label>
            <select id="modal-step" style="width:100%; margin-bottom:15px; padding:5px;">
                ${['C','FU1','FU2','FU3','FU4'].map(s => `<option value="${s}" ${p.sequenceStep===s?'selected':''}>${s}</option>`).join('')}
            </select>

            <label>Cold Email Date</label>
            <input type="date" id="modal-ceDate" value="${p.ceDate || ''}" style="width:100%; margin-bottom:15px; padding:5px; box-sizing:border-box;">

            <label>LinkedIn URL</label>
            <input type="text" id="modal-linkedin" value="${p.linkedinUrl || ''}" style="width:100%; margin-bottom:15px; padding:5px; box-sizing:border-box;">
            
            <hr>
            <h4>Scanner Telemetry</h4>
            <div style="font-size:12px;">
                <b>Clicked:</b> ${p.scannerClicked ? 'Yes' : 'No'}<br>
                <b>Completed:</b> ${p.scannerCompleted ? 'Yes' : 'No'}<br>
                <b>Score:</b> ${p.scannerScore || 'N/A'}<br>
            </div>
        `;
    },

    // 9. Input & Output UI Triggers
    openNewICPModal: function() {
        const batch = prompt("Enter Batch Code (e.g., 04A):", "04A");
        if (!batch) return;
        const founder = prompt("Enter Founder Name:");
        const email = prompt("Enter Target Email:");
        if (!email) return;
        const jsonStr = prompt("Paste V5.0 Hunter JSON:");
        if (!jsonStr) return;

        HuntIngestion.processNewICP(founder, email, batch, jsonStr);
    },

    triggerV5Update: function(docId) {
        const jsonStr = prompt("Paste the fresh V5.0 Hunter JSON payload to upgrade this prospect:");
        if (jsonStr) {
            HuntIngestion.updateExistingICP(docId, jsonStr);
        }
    },

    saveModalChanges: function(docId) {
        const updates = {
            id: docId,
            status: document.getElementById('modal-status').value,
            sequenceStep: document.getElementById('modal-step').value,
            ceDate: document.getElementById('modal-ceDate').value,
            linkedinUrl: document.getElementById('modal-linkedin').value,
            updatedAt: new Date().toISOString()
        };
        HuntCore.saveProspect(updates);
    }
};

// ════════════════════════════════════════════════════════════════════════
// ═════════ MODULE 4: HUNT OPS (SEQUENCE & AUTOMATION DRIVE) ═════════════
// ════════════════════════════════════════════════════════════════════════

const HuntOps = {
    // ── SEQUENCE RULES ──────────────────────────────────────────────────
    sequence: {
        // Number of business days to wait AFTER the previous step
        intervals: { C: 3, FU1: 3, FU2: 4, FU3: 4, FU4: 2 }, 
        // The state machine mapping
        nextStep: { C: 'FU1', FU1: 'FU2', FU2: 'FU3', FU3: 'FU4', FU4: null }
    },

    // 1. Business Days Calculator (Skips Weekends)
    addBusinessDays: function(startDateStr, daysToAdd) {
        if (!startDateStr) return "";
        let date = new Date(startDateStr);
        if (isNaN(date.getTime())) return "";

        let added = 0;
        while (added < daysToAdd) {
            date.setDate(date.getDate() + 1);
            // 0 is Sunday, 6 is Saturday
            if (date.getDay() !== 0 && date.getDay() !== 6) {
                added++;
            }
        }
        return date.toISOString().split('T')[0];
    },

    // 2. Generate Full Sequence Schedule
    generateSchedule: function(ceDateStr) {
        if (!ceDateStr) return { fu1: "", fu2: "", fu3: "", fu4: "" };

        // Calculates exact calendar dates for the entire sequence upfront
        const fu1 = this.addBusinessDays(ceDateStr, this.sequence.intervals.C);
        const fu2 = this.addBusinessDays(fu1, this.sequence.intervals.FU1);
        const fu3 = this.addBusinessDays(fu2, this.sequence.intervals.FU2);
        const fu4 = this.addBusinessDays(fu3, this.sequence.intervals.FU3);

        return { fu1, fu2, fu3, fu4 };
    },

    // 3. Trigger: Schedule Prospect (Moves from QUEUED -> SEQUENCE)
    scheduleProspect: async function(pid, ceDateStr) {
        const prospect = HuntCore.getProspectById(pid);
        if (!prospect) return false;

        const schedule = this.generateSchedule(ceDateStr);
        
        const updates = {
            id: pid,
            status: "SEQUENCE",
            outreachStatus: "COLD",
            sequenceStep: "C",
            ceDate: ceDateStr,
            fu1Date: schedule.fu1,
            fu2Date: schedule.fu2,
            fu3Date: schedule.fu3,
            fu4Date: schedule.fu4,
            nextActionDate: ceDateStr, // The dashboard will flag them on this date
            updatedAt: new Date().toISOString()
        };

        const success = await HuntCore.saveProspect(updates);
        if (success) {
            console.log(`[HuntOps] ${pid} scheduled. CE hits on: ${ceDateStr}`);
            if (window.toast) window.toast('Prospect sequenced successfully.');
        }
        return success;
    },

    // 4. Trigger: Advance Sequence
    // Called when you actually send the email to push them to the next calendar step
    advanceSequence: async function(pid) {
        const prospect = HuntCore.getProspectById(pid);
        if (!prospect || prospect.status !== 'SEQUENCE') return false;

        const currentStep = prospect.sequenceStep || 'C';
        const nextStep = this.sequence.nextStep[currentStep];

        // If they finish FU4 and still haven't replied, they are dead.
        if (!nextStep) {
            return await HuntCore.saveProspect({
                id: pid,
                status: 'DEAD',
                nextActionDate: "",
                updatedAt: new Date().toISOString()
            });
        }

        // Map the upcoming action date based on the step we just advanced to
        let nextDate = "";
        if (nextStep === 'FU1') nextDate = prospect.fu1Date;
        if (nextStep === 'FU2') nextDate = prospect.fu2Date;
        if (nextStep === 'FU3') nextDate = prospect.fu3Date;
        if (nextStep === 'FU4') nextDate = prospect.fu4Date;

        const updates = {
            id: pid,
            sequenceStep: nextStep,
            nextActionDate: nextDate,
            emailsSent: (prospect.emailsSent || 0) + 1,
            updatedAt: new Date().toISOString()
        };

        const success = await HuntCore.saveProspect(updates);
        if (success) {
            console.log(`[HuntOps] ${pid} advanced to ${nextStep}.`);
            if (window.toast) window.toast(`Advanced to ${nextStep}`);
        }
        return success;
    },

    // 5. Trigger: Mark as Engaged (Pauses automated sequence)
    markEngaged: async function(pid) {
        return await HuntCore.saveProspect({
            id: pid,
            status: 'ENGAGED',
            nextActionDate: "", // Clears the automated sequence calendar
            updatedAt: new Date().toISOString()
        });
    },

    // 6. Quarterly Archival Sweep (Cleans the database)
    runArchivalSweep: async function() {
        const prospects = HuntCore.state.prospects;
        const now = new Date();
        let archiveCount = 0;

        for (let p of prospects) {
            const addedDate = new Date(p.addedAt || now);
            const updatedDate = new Date(p.updatedAt || now);
            
            const daysSinceAdded = (now - addedDate) / (1000 * 60 * 60 * 24);
            const daysSinceUpdated = (now - updatedDate) / (1000 * 60 * 60 * 24);

            let shouldArchive = false;
            // Target sits unscheduled for 60+ days
            if (p.status === 'QUEUED' && daysSinceAdded > 60) shouldArchive = true;
            // Target was marked dead 30+ days ago
            if (p.status === 'DEAD' && daysSinceUpdated > 30) shouldArchive = true;

            if (shouldArchive) {
                await HuntCore.saveProspect({ id: p.id, status: 'ARCHIVED' });
                archiveCount++;
            }
        }

        console.log(`[HuntOps] Sweep complete. ${archiveCount} targets archived.`);
        if (window.toast) window.toast(`Archived ${archiveCount} stale targets.`);
    }
};

// ════════════════════════════════════════════════════════════════════════
// ═════════ MODULE 5: HUNT EXPORT (SPEAR COPY GENERATOR) ═════════════════
// ════════════════════════════════════════════════════════════════════════

const HuntExport = {
    
    // 1. Triggered from the UI Modal Action Bar
    copySpear: async function(pid) {
        const p = (typeof HuntCore !== 'undefined' ? HuntCore.getProspectById(pid) : null) 
               || (window.allProspects ? window.allProspects.find(x => x.id === pid) : null);
               
        if (!p) {
            if(window.toast) window.toast('Prospect not found.', 'error');
            return;
        }

        if (p.intelStatus !== 'V5.0' || !p.true_gaps) {
            alert("Cannot generate Spear Copy: This prospect requires a V5.0 JSON update first.");
            return;
        }

        const spearText = this.generateSpearText(p);
        
        try {
            await navigator.clipboard.writeText(spearText);
            if (window.toast) window.toast('Spear Copy copied to clipboard!', 'success');
        } catch (err) {
            console.error('[HuntExport] Clipboard write failed:', err);
            const textArea = document.createElement("textarea");
            textArea.value = spearText;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand("copy");
            document.body.removeChild(textArea);
            if (window.toast) window.toast('Spear Copy copied via fallback!', 'success');
        }
    },

    // 2. The Strict Verbatim Formatter (Zero AI Theater)
    generateSpearText: function(p) {
        const profile = p.ghost_protection_profile || {};
        const gaps = p.true_gaps || [];
        const indictments = profile.self_indictments || [];
        
        let text = ``;

        // ── PART I: TARGET LOGISTICS ──────────────────────────────
        text += `=== TARGET LOGISTICS ===\n`;
        text += `Company: ${p.company || 'Unknown'}\n`;
        text += `PID: ${p.id}\n`;
        text += `Founder: ${p.founderName || 'Unknown'}\n`;
        text += `Role: ${p.founderRole || 'Unknown'}\n`;
        text += `Email: ${p.email || 'Unknown'}\n`;
        text += `HQ Jurisdiction: ${p.jurisdiction || 'Unknown'}\n`;
        text += `Funding Stage: ${p.fundingStage || 'Unknown'}\n`;
        text += `Scanner Link: ${p.scannerLink || 'Unknown'}\n\n`;

        // ── PART II: PRODUCT ARCHITECTURE (Raw JSON Dumps) ────────
        text += `=== PRODUCT ARCHITECTURE ===\n`;
        text += `primary_claim: ${p.primary_claim || 'N/A'}\n`;
        text += `primaryProduct: ${p.primaryProduct ? JSON.stringify(p.primaryProduct, null, 2) : 'N/A'}\n`;
        text += `primaryArchetype: ${p.primaryArchetype ? JSON.stringify(p.primaryArchetype, null, 2) : 'N/A'}\n`;
        text += `featureMap: ${p.featureMap ? JSON.stringify(p.featureMap, null, 2) : 'N/A'}\n`;
        text += `jurisdictional_surface: ${p.jurisdictional_surface ? JSON.stringify(p.jurisdictional_surface, null, 2) : 'N/A'}\n\n`;

        // ── PART III: GLOBAL FORENSICS & ALIBIS ───────────────────
        text += `=== GLOBAL FORENSICS ===\n`;
        text += `confidence_score: ${profile.confidence_score !== undefined ? profile.confidence_score : 'N/A'}\n`;
        text += `confidence_tier: ${profile.confidence_tier || 'N/A'}\n`;
        text += `ghost_protection_vector: ${profile.ghost_protection_vector || 'N/A'}\n`;
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
            
            const citation = g.proof_citation;
            if (!citation) {
                text += `proof_citation: N/A\n`;
            } else if (citation.startsWith("NULL")) {
                text += `proof_citation: ${citation}\n`;
            } else {
                text += `proof_citation: "${citation}"\n`;
            }
            
            text += `Lex_Nova_Fix: ${g.Lex_Nova_Fix || 'N/A'}\n`;
            text += `Status: ${g.Status || 'N/A'}\n`;
            text += `Effective_Date: ${g.Effective_Date || 'N/A'}\n`;
            text += `Pain_Depth: ${g.Pain_Depth || 'N/A'}\n\n`;
        });

        return text.trim();
    }
};

// ════════════════════════════════════════════════════════════════════════
// ═════════ V5.0 SYSTEM CONNECTORS ═══════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════

window.openPP = (id) => HuntUI.openProspectModal(id);
window.filterProspects = () => HuntUI.renderTableRows();
window.openAddProspect = () => HuntUI.openNewICPModal();
window.saveProspect = () => HuntUI.saveModalChanges(window.currentProspect?.id);

window.copySpearReport = (id) => HuntExport.copySpear(id);

window.triggerV5Update = function(id) {
    const jsonStr = prompt("Paste the fresh V5.0 Hunter JSON payload:");
    if (jsonStr) HuntIngestion.updateExistingICP(id, jsonStr);
};

window.advanceSequence = async function() {
    if (!window.currentProspect) return;
    await HuntOps.advanceSequence(window.currentProspect.id);
    if (window.closePP) window.closePP();
};

window.ppRecalcFUDates = async function() {
    if (!window.currentProspect) return;
    const cd = document.getElementById('pp-ce-date')?.value || window.currentProspect.ceDate;
    if (!cd) { if(window.toast) window.toast('Set CE date first','error'); return; }
    await HuntOps.scheduleProspect(window.currentProspect.id, cd);
    if (window.closePP) window.closePP();
};

// ════════════════════════════════════════════════════════════════════════
// ═════════ V5.0 MAIN BOOTSTRAP ══════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════

window.loadOutreach = function() {
    console.log("[Boot] Initializing Outreach Tab...");
    
    // Clear page actions (Legacy Header)
    const pa = document.getElementById('pageActions');
    if (pa) pa.innerHTML = '';
    
    const container = document.getElementById('tab-hunt');
    if (!container) {
        console.error("[Boot] #tab-hunt not found.");
        return;
    }

    // 1. Render UI Skeleton
    HuntUI.renderMainDash();

    // 2. Start Data Sync
    HuntCore.init();
};
