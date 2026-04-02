import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

interface ProtectedRouteProps {
  children: ReactNode;
}

function LoadingSpinner() {
  return (
    <div
      className="flex min-h-screen items-center justify-center"
      style={{ background: "#F5F5F7" }}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-[#D1D1D6] border-t-[#3B82F6]" />
        <p className="text-sm text-[#8E8E93]">Loading…</p>
      </div>
    </div>
  );
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { loading, session, bootstrapError } = useAuth();

  if (loading) return <LoadingSpinner />;
  if (bootstrapError && !session) {
    return <Navigate to="/login" replace />;
  }
  if (!session) return <Navigate to="/login" replace />;

  return <>{children}</>;
};
