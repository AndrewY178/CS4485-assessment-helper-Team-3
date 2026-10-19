import type { Stat } from '../data/mockData'
import { AlertTriangleIcon } from './Icons'

export default function StatCard({ stat }: { stat: Stat }) {
  return (
    <article className="stat-card">
      <h2 className="stat-card__label">
        {stat.warning && (
          <AlertTriangleIcon className="stat-card__warning-icon" />
        )}
        {stat.label}
      </h2>
      <div
        className={`stat-card__value${stat.label === 'Overdue' ? ' stat-card__value--overdue' : ''}`}
      >
        {stat.value}
      </div>
      <p className="stat-card__caption">{stat.caption}</p>
    </article>
  )
}
