# 📊 FinanceAI — Dashboard Financiero con Detección de Anomalías

> Analiza transacciones en tiempo real, detecta patrones anómalos con scoring estadístico y genera diagnósticos automáticos con IA. Incluye proyecciones de flujo de caja con alertas ejecutivas.

---

## Módulos

### 1. Overview
KPIs en tiempo real: gasto total 90 días, anomalías detectadas, categoría dominante y promedio mensual con sparklines de tendencia.

### 2. Detección de Anomalías
Cada transacción recibe un **score de riesgo 0-100%**. Al hacer clic en "Analizar IA", Claude API genera:
- **Diagnóstico** en 2 líneas
- **Posibles causas** (3 bullets)
- **Nivel de riesgo** (bajo/medio/alto + justificación)
- **Acción recomendada** concreta

### 3. Transacciones
Tabla completa con búsqueda y filtro por categoría. Las anomalías aparecen marcadas en rojo con su score visible.

### 4. Proyecciones con IA
Claude analiza los últimos 90 días y devuelve:
- Proyección del próximo mes en MXN
- Tendencia (alcista/bajista/estable)
- Variación esperada en %
- Alertas de riesgo
- Recomendaciones ejecutivas
- Resumen en 2 líneas para dirección

## Instalación

```bash
git clone https://github.com/christianescamilla15-cell/finance-ai-dashboard
cd finance-ai-dashboard
npm install
cp .env.example .env
npm run dev   # http://localhost:3003
```

## Variables de entorno

```env
VITE_ANTHROPIC_API_KEY=sk-ant-...
```

## Casos de uso reales

- Detección de cargos duplicados o no autorizados
- Alertas de gasto excesivo por categoría
- Proyecciones para presentaciones a dirección
- Conciliación de gastos mensual asistida por IA

## Stack

`React` `Claude API` `Python` `Pandas` `PostgreSQL`

---

[![Portfolio](https://img.shields.io/badge/Portfolio-ch65--portfolio-6366F1?style=flat)](https://ch65-portfolio.vercel.app)
