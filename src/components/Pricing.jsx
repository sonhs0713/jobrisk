function Pricing({ onPayClick, isPaying }) {
  return (
    <section className="pricing-section">
      <h2 className="pricing-title">얼리버드 한정 혜택</h2>

      <div className="pricing-card">
        <div className="pricing-meta">
          <p className="pricing-launch-text">🕐 얼리버드 20명 등록 완료 시 즉시 오픈 예정</p>
        </div>
        <p className="pricing-early">3,000원</p>
        <p className="pricing-regular">
          정식 출시 예정가 <span>월 9,900원</span>
        </p>
        <p className="pricing-guarantee-strong">
          <span className="pricing-check-item">
            <span className="pricing-check-mark">✓</span> 채용공고 AI 분석 리포트 1회 제공
          </span>
          <span className="pricing-check-item">
            <span className="pricing-check-mark">✓</span> 정식 서비스 출시 시 1개월 무료 체험권 증정
          </span>
          <span className="pricing-check-item">
            <span className="pricing-check-mark">✓</span> 얼리버드 전용 혜택 우선 안내
          </span>
        </p>
        <button
          type="button"
          className="hero-button pricing-button"
          onClick={onPayClick}
          disabled={isPaying}
        >
          {isPaying ? '결제창 여는 중...' : '내 커리어 지키기'}
        </button>
        <p className="pricing-checks">
          리포트를 받으시기 전에는 전액 환불 가능합니다.
          <br />
          리포트 수령 후에는 환불이 어렵습니다.
          <br />
          환불 문의: sonhs0713@gmail.com
        </p>
        <div className="pricing-service-info">
          <p>서비스 내용: 채용공고 AI 분석 리포트 1회 제공</p>
          <p>금액: 3,000원 (1회)</p>
          <p>제공 기간: 결제 후 1시간 이내</p>
          <p>(평일 오전 10시 ~ 오후 6시 기준)</p>
        </div>
      </div>
    </section>
  )
}

export default Pricing
