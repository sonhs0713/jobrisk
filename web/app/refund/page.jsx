import SiteHeader from '../../components/SiteHeader'
import SiteFooter from '../../components/SiteFooter'

export default function RefundPage() {
  return (
    <>
      <SiteHeader />
      <main className="policy-page">
        <section className="policy-card">
          <p className="eyebrow">Refund</p>
          <h1>환불 정책</h1>
          <p>
            결제가 정상적으로 완료되었지만 리포트가 열리지 않거나 중대한 서비스 장애가 발생한 경우,
            확인 후 환불 또는 재제공을 진행합니다.
          </p>
          <p>
            단순 변심 또는 사용자의 주관적 해석 차이만으로는 환불이 제한될 수 있으며, 자세한 문의는{' '}
            <a href="mailto:getmuno@gmail.com">getmuno@gmail.com</a>으로 접수해 주세요.
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
