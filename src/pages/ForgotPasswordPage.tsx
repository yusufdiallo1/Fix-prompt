import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { AuthLogo } from "../components/AuthLogo";
import { AuthSplitLayout } from "../components/AuthSplitLayout";
import { supabase } from "../lib/supabase";

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" strokeWidth={1.75} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

export const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleReset = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!supabase) {
      setError(
        "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.",
      );
      return;
    }
    setLoading(true);
    setError(null);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });

    if (resetError) {
      setError(resetError.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  };

  return (
    <AuthSplitLayout>
      {/* Brand */}
      <AuthLogo />

      {/* Glass form card */}
      <div className="auth-card mt-7 p-7">
        {sent ? (
          /* ── Success state ── */
          <div className="flex flex-col items-center py-4 text-center">
            <div
              className="mb-5 flex h-14 w-14 items-center justify-center rounded-full"
              style={{ background: "rgba(52, 211, 153, 0.12)" }}
            >
              <CheckCircleIcon className="h-7 w-7 text-[#34D399]" />
            </div>
            <h2 className="text-[20px] font-bold tracking-[-0.015em] text-[#1C1C1E]">
              Check your inbox
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#1C1C1E]">
              We sent a password reset link to{" "}
              <span className="font-medium text-[#1C1C1E]">{email}</span>.
              It may take a minute to arrive.
            </p>
            <button
              type="button"
              onClick={() => {
                setSent(false);
                setEmail("");
              }}
              className="mt-6 text-sm font-medium text-[#3B82F6] transition hover:text-[#2563EB]"
            >
              Try a different email
            </button>
          </div>
        ) : (
          /* ── Form state ── */
          <>
            <h2 className="text-[20px] font-bold tracking-[-0.015em] text-[#1C1C1E]">
              Reset your password
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-[#1C1C1E]">
              Enter your email and we'll send you a link to reset your password.
            </p>

            <form className="mt-6 space-y-4" onSubmit={handleReset} noValidate>
              <div>
                <label className="auth-label" htmlFor="email">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="auth-input"
                />
              </div>

              {error ? (
                <div className="rounded-2xl border border-[#FF453A]/20 bg-[#FF453A]/8 px-4 py-3 text-sm text-[#FF453A]">
                  {error}
                </div>
              ) : null}

              <button type="submit" className="auth-primary-btn" disabled={loading}>
                {loading ? "Sending…" : "Send Reset Link"}
              </button>
            </form>
          </>
        )}
      </div>

      {/* Footer link */}
      <p className="mt-5 text-center text-sm text-[#1C1C1E]">
        <Link to="/login" className="auth-link">
          ← Back to login
        </Link>
        {" · "}
        <Link to="/" className="auth-link">
          Home
        </Link>
      </p>
    </AuthSplitLayout>
  );
};
