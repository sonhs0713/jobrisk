import { useState } from 'react'

/** 랜딩·기타 화면 공통 FAQ 데이터 (단일 소스) */
export const FAQ_ITEMS = [
  {
    question: 'AI 분석이라 정확한가요?',
    answer:
      '100% 단정하지 않습니다. 채용공고에서 반복 운영·보조성 단서, 책임 범위, 성과 지표 여부를 같은 틀로 읽고, 근거가 약하면 추가 확인 필요 톤으로 남깁니다. 현재 프리토타입은 물경력 가능성과 면접에서 물어볼 질문에 집중합니다.',
  },
  {
    question: 'ChatGPT에 물어보면 안 되나요?',
    answer:
      '직접 질문할 수도 있습니다. JOBRISK는 매 공고마다 같은 다섯 축과 직무군 맥락으로 물경력 가능성을 짚고, 무료에서는 한 줄·근거 1개·짧은 이유·확인 질문 1개로 감지해 드립니다. 유료에서는 같은 틀을 더 풀어 면접 가이드까지 이어집니다.',
  },
  {
    question: '환불은 어떻게 하나요?',
    answer:
      '상세 분석 화면을 열어보기 전에는 전액 환불 가능합니다. 확인 후에는 디지털 콘텐츠 특성상 환불이 어려울 수 있어요. 환불 문의는 getmuno@gmail.com으로 연락 주세요.',
  },
  {
    question: '입력한 공고나 개인정보가 저장되나요?',
    answer:
      '무료 미리보기는 브라우저에서 서버로 공고 본문을 보내 분석하고, 같은 브라우저의 sessionStorage에 공고 텍스트가 남을 수 있습니다(결제 후 돌아와 결과를 다시 열 때 등). 결제 완료 시 운영 중인 알림(예: Formspree)으로 결제·공고 관련 필드가 전송되면, 그 제3자 서비스의 저장 정책이 적용됩니다. 서버의 미리보기 API는 코드상 요청 단위로 처리하는 프로토타입이며, 별도의 영구 DB에 공고를 쌓는 흐름은 전제로 하지 않습니다. 문의 폼으로 보낸 내용은 문의 처리 목적에 한해 해당 채널 정책을 따릅니다.',
  },
]

/**
 * @param {{ variant?: 'landing' | 'standalone' }}=} props
 * - landing: App 랜딩(.landing-page) 안에서 쓰는 섹션 레이아웃·아코디언 스타일
 * - standalone: 섹션 제목만 두른 단독 블록
 */
function FAQ({ variant = 'standalone' }) {
  const [openIndex, setOpenIndex] = useState(0)

  const toggleItem = (index) => {
    setOpenIndex((prev) => (prev === index ? -1 : index))
  }

  if (variant === 'landing') {
    return (
      <section className="faq-section">
        <div className="section-label section-centered">자주 묻는 질문</div>
        <h2 className="section-title faq-title-custom section-centered">궁금한 점이 있으신가요</h2>

        {FAQ_ITEMS.map((item, index) => {
          const isOpen = openIndex === index
          return (
            <div className={`faq-item${isOpen ? ' open' : ''}`} key={item.question}>
              <button type="button" className="faq-question" onClick={() => toggleItem(index)} aria-expanded={isOpen}>
                {item.question}
                <span className="faq-icon" aria-hidden="true">
                  +
                </span>
              </button>
              <div className="faq-answer">{item.answer}</div>
            </div>
          )
        })}
      </section>
    )
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
                <span>
                  Q{index + 1}. {item.question}
                </span>
                <span className="faq-toggle-icon" aria-hidden="true">
                  {isOpen ? '−' : '+'}
                </span>
              </button>

              {isOpen ? (
                <p className="faq-answer">
                  A{index + 1}. {item.answer}
                </p>
              ) : null}
            </article>
          )
        })}
      </div>
    </section>
  )
}

export default FAQ
