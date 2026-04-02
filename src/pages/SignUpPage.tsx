import { type FormEvent, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { AuthLogo } from "../components/AuthLogo";
import { AuthSplitLayout } from "../components/AuthSplitLayout";
import { PasswordField } from "../components/PasswordField";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";

// ─── Password strength ──────────────────────────────────────────────────────

function scorePassword(pw: string): number {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

function getStrength(pw: string): "weak" | "medium" | "strong" {
  const s = scorePassword(pw);
  if (s <= 1) return "weak";
  if (s <= 3) return "medium";
  return "strong";
}

const STRENGTH_META = {
  weak:   { label: "Weak",   bar: "w-1/3",  color: "bg-[#FF453A]" },
  medium: { label: "Medium", bar: "w-2/3",  color: "bg-orange-400" },
  strong: { label: "Strong", bar: "w-full", color: "bg-[#34D399]" },
};

// ─── Component ──────────────────────────────────────────────────────────────

export const SignUpPage = () => {
  const navigate = useNavigate();
  const { loading: authLoading, session } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const strength = useMemo(() => getStrength(password), [password]);
  const { label: strengthLabel, bar: strengthBar, color: strengthColor } = STRENGTH_META[strength];

  if (!authLoading && session) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSignUp = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!supabase) {
      setError(
        "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.",
      );
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    // If email confirmation is disabled, a session is returned immediately.
    // If confirmation is required, sign in with password anyway.
    if (!data.session) {
      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
      if (loginError) {
        setError("Account created. Please verify your email, then sign in.");
        setLoading(false);
        return;
      }
    }

    navigate("/dashboard", { replace: true });
  };

  return (
    <AuthSplitLayout>
      {/* Brand */}
      <AuthLogo />

      {/* Glass form card */}
      <div className="auth-card mt-7 p-7">
        <h2 className="text-[20px] font-bold tracking-[-0.015em] text-[#1C1C1E]">
          Create your account
        </h2>
        <p className="mt-1 text-sm text-[#1C1C1E]">
          Start building better prompts today
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSignUp} noValidate>
          {/* Full name */}
          <div>
            <label className="auth-label" htmlFor="fullName">
              Full Name
            </label>
            <input
              id="fullName"
              type="text"
              required
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Doe"
              className="auth-input"
            />
          </div>

          {/* Email */}
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

          {/* Password + strength bar */}
          <div>
            <PasswordField
              id="password"
              label="Password"
              value={password}
              onChange={setPassword}
              show={showPassword}
              onToggleShow={() => setShowPassword((v) => !v)}
              placeholder="Create a password"
            />
            {password.length > 0 && (
              <div className="mt-2.5">
                {/* Track */}
                <div className="h-[5px] w-full overflow-hidden rounded-full bg-[#D1D1D6]/60">
                  {/* Fill */}
                  <div
                    className={`h-full rounded-full transition-all duration-300 ease-out ${strengthBar} ${strengthColor}`}
                  />
                </div>
                <p className={`mt-1.5 text-[11px] font-medium ${
                  strength === "weak"
                    ? "text-[#FF453A]"
                    : strength === "medium"
                      ? "text-orange-500"
                      : "text-[#34D399]"
                }`}>
                  {strengthLabel} password
                </p>
              </div>
            )}
          </div>

          {/* Confirm password */}
          <PasswordField
            id="confirmPassword"
            label="Confirm Password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            show={showConfirm}
            onToggleShow={() => setShowConfirm((v) => !v)}
            placeholder="Repeat your password"
          />

          {/* Error */}
          {error ? (
            <div className="rounded-2xl border border-[#FF453A]/20 bg-[#FF453A]/8 px-4 py-3 text-sm text-[#FF453A]">
              {error}
            </div>
          ) : null}

          {/* Submit */}
          <button type="submit" className="auth-primary-btn" disabled={loading}>
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </form>
      </div>

      {/* Footer link */}
      <p className="mt-5 text-center text-sm text-[#1C1C1E]">
        Already have an account?{" "}
        <Link to="/login" className="auth-link">
          Sign in
        </Link>
        {" · "}
        <Link to="/" className="auth-link">
          Home
        </Link>
      </p>
    </AuthSplitLayout>
  );
};
