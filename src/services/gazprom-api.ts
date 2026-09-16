import { parseDatasetResponse, type DatasetResponse } from './burnout-dataset'
import { parseTechnicalResponse, type TechnicalResponse } from './technical-dataset'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? '/api'

export function getBurnoutDataset(): Promise<DatasetResponse> { return request('/v1/burnout/dataset', parseDatasetResponse, { signal: AbortSignal.timeout(12000) }) }
export function getTechnicalDataset(): Promise<TechnicalResponse> { return request('/v1/burnout/technical', parseTechnicalResponse, { signal: AbortSignal.timeout(12000) }) }

export interface Employee { id: string; name: string }
export interface Deal { id: string; title: string; employeeId: string }
export interface TranscriptSegment { id: string; startMs: number; endMs: number; speaker: string; text: string; highlightRanges: Array<{ startOffset: number; endOffset: number; kind: 'risk' | 'counter' }> }
export type CallState = 'upload_pending' | 'uploaded' | 'transcribing' | 'analysing' | 'completed' | 'no_speech' | 'failed'
export interface CallSnapshot {
  id: string
  state: CallState
  revision: number
  progress: number
  transcript: TranscriptSegment[]
  analysis: { score: number; factorsFor: Array<{ id: string; title: string; description: string; confidence: number; segmentId: string }>; factorsAgainst: Array<{ id: string; title: string; description: string; confidence: number; segmentId: string }>; timeline: Array<{ timestampMs: number; score: number }>; modelVersion: string } | null
}
export interface CallHistoryItem { id: string; fileName: string; state: CallState; progress: number; score: number | null; dealTitle: string; employeeName: string; createdAt: string }
export interface CallHistoryPage { items: CallHistoryItem[]; total: number; page: number; pageSize: number }
interface UploadResponse { call: CallSnapshot; uploadUrl: string | null }

export function listEmployees(): Promise<Employee[]> { return request('/v1/employees', parseEmployees) }
export function createEmployee(): Promise<Employee> { return request('/v1/employees', parseEmployee, { method: 'POST', body: '{}' }) }
export function deleteEmployee(employeeId: string): Promise<void> { return requestEmpty(`/v1/employees/${encodeURIComponent(employeeId)}`, { method: 'DELETE' }) }
export function listDeals(): Promise<Deal[]> { return request('/v1/deals', parseDeals) }
export function createUpload(dealId: string, employeeId: string, file: File): Promise<UploadResponse> { return request(`/v1/deals/${encodeURIComponent(dealId)}/calls/upload-url`, parseUploadResponse, { method: 'POST', body: JSON.stringify({ employeeId, fileName: file.name, contentType: file.type || 'audio/mpeg' }) }) }
export function markUploaded(callId: string): Promise<CallSnapshot> { return request(`/v1/calls/${encodeURIComponent(callId)}/uploaded`, parseSnapshot, { method: 'POST' }) }
export function listCallHistory(page: number): Promise<CallHistoryPage> { return request(`/v1/calls?page=${encodeURIComponent(page)}`, parseCallHistory) }
export function getCallSnapshot(callId: string): Promise<CallSnapshot> { return request(`/v1/calls/${encodeURIComponent(callId)}`, parseSnapshot) }

async function request<T>(path: string, parser: (value: unknown) => T, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } })
  if (!response.ok) throw new Error(await readResponseError(response))
  return parser(await response.json() as unknown)
}
async function requestEmpty(path: string, init?: RequestInit): Promise<void> {
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } })
  if (!response.ok) throw new Error(await readResponseError(response))
}
async function readResponseError(response: Response): Promise<string> {
  const body: unknown = await response.json().catch(() => null)
  if (typeof body === 'object' && body !== null && !Array.isArray(body)) {
    const message = (body as Record<string, unknown>).message
    if (typeof message === 'string') return message
  }
  return `API вернул HTTP ${response.status}`
}
function parseEmployees(value: unknown): Employee[] { return readArray(value, 'Некорректный список сотрудников').map(parseEmployee) }
function parseEmployee(value: unknown): Employee { const item = readRecord(value, 'Некорректный сотрудник'); return { id: readString(item.id, 'Некорректный ID сотрудника'), name: readString(item.name, 'Некорректное имя сотрудника') } }
function parseDeals(value: unknown): Deal[] { return readArray(value, 'Некорректный список сделок').map((value) => { const item = readRecord(value, 'Некорректная сделка'); return { id: readString(item.id, 'Некорректный ID сделки'), title: readString(item.title, 'Некорректное название сделки'), employeeId: readString(item.employeeId, 'Некорректный сотрудник сделки') } }) }
function parseUploadResponse(value: unknown): UploadResponse { const item = readRecord(value, 'Некорректный ответ загрузки'); return { call: parseSnapshot(item.call), uploadUrl: item.uploadUrl === null ? null : readString(item.uploadUrl, 'Некорректный URL загрузки') } }
function parseSnapshot(value: unknown): CallSnapshot { const item = readRecord(value, 'Некорректный снимок анализа'); const analysis = item.analysis; return { id: readString(item.id, 'Некорректный ID звонка'), state: readEnum(item.state, ['upload_pending', 'uploaded', 'transcribing', 'analysing', 'completed', 'no_speech', 'failed'] as const, 'Некорректное состояние'), revision: readNumber(item.revision, 'Некорректная ревизия'), progress: readNumber(item.progress, 'Некорректный прогресс'), transcript: readArray(item.transcript, 'Некорректная расшифровка').map(parseTranscriptSegment), analysis: analysis === null ? null : parseAnalysis(analysis) } }
function parseCallHistory(value: unknown): CallHistoryPage {
  if (Array.isArray(value)) {
    const items = value.map(parseCallHistoryItem)
    return { items, total: items.length, page: 1, pageSize: 5 }
  }
  const page = readRecord(value, 'Некорректная страница проверок')
  return {
    items: readArray(page.items, 'Некорректный список проверок').map(parseCallHistoryItem),
    total: readNumber(page.total, 'Некорректное число проверок'),
    page: readNumber(page.page, 'Некорректный номер страницы'),
    pageSize: readNumber(page.pageSize, 'Некорректный размер страницы'),
  }
}
function parseCallHistoryItem(value: unknown): CallHistoryItem { const item = readRecord(value, 'Некорректная проверка'); return { id: readString(item.id, 'Некорректный ID проверки'), fileName: readString(item.fileName, 'Некорректное имя файла'), state: readEnum(item.state, ['upload_pending', 'uploaded', 'transcribing', 'analysing', 'completed', 'no_speech', 'failed'] as const, 'Некорректное состояние'), progress: readNumber(item.progress, 'Некорректный прогресс'), score: item.score === null ? null : readNumber(item.score, 'Некорректная оценка риска'), dealTitle: readString(item.dealTitle, 'Некорректная сделка'), employeeName: readString(item.employeeName, 'Некорректный сотрудник'), createdAt: readString(item.createdAt, 'Некорректная дата') } }
function parseTranscriptSegment(value: unknown): TranscriptSegment { const item = readRecord(value, 'Некорректный сегмент расшифровки'); return { id: readString(item.id, 'Некорректный ID сегмента'), startMs: readNumber(item.startMs, 'Некорректное начало сегмента'), endMs: readNumber(item.endMs, 'Некорректный конец сегмента'), speaker: readString(item.speaker, 'Некорректный автор сегмента'), text: readString(item.text, 'Некорректный текст сегмента'), highlightRanges: readArray(item.highlightRanges, 'Некорректные выделения').map((value) => { const range = readRecord(value, 'Некорректное выделение'); return { startOffset: readNumber(range.startOffset, 'Некорректное начало выделения'), endOffset: readNumber(range.endOffset, 'Некорректный конец выделения'), kind: readEnum(range.kind, ['risk', 'counter'] as const, 'Некорректный тип выделения') } }) } }
function parseAnalysis(value: unknown): NonNullable<CallSnapshot['analysis']> { const item = readRecord(value, 'Некорректный результат анализа'); return { score: readNumber(item.score, 'Некорректная оценка риска'), factorsFor: parseFactors(item.factorsFor), factorsAgainst: parseFactors(item.factorsAgainst), timeline: readArray(item.timeline, 'Некорректный график').map((value) => { const point = readRecord(value, 'Некорректная точка графика'); return { timestampMs: readNumber(point.timestampMs, 'Некорректное время точки'), score: readNumber(point.score, 'Некорректная оценка точки') } }), modelVersion: readString(item.modelVersion, 'Некорректная версия модели') } }
function parseFactors(value: unknown): NonNullable<CallSnapshot['analysis']>['factorsFor'] { return readArray(value, 'Некорректные факторы').map((value) => { const item = readRecord(value, 'Некорректный фактор'); return { id: readString(item.id, 'Некорректный ID фактора'), title: readString(item.title, 'Некорректный заголовок фактора'), description: readString(item.description, 'Некорректное описание фактора'), confidence: readNumber(item.confidence, 'Некорректная уверенность фактора'), segmentId: readString(item.segmentId, 'Некорректный сегмент фактора') } }) }
function readRecord(value: unknown, message: string): Record<string, unknown> { if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(message); return value as Record<string, unknown> }
function readArray(value: unknown, message: string): unknown[] { if (!Array.isArray(value)) throw new Error(message); return value }
function readString(value: unknown, message: string): string { if (typeof value !== 'string' || value.trim().length === 0) throw new Error(message); return value }
function readNumber(value: unknown, message: string): number { if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(message); return value }
function readEnum<TValue extends string>(value: unknown, values: readonly TValue[], message: string): TValue { if (typeof value !== 'string' || !values.includes(value as TValue)) throw new Error(message); return value as TValue }
