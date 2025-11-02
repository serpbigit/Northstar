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
 * NOTE: This function would typically check for the existence of the requested command 
 * in a manifest sheet before delegating to the Core Library, if not found locally.
 */
function routeUserQuery(text) {
  // For testing prototype features, we will first check the local agent file.
  if (text.startsWith('cmd_TestMenu_')) {
    return cmd_TestMenu_(); // Call the local prototype function directly
  }
  // All other commands delegate to the core library.
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
  try {
    const helpResult = PolarisCore.cmd_Help_({}); 
    
    if (!helpResult.ok || typeof helpResult.message !== 'string') {
        return { ok: false, message: helpResult.message || 'Help command returned error.' };
    }

    // Parse the markdown list into a structured array for the UI
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
