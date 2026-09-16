export type StatusTone = 'danger' | 'warning' | 'success' | 'info' | 'neutral'

export interface ContextItem {
  label: string
  value: string
  description: string
  tone?: StatusTone
}

export interface ChartSeries {
  max?: number
  unit?: string
  key: string
  label: string
  color: string
  dashed?: boolean
  values: Array<number | null>
  description: string
  direction: 'higher-is-worse' | 'higher-is-more'
  help?: string
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

export interface EvidenceItem {
  id: string
  title: string
  description: string
  quote?: string
  timestamp?: string
  confidence: number
  tone: StatusTone
}

export interface BurnoutAnalysis {
  title: string
  eyebrow: string
  context: ContextItem[]
  decision: {
    result: { state: 'completed'; outcome: 'attention'; score: number }
    summary: string
    recommendation: string
  }
  trajectory: {
    label: string
    description: string
    xAxisLabels: string[]
    series: ChartSeries[]
    annotations: { label: string; value: number }[]
  }
  metrics: MetricItem[]
  workload: MetricItem[]
  evidence: EvidenceItem[]
  actions: string[]
}
