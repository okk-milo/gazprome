export interface DatasetCoverage { total: number; accepted: number; pending: number; excluded: number }
export interface WeeklyScores { exhaustion: number; distance: number; speechInconsistency: number; workload: number }
export interface WeeklyCoverage { index: number; accepted: number; pending: number; excluded: number; audioSeconds: number }
export interface Observation { sourceId: string; segmentId: string; title: string; startMs: number; quote: string }
export interface DatasetSummary { id: string; periodStart: string; coverage: DatasetCoverage; weeklyScores: WeeklyScores[]; weeklyCoverage: WeeklyCoverage[]; observations: Observation[] }
export type DatasetResponse = { state: 'empty' } | { state: 'ready'; dataset: DatasetSummary }
export type DatasetState = DatasetResponse | { state: 'loading' } | { state: 'error' }

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Некорректный набор записей')
  return value as Record<string, unknown>
}

function count(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 500) throw new Error('Некорректное количество записей')
  return value
}

function boundedNumber(value: unknown, maximum: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > maximum) throw new Error('Некорректное значение показателя')
  return value
}

function calendarDate(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Некорректная дата')
  const millis = Date.parse(`${value}T00:00:00Z`)
  if (!Number.isFinite(millis) || new Date(millis).toISOString().slice(0, 10) !== value) throw new Error('Некорректная дата')
  return value
}

export function scenarioWeeks(periodStart: string): Array<{ label: string; dates: string }> {
  const start = Date.parse(`${calendarDate(periodStart)}T00:00:00Z`)
  const formatter = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })
  return Array.from({ length: 8 }, (_, index) => ({
    label: `Неделя ${index + 1}`,
    dates: `${formatter.format(start + index * 7 * 86400000)}–${formatter.format(start + (index * 7 + 6) * 86400000)}`,
  }))
}

export function parseDatasetResponse(raw: unknown): DatasetResponse {
  const response = record(raw)
  if (response.state === 'empty') return { state: 'empty' }
  if (response.state !== 'ready') throw new Error('Неизвестное состояние набора')
  const dataset = record(response.dataset)
  if (dataset.provenance !== 'authored_scenario' || typeof dataset.id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(dataset.id)) throw new Error('Некорректное происхождение данных')
  const periodStart = calendarDate(dataset.periodStart)
  const rawCoverage = record(dataset.coverage)
  const coverage = { total: count(rawCoverage.total), accepted: count(rawCoverage.accepted), pending: count(rawCoverage.pending), excluded: count(rawCoverage.excluded) }
  if (coverage.total !== coverage.accepted + coverage.pending + coverage.excluded) throw new Error('Количество записей не совпадает')
  if (!Array.isArray(dataset.weeklyScores) || dataset.weeklyScores.length !== 8 || !Array.isArray(dataset.weeklyCoverage) || dataset.weeklyCoverage.length !== 8) throw new Error('Ожидаются восемь недель')
  const weeklyScores = dataset.weeklyScores.map((raw: unknown): WeeklyScores => {
    const week = record(raw)
    return { exhaustion: boundedNumber(week.exhaustion, 100), distance: boundedNumber(week.distance, 100), speechInconsistency: boundedNumber(week.speechInconsistency, 100), workload: boundedNumber(week.workload, 100) }
  })
  const weeklyCoverage = dataset.weeklyCoverage.map((raw: unknown, index): WeeklyCoverage => {
    const week = record(raw)
    if (week.index !== index) throw new Error('Нарушен порядок недель')
    return { index, accepted: count(week.accepted), pending: count(week.pending), excluded: count(week.excluded), audioSeconds: boundedNumber(week.audioSeconds, 500 * 1800) }
  })
  for (const key of ['accepted', 'pending', 'excluded'] as const) {
    if (weeklyCoverage.reduce((sum, week) => sum + week[key], 0) !== coverage[key]) throw new Error('Итоги недель не совпадают')
  }
  const titles: Record<string, string> = {clarification:'Уточняющий вопрос',repeat_request:'Просьба повторить',self_correction:'Самокоррекция',explicit_complaint:'Явная жалоба',escalation_request:'Запрос эскалации',procedure_explanation:'Объяснение процедуры'}
  if (!Array.isArray(dataset.observations) || dataset.observations.length > 32) throw new Error('Некорректные речевые примеры')
  const observations = dataset.observations.map((raw: unknown): Observation => {
    const item = record(raw)
    const title = typeof item.kind === 'string' && Object.hasOwn(titles, item.kind) ? titles[item.kind] : null
    if (!title || item.review !== 'text_checked' || item.speaker !== 'unknown' || typeof item.sourceId !== 'string' || !/^[a-f0-9]{64}$/.test(item.sourceId) || typeof item.segmentId !== 'string' || typeof item.quote !== 'string' || !item.quote.trim() || item.quote.length > 1500) throw new Error('Некорректный речевой пример')
    return { sourceId: item.sourceId, segmentId: item.segmentId, title, startMs: boundedNumber(item.startMs, 1800000), quote: item.quote }
  })
  return { state: 'ready', dataset: { id: dataset.id, periodStart, coverage, weeklyScores, weeklyCoverage, observations } }
}
