// ─── DATA EXPORT UTILITIES ──────────────────────────────────────────────────

/**
 * Export transactions as a CSV file download.
 * @param {Array} transactions - array of { date, category, amount, description }
 * @param {string} [filename='transacciones.csv']
 */
export function exportToCSV(transactions, filename = 'transacciones.csv') {
  if (!transactions || transactions.length === 0) return;

  const headers = ['Fecha', 'Categoria', 'Monto', 'Descripcion'];
  const rows = transactions.map(tx => [
    tx.date,
    tx.category,
    tx.amount,
    `"${(tx.description || '').replace(/"/g, '""')}"`,
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename);
}

/**
 * Export transactions as a pretty-printed JSON file download.
 * @param {Array} transactions - array of transaction objects
 * @param {string} [filename='transacciones.json']
 */
export function exportToJSON(transactions, filename = 'transacciones.json') {
  if (!transactions || transactions.length === 0) return;

  const data = transactions.map(tx => ({
    fecha: tx.date,
    categoria: tx.category,
    monto: tx.amount,
    descripcion: tx.description,
  }));

  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  triggerDownload(blob, filename);
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
