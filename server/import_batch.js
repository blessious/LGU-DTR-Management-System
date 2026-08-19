const IMPORT_BATCH_SIZE = 1000;

function timestampToMinute(timestamp) {
  return String(timestamp || '').replace(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}):\d{2}$/, '$1:00');
}

function normalizeImportRows(rows) {
  const unique = new Map();
  for (const row of rows) {
    const employeeId = String(row.employee_id || '').trim();
    const createdAt = timestampToMinute(row.created_at).trim();
    if (!employeeId || !createdAt) continue;
    unique.set(`${employeeId}|${createdAt}`, { employee_id: employeeId, created_at: createdAt });
  }
  return [...unique.values()].sort((left, right) => {
    const byEmployee = Number(left.employee_id) - Number(right.employee_id);
    return byEmployee || left.created_at.localeCompare(right.created_at);
  });
}

async function insertImportRowsBatch(connection, rows, batchSize = IMPORT_BATCH_SIZE) {
  let inserted = 0;
  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const values = rows.slice(offset, offset + batchSize).map(row => [row.employee_id, row.created_at]);
    const [result] = await connection.query(
      'INSERT IGNORE INTO imports (employee_id, created_at) VALUES ?',
      [values]
    );
    inserted += Number(result.affectedRows || 0);
  }
  return inserted;
}

function importRefreshScope(rows, startDate, endDate) {
  const dates = rows.map(row => row.created_at.slice(0, 10)).sort();
  return {
    employee_ids: [...new Set(rows.map(row => Number(row.employee_id)))],
    start_date: startDate || dates[0],
    end_date: endDate || dates[dates.length - 1],
    all_history: false
  };
}

module.exports = { normalizeImportRows, insertImportRowsBatch, importRefreshScope };
