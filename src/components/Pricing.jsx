function Pricing({ onPayClick, isPaying }) {
  return (
    <section className="pricing-section">
      <h2 className="pricing-title">무료 미리보기 → 상세 분석</h2>

      <div className="pricing-card">
        <div className="pricing-meta">
          <p className="pricing-launch-text">얼리버드 한정 · 물경력 가능성 상세 분석</p>
        </div>
        <p className="pricing-early">3,000원</p>
        <p className="pricing-regular">
          정식 출시 예정가 <span>월 9,900원</span>
        </p>
        <p className="pricing-guarantee-strong">
          <span className="pricing-check-item">
            <span className="pricing-check-mark">✓</span> 결제 직후 이 페이지에서 상세 결과 확인
          </span>
          <span className="pricing-check-item">
            <span className="pricing-check-mark">✓</span> 직무군 · 5개 축 · 근거 · 면접 가이드
          </span>
          <span className="pricing-check-item">
            <span className="pricing-check-mark">✓</span> 정식 서비스 출시 시 혜택 안내(예정)
          </span>
        </p>
        <button type="button" className="hero-button pricing-button" onClick={onPayClick} disabled={isPaying}>
          {isPaying ? '결제창 여는 중...' : '3,000원으로 물경력 상세 분석 보기'}
        </button>
        <p className="pricing-checks">
          상세 분석을 열어보기 전에는 전액 환불 가능합니다.
          <br />
          확인 후에는 환불이 어려울 수 있습니다.
          <br />
          환불 문의: sonhs0713@gmail.com
        </p>
        <div className="pricing-service-info">
          <p>서비스 내용: 채용공고 1건 기준 물경력 가능성 상세 분석</p>
          <p>금액: 3,000원 (1회)</p>
          <p>결과 확인: 결제 직후 웹 화면에서 즉시</p>
        </div>
      </div>
    </section>
  )
}

export default Pricing
