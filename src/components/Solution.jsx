function Solution() {
  const features = [
    {
      title: '물경력 위험도 분석',
      description: '공고 문구에서 위험 신호를 찾아냅니다',
    },
    {
      title: '커리어 패스 적합성',
      description: '이 포지션이 내 커리어에 맞는지 알려줍니다',
    },
    {
      title: '적정 연봉 추정',
      description: '연봉 미기재 공고의 적정 금액을 추정해드립니다',
    },
    {
      title: '면접 필수 질문',
      description: '입사 전 반드시 확인해야 할 질문 리스트',
    },
  ]

  return (
    <section className="solution-section">
      <h2 className="solution-title">이런 분석을 해드립니다</h2>
      <ol className="solution-list">
        {features.map((feature, index) => (
          <li className="solution-item" key={feature.title}>
            <span className="solution-number">{String(index + 1).padStart(2, '0')}</span>
            <div>
              <p className="solution-item-title">{feature.title}</p>
              <p className="solution-item-description">- {feature.description}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

export default Solution
