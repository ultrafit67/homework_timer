interface TimerDisplayProps {
  time: string
  isRunning: boolean
  isPaused?: boolean
}

export function TimerDisplay({ time, isRunning, isPaused }: TimerDisplayProps) {
  const cls = [
    'timer-display',
    isRunning ? 'timer-display--running' : '',
    isPaused ? 'timer-display--paused' : ''
  ].filter(Boolean).join(' ')

  const label = isPaused ? '已暂停' : isRunning ? '计时中...' : '准备就绪'

  return (
    <div className={cls}>
      <div className="timer-display__time">{time}</div>
      <div className="timer-display__label">{label}</div>
    </div>
  )
}
