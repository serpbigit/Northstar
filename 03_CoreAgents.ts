// ---------------------------------------------------------------------------------
// FILE: 03_CoreAgents.ts
// PURPOSE: Contains the Router (Query 1) and Core Cognitive Agent specialists.
// NOTE: This file depends on files 01, 02, and 05 (MonetizationGate).
// ---------------------------------------------------------------------------------

// ========== Block#3 — NLP Router (Query 1 - AI Powered) ==========

/**
 * Caches the handler manifest (from Handlers sheet) for 10 mins.
 */
function getHandlerManifest_(): any {
  try {
    const cache: any = CacheService.getScriptCache();
    const CACHE_KEY: string = 'polaris_handlers';
    const cached: any = cache.get(CACHE_KEY);
    if (cached) return { ok: true, handlers: JSON.parse(cached) };

    const tbl: any = readTable_(CFG_.HANDLERS_SHEET);
    if (!tbl.ok || !tbl.rows.length) {
      return { ok: false, error: 'Handlers sheet is empty or unreadable.' };
    }

    const handlers: any = tbl.rows.map((r: any) => ({
      key: r.HandlerKey || r.name,
      fn: r.GAS_Function || r.fnName,
      desc: r.Description || r.description,
    })).filter((h: any) => h.key && h.fn); 

    if (!handlers.length) {
      return { ok: false, error: 'No valid handlers found in Handlers sheet.' };
    }
    
    cache.put(CACHE_KEY, JSON.stringify(handlers), 600);
    return { ok: true, handlers: handlers, handlerKeys: handlers.map((h: any) => h.key) };
  } catch (e: any) {
    log_('ERROR', 'getHandlerManifest_', { err: e.message });
    return { ok: false, error: e.message };
  }
}

/**
 * AI-Powered Router (Query 1).
 * @param {string} text The user's input query.
 * @returns {object} {ok: true, handler: string, handlerKey: string} or {ok: false, reason: string, err: string}
 */
function nlpPickCommand_(text: any): any {
  try {
    if (text.trim().startsWith('IACP:')) {
      log_('INFO', 'nlpPickCommand_IACP', { status: 'STUB_BYPASS' });
    }

    const manifest: any = getHandlerManifest_();
    if (!manifest.ok) {
      return { ok: false, reason: 'handlers-not-found', err: manifest.error };
    }

    const toolList: string = manifest.handlers.map((h: any) => 
      `HandlerKey: ${h.key}\nDescription: ${h.desc}`
    ).join('\n---\n');

    const systemPrompt: string = `You are a "Query 1" router.
Your ONLY job is to analyze the user's text and choose the single best HandlerKey from the provided list.
You must respond with ONLY the chosen HandlerKey and nothing else.
If you cannot find a good match, you MUST respond with "general_chat".

Here is the list of available handlers:
${toolList}`;

    const aiResult: any = callOpenAI_(systemPrompt, text);
    if (!aiResult.ok) {
      log_('ERROR', 'nlpPickCommand_AI_call', { err: aiResult.error });
      return { ok: false, reason: 'router-ai-error', err: aiResult.error };
    }
    
    const chosenHandlerKey: string = aiResult.response.trim().replace(/[."']/g, '');
    const chosenHandler: any = manifest.handlers.find((h: any) => h.key === chosenHandlerKey);

    if (!chosenHandler) {
      log_('WARN', 'nlpPickCommand_AI_mismatch', { 
        text: text, 
        chosenKey: chosenHandlerKey 
      });
      const generalChatHandler: any = manifest.handlers.find((h: any) => h.key === 'general_chat');
      if (generalChatHandler) {
         return { ok: true, handler: generalChatHandler.fn, handlerKey: 'general_chat', debug: { chosenKey: 'general_chat (fallback)' } };
      }
      return { ok: false, reason: 'no-match', err: `AI returned invalid key: ${chosenHandlerKey}` };
    }

    return { ok: true, handler: chosenHandler.fn, handlerKey: chosenHandler.key, debug: { chosenKey: chosenHandlerKey } };

  } catch (e: any) {
    log_('ERROR', 'nlpPickCommand_', { err: e.message });
    return { ok: false, reason: 'router-exception', err: e.message };
  }
}

// ========== Block#4 — Core Specialists (Help, Chat, Search) ==========

/**
 * Handles 'help' requests. Dynamically lists available handlers.
 */
function cmd_Help_(params: any): any {
  try {
    const tbl: any = readTable_(CFG_.HANDLERS_SHEET);
    if (!tbl.ok || !tbl.rows.length) {
      return { ok: false, message: '⚠️ Cannot read handlers from sheet.' };
    }
    
    const commands: string = tbl.rows.map((r: any) => {
      const key: any = r.HandlerKey || r.name;
      const desc: any = r.Description || r.description || 'No description.';
      return `• **${key}**: ${desc}`;
    }).join('\n');

    return { ok: true, message: `Here's what I can do:\n${commands}` };
  } catch (e: any) {
    log_('ERROR', 'cmd_Help_', { err: e.message });
    return { ok: false, message: '⚠️ Error getting help.' };
  }
}

/**
 * Handles 'general_chat' requests using Query 2 (OpenAI).
 */
function cmd_GeneralChat_(params: any): any {
  try {
    const text: any = params.text || '';
    const agentsTbl: any = readTable_(CFG_.DATAAGENTS_SHEET);
    
    let instructions: string = 'You are a helpful assistant.';

    if (agentsTbl.ok && agentsTbl.rows.length) {
      const defaultAgent: any = agentsTbl.rows.find((r: any) => 
        String(r.agentName || r.AgentName || '').toLowerCase() === CFG_.DEFAULT_AGENT.toLowerCase()
      );
      if (defaultAgent) {
        const agentInstructions: any = defaultAgent.Instructions || defaultAgent.instructions;
        if (agentInstructions) instructions = agentInstructions;
      }
    }
    
    const aiResult: any = callOpenAI_(instructions, text);
    if (!aiResult.ok) {
      return { ok: false, message: `⚠️ AI Error: ${aiResult.error}` };
    }

    return { ok: true, message: aiResult.response };
  } catch (e: any) {
    log_('ERROR', 'cmd_GeneralChat_', { err: e.message });
    return { ok: false, message: '⚠️ General chat error.' };
  }
}

/**
 * STUB for 'handle_web_search'.
 */
function cmd_HandleWebSearch_(params: any): any {
  return { 
    ok: false, 
    message: '🤖 Web search is not implemented yet. We need to add a Search API first.' 
  };
}
