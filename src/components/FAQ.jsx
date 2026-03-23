import { useState } from 'react'

const FAQ_ITEMS = [
  {
    question: 'AI 분석이라 정확한가요?',
    answer: '아래 기준으로 분석합니다.',
    points: [
      '사람이 혼자 공고를 읽을 때 놓치기 쉬운 물경력 신호, 연봉 정보 비대칭, 조직 문화 위험 요소를 체계적인 기준으로 짚어드립니다.',
      '쓸수록 똑똑해집니다. 실제 입사 경험 피드백을 쌓아 더 정확한 분석을 만들어갑니다.',
    ],
  },
  {
    question: 'ChatGPT에 물어보면 안 되나요?',
    answer: '가능하지만 세 가지가 달라요.',
    points: [
      '첫째, 매번 내 경력과 조건을 설명할 필요가 없어요. 한 번 입력해두면 모든 공고에 자동으로 대조 분석해드립니다.',
      '둘째, 물경력 위험도·적정 연봉·면접 질문이 매번 동일한 형식의 리포트로 나와요. 여러 공고를 나란히 비교하기 쉽습니다.',
      '셋째, 분석 히스토리가 저장돼요. 과거에 본 공고와 오늘 본 공고를 언제든 꺼내서 비교할 수 있습니다.',
    ],
  },
  {
    question: '환불은 어떻게 하나요?',
    answer:
      '결제 후 분석 결과가 마음에 안 드시면 이유 불문 즉시 전액 환불해드립니다. 문의는 이메일로 해주세요',
  },
  {
    question: '내 이력서 정보가 저장되나요?',
    answer:
      '입력하신 경력 정보는 분석에 사용됩니다.\n향후 본인이 원하실 경우 검증된 채용담당자와 매칭되는 기능이 추가될 예정입니다. 매칭 기능은 반드시 본인 동의 후에만 진행됩니다.',
  },
]

function FAQ() {
  const [openIndex, setOpenIndex] = useState(0)

  const toggleItem = (index) => {
    setOpenIndex((prev) => (prev === index ? -1 : index))
  }

  return (
    <section className="faq-section">
      <h2 className="faq-title">자주 묻는 질문</h2>

      <div className="faq-list">
        {FAQ_ITEMS.map((item, index) => {
          const isOpen = openIndex === index
          return (
            <article className="faq-item" key={item.question}>
              <button
                type="button"
                className="faq-question"
                onClick={() => toggleItem(index)}
                aria-expanded={isOpen}
              >
                <span>Q{index + 1}. {item.question}</span>
                <span className="faq-toggle-icon" aria-hidden="true">
                  {isOpen ? '−' : '+'}
                </span>
              </button>

              {isOpen &&
                (item.points ? (
                  <div className="faq-answer">
                    <p className="faq-answer-intro">A{index + 1}. {item.answer}</p>
                    <ul className="faq-answer-list">
                      {item.points.map((point) => (
                        <li key={point}>{point}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="faq-answer">A{index + 1}. {item.answer}</p>
                ))}
            </article>
          )
        })}
      </div>
    </section>
  )
}

export default FAQ
