import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { Link } from 'react-router-dom'

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
        <div style={{ marginTop: 24, display: 'grid', gap: 10, justifyItems: 'center' }}>
          <Link to="/#result" className="hero-button status-home-button">
            이전 결과로 돌아가기
          </Link>
          <Link to="/#form" className="terms-back-link">
            다시 입력하기
          </Link>
        </div>
      </div>
    </main>
  )
}

export default PaymentFail
