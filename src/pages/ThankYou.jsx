import { Link } from 'react-router-dom'

function ThankYou() {
  return (
    <main className="status-page">
      <div className="status-card">
        <h1 className="status-title">결제가 완료되었습니다.</h1>
        <p className="status-description">
          랜딩 페이지로 돌아가 같은 브라우저에서 미리보기 영역을 열면, 결제 직후 물경력 상세 분석을 이어서 확인할 수 있어요.
          <br />
          (결제 직후 자동으로 열리지 않으면 메인의 공고 입력·미리보기 흐름을 한 번 더 눌러 주세요.)
          <br />
          문의: sonhs0713@gmail.com
        </p>
        <Link to="/" className="hero-button status-home-button">
          메인으로 돌아가기
        </Link>
      </div>
    </main>
  )
}

export default ThankYou
