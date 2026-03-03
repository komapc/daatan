import { BotDefinition } from './types'

import { riskyGuy } from './riskyguy'
import { crowdWisdom } from './crowdwisdom'
import { hacker } from './hacker'
import { bookmaker } from './bookmaker'
import { majorityVoter } from './majorityvoter'
import { foxNewsFan } from './foxnewsfan'

export * from './types'

export const BOT_REGISTRY: BotDefinition[] = [
    riskyGuy,
    crowdWisdom,
    hacker,
    bookmaker,
    majorityVoter,
    foxNewsFan
]
