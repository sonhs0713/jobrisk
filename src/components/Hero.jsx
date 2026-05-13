function Hero({ onPayClick }) {
  return (
    <section className="hero-section">
      <div className="hero-content">
        <p className="hero-eyebrow">채용공고 · 물경력 가능성</p>
        <h1 className="hero-title">
          공고는 짧게 쓰이고,
          <br />
          경력은 길게 남습니다
          <br />
          지원 전에 물경력 가능성부터 점검하세요
        </h1>
        <p className="hero-subtitle">
          좋아 보이는 공고도 반복 운영·보조 업무 중심일 수 있어요. JOBRISK는 같은 기준으로 공고 문장을 읽고, 면접에서 확인할
          질문까지 정리해 드립니다.
        </p>
        <button type="button" className="hero-button" onClick={onPayClick}>
          무료 미리보기 후 상세 분석 (얼리버드 3,000원)
        </button>
        <div className="hero-meta">
          <p className="hero-refund-note">
            상세 분석을 열어보기 전에는 전액 환불 가능합니다.
            <br />
            확인 후에는 환불이 어려울 수 있습니다.
            <br />
            환불 문의: sonhs0713@gmail.com
          </p>
        </div>
      </div>
    </section>
  )
}

export default Hero
