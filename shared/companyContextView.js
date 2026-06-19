function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

const GENERIC_TOKENS = new Set([
  '회사',
  '공고',
  '직무',
  '역할',
  '업무',
  '신호',
  '근거',
  '해석',
  '참고',
  '정보',
  '서비스',
  '시장',
  '단계',
  '기업',
  '데이터',
  'ai',
  '기반',
  '관리',
  '운영',
  '실행',
  '구조',
  '확인',
  '필요',
  '추가',
  '문장',
  '표현',
  '케이스',
  '출처',
  '반복',
  'global',
  'launch',
])

function extractTokens(value) {
  return (String(value || '').match(/[A-Za-z0-9가-힣]+/g) || []).filter((token) => {
    const normalized = token.toLowerCase()
    if (normalized.length < 2) return false
    if (/^\d+$/.test(normalized)) return false
    return !GENERIC_TOKENS.has(normalized)
  })
}

function includesAnyKeyword(text, keywords) {
  const normalizedText = normalizeText(text)
  return keywords.some((keyword) => normalizedText.includes(keyword))
}

function collectCompanyIdentifiers(companyContext, companyEvidence) {
  const identifiers = new Set()
  const companyName = String(companyContext?.companyName || '').trim()
  if (companyName) {
    identifiers.add(normalizeText(companyName))
    for (const token of extractTokens(companyName)) identifiers.add(token.toLowerCase())
  }

  for (const item of companyEvidence || []) {
    try {
      const hostname = new URL(String(item?.url || '')).hostname.replace(/^www\./i, '')
      const root = hostname.split('.')[0]?.replace(/[-_]/g, ' ').trim()
      if (!root) continue
      identifiers.add(normalizeText(root))
      for (const token of extractTokens(root)) identifiers.add(token.toLowerCase())
    } catch {
      continue
    }
  }

  return [...identifiers].filter(Boolean)
}

function collectEvidenceKeywords(items, fields) {
  const keywords = new Set()
  for (const item of items || []) {
    for (const field of fields) {
      for (const token of extractTokens(item?.[field])) {
        keywords.add(token.toLowerCase())
      }
    }
  }
  return [...keywords]
}

export function getCompanyContextSection(companyContext) {
  if (!companyContext) return null

  const reportEvidence = companyContext.reportEvidence || { companyEvidence: [], postingEvidence: [] }
  const companyEvidence = Array.isArray(reportEvidence.companyEvidence) ? reportEvidence.companyEvidence : []
  const postingEvidence = Array.isArray(reportEvidence.postingEvidence) ? reportEvidence.postingEvidence : []
  const interpretation = postingEvidence.find((item) => typeof item?.signal === 'string' && item.signal.trim())?.signal?.trim() || ''

  if (!postingEvidence.length || !interpretation) return null

  const companyIdentifiers = collectCompanyIdentifiers(companyContext, companyEvidence)
  const companyKeywords = collectEvidenceKeywords(companyEvidence, ['title', 'summary'])
  const postingKeywords = collectEvidenceKeywords(postingEvidence, ['quote']).filter(
    (keyword) => !companyIdentifiers.includes(keyword),
  )
  const matches = [
    companyIdentifiers.length > 0 && includesAnyKeyword(interpretation, companyIdentifiers),
    companyKeywords.length > 0 && includesAnyKeyword(interpretation, companyKeywords),
    postingKeywords.length > 0 && includesAnyKeyword(interpretation, postingKeywords),
  ]
  const score = matches.filter(Boolean).length
  const hasCompanyName = Boolean(String(companyContext.companyName || '').trim())
  const hasCompanyAnchor = hasCompanyName && includesAnyKeyword(interpretation, companyIdentifiers)
  const hasPostingAnchor = postingKeywords.length > 0 && includesAnyKeyword(interpretation, postingKeywords)

  if (companyEvidence.length > 0) {
    if (score < 2) return null
    return {
      mode: 'rich',
      title: '회사 맥락이 이 직무 판단에 주는 단서',
      bridge: '아래 회사 정보와 공고에 보인 직무 신호를 함께 해석한 참고 근거입니다.',
      interpretation,
      companyEvidence,
      postingEvidence,
      questions: Array.isArray(companyContext.mustAskQuestions) ? companyContext.mustAskQuestions.slice(0, 3) : [],
    }
  }

  if (!hasCompanyAnchor || !hasPostingAnchor) return null

  return {
    mode: 'light',
    title: '공고 안에서 보이는 회사 맥락 참고',
    bridge: '외부 회사 정보 없이, 공고 안에서 반복된 회사 표현만 바탕으로 정리한 참고 내용입니다.',
    interpretation,
    companyEvidence: [],
    postingEvidence,
    questions: Array.isArray(companyContext.mustAskQuestions) ? companyContext.mustAskQuestions.slice(0, 2) : [],
  }
}
