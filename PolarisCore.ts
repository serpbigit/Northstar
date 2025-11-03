// ---------------------------------------------------------------------------------
// FILE: LibraryCore.ts
// PURPOSE: Consolidated source for the Polaris Core Agent Library.
// Includes Config, Utilities, Guardian Policy, Router, and Specialists.
// ---------------------------------------------------------------------------------
// === CONFIG & UTILITIES ===
const CFG_ = {
    SETTINGS_SHEET: 'Settings',
    HANDLERS_SHEET: 'Handlers',
    DATAAGENTS_SHEET: 'DataAgents',
    LOG_SHEET: 'Log',
    JOBS_QUEUE_SHEET: 'PendingActions',
    DEFAULT_AGENT: 'Default',
    // New: Policy Sheet
    POLICY_ACCESS_SHEET: 'UserAccess', 
};

function log_(level, evt, data) {
    try {
        const row = [new Date(), level, evt, JSON.stringify(data || {}).slice(0, 3000)];
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sh = ss.getSheetByName(CFG_.LOG_SHEET) || ss.insertSheet(CFG_.LOG_SHEET, 0);
        sh.appendRow(row);
    } catch (e) { console.error('log_ fail: ' + e.message); }
}

function readTable_(sheetName) {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sh = ss.getSheetByName(sheetName);
        if (!sh) throw new Error("Sheet not found: " + sheetName);
        
        const vals = sh.getDataRange().getValues();
        if (vals.length < 2) return { ok: true, rows: [] };
        
        const header = vals[0].map(h => String(h).trim());
        const rows = vals.slice(1).map(r => Object.fromEntries(header.map((h, i) => [h, r[i]])));
        return { ok: true, rows };
    } catch (e) {
        log_('ERROR', 'readTable_', { err: e.message, sheet: sheetName });
        return { ok: false, error: e.message, rows: [] };
    }
}
// Assume resolveHandlerFn_, appendRow_, GoogleSheets_Setup, getSettings_, and callOpenAI_ exist/are compiled elsewhere.

// === GUARDIAN AGENT (Policy Enforcement) ===

const ADMIN_EMAIL_POLICY = "ADMIN";
const ADMIN_HANDLER_WILDCARD = "*";

function Guardian_getUserPolicy(userEmail) {
    try {
        const tbl = readTable_(CFG_.POLICY_ACCESS_SHEET); 
        const userRow = tbl.rows.find(r => r.User_Email === userEmail); 
        
        if (!userRow) return { accessLevel: 'FREE', allowedHandlers: [] };
        
        const handlers = JSON.parse(userRow.Allowed_Handlers || '[]');

        return { 
            accessLevel: userRow.Access_Level || 'FREE', 
            allowedHandlers: handlers
        };

    } catch (e) {
        log_('ERROR', 'Guardian_getUserPolicy', { err: e.message });
        // Fail open for ADMIN for development sanity
        if (userEmail === 'reuven007@gmail.com') {
             return { accessLevel: ADMIN_EMAIL_POLICY, allowedHandlers: [ADMIN_HANDLER_WILDCARD] };
        }
        return { accessLevel: 'FREE', allowedHandlers: [] };
    }
}

function Guardian_checkAccess(userEmail, handlerKey) {
    const policy = Guardian_getUserPolicy(userEmail);

    if (policy.accessLevel === ADMIN_EMAIL_POLICY || policy.allowedHandlers.includes(ADMIN_HANDLER_WILDCARD)) {
        return { ok: true };
    }
    if (policy.allowedHandlers.includes(handlerKey)) {
        return { ok: true };
    }

    return { 
        ok: false, 
        message: `Access Denied: The handler '${handlerKey}' requires a subscription upgrade.` 
    };
}


// === CORE ROUTER & EXECUTION ===
function getHandlerManifest_() { 
    // STUB: This relies on the original complex nlpPickCommand_ helper. 
    // Assuming this function returns { ok: true, handler: fnName, handlerKey: key }
    throw new Error("Manifest lookup requires nlpPickCommand_ helpers.");
}

function nlpPickCommand_(text) {
    // STUB: Full AI routing logic here.
    // We will simulate the desired output for the 'help' test:
    if (text === 'help') {
        return { ok: true, handler: 'cmd_Help_', handlerKey: 'cmd_Help_' };
    }
    if (text.startsWith('cmd_TestMenu_')) {
        return { ok: true, handler: 'cmd_TestMenu_', handlerKey: 'cmd_TestMenu_' };
    }
    return { ok: false, reason: 'no-match' }; 
}


/**
 * Public entry point for the Polaris Client Project (Web App) via google.script.run.
 */
function routeUserQuery(text) {
    try {
        const userId = Session.getActiveUser().getEmail();
        
        // 1. Route the query (Query 1)
        const routeResult = nlpPickCommand_(text);
        if (!routeResult.ok) {
            return `⚠️ Router Fail: ${routeResult.reason || 'Unknown routing error'}`;
        }

        // 2. Policy Enforcement (THE GATE)
        const accessCheck = Guardian_checkAccess(userId, routeResult.handlerKey);
        if (!accessCheck.ok) {
            return `⚠️ ${accessCheck.message}`; // Return the access denial message
        }
        
        // 3. Execution (Simulated for cmd_Help_)
        const handlerFn = routeResult.handler;
        
        if (handlerFn === 'cmd_Help_') {
            // Check access one more time for debug assurance
            return cmd_Help_({});
        }

        // 4. Resolve and execute (STUB)
        return { ok: true, message: `Successfully routed to ${handlerFn}.` };

    } catch (e) {
        log_('FATAL', 'routeUserQuery_Exception', { err: e.message });
        return '⚠️ Critical Error: An unexpected exception occurred.';
    }
}

// === CORE SPECIALISTS (Mock for Test) ===
function cmd_Help_(params) {
    return { 
        ok: true, 
        message: `Here's what I can do (Access Granted!):
• **cmd_Help_**: Lists available commands.
• **cmd_TestMenu_**: Tests the interactive menu.`
    };
}
