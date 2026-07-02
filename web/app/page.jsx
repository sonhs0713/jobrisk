'use client'

import { useEffect, useRef, useState } from 'react'

import SiteFooter from '../components/SiteFooter'
import SiteHeader from '../components/SiteHeader'
import { allowedTemplates } from '../../shared/persuasionPolicy.js'
import { apiFetch } from '../lib/api'

const DRAFT_STORAGE_KEY = 'jobrisk:home-draft'
const PREVIEW_STORAGE_KEY = 'jobrisk:home-preview'

const criteriaGroups = [
  {
    title: '업무 구조',
    items: [
      { title: '반복 업무', text: '단순 처리로 끝나는지, 개선이나 자동화까지 맡는지 봅니다.' },
      { title: '의사결정 권한', text: '스스로 판단하고 우선순위를 정할 수 있는 역할인지 봅니다.' },
      { title: '업무 범위 명확성', text: '여러 업무가 섞여도 한 방향의 전문성이 남는지 봅니다.' },
    ],
  },
  {
    title: '경력 자산화',
    items: [
      { title: '성과 측정 가능성', text: '이력서와 면접에서 설명할 결과와 지표가 남는지 봅니다.' },
      { title: '시장성 있는 역량', text: '다른 회사에서도 인정받을 수 있는 경험이 쌓이는지 봅니다.' },
      { title: '난이도 상승 가능성', text: '시간이 갈수록 더 큰 문제와 책임으로 확장될 수 있는지 봅니다.' },
    ],
  },
  {
    title: '성장 시스템',
    items: [
      { title: '학습과 피드백 구조', text: '처리로 끝나는지, 결과를 보고 배우고 개선하는 구조가 있는지 봅니다.' },
    ],
  },
]

const heroFlow = [
  {
    label: '공고 문장',
    value: '“콘텐츠 제작, 채널 운영, 고객 응대, 정산 지원 등 브랜드 운영 전반 업무를 담당합니다.”',
  },
  {
    label: '잡리스크 해석',
    value: '반복 처리와 요청 대응 비중이 높을 수 있습니다. 다만 개선 권한과 성과 기준이 있다면 경력 자산이 될 수 있습니다.',
  },
  {
    label: '면접 질문',
    value: '반복 운영 업무와 개선기획 업무의 비중은 각각 어느 정도인가요?',
  },
]

const problemPhrases = ['전반적인 운영 업무', '다양한 업무를 유연하게 수행', '유관 부서 요청 대응']

const proofSteps = [
  {
    label: '공고 문장',
    value: '“콘텐츠 제작, 채널 운영, 고객 응대, 정산 지원 등 브랜드 운영 전반 업무를 담당합니다.”',
  },
  {
    label: '공고상 확인된 신호',
    value: '서로 다른 업무가 한 역할에 함께 적혀 있어 실제 전문성의 중심과 우선순위를 더 확인해야 할 수 있습니다.',
  },
  {
    label: '공고만으로 알 수 없는 부분',
    value: '각 업무의 실제 비중과, 이 역할이 직접 개선 책임을 지는 지표는 공고만으로는 분명하지 않습니다.',
  },
  {
    label: '면접 질문',
    value: '콘텐츠, 채널 운영, 고객 응대, 정산 지원 업무의 비중은 각각 어느 정도이며, 이 역할이 직접 개선 책임을 지는 핵심 지표는 무엇인가요?',
  },
]

const answerGuide = [
  {
    label: '긍정',
    value: '담당 KPI, 업무 비중, 개선 권한, 자동화나 프로세스 개선 계획을 구체적으로 설명합니다.',
    tone: 'safe',
  },
  {
    label: '애매',
    value: '상황에 따라 다르다거나, 팀 상황에 맞춰 유연하게 한다고만 설명합니다.',
    tone: 'warning',
  },
  {
    label: '위험',
    value: '요청받은 일을 빠르게 처리하는 것이 가장 중요하다고만 설명합니다.',
    tone: 'danger',
  },
]

const heroAnswerGuide = [
  { label: '긍정', value: 'KPI와 개선 권한을 구체적으로 설명합니다.', tone: 'safe' },
  { label: '애매', value: '상황에 따라 다릅니다처럼 역할 기준이 모호합니다.', tone: 'warning' },
  { label: '위험', value: '요청받은 일을 빠르게 처리하는 것만 강조합니다.', tone: 'danger' },
]

const sampleJobPosting = `콘텐츠 제작, 채널 운영, 고객 응대, 정산 지원 등 브랜드 운영 전반 업무를 담당합니다.
유관 부서와 협업하여 필요한 운영 업무를 지원합니다.
다양한 업무를 유연하게 수행할 수 있는 분을 찾습니다.`

const premiumRows = [
  { title: '무료에서 먼저 보는 것', points: allowedTemplates.preview.freeItems },
  { title: '유료에서 더 보는 것', points: allowedTemplates.preview.paidItems },
]

const comparisonRows = [
  {
    generic: '질문에 따라 결과 범위가 달라질 수 있습니다.',
    jobrisk: '7가지 기준으로 일관되게 검토합니다.',
  },
  {
    generic: '요약과 의견 중심으로 끝나기 쉽습니다.',
    jobrisk: '공고 원문, 해석, 불확실성을 분리해서 보여줍니다.',
  },
  {
    generic: '면접 질문 제시에 머무르기 쉽습니다.',
    jobrisk: '답변의 긍정, 애매, 위험 신호까지 정리합니다.',
  },
  {
    generic: '분석 결과가 행동 결정으로 이어지지 않을 수 있습니다.',
    jobrisk: '지원, 면접, 계약 전 무엇을 다시 확인할지 연결합니다.',
  },
]

function trackFreeResultViewed({ analysisId = '', riskLevel = '', riskLevelLabel = '' }) {
  if (typeof window === 'undefined') return
  if (typeof window.fbq !== 'function') return

  window.fbq('trackCustom', 'FreeResultViewed', {
    analysis_id: String(analysisId || ''),
    risk_level: String(riskLevel || ''),
    risk_level_label: String(riskLevelLabel || ''),
  })
}

function trackFreeResultViewContent({ analysisId = '', riskLevel = '', riskLevelLabel = '' }) {
  if (typeof window === 'undefined') return
  if (typeof window.fbq !== 'function') return

  window.fbq('track', 'ViewContent', {
    content_name: 'jobrisk_free_result',
    content_category: 'free_analysis_result',
    content_ids: [String(analysisId || '')],
    status: String(riskLevel || ''),
    content_type: String(riskLevelLabel || ''),
  })
}

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
  const pendingTrackedAnalysisIdRef = useRef(null)
  const [jobText, setJobText] = useState('')
  const [jobTextLength, setJobTextLength] = useState(0)
  const [email, setEmail] = useState('')
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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

  useEffect(() => {
    const analysisId = String(preview?.analysisId || '').trim()
    if (!analysisId || !preview?.freePreview) return
    if (pendingTrackedAnalysisIdRef.current !== analysisId) return

    trackFreeResultViewed({
      analysisId,
      riskLevel: preview.freePreview.riskLevel,
      riskLevelLabel: preview.freePreview.riskLevelLabel,
    })
    trackFreeResultViewContent({
      analysisId,
      riskLevel: preview.freePreview.riskLevel,
      riskLevelLabel: preview.freePreview.riskLevelLabel,
    })
    pendingTrackedAnalysisIdRef.current = null
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
      pendingTrackedAnalysisIdRef.current = String(data?.analysisId || '').trim() || null
      setPreview(data)
    } catch (err) {
      pendingTrackedAnalysisIdRef.current = null
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

  function loadSamplePosting() {
    setJobText(sampleJobPosting)
    setJobTextLength(sampleJobPosting.trim().length)
    setError('')
    requestAnimationFrame(() => {
      if (jobTextRef.current) jobTextRef.current.focus()
    })
  }

  const analysisInputCard = (
    <div className="analysis-input-card">
      <label className="field-label" htmlFor="job-posting">
        채용공고 원문
      </label>
      <p className="field-help">지원하려는 공고의 주요 업무, 자격요건, 우대사항을 그대로 붙여 넣어 주세요.</p>
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
            '내 공고 무료 점검하기'
          )}
        </button>
        <span>무료 결과: 핵심 근거 1개 · 확인 질문 1개</span>
      </div>
      <button className="input-link-button" type="button" onClick={loadSamplePosting}>
        예시 공고 불러오기
      </button>
      <p className="trust-note">회사 평판, 조직문화, 야근 여부를 단정하지 않습니다. 공고에서 확인된 신호와 면접에서 확인할 내용을 구분합니다.</p>
      {loadingStatus ? <p className="loading-note">{loadingStatus}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
    </div>
  )

  return (
    <>
      <SiteHeader variant="landing" />
      <main className="landing-page">
        <section className="landing-hero" id="top">
          <div className="landing-shell landing-hero-grid">
            <div className="landing-hero-copy">
              <p className="eyebrow">스타트업 · 중소기업 · 초기 조직 공고 점검</p>
              <h1>
                <span>이 공고,</span>
                <span>1년 뒤에도 이력서에 남을 일인지 먼저 확인하세요.</span>
              </h1>
              <p className="tagline">
                스타트업과 중소기업의 모호한 채용공고 문장을 근거로, 면접에서 확인할 질문과 답변 판단 기준을 정리합니다.
              </p>
              <p className="hero-trust-copy">
                회사를 좋고 나쁘다고 판정하지 않습니다. 공고에서 확인된 사실과 면접에서 확인할 내용을 구분합니다.
              </p>
              <div className="hero-cta-block">
                <a className="button-primary hero-primary-cta" href="#analyze">
                  내 공고 무료 점검하기
                </a>
                <p className="hero-cta-note">무료 결과: 공고 근거 1개 · 확인 질문 1개</p>
              </div>
            </div>

            <aside className="hero-report-card" id="example" aria-label="검증 흐름 예시">
              <div className="hero-report-header">
                <span className="result-pill tone-warning">익명화된 예시</span>
                <h2>공고 문장을 면접 검증 기준으로 바꿉니다</h2>
                <p>특정 회사를 평가하지 않고, 공고 문장을 해석과 질문과 답변 판단 기준으로 나눠 보여줍니다.</p>
              </div>

              <div className="hero-report-list">
                {heroFlow.map((item) => (
                  <div className="hero-report-row" key={item.label}>
                    <strong>{item.label}</strong>
                    <p>{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="hero-answer-guide">
                <strong>답변 판단 기준</strong>
                <div className="hero-answer-list">
                  {heroAnswerGuide.map((item) => (
                    <div className={`hero-answer-item tone-${item.tone}`} key={item.label}>
                      <span>{item.label}</span>
                      <p>{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section className="landing-section landing-section-problem">
          <div className="landing-shell problem-section">
            <div className="section-intro">
              <p className="eyebrow">왜 이런 확인이 필요한가</p>
              <h2>
                <span>공고에는 좋은 말이 많습니다.</span>
                <span>문제는 그 말이 실제 역할을 설명하지 않을 때입니다.</span>
              </h2>
              <p className="tagline">
                이런 표현이 나쁜 신호라는 뜻은 아닙니다. 다만 실제 업무 비중, 성과 기준, 개선 권한은 면접에서 더 확인해야 할 수 있습니다.
              </p>
            </div>

            <div className="problem-quote-card">
              {problemPhrases.map((phrase) => (
                <p key={phrase}>{phrase}</p>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-section landing-section-soft" id="analyze">
          <div className="landing-shell analyze-section">
            <div className="section-intro">
              <p className="eyebrow">무료 공고 점검</p>
              <h2>
                <span>공고를 요약하지 않습니다.</span>
                <span>먼저 다시 확인해야 할 포인트를 찾습니다.</span>
              </h2>
              <p className="tagline">무료 결과에서는 가장 강한 확인 포인트와 면접 질문 1개를 짧게 보여줍니다.</p>
            </div>
            {analysisInputCard}
          </div>
        </section>

        <section className="landing-section">
          <div className="landing-shell proof-section">
            <div className="section-intro">
              <p className="eyebrow">제품 핵심 증명</p>
              <h2>
                <span>한 문장을 끝까지 검증해야</span>
                <span>실제 역할이 보입니다</span>
              </h2>
              <p className="tagline">운영성 문장이 보여도 바로 위험으로 단정하지 않고, 추가 확인이 필요한 지점을 분리합니다.</p>
            </div>

            <div className="proof-card">
              <div className="proof-grid">
                {proofSteps.map((item) => (
                  <div className="proof-row" key={item.label}>
                    <strong>{item.label}</strong>
                    <p>{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="proof-answer-guide">
                <strong>답변 판단 기준</strong>
                <div className="paid-proof-stack">
                  {answerGuide.map((item) => (
                    <div className={`paid-proof-row tone-${item.tone}`} key={item.label}>
                      <strong>{item.label}</strong>
                      <p>{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-section landing-section-soft">
          <div className="landing-shell analysis-workbench">
            <div className="analysis-copy">
              <p className="eyebrow">범용 AI와의 차이</p>
              <h2>
                질문을 만들어 주는 것에서
                <br />
                끝나지 않습니다
              </h2>
              <p className="tagline">
                범용 AI는 질문에 답합니다. 잡리스크는 공고를 읽는 기준과 면접에서 검증하는 기준을 한 흐름으로 정리합니다.
              </p>

              <div className="compare-table-card">
                <div className="compare-table compare-table-head">
                  <strong>일반적인 공고 분석</strong>
                  <strong>잡리스크</strong>
                </div>
                {comparisonRows.map((row) => (
                  <div className="compare-table" key={row.generic}>
                    <p>{row.generic}</p>
                    <p>{row.jobrisk}</p>
                  </div>
                ))}
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
                    <p>무료에서는 왜 이 공고를 다시 확인해야 하는지 짧게 보여주고, 면접에서 물어볼 질문 방향을 잡아줍니다.</p>
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
                    <div className="analysis-preview-row">
                      <strong>한 줄 결론</strong>
                      <p>브랜드 운영 전반을 넓게 맡는 역할일 수 있어, 실제 업무 비중과 개선 책임을 추가 확인할 필요가 있습니다.</p>
                    </div>
                    <div className="analysis-preview-row">
                      <strong>공고 원문 근거</strong>
                      <p>“콘텐츠 제작, 채널 운영, 고객 응대, 정산 지원 등 브랜드 운영 전반 업무를 담당합니다.”</p>
                    </div>
                    <div className="analysis-preview-row">
                      <strong>면접 질문 방향</strong>
                      <p>브랜드 운영 업무 중 이 역할이 직접 책임지는 핵심 지표와 개선 권한은 어디까지인가요?</p>
                    </div>
                  </>
                )}
              </div>

              {freePreview ? (
                <div className="analysis-payment-card" id="pricing">
                  <div className="payment-copy">
                    <h3>상세 리포트 1회 3,000원</h3>
                    <p>면접 질문 5~7개, 답변 해석 기준, 최종 행동 가이드까지 더 구체적으로 확인할 수 있습니다.</p>
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
              ) : (
                <div className="analysis-payment-card" id="pricing">
                  <div className="payment-copy">
                    <h3>무료로 확인할 이유를 찾고, 상세 리포트로 판단 기준을 가져가세요</h3>
                    <p>무료는 왜 다시 확인해야 하는지를 보여주고, 상세 리포트는 면접 답변을 어떤 기준으로 판단할지 정리합니다.</p>
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

                  <div className="price-inline-note">
                    <strong>상세 리포트 1회 3,000원</strong>
                    <p>면접 질문 5~7개 · 답변 해석 기준 · 최종 행동 가이드</p>
                  </div>
                </div>
              )}
            </aside>
          </div>
        </section>

        <section className="landing-section" id="criteria">
          <div className="landing-shell criteria-section">
            <div className="section-intro">
              <p className="eyebrow">왜 이 결과를 믿을 수 있나요</p>
              <h2>
                <span>업무가 많아 보이는지보다</span>
                <span>성과와 권한이 남는 구조인지 먼저 봅니다</span>
              </h2>
              <p className="tagline">좋아 보이는 문장보다, 실제로 어떤 경험과 전문성이 남는지 7가지 기준으로 나눠 확인합니다.</p>
              <p className="criteria-note">잡리스크는 공고만으로 조직문화, 야근, 상사, 회사의 좋고 나쁨을 판정하지 않습니다.</p>
            </div>

            <div className="criteria-stack" aria-label="핵심 판단 기준">
              {criteriaGroups.map((group) => (
                <article className="criteria-group" key={group.title}>
                  <h3>{group.title}</h3>
                  <div className="criteria-group-list">
                    {group.items.map((item) => (
                      <div className="criteria-item" key={item.title}>
                        <strong>{item.title}</strong>
                        <p>{item.text}</p>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-section landing-section-final">
          <div className="landing-shell final-cta-card">
            <h2>
              <span>공고를 요약하지 않습니다</span>
              <span>지원 전에 확인할 질문과 기준을 정리합니다</span>
            </h2>
            <p className="tagline">모호한 공고 문장을 근거, 질문, 답변 해석 기준으로 바꿔 더 나은 지원 결정을 돕습니다.</p>
            <div className="cta-row">
              <a className="button-primary" href="#job-posting">
                내 공고 무료 점검하기
              </a>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
