// ========== FILE: 08_Specialist_Cal.gs ==========

// ========== Block#7 — Specialists: Calendar (Query 2) ==========

/*
 * Helper function to get the fallback help text for this specialist.
 */
function getCalendarHelp_() {
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

/*
 * Helper function to build a permalink for a Google Calendar event.
 */
function calendar_buildEventLink_(event) {
  try {
    const calId = event.getOriginalCalendarId();
    const eventId = event.getId().split('@')[0]; // We only need the part before the @
    
    // This specific format (eventID + " " + calendarID) is required.
    const b64_eid = Utilities.base64Encode(`${eventId} ${calId}`);
    
    // This is the standard URL for a Google Calendar event
    return `https://www.google.com/calendar/event?eid=${b64_eid}`;
    
  } catch (e) {
    log_('ERROR', 'calendar_buildEventLink_', { err: e.message });
    return ''; // Return empty string on failure
  }
}

/*
 * Helper function to read calendar events.
 * (Multilingual and provides permalinks)
 */
function calendar_read_(cmd) {
  try {
    const { start, end, reply_lang: lang = 'en' } = cmd;
    
    const cal = CalendarApp.getDefaultCalendar();
    if (!cal) {
      return { ok: false, message: "⚠️ Could not find default calendar." };
    }
    
    const startTime = new Date(start);
    const endTime = new Date(end);
    const events = cal.getEvents(startTime, endTime);
    
    const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(); // Get the local TZ for display
    
    if (!events.length) {
      const startStr = Utilities.formatDate(startTime, tz, "MMM d");
      const endStr = Utilities.formatDate(endTime, tz, "MMM d");
      const rangeStr = (startStr === endStr) ? startStr : `${startStr} to ${endStr}`;
      
      if (lang === 'he') {
        return { ok: true, message: `🗓️ לא נמצאו אירועים עבור ${rangeStr}.` };
      }
      return { ok: true, message: `🗓️ No events found for ${rangeStr}.` };
    }

    // If we found exactly one event, provide the link.
    if (events.length === 1) {
      const event = events[0];
      const title = event.getTitle();
      let startStr = (lang === 'he') ? '(כל היום)' : '(All Day)';
      if (!event.isAllDayEvent()) {
         startStr = Utilities.formatDate(event.getStartTime(), tz, "h:mm a"); // Use TZ when formatting
      }
      
      const link = calendar_buildEventLink_(event);
      const linkText = (lang === 'he') ? 'פתח ביומן' : 'Open in Calendar';
      
      const message = (lang === 'he')
        ? `נמצא אירוע 1:\n• *${title}* [${startStr}] [${linkText}](${link})`
        : `Found 1 event:\n• *${title}* [${startStr}] [${linkText}](${link})`;
        
      return { ok: true, message: message };
    }

    // If we found multiple events, list them (now with links too).
    const summaries = events.map(e => {
      const title = e.getTitle();
      let startStr = (lang === 'he') ? '(כל היום)' : '(All Day)';
      if (!e.isAllDayEvent()) {
         startStr = Utilities.formatDate(e.getStartTime(), tz, "h:mm a"); // Use TZ when formatting
      }
      const link = calendar_buildEventLink_(e);
      const linkText = (lang === 'he') ? 'קישור' : 'link';

      return `• *${title}* [${startStr}] [[${linkText}]](${link})`;
    });
    
    const message = (lang === 'he')
      ? `נמצאו ${summaries.length} אירועים:\n${summaries.join('\n')}`
      : `Found ${summaries.length} events:\n${summaries.join('\n')}`;
      
    return { ok: true, message: message };

  } catch (e) {
    log_('ERROR', 'calendar_read_', { err: e.message, cmd });
    return { ok: false, message: `⚠️ Error reading calendar events: ${e.message}` };
  }
}

/*
 * Helper function to create a calendar event.
 * (Multilingual)
 */
function calendar_create_(cmd) {
  try {
    const { title, start, end, reply_lang: lang = 'en' } = cmd;

    if (!title || !start || !end) {
      return { ok: false, message: getCalendarHelp_() };
    }
    
    const cal = CalendarApp.getDefaultCalendar();
    const startTime = new Date(start);
    const endTime = new Date(end);
    const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(); // Get the local TZ for display

    const event = cal.createEvent(title, startTime, endTime);
    
    const startTimeStr = Utilities.formatDate(startTime, tz, "h:mm a");
    const startDateStr = Utilities.formatDate(startTime, tz, "MMM d, yyyy");

    if (lang === 'he') {
      return {
        ok: true,
        message: `✅ אירוע נוצר בהצלחה: *${event.getTitle()}* ב-${startDateStr} בשעה ${startTimeStr}.`
      };
    }
    return {
      ok: true,
      message: `✅ Event created successfully: *${event.getTitle()}* on ${startDateStr} at ${startTimeStr}.`
    };
  } catch (e) {
    log_('ERROR', 'calendar_create_', { err: e.message, cmd });
    return { ok: false, message: `⚠️ Error creating calendar event: ${e.message}` };
  }
}


/*
 * Handles 'handle_calendar' requests using Query 2 (OpenAI).
 * (Detects language and uses helpers for robust errors)
 */
function cmd_HandleCalendar_(params) {
  try {
    const text = params.text || '';
    const now = new Date();
    // Get the script's configured timezone (Asia/Jerusalem)
    const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(); 
    // Format the date/time in the local TZ, so the AI sees the correct local date
    const todayISO = Utilities.formatDate(now, tz, "yyyy-MM-dd'T'HH:mm:ss"); // <-- FIXED LINE
    
    // 1. Define the System Prompt
    const systemPrompt = `You are a "Query 2" Calendar specialist. Your ONLY job is to convert the user's request into a single, valid JSON command based on the current time.

The current date and time is: ${todayISO}

You must respond in a valid ISO 8601 date-time format (YYYY-MM-DDTHH:MM:SS).
You must choose one of the following actions: "read" or "create".
You MUST also include a "reply_lang" key set to the detected language of the user's prompt (e.g., "en", "he").

1.  **"read" action**:
    * User: "what's on my calendar today?"
        -> {"action": "read", "start": "2025-10-30T00:00:00", "end": "2025-10-30T23:59:59", "reply_lang": "en"}
    * User: "מה יש לי בלוז מחר?"
        -> {"action": "read", "start": "2025-10-31T00:00:00", "end": "2025-10-31T23:59:59", "reply_lang": "he"}

2.  **"create" action**:
    * User: "schedule a dentist appointment tomorrow at 3pm for 1 hour"
        -> {"action": "create", "title": "Dentist Appointment", "start": "2025-10-31T15:00:00", "end": "2025-10-31T16:00:00", "reply_lang": "en"}
    * User: "קבע פגישת צוות בשישי ב-10 בבוקר"
        -> {"action": "create", "title": "פגישת צוות", "start": "2025-11-01T10:00:00", "end": "2025-11-01T10:30:00", "reply_lang": "he"}

Respond with ONLY the JSON object and nothing else.`;

    // 2. Call OpenAI (Query 2)
    const aiResult = callOpenAI_(systemPrompt, text);
    if (!aiResult.ok) {
      log_('ERROR', 'cmd_HandleCalendar_AI_call', { err: aiResult.error });
      return { ok: false, message: getCalendarHelp_() }; // Use help on AI fail
    }

    // 3. Parse the AI's JSON command
    let cmd;
    try {
      const jsonString = aiResult.response.replace(/```json\n|```/g, '').trim();
      cmd = JSON.parse(jsonString);
      if (!cmd || !cmd.action) {
        throw new Error('AI returned empty or invalid command.');
      }
    } catch (e) {
      log_('ERROR', 'cmd_HandleCalendar_json_parse', { response: aiResult.response, err: e.message });
      return { ok: false, message: getCalendarHelp_() }; // Use help on JSON fail
    }

    // 4. Execute the command
    log_('INFO', 'cmd_HandleCalendar_cmd', { cmd });
    
    switch (cmd.action) {
      case 'read':
        return calendar_read_(cmd); // Pass full cmd object
      
      case 'create':
        return calendar_create_(cmd); // Pass full cmd object

      default:
        log_('WARN', 'cmd_HandleCalendar_unknown_action', { cmd });
        return { ok: false, message: getCalendarHelp_() }; // Use help on unknown action
    }

  } catch (e) {
    log_('ERROR', 'cmd_HandleCalendar_', { err: e.message });
    return { ok: false, message: '⚠️ Calendar handler error.' };
  }
}

/*
 * STUB for 'handle_tasks'.
 */
function cmd_HandleTasks_(params) {
  try {
    const text = params.text || '';

    // TODO: Add "Query 2" AI call here to parse 'text' into JSON

    return {
      ok: true,
      message: `🤖 **Tasks Stub:** I will soon handle: "${text}"`
    };

  } catch (e) {
    log_('ERROR', 'cmd_HandleTasks_', { err: e.message });
    return { ok: false, message: '⚠️ Tasks handler error.' };
  }
}