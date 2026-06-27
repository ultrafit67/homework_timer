import { useState, useMemo } from 'react'
import kudosImg from '../kudos.jpg'

const QUOTES = [
  '书山有路勤为径，学海无涯… 要不先睡一觉？',
  '今日不读书，明日… 还是可以读书的。',
  '学而不思则罔，思而不学则… 打开手机看看。',
  '少壮不努力，老大… 依然在背单词。',
  '读书破万卷，下笔… 打开 ChatGPT。',
  '天将降大任于是人也，必先… 刷完这条短视频。',
  '吾生也有涯，而知也无涯… 所以先玩一会儿。',
  '温故而知新… 新的还没看，旧的已忘光。',
  '一年之计在于春，一日之计在于… 再睡五分钟。',
  '只要学不死，就往死里学… 然后发现已经学死了。',
  '知识就是力量… 但没有 Wi-Fi，什么力量都没有。',
  '学海无涯回头是岸，但你已经游出去很远了。',
  '我生待明日，万事成蹉跎… 所以今天先不学了。',
  '宝剑锋从磨砺出，梅花香自苦寒来… 而你，直接从被窝来。',
]

export function KudosButton() {
  const [open, setOpen] = useState(false)
  const quote = useMemo(() => QUOTES[Math.floor(Math.random() * QUOTES.length)], [open])

  return (
    <>
      <button className="kudos-btn" onClick={() => setOpen(true)} title="赞赏">
        加个鸡腿
      </button>
      {open && (
        <div className="dialog-overlay" onClick={() => setOpen(false)}>
          <div className="dialog dialog--kudos" onClick={e => e.stopPropagation()}>
            <h3 className="dialog__title">加个鸡腿</h3>
            <div className="dialog__body kudos-body">
              <img src={kudosImg} alt="赞赏码" className="kudos-body__img" />
              <p className="kudos-body__quote">{quote}</p>
            </div>
            <div className="dialog__actions">
              <button className="btn btn--primary" onClick={() => setOpen(false)}>收了神通</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
