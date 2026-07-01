import { Component } from 'react'
import type { ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="text-center max-w-sm">
            <p className="text-5xl mb-4">😵</p>
            <h1 className="text-xl font-bold mb-2">Algo salió mal</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              La app encontró un error inesperado. Intenta recargar la página.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-green-select text-white rounded-card px-6 py-3 font-semibold hover:bg-green-600"
            >
              Recargar
            </button>
            <details className="mt-6 text-left">
              <summary className="text-xs text-gray-400 cursor-pointer">Detalles del error</summary>
              <pre className="mt-2 text-xs text-red-400 bg-red-50 dark:bg-red-950 rounded-lg p-3 overflow-auto">
                {this.state.error.message}
              </pre>
            </details>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
