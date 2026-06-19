function normalizeText(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .trim()
}

function uniqueStrings(values, max = Infinity) {
  const result = []
  for (const value of values || []) {
    const normalized = String(value || '').trim()
    if (!normalized || result.includes(normalized)) continue
    result.push(normalized)
    if (result.length >= max) break
  }
  return result
}

function createConfidence(value = 'low', evidence = []) {
  const normalizedEvidence = uniqueStrings(evidence)
  return {
    value: value || null,
    confidence: normalizedEvidence.length >= 2 ? 'high' : normalizedEvidence.length === 1 ? 'medium' : 'low',
    evidence: normalizedEvidence,
  }
}

export function createEmptyCompanyContext(companyName = null) {
  return {
    companyName: companyName || null,
    companyStage: createConfidence(null, []),
    industry: createConfidence(null, []),
    businessSignals: [],
    jobConnectionHypotheses: [],
    mustAskQuestions: [],
    sources: [],
    reportEvidence: {
      companyEvidence: [],
      postingEvidence: [],
    },
    limitations: ['회사 맥락 정보가 없거나 근거가 부족해 추가 확인이 필요합니다.'],
  }
}

function normalizeUrl(url) {
  try {
    return new URL(String(url || '').trim()).toString()
  } catch {
    return null
  }
}

function buildSource({ title, url, sourceType }) {
  const normalizedUrl = normalizeUrl(url)
  if (!normalizedUrl) return null

  return {
    title: String(title || normalizedUrl).trim(),
    url: normalizedUrl,
    sourceType: sourceType || 'other_external',
  }
}

function inferOfficialSite(companyName, source) {
  const normalizedUrl = normalizeUrl(source?.url)
  if (!companyName || !normalizedUrl) return false

  try {
    const hostname = new URL(normalizedUrl).hostname.replace(/^www\./i, '').toLowerCase()
    const normalizedName = String(companyName || '')
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]/g, '')
    const title = String(source?.title || '').toLowerCase()
    const root = hostname.split('.')[0] || ''

    if (!normalizedName || !root) return false
    const rootMatch = normalizedName.includes(root) || root.includes(normalizedName)
    const titleLooksOfficial = /official|회사|공식|about|brand|기업/.test(title)
    return rootMatch && titleLooksOfficial
  } catch {
    return false
  }
}

function normalizeSourceType(sourceType, isOfficial = false) {
  if (isOfficial) return 'official_site'
  if (sourceType === 'news') return 'news'
  return 'other_external'
}

function mergeSources(...groups) {
  const merged = []
  const seen = new Set()

  for (const group of groups) {
    for (const item of group || []) {
      const source = buildSource(item || {})
      if (!source || seen.has(source.url)) continue
      seen.add(source.url)
      merged.push(source)
    }
  }

  return merged
}

function extractHomepageUrl(rawText) {
  const match = normalizeText(rawText).match(/https?:\/\/[^\s)]+/i)
  return match ? match[0] : null
}

function hostToCompanyName(url) {
  if (!url) return null
  try {
    const hostname = new URL(url).hostname.replace(/^www\./i, '')
    const [root] = hostname.split('.')
    if (!root) return null
    if (['bit', 'bitly', 'tinyurl', 't', 'docs', 'forms'].includes(root.toLowerCase())) return null
    return root.replace(/[-_]/g, ' ').trim()
  } catch {
    return null
  }
}

function cleanCompanyName(value) {
  return String(value || '')
    .replace(/^\[(.+?)\]\s*/, '')
    .replace(/^(주식회사|\(주\)|주\))/i, '')
    .replace(/\s+(채용|모집|recruitment|hiring).*$/i, '')
    .replace(/^([A-Za-z][A-Za-z0-9&()._-]*(?:\s+[A-Za-z][A-Za-z0-9&()._-]*){1,5})\s+[가-힣]+$/, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim() || null
}

function normalizeCompanyCore(value) {
  return String(value || '')
    .replace(/[^A-Za-z0-9가-힣]/g, '')
    .trim()
}

function looksLikeCompanyDescription(value) {
  const raw = String(value || '').trim()
  if (!raw) return false
  if (!/\s/.test(raw)) return false
  if (raw.length < 8) return false
  if (/(주식회사|inc\.?|corp\.?|llc|ltd\.?)/i.test(raw)) return false
  if (/(기업|회사|브랜드|스타트업|플랫폼|솔루션|서비스)$/.test(raw)) return true
  if (/(기술|활용|기반|전문|대상|관련|교육|운영|제공|성장)/.test(raw) && /(기업|회사|브랜드|플랫폼|솔루션|서비스)/.test(raw)) return true
  return false
}

function isWeakCompanyName(value) {
  const raw = String(value || '').trim()
  const core = normalizeCompanyCore(raw)
  if (!core || core.length < 2) return true
  if (looksLikeCompanyDescription(raw)) return true
  if (/^(채용공고|포지션상세|회사소개|상세|채용절차|주요업무|자격요건)$/i.test(core)) return true
  if (/^(companylogo|logo)$/i.test(core)) return true
  return false
}

const ROLE_LIKE_COMPANY_PATTERNS = [
  /마케터|디자이너|개발자|엔지니어|리드|매니저|담당자|코디네이터|manager|engineer|developer|designer|backend|back-end|frontend|front-end|fullstack|full-stack|technician|recruiter|coordinator/i,
  /\bIMC\b/i,
]

const COMPANY_CONTEXT_SUFFIX_PATTERNS = [/(브랜드|고객|서비스|플랫폼|팀|조직|제품)/i, /\b(brand|customer|service|platform|product|team)\b/i]
const GENERIC_COMPANY_CANDIDATE_TOKENS = new Set([
  '브랜드',
  '고객',
  '서비스',
  '플랫폼',
  '제품',
  '조직',
  '팀',
  '지원',
  '설계',
  '제작',
  '인터뷰',
  '콘텐츠',
  '콘텐츠를',
  '우대사항',
  '포지션',
  '포지션 상세',
  '포지션상세',
  '채용',
  '로봇',
  '우리',
  '우리는',
  '우리가',
  '위한',
  '채널',
  '고객이',
  '고객을',
  '시장',
  '최고의',
  '운영',
  'campaign',
  'brand',
  'customer',
  'service',
  'platform',
  'product',
  'team',
  'reward',
  'bonus',
  'fm',
  '일본',
  '국내',
  '글로벌',
  '세일즈',
  '경험',
  '교육',
  '고객',
  '기업',
])

const REWARD_LIKE_COMPANY_PATTERNS = /(합격보상|보상금|지원자|추천인|현금\s*\d+|만원|응답률|회원가입|wanted pick|원티드 픽)/i

function normalizeCandidateToken(value) {
  return String(value || '')
    .replace(/[()[\]{}"'`]/g, '')
    .replace(/(입니다|입니다만|은|는|이|가|의|와|과|도|만|로|으로|를|을|에|에서)$/u, '')
    .trim()
}

function isRoleLikeName(value) {
  const normalized = String(value || '').trim()
  if (!normalized) return true
  return ROLE_LIKE_COMPANY_PATTERNS.some((pattern) => pattern.test(normalized))
}

function isGenericCompanyCandidate(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) return true
  if (GENERIC_COMPANY_CANDIDATE_TOKENS.has(normalized)) return true
  return REWARD_LIKE_COMPANY_PATTERNS.test(normalized)
}

function isStrongCompanyIntroLine(line) {
  return /(기업|회사|서비스|플랫폼|브랜드|고객|제공|운영하고|운영하며|만들고|개발하고|성장하고|유치|선택)/i.test(String(line || ''))
}

function extractContextualCompanyCandidates(lines) {
  const counts = new Map()
  const contextCounts = new Map()

  for (const line of lines || []) {
    const normalizedLine = String(line || '').trim()
    const plainKoreanMatch = normalizedLine.match(/^([A-Za-z][A-Za-z0-9&()._-]*(?:\s+[A-Za-z][A-Za-z0-9&()._-]*){1,5})\s+(?:채용|hiring|recruitment)$/i)
    const plainKoreanCandidate = cleanCompanyName(plainKoreanMatch?.[1] || '')
    if (plainKoreanCandidate && !isRoleLikeName(plainKoreanCandidate) && !isGenericCompanyCandidate(plainKoreanCandidate)) return plainKoreanCandidate
    if (!normalizedLine) continue

    const matches = normalizedLine.match(/[A-Za-z가-힣0-9][A-Za-z가-힣0-9&._-]{1,}/g) || []
    for (const rawToken of matches) {
      const token = normalizeCandidateToken(rawToken)
      if (!token || token.length < 2) continue
      if (isRoleLikeName(token)) continue
      if (isGenericCompanyCandidate(token)) continue
      if (/채용|모집|경력|신입|자격요건|우대사항|주요업무|포지션|상시채용|company|logo/i.test(token)) continue
      counts.set(token, (counts.get(token) || 0) + 1)
    }

    for (const pattern of COMPANY_CONTEXT_SUFFIX_PATTERNS) {
      const match = normalizedLine.match(new RegExp(`([A-Za-z가-힣0-9&._-]{2,})\\s*${pattern.source}`, 'i'))
      const token = normalizeCandidateToken(match?.[1] || '')
      if (!token || isRoleLikeName(token)) continue
      if (isGenericCompanyCandidate(token)) continue
      contextCounts.set(token, (contextCounts.get(token) || 0) + 1)
    }
  }

  const ranked = [...counts.entries()]
    .map(([token, count]) => ({
      token,
      count,
      contextCount: contextCounts.get(token) || 0,
      score: count + (contextCounts.get(token) || 0) * 2,
    }))
    .sort((a, b) => b.score - a.score || b.contextCount - a.contextCount || b.count - a.count)

  const best = ranked[0]
  if (!best) return null
  if (best.count >= 2) return best.token
  if (best.contextCount >= 2) return best.token
  if (best.count >= 1 && best.contextCount >= 1) return best.token
  return null
}

function extractEnglishCompanyHeader(lines) {
  for (const line of (lines || []).slice(0, 3)) {
    const normalizedLine = String(line || '').trim()
    const match = normalizedLine.match(/^([A-Za-z][A-Za-z0-9&()._-]*(?:\s+[A-Za-z][A-Za-z0-9&()._-]*){1,5})\s+(?:채용|hiring|recruitment)$/i)
    const candidate = cleanCompanyName(match?.[1] || '')
    if (!candidate) continue
    if (isRoleLikeName(candidate)) continue
    if (isGenericCompanyCandidate(candidate)) continue
    return candidate
  }
  return null
}

function extractLeadingEnglishBrand(lines) {
  for (const line of (lines || []).slice(0, 3)) {
    const normalizedLine = String(line || '').trim()
    const match = normalizedLine.match(/^([A-Z][A-Za-z0-9&()._-]*(?:\s+[A-Z][A-Za-z0-9&()._-]*){1,5})/)
    const candidate = cleanCompanyName(match?.[1] || '')
    if (!candidate) continue
    if (isRoleLikeName(candidate)) continue
    if (isGenericCompanyCandidate(candidate)) continue
    return candidate
  }
  return null
}

function extractEnglishCompanyHeaderFromRawText(rawText) {
  const firstLines = normalizeText(rawText).split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 3)
  for (const line of firstLines) {
    const match = line.match(/^([A-Za-z][A-Za-z0-9&()._-]*(?:\s+[A-Za-z][A-Za-z0-9&()._-]*){1,5})\s+(?:채용|hiring|recruitment)$/i)
    const candidate = cleanCompanyName(match?.[1] || '')
    if (!candidate) continue
    if (isRoleLikeName(candidate)) continue
    if (isGenericCompanyCandidate(candidate)) continue
    return candidate
  }
  return null
}

function resolveCompanyName({ jobPostingText, extractedPosting }) {
  const rawEnglishHeaderCandidate = extractEnglishCompanyHeaderFromRawText(jobPostingText)
  const englishHeaderCandidate = extractEnglishCompanyHeader(extractedPosting.lines)
  const englishLeadCandidate = extractLeadingEnglishBrand(extractedPosting.lines)
  const lineBased = extractCompanyNameFromLines(extractedPosting.lines)
  const structuredCandidate = cleanCompanyName(extractedPosting.companyName)
  const contextualCandidate = extractContextualCompanyCandidates(extractedPosting.lines)
  const homepageCandidate = hostToCompanyName(extractedPosting.companyHomepageUrl)

  const candidates = [rawEnglishHeaderCandidate, englishHeaderCandidate, englishLeadCandidate, lineBased, structuredCandidate, homepageCandidate, contextualCandidate]
    .map((item) => cleanCompanyName(item))
    .filter(Boolean)

  const jobTitle = String(extractedPosting.jobTitle || '').trim()
  for (const candidate of candidates) {
    if (candidate === jobTitle) continue
    if (candidate && jobTitle.includes(candidate)) continue
    if (isRoleLikeName(candidate)) continue
    if (isGenericCompanyCandidate(candidate)) continue
    if (isWeakCompanyName(candidate)) continue
    return candidate
  }

  return null
}

function extractCompanyCandidateFromHeader(line) {
  const rawLine = String(line || '').trim()
  if (/^[\-•*]/.test(rawLine)) return null
  if (REWARD_LIKE_COMPANY_PATTERNS.test(rawLine)) return null
  const hiringHeaderMatch = rawLine.match(/^(.+?)\s+(채용|모집|hiring|recruitment)$/i)
  const candidate = (hiringHeaderMatch?.[1] || rawLine)
    .split(/[∙·•|]/)[0]
    ?.replace(/\s+(경력|신입|정규직|계약직).*$/i, '')
    ?.trim()

  if (!candidate || candidate.length < 2) return null
  const cleaned = cleanCompanyName(candidate)
  if (!cleaned) return null
  if (REWARD_LIKE_COMPANY_PATTERNS.test(cleaned)) return null
  if (/^(포지션 상세|주요업무|자격요건|우대사항)$/i.test(cleaned)) return null
  if (cleaned.length > 32) return null
  if (/\d+\s*만원/.test(cleaned)) return null
  if (/(습니다|합니다|역할|프로세스|경험을|기여할|실행하고)/.test(cleaned)) return null
  if (isRoleLikeName(cleaned)) return null
  if (isGenericCompanyCandidate(cleaned)) return null
  return cleaned
}

function extractCompanyNameFromLines(lines) {
  const safeLines = (lines || []).map((line) => String(line || '').trim()).filter(Boolean)
  const explicitPatterns = [
    /(?:회사명|기업명)\s*[:：]\s*(.+)$/i,
    /(?:Company|Employer)\s*[:：]\s*(.+)$/i,
  ]

  for (const line of safeLines) {
    for (const pattern of explicitPatterns) {
      const match = line.match(pattern)
      if (match) return cleanCompanyName(match[1])
    }
  }

  for (const line of safeLines.slice(0, 4)) {
    const headerCandidate = extractCompanyCandidateFromHeader(line)
    if (headerCandidate) return headerCandidate

    const candidate = cleanCompanyName(line)
    if (!candidate) continue
    if (/(채용|모집|hiring|recruitment)/i.test(line)) return candidate
    if (/(\(주\)|주식회사|inc\.?|corp\.?|labs?|테크|테크놀로지|소프트|컴퍼니)/i.test(line)) return candidate
  }
  const frequencies = new Map()
  const candidateLines = safeLines
    .slice(0, 8)
    .filter((line) => !/^[\-•*]/.test(line))

  for (const line of candidateLines) {
    for (const match of line.matchAll(/[가-힣A-Za-z][가-힣A-Za-z0-9]{1,}/g)) {
      const token = cleanCompanyName(match[0])
      if (!token || token.length < 2) continue
      if (/(채용|모집|경력|신입|주요업무|자격요건|우대사항|포지션|서비스|고객|브랜드)/i.test(token)) continue
      frequencies.set(token, (frequencies.get(token) || 0) + 1)
    }
  }

  const repeated = [...frequencies.entries()].sort((a, b) => b[1] - a[1])[0]
  if (repeated && repeated[1] >= 2) return repeated[0]

  return null
}

function buildBusinessSignal(signal, description, evidence, confidence = 'medium') {
  return {
    signal,
    description,
    confidence,
    evidence: uniqueStrings(evidence, 3),
  }
}

function matchPostingEvidence(postingText, patterns) {
  const lines = normalizeText(postingText).split('\n').map((line) => line.trim()).filter(Boolean)
  return uniqueStrings(
    lines.filter((line) => patterns.some((pattern) => pattern.test(line))).map((line) => line.slice(0, 220)),
    3,
  )
}

function inferCompanySignalsFromPosting({ jobPostingText, extractedPosting }) {
  const stageEvidence = []
  const industryEvidence = []
  const businessSignals = []
  const joined = normalizeText(jobPostingText)

  const stageRules = [
    { value: 'startup', patterns: [/시드|seed/i, /pre-?a/i, /series\s*a/i, /초기\s*스타트업/i, /startup/i] },
    { value: 'growth', patterns: [/series\s*b/i, /series\s*c/i, /스케일업/i, /급성장/i, /hyper.?growth/i] },
    { value: 'enterprise', patterns: [/대기업/i, /계열사/i, /상장/i, /코스닥/i, /코스피/i] },
  ]

  const industryRules = [
    { value: 'ai', patterns: [/\bAI\b/i, /생성형/i, /LLM/i, /머신러닝/i] },
    { value: 'saas', patterns: [/\bSaaS\b/i, /B2B 솔루션/i, /구독형/i] },
    { value: 'ecommerce', patterns: [/커머스/i, /이커머스/i, /쇼핑/i, /셀러/i] },
    { value: 'fintech', patterns: [/핀테크/i, /결제/i, /금융/i] },
    { value: 'healthcare', patterns: [/헬스케어/i, /의료/i, /병원/i] },
    { value: 'gaming', patterns: [/게임/i, /라이브 서비스/i, /게임 운영/i] },
  ]

  const signalRules = [
    {
      signal: 'global_expansion',
      description: '해외 시장 또는 다국가 운영과 연결될 수 있는 표현이 공고에 있습니다.',
      patterns: [/글로벌/i, /해외/i, /일본/i, /미국/i, /현지화/i, /localization/i],
    },
    {
      signal: 'new_market_launch',
      description: '신규 시장 진출 또는 신규 사업 실행과 연결될 수 있는 표현이 공고에 있습니다.',
      patterns: [/신규 시장/i, /런칭/i, /launch/i, /go-to-market/i, /사업 확장/i],
    },
    {
      signal: 'data_or_ai_product',
      description: '데이터 또는 AI 기반 서비스와 연결될 수 있는 표현이 공고에 있습니다.',
      patterns: [/\bAI\b/i, /자동화/i, /데이터/i, /모델/i, /추천/i],
    },
  ]

  for (const rule of stageRules) {
    const evidence = matchPostingEvidence(joined, rule.patterns)
    if (evidence.length) {
      stageEvidence.push(...evidence)
      break
    }
  }

  for (const rule of industryRules) {
    const evidence = matchPostingEvidence(joined, rule.patterns)
    if (evidence.length) {
      industryEvidence.push(...evidence)
      break
    }
  }

  for (const rule of signalRules) {
    const evidence = matchPostingEvidence(joined, rule.patterns)
    if (!evidence.length) continue
    businessSignals.push(buildBusinessSignal(rule.signal, rule.description, evidence, evidence.length >= 2 ? 'high' : 'medium'))
  }

  return {
    companyName: resolveCompanyName({ jobPostingText, extractedPosting }),
    companyHomepageUrl: extractedPosting.companyHomepageUrl || extractHomepageUrl(jobPostingText),
    companyStage: stageEvidence.length ? createConfidence(stageRules.find((rule) => matchPostingEvidence(joined, rule.patterns).length)?.value || null, stageEvidence) : createConfidence(null, []),
    industry: industryEvidence.length ? createConfidence(industryRules.find((rule) => matchPostingEvidence(joined, rule.patterns).length)?.value || null, industryEvidence) : createConfidence(null, []),
    businessSignals,
  }
}

const MOCK_COMPANY_PROFILES = {
  'Acme Japan Commerce': {
    companyStage: createConfidence('growth', ['공개 mock 데이터: 최근 해외 확장 단계로 설정된 테스트 회사입니다.']),
    industry: createConfidence('ecommerce', ['공개 mock 데이터: 커머스 운영 회사로 설정된 테스트 데이터입니다.']),
    businessSignals: [
      buildBusinessSignal(
        'japan_expansion',
        '최근 일본 시장 진출 준비가 있는 것으로 설정된 mock 데이터입니다.',
        ['공개 mock 데이터: 일본 현지 파트너십 및 상품 현지화 준비'],
        'high',
      ),
      buildBusinessSignal(
        'localization_need',
        '서비스 현지화와 운영 체계 정리가 필요한 단계로 설정된 mock 데이터입니다.',
        ['공개 mock 데이터: 일본 고객 대응 운영 프로세스 설계'],
        'medium',
      ),
    ],
    sources: [
      {
        title: 'Acme Japan Commerce mock company page',
        url: 'https://acme.example.com/company',
        sourceType: 'official_site',
      },
    ],
    limitations: ['이 회사 정보는 테스트용 mock 데이터입니다. 실제 회사 사실로 사용하면 안 됩니다.'],
  },
}

function parseSerperSignals(companyName, snippets) {
  const joined = snippets.join('\n')
  const stage = createConfidence(
    /series\s*b|series\s*c|급성장|스케일업/i.test(joined)
      ? 'growth'
      : /series\s*a|seed|pre-?a|초기 스타트업/i.test(joined)
        ? 'startup'
        : /상장|대기업|그룹사/i.test(joined)
          ? 'enterprise'
          : null,
    snippets.filter((snippet) => /series|상장|대기업|스타트업|스케일업|급성장/i.test(snippet)).slice(0, 2),
  )

  const industry = createConfidence(
    /\bAI\b|LLM|생성형/i.test(joined)
      ? 'ai'
      : /커머스|이커머스|쇼핑/i.test(joined)
        ? 'ecommerce'
        : /핀테크|결제|금융/i.test(joined)
          ? 'fintech'
          : /\bSaaS\b|B2B 솔루션|구독형/i.test(joined)
            ? 'saas'
            : null,
    snippets.filter((snippet) => /\bAI\b|LLM|커머스|핀테크|결제|SaaS|B2B/i.test(snippet)).slice(0, 2),
  )

  const businessSignals = []
  if (/일본|Japan|일본 시장|현지화/i.test(joined)) {
    businessSignals.push(
      buildBusinessSignal(
        'japan_expansion',
        `${companyName} 관련 공개 정보에서 일본 시장과 연결된 표현이 확인됩니다.`,
        snippets.filter((snippet) => /일본|Japan|현지화/i.test(snippet)).slice(0, 2),
        'medium',
      ),
    )
  }
  if (/해외 진출|global|global expansion|파트너십/i.test(joined)) {
    businessSignals.push(
      buildBusinessSignal(
        'global_expansion',
        `${companyName} 관련 공개 정보에서 해외 확장 또는 파트너십 표현이 확인됩니다.`,
        snippets.filter((snippet) => /해외 진출|global|파트너십/i.test(snippet)).slice(0, 2),
        'medium',
      ),
    )
  }
  if (/신제품|출시|launch|신규 사업/i.test(joined)) {
    businessSignals.push(
      buildBusinessSignal(
        'new_business',
        `${companyName} 관련 공개 정보에서 신규 사업 또는 제품 출시 표현이 확인됩니다.`,
        snippets.filter((snippet) => /신제품|출시|launch|신규 사업/i.test(snippet)).slice(0, 2),
        'medium',
      ),
    )
  }

  return { companyStage: stage, industry, businessSignals }
}

function summarizeSourceForReport(source, companyName) {
  const sourceTitle = String(source?.title || '').trim()
  const label = source.sourceType === 'official_site' ? '공식 사이트' : source.sourceType === 'news' ? '외부 기사' : '외부 출처'
  if (!sourceTitle) return `${companyName || '회사'} 관련 ${label}를 참고했습니다.`
  return `${label}: ${sourceTitle}`
}

function buildInterpretationSignal(context, hypothesis) {
  const companyName = context.companyName || '이 회사'
  const companyCue = String(hypothesis?.relatedCompanyEvidence || '').trim()
  const jobCue = String(hypothesis?.relatedJobPostingEvidence || '').trim()
  const base = String(hypothesis?.hypothesis || '').trim()

  if (!base) return null
  if (companyCue && jobCue) {
    return `${companyName}의 "${companyCue}" 신호와 공고의 "${jobCue}" 문장을 함께 보면, ${base}`
  }
  if (jobCue) {
    return `${companyName} 공고의 "${jobCue}" 문장을 기준으로 보면, ${base}`
  }
  return `${companyName} 기준으로 보면, ${base}`
}

function isContextUsefulSource(source) {
  const url = String(source?.url || '').toLowerCase()
  const title = String(source?.title || '').toLowerCase()
  if (/privacy|terms|legal|policy/.test(url)) return false
  if (/privacy|terms|legal|policy/.test(title)) return false
  return true
}

function buildReportEvidence(context) {
  const companyEvidence = (context.sources || [])
    .filter((item) => isContextUsefulSource(item))
    .slice(0, 3)
    .map((item) => ({
      title: item.title,
      summary: summarizeSourceForReport(item, context.companyName),
      url: item.url,
      sourceType: item.sourceType,
      isOfficial: item.sourceType === 'official_site',
    }))

  const postingEvidence = []
  const seenQuotes = new Set()
  for (const item of context.jobConnectionHypotheses || []) {
    const quote = String(item?.relatedJobPostingEvidence || '').trim()
    if (!quote || seenQuotes.has(quote)) continue
    seenQuotes.add(quote)
    postingEvidence.push({
      quote,
      signal: buildInterpretationSignal(context, item),
    })
    if (postingEvidence.length >= 2) break
  }

  return {
    companyEvidence,
    postingEvidence,
  }
}

async function fetchOnlineCompanyProfile(companyName) {
  if (!companyName) return { source: 'missing_company_name', snippets: [], sources: [], profile: null }
  if (MOCK_COMPANY_PROFILES[companyName]) {
    return { source: 'mock', snippets: [], sources: MOCK_COMPANY_PROFILES[companyName].sources || [], profile: MOCK_COMPANY_PROFILES[companyName] }
  }

  const apiKey = process.env.SERPER_API_KEY
  const enabled = String(process.env.COMPANY_ENRICHMENT_ENABLED || '').toLowerCase() === 'true'
  if (!enabled || !apiKey) return { source: 'disabled_or_missing_key', snippets: [], sources: [], profile: null }

  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: `${companyName} 투자 단계 시장 진출 기사 사업 회사` }),
    })
    if (!response.ok) return { source: 'search_failed', snippets: [], sources: [], profile: null }
    const json = await response.json()
    const organic = Array.isArray(json?.organic) ? json.organic : []
    const snippets = uniqueStrings(
      organic
        .map((item) => String(item?.snippet || '').trim())
        .filter(Boolean),
      5,
    )
    const sources = mergeSources(
      organic.slice(0, 3).map((item) => ({
        title: item?.title || companyName,
        url: item?.link,
        sourceType: 'news',
      })),
    )
    return { source: 'serper', snippets, sources, profile: parseSerperSignals(companyName, snippets) }
  } catch {
    return { source: 'search_error', snippets: [], sources: [], profile: null }
  }
}

function collectJobEvidence(extractedPosting) {
  return uniqueStrings(
    [
      ...(extractedPosting.sections?.responsibilities || []),
      ...(extractedPosting.sections?.requirements || []),
      ...(extractedPosting.sections?.preferred || []),
    ].map((line) => String(line || '').trim()).filter(Boolean),
    20,
  )
}

function inferContextRoleFamily(extractedPosting) {
  const normalizedFamily = String(extractedPosting?.jobFamily?.id || '').trim().toLowerCase()
  if (normalizedFamily && normalizedFamily !== 'unknown') return normalizedFamily

  const title = String(extractedPosting?.title || '').trim()
  const lines = [
    title,
    ...(extractedPosting.sections?.responsibilities || []),
    ...(extractedPosting.sections?.requirements || []),
    ...(extractedPosting.sections?.preferred || []),
  ]
    .map((line) => String(line || '').trim())
    .filter(Boolean)
    .join(' ')

  if (!lines) return 'generic'
  if (/(디자인|디자이너|UX|UI|BX|BI|브랜드 디자인|비주얼 디자이너|그래픽)/i.test(lines)) return 'design'
  if (/(PM|PO|프로덕트|서비스 기획|사업기획|기획)/i.test(lines)) return 'product'
  if (/(마케팅|브랜드|CRM|캠페인|퍼포먼스|그로스|콘텐츠 마케팅)/i.test(lines)) return 'marketing'
  if (/(영업|세일즈|BD|사업개발|파트너십|Account Manager|B2B|B2C)/i.test(lines)) return 'sales'
  if (/(운영|오퍼레이션|SCM|물류|프로세스|CS|CX|고객 상담|서비스 운영)/i.test(lines)) return 'service'
  return 'generic'
}

function buildHypothesis(rule, jobEvidence, companyEvidence) {
  return {
    hypothesis: rule.hypothesis,
    riskImpact: rule.riskImpact,
    reason: rule.reason,
    relatedJobPostingEvidence: jobEvidence[0],
    relatedCompanyEvidence: companyEvidence[0],
    confidence: jobEvidence.length && companyEvidence.length >= 2 ? 'high' : 'medium',
  }
}

function buildInternalCompanyContextHypothesis(companyName, jobEvidence, roleFamily = 'generic') {
  const quote = String(jobEvidence?.[0] || '').trim()
  if (!companyName || !quote) return null
  if (!['marketing', 'product', 'service', 'sales'].includes(roleFamily)) return null

  return {
    hypothesis: `${companyName} 맥락에서 이 역할이 실제 브랜드/서비스 경험으로 이어지는지 추가 확인이 필요합니다.`,
    riskImpact: 'uncertain',
    reason: '공고 내부에 회사명과 직무 문장이 함께 보이지만, 외부 회사 정보 없이 해석한 내용이라 직무 연결 범위를 면접에서 다시 확인해야 합니다.',
    relatedJobPostingEvidence: quote,
    relatedCompanyEvidence: companyName,
    confidence: 'medium',
  }
}

function inferJobConnectionHypotheses(extractedPosting, companyContext) {
  const jobEvidencePool = collectJobEvidence(extractedPosting)
  const roleFamily = inferContextRoleFamily(extractedPosting)
  const rules = [
    {
      signal: 'japan_expansion',
      allowedFamilies: ['marketing', 'product', 'sales', 'service', 'operations'],
      jobPatterns: [/일본/i, /글로벌/i, /해외/i, /현지화/i, /localization/i],
      riskImpact: 'decrease',
      hypothesis:
        '공고의 글로벌/일본 관련 업무가 실제로 있다면, 이 역할은 단순 운영보다 시장 진출 실행 경험과 연결될 가능성이 있습니다.',
      reason:
        '회사 측 공개 신호와 공고의 글로벌/현지화 표현이 함께 있을 때만, 시장 확장 실행 역할일 가능성을 참고 정보로 볼 수 있습니다.',
    },
    {
      signal: 'global_expansion',
      allowedFamilies: ['marketing', 'product', 'sales'],
      jobPatterns: [/파트너/i, /사업개발/i, /영업/i, /해외/i, /go-to-market/i],
      riskImpact: 'decrease',
      hypothesis:
        '해외 확장 신호가 있고 공고도 파트너십·영업·시장 실행 업무를 담고 있다면, 단순 보조보다 사업 실행 경험으로 이어질 수 있습니다.',
      reason: '공고 업무가 외부 시장 실행과 직접 연결될 때만 의미가 있습니다.',
    },
    {
      signal: 'localization_need',
      allowedFamilies: ['service', 'operations', 'marketing', 'product'],
      jobPatterns: [/운영/i, /프로세스/i, /정책/i, /고객 대응/i, /현지화/i],
      riskImpact: 'uncertain',
      hypothesis:
        '현지화나 운영 체계 정리 단계라면 반복 운영 업무가 있을 수 있으므로, 실제로 개선 권한과 KPI가 있는지 추가 확인이 필요합니다.',
      reason:
        '회사 확장 단계만으로는 좋은/나쁜 역할을 판단할 수 없고, 운영 실행이 단순 반복인지 개선 책임이 있는지 면접에서 갈립니다.',
    },
    {
      signal: 'new_business',
      allowedFamilies: ['marketing', 'product', 'sales'],
      jobPatterns: [/런칭/i, /launch/i, /신규/i, /기획/i, /실행/i],
      riskImpact: 'neutral',
      hypothesis:
        '신규 사업 또는 제품 출시 신호가 있고 공고에도 런칭 관련 표현이 있다면, 초기 실행 업무와 연결될 수 있습니다.',
      reason: '다만 공고에 권한과 산출물이 명확하지 않으면 역할 수준은 추가 확인이 필요합니다.',
    },
    {
      signal: 'data_or_ai_product',
      allowedFamilies: ['product', 'marketing'],
      jobPatterns: [/\bAI\b/i, /데이터/i, /자동화/i, /분석/i, /모델/i],
      riskImpact: 'neutral',
      hypothesis:
        'AI·데이터 서비스 신호가 있고 공고에도 해당 역량이 보이면, 직무가 단순 운영보다 분석·자동화 실행과 연결될 수 있습니다.',
      reason: '기술 키워드만 많고 실제 KPI·권한이 없을 수도 있어 추정과 사실을 분리해야 합니다.',
    },
  ]

  const hypotheses = []
  for (const signal of companyContext.businessSignals || []) {
    const rule = rules.find((candidate) => candidate.signal === signal.signal)
    if (!rule) continue
    if (Array.isArray(rule.allowedFamilies) && !rule.allowedFamilies.includes(roleFamily)) continue
    const relatedJobEvidence = uniqueStrings(jobEvidencePool.filter((line) => rule.jobPatterns.some((pattern) => pattern.test(line))), 2)
    if (!relatedJobEvidence.length) continue
    hypotheses.push(buildHypothesis(rule, relatedJobEvidence, signal.evidence || []))
    if (hypotheses.length >= 3) break
  }

  if (!hypotheses.length && companyContext.companyName) {
    const companyAnchoredEvidence = uniqueStrings(
      jobEvidencePool.filter((line) => line.includes(companyContext.companyName)),
      2,
    )
    const fallbackHypothesis = buildInternalCompanyContextHypothesis(companyContext.companyName, companyAnchoredEvidence, roleFamily)
    if (fallbackHypothesis) hypotheses.push(fallbackHypothesis)
  }
  return hypotheses
}

function buildMustAskQuestions(companyContext, extractedPosting) {
  if (!(companyContext.jobConnectionHypotheses || []).length) return []
  const questions = []
  const jobEvidencePool = collectJobEvidence(extractedPosting)
  const hasKpi = jobEvidencePool.some((line) => /KPI|지표|성과|전환율|매출|리텐션/i.test(line))

  for (const hypothesis of companyContext.jobConnectionHypotheses || []) {
    if (/시장 진출|글로벌|일본/.test(hypothesis.hypothesis)) {
      questions.push({
        question: '이 역할이 실제로 담당하는 국가/시장 범위와 책임 KPI는 무엇인가요?',
        whyAsk: '시장 진출 실행 역할인지, 단순 운영 지원인지 구분하려면 국가 범위와 KPI가 필요합니다.',
        goodAnswerSignal: '담당 시장, 목표 수치, 의사결정 범위를 구체적으로 설명합니다.',
        warningAnswerSignal: '국가 범위나 KPI 없이 이것저것 지원한다고만 답합니다.',
      })
    }
    if (/운영 체계|반복 운영|개선 권한/.test(hypothesis.hypothesis + hypothesis.reason)) {
      questions.push({
        question: '반복 운영 업무와 개선/설계 업무의 비중은 각각 어느 정도인가요?',
        whyAsk: '확장기 운영 역할은 단순 반복인지 개선 책임이 있는지 차이가 큽니다.',
        goodAnswerSignal: '업무 비중과 실제 개선 사례를 숫자 또는 흐름으로 설명합니다.',
        warningAnswerSignal: '운영이 대부분인데 개선 권한이나 목표가 없다고 답합니다.',
      })
    }
    if (/신규 사업|런칭|출시/.test(hypothesis.hypothesis)) {
      questions.push({
        question: '이 포지션이 런칭 과정에서 직접 책임지는 산출물과 의사결정 범위는 무엇인가요?',
        whyAsk: '런칭 참여가 단순 실행인지 핵심 책임인지 확인해야 합니다.',
        goodAnswerSignal: '본인 산출물, 일정 책임, 의사결정 범위를 명확히 설명합니다.',
        warningAnswerSignal: '실무 지원만 하고 핵심 결정은 모두 다른 팀이 한다고 답합니다.',
      })
    }
  }

  return questions.filter((item, index, list) => list.findIndex((candidate) => candidate.question === item.question) === index).slice(0, 5)
  if (!hasKpi) {
    questions.push({
      question: '이 역할의 성과는 어떤 지표나 결과물로 평가하나요?',
      whyAsk: '공고에 KPI가 부족하면 실제로 커리어 자산이 남는 구조인지 확인이 필요합니다.',
      goodAnswerSignal: '평가 지표와 리뷰 주기가 명확합니다.',
      warningAnswerSignal: '열심히 하면 된다는 식으로 평가 기준이 흐립니다.',
    })
  }

  questions.push({
    question: '입사 후 6개월 안에 이 역할이 남겨야 하는 대표 결과물은 무엇인가요?',
    whyAsk: '회사 맥락이 좋아 보여도, 실제 직무 결과물이 모호하면 물경력 위험 판단에 도움이 되지 않습니다.',
    goodAnswerSignal: '결과물, 협업 구조, 성공 기준을 구체적으로 설명합니다.',
    warningAnswerSignal: '필요한 일을 유동적으로 한다고만 답합니다.',
  })

  return questions.filter((item, index, list) => list.findIndex((candidate) => candidate.question === item.question) === index).slice(0, 5)
}

export async function buildCompanyContext({ jobPostingText, extractedPosting }) {
  const inferred = inferCompanySignalsFromPosting({ jobPostingText, extractedPosting })
  const companyName = inferred.companyName || null
  const context = createEmptyCompanyContext(companyName)
  const online = await fetchOnlineCompanyProfile(companyName)
  const homepageSource = inferred.companyHomepageUrl
    ? [
        {
          title: `${companyName || '회사'} 홈페이지`,
          url: inferred.companyHomepageUrl,
          sourceType: 'official_site',
        },
      ]
    : []

  context.companyName = companyName
  context.companyStage =
    inferred.companyStage.value || inferred.companyStage.evidence.length
      ? inferred.companyStage
      : online.profile?.companyStage || createConfidence(null, [])
  context.industry =
    inferred.industry.value || inferred.industry.evidence.length
      ? inferred.industry
      : online.profile?.industry || createConfidence(null, [])

  context.businessSignals = uniqueStrings(
    [
      ...(inferred.businessSignals || []),
      ...((online.profile?.businessSignals || []).filter(Boolean)),
    ].map((signal) => JSON.stringify(signal)),
  ).map((item) => JSON.parse(item))

  context.jobConnectionHypotheses = inferJobConnectionHypotheses(extractedPosting, context)
  context.mustAskQuestions = buildMustAskQuestions(context, extractedPosting)
  context.sources = mergeSources(homepageSource, online.sources, online.profile?.sources).map((item) => {
    const isOfficial = item.sourceType === 'official_site' || inferOfficialSite(companyName, item)
    return {
      ...item,
      sourceType: normalizeSourceType(item.sourceType, isOfficial),
    }
  })
  const postingCompanyMentions = context.companyName
    ? (extractedPosting.lines || []).filter((line) => String(line || '').includes(context.companyName)).length
    : 0
  const isDesignLikeTitle = /(designer|디자이너|design|ux|ui|bx|bi)/i.test(String(extractedPosting.jobTitle || ''))
  if (!context.sources.some((item) => isContextUsefulSource(item)) && (postingCompanyMentions < 2 || isDesignLikeTitle)) {
    context.jobConnectionHypotheses = []
    context.mustAskQuestions = []
  }
  context.reportEvidence = buildReportEvidence(context)

  const limitations = []
  if (!companyName) limitations.push('채용공고에서 회사명을 명확하게 추출하지 못해 회사 맥락 해석은 제한적입니다.')
  if (!inferred.companyHomepageUrl && context.sources.some((item) => item.sourceType === 'official_site')) {
    limitations.push('공고에는 공식 사이트 URL이 없어서 외부 검색 결과를 함께 참고했습니다.')
  } else if (!inferred.companyHomepageUrl && context.sources.some((item) => item.sourceType === 'news')) {
    limitations.push('공식 사이트 대신 외부 기사와 공고 문장을 함께 참고했습니다.')
  } else if (!inferred.companyHomepageUrl) {
    limitations.push('회사 홈페이지 URL이 공고에서 확인되지 않았습니다.')
  }
  if (online.source === 'disabled_or_missing_key') limitations.push('외부 회사 검색이 비활성화되어 공고 텍스트 기반 참고 정보만 사용했습니다.')
  if (online.source === 'search_failed' || online.source === 'search_error') limitations.push('회사 외부 정보 검색에 실패해 공고와 직접 연결되는 정보만 반영했습니다.')
  if (!context.jobConnectionHypotheses.length) limitations.push('회사 정보와 공고 업무를 직접 연결할 근거가 부족해 추가 확인 필요로 처리했습니다.')
  if (!context.businessSignals.length) limitations.push('회사 사업 신호 근거가 충분하지 않아 해석을 최소화했습니다.')
  if (online.profile?.limitations?.length) limitations.push(...online.profile.limitations)

  context.limitations = uniqueStrings(limitations)
  return context
}
