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

/**
 * Returns the current script version from the global config.
 * This is a simple utility to confirm which code version is deployed and running.
 */
function cmd_GetVersion_(params: SpecialistParams): SpecialistResult {
  try {
    const version = CFG_.VERSION || 'unknown';
    return { ok: true, message: `✅ Polaris is running version: **${version}**` };
  } catch (e) {
    return { ok: false, message: '⚠️ Could not retrieve version information.' };
  }
}