// ---------------------------------------------------------------------------------
// FILE: 02_OpenAIClient.ts
// PURPOSE: Handles settings retrieval and the secure external call to the OpenAI API.
// ---------------------------------------------------------------------------------

// NOTE: This file depends on CFG_, log_(), and readTable_() from 01_ConfigAndUtils.ts

/**
 * Gets key-value pairs from the Settings sheet.
 * Caches settings for 10 minutes to reduce Sheet API calls.
 * @returns {object} {ok: true, settings: object} or {ok: false, error: string}
 */
function getSettings_(): any {
  try {
    const cache: any = CacheService.getScriptCache();
    const CACHE_KEY: string = 'polaris_settings';
    const cached: any = cache.get(CACHE_KEY);
    if (cached) return { ok: true, settings: JSON.parse(cached) };

    const tbl: any = readTable_(CFG_.SETTINGS_SHEET);
    if (!tbl.ok || !tbl.rows.length) {
      return { ok: false, error: 'Settings sheet is empty or unreadable.' };
    }

    // Assumes Settings sheet has 'Key' and 'Value' columns
    const settings: any = tbl.rows.reduce((acc: any, row: any) => {
      const k: any = row.Key || row.key; 
      const v: any = row.Value || row.value;
      if (k) acc[k] = v;
      return acc;
    }, {});
    
    if (!settings.OPENAI_API_KEY || !settings.OPENAI_MODEL) {
       log_('WARN', 'getSettings_', 'OPENAI_API_KEY or OPENAI_MODEL missing from Settings');
    }

    cache.put(CACHE_KEY, JSON.stringify(settings), 600); 
    return { ok: true, settings };
  } catch (e: any) {
    log_('ERROR', 'getSettings_', { err: e.message });
    return { ok: false, error: e.message };
  }
}

/**
 * Calls the OpenAI Chat Completions API using UrlFetchApp.
 * @param {string} systemPrompt The system-level instruction for the AI.
 * @param {string} userText The user's input text.
 * @returns {object} {ok: true, response: string} or {ok: false, error: string}
 */
function callOpenAI_(systemPrompt: any, userText: any): any {
  try {
    // 1. Get API Key and Model from settings
    const settingsData: any = getSettings_();
    if (!settingsData.ok) {
      return { ok: false, error: `Failed to get settings: ${settingsData.error}` };
    }
    
    const { OPENAI_API_KEY, OPENAI_MODEL }: any = settingsData.settings;
    if (!OPENAI_API_KEY || !OPENAI_MODEL) {
      return { ok: false, error: 'OPENAI_API_KEY or OPENAI_MODEL is not set in the Settings sheet.' };
    }

    // 2. Prepare the HTTP request payload and options
    const url: string = 'https://api.openai.com/v1/chat/completions';
    const payload: any = {
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userText }
      ],
      max_tokens: 1024,
      temperature: 0.7,
    };
    
    const options: any = {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    };

    // 3. Execute the external request
    const httpResponse: any = UrlFetchApp.fetch(url, options);
    const httpCode: number = httpResponse.getResponseCode();
    const httpContent: string = httpResponse.getContentText();

    // 4. Handle non-200 HTTP errors
    if (httpCode !== 200) {
      log_('ERROR', 'callOpenAI_', { httpCode, httpContent: httpContent.slice(0, 500) });
      return { ok: false, error: `OpenAI API Error ${httpCode}: ${httpContent.slice(0, 500)}` };
    }

    // 5. Parse and return the successful response
    const json: any = JSON.parse(httpContent);
    const responseText: string = json.choices[0].message.content.trim();
    
    return { ok: true, response: responseText };
    
  } catch (e: any) {
    log_('ERROR', 'callOpenAI_', { err: e.message });
    return { ok: false, error: e.message };
  }
}
