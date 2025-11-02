// ---------------------------------------------------------------------------------
// FILE: 01_ConfigAndUtils.ts
// PURPOSE: Global configuration constants, logging, core Sheet utilities, and function resolver.
// ---------------------------------------------------------------------------------

// ========== Block#1 — CONFIG ==========
/**
 * Global configuration constants for sheet names.
 */
const CFG_: any = {
  SETTINGS_SHEET: 'Settings',
  HANDLERS_SHEET: 'Handlers',
  DATAAGENTS_SHEET: 'DataAgents',
  SHARED_POLICIES_SHEET: 'SharedPolicies',
  LOG_SHEET: 'Log',
  JOBS_QUEUE_SHEET: 'PendingActions', 
  DEFAULT_AGENT: 'Default',
};

// ========== Block#2 — UTIL: Logging & Sheets ==========

/**
 * Ensures a sheet exists and creates it with a header if missing.
 */
function ensureSheet_(ss: any, name: any, header: any = []): any {
  let sh: any = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    if (header && header.length) sh.getRange(1, 1, 1, header.length).setValues([header]);
  }
  return sh;
}

/**
 * Centralized, structured execution and debugging log (Archivist Agent reliance).
 */
function log_(level: any, evt: any, data: any) {
  try {
    const row: any = [
      new Date(), 
      level, 
      evt, 
      JSON.stringify(data || {}).slice(0, 3000)
    ];
    const ss: any = SpreadsheetApp.getActiveSpreadsheet();
    const sh: any = ensureSheet_(ss, CFG_.LOG_SHEET, ['ts', 'level', 'evt', 'details']); 
    sh.appendRow(row);
  } catch (e: any) {
    try { 
      console.error('log_ fail: ' + e.message); 
    } catch (_) {}
  }
}

/**
 * Reads a sheet table, converting rows into an array of objects based on the header.
 */
function readTable_(sheetName: any): any {
  try {
    const ss: any = SpreadsheetApp.getActiveSpreadsheet();
    const sh: any = ensureSheet_(ss, sheetName);
    const rng: any = sh.getDataRange();
    const vals: any = rng.getValues();

    if (vals.length < 1) return { ok: true, header: [], rows: [] };
    
    const header: any = vals[0].map((h: any) => String(h).trim()); 
    if (vals.length < 2) return { ok: true, header, rows: [] };
    
    const rows: any = vals.slice(1).map((r: any) => 
      Object.fromEntries(header.map((h: any, i: any) => [h, r[i]]))
    );
    
    return { ok: true, header, rows };
  } catch (e: any) {
    log_('ERROR', 'readTable_', { err: e.message, sheet: sheetName });
    return { ok: false, error: e.message, header: [], rows: [] };
  }
}

/**
 * Appends an object's values to a sheet row based on a required header array.
 */
function appendRow_(sheetName: any, header: any, obj: any): any {
  try {
    const ss: any = SpreadsheetApp.getActiveSpreadsheet();
    const sh: any = ensureSheet_(ss, sheetName, header);
    
    const row: any = header.map((h: any) => obj[h] ?? '');
    
    sh.appendRow(row);
    return { ok: true };
  } catch (e: any) {
    log_('ERROR', 'appendRow_', { err: e.message, sheet: sheetName, data: obj });
    return { ok: false, error: e.message };
  }
}

/**
 * Helper function used by the LibraryInterface to resolve GAS functions dynamically.
 */
function resolveHandlerFn_(this: any, name: any): any {
  const n: any = String(name || '');
  
  if (typeof this[n] === 'function') return this[n];
  if (n.endsWith('_') && typeof this[n.slice(0, -1)] === 'function') return this[n.slice(0, -1)];
  if (!n.endsWith('_') && typeof this[n + '_'] === 'function') return this[n + '_'];
  return null;
}

/**
 * Manually callable function to set up the minimal Polaris sheet structure.
 * *** FIX: Removed SpreadsheetApp.getUi() for non-UI execution ***
 */
function GoogleSheets_Setup(): any {
  const ss: any = SpreadsheetApp.getActiveSpreadsheet();
  // const ui: any = SpreadsheetApp.getUi(); <-- Removed UI dependency

  try {
    // 1. Create essential system sheets with their headers
    ensureSheet_(ss, CFG_.SETTINGS_SHEET, ['Key', 'Value']);
    ensureSheet_(ss, CFG_.LOG_SHEET, ['ts', 'level', 'evt', 'details']);
    ensureSheet_(ss, CFG_.HANDLERS_SHEET, ['HandlerKey', 'GAS_Function', 'Description']);
    ensureSheet_(ss, CFG_.DATAAGENTS_SHEET, ['agentName', 'Instructions', 'TargetSheet']);
    
    ensureSheet_(ss, CFG_.JOBS_QUEUE_SHEET, [
      'ActionPlan_ID', 'User_ID', 'Created_TS', 'Status', 'Name', 
      'Total_Steps', 'Current_Step_Idx', 'Execution_Log', 'Action_Plan_JSON'
    ]);

    // Replaced ui.alert() with Logger.log() for non-UI execution context
    Logger.log('✅ Polaris Setup Complete! Sheets initialized.');

    // Returning success message for the Web App client to display
    return '✅ Polaris Setup Complete! All essential system sheets have been created.';

  } catch (e: any) {
    console.error('Setup Error: ' + e.message);
    Logger.log('⚠️ Setup Failed: ' + e.message);
    // Return error message for the Web App client
    return '⚠️ Setup Failed. Please check the Execution Log: ' + e.message;
  }
}
