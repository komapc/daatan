import { GoogleGenerativeAI, SchemaType, type Schema } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export const predictionSchema: Schema = {
  description: "Structured prediction data extracted from text or URL",
  type: SchemaType.OBJECT,
  properties: {
    claim: {
      type: SchemaType.STRING,
      description: "The core prediction or claim made by the person",
    },
    author: {
      type: SchemaType.STRING,
      description: "The name of the person who made the prediction",
    },
    sourceUrl: {
      type: SchemaType.STRING,
      description: "The source URL where the prediction was found",
    },
    resolutionDate: {
      type: SchemaType.STRING,
      description: "The date when the prediction can be verified (ISO 8601 format)",
    },
    outcomeOptions: {
      type: SchemaType.ARRAY,
      description: "The possible outcomes for the prediction (e.g., ['Yes', 'No'])",
      items: {
        type: SchemaType.STRING
      }
    }
  },
  required: ["claim", "author", "resolutionDate", "outcomeOptions"],
}

export async function extractPrediction(text: string) {
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: predictionSchema,
    },
  })

  const prompt = `
    Extract a structured prediction from the following text. 
    If a resolution date is not explicitly mentioned, infer the most logical one based on the context.
    If the text contains multiple predictions, focus on the most prominent one.
    
    Text:
    ${text}
  `

  const result = await model.generateContent(prompt)
  const response = result.response
  return JSON.parse(response.text())
}
