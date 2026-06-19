import Link from 'next/link'
import LogoMark from './LogoMark'

const landingLinks = [
  { href: '/#analyze', label: '무료 진단' },
]

const reportLinks = [
  { href: '/#analyze', label: '새 공고 분석하기' },
]

export default function SiteHeader({ variant = 'landing' }) {
  const links = variant === 'report' ? reportLinks : landingLinks

  return (
    <header className={`site-header site-header-${variant}`}>
      <div className="site-header-inner">
        <LogoMark tone="dark" />
        <nav className="site-nav" aria-label="주요 메뉴">
          {links.map((link) => (
            <Link className={link.href === '/#analyze' ? 'site-nav-cta' : ''} href={link.href} key={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
