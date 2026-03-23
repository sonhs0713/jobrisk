import { Link } from 'react-router-dom'

function Footer() {
  return (
    <footer className="footer-section">
      <div className="footer-business-info">
        <span>회사명: muno</span>
        <span className="footer-separator" aria-hidden="true">|</span>
        <span>대표자명: 손현수</span>
        <span className="footer-separator" aria-hidden="true">|</span>
        <span>사업자등록번호: 678-17-02416</span>
        <span className="footer-separator" aria-hidden="true">|</span>
        <span>주소: 경기도 성남시 분당구 불정로 361</span>
        <span className="footer-separator" aria-hidden="true">|</span>
        <span>유선번호: 010-7239-0713</span>
        <span className="footer-separator" aria-hidden="true">|</span>
        <span>이메일: sonhs0713@gmail.com</span>
      </div>
      <div className="footer-divider" />
      <div className="footer-base-text">
        <Link to="/terms" className="footer-link">
          이용약관
        </Link>
        <span aria-hidden="true">·</span>
        <span>All rights reserved.</span>
      </div>
    </footer>
  )
}

export default Footer
