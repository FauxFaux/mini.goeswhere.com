import { Component, type ComponentChildren, type ErrorInfo } from "preact";
import { describeError, formatDiagnostic } from "./diagnostics.ts";

interface CrashProps {
  children: ComponentChildren;
  us?: unknown;
  resetPath: string;
  resetKey: string;
}

interface CrashState {
  crashed: boolean;
  error?: unknown;
  errorInfo?: ErrorInfo;
}

export class CrashHandler extends Component<CrashProps, CrashState> {
  state: CrashState = { crashed: false };

  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    this.setState({ crashed: true, error, errorInfo });
  }

  componentDidUpdate(previous: CrashProps) {
    if (this.state.crashed && previous.resetKey !== this.props.resetKey) {
      this.setState({ crashed: false, error: undefined, errorInfo: undefined });
    }
  }

  render(props: CrashProps, state: CrashState) {
    if (!state.crashed) return props.children;
    return (
      <section role="alert">
        <h1>Something went wrong</h1>
        <p>
          <a
            href={`#${props.resetPath}`}
            onClick={(event) => {
              event.preventDefault();
              window.location.hash = props.resetPath;
              window.location.reload();
            }}
          >
            Start fresh
          </a>{" "}
          to clear this tool’s saved state.
        </p>
        <details>
          <summary>Details for a bug report</summary>
          <pre>{describeError(state.error)}</pre>
          <pre>{formatDiagnostic(state.errorInfo)}</pre>
          <h2>URL</h2>
          <pre>{window.location.href}</pre>
          <h2>State</h2>
          <pre>{formatDiagnostic(props.us)}</pre>
        </details>
      </section>
    );
  }
}
