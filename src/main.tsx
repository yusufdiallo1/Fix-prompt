import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App";
import { ThemeProvider } from "./hooks/useTheme";
import { AuthProvider } from "./hooks/useAuth";
import { AppFontProvider } from "./hooks/useAppFont";
import { RuntimeFirewall } from "./components/RuntimeFirewall";
import { readStoredAppFontId, applyAppFontToDocument } from "./lib/appFonts";

applyAppFontToDocument(readStoredAppFontId());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <AppFontProvider>
        <BrowserRouter>
          <RuntimeFirewall>
            <AuthProvider>
              <App />
            </AuthProvider>
          </RuntimeFirewall>
        </BrowserRouter>
      </AppFontProvider>
    </ThemeProvider>
  </StrictMode>,
);
