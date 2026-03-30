import type { Metadata } from 'next'
import SignupClient from './SignupClient'

export const metadata: Metadata = {
  title: 'Sign Up | DAATAN',
  description: 'Create an account to start tracking your forecasts.',
}

export default function SignupPage() {
  return <SignupClient />
}
