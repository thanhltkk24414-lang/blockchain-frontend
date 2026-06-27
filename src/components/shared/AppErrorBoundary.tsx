import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Catches render errors at the app root so failures surface instead of a blank page. */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App render failed:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="page" style={{ maxWidth: 640, margin: '2rem auto', padding: '0 1rem' }}>
          <h2>Something went wrong</h2>
          <p className="error">{this.state.error.message}</p>
          <p className="muted">
            Open DevTools → Console for details, then refresh. If this persists after a refresh, restart{' '}
            <code>npm run dev</code>.
          </p>
          <button className="btn primary" type="button" onClick={() => window.location.reload()}>
            Reload page
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}
