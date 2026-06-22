'use client'

import { useEffect, useRef, useState } from 'react'

import SiteFooter from '../components/SiteFooter'
import SiteHeader from '../components/SiteHeader'
import { allowedTemplates } from '../../shared/persuasionPolicy.js'
import { apiFetch } from '../lib/api'

const DRAFT_STORAGE_KEY = 'jobrisk:home-draft'
const PREVIEW_STORAGE_KEY = 'jobrisk:home-preview'

const criteria = [
  {
    title: '반복 업무',
    text: '단순 처리만 반복되는지, 개선이나 자동화까지 맡는지 먼저 봅니다.',
  },
  {
    title: '의사결정 권한',
    text: '실제로 스스로 판단하고 우선순위를 정할 수 있는 역할인지 확인합니다.',
  },
  {
    title: '성과 측정 가능성',
    text: '나중에 이력서와 면접에서 설명할 수 있는 결과와 지표가 남는지 봅니다.',
  },
  {
    title: '난이도 상승 가능성',
    text: '시간이 갈수록 더 큰 문제와 더 높은 책임으로 확장될 수 있는지 봅니다.',
  },
  {
    title: '시장성 있는 역량',
    text: '그 회사 안에서만 통하는 경험이 아니라 다른 회사에서도 인정받을 수 있는지 봅니다.',
  },
  {
    title: '업무 범위 명확성',
    text: '이것저것 섞인 역할인지, 아니면 한 방향의 전문성이 쌓이는 역할인지 봅니다.',
  },
  {
    title: '학습과 피드백 구조',
    text: '시킨 일을 처리하는 데서 끝나는지, 결과를 보고 배우고 개선하는 구조가 있는지 봅니다.',
  },
]

const heroSignals = [
  {
    label: '위험 신호',
    value: '전략기획처럼 보여도 실제로는 운영 지원 비중이 더 클 수 있습니다.',
  },
  {
    label: '가장 강한 근거',
    value: '성과 기준과 의사결정 권한이 공고에서 구체적으로 드러나지 않습니다.',
  },
  {
    label: '면접 확인 질문',
    value: '이 역할이 직접 책임지는 KPI는 무엇인가요?',
  },
]

const exampleSignals = [
  {
    label: '위험 신호',
    value: '지표 기반 기획처럼 보여도 실제 권한과 책임 범위는 추가 확인이 필요합니다.',
  },
  {
    label: '가장 강한 근거',
    value: '성과 기준은 보이지만, 누가 무엇을 직접 결정하는지는 공고만으로 충분하지 않습니다.',
  },
  {
    label: '면접 확인 질문',
    value: '이 역할이 직접 책임지는 목표와 KPI는 무엇인가요?',
  },
]

const premiumRows = [
  { title: '무료에서 먼저 보는 것', points: allowedTemplates.preview.freeItems },
  { title: '유료에서 더 보는 것', points: allowedTemplates.preview.paidItems },
]

function getPreviewTone(level = '', label = '') {
  const normalized = String(level).toLowerCase()
  const normalizedLabel = String(label)

  if (normalized === 'high' || normalizedLabel.includes('보류') || normalizedLabel.includes('위험')) return 'danger'
  if (normalized === 'low') return 'safe'
  if (normalized === 'insufficient_info' || normalizedLabel.includes('정보 부족')) return 'neutral'
  if (normalized === 'needs_review' || normalized === 'medium') return 'warning'
  return 'warning'
}

function normalizePreviewText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/["'“”‘’.,!?():;/\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function arePreviewTextsNearDuplicate(a, b) {
  const left = normalizePreviewText(a)
  const right = normalizePreviewText(b)
  if (!left || !right) return false
  if (left === right) return true
  if (left.includes(right) || right.includes(left)) return true

  const leftTokens = new Set(left.split(' ').filter(Boolean))
  const rightTokens = new Set(right.split(' ').filter(Boolean))
  if (!leftTokens.size || !rightTokens.size) return false

  let overlap = 0
  for (const token of leftTokens) {
    if (rightTokens.has(token)) overlap += 1
  }
  return overlap / Math.max(leftTokens.size, rightTokens.size) >= 0.8
}

function isValidEmail(value) {
  const normalized = String(value || '').trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
}

export default function HomePage() {
  const jobTextRef = useRef(null)
  const [jobText, setJobText] = useState('')
  const [jobTextLength, setJobTextLength] = useState(0)
  const [email, setEmail] = useState('')
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const trimmedJobTextLength = Math.max(jobTextLength, jobText.trim().length, jobTextRef.current?.value?.trim().length || 0)
  const rawFreePreview = preview?.freePreview
  const freePreview = rawFreePreview || null
  const previewTone = getPreviewTone(freePreview?.riskLevel, freePreview?.riskLevelLabel)
  const loadingStatus = loading ? '공고를 읽고 위험 신호를 정리하는 중입니다.' : ''
  const normalizedEmail = email.trim()
  const emailError =
    !freePreview || !normalizedEmail
      ? ''
      : isValidEmail(normalizedEmail)
        ? ''
        : '올바른 이메일 주소를 입력해 주세요.'
  const canStartPayment = Boolean(preview?.analysisId) && Boolean(normalizedEmail) && !emailError

  useEffect(() => {
    try {
      const savedDraft =
        window.sessionStorage.getItem(DRAFT_STORAGE_KEY) || window.localStorage.getItem(DRAFT_STORAGE_KEY)
      const savedPreview =
        window.sessionStorage.getItem(PREVIEW_STORAGE_KEY) || window.localStorage.getItem(PREVIEW_STORAGE_KEY)

      if (savedDraft) {
        const draft = JSON.parse(savedDraft)
        setJobText(typeof draft.jobText === 'string' ? draft.jobText : '')
        setJobTextLength(typeof draft.jobText === 'string' ? draft.jobText.trim().length : 0)
        setEmail(typeof draft.email === 'string' ? draft.email : '')
      }

      if (savedPreview) {
        setPreview(JSON.parse(savedPreview))
      }
    } catch {
      window.sessionStorage.removeItem(DRAFT_STORAGE_KEY)
      window.sessionStorage.removeItem(PREVIEW_STORAGE_KEY)
      window.localStorage.removeItem(DRAFT_STORAGE_KEY)
      window.localStorage.removeItem(PREVIEW_STORAGE_KEY)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const serialized = JSON.stringify({ jobText, email })
    window.sessionStorage.setItem(DRAFT_STORAGE_KEY, serialized)
    window.localStorage.setItem(DRAFT_STORAGE_KEY, serialized)
  }, [jobText, email])

  useEffect(() => {
    const textarea = jobTextRef.current
    if (!textarea) return

    const syncLength = () => {
      const nextValue = textarea.value || ''
      setJobTextLength(nextValue.trim().length)
      setJobText(nextValue)
    }

    syncLength()
    textarea.addEventListener('input', syncLength)
    return () => textarea.removeEventListener('input', syncLength)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (preview) {
      const serialized = JSON.stringify(preview)
      window.sessionStorage.setItem(PREVIEW_STORAGE_KEY, serialized)
      window.localStorage.setItem(PREVIEW_STORAGE_KEY, serialized)
      return
    }
    window.sessionStorage.removeItem(PREVIEW_STORAGE_KEY)
    window.localStorage.removeItem(PREVIEW_STORAGE_KEY)
  }, [preview])

  async function handlePreview() {
    const currentJobText = jobTextRef.current?.value || jobText
    if (currentJobText !== jobText) {
      setJobText(currentJobText)
    }

    if (currentJobText.trim().length < 40) {
      setError('채용공고를 40자 이상 붙여 넣어 주세요.')
      return
    }

    setError('')
    setLoading(true)

    try {
      const data = await apiFetch('/api/analyze/preview', {
        method: 'POST',
        body: JSON.stringify({ jobPostingText: currentJobText }),
      })
      setPreview(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const priceLabel =
    preview?.price?.amount != null
      ? `${preview.price.amount.toLocaleString('ko-KR')}원으로 상세 리포트 보기`
      : '유료 상세 리포트 보기'

  const checkoutParams = new URLSearchParams({
    analysisId: preview?.analysisId || '',
    email,
  })
  const paymentHref = `/checkout?${checkoutParams.toString()}`

  return (
    <>
      <SiteHeader variant="landing" />
      <div className="site-banner" role="note" aria-label="얼리버드 안내">
        <p>프리토타입 얼리버드 진행 중 · 상세 리포트 1회 3,000원 · 얼리버드 구매자 추가 리포트 혜택 제공</p>
      </div>
      <main className="landing-page">
        <section className="landing-hero" id="top">
          <div className="landing-shell landing-hero-grid">
            <div className="landing-hero-copy">
              <p className="eyebrow">입사 전 진단 리포트</p>
              <h1>
                <span>좋아 보이는 공고라도</span>
                <span>입사 전에 한 번 더 걸러보세요</span>
              </h1>
              <p className="tagline">
                공고 속 애매한 표현을 면접에서 확인할 질문으로 바꿔드립니다.
              </p>
              <div className="cta-row">
                <a className="button-primary" href="#analyze">
                  무료로 위험 신호 확인하기
                </a>
              </div>
            </div>

            <aside className="hero-report-card" aria-label="짧은 분석 예시">
              <div className="hero-report-header">
                <span className="result-pill tone-warning">추가 확인 필요</span>
                <h2>무료 결과 미리보기</h2>
                <p>지원 전에 먼저 보게 될 핵심만 짧게 담았습니다.</p>
              </div>

              <div className="hero-report-list">
                {heroSignals.map((item) => (
                  <div className="hero-report-row" key={item.label}>
                    <strong>{item.label}</strong>
                    <p>{item.value}</p>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>

        <section className="landing-section landing-section-soft" id="analyze">
          <div className="landing-shell analysis-workbench">
            <div className="analysis-copy">
              <p className="eyebrow">무료 진단</p>
              <h2>
                채용공고를 붙여 넣고
                <br />
                무료 위험 신호부터
                <br />
                먼저 확인하세요
              </h2>
              <p className="tagline">
                한 줄 결론, 가장 강한 근거,
                <br />
                확인 질문까지 무료로 먼저 봅니다.
              </p>

              <div className="analysis-input-card">
                <label className="field-label" htmlFor="job-posting">
                  채용공고 원문
                </label>
                <p className="field-help">주요 업무, 자격요건, 우대사항처럼 보이는 문장을 그대로 붙여 넣어 주세요.</p>
                <textarea
                  ref={jobTextRef}
                  id="job-posting"
                  value={jobText}
                  onChange={(event) => setJobText(event.target.value)}
                  onInput={(event) => setJobText(event.currentTarget.value)}
                  placeholder="채용공고 내용을 그대로 붙여 넣어 주세요."
                />

                <div className="form-actions form-actions-briefing">
                  <button className="button-primary" onClick={handlePreview} disabled={loading}>
                    {loading ? (
                      <>
                        <span className="inline-spinner" aria-hidden="true" />
                        <span>진단 중...</span>
                      </>
                    ) : (
                      '무료로 위험 신호 확인하기'
                    )}
                  </button>
                  <span>채용공고를 40자 이상 넣으면 무료 진단을 시작할 수 있습니다.</span>
                </div>
                {loadingStatus ? <p className="loading-note">{loadingStatus}</p> : null}

                <p className="hint-text hint-text-compact">{trimmedJobTextLength} / 40</p>
                {error ? <p className="error-text">{error}</p> : null}
              </div>
            </div>

            <aside
              className="analysis-preview-card"
              id="preview-example"
              aria-label={freePreview ? '현재 공고 기준 무료 분석 결과' : '예시 무료 분석 결과'}
              aria-live="polite"
            >
              <div className="analysis-preview-header">
                <p className="eyebrow">{freePreview ? '현재 공고 기준 분석 결과' : '예시 결과'}</p>
                {freePreview ? (
                  <>
                    <span className={`result-pill tone-${previewTone}`}>{freePreview.riskLevelLabel}</span>
                    <h3>{freePreview.headline}</h3>
                    <p>{freePreview.topEvidence?.interpretation || '공고에서 반복 처리와 권한 범위가 함께 보이면 추가 확인이 필요합니다.'}</p>
                  </>
                ) : (
                  <>
                    <span className="result-pill tone-warning">추가 확인 필요</span>
                    <h3>무료 결과 예시</h3>
                    <p>무료에서는 위험 신호와 질문 방향만 짧게 보여줘, 지원 전에 다시 확인할 포인트를 빠르게 잡게 합니다.</p>
                  </>
                )}
              </div>

              <div className="analysis-preview-stack">
                {freePreview ? (
                  <>
                    {!!(freePreview.shortReasons || [])[0] && (
                      <div className="analysis-preview-row">
                        <strong>짧은 확인 포인트</strong>
                        <p>{freePreview.shortReasons[0]}</p>
                      </div>
                    )}
                    <div className="analysis-preview-row">
                      <strong>면접 질문 방향</strong>
                      <p>{freePreview.verificationQuestion}</p>
                    </div>
                  </>
                ) : (
                  <>
                    {exampleSignals.map((item) => (
                      <div className="analysis-preview-row" key={item.label}>
                        <strong>{item.label}</strong>
                        <p>{item.value}</p>
                      </div>
                    ))}
                  </>
                )}
              </div>

              {freePreview ? (
                <div className="analysis-payment-card" id="pricing">
                  <div className="payment-copy">
                    <h3>{allowedTemplates.preview.sectionTitle}</h3>
                    <p>유료 상세 리포트에서는 면접에서 바로 써먹을 질문, 답변 해석 기준, 행동 가이드까지 더 구체적으로 확인할 수 있습니다.</p>
                  </div>

                  <div className="briefing-compare briefing-compare-split briefing-compare-doc">
                    {premiumRows.map((item) => (
                      <article className="briefing-compare-column" key={item.title}>
                        <h3>{item.title}</h3>
                        <ul className="briefing-bullets">
                          {item.points.map((point) => (
                            <li key={point}>{point}</li>
                          ))}
                        </ul>
                      </article>
                    ))}
                  </div>

                  <div className="earlybird-note-card">
                    <strong>얼리버드 안내</strong>
                    <p>현재는 정식 출시 전 프리토타입입니다. 얼리버드 가격 3,000원으로 상세 리포트를 제공하며, 초기 구매자 피드백을 반영해 제품을 개선하고 있습니다.</p>
                    <p>지금 얼리버드로 결제하면 정식 출시 후 추가 리포트 혜택을 드립니다.</p>
                  </div>
                  <div className="payment-email-block">
                    <label className="field-label payment-email-label" htmlFor="customer-email">
                      정식 서비스 출시 시 연락 받을 이메일 주소를 입력해주세요.
                    </label>
                    <input
                      id="customer-email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="이메일을 입력하세요"
                      aria-invalid={emailError ? 'true' : undefined}
                    />
                    {emailError ? <p className="error-text">{emailError}</p> : null}
                    {!normalizedEmail ? <p className="payment-email-note">이메일을 입력해야 결제를 진행할 수 있습니다.</p> : null}
                  </div>
                  <a
                    className="button-primary full"
                    href={canStartPayment ? paymentHref : '#pricing'}
                    aria-disabled={canStartPayment ? undefined : 'true'}
                    onClick={(event) => {
                      if (canStartPayment) return
                      event.preventDefault()
                    }}
                  >
                    {priceLabel}
                  </a>
                </div>
              ) : null}
            </aside>
          </div>
        </section>

        <section className="landing-section" id="criteria">
          <div className="landing-shell criteria-section">
            <div className="section-intro">
              <p className="eyebrow">먼저 보는 기준</p>
              <h2>
                <span>잡리스크는</span>
                <span>7가지 신호를 먼저 봅니다</span>
              </h2>
              <p className="tagline">좋아 보이는 문장보다, 실제로 어떤 경험이 남는지 기준별로 먼저 따져봅니다.</p>
            </div>

            <div className="criteria-stack" aria-label="핵심 판단 기준">
              {criteria.map((item, index) => (
                <article className="criteria-item" key={item.title}>
                  <span className="criteria-index">{String(index + 1).padStart(2, '0')}</span>
                  <div className="criteria-body">
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-section landing-section-final">
          <div className="landing-shell final-cta-card">
            <h2>
              <span>좋아 보이는 공고라도</span>
              <span>지원 전에 한 번 더 걸러보세요</span>
            </h2>
            <p className="tagline">좋아 보이는 표현보다 실제 역할과 면접 질문을 먼저 확인해 보세요.</p>
            <div className="cta-row">
              <a className="button-primary" href="#analyze">
                무료로 위험 신호 확인하기
              </a>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
