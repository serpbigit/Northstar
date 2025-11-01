"use strict";
/*
 * Contains Manual functions for setup (authorization) and Sheet-bound UI
 * elements.
 * (Blocks #11 and #12)
 */
// ========== Block#11 — UTIL: Manual Authorization ==========
/**
 * Run this function MANUALLY from the Apps Script editor
 * to trigger the authorization prompt for all required scopes.
 */
// Test comment
function authorize_() {
    try {
        // 1. Sheets
        SpreadsheetApp.getActiveSpreadsheet().getName();
        // 2. Calendar
        CalendarApp.getDefaultCalendar().getName();
        // 3. Tasks (Requires enabling the Google Tasks API in your GCP project)
        if (typeof Tasks !== 'undefined' && Tasks.Tasklists) {
            const taskLists = Tasks.Tasklists.list();
            if (taskLists && taskLists.items) {
                const taskList = taskLists.items.find(l => l.title === 'Polaris');
                if (!taskList) {
                    Tasks.Tasklists.insert({ title: 'Polaris' });
                }
            }
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
    }
    catch (e) {
        Logger.log(`⚠️ Authorization Error: ${e.message}. This is normal if you haven't granted permissions yet. Please follow the pop-up flow.`);
    }
}
/**
 * MANUAL RUNNER (The "Thin Wrapper" fix)
 */
function RUN_THIS_TO_AUTHORIZE_() {
    authorize_();
}
// ========== Block#12 — UI & SHEET TRIGGERS ==========
/**
 * Helper function to generate a HTML table from the 'Codebase' sheet data.
 */
function buildCodebaseHtml_() {
    try {
        const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Codebase');
        if (!sh)
            return '<p>Codebase sheet not found.</p>';
        const data = sh.getDataRange().getValues();
        if (data.length === 0)
            return '<p>Codebase is empty.</p>';
        let html = '<style>table {border-collapse: collapse; width: 100%; font-size: 10px;} th, td {border: 1px solid #ddd; padding: 4px; text-align: left;} th {background-color: #f2f2f2;}</style><table><thead><tr>';
        data[0].forEach(header => { html += `<th>${header}</th>`; });
        html += '</tr></thead><tbody>';
        for (let i = 1; i < data.length; i++) {
            html += '<tr>';
            data[i].forEach(cell => { html += `<td>${String(cell)}</td>`; });
            html += '</tr>';
        }
        html += '</tbody></table>';
        return html;
    }
    catch (e) {
        console.error('Error loading codebase table:', e.message);
        return 'Error loading codebase table.';
    }
}
function showCodebaseTable() {
    const htmlOutput = HtmlService.createHtmlOutput(buildCodebaseHtml_()).setTitle('Polaris Project Codebase');
    SpreadsheetApp.getUi().showSidebar(htmlOutput);
}
