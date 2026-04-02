import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import "./index.css";
import App from "./App";
import { ThemeProvider } from "./hooks/useTheme";
import { AuthProvider } from "./hooks/useAuth";
import { AppFontProvider } from "./hooks/useAppFont";
import { RuntimeFirewall } from "./components/RuntimeFirewall";
import { readStoredAppFontId, applyAppFontToDocument } from "./lib/appFonts";

applyAppFontToDocument(readStoredAppFontId());

const Router = Capacitor.isNativePlatform() ? HashRouter : BrowserRouter;

if (Capacitor.isNativePlatform()) {
  void StatusBar.setStyle({ style: Style.Light }).catch(() => {});
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <AppFontProvider>
        <Router>
          <RuntimeFirewall>
            <AuthProvider>
              <App />
            </AuthProvider>
          </RuntimeFirewall>
        </Router>
      </AppFontProvider>
    </ThemeProvider>
  </StrictMode>,
);
