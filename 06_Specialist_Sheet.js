// ========== Block#5 — Specialist: Sheets (Query 2) ==========
function cmd_HandleSheetData_(params) {
  try {
    const text = params.text || '';
    // naive intents: "add X to AgentName" or "list AgentName"
    const addMatch = text.match(/add\s+(.*)\s+to\s+([\w-]+)/i);
    const listMatch = text.match(/list\s+([\w-]+)/i);

    // read DataAgents with your column names
    const agentsTbl = readTable_(CFG_.DATAAGENTS_SHEET).rows || [];

    // helper to map row props (support your headers)
    const getAgentRowByName = (name) => {
      const n = String(name||'').toLowerCase();
      return agentsTbl.find(r =>
        String(r.agentName || r.AgentName || '').toLowerCase() === n
      );
    };

    if (addMatch) {
      const item = addMatch[1].trim();
      const agent = addMatch[2].trim();
      const row = getAgentRowByName(agent);
      const sheetName = row ? (row.sheetName || row.SheetName || agent) : agent;
      const header = ['ts','item'];
      appendRow_(sheetName, header, { ts: new Date(), item });
      return { ok:true, message: `✅ Added to ${sheetName}: ${item}` };
    }

    if (listMatch) {
      const agent = listMatch[1].trim();
      const row = getAgentRowByName(agent);
      const sheetName = row ? (row.sheetName || row.SheetName || agent) : agent;
      const tbl = readTable_(sheetName);
      const items = (tbl.rows||[]).map(r => `• ${r.item || JSON.stringify(r)}`).slice(0,20);
      return { ok:true, message: items.length ? `📋 ${sheetName}\n`+items.join('\n') : `📭 No items in ${sheetName}.` };
    }

    return { ok:false, message:`I can add/list items.\nTry: 'add milk to HomeErrands' or 'list HomeErrands'` };

  } catch (e) {
    log_('ERROR','cmd_HandleSheetData_', {err:e.message});
    return { ok:false, message:'⚠️ Sheet handler error.' };
  }
}


