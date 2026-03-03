import { generateExpressPrediction } from './src/lib/llm/expressPrediction'

async function test() {
  console.log('Testing input: "tomorrow - less alarms than today it tel aviv"')
  try {
    const result = await generateExpressPrediction('tomorrow - less alarms than today it tel aviv', (stage, data) => {
      console.log(`[${stage}]`, data || '')
    })
    console.log('SUCCESS:', JSON.stringify(result, null, 2))
  } catch (error) {
    console.error('FAILED:', error)
  }
}

test()
