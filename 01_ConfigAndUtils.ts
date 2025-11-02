// ---------------------------------------------------------------------------------
// FILE: 01_ConfigAndUtils.ts
// PURPOSE: Global configuration constants, logging, core Sheet utilities, and function resolver.
// ---------------------------------------------------------------------------------

// ========== Block#1 — CONFIG ==========
/**
 * Global configuration constants for sheet names.
 */
const CFG_ = {
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
function ensureSheet_(ss, name, header) {
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    if (header && header.length) sh.getRange(1, 1, 1, header.length).setValues([header]);
  }
  return sh;
}

/**
 * Centralized, structured execution and debugging log (Archivist Agent reliance).
 */
function log_(level, evt, data) {
  try {
    const row = [
      new Date(), 
      level, 
      evt, 
      JSON.stringify(data || {}).slice(0, 3000)
    ];
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ensureSheet_(ss, CFG_.LOG_SHEET, ['ts', 'level', 'evt', 'details']);
    sh.appendRow(row);
  } catch (e) {
    try { 
      console.error('log_ fail: ' + e.message); 
    } catch (_) {}
  }
}

/**
 * Reads a sheet table, converting rows into an array of objects based on the header.
 */
function readTable_(sheetName) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ensureSheet_(ss, sheetName);
    const rng = sh.getDataRange();
    const vals = rng.getValues();

    if (vals.length < 1) return { ok: true, header: [], rows: [] };
    
    const header = vals[0].map(h => String(h).trim()); 
    if (vals.length < 2) return { ok: true, header, rows: [] };
    
    const rows = vals.slice(1).map(r => 
      Object.fromEntries(header.map((h, i) => [h, r[i]]))
    );
    
    return { ok: true, header, rows };
  } catch (e) {
    log_('ERROR', 'readTable_', { err: e.message, sheet: sheetName });
    return { ok: false, error: e.message, header: [], rows: [] };
  }
}

/**
 * Appends an object's values to a sheet row based on a required header array.
 */
function appendRow_(sheetName, header, obj) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ensureSheet_(ss, sheetName, header);
    
    const row = header.map(h => obj[h] ?? '');
    
    sh.appendRow(row);
    return { ok: true };
  } catch (e) {
    log_('ERROR', 'appendRow_', { err: e.message, sheet: sheetName, data: obj });
    return { ok: false, error: e.message };
  }
}

/**
 * Helper function used by the LibraryInterface to resolve GAS functions dynamically.
 * Note: This function must be visible to all core agent files.
 * @param {string} name The name of the function to resolve (e.g., 'cmd_HandleGmail_').
 * @returns {Function | null} The function object or null if not found.
 */
function resolveHandlerFn_(name) {
  // Tolerant resolver: accepts with or without trailing underscore
  const n = String(name || '');
  
  // Check global scope for function names defined in the concatenated script
  if (typeof this[n] === 'function') return this[n];
  if (n.endsWith('_') && typeof this[n.slice(0, -1)] === 'function') return this[n.slice(0, -1)];
  if (!n.endsWith('_') && typeof this[n + '_'] === 'function') return this[n + '_'];
  return null;
}

/**
 * Manually callable function to set up the minimal Polaris sheet structure.
 */
function GoogleSheets_Setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

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

    ui.alert('✅ Polaris Setup Complete!', 'All essential system sheets have been created and initialized.', ui.ButtonSet.OK);

  } catch (e) {
    console.error('Setup Error: ' + e.message);
    ui.alert('⚠️ Setup Failed', 'An error occurred during sheet creation: ' + e.message, ui.ButtonSet.OK);
  }
}
