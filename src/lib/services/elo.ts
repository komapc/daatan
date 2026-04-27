const K = 32

interface EloInput {
  userId: string
  brierScore: number
  eloRating: number
}

/**
 * Compute pairwise ELO deltas for all users who committed to the same prediction.
 * Lower brierScore = better outcome = wins the matchup.
 * Returns a map of userId → total ELO delta from all pairings.
 */
export function calculateEloUpdates(commitments: EloInput[]): Map<string, number> {
  const deltas = new Map<string, number>()

  for (let i = 0; i < commitments.length; i++) {
    for (let j = i + 1; j < commitments.length; j++) {
      const a = commitments[i]
      const b = commitments[j]

      const expectedA = 1 / (1 + 10 ** ((b.eloRating - a.eloRating) / 400))
      const actualA =
        a.brierScore < b.brierScore ? 1 : a.brierScore > b.brierScore ? 0 : 0.5

      const delta = Math.round(K * (actualA - expectedA))

      deltas.set(a.userId, (deltas.get(a.userId) ?? 0) + delta)
      deltas.set(b.userId, (deltas.get(b.userId) ?? 0) - delta)
    }
  }

  return deltas
}
