import Link from 'next/link'

export default function LogoMark({ href = '/', tone = 'light', className = '' }) {
  const toneClass = tone === 'dark' ? 'is-dark' : 'is-light'

  return (
    <Link className={`site-logo-link ${toneClass} ${className}`.trim()} href={href}>
      <span className="site-logo-text">JOBRISK</span>
    </Link>
  )
}
