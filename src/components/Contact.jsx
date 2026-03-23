import { useState } from 'react'

function Contact() {
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()

    const endpoint = import.meta.env.VITE_FORMSPREE_ENDPOINT
    if (!endpoint) {
      setErrorMessage('문의 설정이 아직 완료되지 않았습니다. 관리자에게 문의해주세요.')
      return
    }

    const formData = new FormData(event.currentTarget)

    try {
      setIsSubmitting(true)
      setErrorMessage('')

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

      setSubmitted(true)
    } catch {
      setErrorMessage('문의 전송 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="contact-section">
      <h2 className="contact-title">추가 문의</h2>
      <p className="contact-subtitle">
        FAQ로 해결되지 않은 궁금한 점이 있으시면 남겨주세요
      </p>

      {submitted ? (
        <div className="contact-success">
          문의가 접수되었습니다.
          <br />
          빠른 시일 내에 답변드릴게요
        </div>
      ) : (
        <form className="contact-form" onSubmit={handleSubmit}>
          <label className="contact-label" htmlFor="contact-name">
            이름
          </label>
          <input
            id="contact-name"
            className="contact-input"
            type="text"
            name="name"
            required
          />

          <label className="contact-label" htmlFor="contact-email">
            이메일
          </label>
          <input
            id="contact-email"
            className="contact-input"
            type="email"
            name="email"
            required
          />

          <label className="contact-label" htmlFor="contact-message">
            문의 내용
          </label>
          <textarea
            id="contact-message"
            className="contact-textarea"
            name="message"
            rows="6"
            required
          />

          {errorMessage ? <p className="contact-error">{errorMessage}</p> : null}

          <button type="submit" className="hero-button contact-submit" disabled={isSubmitting}>
            {isSubmitting ? '전송 중...' : '문의 보내기'}
          </button>
        </form>
      )}
    </section>
  )
}

export default Contact
