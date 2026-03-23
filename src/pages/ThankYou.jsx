import { Link } from 'react-router-dom'

function ThankYou() {
  return (
    <main className="status-page">
      <div className="status-card">
        <h1 className="status-title">등록이 완료되었습니다.</h1>
        <p className="status-description">
          서비스 오픈 시 가장 먼저 연락드릴게요.
        </p>
        <Link to="/" className="hero-button status-home-button">
          메인으로 돌아가기
        </Link>
      </div>
    </main>
  )
}

export default ThankYou
