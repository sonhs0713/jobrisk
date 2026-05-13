import { Link } from 'react-router-dom'

const TERMS_SECTIONS = [
  {
    title: '제1조 (목적)',
    body: [
      '본 약관은 muno(이하 "회사")가 제공하는 채용공고 기반 물경력 가능성 점검 서비스 JOBRISK(이하 "서비스") 이용에 관한 조건 및 절차를 규정함을 목적으로 합니다.',
    ],
  },
  {
    title: '제2조 (서비스 내용)',
    body: [
      '서비스는 이용자가 제공한 채용공고 텍스트를 바탕으로, 물경력으로 이어질 가능성을 점검·정리하는 프리토타입 기능을 제공합니다.',
      '회사는 블랙기업 여부, 적정 연봉, 합격·불합격, 회사의 선악 등을 판정하거나 보장하지 않습니다. 결과는 지원 전 확인을 돕기 위한 참고 정보입니다.',
    ],
  },
  {
    title: '제3조 (결제 및 환불)',
    list: [
      '유료 상세 분석 이용료는 사전 고지된 금액(현재 3,000원)을 따릅니다.',
      '이용자가 유료 상세 분석 내용을 확인하기 전에는 전액 환불을 원칙으로 합니다. 확인 후에는 디지털 콘텐츠 특성상 환불이 제한될 수 있습니다.',
      '환불·과금 문의는 회사가 안내하는 이메일 등 고객 채널로 접수합니다.',
    ],
  },
  {
    title: '제4조 (개인정보 및 데이터)',
    body: [
      '서비스는 공고 분석을 위해 필요한 범위에서 텍스트를 처리합니다. 브라우저 저장소(sessionStorage 등)에 입력 내용이 남을 수 있으며, 결제·문의 과정에서 이용자가 입력한 정보가 제3자 결제·알림 도구로 전달될 수 있습니다. 구체적인 보관 기간·항목은 해당 시점의 개인정보 처리방침 및 운영 설정을 따릅니다.',
    ],
  },
  {
    title: '제5조 (면책)',
    body: [
      '분석 결과는 AI 및 규칙 기반으로 생성되며, 100%의 정확성·완전성을 보장하지 않습니다. 이용자는 결과를 참고하여 스스로 지원 여부를 판단해야 합니다.',
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
        <p className="terms-legal-note">
          [검토 필요] 법무·세무 확정 전 초안입니다. 정식 서비스 오픈 시 변호사 검토를 권장합니다.
        </p>
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
