// FILE: /home/reuven007/northstar/01_Config_Global.ts
/*
 * Contains all global configuration objects and constants for Project Northstar.
 */

// ========== Block#1 — CONFIG ==========
const CFG_ = {
  SETTINGS_SHEET: 'Settings',
  HANDLERS_SHEET: 'Handlers',
  DATAAGENTS_SHEET: 'DataAgents',
  LOG_SHEET: 'Log',
  DEFAULT_AGENT: 'Default',
} as const;

// Configuration for persistent storage in the PendingActions sheet
const CFG_PENDING_ = {
    SHEET: 'PendingActions',
    HEADERS: ['ActionID', 'Timestamp', 'Status', 'HandlerKey', 'UserID', 'SpaceName', 'ActionPayload']
} as const;

// To make these variables available globally in the Apps Script environment after compilation,
// you can explicitly attach them to the `global` object.
(global as any).CFG_ = CFG_;
(global as any).CFG_PENDING_ = CFG_PENDING_;

// FILE: /home/reuven007/northstar/02_Utilities.ts
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

interface ParseAiJsonResult<T> {
  ok: true;
  data: T;
}

// ========== Block#1.5 — UTIL: AI Response Parsing ==========



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

/**
 * Safely parses a JSON object from a raw string, which may be wrapped in markdown.
 * @param rawText The raw string response from the AI.
 * @returns A result object with the parsed data or an error.
 */
function parseAiJson_<T>(rawText: string): ParseAiJsonResult<T> | ErrorResult {
  try {
    // 1. Clean the string: remove markdown fences, newlines, and trim whitespace.
    const cleanedText = rawText
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    const data = JSON.parse(cleanedText) as T;
    return { ok: true, data: data };
  } catch (e) {
    log_('ERROR', 'parseAiJson_', { rawText: rawText, err: (e as Error).message });
    return { ok: false, error: `Failed to parse AI response as JSON: ${(e as Error).message}` };
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
      } catch (e) { /* Ignore if response is not JSON */ }
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
    } catch (jsonError) {
      // This is critical for debugging if OpenAI returns non-JSON text
      log_('ERROR', 'callOpenAI_json_parse_error', { error: (jsonError as Error).message, rawResponse: httpContent });
      return { ok: false, error: 'Failed to parse OpenAI response as JSON.' };
    }
  } catch (e) {
    log_('ERROR', 'callOpenAI_fetch_error', { error: (e as Error).message, stack: (e as Error).stack });
    return { ok: false, error: `API ERROR: Failed to get response from OpenAI. Details: ${(e as Error).message}` };
  }
}

// FILE: /home/reuven007/northstar/03_Persistence.ts
// ========== Block#2.5 — UTIL: Pending Actions Storage ==========

/**
 * Stores a pending action in the sheet.
 * Returns {ok: true, message: '...'} or {ok: false, error: '...'}
 */
function pending_save_(actionId: string, handlerKey: string, userId: string, spaceName: string, payload: Record<string, any>): { ok: true } | ErrorResult {
    try {
        const rowData: PendingActionSchema = {
            ActionID: actionId,
            Timestamp: new Date(),
            Status: 'PENDING',
            HandlerKey: handlerKey,
            UserID: userId,
            SpaceName: spaceName,
            ActionPayload: JSON.stringify(payload)
        };

        // CFG_PENDING_ is defined in 01_Config_Global.ts
        appendRow_(CFG_PENDING_.SHEET, [...CFG_PENDING_.HEADERS], rowData);
        return { ok: true };
    } catch (e) {
        log_('ERROR', 'pending_save_', { err: (e as Error).message, actionId });
        return { ok: false, error: 'Failed to save action to sheet.' };
    }
}

/**
 * Retrieves and marks an action as COMPLETED/DELETED in the sheet.
 * Returns {ok: true, payload: {...}} or {ok: false, error: '...'}
 */
function pending_getAndExecute_(actionId: string): { ok: true, payload: Record<string, any> } | ErrorResult {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet(); 
        const sh = ensureSheet_(ss, CFG_PENDING_.SHEET, [...CFG_PENDING_.HEADERS]);
        const data = sh.getDataRange().getValues();

        const headerRow = data[0];
        const actionIdCol = headerRow.indexOf('ActionID');
        const statusCol = headerRow.indexOf('Status');
        const payloadCol = headerRow.indexOf('ActionPayload');

        if (actionIdCol === -1 || statusCol === -1 || payloadCol === -1) {
            throw new Error("PendingActions sheet missing required columns.");
        }

        for (let i = 1; i < data.length; i++) {
            if (data[i][actionIdCol] === actionId) {
                const status = data[i][statusCol];
                if (status !== 'PENDING') {
                    return { ok: false, error: `Action ${actionId} status is '${status}'. Cannot execute.` };
                }

                const payload = JSON.parse(data[i][payloadCol]);
                sh.getRange(i + 1, statusCol + 1).setValue('COMPLETED');

                return { ok: true, payload: payload };
            }
        }

        return { ok: false, error: 'Action ID not found or already completed.' };
    } catch (e) {
        log_('ERROR', 'pending_getAndExecute_', { err: (e as Error).message, actionId });
        return { ok: false, error: `Sheet read/write error: ${(e as Error).message}` };
    }
}

// FILE: /home/reuven007/northstar/04_Routing_NLP.ts
// ========== Block#4 — NLP Router (Query 1 - AI Powered) ==========

// ========== TYPE DEFINITIONS ==========

interface Handler {
  key: string;
  fn: string;
  desc: string;
  fallback: string;
}

interface GetHandlersResult {
  ok: true;
  handlers: Handler[];
}

interface NlpSuccessResult {
  ok: true;
  handler: string;
  debug: { chosenKey: string };
}

interface NlpErrorResult {
  ok: false;
  reason: 'handlers-not-found' | 'router-ai-error' | 'no-match' | 'router-exception';
  err?: string;
}

type NlpResult = NlpSuccessResult | NlpErrorResult;

/**
 * Caches the handler manifest (from Handlers sheet) for 10 mins.
 */
function getHandlerManifest_(): GetHandlersResult | ErrorResult {
  try {
    const cache = CacheService.getScriptCache();
    const CACHE_KEY = 'polaris_handlers';
    const cached = cache.get(CACHE_KEY);
    if (cached) return { ok: true, handlers: JSON.parse(cached) };

    const tblResult = readTable_(CFG_.HANDLERS_SHEET);
    if (!tblResult.ok || !tblResult.rows.length) {
      return { ok: false, error: 'Handlers sheet is empty or unreadable.' };
    }

    const handlers: Handler[] = tblResult.rows.map(r => ({
      key: r.HandlerKey || r.name,
      fn: r.GAS_Function || r.fnName,
      desc: r.Description || r.description,
      fallback: r.FallbackHelpText || r.fallback
    })).filter(h => h.key && h.fn);

    if (!handlers.length) {
      return { ok: false, error: 'No valid handlers found in Handlers sheet.' };
    }

    cache.put(CACHE_KEY, JSON.stringify(handlers), 600); // Cache for 10 mins
    return { ok: true, handlers: handlers };
  } catch (e) {
    log_('ERROR', 'getHandlerManifest_', { err: (e as Error).message });
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * AI-Powered Router (Query 1).
 * Uses OpenAI to pick the best specialist from the Handlers sheet.
 */
function nlpPickCommand_(text: string): NlpResult {
  try {
    const manifest = getHandlerManifest_();
    if (!manifest.ok) {
      return { ok: false, reason: 'handlers-not-found', err: manifest.error };
    }

    const toolList = manifest.handlers.map(h => `HandlerKey: ${h.key}\nDescription: ${h.desc}`).join('\n---\n');

    const systemPrompt = `You are a "Query 1" router. Your ONLY job is to analyze the user's text and choose the single best HandlerKey from the provided list.
You must respond with ONLY the chosen HandlerKey and nothing else.
For example, if the user says "help me", you will respond with "help".
If you cannot find a good match, you MUST respond with "general_chat".
Here is the list of available handlers:\n${toolList}`;

    const aiResult = callOpenAI_(systemPrompt, text);
    if (!aiResult.ok) {
      log_('ERROR', 'nlpPickCommand_AI_call', { err: aiResult.error });
      return { ok: false, reason: 'router-ai-error', err: aiResult.error };
    }

    const chosenHandlerKey = aiResult.response.trim().replace(/[."']/g, '');
    let chosenHandler = manifest.handlers.find(h => h.key === chosenHandlerKey);

    if (!chosenHandler) {
      log_('WARN', 'nlpPickCommand_AI_mismatch', { text: text, chosenKey: chosenHandlerKey });
      chosenHandler = manifest.handlers.find(h => h.key === 'general_chat');
      if (!chosenHandler) return { ok: false, reason: 'no-match' }; // Failsafe
    }

    return { ok: true, handler: chosenHandler.fn, debug: { chosenKey: chosenHandler.key } };
  } catch (e) {
    log_('ERROR', 'nlpPickCommand_', { err: (e as Error).message });
    return { ok: false, reason: 'router-exception', err: (e as Error).message };
  }
}

// FILE: /home/reuven007/northstar/05_Entrypoints.ts
// ========== Block#8.5 — Web App Entrypoint (doGet) ==========

/**
 * Handles GET requests from the approval hyperlink.
 */
function doGet(e: GoogleAppsScript.Events.DoGet): GoogleAppsScript.HTML.HtmlOutput {
  try {
    const { action, id, status, source } = e.parameter;

    // Route to the new, generic policy handler
    if (action === 'policy_response' && id && status && source) {
      cmd_HandlePolicyResponse_({ actionId: id, status, source });
      const friendlyStatus = status === 'APPROVED' ? 'Approved' : 'Rejected';
      return HtmlService.createHtmlOutput(`<h1>✅ Action ${friendlyStatus}</h1><p>Your decision has been recorded. You can now close this window.</p>`);
    }

    // Legacy handler for direct gmail send (can be deprecated)
    if (action === 'gmail_send_confirm' && id) {
      const cache = CacheService.getScriptCache();
      const cachedData = cache.get(id);
      cache.remove(id);

      if (!cachedData) {
        return HtmlService.createHtmlOutput('<h1>⏳ Action Expired</h1><p>The approval link has expired or was already used.</p>');
      }

      const cmd = JSON.parse(cachedData);
      const result = gmail_send_(cmd);

      if (result.ok) {
        return HtmlService.createHtmlOutput(`<h1>✅ Success!</h1><p>Email sent to **${cmd.to}** with subject: "${cmd.subject}".</p><p>You can now close this window.</p>`);
      } else {
        return HtmlService.createHtmlOutput(`<h1>❌ Execution Failed</h1><p>Error sending email: ${result.error}</p><p>Please inform the Polaris owner.</p>`);
      }
    }

    // Fallback for any other invalid link
    return HtmlService.createHtmlOutput('<h1>❌ Invalid Link</h1><p>The link is malformed or the action is not recognized.</p>');

  } catch (error) {
    log_('ERROR', 'doGet_exception', { err: (error as Error).message, params: e.parameter });
    return HtmlService.createHtmlOutput('<h1>🚨 Critical Server Error</h1><p>An unexpected error occurred during execution.</p>');
  }
}

// ========== Block#9 — Add-on Event Entrypoints ==========

function resolveHandlerFn_(name: string): Function | null {
  const n = String(name || '');
  const globalScope = globalThis as any;
  if (typeof globalScope[n] === 'function') return globalScope[n];
  if (n.endsWith('_') && typeof globalScope[n.slice(0, -1)] === 'function') return globalScope[n.slice(0, -1)];
  if (!n.endsWith('_') && typeof globalScope[n + '_'] === 'function') return globalScope[n + '_'];
  return null;
}

function onMessage(event: GoogleAppsScript.Events.ChatEvent) {
  try {
    const text = (event.message?.text || '').trim();

    const route = nlpPickCommand_(text);

    log_('INFO', 'nlpPickCommand_decision', {
      text: text,
      decision: route.ok ? route.debug : route
    });

    if (!route.ok) {
      const userErr = route.reason === 'no-match' ? `🤖 Echo: ${text}` : `Router error: ${route.reason}`;
      return hostReply_({ text: userErr });
    }

    const fn = resolveHandlerFn_(route.handler);
    if (!fn) return hostReply_({ text: `Handler not found: ${route.handler}` });

    const out = fn({ text }); // Specialist runs

    if (out.ok && out.card) {
      return hostReply_({ cardsV2: [out.card] });
    }

    const reply = (out && out.message) || JSON.stringify(out);
    return hostReply_({ text: reply });
  } catch (e) {
    log_('ERROR', 'onMessage', { err: (e as Error).message });
    return hostReply_({ text: '⚠️ Error handling your message.' });
  }
}

/**
 * Host reply builder. Handles text OR cardsV2.
 */
function hostReply_(reply: { text: string } | { cardsV2: any[] }) {
  return {
    actionResponse: {
      type: 'NEW_MESSAGE',
      message: reply
    }
  };
}

/**
 * Entrypoint for all card clicks.
 */
function onCardClick(event: GoogleAppsScript.Events.ChatEvent) {
  try {
    // Assuming handleCardClick_ exists and is typed elsewhere
    return (globalThis as any).handleCardClick_(event);
  } catch (e) {
    log_('ERROR', 'onCardClick_entry', { err: (e as Error).message, event: event });
    return {
      actionResponse: {
        type: 'REQUEST_CONFIG',
        dialogAction: {
          dialog: {
            body: {
              text: `Error handling click: ${(e as Error).message}`
            }
          }
        }
      }
    };
  }
}

function onAddedToSpace(event: GoogleAppsScript.Events.ChatEvent) {
  try {
    return hostReply_({ text: '👋 Polaris PoC ready. Try: "add milk to HomeErrands" or "list HomeErrands"' });
  } catch (e) {
    return hostReply_({ text: '👋 Ready.' });
  }
}

function onRemovedFromSpace(event: GoogleAppsScript.Events.ChatEvent) {
  log_('INFO', 'onRemovedFromSpace', {});
}

/**
 * STUB for handling card clicks.
 * This function will be implemented to handle interactive card elements.
 */
function handleCardClick_(event: GoogleAppsScript.Events.ChatEvent): any {
  log_('INFO', 'handleCardClick_', { event });
  // Placeholder response
  return { actionResponse: { type: 'UPDATE_MESSAGE', message: { text: 'Card click received!' } } };
}

// FILE: /home/reuven007/northstar/06_Specialist_Sheet.ts
// ========== Block#5 — Specialist: Sheets (Query 2) ==========

function cmd_HandleSheetData_(params: SpecialistParams): SpecialistResult {
  try {
    const text = params.text || '';
    const addMatch = text.match(/add\s+(.*)\s+to\s+([\w-]+)/i);
    const listMatch = text.match(/list\s+([\w-]+)/i);

    const agentsTblResult = readTable_(CFG_.DATAAGENTS_SHEET);
    const agentsTbl = (agentsTblResult.ok && agentsTblResult.rows) ? agentsTblResult.rows : [];

    const getAgentRowByName = (name: string) => {
      const n = String(name || '').toLowerCase();
      return agentsTbl.find(r =>
        String(r.agentName || r.AgentName || '').toLowerCase() === n
      );
    };

    if (addMatch) {
      const item = addMatch[1].trim();
      const agentName = addMatch[2].trim();
      const row = getAgentRowByName(agentName);
      const sheetName = row ? (row.sheetName || row.SheetName || agentName) : agentName;
      const header = ['ts', 'item'];
      appendRow_(sheetName, header, { ts: new Date(), item });
      return { ok: true, message: `✅ Added to ${sheetName}: ${item}` };
    }

    if (listMatch) {
      const agentName = listMatch[1].trim();
      const row = getAgentRowByName(agentName);
      const sheetName = row ? (row.sheetName || row.SheetName || agentName) : agentName;
      const tbl = readTable_(sheetName);
      const items = (tbl.ok && tbl.rows) ? tbl.rows.map(r => `• ${r.item || JSON.stringify(r)}`).slice(0, 20) : [];
      return { ok: true, message: items.length ? `📋 ${sheetName}\n` + items.join('\n') : `📭 No items in ${sheetName}.` };
    }

    return { ok: false, message: `I can add/list items.\nTry: 'add milk to HomeErrands' or 'list HomeErrands'` };
  } catch (e) {
    log_('ERROR', 'cmd_HandleSheetData_', { err: (e as Error).message });
    return { ok: false, message: '⚠️ Sheet handler error.' };
  }
}

// FILE: /home/reuven007/northstar/07_Specialist_Chat.ts
// ========== Block#6 — Specialists: Help, Chat, Search ==========

/**
 * Handles 'help' requests. Dynamically lists available handlers.
 */
function cmd_Help_(params: SpecialistParams): SpecialistResult {
  try {
    const tblResult = readTable_(CFG_.HANDLERS_SHEET);
    if (!tblResult.ok || !tblResult.rows.length) {
      return { ok: false, message: '⚠️ Cannot read handlers from sheet.' };
    }

    const commands = tblResult.rows.map(r => {
      const key = r.HandlerKey || r.name;
      const desc = r.Description || r.description || 'No description.';
      return `• **${key}**: ${desc}`;
    }).join('\n');

    return { ok: true, message: `Here's what I can do:\n${commands}` };
  } catch (e) {
    log_('ERROR', 'cmd_Help_', { err: (e as Error).message });
    return { ok: false, message: '⚠️ Error getting help.' };
  }
}

/**
 * Handles 'general_chat' requests using Query 2 (OpenAI).
 * Fetches context from the 'Default' agent in DataAgents.
 */
function cmd_GeneralChat_(params: SpecialistParams): SpecialistResult {
  try {
    const text = params.text || '';
    const agentsTblResult = readTable_(CFG_.DATAAGENTS_SHEET);

    let instructions = 'You are a helpful assistant.'; // Hardcoded fallback

    if (agentsTblResult.ok && agentsTblResult.rows.length) {
      const defaultAgent = agentsTblResult.rows.find(r =>
        String(r.agentName || r.AgentName || '').toLowerCase() === CFG_.DEFAULT_AGENT.toLowerCase()
      );
      if (defaultAgent) {
        const agentInstructions = defaultAgent.Instructions || defaultAgent.instructions;
        if (agentInstructions) instructions = agentInstructions;
      }
    }

    const aiResult = callOpenAI_(instructions, text);

    if (!aiResult.ok) {
      return { ok: false, message: `⚠️ AI Error: ${aiResult.error}` };
    }

    return { ok: true, message: aiResult.response };
  } catch (e) {
    log_('ERROR', 'cmd_GeneralChat_', { err: (e as Error).message });
    return { ok: false, message: '⚠️ General chat error.' };
  }
}

/**
 * STUB for 'handle_web_search'.
 */
function cmd_HandleWebSearch_(params: SpecialistParams): SpecialistResult {
  return {
    ok: false,
    message: '🤖 Web search is not implemented yet. We need to add a Search API (like Google Custom Search) first.'
  };
}

// FILE: /home/reuven007/northstar/08_Specialist_Cal.ts
// ========== Block#7 — Specialists: Calendar (Query 2) ==========

// ========== TYPE DEFINITIONS ==========

interface CalendarReadCommand {
  action: 'read';
  start: string;
  end: string;
  reply_lang?: Language;
}

interface CalendarCreateCommand {
  action: 'create';
  title: string;
  start: string;
  end: string;
  reply_lang?: Language;
}

type CalendarCommand = CalendarReadCommand | CalendarCreateCommand;

/**
 * Helper function to get the fallback help text for this specialist.
 */
function getCalendarHelp_(): string {
  try {
    const manifest = getHandlerManifest_();
    if (!manifest.ok) return 'An error occurred.';

    const calHandler = manifest.handlers.find(h => h.key === 'handle_calendar');
    const fallbackMsg = (calHandler && calHandler.fallback)
      ? calHandler.fallback
      : 'Please be more specific. I may need a date, time, and title.'; // Hardcoded failsafe

    return `⚠️ ${fallbackMsg}`;
  } catch (e) {
    return '⚠️ To manage your calendar, please tell me what you want to do and when.';
  }
}

/**
 * Helper function to build a permalink for a Google Calendar event.
 */
function calendar_buildEventLink_(event: GoogleAppsScript.Calendar.CalendarEvent): string {
  try {
    const calId = event.getOriginalCalendarId();
    const eventId = event.getId().split('@')[0];
    const b64_eid = Utilities.base64Encode(`${eventId} ${calId}`);
    return `https://www.google.com/calendar/event?eid=${b64_eid}`;
  } catch (e) {
    log_('ERROR', 'calendar_buildEventLink_', { err: (e as Error).message });
    return '';
  }
}

/**
 * Helper function to read calendar events.
 */
function calendar_read_(cmd: CalendarReadCommand): SpecialistResult {
  try {
    const { start, end, reply_lang: lang = 'en' } = cmd;
    const cal = CalendarApp.getDefaultCalendar();
    if (!cal) return { ok: false, message: "⚠️ Could not find default calendar." };

    const startTime = new Date(start);
    const endTime = new Date(end);
    const events = cal.getEvents(startTime, endTime);
    const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();

    if (!events.length) {
      const startStr = Utilities.formatDate(startTime, tz, "MMM d");
      const endStr = Utilities.formatDate(endTime, tz, "MMM d");
      const rangeStr = (startStr === endStr) ? startStr : `${startStr} to ${endStr}`;
      const message = lang === 'he' ? `🗓️ לא נמצאו אירועים עבור ${rangeStr}.` : `🗓️ No events found for ${rangeStr}.`;
      return { ok: true, message };
    }

    if (events.length === 1) {
      const event = events[0];
      const title = event.getTitle();
      let startStr = event.isAllDayEvent() ? (lang === 'he' ? '(כל היום)' : '(All Day)') : Utilities.formatDate(event.getStartTime(), tz, "h:mm a");
      const link = calendar_buildEventLink_(event);
      const linkText = lang === 'he' ? 'פתח ביומן' : 'Open in Calendar';
      const message = lang === 'he'
        ? `נמצא אירוע 1:\n• *${title}* [${startStr}] ${linkText}`
        : `Found 1 event:\n• *${title}* [${startStr}] ${linkText}`;
      return { ok: true, message };
    }

    const summaries = events.map(e => {
      const title = e.getTitle();
      let startStr = e.isAllDayEvent() ? (lang === 'he' ? '(כל היום)' : '(All Day)') : Utilities.formatDate(e.getStartTime(), tz, "h:mm a");
      const link = calendar_buildEventLink_(e);
      const linkText = lang === 'he' ? 'קישור' : 'link';
      return `• *${title}* [${startStr}] [[${linkText}]](${link})`;
    });

    const message = lang === 'he'
      ? `נמצאו ${summaries.length} אירועים:\n${summaries.join('\n')}`
      : `Found ${summaries.length} events:\n${summaries.join('\n')}`;
    return { ok: true, message };
  } catch (e) {
    log_('ERROR', 'calendar_read_', { err: (e as Error).message, cmd });
    return { ok: false, message: `⚠️ Error reading calendar events: ${(e as Error).message}` };
  }
}

/**
 * Helper function to create a calendar event.
 */
function calendar_create_(cmd: CalendarCreateCommand): SpecialistResult {
  try {
    const { title, start, end, reply_lang: lang = 'en' } = cmd;
    if (!title || !start || !end) return { ok: false, message: getCalendarHelp_() };

    const cal = CalendarApp.getDefaultCalendar();
    const startTime = new Date(start);
    const endTime = new Date(end);
    const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
    const event = cal.createEvent(title, startTime, endTime);

    const startTimeStr = Utilities.formatDate(startTime, tz, "h:mm a");
    const startDateStr = Utilities.formatDate(startTime, tz, "MMM d, yyyy");

    const message = lang === 'he'
      ? `✅ אירוע נוצר בהצלחה: *${event.getTitle()}* ב-${startDateStr} בשעה ${startTimeStr}.`
      : `✅ Event created successfully: *${event.getTitle()}* on ${startDateStr} at ${startTimeStr}.`;
    return { ok: true, message };
  } catch (e) {
    log_('ERROR', 'calendar_create_', { err: (e as Error).message, cmd });
    return { ok: false, message: `⚠️ Error creating calendar event: ${(e as Error).message}` };
  }
}

/**
 * Handles 'handle_calendar' requests using Query 2 (OpenAI).
 */
function cmd_HandleCalendar_(params: SpecialistParams): SpecialistResult {
  try {
    const text = params.text || '';
    const now = new Date();
    const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
    const todayISO = Utilities.formatDate(now, tz, "yyyy-MM-dd'T'HH:mm:ss");

    const systemPrompt = `You are a "Query 2" Calendar specialist...`; // Prompt omitted for brevity

    const aiResult = callOpenAI_(systemPrompt, text);
    if (!aiResult.ok) {
      log_('ERROR', 'cmd_HandleCalendar_AI_call', { err: aiResult.error });
      return { ok: false, message: getCalendarHelp_() };
    }

    const parseResult = parseAiJson_<CalendarCommand>(aiResult.response);
    if (!parseResult.ok) {
      log_('ERROR', 'cmd_HandleCalendar_json_parse', { response: aiResult.response, err: parseResult.error });
      return { ok: false, message: getCalendarHelp_() };
    }

    const cmd = parseResult.data;
    if (!cmd || !cmd.action) return { ok: false, message: getCalendarHelp_() };

    log_('INFO', 'cmd_HandleCalendar_cmd', { cmd });

    switch (cmd.action) {
      case 'read': return calendar_read_(cmd);
      case 'create': return calendar_create_(cmd);
      default:
        log_('WARN', 'cmd_HandleCalendar_unknown_action', { cmd });
        return { ok: false, message: getCalendarHelp_() };
    }
  } catch (e) {
    log_('ERROR', 'cmd_HandleCalendar_', { err: (e as Error).message });
    return { ok: false, message: '⚠️ Calendar handler error.' };
  }
}

/**
 * STUB for 'handle_tasks'.
 */
function cmd_HandleTasks_(params: SpecialistParams): SpecialistResult {
  const text = params.text || '';
  return { ok: true, message: `🤖 **Tasks Stub:** I will soon handle: "${text}"` };
}

// FILE: /home/reuven007/northstar/09_Specialist_Gmail.ts
// ========== Block#8 — Specialist: Gmail (Query 2) ==========

// ========== TYPE DEFINITIONS ==========

interface GmailReadCommand {
  action: 'read';
  query: string;
  count: number;
  reply_lang?: Language;
}

interface GmailDraftCommand {
  action: 'draft';
  to: string;
  subject: string;
  body: string;
  reply_lang?: Language;
}

type GmailCommand = GmailReadCommand | GmailDraftCommand;

/**
 * Helper function to get the fallback help text for this specialist.
 */
function getGmailHelp_(): string {
  try {
    const manifest = getHandlerManifest_();
    if (!manifest.ok) return 'An error occurred.';

    const gmailHandler = manifest.handlers.find(h => h.key === 'handle_gmail');
    return `⚠️ ${gmailHandler?.fallback || 'Please be more specific. I may need a recipient, subject, and body.'}`;
  } catch (e) {
    return '⚠️ To help with email, please be specific. For drafts, I need a recipient, subject, and body.';
  }
}

/**
 * Helper function to read Gmail threads based on a query.
 */
function gmail_read_(cmd: GmailReadCommand): SpecialistResult {
  try {
    const { query, count, reply_lang: lang = 'en' } = cmd;
    const num = Math.min(Math.max(count || 3, 1), 10);
    const threads = GmailApp.search(query, 0, num);

    if (!threads.length) {
      const message = lang === 'he' ? `📭 לא נמצאו אימיילים עבור השאילתה: "${query}"` : `📭 No emails found for query: "${query}"`;
      return { ok: true, message };
    }

    if (threads.length === 1) {
      const thread = threads[0];
      const subject = thread.getFirstMessageSubject();
      const from = thread.getMessages()[0].getFrom().split('<')[0].trim();
      const link = thread.getPermalink();
      const linkText = lang === 'he' ? 'פתח ב-Gmail' : 'Open in Gmail';
      const message = lang === 'he'
        ? `נמצא אימייל 1:\n• *${subject}* (מאת ${from}) ${linkText}`
        : `Found 1 email:\n• *${subject}* (from ${from}) ${linkText}`;
      return { ok: true, message };
    }

    const summaries = threads.map(t => {
      const subject = t.getFirstMessageSubject();
      const from = t.getMessages()[0].getFrom().split('<')[0].trim();
      const fromText = lang === 'he' ? 'מאת' : 'from';
      return `• *${subject}* (${fromText} ${from})`;
    });

    const message = lang === 'he'
      ? `נמצאו ${summaries.length} אימיילים:\n${summaries.join('\n')}`
      : `Found ${summaries.length} emails:\n${summaries.join('\n')}`;
    return { ok: true, message };
  } catch (e) {
    log_('ERROR', 'gmail_read_', { err: (e as Error).message, query: cmd.query });
    return { ok: false, message: `⚠️ Error reading emails: ${(e as Error).message}` };
  }
}

/**
 * Helper function to SEND a Gmail email.
 */
function gmail_send_(cmd: { to: string, subject: string, body: string, reply_lang?: Language }): { ok: boolean, message?: string, error?: string } {
  try {
    const { to, subject, body, reply_lang: lang = 'en' } = cmd;
    if (!to || !subject || !body) return { ok: false, error: 'Missing to, subject, or body' };

    GmailApp.sendEmail(to, subject, body);
    const successMsg = lang === 'he' ? `✅ נשלח בהצלחה אל: ${to}` : `✅ Successfully sent to: ${to}`;
    return { ok: true, message: successMsg };
  } catch (e) {
    log_('ERROR', 'gmail_send_', { err: (e as Error).message });
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Handles 'handle_gmail' requests using Query 2 (OpenAI).
 */
function cmd_HandleGmail_(params: SpecialistParams): SpecialistResult {
  try {
    const text = params.text || '';
    const systemPrompt = `You are a "Query 2" Gmail specialist. Your ONLY job is to convert the user's request into a single, valid JSON command.

You must respond with ONLY the JSON object and nothing else.
You must choose one of the following actions: "read" or "draft".
You MUST also include a "reply_lang" key set to the detected language of the user's prompt (e.g., "en", "he").

1.  **"read" action**:
    *   User: "show me my last 3 unread emails from 'hello@world.com'"
        -> {"action": "read", "query": "is:unread from:hello@world.com", "count": 3, "reply_lang": "en"}

2.  **"draft" action**:
    *   User: "draft an email to reuven007@gmail.com with the subject 'Polaris Test Draft' and the body 'This is a test message.'"
        -> {"action": "draft", "to": "reuven007@gmail.com", "subject": "Polaris Test Draft", "body": "This is a test message.", "reply_lang": "en"}
    *   User: "שלח מייל ל-test@example.com עם נושא 'בדיקה' ותוכן 'זוהי הודעת בדיקה'"
        -> {"action": "draft", "to": "test@example.com", "subject": "בדיקה", "body": "זוהי הודעת בדיקה", "reply_lang": "he"}

If any required field for a draft (to, subject, body) is missing from the user's text, you MUST return that field as null in the JSON.
For example, if the user says "draft an email to bob":
-> {"action": "draft", "to": "bob", "subject": null, "body": null, "reply_lang": "en"}`;

    const aiResult = callOpenAI_(systemPrompt, text);
    if (!aiResult.ok) {
      log_('ERROR', 'cmd_HandleGmail_AI_call', { err: aiResult.error });
      return { ok: false, message: getGmailHelp_() };
    }

    const parseResult = parseAiJson_<GmailCommand>(aiResult.response);
    if (!parseResult.ok) {
      log_('ERROR', 'cmd_HandleGmail_json_parse', { response: aiResult.response, err: parseResult.error });
      return { ok: false, message: getGmailHelp_() };
    }

    const cmd = parseResult.data;
    if (!cmd || !cmd.action) return { ok: false, message: getGmailHelp_() };

    log_('INFO', 'cmd_HandleGmail_cmd', { cmd });

    switch (cmd.action) {
      case 'read':
        return gmail_read_(cmd);
      case 'draft':
        const { to, subject, body, reply_lang: lang = 'en' } = cmd;
        if (!to || !subject || !body) return { ok: false, message: getGmailHelp_() };
        const pendingActionId = `gmail-send-${Utilities.getUuid()}`;
        CacheService.getScriptCache().put(pendingActionId, JSON.stringify(cmd), 300);
        const approvalUrl = `${ScriptApp.getService().getUrl()}?action=gmail_send_confirm&id=${pendingActionId}`;
        const linkText = lang === 'he' ? 'לחץ כאן לשליחה מיידית' : 'CLICK HERE TO SEND NOW';
        const message = `*Gmail Approval Needed*\n> **To:** ${to}\n> **Subject:** ${subject}\n\n${linkText}`;
        return { ok: true, message: message };
      default:
        log_('WARN', 'cmd_HandleGmail_unknown_action', { cmd });
        return { ok: false, message: getGmailHelp_() };
    }
  } catch (e) {
    log_('ERROR', 'cmd_HandleGmail_', { err: (e as Error).message });
    return { ok: false, message: '⚠️ Gmail handler error.' };
  }
}

// FILE: /home/reuven007/northstar/10_Dev_Tools.ts
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
function authorize_(): void {
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
  } catch (e) {
    Logger.log(`⚠️ Authorization Error: ${(e as Error).message}. This is normal if you haven't granted permissions yet. Please follow the pop-up flow.`);
  }
}

/**
 * MANUAL RUNNER (The "Thin Wrapper" fix)
 */
function RUN_THIS_TO_AUTHORIZE_(): void {
  authorize_();
}

// ========== Block#12 — UI & SHEET TRIGGERS ==========

/**
 * Helper function to generate a HTML table from the 'Codebase' sheet data.
 */
function buildCodebaseHtml_(): string {
  try {
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Codebase');
    if (!sh) return '<p>Codebase sheet not found.</p>';

    const data = sh.getDataRange().getValues();
    if (data.length === 0) return '<p>Codebase is empty.</p>';

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
  } catch (e) {
    console.error('Error loading codebase table:', (e as Error).message);
    return 'Error loading codebase table.';
  }
}

function showCodebaseTable(): void {
  const htmlOutput = HtmlService.createHtmlOutput(buildCodebaseHtml_()).setTitle('Polaris Project Codebase');
  SpreadsheetApp.getUi().showSidebar(htmlOutput);
}

// FILE: /home/reuven007/northstar/11_Governance.ts
/*
 * Contains the core governance logic for handling policy-driven action
 * confirmations and the final execution handlers.
 * (Blocks #13, #14, #15)
 */

// ========== Block#13 — GOVERNANCE: Core Handler ==========

/**
 * Handles the user's decision from the confirmation URL. This is the
 * entry point for Phase 3 (Governance) and is called by doGet(e).
 *
 * @param {object} params The parameters from the URL.
 * @param {string} params.actionId The unique ID of the pending action.
 * @param {string} params.status The decision ('APPROVED' or 'REJECTED').
 * @param {string} params.source The original source of the request (e.g., Chat space).
 */
function cmd_HandlePolicyResponse_({ actionId, status, source }: { actionId: string; status: string; source: string }): void {
  const SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!SPREADSHEET_ID) {
    Logger.log('ERROR: SPREADSHEET_ID is not set in Script Properties.');
    // Attempt to send feedback even on configuration error if a source is present
    if (source) {
      util_SendChatMessageText_(source, '🚨 Configuration Error: The system is missing the SPREADSHEET_ID property.');
    }
    return;
  }

  try {
    // Step 1: Look up the pending action record.
    const { record, rowIndex, headers } = util_getPendingAction_(actionId, SPREADSHEET_ID);

    if (!record) {
      Logger.log(`WARN: Action ID [${actionId}] not found. The link may have expired or been used already.`);
      util_SendChatMessageText_(source, 'The approval link has expired or was already used.');
      return;
    }

    // Prevent double execution.
    if (record.Status !== 'PENDING') {
      Logger.log(`WARN: Action ID [${actionId}] has status [${record.Status}] and is not PENDING. No action taken.`);
      util_SendChatMessageText_(source, `This action was already processed with status: ${record.Status}.`);
      return;
    }

    // Step 2: Update the status in the 'PendingActions' sheet.
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(CFG_PENDING_.SHEET);
    const statusColIndex = headers.indexOf('Status') + 1;
    if (sheet && statusColIndex > 0) {
      sheet.getRange(rowIndex, statusColIndex).setValue(status);
      SpreadsheetApp.flush(); // Ensure the write is committed.
    } else {
      throw new Error(`Could not find 'Status' column or '${CFG_PENDING_.SHEET}' sheet to update.`);
    }

    let feedbackMessage = '';

    // Step 3: Execute or reject the action.
    if (status === 'APPROVED') {
      Logger.log(`Action [${actionId}] APPROVED. Executing handler: ${record.HandlerKey}`);
      const payload = JSON.parse(record.ActionPayload as string);

      // Dynamically call the final execution function.
      // `globalThis` refers to the global scope in Apps Script.
      const handler = (globalThis as any)[record.HandlerKey];
      if (typeof handler === 'function') {
        handler(payload); // Correctly call the function with its payload
        Logger.log(`Successfully executed handler [${record.HandlerKey}] for action [${actionId}].`);
        feedbackMessage = `✅ Action Approved: The '${record.HandlerKey}' action has been completed.`;
      } else {
        throw new Error(`Execution handler [${record.HandlerKey}] not found.`);
      }
    } else {
      // status === 'REJECTED'
      Logger.log(`Action [${actionId}] REJECTED by user.`);
      feedbackMessage = `❌ Action Rejected: The '${record.HandlerKey}' action was cancelled.`;
    }

    // Step 4: Send final feedback to the user in Google Chat.
    util_SendChatMessageText_(source, feedbackMessage);

  } catch (e) {
    const error = e as Error;
    Logger.log(`ERROR in cmd_HandlePolicyResponse_: ${error.message} \n${error.stack}`);
    // Notify user of failure if possible.
    util_SendChatMessageText_(source, `🚨 An error occurred while processing your request: ${error.message}`);
  }
}

// ========== Block#14 — GOVERNANCE: Final Action Executors ==========

/**
 * Final executor for creating a Gmail draft. This is the end of the chain.
 *
 * @param {object} payload The action payload from the policy record.
 * @param {string} payload.to The recipient's email address.
 * @param {string} payload.subject The email subject.
 * @param {string} payload.body The email body.
 * @returns {{ok: boolean}} A standard success object.
 */
function cmd_ExecuteEmailDraft_(payload: { to: string; subject: string; body: string }): { ok: boolean } {
  GmailApp.createDraft(payload.to, payload.subject, payload.body);
  Logger.log(`Email draft created for [${payload.to}] with subject "${payload.subject}".`);
  return { ok: true };
}

// ========== Block#15 — UTIL: Governance & Chat Helpers ==========

/**
 * Retrieves a pending action record from the 'PendingActions' sheet
 * and returns it as a structured object.
 *
 * @param {string} actionId The ActionID to look up.
 * @param {string} spreadsheetId The ID of the spreadsheet.
 * @returns {{record: Record<string, any> | null, rowIndex: number, headers: string[]}} The found record, its row index, and headers.
 */
function util_getPendingAction_(actionId: string, spreadsheetId: string): { record: Record<string, any> | null; rowIndex: number; headers: string[] } {
  const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(CFG_PENDING_.SHEET);
  if (!sheet) {
    Logger.log(`ERROR: '${CFG_PENDING_.SHEET}' sheet not found.`);
    return { record: null, rowIndex: -1, headers: [] };
  }

  const data = sheet.getDataRange().getValues();
  if (data.length < 1) {
    Logger.log(`WARN: '${CFG_PENDING_.SHEET}' is empty.`);
    return { record: null, rowIndex: -1, headers: [] };
  }

  const headers = data[0].map(h => String(h));
  const actionIdColIndex = headers.indexOf('ActionID');

  if (actionIdColIndex === -1) {
    Logger.log(`ERROR: 'ActionID' column not found in '${CFG_PENDING_.SHEET}' sheet.`);
    return { record: null, rowIndex: -1, headers: [] };
  }

  for (let i = 1; i < data.length; i++) {
    if (data[i][actionIdColIndex] === actionId) {
      const record = headers.reduce((obj, header, index) => {
        obj[header] = data[i][index];
        return obj;
      }, {} as Record<string, any>);

      return { record, rowIndex: i + 1, headers };
    }
  }

  Logger.log(`INFO: Action ID [${actionId}] not found in '${CFG_PENDING_.SHEET}' sheet.`);
  return { record: null, rowIndex: -1, headers: [] };
}

/**
 * Placeholder utility to send a simple text message to a Google Chat space.
 *
 * @param {string} spaceName The resource name of the Chat space (e.g., 'spaces/AAAA...').
 * @param {string} text The plain text message to send.
 */
function util_SendChatMessageText_(spaceName: string, text: string): void {
  // This is a simplified placeholder. A real implementation would use the
  // Google Chat API (Advanced Service) for more robust messaging.
  Logger.log(`Simulating message to Chat space [${spaceName}]: "${text}"`);
  // Example using Chat advanced service (if enabled):
  // if (spaceName && text) {
  //   Chat.Spaces.Messages.create({ text: text }, spaceName);
  // }
}

// FILE: /home/reuven007/northstar/index.ts
/**
 * Creates a custom menu in the Google Sheet UI when the sheet is opened..
 */
function onOpen(): void {
  try {
    SpreadsheetApp.getUi()
        .createMenu('🤖 Polaris Agent (TS)')
        .addItem('Say Hello', 'sayHello')
        .addToUi();
  } catch (e) {
    console.error('onOpen failed: Likely non-UI context or permission issue.', (e as Error).message);
  }
}

function sayHello(): void {
  SpreadsheetApp.getUi().alert('Hello from TypeScript!');
}

// FILE: /home/reuven007/northstar/types.d.ts
/**
 * This file contains shared type definitions used across the project.
 * It is a declaration file, so it only contains type information and
 * does not produce any JavaScript output.
 */

declare namespace GoogleAppsScript {
  namespace Events {
    // The built-in ChatEvent is not comprehensive. This extends it.
    interface ChatEvent {
      message?: {
        text?: string;
        [key: string]: any;
      };
      [key: string]: any;
    }
  }
}

/**
 * Shared type for language preference.
 */
type Language = 'en' | 'he';

/**
 * The standard input for any "Specialist" function.
 */
interface SpecialistParams {
  text: string;
  [key: string]: any;
}

/**
 * The standard return structure for any "Specialist" function.
 */
interface SpecialistResult {
  ok: boolean;
  message: string;
  card?: any;
}

/**
 * Represents the data structure for a row in the 'PendingActions' sheet.
 */
interface PendingActionSchema {
  ActionID: string;
  Timestamp: Date | string;
  Status: 'PENDING' | 'COMPLETED' | 'DELETED';
  HandlerKey: string;
  UserID: string;
  SpaceName: string;
  ActionPayload: string; // A stringified JSON object
}
