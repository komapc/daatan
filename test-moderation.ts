import { checkContent } from './src/lib/services/moderation'

async function runTests() {
  const tests = [
    { text: "Will Bitcoin reach $100k by 2026?", type: 'forecast' as const, expected: false },
    { text: "I think this is a great platform.", type: 'comment' as const, expected: false },
    { text: "I hate all people from [protected group] and want to hurt them.", type: 'comment' as const, expected: true },
    { text: "When will [Politician Name] be assassinated?", type: 'forecast' as const, expected: true },
    { text: "Buy cheap crypto now at scam-site.com!!!", type: 'comment' as const, expected: true },
  ]

  console.log('--- Starting Moderation Tests ---')
  for (const test of tests) {
    console.log(`\nTesting: "${test.text.substring(0, 50)}..." (${test.type})`)
    try {
      const result = await checkContent(test.text, test.type)
      console.log('Result:', JSON.stringify(result, null, 2))
      if (result.isOffensive === test.expected) {
        console.log('✅ Match expected')
      } else {
        console.log('❌ UNEXPECTED RESULT')
      }
    } catch (error) {
      console.error('💥 ERROR during check:', error)
    }
  }
  console.log('\n--- Tests Finished ---')
}

runTests().catch(console.error)
