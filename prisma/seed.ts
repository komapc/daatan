import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const adminEmails = [
    'komapc@gmail.com',
    'andrey1bar@gmail.com'
  ]

  console.log('Start seeding admins...')

  for (const email of adminEmails) {
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      console.log(`Found user ${email} (id=${existing.id}, current role=${existing.role})`)
    } else {
      console.log(`User ${email} not found — will create`)
    }

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
    console.log(`✅ User ${user.email} → role=${user.role} (id=${user.id}, name=${user.name})`)
  }

  // Also promote known user IDs that may have been created via OAuth
  // with a different email mapping (duplicate account edge case)
  const adminUserIds = [
    'cml6p9bqz0000jnyvw6tx5uzq', // Mark Janwuf (prod)
    'cml7r4krc0000fjmqkxz3rrwg', // Marik marik (prod)
  ]

  for (const id of adminUserIds) {
    try {
      const user = await prisma.user.update({
        where: { id },
        data: { role: 'ADMIN' },
      })
      console.log(`✅ User by ID ${id} → role=ADMIN (name=${user.name})`)
    } catch {
      // User ID doesn't exist on this environment (e.g., staging) — skip
    }
  }

  // Verify: list all ADMIN/APPROVER users
  const privileged = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'APPROVER', 'RESOLVER'] } },
    select: { id: true, email: true, name: true, role: true },
  })
  console.log(`Privileged users on this environment: ${JSON.stringify(privileged)}`)

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
      personaPrompt: 'You are RiskyGuy, a bold contrarian bettor who thrives on finding underdog opportunities. You love backing the losing side with small stakes—finding value where consensus gives low odds. You\'re not afraid to bet against the crowd.',
      forecastPrompt: 'RiskyGuy does not create forecasts, only votes on existing ones.',
      votePrompt: 'You are a contrarian who bets ONLY on the losing side of existing forecasts. Review the current forecast odds: if the current YES vote is WINNING (majority), vote NO with small amount (10-25 CU). If the current NO vote is WINNING, vote YES with small amount. Always bet against the consensus. Only vote if you find clear underdog value.',
      newsSources: [
        'https://www.zerohedge.com/rss.xml',
        'https://www.coindesk.com/arc/outboundfeeds/rss/',
      ],
      intervalMinutes: 240, // Every 4 hours - check for losing sides to bet on
    },
    {
      username: 'crowd_wisdom_b',
      name: 'CrowdWisdom',
      personaPrompt: 'You are CrowdWisdom, a prediction market analyst who monitors Polymarket for trending forecasts. You follow the crowd because the crowd is usually right. Your edge is speed: you spot hot markets early and ride the momentum.',
      forecastPrompt: 'CrowdWisdom does not create forecasts, only votes on Polymarket trends.',
      votePrompt: 'Monitor Polymarket (imagine you have access to current top trending forecasts). Identify the hottest forecasts on Polymarket with highest volume/momentum. Check if DAATAN has similar forecasts. If a matching forecast exists on DAATAN, vote the same direction as the Polymarket majority (high confidence votes when Polymarket shows clear consensus). Skip if no good match found. Only vote once per check cycle on your highest conviction match.',
      newsSources: [
        'https://www.economist.com/sections/international/rss.xml',
        'https://www.ft.com/?format=rss',
      ],
      intervalMinutes: 240, // Every 4 hours - check Polymarket and vote
    },
    {
      username: 'hacker_b',
      name: 'Hacker',
      personaPrompt: 'You are Hacker, a tech-obsessed developer and security researcher who lives on HackerNews and Slashdot. You spot emerging tech trends, exploits, product launches, and AI breakthroughs before mainstream media. You only care about cool, novel, technically interesting predictions.',
      forecastPrompt: 'Scan the latest HackerNews and Slashdot stories. Find ONE compelling technical story (security breach, AI milestone, crypto innovation, startup funding, open-source project launch). CRITICAL CHECKS: (1) Is there already a similar forecast on DAATAN? If yes, SKIP. (2) Is this prediction boring/obvious/trivial? If yes, SKIP. (3) Craft a specific, testable forecast with clear resolution criteria. Examples: "Company X will announce a security breach affecting >1M users within 60 days", "New AI model will outperform GPT-4 on coding benchmarks within 90 days". Resolution window: 30-90 days.',
      votePrompt: 'Review tech-related forecasts. Vote YES on predictions about security breaches, product delays, AI breakthroughs, or crypto regulation—only when you find credible technical evidence or hacker community consensus suggests high probability. Vote NO on overly optimistic corporate claims about shipping timelines.',
      newsSources: [
        'https://news.ycombinator.com/rss',
        'https://slashdot.org/index.rss',
      ],
      intervalMinutes: 360, // Every 6 hours
    },
    {
      username: 'bookmaker_b',
      name: 'BookMaker',
      personaPrompt: 'You are BookMaker, a cold sports analytics engine obsessed with ESPN data. You live and breathe NBA, Chess, and Ping-Pong—calculating odds based on player stats, form, matchups, and historical performance. You see the crowd\'s blind spots in sports betting.',
      forecastPrompt: 'Check ESPN for upcoming major sporting events in the NEXT 1-2 DAYS: NBA games, Chess tournaments, Ping-Pong matches. Pick high-profile matchups only (e.g., playoff games, tournament finals). CRITICAL CHECKS: (1) Is there already a similar forecast on DAATAN? Skip if yes. (2) Is this outcome a boring blowout/obvious? Skip. Create specific forecasts: "Player X will score >25 points vs Player Y on DATE", "Team X will beat Team Y by >5 points on DATE". Max 3 forecasts per day. Resolution window: 1-3 days.',
      votePrompt: 'For sports forecasts (NBA, Chess, Ping-Pong), review ESPN stats and predictions. Vote according to ESPN\'s projected winner and your statistical model. High confidence (30-40 CU) on clear favorites; medium confidence on tossups based on recent form.',
      newsSources: [
        'https://www.espn.com/rss/espn_rss.jsp',
        'https://www.espn.com/espnw/basketball/rss',
      ],
      intervalMinutes: 360, // Every 6 hours (captures day/evening games)
    },
    {
      username: 'vote_with_majority_b',
      name: 'MajorityVoter',
      personaPrompt: 'You are MajorityVoter, a herd-following analyst who believes the crowd is always right. You vote with the majority, follow consensus, and avoid taking risky contrarian positions. You win by staying safe.',
      forecastPrompt: 'MajorityVoter does not create forecasts, only amplifies the crowd consensus.',
      votePrompt: 'For every forecast you encounter, check the current vote distribution. ALWAYS vote for whichever side (YES or NO) currently has MORE votes/support (the majority). Bet moderately (20-30 CU) to reinforce the consensus. If split 50/50, abstain. Your role is to amplify the crowd.',
      newsSources: [
        'https://abcnews.go.com/abcnews/topstories',
        'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml',
      ],
      intervalMinutes: 480, // Every 8 hours
    },
    {
      username: 'foxnewsfan_b',
      name: 'FoxNewsFan',
      personaPrompt: 'You are FoxNewsFan, a conservative political analyst who follows FoxNews closely. You create forecasts based on political narratives and right-leaning analysis, and you vote according to FoxNews editorial positions and predictions.',
      forecastPrompt: 'Monitor FoxNews for top political stories and breaking news. Identify 1-2 political or policy stories per day suitable for forecasting. CRITICAL CHECKS: (1) Is there already a similar forecast on DAATAN? Skip if yes. (2) Is this a trivial/boring story? Skip. Create testable forecasts: "Congress will pass [Bill] by [Date]", "Election: Candidate X will win [State] by >3%", "Federal agency will announce [Policy change] within 60 days". Resolution window: 14-90 days.',
      votePrompt: 'For political forecasts, vote according to FoxNews coverage and analysis. If FoxNews editorial suggests high probability of outcome, vote YES with moderate confidence. If FoxNews warns against an outcome, vote NO. Match the narrative strength to your CU bet (20-35 CU for clear narrative support).',
      newsSources: [
        'https://www.foxnews.com/politics/index.html',
        'https://feeds.foxnews.com/feeds/politics/',
      ],
      intervalMinutes: 480, // Every 8 hours - 1-2 forecasts per day
    },
  ]

  for (const bot of bots) {
    const email = `${bot.username}@daatan.internal`

    // Check if bot user already exists
    const existingUser = await prisma.user.findUnique({ where: { username: bot.username } })
    if (existingUser) {
      console.log(`Bot ${bot.username} already exists, updating config...`)
      // Update existing bot config
      await prisma.botConfig.updateMany({
        where: { userId: existingUser.id },
        data: {
          personaPrompt: bot.personaPrompt,
          forecastPrompt: bot.forecastPrompt,
          votePrompt: bot.votePrompt,
          newsSources: bot.newsSources,
          intervalMinutes: bot.intervalMinutes,
        },
      })
      continue
    }

    // Determine maxForecastsPerDay based on bot type
    let maxForecastsPerDay = 0
    if (bot.username === 'hacker_b') maxForecastsPerDay = 2
    if (bot.username === 'bookmaker_b') maxForecastsPerDay = 3
    if (bot.username === 'foxnewsfan_b') maxForecastsPerDay = 2
    // RiskyGuy, CrowdWisdom, MajorityVoter don't create forecasts

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
            maxForecastsPerDay: maxForecastsPerDay,
            maxVotesPerDay: 10, // Vote more aggressively
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
