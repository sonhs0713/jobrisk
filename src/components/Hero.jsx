function Hero({ onPayClick, isPaying }) {
  return (
    <section className="hero-section">
      <div className="hero-content">
        <p className="hero-eyebrow">AI 채용공고 리스크 분석</p>
        <h1 className="hero-title">
          공고 읽는 데 30분 <br />
          후회하는 데 1년 <br />
          판단은 AI에게 맡기세요 <br />
        </h1>
        <p className="hero-subtitle">
          잘못된 이직 한 번이 1~2년 커리어를 날립니다.
          <br />
          채용공고에 숨겨진 위험 신호를 AI가 먼저 찾아드립니다
        </p>
        <button type="button" className="hero-button" onClick={onPayClick} disabled={isPaying}>
          {isPaying
            ? '결제창 여는 중...'
            : '내 커리어 지키기 (얼리버드 3,000원)'}
        </button>
        <div className="hero-meta">
          <p className="hero-launch-text">🕐 얼리버드 20명 등록 완료 시 즉시 오픈 예정</p>
          <p className="hero-limited-text">⚡ 얼리버드 20명 한정 · 현재 [N]명 등록 완료</p>
        </div>
      </div>
    </section>
  )
}

export default Hero
