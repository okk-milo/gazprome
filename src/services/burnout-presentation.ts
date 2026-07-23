import type { BurnoutAnalysis, ContextItem, MetricItem, StatusTone } from '../types/analysis'
import type { ApiBurnoutMetric, ApiBurnoutMetricKind, ApiBurnoutSnapshot } from './burnout-api'

const metricTones: Record<ApiBurnoutMetricKind, { increase: StatusTone; decrease: StatusTone; unchanged: StatusTone }> = {
  empathy: { increase: 'success', decrease: 'danger', unchanged: 'neutral' },
  clarity: { increase: 'success', decrease: 'warning', unchanged: 'neutral' },
  strain_language: { increase: 'danger', decrease: 'success', unchanged: 'neutral' },
  absolutist_language: { increase: 'warning', decrease: 'success', unchanged: 'neutral' },
}

export function createBurnoutPresentation(snapshot: ApiBurnoutSnapshot): BurnoutAnalysis | null {
  const result = snapshot.result

  if (snapshot.status.state !== 'completed' || result?.state !== 'completed' || !result.decision) {
    return null
  }

  return {
    title: 'Динамика коммуникации',
    eyebrow: 'Выгорание · сравнение с личной базой',
    context: createContext(result.operatorId, result.baseline, result.current, result.evidence.length),
    decision: {
      result: { state: 'completed', outcome: result.decision.outcome, score: result.decision.score },
      summary: 'Итог сформирован по изменениям текстовых паттернов относительно личной базы оператора.',
      recommendation: result.recommendations[0] ?? 'Рекомендация для этого результата не сформирована.',
    },
    trajectory: {
      label: 'Сравнение периодов',
      description: 'Значения отражают наблюдаемые текстовые паттерны, а не диагноз или KPI-оценку.',
      xAxisLabels: result.metrics.map((metric) => createChartLabel(metric.id)),
      series: [
        { key: 'baseline', label: result.baseline.label, color: '#9aa7b8', dashed: true, values: result.metrics.map((metric) => metric.baselineValue) },
        { key: 'current', label: result.current.label, color: '#e66143', values: result.metrics.map((metric) => metric.currentValue) },
      ],
      annotations: [],
    },
    metrics: result.metrics.map(createMetric),
    workload: [
      { id: 'escalations', label: 'Эскалации и жалобы', value: result.workload.escalationRatio, unit: '%', delta: 'контекст работы', description: 'Не используется как признак состояния', tone: 'neutral', isControl: true },
      { id: 'after-hours', label: 'Звонки после смены', value: result.workload.afterHoursRatio, unit: '%', delta: 'контекст работы', description: 'Не используется как признак состояния', tone: 'neutral', isControl: true },
      { id: 'calls-per-shift', label: 'Звонков за смену', value: result.workload.callsPerShift, delta: 'контекст работы', description: 'Не используется как признак состояния', tone: 'neutral', isControl: true },
      { id: 'breaks', label: 'Паузы за смену', value: result.workload.breakMinutes, unit: 'мин', delta: 'контекст работы', description: 'Не используется как признак состояния', tone: 'neutral', isControl: true },
    ],
    evidence: result.evidence.map((item) => ({ id: item.id, title: item.title, description: item.description, confidence: item.confidence, tone: metricTones[item.metric].increase })),
    actions: result.recommendations,
  }
}

function createContext(
  operatorId: string,
  baseline: { label: string; callCount: number },
  current: { label: string; callCount: number },
  evidenceCount: number,
): ContextItem[] {
  return [
    { label: 'Оператор', value: operatorId, description: 'идентификатор сотрудника' },
    { label: baseline.label, value: `${baseline.callCount}`, description: 'звонков личной базы' },
    { label: current.label, value: `${current.callCount}`, description: 'звонков текущего периода' },
    { label: 'Основания', value: `${evidenceCount}`, description: evidenceCount > 0 ? 'привязаны к репликам оператора' : 'речевые основания не найдены', tone: evidenceCount > 0 ? 'warning' : 'success' },
  ]
}

function createMetric(metric: ApiBurnoutMetric): MetricItem {
  const deltaPrefix = metric.delta > 0 ? '+' : ''
  return {
    id: metric.id,
    label: metric.label,
    value: metric.currentValue,
    unit: '%',
    delta: `${deltaPrefix}${metric.delta} п.п.`,
    description: metric.description,
    tone: metricTones[metric.id][metric.direction],
  }
}

function createChartLabel(metric: ApiBurnoutMetricKind): string {
  if (metric === 'empathy') return 'Эмпатия'
  if (metric === 'clarity') return 'Структурность'
  if (metric === 'strain_language') return 'Напряжение'
  return 'Абсолютизмы'
}
