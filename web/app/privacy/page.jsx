import SiteHeader from '../../components/SiteHeader'
import SiteFooter from '../../components/SiteFooter'

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className="policy-page">
        <section className="policy-card">
          <p className="eyebrow">Privacy</p>
          <h1>개인정보처리방침</h1>
          <p>
            JobRisk는 서비스 제공과 결제 확인, 문의 대응에 필요한 최소한의 정보만 처리합니다. 입력된
            채용공고 원문과 이메일은 분석 제공, 결제 확인, 고객지원 목적 범위에서만 사용합니다.
          </p>
          <p>
            개인정보 처리 관련 문의는 <a href="mailto:getmuno@gmail.com">getmuno@gmail.com</a>으로 요청할 수
            있습니다.
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
