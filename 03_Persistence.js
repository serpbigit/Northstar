// ========== FILE: 03_Persistence.gs ==========
/*
 * Contains utility functions for persistence: saving and retrieving actions
 * from the 'PendingActions' sheet. This is the persistent queue for human approval.
 * (Block #2.5)
 */

// ========== Block#2.5 — UTIL: Pending Actions Storage ==========

/*
 * Stores a pending action in the sheet.
 * Returns {ok: true, message: '...'} or {ok: false, error: '...'}
 */
function pending_save_(actionId, handlerKey, userId, spaceName, payload) {
    try {
        const rowData = {
            ActionID: actionId,
            Timestamp: new Date(),
            Status: 'PENDING',
            HandlerKey: handlerKey,
            UserID: userId,
            SpaceName: spaceName,
            ActionPayload: JSON.stringify(payload)
        };
        
        // CFG_PENDING_ is defined in 01_Config_Global.gs
        appendRow_(CFG_PENDING_.SHEET, CFG_PENDING_.HEADERS, rowData);
        return { ok: true };
    } catch (e) {
        log_('ERROR', 'pending_save_', { err: e.message, actionId });
        return { ok: false, error: 'Failed to save action to sheet.' };
    }
}

/*
 * Retrieves and marks an action as COMPLETED/DELETED in the sheet.
 * Returns {ok: true, payload: {...}} or {ok: false, error: '...'}
 */
function pending_getAndExecute_(actionId) {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        // Ensure the sheet exists with headers
        const sh = ensureSheet_(ss, CFG_PENDING_.SHEET, CFG_PENDING_.HEADERS);
        const data = sh.getDataRange().getValues();
        
        // Find column indices dynamically
        const headerRow = data[0];
        const actionIdCol = headerRow.indexOf('ActionID');
        const statusCol = headerRow.indexOf('Status');
        const payloadCol = headerRow.indexOf('ActionPayload');

        if (actionIdCol === -1 || statusCol === -1 || payloadCol === -1) {
             throw new Error("PendingActions sheet missing required columns.");
        }
        
        // Find the row (starting from index 1, skipping header)
        for (let i = 1; i < data.length; i++) {
            if (data[i][actionIdCol] === actionId) {
                const status = data[i][statusCol];
                if (status !== 'PENDING') {
                    return { ok: false, error: `Action ${actionId} status is '${status}'. Cannot execute.` };
                }
                
                // Get the payload
                const payload = JSON.parse(data[i][payloadCol]);
                
                // Mark as COMPLETED in the sheet immediately
                const rowRange = sh.getRange(i + 1, 1, 1, headerRow.length);
                const newRowValues = rowRange.getValues()[0];
                newRowValues[statusCol] = 'COMPLETED'; // Update Status column
                rowRange.setValues([newRowValues]);
                
                return { ok: true, payload: payload };
            }
        }

        return { ok: false, error: 'Action ID not found or already completed.' };
    } catch (e) {
        log_('ERROR', 'pending_getAndExecute_', { err: e.message, actionId });
        return { ok: false, error: `Sheet read/write error: ${e.message}` };
    }
}