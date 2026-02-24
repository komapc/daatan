/**
 * LLM prompt templates for forecast/prediction creation.
 * All prompts sent to Gemini are defined here for a single source of truth.
 */

export { getExpressPredictionPrompt, type ExpressPredictionPromptParams } from './expressPrediction'
export { getExtractPredictionPrompt } from './extractPrediction'
export { getContextUpdatePrompt } from './updateContext'
export { getSuggestTagsPrompt } from './suggestTags'
