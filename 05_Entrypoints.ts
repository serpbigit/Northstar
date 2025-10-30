// ========== Block#8.5 — Web App Entrypoint (doGet) ==========

/**
 * Handles GET requests from the approval hyperlink.
 */
function doGet(e: GoogleAppsScript.Events.DoGet): GoogleAppsScript.HTML.HtmlOutput {
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
    } else {
      return HtmlService.createHtmlOutput(`<h1>❌ Execution Failed</h1><p>Error sending email: ${result.error}</p><p>Please inform the Polaris owner.</p>`);
    }
  } catch (e) {
    log_('ERROR', 'doGet_exception', { err: (e as Error).message, params: e.parameter });
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
    return (handleCardClick_ as any)(event);
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

// Placeholder for a function that is called but not defined in the provided context
declare function handleCardClick_(event: GoogleAppsScript.Events.ChatEvent): any;