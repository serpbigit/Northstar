"use strict";
/*
 * Contains general utility functions for logging, spreadsheet interaction (read/append),
 * and core AI/settings retrieval.
 * (Blocks #2, #3, and #2.1 - NEW)
 */
// ========== Block#1.5 — UTIL: AI Response Parsing ==========
// ========== Block#2 — UTIL: Logging & Sheets ==========
function log_(level, evt, data) {
    try {
        const version = globalThis.CFG_?.VERSION || 'unknown';
        const row = [new Date(), version, level, evt, JSON.stringify(data || {}).slice(0, 3000)];
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sh = ensureSheet_(ss, CFG_.LOG_SHEET, ['ts', 'version', 'level', 'evt', 'details']);
        sh.appendRow(row);
    }
    catch (e) {
        try {
            console.error('log_ fail: ' + e.message);
        }
        catch (_) { }
    }
}
function ensureSheet_(ss, name, header) {
    let sh = ss.getSheetByName(name);
    if (!sh) {
        sh = ss.insertSheet(name);
        if (header && header.length) {
            sh.getRange(1, 1, 1, header.length).setValues([header]);
        }
    }
    return sh;
}
function readTable_(sheetName) {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sh = ensureSheet_(ss, sheetName);
        const rng = sh.getDataRange();
        const vals = rng.getValues();
        if (vals.length < 2)
            return { ok: true, header: vals[0] || [], rows: [] };
        const header = vals[0];
        const rows = vals.slice(1).map(r => Object.fromEntries(header.map((h, i) => [h, r[i]])));
        return { ok: true, header, rows };
    }
    catch (e) {
        return { ok: false, error: e.message };
    }
}
/**
 * Safely parses a JSON object from a raw string, which may be wrapped in markdown.
 * @param rawText The raw string response from the AI.
 * @returns A result object with the parsed data or an error.
 */
function parseAiJson_(rawText) {
    try {
        // 1. Clean the string: remove markdown fences, newlines, and trim whitespace.
        const cleanedText = rawText
            .replace(/```json/g, '')
            .replace(/```/g, '')
            .trim();
        const data = JSON.parse(cleanedText);
        return { ok: true, data: data };
    }
    catch (e) {
        log_('ERROR', 'parseAiJson_', { rawText: rawText, err: e.message });
        return { ok: false, error: `Failed to parse AI response as JSON: ${e.message}` };
    }
}
function appendRow_(sheetName, header, obj) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ensureSheet_(ss, sheetName, header);
    const row = header.map(h => obj[h] ?? '');
    sh.appendRow(row);
    return { ok: true };
}
// ========== Block#2.1 — UTIL: Sheet Reader for Context Specialist (NEW) ==========
/**
 * Reads a sheet's data and returns it as a structured object array (rows mapped to headers).
 * This is the utility for the Project Context Specialist.
 * @param sheetName The name of the sheet to read.
 * @returns {object} {name: string, data: Record<string, any>[]} or {name: string, error: string}
 */
function util_readSheetAsJson_(sheetName) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) {
        return { name: sheetName, error: `Sheet not found.` };
    }
    try {
        // Reuse the existing robust readTable_ logic
        const result = readTable_(sheetName);
        if (!result.ok) {
            return { name: sheetName, error: result.error };
        }
        return { name: sheetName, data: result.rows };
    }
    catch (e) {
        return { name: sheetName, error: e.message };
    }
}
// ========== End Block#2.1 — UTIL: Sheet Reader for Context Specialist ==========
// ========== Block#3 — UTIL: AI & Settings ==========
function getSettings_() {
    try {
        const cache = CacheService.getScriptCache();
        const CACHE_KEY = 'polaris_settings';
        const cached = cache.get(CACHE_KEY);
        if (cached)
            return { ok: true, settings: JSON.parse(cached) };
        const tblResult = readTable_(CFG_.SETTINGS_SHEET);
        if (!tblResult.ok)
            return tblResult;
        if (!tblResult.rows.length) {
            return { ok: false, error: 'Settings sheet is empty or unreadable.' };
        }
        const settings = tblResult.rows.reduce((acc, row) => {
            const k = row.key || row.Key;
            const v = row.value || row.Value;
            if (k)
                acc[k] = v;
            return acc;
        }, {});
        if (!settings.OPENAI_API_KEY || !settings.OPENAI_MODEL) {
            log_('WARN', 'getSettings_', 'OPENAI_API_KEY or OPENAI_MODEL missing from Settings');
        }
        cache.put(CACHE_KEY, JSON.stringify(settings), 600); // Cache for 10 mins
        return { ok: true, settings };
    }
    catch (e) {
        log_('ERROR', 'getSettings_', { err: e.message });
        return { ok: false, error: e.message };
    }
}
function callOpenAI_(systemPrompt, userText) {
    try {
        const settingsData = getSettings_();
        if (!settingsData.ok) {
            return { ok: false, error: `Failed to get settings: ${settingsData.error}` };
        }
        const { OPENAI_API_KEY, OPENAI_MODEL } = settingsData.settings;
        if (!OPENAI_API_KEY || !OPENAI_MODEL) {
            return { ok: false, error: 'OPENAI_API_KEY or OPENAI_MODEL is not set in the Settings sheet.' };
        }
        const url = 'https://api.openai.com/v1/chat/completions';
        const payload = {
            model: OPENAI_MODEL,
            messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userText }],
            max_tokens: 1024,
            temperature: 0.7,
        };
        const options = {
            method: 'post',
            contentType: 'application/json',
            headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
            payload: JSON.stringify(payload),
            // @ts-ignore - 'deadline' is a valid option but not in the current type definitions.
            deadline: 30, // Set a 30-second timeout for the API call
            muteHttpExceptions: true,
        };
        const httpResponse = UrlFetchApp.fetch(url, options);
        const httpCode = httpResponse.getResponseCode();
        const httpContent = httpResponse.getContentText();
        if (httpCode !== 200) {
            let errorMsg = `OpenAI API Error (${httpCode})`;
            try {
                const errorPayload = JSON.parse(httpContent);
                errorMsg = errorPayload?.error?.message || httpContent;
            }
            catch (e) { /* Ignore if response is not JSON */ }
            log_('ERROR', 'callOpenAI_http_error', { httpCode, errorMsg });
            return { ok: false, error: errorMsg };
        }
        try {
            const json = JSON.parse(httpContent);
            const responseText = json.choices[0]?.message?.content?.trim();
            if (responseText) {
                return { ok: true, response: responseText };
            }
            log_('WARN', 'callOpenAI_response_malformed', { httpContent });
            return { ok: false, error: 'OpenAI response was valid JSON but missing expected content.' };
        }
        catch (jsonError) {
            // This is critical for debugging if OpenAI returns non-JSON text
            log_('ERROR', 'callOpenAI_json_parse_error', { error: jsonError.message, rawResponse: httpContent });
            return { ok: false, error: 'Failed to parse OpenAI response as JSON.' };
        }
    }
    catch (e) {
        log_('ERROR', 'callOpenAI_fetch_error', { error: e.message, stack: e.stack });
        return { ok: false, error: `API ERROR: Failed to get response from OpenAI. Details: ${e.message}` };
    }
}
