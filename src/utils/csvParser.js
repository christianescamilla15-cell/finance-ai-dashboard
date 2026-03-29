// ─── CSV / TEXT PARSER ───────────────────────────────────────────────────────

export const parseImportData = (text, delimiter = null) => {
  const lines = text.trim().split("\n").filter(l => l.trim());
  if (lines.length < 2) return { transactions: [], error: "Se necesitan al menos 2 lineas (encabezado + datos)" };

  // Auto-detect delimiter
  if (!delimiter) {
    const firstLine = lines[0];
    if (firstLine.includes("\t")) delimiter = "\t";
    else if (firstLine.includes(";")) delimiter = ";";
    else delimiter = ",";
  }

  const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase().replace(/['"]/g, ""));

  // Map common header names
  const dateIdx = headers.findIndex(h => ["date", "fecha", "date_time", "fecha_hora"].includes(h));
  const catIdx = headers.findIndex(h => ["category", "categoria", "categoría", "cat", "tipo"].includes(h));
  const amountIdx = headers.findIndex(h => ["amount", "monto", "cantidad", "importe", "valor"].includes(h));
  const descIdx = headers.findIndex(h => ["description", "descripcion", "descripción", "desc", "concepto", "detalle"].includes(h));

  if (dateIdx === -1 || amountIdx === -1) {
    return { transactions: [], error: "Se requieren al menos las columnas 'fecha' y 'monto'. Columnas detectadas: " + headers.join(", ") };
  }

  const transactions = [];
  const errors = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter).map(c => c.trim().replace(/^['"]|['"]$/g, ""));
    if (cols.length < Math.max(dateIdx, amountIdx) + 1) {
      errors.push(`Linea ${i + 1}: columnas insuficientes`);
      continue;
    }

    // Parse date — support various formats
    let dateStr = cols[dateIdx];
    let parsedDate;
    // Try DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = dateStr.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/);
    if (dmyMatch) {
      parsedDate = new Date(`${dmyMatch[3]}-${dmyMatch[2].padStart(2, "0")}-${dmyMatch[1].padStart(2, "0")}`);
    } else {
      parsedDate = new Date(dateStr);
    }

    if (isNaN(parsedDate.getTime())) {
      errors.push(`Linea ${i + 1}: fecha invalida '${dateStr}'`);
      continue;
    }

    // Parse amount — handle commas as decimals, currency symbols
    let amountStr = cols[amountIdx].replace(/[$€£MXN\s]/gi, "").replace(/,(\d{2})$/, ".$1").replace(/,/g, "");
    const amount = Math.round(Math.abs(parseFloat(amountStr)));
    if (isNaN(amount) || amount === 0) {
      errors.push(`Linea ${i + 1}: monto invalido '${cols[amountIdx]}'`);
      continue;
    }

    const category = catIdx !== -1 && cols[catIdx] ? cols[catIdx] : "General";
    const description = descIdx !== -1 && cols[descIdx] ? cols[descIdx] : `${category} — Transaccion #${i}`;

    transactions.push({
      id: `IMP-${Date.now()}-${i}`,
      date: parsedDate.toISOString().split("T")[0],
      category,
      amount,
      description,
    });
  }

  transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
  return { transactions, errors: errors.length > 0 ? errors : null };
};
