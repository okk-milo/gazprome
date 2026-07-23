const analysisStates = ['queued', 'processing', 'completed', 'insufficient_data', 'failed'] as const
const outcomes = ['stable', 'watch', 'attention', 'priority_support'] as const
const metricKinds = ['empathy', 'clarity', 'strain_language', 'absolutist_language'] as const
const LOCAL_BURNOUT_API_PATH = '/local-llm/v1/burnout/analyses'

export type ApiBurnoutAnalysisState = (typeof analysisStates)[number]
export type ApiBurnoutOutcome = (typeof outcomes)[number]
export type ApiBurnoutMetricKind = (typeof metricKinds)[number]

export interface ApiBurnoutStatus {
  analysisId: string
  state: ApiBurnoutAnalysisState
  createdAt: string
  updatedAt: string
  reason?: string
}

export interface ApiBurnoutMetric {
  id: ApiBurnoutMetricKind
  label: string
  baselineValue: number
  currentValue: number
  delta: number
  direction: 'increase' | 'decrease' | 'unchanged'
  description: string
  evidenceIds: string[]
}

export interface ApiBurnoutEvidence {
  id: string
  metric: ApiBurnoutMetricKind
  title: string
  description: string
  confidence: number
  highlight: {
    callId: string
    messageId: string
    startOffset: number
    endOffset: number
  }
}

export interface ApiBurnoutResult {
  analysisId: string
  operatorId: string
  state: 'completed' | 'insufficient_data'
  baseline: { label: string; callCount: number }
  current: { label: string; callCount: number }
  workload: {
    escalationRatio: number
    afterHoursRatio: number
    callsPerShift: number
    breakMinutes: number
  }
  decision?: { outcome: ApiBurnoutOutcome; score: number; policyId: string }
  metrics: ApiBurnoutMetric[]
  evidence: ApiBurnoutEvidence[]
  recommendations: string[]
  limitations: string[]
}

export interface ApiBurnoutSnapshot {
  status: ApiBurnoutStatus
  result?: ApiBurnoutResult
}

export async function getBurnoutAnalysis(analysisId: string, signal?: AbortSignal): Promise<ApiBurnoutSnapshot> {
  const response = await fetch(`${LOCAL_BURNOUT_API_PATH}/${encodeURIComponent(analysisId)}`, { signal })

  if (!response.ok) {
    throw new Error(`Не удалось получить анализ: HTTP ${response.status}`)
  }

  return parseSnapshot(await response.json() as unknown)
}

function parseSnapshot(value: unknown): ApiBurnoutSnapshot {
  const payload = readRecord(value, 'Некорректный ответ API')

  return {
    status: parseStatus(payload.status),
    result: payload.result === undefined ? undefined : parseResult(payload.result),
  }
}

function parseStatus(value: unknown): ApiBurnoutStatus {
  const status = readRecord(value, 'В ответе нет статуса анализа')

  return {
    analysisId: readString(status.analysisId, 'Некорректный ID анализа'),
    state: readEnum(status.state, analysisStates, 'Некорректный статус анализа'),
    createdAt: readString(status.createdAt, 'Некорректное время создания'),
    updatedAt: readString(status.updatedAt, 'Некорректное время обновления'),
    reason: status.reason === undefined ? undefined : readString(status.reason, 'Некорректная причина ошибки'),
  }
}

function parseResult(value: unknown): ApiBurnoutResult {
  const result = readRecord(value, 'Некорректный результат анализа')
  const baseline = readRecord(result.baseline, 'Нет личной базы')
  const current = readRecord(result.current, 'Нет текущего периода')
  const workload = readRecord(result.workload, 'Нет контекста нагрузки')

  return {
    analysisId: readString(result.analysisId, 'Некорректный ID результата'),
    operatorId: readString(result.operatorId, 'Некорректный ID оператора'),
    state: readEnum(result.state, ['completed', 'insufficient_data'] as const, 'Некорректный статус результата'),
    baseline: {
      label: readString(baseline.label, 'Некорректная подпись базы'),
      callCount: readNumber(baseline.callCount, 'Некорректное число звонков базы'),
    },
    current: {
      label: readString(current.label, 'Некорректная подпись текущего периода'),
      callCount: readNumber(current.callCount, 'Некорректное число звонков текущего периода'),
    },
    workload: {
      escalationRatio: readNumber(workload.escalationRatio, 'Некорректная доля эскалаций'),
      afterHoursRatio: readNumber(workload.afterHoursRatio, 'Некорректная доля поздних звонков'),
      callsPerShift: readNumber(workload.callsPerShift, 'Некорректное число звонков'),
      breakMinutes: readNumber(workload.breakMinutes, 'Некорректное время пауз'),
    },
    decision: result.decision === undefined ? undefined : parseDecision(result.decision),
    metrics: readArray(result.metrics, 'Некорректные метрики').map(parseMetric),
    evidence: readArray(result.evidence, 'Некорректные основания').map(parseEvidence),
    recommendations: readArray(result.recommendations, 'Некорректные рекомендации').map((item) => readString(item, 'Некорректная рекомендация')),
    limitations: readArray(result.limitations, 'Некорректные ограничения').map((item) => readString(item, 'Некорректное ограничение')),
  }
}

function parseDecision(value: unknown): NonNullable<ApiBurnoutResult['decision']> {
  const decision = readRecord(value, 'Некорректное решение')
  return {
    outcome: readEnum(decision.outcome, outcomes, 'Некорректный итог'),
    score: readNumber(decision.score, 'Некорректный балл'),
    policyId: readString(decision.policyId, 'Некорректная политика'),
  }
}

function parseMetric(value: unknown): ApiBurnoutMetric {
  const metric = readRecord(value, 'Некорректная метрика')
  return {
    id: readEnum(metric.id, metricKinds, 'Некорректный тип метрики'),
    label: readString(metric.label, 'Некорректное название метрики'),
    baselineValue: readNumber(metric.baselineValue, 'Некорректное значение базы'),
    currentValue: readNumber(metric.currentValue, 'Некорректное текущее значение'),
    delta: readNumber(metric.delta, 'Некорректное изменение'),
    direction: readEnum(metric.direction, ['increase', 'decrease', 'unchanged'] as const, 'Некорректное направление'),
    description: readString(metric.description, 'Некорректное описание метрики'),
    evidenceIds: readArray(metric.evidenceIds, 'Некорректные ссылки на основания').map((item) => readString(item, 'Некорректная ссылка на основание')),
  }
}

function parseEvidence(value: unknown): ApiBurnoutEvidence {
  const evidence = readRecord(value, 'Некорректное основание')
  const highlight = readRecord(evidence.highlight, 'Некорректная привязка основания')
  return {
    id: readString(evidence.id, 'Некорректный ID основания'),
    metric: readEnum(evidence.metric, metricKinds, 'Некорректная метрика основания'),
    title: readString(evidence.title, 'Некорректный заголовок основания'),
    description: readString(evidence.description, 'Некорректное описание основания'),
    confidence: readNumber(evidence.confidence, 'Некорректная уверенность основания'),
    highlight: {
      callId: readString(highlight.callId, 'Некорректный ID звонка'),
      messageId: readString(highlight.messageId, 'Некорректный ID реплики'),
      startOffset: readNumber(highlight.startOffset, 'Некорректное начало выделения'),
      endOffset: readNumber(highlight.endOffset, 'Некорректный конец выделения'),
    },
  }
}

function readRecord(value: unknown, message: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(message)
  }
  return value as Record<string, unknown>
}

function readArray(value: unknown, message: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(message)
  }
  return value
}

function readString(value: unknown, message: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(message)
  }
  return value
}

function readNumber(value: unknown, message: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(message)
  }
  return value
}

function readEnum<TValue extends string>(value: unknown, values: readonly TValue[], message: string): TValue {
  if (typeof value !== 'string' || !values.includes(value as TValue)) {
    throw new Error(message)
  }
  return value as TValue
}
