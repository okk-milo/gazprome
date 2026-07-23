import type {
  AntifraudAnalysis,
  ContextItem,
  EvidenceItem,
  OperatorGuidance,
  StatusTone,
  TimelineAnnotation,
  TranscriptHighlight,
  TranscriptMessage,
} from '../types/analysis'
import type {
  ApiAntifraudEvidence,
  ApiEvidenceKind,
  ApiAntifraudResult,
  ApiAntifraudSnapshot,
  ApiTranscriptRole,
} from './antifraud-api'

const chartPointCount = 11

const evidenceWeights: Record<ApiEvidenceKind, number> = {
  external_instruction: 42,
  safe_account: 36,
  borrowed_script: 24,
  urgency: 18,
}

const evidenceTones: Record<ApiEvidenceKind, StatusTone> = {
  external_instruction: 'danger',
  safe_account: 'danger',
  borrowed_script: 'warning',
  urgency: 'warning',
}

const roleLabels: Record<ApiTranscriptRole, string> = {
  operator: 'Оператор',
  client: 'Клиент',
  unknown: 'Неизвестный',
}

export function createAntifraudPresentation(snapshot: ApiAntifraudSnapshot): AntifraudAnalysis | null {
  const result = snapshot.result

  if (snapshot.status.state !== 'completed' || result?.state !== 'completed' || !result.decision) {
    return null
  }

  const transcript = createTranscript(result)
  const evidence = createEvidence(result)
  const unknownRoleCount = result.transcript.messages.filter((message) => {
    return message.role === 'unknown'
  }).length
  return {
    title: 'Анализ звонка',
    eyebrow: 'Антифрод · анализ расшифровки',
    callDuration: formatDuration(result.transcript.durationMs),
    state: 'completed',
    context: createContext(result, evidence.length, unknownRoleCount),
    decision: {
      result: {
        state: 'completed',
        outcome: result.decision.outcome,
        score: result.decision.score,
      },
      summary: createDecisionSummary(result, evidence),
    },
    confidence: createConfidenceTimeline(result),
    guidance: createGuidance(result),
    transcript,
    evidence,
  }
}

function createContext(result: ApiAntifraudResult, evidenceCount: number, unknownRoleCount: number): ContextItem[] {
  const roleDescription =
    unknownRoleCount === 0
      ? 'все реплики получили роль'
      : `неопределённых ролей: ${unknownRoleCount}`

  return [
    {
      label: 'Звонок',
      value: result.callId,
      description: 'идентификатор звонка',
    },
    {
      label: 'Длительность звонка',
      value: formatDuration(result.transcript.durationMs),
      description: 'в анализ передана вся расшифровка',
    },
    {
      label: 'Подтверждённые признаки',
      value: `${evidenceCount}`,
      description: evidenceCount === 0 ? 'сигналы не найдены' : 'связаны с фрагментами текста',
      tone: evidenceCount > 0 ? 'warning' : 'success',
    },
    {
      label: 'Качество ролей',
      value: unknownRoleCount === 0 ? 'Определены' : 'Есть неопределённость',
      description: roleDescription,
      tone: unknownRoleCount === 0 ? 'success' : 'info',
    },
  ]
}

function createTranscript(result: ApiAntifraudResult): TranscriptMessage[] {
  const highlightsByMessageId = new Map<string, TranscriptHighlight[]>()

  for (const evidence of result.evidence) {
    for (const highlight of evidence.highlights) {
      const messageHighlights = highlightsByMessageId.get(highlight.messageId)
      const transcriptHighlight: TranscriptHighlight = {
        evidenceId: evidence.id,
        startOffset: highlight.startOffset,
        endOffset: highlight.endOffset,
      }

      if (messageHighlights) {
        messageHighlights.push(transcriptHighlight)
        continue
      }

      highlightsByMessageId.set(highlight.messageId, [transcriptHighlight])
    }
  }

  return result.transcript.messages.map((message) => {
    return {
      id: message.id,
      speaker: roleLabels[message.role],
      role: message.role,
      timestamp: formatTimestamp(message.startMs),
      text: message.text,
      highlights: highlightsByMessageId.get(message.id),
    }
  })
}

function createEvidence(result: ApiAntifraudResult): EvidenceItem[] {
  const messagesById = new Map<string, ApiAntifraudResult['transcript']['messages'][number]>()

  for (const message of result.transcript.messages) {
    messagesById.set(message.id, message)
  }

  return result.evidence.map((evidence) => {
    const quote = createEvidenceQuote(evidence, messagesById)

    return {
      id: evidence.id,
      title: evidence.title,
      description: evidence.description,
      quote: quote.text,
      timestamp: quote.timestamp,
      confidence: evidence.confidence,
      tone: evidenceTones[evidence.kind],
    }
  })
}

function createEvidenceQuote(
  evidence: ApiAntifraudEvidence,
  messagesById: Map<string, ApiAntifraudResult['transcript']['messages'][number]>,
): { text?: string; timestamp?: string } {
  const highlight = evidence.highlights[0]

  if (!highlight) {
    return {}
  }

  const message = messagesById.get(highlight.messageId)

  if (!message) {
    return {}
  }

  return {
    text: message.text.slice(highlight.startOffset, highlight.endOffset),
    timestamp: formatTimestamp(message.startMs),
  }
}

function createDecisionSummary(result: ApiAntifraudResult, evidence: EvidenceItem[]): string {
  const outcome = result.decision?.outcome ?? 'safe'

  if (outcome === 'safe') {
    return 'Подтверждённые текстовые признаки мошеннического давления не найдены.'
  }

  const evidenceTitles = Array.from(new Set(evidence.map((item) => item.title))).join(', ')
  return `Итог сформирован по подтверждённым фрагментам: ${evidenceTitles}.`
}

function createConfidenceTimeline(result: ApiAntifraudResult): AntifraudAnalysis['confidence'] {
  const durationMs = result.transcript.durationMs
  const events = result.evidence
    .map((evidence) => {
      const firstHighlight = evidence.highlights[0]
      const message = firstHighlight
        ? result.transcript.messages.find((item) => item.id === firstHighlight.messageId)
        : undefined

      return {
        evidence,
        startMs: message?.startMs ?? durationMs,
      }
    })
    .sort((first, second) => first.startMs - second.startMs)
  const appliedKinds = new Set<ApiEvidenceKind>()
  const values: number[] = []
  let score = 0
  let eventIndex = 0

  for (let pointIndex = 0; pointIndex < chartPointCount; pointIndex += 1) {
    const pointMs = (durationMs * pointIndex) / (chartPointCount - 1)

    while (eventIndex < events.length && events[eventIndex].startMs <= pointMs) {
      const event = events[eventIndex]

      if (!appliedKinds.has(event.evidence.kind)) {
        appliedKinds.add(event.evidence.kind)
        score += evidenceWeights[event.evidence.kind]
      }

      eventIndex += 1
    }

    values.push(Math.min(score, result.decision?.score ?? 0))
  }

  return {
    label: 'Динамика балла риска',
    description: 'Ступени рассчитаны по подтверждённым признакам в момент их появления в расшифровке.',
    xAxisLabels: Array.from({ length: chartPointCount }, (_, index) => {
      return formatTimestamp((durationMs * index) / (chartPointCount - 1))
    }),
    series: [
      {
        key: 'risk-score',
        label: 'Балл риска',
        color: '#e66143',
        values,
      },
    ],
    annotations: createAnnotations(events, durationMs),
  }
}

function createAnnotations(
  events: { evidence: ApiAntifraudEvidence; startMs: number }[],
  durationMs: number,
): TimelineAnnotation[] {
  return events.map((event) => {
    return {
      id: event.evidence.id,
      label: event.evidence.title,
      value: Math.min((event.startMs / durationMs) * 100, 100),
      timestamp: formatTimestamp(event.startMs),
    }
  })
}

function createGuidance(result: ApiAntifraudResult): OperatorGuidance {
  const guidance = result.guidance

  if (!guidance) {
    return {
      kind: 'none',
      text: '',
      purpose: '',
      observe: [],
      evidenceIds: [],
    }
  }

  return {
    kind: guidance.kind,
    text: guidance.text,
    purpose: guidance.purpose,
    observe: guidance.observe.map((observation) => {
      const evidence = result.evidence.find((item) => item.id === observation)
      return evidence?.title ?? observation
    }),
    evidenceIds: guidance.evidenceIds,
  }
}

function formatDuration(durationMs: number): string {
  return formatTimestamp(durationMs)
}

function formatTimestamp(valueMs: number): string {
  const totalSeconds = Math.max(Math.floor(valueMs / 1000), 0)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
