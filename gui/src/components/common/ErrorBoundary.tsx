import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="glass-card rounded-2xl p-8 max-w-md text-center">
            <span className="material-icons text-4xl text-primary mb-4 block">error_outline</span>
            <h2 className="text-lg font-bold text-[var(--color-moonlight)] mb-2">發生錯誤</h2>
            <p className="text-sm text-[var(--color-morning-mist)] mb-4">
              {this.state.error?.message || '未知錯誤'}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="sakura-btn px-4 py-2 rounded-xl text-sm font-bold"
            >
              重試
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
