// ========== Block#8.5 — Web App Entrypoint (doGet) ==========

/*
 * Handles GET requests from the approval hyperlink.
 * Executes the action stored in the cache and replies with a success page.
 * NOTE: Requires script to be deployed as a Web App with access to 'Me'.
 */
function doGet(e) {
  try {
    const action = e.parameter.action;
    const pendingActionId = e.parameter.id;

    if (action !== 'gmail_send_confirm' || !pendingActionId) {
      return HtmlService.createHtmlOutput('<h1>❌ Invalid Approval Link</h1><p>The link is malformed or expired.</p>');
    }

    // 1. Get payload from cache
    const cache = CacheService.getScriptCache();
    const cachedData = cache.get(pendingActionId);
    cache.remove(pendingActionId);
    
    if (!cachedData) {
      return HtmlService.createHtmlOutput('<h1>⏳ Action Expired</h1><p>The approval link has expired or was already used.</p>');
    }

    const cmd = JSON.parse(cachedData);
    
    // 2. Execute the action
    const result = gmail_send_(cmd);
    
    // 3. Return status page
    if (result.ok) {
      return HtmlService.createHtmlOutput(`<h1>✅ Success!</h1><p>Email sent to **${cmd.to}** with subject: "${cmd.subject}".</p><p>You can now close this window.</p>`);
    } else {
      return HtmlService.createHtmlOutput(`<h1>❌ Execution Failed</h1><p>Error sending email: ${result.error}</p><p>Please inform the Polaris owner.</p>`);
    }

  } catch (e) {
    log_('ERROR', 'doGet_exception', { err: e.message, params: e.parameter });
    return HtmlService.createHtmlOutput('<h1>🚨 Critical Server Error</h1><p>An unexpected error occurred during execution.</p>');
  }
}














// ========== Block#9 — Add-on Event Entrypoints ==========
function resolveHandlerFn_(name) {
  // Tolerant resolver: accepts with or without trailing underscore
  const n = String(name || '');
  if (typeof this[n] === 'function') return this[n];
  if (n.endsWith('_') && typeof this[n.slice(0, -1)] === 'function') return this[n.slice(0, -1)];
  if (!n.endsWith('_') && typeof this[n + '_'] === 'function') return this[n + '_'];
  return null;
}

function onMessage(event) {
  try {
    const payload = (event && event.chat && event.chat.messagePayload) || {};
    const msg = payload.message || {};
    const text = (msg.text || '').trim();

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

    const out = fn({text}); // Specialist (e.g., cmd_HandleGmail_) runs
    
    // NEW: Check if specialist returned a card or a simple message
    if (out.ok && out.card) {
      // Return a card message
      return hostReply_({ cardsV2: [out.card] });
    }
    
    // Default to text message
    const reply = (out && out.message) || JSON.stringify(out);
    return hostReply_({ text: reply });

  } catch (e) {
    log_('ERROR','onMessage', {err:e.message});
    return hostReply_({ text: '⚠️ Error handling your message.' });
  }
}

/*
 * Host reply builder. Now handles text OR cardsV2.
 * reply = { text: "..." } OR { cardsV2: [...] }
 */
function hostReply_(reply) {
  return { 
    hostAppDataAction: { 
      chatDataAction: { 
        createMessageAction: { 
          message: reply // Pass the {text} or {cardsV2} object
        } 
      } 
    } 
  };
}

/*
 * NEW: Entrypoint for all card clicks.
 */
function onCardClick(event) {
  try {
    // Pass to the logic handler in Block#10
    return handleCardClick_(event);
  } catch (e) {
    log_('ERROR', 'onCardClick_entry', { err: e.message, event: event });
    return {
      hostAppDialogAction: {
        status: {
          statusCode: "INVALID_ARGUMENT",
          userMessage: `Error handling click: ${e.message}`
        }
      }
    };
  }
}

function onAddedToSpace(event) {
  try {
    return hostReply_({ text: '👋 Polaris PoC ready. Try: "add milk to HomeErrands" or "list HomeErrands"' });
  } catch (e) {
    return hostReply_({ text: '👋 Ready.' });
  }
}

function onRemovedFromSpace(event) {
  log_('LOG','onRemovedFromSpace', {});
}



// ========== Block#9 — Add-on Event Entrypoints ==========
function resolveHandlerFn_(name) {
  // Tolerant resolver: accepts with or without trailing underscore
  const n = String(name || '');
  if (typeof this[n] === 'function') return this[n];
  if (n.endsWith('_') && typeof this[n.slice(0, -1)] === 'function') return this[n.slice(0, -1)];
  if (!n.endsWith('_') && typeof this[n + '_'] === 'function') return this[n + '_'];
  return null;
}

function onMessage(event) {
  try {
    const payload = (event && event.chat && event.chat.messagePayload) || {};
    const msg = payload.message || {};
    const text = (msg.text || '').trim();

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

    const out = fn({text}); // Specialist (e.g., cmd_TestButton_) runs
    
    // Check if specialist returned a card or a simple message
    if (out.ok && out.card) {
      // Return a card message
      return hostReply_({ cardsV2: [out.card] });
    }
    
    // Default to text message
    const reply = (out && out.message) || JSON.stringify(out);
    return hostReply_({ text: reply });

  } catch (e) {
    log_('ERROR','onMessage', {err:e.message});
    return hostReply_({ text: '⚠️ Error handling your message.' });
  }
}

/*
 * Host reply builder. Handles text OR cardsV2.
 * reply = { text: "..." } OR { cardsV2: [...] }
 */
function hostReply_(reply) {
  return { 
    hostAppDataAction: { 
      chatDataAction: { 
        createMessageAction: { 
          message: reply // Pass the {text} or {cardsV2} object
        } 
      } 
    } 
  };
}

/*
 * Entrypoint for all card clicks.
 */
function onCardClick(event) {
  try {
    // Pass to the logic handler in Block#10
    return handleCardClick_(event);
  } catch (e) {
    log_('ERROR', 'onCardClick_entry', { err: e.message, event: event });
    return {
      hostAppDialogAction: {
        status: {
          statusCode: "INVALID_ARGUMENT",
          userMessage: `Error handling click: ${e.message}`
        }
      }
    };
  }
}

function onAddedToSpace(event) {
  try {
    return hostReply_({ text: '👋 Polaris PoC ready. Try: "add milk to HomeErrands" or "list HomeErrands"' });
  } catch (e) {
    return hostReply_({ text: '👋 Ready.' });
  }
}

function onRemovedFromSpace(event) {
  log_('LOG','onRemovedFromSpace', {});
}






