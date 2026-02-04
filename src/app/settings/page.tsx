'use client'

import { Settings, Globe } from 'lucide-react'
import { redirect } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useState } from 'react'

export default function SettingsPage() {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect('/auth/signin?callbackUrl=/settings')
    },
  })

  // Mock state for language preference
  const [language, setLanguage] = useState<'en' | 'he'>('en')

  if (status === 'loading') {
    return <div className="p-8 text-center">Loading...</div>
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6 lg:mb-8">
        <Settings className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Settings</h1>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Preferences</h2>
          <p className="text-sm text-gray-500">Manage your display and language settings.</p>
        </div>

        <div className="p-6 space-y-6">
          {/* Language Setting */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Language</p>
                <p className="text-sm text-gray-500">Choose your preferred language for the interface.</p>
              </div>
            </div>
            
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setLanguage('en')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  language === 'en'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                English
              </button>
              <button
                onClick={() => setLanguage('he')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  language === 'he'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                עברית
              </button>
            </div>
          </div>
        </div>
        
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex justify-end">
          <button 
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            onClick={() => alert('Settings saved (simulation)')}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}
