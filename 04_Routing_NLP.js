// ========== Block#4 — NLP Router (Query 1 - AI Powered) ==========

/*
 * Caches the handler manifest (from Handlers sheet) for 10 mins.
 * (Reads the 'FallbackHelpText' column for robust error replies)
 */
function getHandlerManifest_() {
  try {
    const cache = CacheService.getScriptCache();
    const CACHE_KEY = 'polaris_handlers';
    const cached = cache.get(CACHE_KEY);
    if (cached) return { ok: true, handlers: JSON.parse(cached) };

    const tbl = readTable_(CFG_.HANDLERS_SHEET);
    if (!tbl.ok || !tbl.rows.length) {
      return { ok: false, error: 'Handlers sheet is empty or unreadable.' };
    }

    // Map to a cleaner object, now including the fallback text
    const handlers = tbl.rows.map(r => ({
      key: r.HandlerKey || r.name,
      fn: r.GAS_Function || r.fnName,
      desc: r.Description || r.description,
      fallback: r.FallbackHelpText || r.fallback
    })).filter(h => h.key && h.fn); // Must have a key and function

    if (!handlers.length) {
      return { ok: false, error: 'No valid handlers found in Handlers sheet.' };
    }
    
    cache.put(CACHE_KEY, JSON.stringify(handlers), 600); // Cache for 10 mins
    return { ok: true, handlers: handlers };

  } catch (e) {
    log_('ERROR', 'getHandlerManifest_', { err: e.message });
    return { ok: false, error: e.message };
  }
}

/*
 * AI-Powered Router (Query 1).
 * Uses OpenAI to pick the best specialist from the Handlers sheet.
 */
function nlpPickCommand_(text) {
  try {
    // 1. Get the list of available tools (from cache or sheet)
    const manifest = getHandlerManifest_();
    if (!manifest.ok) {
      return { ok: false, reason: 'handlers-not-found', err: manifest.error };
    }

    // 2. Format the tools for the AI prompt
    const toolList = manifest.handlers.map(h =>
      `HandlerKey: ${h.key}\nDescription: ${h.desc}`
    ).join('\n---\n');

    // 3. Create the System Prompt for the AI Router
    const systemPrompt = `You are a "Query 1" router. Your ONLY job is to analyze the user's text and choose the single best HandlerKey from the provided list.

You must respond with ONLY the chosen HandlerKey and nothing else.

For example, if the user says "help me", you will respond with "help".
If you cannot find a good match, you MUST respond with "general_chat".

Here is the list of available handlers:
${toolList}`;

    // 4. Call OpenAI (Query 1)
    const aiResult = callOpenAI_(systemPrompt, text);

    if (!aiResult.ok) {
      log_('ERROR', 'nlpPickCommand_AI_call', { err: aiResult.error });
      return { ok: false, reason: 'router-ai-error', err: aiResult.error };
    }
    
    // Clean up AI response
    const chosenHandlerKey = aiResult.response.trim().replace(/[."']/g, '');

    // 5. Find the GAS function name for the chosen handler
    const chosenHandler = manifest.handlers.find(h => h.key === chosenHandlerKey);

    if (!chosenHandler) {
      log_('WARN', 'nlpPickCommand_AI_mismatch', {
        text: text,
        chosenKey: chosenHandlerKey
      });
      // Fallback: If AI hallucinates a key, route to general chat
      const generalChatHandler = manifest.handlers.find(h => h.key === 'general_chat');
      if (generalChatHandler) {
          return { ok: true, handler: generalChatHandler.fn, debug: { chosenKey: 'general_chat (fallback)' } };
      }
      return { ok: false, reason: 'no-match' }; // Failsafe
    }

    // 6. Success
    return { ok: true, handler: chosenHandler.fn, debug: { chosenKey: chosenHandlerKey } };

  } catch (e) {
    log_('ERROR', 'nlpPickCommand_', { err: e.message });
    return { ok: false, reason: 'router-exception', err: e.message };
  }
}