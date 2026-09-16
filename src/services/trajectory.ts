import type { ChartSeries } from '../types/analysis'
import type { WeeklyScores } from './burnout-dataset'

export function scenarioSeries(templates: readonly ChartSeries[], weeks: readonly WeeklyScores[]): ChartSeries[] {
  const keys: Record<string, keyof WeeklyScores> = { exhaustion: 'exhaustion', distance: 'distance', 'speech-inconsistency': 'speechInconsistency', workload: 'workload' }
  return templates.map(item => {
    const key = Object.hasOwn(keys, item.key) ? keys[item.key] : null
    if (!key) throw new Error('Unknown scenario scale')
    return { ...item, values: weeks.map(week => week[key]) }
  })
}

export function chartValue(values: readonly (number | null)[], index: number, maximum = 100): number | null {
  const value = values[index]
  if (value == null || !Number.isFinite(value) || value < 0 || value > maximum) return null
  return value
}

export function adverseScore(value: number, sourceDirection: 'positive' | 'adverse'): number {
  if (!Number.isFinite(value) || value < 0 || value > 100) throw new RangeError('Score must be within 0–100')
  return sourceDirection === 'positive' ? 100 - value : value
}
