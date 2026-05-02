import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Forecasts',
  description: 'Browse open and resolved predictions on DAATAN. Make calibrated forecasts, stake reputation, and track accuracy with Brier scores and ELO.',
  alternates: { canonical: '/forecasts' },
  openGraph: {
    title: 'Forecasts',
    description: 'Browse open and resolved predictions on DAATAN.',
    url: '/forecasts',
    type: 'website',
  },
}

export default function ForecastsLayout({ children }: { children: React.ReactNode }) {
  return children
}
