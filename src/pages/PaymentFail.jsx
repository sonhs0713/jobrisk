import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'

function PaymentFail() {
  const location = useLocation()
  const { resultCode, resultMessage } = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return {
      resultCode: params.get('res_cd') || '',
      resultMessage: params.get('res_msg') || '',
    }
  }, [location.search])

  return (
    <main className="status-page">
      <div className="status-card">
        <h1 className="status-title">결제가 완료되지 않았습니다.</h1>
        <p className="status-description">
          잠시 후 다시 시도해주세요.
          {resultCode ? ` (코드: ${resultCode})` : ''}
        </p>
        {resultMessage ? <p className="status-description">{resultMessage}</p> : null}
      </div>
    </main>
  )
}

export default PaymentFail
