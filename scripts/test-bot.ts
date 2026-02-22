import { runDueBots } from '../src/lib/services/bot-runner'

async function main() {
  console.log('Running bots...')
  const summaries = await runDueBots(true)
  console.log('Summaries:', JSON.stringify(summaries, null, 2))
}
main().catch(console.error)
