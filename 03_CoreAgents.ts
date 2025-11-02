// ---------------------------------------------------------------------------------
// FILE: 03_CoreAgents.ts
// PURPOSE: Contains the Router (Query 1) and Core Cognitive Agent specialists.
// NOTE: This file depends on files 01, 02, and 05 (MonetizationGate).
// ---------------------------------------------------------------------------------

// ========== Block#3 — NLP Router (Query 1 - AI Powered) ==========

/**
 * Caches the handler manifest (from Handlers sheet) for 10 mins.
 * This is used by the AI router to know what tools are available.
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

    // Map to a cleaner {key, description, fn} object
    const handlers = tbl.rows.map(r => ({
      // Support various header casings from the sheet
      key: r.HandlerKey || r.name,
      fn: r.GAS_Function || r.fnName,
      desc: r.Description || r.description,
    })).filter(h => h.key && h.fn); // Must have a key and function

    if (!handlers.length) {
      return { ok: false, error: 'No valid handlers found in Handlers sheet.' };
    }
    
    // Cache for 10 mins (600 seconds)
    cache.put(CACHE_KEY, JSON.stringify(handlers), 600);
    return { ok: true, handlers: handlers, handlerKeys: handlers.map(h => h.key) };
  } catch (e) {
    log_('ERROR', 'getHandlerManifest_', { err: e.message });
    return { ok: false, error: e.message };
  }
}

/**
 * AI-Powered Router (Query 1).
 * [cite_start]Uses OpenAI to pick the best specialist from the Handlers sheet[cite: 48].
 * This function must also implement the IACP/Jobs Queue bypass check.
 * @param {string} text The user's input query.
 * @returns {object} {ok: true, handler: string, handlerKey: string} or {ok: false, reason: string, err: string}
 */
function nlpPickCommand_(text) {
  try {
    // 1. Check for IACP/Jobs Queue Bypass (STUB for now)
    // If a structured IACP message is found, route directly to cmd_HandleProtocol_
    if (text.trim().startsWith('IACP:')) {
      log_('INFO', 'nlpPickCommand_IACP', { status: 'STUB_BYPASS' });
      // In the final implementation, we would return:
      // return { ok: true, handler: 'cmd_HandleProtocol_', handlerKey: 'protocol', debug: 'IACP_BYPASS' };
    }

    // 2. Get the list of available tools (from cache or sheet)
    const manifest = getHandlerManifest_();
    if (!manifest.ok) {
      return { ok: false, reason: 'handlers-not-found', err: manifest.error };
    }

    // 3. Format the tools for the AI prompt
    const toolList = manifest.handlers.map(h => 
      `HandlerKey: ${h.key}\nDescription: ${h.desc}`
    ).join('\n---\n');

    // 4. Create the System Prompt for the AI Router (Query 1)
    [cite_start]const systemPrompt = `You are a "Query 1" router[cite: 53].
[cite_start]Your ONLY job is to analyze the user's text and choose the single best HandlerKey from the provided list[cite: 53].
[cite_start]You must respond with ONLY the chosen HandlerKey and nothing else[cite: 54].
[cite_start]If you cannot find a good match, you MUST respond with "general_chat"[cite: 56].

Here is the list of available handlers:
${toolList}`;

    // 5. Call OpenAI 
    const aiResult = callOpenAI_(systemPrompt, text);
    if (!aiResult.ok) {
      log_('ERROR', 'nlpPickCommand_AI_call', { err: aiResult.error });
      return { ok: false, reason: 'router-ai-error', err: aiResult.error };
    }
    
    // 6. Clean and validate AI response
    const chosenHandlerKey = aiResult.response.trim().replace(/[."']/g, '');
    const chosenHandler = manifest.handlers.find(h => h.key === chosenHandlerKey);

    if (!chosenHandler) {
      log_('WARN', 'nlpPickCommand_AI_mismatch', { 
        text: text, 
        chosenKey: chosenHandlerKey 
      });
      [cite_start]// Fallback: If AI hallucinates a key, route to general chat [cite: 60]
      const generalChatHandler = manifest.handlers.find(h => h.key === 'general_chat');
      if (generalChatHandler) {
         return { ok: true, handler: generalChatHandler.fn, handlerKey: 'general_chat', debug: { chosenKey: 'general_chat (fallback)' } };
      }
      return { ok: false, reason: 'no-match', err: `AI returned invalid key: ${chosenHandlerKey}` }; // Failsafe
    }

    // 7. Success
    return { ok: true, handler: chosenHandler.fn, handlerKey: chosenHandler.key, debug: { chosenKey: chosenHandlerKey } };

  } catch (e) {
    log_('ERROR', 'nlpPickCommand_', { err: e.message });
    return { ok: false, reason: 'router-exception', err: e.message };
  }
}

// ========== Block#4 — Core Specialists (Help, Chat, Search) ==========

/**
 * Handles 'help' requests. Dynamically lists available handlers.
 */
function cmd_Help_(params) {
  try {
    const tbl = readTable_(CFG_.HANDLERS_SHEET);
    if (!tbl.ok || !tbl.rows.length) {
      return { ok: false, message: '⚠️ Cannot read handlers from sheet.' };
    }
    
    [cite_start]// Assumes 'HandlerKey' and 'Description' columns exist [cite: 78]
    const commands = tbl.rows.map(r => {
      const key = r.HandlerKey || r.name;
      const desc = r.Description || r.description || 'No description.';
      return `• **${key}**: ${desc}`;
    }).join('\n');

    const message = commands
      ? `Here's what I can do:\n${commands}`
      : "ℹ️ No commands are currently available. Please configure the 'Handlers' sheet.";

    return { ok: true, message: message };
  } catch (e) {
    log_('ERROR', 'cmd_Help_', { err: e.message });
    return { ok: false, message: '⚠️ Error getting help.' };
  }
}

/**
 * Handles 'general_chat' requests using Query 2 (OpenAI) (The Contextualist's role).
 * [cite_start]Fetches context from the 'Default' agent in DataAgents[cite: 82].
 */
function cmd_GeneralChat_(params) {
  try {
    const text = params.text || '';
    const agentsTbl = readTable_(CFG_.DATAAGENTS_SHEET);
    let instructions = '';

    if (agentsTbl.ok && agentsTbl.rows.length) {
      // Find the 'Default' agent (The Contextualist Agent)
      const defaultAgent = agentsTbl.rows.find(r => 
        String(r.agentName || r.AgentName || '').toLowerCase() === CFG_.DEFAULT_AGENT.toLowerCase()
      );
      instructions = (defaultAgent && (defaultAgent.Instructions || defaultAgent.instructions)) || '';
    }
    
    // If no instructions could be found, it's a configuration error.
    if (!instructions) {
      return { ok: false, message: `⚠️ Configuration Error: Could not load 'Default' agent persona from the ${CFG_.DATAAGENTS_SHEET} sheet.` };
    }

    // Query 2: Call AI with the persona instructions
    const aiResult = callOpenAI_(instructions, text);
    if (!aiResult.ok) {
      return { ok: false, message: `⚠️ AI Error: ${aiResult.error}` };
    }

    return { ok: true, message: aiResult.response };
  } catch (e) {
    log_('ERROR', 'cmd_GeneralChat_', { err: e.message });
    return { ok: false, message: '⚠️ General chat error.' };
  }
}

/**
 * STUB for 'handle_web_search'.
 */
function cmd_HandleWebSearch_(params) {
  return { 
    ok: false, 
    message: '🤖 Web search is not implemented yet. [cite_start]We need to add a Search API first[cite: 92].' 
  };
}
