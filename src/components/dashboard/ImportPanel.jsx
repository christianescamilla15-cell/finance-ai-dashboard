// ─── DATA IMPORT PANEL ──────────────────────────────────────────────────────
import { useState, useRef, useCallback } from "react";
import { parseImportData } from '../../utils/csvParser';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_EXTENSIONS = [".csv", ".tsv", ".txt"];

export function ImportPanel({ onImport, t: parentT }) {
  const [mode, setMode] = useState(null); // null, "csv", "paste"
  const [pasteText, setPasteText] = useState("");
  const [importResult, setImportResult] = useState(null);
  const [validationError, setValidationError] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileRef = useRef(null);

  const validateFile = useCallback((file) => {
    if (!file) return "No se selecciono ningun archivo.";
    const ext = "." + file.name.split(".").pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return `Tipo de archivo no permitido (${ext}). Solo se aceptan: ${ALLOWED_EXTENSIONS.join(", ")}`;
    }
    if (file.size > MAX_FILE_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      return `El archivo es demasiado grande (${sizeMB}MB). Maximo permitido: 5MB.`;
    }
    return null;
  }, []);

  const handleCSVUpload = (e) => {
    const file = e.target.files?.[0];
    setValidationError(null);
    const error = validateFile(file);
    if (error) {
      setValidationError(error);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      processImport(text);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    setValidationError(null);
    const file = e.dataTransfer?.files?.[0];
    const error = validateFile(file);
    if (error) {
      setValidationError(error);
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => processImport(ev.target.result);
    reader.readAsText(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handlePaste = () => {
    if (!pasteText.trim()) return;
    setValidationError(null);
    processImport(pasteText);
  };

  const processImport = (text) => {
    const result = parseImportData(text);
    setImportResult(result);
    if (result.transactions.length > 0) {
      const dates = result.transactions.map(t => t.date).sort();
      setImportResult({
        ...result,
        summary: `${result.transactions.length} transacciones importadas, rango: ${dates[0]} - ${dates[dates.length - 1]}`,
      });
    }
  };

  const confirmImport = () => {
    if (importResult?.transactions?.length > 0) {
      onImport(importResult.transactions);
      setMode(null);
      setPasteText("");
      setImportResult(null);
      setValidationError(null);
    }
  };

  const accent = "#10B981";

  if (mode === null) {
    return (
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button onClick={() => setMode("csv")} aria-label="Importar archivo CSV" style={{
          background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)",
          borderRadius: 8, padding: "7px 14px", cursor: "pointer",
          fontSize: 11, fontWeight: 600, color: accent, fontFamily: "'DM Sans', sans-serif",
        }}>
          {parentT.importarCSV}
        </button>
        <button onClick={() => setMode("paste")} aria-label="Pegar datos manualmente" style={{
          background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.25)",
          borderRadius: 8, padding: "7px 14px", cursor: "pointer",
          fontSize: 11, fontWeight: 600, color: "#8B5CF6", fontFamily: "'DM Sans', sans-serif",
        }}>
          {parentT.pegarDatos}
        </button>
      </div>
    );
  }

  return (
    <div style={{
      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 12, padding: 20, marginBottom: 16, animation: "fadeUp 0.3s ease",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#F1F5F9" }}>
          {mode === "csv" ? parentT.importarArchivoCSV : parentT.pegarDatos}
        </p>
        <button
          onClick={() => { setMode(null); setImportResult(null); setPasteText(""); setValidationError(null); }}
          aria-label="Cerrar panel de importacion"
          style={{
            background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 16,
          }}
        >X</button>
      </div>

      {/* Example format */}
      <div style={{
        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 8, padding: 12, marginBottom: 14, fontFamily: "'DM Mono', monospace", fontSize: 10,
        color: "rgba(255,255,255,0.4)", lineHeight: 1.8,
      }}>
        <p style={{ margin: "0 0 4px", fontSize: 10, color: "rgba(255,255,255,0.25)", fontWeight: 700 }}>{parentT.formatoEsperado}</p>
        fecha,categoria,monto,descripcion<br/>
        2025-01-15,Marketing,8500,Campana Google Ads<br/>
        2025-01-16,Software,3200,Licencia Figma<br/>
        2025-01-17,Nomina,45000,Pago quincenal<br/>
        <p style={{ margin: "8px 0 0", fontSize: 9, color: "rgba(255,255,255,0.2)" }}>
          {parentT.columnasMinimas}
        </p>
      </div>

      {/* Validation error */}
      {validationError && (
        <div role="alert" style={{
          background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
          borderRadius: 8, padding: "8px 12px", marginBottom: 12,
        }}>
          <p style={{ margin: 0, fontSize: 12, color: "#FCA5A5" }}>{validationError}</p>
        </div>
      )}

      {mode === "csv" && (
        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,.txt"
            onChange={handleCSVUpload}
            aria-label="Seleccionar archivo CSV, TSV o TXT para importar"
            style={{ display: "none" }}
          />
          <div
            role="button"
            tabIndex={0}
            aria-label="Zona de arrastre: arrastra un archivo CSV aqui o haz click para seleccionar"
            onClick={() => fileRef.current?.click()}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileRef.current?.click(); } }}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            style={{
              border: `2px dashed ${isDragOver ? accent : "rgba(255,255,255,0.15)"}`,
              borderRadius: 10,
              padding: "20px",
              textAlign: "center",
              cursor: "pointer",
              background: isDragOver ? "rgba(16,185,129,0.06)" : "transparent",
              transition: "all 0.2s",
            }}
          >
            <p style={{ margin: "0 0 8px", fontSize: 12, color: isDragOver ? accent : "rgba(255,255,255,0.4)" }}>
              Arrastra un archivo aqui o haz click para seleccionar
            </p>
            <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.25)" }}>
              .csv, .tsv, .txt — max 5MB
            </p>
          </div>
        </div>
      )}

      {mode === "paste" && (
        <div>
          <label htmlFor="paste-data" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}>
            Pegar datos CSV
          </label>
          <textarea
            id="paste-data"
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
            placeholder={"fecha,categoria,monto,descripcion\n2025-01-15,Marketing,8500,Campana Google Ads\n2025-01-16,Software,3200,Licencia Figma"}
            aria-label="Pegar datos en formato CSV"
            rows={8}
            style={{
              width: "100%", background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8, padding: 12,
              color: "#F1F5F9", fontSize: 12,
              fontFamily: "'DM Mono', monospace",
              resize: "vertical",
            }}
          />
          <button onClick={handlePaste} aria-label="Procesar datos pegados" style={{
            marginTop: 8,
            background: `linear-gradient(135deg, #8B5CF6, #6D28D9)`,
            border: "none", borderRadius: 8, padding: "10px 24px",
            fontSize: 12, fontWeight: 700, color: "#fff",
            cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
          }}>
            {parentT.procesarDatos}
          </button>
        </div>
      )}

      {/* Import result */}
      {importResult && (
        <div style={{ marginTop: 14 }}>
          {importResult.error && (
            <p role="alert" style={{ margin: "0 0 8px", fontSize: 12, color: "#FCA5A5" }}>Error: {importResult.error}</p>
          )}
          {importResult.errors && (
            <div style={{ marginBottom: 8 }}>
              <p style={{ margin: "0 0 4px", fontSize: 11, color: "#F59E0B" }}>{parentT.advertencias} ({importResult.errors.length}):</p>
              {importResult.errors.slice(0, 5).map((err, i) => (
                <p key={i} style={{ margin: 0, fontSize: 10, color: "rgba(245,158,11,0.7)", fontFamily: "'DM Mono', monospace" }}>- {err}</p>
              ))}
              {importResult.errors.length > 5 && (
                <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.3)" }}>...+{importResult.errors.length - 5} {parentT.yMas}</p>
              )}
            </div>
          )}
          {importResult.summary && (
            <div style={{
              background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)",
              borderRadius: 8, padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <p style={{ margin: 0, fontSize: 12, color: accent, fontWeight: 600 }}>
                {importResult.summary}
              </p>
              <button onClick={confirmImport} aria-label="Confirmar importacion de datos" style={{
                background: `linear-gradient(135deg, ${accent}, #059669)`,
                border: "none", borderRadius: 8, padding: "8px 20px",
                fontSize: 12, fontWeight: 700, color: "#fff",
                cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                boxShadow: `0 0 16px ${accent}30`,
              }}>
                {parentT.confirmarImportacion}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
