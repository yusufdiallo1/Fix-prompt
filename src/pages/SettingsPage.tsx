import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useTheme, type ThemePreference } from "../hooks/useTheme";
import { useAppFont } from "../hooks/useAppFont";
import { supabase } from "../lib/supabase";
import { isSpeechSupported } from "../lib/stt";

const STT_LANGUAGES = [
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "en-AU", label: "English (AU)" },
  { value: "ar",    label: "Arabic" },
  { value: "fr-FR", label: "French" },
  { value: "es-ES", label: "Spanish" },
  { value: "de-DE", label: "German" },
  { value: "tr-TR", label: "Turkish" },
] as const;

export const SettingsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { themePreference, setThemePreference, resolvedTheme } = useTheme();
  const { fontId, setFontId, options: fontOptions, fontOption } = useAppFont();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState<null | "password" | "signout" | "delete">(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Speech-to-Text settings ───────────────────────────────────────────────
  const [sttLanguage, setSttLanguage] = useState<string>(() => {
    try { return localStorage.getItem("stt_language") ?? "en-US"; } catch { return "en-US"; }
  });
  const [sttAutoImprove, setSttAutoImprove] = useState<boolean>(() => {
    try { return localStorage.getItem("stt_auto_improve") === "true"; } catch { return false; }
  });
  const sttSupported = isSpeechSupported();

  // Load STT preferences from Supabase on mount.
  useEffect(() => {
    if (!supabase || !user?.id) return;
    void (async () => {
      const { data } = await supabase
        .from("user_stats")
        .select("stt_language,stt_auto_improve")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!data) return;
      const lang = (data as { stt_language?: string | null; stt_auto_improve?: boolean | null }).stt_language ?? "en-US";
      const auto = (data as { stt_language?: string | null; stt_auto_improve?: boolean | null }).stt_auto_improve ?? false;
      setSttLanguage(lang);
      setSttAutoImprove(auto);
      try {
        localStorage.setItem("stt_language", lang);
        localStorage.setItem("stt_auto_improve", String(auto));
      } catch { /* ignore */ }
    })();
  }, [user?.id]);

  const saveSttLanguage = async (lang: string) => {
    setSttLanguage(lang);
    try { localStorage.setItem("stt_language", lang); } catch { /* ignore */ }
    if (!supabase || !user?.id) return;
    await supabase
      .from("user_stats")
      .upsert({ user_id: user.id, stt_language: lang }, { onConflict: "user_id" });
  };

  const saveSttAutoImprove = async (val: boolean) => {
    setSttAutoImprove(val);
    try { localStorage.setItem("stt_auto_improve", String(val)); } catch { /* ignore */ }
    if (!supabase || !user?.id) return;
    await supabase
      .from("user_stats")
      .upsert({ user_id: user.id, stt_auto_improve: val }, { onConflict: "user_id" });
  };
  // ─────────────────────────────────────────────────────────────────────────

  const onChangePassword = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (!supabase) {
      setError("Supabase is not configured.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setBusy("password");
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setBusy(null);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setNewPassword("");
    setConfirmPassword("");
    setMessage("Password updated.");
  };

  const onSignOutAll = async () => {
    if (!supabase) return;
    setError(null);
    setMessage(null);
    setBusy("signout");
    const { error: signOutError } = await supabase.auth.signOut({ scope: "global" });
    setBusy(null);
    if (signOutError) {
      setError(signOutError.message);
      return;
    }
    navigate("/login", { replace: true });
  };

  const onDeleteAccountData = async () => {
    if (!supabase || !user?.id) return;
    setError(null);
    setMessage(null);
    if (deleteConfirm.trim() !== "DELETE") {
      setError("Type DELETE to continue.");
      return;
    }

    setBusy("delete");
    const userId = user.id;
    const operations = [
      supabase.from("saved_prompts").delete().eq("user_id", userId),
      supabase.from("code_sessions").delete().eq("user_id", userId),
      supabase.from("prompt_sessions").delete().eq("user_id", userId),
      supabase.from("user_stats").delete().eq("user_id", userId),
      supabase.from("users_profiles").delete().eq("user_id", userId),
    ];
    const results = await Promise.all(operations);
    const failed = results.find((result) => result.error);
    if (failed?.error) {
      setBusy(null);
      setError(failed.error.message);
      return;
    }

    await supabase.auth.signOut({ scope: "global" });
    setBusy(null);
    navigate("/signup", { replace: true });
  };

  return (
    <section className="space-y-5 pb-10">
      <div>
        <h1 className="text-2xl font-semibold text-[#1C1C1E]">Settings</h1>
        <p className="mt-1 text-sm text-[#636366]">Manage your account, security, and preferences.</p>
      </div>

      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
      {error ? <p className="text-sm text-rose-500">{error}</p> : null}

      <div className="rounded-2xl border border-[#E5E5EA] bg-white/75 p-5 backdrop-blur-xl">
        <p className="text-sm font-semibold text-[#1C1C1E]">Account</p>
        <p className="mt-1 text-sm text-[#636366]">{user?.email ?? "No email available"}</p>
      </div>

      <div className="rounded-2xl border border-[#E5E5EA] bg-white/75 p-5 backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
        <p className="text-sm font-semibold text-[#1C1C1E] dark:text-slate-100">Theme</p>
        <p className="mt-1 text-sm text-[#8E8E93] dark:text-slate-400">
          Light, dark, or match your device.
        </p>
        <div className="relative mt-4 max-w-md">
          <label htmlFor="theme-preference" className="sr-only">
            Theme
          </label>
          <select
            id="theme-preference"
            value={themePreference}
            onChange={(event) => setThemePreference(event.target.value as ThemePreference)}
            className="liquid-glass-select"
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
        </div>
        {themePreference === "system" ? (
          <p className="mt-2 text-xs text-[#8E8E93] dark:text-slate-500">
            Currently using {resolvedTheme === "dark" ? "dark" : "light"} (from your device).
          </p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-[#E5E5EA] bg-white/75 p-5 backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
        <p className="text-sm font-semibold text-[#1C1C1E] dark:text-slate-100">Text font</p>
        <p className="mt-1 text-sm text-[#8E8E93] dark:text-slate-400">
          Choose how typed text looks in inputs and text areas across PromptFix.
        </p>
        <div className="relative mt-4 max-w-md">
          <label htmlFor="app-font" className="sr-only">
            Text font
          </label>
          <select
            id="app-font"
            value={fontId}
            onChange={(event) => setFontId(event.target.value)}
            className="liquid-glass-select"
            style={{ fontFamily: fontOption.cssFamily }}
          >
            {fontOptions.map((f) => (
              <option key={f.id} value={f.id} style={{ fontFamily: f.cssFamily }}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <form onSubmit={onChangePassword} className="space-y-3 rounded-2xl border border-[#E5E5EA] bg-white/75 p-5 backdrop-blur-xl">
        <p className="text-sm font-semibold text-[#1C1C1E]">Change Password</p>
        <input
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          placeholder="New password (min 8 chars)"
          className="w-full rounded-2xl border border-[#D1D1D6] bg-white px-4 py-3 text-sm text-[#1C1C1E] outline-none focus:border-[#3B82F6]"
        />
        <input
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Confirm new password"
          className="w-full rounded-2xl border border-[#D1D1D6] bg-white px-4 py-3 text-sm text-[#1C1C1E] outline-none focus:border-[#3B82F6]"
        />
        <button
          type="submit"
          disabled={busy === "password"}
          className="rounded-full bg-gradient-to-r from-[#3B82F6] to-[#A78BFA] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy === "password" ? "Updating..." : "Update Password"}
        </button>
      </form>

      <div className="space-y-3 rounded-2xl border border-[#E5E5EA] bg-white/75 p-5 backdrop-blur-xl">
        <p className="text-sm font-semibold text-[#1C1C1E]">Security</p>
        <button
          type="button"
          onClick={() => void onSignOutAll()}
          disabled={busy === "signout"}
          className="rounded-full border border-[#D1D1D6] bg-white px-4 py-2 text-sm font-medium text-[#1C1C1E] disabled:opacity-100 disabled:text-[#1C1C1E]"
        >
          {busy === "signout" ? "Signing out..." : "Sign Out From All Devices"}
        </button>
      </div>

      {sttSupported && (
        <div className="space-y-4 rounded-2xl border border-[#E5E5EA] bg-white/75 p-5 backdrop-blur-xl">
          <p className="text-sm font-semibold text-[#1C1C1E]">Speech to Text</p>

          {/* Language selector */}
          <div className="space-y-1.5">
            <label className="text-sm text-[#636366]" htmlFor="stt-lang-select">
              Recognition Language
            </label>
            <select
              id="stt-lang-select"
              value={sttLanguage}
              onChange={(e) => void saveSttLanguage(e.target.value)}
              className="w-full rounded-2xl border border-[#D1D1D6] bg-white px-4 py-3 text-sm text-[#1C1C1E] outline-none focus:border-[#3B82F6]"
            >
              {STT_LANGUAGES.map((lang) => (
                <option key={lang.value} value={lang.value}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

          {/* Auto-improve toggle */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-[#1C1C1E]">Auto-improve after speaking</p>
              <p className="mt-0.5 text-xs text-[#8E8E93]">
                Automatically tap Improve when you stop speaking
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={sttAutoImprove}
              onClick={() => void saveSttAutoImprove(!sttAutoImprove)}
              className={[
                "relative mt-0.5 inline-flex h-[30px] w-[52px] shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none",
                sttAutoImprove ? "bg-[#3B82F6]" : "bg-[#D1D1D6]",
              ].join(" ")}
            >
              <span
                className={[
                  "pointer-events-none inline-block h-[22px] w-[22px] translate-y-[-1px] rounded-full bg-white shadow-sm ring-0 transition-transform duration-200",
                  sttAutoImprove ? "translate-x-[24px]" : "translate-x-[1px]",
                ].join(" ")}
              />
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3 rounded-2xl border border-rose-200 bg-rose-50/70 p-5 backdrop-blur-xl">
        <p className="text-sm font-semibold text-rose-700">Danger Zone</p>
        <p className="text-xs text-rose-600">
          This deletes your app data (sessions, saved prompts, stats) and signs you out. Type DELETE to confirm.
        </p>
        <input
          value={deleteConfirm}
          onChange={(event) => setDeleteConfirm(event.target.value)}
          placeholder="Type DELETE"
          className="w-full rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm text-[#1C1C1E] outline-none focus:border-rose-400"
        />
        <button
          type="button"
          onClick={() => void onDeleteAccountData()}
          disabled={busy === "delete"}
          className="rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy === "delete" ? "Deleting..." : "Delete Account Data"}
        </button>
      </div>
    </section>
  );
};
