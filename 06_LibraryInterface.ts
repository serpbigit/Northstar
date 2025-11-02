// ---------------------------------------------------------------------------------
// FILE: 99_LibraryInterface.ts
// PURPOSE: Defines the single public-facing function for the Client Project to call.
// This function implements the full execution pipeline (Router -> Guardian -> Executive).
// ---------------------------------------------------------------------------------

// NOTE: This function must be PUBLIC (no underscore) to be called by google.script.run
// It relies on internal (private) functions from files 01-05.

/**
 * Public entry point for the Polaris Client Project (Web App) via google.script.run.
 * This shims the text from the UI to the internal Core Library logic.
 * * @param {string} text The user's input query.
 * @returns {string} The final response message for the UI.
 */
function routeUserQuery(text) {
  try {
    // 1. Get the current user's ID
    const userId = Session.getActiveUser().getEmail(); 
    
    // 2. Route the query (Query 1) to determine the correct agent (Router Agent)
    const routeResult = nlpPickCommand_(text); 
    
    // Log the routing decision for debugging/Archivist
    log_('INFO', 'routeUserQuery_decision', { 
      text: text, 
      decision: routeResult.ok ? routeResult.debug : routeResult 
    });

    if (!routeResult.ok) {
      log_('ERROR', 'routeUserQuery_RouteFail', { err: routeResult.reason || 'Unknown routing error' });
      // Send the user a helpful error, defaulting to an echo if no match was found
      const userErr = routeResult.reason === 'no-match' ? `🤖 Echo: ${text}` : `Router error: ${routeResult.reason}`;
      return `⚠️ Router Fail: ${userErr}`;
    }

    // --- EXECUTION PIPELINE ---

    // 3. Check for subscription/policy (Guardian Agent's role)
    // isServiceEnabled_ is defined in 05_MonetizationGate.ts
    if (!isServiceEnabled_(userId, routeResult.handlerKey)) {
      log_('WARN', 'routeUserQuery_AccessDenied', { userId: userId, key: routeResult.handlerKey });
      return `⚠️ Access Denied: The **${routeResult.handlerKey}** service requires a subscription upgrade.`;
    }
    
    // 4. Resolve the handler function (Executive Agent's role)
    // resolveHandlerFn_ is defined in 05_MonetizationGate.ts
    const fn = resolveHandlerFn_(routeResult.handler); 
    if (!fn) {
      log_('ERROR', 'routeUserQuery_FnNotFound', { key: routeResult.handler });
      return `⚠️ Internal Error: Handler function not found: ${routeResult.handler}`;
    }

    // 5. Execute the specialist (Query 2)
    // Pass the user text and ID to the specialist
    const out = fn({ text, userId });
    
    // 6. Return the result
    return (out && out.message) || JSON.stringify(out);

  } catch (e) {
    // Top-level failsafe catch
    log_('FATAL', 'routeUserQuery_Exception', { err: e.message, stack: e.stack });
    return '⚠️ Critical Error: An unexpected exception occurred while processing your request.';
  }
}

/**
 * Public entry point for initial setup, callable via google.script.run or from the native editor.
 * This function should be kept public (no underscore).
 */
function setupPolarisSheets() {
  return GoogleSheets_Setup();
}
