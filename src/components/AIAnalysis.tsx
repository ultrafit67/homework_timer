import { useState, useMemo, useCallback, useRef, Fragment, createElement, ReactElement } from 'react'

type TagName = 'h1' | 'h2' | 'h3' | 'h4'

function MarkdownRenderer({ content }: { content: string }): ReactElement {
  const lines = content.split('\n')
  const elements: ReactElement[] = []
  let inCodeBlock = false
  let codeBuffer: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(createElement('pre', { key: `cb-${elements.length}` },
          createElement('code', {}, codeBuffer.join('\n'))
        ))
        codeBuffer = []
        inCodeBlock = false
      } else {
        inCodeBlock = true
      }
      continue
    }

    if (inCodeBlock) {
      codeBuffer.push(line)
      continue
    }

    if (/^---+$/.test(line.trim())) {
      elements.push(createElement('hr', { key: `hr-${elements.length}` }))
      continue
    }

    if (line.trim() === '') continue

    const hMatch = line.match(/^(#{1,4})\s+(.+)/)
    if (hMatch) {
      const level = hMatch[1].length
      const tags: TagName[] = ['h1', 'h2', 'h3', 'h4']
      elements.push(createElement(tags[level - 1], { key: `h-${elements.length}` },
        parseInline(hMatch[2])
      ))
      continue
    }

    const ulMatch = line.match(/^[-*+]\s+(.+)/)
    if (ulMatch) {
      elements.push(createElement('li', { key: `li-${elements.length}`, style: { listStyle: 'disc' } },
        parseInline(ulMatch[1])
      ))
      continue
    }

    const olMatch = line.match(/^\d+\.\s+(.+)/)
    if (olMatch) {
      elements.push(createElement('li', { key: `li-${elements.length}`, style: { listStyle: 'decimal' } },
        parseInline(olMatch[1])
      ))
      continue
    }

    elements.push(createElement('p', { key: `p-${elements.length}` },
      parseInline(line)
    ))
  }

  if (inCodeBlock && codeBuffer.length > 0) {
    elements.push(createElement('pre', { key: `cb-${elements.length}` },
      createElement('code', {}, codeBuffer.join('\n'))
    ))
  }

  return createElement(Fragment, {}, ...elements)
}

interface MatchResult {
  index: number
  length: number
  render: () => ReactElement
}

function findEarliest(text: string, parts: (string | ReactElement)[]): MatchResult | null {
  const boldMatch = text.match(/\*\*(.+?)\*\*/)
  const codeMatch = text.match(/`([^`]+)`/)
  const linkMatch = text.match(/\[([^\]]+)\]\(([^)]+)\)/)

  const candidates: MatchResult[] = []

  if (boldMatch && boldMatch.index !== undefined) {
    const idx = boldMatch.index
    const content = boldMatch[1]
    candidates.push({
      index: idx,
      length: boldMatch[0].length,
      render: () => createElement('strong', { key: `b-${parts.length}` }, content)
    })
  }
  if (codeMatch && codeMatch.index !== undefined) {
    const idx = codeMatch.index
    const content = codeMatch[1]
    candidates.push({
      index: idx,
      length: codeMatch[0].length,
      render: () => createElement('code', { key: `c-${parts.length}` }, content)
    })
  }
  if (linkMatch && linkMatch.index !== undefined) {
    const idx = linkMatch.index
    const content = linkMatch[1]
    const href = linkMatch[2]
    candidates.push({
      index: idx,
      length: linkMatch[0].length,
      render: () => createElement('a', { key: `a-${parts.length}`, href, target: '_blank', rel: 'noopener noreferrer' }, content)
    })
  }

  if (candidates.length === 0) return null

  return candidates.reduce((earliest, c) => c.index < earliest.index ? c : earliest)
}

function parseInline(text: string): (string | ReactElement)[] {
  const parts: (string | ReactElement)[] = []
  let remaining = text

  while (remaining.length > 0) {
    const earliest = findEarliest(remaining, parts)
    if (earliest) {
      if (earliest.index > 0) {
        parts.push(remaining.slice(0, earliest.index))
      }
      parts.push(earliest.render())
      remaining = remaining.slice(earliest.index + earliest.length)
    } else {
      parts.push(remaining)
      break
    }
  }

  return parts
}
import { HomeworkRecord } from '../types'
import { loadUserNames, loadGrade, generateId } from '../utils'
import { useAI, loadApiKey, getAIHistory, deleteAIHistory, saveAIHistory, AIHistoryEntry } from '../hooks/useAI'

interface AIAnalysisProps {
  records: HomeworkRecord[]
  userFilter: string | null
  dateFrom: string
  dateTo: string
}

interface ExportMeta {
  user: string
  dateFrom: string
  dateTo: string
  recordCount: number
}

function exportMd(content: string, meta: ExportMeta) {
  const now = new Date()
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`
  const frontMatter = [
    '---',
    `user: ${meta.user}`,
    `date_from: ${meta.dateFrom || ''}`,
    `date_to: ${meta.dateTo || ''}`,
    `record_count: ${meta.recordCount}`,
    '---',
    ''
  ].join('\n')
  const blob = new Blob([frontMatter + content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ai-analysis-${meta.user}-${dateStr}.md`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function parseImportMd(text: string): { content: string; meta: Partial<ExportMeta> } {
  const meta: Partial<ExportMeta> = {}
  let content = text

  if (text.startsWith('---\n')) {
    const end = text.indexOf('\n---\n', 4)
    if (end !== -1) {
      const fm = text.slice(4, end)
      for (const line of fm.split('\n')) {
        const sep = line.indexOf(': ')
        if (sep === -1) continue
        const key = line.slice(0, sep).trim()
        const val = line.slice(sep + 2).trim()
        if (key === 'user') meta.user = val
        else if (key === 'date_from') meta.dateFrom = val
        else if (key === 'date_to') meta.dateTo = val
        else if (key === 'record_count') meta.recordCount = parseInt(val, 10) || 0
      }
      content = text.slice(end + 5)
    }
  }

  return { content, meta }
}

export function AIAnalysis({ records, userFilter, dateFrom, dateTo }: AIAnalysisProps) {
  const [showHistory, setShowHistory] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [importDup, setImportDup] = useState<{ user: string; dateFrom: string; dateTo: string; recordCount: number } | null>(null)
  const [historyList, setHistoryList] = useState<AIHistoryEntry[]>(() => getAIHistory())
  const [viewingHistory, setViewingHistory] = useState<AIHistoryEntry | null>(null)
  const { loading, error, result, analyze, abort, clearResult } = useAI()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const apiKey = useMemo(() => loadApiKey(), [])

  const refreshHistory = useCallback(() => {
    setHistoryList(getAIHistory())
  }, [])

  const handleImportMd = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const { content, meta } = parseImportMd(reader.result as string)

      const existing = getAIHistory()
      if (existing.some(e => e.result === content)) {
        setImportDup({ user: meta.user || '导入', dateFrom: meta.dateFrom || '', dateTo: meta.dateTo || '', recordCount: meta.recordCount || 0 })
        return
      }

      const entry: AIHistoryEntry = {
        id: generateId(),
        timestamp: new Date().toISOString(),
        user: meta.user || '导入',
        grade: 0,
        dateFrom: meta.dateFrom || '',
        dateTo: meta.dateTo || '',
        recordCount: meta.recordCount || 0,
        result: content
      }
      existing.unshift(entry)
      saveAIHistory(existing)
      setViewingHistory(entry)
      clearResult()
      setShowHistory(false)
      refreshHistory()
    }
    reader.readAsText(file)
    e.target.value = ''
  }, [clearResult, refreshHistory])

  const activeUserName = useMemo(() => {
    if (!userFilter) return '全部用户'
    return userFilter
  }, [userFilter])

  const activeGrade = useMemo(() => {
    if (!userFilter) return 0
    const names = loadUserNames()
    const idx = names.indexOf(userFilter)
    return idx >= 0 ? loadGrade(idx) : 0
  }, [userFilter])

  const rangeLabel = dateFrom && dateTo
    ? `${dateFrom} ~ ${dateTo}`
    : dateFrom ? `${dateFrom} 至今`
    : dateTo ? `截至 ${dateTo}`
    : '全部时间'

  const handleStartAnalysis = () => {
    setShowHistory(false)
    setViewingHistory(null)
    clearResult()
    setShowConfirm(true)
  }

  const handleConfirmAnalysis = async () => {
    setShowConfirm(false)
    await analyze(apiKey, records, activeUserName, activeGrade, dateFrom, dateTo)
    refreshHistory()
  }

  const handleCancelConfirm = () => {
    setShowConfirm(false)
  }

  const handleAnalyzeClick = () => {
    if (!apiKey) {
      alert('请先在计时页面的「AI设置」中配置 API Key')
      return
    }
    if (records.length === 0) {
      alert('当前筛选条件下没有记录，请调整筛选条件')
      return
    }
    handleStartAnalysis()
  }

  const handleViewHistory = (entry: AIHistoryEntry) => {
    setViewingHistory(entry)
    clearResult()
    setShowHistory(true)
  }

  const handleBackToResult = () => {
    setViewingHistory(null)
    clearResult()
  }

  const handleDeleteHistory = (id: string) => {
    deleteAIHistory(id)
    refreshHistory()
    if (viewingHistory?.id === id) setViewingHistory(null)
  }

  const hasRecords = records.length > 0

  return (
    <div className="ai-section">
      <div className="ai-section__body">
          <div className="ai-section__actions">
            <button
              className="btn btn--primary btn--small"
              onClick={handleAnalyzeClick}
              disabled={loading || !hasRecords}
            >
              {loading ? '分析中...' : '🤖 AI分析'}
            </button>
            <button
              className="btn btn--small"
              onClick={() => { setShowHistory(!showHistory); setViewingHistory(null); clearResult() }}
            >
              📋 历史记录
            </button>
            <button className="btn btn--small" onClick={() => fileInputRef.current?.click()}>
              📥 导入
            </button>
            <input ref={fileInputRef} type="file" accept=".md" style={{ display: 'none' }} onChange={handleImportMd} />
            {loading && (
              <button className="btn btn--small btn--danger" onClick={abort}>
                停止
              </button>
            )}
            {result && (
              <button className="btn btn--small" onClick={clearResult}>
                清除
              </button>
            )}
          </div>

          {showConfirm && (
            <div className="ai-confirm">
              <p className="ai-confirm__label">确认以下分析范围：</p>
              <div className="ai-confirm__row">
                <span className="ai-confirm__field">姓名</span>
                <span className="ai-confirm__value">{activeUserName}</span>
              </div>
              <div className="ai-confirm__row">
                <span className="ai-confirm__field">时间范围</span>
                <span className="ai-confirm__value">{rangeLabel}</span>
              </div>
              <div className="ai-confirm__row">
                <span className="ai-confirm__field">记录数</span>
                <span className="ai-confirm__value">{records.length}条</span>
              </div>
              <div className="ai-confirm__actions">
                <button className="btn btn--secondary btn--small" onClick={handleCancelConfirm}>取消</button>
                <button className="btn btn--primary btn--small" onClick={handleConfirmAnalysis}>确认分析</button>
              </div>
            </div>
          )}

          {importDup && (
            <div className="ai-confirm">
              <p className="ai-confirm__label">该分析结果已存在，跳过导入</p>
              <div className="ai-confirm__row">
                <span className="ai-confirm__field">姓名</span>
                <span className="ai-confirm__value">{importDup.user}</span>
              </div>
              <div className="ai-confirm__row">
                <span className="ai-confirm__field">时间范围</span>
                <span className="ai-confirm__value">{importDup.dateFrom || '不限'} ~ {importDup.dateTo || '不限'}</span>
              </div>
              <div className="ai-confirm__row">
                <span className="ai-confirm__field">记录数</span>
                <span className="ai-confirm__value">{importDup.recordCount}条</span>
              </div>
              <div className="ai-confirm__actions">
                <button className="btn btn--primary btn--small" onClick={() => setImportDup(null)}>确定</button>
              </div>
            </div>
          )}

          {!hasRecords && !result && !error && !viewingHistory && !showConfirm && (
            <p className="ai-section__empty">当前筛选条件下没有记录</p>
          )}

          {loading && (
            <div className="ai-section__loading">
              <div className="ai-section__spinner" />
              <span>AI 分析中...</span>
            </div>
          )}

          {error && (
            <div className="ai-section__error">
              <p>{error}</p>
              <button className="btn btn--small btn--primary" onClick={handleAnalyzeClick}>重试</button>
            </div>
          )}

          {result && !viewingHistory && (
            <div className="ai-result">
              <MarkdownRenderer content={result} />
              <p className="ai-result__meta">
                <span>分析时间：{new Date().toLocaleString('zh-CN')} ｜ 记录数：{records.length}条</span>
                <span className="ai-result__meta-actions">
                  <button className="ai-result__action" onClick={() => exportMd(result, { user: activeUserName, dateFrom, dateTo, recordCount: records.length })}>导出</button>
                </span>
              </p>
            </div>
          )}

          {viewingHistory && (
            <div className="ai-result">
              <div className="ai-section__back" onClick={handleBackToResult}>
                ← 返回
              </div>
              <MarkdownRenderer content={viewingHistory.result} />
              <p className="ai-result__meta">
                <span>{viewingHistory.user} ｜ {viewingHistory.dateFrom || '不限'} ~ {viewingHistory.dateTo || '不限'} ｜ {viewingHistory.recordCount}条</span>
                <span className="ai-result__meta-actions">
                  <button className="ai-result__action" onClick={() => exportMd(viewingHistory.result, { user: viewingHistory.user, dateFrom: viewingHistory.dateFrom, dateTo: viewingHistory.dateTo, recordCount: viewingHistory.recordCount })}>导出</button>
                  <button className="ai-result__del" onClick={() => handleDeleteHistory(viewingHistory.id)}>删除</button>
                </span>
              </p>
            </div>
          )}

          {/* History list */}
          {showHistory && !viewingHistory && (
            <div className="ai-history-list">
              {historyList.length === 0 ? (
                <p className="ai-section__empty">暂无历史记录</p>
              ) : (
                historyList.map(entry => (
                  <div key={entry.id} className="ai-history-item" onClick={() => handleViewHistory(entry)}>
                    <div className="ai-history-item__info">
                      <span className="ai-history-item__user">{entry.user}</span>
                      <span className="ai-history-item__date">
                        {entry.dateFrom || '不限'} ~ {entry.dateTo || '不限'}
                      </span>
                      <span className="ai-history-item__count">{entry.recordCount}条</span>
                    </div>
                    <div className="ai-history-item__time">
                      {new Date(entry.timestamp).toLocaleString('zh-CN', {
                        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
    </div>
  )
}
