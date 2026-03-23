import { Link } from 'react-router-dom'

const TERMS_SECTIONS = [
  {
    title: '제1조 (목적)',
    body: [
      '본 약관은 muno(이하 "회사")가 제공하는 채용공고 분석 서비스(이하 "서비스") 이용에 관한 조건 및 절차를 규정함을 목적으로 합니다.',
    ],
  },
  {
    title: '제2조 (서비스 내용)',
    body: ['회사는 채용공고 분석 및 커리어 적합성 진단 서비스를 제공합니다.'],
  },
  {
    title: '제3조 (결제 및 환불)',
    list: [
      '서비스 이용료는 3,000원입니다.',
      '서비스 결과물이 만족스럽지 않을 경우 이유 불문 전액 환불해드립니다.',
      '환불 요청은 이메일로 접수해주세요.',
    ],
  },
  {
    title: '제4조 (개인정보)',
    body: ['회사는 서비스 제공을 위해 수집한 개인정보를 제3자에게 제공하지 않습니다.'],
  },
  {
    title: '제5조 (면책조항)',
    body: [
      '본 서비스의 분석 결과는 AI 기반 확률적 판단이며, 100% 정확성을 보장하지 않습니다.',
    ],
  },
]

function Terms() {
  return (
    <main className="terms-page">
      <section className="terms-card">
        <Link to="/" className="terms-back-link">
          ← 돌아가기
        </Link>
        <h1 className="terms-title">이용약관</h1>
        <div className="terms-sections">
          {TERMS_SECTIONS.map((section) => (
            <article key={section.title} className="terms-section">
              <h2 className="terms-section-title">{section.title}</h2>
              {section.body?.map((paragraph) => (
                <p key={paragraph} className="terms-section-body">
                  {paragraph}
                </p>
              ))}
              {section.list ? (
                <ul className="terms-section-list">
                  {section.list.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}

export default Terms
