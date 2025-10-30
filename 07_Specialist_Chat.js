// ========== Block#6 — Specialists: Help, Chat, Search ==========

/*
 * Handles 'help' requests. Dynamically lists available handlers.
 */
function cmd_Help_(params) {
  try {
    const tbl = readTable_(CFG_.HANDLERS_SHEET);
    if (!tbl.ok || !tbl.rows.length) {
      return { ok: false, message: '⚠️ Cannot read handlers from sheet.' };
    }
    // Assumes 'HandlerKey' and 'Description' columns exist
    const commands = tbl.rows.map(r => {
      const key = r.HandlerKey || r.name;
      const desc = r.Description || r.description || 'No description.';
      return `• **${key}**: ${desc}`;
    }).join('\n');

    return { ok: true, message: `Here's what I can do:\n${commands}` };
  } catch (e) {
    log_('ERROR', 'cmd_Help_', { err: e.message });
    return { ok: false, message: '⚠️ Error getting help.' };
  }
}

/*
 * Handles 'general_chat' requests using Query 2 (OpenAI).
 * Fetches context from the 'Default' agent in DataAgents.
 */
function cmd_GeneralChat_(params) {
  try {
    const text = params.text || '';
    const agentsTbl = readTable_(CFG_.DATAAGENTS_SHEET);
    
    let instructions = 'You are a helpful assistant.'; // Hardcoded fallback

    if (agentsTbl.ok && agentsTbl.rows.length) {
      // Assumes 'agentName' and 'Instructions' columns
      const defaultAgent = agentsTbl.rows.find(r => 
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
    log_('ERROR', 'cmd_GeneralChat_', { err: e.message });
    return { ok: false, message: '⚠️ General chat error.' };
  }
}

/*
 * STUB for 'handle_web_search'.
 */
function cmd_HandleWebSearch_(params) {
  return { 
    ok: false, 
    message: '🤖 Web search is not implemented yet. We need to add a Search API (like Google Custom Search) first.' 
  };
}