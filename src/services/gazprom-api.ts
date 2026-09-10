const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? '/api'

export interface Employee { id: string; name: string }
export interface Deal { id: string; title: string; employeeId: string }
export interface TranscriptSegment { id: string; startMs: number; endMs: number; speaker: string; text: string; highlightRanges: Array<{ startOffset: number; endOffset: number; kind: 'risk' | 'counter' }> }
export interface CallSnapshot {
  id: string
  state: 'upload_pending' | 'uploaded' | 'transcribing' | 'analysing' | 'completed' | 'failed'
  revision: number
  progress: number
  transcript: TranscriptSegment[]
  analysis: { score: number; factorsFor: Array<{ id: string; title: string; description: string; confidence: number; segmentId: string }>; factorsAgainst: Array<{ id: string; title: string; description: string; confidence: number; segmentId: string }>; timeline: Array<{ timestampMs: number; score: number }>; modelVersion: string } | null
}
interface UploadResponse { call: CallSnapshot; uploadUrl: string | null }

export function listEmployees(): Promise<Employee[]> { return request('/v1/employees', parseEmployees) }
export function createEmployee(): Promise<Employee> { return request('/v1/employees', parseEmployee, { method: 'POST', body: '{}' }) }
export function listDeals(): Promise<Deal[]> { return request('/v1/deals', parseDeals) }
export function createUpload(dealId: string, employeeId: string, file: File): Promise<UploadResponse> { return request(`/v1/deals/${encodeURIComponent(dealId)}/calls/upload-url`, parseUploadResponse, { method: 'POST', body: JSON.stringify({ employeeId, fileName: file.name, contentType: file.type || 'audio/mpeg' }) }) }
export function markUploaded(callId: string): Promise<CallSnapshot> { return request(`/v1/calls/${encodeURIComponent(callId)}/uploaded`, parseSnapshot, { method: 'POST' }) }
export function getCallSnapshot(callId: string): Promise<CallSnapshot> { return request(`/v1/calls/${encodeURIComponent(callId)}`, parseSnapshot) }

async function request<T>(path: string, parser: (value: unknown) => T, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } })
  if (!response.ok) throw new Error(`API вернул HTTP ${response.status}`)
  return parser(await response.json() as unknown)
}
function parseEmployees(value: unknown): Employee[] { return readArray(value, 'Некорректный список сотрудников').map(parseEmployee) }
function parseEmployee(value: unknown): Employee { const item = readRecord(value, 'Некорректный сотрудник'); return { id: readString(item.id, 'Некорректный ID сотрудника'), name: readString(item.name, 'Некорректное имя сотрудника') } }
function parseDeals(value: unknown): Deal[] { return readArray(value, 'Некорректный список сделок').map((value) => { const item = readRecord(value, 'Некорректная сделка'); return { id: readString(item.id, 'Некорректный ID сделки'), title: readString(item.title, 'Некорректное название сделки'), employeeId: readString(item.employeeId, 'Некорректный сотрудник сделки') } }) }
function parseUploadResponse(value: unknown): UploadResponse { const item = readRecord(value, 'Некорректный ответ загрузки'); return { call: parseSnapshot(item.call), uploadUrl: item.uploadUrl === null ? null : readString(item.uploadUrl, 'Некорректный URL загрузки') } }
function parseSnapshot(value: unknown): CallSnapshot { const item = readRecord(value, 'Некорректный снимок анализа'); const analysis = item.analysis; return { id: readString(item.id, 'Некорректный ID звонка'), state: readEnum(item.state, ['upload_pending', 'uploaded', 'transcribing', 'analysing', 'completed', 'failed'] as const, 'Некорректное состояние'), revision: readNumber(item.revision, 'Некорректная ревизия'), progress: readNumber(item.progress, 'Некорректный прогресс'), transcript: readArray(item.transcript, 'Некорректная расшифровка').map(parseTranscriptSegment), analysis: analysis === null ? null : parseAnalysis(analysis) } }
function parseTranscriptSegment(value: unknown): TranscriptSegment { const item = readRecord(value, 'Некорректный сегмент расшифровки'); return { id: readString(item.id, 'Некорректный ID сегмента'), startMs: readNumber(item.startMs, 'Некорректное начало сегмента'), endMs: readNumber(item.endMs, 'Некорректный конец сегмента'), speaker: readString(item.speaker, 'Некорректный автор сегмента'), text: readString(item.text, 'Некорректный текст сегмента'), highlightRanges: readArray(item.highlightRanges, 'Некорректные выделения').map((value) => { const range = readRecord(value, 'Некорректное выделение'); return { startOffset: readNumber(range.startOffset, 'Некорректное начало выделения'), endOffset: readNumber(range.endOffset, 'Некорректный конец выделения'), kind: readEnum(range.kind, ['risk', 'counter'] as const, 'Некорректный тип выделения') } }) } }
function parseAnalysis(value: unknown): NonNullable<CallSnapshot['analysis']> { const item = readRecord(value, 'Некорректный результат анализа'); return { score: readNumber(item.score, 'Некорректная оценка риска'), factorsFor: parseFactors(item.factorsFor), factorsAgainst: parseFactors(item.factorsAgainst), timeline: readArray(item.timeline, 'Некорректный график').map((value) => { const point = readRecord(value, 'Некорректная точка графика'); return { timestampMs: readNumber(point.timestampMs, 'Некорректное время точки'), score: readNumber(point.score, 'Некорректная оценка точки') } }), modelVersion: readString(item.modelVersion, 'Некорректная версия модели') } }
function parseFactors(value: unknown): NonNullable<CallSnapshot['analysis']>['factorsFor'] { return readArray(value, 'Некорректные факторы').map((value) => { const item = readRecord(value, 'Некорректный фактор'); return { id: readString(item.id, 'Некорректный ID фактора'), title: readString(item.title, 'Некорректный заголовок фактора'), description: readString(item.description, 'Некорректное описание фактора'), confidence: readNumber(item.confidence, 'Некорректная уверенность фактора'), segmentId: readString(item.segmentId, 'Некорректный сегмент фактора') } }) }
function readRecord(value: unknown, message: string): Record<string, unknown> { if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(message); return value as Record<string, unknown> }
function readArray(value: unknown, message: string): unknown[] { if (!Array.isArray(value)) throw new Error(message); return value }
function readString(value: unknown, message: string): string { if (typeof value !== 'string' || value.trim().length === 0) throw new Error(message); return value }
function readNumber(value: unknown, message: string): number { if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(message); return value }
function readEnum<TValue extends string>(value: unknown, values: readonly TValue[], message: string): TValue { if (typeof value !== 'string' || !values.includes(value as TValue)) throw new Error(message); return value as TValue }
