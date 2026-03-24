import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[200px] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-destructive/10 border border-destructive/20 rounded-lg p-6 text-center">
            <div className="flex justify-center mb-4">
              <AlertCircle className="w-12 h-12 text-destructive" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2">
              出现了一些问题
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              {this.state.error?.message || '未知错误'}
            </p>
            <div className="flex gap-3 justify-center">
              <Button onClick={this.handleReset} variant="outline">
                重试
              </Button>
              <Button onClick={this.handleReload}>
                <RefreshCw className="w-4 h-4 mr-2" />
                重新加载
              </Button>
            </div>
            {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
              <details className="mt-4 text-left">
                <summary className="text-xs cursor-pointer text-muted-foreground hover:text-foreground">
                  展开错误详情
                </summary>
                <pre className="mt-2 p-3 bg-muted rounded text-[10px] overflow-auto max-h-40">
                  {this.state.error?.stack}
                  {'\n\n'}
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
