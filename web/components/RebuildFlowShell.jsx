import styles from './rebuild-flow-shell.module.css'

export default function RebuildFlowShell({
  children,
  ctaHref = '/#free-analysis',
  ctaLabel = '무료 공고 점검하기',
  bodyClassName = '',
  footer = true,
}) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerCard}>
          <a className={styles.brand} href="/" aria-label="JOBRISK 홈">
            <span className={styles.brandText}>JOBRISK</span>
            <span aria-hidden="true" className={styles.brandDot} />
          </a>

          <a className={styles.headerButton} href={ctaHref}>
            {ctaLabel}
            <span aria-hidden="true">→</span>
          </a>
        </div>
      </header>

      <main className={`${styles.body} ${bodyClassName}`.trim()}>{children}</main>

      {footer ? (
        <footer className={styles.footer}>
          <div className={styles.footerCard}>
            <div className={styles.footerBrandBlock}>
              <a className={styles.brand} href="/" aria-label="JOBRISK 홈">
                <span className={styles.brandText}>JOBRISK</span>
                <span aria-hidden="true" className={styles.brandDot} />
              </a>
            </div>

            <div className={styles.footerInfoBlock}>
              <p>사업자등록번호: 678-17-02416</p>
              <p>대표 문의: getmuno@gmail.com</p>
              <p>전화: 010-7239-0713</p>
              <p>대표: 손현수</p>
              <p>주소: 경기도 성남시 분당구 불정로 361</p>
            </div>

            <nav className={styles.footerLinkColumn} aria-label="회사 정보">
              <a href="/terms">문의하기</a>
              <a href="/privacy">개인정보처리방침</a>
              <a href="/terms">이용약관</a>
            </nav>
          </div>
        </footer>
      ) : null}
    </div>
  )
}
