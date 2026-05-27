import { GlickoChart } from './GlickoChart'
import type { ProfileScores, TopicStat } from '@/lib/services/profile'

interface ScoresGridProps {
  scores: ProfileScores
  user: { eloRating: number; mu: number; sigma: number }
  userId: string
  selectedTag: string | null
  tagName: string | null
}

function ScoreCard({
  label,
  value,
  sub,
  color = 'default',
  title,
}: {
  label: string
  value: string
  sub?: string
  color?: 'default' | 'purple' | 'blue' | 'teal' | 'red'
  title?: string
}) {
  const valueClass =
    color === 'purple'
      ? 'text-purple-400'
      : color === 'blue'
        ? 'text-blue-400'
        : color === 'teal'
          ? 'text-teal'
          : color === 'red'
            ? 'text-red-400'
            : 'text-text-secondary'

  return (
    <div
      className="px-4 py-3 bg-navy-800 rounded-xl border border-navy-600"
      title={title}
    >
      <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block leading-tight mb-1">
        {label}
      </span>
      <span className={`text-sm font-bold ${valueClass}`}>{value}</span>
      {sub && <span className="text-[10px] text-gray-400 block mt-0.5">{sub}</span>}
    </div>
  )
}

function SignedCard({
  label,
  value,
  sub,
  title,
}: {
  label: string
  value: number
  sub?: string
  title?: string
}) {
  return (
    <ScoreCard
      label={label}
      value={`${value >= 0 ? '+' : ''}${value}`}
      sub={sub}
      color={value >= 0 ? 'teal' : 'red'}
      title={title}
    />
  )
}

export function ScoresGrid({ scores, user, userId, selectedTag, tagName }: ScoresGridProps) {
  const tag = tagName ?? selectedTag

  return (
    <div className="mb-8 space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        <ScoreCard
          label="ELO Rating"
          value={String(Math.round(user.eloRating))}
          sub="global (head-to-head)"
          color="blue"
          title="ELO head-to-head rating. Updated each time a prediction resolves and you are compared against other committers."
        />
        <ScoreCard
          label="Glicko-2"
          value={`μ ${Math.round(user.mu)}`}
          sub={`± ${Math.round(user.sigma)} uncertainty`}
          color="blue"
          title="Glicko-2 skill estimate. μ = mean skill, σ = uncertainty. Rank = μ − 3σ (volume-adjusted)."
        />
        {scores.avgBrierScore !== null && (
          <ScoreCard
            label={`Brier Score${tag ? ` · ${tag}` : ''}`}
            value={scores.avgBrierScore.toFixed(3)}
            sub={`${scores.brierCount} scored · lower is better`}
            color="purple"
            title="(probability − outcome)². Lower is better. Only computed when you enter a % YES estimate at stake time."
          />
        )}
        {scores.accuracy !== null && (
          <ScoreCard
            label={`Accuracy${tag ? ` · ${tag}` : ''}`}
            value={`${Math.round(scores.accuracy * 100)}%`}
            sub={`${scores.accuracyResolved} resolved`}
            title="% of resolved predictions where you outperformed the RS-neutral baseline."
          />
        )}
        {scores.peerScoreSum !== null && (
          <SignedCard
            label={`Peer Score${tag ? ` · ${tag}` : ''}`}
            value={Number(scores.peerScoreSum.toFixed(2))}
            sub={`${scores.peerScoreCount} scored`}
            title="How much better you were than the community consensus at commit time. Positive = beat the crowd."
          />
        )}
        {scores.weightedPeerScore !== null && (
          <SignedCard
            label={`Wtd. Peer Score${tag ? ` · ${tag}` : ''}`}
            value={Number(scores.weightedPeerScore.toFixed(4))}
            sub="Metaculus-style decay"
            title="Metaculus-style time-weighted peer score. Recent predictions count more (0.95^(days/30) decay)."
          />
        )}
        {scores.truthScore !== null && (
          <SignedCard
            label="TruthScore"
            value={Number(scores.truthScore.toFixed(4))}
            sub="avg peer / prediction"
            title="Average peer score per prediction. How consistently you beat the community consensus."
          />
        )}
        {scores.aiScoreSum !== null && (
          <SignedCard
            label={`AI Score${tag ? ` · ${tag}` : ''}`}
            value={Number(scores.aiScoreSum.toFixed(2))}
            sub={`${scores.aiScoreCount} scored`}
            title="How much better you were than the AI estimate at commit time. Positive = beat the AI."
          />
        )}
        {scores.roi !== null && (
          <SignedCard
            label="ROI"
            value={Number(scores.roi.toFixed(2))}
            sub="RS / resolved prediction"
            title="Average net RS change per resolved prediction. Min 3 resolved to display."
          />
        )}
        {scores.rsTagDelta !== null && (
          <SignedCard
            label={`RS · ${tag}`}
            value={Number(scores.rsTagDelta.toFixed(1))}
            title={`Net RS change for all resolved predictions in tag: ${tag}`}
          />
        )}
      </div>

      {scores.topicBreakdown.length > 0 && !selectedTag && (
        <TopicBreakdown topics={scores.topicBreakdown} />
      )}

      <div className="bg-navy-800 rounded-xl border border-navy-600 p-3">
        <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-2">
          Skill Rating History{tag ? ` · ${tag}` : ''}
        </p>
        <GlickoChart userId={userId} selectedTag={selectedTag} />
      </div>
    </div>
  )
}

function TopicBreakdown({ topics }: { topics: TopicStat[] }) {
  return (
    <div>
      <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-2">Peer score by topic</p>
      <div className="flex flex-wrap gap-2">
        {topics.map(topic => (
          <div
            key={topic.slug}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-navy-800 rounded-lg border border-navy-600 text-xs"
          >
            <span className="text-gray-300 font-medium">{topic.name}</span>
            <span className={`font-bold ${topic.peerScoreAvg >= 0 ? 'text-teal' : 'text-red-400'}`}>
              {topic.peerScoreAvg >= 0 ? '+' : ''}
              {topic.peerScoreAvg.toFixed(3)}
            </span>
            <span className="text-gray-500">({topic.count})</span>
          </div>
        ))}
      </div>
    </div>
  )
}
