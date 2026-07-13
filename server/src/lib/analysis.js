import { CRITERIA_SOURCES, CRITERIA_VERSION, JOB_RISK_CRITERIA } from './jobRiskCriteria.js'
import { buildCompanyContext, createEmptyCompanyContext } from './companyContext.js'

import { allowedTemplates, validatePersuasionCopy } from '../../../shared/persuasionPolicy.js'

function positiveIntegerEnv(...names) {
  for (const name of names) {
    const value = Number(process.env[name])
    if (Number.isInteger(value) && value > 0) return value
  }
  return null
}

export const PREVIEW_MODEL = process.env.OPENAI_PREVIEW_MODEL || 'gpt-5-mini'
export const DETAIL_MODEL = process.env.OPENAI_DETAIL_MODEL || 'gpt-5.2'
export const DETAIL_SCHEMA_VERSION = 'jobrisk-detail-v2'
export const PREVIEW_LLM_ENABLED =
  String(process.env.JOBRISK_ENABLE_PREVIEW_LLM || '').toLowerCase().trim() === 'true'
export const DETAIL_MAX_OUTPUT_TOKENS = positiveIntegerEnv('OPENAI_DETAIL_MAX_OUTPUT_TOKENS', 'JOBRISK_DETAIL_MAX_OUTPUT_TOKENS') || 5000

const DETAIL_AXIS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['key', 'label', 'level', 'levelLabel', 'summary', 'evidence'],
  properties: {
    key: { type: 'string' },
    label: { type: 'string' },
    level: { type: 'string' },
    levelLabel: { type: 'string' },
    summary: { type: 'string' },
    evidence: {
      type: 'object',
      additionalProperties: false,
      required: ['quote', 'sourceType'],
      properties: {
        quote: { type: 'string' },
        sourceType: { type: 'string' },
      },
    },
  },
}

const DETAIL_AUXILIARY_CHECK_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['key', 'label', 'level', 'levelLabel', 'summary', 'evidence', 'question', 'goodAnswerSignal', 'riskyAnswerSignal'],
  properties: {
    key: { type: 'string' },
    label: { type: 'string' },
    level: { type: 'string' },
    levelLabel: { type: 'string' },
    summary: { type: 'string' },
    evidence: {
      type: 'object',
      additionalProperties: false,
      required: ['quote', 'sourceType'],
      properties: {
        quote: { type: 'string' },
        sourceType: { type: 'string' },
      },
    },
    question: { type: 'string' },
    goodAnswerSignal: { type: 'string' },
    riskyAnswerSignal: { type: 'string' },
  },
}

export const PREVIEW_RESPONSE_FORMAT = {
  type: 'json_schema',
  name: 'jobrisk_preview',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['freePreview'],
    properties: {
      freePreview: {
        type: 'object',
        additionalProperties: false,
        required: ['riskLevel', 'riskLevelLabel', 'headline', 'topEvidence', 'shortReasons', 'verificationQuestion', 'structuredSummary'],
        properties: {
          riskLevel: { type: 'string' },
          riskLevelLabel: { type: 'string' },
          headline: { type: 'string' },
          topEvidence: {
            type: 'object',
            additionalProperties: false,
            required: ['quote', 'interpretation'],
            properties: {
              quote: { type: 'string' },
              interpretation: { type: 'string' },
            },
          },
          shortReasons: { type: 'array', items: { type: 'string' } },
          verificationQuestion: { type: 'string' },
          structuredSummary: {
            type: 'object',
            additionalProperties: false,
            required: ['jobTitle', 'sectionsFound'],
            properties: {
              jobTitle: { type: 'string' },
              sectionsFound: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
    },
  },
}

export const DETAIL_RESPONSE_FORMAT = {
  type: 'json_schema',
  name: 'jobrisk_detail_report',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['finalSummary', 'keyEvidence', 'interviewQuestions', 'actionGuide'],
    properties: {
      finalSummary: { type: 'string' },
      keyEvidence: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['quote', 'interpretation', 'whyImportant'],
          properties: {
            quote: { type: 'string' },
            interpretation: { type: 'string' },
            whyImportant: { type: 'string' },
          },
        },
      },
      interviewQuestions: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['question', 'goodAnswerSignal', 'riskyAnswerSignal', 'category', 'whyAsk'],
          properties: {
            question: { type: 'string' },
            goodAnswerSignal: { type: 'string' },
            riskyAnswerSignal: { type: 'string' },
            category: { type: 'string' },
            whyAsk: { type: 'string' },
            answerDecisionHint: { type: 'string' },
          },
        },
      },
      actionGuide: { type: 'string' },
    },
  },
}

const JOB_FAMILIES = JOB_RISK_CRITERIA.map(({ id, label, keywords }) => ({ id, label, keywords }))
const ALLOWED_SECTIONS = new Set(['responsibilities', 'requirements', 'preferred'])
const BLOCKED_PATTERNS = [/지원자.*추천인.*현금/i, /합격보상/i, /추천금/i, /처우 협의/i, /최종 합격/i, /복지|혜택/i, /상시채용/i, /마감일/i]
const TITLE_NOISE_PATTERNS = [
  /^회원가입$/i,
  /^company logo$/i,
  /^(원티드 픽|응답률|평균이상|높음|합격보상|포지션 상세|직무 summary|회사 소개|기타사항|채용절차|채용 전형|전형|태그|마감일|근무지역|상시채용)$/i,
  /^(복지포인트|식대 지원|경조금|건강검진지원|의료비지원|자기계발지원|장비지원|보너스|무제한연차)$/i,
  /^[0-9]+-[0-9]+명$/,
  /^누적 투자/,
]
const EVIDENCE_NOISE_PATTERNS = [
  /원티드 픽|응답률|합격보상|추천인 각 현금|지원자, 추천인 각 현금/i,
  /본 채용정보는 원티드랩의 동의없이|포지션에 맞는 이력서|합격은 확률이다/i,
  /건강검진지원|커피·?스낵바|식대지원|장비지원|연봉상위|인원 급성장|복지포인트|사내동호회|보너스|누적투자|유망산업/i,
  /팔로우|지원하기|이 포지션을 찾고 계셨나요\?|상세 정보 더 보기/i,
]
const REPRESENTATIVE_EVIDENCE_NOISE_PATTERNS = [
  ...EVIDENCE_NOISE_PATTERNS,
  /재택근무|유연근무|근무시간 배려제|육아와 일의 균형|반려동물을 키우는 직원/i,
  /도서 구매비 지원|우수 사원 포상|명절 선물|자유로운 휴가 문화|기타 복지 제도 운영/i,
]
const SECTION_WEIGHTS = {
  responsibilities: 1.0,
  requirements: 0.7,
  preferred: 0.6,
}
const SECTION_SOURCE_PRIORITIES = {
  responsibilities: 5,
  requirements: 4,
  preferred: 3,
}

const AXES = [
  {
    key: 'repetition',
    label: '반복 일이 많은가',
    risky: ['반복', '운영', '업로드', '요청 처리', '모니터링', '관리', '기술지원', '헬프데스크', '유지보수'],
    positive: ['개선', '기획', '실험', '전략', '문제 정의'],
  },
  {
    key: 'responsibility',
    label: '내가 주도할 수 있나',
    risky: ['보조', '지원', '단순', '기타 업무', '팀원', '요청사항 반영'],
    positive: ['책임 범위', '책임지고', '책임집니다', '성과 책임', '오너십', '리딩', '의사결정', '주도', '설계', '구현', 'A to Z', '목표 수립'],
  },
  {
    key: 'measurable',
    label: '성과를 보여줄 수 있나',
    risky: ['정성', '지원 업무', '기타'],
    positive: ['KPI', 'OKR', '지표', '데이터', '결과 보고', '전환율', '매출', '리텐션'],
  },
  {
    key: 'difficulty',
    label: '더 큰 일로 이어지나',
    risky: ['단순', '반복', '정기'],
    positive: ['고도화', '신규', '복잡', '리딩', '전략', '개선'],
  },
  {
    key: 'transferable',
    label: '이직할 때 남는 경험인가',
    risky: ['내부 전용', '단순 처리', '보조'],
    positive: ['기획', '분석', '전략', '데이터', '실험', '보고', '문서화'],
  },
]

const SEVEN_AXES = [
  ...AXES,
  {
    key: 'scopeClarity',
    label: '무슨 일을 맡는지 분명한가',
    risky: ['업무 전반', '전반 업무', '전반적인', '기타 업무', '다양한 업무', '필요 시', '필요에 따라', '유관 업무', '운영 전반', '지원 전반', '보안사항', '인터뷰시 안내', '면접시 안내', '직책', '팀원'],
    positive: ['역할 범위', '담당 범위', '책임 범위', '담당 제품', '담당 영역', '주요 산출물', 'R&R', '오너십', '명확', '전담', 'Owner'],
  },
  {
    key: 'learningFeedback',
    label: '배우고 나아질 수 있나',
    risky: ['처리', '응대', '등록', '검수', '정산', '반복', '요청사항 반영'],
    positive: ['회고', '피드백', '성과 리뷰', '데이터 기반', '실험', 'A/B', '개선안', '원인 분석', '재발 방지'],
  },
]

const FIVE_AXIS_KEYS = new Set(AXES.map((axis) => axis.key))

const AUXILIARY_CHECKS = [
  {
    key: 'applicationSafety',
    label: '경력서 제출 전 안전성',
    patterns: [],
    summaryWithEvidence: '경력서 제출 전에 법인명, 담당자, 회사 이메일, 계약 주체를 먼저 확인해야 합니다.',
    summaryWithoutEvidence: '공고만으로는 경력서 제출 전 안전성 경고가 뚜렷하지 않습니다.',
    question: '계약 주체 회사의 정식 법인명, 사업자등록번호, 담당자 실명과 회사 이메일을 확인할 수 있나요?',
    goodAnswerSignal: '법인명, 사업자등록번호, 담당자 실명, 회사 이메일, 계약서 초안을 바로 확인해 줍니다.',
    riskyAnswerSignal: '개인 이메일 제출만 안내하거나 계약 주체를 끝까지 흐립니다.',
  },
  {
    key: 'contractConsistency',
    label: '계약 구조 일치 여부',
    patterns: [],
    summaryWithEvidence: '파견/프리랜스/도급/근로계약 표현이 충돌하지 않는지 먼저 확인해야 합니다.',
    summaryWithoutEvidence: '공고만으로는 계약 구조 충돌 신호가 뚜렷하지 않습니다.',
    question: '파견인지 프리랜스인지, 4대보험·퇴직금·연차 적용과 실제 소속이 어떻게 되는지 확인할 수 있나요?',
    goodAnswerSignal: '근로계약인지 도급계약인지, 실제 소속과 지휘 체계를 문서 기준으로 설명합니다.',
    riskyAnswerSignal: '파견과 프리랜스를 섞어 말하거나 4대보험, 퇴직금, 소속을 모호하게 답합니다.',
  },
  {
    key: 'employmentForm',
    label: '고용 형태',
    patterns: ['계약직', '파견', '외주', '프리랜서', '인턴', '전환형', '정규직 전환', '프로젝트 계약', '근로계약서'],
    summaryWithEvidence: '고용 형태가 공고에 언급되어 계약 조건을 별도로 확인해야 합니다.',
    summaryWithoutEvidence: '공고만으로는 고용 형태상 추가 위험 신호가 뚜렷하지 않습니다.',
    question: '이 포지션의 정확한 고용 형태와 전환·연장 기준은 무엇인가요?',
    goodAnswerSignal: '고용 형태, 계약 기간, 전환 또는 연장 기준을 명확히 설명합니다.',
    riskyAnswerSignal: '계약 조건이나 전환 기준을 모호하게 설명합니다.',
  },
  {
    key: 'orgPosition',
    label: '조직 내 포지션',
    patterns: ['1인 팀', '1인 조직', '단독 담당', '신설', '어시스턴트', '주니어', '리드', '팀장', '보고 라인', '소속 조직', '상주'],
    summaryWithEvidence: '조직 내 위치나 보고 구조를 면접에서 확인할 필요가 있습니다.',
    summaryWithoutEvidence: '공고만으로는 조직 내 포지션 관련 단정 근거가 부족합니다.',
    question: '이 역할의 소속 조직, 보고 라인, 의사결정 참여 범위는 어디까지인가요?',
    goodAnswerSignal: '소속 팀, 협업 구조, 결정권자, 본인 책임 범위를 구체적으로 설명합니다.',
    riskyAnswerSignal: '여러 조직 요청을 처리하지만 본인 권한과 책임 경계가 흐립니다.',
  },
  {
    key: 'processMaturity',
    label: '기술·프로세스 낙후도',
    patterns: ['수기', '엑셀', '어드민', '레거시', '내부 시스템', '자동화 없음', '반복 입력', '툴 도입'],
    summaryWithEvidence: '사용 도구나 프로세스가 경력 자산으로 이어지는지 확인해야 합니다.',
    summaryWithoutEvidence: '공고만으로는 도구나 프로세스 수준을 단정하기 어렵습니다.',
    question: '반복 업무를 줄이기 위한 도구, 자동화, 데이터 분석 프로세스가 있나요?',
    goodAnswerSignal: '사용 도구, 자동화 범위, 데이터 기반 개선 사례를 구체적으로 설명합니다.',
    riskyAnswerSignal: '수기 처리나 내부 시스템 입력 중심이고 개선 계획이 불명확합니다.',
  },
  {
    key: 'workLocationClarity',
    label: '실제 근무지 명확성',
    patterns: [],
    summaryWithEvidence: '근무지가 여러 곳으로 적혀 있어 실제 출근 위치와 고객사 상주 여부를 먼저 확인해야 합니다.',
    summaryWithoutEvidence: '공고만으로는 근무지 불명확 신호가 뚜렷하지 않습니다.',
    question: '실제 근무지는 어디이며, 고객사 상주인지, 주 근무지가 중간에 바뀔 수 있는지 확인할 수 있나요?',
    goodAnswerSignal: '실제 근무지, 상주 여부, 이동 가능성, 보고 라인을 명확히 설명합니다.',
    riskyAnswerSignal: '상암/마곡 등 후보지만 아직 미정이라고 하거나 고객사 사정에 따라 달라진다고 답합니다.',
  },
  {
    key: 'roleClarity',
    label: '직급·직책·업무 공개 범위',
    patterns: [],
    summaryWithEvidence: '직급과 직책, 실제 역할 레벨, 업무 공개 범위가 서로 맞는지 확인해야 합니다.',
    summaryWithoutEvidence: '공고만으로는 직급·직책 충돌이나 업무 비공개 신호가 뚜렷하지 않습니다.',
    question: '직급과 직책이 왜 이렇게 표기됐는지, 실제 역할 레벨과 공개 가능한 핵심 업무 범위를 설명해 줄 수 있나요?',
    goodAnswerSignal: '직급, 직책, 팀 구조, 공개 가능한 핵심 업무를 일관되게 설명합니다.',
    riskyAnswerSignal: '직급은 높지만 팀원이라거나, 보안상 업무를 면접 전엔 전혀 설명할 수 없다고만 답합니다.',
  },
]

const JOB_FAMILY_AXIS_PROFILES = {
  design: {
    responsibility: {
      risky: ['요청사항 반영', '단순 시안', '반복 제작', '보조'],
      positive: ['주도적으로 진행', '주도', '솔루션 제안', '아이디어 공유', '디자인 방향 제안', 'ownership', '오너십'],
    },
    transferable: {
      risky: ['단순 제작', '반복 생산', '요청 반영만'],
      positive: ['Figma', 'Adobe Creative Suite', 'After Effects', 'Illustrator', 'Photoshop', 'Cinema 4D', '포트폴리오', '비주얼 시스템'],
    },
    learningFeedback: {
      risky: ['요청사항 반영', '반복 제작', '빠른 작업 처리'],
      positive: ['벤치마크', '리서치', '피드백', '솔루션 제안', '아이디어 공유'],
    },
  },
  product: {
    repetition: {
      risky: ['운영 보조', '요청사항 전달', '일정 관리', '보고서 취합', '회의체 운영만'],
      positive: ['퍼널 분석', '사용자 인터뷰', 'a/b 테스트', '실험 설계', '문제 정의', '우선순위 제안', 'prd', '성과 대시보드'],
    },
    responsibility: {
      risky: ['운영 지원', '요청사항 반영', '보고용 정리', '보조'],
      positive: ['문제 정의', '우선순위 제안', '실험 설계 권한', '프로덕트 오너', 'product owner', 'po', '오너십', '로드맵', '의사결정', '주도'],
      sectionScoreAdjustments: {
        responsibilities: 0.4,
        requirements: 0.2,
      },
    },
    measurable: {
      risky: ['정성 지원', '운영 지원', '기타 업무'],
      positive: ['온보딩 완료율', '활성화율', '리텐션', '핵심 기능', '최초 사용률', '전환율', 'a/b 테스트', '성과 대시보드', '지표 추적', 'amplitude', 'ga4', 'metabase', 'sql'],
    },
    difficulty: {
      risky: ['정기 운영', '반복 대응'],
      positive: ['제품 전략', '가설 검증', '실험 설계', '로드맵', '문제 정의', '우선순위 제안', '신규 기능'],
    },
    transferable: {
      risky: ['내부 조율만', '단순 보고', '보조'],
      positive: ['prd', '사용자 인터뷰 리포트', '퍼널 분석 리포트', '실험 설계 문서', '회고 문서', '성과 대시보드', '기능 출시', '데이터 분석'],
    },
    scopeClarity: {
      risky: ['전반 업무', '기타 업무', '필요 시'],
      positive: ['담당 제품', '담당 기능', '3개월 목표', '6개월 목표', '주요 산출물', '스쿼드', '협업 구조', '온보딩', '대시보드', '알림', '리포트 기능'],
    },
    learningFeedback: {
      risky: ['단순 운영', '요청 처리'],
      positive: ['매주 제품 리뷰', '월 1회', '1:1', 'head of product', '분기별 성과 발표', '회고 문서', '실험 결과 공유'],
    },
  },
  development: {
    repetition: {
      risky: ['단순 유지보수', '요청사항 처리', '운영 보조', '반복 수정', '기존 시스템 관리', '고객 요청 처리'],
      positive: ['신규', '설계', '아키텍처', '풀사이클', 'API 설계', '데이터 파이프라인', 'AI 모델 연동', '확장성', '성능 최적화', '리팩토링'],
    },
    responsibility: {
      risky: ['보조', '지원', '단순', '기타 업무'],
      positive: ['주도', '전체 아키텍처', '아키텍처', '설계', '구현', '풀사이클', 'API 설계', '시스템 설계', '권한 관리', '리딩'],
      sectionScoreAdjustments: {
        responsibilities: 0.4,
        position_summary: -0.3,
      },
    },
    measurable: {
      risky: ['정성', '지원 업무', '기타'],
      positive: ['KPI', '지표', '성능 최적화', '확장성', '처리량', '안정성', '결과 보고', '데이터'],
    },
    difficulty: {
      risky: ['단순', '반복', '정기'],
      positive: ['고도화', '복잡한', '실시간', '대용량', '아키텍처', '권한 관리', '데이터 파이프라인', 'AI 모델 연동'],
    },
    transferable: {
      risky: ['내부 전용', '단순 처리', '보조'],
      positive: ['React', 'Vue', 'TypeScript', 'Node.js', 'Python', 'FastAPI', 'Java', 'Spring', 'RESTful API', 'RDBMS', 'NoSQL', 'CI/CD', '클라우드', 'WebGL', 'Three.js'],
    },
  },
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

function linesFrom(text) {
  return normalizeText(text)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function sanitizeTitleCandidate(line) {
  const value = String(line || '').trim()
  if (!value) return ''

  const cutPatterns = [
    /\s+(합격보상|응답률|원티드 픽|포지션 상세|추천인 각 현금|지원자,\s*추천인 각 현금|지원하기)/i,
    /\s+지원자,\s*추천인\s*각\s*현금.*$/i,
    /\s+(글로벌 .*채용합니다|해당 포지션은 .*)/i,
  ]

  let sanitized = value
  for (const pattern of cutPatterns) {
    sanitized = sanitized.replace(pattern, '').trim()
  }

  return sanitized
}

const POSTING_TAIL_CUTOFF_PATTERNS = [
  /본 채용정보는 원티드랩의 동의없이/i,
  /포지션에 맞는 이력서로 다듬어 드려요/i,
  /^지원하기$/i,
  /^이 포지션을 찾고 계셨나요\?$/i,
  /합격은 확률이다! 지금 원티드에서 합격하시렵니까\?/i,
]

function trimPostingTail(text) {
  const normalized = normalizeText(text)
  const lines = normalized.split('\n')
  const cutoffIndex = lines.findIndex((line) => POSTING_TAIL_CUTOFF_PATTERNS.some((pattern) => pattern.test(String(line || '').trim())))
  if (cutoffIndex < 0) return normalized
  return normalizeText(lines.slice(0, cutoffIndex).join('\n'))
}

function splitLineIntoEvidenceSentences(line) {
  const text = String(line || '').trim()
  if (!text) return []

  const normalized = text
    .replace(/\s+/g, ' ')
    .replace(/([.!?])\s+(?=[A-Z가-힣0-9"“‘(])/g, '$1\n')
    .replace(/(니다\.|니다!|니다\?|다\.|다!|다\?)\s+(?=[A-Z가-힣0-9"“‘(])/g, '$1\n')

  return normalized
    .split('\n')
    .map((sentence) => sentence.trim())
    .filter(Boolean)
}

function splitSections(lines) {
  const sections = {
    position_summary: [], responsibilities: [], requirements: [], preferred: [], benefits: [], hiring_process: [],
    tags: [], deadline: [], reward_or_referral: [], location: [], company_info: [], others: [],
  }
  let current = 'others'
  for (const line of lines) {
    if (/^(포지션 상세|포지션|직무 소개|역할 소개)$/i.test(line)) current = 'position_summary'
    else if (/^(주요업무|담당업무|하는 일)$/i.test(line)) current = 'responsibilities'
    else if (/^(자격요건|지원자격|필수요건)$/i.test(line)) current = 'requirements'
    else if (/^(우대사항|우대)$/i.test(line)) current = 'preferred'
    else if (/^(혜택 및 복지|복지|혜택)$/i.test(line)) current = 'benefits'
    else if (/^(채용 전형|전형)$/i.test(line)) current = 'hiring_process'
    else if (/^(태그)$/i.test(line)) current = 'tags'
    else if (/^(마감일|상시채용)$/i.test(line)) current = 'deadline'
    else if (/^(합격보상|추천인|추천금|reward)$/i.test(line)) current = 'reward_or_referral'
    else if (/^(근무지역|location)$/i.test(line)) current = 'location'
    else if (/^(회사정보|회사|기업정보)$/i.test(line)) current = 'company_info'
    sections[current].push(line)
  }
  return sections
}

function hasActionVerb(text) {
  return /(기획|실행|운영|관리|보고|분석|개선|수립|제안|정의|리딩|책임|작성|협업|조율|plan|execute|manage|analyze|report|improve)/i.test(String(text || ''))
}

function hasMeaningfulEvidenceSignal(text) {
  return /(성과|지표|KPI|OKR|매출|전환율|리텐션|A to Z|오너십|권한|책임|전략|개선|실험|문제 정의|API|아키텍처|파이프라인|데이터|문서화|회고|고도화|최적화|설계|구현)/i.test(String(text || ''))
}

function isTitleLikeEvidence(text) {
  const value = String(text || '').trim()
  if (!value) return true
  if (value.length < 18 && !hasActionVerb(value)) return true
  if (value.includes('/') && !hasMeaningfulEvidenceSignal(value)) return true
  if (/^[\w가-힣\s()]+(기획\/운영|기획|운영|마케터|개발자|디자이너|매니저)$/.test(value) && !hasMeaningfulEvidenceSignal(value)) return true
  if (/^[가-힣A-Za-z0-9\s]+∙[가-힣A-Za-z0-9\s]+/.test(value) && !hasMeaningfulEvidenceSignal(value)) return true
  return false
}

function normalizeWord(value) {
  return String(value || '')
    .replace(/[^\p{L}\p{N}]/gu, '')
    .trim()
}

function isWeakCompanyNameCandidate(value) {
  const normalized = normalizeWord(value)
  if (!normalized || normalized.length < 2) return true
  return /^(채용공고|포지션상세|회사소개|회사정보|회사|상세|주요업무|자격요건|우대사항|채용절차|전형)$/.test(normalized)
}

function companyNameTokens(companyName) {
  return String(companyName || '')
    .split(/[\s/()]+/)
    .map(normalizeWord)
    .filter((token) => token.length >= 2)
}

function includesCompanyToken(text, companyName) {
  const normalizedText = normalizeWord(text)
  return companyNameTokens(companyName).some((token) => normalizedText.includes(token))
}

function isEvidenceNoiseLine(text) {
  const value = String(text || '').trim()
  if (!value) return true
  return EVIDENCE_NOISE_PATTERNS.some((pattern) => pattern.test(value))
}

function isRepresentativeEvidenceNoiseLine(text) {
  const value = String(text || '').trim()
  if (!value) return true
  return REPRESENTATIVE_EVIDENCE_NOISE_PATTERNS.some((pattern) => pattern.test(value))
}

function isEvidenceCandidate(text, companyName = '') {
  const value = String(text || '').trim()
  if (!value) return false
  if (isEvidenceNoiseLine(value)) return false
  if (isTitleLikeEvidence(value)) return false
  if (!hasActionVerb(value) && !hasMeaningfulEvidenceSignal(value)) return false
  if (includesCompanyToken(value, companyName) && !hasMeaningfulEvidenceSignal(value.replaceAll(companyName, ''))) return false
  return true
}

function passesSectionGate(item) {
  return ALLOWED_SECTIONS.has(String(item?.section || ''))
}

function getAxisProfile(axis, jobFamilyId = 'unknown') {
  const jobFamilyProfile = JOB_FAMILY_AXIS_PROFILES[jobFamilyId]?.[axis.key] || {}

  return {
    ...axis,
    risky: jobFamilyProfile.risky || axis.risky,
    positive: jobFamilyProfile.positive || axis.positive,
    sectionScoreAdjustments: jobFamilyProfile.sectionScoreAdjustments || {},
  }
}

function passesRelevanceGate(axis, text) {
  const value = String(text || '').toLowerCase()
  const risky = axis.risky.some((k) => value.includes(String(k).toLowerCase()))
  const positive = axis.positive.some((k) => value.includes(String(k).toLowerCase()))
  return risky || positive
}

function passesQualityGate(text, strict = true) {
  if (!text) return false
  if (!strict) return true
  return !isTitleLikeEvidence(text)
}

function collectAllowedEvidence(sectionsNormalized) {
  const items = []
  for (const key of Object.keys(sectionsNormalized || {})) {
    if (!ALLOWED_SECTIONS.has(key)) continue
    let lineIndex = 0
    for (const line of sectionsNormalized[key] || []) {
      if (BLOCKED_PATTERNS.some((pattern) => pattern.test(line)) || isEvidenceNoiseLine(line)) continue
      const sentences = splitLineIntoEvidenceSentences(line)
      let sentenceIndex = 0
      for (const sentence of sentences) {
        if (!isEvidenceCandidate(sentence)) {
          sentenceIndex += 1
          continue
        }
        items.push({
          id: `${key}:${lineIndex}:${sentenceIndex}`,
          section: key,
          text: sentence,
          lineIndex,
          sentenceIndex,
          paragraphKey: `${key}:${lineIndex}`,
          sourcePriority: SECTION_SOURCE_PRIORITIES[key] || 0,
        })
        sentenceIndex += 1
      }
      lineIndex += 1
    }
  }
  return items
}

function collectRawPostingLines(lines = []) {
  return (lines || [])
    .map((line, index) => ({
      id: `raw:${index}`,
      section: 'raw',
      text: String(line || '').trim(),
      lineIndex: index,
      sentenceIndex: 0,
      paragraphKey: `raw:${index}`,
      sourcePriority: 2,
    }))
    .filter((item) => item.text && !BLOCKED_PATTERNS.some((pattern) => pattern.test(item.text)) && !isEvidenceNoiseLine(item.text))
}

function findRawLine(lines, matcher) {
  return (
    (lines || [])
      .map((line) => String(line || '').trim())
      .find((line) => line && matcher(line)) || ''
  )
}

function countDistinctKeywordHits(text, keywords) {
  const value = String(text || '').toLowerCase()
  return keywords.filter((keyword) => value.includes(String(keyword).toLowerCase())).length
}

function hasStrategicHrSignals(text) {
  const keywords = [
    'hrbp',
    'people partner',
    '조직의 문제를 먼저 발견',
    '사람들을 움직이는 드라이버',
    '실행 계획을 수립하여 리드에게 제안',
    'hr 아젠다',
    '리더십 코칭',
    '의사결정 자리에 이해관계자로서 참여',
    '비즈니스 맥락',
    'hr 전략',
  ]
  return countDistinctKeywordHits(text, keywords) >= 3
}

function hasOperationsPlanningSignals(text) {
  const keywords = [
    '풀필먼트',
    'fulfillment',
    '운영기획',
    '프로세스 개선',
    'kpi',
    'sla',
    '데이터 분석',
    'sql',
    '생산성과 효율성',
    '운영팀과의 협업',
  ]
  return countDistinctKeywordHits(text, keywords) >= 4
}

function hasEducationProductPlanningSignals(text) {
  const keywords = [
    '교육상품',
    '고객 니즈',
    '커리큘럼',
    '런칭',
    '매출',
    '전환율',
    '후기 데이터',
    '상품 개선안',
    '상품, ip, 카테고리',
    '상품으로 만듭니다',
    '오프라인 특강',
    '워크숍',
  ]
  return countDistinctKeywordHits(text, keywords) >= 4
}

function hasManufacturingOperationalSignals(text) {
  const keywords = [
    '생산 일정',
    '품질테스트',
    '인증 관리',
    '통관 진행',
    '입고 수량 관리',
    '샘플 관리',
    '발주서 작성',
    '원부자재 수급',
    '납기 관리',
  ]
  return countDistinctKeywordHits(text, keywords) >= 4
}

function hasBroadEducationOperationsSignals(text) {
  const keywords = [
    '강사모집',
    '교육관리',
    '중간,결과보고',
    '결산',
    '홍보 전 과정',
    '교육기획 문서 작성',
  ]
  return countDistinctKeywordHits(text, keywords) >= 4
}

function hasBrandContentStrategySignals(text) {
  const keywords = [
    '브랜드 전략',
    '캠페인 기획',
    '콘텐츠 기획',
    '콘텐츠 전략',
    'seo',
    'geo',
    '성과 분석',
    '전환율',
    '매출',
    '리포트',
    '스토리텔링',
    '파트너십',
  ]
  return countDistinctKeywordHits(text, keywords) >= 4
}

function hasExplicitProcessImprovementOwnership(text) {
  return /(공정 개선|생산 프로세스 개선|품질 개선|불량률 개선).*(직접|주도|책임|리드|오너십)|((직접|주도|책임|리드|오너십).*(공정 개선|생산 프로세스 개선|품질 개선|불량률 개선))/i.test(
    String(text || ''),
  )
}

function isAmbiguousMultiLocationLine(line) {
  const value = String(line || '').trim()
  if (!/(근무지|근무지역|상주)/i.test(value)) return false
  if (!/(\/|또는|혹은)/.test(value)) return false
  const locationKeywordCount = countDistinctKeywordHits(value, ['상암', '마곡', '판교', '강남', '종로', '여의도', 'lg cns', 'lg u+', 'lgu+'])
  return locationKeywordCount >= 2
}

function findInterviewAndWorkLocationPairQuote(lines = []) {
  const interviewQuote = findRawLine(lines, (line) => /면접장소/i.test(line))
  const workQuote = findRawLine(lines, (line) => /근무지/i.test(line))
  if (!interviewQuote || !workQuote) return ''
  return joinEvidenceQuotes(interviewQuote, workQuote)
}

function findWorkArrangementContextQuote(lines = []) {
  return (
    findRawLine(lines, (line) => /(육아와 일의 균형|근무시간 배려제|반려동물을 키우는 직원)/i.test(line)) ||
    findRawLine(lines, (line) => /(재택근무|유연근무|시차출퇴근|주\s*\d일.*재택|하이브리드)/i.test(line))
  )
}

function buildReliabilityGate(structured) {
  const lines = (structured?.lines || []).map((line) => String(line || '').trim()).filter(Boolean)
  const companyName = String(structured?.companyName || '').trim()
  const criticalSignals = []
  const cautionSignals = []

  const addSignal = (target, signal) => {
    if (!signal?.quote) return
    if (target.some((item) => item.key === signal.key)) return
    target.push(signal)
  }

  const ambiguousCompanyQuote =
    findRawLine(lines, (line) => /(회사명|기업명|계약 주체|법인명)/i.test(line) && /\?{2,}|㈜\?\?|주식회사\?\?/i.test(line)) ||
    (/\?{2,}/.test(companyName) ? companyName : '')
  if (ambiguousCompanyQuote) {
    addSignal(criticalSignals, {
      key: 'ambiguousCompany',
      label: '회사명 또는 계약 주체가 불명확합니다.',
      quote: ambiguousCompanyQuote,
      whyImportant: '법인 주체가 흐리면 경력서 제출과 계약 진행 전에 실체 확인이 먼저 필요합니다.',
      question: '계약 주체 회사의 정식 법인명과 사업자등록번호를 확인할 수 있나요?',
    })
  }

  const personalEmailQuote = findRawLine(
    lines,
    (line) =>
      /@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(line) &&
      /@(gmail|naver|daum|hanmail|kakao)\./i.test(line) &&
      /(지원|회신|이력서|서류|메일)/i.test(line),
  )
  if (personalEmailQuote) {
    addSignal(criticalSignals, {
      key: 'personalEmail',
      label: '경력서 제출처가 개인 이메일입니다.',
      quote: personalEmailQuote,
      whyImportant: '경력서에는 개인정보와 경력 정보가 들어가므로 회사 이메일과 담당자 실명 확인 전 제출은 신중해야 합니다.',
      question: '담당자 실명과 회사 이메일로 다시 안내받을 수 있나요?',
    })
  }

  const dispatchQuote = findRawLine(lines, (line) => /(고용형태|근무형태).*(파견직|파견)/i.test(line))
  const freelanceQuote = findRawLine(lines, (line) => /(계약형태|계약조건|근무형태|고용형태).*(프리랜스|도급)/i.test(line))
  if (dispatchQuote && freelanceQuote && dispatchQuote !== freelanceQuote) {
    addSignal(criticalSignals, {
      key: 'contractConflict',
      label: '계약 형태 표현이 서로 충돌합니다.',
      quote: joinEvidenceQuotes(dispatchQuote, freelanceQuote),
      whyImportant: '파견과 프리랜스는 소속, 4대보험, 지휘체계가 달라서 계약 구조를 문서로 먼저 확인해야 합니다.',
      question: '파견인지 프리랜스인지, 실제 소속과 4대보험·퇴직금 적용을 문서로 설명해 줄 수 있나요?',
    })
  }

  if (ambiguousCompanyQuote && !structured?.companyHomepageUrl) {
    addSignal(criticalSignals, {
      key: 'entityUnverifiable',
      label: '경력서 제출 전 법인 실체 확인이 어렵습니다.',
      quote: ambiguousCompanyQuote,
      whyImportant: '법인명과 공식 채널이 불명확하면 경력서 제출 전에 사업자와 계약 주체를 먼저 확인해야 합니다.',
      question: '회사 홈페이지, 사업자등록번호, 계약서 초안을 제출 전에 확인할 수 있나요?',
    })
  }

  const multiLocationQuote = findRawLine(lines, (line) => isAmbiguousMultiLocationLine(line))
  if (multiLocationQuote) {
    addSignal(cautionSignals, {
      key: 'multiLocation',
      label: '실제 근무지가 복수로 병기되어 있습니다.',
      quote: multiLocationQuote,
      whyImportant: '실제 출근 위치와 고객사 상주 여부가 불명확하면 근무 조건과 역할 범위 해석이 달라질 수 있습니다.',
      question: '실제 근무지와 상주 여부가 어디로 확정되는지 알 수 있나요?',
    })
  }

  const hiddenWorkQuote = findRawLine(lines, (line) => /(보안사항|보안 사유|보안).*?(인터뷰|면접).*(안내|공개)/i.test(line))
  if (hiddenWorkQuote) {
    addSignal(cautionSignals, {
      key: 'hiddenWorkDetails',
      label: '상세 업무가 면접 전까지 공개되지 않습니다.',
      quote: hiddenWorkQuote,
      whyImportant: '핵심 업무가 비공개면 지원 전에 역할 범위와 책임을 판단하기 어렵습니다.',
      question: '면접 전에 공개 가능한 핵심 업무 범위와 산출물을 최소한으로 설명해 줄 수 있나요?',
    })
  }

  const rankQuote = findRawLine(lines, (line) => /(직급).*(부장|이사|연구소장|리드|팀장)/i.test(line))
  const roleQuote = findRawLine(lines, (line) => /(직책).*(팀원|사원|실무자)/i.test(line))
  if (rankQuote && roleQuote) {
    addSignal(cautionSignals, {
      key: 'rankRoleConflict',
      label: '직급과 직책이 충돌하거나 역할 레벨이 불명확합니다.',
      quote: joinEvidenceQuotes(rankQuote, roleQuote),
      whyImportant: '직급은 높지만 실제 역할이 팀원일 수 있어 권한과 책임을 따로 확인해야 합니다.',
      question: '직급과 직책이 각각 무엇을 의미하는지, 실제 의사결정 범위는 어디까지인지 알 수 있나요?',
    })
  }

  const allSignals = [...criticalSignals, ...cautionSignals]
  const primarySignal = criticalSignals[0] || cautionSignals[0] || null
  const criticalCount = criticalSignals.length
  const cautionCount = cautionSignals.length

  let previewRiskLevel = 'low'
  let previewRiskLabel = '좋음'
  let summary = '현재 공고만 보면 물경력 위험은 낮아 보입니다.'
  if (criticalCount >= 2) {
    previewRiskLevel = 'high'
    previewRiskLabel = '검증 전 지원 보류'
    summary = '경력서 제출 전 공고 신뢰성과 계약 주체 확인이 먼저 필요합니다.'
  } else if (criticalCount >= 1) {
    previewRiskLevel = 'medium'
    previewRiskLabel = '지원 전 검증 필요'
    summary = '물경력 판단보다 먼저 경력서 제출 안전성과 계약 구조를 확인해야 합니다.'
  } else if (cautionCount > 0) {
    previewRiskLevel = 'needs_review'
    previewRiskLabel = '추가 확인 필요'
    summary = '지원 전에 공고의 역할 범위와 계약 조건을 먼저 확인하는 편이 안전합니다.'
  }

  return {
    criticalSignals,
    cautionSignals,
    allSignals,
    primarySignal,
    criticalCount,
    cautionCount,
    previewRiskLevel,
    previewRiskLabel,
    summary,
  }
}

function findEvidenceWithSection(evidencePool, keywords, max = 2) {
  const found = []
  for (const item of evidencePool || []) {
    const text = item?.text || ''
    if (!text) continue
    if (keywords.some((keyword) => text.toLowerCase().includes(keyword.toLowerCase()))) found.push(item)
  }
  return found
    .sort((a, b) => {
      const sourceDiff = (b.sourcePriority || 0) - (a.sourcePriority || 0)
      if (sourceDiff !== 0) return sourceDiff
      const qualityDiff = Number(hasActionVerb(b.text)) - Number(hasActionVerb(a.text))
      if (qualityDiff !== 0) return qualityDiff
      return a.lineIndex - b.lineIndex || a.sentenceIndex - b.sentenceIndex
    })
    .slice(0, max)
}

function isEvidenceV2Enabled() {
  const flag = String(process.env.ANALYSIS_EVIDENCE_V2 || '').toLowerCase().trim()
  if (flag === 'false') return false
  return true
}

function scoreEvidenceForAxis(axis, evidenceItem, jobFamilyId = 'unknown') {
  const text = String(evidenceItem?.text || '')
  const section = String(evidenceItem?.section || '')
  const axisProfile = getAxisProfile(axis, jobFamilyId)
  const sectionAdjustment = axisProfile.sectionScoreAdjustments?.[section] || 0
  const sectionWeight = (SECTION_WEIGHTS[section] || 0) + sectionAdjustment
  if (!text || sectionWeight <= 0 || !passesSectionGate(evidenceItem) || !passesRelevanceGate(axisProfile, text)) {
    return null
  }

  let riskHits = 0
  let positiveHits = 0
  for (const keyword of axisProfile.risky) {
    if (text.toLowerCase().includes(String(keyword).toLowerCase())) riskHits += 1
  }
  for (const keyword of axisProfile.positive) {
    if (text.toLowerCase().includes(String(keyword).toLowerCase())) positiveHits += 1
  }

  const qualityPenalty = isTitleLikeEvidence(text) ? 3 : 0
  const sourcePriorityBonus = (evidenceItem?.sourcePriority || 0) * 0.1
  const riskScore = Math.max(0, sectionWeight + sourcePriorityBonus + riskHits - qualityPenalty)
  const positiveScore = Math.max(0, sectionWeight + sourcePriorityBonus + positiveHits - qualityPenalty)
  const bestEvidenceScore = Math.max(riskScore, positiveScore)

  return {
    ...evidenceItem,
    axis: axis.key,
    riskHits,
    positiveHits,
    riskScore,
    positiveScore,
    bestEvidenceScore,
    score: bestEvidenceScore,
    sourceType: 'quote',
  }
}

function applyEvidenceReusePenalty(scoredItem, usedEvidenceIds = new Set(), usedParagraphCounts = new Map()) {
  if (!scoredItem) return null
  let penalty = 0

  if (usedEvidenceIds.has(scoredItem.id)) penalty += 100
  const paragraphUseCount = usedParagraphCounts.get(scoredItem.paragraphKey) || 0
  if (paragraphUseCount > 0) penalty += paragraphUseCount * 1.5

  return {
    ...scoredItem,
    score: scoredItem.bestEvidenceScore - penalty,
    reusePenalty: penalty,
  }
}

function rankEvidenceForAxis(axis, evidencePool, { usedEvidenceIds = new Set(), usedParagraphCounts = new Map(), jobFamilyId = 'unknown' } = {}) {
  const scored = []
  for (const item of evidencePool || []) {
    const scoredItem = scoreEvidenceForAxis(axis, item, jobFamilyId)
    if (!scoredItem) continue
    if (scoredItem.riskHits === 0 && scoredItem.positiveHits === 0) continue
    scored.push(applyEvidenceReusePenalty(scoredItem, usedEvidenceIds, usedParagraphCounts))
  }
  return scored.sort((a, b) => b.score - a.score || b.bestEvidenceScore - a.bestEvidenceScore)
}

function resolveAxisLevelFromScore(rankedEvidence) {
  const top = rankedEvidence?.[0]
  if (!top) return { level: 'insufficient_info', picked: null }
  if ((top.score ?? top.bestEvidenceScore) < 1.2) return { level: 'insufficient_info', picked: null }
  if (isTitleLikeEvidence(top.text)) {
    const alternative = rankedEvidence.find((item) => !isTitleLikeEvidence(item.text))
    if (alternative) {
      return resolveAxisLevelFromScore([alternative])
    }
  }
  if (top.bestEvidenceScore < 1.2) return { level: 'insufficient_info', picked: top }

  const diff = top.riskScore - top.positiveScore
  const positiveLead = top.positiveScore - top.riskScore
  const hasBothSignals = top.riskHits > 0 && top.positiveHits > 0
  const hasInterpretivePositiveCue =
    /(기획|전략|a to z|결과 보고|회고|조사 운영|조사 관리|목표 수립|오너십|리딩|구축|캠페인|콘텐츠|브랜드|브랜딩|광고|스토리텔링|seo|geo|활성화)/i.test(top.text)
  const hasScopeGapCue =
    /(실행|운영|관리|지원|조율|협업|보고)/i.test(top.text) && !/(kpi|okr|예산|의사결정|오너십|권한)/i.test(top.text)

  if (diff >= 1.2) return { level: 'risk', picked: top }
  if (positiveLead >= 1.8) return { level: 'strong_positive', picked: top }
  if (hasBothSignals || (hasInterpretivePositiveCue && hasScopeGapCue)) return { level: 'mixed_signal', picked: top }
  if (positiveLead > 0 || (top.positiveScore > 0 && diff < 1.2)) return { level: 'positive_with_check', picked: top }
  return { level: 'risk', picked: top }
}

function pickTopEvidence(evidencePool, axes, { usedEvidenceIds = new Set(), usedParagraphCounts = new Map(), jobFamilyId = 'unknown' } = {}) {
  const candidates = []
  for (const item of evidencePool || []) {
    if (isRepresentativeEvidenceNoiseLine(item?.text)) continue
    const sectionScore = SECTION_WEIGHTS[item.section] || 0
    if (sectionScore <= 0) continue
    const actionScore = hasActionVerb(item.text) ? 2 : 0
    const axisScore = axes.reduce((acc, axis) => acc + (passesRelevanceGate(getAxisProfile(axis, jobFamilyId), item.text) ? 2 : 0), 0)
    const titlePenalty = isTitleLikeEvidence(item.text) ? -3 : 0
    const reusePenalty = (usedEvidenceIds.has(item.id) ? 100 : 0) + ((usedParagraphCounts.get(item.paragraphKey) || 0) * 1.5)
    candidates.push({ item, score: sectionScore + actionScore + axisScore + titlePenalty - reusePenalty })
  }
  candidates.sort((a, b) => b.score - a.score)
  const nonTitle = candidates.find((entry) => !isTitleLikeEvidence(entry.item.text))
  return (nonTitle || candidates[0] || null)?.item || null
}

function buildWhyImportant(axisKey, quote, level) {
  if (!quote) return '공고에서 직접 근거가 부족해 이 축은 면접에서 검증해야 합니다.'
  const byAxis = {
    repetition:
      '운영만 반복하면 성과보다 실행 보조 경험만 남을 수 있습니다. 기획·개선까지 맡는 구조인지 확인해야 합니다.',
    responsibility:
      '성과 요구와 권한이 분리되면 결과를 내도 내 성과로 설명하기 어렵습니다. KPI 책임과 의사결정 권한을 함께 확인해야 합니다.',
    measurable:
      'KPI나 결과물 기준이 없으면 나중에 성과를 설명하기 어렵습니다. 어떤 지표로 평가하는지 확인해야 합니다.',
    difficulty:
      '역할 난이도가 올라가지 않으면 연차 대비 경쟁력이 떨어질 수 있습니다. 운영에서 더 어려운 문제 해결로 확장되는 구조인지 확인해야 합니다.',
    transferable:
      '내부 프로세스 중심 경험만 쌓이면 이직 때 설명할 경험이 약해집니다. 다른 회사에서도 설명 가능한 결과물인지 확인해야 합니다.',
  }
  const text = byAxis[axisKey] || '이 근거가 실제 커리어 자산으로 이어지는지 면접에서 구체적으로 확인해야 합니다.'
  if (level === 'low') return `긍정 신호가 있지만 ${text}`
  return text
}

function criteriaForJobFamily(jobFamilyId) {
  return JOB_RISK_CRITERIA.find((criteria) => criteria.id === jobFamilyId) || null
}

function summarizeCriteria(criteria) {
  if (!criteria) return null
  return {
    version: CRITERIA_VERSION,
    sources: CRITERIA_SOURCES,
    jobFamilyId: criteria.id,
    label: criteria.label,
    riskSignals: criteria.riskSignals,
    positiveSignals: criteria.positiveSignals,
    cautions: criteria.cautions,
    interviewQuestions: criteria.interviewQuestions,
  }
}

function matchCriteriaSignals(lines, criteria) {
  if (!criteria) return null
  const riskyEvidence = findEvidence(lines, criteria.riskSignals, 3)
  const positiveEvidence = findEvidence(lines, criteria.positiveSignals, 3)
  let level = 'needs_review'

  if (riskyEvidence.length > positiveEvidence.length) level = riskyEvidence.length >= 2 ? 'high' : 'medium'
  if (positiveEvidence.length > riskyEvidence.length) level = 'low'
  if (riskyEvidence.length > 0 && positiveEvidence.length > 0) level = 'medium'

  const summaryByLevel = {
    high: `${criteria.label} 기준에서 위험 신호가 상대적으로 강합니다.`,
    medium: `${criteria.label} 기준에서 긍정/주의 신호가 함께 보여 추가 확인이 필요합니다.`,
    low: `${criteria.label} 기준에서 성장 가능성을 보여주는 표현이 확인됩니다.`,
    needs_review: `${criteria.label} 기준으로는 직접 근거가 부족합니다.`,
  }

  return {
    level,
    levelLabel: levelToKo(level),
    summary: summaryByLevel[level],
    riskyEvidence,
    positiveEvidence,
  }
}

function findEvidence(lines, keywords, max = 2) {
  const found = []
  for (const line of lines) {
    if (keywords.some((keyword) => String(line).toLowerCase().includes(String(keyword).toLowerCase()))) {
      found.push(String(line).slice(0, 220))
    }
    if (found.length >= max) break
  }
  return found
}

function looksLikeTitleNoise(line) {
  const value = String(line || '').trim()
  if (!value) return true
  if (TITLE_NOISE_PATTERNS.some((pattern) => pattern.test(value))) return true
  if (/^[•*-]/.test(value) && value.length < 20) return true
  if (/^[A-Za-z\s]+$/.test(value) && value.length <= 6 && !/(back|front|full|data|design|sales|hr)/i.test(value)) return true
  return false
}

function looksLikeNarrativeSentence(line) {
  const value = String(line || '').trim()
  if (!value) return true
  if (value.length >= 90) return true
  if (/[.!?]\s*$/.test(value) && value.length >= 40) return true
  if (/(습니다|합니다|됩니다|있습니다|찾고 있습니다|기대합니다)\.?$/.test(value)) return true
  if (/[,:;]\s/.test(value) && value.length >= 70) return true
  return false
}

function looksLikeJobTitle(line) {
  const value = String(line || '').trim()
  if (!value || looksLikeTitleNoise(value) || looksLikeNarrativeSentence(value)) return false
  if (/^[“"'`].+[”"'`]$/.test(value) && !/(manager|engineer|developer|designer|coordinator|lead|analyst|specialist|마케터|개발|디자이너|엔지니어|기획|운영)/i.test(value)) {
    return false
  }
  if (/[∙·•]/.test(value) && /(경력|신입|정규직|계약직|서울|경기|부산|대전|인천|대구|광주|울산)/i.test(value)) return false
  if (/^[•*-]/.test(value)) return false
  if (value.length > 70) return false
  return /(개발|developer|engineer|엔지니어|backend|back-end|frontend|front-end|fullstack|full-stack|designer|디자이너|마케터|marketing|scm|물류|운영|manager|매니저|sales|영업|hr|리크루터|recruit|recruiter|talent|product|pm|po|data|analyst|리드|lead|technician|scientist|architect|consultant|specialist|coordinator|pd|md|editor|researcher|planner|기획|공정|소자)/i.test(
    value,
  )
}

function extractJobTitleFromLines(lines) {
  const safeLines = (lines || []).map((line) => sanitizeTitleCandidate(line)).filter(Boolean)
  const earlyLines = safeLines.slice(0, 12)
  const preferredCandidates = earlyLines.filter((line) => looksLikeJobTitle(line))

  if (preferredCandidates.length > 0) return preferredCandidates[0]

  const compactFallback = earlyLines.find((line) => !looksLikeTitleNoise(line) && !looksLikeNarrativeSentence(line) && line.length <= 70)
  if (compactFallback) return compactFallback

  const fallback = safeLines.find((line) => !looksLikeTitleNoise(line) && !looksLikeNarrativeSentence(line))
  return fallback || safeLines[0] || '직무명 확인 필요'
}

function buildClassificationLines(structured) {
  const lines = []
  const jobTitle = String(structured?.jobTitle || '').trim()
  if (jobTitle) {
    lines.push(jobTitle, jobTitle, jobTitle)
  }

  for (const sectionName of ['position_summary', 'responsibilities', 'requirements', 'preferred']) {
    for (const line of structured?.sectionsNormalized?.[sectionName] || []) {
      const value = String(line || '').trim()
      if (!value || looksLikeTitleNoise(value)) continue
      lines.push(value)
    }
  }

  for (const line of structured?.lines || []) {
    const value = sanitizeTitleCandidate(line)
    if (!value || looksLikeTitleNoise(value)) continue
    if (/[∙·•]/.test(value) && /(경력|신입|정규직|계약직|서울|경기|부산|대전|인천|대구|광주|울산)/i.test(value)) continue
    if (value === jobTitle) continue
    lines.push(value)
    if (lines.length >= 40) break
  }

  return lines
}

function classifyJobFamilyFromTitle(title) {
  const value = String(title || '').trim()
  if (!value) return null
  if (/(마케팅|marketing|marketer|crm|퍼포먼스|performance|브랜드 마케팅|콘텐츠 마케팅|그로스|growth|d2c|자사몰)/i.test(value)) {
    return { id: 'marketing', label: '마케팅/브랜드/조사', confidence: 'high' }
  }
  if (/(프로덕트 매니저|product manager|product owner|프로덕트 오너|\bpo\b|\bpm\b|prd|퍼널|리텐션|활성화율|a\/b 테스트|실험 설계|head of product|스쿼드)/i.test(value)) {
    return { id: 'product', label: '프로덕트/기획', confidence: 'high' }
  }
  if (/(풀필먼트|fulfillment|fulfilment|운영기획|물류기획|서비스 운영기획|scm|물류)/i.test(value)) {
    return { id: 'operations', label: '운영/SCM/물류기획', confidence: 'high' }
  }
  if (/(recruiter|recruiting|talent acquisition|talent acquisitions|hrbp|hr ops|hr\s|human resources|리크루터|채용 담당자|인사 담당자|hr 담당자|평가보상|인사·총무|인사|채용)/i.test(value)) {
    return { id: 'hr', label: 'HR/채용/조직운영', confidence: 'high' }
  }
  if (/(back[- ]?end|front[- ]?end|full[- ]?stack|engineer|developer|개발자|엔지니어|프론트엔드|백엔드|서버|ai|ml|llm|data engineer|physical ai|로보틱스|network|infrastructure|platform engineer|devops|sre|deployment build lead)/i.test(value)) {
    return { id: 'development', label: '개발/IT/데이터', confidence: 'high' }
  }
  if (/(디자이너|designer|ux|ui|graphic|패션.*디자이너)/i.test(value)) {
    return { id: 'design', label: '디자인', confidence: 'high' }
  }
  if (/(scm|물류|inventory|asset technician|warehouse|재고|입고|출고|3pl|wms|oms)/i.test(value)) {
    return { id: 'operations', label: '운영/SCM/물류기획', confidence: 'high' }
  }
  if (/(공정|소자|반도체|설비|품질|생산|제조)/i.test(value)) {
    return { id: 'manufacturing', label: '생산/제조/공정기술', confidence: 'high' }
  }
  return null
}

function classifyJobFamily(structured) {
  const titleOverride = classifyJobFamilyFromTitle(structured?.jobTitle)
  if (titleOverride) return titleOverride

  const lines = Array.isArray(structured) ? structured : buildClassificationLines(structured)
  const text = lines.join('\n').toLowerCase()
  const productSignals = [
    '프로덕트 매니저',
    'product manager',
    'product owner',
    '프로덕트 오너',
    'prd',
    '온보딩',
    '리텐션',
    '활성화율',
    '퍼널 분석',
    '사용자 인터뷰',
    'a/b 테스트',
    '기능 출시',
    '우선순위',
    '실험 설계',
    '성과 대시보드',
    'head of product',
    '스쿼드',
  ].filter((keyword) => text.includes(keyword.toLowerCase())).length
  const hrSignals = [
    'recruiter',
    'recruiting',
    'talent acquisition',
    'hrbp',
    'human resources',
    '리크루터',
    '채용',
    '인사',
    '평가보상',
    '교육운영',
  ].filter((keyword) => text.includes(keyword.toLowerCase())).length
  const operationsSignals = [
    '풀필먼트',
    'fulfillment',
    'fulfilment',
    '운영기획',
    '프로세스 개선',
    'kpi',
    'sla',
    'sql',
    'scm',
    '물류',
    '생산성과 효율성',
  ].filter((keyword) => text.includes(keyword.toLowerCase())).length
  if (productSignals >= 3 && productSignals > hrSignals) {
    return { id: 'product', label: '프로덕트/기획', confidence: 'high' }
  }
  if (operationsSignals >= 3 && operationsSignals > hrSignals) {
    return { id: 'operations', label: '운영/SCM/물류기획', confidence: 'high' }
  }
  const scored = JOB_FAMILIES.map((family) => ({
    ...family,
    score: family.keywords.reduce((acc, keyword) => acc + (text.includes(String(keyword).toLowerCase()) ? 1 : 0), 0),
  })).sort((a, b) => b.score - a.score)

  const best = scored[0]
  if (!best || best.score === 0) return { id: 'unknown', label: '추가 확인 필요', confidence: 'low' }
  return { id: best.id, label: best.label, confidence: best.score >= 2 ? 'high' : 'medium' }
}

function extractCompanyNameFromLines(lines) {
  const safeLines = (lines || []).map((line) => String(line || '').trim()).filter(Boolean)
  const roleLikePattern =
    /(마케터|디자이너|개발자|엔지니어|리드|매니저|코디네이터|recruiter|manager|engineer|developer|designer|technician|analyst|coordinator|pd|planner|hr)/i
  const invalidCompanyCandidate = (value) => {
    const candidate = String(value || '').trim()
    if (!candidate) return true
    if (candidate.length > 40) return true
    if (/(지원자|추천인|현금|만원|합격보상|응답률|회원가입)/i.test(candidate)) return true
    if (/(입니다|합니다|있습니다|역할|포지션|기업으로|모집합니다)/.test(candidate)) return true
    if (/^[“"'`].+[”"'`]$/.test(candidate)) return true
    return false
  }
  for (const line of safeLines) {
    const match = line.match(/(?:회사명|기업명)\s*[:：]\s*(.+)$/i)
    if (match && !invalidCompanyCandidate(match[1]) && !isWeakCompanyNameCandidate(match[1])) return match[1].trim()
  }
  const title = String(safeLines[0] || '')
  if (!title) return null
  const firstToken = title
    .split(/[∙·•|]/)[0]
    ?.replace(/\s+(경력|신입|정규직|계약직).*$/i, '')
    ?.trim()
  if (
    firstToken &&
    firstToken.length >= 2 &&
    !/^[\-•*]/.test(firstToken) &&
    !/(채용|모집|hiring|recruitment|주요업무|자격요건)/i.test(firstToken) &&
    !roleLikePattern.test(firstToken) &&
    !invalidCompanyCandidate(firstToken) &&
    !isWeakCompanyNameCandidate(firstToken)
  ) {
    return firstToken
  }
  if (/(채용|모집|hiring|recruitment)/i.test(title)) {
    const candidate = title.replace(/\s+(채용|모집|hiring|recruitment).*$/i, '').trim()
    return invalidCompanyCandidate(candidate) || isWeakCompanyNameCandidate(candidate) ? null : candidate || null
  }
  return null
}

function extractCompanyHomepageUrl(text) {
  const match = String(text || '').match(/https?:\/\/[^\s)]+/i)
  return match ? match[0] : null
}

function structurePosting(jobPostingText) {
  const text = trimPostingTail(jobPostingText)
  const lines = linesFrom(text)
  const jobTitle = extractJobTitleFromLines(lines)
  const sectionsNormalized = splitSections(lines)
  const companyName = extractCompanyNameFromLines(lines)
  const companyHomepageUrl = extractCompanyHomepageUrl(text)

  return {
    rawText: text,
    lines,
    jobTitle,
    companyName,
    companyHomepageUrl,
    sectionsNormalized,
    sections: {
      positionSummary: sectionsNormalized.position_summary,
      responsibilities: sectionsNormalized.responsibilities,
      requirements: sectionsNormalized.requirements,
      preferred: sectionsNormalized.preferred,
      employment: sectionsNormalized.deadline,
    },
  }
}

function enhanceAxesWithCompanyContext(fiveAxes, companyContext) {
  const hypotheses = companyContext?.jobConnectionHypotheses || []
  const businessSignals = companyContext?.businessSignals || []
  const hasSignalSupport = businessSignals.some((item) => ['medium', 'high'].includes(item?.confidence))
  if (!hypotheses.length && !hasSignalSupport) return fiveAxes

  return fiveAxes.map((axis) => {
    const hypothesis =
      (axis.key === 'repetition' && hypotheses.find((item) => item.riskImpact === 'uncertain')) ||
      (axis.key === 'responsibility' && hypotheses.find((item) => item.riskImpact === 'decrease')) ||
      (axis.key === 'transferable' && hypotheses.find((item) => item.riskImpact === 'decrease')) ||
      null

    if (!hypothesis) return axis

    return {
      ...axis,
      summary: `${axis.summary} 회사 맥락상 ${hypothesis.reason}`,
    }
  })
}

function renderAxisMessage(_axis, level) {
  const map = {
    risk: '현재 공고 기준으로 주의 신호가 확인됩니다.',
    mixed_signal: '좋아 보이는 표현은 있지만, 실제 역할 범위는 더 확인해야 합니다.',
    positive_with_check: '핵심 정보는 비교적 충분하지만, 세부 기준은 추가 확인이 필요합니다.',
    strong_positive: '현재 공고 기준으로 긍정 신호가 비교적 분명합니다.',
    insufficient_info: '현재 공고만으로는 판단 근거가 부족합니다.',
  }
  return map[level]
}

function getAxisInsufficientInfoSummary(axisKey) {
  const map = {
    repetition: '반복 업무 비중은 더 확인이 필요합니다.',
    responsibility: '실제 결정권은 확인이 필요합니다.',
    measurable: '성과 기준은 더 확인이 필요합니다.',
    difficulty: '성장 난이도는 더 확인이 필요합니다.',
    transferable: '이직에 남을 경험인지는 더 확인이 필요합니다.',
    scopeClarity: '핵심 역할 경계가 모호합니다.',
    learningFeedback: '배우고 개선하는 구조는 더 확인이 필요합니다.',
  }

  return map[axisKey] || '핵심 기준은 더 확인이 필요합니다.'
}

function normalizeAxisVerdict(axisKey, level, evidenceText = '') {
  if (axisKey === 'responsibility' && level === 'strong_positive') {
    const hasExplicitAuthorityCue =
      /(의사결정|오너십|owner|ownership|목표 수립|우선순위|kpi|okr|예산|p&l|리딩|주도|전략 수립)/i.test(evidenceText)
    const hasImprovementOwnershipCue = /(개선).*(책임|주도|리딩|소유|오너십)/i.test(evidenceText)
    if (!hasExplicitAuthorityCue && !hasImprovementOwnershipCue) return 'positive_with_check'
  }

  if (axisKey === 'scopeClarity' && level === 'insufficient_info') {
    const scopeBreadthHits = countDistinctKeywordHits(evidenceText, ['자사몰', 'crm', '인플루언서', '콘텐츠', '라이브커머스', '프로모션', '데이터 분석'])
    if (scopeBreadthHits >= 3 || /(업무 전반|전반 업무|다양한 업무|필요 시|유관 업무)/i.test(evidenceText)) {
      return 'mixed_signal'
    }
  }

  if (axisKey === 'repetition' && level === 'strong_positive') {
    const hasOperationalCue = /(운영|관리|일정|협업|조율|프로모션|crm|콘텐츠|라이브커머스|인플루언서)/i.test(evidenceText)
    const hasImprovementCue = /(개선|분석|전략|실험|리포트|성과)/i.test(evidenceText)
    if (hasOperationalCue && hasImprovementCue) return 'positive_with_check'
  }
  return level
}

function applyContextualAxisAdjustments(sevenAxes, structured, jobFamily) {
  const text = [
    structured?.jobTitle,
    ...(structured?.sectionsNormalized?.responsibilities || []),
    ...(structured?.sectionsNormalized?.requirements || []),
    ...(structured?.sectionsNormalized?.preferred || []),
  ]
    .filter(Boolean)
    .join('\n')

  if (!text) return sevenAxes

  const strategicHr = jobFamily?.id === 'hr' && hasStrategicHrSignals(text)
  const operationsPlanning = jobFamily?.id === 'operations' && hasOperationsPlanningSignals(text)
  const educationProductPlanning = jobFamily?.id === 'product' && hasEducationProductPlanningSignals(text)
  const broadEducationOperations = ['education', 'hr', 'public'].includes(jobFamily?.id) && hasBroadEducationOperationsSignals(text)
  const brandContentStrategy = ['marketing', 'media'].includes(jobFamily?.id) && hasBrandContentStrategySignals(text)

  const strategicHrQuote =
    findRawLine(structured?.lines, (line) => /단순히 요청받은 일을 운영하고 처리하는.*아니라/i.test(line)) ||
    findRawLine(structured?.lines, (line) => /조직의 문제를 먼저 발견하고 사람들을 움직이는 드라이버/i.test(line))
  const operationsPlanningQuote =
    findRawLine(structured?.lines, (line) => /풀필먼트 서비스 운영을 기획하고 프로세스 개선 업무를 담당/i.test(line)) ||
    findRawLine(structured?.lines, (line) => /프로세스 개선안을 도출하고 실행을 추적 관리/i.test(line))
  const manufacturingOperationalQuote =
    findRawLine(structured?.lines, (line) => /생산 일정.*품질테스트\/인증 관리/i.test(line)) ||
    findRawLine(structured?.lines, (line) => /수출입 통관 진행.*입고 수량 관리/i.test(line)) ||
    findRawLine(structured?.lines, (line) => /생산 발주서 작성 및 관리/i.test(line)) ||
    findRawLine(structured?.lines, (line) => /원부자재 수급.*납기 관리/i.test(line))
  const educationProductPlanningQuote =
    findRawLine(structured?.lines, (line) => /시장 흐름, 고객 니즈, 경쟁 상품을 바탕으로 신규 교육상품/i.test(line)) ||
    findRawLine(structured?.lines, (line) => /하나의 콘텐츠를 단순 강의가 아니라.*교육상품으로 만듭니다/i.test(line))
  const educationProductCollaborationQuote =
    findRawLine(structured?.lines, (line) => /제작pd, 마케팅, 디자인, 운영팀과 협업해 상세페이지, 광고 메시지, 런칭 방향을 정리/i.test(line)) ||
    educationProductPlanningQuote
  const educationProductImprovementQuote =
    findRawLine(structured?.lines, (line) => /런칭 이후 매출, 전환율, 고객 반응, 후기 데이터를 보고 상품 개선안/i.test(line))
  const productDeliverableQuote =
    findRawLine(structured?.lines, (line) => /(PRD|사용자 인터뷰 리포트|퍼널 분석 리포트|실험 설계 문서|성과 대시보드)/i.test(line)) ||
    findRawLine(structured?.lines, (line) => /(기능 출시 회고 문서|제품 성과 대시보드)/i.test(line))
  const productFeedbackQuote =
    findRawLine(structured?.lines, (line) => /(매주 제품 리뷰|실험 결과와 지표를 공유)/i.test(line)) ||
    findRawLine(structured?.lines, (line) => /(월 1회 .*1:1 피드백|분기마다 .*성과.*발표)/i.test(line))
  const productScopeQuote =
    findRawLine(structured?.lines, (line) => /(담당 제품).*(온보딩|대시보드|알림|리포트)/i.test(line)) ||
    findRawLine(structured?.lines, (line) => /(온보딩|대시보드|알림|리포트 기능).*(프로덕트 오너|포지션|담당)/i.test(line)) ||
    findRawLine(structured?.lines, (line) => /(주요 업무).*(퍼널 분석|사용자 인터뷰|PRD|A\/B 테스트|지표 추적)/i.test(line)) ||
    findRawLine(structured?.lines, (line) => /(퍼널 분석|사용자 인터뷰|PRD 작성|A\/B 테스트|지표 추적).*(직접 수행|담당)/i.test(line)) ||
    findRawLine(structured?.lines, (line) => /(고객 온보딩 퍼널 분석|기능 요구사항 문서\(PRD\) 작성)/i.test(line))
  const genericScopeQuote =
    findRawLine(structured?.lines, (line) => /(담당 제품|담당 영역|담당 서비스).*(전략|기획|운영|개선|리포트|가이드|기능|캠페인)/i.test(line)) ||
    findRawLine(structured?.lines, (line) => /(주요 산출물|핵심 산출물).*(기획안|리포트|가이드|대시보드|문서|상세페이지|제안서|PRD)/i.test(line))
  const designOwnershipQuote =
    findRawLine(structured?.lines, (line) => /(주도적으로 진행|디자인 업무를 주도적으로|디자인 방향.*제안)/i.test(line))
  const designResearchQuote =
    findRawLine(structured?.lines, (line) => /(벤치마크|리서치).*(솔루션|제안)/i.test(line)) ||
    findRawLine(structured?.lines, (line) => /(아이디어를 공유|피드백 받는 능력)/i.test(line))
  const designCreativeOutputQuote =
    findRawLine(structured?.lines, (line) => /(캠페인 비주얼|광고 제작|마케팅 크리에이티브|프로모션 및 마케팅 배너)/i.test(line)) ||
    findRawLine(structured?.lines, (line) => /(패키지|굿즈|인쇄물|공간 그래픽|오프라인 행사|팝업 스토어)/i.test(line))
  const designToolQuote =
    findRawLine(structured?.lines, (line) => /(Figma|Adobe Creative Suite|After Effects|Illustrator|Photoshop|Cinema 4D)/i.test(line))
  const designOutcomeSourceLine =
    findRawLine(structured?.lines, (line) => /(기간 내에 결과물을 완성|짧은 기간 안에 결과물을 완성|높은 수준의 품질을 유지)/i.test(line))
  const designOutcomeQuote = /짧은 기간 안에 결과물을 완성/.test(designOutcomeSourceLine)
    ? '짧은 기간 안에 결과물을 완성합니다.'
    : /기간 내에 결과물을 완성/.test(designOutcomeSourceLine)
      ? '기간 내에 결과물을 완성'
      : /높은 수준의 품질을 유지/.test(designOutcomeSourceLine)
        ? '높은 수준의 품질을 유지'
        : ''
  const designDifficultyQuote =
    findRawLine(structured?.lines, (line) => /(최우선 프로젝트|경험을 정의하고 만드는 핵심 역할|비즈니스 목표를 달성|유저 친화적인 솔루션을 제안)/i.test(line))
  const designScopeQuote =
    findRawLine(structured?.lines, (line) => /(플랫폼 전체를 지원할 비주얼 디자이너|브랜드 전체를 지원할 비주얼 디자이너|아이콘, 애니메이션, 비주얼 디자인, 프레젠테이션 자료|아이콘, 프레젠테이션 자료, 프로모션 및 마케팅 배너)/i.test(line))
  const brandContentStrategyQuote =
    findRawLine(structured?.lines, (line) => /(캠페인 기획|콘텐츠 기획|콘텐츠 전략|브랜드 전략|seo|geo).*(실행|운영|리포트|성과 분석)/i.test(line)) ||
    findRawLine(structured?.lines, (line) => /(성과 분석|전환율|매출|리포트|스토리텔링|파트너십)/i.test(line))
  const marketingBreadthQuote =
    findRawLine(
      structured?.lines,
      (line) =>
        countDistinctKeywordHits(line, ['자사몰', 'crm', '인플루언서', '콘텐츠', '라이브커머스', '프로모션', '데이터 분석']) >= 3,
    ) || ''

  return (sevenAxes || []).map((axis) => {
    if (strategicHr && axis.key === 'repetition' && axis.level === 'risk' && strategicHrQuote) {
      return {
        ...axis,
        level: 'positive_with_check',
        levelLabel: levelToKo('positive_with_check'),
        summary: '운영 처리형 HR보다는 조직 문제 정의와 전략 실행 신호가 더 강해 보입니다. 다만 실제 운영 비중은 확인이 필요합니다.',
        evidence: createRawEvidence(strategicHrQuote, axis.key),
      }
    }

    if (operationsPlanning && axis.key === 'repetition' && axis.level === 'risk' && operationsPlanningQuote) {
      return {
        ...axis,
        level: 'mixed_signal',
        levelLabel: levelToKo('mixed_signal'),
        summary: '운영 실행 요소는 있지만, 프로세스 개선과 지표 기반 기획 역할이 함께 보여 단순 운영으로 단정하기는 어렵습니다.',
        evidence: createRawEvidence(operationsPlanningQuote, axis.key),
      }
    }

    if (jobFamily?.id === 'manufacturing' && hasManufacturingOperationalSignals(text) && axis.key === 'repetition' && manufacturingOperationalQuote) {
      return {
        ...axis,
        level: 'risk',
        levelLabel: levelToKo('risk'),
        summary: '일정·수량·발주·통관·납기 관리 중심 업무가 보여 반복 운영 비중을 먼저 확인해야 합니다.',
        evidence: createRawEvidence(manufacturingOperationalQuote, axis.key),
      }
    }

    if (broadEducationOperations && axis.key === 'repetition') {
      const educationOpsQuote =
        findRawLine(structured?.lines, (line) => /교육사업 기획.*강사모집.*교육관리.*결산.*홍보 전 과정 담당/i.test(line)) ||
        findRawLine(structured?.lines, (line) => /교육기획 문서 작성/i.test(line))
      if (educationOpsQuote) {
        return {
          ...axis,
          level: 'risk',
          levelLabel: levelToKo('risk'),
          summary: '기획부터 강사모집·운영관리·결산·홍보까지 넓게 묶여 있어 반복 운영과 잡무 비중을 먼저 확인해야 합니다.',
          evidence: createRawEvidence(educationOpsQuote, axis.key),
        }
      }
    }

    if (brandContentStrategy && axis.key === 'repetition' && axis.level === 'risk' && brandContentStrategyQuote) {
      return {
        ...axis,
        level: 'mixed_signal',
        levelLabel: levelToKo('mixed_signal'),
        summary: '운영 요소는 보이지만, 캠페인·콘텐츠 전략과 성과 분석이 함께 적혀 있어 단순 반복 운영으로 단정하기는 어렵습니다.',
        evidence: createRawEvidence(brandContentStrategyQuote, axis.key),
      }
    }

    if (jobFamily?.id === 'marketing' && axis.key === 'scopeClarity' && marketingBreadthQuote) {
      return {
        ...axis,
        level: axis.level === 'risk' ? 'risk' : 'mixed_signal',
        levelLabel: levelToKo(axis.level === 'risk' ? 'risk' : 'mixed_signal'),
        summary:
          '업무 항목은 충분히 적혀 있지만 자사몰, CRM, 콘텐츠, 프로모션, 라이브커머스가 함께 묶여 있어 핵심 역할 경계는 확인이 필요합니다.',
        evidence: createRawEvidence(marketingBreadthQuote, axis.key),
      }
    }

    if (jobFamily?.id === 'marketing' && axis.key === 'repetition' && marketingBreadthQuote && axis.level === 'strong_positive') {
      return {
        ...axis,
        level: 'positive_with_check',
        levelLabel: levelToKo('positive_with_check'),
        summary: '성과 분석과 전략 개선 문구는 보이지만 운영성 업무도 넓게 포함돼 있어 실제 비중 확인이 필요합니다.',
        evidence: createRawEvidence(marketingBreadthQuote, axis.key),
      }
    }

    if (axis.key === 'scopeClarity' && axis.level === 'insufficient_info' && genericScopeQuote) {
      return {
        ...axis,
        level: 'positive_with_check',
        levelLabel: levelToKo('positive_with_check'),
        summary: '담당 범위나 주요 산출물이 비교적 구체적으로 적혀 있어 업무 범위는 어느 정도 보입니다. 다만 최종 책임 경계는 확인이 필요합니다.',
        evidence: createRawEvidence(genericScopeQuote, axis.key),
      }
    }

    if (educationProductPlanning && (educationProductPlanningQuote || educationProductImprovementQuote)) {
      if (axis.key === 'repetition' && axis.level === 'risk') {
        return {
          ...axis,
          level: 'positive_with_check',
          levelLabel: levelToKo('positive_with_check'),
          summary: '단순 강의 운영보다 교육상품 설계와 개선 역할 신호가 더 강해 보입니다. 다만 실제 운영 비중은 확인이 필요합니다.',
          evidence: createRawEvidence(educationProductPlanningQuote || educationProductCollaborationQuote || educationProductImprovementQuote, axis.key),
        }
      }
      if (axis.key === 'responsibility' && axis.level === 'insufficient_info') {
        return {
          ...axis,
          level: 'positive_with_check',
          levelLabel: levelToKo('positive_with_check'),
          summary: '교육상품 콘셉트와 커리큘럼, 런칭 방향을 직접 설계하는 역할로 보입니다. 다만 최종 승인 범위는 확인이 필요합니다.',
          evidence: createRawEvidence(educationProductCollaborationQuote || educationProductPlanningQuote, axis.key),
        }
      }
      if (axis.key === 'transferable' && axis.level === 'insufficient_info') {
        return {
          ...axis,
          level: 'positive_with_check',
          levelLabel: levelToKo('positive_with_check'),
          summary: '상품 기획과 런칭, 전환율·후기 데이터 기반 개선 경험은 다음 이직에도 설명 가능한 자산이 될 수 있습니다.',
          evidence: createRawEvidence(educationProductImprovementQuote || educationProductCollaborationQuote || educationProductPlanningQuote, axis.key),
        }
      }
      if (axis.key === 'learningFeedback' && axis.level === 'insufficient_info') {
        return {
          ...axis,
          level: 'positive_with_check',
          levelLabel: levelToKo('positive_with_check'),
          summary: '런칭 이후 고객 반응과 데이터로 상품을 다시 개선하는 구조가 보입니다.',
          evidence: createRawEvidence(educationProductImprovementQuote || educationProductPlanningQuote, axis.key),
        }
      }
    }

    if (jobFamily?.id === 'product') {
      if (axis.key === 'transferable' && axis.level === 'insufficient_info' && productDeliverableQuote) {
        return {
          ...axis,
          level: 'positive_with_check',
          levelLabel: levelToKo('positive_with_check'),
          summary: 'PRD, 인터뷰/분석 리포트, 실험 설계 문서, 성과 대시보드처럼 이직 시 설명 가능한 산출물이 공고에 직접 보입니다. 다만 실제 대표 성과 사례로 정리할 수 있는지는 확인이 필요합니다.',
          evidence: createRawEvidence(productDeliverableQuote, axis.key),
        }
      }
      if (axis.key === 'learningFeedback' && axis.level === 'insufficient_info' && productFeedbackQuote) {
        return {
          ...axis,
          level: 'positive_with_check',
          levelLabel: levelToKo('positive_with_check'),
          summary: '실험 결과 공유, 정기 1:1, 분기 발표가 적혀 있어 처리로 끝나기보다 리뷰와 개선으로 이어지는 구조가 보입니다.',
          evidence: createRawEvidence(productFeedbackQuote, axis.key),
        }
      }
      if (axis.key === 'scopeClarity' && axis.level !== 'strong_positive' && productScopeQuote) {
        return {
          ...axis,
          level: 'positive_with_check',
          levelLabel: levelToKo('positive_with_check'),
          summary: '담당 제품 범위와 주요 업무가 비교적 구체적으로 적혀 있어 업무 범위는 선명한 편입니다. 다만 최종 책임 경계는 확인이 필요합니다.',
          evidence: createRawEvidence(productScopeQuote, axis.key),
        }
      }
    }

    if (jobFamily?.id === 'design') {
      if (axis.key === 'repetition' && axis.level === 'risk' && designCreativeOutputQuote) {
        return {
          ...axis,
          level: 'mixed_signal',
          levelLabel: levelToKo('mixed_signal'),
          summary: '가이드라인 운영 요소는 보이지만, 캠페인·패키지·공간 그래픽 같은 결과물 설계가 함께 적혀 있어 단순 반복 운영으로 단정하기는 어렵습니다.',
          evidence: createRawEvidence(designCreativeOutputQuote, axis.key),
        }
      }
      if (axis.key === 'responsibility' && axis.level === 'insufficient_info' && designOwnershipQuote) {
        return {
          ...axis,
          level: 'positive_with_check',
          levelLabel: levelToKo('positive_with_check'),
          summary: '주도적으로 진행한다는 표현이 있어 제작만 하는 역할로 단정하기는 어렵습니다. 다만 최종 결정권과 승인 구조는 확인이 필요합니다.',
          evidence: createRawEvidence(designOwnershipQuote, axis.key),
        }
      }
      if (axis.key === 'learningFeedback' && axis.level === 'insufficient_info' && designResearchQuote) {
        return {
          ...axis,
          level: 'positive_with_check',
          levelLabel: levelToKo('positive_with_check'),
          summary: '벤치마크·리서치 기반 제안 표현이 있어 작업이 단순 제작으로 끝나지 않고 개선 논의로 이어질 가능성이 보입니다.',
          evidence: createRawEvidence(designResearchQuote, axis.key),
        }
      }
      if (axis.key === 'transferable' && axis.level === 'insufficient_info' && designToolQuote) {
        return {
          ...axis,
          level: 'positive_with_check',
          levelLabel: levelToKo('positive_with_check'),
          summary: '업계에서 널리 쓰는 도구와 결과물 유형이 적혀 있어 다른 회사에도 설명 가능한 경험으로 남을 가능성이 보입니다.',
          evidence: createRawEvidence(designToolQuote, axis.key),
        }
      }
      if (axis.key === 'measurable' && axis.level === 'insufficient_info' && designOutcomeQuote) {
        return {
          ...axis,
          level: 'mixed_signal',
          levelLabel: levelToKo('mixed_signal'),
          summary: '품질과 납기 기준은 보이지만, 숫자 성과나 사용자 반응 지표까지는 공고에 드러나지 않습니다.',
          evidence: createRawEvidence(designOutcomeQuote, axis.key),
        }
      }
      if (axis.key === 'difficulty' && axis.level === 'insufficient_info' && designDifficultyQuote) {
        return {
          ...axis,
          level: 'positive_with_check',
          levelLabel: levelToKo('positive_with_check'),
          summary: '최우선 프로젝트와 고객 경험 정의 역할이 적혀 있어 단순 제작보다 난도 높은 과제를 맡을 가능성이 보입니다.',
          evidence: createRawEvidence(designDifficultyQuote, axis.key),
        }
      }
      if (axis.key === 'scopeClarity' && axis.level === 'insufficient_info' && designScopeQuote) {
        return {
          ...axis,
          level: 'mixed_signal',
          levelLabel: levelToKo('mixed_signal'),
          summary: '플랫폼 전반을 지원하고 산출물 종류도 넓게 적혀 있어 역할 범위는 보이지만, 핵심 전문성이 어디에 집중되는지는 확인이 필요합니다.',
          evidence: createRawEvidence(designScopeQuote, axis.key),
        }
      }
    }

    return axis
  })
}

function judgeAxis(axis, evidencePool, { usedEvidenceIds = new Set(), usedParagraphCounts = new Map(), jobFamilyId = 'unknown' } = {}) {
  const axisProfile = getAxisProfile(axis, jobFamilyId)
  const riskyEvidence = findEvidenceWithSection(evidencePool, axisProfile.risky, 2)
  const positiveEvidence = findEvidenceWithSection(evidencePool, axisProfile.positive, 2)
  const candidates = [...riskyEvidence, ...positiveEvidence]
    .map((item) =>
      applyEvidenceReusePenalty(
        {
          ...item,
          bestEvidenceScore: (SECTION_WEIGHTS[item.section] || 0) + (item.sourcePriority || 0) * 0.1,
          riskScore: 0,
          positiveScore: 0,
        },
        usedEvidenceIds,
        usedParagraphCounts,
      ),
    )
    .sort((a, b) => b.score - a.score || b.bestEvidenceScore - a.bestEvidenceScore)
  let level = 'insufficient_info'

  if (riskyEvidence.length > positiveEvidence.length) level = 'risk'
  if (positiveEvidence.length > riskyEvidence.length) level = positiveEvidence.length >= 2 ? 'strong_positive' : 'positive_with_check'
  if (riskyEvidence.length > 0 && positiveEvidence.length > 0) {
    level = positiveEvidence.length >= riskyEvidence.length ? 'mixed_signal' : 'risk'
  }
  level = normalizeAxisVerdict(axis.key, level, candidates[0]?.text || '')
  const picked = candidates[0] || null
  return {
    key: axis.key,
    label: axis.label,
    level,
    levelLabel: levelToKo(level),
    summary: renderAxisMessage(axis, level),
    evidence: picked
      ? {
          id: picked.id,
          quote: picked.text,
          section: picked.section,
          axis: axis.key,
          score: typeof picked.score === 'number' ? picked.score : 1,
          sourceType: 'quote',
          paragraphKey: picked.paragraphKey,
        }
      : null,
  }
}

function judgeAxisV2(axis, evidencePool, options = {}) {
  const ranked = rankEvidenceForAxis(axis, evidencePool, options)
  const { level: rawLevel, picked } = resolveAxisLevelFromScore(ranked)
  const level = normalizeAxisVerdict(axis.key, rawLevel, picked?.text || '')

  return {
    key: axis.key,
    label: axis.label,
    level,
    levelLabel: levelToKo(level),
    summary: renderAxisMessage(axis, level),
    evidence: picked
      ? {
          id: picked.id,
          quote: picked.text,
          section: picked.section,
          axis: axis.key,
          score: picked.score,
          sourceType: picked.sourceType,
          paragraphKey: picked.paragraphKey,
        }
      : null,
  }
}

function buildAxes(axisDefinitions, evidencePool, jobFamily) {
  const usedEvidenceIds = new Set()
  const usedParagraphCounts = new Map()
  const jobFamilyId = jobFamily?.id || 'unknown'

  return axisDefinitions.map((axis) => {
    const judgment = isEvidenceV2Enabled()
      ? judgeAxisV2(axis, evidencePool, { usedEvidenceIds, usedParagraphCounts, jobFamilyId })
      : judgeAxis(axis, evidencePool, { usedEvidenceIds, usedParagraphCounts, jobFamilyId })

    const pickedId = judgment.evidence?.id
    const pickedParagraphKey = judgment.evidence?.paragraphKey
    if (pickedId) usedEvidenceIds.add(pickedId)
    if (pickedParagraphKey) usedParagraphCounts.set(pickedParagraphKey, (usedParagraphCounts.get(pickedParagraphKey) || 0) + 1)
    return judgment
  })
}

function buildSevenAxes(evidencePool, jobFamily) {
  return buildAxes(SEVEN_AXES, evidencePool, jobFamily)
}

function createRawEvidence(quote, axisKey) {
  if (!quote) return null
  return {
    id: `reliability:${axisKey}:${normalizeWord(quote).slice(0, 24)}`,
    quote,
    section: 'raw',
    axis: axisKey,
    score: 1.5,
    sourceType: 'quote',
    paragraphKey: `reliability:${axisKey}`,
  }
}

function joinEvidenceQuotes(...quotes) {
  return quotes
    .flatMap((item) => String(item || '').split('\n'))
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index)
    .join('\n')
}

function evidenceExistsInSource(quote, sourceText) {
  if (!quote) return false
  const segments = String(quote)
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
  if (!segments.length) return false
  return segments.every((segment) => sourceText.includes(segment))
}

function applyReliabilityGateToAxes(sevenAxes, structured) {
  const reliabilityGate = structured?.reliabilityGate || buildReliabilityGate(structured)
  const gateSignalMap = new Map(reliabilityGate.allSignals.map((signal) => [signal.key, signal]))
  const m365OperationsQuote = findRawLine(
    structured?.lines,
    (line) =>
      /(m365|office 365|기술지원)/i.test(line) &&
      /운영/i.test(line) &&
      !/(자동화|개선|고도화|분석|정책)/i.test(line) &&
      !isEvidenceNoiseLine(line),
  )

  return (sevenAxes || []).map((axis) => {
    if (axis.key === 'repetition' && m365OperationsQuote && axis.level !== 'strong_positive') {
      return {
        ...axis,
        level: 'risk',
        levelLabel: levelToKo('risk'),
        summary: '운영·기술지원 중심 역할로 보여 반복 요청 처리 비중을 먼저 확인해야 합니다.',
        evidence: createRawEvidence(m365OperationsQuote, axis.key),
      }
    }

    if (axis.key === 'scopeClarity') {
      const signal = gateSignalMap.get('hiddenWorkDetails') || gateSignalMap.get('rankRoleConflict') || gateSignalMap.get('multiLocation')
      if (signal) {
        return {
          ...axis,
          level: 'risk',
          levelLabel: levelToKo('risk'),
          summary: '업무 공개 범위나 역할 레벨이 흐려 실제 담당 범위를 면접 전에는 확정하기 어렵습니다.',
          evidence: createRawEvidence(signal.quote, axis.key),
        }
      }
    }

    if (axis.key === 'responsibility') {
      const signal = gateSignalMap.get('rankRoleConflict') || gateSignalMap.get('hiddenWorkDetails')
      if (signal && axis.level === 'strong_positive') {
        return {
          ...axis,
          level: 'positive_with_check',
          levelLabel: levelToKo('positive_with_check'),
          summary: '직급·직책 또는 업무 공개 범위가 흐려 실제 권한과 책임은 추가 확인이 필요합니다.',
          evidence: createRawEvidence(signal.quote, axis.key),
        }
      }
    }

    return axis
  })
}

function buildFiveAxesFromSevenAxes(sevenAxes) {
  return (sevenAxes || []).filter((axis) => FIVE_AXIS_KEYS.has(axis?.key))
}

function buildFiveAxes(evidencePool, jobFamily) {
  return buildAxes(AXES, evidencePool, jobFamily)
}

function toSchemaEvidence(evidence) {
  if (!evidence?.quote) return { quote: '', sourceType: 'none' }
  return {
    quote: evidence.quote,
    sourceType: evidence.sourceType || 'quote',
  }
}

function findEmploymentFormEvidence(sourceLines) {
  const lines = sourceLines || []
  const riskyQuote = lines.find((line) => /(계약직|파견|외주|프리랜서|인턴|전환형|정규직 전환|프로젝트 계약)/i.test(line))
  if (riskyQuote) {
    return { quote: riskyQuote, level: 'medium' }
  }
  const regularQuote = lines.find((line) => /정규직/i.test(line))
  if (regularQuote) {
    return { quote: regularQuote, level: 'low' }
  }
  return { quote: '', level: 'insufficient_info' }
}

function collectAuxiliarySourceLines(structured, mode = 'default') {
  const sectionKeysByMode = {
    employmentForm: ['position_summary', 'responsibilities', 'requirements', 'preferred', 'hiring_process', 'others'],
    orgPosition: ['position_summary', 'responsibilities', 'requirements', 'preferred', 'hiring_process', 'location', 'others'],
    processMaturity: ['position_summary', 'responsibilities', 'requirements', 'preferred'],
    default: ['position_summary', 'responsibilities', 'requirements', 'preferred', 'hiring_process', 'location', 'others'],
  }
  const sectionKeys = sectionKeysByMode[mode] || sectionKeysByMode.default
  return sectionKeys
    .flatMap((key) => structured?.sectionsNormalized?.[key] || [])
    .map((line) => String(line || '').trim())
    .filter(Boolean)
    .filter((line) => !BLOCKED_PATTERNS.some((pattern) => pattern.test(line)) && !isEvidenceNoiseLine(line))
}

function buildAuxiliaryChecks(structured) {
  const sourceLines = collectAuxiliarySourceLines(structured)
  const employmentSourceLines = collectAuxiliarySourceLines(structured, 'employmentForm')
  const orgPositionSourceLines = collectAuxiliarySourceLines(structured, 'orgPosition')
  const processMaturitySourceLines = collectAuxiliarySourceLines(structured, 'processMaturity')
  const reliabilityGate = structured?.reliabilityGate || buildReliabilityGate(structured)
  const reliabilitySignalMap = new Map(reliabilityGate.allSignals.map((signal) => [signal.key, signal]))
  const compensationQuote = findRawLine(
    structured?.lines,
    (line) => /(월급여|월 급여|용역비|급여|보수)/i.test(line) && /(만원|원)/.test(line),
  )
  const compensationNeedsContractCheck = Boolean(
    compensationQuote &&
      (reliabilitySignalMap.has('contractConflict') || employmentSourceLines.some((line) => /(프리랜스|도급|용역)/i.test(line))),
  )
  const signalKeysByCheck = {
    applicationSafety: ['ambiguousCompany', 'personalEmail', 'entityUnverifiable'],
    contractConsistency: ['contractConflict'],
    workLocationClarity: ['multiLocation'],
    roleClarity: ['hiddenWorkDetails', 'rankRoleConflict'],
  }

  return AUXILIARY_CHECKS.map((check) => {
    const checkSourceLines =
      check.key === 'employmentForm'
        ? employmentSourceLines
        : check.key === 'orgPosition'
          ? orgPositionSourceLines
          : check.key === 'processMaturity'
            ? processMaturitySourceLines
            : sourceLines
    const mappedSignal = (signalKeysByCheck[check.key] || []).map((key) => reliabilitySignalMap.get(key)).find(Boolean) || null
    const pairedLocationQuote = check.key === 'workLocationClarity' ? findInterviewAndWorkLocationPairQuote(structured?.lines) : ''
    const employmentFormEvidence = check.key === 'employmentForm' ? findEmploymentFormEvidence(checkSourceLines) : null
    const quote =
      mappedSignal?.quote ||
      pairedLocationQuote ||
      employmentFormEvidence?.quote ||
      checkSourceLines.find((line) => check.patterns.some((pattern) => line.includes(pattern))) ||
      ''
    const hasEvidence = Boolean(quote)
    let level = employmentFormEvidence?.level || (hasEvidence ? 'medium' : 'insufficient_info')
    if (check.key === 'applicationSafety') {
      if (reliabilityGate.criticalCount >= 2) level = 'high'
      else if (reliabilityGate.criticalCount >= 1) level = 'medium'
      else if (reliabilityGate.cautionCount > 0) level = 'low'
    } else if (check.key === 'contractConsistency') {
      if (reliabilitySignalMap.has('contractConflict')) level = 'high'
    } else if (check.key === 'workLocationClarity' || check.key === 'roleClarity') {
      if (reliabilitySignalMap.has(check.key === 'workLocationClarity' ? 'multiLocation' : 'rankRoleConflict')) level = 'medium'
      if (reliabilitySignalMap.has('hiddenWorkDetails') && check.key === 'roleClarity') level = 'medium'
    }

    let summary = mappedSignal?.label || (hasEvidence ? check.summaryWithEvidence : check.summaryWithoutEvidence)
    let question = mappedSignal?.question || check.question
    if (check.key === 'workLocationClarity' && pairedLocationQuote) {
      summary = '실제 근무지가 복수로 병기되어 있습니다.'
      question = '실제 근무지와 상주 여부가 어디로 확정되는지 알 수 있나요?'
    }

    if (compensationNeedsContractCheck && (check.key === 'contractConsistency' || check.key === 'employmentForm')) {
      summary = `${summary} 월급여·용역비 표기가 있어 세전/세후, 4대보험, 퇴직금, 연차, 세금 처리 기준도 계약서로 확인해야 합니다.`
      if (check.key === 'contractConsistency') {
        question =
          '파견인지 프리랜스인지, 실제 소속과 함께 월급여·용역비가 세전/세후 중 무엇인지, 4대보험·퇴직금·연차·세금 처리를 계약서로 확인할 수 있나요?'
      }
    }

    return {
      key: check.key,
      label: check.label,
      level,
      levelLabel: levelToKo(level),
      summary,
      evidence: { quote, sourceType: hasEvidence ? 'quote' : 'none' },
      question,
      goodAnswerSignal: check.goodAnswerSignal,
      riskyAnswerSignal: check.riskyAnswerSignal,
    }
  })
}

function filterAuxiliaryChecksForDisplay(auxiliaryChecks = [], reliabilityGate = null) {
  const reliabilityKeys = new Set(['applicationSafety', 'contractConsistency', 'workLocationClarity', 'roleClarity'])
  const activeReliabilityKeys = new Set((reliabilityGate?.allSignals || []).map((signal) => {
    if (['personalEmail', 'ambiguousCompany', 'entityUnverifiable'].includes(signal.key)) return 'applicationSafety'
    if (signal.key === 'contractConflict') return 'contractConsistency'
    if (signal.key === 'multiLocation') return 'workLocationClarity'
    if (['hiddenWorkDetails', 'rankRoleConflict'].includes(signal.key)) return 'roleClarity'
    return signal.key
  }))

  return (auxiliaryChecks || []).filter((check) => {
    if (!check) return false
    const hasEvidence = Boolean(check?.evidence?.quote)
    if (reliabilityKeys.has(check.key)) {
      if (check.key === 'workLocationClarity' && !activeReliabilityKeys.has(check.key)) {
        return hasEvidence && ['high', 'medium'].includes(check.level)
      }
      if (!activeReliabilityKeys.has(check.key)) return false
      return hasEvidence || ['high', 'medium'].includes(check.level)
    }
    if (check.key === 'employmentForm') {
      return hasEvidence
    }
    return hasEvidence && check.level !== 'insufficient_info'
  })
}

function levelToKo(level) {
  if (level === 'risk') return '위험 신호 있음'
  if (level === 'mixed_signal') return '좋아 보이지만 범위 확인 필요'
  if (level === 'positive_with_check') return '긍정 신호 있음 · 확인 필요'
  if (level === 'strong_positive') return '긍정 신호 강함'
  if (level === 'insufficient_info') return '정보 부족'
  if (level === 'high') return '위험 높음'
  if (level === 'medium') return '추가 확인 필요'
  if (level === 'low') return '위험 낮음'
  return '근거 부족'
}

function axisLevelToOverallRisk(level) {
  if (level === 'risk') return 'high'
  if (level === 'mixed_signal' || level === 'positive_with_check' || level === 'insufficient_info') return 'medium'
  if (level === 'strong_positive') return 'low'
  return level
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

function selectIssueAxes(fiveAxes, max = 3) {
  const issueLevels = ['risk', 'mixed_signal', 'positive_with_check']
  const selected = fiveAxes.filter((axis) => issueLevels.includes(axis?.level)).sort(compareAxisPriority)
  if (selected.length >= max) return selected.slice(0, max)
  if (selected.length > 0) {
    const positiveFallback = fiveAxes
      .filter((axis) => !selected.some((picked) => picked.key === axis.key) && axis?.level === 'strong_positive')
      .sort(compareAxisPriority)
    const fallback = fiveAxes
      .filter((axis) => !selected.some((picked) => picked.key === axis.key) && axis?.level !== 'strong_positive')
      .sort(compareAxisPriority)
    return [...selected, ...positiveFallback, ...fallback].slice(0, max)
  }

  const strongPositiveFallback = fiveAxes.filter((axis) => axis?.level === 'strong_positive').sort(compareAxisPriority)
  if (strongPositiveFallback.length > 0) return strongPositiveFallback.slice(0, Math.min(max, strongPositiveFallback.length))

  const fallback = fiveAxes.filter((axis) => axis?.level !== 'strong_positive').sort(compareAxisPriority)
  if (fallback.length > 0) return fallback.slice(0, Math.min(max, fallback.length))
  return fiveAxes.slice(0, Math.min(max, fiveAxes.length))
}

function overallRisk(axes, jobFamily, criteriaMatch, options = {}) {
  const sevenAxes = Array.isArray(options.sevenAxes) && options.sevenAxes.length > 0 ? options.sevenAxes : axes
  const auxiliaryChecks = Array.isArray(options.auxiliaryChecks) ? options.auxiliaryChecks : []
  const sourceText = String(options.sourceText || '')
  if (jobFamily.confidence === 'low' && !criteriaMatch) {
    const hasAnySignal = axes.some((axis) => axis.level !== 'insufficient_info')
    return hasAnySignal ? 'medium' : 'needs_review'
  }

  const axisMap = new Map(sevenAxes.map((axis) => [axis.key, axis]))
  const levelOf = (key) => axisMap.get(key)?.level || 'insufficient_info'
  const countByLevel = (targetLevel, pool = sevenAxes) => pool.filter((axis) => axis.level === targetLevel).length
  const countKeyLevels = (keys, levels) =>
    keys.filter((key) => levels.includes(levelOf(key))).length
  const hasAuxiliarySignal = (key) =>
    auxiliaryChecks.some((check) => check?.key === key && check?.level === 'medium' && check?.evidence?.quote)

  const normalizedLevels = axes.map((axis) => axisLevelToOverallRisk(axis.level))
  const high = normalizedLevels.filter((level) => level === 'high').length
  const strongPositive = countByLevel('strong_positive')
  const mixed = countByLevel('mixed_signal')
  const check = countByLevel('positive_with_check')
  const insufficient = countByLevel('insufficient_info')
  const noRisk = high === 0

  const repetitionLevel = levelOf('repetition')
  const responsibilityLevel = levelOf('responsibility')
  const measurableLevel = levelOf('measurable')
  const difficultyLevel = levelOf('difficulty')
  const transferableLevel = levelOf('transferable')
  const learningFeedbackLevel = levelOf('learningFeedback')
  const scopeClarityLevel = levelOf('scopeClarity')

  const coreKeys = ['responsibility', 'measurable', 'transferable', 'learningFeedback']
  const corePositiveCount = countKeyLevels(coreKeys, ['positive_with_check', 'strong_positive'])
  const coreStrongCount = countKeyLevels(coreKeys, ['strong_positive'])
  const coreMixedCount = countKeyLevels(coreKeys, ['mixed_signal'])

  const employmentSignal = hasAuxiliarySignal('employmentForm')
  const highCombo =
    repetitionLevel === 'risk' &&
    responsibilityLevel === 'insufficient_info' &&
    ['insufficient_info', 'positive_with_check'].includes(measurableLevel) &&
    ['insufficient_info', 'positive_with_check'].includes(difficultyLevel) &&
    ['insufficient_info', 'positive_with_check', 'mixed_signal'].includes(transferableLevel) &&
    employmentSignal
  const manufacturingOperationalHighCandidate =
    jobFamily.id === 'manufacturing' &&
    repetitionLevel === 'risk' &&
    /(계약직|1년 계약직)/i.test(sourceText) &&
    hasManufacturingOperationalSignals(sourceText) &&
    !hasExplicitProcessImprovementOwnership(sourceText) &&
    ['insufficient_info', 'positive_with_check'].includes(measurableLevel) &&
    ['insufficient_info', 'positive_with_check'].includes(difficultyLevel)
  const broadEducationOperationsHighCandidate =
    ['education', 'hr', 'public'].includes(jobFamily.id) &&
    repetitionLevel === 'risk' &&
    hasBroadEducationOperationsSignals(sourceText) &&
    responsibilityLevel === 'insufficient_info' &&
    measurableLevel === 'insufficient_info' &&
    difficultyLevel === 'insufficient_info'

  const lowCandidate =
    noRisk &&
    coreMixedCount === 0 &&
    (
      (corePositiveCount >= 4 && (repetitionLevel !== 'mixed_signal' || strongPositive === 0)) ||
      (corePositiveCount >= 4 && repetitionLevel === 'mixed_signal' && strongPositive <= 1) ||
      (corePositiveCount >= 3 &&
        coreStrongCount >= 2 &&
        measurableLevel === 'strong_positive' &&
        repetitionLevel !== 'mixed_signal')
    )

  const productLowCandidate =
    jobFamily.id === 'product' &&
    noRisk &&
    strongPositive >= 3 &&
    ['strong_positive', 'positive_with_check'].includes(responsibilityLevel) &&
    ['strong_positive', 'positive_with_check'].includes(measurableLevel) &&
    ['strong_positive', 'positive_with_check'].includes(transferableLevel) &&
    ['strong_positive', 'positive_with_check'].includes(learningFeedbackLevel) &&
    ['strong_positive', 'positive_with_check'].includes(scopeClarityLevel)

  const productNeedsVerificationCandidate =
    jobFamily.id === 'product' &&
    noRisk &&
    strongPositive >= 2 &&
    corePositiveCount >= 3 &&
    ['positive_with_check', 'strong_positive'].includes(measurableLevel)

  const needsVerificationCandidate =
    noRisk &&
    (
      (mixed > 0 && strongPositive >= 1) ||
      (strongPositive >= 2 &&
        measurableLevel === 'positive_with_check' &&
        ['positive_with_check', 'insufficient_info'].includes(learningFeedbackLevel)) ||
      (['positive_with_check', 'insufficient_info'].includes(responsibilityLevel) &&
        ['positive_with_check', 'insufficient_info'].includes(measurableLevel) &&
        (corePositiveCount >= 2 || coreStrongCount >= 1))
    )

  if (high >= 2) return 'high'
  if (highCombo) return 'high'
  if (manufacturingOperationalHighCandidate) return 'high'
  if (broadEducationOperationsHighCandidate) return 'high'
  if (jobFamily.id === 'development' && noRisk && coreStrongCount >= 2) return 'low'
  if (productLowCandidate) return 'low'
  if (lowCandidate) return 'low'
  if (productNeedsVerificationCandidate) return 'needs_review'
  if (needsVerificationCandidate) return 'needs_review'
  if (high === 1 || mixed > 0 || check >= 2) return 'medium'
  if (criteriaMatch?.level === 'medium') return 'medium'
  if (insufficient >= Math.max(3, Math.ceil(sevenAxes.length / 2))) return 'needs_review'
  return 'low'
}

function buildPrimaryQuestion({ jobFamily, fiveAxes, criteria }) {
  const responsibility = fiveAxes.find((axis) => axis.key === 'responsibility')
  const repetition = fiveAxes.find((axis) => axis.key === 'repetition')
  const measurable = fiveAxes.find((axis) => axis.key === 'measurable')
  const scopeClarity = fiveAxes.find((axis) => axis.key === 'scopeClarity')

  if (jobFamily?.id === 'development') {
    if (responsibility?.level === 'positive_with_check' || responsibility?.level === 'insufficient_info') {
      return '이 포지션이 실제로 기술 선택과 아키텍처 의사결정에 참여하는 범위는 어디까지인가요?'
    }
    if (repetition?.level === 'positive_with_check' || repetition?.level === 'insufficient_info' || repetition?.level === 'risk') {
      return '신규 기능 개발과 운영·유지보수 업무의 비중은 어느 정도인가요?'
    }
  }

  if (jobFamily?.id === 'product') {
    if (measurable?.level === 'strong_positive' || measurable?.level === 'positive_with_check') {
      return '입사 후 6개월 목표의 현재 기준선과 목표 미달성 시 평가 방식은 어떻게 되나요?'
    }
    if (responsibility?.level === 'strong_positive' || responsibility?.level === 'positive_with_check') {
      return '이 역할의 의사결정 범위와 최종 승인권자는 누구인가요?'
    }
    if (repetition?.level === 'risk' || repetition?.level === 'positive_with_check') {
      return '운영성 업무와 문제 정의·실험 설계 업무의 실제 비중은 어느 정도인가요?'
    }
  }

  if (jobFamily?.id === 'design') {
    if (responsibility?.level === 'positive_with_check' || responsibility?.level === 'insufficient_info') {
      return '이 역할에서 제가 직접 방향을 제안하고 결정할 수 있는 범위는 어디까지인가요?'
    }
    if (repetition?.level === 'risk' || repetition?.level === 'mixed_signal' || repetition?.level === 'positive_with_check') {
      return '요청받은 제작 업무와 문제 정의·제안 업무의 실제 비중은 어느 정도인가요?'
    }
    if (measurable?.level === 'insufficient_info') {
      return '이 역할의 결과물은 어떤 기준이나 지표로 평가하나요?'
    }
  }

  if (jobFamily?.id === 'marketing') {
    if (scopeClarity?.level === 'risk' || scopeClarity?.level === 'mixed_signal') {
      return '자사몰, CRM, 콘텐츠, 프로모션, 협업 업무 중 실제 주업무는 무엇이고 각각의 비중은 어떻게 나뉘나요?'
    }
    if (responsibility?.level === 'mixed_signal' || responsibility?.level === 'positive_with_check') {
      return '예산, 채널, 프로모션, 우선순위 중 제가 직접 결정하거나 제안할 수 있는 범위는 어디까지인가요?'
    }
    if (measurable?.level === 'mixed_signal' || measurable?.level === 'positive_with_check') {
      return 'ROAS, CVR, 매출, 리텐션 같은 지표 중 제가 직접 책임지는 항목은 무엇인가요?'
    }
    if (repetition?.level === 'risk' || repetition?.level === 'mixed_signal') {
      return '반복 운영 업무와 기획·개선 업무의 실제 비중은 어느 정도인가요?'
    }
  }

  return criteria?.interviewQuestions?.[0] || '입사 후 3개월 안에 제가 직접 책임져야 하는 산출물과 평가 기준은 무엇인가요?'
}

function buildPreviewHeadline({ risk, jobFamily, fiveAxes }) {
  const responsibility = fiveAxes.find((axis) => axis.key === 'responsibility')
  const repetition = fiveAxes.find((axis) => axis.key === 'repetition')
  const difficulty = fiveAxes.find((axis) => axis.key === 'difficulty')
  const measurable = fiveAxes.find((axis) => axis.key === 'measurable')
  const transferable = fiveAxes.find((axis) => axis.key === 'transferable')
  const hasAnySignal = fiveAxes.some((axis) => axis.level !== 'insufficient_info')

  if (jobFamily?.id === 'development') {
    if (risk === 'low') {
      return '이 공고는 단순 반복 개발보다 설계·고도화 성격이 더 강해 보입니다.'
    }
    if (risk === 'medium') {
      if (responsibility?.level === 'positive_with_check' || responsibility?.level === 'insufficient_info') {
        return '기술 성장 가능성은 보이지만, 실제 권한과 역할 범위는 확인이 필요합니다.'
      }
      if (repetition?.level === 'positive_with_check' || repetition?.level === 'insufficient_info' || repetition?.level === 'risk') {
        return '신규 개발 비중은 있어 보이지만, 운영·유지보수 비중은 확인이 필요합니다.'
      }
      if (difficulty?.level === 'strong_positive') {
        return '기술 난이도는 높아 보이지만, 실제로 더 어려운 문제를 맡는 구조인지는 확인이 필요합니다.'
      }
      return '기술적으로는 좋은 신호가 있지만, 실제 업무 범위는 확인이 필요합니다.'
    }
  }

  if (jobFamily?.id === 'marketing') {
    if (responsibility?.level === 'mixed_signal') {
      return '브랜드 기획 문구는 보이지만, 실제 권한 범위는 면접에서 확인이 필요합니다.'
    }
    if (measurable?.level === 'mixed_signal' || measurable?.level === 'positive_with_check') {
      return '결과 보고 문구는 보이지만, KPI와 성과 책임 범위는 면접에서 확인이 필요합니다.'
    }
  }

  if (jobFamily?.id === 'product') {
    if (
      risk === 'low' &&
      ['strong_positive', 'positive_with_check'].includes(responsibility?.level) &&
      ['strong_positive', 'positive_with_check'].includes(measurable?.level) &&
      ['strong_positive', 'positive_with_check'].includes(transferable?.level)
    ) {
      return '목표, 권한, 산출물 구조가 비교적 명확해 경력 자산으로 이어질 가능성이 높아 보입니다.'
    }
    if (risk === 'needs_review' || risk === 'medium') {
      return '좋은 신호는 많지만, 기준선과 평가 방식 같은 세부 기준은 면접에서 더 확인해야 합니다.'
    }
  }

  const headlineMap = {
    high: '물경력 위험 신호가 비교적 강하게 보입니다.',
    medium: '공고만으로는 역할 범위가 충분히 선명하지 않아 추가 확인이 필요합니다.',
    low: '현재 공고만 보면 물경력 위험은 낮아 보입니다.',
    needs_review: hasAnySignal ? '좋아 보이는 표현은 있지만, 실제 역할 범위는 더 확인이 필요합니다.' : '공고만으로는 판단 근거가 부족합니다.',
  }

  return headlineMap[risk]
}

function buildPreviewHeadlineFromLeadRisk({ leadRisk, risk, jobFamily, fiveAxes }) {
  if (!leadRisk?.key) return buildPreviewHeadline({ risk, jobFamily, fiveAxes })

  if (leadRisk.key === 'scopeClarity') {
    if (jobFamily?.id === 'marketing') {
      return '업무 범위가 넓게 묶여 있어 실제 주업무와 우선순위를 먼저 확인해야 합니다.'
    }
    if (jobFamily?.id === 'sales') {
      return '영업 전략 문구가 있어도 실제로는 파트너 운영과 가격 조건 협의 비중이 더 큰지 먼저 확인해야 합니다.'
    }
    if (jobFamily?.id === 'development') {
      return '신규 개발 외 운영·협업 업무 비중이 함께 묶여 있으면 실제 주업무를 먼저 확인해야 합니다.'
    }
    return '업무 범위가 넓게 묶여 있어 실제 핵심 업무를 먼저 확인해야 합니다.'
  }

  if (leadRisk.key === 'responsibility') {
    return jobFamily?.id === 'marketing'
      ? '전략 문구는 보이지만 실제 결정권 범위는 면접에서 확인해야 합니다.'
      : '역할은 적혀 있지만 실제 결정권 범위는 면접에서 확인해야 합니다.'
  }

  if (leadRisk.key === 'measurable') {
    return jobFamily?.id === 'marketing'
      ? '성과 분석 문구는 보이지만 직접 책임지는 KPI는 면접에서 확인해야 합니다.'
      : '성과 문구는 보이지만 직접 책임지는 평가 기준은 면접에서 확인해야 합니다.'
  }

  if (leadRisk.key === 'repetition') {
    return '개선 문구가 있어도 운영 비중이 더 크면 경력 자산이 약해질 수 있어 확인이 필요합니다.'
  }

  return toSentenceLimitedText(leadRisk.summary, 1) || buildPreviewHeadline({ risk, jobFamily, fiveAxes })
}

function previewFocusAxes(fiveAxes, risk = 'medium') {
  const priorities = risk === 'low'
    ? ['strong_positive', 'positive_with_check', 'mixed_signal', 'insufficient_info']
    : ['risk', 'mixed_signal', 'positive_with_check', 'insufficient_info']
  const selected = priorities.flatMap((level) => fiveAxes.filter((axis) => axis.level === level))
  if (selected.length > 0) return selected.slice(0, 2)
  const fallback = risk === 'low'
    ? fiveAxes
    : fiveAxes.filter((axis) => axis.level !== 'strong_positive')
  if (fallback.length > 0) return fallback.slice(0, 2)
  return fiveAxes.slice(0, 1)
}

function buildPreviewShortReason(axis) {
  const templates = {
    repetition: {
      risk: '단순 운영 비중에서 주의 신호가 보입니다. 반복 운영 중심인지, 기획·개선 업무가 함께 있는지 확인해야 합니다.',
      mixed_signal: '기획 문구는 보이지만, 실제로는 운영·조율 비중이 큰 역할일 수 있어 범위를 확인해야 합니다.',
      positive_with_check: '단순 운영 비중은 공고만으로 확정하기 어렵습니다. 반복 운영과 개선 업무 비중을 확인해야 합니다.',
      insufficient_info: '단순 운영 비중을 판단할 근거가 공고에 충분하지 않습니다. 반복 운영과 개선 업무 비중을 확인해야 합니다.',
      strong_positive: '단순 운영보다 기획·개선 업무 가능성은 보입니다. 실제 개선 책임까지 맡는지 확인해야 합니다.',
    },
    responsibility: {
      risk: '내 권한과 책임 범위가 좁을 가능성이 보입니다. 결과 책임과 결정 권한을 어디까지 맡는지 확인해야 합니다.',
      mixed_signal: '좋아 보이는 역할 설명은 있지만, KPI·예산·의사결정 권한이 빠져 있어 실제 책임 범위를 확인해야 합니다.',
      positive_with_check: '내 권한과 책임 범위가 공고에서 분명하지 않습니다. 결과 책임과 결정 권한을 확인해야 합니다.',
      insufficient_info: '내 권한과 책임 범위를 판단할 근거가 공고에 부족합니다. 결과 책임과 결정 권한을 확인해야 합니다.',
      strong_positive: '권한과 책임 신호는 일부 보입니다. 실제 의사결정 범위까지 맡는지 확인해야 합니다.',
    },
    measurable: {
      risk: '성과를 설명하기 어려운 역할일 가능성이 보입니다. 어떤 지표나 결과물로 평가하는지 확인해야 합니다.',
      mixed_signal: '결과 보고 문구는 보이지만, 실제 KPI ownership이 없어 보고용 역할에 머물 수 있는지 확인해야 합니다.',
      positive_with_check: '성과 기준이 일부 보이지만 공고만으로는 충분하지 않습니다. 어떤 지표와 결과물로 평가하는지 확인해야 합니다.',
      insufficient_info: '성과 기준이 공고에 충분히 드러나지 않습니다. 어떤 지표와 결과물로 평가하는지 확인해야 합니다.',
      strong_positive: '성과를 남길 가능성은 보입니다. 실제 KPI와 결과물 기준을 확인해야 합니다.',
    },
    difficulty: {
      risk: '더 어려운 문제를 맡는 성장 구조가 약할 수 있습니다. 시간이 갈수록 난도가 올라가는 역할인지 확인해야 합니다.',
      mixed_signal: '확장된 역할처럼 보이지만, 실제로 더 어려운 문제를 맡는 성장 구조인지는 확인이 필요합니다.',
      positive_with_check: '성장 기회는 일부 보이지만 난이도 상승 구조는 더 확인이 필요합니다. 시간이 갈수록 더 어려운 문제를 맡는지 확인해야 합니다.',
      insufficient_info: '난이도 상승 구조를 판단할 근거가 공고에 부족합니다. 시간이 갈수록 더 어려운 문제를 맡는지 확인해야 합니다.',
      strong_positive: '어려운 문제를 맡을 가능성은 보입니다. 실제 성장 경로와 다음 단계 책임을 확인해야 합니다.',
    },
    transferable: {
      risk: '다음 이직에도 설명할 성과가 남기 어려울 수 있습니다. 외부에서도 설명 가능한 결과물이 남는지 확인해야 합니다.',
      mixed_signal: '경력 자산이 될 만한 표현은 있지만, 실제로 포트폴리오에 남는 결과물인지 확인이 필요합니다.',
      positive_with_check: '경험이 남을 가능성은 있지만 공고만으로는 충분히 분명하지 않습니다. 외부에서도 설명 가능한 결과물이 남는지 확인해야 합니다.',
      insufficient_info: '이 경험이 다음 커리어에 남을지 판단할 근거가 부족합니다. 외부에서도 설명 가능한 결과물이 남는지 확인해야 합니다.',
      strong_positive: '경험이 남을 가능성은 보입니다. 실제 결과물이 이력서에 어떻게 남는지 확인해야 합니다.',
    },
  }

  return templates[axis?.key]?.[axis?.level] || null
}

function buildPreviewFallbackReason(fiveAxes) {
  const fallbackOrder = ['responsibility', 'repetition', 'measurable', 'difficulty', 'transferable']
  for (const key of fallbackOrder) {
    const axis = fiveAxes.find((item) => item.key === key)
    const reason = buildPreviewShortReason({
      ...axis,
      key,
      level: axis?.level === 'strong_positive' ? 'strong_positive' : 'insufficient_info',
    })
    if (reason) return reason
  }
  return '이 역할이 실행만 맡는지, 결과와 방향까지 맡는지 확인이 필요합니다.'
}

function sanitizeFreePreviewText(text) {
  return String(text || '')
    .replace(/\s*회사 맥락상 .+$/u, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function isGenericFreePreviewSummary(text) {
  const value = sanitizeFreePreviewText(text)
  if (!value) return true
  return [
    '현재 공고 기준으로 주의 신호가 확인됩니다.',
    '좋아 보이는 표현은 있지만, 실제 역할 범위는 더 확인해야 합니다.',
    '핵심 정보는 비교적 충분하지만, 세부 기준은 추가 확인이 필요합니다.',
    '현재 공고 기준으로 긍정 신호가 비교적 분명합니다.',
    '현재 공고만으로는 판단 근거가 부족합니다.',
  ].includes(value)
}

function buildAxisFreePreviewText(axis) {
  const summary = sanitizeFreePreviewText(axis?.summary)
  if (summary && !isGenericFreePreviewSummary(summary)) return summary
  return buildPreviewShortReason(axis) || ''
}

function scoreAxisFreePreviewCandidate(axis, risk = 'medium') {
  const levelPriority =
    risk === 'low'
      ? { strong_positive: 5, positive_with_check: 4, mixed_signal: 3, insufficient_info: 2, risk: 1 }
      : { risk: 5, mixed_signal: 4, positive_with_check: 3, strong_positive: 2, insufficient_info: 1 }

  const text = buildAxisFreePreviewText(axis)
  let score = levelPriority[axis?.level] || 0
  if (axis?.evidence?.quote) score += 2
  if (!isGenericFreePreviewSummary(axis?.summary)) score += 2
  if (text && !isPreviewTextNearDuplicate(text, axis?.evidence?.quote || '')) score += 1
  return score
}

function selectFreePreviewAxisCandidates(fiveAxes, risk = 'medium') {
  return [...(fiveAxes || [])]
    .map((axis) => {
      const templateText = buildPreviewShortReason(axis) || ''
      const text = buildAxisFreePreviewText(axis)
      return {
        key: axis?.key || '',
        level: axis?.level || '',
        text,
        templateText,
        quote: axis?.evidence?.quote || '',
        score: scoreAxisFreePreviewCandidate(axis, risk),
      }
    })
    .filter((candidate) => candidate.key && candidate.text)
    .sort((a, b) => b.score - a.score)
}

function buildSupportPreviewText(candidate) {
  if (!candidate) return ''
  if (candidate.level === 'risk' && candidate.templateText) return candidate.templateText
  return candidate.text || candidate.templateText || ''
}

function buildHighestRiskPreviewReason(fiveAxes) {
  const riskAxis = (fiveAxes || []).find((axis) => axis?.level === 'risk')
  return riskAxis ? buildPreviewShortReason(riskAxis) || '' : ''
}

function detectOperationalRiskPreviewReason(sourceText = '') {
  const text = String(sourceText || '')
  if (!/(반복 운영|요청 처리|모니터링 운영|데이터 취합|등록|업로드|검수|정산 보조|내부 시스템 입력)/i.test(text)) {
    return ''
  }
  return buildPreviewShortReason({ key: 'repetition', level: 'risk' }) || ''
}

function buildReliabilitySupportReason(reliabilityGate) {
  const secondarySignal = (reliabilityGate?.allSignals || []).slice(1).find((signal) => signal?.whyImportant)
  if (!secondarySignal) return ''

  const templates = {
    contractConflict: '개인 제출 안내 외에도 계약 형태 표현이 엇갈려 실제 계약 구조를 문서로 다시 확인해야 합니다.',
    entityUnverifiable: '공식 홈페이지나 법인 정보가 약하면 경력서 제출 전 회사 실체를 먼저 확인하는 편이 안전합니다.',
    multiLocation: '근무지가 여러 곳으로 적혀 있으면 실제 출근 위치와 상주 여부가 달라질 수 있어 먼저 확인해야 합니다.',
    hiddenWorkDetails: '상세 업무가 면접 전 비공개라면 지원 전에 역할 범위와 산출물을 최소한으로 확인해야 합니다.',
    rankRoleConflict: '직급과 직책 표기가 다르면 실제 역할 레벨과 보고 라인을 따로 확인해야 합니다.',
  }

  return templates[secondarySignal.key] || secondarySignal.whyImportant || ''
}

function normalizePreviewTextForDedup(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[“”"'‘’`]/g, '')
    .replace(/[.,!?;:~·\-_/\\[\]{}<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isPreviewTextNearDuplicate(a, b) {
  const normalizedA = normalizePreviewTextForDedup(a)
  const normalizedB = normalizePreviewTextForDedup(b)
  if (!normalizedA || !normalizedB) return false
  if (normalizedA === normalizedB) return true
  return normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA)
}

function buildPreviewInterpretation({ reliabilityGate, shortReasons, fiveAxes }) {
  if (reliabilityGate?.primarySignal?.whyImportant) {
    return reliabilityGate.primarySignal.whyImportant
  }
  return buildPreviewFallbackReason(fiveAxes)
}

function buildPreviewSupportReason({ reliabilityGate, shortReasons, fiveAxes, interpretation }) {
  if (reliabilityGate?.primarySignal) {
    const support = buildReliabilitySupportReason(reliabilityGate)
    if (support && !isPreviewTextNearDuplicate(support, interpretation)) {
      return support
    }
    return ''
  }

  return (shortReasons || []).find((reason) => reason && !isPreviewTextNearDuplicate(reason, interpretation)) || ''
}

function buildFreePreviewReasonFromAxis(axis) {
  if (!axis) return ''
  if (axis.key === 'scopeClarity') {
    const summary = sanitizeFreePreviewText(axis.summary)
    if (summary) return summary
    if (axis.level === 'risk' || axis.level === 'mixed_signal') {
      return '업무 범위가 넓게 묶여 있어 실제 주업무와 보조 업무 비중을 먼저 확인해야 합니다.'
    }
    if (axis.level === 'positive_with_check' || axis.level === 'insufficient_info') {
      return '업무 항목은 보이지만 핵심 역할과 부수 업무 경계는 더 확인해야 합니다.'
    }
    return '업무 범위는 비교적 보이지만 실제 책임 경계는 한 번 더 확인해야 합니다.'
  }

  return buildPreviewShortReason(axis) || buildAxisFreePreviewText(axis) || ''
}

function buildFreePreviewLeadRiskQuestion({ key, jobFamily, fiveAxes, criteria }) {
  if (key === 'scopeClarity') {
    if (jobFamily?.id === 'marketing') {
      return '이 역할에서 실제 주업무는 무엇이고, 여러 마케팅 업무 중 어디에 가장 많은 시간이 쓰이나요?'
    }
    if (jobFamily?.id === 'sales') {
      return '매출 분석과 영업 전략 수립이 핵심인지, 아니면 파트너 운영과 가격 조건 협의 비중이 더 큰지 확인할 수 있나요?'
    }
    if (jobFamily?.id === 'operations') {
      return '재고 관리, 입출고 대응, 운영 지원 중 실제 핵심 업무는 무엇이고 어디에 가장 많은 시간이 쓰이나요?'
    }
    if (jobFamily?.id === 'development') {
      return '이 역할에서 신규 개발과 운영 대응 중 실제로 더 큰 비중은 어느 쪽인가요?'
    }
    return '이 역할에서 제가 가장 많이 맡게 될 핵심 업무는 무엇인가요?'
  }

  if (key === 'responsibility') {
    if (jobFamily?.id === 'marketing') {
      return '이 역할에서 제가 직접 정하거나 제안할 수 있는 범위는 어디까지인가요?'
    }
    return '이 역할에서 제가 직접 결정하거나 책임지는 범위는 어디까지인가요?'
  }

  if (key === 'measurable') {
    if (jobFamily?.id === 'marketing') {
      return '이 역할에서 제가 직접 책임지는 성과 기준은 무엇인가요?'
    }
    return '이 역할의 성과는 어떤 지표나 결과물로 평가하나요?'
  }

  if (key === 'repetition') {
    return '운영 업무와 개선 업무 중 실제로 더 큰 비중은 어느 쪽인가요?'
  }

  return buildPrimaryQuestion({ jobFamily, fiveAxes, criteria })
}

function buildFreePreviewLeadRisk({ risk, jobFamily, fiveAxes, sevenAxes, criteria, sourceLines = [] }) {
  const axes = (sevenAxes || fiveAxes || []).filter((axis) =>
    ['scopeClarity', 'responsibility', 'measurable', 'repetition', 'transferable', 'difficulty'].includes(axis?.key),
  )
  if (axes.length === 0) return null
  const marketingScopeBreadthJoinedText = sourceLines.join(' ')
  const marketingScopeBreadthLine =
    jobFamily?.id === 'marketing'
      ? findRawLine(
          sourceLines,
          (line) => countDistinctKeywordHits(line, ['자사몰', 'crm', '인플루언서', '콘텐츠', '라이브커머스', '프로모션', '데이터 분석']) >= 3,
        ) ||
        sourceLines.find((line) => /(자사몰|crm|인플루언서|콘텐츠|라이브커머스|프로모션|데이터 분석)/i.test(line)) ||
        ''
      : ''
  const hasMarketingScopeBreadthSignal =
    jobFamily?.id === 'marketing' &&
    countDistinctKeywordHits(marketingScopeBreadthJoinedText, ['자사몰', 'crm', '인플루언서', '콘텐츠', '라이브커머스', '프로모션', '데이터 분석']) >= 4
  const salesPartnerOpsJoinedText = sourceLines.join(' ')
  const salesPartnerOpsLine =
    jobFamily?.id === 'sales'
      ? findRawLine(
          sourceLines,
          (line) =>
            countDistinctKeywordHits(line, ['신규 제휴', '파트너', '객실 재고', '가격 조건', '프로모션', '홀세일', '매출 데이터', '영업 전략']) >= 3,
        ) ||
        sourceLines.find((line) => /(신규 제휴|파트너|객실 재고|가격 조건|프로모션|홀세일|매출 데이터|영업 전략)/i.test(line)) ||
        ''
      : ''
  const hasSalesPartnerOpsSignal =
    jobFamily?.id === 'sales' &&
    countDistinctKeywordHits(salesPartnerOpsJoinedText, ['신규 제휴', '파트너', '객실 재고', '가격 조건', '프로모션', '홀세일', '매출 데이터', '영업 전략']) >= 4

  const levelPriority =
    risk === 'low'
      ? { strong_positive: 0, positive_with_check: 1, mixed_signal: 2, insufficient_info: 3, risk: 4 }
      : { risk: 0, mixed_signal: 1, positive_with_check: 2, insufficient_info: 3, strong_positive: 4 }
  const basePriority = { scopeClarity: 0, responsibility: 1, measurable: 2, repetition: 3, transferable: 4, difficulty: 5 }

  const ranked = [...axes]
    .map((axis) => {
      const hasScopeBreadthCandidate = axis?.key === 'scopeClarity' && hasMarketingScopeBreadthSignal
      const hasSalesPartnerOpsCandidate = axis?.key === 'scopeClarity' && hasSalesPartnerOpsSignal
      const summary = hasScopeBreadthCandidate
        ? '업무 범위가 넓게 묶여 있어 실제 주업무와 보조 업무 비중을 먼저 확인해야 합니다.'
        : hasSalesPartnerOpsCandidate
        ? '영업 전략 문구는 보이지만, 실제로는 파트너 운영과 가격 조건 협의 비중이 더 큰 역할인지 먼저 확인해야 합니다.'
        : buildAxisFreePreviewText(axis) || buildFreePreviewReasonFromAxis(axis)
      const evidenceQuote =
        axis?.evidence?.quote ||
        (hasScopeBreadthCandidate ? marketingScopeBreadthLine : '') ||
        (hasSalesPartnerOpsCandidate ? salesPartnerOpsLine : '')
      let score = (levelPriority[axis?.level] ?? 99) * 10 + (basePriority[axis?.key] ?? 99)
      if (hasScopeBreadthCandidate) score -= 20
      if (hasSalesPartnerOpsCandidate) score -= 18
      if (evidenceQuote) score -= 2
      if (jobFamily?.id === 'marketing' && axis?.key === 'scopeClarity' && /(자사몰|crm|콘텐츠|프로모션|인플루언서|라이브커머스|협업)/i.test(evidenceQuote)) {
        score -= 3
      }
      if (jobFamily?.id === 'marketing' && axis?.key === 'scopeClarity' && /(넓|경계|여러 업무|함께 묶)/.test(summary)) {
        score -= 2
      }
      if (jobFamily?.id === 'sales' && axis?.key === 'scopeClarity' && /(파트너|가격 조건|프로모션|홀세일|영업 전략)/i.test(evidenceQuote)) {
        score -= 3
      }
      if (jobFamily?.id === 'sales' && axis?.key === 'scopeClarity' && /(파트너 운영|가격 조건 협의|영업 전략 문구)/.test(summary)) {
        score -= 2
      }
      return {
        key: axis?.key || '',
        level: axis?.level || '',
        summary,
        quote: evidenceQuote,
        axis,
        score,
      }
    })
    .filter((candidate) => candidate.key && candidate.summary)
    .sort((a, b) => a.score - b.score)

  const lead = ranked[0] || null
  if (!lead) return null

  const supportReasons = []
  const pushReason = (value) => {
    if (!value) return
    if (supportReasons.some((item) => isPreviewTextNearDuplicate(item, value))) return
    supportReasons.push(value)
  }

  pushReason(lead.summary)
  pushReason(buildFreePreviewReasonFromAxis(lead.axis))
  for (const candidate of ranked.slice(1)) {
    if (supportReasons.length >= 2) break
    pushReason(buildFreePreviewReasonFromAxis(candidate.axis))
  }

  return {
    key: lead.key,
    level: lead.level,
    summary: lead.summary,
    quote: lead.quote,
    supportReasons: supportReasons.slice(0, 2),
    verificationQuestion: buildFreePreviewLeadRiskQuestion({
      key: lead.key,
      jobFamily,
      fiveAxes,
      criteria,
    }),
  }
}

function selectPreviewLeadAxis({ fiveAxes, risk }) {
  const axisPriority = ['measurable', 'responsibility', 'transferable', 'difficulty', 'repetition']
  const candidates = [...(fiveAxes || [])].sort((a, b) => {
    const levelPriority =
      risk === 'low'
        ? { strong_positive: 0, positive_with_check: 1, mixed_signal: 2, insufficient_info: 3, risk: 4 }
        : { risk: 0, mixed_signal: 1, positive_with_check: 2, insufficient_info: 3, strong_positive: 4 }
    const levelDiff = (levelPriority[a?.level] ?? 99) - (levelPriority[b?.level] ?? 99)
    if (levelDiff !== 0) return levelDiff
    return (axisPriority.indexOf(a?.key) === -1 ? 99 : axisPriority.indexOf(a?.key)) - (axisPriority.indexOf(b?.key) === -1 ? 99 : axisPriority.indexOf(b?.key))
  })
  return candidates[0] || fiveAxes?.[0] || null
}

function dedupeFreePreviewFields(preview, fallbackPreview, trace = null) {
  const headline = preview?.headline || fallbackPreview?.headline || ''
  const interpretation = preview?.topEvidence?.interpretation || fallbackPreview?.topEvidence?.interpretation || ''
  const verificationQuestion = preview?.verificationQuestion || fallbackPreview?.verificationQuestion || ''
  const dedupedShortReasons = []

  for (const reason of preview?.shortReasons || []) {
    if (!reason) continue
    if (isPreviewTextNearDuplicate(reason, headline)) continue
    if (isPreviewTextNearDuplicate(reason, interpretation)) continue
    if (isPreviewTextNearDuplicate(reason, verificationQuestion)) continue
    if (dedupedShortReasons.some((item) => isPreviewTextNearDuplicate(item, reason))) continue
    dedupedShortReasons.push(reason)
  }

  let safeInterpretation = interpretation
  let replacedBecauseHeadlineDuplicate = false
  let replacedBecauseShortReasonDuplicate = false
  if (isPreviewTextNearDuplicate(safeInterpretation, headline)) {
    safeInterpretation = fallbackPreview?.topEvidence?.interpretation || safeInterpretation
    replacedBecauseHeadlineDuplicate = true
  }
  if (dedupedShortReasons.some((reason) => isPreviewTextNearDuplicate(reason, safeInterpretation))) {
    safeInterpretation = fallbackPreview?.topEvidence?.interpretation || safeInterpretation
    replacedBecauseShortReasonDuplicate = true
  }

  if (trace) {
    trace.dedupe = {
      originalInterpretation: interpretation,
      finalInterpretation: safeInterpretation,
      replacedBecauseHeadlineDuplicate,
      replacedBecauseShortReasonDuplicate,
      fallbackInterpretation: fallbackPreview?.topEvidence?.interpretation || '',
      dedupedShortReasons,
    }
  }

  return {
    ...preview,
    shortReasons: dedupedShortReasons.slice(0, 2),
    topEvidence: {
      ...preview?.topEvidence,
      interpretation: safeInterpretation,
    },
  }
}

function buildPreviewShortReasons(focusAxes, fiveAxes) {
  const reasons = []
  const seenTexts = new Set()
  const seenKeys = new Set()

  for (const axis of focusAxes) {
    if (!axis || seenKeys.has(axis.key)) continue
    if (axis.level === 'strong_positive' && reasons.length > 0) continue
    const reason = buildPreviewShortReason(axis)
    if (!reason || seenTexts.has(reason)) continue
    seenKeys.add(axis.key)
    seenTexts.add(reason)
    reasons.push(reason)
    if (reasons.length >= 2) break
  }

  if (reasons.length === 0) {
    reasons.push(buildPreviewFallbackReason(fiveAxes))
  }

  return reasons
}

function buildPreviewHeadlineWithPrompt({ risk, jobFamily, fiveAxes, reliabilityGate, leadRisk = null }) {
  if (reliabilityGate?.criticalCount >= 2) return '법인 실체와 계약 주체를 확인하기 전에는 지원을 보류하는 편이 안전합니다.'
  if (reliabilityGate?.criticalCount >= 1) return '물경력 판단보다 먼저 경력서 제출 안전성과 계약 구조를 확인해야 합니다.'
  if (reliabilityGate?.cautionCount > 0) return '지원 전에 역할 범위와 계약 조건을 먼저 확인하는 편이 안전합니다.'
  const firstSentence = buildPreviewHeadlineFromLeadRisk({ leadRisk, risk, jobFamily, fiveAxes })
  if (jobFamily?.id === 'product' && ['low', 'medium', 'needs_review'].includes(risk) && !/좋은 신호|경력 자산/.test(firstSentence)) {
    return `좋은 신호는 있지만, ${firstSentence}`
  }
  if (jobFamily?.id === 'product' && risk === 'low') return firstSentence
  if (risk === 'low') return `${firstSentence} 다만 지원 전에 핵심 확인은 필요합니다.`
  if (risk === 'medium') return `${firstSentence} 지원 전에 면접에서 확인할 포인트를 먼저 보세요.`
  if (risk === 'needs_review') return `${firstSentence} 아래 확인 포인트부터 먼저 확인해 보세요.`
  if (risk === 'high') return `${firstSentence} 지원 전에 핵심 확인 포인트를 먼저 보세요.`
  return firstSentence
}

function buildPreviewRiskLabel({ risk, jobFamily, fiveAxes, reliabilityGate }) {
  if (reliabilityGate?.criticalCount >= 2) return reliabilityGate.previewRiskLabel
  if (risk === 'high') return '위험'
  if (risk === 'low') return '좋음'
  return '추가 확인 필요'
}

function buildFreePreview({ structured, jobFamily, fiveAxes, criteria, criteriaMatch }) {
  const baselineRisk = overallRisk(fiveAxes, jobFamily, criteriaMatch, {
    sevenAxes: structured.sevenAxes || [],
    auxiliaryChecks: structured.auxiliaryChecks || [],
    sourceText: structured.rawText || '',
  })
  const reliabilityGate = structured.reliabilityGate || buildReliabilityGate(structured)
  const risk =
    reliabilityGate.criticalCount >= 2
      ? 'high'
      : reliabilityGate.criticalCount >= 1
        ? (baselineRisk === 'high' ? 'high' : 'medium')
        : baselineRisk
  const focusAxes = previewFocusAxes(fiveAxes, risk)
  const shortReasons = buildPreviewShortReasons(focusAxes, fiveAxes)
  const leadRisk = buildFreePreviewLeadRisk({
    risk,
    jobFamily,
    fiveAxes,
    sevenAxes: structured.sevenAxes || [],
    criteria,
    sourceLines: structured.lines || [],
  })
  const axisPreviewCandidates = selectFreePreviewAxisCandidates(fiveAxes, risk)
  const riskyAxis = selectPreviewLeadAxis({ fiveAxes: focusAxes.length > 0 ? focusAxes : fiveAxes, risk })
  const employmentFormCheck =
    risk === 'high'
      ? null
      : (structured.auxiliaryChecks || []).find(
          (check) =>
            check?.key === 'employmentForm' &&
            ['medium', 'high'].includes(check?.level) &&
        check?.evidence?.quote &&
        !/정규직/i.test(check.evidence.quote),
        )
  const leadAxisCandidate = axisPreviewCandidates.find((candidate) => candidate.key === riskyAxis?.key) || axisPreviewCandidates[0] || null
  const supportAxisCandidate =
    axisPreviewCandidates.find(
      (candidate) =>
        candidate.key !== leadAxisCandidate?.key &&
        !isPreviewTextNearDuplicate(candidate.text, leadAxisCandidate?.text || '') &&
        !isPreviewTextNearDuplicate(candidate.quote, leadAxisCandidate?.quote || ''),
    ) || null
  const usedEvidenceIds = new Set(fiveAxes.map((axis) => axis.evidence?.id).filter(Boolean))
  const usedParagraphCounts = new Map()
  for (const axis of fiveAxes) {
    if (!axis.evidence?.paragraphKey) continue
    usedParagraphCounts.set(axis.evidence.paragraphKey, (usedParagraphCounts.get(axis.evidence.paragraphKey) || 0) + 1)
  }
  const preferredEvidence = pickTopEvidence(collectAllowedEvidence(structured.sectionsNormalized), AXES, { usedEvidenceIds, usedParagraphCounts, jobFamilyId: jobFamily.id })
  const gateQuote = reliabilityGate.primarySignal?.quote || ''
  const riskyAxisQuote = riskyAxis?.evidence?.quote || ''
  const roleQuestion = buildPrimaryQuestion({ jobFamily, fiveAxes, criteria, leadRiskKey: leadRisk?.key })
  const shouldUseEmploymentAsLead = !reliabilityGate.primarySignal && !!employmentFormCheck
  const whyImportant =
    reliabilityGate.primarySignal?.whyImportant ||
    (shouldUseEmploymentAsLead
      ? employmentFormCheck?.summary
      : leadRisk?.summary || leadAxisCandidate?.text || employmentFormCheck?.summary || buildPreviewInterpretation({ reliabilityGate, shortReasons, fiveAxes }))
  const leadSupportText = buildSupportPreviewText(leadAxisCandidate)
  const secondarySupportText = buildSupportPreviewText(supportAxisCandidate)
  const hasRiskFocusAxis = focusAxes.some((axis) => axis?.level === 'risk')
  const highestRiskReason = buildHighestRiskPreviewReason(fiveAxes)
  const operationalRiskReason = detectOperationalRiskPreviewReason(structured.rawText)
  const supportReason =
    !shouldUseEmploymentAsLead && operationalRiskReason && !isPreviewTextNearDuplicate(operationalRiskReason, whyImportant)
      ? operationalRiskReason
      : !shouldUseEmploymentAsLead && highestRiskReason && !isPreviewTextNearDuplicate(highestRiskReason, whyImportant)
      ? highestRiskReason
      : !shouldUseEmploymentAsLead && hasRiskFocusAxis
      ? buildPreviewSupportReason({ reliabilityGate, shortReasons, fiveAxes, interpretation: whyImportant })
      : secondarySupportText && !isPreviewTextNearDuplicate(secondarySupportText, whyImportant)
      ? secondarySupportText
      : leadSupportText && !isPreviewTextNearDuplicate(leadSupportText, whyImportant)
        ? leadSupportText
        : buildPreviewSupportReason({ reliabilityGate, shortReasons, fiveAxes, interpretation: whyImportant })
  const quoteCandidates = [
    gateQuote,
    shouldUseEmploymentAsLead ? (employmentFormCheck?.evidence?.quote || '') : (leadAxisCandidate?.quote || ''),
    leadRisk?.quote || '',
    supportAxisCandidate?.quote || '',
    isRepresentativeEvidenceNoiseLine(riskyAxisQuote) ? '' : riskyAxisQuote,
    preferredEvidence?.text || '',
    criteriaMatch?.riskyEvidence?.[0] || '',
    criteriaMatch?.positiveEvidence?.[0] || '',
    riskyAxisQuote,
  ].filter(Boolean)
  const quote = quoteCandidates[0] || ''
  const freePreviewReasons = [
    ...(leadRisk?.supportReasons || []),
    ...(supportReason ? [supportReason] : []),
  ].filter((reason, index, items) => items.findIndex((item) => isPreviewTextNearDuplicate(item, reason)) === index)
  const headline =
    !reliabilityGate.primarySignal && employmentFormCheck
      ? '계약 조건과 실제 역할 범위를 먼저 확인해야 합니다. 지원 전에 면접에서 확인할 포인트를 먼저 보세요.'
      : buildPreviewHeadlineWithPrompt({ risk, jobFamily, fiveAxes, reliabilityGate, leadRisk })
  const verificationQuestion =
    !reliabilityGate.primarySignal && employmentFormCheck?.question
      ? employmentFormCheck.question
      : leadRisk?.verificationQuestion || roleQuestion

  return {
    riskLevel: risk,
    riskLevelLabel: buildPreviewRiskLabel({ risk, jobFamily, fiveAxes, reliabilityGate }),
    headline,
    jobFamily,
    topEvidence: {
      quote,
      interpretation: quote
        ? whyImportant
        : '공고 표현이 추상적이라, 핵심 근거는 면접 답변으로 확인해야 합니다.',
    },
    shortReasons: freePreviewReasons.slice(0, 2),
    verificationQuestion: reliabilityGate.primarySignal?.question || verificationQuestion,
    structuredSummary: {
      jobTitle: structured.jobTitle,
      sectionsFound: Object.entries(structured.sections)
        .filter(([, value]) => value.length > 0)
        .map(([key]) => key),
    },
  }
}

function createQuestionTemplate(question, goodAnswerSignal, riskyAnswerSignal, meta = {}) {
  return {
    question,
    goodAnswerSignal,
    riskyAnswerSignal,
    ...(meta.category ? { category: meta.category } : {}),
    ...(meta.whyAsk ? { whyAsk: meta.whyAsk } : {}),
    ...(meta.answerDecisionHint ? { answerDecisionHint: meta.answerDecisionHint } : {}),
  }
}

function inferQuestionCategoryFromText(question = '') {
  const text = String(question || '')

  if (/(성과|지표|KPI|ROAS|CAC|CVR|전환율|매출|리포트|평가)/i.test(text)) return 'measurable'
  if (/(결정|권한|책임|우선순위|승인|직접 .*참여|직접 .*결정)/i.test(text)) return 'responsibility'
  if (/(운영|반복|실행|유지보수|처리|비중)/i.test(text)) return 'repetition'
  if (/(이력서|포트폴리오|결과물|다음 이직|남는 경험|자산)/i.test(text)) return 'transferable'
  if (/(6개월|1년 뒤|성장 경로|더 어려운 문제|확장|난이도)/i.test(text)) return 'difficulty'
  if (/(리뷰|피드백|회고|실험|A\/B|학습)/i.test(text)) return 'learningFeedback'
  if (/(핵심 업무|부수 업무|잡무|역할 범위|경계)/i.test(text)) return 'scopeClarity'
  return 'responsibility'
}

function buildQuestionSignalsByCategory(category, jobFamily = null) {
  const marketingLike = ['marketing', 'media'].includes(jobFamily?.id)

  const baseMap = {
    responsibility: {
      goodAnswerSignal: marketingLike
        ? '직접 책임지는 KPI, 승인 구조, 예산·채널 실험 권한을 실제 사례와 함께 설명합니다.'
        : '직접 결정하는 범위, 승인 구조, 책임 기준을 실제 사례와 함께 설명합니다.',
      riskyAnswerSignal: marketingLike
        ? '전략 문구는 있지만 실제 결정은 윗선이 하고 본인은 실행만 맡는다고 답합니다.'
        : '결정은 다른 사람이 하고 본인은 실행이나 조율만 맡는다고 답합니다.',
    },
    measurable: {
      goodAnswerSignal: marketingLike
        ? 'ROAS, CVR, 매출, 리텐션 같은 지표와 리뷰 주기를 구체적으로 설명합니다.'
        : 'KPI, 평가 기준, 결과 보고 방식과 리뷰 주기를 구체적으로 설명합니다.',
      riskyAnswerSignal: marketingLike
        ? '성과 보고는 하지만 어떤 지표를 직접 책임지는지는 끝까지 모호하게 답합니다.'
        : '결과는 본다고 하지만 어떤 수치나 기준으로 평가하는지는 모호하게 답합니다.',
    },
    repetition: {
      goodAnswerSignal: marketingLike
        ? '운영 업무와 실험·개선 업무 비중을 숫자나 최근 캠페인 사례로 설명합니다.'
        : '반복 업무와 개선 업무 비중을 숫자와 실제 사례로 구체적으로 설명합니다.',
      riskyAnswerSignal: marketingLike
        ? '콘텐츠 업로드나 채널 운영 비중은 큰데 개선 과제나 ownership은 흐리게 답합니다.'
        : '반복 처리 비중은 큰데 개선 기회나 ownership은 흐리게 답합니다.',
    },
    transferable: {
      goodAnswerSignal: '외부에서도 설명 가능한 프로젝트, 결과물, 개선 사례와 본인 기여 범위를 구체적으로 설명합니다.',
      riskyAnswerSignal: '내부 조율과 요청 처리 위주라서 다음 이직에서 설명할 결과물이 뚜렷하지 않다고 답합니다.',
    },
    difficulty: {
      goodAnswerSignal: '처음 역할과 이후 확장되는 책임, 더 어려운 문제의 예시를 구체적으로 설명합니다.',
      riskyAnswerSignal: '입사 후에도 비슷한 난이도의 반복 업무가 이어진다고 답합니다.',
    },
    learningFeedback: {
      goodAnswerSignal: '리뷰 주기, 피드백 주체, 회고나 실험을 다음 개선으로 연결하는 방식을 설명합니다.',
      riskyAnswerSignal: '업무는 처리하지만 리뷰나 피드백 구조는 사실상 없다고 답합니다.',
    },
    scopeClarity: {
      goodAnswerSignal: '핵심 업무, 부수 업무, 협업 범위와 본인 책임 경계를 구체적으로 설명합니다.',
      riskyAnswerSignal: '여러 요청을 다 받지만 어디까지가 본업인지 경계를 명확히 설명하지 못합니다.',
    },
  }

  return baseMap[category] || baseMap.responsibility
}

function buildAnswerDecisionHint(category, goodAnswerSignal, riskyAnswerSignal) {
  const map = {
    responsibility: '결정권과 승인 범위가 구체적이면 자산이 되고, 실행만 맡는 구조면 조건부 지원이나 보류에 가깝습니다.',
    measurable: 'KPI와 리뷰 구조가 분명하면 안전 신호이고, 결과 기준이 흐리면 판단 불확실성이 커집니다.',
    repetition: '운영 비중보다 개선 과제가 분명하면 자산이 되고, 반복 처리 위주면 물경력 위험이 커집니다.',
    transferable: '외부에서도 설명 가능한 결과물이 남으면 좋고, 내부 조율만 남으면 이직 자산이 약해집니다.',
    scopeClarity: '핵심 역할과 부수 업무 경계가 선명하면 좋고, 여러 잡무가 섞이면 보류 쪽으로 기웁니다.',
    difficulty: '더 어려운 문제로 확장되는 구조면 좋고, 같은 일을 반복하면 성장성은 약해집니다.',
    learningFeedback: '리뷰와 피드백 루프가 있으면 자산이 되고, 처리만 반복되면 성장 체감이 약해집니다.',
    applicationSafety: '공식 채용 주체가 분명하면 진행 가능하고, 계약 주체가 흐리면 지원 전 검증이 먼저입니다.',
    contractConsistency: '계약 구조가 명확하면 진행 가능하고, 소속과 보호 조건이 모호하면 보류가 안전합니다.',
    workLocationClarity: '근무지와 보고 라인이 명확하면 진행 가능하고, 상주·이동 조건이 흐리면 먼저 확인해야 합니다.',
    roleClarity: '실제 역할 레벨이 분명하면 좋고, 직급과 역할이 엇갈리면 면접 검증 전 확신하기 어렵습니다.',
    compensationContract: '실질 처우가 계약서 기준으로 정리되면 좋고, 금액만 강조되면 실제 조건을 다시 봐야 합니다.',
  }

  if (map[category]) return map[category]
  if (goodAnswerSignal && riskyAnswerSignal) {
    return `답변이 구체적으로 ${goodAnswerSignal.replace(/\.$/, '')} 좋고, ${riskyAnswerSignal.replace(/\.$/, '')} 보수적으로 판단하는 편이 안전합니다.`
  }
  return '답변이 구체적일수록 진행 판단이 쉬워지고, 모호할수록 보수적으로 보는 편이 안전합니다.'
}

function buildQuestionReasonByCategory(category) {
  const map = {
    applicationSafety:
      '경력서에는 개인정보가 포함되므로, 제출 전에 담당자 실명과 공식 회사 이메일을 확인해야 합니다.',
    contractConsistency:
      '파견·프리랜스 여부에 따라 계약 주체, 법적 보호, 지급 방식이 달라지므로 문서 확인이 필요합니다.',
    compensationContract:
      '표기된 월급여·용역비는 계약 방식에 따라 실질 처우가 달라질 수 있어 지급 기준과 공제 항목을 계약서로 확인해야 합니다.',
    repetition:
      '단순 요청 처리 중심인지, 자동화·정책 개선처럼 이력서에 남는 경험이 있는지 확인해야 합니다.',
    responsibility:
      '실행만 맡는 역할인지, 판단과 의사결정에 참여하는 역할인지 구분해야 합니다.',
    measurable:
      '입사 후 성과가 숫자나 산출물로 남는 구조인지 확인해야 합니다.',
    difficulty:
      '시간이 갈수록 더 어려운 문제와 넓은 책임으로 확장되는 구조인지 확인해야 합니다.',
    transferable:
      '이 경험이 다음 이직에도 설명 가능한 결과물로 남는지 확인해야 합니다.',
    workLocationClarity:
      '실제 근무지와 고객사 상주 여부에 따라 근무 조건과 역할 해석이 달라질 수 있어 먼저 확인해야 합니다.',
    roleClarity:
      '직급·직책 표기와 실제 역할 레벨이 다를 수 있어 보고 라인과 책임 범위를 따로 확인해야 합니다.',
    scopeClarity:
      '업무 범위가 넓게 적혀 있으면 실제 핵심 직무와 잡무 비중을 구분해서 확인해야 합니다.',
  }

  return map[category] || '면접에서 실제 역할, 책임, 권한, 성과 기준을 구체적으로 확인해야 합니다.'
}

function buildCriteriaQuestionTemplate(question, jobFamily) {
  const category = inferQuestionCategoryFromText(question)
  const signals = buildQuestionSignalsByCategory(category, jobFamily)

  return createQuestionTemplate(
    question,
    signals.goodAnswerSignal,
    signals.riskyAnswerSignal,
    {
      category,
      whyAsk: buildQuestionReasonByCategory(category),
      answerDecisionHint: buildAnswerDecisionHint(category, signals.goodAnswerSignal, signals.riskyAnswerSignal),
    },
  )
}

function buildCriteriaQuestions(criteria, jobFamily) {
  if (jobFamily?.id === 'development') {
    return [
      createQuestionTemplate(
        '이 포지션이 실제로 기술 선택과 아키텍처 의사결정에 참여하는 범위는 어디까지인가요?',
        '기술 선택권, 설계 책임, 우선순위 결정 구조를 실제 사례와 함께 설명합니다.',
        '결정은 다른 팀이 하고 본인은 구현만 한다거나, 가봐야 안다고 흐립니다.',
        { category: 'responsibility', whyAsk: buildQuestionReasonByCategory('responsibility') },
      ),
      createQuestionTemplate(
        '신규 기능 개발과 운영·유지보수 업무의 비중은 어느 정도인가요?',
        '신규 개발, 운영 안정화, 레거시 대응 비중을 숫자와 실제 프로젝트 예시로 설명합니다.',
        '운영 이슈가 많다고만 하거나 요청 처리 위주인데 비중을 명확히 답하지 못합니다.',
        { category: 'repetition', whyAsk: buildQuestionReasonByCategory('repetition') },
      ),
      createQuestionTemplate(
        '6개월 뒤 이 역할이 맡게 될 더 어려운 문제는 무엇인가요?',
        '성능, 확장성, 데이터 처리량, 아키텍처 고도화처럼 난이도가 올라가는 문제를 구체적으로 설명합니다.',
        '지금과 비슷한 유지보수만 반복된다고 하거나 성장 경로를 설명하지 못합니다.',
        { category: 'difficulty', whyAsk: buildQuestionReasonByCategory('difficulty') },
      ),
    ]
  }

  if (jobFamily?.id === 'design') {
    return [
      createQuestionTemplate(
        '요청받은 제작 업무와 문제 정의·제안 업무의 실제 비중은 어느 정도인가요?',
        '제작 비중과 함께 직접 제안하거나 방향을 정하는 업무 예시를 구체적으로 설명합니다.',
        '요청받은 시안 제작이 대부분인데 제안이나 결정 범위는 거의 없다고 답합니다.',
        { category: 'repetition', whyAsk: buildQuestionReasonByCategory('repetition') },
      ),
      createQuestionTemplate(
        '이 역할에서 제가 직접 리드하는 결과물과 최종 결정권자의 경계는 어떻게 되나요?',
        '본인 산출물, 리뷰 구조, 최종 승인권자를 실제 협업 흐름 기준으로 설명합니다.',
        '여러 이해관계자 요청을 조율하지만 본인 책임 경계는 모호하다고 답합니다.',
        { category: 'responsibility', whyAsk: buildQuestionReasonByCategory('responsibility') },
      ),
      createQuestionTemplate(
        '1년 뒤 포트폴리오나 이력서에 남길 수 있는 대표 결과물은 무엇인가요?',
        '외부에도 설명 가능한 캠페인, 시스템, 비주얼 결과물과 기여 범위를 구체적으로 설명합니다.',
        '보안이나 내부 사정 때문에 남길 수 있는 결과물이 거의 없다고 답합니다.',
        { category: 'transferable', whyAsk: buildQuestionReasonByCategory('transferable') },
      ),
    ]
  }

  return (criteria?.interviewQuestions || []).map((question) => buildCriteriaQuestionTemplate(question, jobFamily))
}

function buildDefaultQuestions(jobFamily) {
  if (jobFamily?.id === 'product') {
    return [
      createQuestionTemplate(
        '입사 후 3개월·6개월 목표의 현재 기준선은 무엇인가요?',
        '현재 지표 기준선과 목표 수치, 측정 주기를 구체적으로 설명합니다.',
        '목표 수치만 있고 현재 기준선이나 측정 방식은 아직 정해지지 않았다고 답합니다.',
        { category: 'measurable', whyAsk: buildQuestionReasonByCategory('measurable') },
      ),
      createQuestionTemplate(
        '목표를 달성하지 못했을 때 평가나 재계획은 어떤 방식으로 진행되나요?',
        '평가 기준, 리뷰 주기, 목표 조정 방식이 문서나 운영 방식으로 정리돼 있다고 설명합니다.',
        '분위기나 재량으로 본다거나, 실패 기준과 재계획 구조가 없다고 답합니다.',
        { category: 'measurable', whyAsk: buildQuestionReasonByCategory('measurable') },
      ),
      createQuestionTemplate(
        'Head of Product 외에 PM 피어 리뷰나 시니어 피드백 구조가 있나요?',
        '정기 리뷰, 1:1, 회고, 피드백 루프가 실제로 어떻게 운영되는지 설명합니다.',
        '피드백 구조가 없거나, 필요할 때만 비정기적으로 본다고 답합니다.',
        { category: 'learningFeedback', whyAsk: buildQuestionReasonByCategory('learningFeedback') },
      ),
      createQuestionTemplate(
        '이 역할의 의사결정 범위와 최종 승인권자는 누구인가요?',
        '문제 정의, 우선순위 제안, 실험 설계 중 어디까지 직접 결정하고 누가 최종 승인하는지 설명합니다.',
        '아이디어는 내지만 실제 결정은 항상 다른 팀이나 상위자만 한다고 답합니다.',
        { category: 'responsibility', whyAsk: buildQuestionReasonByCategory('responsibility') },
      ),
      createQuestionTemplate(
        '온보딩·리텐션 외에 제품 전략이나 로드맵 수립에도 참여할 수 있나요?',
        '담당 기능을 넘어 전략, 우선순위, 로드맵 논의에 참여하는 범위를 구체적으로 설명합니다.',
        '정해진 백로그 처리만 맡고 전략 논의에는 참여하지 않는다고 답합니다.',
        { category: 'difficulty', whyAsk: buildQuestionReasonByCategory('difficulty') },
      ),
      createQuestionTemplate(
        '복지, 성과급, 스톡옵션 등 현금 외 보상 구조는 어떻게 되나요?',
        '연봉 외 보상 구조와 지급 기준을 서면으로 설명합니다.',
        '연봉 외 보상은 아직 정해지지 않았거나 입사 후에만 알 수 있다고 답합니다.',
        { category: 'companyContext', whyAsk: '핵심 역할 정보가 충분해도 보상 구조는 실제 처우 판단에 영향을 주므로 조건을 분리해서 확인해야 합니다.' },
      ),
    ]
  }

  if (jobFamily?.id === 'development') {
    return [
      createQuestionTemplate(
        '입사 후 3개월 안에 제가 직접 책임져야 하는 대표 산출물은 무엇인가요?',
        '구현 기능, 설계 문서, 데이터 파이프라인, 운영 지표 등 산출물과 평가 기준을 함께 설명합니다.',
        '필요한 일을 유동적으로 한다고만 답하거나, 본인 산출물이 무엇인지 흐립니다.',
        { category: 'measurable', whyAsk: buildQuestionReasonByCategory('measurable') },
      ),
      createQuestionTemplate(
        'SaaS 전환이나 플랫폼 고도화에서 이 역할이 직접 책임지는 영역은 무엇인가요?',
        '프론트엔드, 백엔드, 아키텍처, 데이터베이스 중 어디를 직접 리드하는지 명확히 설명합니다.',
        '전체적으로 다 같이 한다고만 하거나 책임 경계를 구체적으로 말하지 못합니다.',
        { category: 'responsibility', whyAsk: buildQuestionReasonByCategory('responsibility') },
      ),
      createQuestionTemplate(
        '이 역할의 성과를 어떤 기술 지표나 결과물로 평가하나요?',
        '성능, 안정성, 처리량, 장애율, 배포 속도 같은 지표와 리뷰 주기를 설명합니다.',
        '평가 기준이 분위기나 주관적 만족도 중심이고, 기술 성과를 어떻게 측정하는지 명확히 답하지 못합니다.',
        { category: 'measurable', whyAsk: buildQuestionReasonByCategory('measurable') },
      ),
      createQuestionTemplate(
        '이 역할에서 1년 뒤 이력서에 남는 대표 프로젝트는 무엇인가요?',
        '사용 기술, 해결한 문제, 시스템 규모, 개선 결과를 다른 회사에도 설명 가능하게 말합니다.',
        '회사 내부 맥락만 알아야 이해되는 업무라며 외부 시장에서 설명 가능한 성과를 제시하지 못합니다.',
        { category: 'transferable', whyAsk: buildQuestionReasonByCategory('transferable') },
      ),
      createQuestionTemplate(
        '우선순위가 충돌할 때 이 역할이 직접 결정할 수 있는 범위는 어디까지인가요?',
        '의사결정 구조와 역할 경계, 본인이 직접 결정하는 범위를 구체적으로 설명합니다.',
        '요청이 들어오는 대로 처리한다거나, 결정 구조가 항상 바뀐다고만 답합니다.',
        { category: 'responsibility', whyAsk: buildQuestionReasonByCategory('responsibility') },
      ),
    ]
  }

  return [
      createQuestionTemplate(
        '입사 후 3개월 안에 제가 직접 책임져야 하는 산출물은 무엇인가요?',
        '산출물, 내 권한과 책임, 평가 기준을 구체적으로 설명합니다.',
        '상황에 따라 다르다거나 여러 업무를 도와야 한다는 식으로 흐립니다.',
        { category: 'measurable', whyAsk: buildQuestionReasonByCategory('measurable') },
      ),
    createQuestionTemplate(
      '단순 운영 업무와 개선/기획 업무의 비중은 어느 정도인가요?',
        '비중과 예시를 숫자나 실제 업무 흐름으로 설명합니다.',
        '운영이 대부분인데 개선 권한이나 목표가 없습니다.',
        { category: 'repetition', whyAsk: buildQuestionReasonByCategory('repetition') },
      ),
    createQuestionTemplate(
      '성과는 어떤 KPI나 지표로 평가하나요?',
        'KPI, 리뷰 주기, 피드백 방식이 명확합니다.',
        '평가 기준을 분위기나 주관적 설명으로만 답변합니다.',
        { category: 'measurable', whyAsk: buildQuestionReasonByCategory('measurable') },
      ),
    createQuestionTemplate(
      '이 역할에서 1년 뒤 이력서에 남는 결과물은 무엇인가요?',
        '이직할 때 설명할 경험과 구체적인 프로젝트 결과물이 있습니다.',
        '단순 처리와 반복 업무 위주로 설명 가능한 결과물이 없습니다.',
        { category: 'transferable', whyAsk: buildQuestionReasonByCategory('transferable') },
      ),
    createQuestionTemplate(
      '업무 우선순위는 어떤 기준으로 정하나요?',
        '의사결정 구조와 역할 경계가 명확합니다.',
        '요청이 들어오는 대로 처리하는 구조입니다.',
        { category: 'responsibility', whyAsk: buildQuestionReasonByCategory('responsibility') },
      ),
  ]
}

function fallbackDetail({ analysis }) {
  const structured = analysis.structured
  const jobFamily = structured.jobFamily
  const companyContext = structured.companyContext || createEmptyCompanyContext(structured.companyName || null)
  const reliabilityGate = structured.reliabilityGate || buildReliabilityGate(structured)
  const compensationQuote = findRawLine(
    structured?.lines,
    (line) => /(월급여|월 급여|용역비|급여|보수)/i.test(line) && /(만원|원)/.test(line),
  )
  const compensationNeedsContractCheck = Boolean(
    compensationQuote &&
      (reliabilityGate.allSignals.some((signal) => signal.key === 'contractConflict') ||
        (structured?.lines || []).some((line) => /(프리랜스|도급|용역)/i.test(line))),
  )
  const sevenAxes = enhanceAxesWithCompanyContext(structured.sevenAxes || structured.fiveAxes || [], companyContext)
  const fiveAxes = enhanceAxesWithCompanyContext(
    structured.fiveAxes || buildFiveAxesFromSevenAxes(sevenAxes),
    companyContext,
  )
  const auxiliaryChecks = filterAuxiliaryChecksForDisplay(structured.auxiliaryChecks || [], reliabilityGate)
  const criteria = criteriaForJobFamily(jobFamily.id)
  const selectedAxes = selectIssueAxes(fiveAxes, 3)
  const safetyEvidence = reliabilityGate.allSignals.slice(0, 2).map((signal) => ({
    quote: signal.quote,
    interpretation: signal.label,
    whyImportant: signal.whyImportant,
  }))
  const keyEvidence = [...safetyEvidence, ...selectedAxes
    .filter((axis) => axis.evidence?.quote)
    .map((axis) => ({
      quote: axis.evidence.quote,
      interpretation: axis.summary,
      whyImportant: buildWhyImportant(axis.key, axis.evidence.quote, axis.level),
    }))]
    .concat(
      (() => {
        const items = []
        const jobTitle = String(structured?.jobTitle || '').trim()
        if (jobTitle && !looksLikeTitleNoise(jobTitle) && jobTitle.length <= 40) {
          items.push({
            quote: jobTitle,
            interpretation: '공고에서 제시한 직무명 기준 맥락입니다.',
            whyImportant: '직무명이 실제 업무 범위와 맞는지 함께 확인해야 합니다.',
          })
        }
        const workArrangementQuote = findWorkArrangementContextQuote(structured?.lines)
        if (workArrangementQuote) {
          items.push({
            quote: workArrangementQuote,
            interpretation: '근무 방식과 일하는 환경에 대한 보조 정보도 함께 적혀 있습니다.',
            whyImportant: '물경력 직접 근거는 아니지만 실제 지원 판단 맥락에는 참고가 될 수 있습니다.',
          })
        }
        return items
      })(),
    )
    .filter((item, index, list) => item.quote && list.findIndex((candidate) => candidate.quote === item.quote) === index)
    .slice(0, 5)

  const criteriaQuestions = buildCriteriaQuestions(criteria, jobFamily)
  const companyQuestions = (companyContext.mustAskQuestions || []).map((item) => ({
    question: item.question,
    goodAnswerSignal: item.goodAnswerSignal,
    riskyAnswerSignal: item.warningAnswerSignal,
    category: 'companyContext',
    whyAsk: item.whyAsk,
  }))
  const safetyQuestions = reliabilityGate.allSignals.map((signal) =>
    createQuestionTemplate(
      signal.question,
      signal.key === 'contractConflict'
        ? '근로계약인지 도급계약인지, 실제 소속과 지급 기준을 계약서 기준으로 일관되게 설명합니다.'
        : '법인명, 계약 주체, 실제 소속, 회사 이메일, 계약서 초안을 문서 기준으로 분명하게 설명합니다.',
      signal.key === 'contractConflict'
        ? '파견과 프리랜스를 섞어 말하거나 지급 방식·소속·보호 조건을 모호하게 답합니다.'
        : '담당자 개인 연락처만 주거나 계약 형태·소속·업무 범위를 모호하게 답합니다.',
      {
        category:
          signal.key === 'personalEmail' || signal.key === 'ambiguousCompany' || signal.key === 'entityUnverifiable'
            ? 'applicationSafety'
            : signal.key === 'contractConflict'
              ? 'contractConsistency'
              : signal.key === 'multiLocation'
                ? 'workLocationClarity'
                : 'roleClarity',
        whyAsk: buildQuestionReasonByCategory(
          signal.key === 'personalEmail' || signal.key === 'ambiguousCompany' || signal.key === 'entityUnverifiable'
            ? 'applicationSafety'
            : signal.key === 'contractConflict'
              ? 'contractConsistency'
              : signal.key === 'multiLocation'
                ? 'workLocationClarity'
                : 'roleClarity',
        ),
      },
    ),
  )

  const pairedLocationQuote = findInterviewAndWorkLocationPairQuote(structured?.lines)
  if (pairedLocationQuote && !reliabilityGate.allSignals.some((signal) => signal.key === 'multiLocation')) {
    safetyQuestions.push(
      createQuestionTemplate(
        '실제 근무지와 상주 여부가 어디로 확정되는지 알 수 있나요?',
        '실제 근무지, 상주 여부, 이동 가능성, 보고 라인을 명확히 설명합니다.',
        '면접 장소와 실제 근무지가 달라질 수 있는데도 언제 어디서 일하는지 모호하게 답합니다.',
        { category: 'workLocationClarity', whyAsk: buildQuestionReasonByCategory('workLocationClarity') },
      ),
    )
  }

  if (compensationNeedsContractCheck) {
    safetyQuestions.push(
      createQuestionTemplate(
        '월 700만 원은 용역비 기준인지, 세전/세후 기준인지, 4대보험·퇴직금·연차·세금 처리는 어떻게 적용되는지 계약서로 확인할 수 있나요?',
        '월 금액 기준, 공제 항목, 4대보험·퇴직금·연차 적용 여부를 계약서 문구로 설명합니다.',
        '월 금액만 강조하고 실제 공제 항목이나 법적 보호 조건은 면접 후 보자고 미룹니다.',
        { category: 'compensationContract', whyAsk: buildQuestionReasonByCategory('compensationContract') },
      ),
    )
  }

  const defaultQuestions = buildDefaultQuestions(jobFamily)
  const prioritizedQuestions = selectedAxes.map((axis) => {
    if (axis.key === 'responsibility') {
      if (jobFamily?.id === 'development') {
        return createQuestionTemplate(
          '이 포지션이 실제로 기술 선택과 아키텍처 의사결정에 참여하는 범위는 어디까지인가요?',
          '기술 선택권, 설계 책임, 우선순위 결정 구조를 실제 사례와 함께 설명합니다.',
          '결정은 다른 팀이 하고 본인은 구현만 한다거나, 가봐야 안다고 흐립니다.',
          { category: 'responsibility', whyAsk: buildQuestionReasonByCategory('responsibility') },
        )
      }
      if (jobFamily?.id === 'product') {
        return createQuestionTemplate(
          '이 역할의 의사결정 범위와 최종 승인권자는 누구인가요?',
          '문제 정의, 우선순위 제안, 실험 설계 중 어디까지 직접 결정하고 누가 최종 승인하는지 설명합니다.',
          '아이디어는 내지만 실제 결정은 항상 다른 팀이나 상위자만 한다고 답합니다.',
          { category: 'responsibility', whyAsk: buildQuestionReasonByCategory('responsibility') },
        )
      }
      return createQuestionTemplate(
        '이 역할에서 제가 직접 결정하거나 제안할 수 있는 범위는 어디까지인가요?',
        '승인 구조와 함께 예산, 채널, 우선순위 중 직접 결정하거나 제안하는 범위를 실제 사례로 설명합니다.',
        '전략 문구는 있지만 실제 결정은 윗선이 하고 본인은 실행과 조율만 맡는다고 답합니다.',
        { category: 'responsibility', whyAsk: buildQuestionReasonByCategory('responsibility') },
      )
    }
    if (axis.key === 'repetition') {
      return createQuestionTemplate(
        '실행 운영과 기획·개선 업무의 비중은 실제로 어느 정도인가요?',
        '운영 비중과 개선 과제를 숫자나 최근 프로젝트 기준으로 구체적으로 설명합니다.',
        '운영이 대부분이지만 개선 기회나 ownership은 모호하다고 답합니다.',
        { category: 'repetition', whyAsk: buildQuestionReasonByCategory('repetition') },
      )
    }
    if (axis.key === 'measurable') {
      return createQuestionTemplate(
        '이 역할의 성과는 어떤 지표나 결과물로 평가하나요?',
        'KPI, 결과 보고 방식, 회고 후 다음 액션까지 구체적으로 설명합니다.',
        '결과 보고는 하지만 어떤 수치나 기준으로 평가하는지는 모호하다고 답합니다.',
        { category: 'measurable', whyAsk: buildQuestionReasonByCategory('measurable') },
      )
    }
    if (axis.key === 'transferable') {
      return createQuestionTemplate(
        '1년 뒤 이 역할에서 이력서에 남는 대표 결과물은 무엇인가요?',
        '외부 회사에도 설명 가능한 캠페인, 프로젝트, 리포트, 개선 결과를 구체적으로 설명합니다.',
        '내부 조율과 운영 중심이라 설명 가능한 결과물이 뚜렷하지 않다고 답합니다.',
        { category: 'transferable', whyAsk: buildQuestionReasonByCategory('transferable') },
      )
    }
    return createQuestionTemplate(
      '입사 후 시간이 갈수록 더 어려운 문제를 맡게 되는 구조인가요?',
      '초기 역할과 이후 확장되는 책임, 더 어려운 문제의 예시를 구체적으로 설명합니다.',
      '처음과 비슷한 반복 업무를 계속 맡는 구조라고 설명합니다.',
      { category: 'difficulty', whyAsk: buildQuestionReasonByCategory('difficulty') },
    )
  })

  const repetitionAxis = fiveAxes.find((axis) => axis.key === 'repetition')
  const responsibilityAxis = fiveAxes.find((axis) => axis.key === 'responsibility')
  const transferableAxis = fiveAxes.find((axis) => axis.key === 'transferable')
  const measurableAxis = fiveAxes.find((axis) => axis.key === 'measurable')
  const supplementalQuestions = []

  if (repetitionAxis?.level === 'risk' && responsibilityAxis?.level === 'insufficient_info') {
    supplementalQuestions.push(
      createQuestionTemplate(
        '실행 운영과 기획·개선 업무의 비중은 실제로 어느 정도인가요?',
        '운영 비중과 개선 과제를 숫자나 최근 프로젝트 기준으로 구체적으로 설명합니다.',
        '운영이 대부분이지만 개선 기회나 ownership은 모호하다고 답합니다.',
        { category: 'repetition', whyAsk: buildQuestionReasonByCategory('repetition') },
      ),
    )
    supplementalQuestions.push(
      jobFamily?.id === 'development'
        ? createQuestionTemplate(
            '이 포지션이 실제로 기술 선택과 아키텍처 의사결정에 참여하는 범위는 어디까지인가요?',
            '기술 선택권, 설계 책임, 우선순위 결정 구조를 실제 사례와 함께 설명합니다.',
            '결정은 다른 팀이 하고 본인은 구현만 한다거나, 가봐야 안다고 흐립니다.',
            { category: 'responsibility', whyAsk: buildQuestionReasonByCategory('responsibility') },
          )
        : createQuestionTemplate(
            '이 역할에서 제가 직접 결정하거나 제안할 수 있는 범위는 어디까지인가요?',
            '승인 구조와 함께 예산, 채널, 우선순위 중 직접 결정하거나 제안하는 범위를 실제 사례로 설명합니다.',
            '전략 문구는 있지만 실제 결정은 윗선이 하고 본인은 실행과 조율만 맡는다고 답합니다.',
            { category: 'responsibility', whyAsk: buildQuestionReasonByCategory('responsibility') },
          ),
    )
  }

  if (
    repetitionAxis?.level === 'risk' &&
    jobFamily?.id === 'media' &&
    ['insufficient_info', 'positive_with_check'].includes(measurableAxis?.level || 'insufficient_info')
  ) {
    supplementalQuestions.push(
      createQuestionTemplate(
        '이 역할의 성과는 어떤 지표나 결과물로 평가하나요?',
        'KPI, 결과 보고 방식, 회고 후 다음 액션까지 구체적으로 설명합니다.',
        '결과 보고는 하지만 어떤 수치나 기준으로 평가하는지는 모호하다고 답합니다.',
        { category: 'measurable', whyAsk: buildQuestionReasonByCategory('measurable') },
      ),
    )
  }

  if (
    repetitionAxis?.level === 'risk' &&
    transferableAxis?.level === 'insufficient_info' &&
    ['insufficient_info', 'positive_with_check'].includes(measurableAxis?.level || 'insufficient_info')
  ) {
    supplementalQuestions.push(
      createQuestionTemplate(
        '1년 뒤 이 역할에서 이력서에 남는 대표 결과물은 무엇인가요?',
        '외부 회사에도 설명 가능한 캠페인, 프로젝트, 리포트, 개선 결과를 구체적으로 설명합니다.',
        '내부 조율과 운영 중심이라 설명 가능한 결과물이 뚜렷하지 않다고 답합니다.',
        { category: 'transferable', whyAsk: buildQuestionReasonByCategory('transferable') },
      ),
    )
  }

  const existingQuestionPool = [...safetyQuestions, ...defaultQuestions, ...prioritizedQuestions, ...criteriaQuestions]
  const dedupedCompanyQuestions = companyQuestions.filter(
    (item) => !existingQuestionPool.some((candidate) => areInterviewQuestionsNearDuplicate(candidate?.question, item?.question)),
  )

  const orderedInterviewQuestions =
    jobFamily?.id === 'product'
      ? [...safetyQuestions, ...defaultQuestions, ...supplementalQuestions, ...prioritizedQuestions, ...dedupedCompanyQuestions, ...criteriaQuestions]
      : [...safetyQuestions, ...supplementalQuestions, ...prioritizedQuestions, ...dedupedCompanyQuestions, ...criteriaQuestions, ...defaultQuestions]

  return {
    finalSummary:
      reliabilityGate.criticalCount >= 1
        ? '경력서 제출 전 공고 신뢰성과 계약 구조 확인이 먼저 필요하고, 그다음 물경력 가능성을 봐야 합니다.'
        : analysis.freePreview.headline,
    jobFamily,
    companyContext,
    sevenAxes,
    fiveAxes,
    auxiliaryChecks,
    keyEvidence,
    interviewQuestions: orderedInterviewQuestions
      .filter((item, index, list) => list.findIndex((candidate) => candidate.question === item.question) === index)
      .slice(0, 7),
    actionGuide:
      reliabilityGate.criticalCount >= 1
        ? '1. 법인명·사업자등록번호·담당자 회사 이메일·계약서 초안을 먼저 확인하세요. 2. 파견인지 프리랜스인지, 실제 소속과 4대보험·퇴직금·연차 적용을 확인하세요. 3. 그다음 운영 비중, 권한 범위, 산출물과 성과 기준을 확인하세요.'
        : '이 리포트는 지원 여부를 대신 결정하지 않습니다. 직무 기준과 원문 근거를 함께 보고, 면접 질문 답변으로 내 권한과 책임·산출물·성과 기준이 명확한지 확인한 뒤 판단하세요.',
  }
}

function filterInterviewQuestionsForDisplay(interviewQuestions = [], { auxiliaryChecks = [], structured = {}, detailJobFamily = null, coreRisks = [] } = {}) {
  const activeAuxiliaryKeys = new Set((auxiliaryChecks || []).map((item) => item.key))
  const sourceLines = structured?.lines || []
  const hasFreelanceContractSignal = sourceLines.some((line) => /(프리랜스|도급|용역)/i.test(line))
  const hasCompensationSignal = sourceLines.some((line) => /(월급여|월 급여|용역비|급여|보수)/i.test(line) && /(만원|원)/.test(line))
  const riskAxisKeys = new Set((coreRisks || []).flatMap((item) => item?.sourceAxisKeys || []))

  return (interviewQuestions || []).filter((item) => {
    if (!item?.question) return false
    if (item.category === 'applicationSafety' && !activeAuxiliaryKeys.has('applicationSafety')) return false
    if (item.category === 'contractConsistency' && !activeAuxiliaryKeys.has('contractConsistency')) return false
    if (item.category === 'workLocationClarity' && !activeAuxiliaryKeys.has('workLocationClarity')) return false
    if (item.category === 'roleClarity' && !activeAuxiliaryKeys.has('roleClarity')) return false
    if (item.category === 'compensationContract' && !(activeAuxiliaryKeys.has('contractConsistency') && hasFreelanceContractSignal && hasCompensationSignal)) {
      return false
    }
    if (detailJobFamily?.id === 'product' && /(파견|프리랜스|고객사 상주|회사 이메일|계약 주체)/i.test(item.question)) {
      return activeAuxiliaryKeys.has('applicationSafety') || activeAuxiliaryKeys.has('contractConsistency') || activeAuxiliaryKeys.has('workLocationClarity')
    }
    if (riskAxisKeys.has('scopeClarity') && buildQuestionTopicSignature(item) === 'scope_breakdown') return true
    return true
  })
}

function normalizeInterviewQuestionForDedupe(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[“”"'‘’`]/g, '')
    .replace(/[.,!?;:~·\-_/\\[\]{}<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function areInterviewQuestionsNearDuplicate(a, b) {
  const normalizedA = normalizeInterviewQuestionForDedupe(a)
  const normalizedB = normalizeInterviewQuestionForDedupe(b)
  if (!normalizedA || !normalizedB) return false
  if (normalizedA === normalizedB) return true
  if (normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA)) return true

  const tokensA = new Set(normalizedA.split(' ').filter((token) => token.length >= 2))
  const tokensB = new Set(normalizedB.split(' ').filter((token) => token.length >= 2))
  if (!tokensA.size || !tokensB.size) return false
  const overlap = [...tokensA].filter((token) => tokensB.has(token)).length
  const minSize = Math.min(tokensA.size, tokensB.size)
  return minSize >= 4 && overlap / minSize >= 0.7
}

function toSentenceLimitedText(text, maxSentences = 1) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim()
  if (!normalized) return ''
  const sentences = normalized.match(/[^.!?]+[.!?]?/g)?.map((item) => item.trim()).filter(Boolean) || [normalized]
  return sentences.slice(0, maxSentences).join(' ').trim()
}

function toLengthLimitedText(text, maxLength = 120) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim()
  if (!normalized || normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}…`
}

function compactCompanyContext(companyContext) {
  if (!companyContext || typeof companyContext !== 'object') return companyContext

  return {
    ...companyContext,
    companyName: toLengthLimitedText(companyContext.companyName, 40),
    businessSignals: (companyContext.businessSignals || []).slice(0, 1).map((item) => ({
      signal: toLengthLimitedText(item?.signal, 36),
      description: toLengthLimitedText(toSentenceLimitedText(item?.description, 1), 60),
      confidence: item?.confidence || 'low',
      evidence: (item?.evidence || []).slice(0, 1).map((evidence) => toLengthLimitedText(evidence, 50)),
    })),
    jobConnectionHypotheses: (companyContext.jobConnectionHypotheses || []).slice(0, 1).map((item) => ({
      hypothesis: toLengthLimitedText(item?.hypothesis, 60),
      riskImpact: item?.riskImpact || 'uncertain',
      reason: toLengthLimitedText(toSentenceLimitedText(item?.reason, 1), 60),
      relatedJobPostingEvidence: toLengthLimitedText(item?.relatedJobPostingEvidence, 50),
      relatedCompanyEvidence: toLengthLimitedText(item?.relatedCompanyEvidence, 50),
      confidence: item?.confidence || 'low',
    })),
    mustAskQuestions: (companyContext.mustAskQuestions || []).slice(0, 1).map((item) => ({
      question: toLengthLimitedText(item?.question, 60),
      whyAsk: toLengthLimitedText(toSentenceLimitedText(item?.whyAsk, 1), 50),
      goodAnswerSignal: toLengthLimitedText(toSentenceLimitedText(item?.goodAnswerSignal, 1), 45),
      warningAnswerSignal: toLengthLimitedText(toSentenceLimitedText(item?.warningAnswerSignal, 1), 45),
    })),
    limitations: (companyContext.limitations || []).slice(0, 2).map((item) => toLengthLimitedText(item, 60)),
  }
}

function pickEvidenceQuoteSegment(value = '') {
  const raw = String(value || '').trim()
  if (!raw) return ''

  const lineCandidates = raw
    .split(/\r?\n|•|·/)
    .map((item) => item.replace(/^\s*[-*]\s*/, '').trim())
    .filter(Boolean)

  const line = lineCandidates.find((item) => item.length >= 12) || lineCandidates[0] || raw
  return toSentenceLimitedText(line, 1) || line
}

function compactEvidenceQuote(value, maxLength = 120) {
  const normalized = pickEvidenceQuoteSegment(value).replace(/\s+/g, ' ').trim()
  if (!normalized) return ''
  return toLengthLimitedText(normalized, maxLength)
}

function buildQuestionIntentFamilySignature(item = {}) {
  const topic = buildQuestionTopicSignature(item)
  if (topic === 'baseline_metrics') return 'baseline_metrics'
  if (topic === 'kpi_evaluation' || topic === 'kpi_ownership') return 'kpi_metrics'
  return topic
}

function pickInterviewQuestionsForCompactDisplay(interviewQuestions = [], limit = 5, coreRisks = []) {
  const deduped = []
  const topicSeen = new Set()

  for (const item of interviewQuestions) {
    const topic = coreRisks.length > 0 ? buildQuestionIntentFamilySignature(item) : buildQuestionTopicSignature(item)
    if (topicSeen.has(topic)) continue
    topicSeen.add(topic)
    deduped.push(item)
    if (deduped.length >= Math.max(limit + 2, 7)) break
  }

  const base = deduped.slice(0, limit)
  const feedbackQuestion = deduped.find((item) => /(Head of Product|PM 피어 리뷰|시니어 피드백)/i.test(item?.question || ''))
  if (feedbackQuestion && !base.some((item) => item?.question === feedbackQuestion.question) && limit >= 3) {
    const adjusted = [...base.slice(0, Math.max(0, limit - 1)), feedbackQuestion]
    return adjusted
  }

  const hasCompensationQuestion = base.some((item) => item?.category === 'compensationContract')
  if (hasCompensationQuestion) return base

  const compensationQuestion = deduped.find((item) => item?.category === 'compensationContract')
  if (!compensationQuestion) return base

  const mustKeepScopeBreakdown =
    coreRisks.some((risk) => risk.key === 'scope_breadth') &&
    !base.some((item) => buildQuestionTopicSignature(item) === 'scope_breakdown')
  if (mustKeepScopeBreakdown) {
    const scopeQuestion = deduped.find((item) => buildQuestionTopicSignature(item) === 'scope_breakdown')
    if (scopeQuestion) {
      return [...base.slice(0, Math.max(0, limit - 1)), scopeQuestion]
    }
  }

  return [...base.slice(0, Math.max(0, limit - 1)), compensationQuestion]
}

function getDetailTone(level = '') {
  if (['risk', 'high'].includes(level)) return 'danger'
  if (['mixed_signal', 'positive_with_check', 'medium'].includes(level)) return 'warning'
  if (level === 'insufficient_info') return 'neutral'
  return 'safe'
}

function getAxisDecisionMeta(axisKey) {
  const map = {
    repetition: {
      missingTopic: '반복 운영과 개선 업무의 비중',
      positiveSignal: '반복 업무를 개선·자동화·분석으로 연결하는 구조로 볼 여지가 있습니다.',
      riskSignal: '반복 처리와 운영 비중이 크면 시간이 지나도 비슷한 일만 반복할 수 있습니다.',
      careerLink: '운영 처리만 남으면 이직 때 설명할 개선 성과가 약해집니다.',
      confirmPoint: '운영 비중과 개선 과제를 숫자나 최근 사례 기준으로 확인해야 합니다.',
    },
    responsibility: {
      missingTopic: '결정권과 책임 범위',
      positiveSignal: '전략 수립이나 우선순위 판단으로 이어질 수 있는 여지가 있습니다.',
      riskSignal: '권한이 없으면 전략 문구가 있어도 실제로는 실행과 조율 역할에 머물 수 있습니다.',
      careerLink: '판단 경험이 없으면 경력서에 주도 경험보다 지원 경험만 남기 쉽습니다.',
      confirmPoint: '예산, 채널, 승인, 우선순위 중 직접 결정하는 범위를 확인해야 합니다.',
    },
    measurable: {
      missingTopic: 'KPI와 평가 기준',
      positiveSignal: '성과 분석이나 결과 관리 경험으로 이어질 가능성이 있습니다.',
      riskSignal: '평가 기준이 없으면 일을 많이 해도 무엇을 만든 역할인지 설명하기 어려워집니다.',
      careerLink: '숫자나 결과물이 남지 않으면 이직 때 경력 자산화가 약해집니다.',
      confirmPoint: 'KPI, 리뷰 주기, 결과 보고 방식이 어떻게 잡혀 있는지 확인해야 합니다.',
    },
    difficulty: {
      missingTopic: '시간이 갈수록 더 어려운 문제를 맡는 구조',
      positiveSignal: '역할이 확장되면 더 큰 문제를 해결하는 경험으로 이어질 수 있습니다.',
      riskSignal: '확장 구조가 없으면 같은 수준의 반복 업무에 머물 가능성이 있습니다.',
      careerLink: '난이도 상승이 없으면 경력 연차에 비해 성장 폭이 작게 보일 수 있습니다.',
      confirmPoint: '입사 후 책임 범위와 문제 난이도가 어떻게 커지는지 확인해야 합니다.',
    },
    transferable: {
      missingTopic: '이직 때 설명 가능한 결과물과 범용 역량',
      positiveSignal: '시장에서도 통하는 결과물과 방법론으로 남을 가능성이 있습니다.',
      riskSignal: '내부 조율이나 회사 특화 운영만 남으면 다음 이직에서 설명력이 약합니다.',
      careerLink: '범용 역량이 약하면 경력 연차가 쌓여도 시장 가치가 낮아질 수 있습니다.',
      confirmPoint: '외부에서도 설명 가능한 프로젝트, 리포트, 개선 결과가 남는지 확인해야 합니다.',
    },
    scopeClarity: {
      missingTopic: '핵심 역할과 부수 업무의 경계',
      positiveSignal: '업무 범위가 하나의 전문성으로 수렴하면 경력 자산이 쌓이기 좋은 구조일 수 있습니다.',
      riskSignal: '업무 범위가 넓고 경계가 흐리면 여러 운영 잡무가 한 역할에 섞일 가능성이 있습니다.',
      careerLink: '전문성 대신 잡무 경험만 넓어지면 물경력으로 느껴질 가능성이 커집니다.',
      confirmPoint: '핵심 업무와 요청성 보조 업무가 어디서 갈리는지 확인해야 합니다.',
    },
    learningFeedback: {
      missingTopic: '성과 리뷰와 피드백 구조',
      positiveSignal: '회고와 피드백이 있으면 일을 하며 더 나아지는 구조일 수 있습니다.',
      riskSignal: '처리만 하고 끝나는 구조면 같은 실무를 반복해도 성장 체감이 약해집니다.',
      careerLink: '학습 루프가 없으면 개선 경험 대신 단순 수행 경험만 남기 쉽습니다.',
      confirmPoint: '리뷰 주기, 피드백 주체, 회고 방식이 있는지 확인해야 합니다.',
    },
  }

  return (
    map[axisKey] || {
      missingTopic: '핵심 판단 정보',
      positiveSignal: '경력 자산으로 이어질 수 있는 여지가 있습니다.',
      riskSignal: '역할 수준을 설명할 근거가 부족하면 실제 경험 가치가 낮아질 수 있습니다.',
      careerLink: '핵심 정보가 흐리면 이직 때 설명력이 약해질 수 있습니다.',
      confirmPoint: '면접에서 실제 역할과 평가 기준을 확인해야 합니다.',
    }
  )
}

function buildAxisRiskInterpretation(axis) {
  const meta = getAxisDecisionMeta(axis?.key)
  const quote = String(axis?.evidence?.quote || '').trim()

  if (quote) {
    if (axis?.key === 'scopeClarity') {
      if (axis?.level === 'risk' || axis?.level === 'mixed_signal' || axis?.level === 'positive_with_check') {
        return `'${quote}' 문구는 업무 범위가 한 포지션에 넓게 묶여 있음을 보여줍니다. 넓은 범위를 경험한다는 장점은 있지만, 실제로는 ${meta.riskSignal.toLowerCase()} ${meta.careerLink} 따라서 ${meta.confirmPoint}`
      }
      if (axis?.level === 'insufficient_info') {
        return `'${quote}' 문구는 역할 범위를 완전히 숨기진 않지만, 핵심 업무와 부수 업무의 경계는 여전히 직접 드러나지 않습니다. 실제로는 ${meta.riskSignal.toLowerCase()} ${meta.careerLink} 따라서 ${meta.confirmPoint}`
      }
    }
    if (axis?.level === 'risk') {
      return `공고의 '${quote}' 문구는 ${meta.riskSignal} ${meta.careerLink} 따라서 ${meta.confirmPoint}`
    }
    if (axis?.level === 'insufficient_info') {
      return `'${quote}' 문구는 ${meta.positiveSignal} 다만 ${meta.missingTopic}가 직접 드러나지 않아 ${meta.riskSignal.toLowerCase()} ${meta.careerLink} 따라서 ${meta.confirmPoint}`
    }
    if (axis?.level === 'mixed_signal' || axis?.level === 'positive_with_check') {
      return `'${quote}' 문구는 ${meta.positiveSignal} 다만 동시에 ${meta.riskSignal.toLowerCase()} ${meta.careerLink} 따라서 ${meta.confirmPoint}`
    }
    return `'${quote}' 문구는 ${meta.positiveSignal} 다만 과장 해석은 피하고 ${meta.confirmPoint}`
  }

  return `공고에는 ${meta.missingTopic}를 직접 보여주는 문구가 거의 없습니다. 그래서 ${meta.positiveSignal.toLowerCase()} 실제로는 ${meta.riskSignal.toLowerCase()} ${meta.careerLink} 따라서 ${meta.confirmPoint}`
}

function buildAxisDecisionMeaning(axis) {
  const meta = getAxisDecisionMeta(axis?.key)
  if (axis?.level === 'risk') return `이 축은 현재 지원 판단을 보수적으로 낮추는 직접 위험 신호입니다. ${meta.confirmPoint}`
  if (axis?.level === 'insufficient_info') return `이 축은 위험 확정이 아니라 판단 불확실성을 키우는 정보 공백입니다. ${meta.confirmPoint}`
  if (axis?.level === 'mixed_signal' || axis?.level === 'positive_with_check') return `이 축은 긍정 가능성과 위험 가능성이 함께 있어 조건부 지원 여부를 가르는 기준입니다. ${meta.confirmPoint}`
  return `이 축은 비교적 긍정 신호가 보이지만 최종 판단 전 ${meta.confirmPoint}`
}

function dedupeTextItems(items = [], selector = (item) => item) {
  const seen = new Set()
  return items.filter((item) => {
    const value = String(selector(item) || '')
      .replace(/\s+/g, ' ')
      .trim()
    if (!value || seen.has(value)) return false
    seen.add(value)
    return true
  })
}

function buildCoreRiskItem({ key, title, summary, whyRisk, questionToVerify, severity = 'medium', sourceAxisKeys = [] }) {
  return {
    key,
    title,
    summary,
    whyRisk,
    questionToVerify,
    severity,
    sourceAxisKeys,
  }
}

function buildDecisionStance(coreRisks = [], reliabilityGate = null) {
  if (reliabilityGate?.criticalCount >= 1) {
    return {
      decisionLevel: 'hold_before_apply',
      headline: '검증 전 지원 보류',
      recommendedAction: 'hold_before_apply',
      reason:
        '공식 채용 주체와 계약 안전성부터 검증해야 합니다. 회사 확인과 계약 조건이 정리되기 전에는 지원 판단을 보류하는 편이 안전합니다.',
    }
  }

  const keys = new Set(coreRisks.map((risk) => risk.key))

  if (keys.has('scope_breadth') && keys.has('authority_gap')) {
    return {
      decisionLevel: 'hold_before_apply',
      headline: '확인 전 보류 권장',
      recommendedAction: 'hold_before_apply',
      reason:
        '업무 범위와 결정권 답변이 분명할 때만 지원 검토 쪽으로 보고, 둘 다 모호하면 운영형 제너럴리스트 역할일 가능성을 더 크게 봐야 합니다.',
    }
  }

  if (keys.has('scope_breadth') || keys.has('authority_gap') || keys.has('kpi_gap')) {
    return {
      decisionLevel: 'conditional_apply',
      headline: '조건부 지원 가능',
      recommendedAction: 'check_before_apply',
      reason:
        '업무 범위, KPI, 결정권 답변이 분명할 때만 지원 쪽으로 보고, 답변이 모호하면 운영형 제너럴리스트 역할로 남을 가능성을 보수적으로 봐야 합니다.',
    }
  }

  if (keys.has('ops_mix')) {
    return {
      decisionLevel: 'ops_risk_caution',
      headline: '운영형 물경력 위험 주의',
      recommendedAction: 'check_before_apply',
      reason:
        '운영 비중과 개선 과제의 실제 비중을 먼저 확인하고, 반복 처리 위주라면 지원을 보수적으로 판단하는 편이 안전합니다.',
    }
  }

  return {
    decisionLevel: 'verification_needed',
    headline: '추가 확인 필요',
    recommendedAction: 'check_before_apply',
    reason: '핵심 역할, KPI, 결정권 범위를 먼저 확인한 뒤 지원 판단을 내리는 편이 안전합니다.',
  }
}

function buildConfidenceReason(axes = [], auxiliaryChecks = []) {
  const insufficientCount = axes.filter((axis) => axis?.level === 'insufficient_info').length
  const dangerCount = axes.filter((axis) => getDetailTone(axis?.level) === 'danger').length
  const warningAuxCount = auxiliaryChecks.filter((item) => getDetailTone(item?.level) === 'warning').length
  const safeCount = axes.filter((axis) => getDetailTone(axis?.level) === 'safe').length

  if (insufficientCount >= 3) {
    return 'KPI, 결정권, 업무 비중처럼 지원 판단에 중요한 근거가 여러 축에서 비어 있어 신뢰도가 낮습니다.'
  }
  if (dangerCount >= 2) {
    return '직접 위험 신호는 보이지만, 그 강도를 더 뒷받침할 근거가 있으면 판단 신뢰도가 더 높아집니다.'
  }
  if (warningAuxCount >= 1 && insufficientCount >= 1) {
    return '고용형태나 운영 구조 확인 포인트가 남아 있어, 면접 전까지는 이 점수를 보수적으로 읽는 편이 안전합니다.'
  }
  if (safeCount >= 3) {
    return 'KPI, 역할 범위, 성과 축적 구조를 보여주는 근거가 비교적 구체적이라 점수 신뢰도가 높은 편입니다.'
  }
  return '근거가 구체적일수록 점수의 신뢰도가 높습니다.'
}

function buildCoreRisks(detail = {}, structured = {}) {
  const sevenAxes = detail?.sevenAxes || []
  const axisByKey = new Map(sevenAxes.map((axis) => [axis?.key, axis]))
  const sourceLines = structured?.lines || []
  const jobFamilyId = detail?.jobFamily?.id || structured?.jobFamily?.id || 'unknown'
  const scopeAxis = axisByKey.get('scopeClarity')
  const responsibilityAxis = axisByKey.get('responsibility')
  const measurableAxis = axisByKey.get('measurable')
  const repetitionAxis = axisByKey.get('repetition')

  const marketingBreadthQuote =
    findRawLine(
      sourceLines,
      (line) =>
        countDistinctKeywordHits(line, ['자사몰', 'crm', '인플루언서', '콘텐츠', '라이브커머스', '프로모션', '데이터 분석']) >= 3,
    ) || scopeAxis?.evidence?.quote || ''
  const hasMarketingBreadthSignal = countDistinctKeywordHits(marketingBreadthQuote, ['자사몰', 'crm', '인플루언서', '콘텐츠', '라이브커머스', '프로모션', '데이터 분석']) >= 3
  const strategyWithoutAuthorityQuote =
    findRawLine(sourceLines, (line) => /(전략 수립|마케팅 전략|캠페인 기획|브랜드 전략)/i.test(line) && !/(예산|권한|승인|의사결정|오너십)/i.test(line)) ||
    responsibilityAxis?.evidence?.quote ||
    ''
  const metricsWithoutOwnershipQuote =
    findRawLine(sourceLines, (line) => /(성과 분석|데이터 분석|리포트|매출|roas|cvr|리텐션|전환율)/i.test(line) && !/(kpi|평가|책임|직접 책임)/i.test(line)) ||
    measurableAxis?.evidence?.quote ||
    ''

  const risks = []

  if (
    (jobFamilyId === 'marketing' && scopeAxis && ['risk', 'mixed_signal', 'positive_with_check'].includes(scopeAxis.level)) ||
    hasMarketingBreadthSignal
  ) {
    risks.push(
      buildCoreRiskItem({
        key: 'scope_breadth',
        title: '업무 범위 과다와 역할 경계 모호',
        summary: '자사몰, CRM, 콘텐츠, 프로모션, 라이브커머스 같은 하위 업무가 한 포지션에 묶여 있어 핵심 전문성보다 운영 범위만 넓게 남을 가능성이 있습니다.',
        whyRisk: '핵심 문제는 일이 많다는 점보다 경계가 흐리다는 점입니다. 팀 구조가 약하면 여러 운영 업무를 우선순위 없이 넓게 떠안는 운영형 제너럴리스트 역할이 될 수 있습니다.',
        questionToVerify: '자사몰, 인플루언서, CRM, 콘텐츠, 라이브커머스 중 실제 주 업무는 무엇이고 각 업무 비중은 어떻게 나뉘나요?',
        severity: scopeAxis?.level === 'risk' ? 'high' : 'medium',
        sourceAxisKeys: ['scopeClarity', 'repetition'],
      }),
    )
  }

  if (
    responsibilityAxis &&
    ['insufficient_info', 'positive_with_check', 'mixed_signal'].includes(responsibilityAxis.level) &&
    (jobFamilyId === 'marketing' ||
      scopeAxis?.level === 'risk' ||
      /(전략|기획)/i.test(strategyWithoutAuthorityQuote))
  ) {
    risks.push(
      buildCoreRiskItem({
        key: 'authority_gap',
        title: '전략 권한 불명확',
        summary: '전략이나 기획 문구는 보이지만, 예산·채널·우선순위 같은 실제 결정권이 드러나지 않아 실행 중심 역할일 가능성을 배제하기 어렵습니다.',
        whyRisk: '전략이라는 표현보다 중요한 것은 무엇을 직접 정하느냐입니다. 승인권과 우선순위 결정권이 없으면 전략 경험보다 실행과 조율 경험만 남을 수 있습니다.',
        questionToVerify: '예산, 채널, 프로모션, 우선순위 중 제가 직접 결정하거나 제안할 수 있는 범위는 어디까지인가요?',
        severity: responsibilityAxis?.level === 'mixed_signal' ? 'medium' : 'medium',
        sourceAxisKeys: ['responsibility'],
      }),
    )
  }

  if (
    measurableAxis &&
    ['insufficient_info', 'positive_with_check', 'mixed_signal'].includes(measurableAxis.level) &&
    (jobFamilyId === 'marketing' || scopeAxis?.level === 'risk' || repetitionAxis?.level === 'risk')
  ) {
    risks.push(
      buildCoreRiskItem({
        key: 'kpi_gap',
        title: 'KPI와 성과 책임 범위 불명확',
        summary: '성과 분석 문구는 보이지만, ROAS·CVR·매출·리텐션 중 무엇을 직접 책임지는지는 아직 불분명합니다.',
        whyRisk: '성과 분석을 한다는 말만으로는 부족합니다. 직접 책임지는 지표와 리뷰 기준이 흐리면, 입사 후 성과가 숫자나 대표 산출물로 남기 어렵습니다.',
        questionToVerify:
          jobFamilyId === 'marketing'
            ? '이 역할의 성과는 ROAS, CVR, 매출, 리텐션 같은 어떤 지표나 결과물로 평가하나요?'
            : '이 역할의 성과는 어떤 지표나 결과물로 평가하나요?',
        severity: measurableAxis?.level === 'insufficient_info' ? 'medium' : 'medium',
        sourceAxisKeys: ['measurable'],
      }),
    )
  }

  if (repetitionAxis && ['risk', 'positive_with_check', 'mixed_signal'].includes(repetitionAxis.level)) {
    risks.push(
      buildCoreRiskItem({
        key: 'ops_mix',
        title: '운영 비중이 전략 경험을 덮을 가능성',
        summary: '분석과 개선 문구가 일부 있어도 운영성 업무 비중이 더 크면, 시간이 지나도 비슷한 실행 업무가 반복될 가능성이 있습니다.',
        whyRisk: '이 경우 핵심 리스크는 단순 반복이 아니라 비중입니다. 개선 과제가 부수적이면 경력 자산은 전략보다 운영 제너럴리스트 경험으로 남을 가능성이 큽니다.',
        questionToVerify: '운영 업무와 실험·개선 업무의 비중은 실제로 어느 정도인가요?',
        severity: repetitionAxis?.level === 'risk' ? 'high' : 'medium',
        sourceAxisKeys: ['repetition'],
      }),
    )
  }

  const priority = {
    scope_breadth: 0,
    authority_gap: 1,
    kpi_gap: 2,
    ops_mix: 3,
  }

  return dedupeTextItems(
    risks.sort((a, b) => (priority[a.key] ?? 99) - (priority[b.key] ?? 99)).slice(0, 3),
    (item) => item.key,
  )
}

function buildCoreRiskQuestions(coreRisks = []) {
  return coreRisks.map((risk) => {
    if (risk.key === 'scope_breadth') {
      return createQuestionTemplate(
        risk.questionToVerify,
        '주 업무와 보조 업무를 나눠 설명하고, 각 업무 비중을 숫자나 최근 사례 기준으로 말합니다.',
        '상황에 따라 전반적으로 다 맡는다고만 하거나 핵심 업무 비중을 명확히 답하지 못합니다.',
        { category: 'scopeClarity', whyAsk: buildQuestionReasonByCategory('scopeClarity') },
      )
    }
    if (risk.key === 'authority_gap') {
      return createQuestionTemplate(
        risk.questionToVerify,
        '예산·채널·우선순위처럼 직접 결정하거나 제안하는 범위를 실제 사례와 함께 설명합니다.',
        '전략 문구는 있지만 실제 결정은 윗선이 하고 본인은 실행만 맡는다고 답합니다.',
        { category: 'responsibility', whyAsk: buildQuestionReasonByCategory('responsibility') },
      )
    }
    if (risk.key === 'kpi_gap') {
      return createQuestionTemplate(
        risk.questionToVerify,
        '직접 책임지는 지표와 함께 리뷰 주기, 보고 방식, 목표 수치를 실제 사례 기준으로 설명합니다.',
        '성과 분석은 하지만 어떤 지표를 본인이 직접 책임지는지는 아직 정해지지 않았다고 답합니다.',
        { category: 'measurable', whyAsk: buildQuestionReasonByCategory('measurable') },
      )
    }
    return createQuestionTemplate(
      '실행 운영과 기획·개선 업무의 비중은 실제로 어느 정도인가요?',
      '운영 비중과 개선 과제를 숫자나 최근 프로젝트 기준으로 구체적으로 설명합니다.',
      '운영이 대부분이지만 개선 기회나 ownership은 모호하다고 답합니다.',
      { category: 'repetition', whyAsk: buildQuestionReasonByCategory('repetition') },
    )
  })
}

function buildQuestionTopicSignature(item = {}) {
  const text = `${item?.category || ''} ${item?.question || ''}`.toLowerCase()
  if (item?.category === 'scopeClarity') return 'scope_breakdown'
  if (item?.category === 'responsibility') return 'decision_authority'
  if (item?.category === 'repetition') return 'ops_vs_improvement'
  if (item?.category === 'measurable') {
    if (/(기준선|3개월|6개월)/i.test(text)) return 'baseline_metrics'
    if (/(직접 책임지는|책임지는 항목|책임지는 지표)/i.test(text)) return 'kpi_ownership'
    return 'kpi_evaluation'
  }
  if (/(자사몰|crm|인플루언서|라이브커머스|콘텐츠).*(비중|주 업무)|주 업무.*(자사몰|crm|인플루언서|라이브커머스|콘텐츠)/i.test(text)) return 'scope_breakdown'
  if (/(kpi|roas|cvr|매출|리텐션|성과|평가)/i.test(text)) return 'kpi_metrics'
  if (/(예산|채널|승인|우선순위|의사결정|권한)/i.test(text)) return 'decision_authority'
  if (/(운영).*(개선|전략|기획|실험|비중)|(개선|전략|기획|실험).*(운영|비중)/i.test(text)) return 'ops_vs_improvement'
  return item?.category || inferQuestionCategoryFromText(item?.question || '')
}

function prioritizeInterviewQuestionsForCoreRisks(interviewQuestions = [], coreRisks = []) {
  const priorityMap = new Map()
  coreRisks.forEach((risk, index) => {
    for (const key of risk.sourceAxisKeys || []) {
      if (!priorityMap.has(key)) priorityMap.set(key, index)
    }
  })

  return [...interviewQuestions].sort((a, b) => {
    const topicA = buildQuestionTopicSignature(a)
    const topicB = buildQuestionTopicSignature(b)
    const scoreA = priorityMap.has(a?.category) ? priorityMap.get(a.category) : priorityMap.has(topicA) ? priorityMap.get(topicA) : 99
    const scoreB = priorityMap.has(b?.category) ? priorityMap.get(b.category) : priorityMap.has(topicB) ? priorityMap.get(topicB) : 99
    if (scoreA !== scoreB) return scoreA - scoreB
    return 0
  })
}

function buildActionGuideFromCoreRisks(coreRisks = [], reliabilityGate = null) {
  return buildDecisionStance(coreRisks, reliabilityGate).reason
}

function buildVerdictMessagingFromCoreRisks(coreRisks = [], reliabilityGate = null) {
  if (!coreRisks.length) return null

  const stance = buildDecisionStance(coreRisks, reliabilityGate)

  const hasScope = coreRisks.some((item) => item.key === 'scope_breadth')
  const hasKpi = coreRisks.some((item) => item.key === 'kpi_gap')
  let description = coreRisks[0]?.summary || ''
  if (stance.decisionLevel === 'hold_before_apply') {
    description = '업무 범위와 결정권이 동시에 모호하면 실행보다 운영 조율 경험만 남을 가능성이 있어, 확인 전에는 보류 쪽으로 보는 편이 안전합니다.'
  } else if (stance.decisionLevel === 'conditional_apply') {
    description = '지원 자체를 바로 배제할 단계는 아니지만, 업무 범위와 KPI 구조가 분명한지 먼저 확인해야 합니다.'
  } else if (stance.decisionLevel === 'ops_risk_caution') {
    description = '분석·개선 문구가 일부 있어도 운영 비중이 더 크면 전략 경험보다 운영 경험만 넓게 남을 수 있습니다.'
  } else if (hasScope) {
    description = '업무 범위가 넓게 묶여 있어 성장 기회일 수도 있지만, 핵심 전문성보다 운영 범위만 넓게 남을 가능성을 먼저 확인해야 합니다.'
  } else if (hasKpi) {
    description = '성과 분석 문구는 보이지만 직접 책임지는 지표가 흐려, 지원 전 KPI 구조를 먼저 확인하는 편이 안전합니다.'
  }
  const reason = coreRisks.slice(0, 2).map((item) => item.whyRisk).join(' ')

  return {
    headline: stance.headline,
    decisionLevel: stance.decisionLevel,
    description: toLengthLimitedText(toSentenceLimitedText(description, 1), 120),
    reason: toLengthLimitedText(toSentenceLimitedText(reason, 2), 180),
  }
}

function enrichAxesForDecision(detail = {}) {
  const enrich = (axis) => ({
    ...axis,
    riskInterpretation: buildAxisRiskInterpretation(axis),
    decisionMeaning: buildAxisDecisionMeaning(axis),
  })

  const sevenAxes = (detail?.sevenAxes || []).map(enrich)
  const fiveAxes = (detail?.fiveAxes || buildFiveAxesFromSevenAxes(sevenAxes)).map(enrich)
  return { ...detail, sevenAxes, fiveAxes }
}

function buildTopDecisionRisks(axes = [], auxiliaryChecks = [], coreRisks = []) {
  if (coreRisks.length > 0) {
    return coreRisks.slice(0, 3).map((risk) => ({
      key: risk.key,
      label: risk.title,
      score: risk.severity === 'high' ? 100 : 80,
      summary: risk.summary,
      evidenceQuote: '',
      reason: risk.whyRisk,
    }))
  }

  const coreWeights = {
    measurable: 5,
    responsibility: 5,
    scopeClarity: 4,
    repetition: 4,
    transferable: 4,
    difficulty: 3,
    learningFeedback: 3,
  }

  const axisItems = (axes || [])
    .map((axis) => {
      const normalizedTone = getDetailTone(axis?.level)
      const base =
        normalizedTone === 'danger' ? 100 : normalizedTone === 'warning' ? 75 : axis?.level === 'insufficient_info' ? 60 : normalizedTone === 'neutral' ? 45 : 15
      const weight = coreWeights[axis?.key] || 1
      return {
        key: axis?.key,
        label: axis?.label || '핵심 축',
        score: base + weight,
        summary: axis?.summary || '',
        evidenceQuote: axis?.evidence?.quote || '',
        reason: axis?.decisionMeaning || '',
      }
    })
    .filter((item) => item.score >= 50)

  const auxiliaryItems = (auxiliaryChecks || [])
    .filter((item) => ['danger', 'warning'].includes(getDetailTone(item?.level)))
    .map((item) => ({
      key: item?.key,
      label: item?.label || '보조 체크',
      score: getDetailTone(item?.level) === 'danger' ? 58 : 52,
      summary: item?.summary || '',
      evidenceQuote: item?.evidence?.quote || '',
      reason: '보조 체크 항목이므로 핵심 축보다 우선하지 않지만, 실제 지원 안전성에는 영향을 줍니다.',
    }))

  return [...axisItems, ...auxiliaryItems]
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
}

function buildFallbackDisplayVerdict(detail) {
  const axes = detail?.fiveAxes || detail?.sevenAxes || []
  const auxiliaryChecks = detail?.auxiliaryChecks || []
  const coreRisks = detail?.coreRisks || []
  const coreKeys = ['measurable', 'responsibility', 'scopeClarity', 'repetition', 'transferable']
  const coreAxes = axes.filter((axis) => coreKeys.includes(axis?.key))
  const riskCoreCount = coreAxes.filter((axis) => axis?.level === 'risk').length
  const infoGapCoreCount = coreAxes.filter((axis) => axis?.level === 'insufficient_info').length
  const mixedCoreCount = coreAxes.filter((axis) => ['mixed_signal', 'positive_with_check'].includes(axis?.level)).length
  const safeCoreCount = coreAxes.filter((axis) => axis?.level === 'strong_positive').length
  const blockingAuxiliary = auxiliaryChecks.filter((item) => getDetailTone(item?.level) === 'danger').length
  const topDecisionRisks = buildTopDecisionRisks(detail?.sevenAxes || axes, auxiliaryChecks, coreRisks)

  let riskLevel = 'needs_review'
  let label = '조건부 지원 추천'
  let tone = 'warning'
  let description = '긍정 신호는 있지만 핵심 정보 공백이 남아 있어, 면접 답변으로 역할 수준을 검증해야 합니다.'
  let reason = '핵심 축에 정보 공백이 남아 있어 지원 판단을 바로 확정하기 어렵습니다.'

  if (blockingAuxiliary > 0 || riskCoreCount >= 2) {
    riskLevel = 'high'
    label = '위험 신호 높음'
    tone = 'danger'
    description = '반복 운영, 권한 부재, 성과 불명확 같은 직접 위험 신호가 겹쳐 보여 보수적으로 보는 편이 안전합니다.'
    reason = '핵심 축에서 직접 부정 신호가 복수로 확인돼 면접 전 기대보다 실제 역할이 좁을 가능성이 큽니다.'
  } else if (riskCoreCount >= 1 && infoGapCoreCount >= 1) {
    riskLevel = 'medium'
    label = '보류 권장'
    tone = 'warning'
    description = '직접 위험 신호와 핵심 정보 공백이 함께 있어, 답변이 명확하지 않으면 보류 쪽으로 보는 편이 안전합니다.'
    reason = '부정 신호가 이미 보이고 동시에 핵심 정보도 비어 있어, 실제 역할 수준을 확신하기 어렵습니다.'
  } else if (infoGapCoreCount >= 3 || (infoGapCoreCount >= 2 && mixedCoreCount >= 1)) {
    riskLevel = 'medium'
    label = '조건부 지원 추천'
    tone = 'warning'
    description = '공고에 직접 위험 문구가 많지는 않지만, KPI·권한·역할 범위 같은 핵심 정보가 반복적으로 비어 있습니다.'
    reason = '정보 없음 자체가 위험은 아니지만, 핵심 축 공백이 겹치면 면접 검증 전에는 역할 가치를 판단하기 어렵습니다.'
  } else if (safeCoreCount >= 3 && riskCoreCount === 0) {
    riskLevel = 'low'
    label = '지원 추천'
    tone = 'safe'
    description = 'KPI, 역할 범위, 성과 축적 가능성에서 비교적 분명한 긍정 신호가 보여 지원해 볼 만합니다.'
    reason = '핵심 축에서 긍정 근거가 비교적 뚜렷하고, 직접 위험 신호는 제한적입니다.'
  }

  const coreRiskMessaging = buildVerdictMessagingFromCoreRisks(coreRisks)
  if (coreRiskMessaging) {
    description = coreRiskMessaging.description || description
    reason = coreRiskMessaging.reason || reason
  }

  return {
    riskLevel,
    label,
    description,
    tone,
    reason,
    topDecisionRisks,
  }
}

function buildDisplayVerdict({ freePreview, detail }) {
  const weightedVerdict = buildFallbackDisplayVerdict(detail)
  if (!freePreview?.riskLevel) return weightedVerdict

  if (freePreview.riskLevel === 'high' && weightedVerdict.riskLevel !== 'high') {
    return {
      ...weightedVerdict,
      riskLevel: 'high',
      label: '위험 신호 높음',
      tone: 'danger',
      description: weightedVerdict.description.includes('직접 위험')
        ? weightedVerdict.description
        : '미리보기 단계에서 직접 위험 신호가 확인돼, 상세 리포트도 보수적으로 보는 편이 안전합니다.',
      reason:
        weightedVerdict.reason ||
        '미리보기에서 직접 위험 신호가 먼저 확인됐으므로, 상세 판단도 그 신호를 우선 반영합니다.',
    }
  }

  return {
    ...weightedVerdict,
    description: weightedVerdict.description || toLengthLimitedText(toSentenceLimitedText(freePreview.headline, 1), 120),
  }
}

function getDecisionConfidenceScore(axes = [], auxiliaryChecks = []) {
  const score =
    50 +
    axes.filter((axis) => getDetailTone(axis?.level) === 'safe').length * 9 -
    axes.filter((axis) => getDetailTone(axis?.level) === 'danger').length * 12 -
    axes.filter((axis) => getDetailTone(axis?.level) === 'neutral').length * 4 -
    auxiliaryChecks.filter((item) => getDetailTone(item?.level) === 'danger').length * 10 -
    auxiliaryChecks.filter((item) => getDetailTone(item?.level) === 'warning').length * 5

  return Math.max(28, Math.min(91, score))
}

function mapToneToVerdictCode(tone = 'neutral') {
  if (tone === 'safe') return 'low_risk'
  if (tone === 'danger') return 'high_risk'
  if (tone === 'warning') return 'mixed'
  return 'verification_needed'
}

function mapToneToVerdictLabel(tone = 'neutral') {
  if (tone === 'safe') return '좋음'
  if (tone === 'danger') return '위험 신호'
  if (tone === 'warning') return '확인 필요'
  return '정보 부족'
}

function mapVerdictToAction(tone = 'neutral') {
  if (tone === 'safe') return 'apply_with_checks'
  if (tone === 'danger') return 'avoid'
  if (tone === 'warning') return 'check_before_apply'
  return 'check_before_apply'
}

function getDecisionVerificationPrompt(axis = {}) {
  const map = {
    repetition: '운영 비중과 개선 과제를 숫자나 최근 사례 기준으로 확인해야 합니다.',
    responsibility: '예산, 채널, 승인, 우선순위 중 직접 결정하는 범위를 확인해야 합니다.',
    measurable: 'KPI, 리뷰 주기, 결과 보고 방식이 어떻게 잡혀 있는지 확인해야 합니다.',
    difficulty: '입사 후 책임 범위와 문제 난이도가 어떻게 커지는지 확인해야 합니다.',
    transferable: '외부에서도 설명 가능한 프로젝트, 리포트, 개선 결과가 남는지 확인해야 합니다.',
    scopeClarity: '핵심 업무와 요청성 보조 업무가 어디서 갈리는지 확인해야 합니다.',
    learningFeedback: '리뷰 주기, 피드백 주체, 회고 방식이 있는지 확인해야 합니다.',
  }

  return map[axis?.key] || `${axis?.label || '핵심 항목'}을 구체적으로 확인해야 합니다.`
}

function buildDecisionRiskSignals(sevenAxes = [], auxiliaryChecks = []) {
  if (auxiliaryChecks?.__detailCoreRisks?.length > 0) {
    return auxiliaryChecks.__detailCoreRisks.slice(0, 5).map((risk) => ({
      source: 'core_risk',
      key: risk.key,
      label: risk.title,
      severity: risk.severity,
      evidenceQuote: '',
      summary: risk.summary,
      decisionMeaning: risk.whyRisk,
    }))
  }

  const axisSignals = (sevenAxes || [])
    .filter((axis) => axis?.level === 'risk')
    .map((axis) => ({
      source: 'axis',
      key: axis?.key || '',
      label: axis?.label || '',
      severity: 'high',
      evidenceQuote: axis?.evidence?.quote || '',
      summary: axis?.riskInterpretation || axis?.summary || '',
      decisionMeaning: axis?.decisionMeaning || '',
    }))

  const auxiliarySignals = (auxiliaryChecks || [])
    .filter((item) => getDetailTone(item?.level) === 'danger')
    .map((item) => ({
      source: 'auxiliary_check',
      key: item?.key || '',
      label: item?.label || '',
      severity: 'high',
      evidenceQuote: item?.evidence?.quote || '',
      summary: item?.summary || '',
      decisionMeaning: item?.riskyAnswerSignal || item?.question || '',
    }))

  return [...axisSignals, ...auxiliarySignals].slice(0, 5)
}

function getVerificationTopicSignature(item = {}) {
  const key = String(item?.key || '')
  if (key === 'scope_breadth' || key === 'scopeClarity') return 'scope_breakdown'
  if (key === 'authority_gap' || key === 'responsibility') return 'decision_authority'
  if (key === 'kpi_gap' || key === 'measurable') return 'kpi_metrics'
  if (key === 'ops_mix' || key === 'repetition') return 'ops_vs_improvement'

  const text = `${item?.label || ''} ${item?.missingInfo || ''} ${item?.questionToAsk || ''}`.toLowerCase()
  if (/(자사몰|crm|인플루언서|라이브커머스|콘텐츠).*(비중|주 업무)|주 업무.*(자사몰|crm|인플루언서|라이브커머스|콘텐츠)/i.test(text)) return 'scope_breakdown'
  if (/(kpi|roas|cvr|매출|리텐션|성과|평가)/i.test(text)) return 'kpi_metrics'
  if (/(예산|채널|승인|우선순위|의사결정|권한)/i.test(text)) return 'decision_authority'
  if (/(운영).*(개선|전략|기획|실험|비중)|(개선|전략|기획|실험).*(운영|비중)/i.test(text)) return 'ops_vs_improvement'
  return key || text
}

function buildDecisionNextSteps(coreRisks = [], reliabilityGate = null) {
  if (reliabilityGate?.criticalCount >= 1) {
    return [
      '공식 채용 주체, 회사 이메일, 계약서를 먼저 확인하세요.',
      '그다음 실제 업무 범위와 KPI 구조를 확인하세요.',
      '기본 신원과 계약 구조가 흐리면 지원 판단을 멈추세요.',
    ]
  }

  const keys = new Set(coreRisks.map((risk) => risk.key))
  const items = []

  if (keys.has('scope_breadth')) {
    items.push('핵심 업무와 보조 업무를 나눠서 설명해 달라고 요청하세요.')
  }
  if (keys.has('authority_gap')) {
    items.push('예산, 채널, 우선순위 중 직접 결정하는 범위를 먼저 확인하세요.')
  }
  if (keys.has('kpi_gap')) {
    items.push('입사 후 직접 책임지는 KPI와 리뷰 기준을 먼저 확인하세요.')
  }
  if (keys.has('ops_mix')) {
    items.push('운영 업무와 개선 업무의 실제 비중을 숫자 기준으로 확인하세요.')
  }

  return dedupeTextItems(items, (item) => item).slice(0, 3)
}

function buildDecisionVerificationNotes(coreRisks = [], sevenAxes = [], auxiliaryChecks = []) {
  const coreRiskNotes = (coreRisks || []).map((risk) => ({
    key: risk.key,
    text:
      risk.key === 'scope_breadth'
        ? '자사몰, CRM, 콘텐츠, 라이브커머스 중 실제 주 업무와 각 업무 비중을 확인해야 합니다.'
        : risk.key === 'authority_gap'
          ? '예산, 채널, 우선순위 중 직접 결정하거나 제안하는 범위를 확인해야 합니다.'
          : risk.key === 'kpi_gap'
            ? '직접 책임지는 KPI, 리뷰 주기, 결과 보고 방식을 확인해야 합니다.'
            : risk.key === 'ops_mix'
              ? '운영 업무와 실험·개선 업무의 실제 비중을 최근 사례 기준으로 확인해야 합니다.'
              : risk.questionToVerify || risk.whyRisk,
  }))

  const axisNotes = (sevenAxes || [])
    .filter((axis) => axis?.level === 'insufficient_info')
    .map((axis) => ({
      key: axis?.key,
      text: `${axis?.label || '이 축'}은 아직 공고 근거가 비어 있어 ${getAxisDecisionMeta(axis?.key).confirmPoint.toLowerCase()}`,
    }))

  const auxiliaryNotes = (auxiliaryChecks || [])
    .filter((item) => getDetailTone(item?.level) === 'warning')
    .map((item) => ({
      key: item?.key,
      text: item?.goodAnswerSignal || item?.summary || '',
    }))

  return dedupeTextItems([...coreRiskNotes, ...axisNotes, ...auxiliaryNotes], (item) => getVerificationTopicSignature(item))
    .map((item) => toLengthLimitedText(toSentenceLimitedText(item?.text, 2), 140))
    .filter(Boolean)
    .slice(0, 3)
}

function buildDecisionVerificationNeeded(sevenAxes = [], auxiliaryChecks = []) {
  const coreRiskItems = (auxiliaryChecks?.__detailCoreRisks || []).map((risk) => ({
    source: 'core_risk',
    key: risk.key,
    label: risk.title,
    missingInfo: risk.summary,
    whyItMatters: risk.whyRisk,
    questionToAsk: risk.questionToVerify,
  }))

  const axisItems = (sevenAxes || [])
    .filter((axis) => axis?.level === 'insufficient_info')
    .map((axis) => ({
      source: 'axis',
      key: axis?.key || '',
      label: axis?.label || '',
      missingInfo: axis?.summary || `${axis?.label || '핵심 항목'} 관련 근거가 부족합니다.`,
      whyItMatters: axis?.decisionMeaning || '정보가 부족하면 지원 판단을 보수적으로 해야 합니다.',
      questionToAsk: getDecisionVerificationPrompt(axis),
    }))

  const auxiliaryItems = (auxiliaryChecks || [])
    .filter((item) => getDetailTone(item?.level) === 'warning')
    .map((item) => ({
      source: 'auxiliary_check',
      key: item?.key || '',
      label: item?.label || '',
      missingInfo: item?.summary || `${item?.label || '핵심 항목'} 확인이 필요합니다.`,
      whyItMatters: item?.goodAnswerSignal || '이 항목은 실제 지원 판단에 직접 영향을 줍니다.',
      questionToAsk: item?.question || '',
    }))

  const dedupedByQuestion = dedupeTextItems([...coreRiskItems, ...axisItems, ...auxiliaryItems], (item) => item.questionToAsk)
  return dedupeTextItems(dedupedByQuestion, (item) => getVerificationTopicSignature(item)).slice(0, 6)
}

export function buildDecisionReport({ freePreview, detail }) {
  const verdict = detail?.displayVerdict || buildFallbackDisplayVerdict(detail)
  const sevenAxes = detail?.sevenAxes || []
  const fiveAxes = detail?.fiveAxes || []
  const auxiliaryChecks = detail?.auxiliaryChecks || []
  const coreRisks = detail?.coreRisks || []
  const interviewQuestions = detail?.interviewQuestions || []
  const scoringAxes = sevenAxes.length > 0 ? sevenAxes : fiveAxes
  const decisionAuxiliaryChecks = Object.assign([], auxiliaryChecks, { __detailCoreRisks: coreRisks })
  const confidenceScore = getDecisionConfidenceScore(scoringAxes, auxiliaryChecks)
  const decisionStance = detail?.decisionStance || buildDecisionStance(coreRisks)
  const nextSteps = buildDecisionNextSteps(coreRisks)
  const verificationNotes = buildDecisionVerificationNotes(coreRisks, sevenAxes, auxiliaryChecks)
  const alignedVerdict = buildVerdictMessagingFromCoreRisks(coreRisks) || null

  return {
    overallVerdict: {
      code: mapToneToVerdictCode(verdict?.tone),
      label: mapToneToVerdictLabel(verdict?.tone),
      tone: verdict?.tone || 'neutral',
      headline: decisionStance.headline,
      decisionLevel: decisionStance.decisionLevel,
      summary: verdict?.reason || verdict?.description || '',
      confidenceScore,
      confidenceReason: buildConfidenceReason(scoringAxes, auxiliaryChecks),
    },
    summary: {
      headline: alignedVerdict?.description || freePreview?.headline || verdict?.description || '',
      oneLineReason: detail?.actionGuide || verdict?.reason || verdict?.description || '',
      topEvidenceQuote: freePreview?.topEvidence?.quote || detail?.keyEvidence?.[0]?.quote || '',
      topEvidenceInterpretation:
        freePreview?.topEvidence?.interpretation || detail?.keyEvidence?.[0]?.interpretation || '',
    },
    riskSignals: buildDecisionRiskSignals(sevenAxes, decisionAuxiliaryChecks),
    verificationNeeded: buildDecisionVerificationNeeded(sevenAxes, decisionAuxiliaryChecks),
    recommendedQuestions: interviewQuestions.map((item, index) => ({
      key: item?.category || `question_${index}`,
      category: item?.category || '',
      question: item?.question || '',
      whyAsk: item?.whyAsk || '',
      goodAnswerSignal: item?.goodAnswerSignal || '',
      riskyAnswerSignal: item?.riskyAnswerSignal || '',
      answerDecisionHint: item?.answerDecisionHint || '',
    })),
    axes: {
      five: fiveAxes,
      seven: sevenAxes,
    },
    decisionGuide: {
      recommendedAction: decisionStance.recommendedAction || mapVerdictToAction(verdict?.tone),
      headline: decisionStance.headline,
      decisionLevel: decisionStance.decisionLevel,
      reason: detail?.actionGuide || verdict?.reason || verdict?.description || '',
      nextSteps,
      verificationNotes,
    },
  }
}

function finalizeDetailForDisplay(detail, structured, freePreview = null) {
  const enrichedDetail = enrichAxesForDecision(detail)
  const coreRisks = buildCoreRisks(enrichedDetail, structured)
  const detailWithCoreRisks = { ...enrichedDetail, coreRisks }
  const reliabilityGate = structured?.reliabilityGate || buildReliabilityGate(structured)
  const auxiliaryChecks = filterAuxiliaryChecksForDisplay(detailWithCoreRisks?.auxiliaryChecks || [], reliabilityGate)
  const interviewQuestions = filterInterviewQuestionsForDisplay(
    dedupeTextItems([...buildCoreRiskQuestions(coreRisks), ...(detailWithCoreRisks?.interviewQuestions || [])], (item) => item.question),
    {
    auxiliaryChecks,
    structured,
      detailJobFamily: detailWithCoreRisks?.jobFamily || structured?.jobFamily || null,
      coreRisks,
    },
  )
  const prioritizedQuestions = prioritizeInterviewQuestionsForCoreRisks(interviewQuestions, coreRisks)
  const actionGuide = buildActionGuideFromCoreRisks(coreRisks, reliabilityGate)
  const decisionStance = buildDecisionStance(coreRisks, reliabilityGate)

  return {
    ...detailWithCoreRisks,
    finalSummary: toLengthLimitedText(toSentenceLimitedText(detailWithCoreRisks?.finalSummary, 1), 120),
    actionGuide: toLengthLimitedText(toSentenceLimitedText(actionGuide || detailWithCoreRisks?.actionGuide, 2), 180),
    auxiliaryChecks,
    keyEvidence: (detailWithCoreRisks?.keyEvidence || []).slice(0, 3).map((item) => ({
      ...item,
      quote: compactEvidenceQuote(item?.quote, 110),
      interpretation: toLengthLimitedText(toSentenceLimitedText(item?.interpretation, 1), 80),
      whyImportant: toLengthLimitedText(toSentenceLimitedText(item?.whyImportant, 1), 80),
    })),
    sevenAxes: (detailWithCoreRisks?.sevenAxes || []).map((axis) => ({
      ...axis,
      evidence: axis?.evidence
        ? {
            ...axis.evidence,
            quote: compactEvidenceQuote(axis?.evidence?.quote, 110),
          }
        : axis?.evidence,
      summary: toLengthLimitedText(toSentenceLimitedText(axis?.summary, 1), 90),
      riskInterpretation: toLengthLimitedText(toSentenceLimitedText(axis?.riskInterpretation, 3), 220),
      decisionMeaning: toLengthLimitedText(toSentenceLimitedText(axis?.decisionMeaning, 2), 120),
    })),
    fiveAxes: (detailWithCoreRisks?.fiveAxes || []).map((axis) => ({
      ...axis,
      evidence: axis?.evidence
        ? {
            ...axis.evidence,
            quote: compactEvidenceQuote(axis?.evidence?.quote, 110),
          }
        : axis?.evidence,
      summary: toLengthLimitedText(toSentenceLimitedText(axis?.summary, 1), 90),
      riskInterpretation: toLengthLimitedText(toSentenceLimitedText(axis?.riskInterpretation, 3), 220),
      decisionMeaning: toLengthLimitedText(toSentenceLimitedText(axis?.decisionMeaning, 2), 120),
    })),
    coreRisks,
    decisionStance,
    interviewQuestions: pickInterviewQuestionsForCompactDisplay(
      prioritizedQuestions.map((item) => ({
        ...item,
        answerDecisionHint: toLengthLimitedText(
          toSentenceLimitedText(
            item?.answerDecisionHint || buildAnswerDecisionHint(item?.category, item?.goodAnswerSignal, item?.riskyAnswerSignal),
            2,
          ),
          110,
        ),
      })),
      6,
      coreRisks,
    ),
    companyContext: compactCompanyContext(detailWithCoreRisks?.companyContext),
    displayVerdict: buildDisplayVerdict({ freePreview, detail: { ...detailWithCoreRisks, actionGuide } }),
  }
}

function sanitizeCopyWithPolicy(text, { surface, claimStrength = 'soft_inference', hasEvidence = false, fallbackText }) {
  const validation = validatePersuasionCopy(text, { surface, claimStrength, hasEvidence })
  if (validation.ok) {
    return text
  }
  return fallbackText
}

function applyPreviewPersuasionPolicy(preview, fallbackPreview, trace = null) {
  const quote = preview?.topEvidence?.quote || ''
  const rawHeadline = preview?.headline
  const rawInterpretation = preview?.topEvidence?.interpretation
  const headlineFallback = fallbackPreview.headline
  const interpretationFallback = fallbackPreview.topEvidence.interpretation
  const headline = sanitizeCopyWithPolicy(rawHeadline, {
    surface: 'preview',
    claimStrength: 'soft_inference',
    hasEvidence: Boolean(quote),
    fallbackText: headlineFallback,
  })
  const interpretation = sanitizeCopyWithPolicy(rawInterpretation, {
    surface: 'preview',
    claimStrength: quote ? 'strict_evidence' : 'soft_inference',
    hasEvidence: Boolean(quote),
    fallbackText: interpretationFallback,
  })

  const shortReasons = (preview?.shortReasons || []).slice(0, 2).map((reason, index) => {
    const fallbackText = fallbackPreview.shortReasons?.[index] || fallbackPreview.shortReasons?.[0] || allowedTemplates.preview.freeItems[0]
    return sanitizeCopyWithPolicy(reason, {
      surface: 'preview',
      claimStrength: 'soft_inference',
      fallbackText,
    })
  })

  const policyChecked = {
    ...preview,
    headline,
    shortReasons,
    topEvidence: {
      ...preview.topEvidence,
      interpretation,
    },
  }

  if (trace) {
    trace.policy = {
      quote,
      headline: {
        input: rawHeadline || '',
        output: headline || '',
        fallback: headlineFallback || '',
        usedFallback: Boolean((rawHeadline || '') !== (headline || '') && (headline || '') === (headlineFallback || '')),
      },
      interpretation: {
        input: rawInterpretation || '',
        output: interpretation || '',
        fallback: interpretationFallback || '',
        usedFallback: Boolean((rawInterpretation || '') !== (interpretation || '') && (interpretation || '') === (interpretationFallback || '')),
      },
      shortReasons: (preview?.shortReasons || []).slice(0, 2).map((reason, index) => {
        const fallbackText = fallbackPreview.shortReasons?.[index] || fallbackPreview.shortReasons?.[0] || allowedTemplates.preview.freeItems[0]
        const output = shortReasons[index] || ''
        return {
          input: reason || '',
          output,
          fallback: fallbackText,
          usedFallback: Boolean((reason || '') !== output && output === fallbackText),
        }
      }),
    }
  }

  return dedupeFreePreviewFields(policyChecked, fallbackPreview, trace)
}

function normalizeEvidenceText(text) {
  return String(text || '')
    .replace(/[“”"'‘’`]/g, '')
    .replace(/^[*•·-]\s*/gm, '')
    .replace(/\s*:\s*/g, ': ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function verifyQuoteAgainstPosting(quote, jobPostingText) {
  const normalizedQuote = normalizeEvidenceText(quote)
  const normalizedPosting = normalizeEvidenceText(jobPostingText)
  if (!normalizedQuote || !normalizedPosting) {
    return {
      verified: false,
      matchedSegments: [],
      strategy: 'missing_input',
    }
  }
  if (normalizedPosting.includes(normalizedQuote)) {
    return {
      verified: true,
      matchedSegments: [normalizedQuote],
      strategy: 'full_quote',
    }
  }

  const segments = String(quote || '')
    .split(/\n+/)
    .flatMap((line) => line.split(/\s+\/\s+/))
    .map((segment) => normalizeEvidenceText(segment))
    .map((segment) => segment.trim().replace(/^[“”"'‘’`]+|[“”"'‘’`]+$/g, ''))
    .filter((segment) => segment.length >= 8)
  const matchedSegments = [...new Set(segments.filter((segment) => normalizedPosting.includes(segment)))]

  return {
    verified: matchedSegments.length >= 2,
    matchedSegments,
    strategy: matchedSegments.length >= 2 ? 'segment_match' : 'no_match',
  }
}

function collectConditionalOverridePositiveSignals(jobPostingText, structured) {
  const text = String(jobPostingText || '')
  const rules = [
    {
      key: 'measurable_metrics',
      category: 'measurable',
      pattern: /(KPI|지표|전환율|리텐션|활성화율|완료율|사용률|매출|ROAS|CAC|오류율|처리 시간)/i,
    },
    {
      key: 'measurable_targets',
      category: 'measurable',
      pattern: /(3개월 목표|6개월 목표|30일 내|90일|목표\s*:|개선 목표)/i,
    },
    {
      key: 'ownership_authority',
      category: 'ownership',
      pattern: /(문제 정의|우선순위 제안|실험 설계 권한|의사결정|주도|직접 제안|책임|결정)/i,
    },
    {
      key: 'ownership_scope',
      category: 'ownership',
      pattern: /(기획 방향|담당 영역|로드맵|직접 수행|오너)/i,
    },
    {
      key: 'artifacts_deliverables',
      category: 'artifacts_learning',
      pattern: /(PRD|리포트|대시보드|회고 문서|실험 설계 문서|문서화)/i,
    },
    {
      key: 'learning_feedback',
      category: 'artifacts_learning',
      pattern: /(리뷰 미팅|1:1 피드백|피드백|회고|실험 결과|분기마다|성과 발표|공유)/i,
    },
    {
      key: 'experimentation',
      category: 'artifacts_learning',
      pattern: /(A\/B 테스트|실험 설계|문제 발견|개선 과제)/i,
    },
    {
      key: 'analytics_tools',
      category: 'measurable',
      pattern: /(Amplitude|GA4|SQL|Metabase|퍼널 분석|데이터 분석)/i,
    },
  ]

  const matchedSignals = rules.filter((rule) => rule.pattern.test(text))
  const categories = [...new Set(matchedSignals.map((rule) => rule.category))]

  const axesByKey = Object.fromEntries((structured?.fiveAxes || []).map((axis) => [axis.key, axis.level]))
  if (['strong_positive', 'positive_with_check'].includes(axesByKey.measurable) && !categories.includes('measurable')) {
    categories.push('measurable')
  }
  if (['strong_positive', 'positive_with_check'].includes(axesByKey.responsibility) && !categories.includes('ownership')) {
    categories.push('ownership')
  }

  return {
    count: matchedSignals.length,
    categories,
    keys: matchedSignals.map((rule) => rule.key),
  }
}

function collectConditionalOverrideNegativeSignals(jobPostingText, structured) {
  const text = String(jobPostingText || '')
  const rules = [
    {
      key: 'repetition_risk_axis',
      matched: structured?.fiveAxes?.find((axis) => axis.key === 'repetition')?.level === 'risk',
    },
    {
      key: 'assist_only_copy',
      matched: /(보조|지원|어시스트|상급자 지시|요청사항 반영|요청 처리)/i.test(text),
    },
    {
      key: 'repetitive_ops_copy',
      matched: /(반복 응대|반복 운영|등록|업로드|검수|정산|모니터링|내부 시스템 입력)/i.test(text),
    },
    {
      key: 'vague_scope_copy',
      matched: /(기타 업무|전반적인 운영 업무|다양한 업무 지원|필요 시 유관 업무 수행|유연한 업무 대응|업무 전반)/i.test(text),
    },
  ]

  return {
    count: rules.filter((rule) => rule.matched).length,
    keys: rules.filter((rule) => rule.matched).map((rule) => rule.key),
  }
}

function shouldAllowConditionalLlmRiskOverride({
  jobPostingText,
  structured,
  fallbackPreview,
  llmFreePreview,
}) {
  const blockedReasons = []
  const reliabilityGate = structured?.reliabilityGate || { criticalSignals: [] }
  const auxiliaryChecks = structured?.auxiliaryChecks || []
  const applicationSafety = auxiliaryChecks.find((item) => item.key === 'applicationSafety')?.level || 'insufficient_info'
  const contractConsistency = auxiliaryChecks.find((item) => item.key === 'contractConsistency')?.level || 'insufficient_info'
  const fiveAxes = structured?.fiveAxes || []
  const repetitionLevel = fiveAxes.find((axis) => axis.key === 'repetition')?.level || 'insufficient_info'
  const responsibilityLevel = fiveAxes.find((axis) => axis.key === 'responsibility')?.level || 'insufficient_info'
  const measurableLevel = fiveAxes.find((axis) => axis.key === 'measurable')?.level || 'insufficient_info'
  const transferableLevel = fiveAxes.find((axis) => axis.key === 'transferable')?.level || 'insufficient_info'
  const scopeClarityLevel = fiveAxes.find((axis) => axis.key === 'scopeClarity')?.level || 'insufficient_info'
  const llmRiskLevel = llmFreePreview?.riskLevel || null
  const quoteVerification = verifyQuoteAgainstPosting(llmFreePreview?.topEvidence?.quote || '', jobPostingText)
  const positiveSignals = collectConditionalOverridePositiveSignals(jobPostingText, structured)
  const negativeSignals = collectConditionalOverrideNegativeSignals(jobPostingText, structured)

  if (fallbackPreview?.riskLevel !== 'needs_review') blockedReasons.push('fallback_not_needs_review')
  if (llmRiskLevel === 'high') blockedReasons.push('llm_high_veto')
  if ((reliabilityGate?.criticalSignals || []).length > 0) blockedReasons.push('reliability_critical_signals')
  if (['medium', 'high'].includes(applicationSafety)) blockedReasons.push('application_safety_medium_or_high')
  if (['medium', 'high'].includes(contractConsistency)) blockedReasons.push('contract_consistency_medium_or_high')
  if (!quoteVerification.verified) blockedReasons.push('quote_evidence_not_verified')
  if (positiveSignals.count < 7) blockedReasons.push('positive_signals_below_threshold')
  if (!positiveSignals.categories.includes('measurable')) blockedReasons.push('missing_positive_measurable')
  if (!positiveSignals.categories.includes('ownership')) blockedReasons.push('missing_positive_ownership')
  if (!positiveSignals.categories.includes('artifacts_learning')) blockedReasons.push('missing_positive_artifacts_learning')
  if (negativeSignals.count > 1) blockedReasons.push('negative_signals_too_many')
  if (scopeClarityLevel === 'risk') blockedReasons.push('scope_clarity_risk')
  if (repetitionLevel === 'risk' && responsibilityLevel === 'insufficient_info') blockedReasons.push('repetition_risk_with_unclear_responsibility')
  const hasRawTextMeasurableAndTransferableSupport =
    positiveSignals.categories.includes('measurable') && positiveSignals.categories.includes('artifacts_learning')
  if (
    measurableLevel === 'insufficient_info' &&
    transferableLevel === 'insufficient_info' &&
    !hasRawTextMeasurableAndTransferableSupport
  ) {
    blockedReasons.push('measurable_and_transferable_insufficient')
  }

  const allowed = blockedReasons.length === 0

  return {
    allowed,
    reason: allowed ? 'needs_review_to_low_override_allowed' : '',
    blockedReasons,
    positiveSignalCount: positiveSignals.count,
    positiveSignalCategories: positiveSignals.categories,
    positiveSignalKeys: positiveSignals.keys,
    negativeSignalCount: negativeSignals.count,
    negativeSignalKeys: negativeSignals.keys,
    quoteEvidenceVerified: quoteVerification.verified,
    quoteEvidenceMatchStrategy: quoteVerification.strategy,
    quoteEvidenceMatchedSegments: quoteVerification.matchedSegments,
  }
}

function applyDetailPersuasionPolicy(detail, fallbackDetailValue) {
  const finalSummary = sanitizeCopyWithPolicy(detail?.finalSummary, {
    surface: 'report',
    claimStrength: 'soft_inference',
    fallbackText: fallbackDetailValue.finalSummary,
  })
  const actionGuide = sanitizeCopyWithPolicy(detail?.actionGuide, {
    surface: 'report',
    claimStrength: 'soft_inference',
    fallbackText: fallbackDetailValue.actionGuide,
  })

  const keyEvidence = (detail?.keyEvidence || []).map((item, index) => {
    const fallbackItem = fallbackDetailValue.keyEvidence?.[index] || fallbackDetailValue.keyEvidence?.[0] || item
    const hasEvidence = Boolean(item?.quote)
    const interpretation = sanitizeCopyWithPolicy(item?.interpretation, {
      surface: 'report',
      claimStrength: hasEvidence ? 'strict_evidence' : 'soft_inference',
      hasEvidence,
      fallbackText: fallbackItem?.interpretation || '공고에서 직접 근거를 찾기 어려워 추가 확인이 필요합니다.',
    })
    return {
      ...item,
      interpretation,
    }
  })

  return {
    ...detail,
    finalSummary,
    actionGuide,
    keyEvidence,
  }
}

function hydrateDetailCompanyContext(detail, fallbackDetailValue, structured = null) {
  return (
    detail?.companyContext ||
    fallbackDetailValue?.companyContext ||
    structured?.companyContext ||
    createEmptyCompanyContext(structured?.companyName || null)
  )
}

function hydrateDetailServerFields(detail, fallbackDetailValue, structured = null) {
  return {
    ...detail,
    jobFamily: detail?.jobFamily || fallbackDetailValue?.jobFamily || structured?.jobFamily || null,
    sevenAxes: detail?.sevenAxes || fallbackDetailValue?.sevenAxes || structured?.sevenAxes || [],
    auxiliaryChecks: detail?.auxiliaryChecks || fallbackDetailValue?.auxiliaryChecks || structured?.auxiliaryChecks || [],
    fiveAxes:
      detail?.fiveAxes ||
      fallbackDetailValue?.fiveAxes ||
      buildFiveAxesFromSevenAxes(detail?.sevenAxes || fallbackDetailValue?.sevenAxes || structured?.sevenAxes || []),
  }
}

function enforceQuality(detail, sourceLines, structured = null) {
  const blocked = ['블랙기업', '소문', '조직문화', '평판', '무조건 지원']
  const stringify = JSON.stringify(detail)
  if (blocked.some((term) => stringify.includes(term))) {
    detail.actionGuide = '공고에 없는 회사 평판, 소문, 조직문화는 단정하지 않고 면접 질문으로 확인해 주세요.'
  }

  const sourceText = sourceLines.join('\n')
  const seenQuotes = new Set()
  detail.keyEvidence = (detail.keyEvidence || []).filter((item) => {
    if (!item.quote || !evidenceExistsInSource(item.quote, sourceText)) return false
    const normalizedQuote = joinEvidenceQuotes(item.quote)
    if (!normalizedQuote) return false
    const segments = normalizedQuote.split('\n')
    if (!segments.every((segment) => isEvidenceCandidate(segment))) return false
    if (seenQuotes.has(normalizedQuote)) return false
    seenQuotes.add(normalizedQuote)
    return !BLOCKED_PATTERNS.some((pattern) => pattern.test(item.quote))
  })

  const sanitizeAxis = (axis) => {
    const structuredAxis = (structured?.sevenAxes || []).find((item) => item?.key === axis?.key) || null
    const structuredQuote = structuredAxis?.evidence?.quote || ''
    const isRelaxedStructuredRawQuote =
      structuredAxis?.evidence?.section === 'raw' &&
      ['mixed_signal', 'positive_with_check', 'strong_positive'].includes(structuredAxis?.level || '') &&
      evidenceExistsInSource(structuredQuote, sourceText) &&
      !BLOCKED_PATTERNS.some((pattern) => pattern.test(structuredQuote)) &&
      !isEvidenceNoiseLine(structuredQuote) &&
      !isTitleLikeEvidence(structuredQuote)
    const structuredUsableQuote =
      isRelaxedStructuredRawQuote ||
      (structuredQuote &&
        evidenceExistsInSource(structuredQuote, sourceText) &&
        joinEvidenceQuotes(structuredQuote)
          .split('\n')
          .every((segment) => isEvidenceCandidate(segment)) &&
        !BLOCKED_PATTERNS.some((pattern) => pattern.test(structuredQuote)))
    const scopeFallbackQuote =
      axis?.key === 'scopeClarity' &&
      /업무 범위는 선명한 편|담당 제품 범위와 주요 업무가 비교적 구체적/.test(axis?.summary || '')
        ? findRawLine(sourceLines, (line) =>
            /(담당 제품|온보딩.*대시보드.*알림.*리포트 기능|고객 온보딩 퍼널 분석|퍼널 분석|사용자 인터뷰|PRD 작성|기능 요구사항 문서\(PRD\) 작성|A\/B 테스트 기획 및 결과 분석|활성화율, 전환율, 리텐션 지표 추적|스쿼드로 협업)/i.test(
              line,
            ),
          )
        : ''
    const evidence = axis?.evidence || null
    const quote = evidence?.quote || ''
    const usableQuote =
      quote &&
      evidenceExistsInSource(quote, sourceText) &&
      joinEvidenceQuotes(quote)
        .split('\n')
        .every((segment) => isEvidenceCandidate(segment)) &&
      !BLOCKED_PATTERNS.some((pattern) => pattern.test(quote))
    if (!usableQuote && scopeFallbackQuote) {
      const fallbackLevel = axis?.level === 'strong_positive' ? 'strong_positive' : 'positive_with_check'
      return {
        ...axis,
        level: fallbackLevel,
        levelLabel: levelToKo(fallbackLevel),
        evidence: createRawEvidence(scopeFallbackQuote, axis.key),
      }
    }
    if (!usableQuote && structuredUsableQuote && ['mixed_signal', 'positive_with_check', 'strong_positive'].includes(structuredAxis?.level || '')) {
      return {
        ...structuredAxis,
        label: axis?.label || structuredAxis.label,
      }
    }
    if (!usableQuote) {
      const relaxedLevel = axis?.level === 'mixed_signal' ? 'positive_with_check' : 'insufficient_info'
      return {
        ...axis,
        level: relaxedLevel,
        levelLabel: levelToKo(relaxedLevel),
        summary: getAxisInsufficientInfoSummary(axis?.key),
        evidence: null,
      }
    }
    return axis
  }

  detail.sevenAxes = (detail.sevenAxes || []).map(sanitizeAxis)
  detail.fiveAxes = (detail.fiveAxes || buildFiveAxesFromSevenAxes(detail.sevenAxes)).map(sanitizeAxis)
  detail.auxiliaryChecks = (detail.auxiliaryChecks || []).map((check) => {
    const quote = check?.evidence?.quote || ''
    const safeEvidence = !quote || (evidenceExistsInSource(quote, sourceText) && !BLOCKED_PATTERNS.some((pattern) => pattern.test(quote)))
    return {
      ...check,
      evidence: safeEvidence ? toSchemaEvidence(check.evidence) : { quote: '', sourceType: 'none' },
    }
  })

  if (detail.keyEvidence.length === 0) {
    detail.keyEvidence = [{ quote: '', interpretation: '공고에서 직접 근거를 찾기 어려워 추가 확인 필요로 처리했습니다.', whyImportant: '근거가 부족하면 단정 대신 면접 검증 질문으로 확인하는 것이 안전합니다.' }]
  }

  return detail
}

function extractOutputText(data) {
  if (data?.output_text) return data.output_text
  const parts = data?.output
    ?.flatMap((item) => item.content || [])
    ?.filter((content) => content.type === 'output_text' && content.text)
    ?.map((content) => content.text)
  return parts?.join('') || ''
}

function buildOpenAiRequestConfig({ model, responseFormat, temperature, maxTokens, maxOutputTokens }) {
  return {
    model,
    temperature: temperature ?? null,
    max_tokens: maxTokens ?? null,
    max_output_tokens: maxOutputTokens ?? null,
    response_format: responseFormat || null,
  }
}

function normalizeOpenAiUsage(data) {
  const usage = data?.usage || null
  if (!usage || typeof usage !== 'object') return null
  const inputTokens = usage.input_tokens ?? usage.inputTokens ?? null
  const outputTokens = usage.output_tokens ?? usage.outputTokens ?? null
  const totalTokens = usage.total_tokens ?? usage.totalTokens ?? null
  if (inputTokens == null && outputTokens == null && totalTokens == null) return null
  return {
    inputTokens,
    outputTokens,
    totalTokens,
  }
}

async function callOpenAi({ model, prompt, responseFormat, temperature, maxTokens, maxOutputTokens, debug = false, parseJson = true, includeMetadata = false }) {
  const apiKey = process.env.OPENAI_API_KEY
  const requestConfig = buildOpenAiRequestConfig({ model, responseFormat, temperature, maxTokens, maxOutputTokens })
  const shouldReturnMetadata = debug || includeMetadata
  const buildDebugResult = ({ rawText = '', parsed = null, usage = null, outputChars = null, error = null } = {}) => ({
    rawText,
    parsed,
    usage,
    outputChars,
    requestConfig,
    error,
  })

  if (!apiKey) {
    console.error('[jobrisk][openai] missing OPENAI_API_KEY')
    return shouldReturnMetadata ? buildDebugResult({ error: { stage: 'missing_api_key', message: 'OPENAI_API_KEY is missing' } }) : null
  }

  const requestBody = {
    model,
    input: prompt,
  }
  if (responseFormat) requestBody.text = { format: responseFormat }
  if (temperature != null) requestBody.temperature = temperature
  if (maxOutputTokens != null) requestBody.max_output_tokens = maxOutputTokens
  else if (maxTokens != null) requestBody.max_tokens = maxTokens

  let response
  try {
    response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })
  } catch (error) {
    console.error('[jobrisk][openai] fetch failed', {
      model,
      message: error?.message || String(error),
    })
    return shouldReturnMetadata ? buildDebugResult({ error: { stage: 'fetch_failed', message: error?.message || String(error) } }) : null
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    console.error('[jobrisk][openai] non-200 response', {
      model,
      status: response.status,
      body: errorText.slice(0, 500),
    })
    return shouldReturnMetadata
      ? buildDebugResult({
          error: { stage: 'http_error', status: response.status, body: errorText.slice(0, 500) },
        })
      : null
  }

  let data
  try {
    data = await response.json()
  } catch (error) {
    console.error('[jobrisk][openai] invalid json response', {
      model,
      message: error?.message || String(error),
    })
    return shouldReturnMetadata ? buildDebugResult({ error: { stage: 'invalid_json_response', message: error?.message || String(error) } }) : null
  }

  const text = extractOutputText(data)
  const usage = normalizeOpenAiUsage(data)
  const outputChars = text.length
  if (!text) {
    console.error('[jobrisk][openai] empty output_text', {
      model,
      outputKeys: Object.keys(data || {}),
    })
    return shouldReturnMetadata
      ? buildDebugResult({
          usage,
          outputChars,
          error: { stage: 'empty_output_text', outputKeys: Object.keys(data || {}) },
        })
      : null
  }

  if (!parseJson) {
    return shouldReturnMetadata ? buildDebugResult({ rawText: text, parsed: null, usage, outputChars }) : text
  }

  try {
    const parsed = JSON.parse(text)
    return shouldReturnMetadata ? buildDebugResult({ rawText: text, parsed, usage, outputChars }) : parsed
  } catch (error) {
    console.error('[jobrisk][openai] failed to parse model json', {
      model,
      message: error?.message || String(error),
      text: text.slice(0, 500),
    })
    return shouldReturnMetadata
      ? buildDebugResult({
          rawText: text,
          parsed: null,
          usage,
          outputChars,
          error: { stage: 'parse_failed', message: error?.message || String(error), text: text.slice(0, 500) },
        })
      : null
  }
}

export async function callOpenAiDebug(options) {
  return callOpenAi({ ...options, debug: true })
}

function buildPromptCompanyContextSnapshot(companyContext) {
  if (!companyContext) return null
  return {
    companyName: toLengthLimitedText(companyContext.companyName, 40) || null,
    companyStage: companyContext.companyStage
      ? {
          value: companyContext.companyStage.value || null,
          confidence: companyContext.companyStage.confidence || 'low',
        }
      : null,
    industry: companyContext.industry
      ? {
          value: companyContext.industry.value || null,
          confidence: companyContext.industry.confidence || 'low',
        }
      : null,
    businessSignals: (companyContext.businessSignals || []).slice(0, 1).map((item) => ({
      signal: toLengthLimitedText(item?.signal, 32),
      description: toLengthLimitedText(item?.description, 55),
      confidence: item?.confidence || 'low',
      evidence: (item?.evidence || []).slice(0, 1).map((evidence) => toLengthLimitedText(evidence, 45)),
    })),
    jobConnectionHypotheses: (companyContext.jobConnectionHypotheses || []).slice(0, 1).map((item) => ({
      hypothesis: toLengthLimitedText(item?.hypothesis, 55),
      riskImpact: item?.riskImpact || 'uncertain',
      reason: toLengthLimitedText(item?.reason, 60),
      relatedJobPostingEvidence: toLengthLimitedText(item?.relatedJobPostingEvidence, 45),
      relatedCompanyEvidence: toLengthLimitedText(item?.relatedCompanyEvidence, 45),
      confidence: item?.confidence || 'low',
    })),
    mustAskQuestions: (companyContext.mustAskQuestions || []).slice(0, 1).map((item) => ({
      question: toLengthLimitedText(item?.question, 55),
      whyAsk: toLengthLimitedText(item?.whyAsk, 45),
      goodAnswerSignal: toLengthLimitedText(item?.goodAnswerSignal, 40),
      warningAnswerSignal: toLengthLimitedText(item?.warningAnswerSignal, 40),
    })),
  }
}

function shouldIncludeCompanyContextInPrompt(companyContext) {
  if (!companyContext || typeof companyContext !== 'object') return false

  const companyEvidenceCount = Array.isArray(companyContext?.reportEvidence?.companyEvidence)
    ? companyContext.reportEvidence.companyEvidence.length
    : 0
  const hypothesisCount = Array.isArray(companyContext?.jobConnectionHypotheses)
    ? companyContext.jobConnectionHypotheses.length
    : 0
  const questionCount = Array.isArray(companyContext?.mustAskQuestions)
    ? companyContext.mustAskQuestions.length
    : 0

  return companyEvidenceCount > 0 || hypothesisCount > 0 || questionCount > 0
}

function buildPromptAxisSnapshot(axis, { summaryLength = 80, evidenceLength = 90 } = {}) {
  return {
    key: axis?.key || '',
    label: axis?.label || '',
    level: axis?.level || '',
    levelLabel: axis?.levelLabel || '',
    summary: toLengthLimitedText(axis?.summary, summaryLength),
    evidence: axis?.evidence?.quote
      ? { quote: toLengthLimitedText(axis.evidence.quote, evidenceLength), sourceType: axis?.evidence?.sourceType || 'posting' }
      : null,
  }
}

function buildPromptAuxiliaryCheckSnapshot(check, { summaryLength = 75, questionLength = 70, evidenceLength = 80 } = {}) {
  return {
    key: check?.key || '',
    label: check?.label || '',
    level: check?.level || '',
    levelLabel: check?.levelLabel || '',
    summary: toLengthLimitedText(check?.summary, summaryLength),
    question: toLengthLimitedText(check?.question, questionLength),
    goodAnswerSignal: toLengthLimitedText(check?.goodAnswerSignal, 45),
    riskyAnswerSignal: toLengthLimitedText(check?.riskyAnswerSignal, 45),
    evidence: check?.evidence?.quote
      ? { quote: toLengthLimitedText(check.evidence.quote, evidenceLength), sourceType: check?.evidence?.sourceType || 'posting' }
      : null,
  }
}

function buildDetailEvidenceQuotes(structured, fallback) {
  const seen = new Set()
  const quotes = []
  const pushQuote = ({ quote, sourceType = 'posting', axisKey = null, sourceKey = null }) => {
    const normalizedQuote = joinEvidenceQuotes(quote)
    if (!normalizedQuote || seen.has(normalizedQuote)) return
    seen.add(normalizedQuote)
    quotes.push({
      quote: toLengthLimitedText(normalizedQuote, 120),
      sourceType,
      axisKey,
      sourceKey,
    })
  }

  for (const axis of structured?.sevenAxes || []) {
    if (axis?.evidence?.quote) {
      pushQuote({
        quote: axis.evidence.quote,
        sourceType: axis?.evidence?.sourceType || 'posting',
        axisKey: axis?.key || null,
        sourceKey: 'sevenAxes',
      })
    }
  }

  for (const check of structured?.auxiliaryChecks || []) {
    if (check?.evidence?.quote) {
      pushQuote({
        quote: check.evidence.quote,
        sourceType: check?.evidence?.sourceType || 'posting',
        axisKey: check?.key || null,
        sourceKey: 'auxiliaryChecks',
      })
    }
  }

  for (const item of fallback?.keyEvidence || []) {
    if (item?.quote) {
      pushQuote({
        quote: item.quote,
        sourceType: 'posting',
        sourceKey: 'fallbackKeyEvidence',
      })
    }
  }

  return quotes.slice(0, 12)
}

function buildDetailPromptStructuredSnapshot(structured) {
  const promptCompanyContext = shouldIncludeCompanyContextInPrompt(structured?.companyContext)
    ? buildPromptCompanyContextSnapshot(structured?.companyContext || null)
    : null

  return {
    jobTitle: structured?.jobTitle || '',
    companyName: structured?.companyName || null,
    companyHomepageUrl: structured?.companyHomepageUrl || null,
    reliabilityGate: structured?.reliabilityGate || null,
    jobFamily: structured?.jobFamily || null,
    sevenAxes: (structured?.sevenAxes || []).map((axis) => buildPromptAxisSnapshot(axis)),
    auxiliaryChecks: (structured?.auxiliaryChecks || []).map((check) => buildPromptAuxiliaryCheckSnapshot(check)),
    companyContext: promptCompanyContext,
  }
}

function buildPreviewPromptStructuredSnapshot(structured) {
  const promptCompanyContext = shouldIncludeCompanyContextInPrompt(structured?.companyContext)
    ? buildPromptCompanyContextSnapshot(structured?.companyContext || null)
    : null

  return {
    jobTitle: structured?.jobTitle || '',
    companyName: structured?.companyName || null,
    companyHomepageUrl: structured?.companyHomepageUrl || null,
    reliabilityGate: structured?.reliabilityGate || null,
    jobFamily: structured?.jobFamily || null,
    sevenAxes: (structured?.sevenAxes || []).map((axis) =>
      buildPromptAxisSnapshot(axis, { summaryLength: 72, evidenceLength: 80 }),
    ),
    auxiliaryChecks: (structured?.auxiliaryChecks || []).map((check) =>
      buildPromptAuxiliaryCheckSnapshot(check, { summaryLength: 68, questionLength: 62, evidenceLength: 72 }),
    ),
    structuredSummary: {
      sectionsFound: Object.entries(structured?.sections || {})
        .filter(([, value]) => Array.isArray(value) && value.length > 0)
        .map(([key]) => key),
    },
    companyContext: promptCompanyContext,
  }
}

function buildPreviewPromptPayload(structured, fallback) {
  return {
    structured: buildPreviewPromptStructuredSnapshot(structured),
    fallback: {
      riskLevel: fallback?.riskLevel || null,
      riskLevelLabel: fallback?.riskLevelLabel || null,
      headline: toLengthLimitedText(fallback?.headline, 100),
      topEvidence: fallback?.topEvidence
        ? {
            quote: toLengthLimitedText(fallback.topEvidence.quote, 80),
            interpretation: toLengthLimitedText(fallback.topEvidence.interpretation, 80),
          }
        : null,
      shortReasons: (fallback?.shortReasons || []).slice(0, 2).map((reason) => toLengthLimitedText(reason, 80)),
      verificationQuestion: toLengthLimitedText(fallback?.verificationQuestion, 72),
      structuredSummary: fallback?.structuredSummary
        ? {
            jobTitle: fallback.structuredSummary.jobTitle || '',
            sectionsFound: fallback.structuredSummary.sectionsFound || [],
          }
        : null,
    },
  }
}

function buildDetailPromptPayload(analysis, fallback) {
  return {
    structured: buildDetailPromptStructuredSnapshot(analysis?.structured),
    evidenceQuotes: buildDetailEvidenceQuotes(analysis?.structured, fallback),
    freePreview: analysis?.freePreview
      ? {
          riskLevel: analysis.freePreview.riskLevel || null,
          riskLevelLabel: analysis.freePreview.riskLevelLabel || null,
          headline: toLengthLimitedText(analysis.freePreview.headline, 100),
          verificationQuestion: toLengthLimitedText(analysis.freePreview.verificationQuestion, 80),
          shortReasons: (analysis.freePreview.shortReasons || []).slice(0, 2).map((reason) => toLengthLimitedText(reason, 80)),
        }
      : null,
    fallback: {
      finalSummary: toLengthLimitedText(fallback?.finalSummary, 75),
      jobFamily: fallback?.jobFamily || null,
      keyEvidence: (fallback?.keyEvidence || []).slice(0, 1).map((item) => ({
        quote: toLengthLimitedText(item?.quote, 70),
        interpretation: toLengthLimitedText(item?.interpretation, 70),
        whyImportant: toLengthLimitedText(item?.whyImportant, 45),
      })),
      interviewQuestions: (fallback?.interviewQuestions || []).slice(0, 2).map((item) => ({
        question: toLengthLimitedText(item?.question, 65),
        goodAnswerSignal: toLengthLimitedText(item?.goodAnswerSignal, 36),
        riskyAnswerSignal: toLengthLimitedText(item?.riskyAnswerSignal, 36),
        category: item?.category || '',
        whyAsk: toLengthLimitedText(item?.whyAsk, 36),
      })),
      actionGuide: toLengthLimitedText(fallback?.actionGuide, 65),
    },
  }
}

function applyConditionalLowOverridePreview(preview) {
  return {
    ...preview,
    riskLevel: 'low',
    riskLevelLabel: '좋음',
    headline:
      '물경력 위험은 낮아 보입니다. KPI, 산출물, 실험 구조가 공고에 구체적으로 드러납니다. 다만 최종 의사결정권과 성과평가 방식은 면접에서 확인하세요.',
  }
}

export async function buildPreview({ jobPostingText }, options = {}) {
  const {
    debug = false,
    llmModelOverride = null,
    llmTemperature = null,
    llmMaxTokens = null,
    llmMaxOutputTokens = null,
    previewLlmEnabled = PREVIEW_LLM_ENABLED,
    allowLlmRiskOverride = false,
    conditionalLlmRiskOverride = false,
    llmResultOverride = null,
  } = options
  const sanitizedJobPostingText = trimPostingTail(jobPostingText)
  const structured = structurePosting(sanitizedJobPostingText)
  const jobFamily = classifyJobFamily(structured)
  structured.jobFamily = jobFamily
  structured.companyContext = await buildCompanyContext({ jobPostingText: sanitizedJobPostingText, extractedPosting: structured })
  structured.reliabilityGate = buildReliabilityGate(structured)
  const criteria = criteriaForJobFamily(jobFamily.id)
  const evidencePool = collectAllowedEvidence(structured.sectionsNormalized)
  const criteriaMatch = matchCriteriaSignals(evidencePool.map((item) => item.text), criteria)
  const sevenAxes = applyContextualAxisAdjustments(
    applyReliabilityGateToAxes(buildSevenAxes(evidencePool, jobFamily), structured),
    structured,
    jobFamily,
  )
  const fiveAxes = buildFiveAxesFromSevenAxes(sevenAxes)
  const auxiliaryChecks = buildAuxiliaryChecks(structured)

  structured.criteria = summarizeCriteria(criteria)
  structured.criteriaMatch = criteriaMatch
  structured.sevenAxes = sevenAxes
  structured.fiveAxes = fiveAxes
  structured.auxiliaryChecks = auxiliaryChecks

  const fallback = buildFreePreview({ structured, jobFamily, fiveAxes, criteria, criteriaMatch })
  const previewModel = llmModelOverride || PREVIEW_MODEL
  const previewLlmRequested = llmResultOverride != null || previewLlmEnabled
  const previewPromptPayload = previewLlmRequested ? buildPreviewPromptPayload(structured, fallback) : null
  const llmResult =
    llmResultOverride != null
      ? (debug
          ? {
              rawText: '',
              parsed: llmResultOverride,
              usage: null,
              outputChars: 0,
              requestConfig: {
                model: previewModel,
                temperature: llmTemperature,
                max_tokens: llmMaxTokens,
                max_output_tokens: llmMaxOutputTokens,
                response_format: PREVIEW_RESPONSE_FORMAT,
              },
              error: null,
            }
          : llmResultOverride)
      : previewLlmEnabled
        ? await callOpenAi({
            model: previewModel,
            responseFormat: PREVIEW_RESPONSE_FORMAT,
            temperature: llmTemperature,
            maxTokens: llmMaxTokens,
            maxOutputTokens: llmMaxOutputTokens,
            debug,
            includeMetadata: true,
            prompt: [
              {
                role: 'user',
                content: `아래 JSON만 사용해서 무료 미리보기를 개선해 주세요. 회사 평판, 조직문화 추정은 금지하고 근거가 약하면 추가 확인 필요로 답하세요. 회사 정보는 최종 판정을 대체하지 말고 참고 정보로만 취급하세요. 강한 판단은 공고 직접 인용 또는 구조화된 근거에 연결하세요. 손실 공포, 미래 보장, 사회적 증거, 결제 압박 문구는 금지합니다. 유료 가치는 무엇이 더 제공되는지 설명할 수 있지만 지금 결제하라고 압박하지 마세요. JSON만 반환해 주세요.\n${JSON.stringify(previewPromptPayload)}`,
              },
            ],
          })
        : (debug
            ? {
                rawText: '',
                parsed: null,
                usage: null,
                outputChars: 0,
                requestConfig: {
                  model: previewModel,
                  temperature: llmTemperature,
                  max_tokens: llmMaxTokens,
                  max_output_tokens: llmMaxOutputTokens,
                  response_format: PREVIEW_RESPONSE_FORMAT,
                },
                error: { stage: 'disabled', message: 'Preview LLM disabled' },
              }
            : null)
  const llm = debug || llmResult?.parsed !== undefined ? llmResult?.parsed : llmResult

  const previewPolicyTrace = debug ? {} : null
  const freePreviewDraft = applyPreviewPersuasionPolicy(llm?.freePreview || fallback, fallback, previewPolicyTrace)
  const llmRiskLevel = llm?.freePreview?.riskLevel || null
  const prePolicyRiskLevel = llmRiskLevel || fallback.riskLevel
  const conditionalOverrideDecision = shouldAllowConditionalLlmRiskOverride({
    jobPostingText: sanitizedJobPostingText,
    structured,
    fallbackPreview: fallback,
    llmFreePreview: freePreviewDraft,
  })
  const conditionalOverridePreview =
    conditionalLlmRiskOverride && conditionalOverrideDecision.allowed
      ? applyConditionalLowOverridePreview(freePreviewDraft)
      : freePreviewDraft
  const shouldUseLlmRiskOverride =
    allowLlmRiskOverride || (conditionalLlmRiskOverride && conditionalOverrideDecision.allowed)
  const freePreview = {
    ...conditionalOverridePreview,
    riskLevel: shouldUseLlmRiskOverride ? conditionalOverridePreview.riskLevel || fallback.riskLevel : fallback.riskLevel,
    riskLevelLabel: shouldUseLlmRiskOverride ? conditionalOverridePreview.riskLevelLabel || fallback.riskLevelLabel : fallback.riskLevelLabel,
  }
  const riskLevelChanged = fallback.riskLevel !== freePreview.riskLevel
  let changedAt = 'unchanged'
  if (llmRiskLevel && llmRiskLevel !== fallback.riskLevel) changedAt = 'llm_output'
  if (freePreviewDraft.riskLevel !== prePolicyRiskLevel) changedAt = changedAt === 'unchanged' ? 'post_policy' : `${changedAt}+post_policy`
  const finalLockedToFallback = freePreview.riskLevel === fallback.riskLevel

  const result = {
    structured,
    freePreview,
    fallbackFreePreview: fallback,
    llmFreePreview: llm?.freePreview || null,
    debugRiskTrace: {
      fallbackRiskLevel: fallback.riskLevel,
      llmInputRiskLevel: fallback.riskLevel,
      llmReturnedRiskLevel: llmRiskLevel,
      finalRiskLevel: freePreview.riskLevel,
      riskLevelChanged,
      changedAt,
      finalLockedToFallback,
    },
    engine: llm ? `openai:${previewModel}` : 'deterministic_fallback',
    openAiUsage: llmResult?.usage || null,
    openAiOutputChars: llmResult?.outputChars ?? null,
    openAiErrorStage: llmResult?.error?.stage ?? null,
  }
  if (debug) {
    const wasLlmOverrideSuppressed =
      Boolean(llmRiskLevel) &&
      llmRiskLevel !== fallback.riskLevel &&
      allowLlmRiskOverride === false &&
      freePreview.riskLevel === fallback.riskLevel
    result.debug = {
      previewLlm: llmResult,
      previewRiskExperiment: {
        fallbackRiskLevel: fallback.riskLevel,
        llmReturnedRiskLevel: llmRiskLevel,
        llmAppliedRiskLevel: freePreviewDraft.riskLevel || fallback.riskLevel,
        fallbackLocked: finalLockedToFallback,
        finalRiskLevel: freePreview.riskLevel,
        allowLlmRiskOverride,
        conditionalLlmRiskOverride,
        wasLlmOverrideSuppressed,
        conditionalOverrideAllowed: conditionalOverrideDecision.allowed,
        conditionalOverrideReason: conditionalOverrideDecision.reason,
        conditionalOverrideBlockedReasons: conditionalOverrideDecision.blockedReasons,
        positiveSignalCount: conditionalOverrideDecision.positiveSignalCount,
        positiveSignalCategories: conditionalOverrideDecision.positiveSignalCategories,
        negativeSignalCount: conditionalOverrideDecision.negativeSignalCount,
        quoteEvidenceVerified: conditionalOverrideDecision.quoteEvidenceVerified,
      },
      previewStages: {
        fallbackFreePreview: fallback,
        llmFreePreviewRaw: llm?.freePreview || null,
        postPolicyFreePreview: freePreviewDraft,
        finalFreePreview: freePreview,
      },
      previewInterpretationTrace: {
        rawLlmInterpretation: llm?.freePreview?.topEvidence?.interpretation || '',
        fallbackInterpretation: fallback?.topEvidence?.interpretation || '',
        postPolicyInterpretation: freePreviewDraft?.topEvidence?.interpretation || '',
        finalInterpretation: freePreview?.topEvidence?.interpretation || '',
        policy: previewPolicyTrace?.policy || null,
        dedupe: previewPolicyTrace?.dedupe || null,
      },
    }
  }
  return result
}

export async function buildDetailReport({ analysis }, options = {}) {
  const {
    debug = false,
    llmModelOverride = null,
    llmTemperature = null,
    llmMaxTokens = null,
    llmMaxOutputTokens = null,
  } = options
  const fallback = fallbackDetail({ analysis })
  const detailModel = llmModelOverride || DETAIL_MODEL
  const detailPromptPayload = buildDetailPromptPayload(analysis, fallback)
  const llmResult = await callOpenAi({
    model: detailModel,
    responseFormat: DETAIL_RESPONSE_FORMAT,
    temperature: llmTemperature,
    maxTokens: llmMaxTokens,
    maxOutputTokens: llmMaxOutputTokens ?? DETAIL_MAX_OUTPUT_TOKENS,
    debug,
    includeMetadata: true,
    prompt: [
      {
        role: 'user',
        content: [
          '아래 분석 데이터만 사용해서 상세 리포트 JSON을 작성해 주세요.',
          '필수 필드: finalSummary, keyEvidence, interviewQuestions, actionGuide.',
          'jobFamily, sevenAxes, auxiliaryChecks, fiveAxes, companyContext는 서버가 별도로 조립하므로 반환하지 마세요.',
          '모든 keyEvidence.quote는 원문에 실제 존재하는 문장이어야 합니다.',
          'keyEvidence는 evidenceQuotes 안의 quote만 사용하세요.',
          '회사 평판, 소문, 조직문화 추정은 금지합니다.',
          '회사 맥락은 질문과 근거 해석이 필요할 때만 짧게 반영하세요.',
          '강한 판단은 공고 직접 인용 또는 구조화된 근거에 연결해 주세요.',
          '손실 공포, 미래 보장, 압박형 결제 문구, 사회적 증거 표현은 금지합니다.',
          '유료 가치는 무엇이 더 제공되는지 설명할 수 있지만, 지금 결제하라고 압박하지 마세요.',
          '간결하게 작성하세요. 최종 요약은 1문장, actionGuide는 2문장 이내로 제한하세요.',
          'keyEvidence는 가장 중요한 3개만, interviewQuestions는 우선순위가 높은 5~7개로 작성하세요.',
          'goodAnswerSignal, riskyAnswerSignal, whyAsk, answerDecisionHint는 1문장 이하의 짧은 기준으로 작성하세요.',
          JSON.stringify(detailPromptPayload),
        ].join('\n'),
      },
    ],
  })
  const llm = debug || llmResult?.parsed !== undefined ? llmResult?.parsed : llmResult

  const mergedDetail = hydrateDetailServerFields(llm || fallback, fallback, analysis.structured)
  const policyCheckedDetail = applyDetailPersuasionPolicy(mergedDetail, fallback)
  policyCheckedDetail.companyContext = hydrateDetailCompanyContext(policyCheckedDetail, fallback, analysis.structured)
  const qualityCheckedDetail = enforceQuality(policyCheckedDetail, analysis.structured.lines || [], analysis.structured)

  const finalizedDetail = finalizeDetailForDisplay(qualityCheckedDetail, analysis.structured, analysis.freePreview || null)
  const result = {
    detail: finalizedDetail,
    decisionReport: buildDecisionReport({
      freePreview: analysis.freePreview || null,
      detail: finalizedDetail,
    }),
    detailVersion: DETAIL_SCHEMA_VERSION,
    engine: llm ? `openai:${detailModel}` : 'deterministic_fallback',
    openAiUsage: llmResult?.usage || null,
    openAiOutputChars: llmResult?.outputChars ?? null,
    openAiErrorStage: llmResult?.error?.stage ?? null,
  }
  if (debug) {
    result.debug = {
      detailLlm: llmResult,
    }
  }
  return result
}


