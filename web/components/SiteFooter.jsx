import Link from 'next/link'
import LogoMark from './LogoMark'

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-brand-block">
          <LogoMark tone="light" className="site-footer-logo" />
        </div>

        <div className="site-footer-info">
          <div className="site-footer-meta">
            <p>사업자등록번호: 678-17-02416</p>
            <p>대표 문의: getmuno@gmail.com</p>
            <p>전화: 010-7239-0713</p>
            <p>대표: 손현수</p>
            <p>주소: 경기도 성남시 분당구 불정로 361</p>
          </div>

          <div className="site-footer-links" aria-label="정책 링크">
            <Link href="/terms">이용약관</Link>
            <Link href="/privacy">개인정보처리방침</Link>
            <Link href="/refund">환불 정책</Link>
            <a href="mailto:getmuno@gmail.com?subject=JobRisk 문의">문의하기</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
