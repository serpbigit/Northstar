// ========== Block#8.5 — Web App Entrypoint (doGet) ==========

/**
 * Handles GET requests from the approval hyperlink.
 */
function doGet(e: GoogleAppsScript.Events.DoGet): GoogleAppsScript.HTML.HtmlOutput {
  try {
    const action = e.parameter.action;
    const pendingActionId = e.parameter.id;

    if (!pendingActionId) {
      return HtmlService.createHtmlOutput('<h1>❌ Invalid Link</h1><p>The link is missing a required action ID.</p>');
    }

    // The `action` parameter can be used to route to different handlers if needed in the future.
    // For now, all actions are handled by the pending action system.

    // This is the primary handler for sheet-based pending actions.
    const execResult = pending_getAndExecute_(pendingActionId);
    if (!execResult.ok) {
      return HtmlService.createHtmlOutput(`<h1>❌ Action Failed</h1><p>${execResult.error}</p>`);
    }

    // Assuming the payload is for gmail_send_ for now. This can be expanded later.
    const cmd = execResult.payload as { to: string; subject: string; body: string; reply_lang?: Language };

    // Add a runtime check to ensure the payload is valid before sending.
    if (!cmd || !cmd.to || !cmd.subject || !cmd.body) {
      return HtmlService.createHtmlOutput(`<h1>❌ Action Failed</h1><p>The action payload was incomplete or corrupted.</p>`);
    }

    const sendResult = gmail_send_(cmd);

    if (sendResult.ok) {
      return HtmlService.createHtmlOutput(`<h1>✅ Success!</h1><p>Email sent to **${cmd.to}** with subject: "${cmd.subject}".</p><p>You can now close this window.</p>`);
    } else {
      // The 'error' property is guaranteed by the return type of gmail_send_ on failure.
      return HtmlService.createHtmlOutput(`<h1>❌ Execution Failed</h1><p>Error sending email: ${sendResult.error}</p><p>Please inform the Polaris owner.</p>`);
    }
  } catch (error) {
    log_('ERROR', 'doGet_exception', { err: (error as Error).message, params: e.parameter });
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

    // Assuming fn returns {ok: boolean, message: string, card?: object}
    const out = fn({ text, user: event.user?.name, space: event.space?.name }); 

    if (out.ok && out.card) {
      return hostReply_({ cardsV2: [out.card] });
    }

    const reply = (out && out.message) || JSON.stringify(out);
    return hostReply_({ text: reply });
  } catch (e) {
    // FIX: Ensure this catch block returns the required structured response, not a simple string error.
    log_('ERROR', 'onMessage', { err: (e as Error).message });
    return hostReply_({ text: `⚠️ Critical Error: Failed to process your message. Details: ${(e as Error).message}` });
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
    return (globalThis as any).handleCardClick_(event);
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

/**
 * STUB for handling card clicks.
 */
function handleCardClick_(event: GoogleAppsScript.Events.ChatEvent): any {
  log_('INFO', 'handleCardClick_', { event });
  // Placeholder response
  return { actionResponse: { type: 'UPDATE_MESSAGE', message: { text: 'Card click received!' } } };
}
