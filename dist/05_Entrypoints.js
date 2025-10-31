"use strict";
// ========== Block#8.5 — Web App Entrypoint (doGet) ==========
/**
 * Handles GET requests from the approval hyperlink.
 */
function doGet(e) {
    try {
        const action = e.parameter.action;
        const pendingActionId = e.parameter.id;
        if (action !== 'gmail_send_confirm' || !pendingActionId) {
            return HtmlService.createHtmlOutput('<h1>❌ Invalid Approval Link</h1><p>The link is malformed or expired.</p>');
        }
        const cache = CacheService.getScriptCache();
        const cachedData = cache.get(pendingActionId);
        cache.remove(pendingActionId);
        if (!cachedData) {
            return HtmlService.createHtmlOutput('<h1>⏳ Action Expired</h1><p>The approval link has expired or was already used.</p>');
        }
        const cmd = JSON.parse(cachedData);
        const result = gmail_send_(cmd);
        if (result.ok) {
            return HtmlService.createHtmlOutput(`<h1>✅ Success!</h1><p>Email sent to **${cmd.to}** with subject: "${cmd.subject}".</p><p>You can now close this window.</p>`);
        }
        else {
            return HtmlService.createHtmlOutput(`<h1>❌ Execution Failed</h1><p>Error sending email: ${result.error}</p><p>Please inform the Polaris owner.</p>`);
        }
    }
    catch (error) {
        log_('ERROR', 'doGet_exception', { err: error.message, params: e.parameter });
        return HtmlService.createHtmlOutput('<h1>🚨 Critical Server Error</h1><p>An unexpected error occurred during execution.</p>');
    }
}
// ========== Block#9 — Add-on Event Entrypoints ==========
function resolveHandlerFn_(name) {
    const n = String(name || '');
    const globalScope = globalThis;
    if (typeof globalScope[n] === 'function')
        return globalScope[n];
    if (n.endsWith('_') && typeof globalScope[n.slice(0, -1)] === 'function')
        return globalScope[n.slice(0, -1)];
    if (!n.endsWith('_') && typeof globalScope[n + '_'] === 'function')
        return globalScope[n + '_'];
    return null;
}
function onMessage(event) {
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
        if (!fn)
            return hostReply_({ text: `Handler not found: ${route.handler}` });
        const out = fn({ text }); // Specialist runs
        if (out.ok && out.card) {
            return hostReply_({ cardsV2: [out.card] });
        }
        const reply = (out && out.message) || JSON.stringify(out);
        return hostReply_({ text: reply });
    }
    catch (e) {
        log_('ERROR', 'onMessage', { err: e.message });
        return hostReply_({ text: '⚠️ Error handling your message.' });
    }
}
/**
 * Host reply builder. Handles text OR cardsV2.
 */
function hostReply_(reply) {
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
function onCardClick(event) {
    try {
        // Assuming handleCardClick_ exists and is typed elsewhere
        return globalThis.handleCardClick_(event);
    }
    catch (e) {
        log_('ERROR', 'onCardClick_entry', { err: e.message, event: event });
        return {
            actionResponse: {
                type: 'REQUEST_CONFIG',
                dialogAction: {
                    dialog: {
                        body: {
                            text: `Error handling click: ${e.message}`
                        }
                    }
                }
            }
        };
    }
}
function onAddedToSpace(event) {
    try {
        return hostReply_({ text: '👋 Polaris PoC ready. Try: "add milk to HomeErrands" or "list HomeErrands"' });
    }
    catch (e) {
        return hostReply_({ text: '👋 Ready.' });
    }
}
function onRemovedFromSpace(event) {
    log_('INFO', 'onRemovedFromSpace', {});
}
/**
 * STUB for handling card clicks.
 * This function will be implemented to handle interactive card elements.
 */
function handleCardClick_(event) {
    log_('INFO', 'handleCardClick_', { event });
    // Placeholder response
    return { actionResponse: { type: 'UPDATE_MESSAGE', message: { text: 'Card click received!' } } };
}
