'use client'

import { useEffect, useRef, useState } from 'react'

export default function RevealSection({
  as: Tag = 'section',
  className,
  id,
  children,
  initialVisible = false,
  ...rest
}) {
  const ref = useRef(null)
  const [isVisible, setIsVisible] = useState(initialVisible)

  useEffect(() => {
    const element = ref.current

    if (!element || initialVisible) {
      return
    }

    if (typeof window === 'undefined') {
      setIsVisible(true)
      return
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      setIsVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          return
        }

        setIsVisible(true)
        observer.unobserve(entry.target)
      },
      {
        threshold: 0.18,
        rootMargin: '0px 0px -12% 0px',
      }
    )

    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [initialVisible])

  return (
    <Tag
      ref={ref}
      className={className}
      data-reveal-section=""
      data-visible={isVisible ? 'true' : 'false'}
      id={id}
      {...rest}
    >
      {children}
    </Tag>
  )
}
