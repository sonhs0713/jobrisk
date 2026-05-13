/**
 * 직무군 분류 + 물경력 5축 + 무료/유료 전용 페이로드 (내부 규칙)
 * docs/퍼플렉시티 직무별 물경력 기준 12대분류 정렬
 */

const JOB_FAMILIES = [
  {
    id: 'dev_infra',
    label: '개발·인프라',
    keys: [
      '개발자',
      '소프트웨어',
      '백엔드',
      '프론트',
      '풀스택',
      '서버',
      'DevOps',
      'SRE',
      '데이터 엔지니어',
      'DBA',
      'QA',
      '테스트',
      'iOS',
      '안드로이드',
      '앱 개발',
      '플랫폼',
      '인프라',
      'Kubernetes',
      'AWS',
      'MSA',
      'API',
      '장애',
      '성능',
      '아키텍처',
    ],
  },
  {
    id: 'product_planning',
    label: '프로덕트·기획',
    keys: ['PM', 'PO', '프로덕트', '서비스 기획', '사업개발', '기획자', '전략', '로드맵', '요구사항', '우선순위'],
  },
  {
    id: 'marketing_brand',
    label: '마케팅·브랜딩',
    keys: ['마케팅', '그로스', '퍼포먼스', '브랜드', '캠페인', '퍼널', 'CRM', 'PR', '광고'],
  },
  {
    id: 'design_creative',
    label: '디자인·크리에이티브',
    keys: ['디자이너', 'UX', 'UI', '그래픽', '모션', '영상', '아트', 'BX', 'BI', '캐릭터', '일러스트'],
  },
  {
    id: 'sales_cs',
    label: '영업·세일즈·고객성장',
    keys: ['영업', '세일즈', 'CS', '고객성공', 'CSM', '기술영업', '솔루션', 'AM', 'RM', '제휴'],
  },
  {
    id: 'ops_office',
    label: '운영·오피스·일반관리',
    keys: ['운영', '경영지원', '총무', '사무', '비서', '회계', '경리', '구매', '자금', '오피스', '관리'],
  },
  {
    id: 'manufacturing',
    label: '제조·품질·엔지니어링',
    keys: ['생산', '공정', '품질', '제조', '설비', '안전', 'CAD', '기계', '전기', '품질관리'],
  },
  {
    id: 'finance_legal',
    label: '금융·회계·리스크',
    keys: ['재무', '회계', '세무', 'IR', '투자', '증권', '내부통제', '준법', '리스크', 'FP&A', '애널리스트'],
  },
  {
    id: 'hr_edu',
    label: 'HR·교육·조직',
    keys: ['인사', 'HR', '채용', '리크루터', 'HRBP', '교육', '강사', '노무', '평가', '보상', '조직'],
  },
  {
    id: 'data_research',
    label: '데이터·분석·연구',
    keys: ['데이터 분석', '데이터 사이언스', 'BI', '리서치', '연구원', '실험 설계', '모델', '지표'],
  },
  {
    id: 'medical_health',
    label: '의료·바이오·헬스케어',
    keys: ['간호', '약사', '의사', '임상', '병원', '헬스', '바이오', '의료', '요양', '치료'],
  },
  {
    id: 'public_security',
    label: '공공·법무·안전·보안',
    keys: ['법무', '변호사', '보안', '정보보호', '공무원', '소방', '경찰', '컴플라이언스', '감사', '허가'],
  },
]

const OPS_REPEAT = /(운영|지원|조율|서포트|응대|정산|업로드|게시|단순|반복|일일|루틴)/
const OWNERSHIP = /(오너십|ownership|문제\s*정의|우선순위|로드맵|실험|A\/B|KPI|OKR|성과\s*책임|개선|설계|리드|주도|아키텍처|장애|성능|품질\s*개선)/i
const DEV_VALUE = /(장애|성능|아키텍처|배포|모니터링|SRE|온콜|슬로우|쿼리|트래픽|확장|보안\s*패치)/

function joinedText(lines) {
  return Array.isArray(lines) ? lines.join('\n') : ''
}

export function classifyJobFamily(lines) {
  const text = joinedText(lines)
  let best = { id: 'other', label: '기타', score: 0 }
  for (const fam of JOB_FAMILIES) {
    let score = 0
    for (const k of fam.keys) {
      if (text.includes(k)) score += 1
    }
    if (score > best.score) {
      best = { id: fam.id, label: fam.label, score }
    }
  }
  if (best.score < 2) {
    return { id: 'other', label: '기타', score: best.score }
  }
  return { id: best.id, label: best.label, score: best.score }
}

function axisLevelFromConcern(concern, parseLow) {
  if (parseLow) return 'needs_review'
  if (concern >= 2.5) return 'high'
  if (concern >= 1.2) return 'medium'
  if (concern > 0) return 'low'
  return 'needs_review'
}

export function computeFiveAxes({ lines, extraction, jobFamily }) {
  const text = joinedText(lines)
  const parseLow = extraction?.parseMeta?.parseConfidence < 0.45 || extraction?.parseMeta?.sectionDetectionFailed

  const opsMatches = text.match(new RegExp(OPS_REPEAT, 'g')) || []
  const opsHits = opsMatches.length
  const ownershipBoost = OWNERSHIP.test(text)
  const roleBullets = typeof extraction?.roleBullets === 'number' ? extraction.roleBullets : 0
  const boundary = extraction?.roleBoundaryMentioned

  let repConcern = Math.min(4, opsHits * 0.85 + (roleBullets >= 12 ? 1.2 : 0))
  if (jobFamily.id === 'dev_infra' && DEV_VALUE.test(text)) {
    repConcern = Math.max(0, repConcern - 1.8)
  }
  if (jobFamily.id === 'marketing_brand' || jobFamily.id === 'design_creative') {
    if (/업로드|게시|응대|정산|콘솔/.test(text)) repConcern += 1.2
  }

  let respConcern = 0
  if (!boundary && roleBullets >= 10) respConcern += 2.2
  else if (!boundary) respConcern += 1.4
  if (text.includes('우선순위') || text.includes('경계') || text.includes('하지 않을')) respConcern -= 1.2

  const measConcern = extraction?.kpiMentioned ? 0.3 : 2.2

  let diffConcern = 1.0
  if (ownershipBoost) diffConcern -= 1.3
  if (roleBullets >= 14) diffConcern += 0.4

  let transConcern = 1.1
  if (ownershipBoost) transConcern -= 1.4
  if (opsHits >= 4) transConcern += 1.0

  const mk = (key, label, concern, summaries) => {
    const level = axisLevelFromConcern(concern, parseLow)
    return {
      key,
      label,
      level,
      levelLabel: axisLabelKo(level),
      summary: summaries[level] || summaries.needs_review,
    }
  }

  return [
    mk('repetition', '반복·운영 업무 비중', repConcern, {
      high: '반복·운영·지원성 표현이 여러 번 보여요.',
      medium: '운영·지원성 업무가 일부 보여요.',
      low: '반복 업무 비중은 공고만으로는 크지 않아 보여요.',
      needs_review: '반복 업무 비중은 공고만으로 확정하기 어려워요.',
    }),
    mk('responsibility', '책임 범위', respConcern, {
      high: '책임 범위가 넓게 읽힐 여지가 있어요.',
      medium: '역할 경계가 완전히 드러나지는 않아요.',
      low: '역할 경계·우선순위 단서가 일부 있어요.',
      needs_review: '책임 범위는 면접에서 우선순위와 함께 확인하는 게 좋아요.',
    }),
    mk('measurable', '성과 측정 가능성', measConcern, {
      high: '성과 지표가 드러나지 않아 추가 확인이 필요해요.',
      medium: '성과 표현은 있으나 운영 방식은 추가 확인이 필요해요.',
      low: 'KPI·성과 관련 표현이 있어요.',
      needs_review: '평가·지표 운영은 추가 확인이 필요해요.',
    }),
    mk('difficulty', '난이도·책임 상승 여부', diffConcern, {
      high: '난이도 상승·성장 단서가 약해 보여요.',
      medium: '성장·난이도 단서가 섞여 있어요.',
      low: '기획·개선·지표 등 성장 단서가 보여요.',
      needs_review: '난이도는 실제 목표 설정 방식을 확인해야 해요.',
    }),
    mk('transferable', '전이 가능한 역량 축적', transConcern, {
      high: '전이 가능한 역량이 쌓일지는 추가 확인이 필요해요.',
      medium: '역량 축적은 일부 단서만 보여요.',
      low: '판단·개선·지표 등 전이 가능한 역량 단서가 있어요.',
      needs_review: '이직 시 설명 가능한 역량은 면접에서 구체적으로 확인하는 게 좋아요.',
    }),
  ]
}

/** 직무군별 물경력(물경력 태그) 레벨 보정 — 보수적으로 */
export function applyJobFamilyToWaterMatch(waterMatch, jobFamily, lines) {
  if (!waterMatch || String(waterMatch.tag) !== '물경력') return waterMatch
  const text = joinedText(lines)
  const level = String(waterMatch.level || 'needs_review')
  let next = { ...waterMatch }

  if (jobFamily.id === 'dev_infra') {
    if (DEV_VALUE.test(text) && (level === 'high' || level === 'medium')) {
      next = { ...next, level: 'needs_review', reason: `${next.reason} (개발·인프라 직군에서는 운영·장애·성능 경험이 경력 가치로 이어질 수 있어요. 공고 문장만으로는 단정하지 않았어요.)` }
    }
  }
  if (jobFamily.id === 'marketing_brand' || jobFamily.id === 'design_creative') {
    if (/업로드|게시|응대|정산/.test(text) && level === 'medium') {
      next = { ...next, level: 'high' }
    }
  }
  return next
}

function pickWaterHeadline(waterLevel, parseLow) {
  if (parseLow) return { headline: '추가 확인이 필요해요', detail: '공고 형식이 일정하지 않아, 물경력 가능성을 단정하지 않고 확인 질문을 우선할게요.' }
  if (waterLevel === 'high') return { headline: '높아 보여요', detail: '공고 문장 기준으로 물경력으로 흐를 수 있는 신호가 상대적으로 뚜렷해 보여요. 면접에서 역할과 성과 책임을 꼭 확인하세요.' }
  if (waterLevel === 'medium') return { headline: '추가 확인이 필요해요', detail: '일부 신호는 있지만, 직무군 맥락상 해석이 갈릴 수 있어요. 핵심 산출물과 책임 범위를 확인하는 게 안전해요.' }
  if (waterLevel === 'low') return { headline: '낮아 보여요', detail: '현재 공고만으로는 물경력 신호가 크지 않아 보여요. 그래도 입사 후 역할은 면접에서 한 번 더 확인하세요.' }
  return { headline: '추가 확인이 필요해요', detail: '근거가 부족해 단정하지 않았어요. 아래 질문으로 우선 확인해보세요.' }
}

function firstQuoteFromMatch(waterMatch, fallbackLines) {
  const ev = Array.isArray(waterMatch?.evidence) ? waterMatch.evidence : []
  const q = ev.find((e) => e && typeof e.text === 'string' && e.text.trim())
  if (q) return String(q.text).trim().slice(0, 280)
  const line = (fallbackLines || []).find((l) => OPS_REPEAT.test(l) || OWNERSHIP.test(l))
  return line ? String(line).trim().slice(0, 280) : ''
}

export function buildFreePreviewPayload({ extraction, jobFamily, avoidConditionMatches, fiveAxes }) {
  const waterIdx = avoidConditionMatches.findIndex((m) => String(m?.tag) === '물경력')
  const waterMatch = waterIdx >= 0 ? avoidConditionMatches[waterIdx] : null
  const parseLow = extraction?.parseMeta?.parseConfidence < 0.45 || extraction?.parseMeta?.sectionDetectionFailed
  const waterLevel = waterMatch ? String(waterMatch.level || 'needs_review') : 'needs_review'

  const { headline, detail } = pickWaterHeadline(waterLevel, parseLow)
  const quote = firstQuoteFromMatch(waterMatch, extraction?.evidenceLines || extraction?.lines || [])
  const interpretation = quote
    ? '이 문장은 업무 성격(운영·지원·반복 vs 기획·성과 책임)을 가늠하는 단서로 썼어요.'
    : '직접 인용할 만한 한 줄이 부족해, 직무군·5축 기준으로만 정리했어요.'

  const reasonPool = fiveAxes
    .filter((a) => a.level === 'high' || a.level === 'medium' || a.level === 'needs_review')
    .map((a) => `${a.label}: ${a.summary}`)
  const shortReasons = reasonPool.slice(0, 3)
  while (shortReasons.length < 2) {
    shortReasons.push('공고만으로는 역할의 핵심 산출물이 충분히 드러나지 않아요.')
  }

  const verificationQuestion =
    jobFamily.id === 'dev_infra'
      ? '이 역할에서 장애·성능·설계 중 무엇을 “직접 소유”하나요? 운영 업무 비중은 대략 어느 정도인가요?'
      : jobFamily.id === 'marketing_brand' || jobFamily.id === 'design_creative'
        ? '캠페인/콘텐츠에서 전략·실험·지표 개선 중 무엇을 직접 결정하나요, 집행 비중은 어느 정도인가요?'
        : '입사 후 3개월 안에 만들어야 하는 핵심 산출물과, 그 성과를 어떻게 평가하나요?'

  return {
    headline,
    headlineDetail: detail,
    jobFamilyLabel: jobFamily.label,
    jobFamilyId: jobFamily.id,
    topEvidence: { quote, interpretation },
    shortReasons: shortReasons.slice(0, 3),
    verificationQuestion,
  }
}

const PAID_QUESTIONS = [
  {
    question: '이 포지션의 핵심 산출물(3개월 기준)은 무엇이고, 성공 여부는 무엇으로 측정하나요?',
    good: '산출물과 지표가 구체적으로 말해짐',
    risky: '산출물이 모호하거나 평가 주체·주기가 불명확',
  },
  {
    question: '운영·지원·반복 업무의 비중은 대략 어느 정도이며, 줄이기 위한 구조가 있나요?',
    good: '비중과 우선순위 조정 방식이 설명됨',
    risky: '“전반 지원/기타” 중심이고 경계가 없음',
  },
  {
    question: '우선순위는 누가 정하고, “하지 않을 일”은 무엇인가요?',
    good: '결정권과 범위가 명확',
    risky: '범위가 계속 확장될 수 있는 구조',
  },
  {
    question: '평가·피드백은 어떤 주기로, 누가 어떤 기준으로 하나요?',
    good: '기준과 주기가 합리적으로 설명됨',
    risky: '기준 없이 분위기/투입 시간으로만 평가',
  },
  {
    question: '팀 내 기술·도메인 결정에 참여할 수 있는 범위는 어디까지인가요?',
    good: '의사결정 참여 경로가 있음',
    risky: '실행만 요구되고 판단 참여가 제한적',
  },
  {
    question: '이 포지션에서 만드는 산출물·데이터는 대외적으로 설명하거나 포트폴리오로 남길 수 있는 범위가 어떻게 되나요?',
    good: '허용 범위와 비식별화 방식이 현실적으로 설명됨',
    risky: '모든 산출물이 내부 전용이라 전이 가능한 경력으로 설명하기 어려움',
  },
  {
    question: '이전 팀에서 비슷한 역할의 사람은 보통 어떤 커리어 경로로 갔나요?',
    good: '성장 사례가 설득력 있게 설명됨',
    risky: '회전이 잦거나 경로가 불분명',
  },
]

export function buildPaidDetailPayload({
  jobFamily,
  fiveAxes,
  supportDecision,
  avoidConditionMatches,
  keyEvidence,
  interviewQuestions,
}) {
  const water = avoidConditionMatches.find((m) => String(m?.tag) === '물경력')
  const evidenceList = []
  const fromWater = Array.isArray(water?.evidence) ? water.evidence : []
  for (const e of fromWater) {
    if (e?.text) evidenceList.push({ quote: String(e.text).trim(), note: '물경력 신호와 직접 연결된 공고 문장' })
  }
  const fromKey = Array.isArray(keyEvidence) ? keyEvidence : []
  for (const e of fromKey) {
    if (e?.text) evidenceList.push({ quote: String(e.text).trim(), note: String(e.why || '').trim() || '확인 포인트' })
  }
  const unique = []
  const seen = new Set()
  for (const it of evidenceList) {
    if (!it.quote || seen.has(it.quote)) continue
    seen.add(it.quote)
    unique.push(it)
    if (unique.length >= 5) break
  }

  const mergedInterview = PAID_QUESTIONS.slice(0, 7).map((q) => ({
    question: q.question,
    ifGood: q.good,
    ifRisky: q.risky,
    whyThisMatters: '지원 전에 물경력 가능성을 가늠하기 위한 확인 질문이에요.',
  }))

  return {
    finalSummary: supportDecision?.summary
      ? String(supportDecision.summary)
      : '공고 기준으로 물경력 가능성을 점검했고, 세부는 면접에서 확인하는 편이 안전해요.',
    jobFamilyLabel: jobFamily.label,
    jobFamilyId: jobFamily.id,
    fiveAxes,
    keyEvidence: unique.slice(0, 5),
    interviewQuestions: mergedInterview.slice(0, 7),
    actionGuide:
      '결론을 서두르지 말고, 위 질문에 대한 답을 바탕으로 “핵심 산출물·성과 책임·역할 경계”를 확인한 뒤 지원 여부를 정리해보세요.',
  }
}
