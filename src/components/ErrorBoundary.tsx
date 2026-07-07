import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-gray-950 text-center">
          <div className="text-5xl mb-4">😵</div>
          <h1 className="text-xl font-bold mb-2 text-gray-800 dark:text-gray-100">Algo salió mal</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            La app encontró un error inesperado. Intenta recargar la página.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-green-500 text-white px-6 py-2.5 rounded-xl font-semibold text-sm"
          >
            Recargar
          </button>
          <details className="mt-6 text-left max-w-sm">
            <summary className="text-xs text-gray-400 cursor-pointer">Detalles del error</summary>
            <pre className="mt-2 text-xs text-red-500 overflow-auto max-h-40 bg-gray-100 dark:bg-gray-900 p-2 rounded">
              {this.state.error.message}
            </pre>
          </details>
        </div>
      )
    }
    return this.props.children
  }
}
