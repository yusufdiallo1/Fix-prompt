import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  APP_FONT_STORAGE_KEY,
  applyAppFontToDocument,
  readStoredAppFontId,
  writeStoredAppFontId,
  getAppFontOptionById,
  type AppFontOption,
  APP_FONT_OPTIONS,
} from "../lib/appFonts";

interface AppFontContextValue {
  fontId: string;
  fontOption: AppFontOption;
  setFontId: (id: string) => void;
  options: typeof APP_FONT_OPTIONS;
}

const AppFontContext = createContext<AppFontContextValue | null>(null);

export function AppFontProvider({ children }: { children: ReactNode }) {
  const [fontId, setFontIdState] = useState<string>(() => readStoredAppFontId());

  useEffect(() => {
    applyAppFontToDocument(fontId);
  }, [fontId]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === APP_FONT_STORAGE_KEY && e.newValue) {
        setFontIdState(e.newValue);
        applyAppFontToDocument(e.newValue);
      }
    };
    const onCustom = (e: Event) => {
      const ce = e as CustomEvent<{ id?: string }>;
      if (ce.detail?.id) {
        setFontIdState(ce.detail.id);
        applyAppFontToDocument(ce.detail.id);
      }
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("app-font-changed", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("app-font-changed", onCustom);
    };
  }, []);

  const setFontId = useCallback((id: string) => {
    writeStoredAppFontId(id);
    setFontIdState(id);
    applyAppFontToDocument(id);
  }, []);

  const value = useMemo(
    () => ({
      fontId,
      fontOption: getAppFontOptionById(fontId),
      setFontId,
      options: APP_FONT_OPTIONS,
    }),
    [fontId, setFontId],
  );

  return <AppFontContext.Provider value={value}>{children}</AppFontContext.Provider>;
}

export function useAppFont(): AppFontContextValue {
  const ctx = useContext(AppFontContext);
  if (!ctx) {
    throw new Error("useAppFont must be used within AppFontProvider");
  }
  return ctx;
}
