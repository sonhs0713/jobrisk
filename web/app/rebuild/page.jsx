import RebuildFreeAnalysisClient from './RebuildFreeAnalysisClient'
import HeroTypingTitle from './HeroTypingTitle'
import RevealSection from './RevealSection'
import styles from './rebuild.module.css'

const navLinks = [
  { href: '#problem', label: '서비스 소개' },
  { href: '#free-analysis', label: '무료 분석' },
  { href: '#example', label: '분석 예시' },
  { href: '#paid-report', label: '유료 결과' },
]

const heroSignals = [
  {
    icon: 'document',
    title: '근거 확인',
    body: '모호한 운영, 관리, 커뮤니케이션 문장을 검토 가능한 신호로 바꿉니다.',
  },
  {
    icon: 'chat',
    title: '면접 질문',
    body: '면접에서 바로 확인할 수 있는 질문으로 연결합니다.',
  },
  {
    icon: 'balance',
    title: '답변 해석',
    body: '답변을 어떤 기준으로 들어야 하는지 해석 기준을 제공합니다.',
  },
  {
    icon: 'flag',
    title: '지원 결정',
    body: '취업 이후 후회가 줄도록 마지막 판단을 돕습니다.',
  },
]

const limitPoints = [
  { icon: 'spark', title: 'AI 요약', body: '표면적 설명만 제공' },
  { icon: 'profile', title: '직업 / 스펙', body: '직무 관점이 아닌 일반 조언' },
  { icon: 'review', title: '리뷰 플랫폼', body: '기업 / 문화 중심 정보' },
]

const paidQuestions = [
  '실제 개선 권한은 어디까지 맡게 되나요?',
  '성과를 어떤 지표로 평가하나요?',
  '예산과 개선 우선순위 결정 권한이 있나요?',
  '현재 가장 중요한 문제는 무엇인가요?',
  '1년 뒤에 이 역할은 어떻게 달라지나요?',
]

const howItWorksSteps = [
  {
    number: '01',
    icon: 'document',
    title: '공고 근거 확인',
    lines: ['모든 표현 검토', '근거를 추출'],
  },
  {
    number: '02',
    icon: 'chat',
    title: '면접 검증 생성',
    lines: ['검증 가능한 질문으로', '변환'],
  },
  {
    number: '03',
    icon: 'balance',
    title: '답변 해석 기준 제시',
    lines: ['취업 / 기회 신호와', '해석 기준 제공'],
  },
  {
    number: '04',
    icon: 'flag',
    title: '지원 결정 지원',
    lines: ['후회 없는 선택을', '돕습니다'],
  },
]

const forWhomCards = [
  {
    icon: 'chart',
    titleLines: ['스타트업 운영형', '직무 지원자'],
    bodyLines: ['역할과 성장 기준이 모호한', '공고를 걸러내고 싶은 분'],
  },
  {
    icon: 'briefcase',
    titleLines: ['중소기업 사무형', '직무 지원자'],
    bodyLines: ['업무 범위가 넓고 모호한', '공고가 불안한 분'],
  },
  {
    icon: 'person',
    titleLines: ['모호한 공고가', '불안한 취준생'],
    bodyLines: ['지원 전 리스크를 미리 확인하고', '싶은 모든 취업 준비생'],
  },
]

export const metadata = {
  title: 'JobRisk Frontend Rebuild',
  description: '잡리스크 랜딩 페이지를 섹션 단위로 다시 구현하는 작업 페이지입니다.',
}

export default function RebuildPage() {
  return (
    <main className={styles.page} id="top">
      <RevealSection as="section" className={styles.hero} id="navigation" initialVisible={true}>
        <div className={styles.navCard}>
          <a className={styles.brand} href="#top" aria-label="JOBRISK 홈">
            <span className={styles.brandText}>JOBRISK</span>
            <span className={styles.brandDot} aria-hidden="true" />
          </a>

          <nav className={styles.navMenu} aria-label="주요 메뉴">
            {navLinks.map((link) => (
              <a className={styles.navLink} href={link.href} key={link.href}>
                {link.label}
              </a>
            ))}
          </nav>

          <div className={styles.navAside}>
            <a className={styles.navCta} href="#free-analysis">
              무료로 공고 점검하기
              <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </RevealSection>

      <RevealSection as="section" className={styles.heroProblem} id="hero" initialVisible={true}>
        <div className={styles.heroProblemLabel}>
          <span>01</span>
          <p>HERO</p>
          <p>PROBLEM</p>
        </div>

        <div className={styles.heroProblemLayout}>
          <div className={styles.heroCopy}>
            <HeroTypingTitle
              className={styles.heroTitle}
              text={`화려한 공고 문구,\n그대로 믿고\n지원하시나요?`}
            />
            <p className={styles.heroLead}>좋아 보이는 공고만 믿고 지원했다가 1~2년을 낭비할 수 있습니다. 지금 JOBRISK로 커리어를 지키세요.</p>

            <div className={styles.heroActions}>
              <a className={styles.heroPrimaryCta} href="#free-analysis">
                무료 공고 분석하기
                <span aria-hidden="true">→</span>
              </a>
            </div>
          </div>

          <div className={styles.heroVisual}>
            <div className={styles.quoteCard}>
              <span className={styles.cardEyebrow}>채용 공고</span>
              <span className={styles.quoteMarkOpen} aria-hidden="true">
                “
              </span>
              <span className={styles.quoteMarkClose} aria-hidden="true">
                ”
              </span>
              <blockquote className={styles.quoteText}>
                다양한 업무를
                <br />
                담당하고
                <br />
                운영 전반을 경험하며,
                <br />
                유관 업무를
                <br />
                수행합니다.
              </blockquote>
              <div className={styles.quoteHighlight} aria-hidden="true" />
            </div>

            <div className={styles.heroConnector} aria-hidden="true">
              <span className={styles.heroConnectorLine} />
              <span className={styles.heroConnectorArrow}>→</span>
            </div>

            <div className={styles.signalCard}>
              <h2>JOBRISK 한 번에 보기</h2>
              <div className={styles.signalList}>
                {heroSignals.map((signal) => (
                  <div className={styles.signalItem} key={signal.title}>
                    <span className={styles.signalMarker} aria-hidden="true">
                      <SignalFeatureIcon type={signal.icon} />
                    </span>
                    <div>
                      <strong>{signal.title}</strong>
                      <p>{signal.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </RevealSection>

      <RevealSection as="section" className={styles.problemLimits} id="problem">
        <div className={styles.problemLimitsLabel}>
          <span>02</span>
          <p>PROBLEM &amp;</p>
          <p>LIMITS</p>
        </div>

        <div className={styles.problemLimitsLayout}>
          <div className={styles.problemLimitsCopy}>
            <h2>
              대부분의 공고는
              <br />
              모호하게 적혀 있습니다
            </h2>
            <p>
              정확한 정보 없이 지원하면
              <br />
              시간과 커리어가 무의미해질 수 있습니다.
            </p>
          </div>

          <div className={styles.problemLimitsPanel}>
            <article className={styles.limitsColumn}>
              <span className={styles.limitsEyebrow}>공고에서 흔히 보이는 표현</span>
              <div className={styles.limitsQuoteMark} aria-hidden="true">
                &quot;
              </div>
              <div className={styles.limitsQuoteBody}>
                <p>다양한 업무</p>
                <p>운영 전반</p>
                <p>유관 업무 수행</p>
                <span>...</span>
              </div>
            </article>

            <article className={styles.limitsColumn}>
              <span className={styles.limitsEyebrow}>기존 방식의 한계</span>
              <div className={styles.limitPointList}>
                {limitPoints.map((point) => (
                  <div className={styles.limitPoint} key={point.title}>
                    <span className={styles.limitIcon} aria-hidden="true">
                      <LimitFeatureIcon type={point.icon} />
                    </span>
                    <div>
                      <strong>{point.title}</strong>
                      <p>{point.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className={`${styles.limitsColumn} ${styles.limitsColumnAccent}`}>
              <span className={styles.limitsEyebrowAccent}>JOBRISK는 다르게 접근합니다.</span>
              <div className={styles.limitsAccentBody}>
                <p>공고 근거를 기반으로</p>
                <p>면접에서 검증 가능한</p>
                <p>질문과 해석 기준을</p>
                <p>제공합니다.</p>
              </div>
              <div className={styles.limitsCheck} aria-hidden="true">
                ✓
              </div>
            </article>
          </div>
        </div>
      </RevealSection>

      <RevealSection as="section" className={styles.freeAnalysis} id="free-analysis">
        <div className={styles.freeAnalysisLabel}>
          <span>03</span>
          <p>FREE</p>
          <p>ANALYSIS</p>
        </div>

        <RebuildFreeAnalysisClient />
      </RevealSection>

      <RevealSection as="section" className={styles.exampleSection} id="example">
        <div className={styles.exampleLabel}>
          <span>04</span>
          <p>EXAMPLE</p>
        </div>

        <div className={styles.exampleLayout}>
          <div className={styles.exampleCopy}>
            <h2>
              실제 공고
              <br />
              예시로 분석
              <br />
              과정을
              <br />
              확인해보세요
            </h2>
            <a className={styles.exampleMoreButton} href="#example">
              다음 예시 보기
              <span aria-hidden="true">→</span>
            </a>
          </div>

          <div className={styles.exampleCard}>
            <div className={styles.exampleHead}>예시. 스타트업 마케터 공고</div>

            <div className={styles.exampleGrid}>
              <article className={styles.exampleBlock}>
                <strong>Before</strong>
                <p>
                  다양한 채널 운영 및 콘텐츠 제작,
                  <br />
                  퍼포먼스 개선 등 마케팅 전반을 담당합니다.
                </p>
              </article>

              <div className={styles.exampleArrow} aria-hidden="true">
                →
              </div>

              <article className={styles.exampleBlock}>
                <strong>면접 질문 예시</strong>
                <div className={styles.exampleQuestionMark}>Q.</div>
                <p>주도적으로 아이디어를 내고 실행한 경험이 있나요?</p>
              </article>

              <div className={styles.exampleArrow} aria-hidden="true">
                →
              </div>

              <article className={styles.exampleBlock}>
                <strong>답변 해석</strong>
                <div className={styles.exampleAnswerStack}>
                  <div className={styles.exampleAnswerRow}>
                    <span className={`${styles.exampleAnswerChip} ${styles.exampleAnswerPositive}`}>좋은 신호</span>
                    <p>데이터 기반 개선, 실험 설계 경험</p>
                  </div>
                  <div className={styles.exampleAnswerRow}>
                    <span className={`${styles.exampleAnswerChip} ${styles.exampleAnswerNegative}`}>위험 신호</span>
                    <p>지시 수행 중심, 권한이 없음</p>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </div>
      </RevealSection>

      <RevealSection as="section" className={styles.paidAnalysis} id="paid-report">
        <div className={styles.paidAnalysisLabel}>
          <span>05</span>
          <p>PAID</p>
          <p>ANALYSIS</p>
        </div>

        <div className={styles.paidAnalysisLayout}>
          <div className={styles.paidAnalysisCopy}>
            <h2>
              유료 분석에서는
              <br />
              면접 검증과
              <br />
              해석 기준까지
              <br />
              제공합니다
            </h2>
            <a className={styles.paidAnalysisButton} href="#paid-report">
              유료 결과 미리보기
              <span aria-hidden="true">→</span>
            </a>
          </div>

          <div className={styles.paidReportCard}>
            <div className={styles.paidReportHead}>
              <strong>JOBRISK 종합 분석 리포트 (예시)</strong>
              <span>실제 리포트는 더 상세합니다.</span>
            </div>

            <div className={styles.paidReportGrid}>
              <article className={styles.paidReportBlock}>
                <strong>7대 핵심 분석</strong>
                <div className={styles.scoreRadar}>
                  <div className={styles.scoreRadarCore}>
                    <span>64</span>
                    <small>/100</small>
                  </div>
                  <div className={styles.scoreRingOne} aria-hidden="true" />
                  <div className={styles.scoreRingTwo} aria-hidden="true" />
                  <div className={styles.scoreAxis} aria-hidden="true" />
                </div>
                <div className={styles.scoreLegend}>
                  <span className={styles.scoreLegendBad}>위험 신호</span>
                  <span className={styles.scoreLegendNeutral}>중간 검토</span>
                </div>
              </article>

              <article className={styles.paidReportBlock}>
                <strong>면접에서 꼭 물어볼 질문</strong>
                <ol className={styles.paidQuestionList}>
                  {paidQuestions.map((question) => (
                    <li key={question}>{question}</li>
                  ))}
                </ol>
              </article>

              <article className={styles.paidReportBlock}>
                <strong>답변 해석 가이드</strong>
                <div className={styles.paidGuideStack}>
                  <div className={styles.paidGuideRow}>
                    <span className={`${styles.paidGuideChip} ${styles.paidGuideGood}`}>좋은 신호</span>
                    <p>구체적 지표 성과 경험, 권한 범위 설명</p>
                  </div>
                  <div className={styles.paidGuideRow}>
                    <span className={`${styles.paidGuideChip} ${styles.paidGuideRisk}`}>위험 신호</span>
                    <p>지시 중심, 범위 없음, 모호한 설명 반복</p>
                  </div>
                </div>
                <div className={styles.paidFinalGuide}>
                  <strong>최종 행동 가이드</strong>
                  <p>추가 확인 질문을 가지고 면접에 들어가세요.</p>
                </div>
              </article>
            </div>
          </div>
        </div>
      </RevealSection>

      <RevealSection as="section" className={styles.howItWorks} id="how-it-works">
        <div className={styles.howItWorksLabel}>
          <span>06</span>
          <p>HOW IT</p>
          <p>WORKS</p>
        </div>

        <div className={styles.howItWorksLayout}>
          <div className={styles.howItWorksCopy}>
            <h2>
              JOBRISK는
              <br />
              이렇게
              <br />
              도와드립니다
            </h2>
          </div>

          <div className={styles.howItWorksCard}>
            {howItWorksSteps.map((step, index) => (
              <div className={styles.howItWorksItem} key={step.number}>
                <span className={styles.howItWorksNumber}>{step.number}</span>
                <div className={styles.howItWorksBody}>
                  <WorkflowIcon type={step.icon} />
                  <div className={styles.howItWorksText}>
                    <strong>{step.title}</strong>
                    {step.lines.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                </div>
                {index < howItWorksSteps.length - 1 ? (
                  <span className={styles.howItWorksArrow} aria-hidden="true">
                    →
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </RevealSection>

      <RevealSection as="section" className={styles.forWhom} id="for-whom">
        <div className={styles.forWhomLabel}>
          <span>07</span>
          <p>FOR WHOM</p>
        </div>

        <div className={styles.forWhomLayout}>
          <div className={styles.forWhomCopy}>
            <h2>
              이런 분에게 특히
              <br />
              도움이 됩니다
            </h2>
          </div>

          <div className={styles.forWhomCards}>
            {forWhomCards.map((card) => (
              <article className={styles.forWhomCard} key={card.titleLines.join('-')}>
                <AudienceIcon type={card.icon} />
                <div className={styles.forWhomText}>
                  <strong>
                    {card.titleLines.map((line) => (
                      <span key={line}>
                        {line}
                        <br />
                      </span>
                    ))}
                  </strong>
                  {card.bodyLines.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </RevealSection>

      <RevealSection as="section" className={styles.finalCta} id="final-cta">
        <div className={styles.finalCtaLabel}>
          <span>08</span>
          <p>FINAL CTA</p>
        </div>

        <div className={styles.finalCtaCard}>
          <div className={styles.finalCtaCopy}>
            <h2>
              후회 없는 커리어 선택,
              <br />
              지금 공고 한 줄로 시작하세요.
            </h2>
            <p>1분이면 충분합니다.</p>
          </div>

          <a className={styles.finalCtaButton} href="#free-analysis">
            무료로 공고 점검하기
            <span aria-hidden="true">→</span>
          </a>
          <div className={styles.finalCtaPattern} aria-hidden="true" />
          <div className={styles.finalCtaDot} aria-hidden="true" />
        </div>
      </RevealSection>

      <RevealSection as="footer" className={styles.footerSection} id="footer">
        <div className={styles.footerCard}>
          <div className={styles.footerBrandBlock}>
            <a className={styles.footerBrand} href="#top" aria-label="JOBRISK 홈">
              <span>JOBRISK</span>
              <span className={styles.footerBrandDot} aria-hidden="true" />
            </a>
          </div>

          <div className={styles.footerInfoBlock}>
            <p>사업자등록번호: 678-17-02416</p>
            <p>대표 문의: getmuno@gmail.com</p>
            <p>전화: 010-7239-0713</p>
            <p>대표: 손현수</p>
            <p>주소: 경기도 성남시 분당구 불정로 361</p>
          </div>

          <nav className={styles.footerLinkColumn} aria-label="회사">
            <a href="/terms">문의하기</a>
            <a href="/privacy">개인정보처리방침</a>
            <a href="/terms">이용약관</a>
          </nav>
        </div>
      </RevealSection>
    </main>
  )
}

function SignalFeatureIcon({ type }) {
  if (type === 'document') {
    return (
      <svg className={styles.signalIcon} viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 3.75h7l4 4v12.5H7z" fill="none" stroke="currentColor" strokeWidth="1.7" />
        <path d="M14 3.75v4h4" fill="none" stroke="currentColor" strokeWidth="1.7" />
        <path d="M9.5 12h5M9.5 15h5M9.5 18h3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
      </svg>
    )
  }

  if (type === 'chat') {
    return (
      <svg className={styles.signalIcon} viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M5 7.75a3.75 3.75 0 0 1 3.75-3.75h5.5A4.75 4.75 0 0 1 19 8.75a4.75 4.75 0 0 1-4.75 4.75H11l-3.5 2 .6-2.5A3.75 3.75 0 0 1 5 9.5z"
          fill="none"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
        <circle cx="9" cy="8.75" r="1" fill="currentColor" />
        <circle cx="12" cy="8.75" r="1" fill="currentColor" />
        <circle cx="15" cy="8.75" r="1" fill="currentColor" />
      </svg>
    )
  }

  if (type === 'balance') {
    return (
      <svg className={styles.signalIcon} viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4v14M8 6h8M5 20h14" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
        <path d="M8 6 5.5 10h5zM16 6l-2.5 4h5z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
      </svg>
    )
  }

  return (
    <svg className={styles.signalIcon} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3.75v16.5M7 5.5h9l-2 3 2 3H7" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
    </svg>
  )
}

function LimitFeatureIcon({ type }) {
  if (type === 'spark') {
    return (
      <svg className={styles.limitIconSvg} viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4.5 13.6 9l4.4 1.6-4.4 1.6-1.6 4.3-1.6-4.3L6 10.6 10.4 9z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
        <path d="M18 4.5v3M16.5 6h3" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
      </svg>
    )
  }

  if (type === 'profile') {
    return (
      <svg className={styles.limitIconSvg} viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="8.2" cy="8" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.7" />
        <path d="M4.8 16.6c.8-2.2 2.4-3.4 4.2-3.4s3.4 1.2 4.2 3.4" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
        <path d="M15.5 8h4M15.5 11.5h4M15.5 15h3.2" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
      </svg>
    )
  }

  return (
    <svg className={styles.limitIconSvg} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 7.2h10v7.1H10.8L7 17.2z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
      <path d="M10 10.5h4M10 13h2.8" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
      <path d="M18.4 7.8h1.1a1.5 1.5 0 0 1 1.5 1.5v5.2" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
    </svg>
  )
}

function WorkflowIcon({ type }) {
  if (type === 'document') {
    return (
      <svg className={styles.workflowIcon} viewBox="0 0 40 40" aria-hidden="true">
        <path d="M11 6.5h12l6 6V33.5H11z" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M23 6.5v7h6" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M15 19h10M15 24h10M15 29h7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    )
  }

  if (type === 'chat') {
    return (
      <svg className={styles.workflowIcon} viewBox="0 0 40 40" aria-hidden="true">
        <path
          d="M11 11.5c0-3 2.4-5.5 5.5-5.5h7c5 0 9 4 9 9 0 5.2-4.2 9.5-9.5 9.5h-4.5l-5.5 4 .9-4.8C12.1 22 11 19.9 11 17.5z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <circle cx="17" cy="16.5" r="1.3" fill="currentColor" />
        <circle cx="22" cy="16.5" r="1.3" fill="currentColor" />
        <circle cx="27" cy="16.5" r="1.3" fill="currentColor" />
      </svg>
    )
  }

  if (type === 'balance') {
    return (
      <svg className={styles.workflowIcon} viewBox="0 0 40 40" aria-hidden="true">
        <path d="M20 7v22M14 10h12M10 33h20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M14 10l-5 8h10zM26 10l-5 8h10z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    )
  }

  return (
    <svg className={styles.workflowIcon} viewBox="0 0 40 40" aria-hidden="true">
      <path d="M12 6.5v27M12 8h16l-3 5 3 5H12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  )
}

function AudienceIcon({ type }) {
  if (type === 'chart') {
    return (
      <svg className={styles.audienceIcon} viewBox="0 0 40 40" aria-hidden="true">
        <path d="M9 8.5v23h23" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M14 25l5-6 4 3 7-8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M27 14h3v3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  if (type === 'briefcase') {
    return (
      <svg className={styles.audienceIcon} viewBox="0 0 40 40" aria-hidden="true">
        <path d="M12.5 14.5v-2c0-1.7 1.3-3 3-3h9c1.7 0 3 1.3 3 3v2" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <rect x="8" y="14.5" width="24" height="15" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 21h24M18 20.8h4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    )
  }

  return (
    <svg className={styles.audienceIcon} viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="14" r="5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M10.5 30.5c1.8-4.8 5.5-7.3 9.5-7.3s7.7 2.5 9.5 7.3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
