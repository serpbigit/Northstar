/**
 * Entry point to serve the HTML Web App client (index.html).
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('index')
       .evaluate()
       .setTitle('Polaris Agent Client')
       .setSandboxMode(HtmlService.SandboxMode.IFRAME);
}

/**
 * Public function called by the client to route user queries through the Polaris Core Library.
 */
function routeUserQuery(text) {
  return PolarisCore.routeUserQuery(text);
}

/**
 * Public function called by the client to perform initial sheet setup.
 */
function setupSheets() {
  return PolarisCore.setupPolarisSheets();
}

/**
 * NEW: Public function to fetch a list of available handlers (commands) for UI suggestions.
 */
function getSuggestedActions() {
  try {
    const helpResult = PolarisCore.cmd_Help_({}); // Call the Core Library's help function directly
    
    // Check if the result is a failure object or text error
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
