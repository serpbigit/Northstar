// ---------------------------------------------------------------------------------
// FILE: 02_OpenAIClient.ts
// PURPOSE: Handles settings retrieval and the secure external call to the OpenAI API.
// ---------------------------------------------------------------------------------

// NOTE: This file depends on CFG_, log_(), and readTable_() from 01_ConfigAndUtils.ts

/**
 * Gets key-value pairs from the Settings sheet.
 * Caches settings for 10 minutes to reduce Sheet API calls (CacheService is a shared resource).
 * @returns {object} {ok: true, settings: object} or {ok: false, error: string}
 */
function getSettings_() {
  try {
    const cache = CacheService.getScriptCache();
    const CACHE_KEY = 'polaris_settings';
    const cached = cache.get(CACHE_KEY);
    if (cached) return { ok: true, settings: JSON.parse(cached) };

    const tbl = readTable_(CFG_.SETTINGS_SHEET);
    if (!tbl.ok || !tbl.rows.length) {
      return { ok: false, error: 'Settings sheet is empty or unreadable.' };
    }

    // Assumes Settings sheet has 'Key' and 'Value' columns
    const settings = tbl.rows.reduce((acc, row) => {
      // Tolerate different header casing (key/Key, value/Value)
      const k = row.Key || row.key; 
      const v = row.Value || row.value;
      if (k) acc[k] = v;
      return acc;
    }, {});
    
    // Check for essential keys before caching
    if (!settings.OPENAI_API_KEY || !settings.OPENAI_MODEL) {
       log_('WARN', 'getSettings_', 'OPENAI_API_KEY or OPENAI_MODEL missing from Settings');
    }

    // Cache for 10 minutes (600 seconds)
    cache.put(CACHE_KEY, JSON.stringify(settings), 600); 
    return { ok: true, settings };
  } catch (e) {
    log_('ERROR', 'getSettings_', { err: e.message });
    return { ok: false, error: e.message };
  }
}

/**
 * Calls the OpenAI Chat Completions API using UrlFetchApp.
 * This is the core intelligence call for both Query 1 (Router) and Query 2 (Specialist).
 * @param {string} systemPrompt The system-level instruction for the AI.
 * @param {string} userText The user's input text.
 * @returns {object} {ok: true, response: string} or {ok: false, error: string}
 */
function callOpenAI_(systemPrompt, userText) {
  try {
    // 1. Get API Key and Model from settings
    const settingsData = getSettings_();
    if (!settingsData.ok) {
      return { ok: false, error: `Failed to get settings: ${settingsData.error}` };
    }
    
    const { OPENAI_API_KEY, OPENAI_MODEL } = settingsData.settings;
    if (!OPENAI_API_KEY || !OPENAI_MODEL) {
      return { ok: false, error: 'OPENAI_API_KEY or OPENAI_MODEL is not set in the Settings sheet.' };
    }

    // 2. Prepare the HTTP request payload and options
    const url = 'https://api.openai.com/v1/chat/completions';
    const payload = {
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userText }
      ],
      max_tokens: 1024,
      temperature: 0.7,
    };
    
    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true, // IMPORTANT for robust error handling
    };

    // 3. Execute the external request
    const httpResponse = UrlFetchApp.fetch(url, options);
    const httpCode = httpResponse.getResponseCode();
    const httpContent = httpResponse.getContentText();

    // 4. Handle non-200 HTTP errors
    if (httpCode !== 200) {
      log_('ERROR', 'callOpenAI_', { httpCode, httpContent: httpContent.slice(0, 500) });
      return { ok: false, error: `OpenAI API Error ${httpCode}: ${httpContent.slice(0, 500)}` };
    }

    // 5. Parse and return the successful response
    const json = JSON.parse(httpContent);
    const responseText = json.choices[0].message.content.trim();
    
    return { ok: true, response: responseText };
    
  } catch (e) {
    log_('ERROR', 'callOpenAI_', { err: e.message });
    return { ok: false, error: e.message };
  }
}
