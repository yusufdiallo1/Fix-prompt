import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type ThemePreference = "light" | "dark" | "system";

interface ThemeContextValue {
  /** User choice: light, dark, or follow OS */
  themePreference: ThemePreference;
  setThemePreference: (theme: ThemePreference) => void;
  /** Resolved appearance after applying system preference */
  resolvedTheme: "light" | "dark";
  /** @deprecated use setThemePreference */
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "fixprompt-theme";

const readStoredPreference = (): ThemePreference => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    /* ignore */
  }
  return "system";
};

const resolveEffective = (preference: ThemePreference): "light" | "dark" => {
  if (preference === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return preference;
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(() =>
    readStoredPreference(),
  );
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() =>
    resolveEffective(readStoredPreference()),
  );

  useEffect(() => {
    const root = document.documentElement;

    const apply = () => {
      const effective = resolveEffective(themePreference);
      setResolvedTheme(effective);
      root.classList.toggle("dark", effective === "dark");
      try {
        window.localStorage.setItem(STORAGE_KEY, themePreference);
      } catch {
        /* ignore */
      }
    };

    apply();

    if (themePreference !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [themePreference]);

  const setThemePreference = (next: ThemePreference) => {
    setThemePreferenceState(next);
  };

  const value = useMemo(
    () => ({
      themePreference,
      setThemePreference,
      resolvedTheme,
      toggleTheme: () =>
        setThemePreferenceState((prev) => {
          const cur = resolveEffective(prev);
          return cur === "light" ? "dark" : "light";
        }),
    }),
    [themePreference, resolvedTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
};
