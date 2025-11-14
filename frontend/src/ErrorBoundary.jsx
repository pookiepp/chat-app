import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('Uncaught error in React tree:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6">
          <h2 className="text-2xl font-bold text-red-600">Something went wrong</h2>
          <pre className="mt-4 whitespace-pre-wrap bg-zinc-100 dark:bg-zinc-800 p-4 rounded">{String(this.state.error)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}
