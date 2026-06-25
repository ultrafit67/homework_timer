import { useState, useCallback, useRef } from 'react'
import { HomeworkRecord } from '../types'
import { generateId } from '../utils'

const AI_KEY_STORAGE = 'homework-ai-key'
const AI_HISTORY_STORAGE = 'homework-ai-history'
const MAX_HISTORY = 20
const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/v1/chat/completions'

export interface AIHistoryEntry {
  id: string
  timestamp: string
  user: string
  grade: number
  dateFrom: string
  dateTo: string
  recordCount: number
  result: string
}

export function loadApiKey(): string {
  try { return localStorage.getItem(AI_KEY_STORAGE) || '' } catch { return '' }
}

export function saveApiKey(key: string): void {
  try { localStorage.setItem(AI_KEY_STORAGE, key) } catch {}
}

export function getAIHistory(): AIHistoryEntry[] {
  try {
    const raw = localStorage.getItem(AI_HISTORY_STORAGE)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveAIHistory(history: AIHistoryEntry[]): void {
  try {
    localStorage.setItem(AI_HISTORY_STORAGE, JSON.stringify(history))
  } catch {}
}

export function deleteAIHistory(id: string): void {
  const history = getAIHistory().filter(e => e.id !== id)
  saveAIHistory(history)
}

function addAIHistory(entry: AIHistoryEntry): void {
  const history = getAIHistory()
  history.unshift(entry)
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY
  saveAIHistory(history)
}

function buildPrompt(records: HomeworkRecord[], userName: string, grade: number, dateFrom: string, dateTo: string): string {
  const timeRange = dateFrom && dateTo
    ? `${dateFrom} 到 ${dateTo}`
    : dateFrom
      ? `${dateFrom} 至今`
      : dateTo
        ? `截至 ${dateTo}`
        : '全部时间'

  // Build a summary for the prompt to keep tokens reasonable
  const totalSeconds = records.reduce((s, r) => s + r.durationSeconds, 0)
  const subjectSummary: Record<string, { totalSeconds: number; count: number }> = {}
  for (const r of records) {
    if (!subjectSummary[r.subject]) subjectSummary[r.subject] = { totalSeconds: 0, count: 0 }
    subjectSummary[r.subject].totalSeconds += r.durationSeconds
    subjectSummary[r.subject].count++
  }

  // Group by date
  const dailyTotals: Record<string, number> = {}
  for (const r of records) {
    dailyTotals[r.date] = (dailyTotals[r.date] || 0) + r.durationSeconds
  }

  const dailySummary = Object.entries(dailyTotals)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, secs]) => `${date}: ${Math.round(secs / 60)}分钟`)
    .join('\n')

  const subjectLines = Object.entries(subjectSummary)
    .sort(([, a], [, b]) => b.totalSeconds - a.totalSeconds)
    .map(([subj, stat]) => {
      const mins = Math.round(stat.totalSeconds / 60)
      const pct = totalSeconds > 0 ? Math.round(stat.totalSeconds / totalSeconds * 100) : 0
      return `- ${subj}: ${mins}分钟 (${pct}%), ${stat.count}次`
    })
    .join('\n')

  const totalHours = Math.round(totalSeconds / 60 * 10) / 10

  return `你是一个学习分析助手。请分析以下学习数据，给出时间分布、趋势分析和学习效率建议。

## 基本信息
- 姓名：${userName}（${grade > 0 ? `${grade}年级` : '未设置年级'}）
- 时间范围：${timeRange}
- 记录数：${records.length}条
- 总学习时间：${totalHours}分钟

## 各科目统计
${subjectLines}

## 每日学习时间
${dailySummary}

请用中文以 Markdown 格式回答，包含以下几个部分：
1. 📊 **学习时间概览** — 总时间、日均、各科目分布
2. 📈 **时间趋势** — 每天学习时长的变化
3. ⚖️ **均衡性评估** — 各科目时间分配是否合理
4. 💡 **提高效率的建议** — 具体、可执行，针对孩子的年龄和科目特点`
}

interface UseAIReturn {
  loading: boolean
  error: string | null
  result: string | null
  analyze: (
    apiKey: string,
    records: HomeworkRecord[],
    userName: string,
    grade: number,
    dateFrom: string,
    dateTo: string
  ) => Promise<string | null>
  abort: () => void
  clearResult: () => void
}

export function useAI(): UseAIReturn {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const analyze = useCallback(async (
    apiKey: string,
    records: HomeworkRecord[],
    userName: string,
    grade: number,
    dateFrom: string,
    dateTo: string
  ): Promise<string | null> => {
    // Abort previous request
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const prompt = buildPrompt(records, userName, grade, dateFrom, dateTo)

      const res = await fetch(DEEPSEEK_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: '你是一个学习分析助手。用中文回答，Markdown格式。' },
            { role: 'user', content: prompt }
          ],
          max_tokens: 4096,
          temperature: 0.7,
          stream: false
        }),
        signal: controller.signal
      })

      if (!res.ok) {
        const body = await res.text()
        let msg = `API 请求失败 (${res.status})`
        try {
          const json = JSON.parse(body)
          if (json.error?.message) msg = json.error.message
        } catch {}
        throw new Error(msg)
      }

      const json = await res.json()
      const text = json.choices?.[0]?.message?.content || ''
      setResult(text)

      // Save to history
      const entry: AIHistoryEntry = {
        id: generateId(),
        timestamp: new Date().toISOString(),
        user: userName,
        grade,
        dateFrom,
        dateTo,
        recordCount: records.length,
        result: text
      }
      addAIHistory(entry)

      return text
    } catch (e: any) {
      if (e.name === 'AbortError') {
        setError(null)
      } else {
        const msg = e.message || '分析失败，请重试'
        setError(msg)
      }
      return null
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false)
      }
    }
  }, [])

  const abort = useCallback(() => {
    abortRef.current?.abort()
    setLoading(false)
  }, [])

  const clearResult = useCallback(() => {
    setResult(null)
    setError(null)
  }, [])

  return { loading, error, result, analyze, abort, clearResult }
}
