import { useMemo, useState } from 'react'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function EmailModal({
  isOpen,
  email,
  onEmailChange,
  onClose,
  onSubmit,
  isSubmitting,
}) {
  const [error, setError] = useState('')

  const isEmailEmpty = useMemo(() => email.trim().length === 0, [email])

  if (!isOpen) return null

  const handleSubmit = async (event) => {
    event.preventDefault()

    const trimmedEmail = email.trim()
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setError('올바른 이메일 주소를 입력해주세요')
      return
    }

    setError('')
    await onSubmit(trimmedEmail)
  }

  const handleInputChange = (event) => {
    onEmailChange(event.target.value)
    if (error) setError('')
  }

  return (
    <div className="email-modal-overlay" onClick={onClose}>
      <div className="email-modal" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          className="email-modal-close"
          onClick={onClose}
          aria-label="모달 닫기"
        >
          ×
        </button>

        <h2 className="email-modal-title">서비스 오픈 시 가장 먼저 알려드릴게요</h2>
        <p className="email-modal-description">
          이메일을 입력하시면 결제 완료 후
          <br />
          서비스 오픈 소식을 가장 먼저 받아보실 수 있습니다
        </p>

        <form className="email-modal-form" onSubmit={handleSubmit}>
          <label className="contact-label" htmlFor="payment-email">
            이메일
          </label>
          <input
            id="payment-email"
            className="contact-input email-modal-input"
            type="email"
            value={email}
            onChange={handleInputChange}
            required
          />

          {error ? <p className="contact-error">{error}</p> : null}

          <button
            type="submit"
            className="hero-button email-modal-submit"
            disabled={isEmailEmpty || isSubmitting}
          >
            {isSubmitting ? '결제창 여는 중...' : '결제하기'}
          </button>
          <p className="email-modal-footnote">
            ✓ 스팸 없음 &nbsp; ✓ 언제든 수신 거부 가능
          </p>
        </form>
      </div>
    </div>
  )
}

export default EmailModal
