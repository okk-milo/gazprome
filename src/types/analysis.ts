export type AnalysisPage = 'antifraud' | 'burnout'

export type StatusTone = 'danger' | 'warning' | 'success' | 'info' | 'neutral'

export type AnalysisRunState = 'queued' | 'processing' | 'completed' | 'insufficient_data' | 'failed'

export type AntifraudOutcome = 'safe' | 'verification' | 'escalation' | 'manual_review'

export type BurnoutOutcome = 'stable' | 'watch' | 'attention' | 'priority_support'

export interface OutcomePresentation {
  label: string
  title: string
  tone: StatusTone
}

export interface CompletedResult<TOutcome extends string> {
  state: 'completed'
  outcome: TOutcome
  score: number
}

export type ResultState<TOutcome extends string> =
  | CompletedResult<TOutcome>
  | {
      state: 'queued' | 'processing'
      outcome: null
      score: null
    }
  | {
      state: 'insufficient_data' | 'failed'
      outcome: null
      score: null
      reason: string
    }

export const antifraudOutcomePresentation = {
  safe: {
    label: 'Рекомендуемое действие',
    title: 'Можно сократить разговор',
    tone: 'success',
  },
  verification: {
    label: 'Рекомендуемое действие',
    title: 'Проведите дополнительную проверку',
    tone: 'warning',
  },
  escalation: {
    label: 'Рекомендуемое действие',
    title: 'Не разблокировать операцию',
    tone: 'danger',
  },
  manual_review: {
    label: 'Рекомендуемое действие',
    title: 'Нужна ручная оценка кейса',
    tone: 'info',
  },
} satisfies Record<AntifraudOutcome, OutcomePresentation>

export const burnoutOutcomePresentation = {
  stable: {
    label: 'Итог наблюдения',
    title: 'Состояние стабильно относительно личной нормы',
    tone: 'success',
  },
  watch: {
    label: 'Итог наблюдения',
    title: 'Стоит наблюдать динамику',
    tone: 'info',
  },
  attention: {
    label: 'Итог наблюдения',
    title: 'Состояние изменилось относительно личной нормы',
    tone: 'warning',
  },
  priority_support: {
    label: 'Итог наблюдения',
    title: 'Нужна приоритетная поддержка сотрудника',
    tone: 'danger',
  },
} satisfies Record<BurnoutOutcome, OutcomePresentation>

export interface ContextItem {
  label: string
  value: string
  description: string
  tone?: StatusTone
}

export interface ChartSeries {
  key: string
  label: string
  color: string
  dashed?: boolean
  values: number[]
}

export interface TimelineAnnotation {
  id?: string
  label: string
  value: number
  timestamp?: string
}

export interface EvidenceItem {
  id: string
  title: string
  description: string
  quote?: string
  timestamp?: string
  confidence: number
  tone: StatusTone
}

export interface TranscriptHighlight {
  evidenceId: string
  startOffset: number
  endOffset: number
}

export interface TranscriptMessage {
  id: string
  speaker: string
  role: 'operator' | 'client' | 'unknown'
  timestamp: string
  text: string
  highlights?: TranscriptHighlight[]
}

export interface OperatorGuidance {
  kind: 'question' | 'instruction' | 'none'
  text: string
  purpose: string
  observe: string[]
  evidenceIds: string[]
}

export interface MetricItem {
  id: string
  label: string
  value: number
  unit?: string
  delta: string
  description: string
  tone: StatusTone
  isControl?: boolean
}

export interface AntifraudAnalysis {
  title: string
  eyebrow: string
  callDuration: string
  state: AnalysisRunState
  context: ContextItem[]
  decision: {
    result: CompletedResult<AntifraudOutcome>
    summary: string
  }
  confidence: {
    label: string
    description: string
    xAxisLabels: string[]
    series: ChartSeries[]
    annotations: TimelineAnnotation[]
  }
  guidance: OperatorGuidance
  transcript: TranscriptMessage[]
  evidence: EvidenceItem[]
}

export interface BurnoutAnalysis {
  title: string
  eyebrow: string
  context: ContextItem[]
  decision: {
    result: CompletedResult<BurnoutOutcome>
    summary: string
    recommendation: string
  }
  trajectory: {
    label: string
    description: string
    xAxisLabels: string[]
    series: ChartSeries[]
    annotations: TimelineAnnotation[]
  }
  metrics: MetricItem[]
  workload: MetricItem[]
  evidence: EvidenceItem[]
  actions: string[]
}
