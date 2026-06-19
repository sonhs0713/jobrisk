import SiteFooter from '../../../components/SiteFooter'
import SiteHeader from '../../../components/SiteHeader'
import ReportFeedback from './ReportFeedback'
import { getCompanyContextSection } from '../../../../shared/companyContextView.js'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:4000'

const axisDefinitions = {
  repetition: '운영만 반복하는 역할인지, 기획·개선까지 맡는지 봅니다.',
  responsibility: '결과 책임과 결정 권한이 실제로 있는지 봅니다.',
  measurable: '나중에 성과를 숫자나 결과물로 설명할 수 있는지 봅니다.',
  difficulty: '시간이 갈수록 더 어려운 문제를 맡게 되는지 봅니다.',
  transferable: '다른 회사에서도 설명 가능한 결과물과 경험이 남는지 봅니다.',
  scopeClarity: '업무 범위가 명확한지, 여러 직무가 섞여 전문성이 흐려지지 않는지 봅니다.',
  learningFeedback: '업무 결과를 보고 배우고 개선하는 구조가 있는지 봅니다.',
}

const companyStageLabels = {
  startup: '초기 단계',
  growth: '성장 단계',
  enterprise: '안정 단계',
}

const industryLabels = {
  ai: 'AI',
  ecommerce: '커머스',
  saas: 'SaaS',
  fintech: '핀테크',
  healthcare: '헬스케어',
  gaming: '게임',
}

function getTone(level = '') {
  const normalized = String(level).toLowerCase()
  if (normalized.includes('high') || normalized.includes('risk')) return 'danger'
  if (
    normalized.includes('mixed') ||
    normalized.includes('medium') ||
    normalized.includes('review') ||
    normalized.includes('need') ||
    normalized.includes('check') ||
    normalized.includes('insufficient')
  ) {
    return 'warning'
  }
  if (normalized.includes('low') || normalized.includes('positive')) return 'safe'
  return 'neutral'
}

function getAxisStatus(level = '') {
  if (level === 'risk') return '주의'
  if (level === 'strong_positive') return '좋음'
  if (level === 'mixed_signal' || level === 'positive_with_check') return '보통'
  if (level === 'insufficient_info') return '정보부족'
  if (level === 'high') return '위험'
  if (level === 'medium') return '추가 확인'
  if (level === 'low') return '좋음'
  return '보통'
}

function getAuxiliaryStatus(level = '') {
  if (level === 'high') return '위험'
  if (level === 'medium') return '추가 확인'
  if (level === 'low') return '좋음'
  if (level === 'insufficient_info') return '정보부족'
  return '확인 필요'
}

function getStatusLabel(level = '') {
  if (['high', 'medium', 'low', 'insufficient_info'].includes(level)) return getAuxiliaryStatus(level)
  return getAxisStatus(level)
}

function getUnifiedAxisStatus(level = '') {
  if (level === 'risk' || level === 'high') return '위험'
  if (level === 'strong_positive' || level === 'low') return '좋음'
  if (level === 'insufficient_info') return '정보 부족'
  return '확인 필요'
}

function getUnifiedAuxiliaryStatus(level = '') {
  if (level === 'high') return '보류'
  if (level === 'low') return '좋음'
  if (level === 'insufficient_info') return '정보 부족'
  return '확인 필요'
}

function getUnifiedStatusLabel(level = '') {
  if (['high', 'medium', 'low', 'insufficient_info'].includes(level)) return getUnifiedAuxiliaryStatus(level)
  return getUnifiedAxisStatus(level)
}

function getUnifiedDisplayVerdict(detail) {
  const auxiliaryChecks = detail?.auxiliaryChecks || []
  const axes = detail?.sevenAxes || detail?.fiveAxes || []
  const applicationSafety = auxiliaryChecks.find((item) => item.key === 'applicationSafety')
  const contractConsistency = auxiliaryChecks.find((item) => item.key === 'contractConsistency')
  const employmentForm = auxiliaryChecks.find((item) => item.key === 'employmentForm')
  const riskCount = axes.filter((axis) => axis.level === 'risk').length
  const mixedCount = axes.filter((axis) => ['mixed_signal', 'positive_with_check'].includes(axis.level)).length
  const strongPositiveCount = axes.filter((axis) => axis.level === 'strong_positive').length

  if (applicationSafety?.level === 'high' || contractConsistency?.level === 'high' || employmentForm?.level === 'high') {
    return {
      label: '지원 전 보류',
      description: '지원 전에 계약 주체, 공식 채널, 고용 형태와 실제 소속을 먼저 문서로 확인하는 편이 안전합니다.',
      tone: 'danger',
    }
  }

  if (riskCount >= 2) {
    return {
      label: '위험',
      description: '반복 운영 비중이나 역할 구조에서 강한 위험 신호가 보여, 지원 전에 핵심 조건을 먼저 검증하는 편이 안전합니다.',
      tone: 'warning',
    }
  }

  if (riskCount >= 1 || mixedCount >= 1 || applicationSafety?.level === 'medium') {
    return {
      label: '추가 확인 필요',
      description: '좋은 신호가 있어도 실제 권한, 성과 기준, 계약 조건은 면접에서 더 확인해야 합니다.',
      tone: 'warning',
    }
  }

  if (strongPositiveCount >= 2) {
    return {
      label: '좋음',
      description: '공고 기준으로는 좋은 근거가 비교적 선명합니다. 다만 실제 평가 방식과 책임 범위는 면접에서 확인하는 편이 안전합니다.',
      tone: 'safe',
    }
  }

  return {
    label: '추가 확인 필요',
    description: '공고만으로는 단정할 근거가 부족해, 면접에서 역할과 성과 구조를 더 확인해야 합니다.',
    tone: 'warning',
  }
}

function getReportHeroTitle(tone = 'warning') {
  if (tone === 'safe') return '물경력 위험이 낮아 보입니다'
  if (tone === 'danger') return '물경력 위험 신호가 큽니다'
  return '지원 전 확인이 필요합니다'
}

const axisHeadlineMap = {
  repetition: '단순 운영 비중을 먼저 확인해야 합니다',
  responsibility: '이 역할이 실행 지원인지, 결과 책임까지 맡는지 먼저 확인해야 합니다',
  measurable: '이 역할이 어떤 성과를 만들고 어떻게 평가받는지 먼저 확인해야 합니다',
  difficulty: '더 어려운 일을 맡게 되는 구조인지 먼저 확인해야 합니다',
  transferable: '이 경험이 다음 이직에서도 설명될 수 있는지 먼저 확인해야 합니다',
  scopeClarity: '업무 범위와 핵심 역할이 선명한지 먼저 확인해야 합니다',
  learningFeedback: '배우고 개선하는 구조가 있는지 먼저 확인해야 합니다',
}

const auxiliaryHeadlineMap = {
  applicationSafety: '지원 경로와 회사 실체를 먼저 확인해야 합니다',
  contractConsistency: '계약 구조를 먼저 확인해야 합니다',
  employmentForm: '고용 형태를 먼저 확인해야 합니다',
  workLocationClarity: '근무 위치와 소속 구조를 먼저 확인해야 합니다',
  roleClarity: '실제 역할 범위를 먼저 확인해야 합니다',
}

function getReportHeroHeadline(verdict, priorityItems = []) {
  const leadItem = priorityItems[0]
  if (leadItem?.key && auxiliaryHeadlineMap[leadItem.key]) return auxiliaryHeadlineMap[leadItem.key]
  if (leadItem?.key && axisHeadlineMap[leadItem.key]) return axisHeadlineMap[leadItem.key]
  if (verdict?.tone === 'safe') return '좋은 신호가 보이지만 핵심 조건은 확인이 필요합니다'
  if (verdict?.tone === 'danger') return '지원 전에 핵심 조건 검증이 필요합니다'
  return '핵심 조건을 더 확인해야 합니다'
}

function getReportHeroBridge(verdict, priorityItems = []) {
  const leadItem = priorityItems[0]
  const leadReason = leadItem?.checklistReason || ''
  const verdictDescription = verdict?.description || ''

  if (leadReason && verdictDescription) {
    return `${leadReason} ${verdictDescription}`
  }

  return leadReason || verdictDescription || '공고 기준으로는 핵심 조건이 충분히 드러나지 않아, 면접에서 역할과 성과 구조를 먼저 확인해야 합니다.'
}

function getActionGuideText(verdict, priorityItems = [], priorityQuestions = []) {
  const leadItem = priorityItems[0]
  const firstQuestion = priorityQuestions[0]

  if (verdict?.tone === 'danger') {
    return '계약 주체, 역할 범위, 평가 기준이 모호하면 바로 지원하지 말고 먼저 확인하세요.'
  }

  if (verdict?.tone === 'safe') {
    return firstQuestion?.question
      ? `긍정 신호가 보여도 "${firstQuestion.question}"부터 확인해 실제 권한과 성장 여지를 검증하세요.`
      : '긍정 신호가 보여도 실제 권한과 평가 기준은 면접에서 한 번 더 확인하세요.'
  }

  if (leadItem?.label) {
    return `${leadItem.label}부터 확인하고, 답이 모호하면 지원을 보류하는 쪽이 안전합니다.`
  }

  return '역할 범위와 평가 기준이 모호하면 지원을 서두르지 말고 면접에서 먼저 확인하세요.'
}

function getChecklistReason(axis) {
  const map = {
    repetition: '운영성 업무 비중이 얼마나 큰지, 개선 기회가 함께 있는지 먼저 확인해야 합니다.',
    responsibility: '실행만 맡는 역할인지, 결과와 방향까지 맡는 역할인지 먼저 확인해야 합니다.',
    measurable: '성과가 숫자와 결과물로 남는 구조인지 물어봐야 합니다.',
    difficulty: '입사 후 더 어려운 문제를 맡는 성장 구조인지 확인해야 합니다.',
    transferable: '이 경험이 다음 커리어에도 설명 가능한 결과물로 남는지 확인해야 합니다.',
    scopeClarity: '업무 범위가 넓어 보여도 핵심 역할과 책임 경계가 선명한지 확인해야 합니다.',
    learningFeedback: '처리로 끝나는지, 회고와 개선으로 이어지는지 확인해야 합니다.',
  }

  return map[axis?.key] || '면접에서 역할, 책임, 권한, 성과 기준을 구체적으로 확인해야 합니다.'
}

function getVerdict(detail) {
  const auxiliaryChecks = detail?.auxiliaryChecks || []
  const axes = detail?.sevenAxes || detail?.fiveAxes || []
  const applicationSafety = auxiliaryChecks.find((item) => item.key === 'applicationSafety')
  const contractConsistency = auxiliaryChecks.find((item) => item.key === 'contractConsistency')
  const riskCount = axes.filter((axis) => axis.level === 'risk').length
  const mixedCount = axes.filter((axis) => ['mixed_signal', 'positive_with_check'].includes(axis.level)).length
  const strongPositiveCount = axes.filter((axis) => axis.level === 'strong_positive').length

  if (applicationSafety?.level === 'high') {
    return {
      label: '검증 전 지원 보류',
      description: '경력서 제출 전 법인 실체, 계약 주체, 회사 이메일부터 확인하는 편이 안전합니다.',
    }
  }

  if (contractConsistency?.level === 'high' || riskCount >= 2) {
    return {
      label: '주의',
      description: '계약 구조 또는 업무 범위에서 강한 주의 신호가 보여 먼저 검증이 필요합니다.',
    }
  }

  if (riskCount >= 1 || mixedCount >= 1 || applicationSafety?.level === 'medium') {
    return {
      label: '보통',
      description: '긍정 신호와 확인 필요 신호가 섞여 있어, 지원 전 검증 질문이 중요합니다.',
    }
  }

  if (strongPositiveCount >= 2) {
    return {
      label: '좋음',
      description: '현재 공고 기준으로는 비교적 긍정 신호가 보이지만 실제 권한과 성과 기준은 확인이 필요합니다.',
    }
  }

  return {
    label: '정보부족',
    description: '공고만으로는 판단 근거가 부족해, 지원 전에 핵심 정보를 먼저 확인해야 합니다.',
  }
}

function formatConfidenceValue(item, labels) {
  const value = item?.value
  if (!value) return null
  return labels?.[value] || value
}

function selectChecklistAxes(axes) {
  const groups = ['risk', 'mixed_signal', 'positive_with_check', 'insufficient_info']
  const selected = groups.flatMap((level) => axes.filter((axis) => axis.level === level))
  if (selected.length > 0) return selected.slice(0, 3)

  return axes.slice(0, 2)
}

function buildPriorityItems(axes, auxiliaryChecks) {
  const safetyChecks = (auxiliaryChecks || []).filter((item) =>
    ['applicationSafety', 'contractConsistency', 'workLocationClarity', 'roleClarity'].includes(item.key),
  )
  const axisChecks = selectChecklistAxes(axes || []).map((axis) => ({
    ...axis,
    checklistReason: getChecklistReason(axis),
  }))

  return [
    ...safetyChecks.map((item) => ({
      ...item,
      checklistReason: item.summary,
    })),
    ...axisChecks,
  ].slice(0, 4)
}

function getVerdictV2(detail) {
  const auxiliaryChecks = detail?.auxiliaryChecks || []
  const axes = detail?.sevenAxes || detail?.fiveAxes || []
  const applicationSafety = auxiliaryChecks.find((item) => item.key === 'applicationSafety')
  const contractConsistency = auxiliaryChecks.find((item) => item.key === 'contractConsistency')
  const employmentForm = auxiliaryChecks.find((item) => item.key === 'employmentForm')
  const riskCount = axes.filter((axis) => axis.level === 'risk').length
  const mixedCount = axes.filter((axis) => ['mixed_signal', 'positive_with_check'].includes(axis.level)).length
  const strongPositiveCount = axes.filter((axis) => axis.level === 'strong_positive').length

  if (applicationSafety?.level === 'high') {
    return {
      label: '검증 전 제출 보류',
      description: '경력서 제출 전에 회사 실체, 공식 제출처, 계약 주체를 먼저 확인해야 합니다.',
      tone: 'danger',
    }
  }

  if (contractConsistency?.level === 'high' || employmentForm?.level === 'high') {
    return {
      label: '신원·계약 검증 우선',
      description: '계약 형태와 실제 소속이 엇갈릴 수 있어 지원 전에 계약 구조를 먼저 문서로 확인해야 합니다.',
      tone: 'danger',
    }
  }

  if (riskCount >= 2) {
    return {
      label: '경력서 제출 전 확인 필요',
      description: '물경력 신호와 공고 불명확성이 함께 보여, 지원 전에 핵심 조건을 먼저 확인해야 합니다.',
      tone: 'warning',
    }
  }

  if (riskCount >= 1 || mixedCount >= 1 || applicationSafety?.level === 'medium') {
    return {
      label: '경력서 제출 전 확인 필요',
      description: '좋아 보이는 표현이 있어도 실제 권한, 계약 조건, 성과 기준은 면접에서 확인해야 합니다.',
      tone: 'warning',
    }
  }

  if (strongPositiveCount >= 2) {
    return {
      label: '지원 전 핵심 확인 권장',
      description: '현재 공고 기준으로는 비교적 긍정 신호가 있지만, 실제 권한과 성과 기준은 확인이 필요합니다.',
      tone: 'safe',
    }
  }

  return {
    label: '추가 정보 확인 필요',
    description: '공고만으로는 판단 근거가 부족해, 지원 전에 핵심 정보를 먼저 확인해야 합니다.',
    tone: 'warning',
  }
}

function getDisplayVerdict(detail) {
  const auxiliaryChecks = detail?.auxiliaryChecks || []
  const axes = detail?.sevenAxes || detail?.fiveAxes || []
  const applicationSafety = auxiliaryChecks.find((item) => item.key === 'applicationSafety')
  const contractConsistency = auxiliaryChecks.find((item) => item.key === 'contractConsistency')
  const employmentForm = auxiliaryChecks.find((item) => item.key === 'employmentForm')
  const riskCount = axes.filter((axis) => axis.level === 'risk').length
  const mixedCount = axes.filter((axis) => ['mixed_signal', 'positive_with_check'].includes(axis.level)).length
  const strongPositiveCount = axes.filter((axis) => axis.level === 'strong_positive').length

  if (applicationSafety?.level === 'high') {
    return {
      label: '검증 전 제출 보류',
      description: '경력서 제출 전에 회사 실체, 공식 제출 경로, 계약 주체를 먼저 확인해야 합니다.',
      tone: 'danger',
    }
  }

  if (contractConsistency?.level === 'high' || employmentForm?.level === 'high') {
    return {
      label: '신원·계약 검증 우선',
      description: '계약 형태와 실제 소속 설명이 엇갈려 있어, 지원 전 계약 구조를 먼저 문서로 확인해야 합니다.',
      tone: 'danger',
    }
  }

  if (riskCount >= 2) {
    return {
      label: '경력서 제출 전 확인 필요',
      description: '물경력 위험 신호와 공고 불명확성이 함께 보여, 지원 전 조건과 역할을 먼저 확인해야 합니다.',
      tone: 'warning',
    }
  }

  if (riskCount >= 1 || mixedCount >= 1 || applicationSafety?.level === 'medium') {
    return {
      label: '경력서 제출 전 확인 필요',
      description: '좋은 신호가 있어도 실제 권한, 성과 기준, 계약 조건은 면접에서 더 확인하는 편이 안전합니다.',
      tone: 'warning',
    }
  }

  if (strongPositiveCount >= 3) {
    return {
      label: '낮은 물경력 위험',
      description: '핵심 목표, 권한, 산출물, 협업 구조가 비교적 분명해 경력 자산으로 설명하기 좋은 공고에 가깝습니다.',
      tone: 'safe',
    }
  }

  if (strongPositiveCount >= 2) {
    return {
      label: '좋은 공고이나 세부 확인 필요',
      description: '핵심 긍정 신호는 충분하지만 기준선, 평가 방식, 보상 세부 조건은 면접에서 더 확인하는 편이 안전합니다.',
      tone: 'safe',
    }
  }

  return getVerdictV2(detail)
}

function buildPriorityItemsV2(axes, auxiliaryChecks) {
  const safetyOrder = ['applicationSafety', 'contractConsistency', 'employmentForm', 'workLocationClarity', 'roleClarity']
  const safetyChecks = safetyOrder
    .map((key) => (auxiliaryChecks || []).find((item) => item.key === key))
    .filter(Boolean)
  const axisChecks = selectChecklistAxes(axes || []).map((axis) => ({
    ...axis,
    checklistReason: getChecklistReason(axis),
  }))

  return [
    ...safetyChecks.map((item) => ({
      ...item,
      checklistReason: item.summary,
    })),
    ...axisChecks,
  ].slice(0, 5)
}

function getMissingInfoDescription(axis) {
  const map = {
    repetition: '운영 업무 중 반복 처리와 개선 업무 비중은 공고에서 분명하지 않습니다.',
    responsibility: '결정 권한, 승인 범위, 보고 라인은 공고에서 분명하지 않습니다.',
    measurable: '성과 기준, KPI, 산출물, 평가 방식은 공고에서 확인되지 않습니다.',
    difficulty: '시간이 지나며 더 어려운 문제를 맡는 구조는 공고에서 확인되지 않습니다.',
    transferable: '외부 이직 시장에서도 설명 가능한 결과물이 남는지는 공고에서 분명하지 않습니다.',
    scopeClarity: '핵심 업무 범위와 잡무 비중 구분은 공고에서 충분히 드러나지 않습니다.',
    learningFeedback: '회고, 성과 리뷰, 개선 프로세스는 공고에서 확인되지 않습니다.',
  }

  return map[axis?.key] || '이 항목은 공고에서 확인되지 않는 정보가 많아 추가 확인이 필요합니다.'
}

function compareAxisPriority(a, b) {
  const levelPriority = {
    risk: 0,
    mixed_signal: 1,
    positive_with_check: 2,
    insufficient_info: 3,
    strong_positive: 4,
  }
  const axisPriority = {
    responsibility: 0,
    repetition: 1,
    measurable: 2,
    transferable: 3,
    difficulty: 4,
    scopeClarity: 5,
    learningFeedback: 6,
  }
  const levelDiff = (levelPriority[a?.level] ?? 99) - (levelPriority[b?.level] ?? 99)
  if (levelDiff !== 0) return levelDiff
  return (axisPriority[a?.key] ?? 99) - (axisPriority[b?.key] ?? 99)
}

function splitDeepDiveAxes(axes) {
  const issueLevels = ['risk', 'mixed_signal', 'positive_with_check']
  const issueAxes = axes.filter((axis) => issueLevels.includes(axis.level)).sort(compareAxisPriority)
  const fillerAxes = axes.filter((axis) => !issueLevels.includes(axis.level) && axis.level !== 'strong_positive').sort(compareAxisPriority)
  const primary = [...issueAxes, ...fillerAxes].slice(0, 3)
  if (primary.length === 0) {
    return {
      primaryAxes: axes.slice(0, 1),
      foldedAxes: axes.slice(1),
    }
  }

  return {
    primaryAxes: primary,
    foldedAxes: axes.filter((axis) => !primary.some((item) => item.key === axis.key)),
  }
}

function splitDisplayAxes(axes) {
  const issueLevels = ['risk', 'mixed_signal', 'positive_with_check']
  const issueAxes = axes.filter((axis) => issueLevels.includes(axis.level)).sort(compareAxisPriority)
  if (issueAxes.length > 0) return splitDeepDiveAxes(axes)

  const strongAxes = axes.filter((axis) => axis.level === 'strong_positive').sort(compareAxisPriority)
  if (strongAxes.length > 0) {
    const primary = [...strongAxes, ...axes.filter((axis) => axis.level !== 'strong_positive').sort(compareAxisPriority)].slice(0, 3)
    return {
      primaryAxes: primary,
      foldedAxes: axes.filter((axis) => !primary.some((item) => item.key === axis.key)),
    }
  }

  return splitDeepDiveAxes(axes)
}

function buildAxisDetails(axes, evidenceByQuote) {
  return axes.map((axis) => ({
    ...axis,
    detailItem: axis.evidence?.quote ? evidenceByQuote.get(axis.evidence.quote) || null : null,
  }))
}

function summarizeMissingInfo(axes) {
  const missingLabels = (axes || []).filter((axis) => axis.level === 'insufficient_info').map((axis) => axis.label)
  if (!missingLabels.length) return ''
  return `공고에서 확인되지 않는 정보: ${missingLabels.join(', ')}`
}

async function getReport(analysisId, token) {
  const response = await fetch(
    `${API_BASE_URL}/api/analyze/${analysisId}/detail?token=${encodeURIComponent(token || '')}`,
    { cache: 'no-store' },
  )
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || '리포트를 불러오지 못했습니다.')
  return data
}

function ReportState({ title, message }) {
  return (
    <>
      <SiteHeader variant="report" />
      <main className="report-page report-state-page">
        <section className="report-state-card">
          <p className="report-kicker">JobRisk 상세 리포트</p>
          <h1>{title}</h1>
          <p>{message}</p>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}

function AxisInsightCard({ axis }) {
  const tone = getTone(axis.level)
  const missingInfoSummary = axis.evidence?.quote ? '' : summarizeMissingInfo([axis])

  return (
    <article className="report-evidence-card report-axis-insight-card">
      <div className="report-card-head report-card-head-inline">
        <div className="report-card-title-block">
          <h3>{axis.label}</h3>
          <p className="report-axis-definition">{axisDefinitions[axis.key] || '이 기준이 실제 경력 자산으로 이어지는지 보는 항목입니다.'}</p>
        </div>
        <span className={`report-status-chip tone-${tone}`}>{getUnifiedAxisStatus(axis.level)}</span>
      </div>
      <div className="evidence-block">
        <strong>판단 요약</strong>
        <p>{axis.summary}</p>
      </div>
      <div className="evidence-block evidence-block-quote">
        <strong>공고 원문 근거</strong>
        {axis.evidence?.quote ? <blockquote>{axis.evidence.quote}</blockquote> : <p>{missingInfoSummary || '공고 원문에서 직접 확인할 근거가 부족합니다.'}</p>}
      </div>
      <div className="evidence-block">
        <strong>왜 중요한가요</strong>
        <p>{axis.detailItem?.whyImportant || getChecklistReason(axis)}</p>
      </div>
    </article>
  )
}

function AxisInsightCardV2({ axis }) {
  const tone = getTone(axis.level)
  const missingInfoSummary = axis.evidence?.quote ? '' : getMissingInfoDescription(axis)
  const followUpReason = axis.detailItem?.whyImportant || getChecklistReason(axis)

  return (
    <article className="report-evidence-card report-axis-insight-card">
      <div className="report-card-head report-card-head-inline">
        <div className="report-card-title-block">
          <h3>{axis.label}</h3>
          <p className="report-axis-definition">{axisDefinitions[axis.key] || '이 기준이 실제 경력 자산으로 이어지는지 보는 항목입니다.'}</p>
        </div>
        <span className={`report-status-chip tone-${tone}`}>{getUnifiedAxisStatus(axis.level)}</span>
      </div>
      <div className="evidence-block">
        <strong>판단 요약</strong>
        <p>{axis.summary}</p>
      </div>
      <div className="evidence-block evidence-block-quote">
        <strong>{axis.evidence?.quote ? '공고 원문 근거' : '공고에서 확인되지 않는 정보'}</strong>
        {axis.evidence?.quote ? (
          <blockquote>{axis.evidence.quote}</blockquote>
        ) : (
          <p>{missingInfoSummary || '공고에서 확인되지 않는 정보가 많아 추가 확인이 필요합니다.'}</p>
        )}
      </div>
      <div className="evidence-block">
        <strong>면접에서 확인할 점</strong>
        <p>{followUpReason}</p>
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
  const axes = detail?.sevenAxes || detail?.fiveAxes || []
  const auxiliaryChecks = detail?.auxiliaryChecks || []
  const evidence = detail?.keyEvidence || []
  const questions = detail?.interviewQuestions || []
  const companyContext = detail?.companyContext || null
  const evidenceByQuote = new Map(evidence.filter((item) => item?.quote).map((item) => [item.quote, item]))
  const priorityItems = buildPriorityItemsV2(axes, auxiliaryChecks)
  const detailedAxes = buildAxisDetails(axes, evidenceByQuote)
  const deepDiveAxes = [...detailedAxes].sort(compareAxisPriority)
  const priorityQuestions = questions.slice(0, 3)
  const additionalQuestions = questions.slice(3)
  const verdict = detail?.displayVerdict || getUnifiedDisplayVerdict(detail)
  const companySection = getCompanyContextSection(companyContext)
  const heroTitle = getReportHeroHeadline(verdict, priorityItems)
  const heroBridge = getReportHeroBridge(verdict, priorityItems)
  const firstPriorityItem = priorityItems[0] || null
  const firstPriorityQuestion = priorityQuestions[0] || null
  const actionGuideText = getActionGuideText(verdict, priorityItems, priorityQuestions)

  return (
    <>
      <SiteHeader variant="report" />
      <main className="report-page report-page-briefing">
        <header className="report-hero report-hero-briefing">
          <section className="report-hero-briefing-copy">
            <span className={`report-verdict-label tone-${verdict.tone}`}>
              {verdict.label}
            </span>
            <h1>{heroTitle}</h1>
            <p className="report-lead report-hero-bridge">{heroBridge}</p>
          </section>
        </header>

        <section className="report-section report-section-tight" aria-labelledby="summary-heading">
          <div className="report-section-heading report-section-heading-compact">
            <h2 id="summary-heading">한눈에 보는 요약</h2>
          </div>
          <div className="report-glance-grid">
            <article className="report-glance-card">
              <strong>최종 판단</strong>
              <h3>{verdict.label}</h3>
              <p>{verdict.description}</p>
            </article>
            <article className="report-glance-card">
              <strong>가장 먼저 확인할 점</strong>
              <h3>{firstPriorityItem?.label || '역할 범위와 평가 기준'}</h3>
              <p>{firstPriorityItem?.checklistReason || heroBridge}</p>
            </article>
            <article className="report-glance-card">
              <strong>먼저 물어볼 질문</strong>
              <h3>{firstPriorityQuestion?.question || '이 역할의 실제 범위와 평가 기준은 무엇인가요?'}</h3>
              <p>{firstPriorityQuestion?.whyAsk || firstPriorityItem?.checklistReason || '면접에서 실제 역할과 평가 기준을 먼저 확인하세요.'}</p>
            </article>
            <article className="report-glance-card report-glance-card-accent">
              <strong>행동 가이드</strong>
              <h3>답이 모호하면 보류</h3>
              <p>{actionGuideText}</p>
            </article>
          </div>
        </section>

        {false ? <section className="report-section report-section-tight" aria-labelledby="report-checklist-heading">
          <div className="report-section-heading">
            <h2 id="report-checklist-heading">지금 먼저 확인할 것</h2>
          </div>
          <div className="report-priority-stack">
            {priorityItems.map((item) => {
              const tone = getTone(item.level)
              return (
                <article className={`report-priority-row tone-${tone}`} key={item.key}>
                  <div className="report-priority-content">
                    <div className="report-priority-head">
                      <h3>{item.label}</h3>
                      <span className={`report-status-chip tone-${tone}`}>{getUnifiedStatusLabel(item.level)}</span>
                    </div>
                    <p>{item.checklistReason}</p>
                  </div>
                </article>
              )
            })}
          </div>
        </section> : null}

        <section className="report-section report-section-tight report-interview-section" aria-labelledby="questions-heading">
          <div className="report-section-heading">
            <h2 id="questions-heading">면접에서 먼저 물어볼 질문</h2>
          </div>

          <div className="report-question-stack">
            {priorityQuestions.map((item, index) => {
              const relatedAxis = priorityItems[index] || priorityItems[0] || axes[index]
              return (
                <article className="report-question-row" key={`${item.question}-${index}`}>
                  <span className="report-question-number">Q{index + 1}</span>
                  <div className="report-question-body">
                    <h3>{item.question}</h3>
                    <p className="report-question-why">{item.whyAsk || relatedAxis?.checklistReason || getChecklistReason(relatedAxis)}</p>
                    <div className="report-question-signals">
                      <p>
                        <strong>좋은 답변</strong>
                        {item.goodAnswerSignal}
                      </p>
                      <p>
                        <strong>주의할 답변</strong>
                        {item.riskyAnswerSignal}
                      </p>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>

          {additionalQuestions.length ? (
            <div className="report-extra-questions">
              <h3>추가로 확인할 질문</h3>
              <div className="report-question-stack report-question-stack-compact">
                {additionalQuestions.map((item, index) => (
                  <article className="report-question-row report-question-row-compact" key={`${item.question}-extra-${index}`}>
                    <span className="report-question-number">Q{priorityQuestions.length + index + 1}</span>
                    <div className="report-question-body">
                      <h3>{item.question}</h3>
                      <p className="report-question-why">{item.whyAsk || '이 질문은 실제 역할 범위와 평가 기준을 더 구체적으로 확인하기 위한 질문입니다.'}</p>
                      <div className="report-question-signals report-question-signals-compact">
                        <p>
                          <strong>좋은 답변</strong>
                          {item.goodAnswerSignal || '업무 범위, 책임 기준, 협업 구조를 구체적으로 설명합니다.'}
                        </p>
                        <p>
                          <strong>주의할 답변</strong>
                          {item.riskyAnswerSignal || '역할 기준이 모호하거나 상황에 따라 달라진다는 표현이 반복됩니다.'}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <section className="report-section report-section-tight" aria-labelledby="deep-dive-heading">
          <div className="report-section-heading">
            <h2 id="deep-dive-heading">왜 이렇게 판단하나요</h2>
          </div>

          <div className="report-axis-overview-list" aria-label="7가지 기준 요약">
            {deepDiveAxes.map((axis, index) => {
              const tone = getTone(axis.level)
              return (
                <details className={`report-axis-accordion tone-${tone}`} key={`${axis.key}-detail-${index}`}>
                  <summary className="report-axis-overview-row report-axis-overview-row-clickable">
                    <div className="report-axis-overview-copy">
                      <strong>{axis.label}</strong>
                      <p>{axis.summary}</p>
                    </div>
                    <div className="report-axis-overview-meta">
                      <span className={`report-status-chip tone-${tone}`}>{getUnifiedAxisStatus(axis.level)}</span>
                      <span className="report-axis-overview-chevron" aria-hidden="true">+</span>
                    </div>
                  </summary>
                  <div className="report-axis-accordion-panel">
                    <AxisInsightCardV2 axis={axis} />
                  </div>
                </details>
              )
            })}
          </div>

          {false ? <div className="report-axis-overview-list" aria-label="7가지 기준 요약">
            {deepDiveAxes.map((axis, index) => {
              const tone = getTone(axis.level)
              return (
                <article className={`report-axis-overview-row tone-${tone}`} key={`${axis.key}-overview-${index}`}>
                  <div className="report-axis-overview-copy">
                    <strong>{axis.label}</strong>
                    <p>{axis.summary}</p>
                  </div>
                  <span className={`report-status-chip tone-${tone}`}>{getUnifiedAxisStatus(axis.level)}</span>
                </article>
              )
            })}
          </div> : null}

          {false ? deepDiveAxes.length ? (
            <details className="report-criteria-details report-criteria-details-nested">
              <summary className="report-criteria-summary">
                <span>기준별 상세 설명 보기</span>
              </summary>
              <div className="report-axis-stack report-axis-stack-briefing report-axis-stack-cards">
                {deepDiveAxes.map((axis, index) => (
                  <AxisInsightCardV2 axis={axis} key={`${axis.key}-detail-${index}`} />
                ))}
              </div>
            </details>
          ) : null : null}
        </section>

        {auxiliaryChecks.length ? (
          <section className="report-section report-section-tight report-section-subdued" aria-labelledby="auxiliary-checks-heading">
            <div className="report-section-heading">
              <p className="report-core-label">보조 체크</p>
              <h2 id="auxiliary-checks-heading">계약·조직·프로세스 확인</h2>
            </div>

            <div className="report-axis-stack report-axis-stack-briefing report-axis-stack-cards">
              {auxiliaryChecks.map((check) => {
                const tone = getTone(check.level)
                return (
                  <article className={`report-axis-card tone-${tone}`} key={check.key}>
                    <div className="report-axis-card-head">
                      <div>
                        <p className="report-axis-definition">{check.label}</p>
                        <h3>{check.summary}</h3>
                      </div>
                      <span className={`report-status-chip tone-${tone}`}>{getUnifiedAuxiliaryStatus(check.level)}</span>
                    </div>

                    {check.evidence?.quote ? (
                      <blockquote className="report-evidence-quote">“{check.evidence.quote}”</blockquote>
                    ) : null}

                    <div className="report-question-signals">
                      <p>
                        <strong>면접 질문</strong>
                        {check.question}
                      </p>
                      <p>
                        <strong>좋은 답변</strong>
                        {check.goodAnswerSignal}
                      </p>
                      <p>
                        <strong>주의할 답변</strong>
                        {check.riskyAnswerSignal}
                      </p>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        ) : null}

        {companySection ? (
          <section className="report-section report-section-tight" aria-labelledby="company-context-heading">
            <div className="report-section-heading">
              <h2 id="company-context-heading">{companySection.title}</h2>
            </div>

            <section className="report-context-surface">
              <div className="report-context-summary-block">
                <p className="report-context-bridge">{companySection.bridge}</p>
              </div>

              <div className="report-context-body">
                <h3>직무 해석</h3>
                <p>{companySection.interpretation}</p>
              </div>

              {companySection.companyEvidence.length ? (
                <div className="report-context-body">
                  <h3>회사 근거</h3>
                  <ul className="report-context-links report-context-links-detailed">
                    {companySection.companyEvidence.map((item) => (
                      <li key={item.url}>
                        <a href={item.url} target="_blank" rel="noreferrer">
                          {item.title}
                        </a>
                        <p>{item.summary}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {companySection.postingEvidence.length ? (
                <div className="report-context-body">
                  <h3>공고 근거</h3>
                  <ul className="briefing-bullets report-context-section-list">
                    {companySection.postingEvidence.map((item) => (
                      <li key={item.quote}>
                        {item.quote}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {companySection.questions.length ? (
                <div className="report-context-body">
                  <h3>면접에서 확인할 질문</h3>
                  <ul className="report-question-stack report-question-stack-compact">
                    {companySection.questions.map((item) => (
                      <li key={item.question}>
                        <strong>{item.question}</strong>
                        <p>{item.whyAsk}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          </section>
        ) : null}

        <ReportFeedback analysisId={analysisId} />
      </main>
      <SiteFooter />
    </>
  )
}
