import { StrictMode, useState, useCallback, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ClerkProvider } from "@clerk/clerk-react";
import { QueryClientProvider } from "@tanstack/react-query";
import { isClerkConfigured } from "./lib/clerkConfig";
import { ClerkAuthCtx } from "./lib/ClerkAuthContext";
import { ThemeProvider } from "./lib/theme";
import { ToastContainer } from "./components/ui/Toast/Toast";
import ErrorBoundary from "./components/ErrorBoundary";
import { queryClient } from "./lib/queryClient";
import App from "./App.jsx";
import "./index.css";

window.addEventListener("error", (e) => {
  console.error("[Velora] Uncaught error:", e.error || e.message);
});
window.addEventListener("unhandledrejection", (e) => {
  console.error("[Velora] Unhandled promise rejection:", e.reason);
});

const clerkConfigured = isClerkConfigured();
const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || "";

const clerkAppearance = {
  variables: {
    colorPrimary: "#2563EB",
    colorBackground: "#14141C",
    colorText: "#FFFFFF",
    colorTextSecondary: "#a1a1aa",
    borderRadius: "0.75rem",
  },
  elements: {
    card: "bg-surface border border-white/10 shadow-xl",
    formButtonPrimary: "bg-primary hover:bg-primary/90 text-white py-3 px-4 rounded-xl font-medium",
    formFieldInput: "bg-white/5 border border-white/10 text-white rounded-xl px-4 py-3",
    formFieldLabel: "text-text-secondary",
    socialButtonsBlockButton: "bg-white/10 hover:bg-white/15 border border-white/15 py-3 px-4 rounded-xl font-medium text-white",
    socialButtonsBlockButtonText: "text-white/90",
    headerTitle: "text-white",
    headerSubtitle: "text-text-secondary",
    dividerLine: "bg-white/10",
    dividerText: "text-text-secondary",
    footerActionLink: "text-primary hover:text-primary/80",
    identityPreviewEditButton: "text-primary",
    formFieldInputTextPasswordVisible: "text-white",
    formResendCodeLink: "text-primary",
  },
};

const appContent = (
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <ToastContainer />
      </BrowserRouter>
    </QueryClientProvider>
  </ThemeProvider>
);

console.warn(`[VELORA] Clerk: ${clerkConfigured ? "configured" : "dev mode (no key)"}`);

function Root() {
  const [clerkFailed, setClerkFailed] = useState(false);
  const markClerkFailed = useCallback(() => setClerkFailed(true), []);
  const clerkAvailable = clerkConfigured && !clerkFailed;
  const authCtxValue = useMemo(() => ({ clerkAvailable, markClerkFailed }), [clerkAvailable, markClerkFailed]);

  return (
    <ClerkAuthCtx.Provider value={authCtxValue}>
      <ErrorBoundary onError={(err) => {
        const msg = String(err?.message || err || "").toLowerCase();
        if (msg.includes("clerk") || msg.includes("publishable") || msg.includes("pk_")) {
          console.error("[Velora] Clerk failed, disabling:", err);
          markClerkFailed();
        }
      }}>
        {clerkAvailable ? (
          <ClerkProvider publishableKey={clerkPubKey} appearance={clerkAppearance}>
            {appContent}
          </ClerkProvider>
        ) : (
          appContent
        )}
      </ErrorBoundary>
    </ClerkAuthCtx.Provider>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
