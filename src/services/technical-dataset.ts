export const technicalKeys = ['repetition', 'correction', 'complaint', 'speechDensity'] as const
export type TechnicalKey = typeof technicalKeys[number]
export const technicalKinds = ['clarification', 'repeat_request', 'self_correction', 'explicit_complaint', 'escalation_request'] as const
export type TechnicalKind = typeof technicalKinds[number]
export interface TechnicalMeasures { scores: Record<TechnicalKey, number>; index: number; rates: Record<'repetition' | 'correction' | 'complaint', number>; durationSeconds: number; speechSeconds: number; words: number; counts: Record<TechnicalKind, number> }
export interface TechnicalDataset {
  coverage: { total: number; measured: number; excluded: number; failed: number }
  weeks: Array<{ index: number; start: string; end: string; sourceIds: string[]; measures: TechnicalMeasures | null }>
  overall: TechnicalMeasures | null; baseline: TechnicalMeasures | null; recent: TechnicalMeasures | null
  sources: Array<{ id: string; status: 'measured' | 'excluded' | 'failed'; reason: string | null; week: number | null; index: number | null }>
  observations: Array<{ sourceId: string; kind: TechnicalKind; segmentId: string; quote: string; startMs: number; endMs: number }>
}
export type TechnicalResponse = { state: 'empty'; dataset: null } | { state: 'ready'; dataset: TechnicalDataset }
export type TechnicalState = TechnicalResponse | { state: 'loading' | 'error' }
function record(raw: unknown): Record<string, unknown> { if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Некорректные данные'); return Object.fromEntries(Object.entries(raw)) }
function number(raw: unknown, max = 1000000, integer = false): number { if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0 || raw > max || (integer && !Number.isInteger(raw))) throw new Error('Некорректное число'); return raw }
function string(raw: unknown): string { if (typeof raw !== 'string' || !raw || raw.length > 1500) throw new Error('Некорректная строка'); return raw }
function array(raw: unknown, max = 500): unknown[] { if (!Array.isArray(raw) || raw.length > max) throw new Error('Некорректный список'); return raw }
function sourceId(raw: unknown): string { const id = string(raw); if (!/^[a-f0-9]{64}$/.test(id)) throw new Error('Некорректная запись'); return id }
function date(raw: unknown): string { const value = string(raw); if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new Error('Некорректная дата'); return value }
function measures(raw: unknown): TechnicalMeasures | null {
  if (raw === null) return null
  const m = record(raw), s = record(m.scores), r = record(m.rates), c = record(m.counts)
  const result = { index: number(m.index, 100), scores: { repetition: number(s.repetition, 100), correction: number(s.correction, 100), complaint: number(s.complaint, 100), speechDensity: number(s.speechDensity, 100) }, rates: { repetition: number(r.repetition), correction: number(r.correction), complaint: number(r.complaint) }, durationSeconds: number(m.durationSeconds), speechSeconds: number(m.speechSeconds), words: number(m.words, 25000000, true), counts: { clarification: number(c.clarification, 2500000, true), repeat_request: number(c.repeat_request, 2500000, true), self_correction: number(c.self_correction, 2500000, true), explicit_complaint: number(c.explicit_complaint, 2500000, true), escalation_request: number(c.escalation_request, 2500000, true) } }
  if (!result.speechSeconds || result.speechSeconds > result.durationSeconds) throw new Error('Некорректная длительность')
  return result
}
export function parseTechnicalResponse(raw: unknown): TechnicalResponse {
  const response = record(raw)
  if (response.state === 'empty' && response.dataset === null) return { state: 'empty', dataset: null }
  if (response.state !== 'ready') throw new Error('Неизвестное состояние')
  const d = record(response.dataset), c = record(d.coverage)
  if (d.version !== 'technical-dialogue-v1' || d.ordering !== 'score_sorted_conditional') throw new Error('Неизвестная методика')
  const periodStart = date(d.periodStart)
  const coverage = { total: number(c.total, 500, true), measured: number(c.measured, 500, true), excluded: number(c.excluded, 500, true), failed: number(c.failed, 500, true) }
  if (coverage.total !== coverage.measured + coverage.excluded + coverage.failed) throw new Error('Не совпадает число записей')
  const sources = array(d.sources).map((rawSource): TechnicalDataset['sources'][number] => { const s = record(rawSource); if (s.status !== 'measured' && s.status !== 'excluded' && s.status !== 'failed') throw new Error('Неизвестный статус'); return { id: sourceId(s.id), status: s.status, reason: s.reason === null ? null : string(s.reason), week: s.week === null ? null : number(s.week, 7, true), index: s.index === null ? null : number(s.index, 100) } })
  if (sources.length !== coverage.total || new Set(sources.map(s => s.id)).size !== sources.length) throw new Error('Не совпадают записи')
  for (const source of sources) {
    if (source.status === 'measured' ? source.reason !== null || source.week === null || source.index === null : source.reason === null || source.week !== null || source.index !== null) throw new Error('Несогласованное состояние записи')
  }
  for (const status of ['measured', 'excluded', 'failed'] as const) if (sources.filter(s => s.status === status).length !== coverage[status]) throw new Error('Не совпадает покрытие')
  const assigned = new Set<string>()
  const weeks = array(d.weeks, 8).map((rawWeek, i) => {
    const w = record(rawWeek), start = date(w.start), end = date(w.end), value = measures(w.measures)
    if (w.index !== i || Date.parse(start) !== Date.parse(periodStart) + i * 7 * 86400000 || Date.parse(end) !== Date.parse(start) + 6 * 86400000) throw new Error('Нарушен порядок недель')
    const ids = array(w.sourceIds).map(sourceId)
    if ((ids.length === 0) !== (value === null)) throw new Error('Нет измерений для недели')
    for (const id of ids) { const source = sources.find(s => s.id === id); if (assigned.has(id) || !source || source.status !== 'measured' || source.week !== i || source.index === null) throw new Error('Некорректное распределение'); assigned.add(id) }
    return { index: i, start, end, sourceIds: ids, measures: value }
  })
  if (weeks.length !== 8 || assigned.size !== coverage.measured) throw new Error('Неполное распределение')
  const observations = array(d.observations, 32).map(rawEvent => { const e = record(rawEvent), kind = technicalKinds.find(k => k === e.kind), id = sourceId(e.sourceId); if (!kind || !assigned.has(id)) throw new Error('Некорректный фрагмент'); const startMs = number(e.startMs, 1800000, true), endMs = number(e.endMs, 1800000, true); if (endMs <= startMs) throw new Error('Некорректное время'); return { sourceId: id, kind, segmentId: string(e.segmentId), quote: string(e.quote), startMs, endMs } })
  const overall = measures(d.overall), baseline = measures(d.baseline), recent = measures(d.recent)
  if ((coverage.measured === 0) !== (overall === null)) throw new Error('Нет итоговых измерений')
  if (weeks.slice(0, 2).every(w => w.measures === null) !== (baseline === null) || weeks.slice(6).every(w => w.measures === null) !== (recent === null)) throw new Error('Нет измерений для сравнения')
  return { state: 'ready', dataset: { coverage, weeks, overall, baseline, recent, sources, observations } }
}

export const technicalLabels: Record<TechnicalKind, string> = { clarification: 'Уточнение смысла', repeat_request: 'Просьба повторить', self_correction: 'Самокоррекция', explicit_complaint: 'Явная жалоба', escalation_request: 'Запрос эскалации' }
export const technicalCharts: Array<{ key: TechnicalKey; label: string; color: string; description: string; help: string }> = [
  { key: 'repetition', label: 'Повторы и уточнения', color: '#e66143', description: 'Выше — чаще встречаются просьбы повторить и уточнения смысла.', help: 'Число найденных просьб повторить и уточнений делится на минуты распознанной речи. Одна такая реплика в минуту — 50 баллов; две и более — 100. Обычные вопросы не учитываются.' },
  { key: 'correction', label: 'Самокоррекции', color: '#7c6ff1', description: 'Выше — чаще встречаются явные переформулировки.', help: 'Учитываются найденные формулировки с явными маркерами исправления: «точнее», «вернее», «поправлюсь». Одна самокоррекция в минуту распознанной речи — 100 баллов. Запинки не учитываются.' },
  { key: 'complaint', label: 'Жалобы и эскалации', color: '#eea53a', description: 'Выше — чаще звучат явные жалобы и запросы эскалации.', help: 'Число найденных явных жалоб и просьб передать обращение руководителю или специалисту делится на минуты распознанной речи. Одно событие в минуту — 100 баллов.' },
  { key: 'speechDensity', label: 'Речевая нагрузка', color: '#9aa1ad', description: 'Выше — большую часть записи занимает распознанная речь.', help: 'Доля времени, покрытого речевыми фрагментами ASR, в полной длительности записи. Пересекающиеся фрагменты считаются один раз. Это плотность речи в записи, а не нагрузка сотрудника за смену.' },
]
