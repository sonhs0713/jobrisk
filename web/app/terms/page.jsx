import SiteHeader from '../../components/SiteHeader'
import SiteFooter from '../../components/SiteFooter'

export default function TermsPage() {
  return (
    <>
      <SiteHeader />
      <main className="policy-page">
        <section className="policy-card">
          <p className="eyebrow">Terms</p>
          <h1>이용약관</h1>
          <p>
            JobRisk는 채용공고 원문을 바탕으로 물경력 가능성을 해석해 주는 참고 서비스입니다. 서비스
            결과는 최종 입사 판단을 대신하지 않으며, 사용자는 실제 지원 전 면접과 추가 검증을 통해
            판단해야 합니다.
          </p>
          <p>
            결제, 환불, 서비스 이용과 관련한 문의는 <a href="mailto:getmuno@gmail.com">getmuno@gmail.com</a>으로
            접수할 수 있습니다.
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
