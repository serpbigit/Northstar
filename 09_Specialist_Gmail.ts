// ========== Block#8 — Specialist: Gmail (Query 2) ==========

// ========== TYPE DEFINITIONS ==========

interface GmailReadCommand {
  action: 'read';
  query: string;
  count: number;
  reply_lang?: Language;
}

interface GmailDraftCommand {
  action: 'draft';
  to: string;
  subject: string;
  body: string;
  reply_lang?: Language;
}

type GmailCommand = GmailReadCommand | GmailDraftCommand;

/**
 * Helper function to get the fallback help text for this specialist.
 */
function getGmailHelp_(): string {
  try {
    const manifest = getHandlerManifest_();
    if (!manifest.ok) return 'An error occurred.';

    const gmailHandler = manifest.handlers.find(h => h.key === 'handle_gmail');
    return `⚠️ ${gmailHandler?.fallback || 'Please be more specific. I may need a recipient, subject, and body.'}`;
  } catch (e) {
    return '⚠️ To help with email, please be specific. For drafts, I need a recipient, subject, and body.';
  }
}

/**
 * Helper function to read Gmail threads based on a query.
 */
function gmail_read_(cmd: GmailReadCommand): SpecialistResult {
  try {
    const { query, count, reply_lang: lang = 'en' } = cmd;
    const num = Math.min(Math.max(count || 3, 1), 10);
    const threads = GmailApp.search(query, 0, num);

    if (!threads.length) {
      const message = lang === 'he' ? `📭 לא נמצאו אימיילים עבור השאילתה: "${query}"` : `📭 No emails found for query: "${query}"`;
      return { ok: true, message };
    }

    if (threads.length === 1) {
      const thread = threads[0];
      const subject = thread.getFirstMessageSubject();
      const from = thread.getMessages()[0].getFrom().split('<')[0].trim();
      const link = thread.getPermalink();
      const linkText = lang === 'he' ? 'פתח ב-Gmail' : 'Open in Gmail';
      const message = lang === 'he'
        ? `נמצא אימייל 1:\n• *${subject}* (מאת ${from}) ${linkText}`
        : `Found 1 email:\n• *${subject}* (from ${from}) ${linkText}`;
      return { ok: true, message };
    }

    const summaries = threads.map(t => {
      const subject = t.getFirstMessageSubject();
      const from = t.getMessages()[0].getFrom().split('<')[0].trim();
      const fromText = lang === 'he' ? 'מאת' : 'from';
      return `• *${subject}* (${fromText} ${from})`;
    });

    const message = lang === 'he'
      ? `נמצאו ${summaries.length} אימיילים:\n${summaries.join('\n')}`
      : `Found ${summaries.length} emails:\n${summaries.join('\n')}`;
    return { ok: true, message };
  } catch (e) {
    log_('ERROR', 'gmail_read_', { err: (e as Error).message, query: cmd.query });
    return { ok: false, message: `⚠️ Error reading emails: ${(e as Error).message}` };
  }
}

/**
 * Helper function to SEND a Gmail email.
 */
function gmail_send_(cmd: { to: string, subject: string, body: string, reply_lang?: Language }): { ok: boolean, message?: string, error?: string } {
  try {
    const { to, subject, body, reply_lang: lang = 'en' } = cmd;
    if (!to || !subject || !body) return { ok: false, error: 'Missing to, subject, or body' };

    GmailApp.sendEmail(to, subject, body);
    const successMsg = lang === 'he' ? `✅ נשלח בהצלחה אל: ${to}` : `✅ Successfully sent to: ${to}`;
    return { ok: true, message: successMsg };
  } catch (e) {
    log_('ERROR', 'gmail_send_', { err: (e as Error).message });
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Handles 'handle_gmail' requests using Query 2 (OpenAI).
 */
function cmd_HandleGmail_(params: SpecialistParams): SpecialistResult {
  try {
    const text = params.text || '';
    const systemPrompt = `You are a "Query 2" Gmail specialist. Your ONLY job is to convert the user's request into a single, valid JSON command.

You must respond with ONLY the JSON object and nothing else.
You must choose one of the following actions: "read" or "draft".
You MUST also include a "reply_lang" key set to the detected language of the user's prompt (e.g., "en", "he").

1.  **"read" action**:
    *   User: "show me my last 3 unread emails from 'hello@world.com'"
        -> {"action": "read", "query": "is:unread from:hello@world.com", "count": 3, "reply_lang": "en"}

2.  **"draft" action**:
    *   User: "draft an email to reuven007@gmail.com with the subject 'Polaris Test Draft' and the body 'This is a test message.'"
        -> {"action": "draft", "to": "reuven007@gmail.com", "subject": "Polaris Test Draft", "body": "This is a test message.", "reply_lang": "en"}
    *   User: "שלח מייל ל-test@example.com עם נושא 'בדיקה' ותוכן 'זוהי הודעת בדיקה'"
        -> {"action": "draft", "to": "test@example.com", "subject": "בדיקה", "body": "זוהי הודעת בדיקה", "reply_lang": "he"}

If any required field for a draft (to, subject, body) is missing from the user's text, you MUST return that field as null in the JSON.
For example, if the user says "draft an email to bob":
-> {"action": "draft", "to": "bob", "subject": null, "body": null, "reply_lang": "en"}`;

    const aiResult = callOpenAI_(systemPrompt, text);
    if (!aiResult.ok) {
      log_('ERROR', 'cmd_HandleGmail_AI_call', { err: aiResult.error });
      return { ok: false, message: getGmailHelp_() };
    }

    const parseResult = parseAiJson_<GmailCommand>(aiResult.response);
    if (!parseResult.ok) {
      log_('ERROR', 'cmd_HandleGmail_json_parse', { response: aiResult.response, err: parseResult.error });
      return { ok: false, message: getGmailHelp_() };
    }

    const cmd = parseResult.data;
    if (!cmd || !cmd.action) return { ok: false, message: getGmailHelp_() };

    log_('INFO', 'cmd_HandleGmail_cmd', { cmd });

    switch (cmd.action) {
      case 'read':
        return gmail_read_(cmd);
      case 'draft':
        const { to, subject, body, reply_lang: lang = 'en' } = cmd;
        if (!to || !subject || !body) return { ok: false, message: getGmailHelp_() };
        const pendingActionId = `gmail-send-${Utilities.getUuid()}`;
        CacheService.getScriptCache().put(pendingActionId, JSON.stringify(cmd), 300);
        const approvalUrl = `${ScriptApp.getService().getUrl()}?action=gmail_send_confirm&id=${pendingActionId}`;
        const linkText = lang === 'he' ? 'לחץ כאן לשליחה מיידית' : 'CLICK HERE TO SEND NOW';
        const message = `*Gmail Approval Needed*\n> **To:** ${to}\n> **Subject:** ${subject}\n\n${linkText}`;
        return { ok: true, message: message };
      default:
        log_('WARN', 'cmd_HandleGmail_unknown_action', { cmd });
        return { ok: false, message: getGmailHelp_() };
    }
  } catch (e) {
    log_('ERROR', 'cmd_HandleGmail_', { err: (e as Error).message });
    return { ok: false, message: '⚠️ Gmail handler error.' };
  }
}