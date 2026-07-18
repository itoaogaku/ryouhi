import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { Button, Select } from './ui/index.jsx'

// 画面上部のグローバル年月セレクタ
export default function MonthSelector() {
  const { year, month, setYear, setMonth } = useApp()

  const now = new Date()
  const years = []
  for (let y = now.getFullYear() - 2; y <= now.getFullYear() + 1; y++) {
    years.push(y)
  }

  const prev = () => {
    if (month === 1) {
      setYear(year - 1)
      setMonth(12)
    } else {
      setMonth(month - 1)
    }
  }
  const next = () => {
    if (month === 12) {
      setYear(year + 1)
      setMonth(1)
    } else {
      setMonth(month + 1)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" onClick={prev} aria-label="前月">
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <div className="flex items-center gap-1.5">
        <Select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="w-24"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}年
            </option>
          ))}
        </Select>
        <Select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="w-20"
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>
              {m}月
            </option>
          ))}
        </Select>
      </div>

      <Button variant="outline" size="icon" onClick={next} aria-label="翌月">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}
