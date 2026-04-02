import { type FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { AuthLogo } from "../components/AuthLogo";
import { AuthSplitLayout } from "../components/AuthSplitLayout";
import { PasswordField } from "../components/PasswordField";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";

export const LoginPage = () => {
  const navigate = useNavigate();
  const { loading: authLoading, session } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!authLoading && session) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSignIn = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!supabase) {
      setError(
        "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.",
      );
      return;
    }
    setLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
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
          Welcome back
        </h2>
        <p className="mt-1 text-sm text-[#636366]">
          Sign in to continue to <span className="brand-wordmark">PromptFix</span>
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSignIn} noValidate>
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

          {/* Password */}
          <div>
            <PasswordField
              id="password"
              label="Password"
              value={password}
              onChange={setPassword}
              show={showPassword}
              onToggleShow={() => setShowPassword((v) => !v)}
              placeholder="Enter your password"
            />
            <div className="mt-2 flex justify-end">
              <Link to="/forgot-password" className="auth-link">
                Forgot password?
              </Link>
            </div>
          </div>

          {/* Error */}
          {error ? (
            <div className="rounded-2xl border border-[#FF453A]/20 bg-[#FF453A]/8 px-4 py-3 text-sm text-[#FF453A]">
              {error}
            </div>
          ) : null}

          {/* Submit */}
          <button type="submit" className="auth-primary-btn" disabled={loading}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

      </div>

      {/* Footer link */}
      <p className="mt-5 text-center text-sm text-[#636366]">
        Don't have an account?{" "}
        <Link to="/signup" className="auth-link">
          Sign up
        </Link>
        {" · "}
        <Link to="/" className="auth-link">
          Home
        </Link>
      </p>
    </AuthSplitLayout>
  );
};
