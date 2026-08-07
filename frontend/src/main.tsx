import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { I18nProvider } from "./i18n";
import "./styles.css";

// Global error handlers for uncaught errors and unhandled promise rejections
window.addEventListener("error", (event) => {
  console.error("[global] Uncaught error:", event.error ?? event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("[global] Unhandled promise rejection:", event.reason);
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <I18nProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </I18nProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
);
