/** Curated fonts for Settings; loaded via Google Fonts in index.html */
export const APP_FONT_STORAGE_KEY = "app_font_id";

export interface AppFontOption {
  id: string;
  label: string;
  /** CSS font-family stack (first family must match Google Fonts name) */
  cssFamily: string;
}

export const APP_FONT_OPTIONS: AppFontOption[] = [
  { id: "dm-sans", label: "DM Sans", cssFamily: '"DM Sans", system-ui, sans-serif' },
  { id: "inter", label: "Inter", cssFamily: '"Inter", system-ui, sans-serif' },
  { id: "roboto", label: "Roboto", cssFamily: '"Roboto", system-ui, sans-serif' },
  { id: "open-sans", label: "Open Sans", cssFamily: '"Open Sans", system-ui, sans-serif' },
  { id: "lato", label: "Lato", cssFamily: '"Lato", system-ui, sans-serif' },
  { id: "source-sans", label: "Source Sans 3", cssFamily: '"Source Sans 3", system-ui, sans-serif' },
  { id: "nunito", label: "Nunito", cssFamily: '"Nunito", system-ui, sans-serif' },
  { id: "poppins", label: "Poppins", cssFamily: '"Poppins", system-ui, sans-serif' },
  { id: "work-sans", label: "Work Sans", cssFamily: '"Work Sans", system-ui, sans-serif' },
  { id: "montserrat", label: "Montserrat", cssFamily: '"Montserrat", system-ui, sans-serif' },
  { id: "raleway", label: "Raleway", cssFamily: '"Raleway", system-ui, sans-serif' },
  { id: "merriweather", label: "Merriweather", cssFamily: '"Merriweather", Georgia, serif' },
  { id: "playfair", label: "Playfair Display", cssFamily: '"Playfair Display", Georgia, serif' },
  { id: "jetbrains-mono", label: "JetBrains Mono", cssFamily: '"JetBrains Mono", ui-monospace, monospace' },
  { id: "fira-code", label: "Fira Code", cssFamily: '"Fira Code", ui-monospace, monospace' },
  { id: "ibm-plex-sans", label: "IBM Plex Sans", cssFamily: '"IBM Plex Sans", system-ui, sans-serif' },
  { id: "ubuntu", label: "Ubuntu", cssFamily: '"Ubuntu", system-ui, sans-serif' },
  { id: "rubik", label: "Rubik", cssFamily: '"Rubik", system-ui, sans-serif' },
  { id: "manrope", label: "Manrope", cssFamily: '"Manrope", system-ui, sans-serif' },
  { id: "quicksand", label: "Quicksand", cssFamily: '"Quicksand", system-ui, sans-serif' },
];

export const DEFAULT_APP_FONT_ID = "dm-sans";

export function getAppFontOptionById(id: string | null | undefined): AppFontOption {
  const found = APP_FONT_OPTIONS.find((f) => f.id === id);
  return found ?? APP_FONT_OPTIONS[0];
}

export function readStoredAppFontId(): string {
  try {
    const raw = localStorage.getItem(APP_FONT_STORAGE_KEY);
    if (raw && APP_FONT_OPTIONS.some((f) => f.id === raw)) return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_APP_FONT_ID;
}

export function writeStoredAppFontId(id: string): void {
  try {
    localStorage.setItem(APP_FONT_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent("app-font-changed", { detail: { id } }));
}

export function applyAppFontToDocument(id: string): void {
  const opt = getAppFontOptionById(id);
  document.documentElement.style.setProperty("--app-font-family", opt.cssFamily);
  document.documentElement.setAttribute("data-app-font", opt.id);
}
