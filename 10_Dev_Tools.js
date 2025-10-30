
// ========== FILE: 10_Dev_tools.gs ==========
/*
 * Contains Manual functions for setup (authorization) and Sheet-bound UI
 * elements (onOpen, menu items).
 * (Blocks #11 and #12)
 */

// ========== Block#11 — UTIL: Manual Authorization ==========

/*
 * Run this function MANUALLY from the Apps Script editor
 * to trigger the authorization prompt for all required scopes.
 */

function authorize_() {
  try {
    // 1. Sheets
    SpreadsheetApp.getActiveSpreadsheet().getName();
    
    // 2. Calendar
    CalendarApp.getDefaultCalendar().getName();
    
    // 3. Tasks
    // This will create a 'Polaris' list if it doesn't exist,
    // which is a good, safe 'write' test.
    const taskList = Tasks.Tasklists.list().items.find(l => l.title === 'Polaris');
    if (!taskList) {
      Tasks.Tasklists.insert({ title: 'Polaris' });
    }
    
    // 4. Gmail (Read & Compose)
    GmailApp.getInboxUnreadCount(); // Read-only
    GmailApp.getDrafts(); // Compose (accessing drafts)
    GmailApp.sendEmail(Session.getActiveUser().getEmail(), 'Auth Test', 'Test'); // Send
    
    // 5. External Request (OpenAI)
    UrlFetchApp.fetch('https://api.openai.com', { muteHttpExceptions: true });
    
    // 6. Cache
    CacheService.getScriptCache().put('auth_test', 'ok', 60);

    Logger.log('✅ All services accessed. Permissions are (or will be) granted.');
    
  } catch (e) {
    Logger.log(`⚠️ Authorization Error: ${e.message}. This is normal if you haven't granted permissions yet. Please follow the pop-up flow.`);
  }
}


/*
 * MANUAL RUNNER (The "Thin Wrapper" fix)
 * Use this to run authorize_() if it isn't appearing in the dropdown.
 * Just save, select 'RUN_THIS_TO_AUTHORIZE_' from the dropdown, and click Run.
 */
function RUN_THIS_TO_AUTHORIZE_() {
  authorize_(); 
}

// ----------------------------------------------------




// ========== Block#12 — UI & SHEET TRIGGERS ==========

/*
 * Helper function to generate a HTML table from the 'Codebase' sheet data.
 */
function buildCodebaseHtml_() {
  try {
    // Assuming 'Codebase' is the sheet name based on your past images/tabs
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName('Codebase'); 
    if (!sh) return '<p>Codebase sheet not found. Please create a sheet named "Codebase".</p>';

    const data = sh.getDataRange().getValues();
    if (data.length === 0) return '<p>Codebase is empty.</p>';

    // Basic styling for the table
    let html = '<style>table {border-collapse: collapse; width: 100%; font-size: 10px;} th, td {border: 1px solid #ddd; padding: 4px; text-align: left;} th {background-color: #f2f2f2;}</style><table>';
    
    // Header
    html += '<thead><tr>';
    data[0].forEach(header => {
      html += `<th>${header}</th>`;
    });
    html += '</tr></thead><tbody>';

    // Data Rows (skipping header row)
    for (let i = 1; i < data.length; i++) {
      html += '<tr>';
      data[i].forEach(cell => {
        html += `<td>${cell}</td>`;
      });
      html += '</tr>';
    }
    html += '</tbody></table>';

    return html;
  } catch (e) {
    console.error('Error loading codebase table:', e.message); 
    return 'Error loading codebase table.';
  }
}

/*
 * Handles opening the Codebase Table in a sidebar when clicked from the menu.
 * The SpreadsheetApp.getUi() call is now wrapped in a try/catch.
 */
function showCodebaseTable() {
  try {
    const htmlOutput = HtmlService.createHtmlOutput(buildCodebaseHtml_())
        .setTitle('Polaris Project Codebase');
    // If this is called outside of the Sheet UI (e.g., from a test trigger), it will crash.
    SpreadsheetApp.getUi().showSidebar(htmlOutput);
  } catch (e) {
    // This ensures that if the function is called in a headless context, 
    // it logs the error but does not crash the main thread.
    console.error('showCodebaseTable failed: Running in non-UI context.', e.message);
  }
}

/*
 * Creates a custom menu in the Google Sheet UI when the sheet is opened.
 * The SpreadsheetApp.getUi() call is now safely contained in a try/catch.
 */
function onOpen() {
  try {
    SpreadsheetApp.getUi()
        .createMenu('🤖 Polaris Agent')
        .addItem('Authorize All Services', 'RUN_THIS_TO_AUTHORIZE_') // Use the public wrapper
        .addSeparator()
        .addItem('View Codebase Modules', 'showCodebaseTable')
        .addToUi();
  } catch (e) {
    // The onOpen trigger should ONLY run in a UI context, but we guard it anyway.
    console.error('onOpen failed: Likely non-UI context or permission issue.', e.message);
  }
}
// ===============================================


