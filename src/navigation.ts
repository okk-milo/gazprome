export type AnalysisPage = 'antifraud' | 'burnout'

export function pageFromHash(hash: string): AnalysisPage {
  return hash === '#burnout' ? 'burnout' : 'antifraud'
}
