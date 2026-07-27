import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[Velora] ErrorBoundary caught:", error, errorInfo);
    if (this.props.onError) this.props.onError(error);
  }

  render() {
    if (this.state.error) {
      const { error } = this.state;
      const message = error?.message || String(error);
      const stack = this.props.showStack !== false ? (error?.stack || "") : "";

      return (
        <div style={{
          minHeight: "100vh",
          background: "#0B0B0F",
          color: "#fff",
          fontFamily: "Inter, system-ui, sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
        }}>
          <div style={{
            maxWidth: "520px",
            width: "100%",
            textAlign: "center",
          }}>
            <div style={{
              width: "64px",
              height: "64px",
              borderRadius: "1rem",
              background: "linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.05))",
              border: "1px solid rgba(239,68,68,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1.5rem",
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>

            <h1 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem", color: "#fff" }}>
              Something went wrong
            </h1>
            <p style={{ color: "#A1A1AA", fontSize: "0.875rem", marginBottom: "1.5rem", lineHeight: 1.6 }}>
              Velora encountered an unexpected error. You can try reloading the page or return to the dashboard.
            </p>

            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", marginBottom: "1.5rem", flexWrap: "wrap" }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  background: "#2563EB",
                  color: "#fff",
                  border: "none",
                  borderRadius: "0.75rem",
                  padding: "0.625rem 1.25rem",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  cursor: "pointer",
                  transition: "opacity 0.2s",
                }}
                onMouseOver={(e) => e.target.style.opacity = "0.85"}
                onMouseOut={(e) => e.target.style.opacity = "1"}
              >
                Reload Page
              </button>
              <button
                onClick={() => window.location.href = "/dashboard"}
                style={{
                  background: "rgba(255,255,255,0.06)",
                  color: "#A1A1AA",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "0.75rem",
                  padding: "0.625rem 1.25rem",
                  fontWeight: 500,
                  fontSize: "0.875rem",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
                onMouseOver={(e) => { e.target.style.color = "#fff"; e.target.style.borderColor = "rgba(255,255,255,0.15)"; }}
                onMouseOut={(e) => { e.target.style.color = "#A1A1AA"; e.target.style.borderColor = "rgba(255,255,255,0.08)"; }}
              >
                Go to Dashboard
              </button>
            </div>

            <div style={{
              background: "#14141C",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "0.75rem",
              padding: "1rem",
              textAlign: "left",
              overflow: "auto",
              maxHeight: "200px",
            }}>
              <code style={{ fontSize: "0.8rem", color: "#F87171", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{message}</code>
              {stack && (
                <pre style={{ fontSize: "0.7rem", color: "#71717A", marginTop: "0.5rem", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{stack}</pre>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
