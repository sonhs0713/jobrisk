function Problem() {
  return (
    <section className="problem-section">
      <h2 className="problem-title">다들 한 번씩은 겪어봤을 겁니다
      </h2>
      <div className="problem-grid">
        <article className="problem-card">
          <span className="problem-icon" role="img" aria-label="warning">
            🚨
          </span>
          <h3 className="problem-card-title">야근·물경력, 공고만 봐서는 알 수 없습니다</h3>
          <p className="problem-card-description">
            &apos;자율적인 분위기&apos;, &apos;오너십 발휘&apos;.
            <br />
            좋은 말 뒤에 숨겨진 신호를
            <br />
            채용공고 문구에서 먼저 찾아드립니다
          </p>
        </article>

        <article className="problem-card">
          <span className="problem-icon" role="img" aria-label="chart">
            📉
          </span>
          <h3 className="problem-card-title">잡플래닛 4점도 믿을 수 없습니다</h3>
          <p className="problem-card-description">
            평점 높아서 지원했는데
            <br />
            막상 입사해보니 야근에 물경력.
            <br />
            후기는 재직자가 쓰고
            <br />
            채용공고는 회사가 직접 씁니다
          </p>
        </article>

        <article className="problem-card">
          <span className="problem-icon" role="img" aria-label="money">
            💰
          </span>
          <h3 className="problem-card-title">연봉은 왜 항상 내가 먼저 써야 할까요</h3>
          <p className="problem-card-description">
            희망연봉을 낮게 쓰면 손해,
            <br />
            높게 쓰면 탈락.
            <br />
            적정 연봉이 얼마인지 모르면
            <br />
            항상 끌려다닐 수밖에 없습니다
          </p>
        </article>
      </div>
    </section>
  )
}

export default Problem
