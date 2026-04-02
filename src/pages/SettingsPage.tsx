import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../hooks/useTheme";
import { supabase } from "../lib/supabase";

export const SettingsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState<null | "password" | "signout" | "delete">(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      supabase.from("debug_sessions").delete().eq("user_id", userId),
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

      <div className="rounded-2xl border border-[#E5E5EA] bg-white/75 p-5 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#1C1C1E]">Theme</p>
            <p className="text-sm text-[#8E8E93]">Switch between light and dark mode.</p>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-full border border-[#D1D1D6] bg-white/90 px-4 py-2 text-sm font-medium text-[#1C1C1E]"
          >
            {theme === "dark" ? "Use Light" : "Use Dark"}
          </button>
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
