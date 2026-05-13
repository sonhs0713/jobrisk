import { useEffect, useMemo, useRef, useState } from 'react'
import Footer from './components/Footer'
import FAQ from './components/FAQ'
import { requestEarlyBirdPayment } from './lib/portonePayment'

const DEFAULT_ANALYSIS_TAGS = ['물경력']

const EXCLUDED_AVOID_RISK_TAGS = new Set(['복지 과장', '출퇴근/근무 방식 불일치'])

const EARLYBIRD_TAGS_KEY = 'earlybird_avoid_risk_tags'

function readStoredAvoidRiskTags() {
  // 프리토타입: API는 물경력 축만 사용. 과거 세션의 다중 태그는 노출·전송하지 않음.
  return [...DEFAULT_ANALYSIS_TAGS]
}

async function fetchPreviewAnalyzeApi(jobPostingText, avoidRiskTags = DEFAULT_ANALYSIS_TAGS) {
  const response = await fetch('/api/preview/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      jobPostingText: String(jobPostingText || '').trim(),
      avoidRiskTags: avoidRiskTags.filter((t) => !EXCLUDED_AVOID_RISK_TAGS.has(t)),
    }),
  })
  const data = await response.json()
  if (!response.ok || !data?.ok || !data?.result) {
    throw new Error('preview_failed')
  }
  return data.result
}

function buildFallbackPreviewEmail() {
  return `preview-user-${Date.now()}@jobrisk.local`
}

function toEvidenceText(e) {
  if (!e) return ''
  if (typeof e === 'string') return e
  if (typeof e === 'object' && 'text' in e) return String(e.text || '')
  return ''
}

function toEvidenceSourceType(e) {
  if (e && typeof e === 'object' && 'sourceType' in e) return String(e.sourceType || '')
  return ''
}

function levelLabel(level) {
  if (level === 'high') return '높음'
  if (level === 'medium') return '중간'
  if (level === 'low') return '낮음'
  return '추가 확인 필요'
}

function levelHelp(level) {
  if (level === 'high') return '공고 근거상 물경력 가능성을 더 의식해 볼 만함'
  if (level === 'medium') return '일부 단서가 있으나 추가 확인이 필요함'
  if (level === 'low') return '현재 공고 기준으로는 물경력 신호가 크지 않음'
  return '공고만으로는 판단 근거가 부족함'
}

function toFirstSentence(text) {
  const s = String(text || '').trim()
  if (!s) return ''
  const idx = s.indexOf('. ')
  if (idx !== -1) return s.slice(0, idx + 1)
  const idx2 = s.indexOf('다.')
  if (idx2 !== -1 && idx2 < 120) return s.slice(0, idx2 + 2)
  return s.length > 120 ? `${s.slice(0, 120)}…` : s
}

function agentDebugLog({ runId, hypothesisId, location, message, data }) {
  // #region agent log
  fetch('http://127.0.0.1:7579/ingest/be5faab1-4bf7-4191-81cc-c89d7a00a55b', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'dc5642' },
    body: JSON.stringify({
      sessionId: 'dc5642',
      runId,
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {})
  // #endregion
}

function App() {
  const [isPaying, setIsPaying] = useState(false)
  const [jobPostingText, setJobPostingText] = useState('')
  const [isPreviewVisible, setIsPreviewVisible] = useState(false)
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [paymentSuccessMessage, setPaymentSuccessMessage] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewResult, setPreviewResult] = useState(null)
  const [contactSubmitted, setContactSubmitted] = useState(false)
  const [isContactSubmitting, setIsContactSubmitting] = useState(false)
  const [contactErrorMessage, setContactErrorMessage] = useState('')
  const [jobSubmitError, setJobSubmitError] = useState('')
  const resultSectionRef = useRef(null)

  const jobFormErrors = useMemo(() => {
    const errors = {
      jobPostingText: '',
    }

    if (!jobPostingText.trim()) {
      errors.jobPostingText = '채용공고 텍스트를 입력해주세요.'
    }

    return errors
  }, [jobPostingText])

  const isJobFormValid = !jobFormErrors.jobPostingText

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const unlockedParam = params.get('unlocked')
    const unlockedFlag = sessionStorage.getItem('earlybird_unlocked')

    if (unlockedParam === '1' || unlockedFlag === '1') {
      setIsUnlocked(true)
      setIsPreviewVisible(true)
      setPaymentSuccessMessage('결제가 완료되어 물경력 상세 분석이 열렸어요. 아래에서 바로 확인할 수 있어요.')
      sessionStorage.removeItem('earlybird_unlocked')
      setTimeout(() => {
        resultSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 0)

      const storedJob = sessionStorage.getItem('earlybird_job_posting_text') || ''
      const storedTags = readStoredAvoidRiskTags()
      const filteredTags = storedTags.filter((t) => !EXCLUDED_AVOID_RISK_TAGS.has(t))
      const tagsForPreview = filteredTags.length > 0 ? filteredTags : DEFAULT_ANALYSIS_TAGS

      if (storedJob.trim()) {
        setJobPostingText(storedJob.trim())
        setPreviewLoading(true)
        setPreviewResult(null)
        ;(async () => {
          try {
            agentDebugLog({
              runId: 'post-pay',
              hypothesisId: 'H1',
              location: 'src/App.jsx:unlock_restore_preview',
              message: 'Restoring preview after payment return',
              data: {
                path: '/api/preview/analyze',
                jobPostingTextLen: storedJob.trim().length,
                avoidRiskTagsCount: tagsForPreview.length,
              },
            })
            const result = await fetchPreviewAnalyzeApi(storedJob, tagsForPreview)
            setPreviewResult(result)
          } catch {
            agentDebugLog({
              runId: 'post-pay',
              hypothesisId: 'H2',
              location: 'src/App.jsx:unlock_restore_preview_catch',
              message: 'Preview restore after payment failed',
              data: {},
            })
            setPreviewResult(null)
          } finally {
            setPreviewLoading(false)
          }
        })()
      }
    }
  }, [])

  const handleJobFormPreview = (event) => {
    event.preventDefault()
    setJobSubmitError('')

    if (!isJobFormValid) return

    setIsPreviewVisible(true)
    setPaymentSuccessMessage('')
    setPreviewLoading(true)
    setPreviewResult(null)
    setTimeout(() => {
      resultSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 0)

    ;(async () => {
      try {
        agentDebugLog({
          runId: 'pre-fix',
          hypothesisId: 'H1',
          location: 'src/App.jsx:pre_fetch_preview',
          message: 'Preview analyze fetch starting',
          data: {
            path: '/api/preview/analyze',
            jobPostingTextLen: jobPostingText.trim().length,
            avoidRiskTagsCount: DEFAULT_ANALYSIS_TAGS.length,
          },
        })
        const result = await fetchPreviewAnalyzeApi(jobPostingText)
        agentDebugLog({
          runId: 'pre-fix',
          hypothesisId: 'H1',
          location: 'src/App.jsx:post_fetch_preview',
          message: 'Preview analyze fetch completed',
          data: { ok: true },
        })
        setPreviewResult(result)
      } catch {
        agentDebugLog({
          runId: 'pre-fix',
          hypothesisId: 'H2',
          location: 'src/App.jsx:catch_preview',
          message: 'Preview analyze failed (caught)',
          data: {},
        })
        // 내부 오류는 노출하지 않고, 화면에는 fallback 결과가 없을 경우만 안내
        setPreviewResult(null)
      } finally {
        setPreviewLoading(false)
      }
    })()
  }

  const handleStartPayment = async () => {
    setJobSubmitError('')

    if (!isJobFormValid) return

    const mappedAdditionalRequest = '분석 기준: 물경력 가능성 (프리토타입)'

    // TODO: 결제 전 이메일은 필수로 받지 않습니다. 결제 후 옵션으로 이메일 전달을 제공합니다.
    const customerEmailForPayment = buildFallbackPreviewEmail()

    sessionStorage.setItem('earlybird_job_posting_text', jobPostingText.trim())
    sessionStorage.setItem(EARLYBIRD_TAGS_KEY, JSON.stringify(DEFAULT_ANALYSIS_TAGS))
    sessionStorage.setItem('earlybird_additional_request', mappedAdditionalRequest)
    sessionStorage.setItem('earlybird_customer_email', customerEmailForPayment)

    try {
      setIsPaying(true)
      await requestEarlyBirdPayment(customerEmailForPayment)
    } catch (error) {
      setJobSubmitError(error?.message || '결제 진행 중 오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setIsPaying(false)
    }
  }

  const handleContactSubmit = async (event) => {
    event.preventDefault()

    const endpoint =
      import.meta.env.VITE_FORMSPREE_CONTACT_ENDPOINT || import.meta.env.VITE_FORMSPREE_ENDPOINT
    if (!endpoint) {
      setContactErrorMessage(
        '문의 전송 설정이 없습니다. .env.local에 VITE_FORMSPREE_ENDPOINT를 설정한 뒤 서버를 다시 실행해주세요.',
      )
      return
    }

    const formData = new FormData(event.currentTarget)

    try {
      setIsContactSubmitting(true)
      setContactErrorMessage('')

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
        body: formData,
      })

      if (!response.ok) {
        throw new Error('문의 전송에 실패했습니다.')
      }

      setContactSubmitted(true)
    } catch {
      setContactErrorMessage('문의 전송 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setIsContactSubmitting(false)
    }
  }

  return (
    <div className="landing-page">
      <nav>
        <div className="nav-logo">
          JOB<span>RISK</span>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-eyebrow">채용공고 · 물경력 가능성 점검</div>
        <h1 className="hero-title">
          좋아 보이는 공고도,
          <br />
          실제로는 반복 운영·보조 업무 중심일 수 있습니다
        </h1>
        <p className="hero-sub">
          JOBRISK는 채용공고를 읽고, 이 일이 경력에 남을지·물경력으로 흐를 가능성이 큰지 먼저 점검해 드립니다. (프리토타입: 물경력만)
        </p>
        <div className="hero-cta-group">
          <a href="#form" className="btn-primary hero-main-cta">
            채용공고 붙여넣고 무료 미리보기 보기 →
          </a>
          <span className="btn-price-note">
            무료 미리보기 → 원하면 3,000원에 상세 분석 · 상세 확인 전 전액 환불
          </span>
        </div>
      </section>

      <section className="trust-strip" aria-label="서비스 신뢰 정보">
        <div className="trust-strip-inner">
          <div className="trust-item">
            <span className="trust-item-label">분석 기준</span>
            공고 문장 + 직무군 맥락 + 물경력 5개 축
          </div>
          <div className="trust-item">
            <span className="trust-item-label">결과 확인</span>
            결제 직후 이 페이지에서 상세 분석 확인
          </div>
          <div className="trust-item">
            <span className="trust-item-label">환불 정책</span>
            상세 분석 확인 전 100% 환불 가능
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-label section-centered">왜 필요한가</div>
        <h2 className="section-title section-centered">
          공고는 짧고,
          <br />
          실제 역할은 길게 남습니다
        </h2>
        <p className="section-sub section-centered">
          채용공고는 실제 업무를 다 보여주지 않습니다. 반복 운영·보조인지, 성과 책임이 있는 역할인지는 문장을 차근히 읽어야 드러납니다.
        </p>
        <div className="pain-grid">
          <div className="pain-card">
            <div className="pain-icon">📄</div>
            <div className="pain-title">멋진 문장 뒤에 숨은 업무 성격</div>
            <div className="pain-desc">
              &apos;오너십&apos;, &apos;빠른 실행&apos; 같은 표현만으로는 역할 경계가 보이지 않을 수 있어요. 같은 &apos;운영&apos;이라도 직무에 따라 의미가 달라질 수 있습니다.
            </div>
          </div>
          <div className="pain-card">
            <div className="pain-icon">🧭</div>
            <div className="pain-title">공고만으로는 판단이 어려운 부분</div>
            <div className="pain-desc">
              지표·우선순위·&apos;하지 않을 일&apos;이 빠져 있으면, 입사 후에야 실제 비중이 드러나는 경우가 많습니다. 그래서 지원 전에 질문 포인트를 잡는 게 중요합니다.
            </div>
          </div>
          <div className="pain-card">
            <div className="pain-icon">✅</div>
            <div className="pain-title">JOBRISK가 하는 일</div>
            <div className="pain-desc">
              이 공고가 경력에 남는 일인지, 물경력으로 흐를 여지가 큰지 같은 기준으로 먼저 읽어 드립니다. 회사의 선악을 단정하지 않습니다.
            </div>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="how-read-title">
        <div className="section-label section-centered">읽는 방식</div>
        <h2 id="how-read-title" className="section-title section-centered">
          물경력 가능성,
          <br />
          같은 문장도 직무군에 따라 다르게 봅니다
        </h2>
        <p className="section-sub section-centered">
          자유형 요약이 아니라, 공고에서 직무 단서를 잡은 뒤 아래 다섯 축으로 정리합니다. 근거가 약하면 &apos;추가 확인 필요&apos; 톤을 유지합니다.
        </p>
        <ul className="landing-five-axes-list" aria-label="물경력 점검 다섯 축">
          <li>
            <strong>반복·운영 업무 비중</strong> — 운영·지원·반복 표현이 많을수록 물경력 가능성을 더 의식해 봅니다.
          </li>
          <li>
            <strong>책임 범위</strong> — 역할 경계·우선순위 단서가 있는지 봅니다.
          </li>
          <li>
            <strong>성과 측정 가능성</strong> — KPI·지표·평가 기준이 드러나는지 봅니다.
          </li>
          <li>
            <strong>난이도·책임 상승</strong> — 기획·판단·개선·실험 등 난이도가 쌓이는지 봅니다.
          </li>
          <li>
            <strong>전이 가능한 역량 축적</strong> — 다음 이직에서 설명할 만한 역량으로 남는지 봅니다.
          </li>
        </ul>
        <p className="section-sub section-centered landing-five-axes-footnote">
          같은 &apos;운영&apos;이라도 개발·인프라에서는 가치로 이어질 수 있고, 콘텐츠·마케에서는 집행 비중이 크면 물경력 쪽으로 더 보수적으로 읽을 수 있습니다.
        </p>
      </section>

      <section className="demo-section">
        <div className="demo-inner">
          <div className="section-label section-centered">실제 분석 예시</div>
          <h2 className="section-title section-centered">
            무료 미리보기와
            <br />
            유료 상세가 이렇게 달라집니다
          </h2>
          <div className="demo-grid">
            <div className="demo-card">
              <div className="demo-card-label">채용공고 원문(일부)</div>
              <div className="demo-text">
                <strong>[글로벌 뷰티 브랜드] 마케팅 담당자 채용</strong>
                <br />
                <br />
                빠르게 성장 중인 뷰티 스타트업입니다.
                <br />
                <br />
                <strong>주요업무</strong>
                <br />· SNS 채널 운영 및 콘텐츠 제작
                <br />· 디지털 광고 집행 및 성과 분석
                <br />· 인플루언서 섭외 및 협업 관리
                <br />· 데이터 기반 마케팅 전략 수립
                <br />
                <br />
                <strong>혜택</strong>
                <br />· 자율 출퇴근 · 연봉 협의 · 소규모 팀에서 오너십 발휘 가능
              </div>
            </div>
            <div className="demo-card result">
              <div className="demo-card-label">무료 미리보기(감지)</div>
              <div className="risk-badge">추가 확인이 필요해 보여요</div>
              <div className="result-item">
                <div className="result-item-label">한 줄</div>
                <div className="result-item-content">채널·광고·협업·전략이 한 번에 묶여 있어, 집행 비중이 큰지 먼저 확인하는 편이 안전해요.</div>
              </div>
              <div className="result-item">
                <div className="result-item-label">핵심 근거 1개</div>
                <div className="result-item-content">
                  <em>“SNS 채널 운영 및 콘텐츠 제작”</em>
                  <br />
                  → 운영·집행 단서로 읽을 수 있어, 전략·지표 소유 여부를 면접에서 확인할 가치가 있어요.
                </div>
              </div>
              <div className="result-item">
                <div className="result-item-label">짧은 이유</div>
                <div className="result-item-content">
                  · 역할 묶음이 넓어 우선순위 확인이 필요
                  <br />
                  · 성과 지표 문장이 약하면 평가 방식 확인
                </div>
              </div>
              <div className="result-item">
                <div className="result-item-label">확인 질문 1개</div>
                <div className="result-item-content">캠페인에서 전략·실험·지표 개선 중 무엇을 직접 결정하나요?</div>
              </div>
              <div className="demo-card-label demo-card-label-follow">유료 상세(검증) 예시</div>
              <div className="result-item">
                <div className="result-item-label">직무군 · 5개 축</div>
                <div className="result-item-content">
                  마케팅·브랜딩 기준으로 반복·운영 비중, 책임 범위, 성과 측정, 난이도, 전이 역량을 축별로 정리합니다.
                </div>
              </div>
              <div className="result-item">
                <div className="result-item-label">근거 · 면접</div>
                <div className="result-item-content">
                  공고 원문 3~5개를 골라 묶어 보여 주고, 면접 질문 5~7개에 괜찮은 답/확인 필요 답변 가이드를 붙입니다.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="stakes-section" aria-label="지원 전 점검">
        <div className="stakes-inner">
          <div className="stakes-caption">지원 전에 한 번만 더 읽어볼 가치가 있습니다</div>
          <p className="stakes-desc">
            공고 문장만으로 모든 것을 단정하지 않습니다.
            <br />
            다만 &apos;어디를 더 물어봐야 하는지&apos;를 미리 정리해 두면, 면접에서 역할과 성과 기준을 빠르게 확인할 수 있습니다.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="section-label section-centered">사용 방법</div>
        <h2 className="section-title section-centered">세 단계면 충분합니다</h2>
        <p className="section-sub section-centered">공고 본문만 있으면 됩니다. 별도 회피 조건 선택은 하지 않아요.</p>
        <div className="steps-grid">
          <div className="step-item">
            <div className="step-num">01</div>
            <div className="step-title">채용공고를 붙여넣습니다</div>
            <div className="step-desc">지원을 고려 중인 공고 본문을 그대로 넣어 주세요</div>
          </div>
          <div className="step-item">
            <div className="step-num">02</div>
            <div className="step-title">무료 미리보기로 물경력 가능성을 봅니다</div>
            <div className="step-desc">한 줄 결론, 핵심 근거 1개, 짧은 이유, 확인 질문 1개까지 감지해 드립니다</div>
          </div>
          <div className="step-item">
            <div className="step-num">03</div>
            <div className="step-title">더 깊게 보려면 상세 분석을 엽니다</div>
            <div className="step-desc">결제 후 이 페이지에서 5개 축·근거·면접 가이드를 바로 이어서 볼 수 있어요</div>
          </div>
        </div>
      </section>

      <section className="pricing-section" id="pricing">
        <div className="section-label section-centered">가격</div>
        <h2 className="section-title pricing-title-custom">무료 미리보기 후, 필요할 때만 상세 분석</h2>
        <div className="pricing-card">
          <div className="pricing-badge">얼리버드 한정</div>
          <div className="pricing-price">
            <span>₩</span>3,000
          </div>
          <div className="pricing-original">정식 출시가 월 9,900원(예정)</div>
          <ul className="pricing-includes">
            <li>채용공고 1건 기준 물경력 가능성 상세 분석</li>
            <li>직무군 기준 해석 + 5개 축 + 근거 + 면접 질문·답변 가이드</li>
            <li>결제 직후 이 페이지에서 바로 확인</li>
            <li>정식 출시 시 1개월 무료 체험권(안내 예정)</li>
          </ul>
          <a href="#form" className="btn-primary pricing-btn">
            채용공고 붙여넣고 무료 미리보기 보기 →
          </a>
          <p className="pricing-refund">상세 분석을 확인하기 전에는 전액 환불 가능 · 문의 getmuno@gmail.com</p>
        </div>
      </section>

      <section className="form-section" id="form">
        <div className="section-label section-centered">채용공고 입력</div>
        <h2 className="section-title form-title-custom">
          이 공고,
          <br />
          물경력 가능성부터 보기
        </h2>
        <p className="form-intro-note">
          공고 본문만 붙여넣으면 무료 미리보기가 시작돼요. 지금 프리토타입은 <strong>물경력 가능성</strong>만 다룹니다. 회사
          판정·연봉 추정·다른 리스크 종합은 하지 않아요.
        </p>
        <div className="form-card">
          <form onSubmit={handleJobFormPreview}>
            <div className="form-group">
              <label className="form-label" htmlFor="job-posting-text">
                채용공고 텍스트
              </label>
              <textarea
                id="job-posting-text"
                className="form-textarea"
                placeholder="채용공고 전체 내용을 입력해주세요"
                value={jobPostingText}
                onChange={(event) => setJobPostingText(event.target.value)}
                style={{ minHeight: '200px' }}
              />
              {jobFormErrors.jobPostingText ? <p className="contact-error">{jobFormErrors.jobPostingText}</p> : null}
            </div>
            {jobSubmitError ? <p className="contact-error">{jobSubmitError}</p> : null}
            <button type="submit" className="form-submit" disabled={isPaying || !isJobFormValid}>
              {isPaying ? '잠시만 기다려주세요...' : '무료 미리보기로 물경력 가능성 확인하기'}
            </button>
            <p className="form-note">
              결과는 이 페이지에서 바로 확인해요.
              <br />
              이메일로 보내기 등은 준비 중이며, 결제 단계에서도 이메일을 필수로 받지 않아요.
            </p>
          </form>
        </div>
      </section>

      {isPreviewVisible ? (
        <section ref={resultSectionRef} className="section preview-result-section" id="result" aria-label="무료 미리보기 결과">
          <div className="section-label section-centered">무료 미리보기 결과</div>
          <h2 className="section-title section-centered">공고 기준으로 물경력 가능성을 먼저 짚었어요</h2>

          {paymentSuccessMessage ? (
            <div className="payment-success-banner" role="status" aria-live="polite">
              {paymentSuccessMessage}
            </div>
          ) : null}

          {(() => {
            const preview = previewResult
            return (
              <>
                {previewLoading ? (
                  <div className="preview-block">
                    <h3 className="preview-heading">분석 중</h3>
                    <p className="preview-line">공고 문장 근거를 찾아 미리보기를 만들고 있어요…</p>
                  </div>
                ) : null}

                {!previewLoading && !preview ? (
                  <div className="preview-block">
                    <h3 className="preview-heading">미리보기를 만들지 못했어요</h3>
                    <p className="preview-line">
                      공고 텍스트가 너무 짧거나 형식이 깨져 있을 수 있어요. 공고 본문을 조금 더 길게 붙여넣고 다시 시도해주세요.
                    </p>
                  </div>
                ) : null}

                {preview && !isUnlocked && preview.freePreview ? (
                  <div className="preview-block preview-summary-frame" aria-label="무료 미리보기 요약">
                    <p className="preview-subline preview-family-note">
                      직무군 추정: <strong>{preview.freePreview.jobFamilyLabel}</strong>
                    </p>
                    <h3 className="preview-heading">물경력 가능성 한 줄</h3>
                    <p className="preview-line preview-free-headline">
                      <strong>{preview.freePreview.headline}</strong>
                      {preview.freePreview.headlineDetail
                        ? ` — ${toFirstSentence(preview.freePreview.headlineDetail)}`
                        : ''}
                    </p>
                    {preview.freePreview.topEvidence?.quote ? (
                      <div className="preview-inline-block" aria-label="핵심 근거">
                        <div className="preview-inline-title">가장 강한 근거(공고 원문)</div>
                        <div className="preview-inline-quote">{preview.freePreview.topEvidence.quote}</div>
                        {preview.freePreview.topEvidence.interpretation ? (
                          <div className="preview-inline-why">{preview.freePreview.topEvidence.interpretation}</div>
                        ) : null}
                      </div>
                    ) : null}
                    {Array.isArray(preview.freePreview.shortReasons) && preview.freePreview.shortReasons.length ? (
                      <div className="preview-inline-block" aria-label="짧은 이유">
                        <div className="preview-inline-title">짧게 짚어본 포인트</div>
                        <ul className="preview-reason-bullets">
                          {preview.freePreview.shortReasons.map((r) => (
                            <li key={r}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {preview.freePreview.verificationQuestion ? (
                      <div className="preview-inline-block" aria-label="확인 질문">
                        <div className="preview-inline-title">확인 질문(1개)</div>
                        <div className="preview-inline-question">
                          <strong>{preview.freePreview.verificationQuestion}</strong>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {preview && !isUnlocked && !preview.freePreview ? (
                  <div className="preview-block preview-summary-frame" aria-label="미리보기 형식 안내">
                    <h3 className="preview-heading">미리보기 형식을 불러오지 못했어요</h3>
                    <p className="preview-line">
                      정상 응답이라면 무료 미리보기 블록이 함께 내려옵니다. 캐시된 예전 응답이거나 일시 오류일 수 있어요. 공고를
                      다시 붙여넣고 한 번 더 시도해 주세요.
                    </p>
                  </div>
                ) : null}

                {isUnlocked && preview ? (
                  <div className="preview-block preview-detail-frame" aria-label="상세 분석">
                    <h3 className="preview-heading">물경력 상세 분석</h3>

                    {preview.paidDetail ? (
                      <>
                        <div className="preview-block-inner">
                          <h4 className="preview-subheading">요약 · 직무군</h4>
                          <p className="preview-line">
                            <strong>{preview.paidDetail.jobFamilyLabel}</strong>
                          </p>
                          <p className="preview-card-desc">{preview.paidDetail.finalSummary}</p>
                        </div>
                        <div className="preview-block-inner">
                          <h4 className="preview-subheading">물경력 점검 5개 축</h4>
                          <ul className="preview-five-axes">
                            {(preview.paidDetail.fiveAxes || []).map((ax) => (
                              <li key={ax.key}>
                                <strong>{ax.label}</strong> — {ax.levelLabel}
                                <div className="preview-axis-summary">{ax.summary}</div>
                              </li>
                            ))}
                          </ul>
                        </div>
                        {preview.paidDetail.keyEvidence?.length ? (
                          <div className="preview-block-inner">
                            <h4 className="preview-subheading">핵심 근거</h4>
                            <ul className="preview-evidence-list">
                              {preview.paidDetail.keyEvidence.map((ev) => (
                                <li key={ev.quote}>
                                  <span className="evidence-badge">원문</span>
                                  <span className="evidence-text">{ev.quote}</span>
                                  {ev.note ? <div className="preview-inline-why">{ev.note}</div> : null}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        <div className="preview-block-inner">
                          <h4 className="preview-subheading">면접에서 꼭 물어볼 질문</h4>
                          <ul className="preview-question-list paid-question-list">
                            {(preview.paidDetail.interviewQuestions || []).map((q) => (
                              <li key={q.question}>
                                <strong>{q.question}</strong>
                                {q.whyThisMatters ? <div className="preview-subline">{q.whyThisMatters}</div> : null}
                                <div className="preview-answer-guide">
                                  <span className="answer-pill answer-good">괜찮은 답</span> {q.ifGood}
                                  <br />
                                  <span className="answer-pill answer-risk">확인 필요</span> {q.ifRisky}
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                        {preview.paidDetail.actionGuide ? (
                          <div className="preview-block-inner">
                            <h4 className="preview-subheading">다음 행동 가이드</h4>
                            <p className="preview-card-desc">{preview.paidDetail.actionGuide}</p>
                          </div>
                        ) : null}
                      </>
                    ) : null}

                    {!preview.paidDetail && preview?.avoidConditionMatches?.length ? (
                      <div className="preview-block-inner">
                        <h4 className="preview-subheading">물경력 신호별 근거</h4>
                        <div className="avoid-match-list">
                          {preview.avoidConditionMatches.map((m) => (
                            <div key={m.tag} className={`avoid-match-card level-${m.level || 'needs_review'}`}>
                              <div className="avoid-match-header">
                                <span className="selected-tag">{m.tag}</span>
                                <span className="level-pill" title={levelHelp(m.level)}>
                                  {levelLabel(m.level)}
                                </span>
                              </div>
                              <div className="preview-card-desc">{m.reason}</div>
                              {Array.isArray(m.evidence) && m.evidence.length ? (
                                <ul className="preview-evidence-list" aria-label="근거 문장">
                                  {m.evidence.slice(0, 3).map((ev) => (
                                    <li key={toEvidenceText(ev)}>
                                      <span className="evidence-badge">
                                        {toEvidenceSourceType(ev) === 'quote' ? '원문' : '요약'}
                                      </span>
                                      <span className="evidence-text">{toEvidenceText(ev)}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {preview?.missingInformation?.length ? (
                      <div className="preview-block-inner">
                        <h4 className="preview-subheading">누락 정보(확인 필요)</h4>
                        <ul className="preview-question-list">
                          {preview.missingInformation.map((m) => (
                            <li key={m.item}>
                              <strong>{m.item}</strong>
                              {m.reason ? ` — ${m.reason}` : ''}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {!preview.paidDetail && preview?.keyPoints?.length ? (
                      <div className="preview-block-inner">
                        <h4 className="preview-subheading">추가 확인 포인트</h4>
                        <div className="preview-card-grid">
                          {preview.keyPoints.slice(0, 6).map((item) => (
                            <div key={item.title} className="preview-card">
                              <div className="preview-card-title">{item.title}</div>
                              <div className="preview-card-desc">{item.reason}</div>
                              {Array.isArray(item.evidence) && item.evidence.length ? (
                                <ul className="preview-evidence-list" aria-label="근거 문장">
                                  {item.evidence.slice(0, 3).map((ev) => (
                                    <li key={toEvidenceText(ev)}>
                                      <span className="evidence-badge">
                                        {toEvidenceSourceType(ev) === 'quote' ? '원문' : '요약'}
                                      </span>
                                      <span className="evidence-text">{toEvidenceText(ev)}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {!preview.paidDetail && preview?.interviewQuestions?.length ? (
                      <div className="preview-block-inner">
                        <h4 className="preview-subheading">면접 질문(전체)</h4>
                        <ul className="preview-question-list">
                          {preview.interviewQuestions.slice(0, 6).map((q) => (
                            <li key={q.question}>
                              <strong>{q.question}</strong>
                              {q.whyThisMatters ? ` — ${q.whyThisMatters}` : ''}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="preview-cta">
                  {!isUnlocked ? (
                    <>
                      <button type="button" className="btn-primary preview-pay-cta" onClick={handleStartPayment} disabled={isPaying}>
                        {isPaying ? '결제창 여는 중...' : '3,000원으로 물경력 상세 분석 보기'}
                      </button>
                      <p className="preview-cta-note">결제 직후 이 화면에서 5개 축·근거·면접 가이드가 열려요. 이메일 발송은 선택·준비 중입니다.</p>
                    </>
                  ) : (
                    <>
                      <div className="unlocked-note">이제 물경력 상세 분석을 이 화면에서 바로 확인할 수 있어요.</div>
                      <div className="postpay-actions">
                        <button type="button" className="btn-primary btn-secondary-size" disabled>
                          이 결과를 이메일로 받기 (준비 중)
                        </button>
                        <button type="button" className="btn-primary btn-secondary-size" disabled>
                          PC에서 다시 볼 링크 받기 (준비 중)
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
            )
          })()}
        </section>
      ) : null}

      <section className="founder-section">
        <div className="founder-card">
          <div className="founder-label">서비스를 만든 이유</div>
          <p className="founder-quote">
            저는 이직을 준비할 때 공고를 꼼꼼히 읽기보다 &quot;일단 붙어보자&quot;에 가깝게 지원했습니다.
            <br />
            막상 합류해 보니 <em>말로는 성장, 실제로는 반복 운영·보조 업무</em>에 시간이 많이 갔습니다.
            <br />
            <br />
            회사를 재판하는 도구는 아니지만, 지원 전에 <em>물경력 가능성</em>을 같은 기준으로 점검할 수 있으면 조금은 덜
            막막하겠다고 느꼈습니다.
            <br />
            그래서 JOBRISK를 만들고 있습니다.
          </p>
          <div className="founder-byline">
            <div className="founder-avatar">H</div>
            <div>
              <div className="founder-name">현수</div>
              <div className="founder-desc">muno 대표</div>
            </div>
          </div>
        </div>
      </section>

      <FAQ variant="landing" />

      <section className="contact-section">
        <div className="section-label section-centered">추가 문의</div>
        <h2 className="section-title contact-title-custom section-centered">
          FAQ로 해결되지 않은
          <br />
          궁금한 점이 있으신가요
        </h2>
        <div className="contact-card">
          {contactSubmitted ? (
            <div className="contact-success">
              문의가 접수되었습니다.
              <br />
              빠른 시일 내에 답변드릴게요
            </div>
          ) : (
            <form onSubmit={handleContactSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="contact-name">
                  이름
                </label>
                <input id="contact-name" type="text" className="form-input" name="name" placeholder="이름을 입력해주세요" required />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="contact-email">
                  이메일
                </label>
                <input
                  id="contact-email"
                  type="email"
                  className="form-input"
                  name="email"
                  placeholder="이메일을 입력해주세요"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="contact-message">
                  문의 내용
                </label>
                <textarea
                  id="contact-message"
                  className="form-textarea"
                  name="message"
                  placeholder="문의 내용을 입력해주세요"
                  required
                />
              </div>
              {contactErrorMessage ? <p className="contact-error">{contactErrorMessage}</p> : null}
              <button type="submit" className="form-submit" disabled={isContactSubmitting}>
                {isContactSubmitting ? '전송 중...' : '문의 보내기'}
              </button>
            </form>
          )}
        </div>
      </section>

      <Footer />

    </div>
  )
}

export default App

