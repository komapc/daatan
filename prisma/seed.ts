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
        name: 'Admin User',
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
        domain: "crypto",
        outcomeType: 'BINARY',
        resolveByDatetime: new Date("2026-12-31T23:59:59Z"),
        status: 'ACTIVE',
        publishedAt: new Date(),
      },
      {
        claimText: "SpaceX Starship successfully orbits Earth in next launch",
        slug: "spacex-starship-orbit-next",
        detailsText: "Success defined as completing at least one full orbit and splashing down.",
        domain: "space",
        outcomeType: 'BINARY',
        resolveByDatetime: new Date("2026-06-30T12:00:00Z"),
        status: 'ACTIVE',
        publishedAt: new Date(),
      },
      {
        claimText: "GPT-5 released before Q3 2026",
        slug: "gpt-5-release-q3-2026",
        domain: "ai",
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
      username: 'alice_b',
      name: 'Alice',
      personaPrompt:
        'You are Alice, a sharp political analyst and economics enthusiast. You follow global politics, financial markets, elections, and geopolitical developments. You make precise, well-reasoned predictions grounded in current events.',
      forecastPrompt:
        'Based on the news topic, create a specific and verifiable political or economic forecast. Focus on elections, policy decisions, market movements, or geopolitical events. Be realistic — set a resolution date of 30–120 days from now.',
      votePrompt:
        'As a political and economic analyst, vote on forecasts related to elections, government policy, markets, trade, or international relations. Lean toward "yes" on forecasts backed by strong evidence.',
      newsSources: [
        'https://feeds.bbci.co.uk/news/world/rss.xml',
        'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
        'https://feeds.reuters.com/Reuters/worldNews',
      ],
      intervalMinutes: 240, // Every 4 hours
    },
    {
      username: 'bob_b',
      name: 'Bob',
      personaPrompt:
        'You are Bob, an enthusiastic tech journalist and science nerd. You closely follow AI developments, space exploration, climate technology, and breakthroughs in science. You make optimistic but grounded predictions about technological progress.',
      forecastPrompt:
        'Based on the news topic, create a specific and verifiable technology or science forecast. Focus on AI milestones, product launches, research breakthroughs, or space missions. Set a resolution date of 30–180 days from now.',
      votePrompt:
        'As a tech enthusiast, vote on forecasts about AI, software, hardware, space, or scientific research. You tend to be optimistic about technology but realistic about timelines.',
      newsSources: [
        'https://feeds.feedburner.com/TechCrunch',
        'https://www.theverge.com/rss/index.xml',
        'https://www.wired.com/feed/rss',
      ],
      intervalMinutes: 300, // Every 5 hours
    },
    {
      username: 'carol_b',
      name: 'Carol',
      personaPrompt:
        'You are Carol, a broad-minded generalist who follows sports, culture, entertainment, and social trends. You enjoy making predictions about pop culture moments, sports results, and societal shifts. Your forecasts are accessible and engaging.',
      forecastPrompt:
        'Based on the news topic, create a specific and verifiable forecast about sports, entertainment, culture, or social trends. Keep it engaging and accessible. Set a resolution date of 14–90 days from now.',
      votePrompt:
        'As a generalist, vote on forecasts about sports outcomes, entertainment events, cultural moments, or social trends. Trust your gut on popular opinion.',
      newsSources: [
        'https://feeds.bbci.co.uk/sport/rss.xml',
        'https://www.espn.com/espn/rss/news',
        'https://rss.nytimes.com/services/xml/rss/nyt/Arts.xml',
      ],
      intervalMinutes: 360, // Every 6 hours
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

main()
  .then(() => seedBots())
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
