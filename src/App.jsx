import { useMemo, useState } from 'react'
import Footer from './components/Footer'
import { requestEarlyBirdPayment } from './lib/kcpPayment'

function App() {
  const [isPaying, setIsPaying] = useState(false)
  const [jobPostingText, setJobPostingText] = useState('')
  const [additionalRequest, setAdditionalRequest] = useState('')
  const [jobEmail, setJobEmail] = useState('')
  const [contactSubmitted, setContactSubmitted] = useState(false)
  const [isContactSubmitting, setIsContactSubmitting] = useState(false)
  const [contactErrorMessage, setContactErrorMessage] = useState('')
  const [jobSubmitError, setJobSubmitError] = useState('')
  const [openFaqIndex, setOpenFaqIndex] = useState(0)

  const jobFormErrors = useMemo(() => {
    const errors = {
      jobPostingText: '',
      email: '',
    }

    if (!jobPostingText.trim()) {
      errors.jobPostingText = '채용공고 텍스트를 입력해주세요.'
    }

    const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(jobEmail.trim())
    if (!jobEmail.trim() || !isEmailValid) {
      errors.email = '올바른 이메일을 입력해주세요.'
    }

    return errors
  }, [jobEmail, jobPostingText])

  const isJobFormValid = !jobFormErrors.jobPostingText && !jobFormErrors.email

  const handleJobFormPayment = async (event) => {
    event.preventDefault()
    setJobSubmitError('')

    if (!isJobFormValid) return

    sessionStorage.setItem('earlybird_job_posting_text', jobPostingText.trim())
    sessionStorage.setItem('earlybird_additional_request', additionalRequest.trim())
    sessionStorage.setItem('earlybird_customer_email', jobEmail.trim())

    try {
      setIsPaying(true)
      await requestEarlyBirdPayment(jobEmail.trim())
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

  const toggleFaq = (index) => {
    setOpenFaqIndex((prev) => (prev === index ? -1 : index))
  }

  return (
    <div className="landing-page">
      <nav>
        <div className="nav-logo">
          JOB<span>RISK</span>
        </div>
        <a href="#form" className="nav-cta">
          리스크 진단받기
        </a>
      </nav>

      <section className="hero">
        <div className="hero-eyebrow">AI 채용공고 리스크 분석</div>
        <h1 className="hero-title">
          <span className="line-muted">입사 전에 알았더라면...</span>
          입사 후 후회, 입사 전에 막으세요
        </h1>
        <p className="hero-sub">
          채용공고에 숨겨진 <span className="keyword-highlight">물경력</span>·야근·
          <span className="keyword-highlight">연봉 함정</span>을
          <br />
          AI가 먼저 찾아드립니다
        </p>
        <p className="hero-oneliner">이직을 고민하는 직장인을 위한 커리어 리스크 진단 서비스</p>
        <div className="hero-cta-group">
          <a href="#form" className="btn-primary">
            내 커리어 리스크 진단받기 →
          </a>
          <span className="btn-price-note">
            얼리버드 <strong>3,000원</strong> · 리포트 받기 전 전액 환불 가능
          </span>
        </div>
        <div className="hero-social-proof">
          <div className="proof-item">
            <div className="proof-dot" />
            물경력 위험도 분석
          </div>
          <div className="proof-item">
            <div className="proof-dot" />
            적정 연봉 추정
          </div>
          <div className="proof-item">
            <div className="proof-dot" />
            면접 필수 질문 제공
          </div>
        </div>
      </section>

      <section className="trust-strip" aria-label="서비스 신뢰 정보">
        <div className="trust-strip-inner">
          <div className="trust-item">
            <span className="trust-item-label">분석 기준</span>
            채용공고 문구 기반 리스크 체크리스트
          </div>
          <div className="trust-item">
            <span className="trust-item-label">리포트 전달</span>
            결제 후 1시간 이내 (평일 10시~18시)
          </div>
          <div className="trust-item">
            <span className="trust-item-label">환불 정책</span>
            리포트 전달 전 100% 환불 가능
          </div>
        </div>
      </section>

      <section className="founder-section">
        <div className="founder-card">
          <div className="founder-label">서비스를 만든 이유</div>
          <p className="founder-quote">
            저는 이직을 준비할 때 &quot;일단 취업이 되는 게 먼저&quot;라는 생각에 공고를 제대로 읽지 않았습니다.
            <br />
            결과는 <em>취업사기, 블랙기업, 물경력</em>을 모두 경험하는 것이었습니다.
            <br />
            <br />
            그 1~2년을 되돌릴 수 없었습니다.
            <br />
            적어도 다음 사람은 막아보고 싶었습니다.
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

      <section className="section">
        <div className="section-label section-centered">왜 필요한가</div>
        <h2 className="section-title section-centered">
          다들 한 번씩은
          <br />
          겪어봤을 겁니다
        </h2>
        <p className="section-sub section-centered">좋은 말 뒤에 숨겨진 신호, 공고만 봐서는 알 수 없습니다.</p>
        <div className="pain-grid">
          <div className="pain-card">
            <div className="pain-icon">🚨</div>
            <div className="pain-title">'자율적인 분위기'의 진짜 의미</div>
            <div className="pain-desc">
              &apos;오너십 발휘&apos;, &apos;빠르게 성장 중&apos;. 좋은 말 뒤에 숨겨진 신호를 채용공고 문구에서 먼저 찾아드립니다.
            </div>
          </div>
          <div className="pain-card">
            <div className="pain-icon">📉</div>
            <div className="pain-title">잡플래닛 4점도 믿을 수 없습니다</div>
            <div className="pain-desc">
              후기는 재직자가 씁니다. 채용공고는 회사가 직접 씁니다. 가장 솔직한 정보는 공고 안에 있습니다.
            </div>
          </div>
          <div className="pain-card">
            <div className="pain-icon">💰</div>
            <div className="pain-title">연봉은 왜 항상 내가 먼저 써야 할까요</div>
            <div className="pain-desc">
              정보 비대칭 상태에서 협상하면 항상 끌려다닙니다. 적정 연봉을 먼저 알고 들어가세요.
            </div>
          </div>
        </div>
      </section>

      <section className="section market-truth-section" aria-labelledby="market-truth-title">
        <div className="section-label section-centered">현실 데이터</div>
        <h2 id="market-truth-title" className="section-title section-centered">
          채용공고, 그대로 믿으면 60%가 후회합니다
        </h2>
        <p className="section-sub section-centered market-truth-sub">
          회사는 채용공고를 &apos;진실&apos;이 아닌 &apos;마케팅&apos;으로 씁니다.
          <br />
          Jobrisk는 그 광고 이면에 가려진 실무의 민낯과 커리어의 함정을 데이터로 걸러내어,
          <br />
          구직자가 &apos;속아서 입사하는 일&apos;을 막아드립니다.
        </p>
        <div className="market-truth-grid">
          <article className="market-truth-card">
            <p className="market-truth-value">60%</p>
            <h3 className="market-truth-headline">채용공고와 실제 업무, 60%가 다릅니다</h3>
            <p className="market-truth-desc">
              채용공고는 회사가 좋은 인재를 꼬시기 위해 만든 &apos;마케팅 문서&apos;입니다. 팩트만 골라내는 필터가 없다면,
              불일치의 리스크는 구직자가 감당해야 합니다.
              <span className="market-truth-source">출처: 2015, 알바천국</span>
            </p>
          </article>

          <article className="market-truth-card">
            <p className="market-truth-value">45.1%</p>
            <h3 className="market-truth-headline">취업 사기, 절대 남의 일이 아닙니다</h3>
            <p className="market-truth-desc">
              구직 경험자 10명 중 4명 이상이 사기성 채용을 경험했습니다. 감에 의존하지 말고 데이터로 검증하세요.
              <span className="market-truth-source">출처: 2021, 인크루트</span>
            </p>
          </article>

          <article className="market-truth-card">
            <p className="market-truth-value">37.7%</p>
            <h3 className="market-truth-headline">직장인 37.7%가 물경력을 걱정합니다</h3>
            <p className="market-truth-desc">
              성장이 멈춘 경력은 이직 시장에서 가장 위험한 자산입니다. 입사 전, 커리어 패스를 먼저 진단하세요.
              <span className="market-truth-source">출처: 2023, 잡코리아</span>
            </p>
          </article>

          <article className="market-truth-card">
            <p className="market-truth-value">30~50%</p>
            <h3 className="market-truth-headline">보이지 않는 블랙기업의 징후들</h3>
            <p className="market-truth-desc">
              계약서 미작성, 과로 등 부당한 환경은 공고의 행간에 숨어 있습니다. 우리는 그 신호를 찾아내어 구직자를
              보호합니다.
              <span className="market-truth-source">출처: 2015, 청년유니온</span>
            </p>
          </article>
        </div>
      </section>

      <div className="divider" />

      <section className="stakes-section">
        <div className="stakes-inner">
          <div className="stakes-number">1~2년</div>
          <div className="stakes-caption">잘못된 이직 한 번이 날려버리는 커리어</div>
          <p className="stakes-desc">
            퇴사를 결심하고 다시 이직할 때까지,
            <br />
            그 공백기에 동기들은 계속 앞으로 나아갑니다.
            <br />
            공고 하나를 잘못 읽은 대가치고는 너무 큽니다.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="section-label section-centered">사용 방법</div>
        <h2 className="section-title section-centered">3분이면 충분합니다</h2>
        <p className="section-sub section-centered">복잡한 것 없습니다. 공고를 붙여넣기만 하면 됩니다.</p>
        <div className="steps-grid">
          <div className="step-item">
            <div className="step-num">01</div>
            <div className="step-title">내 조건을 입력합니다</div>
            <div className="step-desc">연차, 희망 연봉, 피하고 싶은 조건을 간단히 적어주세요</div>
          </div>
          <div className="step-item">
            <div className="step-num">02</div>
            <div className="step-title">채용공고를 붙여넣습니다</div>
            <div className="step-desc">지원하려는 공고 텍스트를 그대로 복사해서 넣으면 됩니다</div>
          </div>
          <div className="step-item">
            <div className="step-num">03</div>
            <div className="step-title">리포트를 받습니다</div>
            <div className="step-desc">1시간 이내 이메일로 분석 결과를 보내드립니다 (평일 10시~18시)</div>
          </div>
        </div>
      </section>

      <div className="divider" />

      <section className="demo-section">
        <div className="demo-inner">
          <div className="section-label section-centered">실제 분석 예시</div>
          <h2 className="section-title section-centered">
            채용공고의 행간을
            <br />
            이렇게 읽어드립니다
          </h2>
          <div className="demo-grid">
            <div className="demo-card">
              <div className="demo-card-label">채용공고 원문</div>
              <div className="demo-text">
                <strong>[글로벌 뷰티 브랜드] 마케팅 담당자 채용</strong>
                <br />
                <br />
                빠르게 성장 중인 뷰티 스타트업입니다.
                <br />
                인스타그램 팔로워 10만 보유.
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
                <br />· 자율 출퇴근
                <br />· 연봉 협의
                <br />· 소규모 팀에서 오너십 발휘 가능
              </div>
            </div>
            <div className="demo-card result">
              <div className="demo-card-label">AI 분석 결과</div>
              <div className="risk-badge">물경력 위험도 높음</div>
              <div className="result-item">
                <div className="result-item-label">위험 신호</div>
                <div className="result-item-content">
                  SNS·광고·데이터 동시 담당 → <strong>전문성 없이 잡일 가능성</strong>
                  <br />
                  소규모팀 + 오너십 강조 → 혼자 다 해야 하는 구조
                  <br />
                  연봉 협의 → 정보 비대칭 협상
                </div>
              </div>
              <div className="result-item">
                <div className="result-item-label">적정 연봉</div>
                <div className="result-item-content">
                  경력 3년 기준 <strong>3,800~4,200만원</strong>
                </div>
              </div>
              <div className="result-item">
                <div className="result-item-label">커리어 패스 전망</div>
                <div className="result-item-content">
                  직무 범위 과다로 3년 후 <strong>&apos;무엇을 잘하는 사람&apos;으로 포지셔닝 어려움</strong>
                </div>
              </div>
              <div className="result-item">
                <div className="result-item-label">면접 필수 질문</div>
                <div className="result-item-content">
                  · 전임자는 왜 퇴사했나요?
                  <br />· 팀 규모와 각자 담당 업무는?
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-label section-centered">분석 항목</div>
        <h2 className="section-title section-centered">이런 분석을 해드립니다</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-num">01</div>
            <div className="feature-title">물경력 위험도 분석</div>
            <div className="feature-desc">
              공고 문구에서 위험 신호를 찾아냅니다. 입사 후 후회하는 가장 흔한 패턴입니다.
            </div>
          </div>
          <div className="feature-card">
            <div className="feature-num">02</div>
            <div className="feature-title">커리어 패스 적합성</div>
            <div className="feature-desc">
              이 포지션이 내 커리어 방향에 맞는지, 3년 후 어떤 사람이 되어 있을지 알려드립니다.
            </div>
          </div>
          <div className="feature-card">
            <div className="feature-num">03</div>
            <div className="feature-title">적정 연봉 추정</div>
            <div className="feature-desc">
              연봉 미기재 공고의 적정 금액을 추정해드립니다. 협상 테이블에서 끌려다니지 마세요.
            </div>
          </div>
          <div className="feature-card">
            <div className="feature-num">04</div>
            <div className="feature-title">면접 필수 질문</div>
            <div className="feature-desc">
              입사 전 반드시 확인해야 할 질문 리스트. 면접에서 주도권을 쥐는 가장 빠른 방법입니다.
            </div>
          </div>
        </div>
      </section>

      <div className="divider" />

      <section className="success-section">
        <div className="success-inner">
          <div className="section-label">이걸 쓰면 어떻게 달라지나요</div>
          <h2 className="section-title success-title">
            &quot;역시 잘 골랐다&quot;는 확신을 갖고
            <br />
            첫 출근을 하세요
          </h2>
          <div className="success-list">
            <div className="success-item">
              <div className="success-check">✓</div>
              공고를 읽으면서 &quot;이게 맞는 건지&quot; 불안해하지 않아도 됩니다
            </div>
            <div className="success-item">
              <div className="success-check">✓</div>
              연봉 협상 테이블에서 적정 금액을 알고 앉을 수 있습니다
            </div>
            <div className="success-item">
              <div className="success-check">✓</div>
              면접에서 회사를 평가하는 질문을 먼저 던질 수 있습니다
            </div>
            <div className="success-item">
              <div className="success-check">✓</div>
              잘못된 이직으로 1~2년을 날리는 일을 피할 수 있습니다
            </div>
          </div>
          <a href="#form" className="btn-primary btn-secondary-size">
            지금 바로 진단받기 →
          </a>
        </div>
      </section>

      <section className="pricing-section" id="pricing">
        <div className="section-label section-centered">얼리버드 혜택</div>
        <h2 className="section-title pricing-title-custom">지금 바로 시작하세요</h2>
        <div className="pricing-card">
          <div className="pricing-badge">얼리버드 한정</div>
          <div className="pricing-price">
            <span>₩</span>3,000
          </div>
          <div className="pricing-original">정식 출시가 월 9,900원</div>
          <ul className="pricing-includes">
            <li>채용공고 AI 분석 리포트 1회</li>
            <li>물경력 위험도 · 연봉 추정 · 면접 질문 포함</li>
            <li>정식 출시 시 1개월 무료 체험권</li>
            <li>얼리버드 전용 혜택 우선 안내</li>
          </ul>
          <a href="#form" className="btn-primary pricing-btn">
            내 커리어 리스크 진단받기 →
          </a>
          <p className="pricing-refund">리포트 받기 전 전액 환불 가능 · 문의 getmuno@gmail.com</p>
        </div>
      </section>

      <section className="form-section" id="form">
        <div className="section-label section-centered">채용공고 입력</div>
        <h2 className="section-title form-title-custom">
          분석받고 싶은 공고를
          <br />
          붙여넣어 주세요
        </h2>
        <p className="form-intro-note">
          결제 후 1시간 이내 리포트를 이메일로 보내드립니다 (평일 10시~18시)
        </p>
        <div className="form-card">
          <form onSubmit={handleJobFormPayment}>
            <div className="form-group">
              <label className="form-label" htmlFor="job-posting-text">
                채용공고 텍스트
              </label>
              <textarea
                id="job-posting-text"
                className="form-textarea"
                placeholder="분석받고 싶은 채용공고를 붙여넣어 주세요"
                value={jobPostingText}
                onChange={(event) => setJobPostingText(event.target.value)}
                style={{ minHeight: '200px' }}
              />
              {jobFormErrors.jobPostingText ? <p className="contact-error">{jobFormErrors.jobPostingText}</p> : null}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="additional-request">
                기타 요구사항 <span className="optional">선택</span>
              </label>
              <textarea
                id="additional-request"
                className="form-textarea"
                placeholder="예) 현재 경력 3년차 마케터, 야근 없는 곳 원함, 연봉 4천만원 이상 희망"
                value={additionalRequest}
                onChange={(event) => setAdditionalRequest(event.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="job-input-email">
                이메일
              </label>
              <input
                id="job-input-email"
                type="email"
                className="form-input"
                placeholder="리포트를 받으실 이메일을 입력해주세요"
                value={jobEmail}
                onChange={(event) => setJobEmail(event.target.value)}
              />
              {jobFormErrors.email ? <p className="contact-error">{jobFormErrors.email}</p> : null}
            </div>
            {jobSubmitError ? <p className="contact-error">{jobSubmitError}</p> : null}
            <button type="submit" className="form-submit" disabled={isPaying || !isJobFormValid}>
              {isPaying ? '결제창 여는 중...' : '내 커리어 리스크 진단받기 (3,000원)'}
            </button>
            <p className="form-note">
              리포트를 받기 전에는 전액 환불 가능합니다
              <br />
              리포트 수령 후에는 환불이 어렵습니다
            </p>
          </form>
        </div>
      </section>

      <section className="faq-section">
        <div className="section-label section-centered">자주 묻는 질문</div>
        <h2 className="section-title faq-title-custom section-centered">궁금한 점이 있으신가요</h2>

        <div className={`faq-item ${openFaqIndex === 0 ? 'open' : ''}`}>
          <button type="button" className="faq-question" onClick={() => toggleFaq(0)} aria-expanded={openFaqIndex === 0}>
            AI 분석이라 정확한가요?
            <span className="faq-icon">+</span>
          </button>
          <div className="faq-answer">
            사람이 혼자 공고를 읽을 때 놓치기 쉬운 물경력 신호, 연봉 정보 비대칭, 조직 문화 위험 요소를 체계적인
            기준으로 짚어드립니다. 실제 입사 경험 피드백을 쌓아 더 정확한 분석을 만들어가고 있습니다.
          </div>
        </div>

        <div className={`faq-item ${openFaqIndex === 1 ? 'open' : ''}`}>
          <button type="button" className="faq-question" onClick={() => toggleFaq(1)} aria-expanded={openFaqIndex === 1}>
            ChatGPT에 물어보면 안 되나요?
            <span className="faq-icon">+</span>
          </button>
          <div className="faq-answer">
            물론 직접 물어볼 수 있습니다. 다만 어떤 기준으로 어떤 질문을 해야 하는지 모르면 중요한 신호를 놓칩니다.
            jobrisk는 채용공고 분석에 특화된 기준으로 일관되게 분석해드립니다.
          </div>
        </div>

        <div className={`faq-item ${openFaqIndex === 2 ? 'open' : ''}`}>
          <button type="button" className="faq-question" onClick={() => toggleFaq(2)} aria-expanded={openFaqIndex === 2}>
            환불은 어떻게 하나요?
            <span className="faq-icon">+</span>
          </button>
          <div className="faq-answer">
            리포트를 받으시기 전에는 전액 환불 가능합니다. 리포트 수령 후에는 환불이 어렵습니다. 환불 문의는
            getmuno@gmail.com으로 연락주세요.
          </div>
        </div>

        <div className={`faq-item ${openFaqIndex === 3 ? 'open' : ''}`}>
          <button type="button" className="faq-question" onClick={() => toggleFaq(3)} aria-expanded={openFaqIndex === 3}>
            내 이력서 정보가 저장되나요?
            <span className="faq-icon">+</span>
          </button>
          <div className="faq-answer">입력하신 정보는 분석 목적으로만 사용되며, 분석 완료 후 별도로 저장하지 않습니다.</div>
        </div>
      </section>

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

      <div className="sticky-cta">
        <a href="#form">내 커리어 리스크 진단받기 (3,000원)</a>
      </div>
    </div>
  )
}

export default App

