/*
 * Contains general utility functions for logging, spreadsheet interaction (read/append),
 * and core AI/settings retrieval.
 * (Blocks #2 and #3)
 */

// ========== TYPE DEFINITIONS ==========

type LogLevel = 'INFO' | 'WARN' | 'ERROR';

interface TableReadResult {
  ok: true;
  header: string[];
  rows: Record<string, any>[];
}

interface SuccessResult {
  ok: true;
}

interface ErrorResult {
  ok: false;
  error: string;
}

interface Settings {
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  [key: string]: any;
}

interface GetSettingsResult {
  ok: true;
  settings: Settings;
}

interface CallOpenAIResult {
  ok: true;
  response: string;
}

// ========== Block#2 — UTIL: Logging & Sheets ==========

function log_(level: LogLevel, evt: string, data: any): void {
  try {
    const row = [new Date(), level, evt, JSON.stringify(data || {}).slice(0, 3000)];
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ensureSheet_(ss, CFG_.LOG_SHEET, ['ts', 'level', 'evt', 'details']);
    sh.appendRow(row);
  } catch (e) {
    try {
      console.error('log_ fail: ' + (e as Error).message);
    } catch (_) {}
  }
}

function ensureSheet_(ss: GoogleAppsScript.Spreadsheet.Spreadsheet, name: string, header?: string[]): GoogleAppsScript.Spreadsheet.Sheet {
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    if (header && header.length) {
      sh.getRange(1, 1, 1, header.length).setValues([header]);
    }
  }
  return sh;
}

function readTable_(sheetName: string): TableReadResult | ErrorResult {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ensureSheet_(ss, sheetName);
    const rng = sh.getDataRange();
    const vals = rng.getValues();
    if (vals.length < 2) return { ok: true, header: vals[0] || [], rows: [] };
    const header = vals[0];
    const rows = vals.slice(1).map(r => Object.fromEntries(header.map((h, i) => [h, r[i]])));
    return { ok: true, header, rows };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

function appendRow_(sheetName: string, header: string[], obj: Record<string, any>): SuccessResult {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ensureSheet_(ss, sheetName, header);
  const row = header.map(h => obj[h] ?? '');
  sh.appendRow(row);
  return { ok: true };
}

// ========== Block#3 — UTIL: AI & Settings ==========

function getSettings_(): GetSettingsResult | ErrorResult {
  try {
    const cache = CacheService.getScriptCache();
    const CACHE_KEY = 'polaris_settings';
    const cached = cache.get(CACHE_KEY);
    if (cached) return { ok: true, settings: JSON.parse(cached) };

    const tblResult = readTable_(CFG_.SETTINGS_SHEET);
    if (!tblResult.ok) return tblResult;
    if (!tblResult.rows.length) {
      return { ok: false, error: 'Settings sheet is empty or unreadable.' };
    }

    const settings = tblResult.rows.reduce((acc: Settings, row) => {
      const k = row.key || row.Key;
      const v = row.value || row.Value;
      if (k) acc[k] = v;
      return acc;
    }, {});

    if (!settings.OPENAI_API_KEY || !settings.OPENAI_MODEL) {
      log_('WARN', 'getSettings_', 'OPENAI_API_KEY or OPENAI_MODEL missing from Settings');
    }

    cache.put(CACHE_KEY, JSON.stringify(settings), 600); // Cache for 10 mins
    return { ok: true, settings };
  } catch (e) {
    log_('ERROR', 'getSettings_', { err: (e as Error).message });
    return { ok: false, error: (e as Error).message };
  }
}

function callOpenAI_(systemPrompt: string, userText: string): CallOpenAIResult | ErrorResult {
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

    const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    };

    const httpResponse = UrlFetchApp.fetch(url, options);
    const httpCode = httpResponse.getResponseCode();
    const httpContent = httpResponse.getContentText();

    if (httpCode !== 200) {
      log_('ERROR', 'callOpenAI_', { httpCode, httpContent });
      return { ok: false, error: `OpenAI API Error ${httpCode}: ${httpContent.slice(0, 500)}` };
    }

    const json = JSON.parse(httpContent);
    const responseText = json.choices[0].message.content.trim();

    return { ok: true, response: responseText };
  } catch (e) {
    log_('ERROR', 'callOpenAI_', { err: (e as Error).message });
    return { ok: false, error: (e as Error).message };
  }
}