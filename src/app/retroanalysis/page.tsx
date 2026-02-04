'use client'

import React from 'react'

export default function RetroanalysisPage() {
  return (
    <div className="min-h-screen bg-[#0b0e11] text-[#e1e1e1] font-sans">
      <div className="max-w-6xl mx-auto p-4 md:p-8">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Geopolitical Forecast Markets</h1>
            <p className="text-gray-400 text-sm">Market ID: VEN-DECAP-2026-01</p>
          </div>
          <div className="text-right">
            <span className="text-xs text-gray-500 block">Total Volume</span>
            <span className="text-lg font-mono text-green-400">$10,542,891.42</span>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-[#161a1e] border border-[#2b3139] rounded-lg p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-semibold leading-tight max-w-lg">
                  Will the US Armed Forces capture Nicolás Maduro by January 15, 2026?
                </h2>
                <span className="px-2 py-1 bg-yellow-900/30 text-yellow-400 text-xs rounded border border-yellow-700/50">DISPUTED</span>
              </div>

              <div className="flex space-x-8 mb-8">
                <div>
                  <p className="text-xs text-gray-500">Current Probability</p>
                  <p className="text-3xl font-bold text-white">91%</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">24h Change</p>
                  <p className="text-3xl font-bold text-green-400">+84.2%</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Closing Date</p>
                  <p className="text-lg text-white">Jan 15, 2026</p>
                </div>
              </div>

              <div className="relative h-64 w-full bg-[#0d1117] rounded-lg border border-[#2b3139] overflow-hidden p-2">
                <svg viewBox="0 0 400 150" className="w-full h-full">
                  <line x1="0" y1="130" x2="400" y2="130" stroke="#2b3139" strokeWidth="1" />
                  <line x1="0" y1="80" x2="400" y2="80" stroke="#2b3139" strokeWidth="1" strokeDasharray="4" />
                  <line x1="0" y1="30" x2="400" y2="30" stroke="#2b3139" strokeWidth="1" strokeDasharray="4" />

                  <path d="M 0 120 L 50 122 L 100 120 L 150 125 L 200 121 L 250 118 L 300 122 L 320 115 L 340 110 L 350 40 L 360 20 L 370 15 L 400 10"
                    fill="none"
                    stroke="#00c087"
                    strokeWidth="3"
                    className="line-graph"
                    style={{ strokeDasharray: 1000, strokeDashoffset: 0, animation: 'draw 2s ease-out forwards' }} />
                  <circle cx="350" cy="40" r="4" fill="#00c087" />
                </svg>
                <div className="absolute bottom-2 left-4 text-[10px] text-gray-500">Dec 20</div>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-gray-500">Dec 27 (Insider Entry)</div>
                <div className="absolute bottom-2 right-4 text-[10px] text-gray-500 text-green-400 font-bold">Jan 3 (Capture)</div>
              </div>
            </div>

            <div className="bg-[#161a1e] border border-[#2b3139] rounded-lg p-6">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">High-Conviction Activity</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-gray-800/20 rounded border border-gray-700/30">
                  <div>
                    <span className="text-white font-mono">mutualdelta</span>
                    <span className="text-xs text-gray-500 ml-2">Dec 27, 2025</span>
                  </div>
                  <div className="text-right">
                    <span className="text-green-400 font-bold">$40,000 @ $0.09</span>
                    <span className="block text-[10px] text-gray-500">Est. Payout: $444,444</span>
                  </div>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-800/20 rounded border border-gray-700/30">
                  <div>
                    <span className="text-white font-mono">Burdensome-Mix</span>
                    <span className="text-xs text-gray-500 ml-2">Dec 26, 2025</span>
                  </div>
                  <div className="text-right">
                    <span className="text-green-400 font-bold">$32,537 @ $0.07</span>
                    <span className="block text-[10px] text-gray-500">Status: Disputed Claim</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-[#161a1e] border border-[#2b3139] rounded-lg p-6">
              <h3 className="font-bold mb-4">Order Book</h3>
              <div className="flex mb-4">
                <button className="flex-1 py-2 text-sm font-bold border-b-2 border-green-500 text-white">Buy</button>
                <button className="flex-1 py-2 text-sm font-bold text-gray-500 border-b-2 border-transparent">Sell</button>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Outcome</span>
                  <span className="text-white font-bold">YES</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Share Price</span>
                  <span className="text-white font-mono">$0.91</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Est. Return</span>
                  <span className="text-green-400">9.8%</span>
                </div>
                <div className="mt-6 flex gap-2">
                  <button className="flex-1 bg-[#00c087] hover:bg-[#00a374] text-white py-3 rounded-lg font-bold transition-colors">YES</button>
                  <button className="flex-1 bg-[#f6465d] hover:bg-[#d13e50] text-white py-3 rounded-lg font-bold transition-colors">NO</button>
                </div>
              </div>
            </div>

            <div className="bg-[#161a1e] border border-[#2b3139] rounded-lg p-4">
              <h3 className="text-xs font-bold text-gray-500 mb-3">LATEST NEWS</h3>
              <div className="space-y-3">
                <div className="border-l-2 border-green-500 pl-3">
                  <p className="text-xs text-white">Trump confirms capture from Mar-a-Lago press room.</p>
                  <span className="text-[10px] text-gray-500">04:21 AM</span>
                </div>
                <div className="border-l-2 border-gray-700 pl-3">
                  <p className="text-xs text-gray-400">Caracas power grid reports 100% failure.</p>
                  <span className="text-[10px] text-gray-500">02:15 AM</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
