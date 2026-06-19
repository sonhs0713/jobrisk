import 'dotenv/config'
import fs from 'node:fs/promises'
import path from 'node:path'

import { buildDetailReport, buildPreview } from '../server/src/lib/analysis.js'
import { getCompanyContextSection } from '../shared/companyContextView.js'

const SUMMARY_FILENAME = 'job-postings-154.summary.csv'
const RAW_FULL_FILENAME = 'job-postings-154.raw.full.json'
const CLEAN_FULL_FILENAME = 'job-postings-154.clean.full.json'
const SUSPECTS_FILENAME = 'job-postings-154.suspects.csv'
const REVIEW_SAMPLE_FILENAME = 'job-postings-154.review-sample.csv'
const REPORT_FILENAME = 'job-postings-154.improvement-report.md'

const NOISE_PATTERNS = [
  { key: 'signup', label: '회원가입', pattern: /회원가입/g },
  { key: 'response_rate', label: '응답률', pattern: /응답률/g },
  { key: 'reward', label: '합격보상', pattern: /합격보상|지원자,\s*추천인 각 현금/gi },
  { key: 'wanted_pick', label: '원티드 픽', pattern: /원티드 픽/g },
  { key: 'always_hiring', label: '상시채용', pattern: /상시채용/g },
]

const FOOTER_START_PATTERNS = [
  /본 채용정보는 원티드랩의 동의없이/i,
  /합격은 확률이다! 지금 원티드/i,
  /^이 포지션을 찾고 계셨나요\?$/i,
]

const DROP_LINE_PATTERNS = [
  /^회원가입$/i,
  /^응답률$/i,
  /^(높음|평균이상|매우 높음)$/i,
  /^합격보상$/i,
  /^지원자,\s*추천인 각 현금/i,
  /^원티드 픽$/i,
  /^지원하기$/i,
  /^팔로우$/i,
  /^NAVER$/i,
  /^© NAVER Corp\.$/i,
]

const REVIEW_PRIORITY = [
  'job_title_looks_like_noise',
  'job_family_seems_wrong',
  'axis_level_quote_mismatch',
  'evidence_from_benefits',
  'over_interpretation_suspect',
  'company_context_missing_but_company_present',
  'missing_company_name',
  'question_not_matching_job_family',
]

const JOB_FAMILY_HINTS = {
  hr: ['온보딩', '평가', '보상', 'hr ', '인사', '근태', '노무', '리크루터', 'recruiter', 'talent acquisition', 'hrbp'],
  marketing: ['마케팅', '브랜드', 'crm', '퍼포먼스', '캠페인', '광고', '콘텐츠', 'imc'],
  operations: ['물류', '재고', '발주', '정산', 'scm', 'supply chain', 'inventory', 'oms', 'wms', 'warehouse', 'asset technician'],
  development: ['backend', 'back-end', 'frontend', 'front-end', '개발', '엔지니어', 'api', 'python', 'react', 'node', 'java', 'ml', 'ai'],
  design: ['디자인', 'ux', 'ui', 'bx', '그래픽', 'product designer'],
  manufacturing: ['생산', '제조', '공정', '품질', '반도체', '소자', '설비', 'simulation', 'tcad'],
}

const GENERIC_COMPANY_PATTERNS = [/^브랜드$/i, /^서비스$/i, /^플랫폼$/i, /^회사$/i, /^기업$/i, /^팀$/i]
const JOB_TITLE_NOISE_PATTERNS = [/응답률/i, /상시채용/i, /채용절차/i, /채용 전형/i, /태그/i, /근무지역/i, /합격보상/i]
const BENEFIT_PATTERNS = [/혜택/i, /복지/i, /건강검진/i, /식대/i, /휴가/i, /복지 포인트/i, /스낵바/i]
const HIRING_PROCESS_PATTERNS = [/채용 전형/i, /전형절차/i, /서류 전형/i, /인터뷰/i, /최종 합격/i, /레퍼런스 체크/i]
const TAG_PATTERNS = [/^태그$/i, /설립\d+년/i, /연봉상위/i, /누적투자/i, /유망산업/i]
const GENERIC_INTERPRETATION_PATTERNS = [/추가 확인이 필요/i, /판단 근거가 충분하지 않/i, /이름이 보입니다/i, /가능성이 있습니다/i]

function parseCsv(text) {
  const rows = []
  let current = ''
  let row = []
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    const next = text[i + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      row.push(current)
      current = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1
      row.push(current)
      current = ''
      if (row.some((cell) => cell.length > 0)) rows.push(row)
      row = []
      continue
    }

    current += char
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current)
    rows.push(row)
  }

  return rows
}

function rowsToObjects(rows) {
  if (rows.length === 0) return []
  const [header, ...dataRows] = rows
  return dataRows.map((row) => Object.fromEntries(header.map((key, index) => [key, row[index] ?? ''])))
}

function normalizeText(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function toLines(text) {
  return normalizeText(text)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function preprocessWantedText(text) {
  const originalLines = toLines(text)
  const keptLines = []
  let stoppedAtFooter = false
  let skipNextMetadataLine = false
  let skipRewardValueLine = false
  let skipResponseValueLine = false

  for (const line of originalLines) {
    if (FOOTER_START_PATTERNS.some((pattern) => pattern.test(line))) {
      stoppedAtFooter = true
      break
    }
    if (skipNextMetadataLine) {
      skipNextMetadataLine = false
      continue
    }
    if (skipRewardValueLine) {
      skipRewardValueLine = false
      if (/(지원자|추천인|현금|만원|보상금|reward)/i.test(line)) {
        continue
      }
    }
    if (skipResponseValueLine) {
      skipResponseValueLine = false
      if (/^(매우 높음|높음|보통|낮음|very high|high|medium|low)$/i.test(line)) {
        continue
      }
    }
    if (DROP_LINE_PATTERNS.some((pattern) => pattern.test(line))) {
      if (/^회원가입$/i.test(line)) skipNextMetadataLine = true
      if (/^합격보상$/i.test(line)) skipRewardValueLine = true
      if (/^응답률$/i.test(line)) skipResponseValueLine = true
      continue
    }
    keptLines.push(line)
  }

  const cleanText = normalizeText(keptLines.join('\n'))
  return {
    text: cleanText,
    stats: {
      originalLineCount: originalLines.length,
      cleanedLineCount: keptLines.length,
      removedLineCount: Math.max(originalLines.length - keptLines.length, 0),
      stoppedAtFooter,
    },
  }
}

function countNoise(text) {
  const counts = {}
  for (const item of NOISE_PATTERNS) {
    counts[item.key] = (String(text || '').match(item.pattern) || []).length
  }
  return counts
}

function safeJson(value) {
  return JSON.stringify(value ?? null)
}

function csvEscape(value) {
  const stringValue = value == null ? '' : String(value)
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }
  return stringValue
}

async function writeCsv(filePath, rows) {
  if (!rows.length) {
    await fs.writeFile(filePath, '', 'utf8')
    return
  }
  const headers = Object.keys(rows[0])
  const lines = [headers.map(csvEscape).join(',')]
  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header])).join(','))
  }
  await fs.writeFile(filePath, lines.join('\n'), 'utf8')
}

function getAxisMap(fiveAxes = []) {
  return Object.fromEntries((fiveAxes || []).map((axis) => [axis.key, axis]))
}

function compactText(value, max = 140) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (text.length <= max) return text
  return `${text.slice(0, max - 1)}…`
}

function familyScoresFromText(text) {
  const value = String(text || '').toLowerCase()
  const scores = {}
  for (const [family, hints] of Object.entries(JOB_FAMILY_HINTS)) {
    scores[family] = hints.reduce((count, hint) => count + Number(value.includes(hint.toLowerCase())), 0)
  }
  return scores
}

function expectedFamilyFromText(text) {
  const scores = familyScoresFromText(text)
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1])
  const [best, second] = ranked
  if (!best || best[1] < 2) return null
  if (second && best[1] === second[1]) return null
  return best[0]
}

function expectedFamilyWithScore(text) {
  const scores = familyScoresFromText(text)
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1])
  const [best, second] = ranked
  if (!best) return { family: null, score: 0, secondScore: 0 }
  return {
    family: best[1] >= 2 && (!second || best[1] > second[1]) ? best[0] : null,
    score: best[1],
    secondScore: second?.[1] || 0,
  }
}

function hasAnyPattern(text, patterns) {
  return patterns.some((pattern) => pattern.test(String(text || '')))
}

function isLikelyNoiseTitle(title) {
  const value = String(title || '').trim()
  if (!value) return true
  return hasAnyPattern(value, JOB_TITLE_NOISE_PATTERNS)
}

function isGenericCompanyName(companyName) {
  const value = String(companyName || '').trim()
  if (!value) return false
  return GENERIC_COMPANY_PATTERNS.some((pattern) => pattern.test(value))
}

function isBenefitLike(text) {
  return hasAnyPattern(text, BENEFIT_PATTERNS)
}

function isHiringProcessLike(text) {
  return hasAnyPattern(text, HIRING_PROCESS_PATTERNS)
}

function isTagLike(text) {
  return hasAnyPattern(text, TAG_PATTERNS)
}

function hasGrowthSignals(text) {
  return /(고도화|신규|리딩|주도|전략|아키텍처|개선|복잡|확장성|설계|구현)/i.test(String(text || ''))
}

function hasResponsibilitySignals(text) {
  return /(오너십|책임|주도|A to Z|전체|리딩|설계|목표 수립|권한)/i.test(String(text || ''))
}

function hasKpiSignals(text) {
  return /(KPI|OKR|지표|결과 보고|성과|전환율|매출|리텐션|데이터 분석)/i.test(String(text || ''))
}

function hasRepetitionSignals(text) {
  return /(반복|운영|모니터링|요청 처리|업로드|정리|지원)/i.test(String(text || ''))
}

function hasTransferabilitySignals(text) {
  return /(문서화|분석|전략|프로젝트|아키텍처|Python|React|Node|마케팅|브랜드|반도체|공정|설계)/i.test(String(text || ''))
}

function isPositiveLike(level) {
  return ['positive_with_check', 'strong_positive', 'positive'].includes(String(level || ''))
}

function isNegativeLike(level) {
  return ['risk', 'insufficient_info', 'needs_review'].includes(String(level || ''))
}

function genericQuestion(question) {
  return /(3개월|산출물|업무 우선순위|성과는 어떤 KPI|1년 뒤 이력서)/i.test(String(question || ''))
}

function domainQuestionMatch(jobFamilyId, joinedQuestions) {
  const text = String(joinedQuestions || '')
  const familyPatterns = {
    development: /(아키텍처|기술 선택|신규 기능|운영·유지보수|성능|API|시스템)/i,
    hr: /(채용|온보딩|평가|보상|근태|조직문화|인사)/i,
    marketing: /(캠페인|브랜드|성과 지표|소재|채널|전환|고객)/i,
    operations: /(프로세스|재고|정산|운영 비중|SOP|ERP|WMS|물류)/i,
    design: /(디자인 시스템|사용자 리서치|프로토타입|피드백|협업)/i,
    manufacturing: /(공정|수율|품질|설비|시뮬레이션|반도체)/i,
  }
  return familyPatterns[jobFamilyId]?.test(text) ?? true
}

async function analyzePosting(id, jobPostingText) {
  const preview = await buildPreview({ jobPostingText })
  const detail = await buildDetailReport({
    analysis: {
      structured: preview.structured,
      freePreview: preview.freePreview,
    },
  })
  const companySection = getCompanyContextSection(detail.detail.companyContext)
  return { id, preview, detail, companySection }
}

function summarizePosting(id, inputText, result, preprocessStats = null) {
  const preview = result.preview?.freePreview || {}
  const structured = result.preview?.structured || {}
  const detail = result.detail?.detail || {}
  const companyContext = detail.companyContext || structured.companyContext || {}
  const companySection = result.companySection
  const axisMap = getAxisMap(detail.fiveAxes || structured.fiveAxes || [])
  const interviewQuestions = detail.interviewQuestions || []
  const keyEvidence = detail.keyEvidence || []
  const noise = countNoise(inputText)

  return {
    id,
    inputLength: String(inputText.length),
    companyName: companyContext.companyName || structured.companyName || '',
    jobTitle: structured.jobTitle || '',
    jobFamilyId: detail.jobFamily?.id || structured.jobFamily?.id || '',
    jobFamilyLabel: detail.jobFamily?.label || structured.jobFamily?.label || '',
    jobFamilyConfidence: detail.jobFamily?.confidence || structured.jobFamily?.confidence || '',
    previewRiskLevel: preview.riskLevel || '',
    previewRiskLabel: preview.riskLevelLabel || '',
    previewHeadline: preview.headline || '',
    previewShortReasons: preview.shortReasons || [],
    previewVerificationQuestion: preview.verificationQuestion || '',
    topEvidenceQuote: preview.topEvidence?.quote || '',
    topEvidenceInterpretation: preview.topEvidence?.interpretation || '',
    detailFinalSummary: detail.finalSummary || '',
    detailActionGuide: detail.actionGuide || '',
    companyContextCompanyName: companyContext.companyName || '',
    companyContextSectionMode: companySection?.mode || '',
    companyContextPostingEvidenceCount: String(companyContext.reportEvidence?.postingEvidence?.length || 0),
    companyContextCompanyEvidenceCount: String(companyContext.reportEvidence?.companyEvidence?.length || 0),
    companyContextInterpretation: companySection?.interpretation || companyContext.reportEvidence?.postingEvidence?.[0]?.signal || '',
    interviewQuestionsCount: String(interviewQuestions.length),
    interviewQuestions: interviewQuestions.map((item) => item.question),
    keyEvidenceQuotes: keyEvidence.map((item) => item.quote || ''),
    keyEvidenceInterpretations: keyEvidence.map((item) => item.interpretation || ''),
    enginePreview: result.preview?.engine || '',
    engineDetail: result.detail?.engine || '',
    limitations: companyContext.limitations || [],
    fiveAxesLevels: {
      repetition: axisMap.repetition?.level || '',
      responsibility: axisMap.responsibility?.level || '',
      measurable: axisMap.measurable?.level || '',
      difficulty: axisMap.difficulty?.level || '',
      transferable: axisMap.transferable?.level || '',
    },
    fiveAxesQuotes: {
      repetition: axisMap.repetition?.evidence?.quote || '',
      responsibility: axisMap.responsibility?.evidence?.quote || '',
      measurable: axisMap.measurable?.evidence?.quote || '',
      difficulty: axisMap.difficulty?.evidence?.quote || '',
      transferable: axisMap.transferable?.evidence?.quote || '',
    },
    preprocessStats,
    noise,
  }
}

function tagPosting(summary, sourceText) {
  const tags = []
  const companyName = summary.companyName
  const jobTitle = summary.jobTitle
  const familyId = summary.jobFamilyId
  const joinedText = `${jobTitle}\n${sourceText}`
  const expectedFamilyInfo = expectedFamilyWithScore(joinedText)
  const expectedFamily = expectedFamilyInfo.family
  const axisLevels = summary.fiveAxesLevels || {}
  const axisQuotes = summary.fiveAxesQuotes || {}
  const questions = summary.interviewQuestions || []
  const questionBlob = questions.join('\n')
  const keyEvidenceQuotes = (summary.keyEvidenceQuotes || []).filter(Boolean)
  const axisEvidenceQuotes = Object.values(axisQuotes || {}).filter(Boolean)
  const evidenceQuotes = [summary.topEvidenceQuote, ...keyEvidenceQuotes, ...axisEvidenceQuotes].filter(Boolean)
  const duplicateEvidenceSource = [...keyEvidenceQuotes, ...axisEvidenceQuotes]
  const uniqueEvidence = new Set(duplicateEvidenceSource)

  if (!companyName) tags.push('missing_company_name')
  if (!jobTitle) tags.push('missing_job_title')
  if (isLikelyNoiseTitle(jobTitle)) tags.push('job_title_looks_like_noise')
  if (companyName && jobTitle && companyName === jobTitle) tags.push('company_name_equals_job_title')
  if (isGenericCompanyName(companyName)) tags.push('company_name_looks_generic')

  if (!familyId || summary.jobFamilyConfidence === 'low') tags.push('job_family_low_confidence')
  if (expectedFamily && familyId && expectedFamily !== familyId) tags.push('job_family_seems_wrong')
  if (familyId !== 'development' && /(backend|back-end|frontend|front-end|developer|api|react|node|python|engineer)/i.test(joinedText)) {
    tags.push('developer_classified_non_tech')
  }
  if (expectedFamily === 'hr' && familyId !== 'hr') {
    tags.push('hr_classified_non_hr')
  }
  if (expectedFamily === 'operations' && familyId !== 'operations') {
    tags.push('operations_classified_unrelated')
  }

  if (hasRepetitionSignals(sourceText) && isPositiveLike(axisLevels.repetition)) tags.push('axis_repetition_misread')
  if (hasResponsibilitySignals(sourceText) && isNegativeLike(axisLevels.responsibility)) tags.push('axis_responsibility_misread')
  if (hasKpiSignals(sourceText) && isNegativeLike(axisLevels.measurable)) tags.push('axis_kpi_misread')
  if (hasGrowthSignals(sourceText) && isNegativeLike(axisLevels.difficulty)) tags.push('axis_growth_misread')
  if (hasTransferabilitySignals(sourceText) && isNegativeLike(axisLevels.transferable)) tags.push('axis_transferability_misread')

  for (const [axisKey, level] of Object.entries(axisLevels)) {
    const quote = axisQuotes[axisKey] || ''
    if (level && level !== 'insufficient_info' && !quote) {
      tags.push('axis_quote_missing')
      break
    }
    if (quote && (isBenefitLike(quote) || isHiringProcessLike(quote) || isTagLike(quote))) {
      tags.push('axis_level_quote_mismatch')
      break
    }
  }

  if (evidenceQuotes.some((quote) => isBenefitLike(quote))) tags.push('evidence_from_benefits')
  if (evidenceQuotes.some((quote) => isHiringProcessLike(quote))) tags.push('evidence_from_hiring_process')
  if (evidenceQuotes.some((quote) => isTagLike(quote))) tags.push('evidence_from_tags')
  if (evidenceQuotes.some((quote) => compactText(quote, 999).length < 16)) tags.push('evidence_too_generic')
  if (uniqueEvidence.size < duplicateEvidenceSource.length) tags.push('duplicate_evidence')
  if (
    String(summary.topEvidenceQuote || '').trim().length > 0 &&
    String(summary.topEvidenceQuote || '').trim().length < 35 &&
    String(summary.topEvidenceInterpretation || '').trim().length > 120
  ) {
    tags.push('over_interpretation_suspect')
  }

  if (companyName && !summary.companyContextSectionMode && /(브랜드|고객|서비스|플랫폼)/i.test(sourceText)) {
    tags.push('company_context_missing_but_company_present')
  }
  if (summary.companyContextSectionMode === 'light') tags.push('company_context_light_only')
  if (!summary.companyContextCompanyName) tags.push('company_context_company_name_missing')
  if (GENERIC_INTERPRETATION_PATTERNS.some((pattern) => pattern.test(summary.companyContextInterpretation || ''))) {
    tags.push('company_context_interpretation_generic')
  }

  const genericQuestionCount = questions.filter((question) => genericQuestion(question)).length
  if (questions.length > 0 && genericQuestionCount >= Math.max(3, Math.ceil(questions.length * 0.6))) {
    tags.push('interview_questions_too_generic')
  }
  if (questions.length < 5) tags.push('interview_questions_count_low')
  if (familyId && questions.length > 0 && !domainQuestionMatch(familyId, questionBlob)) {
    tags.push('question_not_matching_job_family')
  }

  return [...new Set(tags)]
}

function compareMetric(rawRows, cleanRows, selector) {
  const rawValue = rawRows.reduce((sum, row) => sum + selector(row), 0)
  const cleanValue = cleanRows.reduce((sum, row) => sum + selector(row), 0)
  return { rawValue, cleanValue, delta: cleanValue - rawValue }
}

function countTags(rows, tag) {
  return rows.reduce((sum, row) => sum + Number((row.tags || []).includes(tag)), 0)
}

function rankSuspect(row) {
  const tags = row.tags || []
  let score = 0
  for (const [index, tag] of REVIEW_PRIORITY.entries()) {
    if (tags.includes(tag)) score += (REVIEW_PRIORITY.length - index) * 10
  }
  score += tags.length
  return score
}

function selectReviewSamples(cleanRows) {
  const suspects = cleanRows
    .filter((row) => (row.tags || []).length > 0)
    .sort((a, b) => rankSuspect(b) - rankSuspect(a) || Number(a.id) - Number(b.id))
  const successPool = cleanRows
    .filter((row) => (row.tags || []).length === 0)
    .sort((a, b) => Number(a.id) - Number(b.id))

  const chosenSuspects = []
  const usedIds = new Set()
  for (const row of suspects) {
    if (chosenSuspects.length >= 25) break
    if (usedIds.has(row.id)) continue
    chosenSuspects.push(row)
    usedIds.add(row.id)
  }

  const successByFamily = new Map()
  for (const row of successPool) {
    if (!row.jobFamilyId || successByFamily.has(row.jobFamilyId)) continue
    successByFamily.set(row.jobFamilyId, row)
    usedIds.add(row.id)
    if (successByFamily.size >= 5) break
  }
  const chosenSuccess = [...successByFamily.values()]
  for (const row of successPool) {
    if (chosenSuccess.length >= 5) break
    if (usedIds.has(row.id)) continue
    chosenSuccess.push(row)
    usedIds.add(row.id)
  }

  return {
    suspects: chosenSuspects,
    success: chosenSuccess.slice(0, 5),
  }
}

function summaryCsvRow(rawRow, cleanRow) {
  return {
    id: cleanRow.id,
    raw_input_length: rawRow.inputLength,
    clean_input_length: cleanRow.inputLength,
    raw_company_name: rawRow.companyName,
    clean_company_name: cleanRow.companyName,
    raw_job_title: rawRow.jobTitle,
    clean_job_title: cleanRow.jobTitle,
    raw_job_family_id: rawRow.jobFamilyId,
    clean_job_family_id: cleanRow.jobFamilyId,
    clean_preview_risk_level: cleanRow.previewRiskLevel,
    clean_preview_risk_label: cleanRow.previewRiskLabel,
    clean_preview_headline: cleanRow.previewHeadline,
    clean_top_evidence_quote: cleanRow.topEvidenceQuote,
    clean_company_context_mode: cleanRow.companyContextSectionMode,
    clean_interview_questions_count: cleanRow.interviewQuestionsCount,
    raw_tags: safeJson(rawRow.tags),
    clean_tags: safeJson(cleanRow.tags),
    noise_counts: safeJson(rawRow.noise),
  }
}

function suspectCsvRow(row) {
  return {
    id: row.id,
    company_name: row.companyName,
    job_title: row.jobTitle,
    job_family_id: row.jobFamilyId,
    preview_risk_label: row.previewRiskLabel,
    preview_headline: row.previewHeadline,
    top_evidence_quote: row.topEvidenceQuote,
    company_context_mode: row.companyContextSectionMode,
    tags: safeJson(row.tags),
  }
}

function reviewCsvRow(row, sampleType) {
  return {
    id: row.id,
    sample_type: sampleType,
    company_name: row.companyName,
    job_title: row.jobTitle,
    job_family_id: row.jobFamilyId,
    preview_risk_label: row.previewRiskLabel,
    preview_headline: row.previewHeadline,
    top_evidence_quote: row.topEvidenceQuote,
    company_context_mode: row.companyContextSectionMode,
    tags: safeJson(row.tags),
    manual_company_name: '',
    manual_job_title: '',
    manual_job_family: '',
    manual_preview_risk_level: '',
    manual_detail_risk_level: '',
    manual_top_evidence_good_bad: '',
    manual_questions_good_bad: '',
    manual_company_context_good_bad: '',
    manual_notes: '',
  }
}

function renderReport({ rawRows, cleanRows, reviewSamples, noiseTotals }) {
  const metrics = {
    companyName: compareMetric(rawRows, cleanRows, (row) => Number(Boolean(row.companyName))),
    jobTitle: compareMetric(rawRows, cleanRows, (row) => Number(Boolean(row.jobTitle) && !isLikelyNoiseTitle(row.jobTitle))),
    companyContextVisible: compareMetric(rawRows, cleanRows, (row) => Number(Boolean(row.companyContextSectionMode))),
    evidenceBenefitTag: compareMetric(rawRows, cleanRows, (row) => Number((row.tags || []).includes('evidence_from_benefits'))),
  }

  const trackedTags = [
    'job_title_looks_like_noise',
    'job_family_seems_wrong',
    'axis_level_quote_mismatch',
    'evidence_from_benefits',
    'over_interpretation_suspect',
    'company_context_missing_but_company_present',
    'interview_questions_too_generic',
  ]

  const tagLines = trackedTags
    .map((tag) => `- \`${tag}\`: raw ${countTags(rawRows, tag)}건 -> clean ${countTags(cleanRows, tag)}건`)
    .join('\n')

  const noiseLines = Object.entries(noiseTotals)
    .map(([key, value]) => `- \`${key}\`: ${value}건`)
    .join('\n')

  const suspectCount = cleanRows.filter((row) => (row.tags || []).length > 0).length
  const successCount = cleanRows.length - suspectCount

  return `# JobRisk 154개 채용공고 개선 리포트

## 입력 데이터
- 총 공고 수: ${cleanRows.length}
- raw baseline과 clean baseline을 모두 생성했습니다.
- clean baseline은 원티드 하단 추천 공고, CTA, 합격보상/응답률/회원가입 같은 노이즈를 줄인 텍스트 기준입니다.

## 원티드 노이즈 현황
${noiseLines}

## 핵심 비교
- 회사명 추출 성공: raw ${metrics.companyName.rawValue}건 -> clean ${metrics.companyName.cleanValue}건
- 직무명 추출 정상: raw ${metrics.jobTitle.rawValue}건 -> clean ${metrics.jobTitle.cleanValue}건
- 회사 맥락 섹션 노출: raw ${metrics.companyContextVisible.rawValue}건 -> clean ${metrics.companyContextVisible.cleanValue}건
- 복지 근거 오염 의심: raw ${metrics.evidenceBenefitTag.rawValue}건 -> clean ${metrics.evidenceBenefitTag.cleanValue}건

## 주요 실패 태그 비교
${tagLines}

## 수동 검토 세트
- 실패 의심 샘플: ${reviewSamples.suspects.length}개
- clean success 샘플: ${reviewSamples.success.length}개
- review sample CSV에 manual_* 칼럼을 추가해 사람이 직접 정답을 기록할 수 있게 했습니다.

## 현재 판단
- 이번 구현의 핵심은 카피가 아니라 입력 해석 품질을 드러내는 평가 루프를 만든 것입니다.
- 다음 라운드 우선순위는 전처리 보강 -> 회사명/직무명 추출 -> 직무군 분류 -> 5개 판단축/근거 선택 -> 질문 품질 순서가 맞습니다.
- 회사 맥락은 계속 보조 정보로만 다루는 것이 안전합니다.

## 남은 문제
- 이 리포트는 자동 태깅 기반이므로 일부 오탐이 있을 수 있습니다.
- 실제 개선 여부 확정은 review-sample의 manual_* 칼럼을 채운 뒤 다시 비교해야 합니다.
- preview와 detail의 품질 평가는 이번에 분리 저장했지만, 최종 의사결정은 수동 검토가 필요합니다.
`
}

async function main() {
  const inputPath = process.argv[2]
  if (!inputPath) {
    throw new Error('Usage: node scripts/analyze-csv.mjs <csv-path>')
  }

  const resolvedInput = path.resolve(inputPath)
  const rawCsv = await fs.readFile(resolvedInput, 'utf8')
  const sourceRows = rowsToObjects(parseCsv(rawCsv))

  const rawResults = []
  const cleanResults = []
  const noiseTotals = Object.fromEntries(NOISE_PATTERNS.map((item) => [item.key, 0]))
  const failures = []

  for (const row of sourceRows) {
    const id = String(row.id || '').trim()
    const rawText = normalizeText(row.job_posting_text || '')
    if (!id || !rawText) continue

    const preprocess = preprocessWantedText(rawText)
    const noise = countNoise(rawText)
    for (const [key, value] of Object.entries(noise)) noiseTotals[key] += value

    try {
      const rawAnalysis = await analyzePosting(id, rawText)
      const cleanAnalysis = await analyzePosting(id, preprocess.text || rawText)

      const rawSummary = summarizePosting(id, rawText, rawAnalysis, null)
      const cleanSummary = summarizePosting(id, preprocess.text || rawText, cleanAnalysis, preprocess.stats)
      rawSummary.tags = tagPosting(rawSummary, rawText)
      cleanSummary.tags = tagPosting(cleanSummary, preprocess.text || rawText)

      rawResults.push({
        id,
        input: rawText,
        summary: rawSummary,
        preview: rawAnalysis.preview,
        detail: rawAnalysis.detail,
      })
      cleanResults.push({
        id,
        input: preprocess.text || rawText,
        preprocess,
        summary: cleanSummary,
        preview: cleanAnalysis.preview,
        detail: cleanAnalysis.detail,
      })
    } catch (error) {
      failures.push({
        id,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const rawSummaryRows = rawResults.map((item) => item.summary)
  const cleanSummaryRows = cleanResults.map((item) => item.summary)
  const rawById = new Map(rawSummaryRows.map((row) => [row.id, row]))
  const cleanById = new Map(cleanSummaryRows.map((row) => [row.id, row]))

  const summaryRows = [...cleanById.keys()].map((id) => summaryCsvRow(rawById.get(id), cleanById.get(id)))
  const suspectRows = cleanSummaryRows.filter((row) => (row.tags || []).length > 0).map(suspectCsvRow)
  const reviewSamples = selectReviewSamples(cleanSummaryRows)
  const reviewRows = [
    ...reviewSamples.suspects.map((row) => reviewCsvRow(row, 'suspect')),
    ...reviewSamples.success.map((row) => reviewCsvRow(row, 'clean_success')),
  ]

  const outDir = path.resolve('artifacts')
  await fs.mkdir(outDir, { recursive: true })

  await fs.writeFile(
    path.join(outDir, RAW_FULL_FILENAME),
    JSON.stringify({ generatedAt: new Date().toISOString(), inputPath: resolvedInput, failures, results: rawResults }, null, 2),
    'utf8',
  )
  await fs.writeFile(
    path.join(outDir, CLEAN_FULL_FILENAME),
    JSON.stringify({ generatedAt: new Date().toISOString(), inputPath: resolvedInput, failures, results: cleanResults }, null, 2),
    'utf8',
  )
  await writeCsv(path.join(outDir, SUMMARY_FILENAME), summaryRows)
  await writeCsv(path.join(outDir, SUSPECTS_FILENAME), suspectRows)
  await writeCsv(path.join(outDir, REVIEW_SAMPLE_FILENAME), reviewRows)
  await fs.writeFile(
    path.join(outDir, REPORT_FILENAME),
    renderReport({ rawRows: rawSummaryRows, cleanRows: cleanSummaryRows, reviewSamples, noiseTotals }),
    'utf8',
  )

  console.log(
    JSON.stringify(
      {
        count: cleanResults.length,
        failures: failures.length,
        artifacts: {
          rawFull: path.join(outDir, RAW_FULL_FILENAME),
          cleanFull: path.join(outDir, CLEAN_FULL_FILENAME),
          summary: path.join(outDir, SUMMARY_FILENAME),
          suspects: path.join(outDir, SUSPECTS_FILENAME),
          reviewSample: path.join(outDir, REVIEW_SAMPLE_FILENAME),
          report: path.join(outDir, REPORT_FILENAME),
        },
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
