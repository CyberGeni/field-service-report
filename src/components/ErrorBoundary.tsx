import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Keeps one screen's failure from taking the app down with it.
 *
 * React unmounts the whole tree on an uncaught render error, so without this any
 * single bad value anywhere renders the entire app as a blank white page.
 */
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Screen failed to render:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    const { error } = this.state;

    if (!error) return this.props.children;

    return (
      <div className="bg-white rounded-xl p-6">
        <div className="flex items-center space-x-3 mb-4">
          <AlertCircle size={24} className="text-red-500" />
          <h3 className="text-lg font-semibold text-gray-800">Something went wrong</h3>
        </div>

        <p className="text-gray-600 mb-2">
          This screen couldn't be displayed. Your recorded hours are safe.
        </p>
        <p className="text-sm text-gray-500 break-words mb-6">{error.message}</p>

        <button
          type="button"
          onClick={this.handleReset}
          className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-colors"
        >
          <RotateCcw size={18} />
          <span>Try Again</span>
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
