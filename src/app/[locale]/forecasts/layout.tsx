import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Forecasts | Daatan',
  description: 'Browse prediction markets and forecasts. Make your predictions and track outcomes.',
  openGraph: {
    title: 'Forecasts | Daatan',
    description: 'Browse prediction markets and forecasts.',
  },
}

export default function ForecastsLayout({ children }: { children: React.ReactNode }) {
  return children
}
