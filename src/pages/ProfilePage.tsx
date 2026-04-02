import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import type { UserProfile } from "../types/database";

const PLATFORM_OPTIONS = ["Lovable", "Cursor", "Replit", "ChatGPT", "Claude", "Other"] as const;
const MODE_OPTIONS = [
  { value: "improve", label: "Improve" },
  { value: "debug", label: "Fix code" },
  { value: "both", label: "Both" },
] as const;

const formatDate = (iso?: string | null) => {
  if (!iso) return "N/A";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

export const ProfilePage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [totalSessions, setTotalSessions] = useState(0);
  const [savedPrompts, setSavedPrompts] = useState(0);

  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [preferredPlatform, setPreferredPlatform] = useState<string>("Other");
  const [preferredMode, setPreferredMode] = useState<string>("both");
  const [planTier, setPlanTier] = useState("free");

  const email = user?.email ?? "No email available";
  const initials = useMemo(() => {
    const source = fullName.trim() || email;
    const parts = source.split(/\s+|@/).filter(Boolean);
    return (parts[0]?.[0] ?? "P").toUpperCase() + (parts[1]?.[0] ?? "F").toUpperCase();
  }, [email, fullName]);

  useEffect(() => {
    if (!user?.id || !supabase) {
      setLoading(false);
      return;
    }
    const sb = supabase;

    let active = true;
    setLoading(true);
    setError(null);

    const load = async () => {
      const [profileRes, sessionsRes, savedRes] = await Promise.all([
        sb
          .from("users_profiles")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle(),
        sb
          .from("prompt_sessions")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id),
        sb
          .from("saved_prompts")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id),
      ]);

      if (!active) return;

      if (profileRes.error) {
        setError(profileRes.error.message);
      } else {
        const profile = profileRes.data as UserProfile | null;
        setFullName(profile?.full_name ?? "");
        setAvatarUrl(profile?.avatar_url ?? "");
        setPreferredPlatform(profile?.preferred_platform ?? "Other");
        setPreferredMode(profile?.preferred_mode ?? "both");
        setPlanTier(profile?.plan_tier ?? "free");
      }

      setTotalSessions(sessionsRes.count ?? 0);
      setSavedPrompts(savedRes.count ?? 0);
      setLoading(false);
    };

    void load();
    return () => {
      active = false;
    };
  }, [user?.id]);

  const onSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!user?.id || !supabase) {
      setError("Supabase is not configured.");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    const payload = {
      user_id: user.id,
      email,
      full_name: fullName.trim() || null,
      avatar_url: avatarUrl.trim() || null,
      preferred_platform: preferredPlatform,
      preferred_mode: preferredMode,
    };

    const { error: saveError } = await supabase
      .from("users_profiles")
      .upsert(payload, { onConflict: "user_id" });

    setSaving(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }

    setMessage("Profile updated.");
  };

  return (
    <section className="space-y-5 pb-12">
      <header>
        <h1 className="text-2xl font-semibold text-[#1C1C1E]">Profile</h1>
        <p className="mt-1 text-sm text-[#636366]">
          Manage your <span className="brand-wordmark">PromptFix</span> profile details and preferences.
        </p>
      </header>

      {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
      {error ? <p className="text-sm text-rose-500">{error}</p> : null}

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <aside
          className="rounded-2xl border border-[#E5E5EA] p-5"
          style={{ background: "rgba(255,255,255,0.72)", backdropFilter: "blur(12px)" }}
        >
          <div className="flex items-center gap-3">
            {avatarUrl.trim() ? (
              <img
                src={avatarUrl}
                alt="Profile avatar"
                className="h-14 w-14 rounded-full border border-[#D1D1D6] object-cover"
                onError={(event) => {
                  (event.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#3B82F6] to-[#A78BFA] text-sm font-semibold text-white">
                {initials}
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-[#1C1C1E]">{fullName.trim() || "Your name"}</p>
              <p className="text-xs text-[#8E8E93]">{email}</p>
            </div>
          </div>

          <div className="mt-4 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-[#636366]">Plan</span>
              <span className="rounded-full border border-[#D1D1D6] bg-white px-2 py-0.5 text-xs font-semibold capitalize text-[#1C1C1E]">
                {planTier}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#636366]">Sessions</span>
              <span className="text-[#1C1C1E]">{totalSessions}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#636366]">Saved prompts</span>
              <span className="text-[#1C1C1E]">{savedPrompts}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#636366]">Member since</span>
              <span className="text-[#1C1C1E]">{formatDate(user?.created_at)}</span>
            </div>
          </div>
        </aside>

        <form
          onSubmit={onSave}
          className="space-y-4 rounded-2xl border border-[#E5E5EA] p-5"
          style={{ background: "rgba(255,255,255,0.72)", backdropFilter: "blur(12px)" }}
        >
          {loading ? (
            <div className="space-y-3">
              <div className="skeleton h-10 w-full rounded-xl" />
              <div className="skeleton h-10 w-full rounded-xl" />
              <div className="skeleton h-10 w-full rounded-xl" />
            </div>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-[#1C1C1E]">Full name</label>
                <input
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Your full name"
                  className="w-full rounded-xl border border-[#D1D1D6] bg-white/90 px-3 py-2.5 text-sm text-[#1C1C1E] outline-none focus:border-[#3B82F6] focus:shadow-[0_0_0_3px_rgba(59,130,246,0.12)]"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-[#1C1C1E]">Email</label>
                <input
                  value={email}
                  disabled
                  className="w-full rounded-xl border border-[#E5E5EA] bg-[#F2F2F7] px-3 py-2.5 text-sm text-[#636366]"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-[#1C1C1E]">Avatar URL</label>
                <input
                  value={avatarUrl}
                  onChange={(event) => setAvatarUrl(event.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-xl border border-[#D1D1D6] bg-white/90 px-3 py-2.5 text-sm text-[#1C1C1E] outline-none focus:border-[#3B82F6] focus:shadow-[0_0_0_3px_rgba(59,130,246,0.12)]"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#1C1C1E]">Preferred platform</label>
                  <select
                    value={preferredPlatform}
                    onChange={(event) => setPreferredPlatform(event.target.value)}
                    className="w-full rounded-xl border border-[#D1D1D6] bg-white/90 px-3 py-2.5 text-sm text-[#1C1C1E] outline-none focus:border-[#3B82F6]"
                  >
                    {PLATFORM_OPTIONS.map((platform) => (
                      <option key={platform} value={platform}>
                        {platform}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-[#1C1C1E]">Preferred mode</label>
                  <select
                    value={preferredMode}
                    onChange={(event) => setPreferredMode(event.target.value)}
                    className="w-full rounded-xl border border-[#D1D1D6] bg-white/90 px-3 py-2.5 text-sm text-[#1C1C1E] outline-none focus:border-[#3B82F6]"
                  >
                    {MODE_OPTIONS.map((mode) => (
                      <option key={mode.value} value={mode.value}>
                        {mode.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-full bg-gradient-to-r from-[#3B82F6] to-[#A78BFA] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save Profile"}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </section>
  );
};
