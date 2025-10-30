// ========== Block#8 — Specialist: Gmail (Query 2) ==========

/*
 * Helper function to get the fallback help text for this specialist.
*/
function getGmailHelp_() {
  try {
    const manifest = getHandlerManifest_();
    if (!manifest.ok) return 'An error occurred.';
    
    const gmailHandler = manifest.handlers.find(h => h.key === 'handle_gmail');
    const fallbackMsg = (gmailHandler && gmailHandler.fallback) 
      ? gmailHandler.fallback 
      : 'Please be more specific. I may need a recipient, subject, and body.';
      
    return `⚠️ ${fallbackMsg}`;
  } catch (e) {
    return '⚠️ To help with email, please be specific. For drafts, I need a recipient, subject, and body.';
  }
}

/*
 * Helper function to read Gmail threads based on a query.
 * (Multilingual and provides permalink for single-thread results)
 */
function gmail_read_(cmd) {
  try {
    const { query, count, reply_lang: lang = 'en' } = cmd;

    const num = Math.min(Math.max(parseInt(count) || 3, 1), 10);
    const threads = GmailApp.search(query, 0, num);
    
    if (!threads.length) {
      if (lang === 'he') {
        return { ok: true, message: `📭 לא נמצאו אימיילים עבור השאילתה: "${query}"` };
      }
      return { ok: true, message: `📭 No emails found for query: "${query}"` };
    }

    // If we found exactly one thread, provide the link.
    if (threads.length === 1) {
      const thread = threads[0];
      const firstMsg = thread.getMessages()[0];
      const subject = thread.getFirstMessageSubject();
      const from = firstMsg.getFrom().split('<')[0].trim();
      const link = thread.getPermalink(); // Get the direct URL
      
      const linkText = (lang === 'he') ? 'פתח ב-Gmail' : 'Open in Gmail';

      const message = (lang === 'he')
        ? `נמצא אימייל 1:\n• *${subject}* (מאת ${from}) [${linkText}](${link})`
        : `Found 1 email:\n• *${subject}* (from ${from}) [${linkText}](${link})`;
      
      return { ok: true, message: message };
    }

    // If we found multiple threads, list them as before.
    const summaries = threads.map(t => {
      const firstMsg = t.getMessages()[0];
      const subject = t.getFirstMessageSubject();
      const from = firstMsg.getFrom().split('<')[0].trim();
      
      const fromText = (lang === 'he') ? 'מאת' : 'from';
      return `• *${subject}* (${fromText} ${from})`;
    });

    const message = (lang === 'he')
      ? `נמצאו ${summaries.length} אימיילים:\n${summaries.join('\n')}`
      : `Found ${summaries.length} emails:\n${summaries.join('\n')}`;

    return { ok: true, message: message };

  } catch (e) {
    log_('ERROR', 'gmail_read_', { err: e.message, query });
    return { ok: false, message: `⚠️ Error reading emails: ${e.message}` };
  }
}

/*
 * Helper function to SEND a Gmail email.
 * This is called by the new doGet handler.
 */
function gmail_send_(cmd) {
  try {
    const { to, subject, body, reply_lang: lang = 'en' } = cmd;

    if (!to || !subject || !body) {
      return { ok: false, error: 'Missing to, subject, or body' };
    }
    
    GmailApp.sendEmail(to, subject, body);
    
    const successMsg = (lang === 'he')
      ? `✅ נשלח בהצלחה אל: ${to}`
      : `✅ Successfully sent to: ${to}`;
      
    return { ok: true, message: successMsg };

  } catch (e) {
    log_('ERROR', 'gmail_send_', { err: e.message });
    return { ok: false, error: e.message };
  }
}


/*
 * Handles 'handle_gmail' requests using Query 2 (OpenAI).
 */
function cmd_HandleGmail_(params) {
  try {
    const text = params.text || '';

    // 1. Define the System Prompt (remains the same)
    const systemPrompt = `You are a "Query 2" Gmail specialist. Your ONLY job is to convert the user's request into a single, valid JSON command. ... (rest of prompt)`;

    // 2. Call OpenAI (Query 2)
    const aiResult = callOpenAI_(systemPrompt, text);
    if (!aiResult.ok) {
      log_('ERROR', 'cmd_HandleGmail_AI_call', { err: aiResult.error });
      return { ok: false, message: getGmailHelp_() };
    }

    // 3. Parse the AI's JSON command
    let cmd;
    // ... (parsing remains the same)
    try {
      const jsonString = aiResult.response.replace(/```json\n|```/g, '').trim();
      cmd = JSON.parse(jsonString);
      
      if (!cmd || !cmd.action) {
        throw new Error('AI returned empty or invalid command.');
      }
      
      if (cmd.action === 'read' && !cmd.count) cmd.count = 3;

    } catch (e) {
      log_('ERROR', 'cmd_HandleGmail_json_parse', { response: aiResult.response, err: e.message });
      return { ok: false, message: getGmailHelp_() };
    }

    // 4. Execute the command
    log_('INFO', 'cmd_HandleGmail_cmd', { cmd });
    
    switch (cmd.action) {
      case 'read':
        return gmail_read_(cmd);
      
      case 'draft':
        // ** NEW FLOW: PROPOSE HYPERLINK, DON'T EXECUTE **
        try {
          const { to, subject, body, reply_lang: lang = 'en' } = cmd;
          if (!to || !subject || !body) {
            return { ok: false, message: getGmailHelp_() };
          }
          
          // Store payload for the click handler to use
          const pendingActionId = `gmail-send-${Utilities.getUuid()}`;
          const cache = CacheService.getScriptCache();
          cache.put(pendingActionId, JSON.stringify(cmd), 300); // Store for 5 mins

          // Get the script URL for the link action
          // NOTE: This requires the script to be deployed as a Web App (Publish -> Deploy as Web App)
          const scriptUrl = ScriptApp.getService().getUrl();
          const approvalUrl = `${scriptUrl}?action=gmail_send_confirm&id=${pendingActionId}`;
          
          const refId = pendingActionId.slice(-6).toUpperCase(); 
          
          // Build the hyperlink text message
          const linkText = (lang === 'he') ? 'לחץ כאן לשליחה מיידית' : 'CLICK HERE TO SEND NOW';
          
          let message = `*Gmail Approval Needed (Ref: ${refId})*`;
          message += `\n> **To:** ${to}\n> **Subject:** ${subject}`;
          message += `\n\n[${linkText}](${approvalUrl})`;
          
          // Return the plain text message with the hyperlink
          return { ok: true, message: message };

        } catch (e) {
          log_('ERROR', 'cmd_HandleGmail_hyperlink_proposal', { err: e.message });
          return { ok: false, message: '⚠️ Error building email proposal link. Check Web App deployment status.' };
        }

      default:
        log_('WARN', 'cmd_HandleGmail_unknown_action', { cmd });
        return { ok: false, message: getGmailHelp_() };
    }

  } catch (e) {
    log_('ERROR', 'cmd_HandleGmail_', { err: e.message });
    return { ok: false, message: '⚠️ Gmail handler error.' };
  }
}
