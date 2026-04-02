import type { ReactNode } from "react";

interface AuthPageShellProps {
  children: ReactNode;
}

export const AuthPageShell = ({ children }: AuthPageShellProps) => {
  return (
    <div className="auth-page min-h-screen px-0 pb-0 pt-[max(1.25rem,env(safe-area-inset-top))] md:flex md:items-center md:justify-center md:p-8">
      <div className="auth-card min-h-[calc(100vh-max(1.25rem,env(safe-area-inset-top)))] w-full rounded-none border-x-0 border-b-0 px-5 py-6 md:mx-auto md:min-h-0 md:max-w-md md:rounded-[2rem] md:border md:p-8">
        {children}
      </div>
    </div>
  );
};
