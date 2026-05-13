function Problem() {
  return (
    <section id="problem-section" className="problem-section">
      <h2 className="problem-title">공고만으로는 역할의 전부가 보이지 않을 때가 있습니다</h2>
      <div className="problem-grid">
        <article className="problem-card">
          <span className="problem-icon" role="img" aria-label="document">
            📄
          </span>
          <h3 className="problem-card-title">멋진 문장과 실제 업무 사이</h3>
          <p className="problem-card-description">
            &apos;오너십&apos;, &apos;빠른 실행&apos; 같은 표현만으로는
            <br />
            반복 운영인지 성과 책임인지 경계가 드러나지 않을 수 있습니다
          </p>
        </article>

        <article className="problem-card">
          <span className="problem-icon" role="img" aria-label="compass">
            🧭
          </span>
          <h3 className="problem-card-title">같은 단어도 직무에 따라 다릅니다</h3>
          <p className="problem-card-description">
            같은 &apos;운영&apos;이라도
            <br />
            직무 맥락에 따라 물경력 신호로 읽을지,
            <br />
            경력 자산으로 읽을지가 달라질 수 있습니다
          </p>
        </article>

        <article className="problem-card">
          <span className="problem-icon" role="img" aria-label="check">
            ✅
          </span>
          <h3 className="problem-card-title">지원 전에 질문 포인트를 잡습니다</h3>
          <p className="problem-card-description">
            JOBRISK는 회사를 단정하지 않고
            <br />
            공고 문장을 기준으로 물경력 가능성을
            <br />
            같은 틀로 먼저 점검합니다
          </p>
        </article>
      </div>
    </section>
  )
}

export default Problem
