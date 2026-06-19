import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'

import { buildDetailReport, buildPreview } from '../server/src/lib/analysis.js'

const GOLDEN_SET_PATH = path.resolve('server/test/fixtures/golden-set/golden-set-v3.confirmed.json')
const EXTRA_GOLDEN_SET_DIR = path.resolve('server/test/fixtures/golden-set/extra')
const DEFAULT_OPENAI_TIMEOUT_MS = 120_000

function formatSeconds(ms) {
  return `${(ms / 1000).toFixed(1)}s`
}

function createTimeoutError(timeoutMs) {
  const error = new Error(`OpenAI request timed out after ${formatSeconds(timeoutMs)}`)
  error.name = 'OpenAITimeoutError'
  return error
}

function installFetchTimeout(timeoutMs) {
  const originalFetch = globalThis.fetch
  const timeoutState = { hitCount: 0 }

  if (typeof originalFetch !== 'function') {
    return {
      restore() {},
      timeoutState,
    }
  }

  globalThis.fetch = async (input, init = {}) => {
    const controller = new AbortController()
    const timer = setTimeout(() => {
      timeoutState.hitCount += 1
      controller.abort(createTimeoutError(timeoutMs))
    }, timeoutMs)

    const upstreamSignal = init?.signal
    const abortFromUpstream = () => controller.abort(upstreamSignal?.reason)
    if (upstreamSignal) {
      if (upstreamSignal.aborted) abortFromUpstream()
      else upstreamSignal.addEventListener('abort', abortFromUpstream, { once: true })
    }

    try {
      return await originalFetch(input, {
        ...init,
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timer)
      if (upstreamSignal) upstreamSignal.removeEventListener('abort', abortFromUpstream)
    }
  }

  return {
    restore() {
      globalThis.fetch = originalFetch
    },
    timeoutState,
  }
}

function parseArgs(argv) {
  const args = { live: false, limit: null, ids: [], timeoutMs: DEFAULT_OPENAI_TIMEOUT_MS }
  for (const item of argv) {
    if (item === '--live') args.live = true
    else if (item.startsWith('--limit=')) {
      const limit = Number(item.split('=')[1])
      if (!Number.isInteger(limit) || limit <= 0) throw new Error(`Invalid --limit value: ${item}`)
      args.limit = limit
    } else if (item.startsWith('--timeout-ms=')) {
      const timeoutMs = Number(item.split('=')[1])
      if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) throw new Error(`Invalid --timeout-ms value: ${item}`)
      args.timeoutMs = timeoutMs
    } else if (item.startsWith('--ids=')) {
      const ids = item
        .slice('--ids='.length)
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
      if (!ids.length) throw new Error(`Invalid --ids value: ${item}`)
      args.ids = ids
    }
  }
  return args
}

function timestampForPath(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0')
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-') + '-' + [pad(date.getHours()), pad(date.getMinutes())].join('')
}

function listExtraGoldenSetPaths() {
  if (!fs.existsSync(EXTRA_GOLDEN_SET_DIR)) return []
  return fs
    .readdirSync(EXTRA_GOLDEN_SET_DIR)
    .filter((name) => name.endsWith('.json'))
    .map((name) => path.join(EXTRA_GOLDEN_SET_DIR, name))
    .sort()
}

function normalizeToArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean)
  if (value == null) return []
  if (typeof value === 'string') return value.split(/\s*[|,;/]\s*/).map((item) => item.trim()).filter(Boolean)
  return [value].filter(Boolean)
}

function normalizeWhitespace(value = '') {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeCompareText(value = '') {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[“”"'`]/g, '')
    .replace(/[()[\]{}.,!?/:;~\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function expandIntentTerms(rawTerm) {
  const term = normalizeWhitespace(rawTerm)
  const map = {
    '개인 이메일': ['개인 이메일', 'naver.com', 'daum.net', 'gmail.com', '공식 회사 이메일'],
    '계약 주체': ['계약 주체', '법인명', '사업자등록번호', '실제 소속'],
    '공식 이메일 확인': ['공식 이메일', '회사 이메일', '공식 채용 페이지'],
    '파견직': ['파견직', '파견'],
    '프리랜스': ['프리랜스', '용역', '도급'],
    '고객사 상주': ['고객사 상주', '상주'],
    '현재 기준선': ['현재 기준선', '기준선', '지표', 'kpi'],
    '평가 방식': ['평가 방식', '목표 미달성', '재계획', '평가'],
    'PM 피드백 구조': ['피어 리뷰', '시니어 피드백', 'head of product', '1:1', '피드백 구조'],
    '제품 전략 참여 범위': ['제품 전략', '로드맵', '전략 참여', '의사결정 범위', '최종 승인권자'],
    'PRD': ['prd'],
    'A/B 테스트': ['a/b 테스트', 'ab 테스트', '실험 설계'],
    '성과 대시보드': ['성과 대시보드', '대시보드'],
    '문제 정의': ['문제 정의'],
    '실험 설계 권한': ['실험 설계 권한', '실험 설계'],
    '경력서 제출처 검증': ['경력서 제출', '공식 이메일', '회사 이메일', '법인명'],
    '물경력 낮음': ['낮은 물경력 위험', '좋은 공고', '경력 자산'],
    '산출물': ['산출물', '결과물', 'prd', '리포트', '대시보드'],
    '성과지표': ['성과지표', '활성화율', '리텐션', '전환율', '기준선', '지표', 'kpi'],
    '성장 구조': ['피드백 구조', '1:1', '회고', '제품 리뷰', '더 어려운 일을 맡', '역할 확장'],
  }
  return map[term] || [term]
}

function expandAdditionalIntentTerms(rawTerm) {
  const term = normalizeWhitespace(rawTerm)
  const map = {
    '스쿼드 협업': ['스쿼드 협업', '스쿼드로 협업', '스쿼드', '협업합니다'],
    'KPI 기준선': ['KPI 기준선', '현재 기준선', '기준선'],
    '목표 미달성 시 평가 방식': ['목표 미달성 시 평가 방식', '평가 방식', '재계획', '목표를 달성하지 못했을 때'],
    'PM 피드백 구조': ['PM 피드백 구조', 'PM 피어 리뷰', '시니어 피드백', 'Head of Product', '1:1'],
    '제품 전략 참여 범위': ['제품 전략 참여 범위', '제품 전략', '로드맵 수립', '전략 참여'],
    '최종 승인권': ['최종 승인권', '승인권자', '의사결정 범위'],
  }
  return map[term] || []
}

function findMissingTerms(text, expectedTerms = []) {
  const haystack = normalizeCompareText(text)
  return expectedTerms.filter((term) => {
    const variants = [...expandIntentTerms(term), ...expandAdditionalIntentTerms(term)].map(normalizeCompareText)
    return !variants.some((variant) => variant && haystack.includes(variant))
  })
}

function findForbiddenTerms(text, forbiddenTerms = []) {
  const haystack = normalizeCompareText(text)
  return forbiddenTerms.filter((term) => {
    const variants = [...expandIntentTerms(term), ...expandAdditionalIntentTerms(term)].map(normalizeCompareText)
    return variants.some((variant) => variant && haystack.includes(variant))
  })
}

function normalizeExpectedRisk(value = '') {
  return String(value || '').trim().toUpperCase()
}

function normalizeActualRisk(preview = {}) {
  const risk = String(preview.riskLevel || '').toLowerCase()
  if (risk === 'high') return 'HIGH'
  if (risk === 'medium') return 'MEDIUM'
  if (risk === 'low') return 'LOW'
  if (risk === 'needs_review') return 'NEEDS_VERIFICATION'

  const label = String(preview.riskLevelLabel || '')
  if (label.includes('주의')) return 'HIGH'
  if (label.includes('좋음')) return 'LOW'
  if (label.includes('보통')) return 'MEDIUM'
  return 'UNKNOWN'
}

function normalizeVerdictGroup(value = '') {
  const raw = String(value || '').trim()
  const normalized = normalizeCompareText(value)
  if (!normalized) return 'unknown'
  if (raw.includes('좋음')) return raw.includes('조건부') || raw.includes('추가 확인') ? 'conditional_positive' : 'positive'
  if (raw.includes('추가 확인 필요')) return 'caution'
  if (raw.includes('지원 전 보류')) return 'danger'
  if (raw.includes('위험')) return 'danger'
  if (
    normalized.includes('낮은 물경력 위험') ||
    normalized.includes('경력 자산') ||
    normalized.includes('좋은 공고') ||
    normalized.includes('성장형') ||
    normalized.includes('조건부 좋음')
  ) {
    return normalized.includes('조건부') || normalized.includes('세부 확인') ? 'conditional_positive' : 'positive'
  }
  if (normalized.includes('정보 부족') || normalized.includes('추가 정보 확인')) return 'insufficient'
  if (normalized.includes('주의')) return 'caution'
  if (
    normalized.includes('검증 전') ||
    normalized.includes('보류') ||
    normalized.includes('신원') ||
    normalized.includes('계약 검증') ||
    normalized.includes('위험')
  ) {
    return 'danger'
  }
  if (normalized.includes('확인 필요') || normalized.includes('보통')) return 'caution'
  return 'unknown'
}

function normalizeExpectedVerdictGroup(value = '') {
  const normalized = normalizeCompareText(value)
  if (!normalized) return ''
  if (normalized.includes('긍정') || normalized.includes('좋') || normalized.includes('낮은') || normalized.includes('경력 자산')) return 'positive'
  if (normalized.includes('조건부') || normalized.includes('세부 확인')) return 'conditional_positive'
  if (normalized.includes('정보부족')) return 'insufficient'
  if (normalized.includes('주의')) return 'caution'
  if (normalized.includes('위험') || normalized.includes('보류') || normalized.includes('검증')) return 'danger'
  return normalized
}

function deriveExpectedVerdictGroup(sample = {}) {
  const expectedRisk = normalizeExpectedRisk(sample.expected_risk || '')
  if (expectedRisk === 'HIGH') return 'danger'
  if (expectedRisk === 'LOW') return 'positive'
  if (expectedRisk === 'MEDIUM' || expectedRisk === 'NEEDS_VERIFICATION') return 'caution'
  return normalizeExpectedVerdictGroup(sample.expected_verdict || '')
}

function normalizeExpectedRiskBand(value = '') {
  const normalized = normalizeCompareText(value)
  if (!normalized) return ''
  if (normalized.includes('낮음') && normalized.includes('보통')) return ['LOW', 'MEDIUM', 'NEEDS_VERIFICATION']
  if (normalized.includes('주의') && normalized.includes('정보부족')) return ['MEDIUM', 'HIGH', 'NEEDS_VERIFICATION']
  if (normalized.includes('낮음')) return ['LOW']
  if (normalized.includes('보통')) return ['MEDIUM', 'NEEDS_VERIFICATION']
  if (normalized.includes('정보부족')) return ['NEEDS_VERIFICATION']
  if (normalized.includes('주의')) return ['HIGH', 'MEDIUM']
  if (normalized.includes('위험')) return ['HIGH']
  return [String(value || '').trim().toUpperCase()]
}

function normalizeJobFamilyGroup(value = '') {
  const normalized = normalizeCompareText(value)
  if (!normalized) return ''
  if (
    normalized.includes('product_manager') ||
    normalized.includes('product_owner') ||
    normalized.includes('product_growth') ||
    normalized.includes('b2b_saas_pm') ||
    normalized === 'product' ||
    normalized.includes('프로덕트') ||
    normalized === 'pm'
  ) {
    return 'product'
  }
  if (
    normalized.includes('hr_recruiting') ||
    normalized.includes('education_operations') ||
    normalized.includes('organization_operations') ||
    normalized === 'hr' ||
    normalized.includes('채용') ||
    normalized.includes('인사') ||
    normalized.includes('교육운영') ||
    normalized.includes('조직운영')
  ) {
    return 'hr'
  }
  return normalized
}

function includesPostingQuote(postingText, quote) {
  const normalizedQuote = String(quote || '').trim()
  if (!normalizedQuote) return true
  return String(postingText || '').includes(normalizedQuote)
}

function collectQuotes(result = {}) {
  const preview = result.preview?.freePreview || {}
  const detail = result.detail?.detail || {}
  const structured = result.preview?.structured || {}
  const quotes = []
  if (preview.topEvidence?.quote) quotes.push({ surface: 'preview.topEvidence', quote: preview.topEvidence.quote })
  for (const item of detail.keyEvidence || []) {
    if (item?.quote) quotes.push({ surface: 'detail.keyEvidence', quote: item.quote })
  }
  for (const axis of [...(structured.sevenAxes || []), ...(detail.sevenAxes || [])]) {
    if (axis?.evidence?.quote) quotes.push({ surface: `axis.${axis.key}`, quote: axis.evidence.quote })
  }
  return quotes
}

function hasUnsupportedClaim(result = {}) {
  const text = JSON.stringify({
    freePreview: result.preview?.freePreview,
    detail: result.detail?.detail,
  })
  const blockedPatterns = [
    /이 회사는 나쁜 회사/,
    /지원하면 안/,
    /무조건 물경력/,
    /성장 가능성이 없습니다/,
    /야근이 많/,
    /조직문화.*나쁘/,
    /평판.*나쁘/,
    /소문/,
  ]
  return blockedPatterns.some((pattern) => pattern.test(text))
}

function evaluateFreePreview(preview = {}) {
  const shortReasons = preview.shortReasons || []
  const headline = String(preview.headline || '')
  const evidenceInterpretation = String(preview.topEvidence?.interpretation || '')
  return {
    reasonCount: shortReasons.length,
    headlineLength: headline.length,
    overExposed: shortReasons.length > 3 || headline.length > 180 || evidenceInterpretation.length > 240,
  }
}

function summarizeActualEvidence(result = {}) {
  const previewQuote = result.preview?.freePreview?.topEvidence?.quote || ''
  const detailQuotes = (result.detail?.detail?.keyEvidence || []).map((item) => item.quote).filter(Boolean)
  return [previewQuote, ...detailQuotes].filter(Boolean).slice(0, 5)
}

function summarizeActualQuestions(result = {}) {
  return (result.detail?.detail?.interviewQuestions || [])
    .map((item) => item.question)
    .filter(Boolean)
    .slice(0, 7)
}

function summarizeActualJobFamily(result = {}) {
  const previewFamily = result.preview?.structured?.jobFamily || {}
  const detailFamily = result.detail?.detail?.jobFamily || {}
  return {
    preview: {
      id: String(previewFamily.id || ''),
      label: String(previewFamily.label || ''),
    },
    detail: {
      id: String(detailFamily.id || ''),
      label: String(detailFamily.label || ''),
    },
  }
}

function summarizeActualReportType(result = {}) {
  const detailFamilyLabel = result.detail?.detail?.jobFamily?.label || result.preview?.structured?.jobFamily?.label || ''
  return detailFamilyLabel ? `${detailFamilyLabel} 리포트` : ''
}

function inferDetailVerdict(detail = {}) {
  const auxiliaryChecks = detail?.auxiliaryChecks || []
  const axes = detail?.sevenAxes || detail?.fiveAxes || []
  const applicationSafety = auxiliaryChecks.find((item) => item.key === 'applicationSafety')
  const contractConsistency = auxiliaryChecks.find((item) => item.key === 'contractConsistency')
  const employmentForm = auxiliaryChecks.find((item) => item.key === 'employmentForm')
  const riskCount = axes.filter((axis) => axis.level === 'risk').length
  const mixedCount = axes.filter((axis) => ['mixed_signal', 'positive_with_check'].includes(axis.level)).length
  const strongPositiveCount = axes.filter((axis) => axis.level === 'strong_positive').length

  if (applicationSafety?.level === 'high') return 'danger'
  if (contractConsistency?.level === 'high' || employmentForm?.level === 'high') return 'danger'
  if (riskCount >= 2) return 'danger'
  if (riskCount >= 1 || mixedCount >= 1 || applicationSafety?.level === 'medium') return 'caution'
  if (strongPositiveCount >= 3) return 'positive'
  if (strongPositiveCount >= 2) return 'conditional_positive'
  return 'insufficient'
}

function deriveDetailVerdictGroup(detail = {}) {
  const displayVerdict = detail?.displayVerdict || {}
  const displayText = displayVerdict.label || displayVerdict.headline || ''
  if (String(displayText).trim()) return normalizeVerdictGroup(displayText)
  return inferDetailVerdict(detail)
}

function collectSearchableText(result = {}) {
  const preview = result.preview?.freePreview || {}
  const detail = result.detail?.detail || {}
  const textParts = [
    preview.riskLevelLabel,
    preview.headline,
    preview.topEvidence?.quote,
    preview.topEvidence?.interpretation,
    ...(preview.shortReasons || []),
    preview.verificationQuestion,
    detail.finalSummary,
    detail.actionGuide,
    ...((detail.keyEvidence || []).flatMap((item) => [item.quote, item.interpretation, item.whyImportant])),
    ...((detail.interviewQuestions || []).flatMap((item) => [item.question, item.whyAsk, item.goodAnswerSignal, item.riskyAnswerSignal])),
    ...((detail.auxiliaryChecks || []).flatMap((item) => [item.label, item.summary, item.question, item.evidence?.quote])),
    ...((detail.sevenAxes || []).flatMap((item) => [item.label, item.summary, item.evidence?.quote])),
  ]
  return textParts.filter(Boolean).join('\n')
}

function derivePriorityItems(detail = {}) {
  const auxiliaryChecks = detail?.auxiliaryChecks || []
  const axes = detail?.sevenAxes || detail?.fiveAxes || []
  const interviewQuestions = detail?.interviewQuestions || []
  const isProductFamily = detail?.jobFamily?.id === 'product'
  const safetyOrder = ['applicationSafety', 'contractConsistency', 'employmentForm', 'workLocationClarity', 'roleClarity']
  const safetyItems = safetyOrder
    .map((key) => auxiliaryChecks.find((item) => item.key === key))
    .filter(Boolean)
    .map((item) => `${item.label || ''} ${item.summary || ''} ${item.question || ''}`.trim())

  const axisPriority = ['risk', 'mixed_signal', 'positive_with_check', 'strong_positive', 'insufficient_info']
  const axisItems = axisPriority
    .flatMap((level) => axes.filter((axis) => axis.level === level))
    .slice(0, 3)
    .map((axis) => `${axis.label || ''} ${axis.summary || ''}`.trim())

  const questionItems = interviewQuestions.slice(0, isProductFamily ? 5 : 3).map((item) => item.question).filter(Boolean)

  const orderedItems = safetyItems.length > 0 ? [...safetyItems, ...questionItems, ...axisItems] : [...questionItems, ...axisItems]
  return orderedItems.filter(Boolean).slice(0, 5)
}

function summarizeRiskTrace(result = {}) {
  const trace = result.preview?.debugRiskTrace || {}
  return {
    fallbackRiskLevel: String(trace.fallbackRiskLevel || result.preview?.fallbackFreePreview?.riskLevel || ''),
    llmInputRiskLevel: String(trace.llmInputRiskLevel || result.preview?.fallbackFreePreview?.riskLevel || ''),
    llmReturnedRiskLevel: trace.llmReturnedRiskLevel == null ? null : String(trace.llmReturnedRiskLevel),
    finalRiskLevel: String(trace.finalRiskLevel || result.preview?.freePreview?.riskLevel || ''),
    riskLevelChanged: Boolean(trace.riskLevelChanged),
    changedAt: String(trace.changedAt || 'unknown'),
    finalLockedToFallback: Boolean(trace.finalLockedToFallback),
  }
}

function loadGoldenSources() {
  const paths = [GOLDEN_SET_PATH, ...listExtraGoldenSetPaths()].filter((filePath) => fs.existsSync(filePath))
  const sources = paths.map((filePath) => {
    const json = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    return {
      path: filePath,
      schemaVersion: json.schemaVersion || 'unknown',
      summary: json.summary || null,
      samples: Array.isArray(json.samples) ? json.samples : [],
    }
  })

  const samples = sources.flatMap((source) =>
    source.samples.map((sample) => ({
      ...sample,
      __sourcePath: source.path,
      __sourceSchema: source.schemaVersion,
    })),
  )

  return {
    sources,
    samples,
    summary: {
      totalFiles: sources.length,
      totalSamples: samples.length,
      exportedRows: samples.length,
      confirmedRows: sources.reduce((sum, source) => sum + Number(source.summary?.confirmedRows || 0), 0),
      totalRows: sources.reduce((sum, source) => sum + Number(source.summary?.totalRows || source.samples.length || 0), 0),
      missingPostingTextCount: samples.filter((sample) => !String(sample.posting_text || sample.job_posting_text || '').trim()).length,
    },
  }
}

function evaluateSample({ sample, result, skippedReason }) {
  const postingText = sample.posting_text || sample.job_posting_text || ''
  const expectedRisk = normalizeExpectedRisk(sample.expected_risk || '')
  const actualRisk = result ? normalizeActualRisk(result.preview?.freePreview) : 'NOT_RUN'
  const quoteProblems = result
    ? collectQuotes(result).filter((item) => !includesPostingQuote(postingText, item.quote))
    : []
  const unsupportedClaim = result ? hasUnsupportedClaim(result) : false
  const outsidePostingClaim = quoteProblems.length > 0 || unsupportedClaim
  const freePreview = result ? evaluateFreePreview(result.preview?.freePreview) : { overExposed: false, reasonCount: 0, headlineLength: 0 }
  const actualEvidence = result ? summarizeActualEvidence(result) : []
  const actualQuestions = result ? summarizeActualQuestions(result) : []
  const actualJobFamily = result ? summarizeActualJobFamily(result) : { preview: { id: '', label: '' }, detail: { id: '', label: '' } }
  const actualReportType = result ? summarizeActualReportType(result) : ''
  const searchableText = result ? collectSearchableText(result) : ''
  const priorityItems = result ? derivePriorityItems(result.detail?.detail) : []
  const previewVerdictGroup = result ? normalizeVerdictGroup(result.preview?.freePreview?.riskLevelLabel || result.preview?.freePreview?.headline) : 'unknown'
  const detailVerdictGroup = result ? deriveDetailVerdictGroup(result.detail?.detail) : 'unknown'
  const riskTrace = result ? summarizeRiskTrace(result) : {
    fallbackRiskLevel: '',
    llmInputRiskLevel: '',
    llmReturnedRiskLevel: null,
    finalRiskLevel: '',
    riskLevelChanged: false,
    changedAt: 'not_run',
    finalLockedToFallback: false,
  }
  const expectedVerdictGroup = deriveExpectedVerdictGroup(sample)
  const expectedRiskBand = normalizeExpectedRiskBand(sample.expected_risk_level || sample.expected_risk || '')
  const mustInclude = normalizeToArray(sample.must_include)
  const mustNotInclude = normalizeToArray(sample.must_not_include)
  const expectedQuestions = normalizeToArray(sample.expected_questions)
  const expectedTopPriority = normalizeToArray(sample.expected_top_priority)
  const expectedJobFamily = normalizeJobFamilyGroup(sample.expected_job_family || '')
  const forbiddenJobFamilies = normalizeToArray(sample.must_not_job_family).map((value) => normalizeJobFamilyGroup(value)).filter(Boolean)
  const requiredReportType = normalizeToArray(sample.required_report_type)
  const forbiddenReportType = normalizeToArray(sample.forbidden_report_type)
  const actualJobFamilyGroups = [actualJobFamily.preview.id, actualJobFamily.detail.id, actualJobFamily.preview.label, actualJobFamily.detail.label]
    .map((value) => normalizeJobFamilyGroup(value))
    .filter(Boolean)
  const verdictMatches = !expectedVerdictGroup || [previewVerdictGroup, detailVerdictGroup].includes(expectedVerdictGroup) || (expectedVerdictGroup === 'positive' && detailVerdictGroup === 'conditional_positive')
  const riskMatches = !expectedRiskBand.length || expectedRiskBand.includes(actualRisk)
  const missingMustInclude = findMissingTerms(searchableText, mustInclude)
  const foundMustNotInclude = findForbiddenTerms(searchableText, mustNotInclude)
  const missingExpectedQuestions = findMissingTerms(actualQuestions.join('\n'), expectedQuestions)
  const missingTopPriority = findMissingTerms(priorityItems.join('\n'), expectedTopPriority)
  const jobFamilyMatches = !expectedJobFamily || actualJobFamilyGroups.includes(expectedJobFamily)
  const foundForbiddenJobFamily = forbiddenJobFamilies.filter((value) => actualJobFamilyGroups.includes(value))
  const hasRequiredReportType = requiredReportType.length === 0 || requiredReportType.some((term) => findMissingTerms(actualReportType, [term]).length === 0)
  const missingRequiredReportType = hasRequiredReportType ? [] : requiredReportType
  const foundForbiddenReportType = findForbiddenTerms(actualReportType, forbiddenReportType)
  const missingPostingText = !String(postingText).trim()
  const evidenceInsufficient = Boolean(sample.expected_evidence) && actualEvidence.length === 0
  const questionInsufficient = Boolean(sample.expected_questions) && actualQuestions.length === 0

  const checks = {
    verdict: {
      applicable: Boolean(expectedVerdictGroup),
      pass: verdictMatches,
      expected: expectedVerdictGroup,
      actual: { preview: previewVerdictGroup, detail: detailVerdictGroup },
    },
    risk_level: {
      applicable: Boolean(expectedRiskBand.length),
      pass: riskMatches,
      expected: expectedRiskBand,
      actual: actualRisk,
    },
    must_include: {
      applicable: mustInclude.length > 0,
      pass: missingMustInclude.length === 0,
      missing: missingMustInclude,
    },
    must_not_include: {
      applicable: mustNotInclude.length > 0,
      pass: foundMustNotInclude.length === 0,
      found: foundMustNotInclude,
    },
    expected_questions: {
      applicable: expectedQuestions.length > 0,
      pass: missingExpectedQuestions.length === 0,
      missing: missingExpectedQuestions,
    },
    top_priority: {
      applicable: expectedTopPriority.length > 0,
      pass: missingTopPriority.length === 0,
      missing: missingTopPriority,
      actual: priorityItems,
    },
    job_family: {
      applicable: Boolean(expectedJobFamily) || forbiddenJobFamilies.length > 0,
      pass: jobFamilyMatches && foundForbiddenJobFamily.length === 0,
      expected: expectedJobFamily,
      actual: actualJobFamily,
      forbidden: foundForbiddenJobFamily,
    },
    report_type: {
      applicable: requiredReportType.length > 0 || forbiddenReportType.length > 0,
      pass: missingRequiredReportType.length === 0 && foundForbiddenReportType.length === 0,
      expected: requiredReportType,
      actual: actualReportType,
      missing: missingRequiredReportType,
      forbidden: foundForbiddenReportType,
    },
  }

  const hasFailedCheck = Object.values(checks).some((check) => check.applicable && !check.pass)
  const status = missingPostingText || outsidePostingClaim || freePreview.overExposed || skippedReason || hasFailedCheck ? 'fail' : 'pass'

  return {
    id: sample.sample_id || sample.id,
    title: sample.title || sample.sample_id || sample.id,
    company: sample.company,
    status,
    expectedRisk,
    actualRisk,
    riskMatches,
    previewVerdictGroup,
    detailVerdictGroup,
    verdictMatches,
    missingPostingText,
    outsidePostingClaim,
    quoteProblems,
    unsupportedClaim,
    freePreview,
    evidenceInsufficient,
    questionInsufficient,
    skippedReason,
    expectedRiskType: sample.expected_risk_type,
    testPurpose: sample.test_purpose,
    expectedEvidence: sample.expected_evidence,
    actualEvidence,
    expectedQuestions: sample.expected_questions,
    actualQuestions,
    expectedTopPriority: sample.expected_top_priority,
    actualTopPriority: priorityItems,
    expectedJobFamily: sample.expected_job_family,
    actualJobFamily,
    requiredReportType: sample.required_report_type,
    actualReportType,
    expectedAxisSignals: sample.expected_axis_signals,
    ownerNotes: sample.owner_notes,
    riskTrace,
    checks,
    sourceSheet: sample.source_sheet,
    sourceCell: sample.source_cell || sample.source_row || '',
    category: sample.category || '',
    sourcePath: sample.__sourcePath,
  }
}

async function runSample(sample) {
  if (!String(sample.posting_text || '').trim()) {
    return { result: null, skippedReason: 'posting_text가 비어 있어 분석을 실행하지 않았습니다.' }
  }

  const preview = await buildPreview({ jobPostingText: sample.posting_text || sample.job_posting_text || '' })
  const detail = await buildDetailReport({
    analysis: {
      structured: preview.structured,
      freePreview: preview.freePreview,
    },
  })
  return { result: { preview, detail }, skippedReason: '' }
}

async function runSampleWithTimeout(sample, options = {}) {
  const timeoutState = options.timeoutState || { hitCount: 0 }
  const timeoutHitsBefore = timeoutState.hitCount

  try {
    const output = await runSample(sample)
    const timeoutHitsDuringRun = timeoutState.hitCount - timeoutHitsBefore
    if (timeoutHitsDuringRun > 0) {
      return {
        ...output,
        skippedReason: `OpenAI timeout after ${formatSeconds(options.timeoutMs || DEFAULT_OPENAI_TIMEOUT_MS)}; deterministic fallback was used.`,
      }
    }
    return output
  } catch (error) {
    const message = error?.message || String(error)
    return { result: null, skippedReason: `sample execution failed: ${message}` }
  }
}

function countWhere(results, predicate) {
  return results.filter(predicate).length
}

function renderList(values = []) {
  if (!values.length) return '  - 없음'
  return values.map((value) => `  - ${String(value).replace(/\n/g, ' ')}`).join('\n')
}

function renderReport({ results, mode, sourceSummary }) {
  const total = results.length
  const pass = countWhere(results, (item) => item.status === 'pass')
  const partial = countWhere(results, (item) => item.status === 'partial')
  const fail = countWhere(results, (item) => item.status === 'fail')
  const riskMismatch = countWhere(results, (item) => !item.riskMatches)
  const evidenceInsufficient = countWhere(results, (item) => item.evidenceInsufficient)
  const questionInsufficient = countWhere(results, (item) => item.questionInsufficient)
  const outsidePostingClaim = countWhere(results, (item) => item.outsidePostingClaim)
  const freeOverExposed = countWhere(results, (item) => item.freePreview.overExposed)

  const lines = [
    '# 골든셋 검증 결과',
    '',
    `- 실행 모드: ${mode}`,
    `- 전체 샘플 수: ${total}`,
    `- 통과: ${pass}`,
    `- 부분 통과: ${partial}`,
    `- 실패: ${fail}`,
    `- 위험도 불일치: ${riskMismatch}`,
    `- 근거 부족: ${evidenceInsufficient}`,
    `- 질문 품질 부족: ${questionInsufficient}`,
    `- 공고 밖 단정 발생: ${outsidePostingClaim}`,
    `- 무료 결과 과다 노출: ${freeOverExposed}`,
    '',
    '## 소스 요약',
    '',
    `- 원본 전체 행 수: ${sourceSummary?.totalRows ?? 'unknown'}`,
    `- CONFIRMED 행 수: ${sourceSummary?.confirmedRows ?? 'unknown'}`,
    `- JSON 샘플 수: ${sourceSummary?.exportedRows ?? 'unknown'}`,
    `- posting_text 누락 수: ${sourceSummary?.missingPostingTextCount ?? 'unknown'}`,
    '',
    '## 샘플별 결과',
  ]

  for (const item of results) {
    lines.push(
      '',
      `### ${item.id} - ${item.title}`,
      '',
      `- 상태: ${item.status}`,
      `- 회사: ${item.company || ''}`,
      `- 기대 위험도: ${item.expectedRisk}`,
      `- 실제 위험도: ${item.actualRisk}`,
      `- 위험도 일치 여부: ${item.riskMatches ? '일치' : '불일치'}`,
      `- 근거 포착 여부: ${item.evidenceInsufficient ? '실제 근거 없음' : '검토 필요'}`,
      `- 질문 품질: ${item.questionInsufficient ? '실제 질문 없음' : '검토 필요'}`,
      `- 공고 밖 단정 여부: ${item.outsidePostingClaim ? '발생' : '없음'}`,
      `- 무료 결과 과다 노출: ${item.freePreview.overExposed ? '예' : '아니오'} (shortReasons ${item.freePreview.reasonCount}개, headline ${item.freePreview.headlineLength}자)`,
      `- 코멘트: ${item.skippedReason || item.testPurpose || ''}`,
      '',
      '기대 근거:',
      renderList(item.expectedEvidence ? [item.expectedEvidence] : []),
      '',
      '실제 근거 후보:',
      renderList(item.actualEvidence),
      '',
      '기대 질문 방향:',
      renderList(item.expectedQuestions ? [item.expectedQuestions] : []),
      '',
      '실제 질문 후보:',
      renderList(item.actualQuestions),
      '',
      '기대 7축 신호:',
      renderList(item.expectedAxisSignals ? [item.expectedAxisSignals] : []),
    )
    if (item.quoteProblems.length) {
      lines.push('', '공고 밖 quote 의심:', renderList(item.quoteProblems.map((problem) => `${problem.surface}: ${problem.quote}`)))
    }
  }

  return `${lines.join('\n')}\n`
}

function renderStrictGoldenReport({ results, mode, sourceSummary }) {
  const total = results.length
  const pass = countWhere(results, (item) => item.status === 'pass')
  const fail = countWhere(results, (item) => item.status === 'fail')
  const lines = [
    'Golden Set Result',
    '',
    `- mode: ${mode}`,
    `- total: ${total}`,
    `- passed: ${pass}`,
    `- failed: ${fail}`,
    `- source files: ${sourceSummary?.totalFiles ?? 'unknown'}`,
    `- source rows: ${sourceSummary?.totalRows ?? 'unknown'}`,
    `- source confirmed rows: ${sourceSummary?.confirmedRows ?? 'unknown'}`,
    `- source missing posting_text: ${sourceSummary?.missingPostingTextCount ?? 'unknown'}`,
  ]

  for (const item of results) {
    const verdictCheck = item.checks.verdict
    const riskCheck = item.checks.risk_level
    const includeCheck = item.checks.must_include
    const excludeCheck = item.checks.must_not_include
      const questionCheck = item.checks.expected_questions
      const priorityCheck = item.checks.top_priority
      const jobFamilyCheck = item.checks.job_family
      const reportTypeCheck = item.checks.report_type

      lines.push(
        '',
        `${item.status === 'pass' ? 'PASS' : 'FAIL'} ${item.id} ${item.title}`,
        `- verdict: ${verdictCheck.applicable ? (verdictCheck.pass ? 'pass' : 'fail') : 'skip'}`,
        `- risk_level: ${riskCheck.applicable ? (riskCheck.pass ? 'pass' : 'fail') : 'skip'}`,
        `- must_include: ${includeCheck.applicable ? (includeCheck.pass ? 'pass' : 'fail') : 'skip'}`,
        `- must_not_include: ${excludeCheck.applicable ? (excludeCheck.pass ? 'pass' : 'fail') : 'skip'}`,
        `- expected_questions: ${questionCheck.applicable ? (questionCheck.pass ? 'pass' : 'fail') : 'skip'}`,
        `- top_priority: ${priorityCheck.applicable ? (priorityCheck.pass ? 'pass' : 'fail') : 'skip'}`,
        `- job_family: ${jobFamilyCheck.applicable ? (jobFamilyCheck.pass ? 'pass' : 'fail') : 'skip'}`,
        `- report_type: ${reportTypeCheck.applicable ? (reportTypeCheck.pass ? 'pass' : 'fail') : 'skip'}`,
      )

    if (includeCheck.applicable && !includeCheck.pass) {
      lines.push('- must_include failed:', ...includeCheck.missing.map((value) => `  - missing keyword: "${value}"`))
    }
    if (excludeCheck.applicable && !excludeCheck.pass) {
      lines.push('- must_not_include failed:', ...excludeCheck.found.map((value) => `  - found forbidden phrase: "${value}"`))
    }
    if (questionCheck.applicable && !questionCheck.pass) {
      lines.push('- expected_questions failed:', ...questionCheck.missing.map((value) => `  - missing intent: "${value}"`))
    }
      if (priorityCheck.applicable && !priorityCheck.pass) {
        lines.push('- top_priority failed:', ...priorityCheck.missing.map((value) => `  - missing priority: "${value}"`))
      }
      if (jobFamilyCheck.applicable && !jobFamilyCheck.pass) {
        if (jobFamilyCheck.expected && !normalizeJobFamilyGroup(jobFamilyCheck.actual.detail.id || jobFamilyCheck.actual.preview.id).includes(jobFamilyCheck.expected)) {
          lines.push(`- job_family detail: expected ${jobFamilyCheck.expected}, actual preview=${jobFamilyCheck.actual.preview.id || jobFamilyCheck.actual.preview.label}, detail=${jobFamilyCheck.actual.detail.id || jobFamilyCheck.actual.detail.label}`)
        }
        if (jobFamilyCheck.forbidden.length > 0) {
          lines.push('- job_family failed:', ...jobFamilyCheck.forbidden.map((value) => `  - found forbidden family: "${value}"`))
        }
      }
      if (reportTypeCheck.applicable && !reportTypeCheck.pass) {
        if (reportTypeCheck.missing.length > 0) {
          lines.push('- report_type failed:', ...reportTypeCheck.missing.map((value) => `  - missing report keyword: "${value}"`))
        }
        if (reportTypeCheck.forbidden.length > 0) {
          lines.push('- report_type failed:', ...reportTypeCheck.forbidden.map((value) => `  - found forbidden report keyword: "${value}"`))
        }
      }
      if (verdictCheck.applicable && !verdictCheck.pass) {
        lines.push(`- verdict detail: expected ${verdictCheck.expected}, actual preview=${verdictCheck.actual.preview}, detail=${verdictCheck.actual.detail}`)
      }
    if (riskCheck.applicable && !riskCheck.pass) {
      lines.push(`- risk_level detail: expected ${riskCheck.expected.join(' / ')}, actual ${riskCheck.actual}`)
    }
    if (item.skippedReason || item.quoteProblems.length || item.unsupportedClaim || item.freePreview.overExposed) {
      lines.push('- execution notes:')
      if (item.skippedReason) lines.push(`  - ${item.skippedReason}`)
      if (item.quoteProblems.length) {
        lines.push(...item.quoteProblems.map((problem) => `  - quote not found in posting: ${problem.surface} -> ${problem.quote}`))
      }
      if (item.unsupportedClaim) lines.push('  - blocked unsupported claim pattern found')
      if (item.freePreview.overExposed) lines.push(`  - free preview over-exposed: shortReasons=${item.freePreview.reasonCount}, headlineLength=${item.freePreview.headlineLength}`)
    }
  }

  lines.push('', 'Summary', `- total: ${total}`, `- passed: ${pass}`, `- failed: ${fail}`)
  return `${lines.join('\n')}\n`
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!fs.existsSync(GOLDEN_SET_PATH)) {
    throw new Error(`Golden set JSON not found. Run npm run golden:sync first: ${GOLDEN_SET_PATH}`)
  }
  if (args.live && !process.env.OPENAI_API_KEY) {
    throw new Error('--live requires OPENAI_API_KEY')
  }

  const mode = args.live ? 'live-openai' : 'dry-run-deterministic'
  const originalApiKey = process.env.OPENAI_API_KEY
  const originalConsoleError = console.error
  const fetchTimeoutController = args.live
    ? installFetchTimeout(args.timeoutMs)
    : { restore() {}, timeoutState: { hitCount: 0 } }
  if (!args.live) {
    process.env.OPENAI_API_KEY = ''
    console.error = (...items) => {
      if (String(items[0] || '').includes('[jobrisk][openai] missing OPENAI_API_KEY')) return
      originalConsoleError(...items)
    }
  }

  const goldenSet = loadGoldenSources()
  const samplesById = new Map(goldenSet.samples.map((sample) => [sample.sample_id || sample.id, sample]))
  const selectedSamples = args.ids.length
    ? args.ids.map((id) => samplesById.get(id)).filter(Boolean)
    : goldenSet.samples
  const missingIds = args.ids.filter((id) => !samplesById.has(id))
  if (missingIds.length) {
    throw new Error(`Unknown sample ID(s) in --ids: ${missingIds.join(', ')}`)
  }
  const samples = args.limit ? selectedSamples.slice(0, args.limit) : selectedSamples
  const results = []
  for (const [index, sample] of samples.entries()) {
    const startedAt = Date.now()
    const sampleId = sample.sample_id || sample.id
    console.log(`[${index + 1}/${samples.length}] ${sampleId} start`)
    const { result, skippedReason } = await runSampleWithTimeout(sample, {
      timeoutMs: args.timeoutMs,
      timeoutState: fetchTimeoutController.timeoutState,
    })
    const evaluated = evaluateSample({ sample, result, skippedReason })
    results.push(evaluated)
    const duration = formatSeconds(Date.now() - startedAt)
    const trace = evaluated.riskTrace
    if (evaluated.status === 'fail') {
      console.log(`[${index + 1}/${samples.length}] ${sampleId} failed in ${duration}: ${skippedReason || 'validation failed'}`)
    } else if (skippedReason) {
      console.log(`[${index + 1}/${samples.length}] ${sampleId} completed in ${duration} with note: ${skippedReason}`)
    } else {
      console.log(`[${index + 1}/${samples.length}] ${sampleId} completed in ${duration}`)
    }
    console.log(
      `[${index + 1}/${samples.length}] ${sampleId} risk trace: fallback=${trace.fallbackRiskLevel || 'n/a'} -> llm_input=${trace.llmInputRiskLevel || 'n/a'} -> llm_returned=${trace.llmReturnedRiskLevel || 'null'} -> final=${trace.finalRiskLevel || 'n/a'} (${trace.riskLevelChanged ? `changed at ${trace.changedAt}` : 'unchanged'}, locked_to_fallback=${trace.finalLockedToFallback ? 'yes' : 'no'})`,
    )
  }

  if (!args.live) {
    process.env.OPENAI_API_KEY = originalApiKey
    console.error = originalConsoleError
  }
  fetchTimeoutController.restore()

  const outputDir = path.resolve('artifacts/golden-set', timestampForPath())
  fs.mkdirSync(outputDir, { recursive: true })
  const reportPath = path.join(outputDir, 'golden-set-report.md')
  const resultPath = path.join(outputDir, 'golden-set-results.json')
  const report = renderStrictGoldenReport({ results, mode, sourceSummary: goldenSet.summary })
  fs.writeFileSync(reportPath, report, 'utf8')
  fs.writeFileSync(
    resultPath,
    `${JSON.stringify({
      mode,
      generatedAt: new Date().toISOString(),
      source: {
        jsonPaths: goldenSet.sources.map((source) => path.relative(process.cwd(), source.path).replace(/\\/g, '/')),
        summary: goldenSet.summary,
      },
      results,
    }, null, 2)}\n`,
    'utf8',
  )

  console.log('[golden:run] completed')
  console.log(`- mode: ${mode}`)
  console.log(`- samples: ${results.length}`)
  console.log(`- ids: ${args.ids.length ? args.ids.join(', ') : 'all'}`)
  console.log(`- openai_timeout_ms: ${args.timeoutMs}`)
  console.log(`- pass: ${countWhere(results, (item) => item.status === 'pass')}`)
  console.log(`- fail: ${countWhere(results, (item) => item.status === 'fail')}`)
  console.log(`- report: ${path.relative(process.cwd(), reportPath)}`)
  console.log(`- json: ${path.relative(process.cwd(), resultPath)}`)
  if (countWhere(results, (item) => item.status === 'fail') > 0) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
