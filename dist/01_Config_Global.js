"use strict";
/*
 * Contains all global configuration objects and constants for Project Northstar.
 */
// ========== Block#1 — CONFIG ==========
const CFG_ = {
    SETTINGS_SHEET: 'Settings',
    HANDLERS_SHEET: 'Handlers',
    DATAAGENTS_SHEET: 'DataAgents',
    LOG_SHEET: 'Log',
    DEFAULT_AGENT: 'Default',
};
// Configuration for persistent storage in the PendingActions sheet
const CFG_PENDING_ = {
    SHEET: 'PendingActions',
    HEADERS: ['ActionID', 'Timestamp', 'Status', 'HandlerKey', 'UserID', 'SpaceName', 'ActionPayload']
};
// To make these variables available globally in the Apps Script environment after compilation,
// you can explicitly attach them to the `global` object.
global.CFG_ = CFG_;
global.CFG_PENDING_ = CFG_PENDING_;
