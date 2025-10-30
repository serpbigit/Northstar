// ========== Block#5 — Specialist: Sheets (Query 2) ==========

function cmd_HandleSheetData_(params: SpecialistParams): SpecialistResult {
  try {
    const text = params.text || '';
    const addMatch = text.match(/add\s+(.*)\s+to\s+([\w-]+)/i);
    const listMatch = text.match(/list\s+([\w-]+)/i);

    const agentsTblResult = readTable_(CFG_.DATAAGENTS_SHEET);
    const agentsTbl = (agentsTblResult.ok && agentsTblResult.rows) ? agentsTblResult.rows : [];

    const getAgentRowByName = (name: string) => {
      const n = String(name || '').toLowerCase();
      return agentsTbl.find(r =>
        String(r.agentName || r.AgentName || '').toLowerCase() === n
      );
    };

    if (addMatch) {
      const item = addMatch[1].trim();
      const agentName = addMatch[2].trim();
      const row = getAgentRowByName(agentName);
      const sheetName = row ? (row.sheetName || row.SheetName || agentName) : agentName;
      const header = ['ts', 'item'];
      appendRow_(sheetName, header, { ts: new Date(), item });
      return { ok: true, message: `✅ Added to ${sheetName}: ${item}` };
    }

    if (listMatch) {
      const agentName = listMatch[1].trim();
      const row = getAgentRowByName(agentName);
      const sheetName = row ? (row.sheetName || row.SheetName || agentName) : agentName;
      const tbl = readTable_(sheetName);
      const items = (tbl.ok && tbl.rows) ? tbl.rows.map(r => `• ${r.item || JSON.stringify(r)}`).slice(0, 20) : [];
      return { ok: true, message: items.length ? `📋 ${sheetName}\n` + items.join('\n') : `📭 No items in ${sheetName}.` };
    }

    return { ok: false, message: `I can add/list items.\nTry: 'add milk to HomeErrands' or 'list HomeErrands'` };
  } catch (e) {
    log_('ERROR', 'cmd_HandleSheetData_', { err: (e as Error).message });
    return { ok: false, message: '⚠️ Sheet handler error.' };
  }
}