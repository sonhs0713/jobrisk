'use client'

import { useEffect, useState } from 'react'

import styles from './rebuild.module.css'

const TYPING_INTERVAL_MS = 52

export default function HeroTypingTitle({ text, className = '' }) {
  const [visibleLength, setVisibleLength] = useState(0)
  const characters = Array.from(text)

  useEffect(() => {
    setVisibleLength(0)

    let index = 0

    const timer = window.setInterval(() => {
      index += 1
      setVisibleLength(index)

      if (index >= characters.length) {
        window.clearInterval(timer)
      }
    }, TYPING_INTERVAL_MS)

    return () => window.clearInterval(timer)
  }, [text])

  const visibleText = characters.slice(0, visibleLength).join('')
  const isComplete = visibleLength >= characters.length
  const visibleLines = visibleText.split('\n')

  return (
    <h1 className={className}>
      <span className={styles.typewriterText}>
        {visibleLines.map((line, index) => {
          const isLastLine = index === visibleLines.length - 1

          return (
            <span className={styles.typewriterLine} key={`${index}-${line}`}>
              {line}
              {isLastLine && !isComplete ? <span className={styles.typewriterCursor} aria-hidden="true" /> : null}
              {index < visibleLines.length - 1 ? <br /> : null}
            </span>
          )
        })}
      </span>
    </h1>
  )
}
