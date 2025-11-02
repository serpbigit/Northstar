// ---------------------------------------------------------------------------------
// FILE: 05_MonetizationGate.ts
// PURPOSE: Handles external subscription and tier checking for the Guardian Agent.
// NOTE: This file depends on CFG_ and log_() from 01_ConfigAndUtils.ts
// ---------------------------------------------------------------------------------

/**
 * STUB: Connects to the external service/API to retrieve the user's tier 
 * and their allowed services for policy enforcement.
 * @param {string} userId The email address of the active user.
 * @returns {object} { tier: 'FREE'|'PAID_BASIC'|'PAID_PREMIUM', subscribedServices: string[] }
 */
function checkSubscriptionStatus_(userId) {
  // Log the call for future auditing
  log_('INFO', 'checkSubscriptionStatus_', { user: userId, action: 'External API Call STUB' });
  
  // --- STUB IMPLEMENTATION ---
  // In the free tier, users get basic chat and sheets functionality (cmd_HandleSheetData is mapped to 'sheets').
  const FREE_TIER_SERVICES = ['general_chat', 'sheets'];

  if (userId.includes('premium.user')) {
    // Example for testing Premium tier access
    return { tier: 'PAID_PREMIUM', subscribedServices: ['calendar', 'gmail', 'tasks', 'sheets', 'general_chat', 'web_search'] };
  }
  
  // Default to FREE tier
  return { tier: 'FREE', subscribedServices: FREE_TIER_SERVICES };
}

/**
 * Checks if a requested service (HandlerKey) is enabled for the user's subscription tier.
 * Used by the Guardian Agent before executing a command.
 * @param {string} userId The user's ID.
 * @param {string} handlerKey The requested service key (e.g., 'handle_calendar').
 * @returns {boolean} True if the service is enabled, false otherwise.
 */
function isServiceEnabled_(userId, handlerKey) {
  const status = checkSubscriptionStatus_(userId); 

  // Normalize the handler key for reliable lookup
  const key = handlerKey.toLowerCase();
  
  if (status.tier === 'PAID_PREMIUM') return true; 

  return status.subscribedServices.includes(key);
}
