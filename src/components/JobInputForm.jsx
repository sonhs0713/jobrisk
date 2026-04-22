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
    additionalRequest: false,
    email: false,
  })
  const [submitError, setSubmitError] = useState('')

  const errors = useMemo(() => {
    const nextErrors = {
      jobPostingText: '',
      additionalRequest: '',
      email: '',
    }

    if (!jobPostingText.trim()) {
      nextErrors.jobPostingText = '채용공고를 입력해주세요'
    }

    if (!additionalRequest.trim()) {
      nextErrors.additionalRequest = '기타 요구사항을 입력해주세요'
    }

    if (!email.trim() || !isValidEmail(email.trim())) {
      nextErrors.email = '올바른 이메일 주소를 입력해주세요'
    }

    return nextErrors
  }, [additionalRequest, email, jobPostingText])

  const isFormValid = !errors.jobPostingText && !errors.additionalRequest && !errors.email

  const handleSubmit = async (event) => {
    event.preventDefault()
    setTouched({ jobPostingText: true, additionalRequest: true, email: true })
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
        결제 후 1시간 이내 분석 리포트를 이메일로 보내드립니다
        <br />
        (평일 오전 10시 ~ 오후 6시 기준)
      </p>

      <form className="job-input-form" onSubmit={handleSubmit}>
        <label className="contact-label" htmlFor="job-posting-text">
          채용공고 텍스트
        </label>
        <textarea
          id="job-posting-text"
          className="contact-textarea job-input-textarea"
          name="jobPostingText"
          placeholder="분석받고 싶은 채용공고를 붙여넣어 주세요"
          value={jobPostingText}
          onChange={(event) => setJobPostingText(event.target.value)}
          onBlur={() => setTouched((prev) => ({ ...prev, jobPostingText: true }))}
        />
        {touched.jobPostingText && errors.jobPostingText ? (
          <p className="contact-error">{errors.jobPostingText}</p>
        ) : null}

        <label className="contact-label" htmlFor="additional-request">
          기타 요구사항 (선택)
        </label>
        <textarea
          id="additional-request"
          className="contact-textarea job-input-textarea-secondary"
          name="additionalRequest"
          placeholder={`추가로 알려주실 내용이 있으면 적어주세요
예) 현재 경력 3년차 마케터, 야근 없는 곳 원함, 연봉 4천만원 이상 희망`}
          value={additionalRequest}
          onChange={(event) => setAdditionalRequest(event.target.value)}
          onBlur={() => setTouched((prev) => ({ ...prev, additionalRequest: true }))}
        />
        {touched.additionalRequest && errors.additionalRequest ? (
          <p className="contact-error">{errors.additionalRequest}</p>
        ) : null}

        <label className="contact-label" htmlFor="job-input-email">
          이메일
        </label>
        <input
          id="job-input-email"
          className="contact-input"
          type="email"
          name="email"
          placeholder="리포트를 받으실 이메일을 입력해주세요"
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
          {isPaying ? '결제창 여는 중...' : '내 커리어 리스크 진단받기(3,000원)'}
        </button>
      </form>
    </section>
  )
}

export default JobInputForm
