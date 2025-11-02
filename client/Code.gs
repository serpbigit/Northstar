/**
 * Entry point to serve the HTML Web App client (index.html).
 */
function doGet(e) {
  // CRITICAL FIX: Using EMULATED mode for reliable rendering in GAS Web App IFRAME.
  return HtmlService.createTemplateFromFile('index')
       .evaluate()
       .setTitle('Polaris Agent Client')
       .setSandboxMode(HtmlService.SandboxMode.EMULATED);
}

/**
 * Public function called by the client to route user queries through the Polaris Core Library.
 */
function routeUserQuery(text) {
  const userEmail = Session.getActiveUser().getEmail();

  // --- GATE BYPASS: ADMIN/PROTOTYPE COMMANDS (For Developer) ---
  const ADMIN_EMAIL = 'reuven007@gmail.com'; 
  if (userEmail === ADMIN_EMAIL && text.startsWith('cmd_TestMenu_')) {
    
    // Direct call to prototype function in the same project scope
    if (typeof cmd_TestMenu_ === 'function') {
        return cmd_TestMenu_();
    }
  }

  // --- STANDARD ROUTING DELEGATION ---
  // All other commands delegate to the core library for full policy checking.
  return PolarisCore.routeUserQuery(text);
}

/**
 * Public function called by the client to perform initial sheet setup.
 */
function setupSheets() {
  return PolarisCore.setupPolarisSheets();
}

/**
 * Public function to fetch a list of available handlers (commands) for UI suggestions.
 */
function getSuggestedActions() {
  // This function relies on the Core Library (PolarisCore) access.
  try {
    const helpResult = PolarisCore.cmd_Help_({}); 
    
    if (!helpResult.ok || typeof helpResult.message !== 'string') {
        return { ok: false, message: helpResult.message || 'Error fetching available commands.' };
    }

    const commands = helpResult.message.split('\n').slice(1).map(line => {
      const match = line.match(/^\s*• \*\*([\w-]+)\*\*: (.*)/);
      return match ? { key: match[1], description: match[2] } : null;
    }).filter(Boolean);

    return { ok: true, actions: commands };

  } catch (e) {
    Logger.log("Error in getSuggestedActions: " + e.message);
    return { ok: false, message: "Error fetching suggestions: " + e.message };
  }
}
