import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Lenis from "lenis";

// Utils
import { detectAnomalies } from './utils/anomalyDetection';
import { computeMetrics } from './utils/metrics';
import { generateRealAnalysis } from './utils/analysis';
import { generateRealForecast } from './utils/forecast';

// Constants
import { INITIAL_MOCK } from './constants/mockData';
import { STRINGS } from './constants/translations';
import { APPLE_EASE } from './constants/animation';

// Hooks
import { useTheme } from './hooks/useTheme';

// Components
import { KPICards } from './components/dashboard/KPICards';
import { OverviewTab } from './components/dashboard/OverviewTab';
import { AnomalyTable } from './components/dashboard/AnomalyTable';
import { TransactionList } from './components/dashboard/TransactionList';
import { ForecastPanel } from './components/dashboard/ForecastPanel';
import { ImportPanel } from './components/dashboard/ImportPanel';
import { ExportButton } from './components/dashboard/ExportButton';
import { CategoryManager } from './components/dashboard/CategoryManager';
import { FinanceChatbot } from './components/chat/FinanceChatbot';
import { OnboardingTour } from './components/common/OnboardingTour';
import { ContactBar } from './components/common/ContactBar';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { ThemeToggle } from './components/common/ThemeToggle';

const tabVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: APPLE_EASE } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.25, ease: APPLE_EASE } },
};

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function FinancialDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedTx, setSelectedTx] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiError, setAiError] = useState("");
  const [forecastData, setForecastData] = useState(null);
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [forecastError, setForecastError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCat, setFilterCat] = useState("Todas");
  const [rawTransactions, setRawTransactions] = useState(INITIAL_MOCK);
  const [dataSource, setDataSource] = useState("mock");
  const [importSummary, setImportSummary] = useState(null);
  const [lang, setLang] = useState('es');
  const [customCategories, setCustomCategories] = useState([]);
  const [scrollProgress, setScrollProgress] = useState(0);

  const { theme, toggleTheme, colors } = useTheme();
  const t = useMemo(() => STRINGS[lang], [lang]);

  const chatbotOpenRef = useRef(null);
  const chatbotSendRef = useRef(null);

  const isDark = theme === 'dark';

  // ── Lenis smooth scroll ──
  useEffect(() => {
    const lenis = new Lenis({ duration: 1.2, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
    function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
    requestAnimationFrame(raf);
    return () => lenis.destroy();
  }, []);

  // ── Scroll progress ──
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      setScrollProgress(scrollHeight > 0 ? scrollTop / scrollHeight : 0);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Derived data
  const transactions = useMemo(() => detectAnomalies(rawTransactions), [rawTransactions]);
  const metrics = useMemo(() => computeMetrics(transactions), [transactions]);
  const anomalies = useMemo(() => transactions.filter(t => t.isAnomaly).slice(0, 20), [transactions]);
  const monthlyValues = useMemo(() => Object.values(metrics.monthly), [metrics]);
  const allCategories = useMemo(() => [...new Set(transactions.map(t => t.category))].sort(), [transactions]);

  const recentTxs = useMemo(() => transactions.slice(0, 50).filter(t =>
    (filterCat === "Todas" || t.category === filterCat) &&
    (t.description.toLowerCase().includes(searchTerm.toLowerCase()) || t.category.toLowerCase().includes(searchTerm.toLowerCase()))
  ), [transactions, filterCat, searchTerm]);

  // Handlers
  const handleImport = useCallback((imported) => {
    setRawTransactions(imported);
    setDataSource("imported");
    const dates = imported.map(t => t.date).sort();
    setImportSummary(`${imported.length} transacciones importadas (${dates[0]} a ${dates[dates.length - 1]})`);
    setSelectedTx(null); setAiAnalysis(""); setForecastData(null); setFilterCat("Todas"); setSearchTerm("");
  }, []);

  const handleResetToMock = useCallback(() => {
    setRawTransactions(INITIAL_MOCK);
    setDataSource("mock"); setImportSummary(null); setSelectedTx(null);
    setAiAnalysis(""); setForecastData(null); setFilterCat("Todas"); setSearchTerm("");
  }, []);

  const handleAddCategory = useCallback((cat) => {
    setCustomCategories(prev => {
      if (prev.some(c => c.name === cat.name)) return prev;
      return [...prev, cat];
    });
  }, []);

  const analyzeAnomaly = async (tx) => {
    setSelectedTx(tx); setAiAnalysis(""); setAiError(""); setLoadingAI(true);
    await new Promise(r => setTimeout(r, 1200));
    const analysis = generateRealAnalysis(tx, transactions);
    setAiAnalysis(analysis); setLoadingAI(false);
  };

  const generateForecast = async () => {
    setLoadingForecast(true); setForecastData(null); setForecastError("");
    await new Promise(r => setTimeout(r, 1500));
    const result = generateRealForecast(transactions, metrics);
    if (result.error) { setForecastError(result.error); } else { setForecastData(result); }
    setLoadingForecast(false);
  };

  const accent = "#10B981";
  const tabStyle = (tab) => ({
    padding: "8px 16px", borderRadius: 12, cursor: "pointer",
    fontSize: 12, fontWeight: 600, border: "none",
    fontFamily: "'DM Sans', sans-serif",
    background: activeTab === tab ? `${accent}18` : "transparent",
    color: activeTab === tab ? accent : (isDark ? "rgba(255,255,255,0.4)" : "#94A3B8"),
    transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
  });

  return (
    <>
    <div style={{ minHeight: "100vh", background: colors.bg, color: colors.text, fontFamily: "'DM Sans', sans-serif", padding: "20px 16px", transition: "background 0.5s cubic-bezier(0.16, 1, 0.3, 1), color 0.5s cubic-bezier(0.16, 1, 0.3, 1)" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&family=Bricolage+Grotesque:wght@700;800&display=swap');
        body { background: ${colors.bg}; color: ${colors.text}; transition: background 0.5s cubic-bezier(0.16, 1, 0.3, 1), color 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
        html { background: ${colors.bg}; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes shimmer { 0% { background-position: -200% 0 } 100% { background-position: 200% 0 } }
        @keyframes spinAnim { to { transform: rotate(360deg) } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.15)'}; border-radius: 2px; }
        ::-webkit-scrollbar-track { background: transparent; }
        input:focus, select:focus, textarea:focus { outline: none; }
      `}</style>

      {/* Film grain overlay */}
      {isDark && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9998, pointerEvents: "none",
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E")`,
          opacity: 0.4,
        }} />
      )}

      {/* Scroll progress bar */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, height: 2, zIndex: 9999,
        background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)",
      }}>
        <div style={{
          height: "100%", width: `${scrollProgress * 100}%`,
          background: `linear-gradient(90deg, ${accent}, #34D399)`,
          transition: "width 0.1s linear",
          borderRadius: "0 1px 1px 0",
        }} />
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* HEADER */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: APPLE_EASE }}
          style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}
        >
          <div>
            <h1 style={{
              margin: "0 0 4px", fontFamily: "'Bricolage Grotesque', sans-serif",
              fontSize: "clamp(22px, 4vw, 34px)", fontWeight: 800,
              color: isDark ? "#F0FDF4" : "#1E293B", letterSpacing: "-0.03em",
            }}>
              Finance<span style={{ color: accent }}>AI</span>
            </h1>
            <p style={{ margin: 0, fontSize: 12, color: colors.subtextColor, fontFamily: "'DM Mono', monospace" }}>
              {t.subtitulo}
            </p>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <div role="tablist" aria-label="Secciones del dashboard" style={{
              display: "flex", gap: 4,
              background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)",
              border: `1px solid ${colors.border}`,
              padding: 3, borderRadius: 16,
              backdropFilter: isDark ? "blur(12px)" : "none",
            }}>
              {[
                { key: "overview", label: t.overview },
                { key: "anomalias", label: t.anomalias },
                { key: "transacciones", label: t.transacciones },
                { key: "proyeccion", label: t.proyeccion },
              ].map(tab => (
                <button
                  key={tab.key}
                  role="tab"
                  aria-selected={activeTab === tab.key}
                  aria-controls={`tabpanel-${tab.key}`}
                  aria-label={`Seccion ${tab.label}`}
                  style={tabStyle(tab.key)}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <ExportButton transactions={transactions} t={t} colors={colors} />
            <ThemeToggle theme={theme} toggleTheme={toggleTheme} lang={lang} />
            <button
              onClick={() => setLang(prev => prev === 'es' ? 'en' : 'es')}
              aria-label={`Cambiar idioma a ${lang === 'es' ? 'ingles' : 'espanol'}`}
              style={{
                background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
                border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "#CBD5E1"}`,
                borderRadius: 12, padding: "6px 12px", cursor: "pointer",
                fontSize: 12, fontFamily: "'DM Mono', monospace", marginLeft: 0,
                transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                backdropFilter: isDark ? "blur(12px)" : "none",
              }}
            >
              <span style={{ fontWeight: lang === 'es' ? 700 : 400, color: lang === 'es' ? accent : (isDark ? 'rgba(255,255,255,0.4)' : '#94A3B8') }}>ES</span>
              <span style={{ margin: '0 4px', color: isDark ? 'rgba(255,255,255,0.2)' : '#CBD5E1' }}>/</span>
              <span style={{ fontWeight: lang === 'en' ? 700 : 400, color: lang === 'en' ? accent : (isDark ? 'rgba(255,255,255,0.4)' : '#94A3B8') }}>EN</span>
            </button>
          </div>
        </motion.div>

        {/* DATA SOURCE BANNER + IMPORT */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5, ease: APPLE_EASE }}
          style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            marginBottom: 16, padding: "10px 16px",
            background: dataSource === "imported" ? "rgba(139,92,246,0.06)" : (isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)"),
            border: `1px solid ${dataSource === "imported" ? "rgba(139,92,246,0.2)" : colors.border}`,
            borderRadius: 16,
            backdropFilter: isDark ? "blur(12px)" : "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: dataSource === "imported" ? "#8B5CF6" : (isDark ? "rgba(255,255,255,0.2)" : "#CBD5E1"), boxShadow: dataSource === "imported" ? "0 0 8px rgba(139,92,246,0.4)" : "none" }} />
            <span style={{ fontSize: 11, color: dataSource === "imported" ? "#C4B5FD" : colors.subtextFaint, fontFamily: "'DM Mono', monospace" }}>
              {dataSource === "imported"
                ? importSummary
                : `${t.datosDemo} ${transactions.length} ${t.transaccionesGeneradas} · ${anomalies.length} ${t.anomaliasDetectadasBanner}`}
            </span>
            {dataSource === "imported" && (
              <button onClick={handleResetToMock} aria-label="Volver a datos de demostracion" style={{
                background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "#CBD5E1"}`,
                borderRadius: 8, padding: "3px 10px", cursor: "pointer",
                fontSize: 10, color: isDark ? "rgba(255,255,255,0.4)" : "#64748B", fontFamily: "'DM Sans', sans-serif",
              }}>
                {t.volverADemo}
              </button>
            )}
          </div>
          <ImportPanel onImport={handleImport} t={t} />
        </motion.div>

        {/* KPI CARDS */}
        <ErrorBoundary fallbackLabel="KPIs">
          <KPICards metrics={metrics} anomalies={anomalies} transactions={transactions} monthlyValues={monthlyValues} t={t} colors={colors} />
        </ErrorBoundary>

        {/* TAB CONTENT */}
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} variants={tabVariants} initial="initial" animate="animate" exit="exit">
            {activeTab === "overview" && (
              <ErrorBoundary fallbackLabel="Overview">
                <div role="tabpanel" id="tabpanel-overview" aria-label="Panel de resumen general">
                  <OverviewTab metrics={metrics} anomalies={anomalies} t={t} onViewAnomalies={() => setActiveTab("anomalias")} colors={colors} />
                </div>
              </ErrorBoundary>
            )}

            {activeTab === "anomalias" && (
              <ErrorBoundary fallbackLabel="Anomalias">
                <div role="tabpanel" id="tabpanel-anomalias" aria-label="Panel de anomalias">
                  <AnomalyTable
                    anomalies={anomalies} selectedTx={selectedTx} setSelectedTx={setSelectedTx}
                    analyzeAnomaly={analyzeAnomaly} loadingAI={loadingAI} aiError={aiError} aiAnalysis={aiAnalysis} t={t}
                  />
                </div>
              </ErrorBoundary>
            )}

            {activeTab === "transacciones" && (
              <ErrorBoundary fallbackLabel="Transacciones">
                <div role="tabpanel" id="tabpanel-transacciones" aria-label="Panel de transacciones">
                  <TransactionList
                    recentTxs={recentTxs} allCategories={allCategories}
                    searchTerm={searchTerm} setSearchTerm={setSearchTerm}
                    filterCat={filterCat} setFilterCat={setFilterCat} t={t} colors={colors}
                    customCategories={customCategories} onAddCategory={handleAddCategory}
                  />
                </div>
              </ErrorBoundary>
            )}

            {activeTab === "proyeccion" && (
              <ErrorBoundary fallbackLabel="Proyeccion">
                <div role="tabpanel" id="tabpanel-proyeccion" aria-label="Panel de proyeccion financiera">
                  <ForecastPanel
                    forecastData={forecastData} loadingForecast={loadingForecast} forecastError={forecastError}
                    generateForecast={generateForecast} metrics={metrics} dataSource={dataSource} lang={lang} t={t} colors={colors}
                  />
                </div>
              </ErrorBoundary>
            )}
          </motion.div>
        </AnimatePresence>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 10, color: isDark ? "rgba(255,255,255,0.1)" : "#CBD5E1", fontFamily: "'DM Mono', monospace", letterSpacing: "0.1em" }}>
          {t.footer}
        </p>
      </div>
    </div>
    <ErrorBoundary fallbackLabel="Chatbot">
      <FinanceChatbot
        metrics={metrics} transactions={transactions} anomalies={anomalies}
        forecastData={forecastData} activeTab={activeTab} onNavigate={setActiveTab}
        lang={lang} t={t}
        onExposeControls={(ctrls) => { chatbotOpenRef.current = ctrls.open; chatbotSendRef.current = ctrls.send; }}
      />
    </ErrorBoundary>
    <OnboardingTour
      lang={lang} onSetTab={setActiveTab} onGenerateForecast={generateForecast}
      onOpenChatbot={() => { if (chatbotOpenRef.current) chatbotOpenRef.current(); }}
      onSendChatMessage={(msg) => { if (chatbotSendRef.current) chatbotSendRef.current(msg); }}
    />
    <ContactBar lang={lang} />
    </>
  );
}
