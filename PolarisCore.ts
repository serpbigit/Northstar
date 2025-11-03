// ---------------------------------------------------------------------------------
// FILE: PolarisCore.ts
// PURPOSE: Consolidated source for the Polaris Core Agent Library.
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

/**
 * Global constant for the main database Spreadsheet ID.
 * FIX: Hardcoded ID for the USER_POLICIES_SHEET.
 */
const GLOBAL_DB_ID: string = "1JKS0GGJCMSlLeSNP6lIQGBI4YzQIpgsMpX8JSJU1nak";

/**
 * Centralized, structured execution and debugging log (Archivist Agent reliance).
 */
function log_(level: string, evt: string, data: any): void {
    try {
        const row = [new Date(), level, evt, JSON.stringify(data || {}).slice(0, 3000)];
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sh = ss.getSheetByName(CFG_.LOG_SHEET) || ss.insertSheet(CFG_.LOG_SHEET, 0);
        sh.appendRow(row);
    } catch (e: unknown) { console.error('log_ fail: ' + (e as Error).message); }
}

/**
 * Reads a sheet table, converting rows into an array of objects based on the header.
 * FIX: Now opens the policy sheet by its hardcoded ID.
 */
function readTable_(sheetName: string): { ok: boolean, rows: any[], error?: string } {
    try {
        // Use openById() to connect to the separate policy sheet
        const ss: GoogleAppsScript.Spreadsheet.Spreadsheet = SpreadsheetApp.openById(GLOBAL_DB_ID);
        const sh: GoogleAppsScript.Spreadsheet.Sheet | null = ss.getSheetByName(sheetName);
        
        if (!sh) throw new Error("Sheet not found: " + sheetName);
        
        const vals = sh.getDataRange().getValues();
        if (vals.length < 2) return { ok: true, rows: [] };
        
        const header = vals[0].map((h: any) => String(h).trim());
        const rows = vals.slice(1).map((r: any[]) => Object.fromEntries(header.map((h: string, i: number) => [h, r[i]])));
        return { ok: true, rows };
    } catch (e: unknown) {
        log_('ERROR', 'readTable_', { err: (e as Error).message, sheet: sheetName });
        return { ok: false, error: (e as Error).message, rows: [] };
    }
}

// === GUARDIAN AGENT (Policy Enforcement) ===

const ADMIN_EMAIL_POLICY: string = "ADMIN";
const ADMIN_HANDLER_WILDCARD: string = "*";

interface Policy {
    accessLevel: string;
    allowedHandlers: string[];
}

/**
 * Guardian Agent: Retrieves user policy record from the UserAccess sheet.
 */
function Guardian_getUserPolicy(userEmail: string): Policy {
    try {
        const tbl: { ok: boolean, rows: any[] } = readTable_(CFG_.POLICY_ACCESS_SHEET); 
        if (!tbl.ok) return { accessLevel: 'FREE', allowedHandlers: [] };

        const userRow: any = tbl.rows.find((r: any) => r.User_Email === userEmail); 
        
        if (!userRow) return { accessLevel: 'FREE', allowedHandlers: [] };
        
        // Parse handlers from JSON string in the sheet cell
        const handlers: string[] = JSON.parse(userRow.Allowed_Handlers || '[]');

        return { 
            accessLevel: userRow.Access_Level || 'FREE', 
            allowedHandlers: handlers
        };

    } catch (e: unknown) {
        log_('ERROR', 'Guardian_getUserPolicy', { err: (e as Error).message });
        if (userEmail === 'reuven007@gmail.com') {
             return { accessLevel: ADMIN_EMAIL_POLICY, allowedHandlers: [ADMIN_HANDLER_WILDCARD] };
        }
        return { accessLevel: 'FREE', allowedHandlers: [] };
    }
}

/**
 * Guardian Agent: Main function to check user access before running a handler.
 */
function Guardian_checkAccess(userEmail: string, handlerKey: string): {ok: boolean, message?: string} {
    const policy: Policy = Guardian_getUserPolicy(userEmail);

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


// === CORE ROUTER & EXECUTION (STUBS) ===
function nlpPickCommand_(text: string): any {
    // STUB: This is a simplified version for local testing.
    if (text.toLowerCase() === 'help') {
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
function routeUserQuery(text: string): any {
    try {
        const userId: string = Session.getActiveUser().getEmail();
        
        const routerResult: any = nlpPickCommand_(text);
        if (!routerResult.ok) {
            return `⚠️ Router Fail: ${routerResult.reason || 'Unknown routing error'}`;
        }

        const accessCheck: any = Guardian_checkAccess(userId, routerResult.handlerKey);
        if (!accessCheck.ok) {
            log_('WARN', 'routeUserQuery_AccessDenied', { userId: userId, key: routerResult.handlerKey });
            return `⚠️ ${accessCheck.message}`;
        }
        
        const handlerFn: string = routerResult.handler;
        
        // FIX: If the handler is cmd_Help_ we call the function directly.
        if (handlerFn === 'cmd_Help_') {
            return cmd_Help_({});
        }

        // Final Execution: Dynamic function call using type assertion to bypass TS7053
        // We trust the handlerFn string points to a globally available GAS function.
        const fn = globalThis[handlerFn as keyof typeof globalThis] as ((params: any) => any) | undefined;

        if (typeof fn === 'function') {
            return fn({text: text, userId: userId});
        }
        
        return { ok: false, message: `⚠️ Internal Error: Handler function '${handlerFn}' not found.` };


    } catch (e: unknown) {
        log_('FATAL', 'routeUserQuery_Exception', { err: (e as Error).message });
        return '⚠️ Critical Error: An unexpected exception occurred.';
    }
}

// === CORE SPECIALISTS (Mock for Test) ===
function cmd_Help_(params: any): any {
    return { 
        ok: true, 
        message: `Here's what I can do (Access Granted!):
• **cmd_Help_**: Lists available commands.
• **cmd_TestMenu_**: Tests the interactive menu.`
    };
}
