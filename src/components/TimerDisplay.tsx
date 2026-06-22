interface TimerDisplayProps {
  time: string
  isRunning: boolean
}

export function TimerDisplay({ time, isRunning }: TimerDisplayProps) {
  return (
    <div className={`timer-display ${isRunning ? 'timer-display--running' : ''}`}>
      <div className="timer-display__time">{time}</div>
      <div className="timer-display__label">
        {isRunning ? '计时中...' : '准备就绪'}
      </div>
    </div>
  )
}
