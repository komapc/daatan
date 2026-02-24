import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const adminEmails = [
    'komapc@gmail.com',
    'andrey1bar@gmail.com'
  ]

  console.log('Start seeding admins...')

  for (const email of adminEmails) {
    const user = await prisma.user.upsert({
      where: { email },
      update: { role: 'ADMIN' },
      create: {
        email,
        name: email.split('@')[0], // Replaced on first Google login
        role: 'ADMIN',
        username: email.split('@')[0], // Fallback username
      },
    })
    console.log(`Updated user ${user.email} to ADMIN role`)
  }

  console.log('Seeding predictions...')
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } })

  if (admin) {
    const predictions = [
      {
        claimText: "Bitcoin will reach $100k by end of 2026",
        slug: "btc-100k-2026",
        detailsText: "Prediction based on current market trends and halving cycles.",
        outcomeType: 'BINARY',
        resolveByDatetime: new Date("2026-12-31T23:59:59Z"),
        status: 'ACTIVE',
        publishedAt: new Date(),
      },
      {
        claimText: "SpaceX Starship successfully orbits Earth in next launch",
        slug: "spacex-starship-orbit-next",
        detailsText: "Success defined as completing at least one full orbit and splashing down.",
        outcomeType: 'BINARY',
        resolveByDatetime: new Date("2026-06-30T12:00:00Z"),
        status: 'ACTIVE',
        publishedAt: new Date(),
      },
      {
        claimText: "GPT-5 released before Q3 2026",
        slug: "gpt-5-release-q3-2026",
        outcomeType: 'BINARY',
        resolveByDatetime: new Date("2026-09-30T23:59:59Z"),
        status: 'DRAFT',
        publishedAt: null,
      }
    ]

    for (const p of predictions) {
      await prisma.prediction.upsert({
        where: { slug: p.slug },
        update: {},
        create: {
          ...p,
          outcomeType: p.outcomeType as any,
          status: p.status as any,
          authorId: admin.id
        }
      })
      console.log(`Upserted prediction: ${p.slug}`)
    }
  }
}

async function seedBots() {
  console.log('Seeding bot users...')

  const bots = [
    {
      username: 'riskyguy_b',
      name: 'RiskyGuy',
      personaPrompt: 'You are RiskyGuy, a contrarian trader who looks for black swans and high-variance events. You love betting against the consensus and spotting unlikely but highly impactful geopolitical or economic disruptions.',
      forecastPrompt: 'Using the news topic, write a specific, verifiable forecast about an unlikely but highly consequential event (a "black swan"). Focus on sudden political shifts, market crashes, or disruptive tech breakthroughs. Resolution window: 30–120 days from today.',
      votePrompt: 'As a contrarian risk-taker, commit to forecasts that go against the mainstream grain. Look for asymmetric upside in overlooked risks or opportunities. Vote "no" on consensus outcomes that seem overvalued or overly certain.',
      newsSources: [
        'https://www.zerohedge.com/rss.xml',
        'https://www.coindesk.com/arc/outboundfeeds/rss/',
        'https://cointelegraph.com/rss',
      ],
      intervalMinutes: 180, // Every 3 hours
    },
    {
      username: 'crowd_wisdom_b',
      name: 'CrowdWisdom',
      personaPrompt: 'You are CrowdWisdom, a trend analyst who tracks public sentiment, social media momentum, and prediction market consensus. You believe that crowds are usually right and look for converging opinions across disparate sources.',
      forecastPrompt: 'Using the news topic, write a specific, verifiable forecast about popular culture, elections, or major social events. Focus on outcomes that depend on mass human behavior. Resolution window: 14–90 days from today.',
      votePrompt: 'As a consensus-seeker, commit to forecasts that align with growing public sentiment or market momentum. Avoid extreme outliers. Vote "yes" on outcomes that have strong social or statistical support.',
      newsSources: [
        'https://www.economist.com/sections/international/rss.xml',
        'https://www.ft.com/?format=rss',
        'https://fivethirtyeight.com/features/feed/',
      ],
      intervalMinutes: 480, // Every 8 hours
    },
    {
      username: 'hacker_b',
      name: 'Hacker',
      personaPrompt: 'You are Hacker, a cynical cybersecurity researcher and tech analyst. You follow zero-day exploits, crypto markets, AI safety, and tech infrastructure. You are deeply skeptical of corporate marketing and vaporware.',
      forecastPrompt: 'Using the news topic, write a specific, verifiable forecast about technology, cybersecurity, or crypto. Focus on product delays, security breaches, regulatory actions, or technical milestones. Resolution window: 30–180 days from today.',
      votePrompt: 'As a tech skeptic, commit to forecasts about software releases, crypto, or AI. Apply extreme skepticism to ambitious corporate timelines. Vote "yes" only when there is undeniable technical evidence or shipped code.',
      newsSources: [
        'https://news.ycombinator.com/rss',
        'https://slashdot.org/index.rss',
        'https://www.theverge.com/rss/index.xml',
      ],
      intervalMinutes: 240, // Every 4 hours
    },
    {
      username: 'bookmaker_b',
      name: 'BookMaker',
      personaPrompt: 'You are BookMaker, a cold, calculating oddsmaker and macro-analyst. You evaluate political, economic, and global events purely based on objective probabilities, historical base rates, and market friction. You do not care about narratives, only numbers.',
      forecastPrompt: 'Using the news topic, write a specific, verifiable forecast. Focus on measurable outcomes like economic data, election margins, or market indices. Avoid qualitative claims. Resolution window: 30–120 days from today.',
      votePrompt: 'As a probability-focused oddsmaker, commit to forecasts that represent mispriced odds based on historical data. Focus on "locking in" value and avoiding narrative traps. Vote purely based on the highest expected value.',
      newsSources: [
        'https://www.bloomberg.com/politics/feeds/site.xml',
        'https://www.reutersagency.com/feed/',
        'https://www.wsj.com/xml/rss/3_7085.xml',
      ],
      intervalMinutes: 360, // Every 6 hours
    },
    {
      username: 'vote_with_majority_b',
      name: 'MajorityVoter',
      personaPrompt: 'You are MajorityVoter, a cautious analyst who only bets on sure things. You follow conventional wisdom, institutional consensus, and highly established trends. You strongly avoid speculation.',
      forecastPrompt: 'Using the news topic, write a highly probable, specific, and verifiable forecast about a mainstream news event. Focus on predictable outcomes like scheduled government announcements. Resolution window: 14–60 days from today.',
      votePrompt: 'As a conservative forecaster, commit to the most likely outcomes. Avoid risky bets or contrarian positions. Vote "yes" only on events that are nearly certain to occur based on established consensus.',
      newsSources: [
        'https://abcnews.go.com/abcnews/topstories',
        'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml',
        'https://feeds.bbci.co.uk/news/world/rss.xml',
      ],
      intervalMinutes: 600, // Every 10 hours
    },
  ]

  for (const bot of bots) {
    const email = `${bot.username}@daatan.internal`

    // Check if bot user already exists
    const existingUser = await prisma.user.findUnique({ where: { username: bot.username } })
    if (existingUser) {
      console.log(`Bot ${bot.username} already exists, skipping`)
      continue
    }

    await prisma.user.create({
      data: {
        email,
        name: bot.name,
        username: bot.username,
        slug: bot.username,
        isBot: true,
        emailNotifications: false,
        isPublic: true,
        cuAvailable: 100,
        botConfig: {
          create: {
            personaPrompt: bot.personaPrompt,
            forecastPrompt: bot.forecastPrompt,
            votePrompt: bot.votePrompt,
            newsSources: bot.newsSources,
            intervalMinutes: bot.intervalMinutes,
            maxForecastsPerDay: 3,
            maxVotesPerDay: 8,
            stakeMin: 10,
            stakeMax: 50,
            modelPreference: 'google/gemini-2.0-flash-exp:free',
            hotnessMinSources: 2,
            hotnessWindowHours: 6,
            isActive: true,
          },
        },
      },
    })

    console.log(`Created bot user: ${bot.username}`)
  }
}

async function seedNotifications() {
  console.log('Seeding notifications...')

  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } })
  const bot = await prisma.user.findFirst({ where: { isBot: true } })
  const prediction = await prisma.prediction.findFirst()

  if (!admin) {
    console.log('No admin found, skipping notifications.')
    return
  }

  // Clear existing notifications for admin to avoid duplicates on re-seed
  await prisma.notification.deleteMany({
    where: { userId: admin.id }
  })

  const notifications = [
    {
      userId: admin.id,
      type: 'SYSTEM',
      title: 'Welcome to DAATAN!',
      message: 'Your account has been successfully created. Start by making your first forecast.',
      read: false,
    },
  ]

  if (bot && prediction) {
    notifications.push(
      {
        userId: admin.id,
        type: 'NEW_COMMITMENT',
        title: 'New commitment on your forecast',
        message: `${bot.name} has committed to your forecast.`,
        read: false,
      } as any,
      {
        userId: admin.id,
        type: 'COMMENT_ON_FORECAST',
        title: 'New comment on your forecast',
        message: `${bot.name} commented: "I think the historical data supports this."`,
        read: false,
      } as any,
      {
        userId: admin.id,
        type: 'MENTION',
        title: 'You were mentioned',
        message: `${bot.name} mentioned you in a comment.`,
        read: false,
      } as any,
      {
        userId: admin.id,
        type: 'COMMITMENT_RESOLVED',
        title: 'Forecast resolved',
        message: 'A forecast you committed to has been resolved as correct!',
        read: true,
      } as any
    )

    // add links and refs
    for (let i = 1; i < notifications.length; i++) {
      (notifications[i] as any).predictionId = prediction.id;
      (notifications[i] as any).actorId = bot.id;
      if (notifications[i].type === 'COMMENT_ON_FORECAST' || notifications[i].type === 'MENTION') {
        (notifications[i] as any).link = `/forecasts/${prediction.id}#comments`;
      } else {
        (notifications[i] as any).link = `/forecasts/${prediction.id}`;
      }
    }
  }

  for (const n of notifications) {
    await prisma.notification.create({
      data: n as any
    })
  }
  console.log(`Created ${notifications.length} notifications for admin`)
}

main()
  .then(() => seedBots())
  .then(() => seedNotifications())
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
