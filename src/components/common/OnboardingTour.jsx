// ─── ONBOARDING TOUR ──────────────────────────────────────────────────────────
import { useState, useEffect, useRef, useMemo, useCallback } from "react";

export function OnboardingTour({ lang, onSetTab, onGenerateForecast, chatbotRef, onOpenChatbot, onSendChatMessage }) {
  const [step, setStep] = useState(0);
  const [active, setActive] = useState(true);
  const [spotlightRect, setSpotlightRect] = useState(null);
  const tourLang = useRef(lang);

  const isEN = () => tourLang.current === 'en';

  const updateSpotlight = useCallback((selector) => {
    if (!selector) { setSpotlightRect(null); return; }
    const el = document.querySelector(selector);
    if (!el) { setSpotlightRect(null); return; }
    const rect = el.getBoundingClientRect();
    setSpotlightRect({ top: rect.top - 8, left: rect.left - 8, width: rect.width + 16, height: rect.height + 16 });
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const STEPS = useMemo(() => [
    {
      type: 'modal',
      title: { en: 'FinanceAI Dashboard', es: 'Dashboard FinanceAI' },
      text: {
        en: "AI-powered financial analytics with statistical anomaly detection (z-score), cash flow forecasting (linear regression), and an integrated AI chatbot. Analyze transactions across 7 spending categories with real-time insights.\n\nLet me show you!",
        es: "Analitica financiera con IA: deteccion estadistica de anomalias (z-score), proyeccion de flujo de caja (regresion lineal), y chatbot IA integrado. Analiza transacciones en 7 categorias de gasto con insights en tiempo real.\n\nDejame mostrarte!"
      },
      btn: { en: 'Start Tour', es: 'Iniciar Tour' },
      showLangSelector: true,
    },
    {
      type: 'spotlight',
      selector: '[data-tour="kpi-cards"]',
      title: { en: 'Key Performance Indicators', es: 'Indicadores Clave' },
      text: {
        en: 'These 4 cards show your main financial metrics: total spending, anomalies detected, top spending category, and monthly average. Each includes a sparkline showing the trend.',
        es: 'Estas 4 tarjetas muestran tus metricas financieras principales: gasto total, anomalias detectadas, categoria principal, y promedio mensual. Cada una incluye un sparkline con la tendencia.'
      },
      btn: { en: 'Next', es: 'Siguiente' },
    },
    {
      type: 'spotlight',
      selector: '[data-tour="overview-charts"]',
      title: { en: 'Overview Charts', es: 'Graficas de Resumen' },
      text: {
        en: 'The area chart shows monthly spending trends. The donut chart breaks down spending by category. Hover over any element for exact amounts.',
        es: 'La grafica de area muestra la tendencia mensual de gasto. La grafica de dona desglosa el gasto por categoria. Pasa el cursor sobre cualquier elemento para ver montos exactos.'
      },
      btn: { en: 'Next', es: 'Siguiente' },
    },
    {
      type: 'spotlight',
      selector: '[data-tour="anomalies-tab"]',
      title: { en: 'Anomaly Detection', es: 'Deteccion de Anomalias' },
      text: {
        en: 'Switching to the Anomalies tab... Transactions are flagged when they deviate more than 2 standard deviations from their category mean (z-score analysis). Click any anomaly for a detailed AI-powered statistical diagnosis.',
        es: 'Cambiando a la pestana de Anomalias... Las transacciones se marcan cuando se desvian mas de 2 desviaciones estandar de la media de su categoria (analisis z-score). Haz click en cualquier anomalia para un diagnostico estadistico detallado.'
      },
      btn: { en: 'Try it', es: 'Probarlo' },
      action: () => { onSetTab('anomalias'); },
    },
    {
      type: 'spotlight',
      selector: '[data-tour="transactions-tab"]',
      title: { en: 'Transaction Explorer', es: 'Explorador de Transacciones' },
      text: {
        en: 'Switching to the Transactions tab... Browse all transactions with search and category filters. Anomalous transactions are highlighted in red with a "!" indicator.',
        es: 'Cambiando a la pestana de Transacciones... Explora todas las transacciones con busqueda y filtros por categoria. Las transacciones anomalas se resaltan en rojo con un indicador "!".'
      },
      btn: { en: 'Next', es: 'Siguiente' },
      action: () => { onSetTab('transacciones'); },
    },
    {
      type: 'spotlight',
      selector: '[data-tour="projection-tab"]',
      title: { en: 'Cash Flow Projection', es: 'Proyeccion de Flujo de Caja' },
      text: {
        en: 'Switching to Projection... This uses linear regression on your monthly data to forecast next month\'s spending. It generates alerts, recommendations, and an R-squared confidence score. Generating forecast now...',
        es: 'Cambiando a Proyeccion... Utiliza regresion lineal sobre tus datos mensuales para proyectar el gasto del proximo mes. Genera alertas, recomendaciones, y un score de confianza R-cuadrado. Generando forecast...'
      },
      btn: { en: 'Try it', es: 'Probarlo' },
      action: () => { onSetTab('proyeccion'); setTimeout(() => onGenerateForecast(), 300); },
    },
    {
      type: 'spotlight',
      selector: '[data-tour="chatbot"]',
      title: { en: 'AI Financial Assistant', es: 'Asistente Financiero IA' },
      text: {
        en: 'The AI chatbot can answer questions about your data, explain anomalies, navigate sections, and generate insights. It uses Claude AI with tool-use for precise answers. Opening and asking about anomalies...',
        es: 'El chatbot IA puede responder preguntas sobre tus datos, explicar anomalias, navegar secciones, y generar insights. Usa Claude AI con tool-use para respuestas precisas. Abriendo y preguntando sobre anomalias...'
      },
      btn: { en: 'Try it', es: 'Probarlo' },
      action: () => {
        onSetTab('overview');
        setTimeout(() => {
          onOpenChatbot();
          setTimeout(() => onSendChatMessage(tourLang.current === 'en' ? 'Show me anomalies' : 'Muestra anomalias'), 500);
        }, 300);
      },
    },
    {
      type: 'modal',
      title: { en: 'Tour Complete!', es: 'Tour Completado!' },
      text: {
        en: 'You\'ve seen all the key features of FinanceAI Dashboard:\n\n- KPI cards with sparkline trends\n- Monthly area chart + category donut\n- Statistical anomaly detection (z-score)\n- Transaction explorer with filters\n- Linear regression cash flow forecast\n- AI chatbot with Claude tool-use\n\nFeel free to explore on your own. You can also import your own CSV data!',
        es: 'Has visto todas las funcionalidades clave del Dashboard FinanceAI:\n\n- Tarjetas KPI con sparklines de tendencia\n- Grafica de area mensual + dona por categoria\n- Deteccion estadistica de anomalias (z-score)\n- Explorador de transacciones con filtros\n- Proyeccion de flujo de caja con regresion lineal\n- Chatbot IA con Claude tool-use\n\nExplora libremente. Tambien puedes importar tus propios datos CSV!'
      },
      btn: { en: 'Finish Tour', es: 'Finalizar Tour' },
    },
  ], [onSetTab, onGenerateForecast, onOpenChatbot, onSendChatMessage]);

  const totalSteps = STEPS.length;
  const currentStep = STEPS[step];

  useEffect(() => {
    if (!active || !currentStep) return;
    if (currentStep.action) {
      currentStep.action();
    }
    if (currentStep.selector) {
      const timer = setTimeout(() => updateSpotlight(currentStep.selector), 400);
      return () => clearTimeout(timer);
    } else {
      setSpotlightRect(null);
    }
  }, [step, active]);

  const [showCompletion, setShowCompletion] = useState(false);

  const advance = () => {
    if (step >= totalSteps - 1) {
      setShowCompletion(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setStep(s => s + 1);
  };

  const restartTour = () => {
    setShowCompletion(false);
    setStep(0);
  };

  const skip = () => { setActive(false); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  if (!active) return null;

  if (showCompletion) {
    return (
      <>
        <style>{`
          @keyframes tourFadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        `}</style>
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, pointerEvents: 'auto', cursor: 'pointer' }} onClick={(e) => {
          if (e.target.closest('[data-tour-completion]') || e.target.closest('button')) return;
          setActive(false); window.scrollTo({ top: 0, behavior: 'smooth' });
        }}>
          <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
            <rect width="100%" height="100%" fill="rgba(0,0,0,0.75)" />
          </svg>
          <div data-tour-completion style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            width: 460, maxWidth: '90vw',
            background: '#0D1117', border: '1px solid rgba(16,185,129,0.3)',
            borderRadius: 16, padding: '32px 28px', boxShadow: '0 16px 64px rgba(0,0,0,0.6)',
            animation: 'tourFadeIn 0.35s ease', textAlign: 'center',
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>&#10003;</div>
            <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 800, color: '#F0FDF4', fontFamily: "'Bricolage Grotesque', sans-serif" }}>
              {isEN() ? 'Tour Complete!' : 'Tour Completado!'}
            </h2>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.65 }}>
              {isEN() ? 'You explored all the key features.' : 'Exploraste todas las funcionalidades clave.'}
            </p>
            <div style={{
              display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 24,
            }}>
              {['83 Tests', 'Anomaly Detection', 'Forecasting', 'AI Chatbot'].map(tag => (
                <span key={tag} style={{
                  padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                  background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)',
                  color: '#10B981', fontFamily: "'DM Mono', monospace",
                }}>{tag}</span>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
              <button onClick={restartTour} style={{
                padding: '10px 22px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(16,185,129,0.3)',
                color: '#10B981', fontFamily: "'DM Sans', sans-serif",
              }}>
                {isEN() ? 'Restart Tour' : 'Reiniciar Tour'}
              </button>
              <button onClick={() => { setActive(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{
                background: 'linear-gradient(135deg, #10B981, #059669)',
                border: 'none', borderRadius: 8, padding: '10px 24px',
                cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#fff',
                fontFamily: "'DM Sans', sans-serif",
                boxShadow: '0 0 20px rgba(16,185,129,0.3)',
              }}>
                {isEN() ? 'Explore' : 'Explorar'}
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  const isModal = currentStep?.type === 'modal';

  return (
    <>
      <style>{`
        @keyframes tourFadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes tourPulseRing { 0%,100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.4); } 50% { box-shadow: 0 0 0 8px rgba(16,185,129,0); } }
      `}</style>

      {/* Fixed Skip Tour button */}
      <button onClick={skip} style={{
        position: 'fixed', top: 16, right: 16, zIndex: 99999,
        background: 'rgba(30,41,59,0.95)', border: '1px solid #475569',
        color: '#94a3b8', padding: '8px 16px', borderRadius: 8,
        cursor: 'pointer', fontSize: 13, backdropFilter: 'blur(8px)',
      }}>
        {isEN() ? '\u2715 Skip Tour' : '\u2715 Saltar Tour'}
      </button>

      {/* Backdrop — tap anywhere to advance */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        pointerEvents: 'auto',
        cursor: 'pointer',
      }} onClick={(e) => {
        if (e.target.closest('[data-tour-tooltip]') || e.target.closest('button')) return;
        advance();
      }}>
        {/* Dark overlay with hole */}
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
          <defs>
            <mask id="tour-mask">
              <rect width="100%" height="100%" fill="white" />
              {spotlightRect && (
                <rect
                  x={spotlightRect.left} y={spotlightRect.top}
                  width={spotlightRect.width} height={spotlightRect.height}
                  rx="12" fill="black"
                />
              )}
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(0,0,0,0.75)" mask="url(#tour-mask)" />
        </svg>

        {/* Spotlight ring */}
        {spotlightRect && (
          <div style={{
            position: 'absolute',
            top: spotlightRect.top, left: spotlightRect.left,
            width: spotlightRect.width, height: spotlightRect.height,
            border: '2px solid rgba(16,185,129,0.5)',
            borderRadius: 12,
            animation: 'tourPulseRing 2s infinite',
            pointerEvents: 'none',
          }} />
        )}

        {/* Tooltip / Modal */}
        {isModal ? (
          <div data-tour-tooltip style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            width: 460, maxWidth: '90vw',
            background: '#0D1117', border: '1px solid rgba(16,185,129,0.3)',
            borderRadius: 16, padding: '32px 28px', boxShadow: '0 16px 64px rgba(0,0,0,0.6)',
            animation: 'tourFadeIn 0.35s ease',
          }}>
            {currentStep.showLangSelector && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
                {['es', 'en'].map(l => (
                  <button key={l} onClick={() => { tourLang.current = l; setStep(0); }} style={{
                    padding: '6px 16px', borderRadius: 8, cursor: 'pointer',
                    fontSize: 13, fontWeight: 700, fontFamily: "'DM Mono', monospace",
                    background: tourLang.current === l ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${tourLang.current === l ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.1)'}`,
                    color: tourLang.current === l ? '#10B981' : 'rgba(255,255,255,0.4)',
                  }}>{l.toUpperCase()}</button>
                ))}
              </div>
            )}
            <h2 style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 800, color: '#F0FDF4', fontFamily: "'Bricolage Grotesque', sans-serif" }}>
              {currentStep.title[tourLang.current]}
            </h2>
            <p style={{ margin: '0 0 24px', fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.65, whiteSpace: 'pre-line' }}>
              {currentStep.text[tourLang.current]}
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', fontFamily: "'DM Mono', monospace" }}>
                {step + 1} / {totalSteps}
              </span>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={skip} style={{
                  background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
                  padding: '8px 16px', cursor: 'pointer', fontSize: 12, color: 'rgba(255,255,255,0.4)',
                  fontFamily: "'DM Sans', sans-serif",
                }}>
                  {isEN() ? 'Skip' : 'Saltar'}
                </button>
                <button onClick={advance} style={{
                  background: 'linear-gradient(135deg, #10B981, #059669)',
                  border: 'none', borderRadius: 8, padding: '8px 20px',
                  cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#fff',
                  fontFamily: "'DM Sans', sans-serif",
                  boxShadow: '0 0 20px rgba(16,185,129,0.3)',
                }}>
                  {step === totalSteps - 1
                    ? (isEN() ? 'Finish Tour' : 'Finalizar Tour')
                    : (currentStep.btn[tourLang.current] + ' →')}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div data-tour-tooltip style={(() => {
            const tooltipH = 200, tooltipW = 400, vpPad = 16;
            if (!spotlightRect) {
              return { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: tooltipW, maxWidth: '90vw', background: '#0D1117', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 14, padding: '20px 22px', boxShadow: '0 12px 48px rgba(0,0,0,0.5)', animation: 'tourFadeIn 0.3s ease' };
            }
            const roomBelow = window.innerHeight - (spotlightRect.top + spotlightRect.height);
            const roomAbove = spotlightRect.top;
            let ttStyle;
            if (roomBelow >= tooltipH + vpPad + 16) {
              let ttTop = spotlightRect.top + spotlightRect.height + 16;
              let ttLeft = Math.max(vpPad, Math.min(spotlightRect.left, window.innerWidth - tooltipW - vpPad));
              ttTop = Math.max(vpPad, Math.min(window.innerHeight - tooltipH - vpPad, ttTop));
              ttStyle = { position: 'absolute', top: ttTop, left: ttLeft };
            } else if (roomAbove >= tooltipH + vpPad + 16) {
              let ttTop = spotlightRect.top - tooltipH - 16;
              let ttLeft = Math.max(vpPad, Math.min(spotlightRect.left, window.innerWidth - tooltipW - vpPad));
              ttTop = Math.max(vpPad, Math.min(window.innerHeight - tooltipH - vpPad, ttTop));
              ttStyle = { position: 'absolute', top: ttTop, left: ttLeft };
            } else {
              ttStyle = { position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', top: 'auto', zIndex: 10001 };
            }
            return { ...ttStyle, width: tooltipW, maxWidth: '90vw', background: '#0D1117', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 14, padding: '20px 22px', boxShadow: '0 12px 48px rgba(0,0,0,0.5)', animation: 'tourFadeIn 0.3s ease' };
          })()}>
            <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700, color: '#10B981' }}>
              {currentStep.title[tourLang.current]}
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
              {currentStep.text[tourLang.current]}
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', fontFamily: "'DM Mono', monospace" }}>
                {step + 1} / {totalSteps}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={skip} style={{
                  background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6,
                  padding: '6px 12px', cursor: 'pointer', fontSize: 11, color: 'rgba(255,255,255,0.35)',
                  fontFamily: "'DM Sans', sans-serif",
                }}>
                  {isEN() ? 'Skip Tour' : 'Saltar Tour'}
                </button>
                <button onClick={advance} style={{
                  background: 'linear-gradient(135deg, #10B981, #059669)',
                  border: 'none', borderRadius: 6, padding: '6px 16px',
                  cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#fff',
                  fontFamily: "'DM Sans', sans-serif",
                  boxShadow: '0 0 16px rgba(16,185,129,0.3)',
                }}>
                  {currentStep.btn[tourLang.current] + ' →'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
