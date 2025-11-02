// ---------------------------------------------------------------------------------
// FILE: 04_SwarmSpecialists.ts
// PURPOSE: Contains all Domain Swarm Agents (execution logic for external APIs).
// NOTE: This file depends on files 01 and 02.
// ---------------------------------------------------------------------------------

// ========== Specialist: Sheets (CRUD operations) ==========

/**
 * Helper to find a data agent configuration row by name from the DataAgents sheet.
 * @param {string} agentName The name of the agent to look up.
 * @param {object[]} agentsTblRows The rows from the DataAgents sheet.
 * @returns {object | undefined} The agent configuration row.
 */
function getAgentRowByName_(agentName, agentsTblRows) {
  const n = String(agentName || '').toLowerCase();
  return agentsTblRows.find(r =>
    String(r.agentName || r.AgentName || '').toLowerCase() === n
  );
}

/**
 * Handles sheet data manipulation commands ("add X to List" or "list List").
 * @param {object} params Object containing {text: string} and {userId: string}.
 * @returns {object} {ok: boolean, message: string}
 */
function cmd_HandleSheetData_(params) {
  try {
    const text = params.text || '';
    // naive intents: "add X to AgentName" or "list AgentName"
    const addMatch = text.match(/add\s+(.*)\s+to\s+([\w-]+)/i);
    const listMatch = text.match(/list\s+([\w-]+)/i);

    // Read DataAgents to find target sheet details
    const agentsTbl = readTable_(CFG_.DATAAGENTS_SHEET).rows || [];

    if (addMatch) {
      const item = addMatch[1].trim();
      const agent = addMatch[2].trim();
      const row = getAgentRowByName_(agent, agentsTbl);
      
      // Determine the target sheet name
      const sheetName = row ? (row.sheetName || row.SheetName || agent) : agent;
      
      // Enforce minimal header for the dynamic sheet
      const header = ['ts', 'item']; 
      appendRow_(sheetName, header, { ts: new Date(), item });
      
      return { ok: true, message: `✅ Added to ${sheetName}: ${item}` };
    }

    if (listMatch) {
      const agent = listMatch[1].trim();
      const row = getAgentRowByName_(agent, agentsTbl);
      
      const sheetName = row ? (row.sheetName || row.SheetName || agent) : agent;
      const tbl = readTable_(sheetName);
      
      // Limit list output to 20 items for readability
      const items = (tbl.rows || []).map(r => `• ${r.item || JSON.stringify(r)}`).slice(0, 20);
      
      return { ok: true, message: items.length ?
        `📋 ${sheetName}\n` + items.join('\n') : `📭 No items in ${sheetName}.`
      };
    }

    return { 
      ok: false, 
      message: `I can add/list items.\nTry: 'add milk to HomeErrands' or 'list HomeErrands'` 
    };
  } catch (e) {
    log_('ERROR', 'cmd_HandleSheetData_', { err: e.message });
    return { ok: false, message: '⚠️ Sheet handler error.' };
  }
}


// ========== Specialist: Gmail (Read/Draft Helpers) ==========

/**
 * Helper function to read Gmail threads based on a query.
 * @param {string} query Gmail search query string.
 * @param {number} count Max number of emails to retrieve.
 * @returns {object} {ok: true, message: string} or {ok: false, message: string}
 */
function gmail_read_(query, count) {
  try {
    const num = Math.min(Math.max(parseInt(count) || 3, 1), 10);
    const threads = GmailApp.search(query, 0, num);
    
    if (!threads.length) {
      return { ok: true, message: `📭 No emails found for query: "${query}"` };
    }
    
    const summaries = threads.map(t => {
      const firstMsg = t.getMessages()[0];
      const subject = t.getFirstMessageSubject();
      const from = firstMsg.getFrom().split('<')[0].trim();
      return `• *${subject}* (from ${from})`;
    });

    return { 
      ok: true, 
      message: `Found ${summaries.length} emails:\n${summaries.join('\n')}` 
    };
  } catch (e) {
    log_('ERROR', 'gmail_read_', { err: e.message, query });
    return { ok: false, message: `⚠️ Error reading emails: ${e.message}` };
  }
}

/**
 * Helper function to create a Gmail draft.
 * @param {string} to Recipient email address.
 * @param {string} subject Email subject line.
 * @param {string} body Email body text.
 * @returns {object} {ok: true, message: string} or {ok: false, message: string}
 */
function gmail_draft_(to, subject, body) {
  try {
    if (!to || !subject || !body) {
      return { ok: false, message: `⚠️ AI failed to provide to, subject, or body.` };
    }
    
    // Creates the draft in the user's Gmail account
    const draft = GmailApp.createDraft(to, subject, body); 
    
    return { 
      ok: true, 
      message: `✅ Draft created successfully.\n**To:** ${to}\n**Subject:** ${subject}\n\nI have saved this in your Drafts folder for you to review and send.` 
    };
  } catch (e) {
    log_('ERROR', 'gmail_draft_', { err: e.message });
    return { ok: false, message: `⚠️ Error creating draft: ${e.message}` };
  }
}

/**
 * Handles 'handle_gmail' requests using Query 2 (OpenAI).
 * Parses user text into 'read' or 'draft' commands.
 * @param {object} params Object containing {text: string}.
 * @returns {object} {ok: boolean, message: string}
 */
function cmd_HandleGmail_(params) {
  try {
    const text = params.text || '';

    // 1. Define the System Prompt for the Gmail Specialist (Query 2)
    const systemPrompt = `You are a "Query 2" Gmail specialist.
Your ONLY job is to convert the user's request into a single, valid JSON command.
You must choose one of the following actions: "read" or "draft".

1.  **"read" action**: Use for any request to find, list, or read emails.
    Example: {"action": "read", "query": "from:bob@acme.com in:inbox", "count": 5}

2.  **"draft" action**: Use for any request to write, compose, or draft an email.
    Example: {"action": "draft", "to": "sales@acme.com", "subject": "New PO #12345", "body": "Hello,\n\nPlease find attached PO #12345.\n\nBest,"}

Respond with ONLY the JSON object and nothing else.`;

    // 2. Call OpenAI (Query 2)
    const aiResult = callOpenAI_(systemPrompt, text);
    if (!aiResult.ok) {
      return { ok: false, message: `⚠️ AI Error (Query 2): ${aiResult.error}` };
    }

    // 3. Parse the AI's JSON command
    let cmd;
    try {
      // Clean potential markdown code blocks (e.g., ```json\n{...}```)
      const jsonString = aiResult.response.replace(/```json\n|```/g, '').trim();
      cmd = JSON.parse(jsonString);
    } catch (e) {
      log_('ERROR', 'cmd_HandleGmail_json_parse', { response: aiResult.response, err: e.message });
      return { ok: false, message: `⚠️ AI returned invalid JSON: ${aiResult.response}` };
    }

    // 4. Execute the command
    log_('INFO', 'cmd_HandleGmail_cmd', { cmd });
    switch (cmd.action) {
      case 'read':
        return gmail_read_(cmd.query, cmd.count);
      case 'draft':
        return gmail_draft_(cmd.to, cmd.subject, cmd.body);
      default:
        return { ok: false, message: `⚠️ AI returned an unknown action: ${cmd.action}` };
    }

  } catch (e) {
    log_('ERROR', 'cmd_HandleGmail_', { err: e.message });
    return { ok: false, message: '⚠️ Gmail handler error.' };
  }
}

// ========== Specialist: Calendar (Stub) ==========
function cmd_HandleCalendar_(params) {
  // Logic for CalendarApp integration
  return { ok: true, message: `📅 CALENDAR STUB: I will soon handle: "${params.text || ''}".` };
}

// ========== Specialist: Tasks (Stub) ==========
function cmd_HandleTasks_(params) {
  // Logic for TasksApp integration
  return { ok: true, message: `✅ TASKS STUB: I will soon handle: "${params.text || ''}".` };
}

// ========== Specialist: Drive (Stub for Future Expansion) ==========
function cmd_HandleDrive_(params) {
  // Logic for DriveApp integration
  return { ok: true, message: `☁️ DRIVE STUB: I will soon handle Drive requests: "${params.text || ''}".` };
}
