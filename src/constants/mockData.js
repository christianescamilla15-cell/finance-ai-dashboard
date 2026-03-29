// ─── DATA MOCK ────────────────────────────────────────────────────────────────

export const generateMockTransactions = () => {
  const categories = ["Marketing", "Nomina", "Software", "Infraestructura", "Logistica", "Ventas", "Operaciones"];
  const transactions = [];
  const now = new Date();

  for (let i = 89; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const count = Math.floor(Math.random() * 4) + 1;
    for (let j = 0; j < count; j++) {
      const cat = categories[Math.floor(Math.random() * categories.length)];
      const base = { Marketing: 8000, Nomina: 45000, Software: 3500, Infraestructura: 12000, Logistica: 6000, Ventas: 15000, Operaciones: 9000 };
      const variance = 0.25;
      let amount = base[cat] * (1 + (Math.random() - 0.5) * variance);
      // Inject some real outliers for the statistical detector to find
      if (Math.random() < 0.06) amount *= (Math.random() > 0.5 ? 3.2 : 0.15);
      transactions.push({
        id: `TX-${Date.now()}-${i}-${j}`,
        date: date.toISOString().split("T")[0],
        category: cat,
        amount: Math.round(amount),
        description: `${cat} — ${["Factura", "Pago", "Transferencia", "Cargo"][Math.floor(Math.random() * 4)]} #${Math.floor(Math.random() * 9000) + 1000}`,
      });
    }
  }
  return transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
};

export const INITIAL_MOCK = generateMockTransactions();
