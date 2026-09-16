import type { ChartSeries } from '../types/analysis'

export const reportKeys = ['repetition', 'speechRate', 'longPauses', 'duration'] as const
export type ReportKey = typeof reportKeys[number]
export interface ReportMeasures { values: Record<ReportKey, number>; calls: number; totalMinutes: number; repetitionCount: number; longPauseCount: number }
export interface Workload { calls: number; minutes: number; gapMinutes: number | null; latePercent: number }
export interface ConversationReport {
  coverage: { total: number; measured: number }
  weeks: Array<{ index: number; start: string; end: string; measures: ReportMeasures | null; workload: Workload | null }>
  overall: ReportMeasures | null; baseline: ReportMeasures | null; recent: ReportMeasures | null
  workload: Workload | null; baselineWorkload: Workload | null; recentWorkload: Workload | null
}
export type ReportResponse = { state: 'empty'; dataset: null } | { state: 'ready'; dataset: ConversationReport }
export type ReportState = ReportResponse | { state: 'loading' | 'error' }
function record(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Некорректный отчёт')
  return Object.fromEntries(Object.entries(raw))
}
function number(raw: unknown, max = 1000000, integer = false): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0 || raw > max || (integer && !Number.isInteger(raw))) throw new Error('Некорректное число')
  return raw
}
function date(raw: unknown): string {
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw) || !Number.isFinite(Date.parse(raw)) || new Date(raw).toISOString().slice(0, 10) !== raw) throw new Error('Некорректная дата')
  return raw
}
function measures(raw: unknown): ReportMeasures | null {
  if (raw === null) return null
  const m = record(raw), v = record(m.values)
  const result = { values: { repetition: number(v.repetition, 10000), speechRate: number(v.speechRate, 10000), longPauses: number(v.longPauses, 100), duration: number(v.duration, 30.1) }, calls: number(m.calls, 500, true), totalMinutes: number(m.totalMinutes, 15000), repetitionCount: number(m.repetitionCount, 2500000, true), longPauseCount: number(m.longPauseCount, 500000, true) }
  if (!result.calls || !result.totalMinutes) throw new Error('Нет измерений')
  return result
}
function workload(raw: unknown): Workload | null {
  if (raw === null) return null
  const w = record(raw)
  return { calls: number(w.calls, 500, true), minutes: number(w.minutes, 15000), gapMinutes: w.gapMinutes === null ? null : number(w.gapMinutes, 480), latePercent: number(w.latePercent, 100) }
}
export function parseReportResponse(raw: unknown): ReportResponse {
  const r = record(raw)
  if (r.state === 'empty' && r.dataset === null) return { state: 'empty', dataset: null }
  if (r.state !== 'ready') throw new Error('Неизвестное состояние')
  const d = record(r.dataset), c = record(d.coverage)
  if (d.version !== 'conversation-report-v2' || !Array.isArray(d.weeks) || d.weeks.length !== 8) throw new Error('Неизвестный отчёт')
  const coverage = { total: number(c.total, 500, true), measured: number(c.measured, 500, true) }
  if (!coverage.measured || coverage.measured > coverage.total) throw new Error('Некорректное покрытие')
  const weeks = d.weeks.map((rawWeek: unknown, index) => {
    const w = record(rawWeek), start = date(w.start), end = date(w.end)
    if (w.index !== index || Date.parse(end) - Date.parse(start) !== 6 * 86400000) throw new Error('Некорректная неделя')
    const m = measures(w.measures), context = workload(w.workload)
    if ((m?.calls ?? 0) !== (context?.calls ?? 0)) throw new Error('Не совпадают звонки')
    return { index, start, end, measures: m, workload: context }
  })
  for (let i = 1; i < weeks.length; i++) {
    const a = weeks[i - 1], b = weeks[i]
    if (!a || !b || Date.parse(b.start) - Date.parse(a.start) !== 7 * 86400000) throw new Error('Нарушен порядок недель')
  }
  const overall = measures(d.overall), baseline = measures(d.baseline), recent = measures(d.recent)
  const context = workload(d.workload), baselineWorkload = workload(d.baselineWorkload), recentWorkload = workload(d.recentWorkload)
  if (overall?.calls !== coverage.measured || context?.calls !== coverage.measured || weeks.reduce((sum, w) => sum + (w.measures?.calls ?? 0), 0) !== coverage.measured) throw new Error('Не совпадают итоги')
  if ((baseline?.calls ?? 0) !== weeks.slice(0, 2).reduce((sum, w) => sum + (w.measures?.calls ?? 0), 0) || (recent?.calls ?? 0) !== weeks.slice(6).reduce((sum, w) => sum + (w.measures?.calls ?? 0), 0)) throw new Error('Не совпадают периоды')
  if ((baselineWorkload?.calls ?? 0) !== (baseline?.calls ?? 0) || (recentWorkload?.calls ?? 0) !== (recent?.calls ?? 0)) throw new Error('Не совпадает контекст')
  return { state: 'ready', dataset: { coverage, weeks, overall, baseline, recent, workload: context, baselineWorkload, recentWorkload } }
}
export const reportCharts: Array<{ key: ReportKey; label: string; color: string; unit: string; description: string; help: string }> = [
  { key: 'repetition', label: 'Повторы и уточнения', color: '#ec7356', unit: 'на 10 мин', description: 'Как часто собеседники возвращаются к сказанному.', help: 'Число просьб повторить и уточнений уже сказанного на 10 минут разговоров. Первый вопрос о новых сведениях не учитывается. Ноль означает, что подходящие реплики не найдены.' },
  { key: 'speechRate', label: 'Темп речи', color: '#8371e8', unit: 'слов/мин', description: 'Сколько слов звучит за минуту речи.', help: 'Общее число распознанных слов делится на время звучащей речи. Тишина не входит в знаменатель. Значение относится к разговору целиком, без оценки отдельных участников.' },
  { key: 'longPauses', label: 'Паузы в разговоре', color: '#e8a52d', unit: '%', description: 'Какую часть разговора занимают длинные паузы.', help: 'Доля пауз длительностью от двух секунд между участками речи в общей длительности разговоров. Тишина до начала и после окончания речи не учитывается.' },
  { key: 'duration', label: 'Длительность разговоров', color: '#35a69b', unit: 'мин', description: 'Сколько в среднем длится один разговор.', help: 'Суммарная длительность записей делится на число звонков. При сравнении недель используется одна шкала. Более длинный разговор сам по себе не означает плохой результат.' },
]
export const formatNumber = (n: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(n)
export function chartMaximum(values: Array<number | null>): number {
  const max = Math.max(0, ...values.filter((n): n is number => n !== null))
  if (!max) return 1
  const power = 10 ** Math.floor(Math.log10(max))
  return (max / power <= 1 ? 1 : max / power <= 2 ? 2 : max / power <= 5 ? 5 : 10) * power
}
export function reportSeries(data: ConversationReport): ChartSeries[] {
  return reportCharts.map(chart => {
    const values = data.weeks.map(w => w.measures?.values[chart.key] ?? null)
    return { ...chart, values, direction: 'higher-is-more', max: chart.key === 'longPauses' ? 100 : chartMaximum(values) }
  })
}
export function comparison(data: ConversationReport, key: ReportKey): string {
  if (!data.baseline || !data.recent) return 'Нет сравнения'
  const delta = data.recent.values[key] - data.baseline.values[key]
  if (Math.abs(delta) < 0.05) return 'Без изменений'
  return `${delta > 0 ? '+' : '−'}${formatNumber(Math.abs(delta))} ${key === 'longPauses' ? 'п.п.' : reportCharts.find(c => c.key === key)?.unit ?? ''}`
}
export function reportRecommendations(data: ConversationReport): string[] {
  const items: string[] = []
  if (data.overall?.repetitionCount) items.push('Упростить формулировки, которые требуют повторного объяснения, и добавить короткую проверку понимания в конце ответа.')
  if ((data.recent?.values.longPauses ?? 0) > 5) items.push('Проверить причины длинных пауз: поиск информации, ожидание ответа или выполнение действий. Для частых вопросов подготовить быстрые подсказки.')
  const recentGap = data.recentWorkload?.gapMinutes
  if (recentGap != null && recentGap < (data.baselineWorkload?.gapMinutes ?? 0)) items.push('Проверить, хватает ли интервалов между звонками на завершение предыдущего обращения и подготовку к следующему.')
  if (items.length < 3) items.push('Сопоставлять разговоры похожей тематики и длительности, чтобы изменение состава обращений не мешало сравнению недель.')
  return items.slice(0, 3)
}
