import RebuildFlowShell from '../../../components/RebuildFlowShell'
import shellStyles from '../../../components/rebuild-flow-shell.module.css'
import RevealSection from '../../rebuild/RevealSection'
import HeroTypingTitle from '../../rebuild/HeroTypingTitle'
import PaidReportViewTracker from './PaidReportViewTracker'
import ReportFeedbackCard from './ReportFeedbackCard'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:4000'

const STATUS_LEGEND = [
  { label: '안전', description: '경력 자산화 가능성이 높음', tone: 'safe' },
  { label: '확인 필요', description: '면접에서 추가 확인 필요', tone: 'warning' },
  { label: '정보 부족', description: '공고만으로는 판단이 어려움', tone: 'neutral' },
  { label: '위험 신호', description: '물경력 가능성이 높음', tone: 'danger' },
]

function AxisIcon({ axisKey }) {
  switch (axisKey) {
    case 'repetition':
      return (
        <svg viewBox="0 0 24 24" role="presentation">
          <path d="M7 7h9a4 4 0 0 1 4 4" />
          <path d="m17 4 3 3-3 3" />
          <path d="M17 17H8a4 4 0 0 1-4-4" />
          <path d="m7 20-3-3 3-3" />
        </svg>
      )
    case 'responsibility':
      return (
        <svg viewBox="0 0 24 24" role="presentation">
          <circle cx="12" cy="12" r="7" />
          <circle cx="12" cy="12" r="2.5" />
          <path d="M12 3v3" />
          <path d="M12 18v3" />
          <path d="M3 12h3" />
          <path d="M18 12h3" />
        </svg>
      )
    case 'measurable':
      return (
        <svg viewBox="0 0 24 24" role="presentation">
          <path d="M5 19V9" />
          <path d="M12 19V5" />
          <path d="M19 19v-7" />
          <path d="M4 19h16" />
        </svg>
      )
    case 'difficulty':
      return (
        <svg viewBox="0 0 24 24" role="presentation">
          <path d="m4 18 5-7 4 4 5-9 2 3" />
          <path d="m16 9 2-3 3 1" />
        </svg>
      )
    case 'transferable':
      return (
        <svg viewBox="0 0 24 24" role="presentation">
          <path d="M8 8h8v8" />
          <path d="M16 8 8 16" />
          <path d="M6 12v6h6" />
        </svg>
      )
    case 'scopeClarity':
      return (
        <svg viewBox="0 0 24 24" role="presentation">
          <path d="M8 4H5a1 1 0 0 0-1 1v3" />
          <path d="M16 4h3a1 1 0 0 1 1 1v3" />
          <path d="M20 16v3a1 1 0 0 1-1 1h-3" />
          <path d="M4 16v3a1 1 0 0 0 1 1h3" />
          <path d="M9 12h6" />
          <path d="M12 9v6" />
        </svg>
      )
    case 'learningFeedback':
      return (
        <svg viewBox="0 0 24 24" role="presentation">
          <path d="M12 5a6.5 6.5 0 1 0 6.2 8.5" />
          <path d="M15 5h4v4" />
          <path d="M19 5l-4 4" />
        </svg>
      )
    default:
      return (
        <svg viewBox="0 0 24 24" role="presentation">
          <circle cx="12" cy="12" r="7" />
        </svg>
      )
  }
}

function getTone(level = '') {
  const normalized = String(level).toLowerCase()
  if (normalized.includes('risk') || normalized.includes('high')) return 'danger'
  if (normalized.includes('strong_positive') || normalized.includes('low')) return 'safe'
  if (normalized.includes('insufficient')) return 'neutral'
  return 'warning'
}

function getDisplayStatus(level = '') {
  const tone = getTone(level)
  if (tone === 'safe') return '안전'
  if (tone === 'danger') return '위험 신호'
  if (tone === 'neutral') return '정보 부족'
  return '확인 필요'
}

function getSummaryHeadline(tone = 'warning') {
  if (tone === 'safe') return '지원 자산 가능성이 높습니다'
  if (tone === 'danger') return '위험 신호가 강하게 보입니다'
  if (tone === 'neutral') return '공고만으로는 판단 근거가 부족합니다'
  return '추가 확인이 필요합니다'
}

function getFinalHeadline(tone = 'warning') {
  if (tone === 'safe') return '지원 가능성이 높습니다'
  if (tone === 'danger') return '지원 전 확인이 필요합니다'
  if (tone === 'neutral') return '판단 전에 근거 보강이 필요합니다'
  return '지원 전 확인이 필요합니다'
}

function getDecisionHeadline(actionGuideText = '', tone = 'warning') {
  const text = String(actionGuideText || '').trim()
  if (/^확인 전 보류 권장/.test(text)) return '확인 전 보류 권장'
  if (/^조건부 지원 가능/.test(text)) return '조건부 지원 가능'
  if (/^운영형 물경력 위험 주의/.test(text)) return '운영형 물경력 위험 주의'
  return getFinalHeadline(tone)
}

function getAxisSummaryFallback(axis = {}) {
  const map = {
    repetition: '반복 업무 비중은 더 확인이 필요합니다.',
    responsibility: '실제 결정권은 확인이 필요합니다.',
    measurable: '성과 기준은 더 확인이 필요합니다.',
    difficulty: '성장 난이도는 더 확인이 필요합니다.',
    transferable: '이직에 남을 경험인지는 더 확인이 필요합니다.',
    scopeClarity: '핵심 역할 경계가 모호합니다.',
    learningFeedback: '배우고 개선하는 구조는 더 확인이 필요합니다.',
  }

  return map[axis.key] || '핵심 기준은 더 확인이 필요합니다.'
}

function getMissingInfoDescription(axis = {}) {
  return '근거 부족'
}

function getAxisCheckPoint(axis = {}) {
  if (axis?.decisionMeaning) return axis.decisionMeaning
  const map = {
    repetition: '운영 비중과 개선 비중',
    responsibility: '실제 결정권 범위',
    measurable: '성과 기준과 KPI',
    difficulty: '더 큰 역할로 이어지는 구조',
    transferable: '이직 때 설명할 성과 사례',
    scopeClarity: '핵심 역할과 보조 업무 경계',
    learningFeedback: '회고·피드백 구조',
  }

  return map[axis.key] || '핵심 역할과 평가 기준'
}

function normalizeAxisSummary(axis = {}) {
  if (axis?.riskInterpretation) return String(axis.riskInterpretation).trim()
  const summary = String(axis.summary || '').trim()
  const hasDirectEvidence = Boolean(axis.evidence?.quote)
  if (!hasDirectEvidence && getTone(axis.level) === 'neutral') return getAxisSummaryFallback(axis)
  if (!summary) return getAxisSummaryFallback(axis)
  if (summary.includes(String(axis.label || '')) || summary.includes('공고에서 직접 근거를 찾기 어려워')) {
    return getAxisSummaryFallback(axis)
  }
  return summary
}

function compareAxisPriority(a, b) {
  const levelPriority = {
    risk: 0,
    high: 0,
    mixed_signal: 1,
    positive_with_check: 2,
    medium: 2,
    insufficient_info: 3,
    strong_positive: 4,
    low: 4,
  }

  const axisPriority = {
    measurable: 0,
    responsibility: 1,
    repetition: 2,
    difficulty: 3,
    transferable: 4,
    scopeClarity: 5,
    learningFeedback: 6,
  }

  const levelDiff = (levelPriority[a?.level] ?? 99) - (levelPriority[b?.level] ?? 99)
  if (levelDiff !== 0) return levelDiff

  return (axisPriority[a?.key] ?? 99) - (axisPriority[b?.key] ?? 99)
}

function getUnifiedVerdict(detail = {}) {
  const axes = detail?.sevenAxes || detail?.fiveAxes || []
  const auxiliaryChecks = detail?.auxiliaryChecks || []
  const riskCount = axes.filter((axis) => getTone(axis.level) === 'danger').length
  const warningCount = axes.filter((axis) => getTone(axis.level) === 'warning').length
  const safeCount = axes.filter((axis) => getTone(axis.level) === 'safe').length
  const blockingAuxiliary = auxiliaryChecks.filter((item) => getTone(item.level) === 'danger').length

  if (blockingAuxiliary > 0 || riskCount >= 2) {
    return {
      tone: 'danger',
      summary: '계약 구조나 실제 역할 범위에서 강한 위험 신호가 있어 지원 전 검증이 필요합니다.',
    }
  }

  if (riskCount >= 1 || warningCount >= 2) {
    return {
      tone: 'warning',
      summary: '좋아 보이는 표현이 있어도 실제 권한과 성과 기준은 면접에서 더 확인해야 합니다.',
    }
  }

  if (safeCount >= 3) {
    return {
      tone: 'safe',
      summary: '긍정 신호가 비교적 분명하지만 실제 역할 범위와 성장 경로는 한 번 더 검증하는 편이 안전합니다.',
    }
  }

  return {
    tone: 'neutral',
    summary: '공고만으로는 판단 근거가 부족해 추가 정보 확인이 필요합니다.',
  }
}

function getScoreFromAxes(axes = [], auxiliaryChecks = []) {
  const score =
    50 +
    axes.filter((axis) => getTone(axis.level) === 'safe').length * 9 -
    axes.filter((axis) => getTone(axis.level) === 'danger').length * 12 -
    axes.filter((axis) => getTone(axis.level) === 'neutral').length * 4 -
    auxiliaryChecks.filter((item) => getTone(item.level) === 'danger').length * 10 -
    auxiliaryChecks.filter((item) => getTone(item.level) === 'warning').length * 5

  return Math.max(28, Math.min(91, score))
}

function toDisplayText(value, fallback = '') {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || fallback
  }

  if (typeof value === 'number') return String(value)

  if (value && typeof value === 'object') {
    if (typeof value.value === 'string') {
      const trimmed = value.value.trim()
      return trimmed || fallback
    }
    if (typeof value.label === 'string') {
      const trimmed = value.label.trim()
      return trimmed || fallback
    }
  }

  return fallback
}

function getAnalysisTarget(report = {}, detail = {}) {
  const isInternalMetaValue = (value) => {
    const text = String(value || '').trim()
    if (!text) return true
    if (/^(unknown|mixed|growth|marketing|product|design|operations|finance|hr|sales|service|media|education|public|development|executive)$/i.test(text)) {
      return true
    }
    if (/^[a-z_]+$/i.test(text) && text === text.toLowerCase()) return true
    return false
  }

  const primary =
    toDisplayText(report?.jobTitle) ||
    toDisplayText(detail?.jobTitle) ||
    toDisplayText(report?.title) ||
    toDisplayText(detail?.title) ||
    toDisplayText(report?.role) ||
    toDisplayText(detail?.role) ||
    '채용 공고 분석'

  const rawSecondary =
    toDisplayText(report?.companyName) ||
    toDisplayText(detail?.companyName) ||
    toDisplayText(detail?.companyContext?.companyName) ||
    toDisplayText(detail?.companyContext?.companyStage)

  const secondary = isInternalMetaValue(rawSecondary) ? '입력한 채용공고 기준 분석' : rawSecondary

  return {
    primary,
    secondary,
  }
}

function formatReportDate(report = {}, detail = {}) {
  const rawValue = report?.createdAt || report?.updatedAt || detail?.createdAt || detail?.updatedAt
  if (!rawValue) return null

  const date = new Date(rawValue)
  if (Number.isNaN(date.getTime())) return null

  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function buildRiskSignalItems(axes = [], auxiliaryChecks = []) {
  const axisSignals = axes
    .filter((axis) => ['danger', 'warning', 'neutral'].includes(getTone(axis.level)))
    .sort(compareAxisPriority)
    .map((axis) => String(axis.summary || '').trim())
    .filter(Boolean)

  const auxiliarySignals = auxiliaryChecks
    .filter((item) => ['danger', 'warning'].includes(getTone(item.level)))
    .map((item) => String(item.summary || '').trim())
    .filter(Boolean)

  return [...new Set([...axisSignals, ...auxiliarySignals])].slice(0, 3)
}

function buildFinalActionChecks(items = []) {
  const actionMap = {
    measurable: '이 역할의 KPI와 평가 기준을 먼저 물어보세요.',
    responsibility: '예산, 우선순위, 승인 범위 중 직접 결정하는 부분이 있는지 확인하세요.',
    repetition: '반복 운영 업무와 개선 업무의 비중이 어떻게 나뉘는지 물어보세요.',
    difficulty: '입사 후 더 어려운 문제나 더 큰 범위를 맡게 되는 시점이 있는지 확인하세요.',
    transferable: '이 경험이 다음 이직에서도 설명 가능한 결과와 역량으로 남는지 물어보세요.',
    scopeClarity: '핵심 업무와 부수 업무가 어디까지인지 구체적으로 구분해 달라고 요청하세요.',
    learningFeedback: '입사 후 성과 리뷰와 피드백이 어떤 방식으로 이뤄지는지 확인하세요.',
    applicationSafety: '지원 전에 공식 채용 채널과 실제 채용 주체가 일치하는지 확인하세요.',
    contractConsistency: '계약 주체와 실제 근무 지시 라인이 누구인지 확인하세요.',
    employmentForm: '고용 형태와 전환 조건이 있다면 기준을 확인하세요.',
    workLocationClarity: '근무 위치와 소속 조직이 어떻게 정해지는지 확인하세요.',
    roleClarity: '채용공고에 적힌 역할과 실제로 맡게 될 업무가 같은지 확인하세요.',
  }

  const dynamic = items
    .slice(0, 4)
    .map((item) => actionMap[item?.key] || item?.question || `${item?.label || '핵심 항목'}을 구체적으로 확인하세요.`)
    .filter(Boolean)
  const unique = [...new Set(dynamic)].slice(0, 4)

  return unique.length ? unique : ['지원 전에 역할 범위와 성과 기준을 먼저 확인하세요.']
}

function derivePriorityItems(axes = [], auxiliaryChecks = []) {
  const axisItems = [...axes].sort(compareAxisPriority).slice(0, 3)
  const auxiliaryItems = auxiliaryChecks.filter((item) => ['danger', 'warning'].includes(getTone(item.level))).slice(0, 2)
  return [...axisItems, ...auxiliaryItems]
}

function normalizeDecisionReportVerdict(decisionReport = null, detail = {}) {
  if (!decisionReport?.overallVerdict) return detail?.displayVerdict || getUnifiedVerdict(detail)

  const tone = decisionReport.overallVerdict.tone || 'neutral'
  const label =
    tone === 'safe' ? '지원 추천' : tone === 'danger' ? '위험 신호 높음' : tone === 'warning' ? '조건부 지원 추천' : '추가 확인 필요'

  return {
    riskLevel: decisionReport.overallVerdict.code || 'verification_needed',
    label,
    tone,
    headline: decisionReport.overallVerdict.headline || '',
    decisionLevel: decisionReport.overallVerdict.decisionLevel || '',
    description: decisionReport.summary?.headline || decisionReport.overallVerdict.summary || '',
    reason: decisionReport.decisionGuide?.reason || decisionReport.summary?.oneLineReason || decisionReport.overallVerdict.summary || '',
    summary: decisionReport.overallVerdict.summary || '',
    topDecisionRisks: (decisionReport.riskSignals || []).map((item) => ({
      key: item?.key,
      summary: item?.summary || '',
      reason: item?.decisionMeaning || '',
    })),
  }
}

function buildDecisionReportSignalItems(decisionReport = null) {
  if (!decisionReport) return []

  const riskItems = (decisionReport.riskSignals || []).map((item) => String(item?.summary || '').trim()).filter(Boolean)
  const verificationItems = (decisionReport.verificationNeeded || [])
    .map((item) => String(item?.missingInfo || item?.questionToAsk || '').trim())
    .filter(Boolean)

  return [...new Set([...riskItems, ...verificationItems])].slice(0, 3)
}

function buildDecisionReportPriorityItems(decisionReport = null, axes = [], auxiliaryChecks = []) {
  if (!decisionReport) return derivePriorityItems(axes, auxiliaryChecks)

  const axisItems = [...(decisionReport.axes?.seven || decisionReport.axes?.five || [])].sort(compareAxisPriority).slice(0, 3)
  const verificationItems = (decisionReport.verificationNeeded || []).slice(0, 2).map((item) => ({
    key: item?.key,
    label: item?.label,
    question: item?.questionToAsk,
  }))

  return [...axisItems, ...verificationItems]
}

function buildDecisionReportAxes(decisionReport = null, fallbackAxes = []) {
  if (!decisionReport) return fallbackAxes
  const axes = decisionReport.axes?.seven || decisionReport.axes?.five || []
  return Array.isArray(axes) && axes.length > 0 ? [...axes].sort(compareAxisPriority) : fallbackAxes
}

function normalizeVerificationPrompt(item = {}) {
  const raw = String(item?.summaryNote || item?.whyItMatters || item?.missingInfo || item?.questionToAsk || '').trim()
  if (!raw) return ''

  return raw
    .replace(/^이 축은 위험 확정이 아니라 판단 불확실성을 키우는 정보 공백입니다\.\s*/u, '')
    .replace(/^정보가 부족하면 지원 판단을 보수적으로 해야 합니다\.\s*/u, '')
    .trim()
}

function buildRiskSignalCards(verdict = null, decisionReport = null, detailedAxes = [], auxiliaryChecks = []) {
  if (verdict?.topDecisionRisks?.length > 0) {
    return verdict.topDecisionRisks
      .map((item) => ({
        key: item?.key || item?.summary,
        summary: String(item?.summary || '').trim(),
        reason: String(item?.reason || '').trim(),
      }))
      .filter((item) => item.summary)
      .slice(0, 3)
  }

  if (decisionReport) {
    return (decisionReport.riskSignals || [])
      .map((item) => ({
        key: item?.key || item?.summary,
        summary: String(item?.summary || '').trim(),
        reason: String(item?.decisionMeaning || '').trim(),
      }))
      .filter((item) => item.summary)
      .slice(0, 3)
  }

  return buildRiskSignalItems(detailedAxes, auxiliaryChecks).slice(0, 3).map((item, index) => ({
    key: `fallback-${index}`,
    summary: String(item || '').trim(),
    reason: '',
  }))
}

async function getReport(analysisId, token) {
  const response = await fetch(`${API_BASE_URL}/api/analyze/${analysisId}/detail?token=${encodeURIComponent(token || '')}`, {
    cache: 'no-store',
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || '리포트를 불러오지 못했습니다.')
  return data
}

function ReportState({ title, message }) {
  return (
    <RebuildFlowShell bodyClassName={`${shellStyles.bodyWide} ${shellStyles.reportFrame}`}>
      <div className="report-page report-state-page">
        <section className="report-state-card">
          <p className="report-kicker">JOBRISK 상세 리포트</p>
          <h1>{title}</h1>
          <p>{message}</p>
        </section>
      </div>
    </RebuildFlowShell>
  )
}

function ReportSectionRail({ index, label, titleLines, bodyLines = [] }) {
  return (
    <div className="report-rebuild-rail">
      <div className="report-rebuild-rail-index">
        <span>{index}</span>
        <strong>{label}</strong>
      </div>
      <div className="report-rebuild-rail-line" aria-hidden="true" />
      <div className="report-rebuild-rail-copy">
        {titleLines.length ? (
          <h2>
            {titleLines.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </h2>
        ) : null}
        {bodyLines.length ? (
          <p>
            {bodyLines.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function SummaryMetaCard({ label, primary, secondary }) {
  if (!primary) return null

  return (
    <div className="report-rebuild-meta-card">
      <strong>{label}</strong>
      <div>
        <span>{primary}</span>
        {secondary ? <p>{secondary}</p> : null}
      </div>
    </div>
  )
}

function AxisLegendGuide() {
  return (
    <div className="report-rebuild-axis-legend" aria-label="축 해석 기준">
      <div className="report-rebuild-axis-legend-head">
        <strong>축 해석 기준</strong>
        <p>아래 7개 축의 상태를 이 기준으로 읽으면 됩니다.</p>
      </div>

      <div className="report-rebuild-axis-legend-list">
        {STATUS_LEGEND.map((item) => (
          <article className="report-rebuild-axis-legend-item" key={item.label}>
            <span className={`report-rebuild-status tone-${item.tone}`}>{item.label}</span>
            <p>{item.description}</p>
          </article>
        ))}
      </div>
    </div>
  )
}

function KeyAxisRow({ axis, index }) {
  const checkPoint = getAxisCheckPoint(axis)
  const hasDirectEvidence = Boolean(axis.evidence?.quote)
  const evidenceText = axis.evidence?.quote || getMissingInfoDescription(axis)
  const summaryText = normalizeAxisSummary(axis)

  return (
    <article className="report-rebuild-axis-row report-rebuild-reveal-item" style={{ '--reveal-delay': `${220 + index * 36}ms` }}>
      <div className="report-rebuild-axis-mark">
        <div className="report-rebuild-axis-icon" aria-hidden="true">
          <AxisIcon axisKey={axis.key} />
        </div>
        <div className="report-rebuild-axis-title">
          <span>{String(index + 1).padStart(2, '0')}</span>
          <h3>{axis.label}</h3>
          <em className={`report-rebuild-status tone-${getTone(axis.level)}`}>{getDisplayStatus(axis.level)}</em>
        </div>
      </div>

      <div className="report-rebuild-axis-column">
        <strong>해석</strong>
        <p>{summaryText}</p>
      </div>

      <div className="report-rebuild-axis-column">
        <strong>공고 근거</strong>
        <p>{evidenceText}</p>
      </div>

      <div className="report-rebuild-axis-column">
        <strong>확인 포인트</strong>
        <p>{checkPoint}</p>
      </div>

      <div className="report-rebuild-axis-arrow" aria-hidden="true">
        →
      </div>
    </article>
  )
}

function InterviewQuestionCard({ item, index }) {
  return (
    <article className="report-rebuild-question-card report-rebuild-reveal-item" style={{ '--reveal-delay': `${180 + index * 42}ms` }}>
      <span className="report-rebuild-card-index">{String(index + 1).padStart(2, '0')}</span>
      <h3>{item.question}</h3>
      <div className="report-rebuild-question-block">
        <strong>이 질문이 중요한 이유</strong>
        <p>{item.whyAsk || '이 질문을 통해 실제 역할 범위와 평가 기준을 검증할 수 있습니다.'}</p>
      </div>
      <div className="report-rebuild-question-block">
        <strong>좋은 답변 힌트</strong>
        <p>{item.goodAnswerSignal || '구체적인 기준, 우선순위, 평가 방식을 함께 제시하는 답변이 좋습니다.'}</p>
      </div>
      <div className="report-rebuild-question-block">
        <strong>위험 답변 신호</strong>
        <p>{item.riskyAnswerSignal || '권한, 기준, 결과물을 끝까지 모호하게 설명하면 보수적으로 보는 편이 안전합니다.'}</p>
      </div>
      <div className="report-rebuild-question-block">
        <strong>답변에 따른 판단 기준</strong>
        <p>{item.answerDecisionHint || '답변이 구체적이면 진행 판단이 쉬워지고, 모호하면 보수적으로 보는 편이 안전합니다.'}</p>
      </div>
    </article>
  )
}

export default async function ReportPage({ params, searchParams }) {
  const resolvedParams = await params
  const resolvedSearchParams = await searchParams
  const analysisId = resolvedParams?.analysisId || ''
  const token = resolvedSearchParams?.token || ''
  let report

  try {
    if (!analysisId) throw new Error('분석 결과 ID를 찾을 수 없습니다.')
    report = await getReport(analysisId, token)
  } catch (error) {
    return <ReportState title="리포트를 찾을 수 없습니다." message={error.message} />
  }

  const detail = report?.detail || {}
  const decisionReport = report?.decisionReport || null
  const axes = detail?.sevenAxes || detail?.fiveAxes || []
  const auxiliaryChecks = detail?.auxiliaryChecks || []
  const evidence = detail?.keyEvidence || []
  const questions = decisionReport?.recommendedQuestions || detail?.interviewQuestions || []
  const verificationNeeded = decisionReport?.verificationNeeded || []
  const evidenceByQuote = new Map(evidence.filter((item) => item?.quote).map((item) => [item.quote, item]))
  const decisionAxes = buildDecisionReportAxes(decisionReport, axes)
  const detailedAxes = decisionAxes
    .map((axis) => ({
      ...axis,
      detailItem: axis?.evidence?.quote ? evidenceByQuote.get(axis.evidence.quote) || null : null,
    }))
    .sort(compareAxisPriority)

  const verdict = normalizeDecisionReportVerdict(decisionReport, detail)
  const target = getAnalysisTarget(report, detail)
  const analyzedAt = formatReportDate(report, detail)
  const confidenceScore = decisionReport?.overallVerdict?.confidenceScore || getScoreFromAxes(axes, auxiliaryChecks)
  const confidenceReason = decisionReport?.overallVerdict?.confidenceReason || '근거가 구체적일수록 점수의 신뢰도가 높습니다.'
  const priorityQuestions = questions.slice(0, 6)
  const additionalQuestions = questions.slice(6)
  const topAxes = detailedAxes.slice(0, 7)
  const riskSignalCards = buildRiskSignalCards(verdict, decisionReport, detailedAxes, auxiliaryChecks)
  const priorityItems = buildDecisionReportPriorityItems(decisionReport, detailedAxes, auxiliaryChecks)
  const actionGuideText = decisionReport?.decisionGuide?.reason || detail?.actionGuide || verdict.summary
  const finalHeadline = decisionReport?.decisionGuide?.headline || verdict.headline || getDecisionHeadline(actionGuideText, verdict.tone)
  const finalActionChecks =
    (decisionReport?.decisionGuide?.nextSteps || []).slice(0, 3).length > 0
      ? (decisionReport?.decisionGuide?.nextSteps || []).slice(0, 3)
      : buildFinalActionChecks(priorityItems)
  const verificationNotes =
    (decisionReport?.decisionGuide?.verificationNotes || []).slice(0, 3).length > 0
      ? (decisionReport?.decisionGuide?.verificationNotes || []).slice(0, 3)
      : verificationNeeded.slice(0, 3).map((item) => normalizeVerificationPrompt(item)).filter(Boolean)

  return (
    <RebuildFlowShell bodyClassName={`${shellStyles.bodyWide} ${shellStyles.reportFrame}`}>
      <PaidReportViewTracker analysisId={analysisId} />
      <div className="report-page report-rebuild-page">
        <RevealSection as="section" className="report-rebuild-section" aria-labelledby="report-summary-heading">
            <div className="report-rebuild-reveal-item report-rebuild-reveal-rail">
              <ReportSectionRail
              index="01"
              label="REPORT SUMMARY"
              titleLines={['이 공고의 위험을 분석했습니다']}
              bodyLines={[]}
            />
            </div>

          <div className="report-rebuild-content report-rebuild-reveal-item report-rebuild-reveal-content" style={{ '--reveal-delay': '80ms' }}>
            <div className="report-rebuild-panel report-rebuild-summary-panel report-rebuild-reveal-item" style={{ '--reveal-delay': '140ms' }}>
              <div className="report-rebuild-summary-grid">
                <article className="report-rebuild-card report-rebuild-card-large report-rebuild-reveal-item" style={{ '--reveal-delay': '180ms' }}>
                  <span className="report-rebuild-card-label">종합 판단</span>
                  <HeroTypingTitle
                    className="report-rebuild-hero-title"
                    id="report-summary-heading"
                    reserveLines={1}
                    text={verdict.headline || getSummaryHeadline(verdict.tone)}
                  />
                  <p>{verdict.description || verdict.summary}</p>
                  {verdict.reason ? <p>{verdict.reason}</p> : null}
                </article>

                <article className="report-rebuild-card report-rebuild-score-card report-rebuild-reveal-item" style={{ '--reveal-delay': '240ms' }}>
                  <span className="report-rebuild-card-label">신뢰도</span>
                  <strong>
                    {confidenceScore}
                    <small>/100</small>
                  </strong>
                  <div className="report-rebuild-score-bar" aria-hidden="true">
                    <span style={{ width: `${confidenceScore}%` }} />
                  </div>
                  <p>{confidenceReason}</p>
                </article>

                <article className="report-rebuild-card report-rebuild-signal-card report-rebuild-reveal-item" style={{ '--reveal-delay': '300ms' }}>
                  <span className="report-rebuild-card-label">Top 3 결정 리스크</span>
                  <ol className="report-rebuild-signal-list">
                    {riskSignalCards.map((signal, index) => (
                      <li key={`${signal.key}-${index}`}>
                        <span>{index + 1}</span>
                        <div>
                          <p>{signal.summary}</p>
                          {signal.reason ? <small>{signal.reason}</small> : null}
                        </div>
                      </li>
                    ))}
                  </ol>
                </article>
              </div>

              <div className="report-rebuild-meta-grid report-rebuild-reveal-item" style={{ '--reveal-delay': '340ms' }}>
                <SummaryMetaCard label="분석 대상" primary={target.primary} secondary={target.secondary} />
                <SummaryMetaCard label="분석 일시" primary={analyzedAt} />
              </div>
            </div>

          </div>
        </RevealSection>

        <RevealSection as="section" className="report-rebuild-section" aria-labelledby="key-axes-heading">
            <div className="report-rebuild-reveal-item report-rebuild-reveal-rail">
              <ReportSectionRail
              index="02"
              label="KEY AXES"
              titleLines={['7개 핵심 축으로', '공고를 분석했습니다']}
              bodyLines={[]}
            />
            </div>

          <div className="report-rebuild-content report-rebuild-reveal-item report-rebuild-reveal-content" style={{ '--reveal-delay': '80ms' }}>
            <div className="report-rebuild-reveal-item" style={{ '--reveal-delay': '130ms' }}>
              <AxisLegendGuide />
            </div>
            <div className="report-rebuild-panel report-rebuild-axis-table report-rebuild-reveal-item" style={{ '--reveal-delay': '190ms' }}>
              {topAxes.map((axis, index) => (
                <KeyAxisRow axis={axis} index={index} key={`${axis.key}-${index}`} />
              ))}
            </div>
          </div>
        </RevealSection>

        <RevealSection as="section" className="report-rebuild-section" aria-labelledby="interview-guide-heading">
          <div className="report-rebuild-reveal-item report-rebuild-reveal-rail">
            <ReportSectionRail index="03" label="INTERVIEW GUIDE" titleLines={['면접에서 반드시', '확인할 핵심 질문']} bodyLines={[]} />
          </div>

          <div className="report-rebuild-content report-rebuild-reveal-item report-rebuild-reveal-content" style={{ '--reveal-delay': '80ms' }}>
            <div className="report-rebuild-panel report-rebuild-reveal-item" style={{ '--reveal-delay': '140ms' }}>
              <div className="report-rebuild-question-grid">
                {priorityQuestions.map((item, index) => (
                  <InterviewQuestionCard item={item} index={index} key={`${item.question}-${index}`} />
                ))}
              </div>
                {additionalQuestions.length ? (
                  <button className="report-rebuild-secondary-button report-rebuild-reveal-item" style={{ '--reveal-delay': '220ms' }} type="button">
                    전체 질문 리스트 보기
                  </button>
                ) : null}
            </div>
          </div>
        </RevealSection>

        <RevealSection as="section" className="report-rebuild-section" aria-labelledby="final-action-heading">
            <div className="report-rebuild-reveal-item report-rebuild-reveal-rail">
              <ReportSectionRail
              index="04"
              label="FINAL ACTION"
              titleLines={['최종 판단과', '다음 단계 제안']}
              bodyLines={[]}
            />
            </div>

          <div className="report-rebuild-content report-rebuild-reveal-item report-rebuild-reveal-content" style={{ '--reveal-delay': '80ms' }}>
            <div className="report-rebuild-final-stack report-rebuild-reveal-item" style={{ '--reveal-delay': '120ms' }}>
              <div className="report-rebuild-panel report-rebuild-final-grid report-rebuild-reveal-item" style={{ '--reveal-delay': '170ms' }}>
              <article className="report-rebuild-final-card report-rebuild-reveal-item" style={{ '--reveal-delay': '220ms' }}>
                <span className="report-rebuild-card-label">최종 권고</span>
                <h2 id="final-action-heading">{finalHeadline}</h2>
                <p>{actionGuideText}</p>
              </article>

              <article className="report-rebuild-next-card report-rebuild-reveal-item" style={{ '--reveal-delay': '280ms' }}>
                <span className="report-rebuild-card-label">다음 단계 제안</span>
                <ul>
                  {finalActionChecks.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
              {verificationNotes.length ? (
                <article className="report-rebuild-next-card report-rebuild-reveal-item" style={{ '--reveal-delay': '340ms' }}>
                  <span className="report-rebuild-card-label">추가 확인 필요</span>
                  <ul>
                    {verificationNotes.map((item, index) => (
                      <li key={`${item}-${index}`}>{item}</li>
                    ))}
                  </ul>
                </article>
              ) : null}
              </div>

            </div>
          </div>
        </RevealSection>

        <RevealSection as="section" className="report-rebuild-section" aria-labelledby="paid-report-feedback-heading">
            <div className="report-rebuild-reveal-item report-rebuild-reveal-rail">
              <ReportSectionRail
              index="05"
              label="PAID REPORT FEEDBACK"
              titleLines={['의견을 보내주세요']}
              bodyLines={[]}
            />
            </div>

          <div className="report-rebuild-content report-rebuild-reveal-item report-rebuild-reveal-content" style={{ '--reveal-delay': '80ms' }}>
            <div className="report-rebuild-reveal-item" style={{ '--reveal-delay': '140ms' }}>
              <ReportFeedbackCard analysisId={analysisId} />
            </div>
          </div>
        </RevealSection>

      </div>
    </RebuildFlowShell>
  )
}
