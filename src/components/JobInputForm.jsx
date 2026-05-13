import { useMemo, useState } from 'react'

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function JobInputForm({ onSubmitPayment, isPaying }) {
  const [jobPostingText, setJobPostingText] = useState('')
  const [additionalRequest, setAdditionalRequest] = useState('')
  const [email, setEmail] = useState('')
  const [touched, setTouched] = useState({
    jobPostingText: false,
    email: false,
  })
  const [submitError, setSubmitError] = useState('')

  const errors = useMemo(() => {
    const nextErrors = {
      jobPostingText: '',
      email: '',
    }

    if (!jobPostingText.trim()) {
      nextErrors.jobPostingText = '채용공고를 입력해주세요'
    }

    if (!email.trim() || !isValidEmail(email.trim())) {
      nextErrors.email = '올바른 이메일 주소를 입력해주세요'
    }

    return nextErrors
  }, [email, jobPostingText])

  const isFormValid = !errors.jobPostingText && !errors.email

  const handleSubmit = async (event) => {
    event.preventDefault()
    setTouched({ jobPostingText: true, email: true })
    setSubmitError('')

    if (!isFormValid) return

    try {
      await onSubmitPayment({
        email: email.trim(),
        jobPostingText: jobPostingText.trim(),
        additionalRequest: additionalRequest.trim(),
      })
    } catch (error) {
      setSubmitError(error?.message || '결제 진행 중 오류가 발생했습니다. 다시 시도해주세요.')
    }
  }

  return (
    <section id="job-input-section" className="job-input-section">
      <h2 className="job-input-title">채용공고를 입력해주세요</h2>
      <p className="job-input-subtitle">
        JOBRISK는 지금 <strong>물경력 가능성</strong>만 같은 기준으로 점검합니다. 결제 후에는 이 페이지에서 상세 분석을 바로
        열 수 있어요. 이메일 발송은 보조·준비 중입니다.
      </p>

      <form className="job-input-form" onSubmit={handleSubmit}>
        <label className="contact-label" htmlFor="job-posting-text">
          채용공고 텍스트
        </label>
        <textarea
          id="job-posting-text"
          className="contact-textarea job-input-textarea"
          name="jobPostingText"
          placeholder="지원을 고려 중인 채용공고 본문을 붙여넣어 주세요"
          value={jobPostingText}
          onChange={(event) => setJobPostingText(event.target.value)}
          onBlur={() => setTouched((prev) => ({ ...prev, jobPostingText: true }))}
        />
        {touched.jobPostingText && errors.jobPostingText ? (
          <p className="contact-error">{errors.jobPostingText}</p>
        ) : null}

        <label className="contact-label" htmlFor="additional-request">
          추가 메모 (선택)
        </label>
        <textarea
          id="additional-request"
          className="contact-textarea job-input-textarea-secondary"
          name="additionalRequest"
          placeholder="결제·운영 쪽에 전달할 짧은 메모가 있으면 적어주세요. 분석 축은 물경력만 사용합니다."
          value={additionalRequest}
          onChange={(event) => setAdditionalRequest(event.target.value)}
        />

        <label className="contact-label" htmlFor="job-input-email">
          이메일
        </label>
        <input
          id="job-input-email"
          className="contact-input"
          type="email"
          name="email"
          placeholder="결제·문의 연락용 이메일"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
        />
        {touched.email && errors.email ? <p className="contact-error">{errors.email}</p> : null}
        {submitError ? <p className="contact-error">{submitError}</p> : null}

        <button
          type="submit"
          className={`hero-button job-input-submit${isPaying ? ' is-paying' : ''}`}
          disabled={isPaying}
        >
          {isPaying ? '결제창 여는 중...' : '3,000원으로 물경력 상세 분석 보기'}
        </button>
      </form>
    </section>
  )
}

export default JobInputForm
