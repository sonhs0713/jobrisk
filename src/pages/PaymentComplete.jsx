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
      const paymentId = params.get('paymentId') || sessionStorage.getItem('earlybird_payment_id') || ''
      const orderId = params.get('orderId') || sessionStorage.getItem('earlybird_order_id') || ''
      const amount = params.get('amount') || sessionStorage.getItem('earlybird_amount') || ''

      if (!paymentId || !orderId || !amount) {
        setErrorMessage('결제 확인 정보가 누락되었습니다. 다시 시도해주세요.')
        return
      }

      let verified
      try {
        const verifyResponse = await fetch('/api/payments/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            paymentId,
            orderId,
            amount: Number(amount),
          }),
        })

        verified = await verifyResponse.json()
      } catch {
        const failQuery = new URLSearchParams()
        failQuery.set('res_cd', 'VERIFY_REQUEST_FAILED')
        failQuery.set('res_msg', '결제 검증 요청에 실패했습니다.')
        navigate(`/payment-fail?${failQuery.toString()}`, { replace: true })
        return
      }

      if (!verified?.ok || !verified?.isPaid) {
        const failQuery = new URLSearchParams()
        failQuery.set('res_cd', verified?.code || 'VERIFY_FAILED')
        failQuery.set('res_msg', verified?.message || '결제 검증에 실패했습니다.')
        navigate(`/payment-fail?${failQuery.toString()}`, { replace: true })
        return
      }

      const email = sessionStorage.getItem('earlybird_customer_email') || ''
      const jobPostingText = sessionStorage.getItem('earlybird_job_posting_text') || ''
      const additionalRequest = sessionStorage.getItem('earlybird_additional_request') || ''
      const paymentCompletedAt = new Date().toISOString()

      const formData = new FormData()
      formData.append('event', 'payment_completed')
      formData.append('_subject', '[muno] 결제 완료 및 분석 요청')
      formData.append('email', email)
      formData.append('paymentCompletedAt', paymentCompletedAt)
      formData.append('amount', String(verified.amount || amount))
      formData.append('orderId', String(verified.orderId || orderId))
      formData.append('transactionId', String(verified.transactionId || paymentId))
      formData.append('paymentId', String(paymentId))
      formData.append('jobPostingText', jobPostingText)
      formData.append('additionalRequest', additionalRequest)

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
        sessionStorage.removeItem('earlybird_payment_id')
        sessionStorage.removeItem('earlybird_order_id')
        sessionStorage.removeItem('earlybird_amount')
        sessionStorage.removeItem('earlybird_job_posting_text')
        sessionStorage.removeItem('earlybird_additional_request')
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
