// ─── FINANCE CHATBOT ─────────────────────────────────────────────────────────
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { fmt } from '../../utils/formatting';
import { fetchWithRetry } from '../../services/api';
import { FINANCE_TOOLS } from './chatbotTools';
import { executeToolCall } from './chatbotToolExecutor';
import { buildKB, matchIntent } from './chatbotKB';

export function FinanceChatbot({ metrics, transactions, anomalies, forecastData, activeTab, onNavigate, lang, t: chatT, onExposeControls }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesRef = useRef(null);
  const hoverTimer = useRef(null);

  const scroll = () => setTimeout(() => messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: "smooth" }), 50);

  // ─── Tool context ───────────────────────────────────────────────────
  const toolCtx = useMemo(() => ({ anomalies, metrics, transactions, forecastData }), [anomalies, metrics, transactions, forecastData]);

  const handleToolCall = useCallback((toolName, toolInput) => {
    return executeToolCall(toolName, toolInput, toolCtx);
  }, [toolCtx]);

  // ─── Knowledge base ─────────────────────────────────────────────────
  const KB = useMemo(() => buildKB({ metrics, transactions, anomalies, forecastData, activeTab, lang }), [metrics, transactions, anomalies, forecastData, activeTab, lang]);

  const handleMatchIntent = useCallback((text) => {
    return matchIntent(text, KB, onNavigate, lang);
  }, [KB, onNavigate, lang]);

  // ─── Claude API call ────────────────────────────────────────────────
  const callClaudeWithTools = useCallback(async (userText) => {
    const isEN = lang === 'en';
    const totalTx = transactions.length;
    const anomalyCount = anomalies.length;
    const months = Object.keys(metrics.monthly || {}).length;
    const topCat = Object.entries(metrics.byCategory || {}).sort((a, b) => b[1] - a[1]);

    const systemPrompt = `You are FinanceAI, an intelligent financial assistant embedded in a dashboard. ${isEN ? 'Respond in English.' : 'Respond in Spanish.'}

Current dashboard context:
- Total spending: ${fmt(metrics.total)}
- Transactions: ${totalTx}
- Anomalies detected: ${anomalyCount}
- Months of data: ${months}
- Top categories: ${topCat.slice(0, 5).map(([c, v]) => `${c}: ${fmt(v)}`).join(', ')}
- Monthly trend: ${Object.entries(metrics.monthly || {}).sort((a, b) => a[0].localeCompare(b[0])).map(([m, v]) => `${m}: ${fmt(v)}`).join(', ')}

Use tools to answer data questions with precision. Format responses in markdown with **bold** for key figures. Keep answers concise but insightful.`;

    const conversationMessages = [{ role: "user", content: userText }];

    // Agentic loop: keep calling until we get a text response
    let maxIterations = 5;
    while (maxIterations-- > 0) {
      const { data, error: fetchError } = await fetchWithRetry('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          system: systemPrompt,
          tools: FINANCE_TOOLS,
          messages: conversationMessages,
        }),
        timeout: 15000,
      }, 2);

      if (fetchError) throw new Error(fetchError);
      if (!data) throw new Error("Empty API response");

      const textParts = [];
      const toolUses = [];
      for (const block of data.content || []) {
        if (block.type === "text") textParts.push(block.text);
        if (block.type === "tool_use") toolUses.push(block);
      }

      if (toolUses.length > 0) {
        conversationMessages.push({ role: "assistant", content: data.content });
        const toolResults = toolUses.map(tu => ({
          type: "tool_result",
          tool_use_id: tu.id,
          content: JSON.stringify(handleToolCall(tu.name, tu.input)),
        }));
        conversationMessages.push({ role: "user", content: toolResults });

        if (data.stop_reason === "end_turn" && textParts.length > 0) {
          return textParts.join("\n\n");
        }
        continue;
      }

      if (textParts.length > 0) return textParts.join("\n\n");
      throw new Error("Empty response");
    }
    throw new Error("Max iterations reached");
  }, [lang, metrics, transactions, anomalies, handleToolCall]);

  const addBot = useCallback((text) => {
    setMessages(prev => [...prev, { role: "bot", text }]);
    scroll();
  }, []);

  const quickActions = [
    { label: chatT.queEsEsto, query: "que es esto" },
    { label: chatT.anomalias, query: "anomalias" },
    { label: chatT.proyeccion, query: "proyeccion" },
    { label: chatT.importarDatos, query: "importar" },
    { label: chatT.metodologia, query: "metodologia" },
  ];

  const handleSend = useCallback(async (text) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    setMessages(prev => [...prev, { role: "user", text: trimmed }]);
    setInput("");
    setIsPinned(true);
    setIsLoading(true);
    scroll();

    try {
      const response = await callClaudeWithTools(trimmed);
      setMessages(prev => [...prev, { role: "bot", text: response, source: "ai" }]);
    } catch {
      // Fallback to local KB
      const response = handleMatchIntent(trimmed);
      setMessages(prev => [...prev, { role: "bot", text: response, source: "local" }]);
    } finally {
      setIsLoading(false);
      scroll();
    }
  }, [handleMatchIntent, callClaudeWithTools, isLoading]);

  const open = () => {
    if (isOpen) return;
    setIsOpen(true);
    if (messages.length === 0) {
      setTimeout(() => addBot(chatT.chatGreeting), 200);
    }
  };

  const close = () => { setIsOpen(false); setIsPinned(false); };

  const fmtMsg = (text) => text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.08);padding:1px 4px;border-radius:3px;font-size:11px">$1</code>')
    .replace(/\n/g, "<br/>");

  // Expose open/send for tour
  useEffect(() => {
    if (typeof onExposeControls === 'function') {
      onExposeControls({ open: () => { setIsPinned(true); open(); }, send: handleSend });
    }
  }, [handleSend]);

  return (
    <div
      data-tour="chatbot"
      style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9998, fontFamily: "'DM Sans', sans-serif" }}
      onMouseEnter={() => { clearTimeout(hoverTimer.current); hoverTimer.current = setTimeout(open, 300); }}
      onMouseLeave={() => { clearTimeout(hoverTimer.current); if (!isPinned) hoverTimer.current = setTimeout(close, 600); }}
    >
      {/* FAB */}
      <button
        onClick={() => { if (isOpen) close(); else { setIsPinned(true); open(); } }}
        aria-label={isOpen ? "Cerrar chatbot" : "Abrir chatbot financiero"}
        aria-expanded={isOpen}
        style={{
          width: 52, height: 52, borderRadius: "50%", border: "none",
          background: "linear-gradient(135deg, #10B981, #059669)",
          color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 20px rgba(16,185,129,0.35)", transition: "transform 0.2s",
          position: "relative", zIndex: 2,
        }}>
        {isOpen ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        )}
      </button>

      {/* Panel */}
      <div style={{
        position: "absolute", bottom: 64, right: 0, width: 380,
        maxHeight: isOpen ? 540 : 0, overflow: "hidden",
        background: "#0D1117", border: "1px solid rgba(16,185,129,0.2)",
        borderRadius: 14, boxShadow: "0 8px 40px rgba(0,0,0,0.4)",
        display: "flex", flexDirection: "column",
        opacity: isOpen ? 1 : 0, transform: isOpen ? "translateY(0)" : "translateY(12px)",
        transition: "max-height 0.35s ease, opacity 0.25s ease, transform 0.25s ease",
        pointerEvents: isOpen ? "auto" : "none",
      }}>
        {/* Header */}
        <div style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.15), rgba(5,150,105,0.1))", padding: "14px 18px", borderBottom: "1px solid rgba(16,185,129,0.15)", flexShrink: 0 }}>
          <span style={{ display: "block", fontWeight: 700, fontSize: 14, color: "#10B981" }}>{chatT.asistente}</span>
          <span style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{chatT.teExplico}</span>
        </div>

        {/* Messages */}
        <div ref={messagesRef} role="log" aria-live="polite" aria-label="Mensajes del chatbot" style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10, maxHeight: 320, minHeight: 80 }}
          onClick={() => setIsPinned(true)}>
          {messages.map((msg, i) => (
            <div key={i} style={{ maxWidth: "88%", alignSelf: msg.role === "bot" ? "flex-start" : "flex-end" }}>
              <div style={{
                padding: "10px 14px", borderRadius: 12, fontSize: 12, lineHeight: 1.55,
                ...(msg.role === "bot"
                  ? { background: "rgba(255,255,255,0.04)", color: "#D1D5DB", borderBottomLeftRadius: 4 }
                  : { background: "rgba(16,185,129,0.15)", color: "#A7F3D0", borderBottomRightRadius: 4 }),
              }} dangerouslySetInnerHTML={{ __html: fmtMsg(msg.text) }} />
              {msg.role === "bot" && msg.source && (
                <span style={{
                  display: "inline-block", marginTop: 3, padding: "1px 6px", borderRadius: 4, fontSize: 9,
                  fontWeight: 600, letterSpacing: 0.5,
                  background: msg.source === "ai" ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.06)",
                  color: msg.source === "ai" ? "#818CF8" : "rgba(255,255,255,0.3)",
                  border: `1px solid ${msg.source === "ai" ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.08)"}`,
                }}>{msg.source === "ai" ? "AI" : "Local"}</span>
              )}
            </div>
          ))}
          {isLoading && (
            <div style={{ alignSelf: "flex-start", padding: "10px 14px", borderRadius: 12, background: "rgba(255,255,255,0.04)", fontSize: 12, color: "#6B7280" }}>
              <span style={{ animation: "pulseDots 1.4s infinite" }}>{"..."}</span>
              <style>{`@keyframes pulseDots { 0%, 80%, 100% { opacity: 0.3; } 40% { opacity: 1; } }`}</style>
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div role="group" aria-label="Acciones rapidas del chatbot" style={{ display: "flex", flexWrap: "wrap", gap: 5, padding: "6px 14px 8px", flexShrink: 0 }}>
          {quickActions.map(qa => (
            <button key={qa.label} onClick={() => handleSend(qa.query)} disabled={isLoading} aria-label={`Pregunta rapida: ${qa.label}`} style={{
              background: "transparent", border: "1px solid rgba(16,185,129,0.2)", color: "#10B981",
              padding: "4px 10px", borderRadius: 14, fontSize: 10, cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s",
            }}
            onMouseEnter={e => { e.target.style.background = "rgba(16,185,129,0.15)"; }}
            onMouseLeave={e => { e.target.style.background = "transparent"; }}
            >{qa.label}</button>
          ))}
        </div>

        {/* Input */}
        <div style={{ display: "flex", gap: 6, padding: "8px 12px 12px", borderTop: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleSend(input); }}
            onFocus={() => setIsPinned(true)}
            placeholder={chatT.preguntaSobre}
            aria-label="Escribe tu pregunta al chatbot financiero"
            disabled={isLoading}
            style={{
              flex: 1, border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 12px",
              background: "rgba(255,255,255,0.04)", color: "#F1F5F9", fontSize: 12,
              fontFamily: "'DM Sans', sans-serif", outline: "none",
              opacity: isLoading ? 0.5 : 1,
            }} />
          <button onClick={() => handleSend(input)} disabled={isLoading} aria-label="Enviar mensaje" style={{
            width: 36, height: 36, border: "none", borderRadius: 8,
            background: "linear-gradient(135deg, #10B981, #059669)", color: "#fff",
            cursor: isLoading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            opacity: isLoading ? 0.5 : 1,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
