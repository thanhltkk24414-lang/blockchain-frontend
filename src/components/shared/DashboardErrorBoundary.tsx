import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  section?: string;
}

interface State {
  error: Error | null;
}

/** Catches render errors in a dashboard section so one bad row does not crash the page. */
export class DashboardErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`Dashboard section failed${this.props.section ? ` (${this.props.section})` : ''}:`, error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <p className="error">
          Could not render {this.props.section ?? 'this section'}: {this.state.error.message}
        </p>
      );
    }
    return this.props.children;
  }
}
