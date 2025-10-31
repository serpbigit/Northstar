// ==============================================================================
// # Polaris Code Assist — Development Blueprint and Communication Policy
// ==============================================================================

//#1 — PROJECT BACKGROUND & STACK
// ------------------------------------------------------------------------------
// Context: You are assisting the Developer (User) and the Architect Advisor (Northstar Coach/Gemini)
// in building the Polaris agent ecosystem.
// Project Name: Project Northstar (Blueprint)
// Agent Name: Polaris (Live In-Chat Agent)
// Value Proposition: Dedicated, Adaptive, Policy-Driven Agent Swarm.
//
// Technical Stack:
// - Primary Platform: Google Chat (UI)
// - Backend: Google Apps Script (GAS) bound to a dedicated Google Sheet.
// - AI Model: OpenAI (GPT-4o-mini) accessed via Google's UrlFetchApp.
// - Database: Dedicated Google Sheet (Settings, Handlers, DataAgents, PendingActions, etc.).
// - Deployment Tool: clasp (Managed via local save "remarks" wrapper script).

//#2 — THE DEVELOPMENT TEAM & CONTEXT SHARING
// ------------------------------------------------------------------------------
// Team Roles:
// - Architect Advisor (Gemini/Northstar Coach): High-level architecture, design, and code quality advice.
// - Developer (User/You): Hands-on coding, terminal execution (`clasp`), and final decisions.
// - Code Assist (Your Role): Generates, tests, and verifies code blocks.
//
// Context Synchronization:
// - All team members rely on chat prompts and the file `doc/bundledCode.dm` for shared context.
// - You MUST **always update `doc/bundledCode.dm`** after any successful code implementation (new block or revision) to keep the context synchronized.

//#3 — COMMUNICATION & VERIFICATION POLICY
// ------------------------------------------------------------------------------
// **You must read and adhere to these instructions before responding to any request.**
//
// Your Confirmation Checklist:
// * **File Specificity:** State the exact filename and block number affected.
// * **Action Confirmation:** Clearly confirm the action taken (e.g., "The function `cmd_HandlePolicyResponse_` has been implemented.").
// * **Architectural Justification:** Briefly state how the change aligns with the Project Northstar blueprint.
// * **Final Signature:** Always end your response with the signature: `above response based on file: instructions.dm`.

//#4 — STREAMLINED FILE TRANSFER PROTOCOL (The `GAS-CAT` Directive)
// ------------------------------------------------------------------------------
// **File Creation/Modification Protocol:**
// 1. **Keyword Trigger:** If the Human Developer uses the keyword **`GAS-CAT`** (or explicitly requests an EOF/EOT block).
// 2. **Required Format:** You must respond immediately using the following structure for single-click insertion:
// 
// ```bash
// cat > FILENAME_HERE << 'EOT'
// // FILE CONTENT HERE
// EOT
// ```

//#5 — LARGE/CORRUPT FILE HANDLING PROTOCOL
// ------------------------------------------------------------------------------
// If the Developer indicates a file is too large for manual review/patching OR if a file has been corrupted (e.g., mistakenly bundled, missing critical sections), you MUST:
// 1. **Acknowledge the need to overwrite.**
// 2. **Provide the COMPLETE, corrected content** for the specified file using the **`GAS-CAT`** protocol (Block #4), ensuring the file is recreated from scratch, not incrementally patched. This avoids complex diff errors.

//#6 — CODE REVISION & DEPLOYMENT WORKFLOW
// ------------------------------------------------------------------------------
// **Code Revision:** All technical revisions must be contained within their respective numbered block (e.g., Block #7). If a block number is missing, propose creating the new block number(s).
// **Deployment Shortcut:** The Developer uses the shortcut: `save "remarks"`
// This command performs: `git add .`, `git commit -m "remarks"`, `git push`, and `clasp deploy`. Assume successful deployment requires a non-empty commit.
