import type { ErrorInfo, ReactNode } from "react";
import { Component } from "react";
import { useLocation } from "react-router-dom";

interface BoundaryProps {
  children: ReactNode;
}

interface InnerProps extends BoundaryProps {
  routePath: string;
}

interface BoundaryState {
  hasError: boolean;
  errorMessage: string | null;
}

class AppErrorBoundaryInner extends Component<InnerProps, BoundaryState> {
  state: BoundaryState = { hasError: false, errorMessage: null };

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : "Unknown rendering error.",
    };
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    console.error("[AppErrorBoundary] Route render failure", {
      routePath: this.props.routePath,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      componentStack: errorInfo.componentStack,
    });
  }

  componentDidUpdate(prevProps: InnerProps) {
    if (this.state.hasError && prevProps.routePath !== this.props.routePath) {
      this.setState({ hasError: false, errorMessage: null });
    }
  }

  private retry = () => {
    this.setState({ hasError: false, errorMessage: null });
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <section className="mx-auto max-w-2xl rounded-3xl border border-rose-200 bg-rose-50/90 p-6 text-[#1C1C1E] shadow-[0_10px_30px_rgba(28,28,30,0.10)]">
        <h2 className="text-lg font-semibold text-rose-700">We hit a rendering error</h2>
        <p className="mt-2 text-sm text-rose-700/90">
          Route: <span className="font-semibold">{this.props.routePath}</span>
        </p>
        <p className="mt-2 text-sm text-rose-700/90">
          {this.state.errorMessage ?? "The page failed to render. Please retry."}
        </p>
        <button
          type="button"
          onClick={this.retry}
          className="mt-4 rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Retry
        </button>
      </section>
    );
  }
}

export const AppErrorBoundary = ({ children }: BoundaryProps) => {
  const location = useLocation();
  return (
    <AppErrorBoundaryInner routePath={location.pathname}>
      {children}
    </AppErrorBoundaryInner>
  );
};
