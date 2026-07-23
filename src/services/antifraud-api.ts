const analysisStates = ['queued', 'processing', 'completed', 'insufficient_data', 'failed'] as const
const outcomes = ['safe', 'verification', 'escalation', 'manual_review'] as const
const roles = ['operator', 'client', 'unknown'] as const
const evidenceKinds = ['external_instruction', 'safe_account', 'borrowed_script', 'urgency'] as const
const guidanceKinds = ['question', 'instruction', 'none'] as const
const LOCAL_ANTIFRAUD_API_PATH = '/local-llm/v1/antifraud/analyses'

export type ApiAntifraudAnalysisState = (typeof analysisStates)[number]
export type ApiAntifraudOutcome = (typeof outcomes)[number]
export type ApiTranscriptRole = (typeof roles)[number]
export type ApiEvidenceKind = (typeof evidenceKinds)[number]
export type ApiGuidanceKind = (typeof guidanceKinds)[number]

export interface ApiAntifraudStatus {
  analysisId: string
  state: ApiAntifraudAnalysisState
  createdAt: string
  updatedAt: string
  reason?: string
}

export interface ApiAntifraudTranscriptMessage {
  id: string
  role: ApiTranscriptRole
  startMs: number
  endMs: number
  text: string
}

export interface ApiAntifraudHighlight {
  messageId: string
  startOffset: number
  endOffset: number
}

export interface ApiAntifraudEvidence {
  id: string
  kind: ApiEvidenceKind
  confidence: number
  title: string
  description: string
  highlights: ApiAntifraudHighlight[]
}

export interface ApiAntifraudGuidance {
  kind: ApiGuidanceKind
  text: string
  purpose: string
  observe: string[]
  evidenceIds: string[]
  source: 'llm'
}

export interface ApiAntifraudDecision {
  outcome: ApiAntifraudOutcome
  score: number
  evidenceIds: string[]
  policyId: string
}

export interface ApiAntifraudResult {
  analysisId: string
  callId: string
  state: 'completed' | 'insufficient_data'
  transcript: {
    durationMs: number
    messages: ApiAntifraudTranscriptMessage[]
  }
  decision?: ApiAntifraudDecision
  guidance?: ApiAntifraudGuidance
  evidence: ApiAntifraudEvidence[]
  limitations: string[]
}

export interface ApiAntifraudSnapshot {
  status: ApiAntifraudStatus
  result?: ApiAntifraudResult
}

export async function getAntifraudAnalysis(
  analysisId: string,
  signal?: AbortSignal,
): Promise<ApiAntifraudSnapshot> {
  const response = await fetch(`${LOCAL_ANTIFRAUD_API_PATH}/${encodeURIComponent(analysisId)}`, {
    signal,
  })

  if (!response.ok) {
    throw new Error(`Не удалось получить анализ: HTTP ${response.status}`)
  }

  const payload: unknown = await response.json()
  return parseSnapshot(payload)
}

function parseSnapshot(value: unknown): ApiAntifraudSnapshot {
  const payload = readRecord(value, 'Некорректный ответ API')
  const resultValue = payload.result

  return {
    status: parseStatus(payload.status),
    result: resultValue === undefined ? undefined : parseResult(resultValue),
  }
}

function parseStatus(value: unknown): ApiAntifraudStatus {
  const status = readRecord(value, 'В ответе нет статуса анализа')
  const reason = status.reason

  return {
    analysisId: readString(status.analysisId, 'Некорректный ID анализа'),
    state: readEnum(status.state, analysisStates, 'Некорректный статус анализа'),
    createdAt: readString(status.createdAt, 'Некорректное время создания анализа'),
    updatedAt: readString(status.updatedAt, 'Некорректное время обновления анализа'),
    reason: reason === undefined ? undefined : readString(reason, 'Некорректная причина ошибки'),
  }
}

function parseResult(value: unknown): ApiAntifraudResult {
  const result = readRecord(value, 'Некорректный результат анализа')
  const decisionValue = result.decision
  const guidanceValue = result.guidance
  const transcript = readRecord(result.transcript, 'В результате нет расшифровки')

  return {
    analysisId: readString(result.analysisId, 'Некорректный ID результата'),
    callId: readString(result.callId, 'Некорректный ID звонка'),
    state: readEnum(result.state, ['completed', 'insufficient_data'] as const, 'Некорректный статус результата'),
    transcript: {
      durationMs: readNumber(transcript.durationMs, 'Некорректная длительность звонка'),
      messages: readArray(transcript.messages, 'Некорректные реплики').map(parseTranscriptMessage),
    },
    decision: decisionValue === undefined ? undefined : parseDecision(decisionValue),
    guidance: guidanceValue === undefined ? undefined : parseGuidance(guidanceValue),
    evidence: readArray(result.evidence, 'Некорректные признаки').map(parseEvidence),
    limitations: readArray(result.limitations, 'Некорректные ограничения').map((item) => {
      return readString(item, 'Некорректное ограничение')
    }),
  }
}

function parseTranscriptMessage(value: unknown): ApiAntifraudTranscriptMessage {
  const message = readRecord(value, 'Некорректная реплика')

  return {
    id: readString(message.id, 'Некорректный ID реплики'),
    role: readEnum(message.role, roles, 'Некорректная роль реплики'),
    startMs: readNumber(message.startMs, 'Некорректное начало реплики'),
    endMs: readNumber(message.endMs, 'Некорректное окончание реплики'),
    text: readString(message.text, 'Некорректный текст реплики'),
  }
}

function parseEvidence(value: unknown): ApiAntifraudEvidence {
  const evidence = readRecord(value, 'Некорректный признак')

  return {
    id: readString(evidence.id, 'Некорректный ID признака'),
    kind: readEnum(evidence.kind, evidenceKinds, 'Некорректный тип признака'),
    confidence: readNumber(evidence.confidence, 'Некорректная уверенность признака'),
    title: readString(evidence.title, 'Некорректный заголовок признака'),
    description: readString(evidence.description, 'Некорректное описание признака'),
    highlights: readArray(evidence.highlights, 'Некорректные выделения').map(parseHighlight),
  }
}

function parseHighlight(value: unknown): ApiAntifraudHighlight {
  const highlight = readRecord(value, 'Некорректное выделение')

  return {
    messageId: readString(highlight.messageId, 'Некорректный ID выделенной реплики'),
    startOffset: readNumber(highlight.startOffset, 'Некорректное начало выделения'),
    endOffset: readNumber(highlight.endOffset, 'Некорректный конец выделения'),
  }
}

function parseDecision(value: unknown): ApiAntifraudDecision {
  const decision = readRecord(value, 'Некорректное решение')

  return {
    outcome: readEnum(decision.outcome, outcomes, 'Некорректный итог анализа'),
    score: readNumber(decision.score, 'Некорректный балл анализа'),
    evidenceIds: readArray(decision.evidenceIds, 'Некорректные связи решения').map((item) => {
      return readString(item, 'Некорректный ID признака решения')
    }),
    policyId: readString(decision.policyId, 'Некорректная политика решения'),
  }
}

function parseGuidance(value: unknown): ApiAntifraudGuidance {
  const guidance = readRecord(value, 'Некорректная рекомендация')
  const source = readString(guidance.source, 'Некорректный источник рекомендации')

  if (source !== 'llm') {
    throw new Error('Некорректный источник рекомендации')
  }

  return {
    kind: readEnum(guidance.kind, guidanceKinds, 'Некорректный тип рекомендации'),
    text: readString(guidance.text, 'Некорректный текст рекомендации'),
    purpose: readString(guidance.purpose, 'Некорректная цель рекомендации'),
    observe: readArray(guidance.observe, 'Некорректные наблюдения').map((item) => {
      return readString(item, 'Некорректное наблюдение')
    }),
    evidenceIds: readArray(guidance.evidenceIds, 'Некорректные связи рекомендации').map((item) => {
      return readString(item, 'Некорректный ID признака рекомендации')
    }),
    source,
  }
}

function readRecord(value: unknown, message: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(message)
  }

  return value as Record<string, unknown>
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

function readArray(value: unknown, message: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(message)
  }

  return value
}

function readEnum<TValue extends string>(
  value: unknown,
  values: readonly TValue[],
  message: string,
): TValue {
  if (typeof value !== 'string' || !values.includes(value as TValue)) {
    throw new Error(message)
  }

  return value as TValue
}
