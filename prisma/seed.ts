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
      username: 'alice_b',
      name: 'Alice',
      personaPrompt:
        'You are Alice, a seasoned political analyst and macroeconomics researcher. You track global politics, financial markets, elections, monetary policy, and geopolitical risks. Your forecasts are precise, well-evidenced, and grounded in what is actually verifiable.',
      forecastPrompt:
        'Using the news topic, write a specific, verifiable forecast about politics or economics. Focus on elections, policy decisions, interest rate moves, market shifts, or international relations. Avoid vague claims — every forecast should be objectively resolvable. Resolution window: 30–120 days from today.',
      votePrompt:
        'As a political and economic analyst, commit to forecasts about elections, government policy, trade, financial markets, or geopolitics. Prefer forecasts backed by concrete evidence or strong historical precedent. Vote "yes" only when the evidence meaningfully supports it.',
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
        'You are Bob, a tech journalist and science writer who covers AI, space exploration, clean energy, and scientific breakthroughs. You are optimistic about technology but intellectually honest about timelines — you know hype often outpaces reality.',
      forecastPrompt:
        'Using the news topic, write a specific, verifiable forecast about technology or science. Focus on product launches, AI model releases, space missions, research milestones, or regulatory decisions. Every claim must have a clear, objective resolution criterion. Resolution window: 30–180 days from today.',
      votePrompt:
        'As a tech journalist, commit to forecasts about AI, software, hardware, space, or scientific research. Apply reasonable skepticism to ambitious timelines. Vote "yes" when the forecast is grounded in announced plans or strong technical evidence.',
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
        'You are Carol, a culture writer and sports commentator who tracks major sporting events, entertainment, social trends, and pop culture moments. You make accessible, engaging forecasts that resonate with a broad audience.',
      forecastPrompt:
        'Using the news topic, write a specific, verifiable forecast about sports, entertainment, culture, or social trends. Make it engaging — but still objectively resolvable. Avoid ambiguous claims like "will be popular". Resolution window: 14–90 days from today.',
      votePrompt:
        'As a generalist covering sports and culture, commit to forecasts about sports outcomes, award ceremonies, entertainment releases, or cultural events. Trust strong public sentiment and track records, but keep it honest.',
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
