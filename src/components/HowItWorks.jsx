function HowItWorks() {
  return (
    <section className="how-it-works-section">
      <h2 className="how-it-works-title">사용 방법은 간단합니다</h2>

      <div className="how-it-works-grid">
        <article className="how-it-works-card">
          <p className="how-it-works-step">01</p>
          <h3 className="how-it-works-card-title">
            내 경력과 선호 조건을 입력합니다
          </h3>
          <p className="how-it-works-card-description">
            현재 연차, 희망 연봉, 피하고 싶은 조건을 입력합니다
          </p>
        </article>

        <span className="how-it-works-arrow" aria-hidden="true">
          →
        </span>

        <article className="how-it-works-card">
          <p className="how-it-works-step">02</p>
          <h3 className="how-it-works-card-title">채용공고를 붙여넣습니다</h3>
          <p className="how-it-works-card-description">
            지원하려는 공고 텍스트를 그대로 복사해서 넣으면 됩니다
          </p>
        </article>

        <span className="how-it-works-arrow" aria-hidden="true">
          →
        </span>

        <article className="how-it-works-card">
          <p className="how-it-works-step">03</p>
          <h3 className="how-it-works-card-title">AI 분석 리포트를 받습니다</h3>
          <p className="how-it-works-card-description">
            물경력 위험도, 적정 연봉, 면접 필수 질문을 정리해드립니다
          </p>
        </article>
      </div>
    </section>
  )
}

export default HowItWorks
