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
function getAgentRowByName_(agentName: any, agentsTblRows: any): any {
  const n: any = String(agentName || '').toLowerCase();
  return agentsTblRows.find((r: any) =>
    String(r.agentName || r.AgentName || '').toLowerCase() === n
  );
}

/**
 * Handles sheet data manipulation commands ("add X to List" or "list List").
 * @param {object} params Object containing {text: string} and {userId: string}.
 * @returns {object} {ok: boolean, message: string}
 */
function cmd_HandleSheetData_(params: any): any {
  try {
    const text: any = params.text || '';
    const addMatch: any = text.match(/add\s+(.*)\s+to\s+([\w-]+)/i);
    const listMatch: any = text.match(/list\s+([\w-]+)/i);

    const agentsTbl: any = readTable_(CFG_.DATAAGENTS_SHEET).rows || [];

    if (addMatch) {
      const item: any = addMatch[1].trim();
      const agent: any = addMatch[2].trim();
      const row: any = getAgentRowByName_(agent, agentsTbl);
      
      const sheetName: any = row ? (row.sheetName || row.SheetName || agent) : agent;
      
      const header: any = ['ts', 'item']; 
      appendRow_(sheetName, header, { ts: new Date(), item });
      
      return { ok: true, message: `✅ Added to ${sheetName}: ${item}` };
    }

    if (listMatch) {
      const agent: any = listMatch[1].trim();
      const row: any = getAgentRowByName_(agent, agentsTbl);
      
      const sheetName: any = row ? (row.sheetName || row.SheetName || agent) : agent;
      const tbl: any = readTable_(sheetName);
      
      const items: any = (tbl.rows || []).map((r: any) => `• ${r.item || JSON.stringify(r)}`).slice(0, 20);
      
      return { ok: true, message: items.length ?
        `📋 ${sheetName}\n` + items.join('\n') : `📭 No items in ${sheetName}.`
      };
    }

    return { 
      ok: false, 
      message: `I can add/list items.\nTry: 'add milk to HomeErrands' or 'list HomeErrands'` 
    };
  } catch (e: any) {
    log_('ERROR', 'cmd_HandleSheetData_', { err: e.message });
    return { ok: false, message: '⚠️ Sheet handler error.' };
  }
}


// ========== Specialist: Gmail (Read/Draft Helpers) ==========

/**
 * Helper function to read Gmail threads based on a query.
 */
function gmail_read_(query: any, count: any): any {
  try {
    const num: any = Math.min(Math.max(parseInt(count) || 3, 1), 10);
    const threads: any = GmailApp.search(query, 0, num);
    
    if (!threads.length) {
      return { ok: true, message: `📭 No emails found for query: "${query}"` };
    }
    
    const summaries: any = threads.map((t: any) => {
      const firstMsg: any = t.getMessages()[0];
      const subject: any = t.getFirstMessageSubject();
      const from: any = firstMsg.getFrom().split('<')[0].trim();
      return `• *${subject}* (from ${from})`;
    });

    return { 
      ok: true, 
      message: `Found ${summaries.length} emails:\n${summaries.join('\n')}` 
    };
  } catch (e: any) {
    log_('ERROR', 'gmail_read_', { err: e.message, query });
    return { ok: false, message: `⚠️ Error reading emails: ${e.message}` };
  }
}

/**
 * Helper function to create a Gmail draft.
 */
function gmail_draft_(to: any, subject: any, body: any): any {
  try {
    if (!to || !subject || !body) {
      return { ok: false, message: `⚠️ AI failed to provide to, subject, or body.` };
    }
    
    const draft: any = GmailApp.createDraft(to, subject, body); 
    
    return { 
      ok: true, 
      message: `✅ Draft created successfully.\n**To:** ${to}\n**Subject:** ${subject}\n\nI have saved this in your Drafts folder for you to review and send.` 
    };
  } catch (e: any) {
    log_('ERROR', 'gmail_draft_', { err: e.message });
    return { ok: false, message: `⚠️ Error creating draft: ${e.message}` };
  }
}

/**
 * Handles 'handle_gmail' requests using Query 2 (OpenAI).
 */
function cmd_HandleGmail_(params: any): any {
  try {
    const text: any = params.text || '';

    // 1. Define the System Prompt for the Gmail Specialist (Query 2)
    const systemPrompt: string = `You are a "Query 2" Gmail specialist.
Your ONLY job is to convert the user's request into a single, valid JSON command.
You must choose one of the following actions: "read" or "draft".

1.  **"read" action**: Use for any request to find, list, or read emails.
    Example: {"action": "read", "query": "from:bob@acme.com in:inbox", "count": 5}

2.  **"draft" action**: Use for any request to write, compose, or draft an email.
    Example: {"action": "draft", "to": "sales@acme.com", "subject": "New PO #12345", "body": "Hello,\n\nPlease find attached PO #12345.\n\nBest,"}

Respond with ONLY the JSON object and nothing else.`;

    // 2. Call OpenAI (Query 2)
    const aiResult: any = callOpenAI_(systemPrompt, text);
    if (!aiResult.ok) {
      return { ok: false, message: `⚠️ AI Error (Query 2): ${aiResult.error}` };
    }

    // 3. Parse the AI's JSON command
    let cmd: any;
    try {
      const jsonString: any = aiResult.response.replace(/```json\n|```/g, '').trim();
      cmd = JSON.parse(jsonString);
    } catch (e: any) {
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

  } catch (e: any) {
    log_('ERROR', 'cmd_HandleGmail_', { err: e.message });
    return { ok: false, message: '⚠️ Gmail handler error.' };
  }
}

// ========== Specialist: Calendar (Stub) ==========
function cmd_HandleCalendar_(params: any): any {
  return { ok: true, message: `📅 CALENDAR STUB: I will soon handle: "${params.text || ''}".` };
}

// ========== Specialist: Tasks (Stub) ==========
function cmd_HandleTasks_(params: any): any {
  return { ok: true, message: `✅ TASKS STUB: I will soon handle: "${params.text || ''}".` };
}

// ========== Specialist: Drive (Stub for Future Expansion) ==========
function cmd_HandleDrive_(params: any): any {
  return { ok: true, message: `☁️ DRIVE STUB: I will soon handle Drive requests: "${params.text || ''}".` };
}
