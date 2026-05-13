function Solution() {
  const features = [
    {
      title: '직무군 맥락',
      description: '공고에서 직무 단서를 잡고, 그 직무에 맞게 문장을 읽습니다',
    },
    {
      title: '물경력 5개 축(유료)',
      description: '반복 비중·책임 범위·성과 측정·난이도·전이 역량을 축별로 정리합니다',
    },
    {
      title: '무료 미리보기(감지)',
      description: '한 줄·근거 1개·짧은 이유·확인 질문 1개로 먼저 감지합니다',
    },
    {
      title: '면접 가이드(유료)',
      description: '확인할 질문과 괜찮은 답·추가 확인이 필요한 답을 짧게 붙입니다',
    },
  ]

  return (
    <section className="solution-section">
      <h2 className="solution-title">JOBRISK가 하는 일</h2>
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
