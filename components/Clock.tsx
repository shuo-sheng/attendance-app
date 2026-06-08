import { useState, useEffect } from 'react'

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

export default function Clock() {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const y = now.getFullYear()
  const m = now.getMonth() + 1
  const d = now.getDate()
  const week = WEEKDAYS[now.getDay()]
  const h = String(now.getHours()).padStart(2, '0')
  const mi = String(now.getMinutes()).padStart(2, '0')
  const s = String(now.getSeconds()).padStart(2, '0')

  return (
    <div className="clock-display">
      {y}年{m}月{d}日 {week} {h}:{mi}:{s}
    </div>
  )
}
