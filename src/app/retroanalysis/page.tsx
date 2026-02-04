'use client'

import React, { useState } from 'react'

interface NewsItem {
  source: string
  headline: string
  date: string
  quote?: string
}

const accurateForecasts: NewsItem[] = [
  { source: 'THE WALL STREET JOURNAL', headline: "Pentagon Weighs 'Kinetic Options' as Caracas Deadlock Hardens", date: 'Dec 29, 2025' },
  { source: 'X - @SENTINELS_INTEL (OSINT)', headline: 'Unusual C-17 Activity at Guantanamo Bay', date: 'Jan 03, 2026' },
  { source: 'MIAMI HERALD', headline: "White House Sources: 'Patience has Run Out' on Venezuela", date: 'Jan 05, 2026' },
  { source: 'PANAM POST', headline: 'The Capture is the Only Way Out', date: 'Dec 30, 2025' },
  { source: 'FOREIGN POLICY', headline: 'The End of Diplomacy in the Caribbean', date: 'Jan 02, 2026' },
  { source: 'INFOBAE', headline: 'Navy Seals Training in Colombia?', date: 'Jan 04, 2026' },
]

const inaccurateForecasts: NewsItem[] = [
  { source: 'THE NEW YORK TIMES', headline: 'Why Military Intervention in Venezuela is Off the Table', date: 'Dec 29, 2025' },
  { source: 'AL JAZEERA ENGLISH', headline: 'Regional Powers Rule Out Force', date: 'Jan 02, 2026' },
  { source: 'THE GUARDIAN', headline: "Maduro's Grip Tightens Amid U.S. Indecision", date: 'Jan 04, 2026' },
  { source: 'VENEZUELANALYSIS', headline: 'Invasion Rumors are Psychological Warfare', date: 'Dec 31, 2025' },
  { source: 'THE WASHINGTON POST', headline: 'Editorial: Stick to the Sanctions', date: 'Jan 03, 2026' },
  { source: 'REUTERS', headline: 'Backchannel Talks Continue in Barbados', date: 'Jan 05, 2026', quote: '"Diplomats from both sides report \'significant progress\' on an exit roadmap. The threat of force has been effectively sidelined by these productive negotiations."' },
]

export default function RetroanalysisPage() {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)

  return (
    <div className="min-h-screen bg-[#f5f7fa] text-gray-800 font-sans">
      <div className="max-w-6xl mx-auto p-4 md:p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <span className="inline-block px-4 py-1 bg-teal-500 text-white text-xs font-bold rounded-full mb-4">
            POLITICAL FORECAST MARKET #882-VZ
          </span>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            U.S. Military Extraction of Maduro
          </h1>
          <p className="text-gray-500 text-sm max-w-xl mx-auto">
            Media Sentiment Analysis: 14 Days Preceding the Jan 2026 Operation. Hover over sources to view verified predictive quotes.
          </p>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* YES / ACTION Column */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-teal-500 p-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                <span className="text-white font-bold italic">YES / ACTION</span>
              </div>
              <div className="text-right">
                <p className="text-teal-100 text-[10px] uppercase tracking-wider">Predicted Outcome</p>
                <p className="text-white font-bold">SUCCESS</p>
              </div>
            </div>
            
            <div className="p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1">
                <span className="w-3 h-3 rounded-full border border-gray-300 inline-block"></span>
                ACCURATE ANALYTICAL FORECASTS
              </p>
              <div className="space-y-3">
                {accurateForecasts.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-gray-50 rounded border-l-4 border-teal-500 hover:bg-teal-50 transition-colors cursor-pointer"
                    onMouseEnter={() => setHoveredItem(`accurate-${idx}`)}
                    onMouseLeave={() => setHoveredItem(null)}
                  >
                    <div className="flex justify-between items-start">
                      <p className="text-xs text-gray-500 font-medium">{item.source}</p>
                      <p className="text-xs text-gray-400">{item.date}</p>
                    </div>
                    <p className="text-sm font-medium text-gray-800 mt-1">{item.headline}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* NO / DIPLOMACY Column */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-rose-500 p-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </span>
                <span className="text-white font-bold italic">NO / DIPLOMACY</span>
              </div>
              <div className="text-right">
                <p className="text-rose-100 text-[10px] uppercase tracking-wider">Predicted Outcome</p>
                <p className="text-white font-bold">FAILED</p>
              </div>
            </div>
            
            <div className="p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1">
                <span className="w-3 h-3 rounded-full border border-gray-300 inline-block"></span>
                INACCURATE / DISMISSIVE FORECASTS
              </p>
              <div className="space-y-3">
                {inaccurateForecasts.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-gray-50 rounded border-l-4 border-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
                    onMouseEnter={() => setHoveredItem(`inaccurate-${idx}`)}
                    onMouseLeave={() => setHoveredItem(null)}
                  >
                    <div className="flex justify-between items-start">
                      <p className="text-xs text-gray-500 font-medium">{item.source}</p>
                      <p className="text-xs text-gray-400">{item.date}</p>
                    </div>
                    <p className="text-sm font-medium text-gray-800 mt-1">{item.headline}</p>
                    {item.quote && (
                      <div className="mt-3 p-3 bg-rose-500 rounded text-white text-xs">
                        <p className="text-rose-200 text-[10px] uppercase tracking-wider mb-1">EXACT QUOTE</p>
                        <p className="italic">{item.quote}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
