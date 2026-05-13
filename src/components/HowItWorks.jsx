function HowItWorks() {
  return (
    <section className="how-it-works-section">
      <h2 className="how-it-works-title">사용 방법은 간단합니다</h2>

      <div className="how-it-works-grid">
        <article className="how-it-works-card">
          <p className="how-it-works-step">01</p>
          <h3 className="how-it-works-card-title">채용공고를 붙여넣습니다</h3>
          <p className="how-it-works-card-description">지원을 고려 중인 공고 본문을 그대로 넣으면 됩니다</p>
        </article>

        <span className="how-it-works-arrow" aria-hidden="true">
          →
        </span>

        <article className="how-it-works-card">
          <p className="how-it-works-step">02</p>
          <h3 className="how-it-works-card-title">무료 미리보기로 물경력 가능성을 봅니다</h3>
          <p className="how-it-works-card-description">
            한 줄 결론, 핵심 근거 1개, 짧은 이유, 확인 질문 1개까지 같은 기준으로 감지합니다
          </p>
        </article>

        <span className="how-it-works-arrow" aria-hidden="true">
          →
        </span>

        <article className="how-it-works-card">
          <p className="how-it-works-step">03</p>
          <h3 className="how-it-works-card-title">필요하면 상세 분석을 엽니다</h3>
          <p className="how-it-works-card-description">
            결제 후 이 페이지에서 5개 축·근거·면접 질문과 답변 가이드를 바로 이어서 볼 수 있어요
          </p>
        </article>
      </div>
    </section>
  )
}

export default HowItWorks
