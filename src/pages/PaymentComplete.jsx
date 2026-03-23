import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

function PaymentComplete() {
  const navigate = useNavigate()
  const location = useLocation()
  const startedRef = useRef(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    const savePaymentAndRedirect = async () => {
      const endpoint =
        import.meta.env.VITE_FORMSPREE_PAYMENT_ENDPOINT ||
        import.meta.env.VITE_FORMSPREE_ENDPOINT
      if (!endpoint) {
        setErrorMessage('결제 저장 설정이 없습니다. 관리자에게 문의해주세요.')
        return
      }

      const params = new URLSearchParams(location.search)
      const orderId = params.get('orderId')
      const amount = params.get('amount')
      const paymentKey = params.get('paymentKey')

      if (!orderId || !amount || !paymentKey) {
        setErrorMessage('결제 완료 정보를 확인할 수 없습니다.')
        return
      }

      const email = sessionStorage.getItem('earlybird_customer_email') || ''

      const formData = new FormData()
      formData.append('event', 'payment_completed')
      formData.append('email', email)
      formData.append('paidAt', new Date().toISOString())
      formData.append('amount', amount)
      formData.append('orderId', orderId)

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
          },
          body: formData,
        })

        if (!response.ok) {
          throw new Error('save_failed')
        }

        sessionStorage.removeItem('earlybird_customer_email')
        navigate('/thank-you', { replace: true })
      } catch {
        setErrorMessage('결제 정보 저장에 실패했습니다. 잠시 후 다시 시도해주세요.')
      }
    }

    savePaymentAndRedirect()
  }, [location.search, navigate])

  return (
    <main className="status-page">
      <div className="status-card">
        {errorMessage ? (
          <>
            <h1 className="status-title">저장 중 문제가 발생했습니다.</h1>
            <p className="status-description">{errorMessage}</p>
          </>
        ) : (
          <>
            <h1 className="status-title">결제 정보를 저장하고 있습니다.</h1>
            <p className="status-description">잠시만 기다려주세요...</p>
          </>
        )}
      </div>
    </main>
  )
}

export default PaymentComplete
