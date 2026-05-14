import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export default function ForecastNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <h1 className="text-6xl font-bold text-gray-200 mb-4">404</h1>
      <h2 className="text-2xl font-semibold text-white mb-2">Forecast Not Found</h2>
      <p className="text-gray-500 mb-8 max-w-md">
        This forecast no longer exists or may have been removed.
      </p>
      <Link
        href="/forecasts"
        className="inline-flex items-center gap-2 px-6 py-3 bg-cobalt text-white rounded-lg hover:bg-cobalt/80 transition-colors"
      >
        <ChevronLeft className="w-5 h-5" />
        Browse Forecasts
      </Link>
    </div>
  )
}
