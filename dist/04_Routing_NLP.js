"use strict";
// ========== Block#4 — NLP Router (Query 1 - AI Powered) ==========
/**
 * Caches the handler manifest (from Handlers sheet) for 10 mins.
 */
function getHandlerManifest_() {
    try {
        const cache = CacheService.getScriptCache();
        const CACHE_KEY = 'polaris_handlers';
        const cached = cache.get(CACHE_KEY);
        if (cached)
            return { ok: true, handlers: JSON.parse(cached) };
        const tblResult = readTable_(CFG_.HANDLERS_SHEET);
        if (!tblResult.ok || !tblResult.rows.length) {
            return { ok: false, error: 'Handlers sheet is empty or unreadable.' };
        }
        const handlers = tblResult.rows.map(r => ({
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
    }
    catch (e) {
        log_('ERROR', 'getHandlerManifest_', { err: e.message });
        return { ok: false, error: e.message };
    }
}
/**
 * AI-Powered Router (Query 1).
 * Uses OpenAI to pick the best specialist from the Handlers sheet.
 */
function nlpPickCommand_(text) {
    try {
        const manifest = getHandlerManifest_();
        if (!manifest.ok) {
            return { ok: false, reason: 'handlers-not-found', err: manifest.error };
        }
        // Define core, built-in handlers to ensure they are always present and correctly described.
        const coreHandlers = [
            { key: 'handle_gmail', desc: 'Use to search, read, draft, or send emails.' },
            { key: 'handle_calendar', desc: 'Use to create, read, or manage calendar events.' },
            { key: 'handle_sheet_data', desc: 'Use to add or list items in a spreadsheet list (e.g., "add milk to groceries").' },
            { key: 'general_chat', desc: 'Use for general conversation or questions not covered by other tools.' },
            { key: 'help', desc: 'Use to ask for help or a list of capabilities.' }
        ];
        const coreHandlerKeys = new Set(coreHandlers.map(h => h.key));
        // Filter out any core handlers from the sheet to avoid duplication, allowing sheet-based overrides if needed,
        // but primarily relying on the sheet for custom/new handlers.
        const customHandlers = manifest.handlers.filter(h => !coreHandlerKeys.has(h.key));
        const allHandlersForPrompt = [...coreHandlers, ...customHandlers];
        const toolList = allHandlersForPrompt.map(h => `HandlerKey: ${h.key}\nDescription: ${h.desc}`).join('\n---\n');
        const systemPrompt = `You are a "Query 1" router. Your ONLY job is to analyze the user's text and choose the single best HandlerKey from the provided list.
You must respond with ONLY the chosen HandlerKey and nothing else.
For example, if the user says "help me", you will respond with "help".
If no other tool is a good match for the user's request, you MUST respond with "general_chat".
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
            if (!chosenHandler)
                return { ok: false, reason: 'no-match' }; // Failsafe
        }
        return { ok: true, handler: chosenHandler.fn, debug: { chosenKey: chosenHandler.key } };
    }
    catch (e) {
        log_('ERROR', 'nlpPickCommand_', { err: e.message });
        return { ok: false, reason: 'router-exception', err: e.message };
    }
}
