import { useState, useMemo, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { HomeworkRecord } from '../types'
import { loadUserNames, loadGrade } from '../utils'
import { useAI, loadApiKey, getAIHistory, deleteAIHistory, AIHistoryEntry } from '../hooks/useAI'

interface AIAnalysisProps {
  records: HomeworkRecord[]
  userFilter: string | null
  dateFrom: string
  dateTo: string
}

export function AIAnalysis({ records, userFilter, dateFrom, dateTo }: AIAnalysisProps) {
  const [expanded, setExpanded] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [historyList, setHistoryList] = useState<AIHistoryEntry[]>(() => getAIHistory())
  const [viewingHistory, setViewingHistory] = useState<AIHistoryEntry | null>(null)
  const { loading, error, result, analyze, abort, clearResult } = useAI()

  const apiKey = useMemo(() => loadApiKey(), [expanded])

  const refreshHistory = useCallback(() => {
    setHistoryList(getAIHistory())
  }, [])

  // Determine user info for the analysis context
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

  const handleAnalyze = async () => {
    if (!apiKey) {
      alert('请先在计时页面的「AI设置」中配置 API Key')
      return
    }
    if (records.length === 0) {
      alert('当前筛选条件下没有记录，请调整筛选条件')
      return
    }
    setShowHistory(false)
    setViewingHistory(null)
    clearResult()
    await analyze(apiKey, records, activeUserName, activeGrade, dateFrom, dateTo)
    refreshHistory()
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
      <div className="ai-section__header" onClick={() => setExpanded(!expanded)}>
        <span className="ai-section__title">AI 分析</span>
        <span className="ai-section__toggle">{expanded ? '收起' : '展开'}</span>
      </div>

      {expanded && (
        <div className="ai-section__body">
          {/* Action buttons */}
          <div className="ai-section__actions">
            <button
              className="btn btn--primary btn--small"
              onClick={handleAnalyze}
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

          {/* No records warning */}
          {!hasRecords && !result && !error && !viewingHistory && (
            <p className="ai-section__empty">当前筛选条件下没有记录</p>
          )}

          {/* Loading spinner */}
          {loading && (
            <div className="ai-section__loading">
              <div className="ai-section__spinner" />
              <span>AI 分析中...</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="ai-section__error">
              <p>{error}</p>
              <button className="btn btn--small btn--primary" onClick={handleAnalyze}>重试</button>
            </div>
          )}

          {/* Result */}
          {result && !viewingHistory && (
            <div className="ai-result">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {result}
              </ReactMarkdown>
              <p className="ai-result__meta">
                分析时间：{new Date().toLocaleString('zh-CN')} ｜ 记录数：{records.length}条
              </p>
            </div>
          )}

          {/* History entry being viewed */}
          {viewingHistory && (
            <div className="ai-result">
              <div className="ai-section__back" onClick={handleBackToResult}>
                ← 返回
              </div>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {viewingHistory.result}
              </ReactMarkdown>
              <p className="ai-result__meta">
                {viewingHistory.user} ｜ {viewingHistory.dateFrom || '不限'} ~ {viewingHistory.dateTo || '不限'} ｜ {viewingHistory.recordCount}条
                <button
                  className="ai-result__del"
                  onClick={() => handleDeleteHistory(viewingHistory.id)}
                >
                  删除
                </button>
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
      )}
    </div>
  )
}
