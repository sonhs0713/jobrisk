function Pricing({ onPayClick, isPaying }) {
  return (
    <section className="pricing-section">
      <h2 className="pricing-title">얼리버드 한정 혜택</h2>

      <div className="pricing-card">
        <div className="pricing-meta">
          <p className="pricing-launch-text">🕐 얼리버드 20명 등록 완료 시 즉시 오픈 예정</p>
          <p className="pricing-limited-text">⚡ 얼리버드 20명 한정 · 현재 [N]명 등록 완료</p>
        </div>
        <p className="pricing-early">3,000원</p>
        <p className="pricing-regular">
          정식 출시 예정가 <span>월 9,900원</span>
        </p>
        <p className="pricing-guarantee-strong">
          분석 결과가 마음에 안 드시면 이유 불문 즉시 전액 환불해드립니다
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
          ✓ 즉시 환불 보장 &nbsp; ✓ 개인정보 저장 없음 &nbsp; ✓ 1분 내 신청 완료
        </p>
      </div>
    </section>
  )
}

export default Pricing
