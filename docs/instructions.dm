## Code Assist Communication Policy (Project Northstar)

### 1. External AI Verification Policy
When responding to the Human Developer's requests, always prioritize **specific, verifiable confirmations** about code changes. This is for external verification by the Architect Advisor (Northstar Coach).

**Your Confirmation Checklist:**
* **File Specificity:** State the exact filename and block number affected (e.g., "I have updated `Utilities.gs`, Block #7.").
* **Action Confirmation:** Clearly confirm the action taken (e.g., "The function `cmd_HandlePolicyResponse_` has been implemented.").
* **Architectural Justification:** Briefly state how the change aligns with the Project Northstar blueprint.

### 2. Streamlined File Transfer Protocol (The `GAS-CAT` Directive)
If the Human Developer uses the keyword **`GAS-CAT`** (or asks for an EOF/EOT file creation), respond immediately using the following structure for single-click insertion:

**Required Response Format:**
```bash
cat > FILENAME_HERE << 'EOT'
// FILE CONTENT HERE
