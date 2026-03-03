export interface BotDefinition {
    username: string
    name: string
    description?: string
    personaPrompt: string
    forecastPrompt: string
    votePrompt: string
    newsSources: string[]
    intervalMinutes: number
    maxForecastsPerDay: number
    maxVotesPerDay: number
    stakeMin: number
    stakeMax: number
    modelPreference: string
    hotnessMinSources: number
    hotnessWindowHours: number
}
