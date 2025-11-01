/*
 * Contains all global configuration objects and constants for Project Northstar.
 */

// ========== Block#1 — CONFIG ==========
const CFG_ = {
  SETTINGS_SHEET: 'Settings',
  HANDLERS_SHEET: 'Handlers',
  DATAAGENTS_SHEET: 'DataAgents',
  LOG_SHEET: 'Log',
  VERSION: '1.3.0', // Manually update this before each deployment
  DEFAULT_AGENT: 'Default',
} as const;

// Configuration for persistent storage in the PendingActions sheet
const CFG_PENDING_ = {
    SHEET: 'PendingActions',
    HEADERS: ['ActionID', 'Timestamp', 'Status', 'HandlerKey', 'UserID', 'SpaceName', 'ActionPayload']
} as const;

// To make these variables available globally in the Apps Script environment after compilation,
// you can explicitly attach them to the `global` object.
(global as any).CFG_ = CFG_;
(global as any).CFG_PENDING_ = CFG_PENDING_;