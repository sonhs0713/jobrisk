export const surfaceRules = {
  landing: {
    label: 'landing',
    priorityPrinciples: ['authority', 'reciprocity', 'consistency', 'liking'],
  },
  preview: {
    label: 'preview',
    priorityPrinciples: ['reciprocity', 'authority', 'consistency'],
  },
  checkout: {
    label: 'checkout',
    priorityPrinciples: ['consistency', 'authority', 'liking'],
  },
  report: {
    label: 'report',
    priorityPrinciples: ['authority', 'consistency'],
  },
}

export const principleRules = {
  authority: {
    allowed: true,
    allowedIn: ['landing', 'preview', 'checkout', 'report'],
    guidance: '근거 인용, 판단 기준, 왜 중요한지 설명에만 사용합니다.',
  },
  reciprocity: {
    allowed: true,
    allowedIn: ['landing', 'preview'],
    guidance: '무료 단계에서 실제 도움이 되는 질문과 근거를 먼저 제공합니다.',
  },
  consistency: {
    allowed: true,
    allowedIn: ['landing', 'preview', 'checkout', 'report'],
    guidance: '랜딩의 약속과 실제 결과 내용이 어긋나지 않게 유지합니다.',
  },
  liking: {
    allowed: true,
    allowedIn: ['landing', 'preview', 'checkout'],
    guidance: '쉬운 문장과 부담 없는 톤을 유지합니다.',
  },
  socialProof: {
    allowed: false,
    allowedIn: [],
    guidance: '실제 검증 데이터가 없으므로 이번 단계에서는 금지합니다.',
  },
}

export const claimStrengthRules = {
  strict_evidence: {
    requiresEvidence: true,
    description: '공고 직접 인용이나 구조화된 근거가 있을 때만 허용되는 강한 표현입니다.',
  },
  soft_inference: {
    requiresEvidence: false,
    description: '단정하지 않고 추가 확인을 권하는 표현입니다.',
  },
  blocked: {
    requiresEvidence: false,
    description: '불안, 압박, 근거 없는 사회적 증거를 유도하는 표현입니다.',
  },
}

export const bannedPhrases = [
  '반드시',
  '확실히',
  '무조건 지원',
  '지금 결제',
  '놓치면 손해',
  '손해를 피할 수',
  '많은 사용자',
  '많은 지원자',
  '이미 확인하고 있습니다',
  '검증된 서비스',
  '지금 안 보면',
]

const evidenceCuePatterns = [/공고에/, /명시/, /직접 인용/, /근거/, /문장/, /표현/, /기준/, /5축/]
const pressurePatterns = [/손해/, /지금\s*결제/, /놓치면/, /서둘러/, /늦기 전에/]
const socialProofPatterns = [/많은\s*(사용자|지원자)/, /이미\s*확인/, /검증된\s*서비스/, /후기/, /만족도/]

export const allowedTemplates = {
  landing: {
    heroTitle: '입사 후 후회할 일을, 면접 전에 먼저 확인하세요',
    heroBody: '잡리스크는 채용공고 속 애매한 표현을 분석해 면접에서 꼭 확인해야 할 질문으로 바꿔드립니다.',
    primaryCta: '무료로 위험 신호 확인하기',
    secondaryCta: '예시 결과 보기',
  },
  preview: {
    sectionTitle: '무료와 유료에서 확인되는 차이',
    freeItems: ['핵심 위험 신호 1개', '짧은 확인 포인트 1개', '면접 질문 방향 1개'],
    paidItems: ['7가지 기준 전체 판단', '공고 직접 인용 근거', '면접 질문 5개 이상', '답변 해석 기준', '최종 행동 가이드'],
  },
  checkout: {
    title: '결제 전에 받게 될 내용을 먼저 확인하세요',
    body: '유료에서는 아래 내용을 더 자세히 정리해 드립니다.',
    items: ['7가지 기준 점검', '공고 직접 인용 근거', '면접 질문 3개 이상', '행동 가이드'],
  },
}

export function validatePersuasionCopy(text, context = {}) {
  const normalizedText = String(text || '').trim()
  const surface = context.surface || 'preview'
  const claimStrength = context.claimStrength || 'soft_inference'
  const hasEvidence = Boolean(context.hasEvidence)
  const violations = []

  if (!normalizedText) {
    return { ok: true, normalizedText, surface, claimStrength, violations }
  }

  for (const phrase of bannedPhrases) {
    if (normalizedText.includes(phrase)) {
      violations.push({ type: 'banned_phrase', phrase })
    }
  }

  if (pressurePatterns.some((pattern) => pattern.test(normalizedText))) {
    violations.push({ type: 'pressure_language' })
  }

  if (socialProofPatterns.some((pattern) => pattern.test(normalizedText))) {
    violations.push({ type: 'social_proof_blocked' })
  }

  if (claimStrength === 'strict_evidence' && !hasEvidence) {
    violations.push({ type: 'missing_evidence_for_strong_claim' })
  }

  if (claimStrength === 'strict_evidence' && !evidenceCuePatterns.some((pattern) => pattern.test(normalizedText))) {
    violations.push({ type: 'strong_claim_without_evidence_cue' })
  }

  if (surface === 'checkout' && pressurePatterns.some((pattern) => pattern.test(normalizedText))) {
    violations.push({ type: 'checkout_pressure_blocked' })
  }

  return { ok: violations.length === 0, normalizedText, surface, claimStrength, violations }
}
