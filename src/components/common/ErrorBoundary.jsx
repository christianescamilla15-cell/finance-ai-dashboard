// ─── ERROR BOUNDARY ──────────────────────────────────────────────────────────
import { Component } from "react";

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const { fallbackLabel } = this.props;
      return (
        <div
          role="alert"
          style={{
            background: "rgba(239,68,68,0.06)",
            border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 12,
            padding: "32px 24px",
            textAlign: "center",
            animation: "fadeUp 0.3s ease",
          }}
        >
          <p style={{ fontSize: 28, margin: "0 0 8px" }}>!</p>
          <p style={{ fontSize: 14, fontWeight: 600, color: "#FCA5A5", margin: "0 0 6px" }}>
            Algo salio mal {fallbackLabel ? `en ${fallbackLabel}` : ""}
          </p>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", margin: "0 0 16px" }}>
            Ha ocurrido un error inesperado. Puedes reintentar o recargar la pagina.
          </p>
          <button
            onClick={this.handleRetry}
            aria-label="Reintentar carga de la seccion"
            style={{
              background: "rgba(99,102,241,0.12)",
              border: "1px solid rgba(99,102,241,0.3)",
              borderRadius: 8,
              padding: "9px 22px",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              color: "#6366F1",
              fontFamily: "'DM Sans', sans-serif",
              transition: "all 0.15s",
            }}
          >
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
