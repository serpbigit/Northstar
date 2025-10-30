// ========== Block#7 — Specialists: Calendar (Query 2) ==========

// ========== TYPE DEFINITIONS ==========

type Language = 'en' | 'he';

interface CalendarReadCommand {
  action: 'read';
  start: string;
  end: string;
  reply_lang?: Language;
}

interface CalendarCreateCommand {
  action: 'create';
  title: string;
  start: string;
  end: string;
  reply_lang?: Language;
}

type CalendarCommand = CalendarReadCommand | CalendarCreateCommand;

/**
 * Helper function to get the fallback help text for this specialist.
 */
function getCalendarHelp_(): string {
  try {
    const manifest = getHandlerManifest_();
    if (!manifest.ok) return 'An error occurred.';

    const calHandler = manifest.handlers.find(h => h.key === 'handle_calendar');
    const fallbackMsg = (calHandler && calHandler.fallback)
      ? calHandler.fallback
      : 'Please be more specific. I may need a date, time, and title.'; // Hardcoded failsafe

    return `⚠️ ${fallbackMsg}`;
  } catch (e) {
    return '⚠️ To manage your calendar, please tell me what you want to do and when.';
  }
}

/**
 * Helper function to build a permalink for a Google Calendar event.
 */
function calendar_buildEventLink_(event: GoogleAppsScript.Calendar.CalendarEvent): string {
  try {
    const calId = event.getOriginalCalendarId();
    const eventId = event.getId().split('@')[0];
    const b64_eid = Utilities.base64Encode(`${eventId} ${calId}`);
    return `https://www.google.com/calendar/event?eid=${b64_eid}`;
  } catch (e) {
    log_('ERROR', 'calendar_buildEventLink_', { err: (e as Error).message });
    return '';
  }
}

/**
 * Helper function to read calendar events.
 */
function calendar_read_(cmd: CalendarReadCommand): SpecialistResult {
  try {
    const { start, end, reply_lang: lang = 'en' } = cmd;
    const cal = CalendarApp.getDefaultCalendar();
    if (!cal) return { ok: false, message: "⚠️ Could not find default calendar." };

    const startTime = new Date(start);
    const endTime = new Date(end);
    const events = cal.getEvents(startTime, endTime);
    const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();

    if (!events.length) {
      const startStr = Utilities.formatDate(startTime, tz, "MMM d");
      const endStr = Utilities.formatDate(endTime, tz, "MMM d");
      const rangeStr = (startStr === endStr) ? startStr : `${startStr} to ${endStr}`;
      const message = lang === 'he' ? `🗓️ לא נמצאו אירועים עבור ${rangeStr}.` : `🗓️ No events found for ${rangeStr}.`;
      return { ok: true, message };
    }

    if (events.length === 1) {
      const event = events[0];
      const title = event.getTitle();
      let startStr = event.isAllDayEvent() ? (lang === 'he' ? '(כל היום)' : '(All Day)') : Utilities.formatDate(event.getStartTime(), tz, "h:mm a");
      const link = calendar_buildEventLink_(event);
      const linkText = lang === 'he' ? 'פתח ביומן' : 'Open in Calendar';
      const message = lang === 'he'
        ? `נמצא אירוע 1:\n• *${title}* [${startStr}] ${linkText}`
        : `Found 1 event:\n• *${title}* [${startStr}] ${linkText}`;
      return { ok: true, message };
    }

    const summaries = events.map(e => {
      const title = e.getTitle();
      let startStr = e.isAllDayEvent() ? (lang === 'he' ? '(כל היום)' : '(All Day)') : Utilities.formatDate(e.getStartTime(), tz, "h:mm a");
      const link = calendar_buildEventLink_(e);
      const linkText = lang === 'he' ? 'קישור' : 'link';
      return `• *${title}* [${startStr}] [[${linkText}]](${link})`;
    });

    const message = lang === 'he'
      ? `נמצאו ${summaries.length} אירועים:\n${summaries.join('\n')}`
      : `Found ${summaries.length} events:\n${summaries.join('\n')}`;
    return { ok: true, message };
  } catch (e) {
    log_('ERROR', 'calendar_read_', { err: (e as Error).message, cmd });
    return { ok: false, message: `⚠️ Error reading calendar events: ${(e as Error).message}` };
  }
}

/**
 * Helper function to create a calendar event.
 */
function calendar_create_(cmd: CalendarCreateCommand): SpecialistResult {
  try {
    const { title, start, end, reply_lang: lang = 'en' } = cmd;
    if (!title || !start || !end) return { ok: false, message: getCalendarHelp_() };

    const cal = CalendarApp.getDefaultCalendar();
    const startTime = new Date(start);
    const endTime = new Date(end);
    const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
    const event = cal.createEvent(title, startTime, endTime);

    const startTimeStr = Utilities.formatDate(startTime, tz, "h:mm a");
    const startDateStr = Utilities.formatDate(startTime, tz, "MMM d, yyyy");

    const message = lang === 'he'
      ? `✅ אירוע נוצר בהצלחה: *${event.getTitle()}* ב-${startDateStr} בשעה ${startTimeStr}.`
      : `✅ Event created successfully: *${event.getTitle()}* on ${startDateStr} at ${startTimeStr}.`;
    return { ok: true, message };
  } catch (e) {
    log_('ERROR', 'calendar_create_', { err: (e as Error).message, cmd });
    return { ok: false, message: `⚠️ Error creating calendar event: ${(e as Error).message}` };
  }
}

/**
 * Handles 'handle_calendar' requests using Query 2 (OpenAI).
 */
function cmd_HandleCalendar_(params: SpecialistParams): SpecialistResult {
  try {
    const text = params.text || '';
    const now = new Date();
    const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
    const todayISO = Utilities.formatDate(now, tz, "yyyy-MM-dd'T'HH:mm:ss");

    const systemPrompt = `You are a "Query 2" Calendar specialist...`; // Prompt omitted for brevity

    const aiResult = callOpenAI_(systemPrompt, text);
    if (!aiResult.ok) {
      log_('ERROR', 'cmd_HandleCalendar_AI_call', { err: aiResult.error });
      return { ok: false, message: getCalendarHelp_() };
    }

    let cmd: CalendarCommand;
    try {
      const jsonString = aiResult.response.replace(/```json\n|```/g, '').trim();
      cmd = JSON.parse(jsonString);
      if (!cmd || !cmd.action) throw new Error('AI returned empty or invalid command.');
    } catch (e) {
      log_('ERROR', 'cmd_HandleCalendar_json_parse', { response: aiResult.response, err: (e as Error).message });
      return { ok: false, message: getCalendarHelp_() };
    }

    log_('INFO', 'cmd_HandleCalendar_cmd', { cmd });

    switch (cmd.action) {
      case 'read': return calendar_read_(cmd);
      case 'create': return calendar_create_(cmd);
      default:
        log_('WARN', 'cmd_HandleCalendar_unknown_action', { cmd });
        return { ok: false, message: getCalendarHelp_() };
    }
  } catch (e) {
    log_('ERROR', 'cmd_HandleCalendar_', { err: (e as Error).message });
    return { ok: false, message: '⚠️ Calendar handler error.' };
  }
}

/**
 * STUB for 'handle_tasks'.
 */
function cmd_HandleTasks_(params: SpecialistParams): SpecialistResult {
  const text = params.text || '';
  return { ok: true, message: `🤖 **Tasks Stub:** I will soon handle: "${text}"` };
}