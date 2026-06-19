import assert from 'node:assert/strict'
import { test } from 'node:test'

import { buildDetailReport, buildPreview, verifyQuoteAgainstPosting } from '../src/lib/analysis.js'
import { getCompanyContextSection } from '../../shared/companyContextView.js'

process.env.OPENAI_API_KEY = ''
process.env.ANALYSIS_EVIDENCE_V2 = ''

const PARALLEL_SPACE_POSTING = `
평행공간∙서울 서초구∙경력 3-15년

풀스택 개발자 (3년이상)

포지션 상세
평행공간은 단순한 3D 데이터 생성 기술을 넘어, 현실을 그대로 반영하는 디지털 세계를 구현하여 산업 현장의 의사결정, 운영 최적화, 미래 예측을 가능하게 합니다. 건설, 조선, 제조 등 중후장대 산업의 디지털 혁신을 이끄는 소수 정예의 '테크 부티크' 조직입니다. 스마트시티, 미래 모빌리티, 디지털 트윈 등 핵심 산업 영역에서 현실 정보를 그대로 반영하는 고정밀 3D Reconstruction 자동화 솔루션 'P-Engine'을 개발하여, 현실 세계를 가상 공간으로 신속하고 정확하게 전환하는 것을 목표로 하고 있습니다.
우리는 노동 집약적인 수기 방식의 업무를 자동화된 3D 솔루션으로 전환하여 산업의 패러다임을 바꾸고 있습니다.

이번에 영입하는 풀스택 개발자는 3D Reconstruction, 디지털 트윈, Scan-to-BIM 기술을 기반으로 한 당사의 혁신적인 웹/앱 플랫폼의 프론트엔드와 백엔드 전체 아키텍처를 주도적으로 설계하고 구현하게 됩니다.
주요업무
• AI 기반 웹앱 풀스택 설계 및 개발
• 3D 및 공간 데이터 기반 플랫폼 개발: 디지털 트윈 및 스마트 공장 관리, 건설 결함 검사 등을 위한 B2B 웹/앱 서비스의 프론트엔드 및 백엔드 풀사이클 개발
• 데이터 파이프라인 및 AI 모델 연동: 멀티모달 AI 분석 결과 및 로보틱스, 자율 제조 등과 연계되는 데이터를 서비스 사용자에게 효율적으로 전달하기 위한 API 설계 및 연동
• 복잡한 비즈니스 로직 및 대시보드 구현: 다중 사용자 환경에서의 권한 관리(RBAC), 실시간 상태 동기화 및 직관적인 데이터 시각화 대시보드 구축
• AI 모델 연동 파이프라인 구축: 사진 기반의 LLM/VLM 하자 유형 자동 분류 및 길이 측정 AI 분석 결과를 서비스에 매끄럽게 연동
• 아키텍처 고도화: 점진적인 사용자 증가와 대용량 3D 공간 데이터 처리에 대응할 수 있는 확장성 높고 안정적인 서버/데이터베이스 시스템 설계
자격요건
• 소프트웨어 개발 경력 3년 이상
• 프론트엔드(React, Vue.js, TypeScript 등) 및 백엔드(Node.js, Python/FastAPI, Java/Spring 등) 프레임워크를 활용한 실무 개발 경험을 보유하신 분
• RESTful API 설계 및 고가용성 서버 아키텍처 구축에 대한 이해도가 있으신 분
• RDBMS(PostgreSQL, MySQL 등) 및 NoSQL 데이터베이스 모델링 및 쿼리 성능 최적화 역량을 갖추신 분
• AWS, GCP 등 클라우드 인프라 환경에서의 배포, 운영 및 CI/CD 파이프라인 경험이 있으신 분
우대사항
• 3D 도메인 지식 및 시각화 경험: WebGL, Three.js 등을 활용한 3D 그래픽 렌더링 경험이나 포인트 클라우드, BIM 데이터(Scan-to-BIM) 처리 생태계에 대한 이해도가 높으신 분
• SaaS 전환 프로젝트 경험: 기존의 SI기반 비즈니스를 확장 가능하고 규격화된 SaaS 제품으로 아키텍처를 전환해 본 경험이 있으신 분
`

const MUNO_PM_POSTING = `
포지션 정보
직무: 프로덕트 매니저 > B2B SaaS 프로덕트 기획 고용형태: 정규직 직급: 매니저 직책: 프로덕트 오너 근무부서: Product Growth Team 근무지: 서울 성동구 성수이로 87, muno 오피스 근무형태: 주 3일 오피스 출근, 주 2일 재택근무 연봉: 5,500만원 ~ 7,000만원, 경력 및 역량에 따라 협의
입사 후 수행 업무:
1. 담당업무명 : B2B SaaS 고객 온보딩 및 리텐션 개선을 위한 프로덕트 기획 담당
2. 담당 제품 : 기업 고객용 업무 자동화 SaaS의 온보딩, 대시보드, 알림, 리포트 기능
3. 핵심 목표 : 신규 가입 기업의 30일 내 활성화율과 90일 리텐션 개선
4. 주요 업무 :
   * 고객 온보딩 퍼널 분석 및 개선 과제 정의
   * 사용자 인터뷰와 데이터 분석을 통한 문제 발견
   * 기능 요구사항 문서(PRD) 작성
   * 디자이너, 개발자, 데이터 분석가와의 스프린트 단위 협업
   * A/B 테스트 기획 및 결과 분석
   * 기능 출시 후 활성화율, 전환율, 리텐션 지표 추적
5. 의사결정 권한 :
   * 담당 영역의 문제 정의, 우선순위 제안, 실험 설계 권한을 가집니다.
   * 최종 로드맵은 Head of Product와 함께 결정하지만, 담당 기능의 기획 방향과 실험안은 직접 제안하고 주도합니다.
6. 입사 후 3개월 목표 :
   * 기존 온보딩 퍼널 데이터 분석 완료
   * 고객 인터뷰 10건 이상 진행
   * 개선 과제 3개 이상 도출
   * 첫 번째 A/B 테스트 설계 및 실행
7. 입사 후 6개월 목표 :
   * 온보딩 완료율 15% 이상 개선
   * 신규 고객의 핵심 기능 최초 사용률 20% 이상 개선
   * 개선 결과를 제품 문서와 대시보드로 정리
8. 주요 산출물 :
   * PRD
   * 사용자 인터뷰 리포트
   * 퍼널 분석 리포트
   * 실험 설계 문서
   * 기능 출시 회고 문서
   * 제품 성과 대시보드
9. 사용하는 도구 :
   * Notion, Figma, Jira, Slack, Amplitude, GA4, SQL, Metabase
10. 협업 구조 :
* 프로덕트 매니저 1명, 디자이너 1명, 프론트엔드 개발자 2명, 백엔드 개발자 2명, 데이터 분석가 1명으로 구성된 스쿼드에서 일합니다.
1. 피드백 및 성장 구조 :
* 매주 제품 리뷰 미팅에서 실험 결과와 지표를 공유합니다.
* 월 1회 Head of Product와 1:1 피드백을 진행합니다.
* 분기마다 담당 제품 영역의 성과와 다음 분기 개선 방향을 직접 발표합니다.
1. 지원 자격 :
* B2B SaaS 또는 웹/앱 서비스 기획 경험 2년 이상
* 데이터 기반으로 문제를 정의하고 개선안을 실행한 경험
* 개발, 디자인, 데이터 직군과 협업해 기능을 출시한 경험
1. 우대사항 :
* SQL을 활용한 기본적인 데이터 추출 경험
* A/B 테스트 설계 및 분석 경험
* 온보딩, 리텐션, 활성화 지표 개선 경험
1. 기타 안내 :
* 모든 채용 절차는 muno 인사팀 공식 이메일을 통해 안내됩니다.
* 입사 전 근로계약서, 연봉, 직무 범위, 평가 기준을 서면으로 제공합니다.
`

const COUPANG_EATS_VISUAL_DESIGN_POSTING = `
채용공고
쿠팡∙서울 강남구∙신입 이상∙계약직

[쿠팡이츠]비주얼 디자이너 (계약직)

포지션 상세
쿠팡은 스타트업 문화를 기반으로 한 글로벌 대형 상장사라고 자부합니다. 신규 서비스를 끊임없이 출시하며 비즈니스를 확장해 나가고 있습니다.
쿠팡이츠 브랜드 전체를 지원할 비주얼 디자이너를 찾고 있습니다.

주요업무
아이콘, 프레젠테이션 자료, 프로모션 및 마케팅 배너, 비주얼 시스템 구성 요소, 일러스트레이션, 인포그래픽 등 창의적인 디자인 업무를 주도적으로 진행하고 짧은 기간 안에 결과물을 완성합니다.
벤치마크 및 리서치를 기반으로 유저 친화적인 솔루션을 제안합니다.
프로덕트 디자이너, 리서처, 콘텐츠 전략가, 프로덕트 오너와 협업하며 높은 수준의 디자인 결과물을 제작합니다.

자격요건
디자인 툴(Figma, Adobe Creative Suite [After Effects, Illustrator, Photoshop], 3D 툴[Cinema 4D])에 대한 높은 숙련도가 있으신 분
프레젠테이션을 통해 아이디어를 공유하고 비즈니스 파트너 및 이해관계자로부터 피드백 받는 능력을 보유하신 분

고용조건
계약직 1년
비즈니스 상황에 따라 연장 가능성이 있습니다.

개인정보 처리방침
https://www.coupang.jobs/kr/privacy-policy
`

function buildMockPreviewLlm({
  quote,
  interpretation = 'LLM이 낮은 위험으로 판단했습니다.',
  riskLevel = 'low',
  riskLevelLabel = riskLevel === 'high' ? '위험' : riskLevel === 'low' ? '좋음' : '추가 확인 필요',
  headline = riskLevel === 'low' ? '물경력 위험은 낮아 보입니다.' : '추가 확인이 필요합니다.',
}) {
  return {
    freePreview: {
      riskLevel,
      riskLevelLabel,
      headline,
      topEvidence: {
        quote,
        interpretation,
      },
      shortReasons: ['원문에 KPI와 권한, 산출물 구조가 함께 보입니다.'],
      verificationQuestion: '이 역할에서 직접 책임지는 KPI와 의사결정 범위는 어디까지인가요?',
      structuredSummary: {
        jobTitle: '테스트',
        sectionsFound: ['주요업무'],
      },
    },
  }
}

test('preview returns required fields and evidence policy', async () => {
  const text = `
Service operations manager hiring
Responsibilities
- Repeat content upload checks and daily monitoring operations
- Handle requests and support tasks
Requirements
- Basic spreadsheet skill
Preferred
- Process improvement experience
`

  const result = await buildPreview({ jobPostingText: text })
  assert.equal(typeof result.freePreview.headline, 'string')
  assert.equal(typeof result.freePreview.verificationQuestion, 'string')
  assert.ok(Array.isArray(result.freePreview.shortReasons))
  assert.ok(result.structured.fiveAxes.length === 5)
  assert.ok(result.structured.sevenAxes.length === 7)
  assert.ok(Array.isArray(result.structured.auxiliaryChecks))
  assert.equal(result.freePreview.auxiliaryChecks, undefined)
  assert.equal(result.structured.criteria.version, 'jobrisk-criteria-v1')
})

test('short or unclear job family stays conservative', async () => {
  const text = `
We are hiring someone who can grow together with the team.
Various tasks will be assigned.
Details are shared in interview.
`

  const result = await buildPreview({ jobPostingText: text })
  assert.ok(['needs_review', 'medium'].includes(result.freePreview.riskLevel))
})

test('detail report keeps seven axes and paid-only auxiliary checks', async () => {
  const text = `
CRM 운영 마케터
주요업무
- CRM 캠페인 운영 및 데이터 분석
- 전환율 개선 실험 설계
- 결과 리포트 기반 개선안 제안
자격요건
- 마케팅 운영 경험
`

  const preview = await buildPreview({ jobPostingText: text })
  const detail = await buildDetailReport({
    analysis: {
      structured: preview.structured,
      freePreview: preview.freePreview,
    },
  })

  assert.equal(preview.structured.sevenAxes.length, 7)
  assert.equal(preview.structured.fiveAxes.length, 5)
  assert.equal(detail.detail.sevenAxes.length, 7)
  assert.equal(detail.detail.fiveAxes.length, 5)
  assert.equal(Array.isArray(detail.detail.auxiliaryChecks), true)
  assert.equal(detail.detail.auxiliaryChecks.every((item) => item?.evidence?.quote), true)
  assert.equal(preview.freePreview.auxiliaryChecks, undefined)
})

test('debug option adds metadata without changing default result shape', async () => {
  const text = `
서비스 운영 매니저
주요업무
- 반복 운영 관리
- 요청 처리
자격요건
- 운영 경험
`

  const normal = await buildPreview({ jobPostingText: text })
  const debug = await buildPreview({ jobPostingText: text }, { debug: true, allowLlmRiskOverride: true })

  assert.equal(normal.debug, undefined)
  assert.equal(typeof normal.freePreview.headline, 'string')
  assert.equal(typeof debug.freePreview.headline, 'string')
  assert.equal(typeof debug.debug.previewRiskExperiment.fallbackRiskLevel, 'string')
  assert.equal('requestConfig' in debug.debug.previewLlm, true)
  assert.equal(debug.debug.previewLlm.requestConfig.model.length > 0, true)
})

test('conditional override allows needs_review to low for strong positive muno PM posting', async () => {
  const baseline = await buildPreview({ jobPostingText: MUNO_PM_POSTING })
  const result = await buildPreview(
    { jobPostingText: MUNO_PM_POSTING },
    {
      debug: true,
      conditionalLlmRiskOverride: true,
      llmResultOverride: buildMockPreviewLlm({
        quote: `* 고객 온보딩 퍼널 분석 및 개선 과제 정의
* A/B 테스트 기획 및 결과 분석
* 기능 출시 후 활성화율, 전환율, 리텐션 지표 추적`,
        interpretation: 'KPI, 권한, 산출물, 피드백 구조가 함께 보여 물경력 위험이 낮아 보입니다.',
        riskLevel: 'needs_review',
        riskLevelLabel: '추가 확인 필요',
        headline: '추가 확인이 필요합니다.',
      }),
    },
  )

  assert.equal(baseline.freePreview.riskLevel, 'needs_review')
  assert.equal(result.debug.previewRiskExperiment.fallbackRiskLevel, 'needs_review')
  assert.equal(result.debug.previewRiskExperiment.llmReturnedRiskLevel, 'needs_review')
  assert.equal(result.debug.previewRiskExperiment.quoteEvidenceVerified, true)
  assert.equal(result.debug.previewRiskExperiment.positiveSignalCount >= 7, true)
  assert.deepEqual(result.debug.previewRiskExperiment.positiveSignalCategories.sort(), ['artifacts_learning', 'measurable', 'ownership'])
  assert.equal(result.debug.previewRiskExperiment.negativeSignalCount <= 1, true)
  assert.equal(result.debug.previewRiskExperiment.conditionalOverrideAllowed, true)
  assert.equal(result.freePreview.riskLevel, 'low')
  assert.equal(result.freePreview.riskLevelLabel, '좋음')
  assert.equal(result.freePreview.headline.includes('물경력 위험은 낮아 보입니다.'), true)
})

test('conditional override blocks repetitive operations posting even when llm returns low', async () => {
  const text = `
서비스 운영 담당자
주요업무
- 반복 운영 모니터링
- 고객 요청 처리
- 등록 및 검수
- 정산 보조
자격요건
- 운영 경험
`

  const result = await buildPreview(
    { jobPostingText: text },
    {
      debug: true,
      conditionalLlmRiskOverride: true,
      llmResultOverride: buildMockPreviewLlm({
        quote: '반복 운영 모니터링',
        interpretation: 'LLM은 낮은 위험으로 판단했지만 원문 근거는 약합니다.',
      }),
    },
  )

  assert.equal(result.debug.previewRiskExperiment.llmReturnedRiskLevel, 'low')
  assert.equal(result.debug.previewRiskExperiment.conditionalOverrideAllowed, false)
  assert.notEqual(result.freePreview.riskLevel, 'low')
  assert.equal(result.debug.previewRiskExperiment.conditionalOverrideBlockedReasons.includes('fallback_not_needs_review') || result.debug.previewRiskExperiment.conditionalOverrideBlockedReasons.includes('negative_signals_too_many'), true)
})

test('conditional override blocks when llm returns high even on strong positive posting', async () => {
  const result = await buildPreview(
    { jobPostingText: MUNO_PM_POSTING },
    {
      debug: true,
      conditionalLlmRiskOverride: true,
      llmResultOverride: buildMockPreviewLlm({
        quote: '온보딩 완료율 15% 이상 개선',
        interpretation: '강한 우려가 남습니다.',
        riskLevel: 'high',
        riskLevelLabel: '위험',
        headline: '위험 신호가 큽니다.',
      }),
    },
  )

  assert.equal(result.debug.previewRiskExperiment.llmReturnedRiskLevel, 'high')
  assert.equal(result.debug.previewRiskExperiment.conditionalOverrideAllowed, false)
  assert.equal(result.debug.previewRiskExperiment.conditionalOverrideBlockedReasons.includes('llm_high_veto'), true)
  assert.equal(result.freePreview.riskLevel, 'needs_review')
})

test('conditional override blocks posting with reliability critical signals', async () => {
  const text = `
㈜??
운영 담당자
상세한 업무 내용은 인터뷰 시 안내
고용형태: 파견직
계약형태: 프리랜스
수락시 귀하의 경력서를 hello@daum.net으로 회신부탁드립니다.
`

  const result = await buildPreview(
    { jobPostingText: text },
    {
      debug: true,
      conditionalLlmRiskOverride: true,
      llmResultOverride: buildMockPreviewLlm({
        quote: '상세한 업무 내용은 인터뷰 시 안내',
      }),
    },
  )

  assert.equal(result.debug.previewRiskExperiment.conditionalOverrideAllowed, false)
  assert.equal(result.debug.previewRiskExperiment.conditionalOverrideBlockedReasons.includes('reliability_critical_signals'), true)
})

test('conditional override blocks glossy posting without measurable ownership evidence', async () => {
  const text = `
브랜드 성장 매니저
주요업무
- 다양한 부서와 협업하며 브랜드 성장을 지원합니다.
- 시장 트렌드를 바탕으로 전반적인 운영 업무를 수행합니다.
- 필요 시 유관 업무 수행 및 커뮤니케이션을 담당합니다.
자격요건
- 커뮤니케이션 역량
`

  const result = await buildPreview(
    { jobPostingText: text },
    {
      debug: true,
      conditionalLlmRiskOverride: true,
      llmResultOverride: buildMockPreviewLlm({
        quote: '다양한 부서와 협업하며 브랜드 성장을 지원합니다.',
      }),
    },
  )

  assert.equal(result.debug.previewRiskExperiment.conditionalOverrideAllowed, false)
  assert.equal(result.debug.previewRiskExperiment.conditionalOverrideBlockedReasons.includes('positive_signals_below_threshold'), true)
})

test('conditional override blocks when required positive category is missing even with high positive count', async () => {
  const text = `
프로덕트 운영 매니저
주요업무
- 3개월 목표: 운영 안정화 및 전환율 개선
- KPI와 대시보드 기준으로 지표를 관리합니다.
- PRD와 운영 리포트를 문서화합니다.
- 대시보드, 리포트, 문서화 산출물을 관리합니다.
자격요건
- 데이터 분석 경험
`

  const result = await buildPreview(
    { jobPostingText: text },
    {
      debug: true,
      conditionalLlmRiskOverride: true,
      llmResultOverride: buildMockPreviewLlm({
        quote: `* 3개월 목표: 운영 안정화 및 전환율 개선
* KPI와 대시보드 기준으로 지표를 관리합니다.
* PRD와 운영 리포트를 문서화합니다.`,
        riskLevel: 'needs_review',
        riskLevelLabel: '추가 확인 필요',
      }),
    },
  )

  assert.equal(result.debug.previewRiskExperiment.positiveSignalCategories.includes('ownership'), false)
  assert.equal(result.debug.previewRiskExperiment.conditionalOverrideAllowed, false)
  assert.equal(result.debug.previewRiskExperiment.conditionalOverrideBlockedReasons.includes('missing_positive_ownership'), true)
})

test('conditional override blocks when negative signal count is 2 or more', async () => {
  const text = `
프로덕트 운영 담당
주요업무
- 3개월 목표: 전환율 개선
- KPI, 리텐션, 활성화율을 관리합니다.
- PRD와 실험 설계 문서를 작성합니다.
- 담당 영역의 문제 정의와 우선순위 제안을 수행합니다.
- 기타 업무와 다양한 업무 지원을 함께 수행합니다.
- 필요 시 유관 업무 수행 및 요청 대응을 담당합니다.
`

  const result = await buildPreview(
    { jobPostingText: text },
    {
      debug: true,
      conditionalLlmRiskOverride: true,
      llmResultOverride: buildMockPreviewLlm({
        quote: `* KPI, 리텐션, 활성화율을 관리합니다.
* PRD와 실험 설계 문서를 작성합니다.
* 담당 영역의 문제 정의와 우선순위 제안을 수행합니다.`,
        riskLevel: 'needs_review',
        riskLevelLabel: '추가 확인 필요',
      }),
    },
  )

  assert.equal(result.debug.previewRiskExperiment.negativeSignalCount >= 2, true)
  assert.equal(result.debug.previewRiskExperiment.conditionalOverrideAllowed, false)
  assert.equal(result.debug.previewRiskExperiment.conditionalOverrideBlockedReasons.includes('negative_signals_too_many'), true)
})

test('conditional override blocks mixed posting when positive categories are incomplete', async () => {
  const text = `
CRM 마케팅 운영
주요업무
- KPI와 전환율, 리텐션을 보며 캠페인을 운영합니다.
- 반복 운영 모니터링과 고객 요청 조율을 함께 담당합니다.
- 실험 아이디어를 제안하지만 최종 우선순위는 팀 리드가 결정합니다.
자격요건
- CRM 운영 경험
`

  const result = await buildPreview(
    { jobPostingText: text },
    {
      debug: true,
      conditionalLlmRiskOverride: true,
      llmResultOverride: buildMockPreviewLlm({
        quote: `* KPI와 전환율, 리텐션을 보며 캠페인을 운영합니다.
* 실험 아이디어를 제안하지만 최종 우선순위는 팀 리드가 결정합니다.`,
        riskLevel: 'needs_review',
        riskLevelLabel: '추가 확인 필요',
      }),
    },
  )

  assert.equal(result.debug.previewRiskExperiment.conditionalOverrideAllowed, false)
  assert.notEqual(result.freePreview.riskLevel, 'low')
  assert.equal(
    result.debug.previewRiskExperiment.conditionalOverrideBlockedReasons.includes('missing_positive_artifacts_learning') ||
      result.debug.previewRiskExperiment.conditionalOverrideBlockedReasons.includes('positive_signals_below_threshold') ||
      result.debug.previewRiskExperiment.conditionalOverrideBlockedReasons.includes('negative_signals_too_many'),
    true,
  )
})

test('conditional override blocks when llm quote cannot be verified against posting text', async () => {
  const result = await buildPreview(
    { jobPostingText: MUNO_PM_POSTING },
    {
      debug: true,
      conditionalLlmRiskOverride: true,
      llmResultOverride: buildMockPreviewLlm({
        quote: '존재하지 않는 외부 평판 근거와 숨겨진 보너스 제도',
      }),
    },
  )

  assert.equal(result.debug.previewRiskExperiment.conditionalOverrideAllowed, false)
  assert.equal(result.debug.previewRiskExperiment.quoteEvidenceVerified, false)
  assert.equal(result.debug.previewRiskExperiment.conditionalOverrideBlockedReasons.includes('quote_evidence_not_verified'), true)
  assert.equal(result.freePreview.riskLevel, 'needs_review')
})

test('quote verification keeps A/B token intact instead of splitting on slash', () => {
  const quote = `
* 고객 온보딩 퍼널 분석 및 개선 과제 정의
* A/B 테스트 기획 및 결과 분석
* 기능 출시 후 활성화율, 전환율, 리텐션 지표 추적
`

  const result = verifyQuoteAgainstPosting(quote, MUNO_PM_POSTING)

  assert.equal(result.verified, true)
  assert.equal(result.matchedSegments.includes('A/B 테스트 기획 및 결과 분석'), true)
  assert.equal(result.matchedSegments.includes('고객 온보딩 퍼널 분석 및 개선 과제 정의'), true)
  assert.equal(result.matchedSegments.includes('기능 출시 후 활성화율, 전환율, 리텐션 지표 추적'), true)
})

test('quote verification returns true when two or more bullet segments match posting', () => {
  const quote = `
* 고객 온보딩 퍼널 분석 및 개선 과제 정의
* 존재하지 않는 표현입니다
* 기능 출시 후 활성화율, 전환율, 리텐션 지표 추적
`

  const result = verifyQuoteAgainstPosting(quote, MUNO_PM_POSTING)

  assert.equal(result.verified, true)
  assert.equal(result.matchedSegments.length >= 2, true)
})

test('quote verification preserves slash tokens like UI/UX, B2B/B2C, and GA4/Amplitude', () => {
  const posting = `
주요 업무
* UI/UX 개선안 도출 및 프로토타입 검증
* B2B/B2C 전환 퍼널 비교 분석
* GA4/Amplitude 대시보드 운영 및 실험 결과 공유
`
  const quote = `
* UI/UX 개선안 도출 및 프로토타입 검증
* B2B/B2C 전환 퍼널 비교 분석
* GA4/Amplitude 대시보드 운영 및 실험 결과 공유
`

  const result = verifyQuoteAgainstPosting(quote, posting)

  assert.equal(result.verified, true)
  const matchedBlob = result.matchedSegments.join('\n')
  assert.equal(matchedBlob.includes('UI/UX 개선안 도출 및 프로토타입 검증'), true)
  assert.equal(matchedBlob.includes('B2B/B2C 전환 퍼널 비교 분석'), true)
  assert.equal(matchedBlob.includes('GA4/Amplitude 대시보드 운영 및 실험 결과 공유'), true)
})

test('quote verification stays false when posting does not contain the quote', () => {
  const quote = `
* 전사 인사평가 제도 전면 개편
* 해외 법인 세무 신고 총괄
`

  const result = verifyQuoteAgainstPosting(quote, MUNO_PM_POSTING)

  assert.equal(result.verified, false)
  assert.deepEqual(result.matchedSegments, [])
})

test('target samples cover repetitive ops, ops-with-improvement, and broad ambiguous roles', async () => {
  const samples = [
    {
      name: 'repetitive operations high risk',
      text: `
고객센터 운영 담당자
주요업무
- 고객 문의 접수 및 반복 응대
- 어드민 처리와 정산 요청 처리
- 매일 운영 현황 모니터링
자격요건
- CS 운영 경험
`,
      check(result) {
        const repetition = result.structured.fiveAxes.find((axis) => axis.key === 'repetition')
        assert.ok(['risk', 'mixed_signal', 'positive_with_check'].includes(repetition.level))
      },
    },
    {
      name: 'operations with analysis avoids false positive',
      text: `
CRM 운영 마케터
주요업무
- CRM 캠페인 운영 및 데이터 분석
- 전환율 개선 실험 설계
- 결과 리포트 기반 개선안 제안
자격요건
- 마케팅 운영 경험
`,
      check(result) {
        const repetition = result.structured.fiveAxes.find((axis) => axis.key === 'repetition')
        assert.notEqual(repetition.level, 'risk')
      },
    },
    {
      name: 'broad ambiguous distributed role',
      text: `
콘텐츠/PR 운영 담당자
주요업무
- 콘텐츠 기획, 제휴 커뮤니케이션, PR 지원, 커뮤니티 운영 등 전반 업무
- 필요에 따라 다양한 프로젝트 지원
자격요건
- 콘텐츠와 커뮤니케이션 업무 경험
`,
      check(result) {
        const scopeClarity = result.structured.sevenAxes.find((axis) => axis.key === 'scopeClarity')
        assert.ok(['risk', 'mixed_signal', 'positive_with_check'].includes(scopeClarity.level))
      },
    },
  ]

  for (const sample of samples) {
    const result = await buildPreview({ jobPostingText: sample.text })
    assert.equal(result.structured.sevenAxes.length, 7, sample.name)
    assert.equal(result.structured.fiveAxes.length, 5, sample.name)
    assert.ok(result.freePreview.shortReasons.length <= 3, sample.name)
    assert.equal(result.freePreview.auxiliaryChecks, undefined, sample.name)
    sample.check(result)
  }
})

test('preview short reasons are unique and avoid generic duplicate copy', async () => {
  const text = `
브랜드 마케터 채용
주요업무
- 전사 이슈에 따른 시즌 캠페인 기획 및 운영, 회고
- 커뮤니케이션 전략에 따른 브랜드 캠페인 실행 및 결과 보고
자격요건
- 데이터 기반으로 결과 보고서 작성 및 개선 제안
`

  const result = await buildPreview({ jobPostingText: text })
  const reasons = result.freePreview.shortReasons

  assert.equal(reasons.length > 0, true)
  assert.equal(reasons.length <= 1, true)
  assert.equal(new Set(reasons).size, reasons.length)
  assert.equal(reasons.includes('현재 공고만으로는 추가 확인이 필요합니다.'), false)
  assert.equal(reasons.includes('현재 공고만으로는 판단 근거가 부족합니다.'), false)
})

test('preview short reasons use concrete check-point copy for low information postings', async () => {
  const text = `
채용
주요업무
- 다양한 지원 업무
- 팀 협업
자격요건
- 커뮤니케이션 역량
`

  const result = await buildPreview({ jobPostingText: text })
  const reasons = result.freePreview.shortReasons

  assert.equal(reasons.length >= 1, true)
  assert.equal(reasons.some((item) => item.includes('확인해야 합니다.')), true)
  assert.equal(reasons.some((item) => item === '현재 공고만으로는 추가 확인이 필요합니다.'), false)
  assert.equal(reasons.some((item) => item === '현재 공고만으로는 판단 근거가 부족합니다.'), false)
})

test('preview short reasons prioritize risk before softer checks', async () => {
  const text = `
운영 매니저 채용
주요업무
- 반복 운영 관리와 요청 처리
- 일일 모니터링 운영
- 데이터 취합 및 결과 보고
자격요건
- 엑셀 활용 능력
우대사항
- 프로세스 개선 경험
`

  const result = await buildPreview({ jobPostingText: text })
  const reasons = result.freePreview.shortReasons

  assert.equal(reasons.length >= 1, true)
  assert.equal(
    result.freePreview.topEvidence.interpretation.includes('단순 운영 비중에서 주의 신호') ||
      reasons[0].includes('단순 운영 비중에서 주의 신호'),
    true,
  )
})

test('preview headline stays at overall judgment level without axis labels', async () => {
  const text = `
브랜드 마케터 채용
주요업무
- 전사 이슈 및 시즈널리티에 따른 시즌 캠페인 기획 및 운영, 회고
- 데이터 기반 결과 보고서 작성 및 개선 제안
`

  const result = await buildPreview({ jobPostingText: text })
  const headline = result.freePreview.headline

  assert.equal(typeof headline, 'string')
  assert.equal(headline.includes('단순 운영 비중'), false)
  assert.equal(headline.includes('내 권한과 책임'), false)
  assert.equal(
    headline.includes('핵심 확인은 필요합니다.') ||
      headline.includes('면접에서 확인할 포인트를 먼저 보세요.') ||
      headline.includes('확인 포인트부터 먼저 확인해 보세요.'),
    true,
  )
})

test('preview copy avoids pressure or social proof language', async () => {
  const text = `
브랜드 마케터 채용
주요업무
- 전사 이슈에 따른 시즌 캠페인 기획 및 운영
- 데이터 기반 결과 보고서 작성 및 개선 제안
`

  const result = await buildPreview({ jobPostingText: text })
  const textBlob = JSON.stringify(result.freePreview)

  assert.equal(textBlob.includes('지금 결제'), false)
  assert.equal(textBlob.includes('놓치면 손해'), false)
  assert.equal(textBlob.includes('많은 사용자'), false)
  assert.equal(textBlob.includes('많은 지원자'), false)
})

test('preview keeps axis-specific detail in short reasons only', async () => {
  const text = `
브랜드 마케터 채용
주요업무
- 전사 이슈 및 시즈널리티에 따른 시즌 캠페인 기획 및 운영, 회고
- 커뮤니케이션 전략에 따른 브랜드 캠페인 실행 및 결과 보고
자격요건
- 데이터 기반으로 결과 보고서 작성 및 개선 제안
`

  const result = await buildPreview({ jobPostingText: text })
  const headline = result.freePreview.headline
  const reasons = result.freePreview.shortReasons

  assert.equal(headline.includes('단순 운영 비중'), false)
  assert.equal(headline.includes('내 권한과 책임'), false)
  assert.equal(reasons.length <= 1, true)
  assert.equal(
    reasons.some((item) => item.includes('확인') || item.includes('KPI') || item.includes('운영·조율')),
    true,
  )
})

test('final free preview prevents cross-field duplication between interpretation and short reason', async () => {
  const text = `
브랜드 마케터 채용
주요업무
- 전사 이슈에 따른 시즌 캠페인 기획 및 운영, 회고
- 커뮤니케이션 전략에 따른 브랜드 캠페인 실행 및 결과 보고
자격요건
- 데이터 기반으로 결과 보고서 작성 및 개선 제안
`

  const result = await buildPreview({ jobPostingText: text })
  const interpretation = result.freePreview.topEvidence?.interpretation || ''
  const reason = result.freePreview.shortReasons?.[0] || ''

  assert.equal(Boolean(interpretation), true)
  assert.equal(Boolean(reason), true)
  assert.equal(interpretation === reason, false)
})

test('final free preview removes near-duplicate reason even with punctuation or spacing changes', async () => {
  const text = `
운영 매니저 채용
주요업무
- 반복 운영 관리와 요청 처리
- 일일 모니터링 운영
자격요건
- 엑셀 활용 능력
`

  const result = await buildPreview({ jobPostingText: text })
  const interpretation = (result.freePreview.topEvidence?.interpretation || '').replace(/\s+/g, ' ').trim()
  const reason = (result.freePreview.shortReasons?.[0] || '').replace(/\s+/g, ' ').trim()

  assert.equal(Boolean(interpretation), true)
  assert.equal(Boolean(reason), true)
  assert.equal(interpretation.replace(/[.,!?]/g, '') === reason.replace(/[.,!?]/g, ''), false)
})

test('expanded criteria classifies manufacturing roles and uses job-specific signals', async () => {
  const text = `
생산 공정 개선 채용
주요업무
- 반복 점검이 아니라 공정 개선과 품질 개선을 수행합니다
- 데이터 분석과 결과 보고를 수행합니다
자격요건
- 생산 공정 이해
`

  const result = await buildPreview({ jobPostingText: text })
  assert.equal(typeof result.structured.jobFamily.id, 'string')
  assert.equal(typeof result.structured.criteria.label, 'string')
  assert.ok(['low', 'medium', 'needs_review', 'high'].includes(result.structured.criteriaMatch.level))
})

test('reward or hiring process evidence is excluded from axis evidence', async () => {
  const text = `
Brand marketer hiring
Reward
Candidate and referrer each get cash 500000 KRW
Hiring process
Apply -> Interview -> Final offer
Responsibilities
- Brand IMC planning and operation
- Campaign result reporting
Requirements
- Data based reporting document writing
Deadline
Always hiring
`

  const result = await buildPreview({ jobPostingText: text })
  const evidenceQuotes = result.structured.fiveAxes.map((axis) => axis.evidence?.quote || '')
  const joined = evidenceQuotes.join('\n')

  assert.equal(joined.includes('Candidate and referrer each get cash 500000 KRW'), false)
  assert.equal(joined.includes('Apply -> Interview -> Final offer'), false)
  assert.equal(joined.includes('Always hiring'), false)
})

test('benefits evidence is excluded from key axis evidence', async () => {
  process.env.ANALYSIS_EVIDENCE_V2 = 'true'
  const text = `
브랜드 마케터 채용
혜택 및 복지
- 삶과 업무에 지쳐 멘탈 케어가 필요하다면, 프라이빗 심리 상담 지원
주요업무
- 커뮤니케이션 전략에 따른 브랜드 IMC 플랜 실행 및 결과 보고
- 전사 이슈에 따른 시즌 캠페인 기획 및 운영, 회고
`
  const result = await buildPreview({ jobPostingText: text })
  const joined = result.structured.fiveAxes.map((axis) => axis.evidence?.quote || '').join('\n')
  assert.equal(joined.includes('프라이빗 심리 상담 지원'), false)
})

test('title-like sentence is not selected as topEvidence when concrete evidence exists', async () => {
  process.env.ANALYSIS_EVIDENCE_V2 = 'true'
  const text = `
브랜드 마케터 채용
주요업무
- 컬리 브랜드 캠페인 IMC 기획/운영
- 커뮤니케이션 전략에 따른 브랜드 IMC 플랜 실행 및 결과 보고
- 데이터 기반으로 결과 보고서 작성 및 개선 제안
`
  const result = await buildPreview({ jobPostingText: text })
  assert.notEqual(result.freePreview.topEvidence.quote, '컬리 브랜드 캠페인 IMC 기획/운영')
})

test('company header pattern extracts company name and avoids missing-company limitation', async () => {
  process.env.ANALYSIS_EVIDENCE_V2 = 'true'
  const text = `
컬리∙서울 강남구∙경력 3-8년

브랜드 마케터 (IMC)

주요업무
- 커뮤니케이션 전략에 따른 브랜드 IMC 플랜 실행 및 결과 보고
- 전사 이슈에 따른 시즌 캠페인 기획 및 운영, 회고
자격요건
- 데이터, 소비자 조사, 사례 등을 기반으로 결과 보고서 작성 및 개선 제안
`

  const result = await buildPreview({ jobPostingText: text })
  assert.equal(result.structured.companyContext.companyName, '컬리')
  assert.equal(
    result.structured.companyContext.limitations.includes('채용공고에서 회사명을 명확하게 추출하지 못해 회사 맥락 해석은 제한적입니다.'),
    false,
  )
})

test('company and title only line is excluded from axis evidence when concrete work lines exist', async () => {
  process.env.ANALYSIS_EVIDENCE_V2 = 'true'
  const text = `
컬리∙서울 강남구∙경력 3-8년

브랜드 마케터 (IMC)

주요업무
- 컬리 브랜드 캠페인 IMC 기획/운영
- 커뮤니케이션 전략에 따른 브랜드 IMC 플랜 실행 및 결과 보고
- 전사 이슈에 따른 시즌 캠페인 기획 및 운영, 회고
자격요건
- 데이터 기반으로 결과 보고서 작성 및 개선 제안
`

  const result = await buildPreview({ jobPostingText: text })
  const evidenceQuotes = result.structured.fiveAxes.map((axis) => axis.evidence?.quote).filter(Boolean)
  assert.equal(evidenceQuotes.includes('컬리 브랜드 캠페인 IMC 기획/운영'), false)
  assert.equal(
    evidenceQuotes.some((quote) => quote.includes('브랜드 IMC 플랜 실행 및 결과 보고') || quote.includes('시즌 캠페인 기획 및 운영, 회고')),
    true,
  )
})

test('marketing posting keeps mixed signal instead of flattening to generic info gap', async () => {
  process.env.ANALYSIS_EVIDENCE_V2 = 'true'
  const text = `
컬리∙서울 강남구∙경력 3-8년

브랜드 마케터 (IMC)

주요업무
- 커뮤니케이션 전략에 따른 브랜드 IMC 플랜 실행 및 결과 보고
- 전사 이슈 및 시즈널리티에 따른 시즌 캠페인 기획 및 운영, 회고
- 브랜드 조사 셋팅 및 운영 관리
자격요건
- 종합 광고 대행사 AE 및 인하우스 브랜드 마케터로 브랜드 캠페인 A to Z를 경험해 보신 분
`

  const result = await buildPreview({ jobPostingText: text })
  const responsibility = result.structured.fiveAxes.find((axis) => axis.key === 'responsibility')
  const measurable = result.structured.fiveAxes.find((axis) => axis.key === 'measurable')

  assert.equal(['mixed_signal', 'positive_with_check', 'strong_positive'].includes(responsibility.level), true)
  assert.equal(['mixed_signal', 'positive_with_check', 'strong_positive'].includes(measurable.level), true)
  assert.equal(result.freePreview.shortReasons.length <= 1, true)
  assert.equal(
    result.freePreview.headline.includes('실제 권한 범위는 면접에서 확인이 필요합니다.') ||
      result.freePreview.headline.includes('KPI와 성과 책임 범위는 면접에서 확인이 필요합니다.'),
    true,
  )
})

test('default preview path uses upgraded evidence scoring unless explicitly disabled', async () => {
  process.env.ANALYSIS_EVIDENCE_V2 = ''
  const text = `
컬리∙서울 강남구∙경력 3-8년

브랜드 마케터 (IMC)

주요업무
- 커뮤니케이션 전략에 따른 브랜드 IMC 플랜 실행 및 결과 보고
- 전사 이슈 및 시즈널리티에 따른 시즌 캠페인 기획 및 운영, 회고
- 브랜드 조사 셋팅 및 운영 관리
자격요건
- 종합 광고 대행사 AE 및 인하우스 브랜드 마케터로 브랜드 캠페인 A to Z를 경험해 보신 분
`

  const result = await buildPreview({ jobPostingText: text })
  const headline = result.freePreview.headline
  const responsibility = result.structured.fiveAxes.find((axis) => axis.key === 'responsibility')
  const measurable = result.structured.fiveAxes.find((axis) => axis.key === 'measurable')

  assert.equal(['mixed_signal', 'positive_with_check', 'strong_positive'].includes(responsibility.level), true)
  assert.equal(['mixed_signal', 'positive_with_check', 'strong_positive'].includes(measurable.level), true)
  assert.equal(headline.includes('공고만으로는 판단 근거가 부족합니다'), false)
})

test('detail report focuses on top three issues instead of expanding every axis equally', async () => {
  process.env.ANALYSIS_EVIDENCE_V2 = 'true'
  const text = `
컬리∙서울 강남구∙경력 3-8년

브랜드 마케터 (IMC)

주요업무
- 커뮤니케이션 전략에 따른 브랜드 IMC 플랜 실행 및 결과 보고
- 전사 이슈 및 시즈널리티에 따른 시즌 캠페인 기획 및 운영, 회고
- 브랜드 조사 셋팅 및 운영 관리
자격요건
- 종합 광고 대행사 AE 및 인하우스 브랜드 마케터로 브랜드 캠페인 A to Z를 경험해 보신 분
- 데이터, 소비자 조사, 사례 등을 기반으로 결과 보고서 작성 및 개선 제안
`

  const preview = await buildPreview({ jobPostingText: text })
  const detail = await buildDetailReport({
    analysis: {
      structured: preview.structured,
      freePreview: preview.freePreview,
    },
  })

  assert.equal(detail.detail.keyEvidence.length <= 3, true)
  assert.equal(detail.detail.keyEvidence.length >= 1, true)

  const axisQuotes = new Set(detail.detail.keyEvidence.map((item) => item.quote).filter(Boolean))
  assert.equal(axisQuotes.size, detail.detail.keyEvidence.length)

  const joinedQuestions = detail.detail.interviewQuestions.map((item) => item.question).join('\n')
  assert.equal(
    joinedQuestions.includes('KPI와 의사결정 범위') ||
      joinedQuestions.includes('실행 운영과 기획·개선 업무의 비중') ||
      joinedQuestions.includes('성과는 어떤 지표나 결과물로 평가하나요?'),
    true,
  )
})

test('output text does not include known grammar mistakes', async () => {
  process.env.ANALYSIS_EVIDENCE_V2 = 'true'
  const text = `
마케팅 채용
주요업무
- KPI 지표 데이터 결과 보고
- 전략 기획 및 개선 실행
`
  const result = await buildPreview({ jobPostingText: text })
  const textBlob = JSON.stringify(result.freePreview) + JSON.stringify(result.structured.fiveAxes)
  assert.equal(textBlob.includes('책임 범위은'), false)
  assert.equal(textBlob.includes('난이도 상승 여부은'), false)
})

test('V2 scoring: needs_review when no axis keywords are found', async () => {
  process.env.ANALYSIS_EVIDENCE_V2 = 'true'
  const text = `
Product role
Responsibilities
- Team collaboration and communication
- Various support tasks
Requirements
- Smooth communication
`

  const result = await buildPreview({ jobPostingText: text })
  const repetition = result.structured.fiveAxes.find((axis) => axis.key === 'repetition')
  assert.equal(repetition.level, 'insufficient_info')
})

test('V2 scoring attaches numeric evidence score', async () => {
  process.env.ANALYSIS_EVIDENCE_V2 = 'true'
  const text = `
마케팅 채용
주요업무
- 반복 운영 관리와 요청 처리
- KPI 지표 데이터 결과 보고
- 전략 기획 및 개선 실행
자격요건
- 데이터 기반 문서화
`

  const result = await buildPreview({ jobPostingText: text })
  const withEvidence = result.structured.fiveAxes.filter((axis) => axis.evidence)
  assert.ok(withEvidence.length > 0)
  for (const axis of withEvidence) {
    assert.equal(typeof axis.evidence.score, 'number')
  }
})

test('V2 off keeps fallback-safe behavior', async () => {
  process.env.ANALYSIS_EVIDENCE_V2 = 'false'
  const text = `
Brand marketer hiring
Reward
Candidate and referrer each get cash 500000 KRW
Hiring process
Apply -> Interview -> Final offer
Responsibilities
- Brand IMC planning and operation
`

  const result = await buildPreview({ jobPostingText: text })
  const joined = result.structured.fiveAxes.map((axis) => axis.evidence?.quote || '').join('\n')
  assert.equal(joined.includes('Candidate and referrer each get cash 500000 KRW'), false)
  assert.equal(joined.includes('Apply -> Interview -> Final offer'), false)
})

test('company context uses mock company data only as optional reference information', async () => {
  const text = `
Acme Japan Commerce 채용
회사 홈페이지 https://acme.example.com
주요업무
- 일본 시장 현지화 운영 프로세스를 설계하고 실행합니다
- 글로벌 상품 운영 KPI를 관리합니다
자격요건
- 일본 시장 또는 글로벌 운영 경험
우대사항
- 신규 시장 런칭 경험
`

  const result = await buildPreview({ jobPostingText: text })
  const companyContext = result.structured.companyContext

  assert.equal(Boolean(companyContext.companyName), true)
  assert.equal(Array.isArray(companyContext.businessSignals), true)
  assert.equal(Array.isArray(companyContext.sources), true)
  assert.equal(companyContext.sources.length > 0, true)
  assert.equal(Array.isArray(companyContext.reportEvidence.companyEvidence), true)
  assert.equal(companyContext.reportEvidence.companyEvidence.length > 0, true)
  assert.equal(Array.isArray(companyContext.reportEvidence.postingEvidence), true)
  assert.equal(Array.isArray(companyContext.limitations), true)
})

test('company context stays conservative when company name is missing', async () => {
  const text = `
주요업무
- 반복 운영 관리와 요청 처리
- 데이터 리포트 작성
자격요건
- 엑셀 활용 능력
`

  const result = await buildPreview({ jobPostingText: text })
  const companyContext = result.structured.companyContext

  assert.equal(companyContext.companyName, null)
  assert.equal(Array.isArray(companyContext.sources), true)
  assert.equal(companyContext.sources.length, 0)
  assert.equal(Array.isArray(companyContext.reportEvidence.companyEvidence), true)
  assert.equal(companyContext.reportEvidence.companyEvidence.length, 0)
  assert.equal(Array.isArray(companyContext.limitations), true)
  assert.equal(
    companyContext.limitations.includes('채용공고에서 회사명을 명확하게 추출하지 못해 회사 맥락 해석은 제한적입니다.'),
    true,
  )
})

test('detail report keeps company context structure without breaking core analysis', async () => {
  const text = `
Acme Japan Commerce 채용
주요업무
- 일본 시장 현지화 운영 프로세스를 설계하고 실행합니다
- KPI 기준으로 글로벌 운영 성과를 관리합니다
자격요건
- 일본 시장 또는 글로벌 운영 경험
`

  const preview = await buildPreview({ jobPostingText: text })
  const detail = await buildDetailReport({
    analysis: {
      structured: preview.structured,
      freePreview: preview.freePreview,
    },
  })

  assert.equal(Array.isArray(detail.detail.companyContext.mustAskQuestions), true)
  assert.equal(Array.isArray(detail.detail.companyContext.sources), true)
  assert.equal(Array.isArray(detail.detail.companyContext.reportEvidence.companyEvidence), true)
  assert.equal(Array.isArray(detail.detail.companyContext.reportEvidence.postingEvidence), true)
  assert.equal(Array.isArray(detail.detail.interviewQuestions), true)
  assert.equal(detail.detail.interviewQuestions.length > 0, true)
  assert.equal(typeof detail.detail.finalSummary, 'string')
})

test('detail report action guide stays trust-first without pressure language', async () => {
  const text = `
운영 매니저 채용
주요업무
- 반복 운영 관리와 요청 처리
- 데이터 리포트 작성
자격요건
- 엑셀 활용 능력
`

  const preview = await buildPreview({ jobPostingText: text })
  const detail = await buildDetailReport({
    analysis: {
      structured: preview.structured,
      freePreview: preview.freePreview,
    },
  })

  const textBlob = JSON.stringify(detail.detail)
  assert.equal(textBlob.includes('지금 결제'), false)
  assert.equal(textBlob.includes('놓치면 손해'), false)
  assert.equal(textBlob.includes('많은 사용자'), false)
})

test('karly-style posting recovers company name from repeated internal mentions and shows light company context', async () => {
  const text = `
브랜드 마케터 (IMC)

포지션 상세
브랜드마케팅 담당자는 브랜드의 핵심가치를 전달하고 브랜드 자산을 제고하는 역할을 합니다.
주요업무
- 컬리 브랜드 캠페인 IMC 기획/운영
- 커뮤니케이션 전략에 따른 브랜드 IMC 플랜 실행 및 결과 보고
- 전사 이슈 및 시즈널리티에 따른 시즌 캠페인 기획 및 운영, 회고
자격요건
- 컬리 고객과 마케팅 커뮤니케이션에 대한 이해
- 컬리 서비스에 대한 애정이 있으신 분
`

  const preview = await buildPreview({ jobPostingText: text })
  const detail = await buildDetailReport({
    analysis: {
      structured: preview.structured,
      freePreview: preview.freePreview,
    },
  })

  const companyContext = detail.detail.companyContext
  const section = getCompanyContextSection(companyContext)

  assert.equal(companyContext.companyName, '컬리')
  assert.equal(companyContext.companyName === preview.structured.jobTitle, false)
  assert.equal(Array.isArray(companyContext.reportEvidence.postingEvidence), true)
  assert.equal(companyContext.reportEvidence.postingEvidence.length > 0, true)
  assert.equal(section?.mode, 'light')
  assert.equal(section?.title, '공고 안에서 보이는 회사 맥락 참고')
  assert.equal(section?.interpretation.includes('컬리'), true)
})

test('parallel space regression keeps evidence intact and avoids repeated intro quote', async () => {
  process.env.ANALYSIS_EVIDENCE_V2 = 'true'
  const preview = await buildPreview({ jobPostingText: PARALLEL_SPACE_POSTING })
  const detail = await buildDetailReport({
    analysis: {
      structured: preview.structured,
      freePreview: preview.freePreview,
    },
  })

  const previewQuote = preview.freePreview.topEvidence.quote || ''
  assert.equal(previewQuote.includes('Reconstructi'), false)
  assert.equal(previewQuote.length > 0, true)

  const evidenceQuotes = preview.structured.fiveAxes.map((axis) => axis.evidence?.quote).filter(Boolean)
  const uniqueQuotes = new Set(evidenceQuotes)
  assert.equal(uniqueQuotes.size >= 3, true)

  const repetition = preview.structured.fiveAxes.find((axis) => axis.key === 'repetition')
  assert.notEqual(repetition?.level, 'risk')
  const responsibility = preview.structured.fiveAxes.find((axis) => axis.key === 'responsibility')
  assert.equal(['positive_with_check', 'strong_positive'].includes(responsibility?.level), true)
  assert.equal(
    ['좋음', '추가 확인 필요', '위험', '검증 전 지원 보류'].includes(preview.freePreview.riskLevelLabel),
    true,
  )
  assert.equal(
    preview.freePreview.verificationQuestion.includes('기술 선택') ||
    preview.freePreview.verificationQuestion.includes('아키텍처 의사결정') ||
    preview.freePreview.verificationQuestion.includes('신규 기능 개발') ||
    preview.freePreview.verificationQuestion.includes('유지보수'),
    true,
  )

  const detailBlob = JSON.stringify(detail.detail)
  assert.equal(detailBlob.includes('disabled_or_missing_key'), false)
})

test('development detail questions use differentiated answer signals', async () => {
  process.env.ANALYSIS_EVIDENCE_V2 = 'true'
  const preview = await buildPreview({ jobPostingText: PARALLEL_SPACE_POSTING })
  const detail = await buildDetailReport({
    analysis: {
      structured: preview.structured,
      freePreview: preview.freePreview,
    },
  })

  const questions = detail.detail.interviewQuestions
  assert.equal(Array.isArray(questions), true)
  assert.equal(questions.length > 0, true)

  const uniqueGoodSignals = new Set(questions.map((item) => item.goodAnswerSignal))
  const uniqueRiskSignals = new Set(questions.map((item) => item.riskyAnswerSignal))
  assert.equal(uniqueGoodSignals.size >= 3, true)
  assert.equal(uniqueRiskSignals.size >= 3, true)

  const joinedQuestions = questions.map((item) => item.question).join('\n')
  assert.equal(
    joinedQuestions.includes('아키텍처 의사결정') ||
    joinedQuestions.includes('신규 기능 개발과 운영·유지보수') ||
    joinedQuestions.includes('SaaS 전환'),
    true,
  )
})

test('backend posting is not misclassified as hr when hiring-process noise is present', async () => {
  const text = `
위버스컴퍼니(WEVERSE COMPANY)∙경기 성남시∙신입 이상

Back-end

원티드 픽
전 세계 팬과 아티스트를 연결하는 글로벌 슈퍼팬 플랫폼

응답률
평균이상

포지션 상세
글로벌 팬덤 플랫폼의 백엔드 시스템을 개발합니다.
주요업무
- 커뮤니티, 멤버십, 커머스 기능을 백엔드 구조로 구현합니다.
- Java 또는 Kotlin 기반 서비스 개발과 운영을 수행합니다.
자격요건
- Spring Framework 기반 웹서비스 구조에 대한 이해

채용 절차
- 조직적합성 면접
- 리더 면접
`

  const result = await buildPreview({ jobPostingText: text })
  assert.equal(result.structured.jobFamily.id, 'development')
  assert.equal(result.structured.jobTitle, 'Back-end')
})

test('title extraction skips generic recruitment labels like 상시채용 or 채용절차', async () => {
  const text = `
company logo
(주)위비스
여성 패션 브랜드 지센 여성 우븐 디자이너 대리-과장급 경력
51-300명
복지포인트
식대 지원
상시채용

주요업무
- 시즌 컨셉과 소재를 기획하고 디자인 방향을 제안합니다.
- 샘플과 메인 생산 디자인을 총괄합니다.
자격요건
- 여성복 디자인 경력
`

  const result = await buildPreview({ jobPostingText: text })
  assert.equal(result.structured.jobTitle, '여성 패션 브랜드 지센 여성 우븐 디자이너 대리-과장급 경력')
  assert.equal(result.structured.jobFamily.id, 'design')
})

test('scm and inventory titles map to operations family instead of unrelated office families', async () => {
  const text = `
마이크로소프트(Microsoft)∙서울 종로구∙신입 이상
Data Center Inventory & Asset Technician

포지션 상세
- cycle audits, incoming/outgoing deliveries, stock control, inventory management
자격요건
- inventory handling experience
`

  const result = await buildPreview({ jobPostingText: text })
  assert.equal(result.structured.jobFamily.id, 'operations')
  assert.equal(
    result.freePreview.verificationQuestion.includes('프로세스 개선') ||
      result.freePreview.verificationQuestion.includes('재고 정확도') ||
      result.freePreview.verificationQuestion.includes('ERP/WMS/OMS'),
    true,
  )
})

test('physical ai lead title keeps tech family despite noisy recruiting page text', async () => {
  const text = `
company logo
(주)크라우드웍스
Physical AI 리드
누적 투자 300억↑

주요업무
- AI 기술 전략 수립
- 컨소시엄 제안과 기술 검토 주도
- 필요 시 직접 개발 참여 가능
채용절차
- 1차인터뷰
`

  const result = await buildPreview({ jobPostingText: text })
  assert.equal(result.structured.jobTitle, 'Physical AI 리드')
  assert.equal(result.structured.jobFamily.id, 'development')
})

test('reliability gate blocks good preview and captures conflicting hiring signals', async () => {
  const text = `
㈜??
M365 운영(기술지원 포함)
상세한 업무 내용은 고객사 보안사항으로 인터뷰시 안내
고용형태: 파견직
계약형태: 프리랜스
직급: 부장(연구소장)
직책: 팀원
근무지: 상암 LG CNS 또는 마곡 LG U+
수락시 귀하의 경력서를 hello@daum.net으로 회신부탁드립니다.
`

  const preview = await buildPreview({ jobPostingText: text })
  const detail = await buildDetailReport({
    analysis: {
      structured: preview.structured,
      freePreview: preview.freePreview,
    },
  })

  assert.equal(preview.freePreview.riskLevelLabel, '검증 전 지원 보류')
  assert.equal(preview.freePreview.topEvidence.quote.includes('daum.net') || preview.freePreview.topEvidence.quote.includes('㈜??'), true)
  assert.equal(preview.freePreview.verificationQuestion.includes('법인명') || preview.freePreview.verificationQuestion.includes('회사 이메일'), true)

  const applicationSafety = detail.detail.auxiliaryChecks.find((item) => item.key === 'applicationSafety')
  const contractConsistency = detail.detail.auxiliaryChecks.find((item) => item.key === 'contractConsistency')
  const roleClarity = detail.detail.sevenAxes.find((item) => item.key === 'scopeClarity')
  const learningFeedback = detail.detail.sevenAxes.find((item) => item.key === 'learningFeedback')

  assert.equal(applicationSafety?.level, 'high')
  assert.equal(contractConsistency?.level, 'high')
  assert.equal(['risk', 'positive_with_check', 'insufficient_info'].includes(roleClarity?.level), true)
  assert.equal(learningFeedback?.level === 'insufficient_info' || learningFeedback?.level === 'positive_with_check', true)
  assert.equal(JSON.stringify(detail.detail).includes('직접 인용 가능한 근거가 부족합니다.'), false)
})

test('free preview separates verdict, evidence meaning, and question on trust-gate postings', async () => {
  const text = `
㈜??
M365 운영(기술지원 포함)
상세한 업무 내용은 고객사 보안사항으로 인터뷰시 안내
고용형태: 파견직
계약형태: 프리랜스
수락시 귀하의 경력서를 hello@daum.net으로 회신부탁드립니다.
`

  const result = await buildPreview({ jobPostingText: text })
  const preview = result.freePreview

  assert.equal(preview.riskLevelLabel, '검증 전 지원 보류')
  assert.equal(preview.headline.includes('지원') || preview.headline.includes('보류') || preview.headline.includes('확인'), true)
  assert.equal(preview.topEvidence.quote.includes('daum.net') || preview.topEvidence.quote.includes('㈜??'), true)
  assert.equal(preview.topEvidence.interpretation.length > 0, true)
  assert.equal(preview.shortReasons.length <= 1, true)
  assert.equal(preview.shortReasons[0] !== preview.topEvidence.interpretation, true)
  assert.equal(preview.verificationQuestion.length > 0, true)
})

test('reliability-gate preview keeps evidence, interpretation, and question in different roles', async () => {
  const text = `
채용공고
지원 의사가 있으시면 최신 경력서를 hello@naver.com으로 회신 부탁드립니다.
고용형태: 파견직
계약형태: 프리랜스
`

  const result = await buildPreview({ jobPostingText: text })
  const preview = result.freePreview

  assert.equal(preview.topEvidence.quote.includes('naver.com'), true)
  assert.equal(preview.topEvidence.interpretation.includes('개인정보') || preview.topEvidence.interpretation.includes('제출'), true)
  assert.equal(preview.verificationQuestion.includes('이메일') || preview.verificationQuestion.includes('계약 주체'), true)
  assert.equal(preview.topEvidence.quote === preview.topEvidence.interpretation, false)
  assert.equal((preview.shortReasons?.[0] || '') === preview.topEvidence.interpretation, false)
})

test('detail interview questions carry category-matched whyAsk text', async () => {
  const text = `
㈜??
M365 운영(기술지원 포함)
상세한 업무 내용은 고객사 보안사항으로 인터뷰시 안내
고용형태: 파견직
계약형태: 프리랜스
직급: 부장(연구소장)
직책: 팀원
수락시 귀하의 경력서를 hello@daum.net으로 회신부탁드립니다.
`

  const preview = await buildPreview({ jobPostingText: text })
  const detail = await buildDetailReport({
    analysis: {
      structured: preview.structured,
      freePreview: preview.freePreview,
    },
  })

  const emailQuestion = detail.detail.interviewQuestions.find((item) => item.category === 'applicationSafety')
  const contractQuestion = detail.detail.interviewQuestions.find((item) => item.category === 'contractConsistency')

  assert.equal(emailQuestion?.whyAsk?.includes('공식 회사 이메일') || emailQuestion?.whyAsk?.includes('개인정보'), true)
  assert.equal(contractQuestion?.whyAsk?.includes('계약 주체') || contractQuestion?.whyAsk?.includes('지급 방식'), true)
})

test('contract checks mention compensation conditions when freelance pay is shown', async () => {
  const text = `
㈜??
M365 운영(기술지원 포함)
고용형태: 파견직
계약형태: 프리랜스
월급여/용역비: 700만원
수락시 귀하의 경력서를 hello@daum.net으로 회신부탁드립니다.
`

  const preview = await buildPreview({ jobPostingText: text })
  const detail = await buildDetailReport({
    analysis: {
      structured: preview.structured,
      freePreview: preview.freePreview,
    },
  })

  const contractCheck = detail.detail.auxiliaryChecks.find((item) => item.key === 'contractConsistency')
  const compQuestion = detail.detail.interviewQuestions.find((item) => item.category === 'compensationContract')

  assert.equal(contractCheck?.summary?.includes('세전/세후'), true)
  assert.equal(contractCheck?.question?.includes('세전/세후'), true)
  assert.equal(compQuestion?.question?.includes('월 700만 원'), true)
  assert.equal(compQuestion?.whyAsk?.includes('공제 항목') || compQuestion?.whyAsk?.includes('계약서'), true)
})

test('good product posting suppresses trust-gate checks and keeps PM-style questions', async () => {
  const text = `
주식회사 무노
프로덕트 오너
회사
주식회사 무노
근무지역
서울 성동구 성수이로 87, muno 오피스
포지션 상세
B2B SaaS 온보딩, 대시보드, 알림, 리포트 기능을 담당하는 프로덕트 오너 포지션입니다.
지원은 공식 채용 페이지로 진행하며 문의는 recruit@muno.example.com으로 받습니다.
입사 전 근로계약서, 연봉, 직무 범위, 평가 기준을 서면 제공합니다.
주요업무
문제 정의, 우선순위 제안, 실험 설계 권한을 가지고 온보딩 퍼널과 리텐션을 개선합니다.
퍼널 분석, 사용자 인터뷰, PRD 작성, A/B 테스트, 지표 추적을 직접 수행합니다.
PRD, 인터뷰 리포트, 퍼널 분석 리포트, 실험 설계 문서, 회고 문서, 성과 대시보드를 산출합니다.
PM, 디자이너, FE, BE, 데이터 분석가와 스쿼드로 협업합니다.
자격요건
정규직 포지션입니다.
3개월 안에 데이터 분석, 인터뷰 10건, 개선 과제 3개, A/B 테스트를 진행합니다.
6개월 안에 온보딩 완료율 15% 개선, 핵심 기능 최초 사용률 20% 개선을 목표로 합니다.
Amplitude, GA4, SQL, Metabase, Notion, Figma, Jira, Slack을 활용합니다.
매주 제품 리뷰, 월 1회 Head of Product 1:1, 분기별 성과 발표를 운영합니다.
우대사항
B2B SaaS PM 경험, 데이터 기반 문제 정의 경험, 기능 출시 후 지표 추적 경험이 있으면 좋습니다.
`

  const preview = await buildPreview({ jobPostingText: text })
  const detail = await buildDetailReport({
    analysis: {
      structured: preview.structured,
      freePreview: preview.freePreview,
    },
  })

  const joinedQuestions = detail.detail.interviewQuestions.map((item) => item.question).join('\n')
  const topQuestions = detail.detail.interviewQuestions.slice(0, 3).map((item) => item.question).join('\n')
  const strongPositiveCount = detail.detail.sevenAxes.filter((axis) => axis.level === 'strong_positive').length

  assert.equal(preview.structured.jobFamily.id, 'product')
  assert.equal(detail.detail.jobFamily.label.includes('프로덕트'), true)
  assert.equal(detail.detail.jobFamily.label.includes('HR'), false)
  assert.equal(['좋음', '추가 확인 필요'].includes(preview.freePreview.riskLevelLabel), true)
  assert.equal(preview.freePreview.headline.includes('좋은 신호') || preview.freePreview.headline.includes('경력 자산'), true)
  assert.equal(preview.freePreview.verificationQuestion.includes('기준선') || preview.freePreview.verificationQuestion.includes('결정'), true)
  assert.equal(detail.detail.auxiliaryChecks.some((item) => ['applicationSafety', 'contractConsistency', 'workLocationClarity', 'roleClarity'].includes(item.key)), false)
  assert.equal(detail.detail.auxiliaryChecks.some((item) => item.key === 'employmentForm'), true)
  assert.equal(joinedQuestions.includes('파견인지 프리랜스인지'), false)
  assert.equal(joinedQuestions.includes('4대보험'), false)
  assert.equal(joinedQuestions.includes('고객사 상주'), false)
  assert.equal(joinedQuestions.includes('회사 이메일'), false)
  assert.equal(topQuestions.includes('현재 기준선'), true)
  assert.equal(topQuestions.includes('평가') || topQuestions.includes('재계획'), true)
  assert.equal(topQuestions.includes('Head of Product') || topQuestions.includes('PM 피어 리뷰'), true)
  assert.equal(joinedQuestions.includes('기준선') || joinedQuestions.includes('평가') || joinedQuestions.includes('승인권자'), true)
  assert.equal(strongPositiveCount >= 2, true)
  assert.equal(detail.detail.sevenAxes.find((axis) => axis.key === 'transferable')?.level === 'insufficient_info', false)
  assert.equal(detail.detail.sevenAxes.find((axis) => axis.key === 'scopeClarity')?.level === 'insufficient_info', false)
  assert.equal(detail.detail.sevenAxes.find((axis) => axis.key === 'learningFeedback')?.level === 'insufficient_info', false)
  assert.equal(Boolean(detail.detail.sevenAxes.find((axis) => axis.key === 'transferable')?.evidence?.quote), true)
  assert.equal((detail.detail.sevenAxes.find((axis) => axis.key === 'scopeClarity')?.evidence?.quote || '').includes('온보딩') || (detail.detail.sevenAxes.find((axis) => axis.key === 'scopeClarity')?.evidence?.quote || '').includes('담당 제품'), true)
})

test('product onboarding title is not misclassified as hr family', async () => {
  const text = `
주식회사 무노
온보딩 프로덕트 매니저
포지션 상세
B2B SaaS 온보딩 퍼널과 리텐션을 개선하는 Product Manager 포지션입니다.
주요업무
문제 정의, 우선순위 제안, 실험 설계 권한을 가지고 PRD 작성, 사용자 인터뷰, A/B 테스트를 수행합니다.
6개월 안에 온보딩 완료율 15% 개선, 핵심 기능 최초 사용률 20% 개선을 목표로 합니다.
PM, 디자이너, FE, BE, 데이터 분석가와 스쿼드로 협업합니다.
매주 제품 리뷰, 월 1회 Head of Product 1:1을 운영합니다.
`

  const preview = await buildPreview({ jobPostingText: text })
  const detail = await buildDetailReport({
    analysis: {
      structured: preview.structured,
      freePreview: preview.freePreview,
    },
  })

  assert.equal(preview.structured.jobFamily.id, 'product')
  assert.equal(detail.detail.jobFamily.id, 'product')
  assert.equal(detail.detail.jobFamily.label.includes('프로덕트'), true)
  assert.equal(detail.detail.jobFamily.label.includes('HR'), false)
})

test('product scope clarity stays above insufficient when product area and core work are explicit', async () => {
  const text = `
1. 담당업무명 : B2B SaaS 고객 온보딩 및 리텐션 개선을 위한 프로덕트 기획 담당
2. 담당 제품 : 기업 고객용 업무 자동화 SaaS의 온보딩, 대시보드, 알림, 리포트 기능
4. 주요 업무 :
* 고객 온보딩 퍼널 분석 및 개선 과제 정의
* 기능 요구사항 문서(PRD) 작성
* A/B 테스트 기획 및 결과 분석
* 기능 출시 후 활성화율, 전환율, 리텐션 지표 추적
* 매주 제품 리뷰 미팅에서 실험 결과와 지표를 공유합니다.
* 월 1회 Head of Product와 1:1 피드백을 진행합니다.
* 분기마다 담당 제품 영역의 성과와 다음 분기 개선 방향을 직접 발표합니다.
`

  const preview = await buildPreview({ jobPostingText: text })
  const detail = await buildDetailReport({
    analysis: {
      structured: preview.structured,
      freePreview: preview.freePreview,
    },
  })

  const scopeClarity = detail.detail.sevenAxes.find((axis) => axis.key === 'scopeClarity')
  assert.equal(scopeClarity?.level === 'insufficient_info', false)
  assert.equal(Boolean(scopeClarity?.evidence?.quote), true)
})

test('repetition-risk contract postings prioritize operation mix and measurable outcome near the top', async () => {
  const { readFileSync } = await import('node:fs')
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/golden-set/golden-set-v3.confirmed.json', import.meta.url), 'utf8'))
  const text = fixture.samples.find((sample) => sample.id === 'W019')?.posting_text || ''
  const preview = await buildPreview({ jobPostingText: text })
  const detail = await buildDetailReport({
    analysis: {
      structured: preview.structured,
      freePreview: preview.freePreview,
    },
  })

  const topQuestions = detail.detail.interviewQuestions.slice(0, 4).map((item) => item.question)
  assert.equal(topQuestions.includes('실행 운영과 기획·개선 업무의 비중은 실제로 어느 정도인가요?'), true)
  assert.equal(topQuestions.includes('이 역할의 성과는 어떤 지표나 결과물로 평가하나요?'), true)
})

test('risky trust-gate posting still keeps safety checks and contract questions first', async () => {
  const text = `
㈜??
M365 운영(기술지원 포함)
상세한 업무 내용은 고객사 보안사항으로 인터뷰시 안내
고용형태: 파견직
계약형태: 프리랜스
직급: 부장(연구소장)
직책: 팀원
근무지: 상암 LG CNS 또는 마곡 LG U+
월급여/용역비: 700만원
수락시 귀하의 경력서를 hello@daum.net으로 회신부탁드립니다.
`

  const preview = await buildPreview({ jobPostingText: text })
  const detail = await buildDetailReport({
    analysis: {
      structured: preview.structured,
      freePreview: preview.freePreview,
    },
  })

  const auxiliaryKeys = detail.detail.auxiliaryChecks.map((item) => item.key)
  const questionCategories = detail.detail.interviewQuestions.map((item) => item.category)

  assert.equal(preview.freePreview.riskLevelLabel, '검증 전 지원 보류')
  assert.equal(auxiliaryKeys.includes('applicationSafety'), true)
  assert.equal(questionCategories.includes('applicationSafety'), true)
  assert.equal(questionCategories.includes('contractConsistency') || questionCategories.includes('compensationContract'), true)
})

test('fulfillment operations planning is classified as operations and stays in verification-needed range', async () => {
  const text = `
에이블리코퍼레이션
풀필먼트 서비스 운영기획 담당자
주요업무
에이블리 풀필먼트 서비스 운영을 기획하고 프로세스 개선 업무를 담당해요.
운영팀과의 협업을 통해 프로세스 개선안을 도출하고 실행을 추적 관리해요.
풀필먼트 서비스 지표를 모니터링하고 분석해요.
데이터를 추출 및 분석을 통해 운영의 적정성을 재고하고 생산성과 효율성을 끊임없이 개선할 수 있도록 지원해요.
자격요건
KPI, SLA 등 지표 수립과 분석 및 관리의 경험이 있으신 분을 찾아요.
문제 해결을 위해 분석, 기획, 실행까지 주도적으로 업무를 이끌어본 경험이 있으신 분을 찾아요.
SQL, 엑셀 등 데이터 핸들링을 위한 도구 및 활용에 능숙한 분이면 좋아요.
고용 형태 : 3개월 시용 계약 후, 역량과 퍼포먼스를 바탕으로 정규직 전환 여부를 결정해요.
`

  const preview = await buildPreview({ jobPostingText: text })

  assert.equal(preview.structured.jobFamily.id, 'operations')
  assert.equal(preview.freePreview.riskLevel, 'needs_review')
})

test('strategic HRBP is not treated as repetitive HR operations', async () => {
  const { readFileSync } = await import('node:fs')
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/golden-set/golden-set-v3.confirmed.json', import.meta.url), 'utf8'))
  const text = fixture.samples.find((sample) => sample.id === 'W154')?.posting_text || ''
  const preview = await buildPreview({ jobPostingText: text })
  const repetitionAxis = preview.structured.sevenAxes.find((axis) => axis.key === 'repetition')

  assert.equal(preview.structured.jobFamily.id, 'hr')
  assert.equal(preview.freePreview.riskLevel, 'low')
  assert.notEqual(repetitionAxis?.level, 'risk')
})

test('education content planning PM is treated as product planning, not ambiguous multi-location risk', async () => {
  const text = `
코리아온라인클래스
교육 콘텐츠 기획PM
주요업무
시장 흐름, 고객 니즈, 경쟁 상품을 바탕으로 신규 교육상품을 기획합니다.
실무자 강사와 협업해 강의 콘셉트, 커리큘럼, 수강생 결과물을 설계합니다.
제작PD, 마케팅, 디자인, 운영팀과 협업해 상세페이지, 광고 메시지, 런칭 방향을 정리합니다.
런칭 이후 매출, 전환율, 고객 반응, 후기 데이터를 보고 상품 개선안을 도출합니다.
하나의 콘텐츠를 단순 강의가 아니라 고객이 선택하고 끝까지 따라갈 수 있는 교육상품으로 만듭니다.
우대사항
교육 콘텐츠를 단순 강의가 아니라 하나의 상품, IP, 카테고리로 키워보고 싶은 분
1. 면접장소(본사 본관): 서울특별시 강남구 강남대로 286, 부영빌딩 3,4층
2. 근무지(온라인클래스): 서울특별시 서초구 강남대로41길 8, 태연빌딩 3,4층
`

  const preview = await buildPreview({ jobPostingText: text })
  const workLocationCheck = preview.structured.auxiliaryChecks.find((item) => item.key === 'workLocationClarity')

  assert.equal(preview.structured.jobFamily.id, 'product')
  assert.equal(preview.freePreview.riskLevel, 'low')
  assert.equal(workLocationCheck?.level, 'medium')
  assert.equal(preview.freePreview.headline.includes('지원 전에 역할 범위와 계약 조건을 먼저 확인하는 편이 안전합니다.'), false)
})

test('manufacturing contract role with scheduling and supply admin stays high risk without improvement ownership', async () => {
  const { readFileSync } = await import('node:fs')
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/golden-set/golden-set-v3.confirmed.json', import.meta.url), 'utf8'))
  const text = fixture.samples.find((sample) => sample.id === 'W060')?.posting_text || ''
  const preview = await buildPreview({ jobPostingText: text })

  assert.equal(preview.structured.jobFamily.id, 'manufacturing')
  assert.equal(preview.freePreview.riskLevel, 'high')
})

test('manufacturing risk sample does not use benefits or platform copy as representative evidence', async () => {
  const { readFileSync } = await import('node:fs')
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/golden-set/golden-set-v3.confirmed.json', import.meta.url), 'utf8'))
  const text = fixture.samples.find((sample) => sample.id === 'W060')?.posting_text || ''
  const preview = await buildPreview({ jobPostingText: text })

  assert.equal(/육아와 일의 균형|근무시간 배려제|재택근무|합격보상|원티드랩/.test(preview.freePreview.topEvidence.quote), false)
  assert.equal(/생산 일정|품질테스트|통관 진행|입고 수량 관리|샘플 관리|발주서 작성|납기 관리/.test(preview.freePreview.topEvidence.quote), true)
})

test('broad education operations with end-to-end role diffusion stay high risk', async () => {
  const { readFileSync } = await import('node:fs')
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/golden-set/golden-set-v3.confirmed.json', import.meta.url), 'utf8'))
  const text = fixture.samples.find((sample) => sample.id === 'W061')?.posting_text || ''
  const preview = await buildPreview({ jobPostingText: text })

  assert.equal(preview.structured.jobFamily.id, 'public')
  assert.equal(preview.freePreview.riskLevel, 'high')
})

test('media repetitive contract sample stays high when employment-form signal is present', async () => {
  const { readFileSync } = await import('node:fs')
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/golden-set/golden-set-v3.confirmed.json', import.meta.url), 'utf8'))
  const text = fixture.samples.find((sample) => sample.id === 'W019')?.posting_text || ''
  const preview = await buildPreview({ jobPostingText: text })

  assert.equal(preview.structured.jobFamily.id, 'media')
  assert.equal(preview.freePreview.riskLevel, 'high')
})

test('bx design posting with creative output signals is not treated as high risk from repetition alone', async () => {
  const text = `
더블유컨셉코리아 BX 디자이너
주요업무
- 브랜드 가이드라인 구축 및 운영, 비주얼 일관성 관리
- 온라인 브랜드 캠페인 비주얼, 광고 제작 및 마케팅 크리에이티브 디자인
- 오프라인 행사, 프로모션, 공간 그래픽 제작
- 패키지, 굿즈, 인쇄물 디자인
자격요건
- BX 디자이너 경력 5년 이상
- 포트폴리오 제출 필수
- 브랜드 아이덴티티를 이해하고 디자인으로 구현 가능한 분
- 캠페인 비주얼 및 브랜드 디자인 경험 보유
`

  const preview = await buildPreview({ jobPostingText: text })
  const repetitionAxis = preview.structured.sevenAxes.find((axis) => axis.key === 'repetition')

  assert.equal(preview.structured.jobFamily.id, 'design')
  assert.notEqual(preview.freePreview.riskLevel, 'high')
  assert.equal(repetitionAxis?.level, 'mixed_signal')
})

test('brand marketing posting with campaign strategy and performance analysis is not treated as repetitive operations', async () => {
  const text = `
브랜드 마케터
주요업무
- 브랜드 전략에 맞춘 시즌 캠페인 기획 및 운영
- 블로그 기반 SEO 전략 수립 및 실행
- 콘텐츠 기획, 제작 가이드 정리, 퍼포먼스 리포트 작성
- 캠페인 성과 분석 및 전환율 개선안 도출
`

  const preview = await buildPreview({ jobPostingText: text })
  const repetitionAxis = preview.structured.sevenAxes.find((axis) => axis.key === 'repetition')

  assert.equal(preview.structured.jobFamily.id, 'marketing')
  assert.notEqual(repetitionAxis?.level, 'risk')
})

test('content planning and community strategy posting is not treated as repetitive operations from 운영 wording alone', async () => {
  const text = `
콘텐츠 마케터
주요업무
- 교육 프로그램 및 커뮤니티 콘텐츠 기획
- 커뮤니티 운영 전략 수립 및 활성화 캠페인 실행
- 참여 데이터와 후기 분석을 바탕으로 다음 시즌 개선안 도출
- 파트너십 협업과 스토리텔링 방향 기획
`

  const preview = await buildPreview({ jobPostingText: text })
  const repetitionAxis = preview.structured.sevenAxes.find((axis) => axis.key === 'repetition')

  assert.equal(['media', 'marketing'].includes(preview.structured.jobFamily.id), true)
  assert.notEqual(repetitionAxis?.level, 'risk')
})

test('generic campaign planning and operation wording does not become repetition risk from 운영 alone', async () => {
  const text = `
프로젝트 코디네이터
주요업무
- 브랜드 캠페인 기획 및 운영
- 콘텐츠 전략 실행과 광고 메시지 정리
- 성과 리포트 작성 및 다음 시즌 개선 포인트 도출
`

  const preview = await buildPreview({ jobPostingText: text })
  const repetitionAxis = preview.structured.sevenAxes.find((axis) => axis.key === 'repetition')

  assert.notEqual(repetitionAxis?.level, 'risk')
})

test('responsibility axis does not mistake 책임감 wording for ownership', async () => {
  const text = `
운영 매니저
주요업무
- 출고 프로세스 운영 관리
자격요건
- 꼼꼼하고 책임감이 강한 분
`

  const preview = await buildPreview({ jobPostingText: text })
  const responsibilityAxis = preview.structured.sevenAxes.find((axis) => axis.key === 'responsibility')

  assert.notEqual(responsibilityAxis?.level, 'strong_positive')
})

test('scope clarity recognizes concrete owned product and deliverables wording', async () => {
  const text = `
브랜드 콘텐츠 기획자
주요업무
- 담당 제품의 브랜드 콘텐츠 전략 수립
- 주요 산출물: 캠페인 기획안, 성과 리포트, 상세페이지 메시지 가이드
`

  const preview = await buildPreview({ jobPostingText: text })
  const scopeAxis = preview.structured.sevenAxes.find((axis) => axis.key === 'scopeClarity')

  assert.notEqual(scopeAxis?.level, 'insufficient_info')
})

test('wanted footer recommendations do not contaminate auxiliary evidence on operations postings', async () => {
  const { readFileSync } = await import('node:fs')
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/golden-set/golden-set-v3.confirmed.json', import.meta.url), 'utf8'))
  const text = fixture.samples.find((sample) => sample.id === 'W106')?.posting_text || ''

  const preview = await buildPreview({ jobPostingText: text })
  const detail = await buildDetailReport({
    analysis: {
      structured: preview.structured,
      freePreview: preview.freePreview,
    },
  })

  const tailBlob = preview.structured.lines.slice(-20).join('\n')
  const auxiliaryBlob = JSON.stringify(detail.detail.auxiliaryChecks || [])

  assert.equal(/이 포지션을 찾고 계셨나요|합격은 확률이다|합격보상금|바이오던스|회식비 지원/i.test(tailBlob), false)
  assert.equal(/바이오던스|회식비 지원|합격보상금|이 포지션을 찾고 계셨나요/i.test(auxiliaryBlob), false)
})

test('posting tail trimming keeps real work-location evidence before recommendation footer', async () => {
  const { readFileSync } = await import('node:fs')
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/golden-set/golden-set-v3.confirmed.json', import.meta.url), 'utf8'))
  const text = fixture.samples.find((sample) => sample.id === 'W078')?.posting_text || ''

  const preview = await buildPreview({ jobPostingText: text })
  const detail = await buildDetailReport({
    analysis: {
      structured: preview.structured,
      freePreview: preview.freePreview,
    },
  })

  const locationCheck = detail.detail.auxiliaryChecks.find((item) => item.key === 'workLocationClarity')

  assert.equal(preview.structured.lines.includes('이 포지션을 찾고 계셨나요?'), false)
  assert.equal(Boolean(locationCheck?.evidence?.quote), true)
  assert.equal(/면접장소|근무지/.test(locationCheck?.evidence?.quote || ''), true)
})

test('design contract posting surfaces employment form in free preview and uses applicant-facing question', async () => {
  const result = await buildPreview({ jobPostingText: COUPANG_EATS_VISUAL_DESIGN_POSTING })

  assert.equal(result.structured.jobFamily.id, 'design')
  assert.equal(/계약/.test(result.freePreview.topEvidence.quote), true)
  assert.equal(/고용 형태|전환|연장 기준/.test(result.freePreview.verificationQuestion), true)
  assert.equal(result.freePreview.verificationQuestion.includes('디자인 근거를 제안할 수 있나요?'), false)
})

test('design contract posting suppresses company-context hallucination from privacy-only source', async () => {
  const preview = await buildPreview({ jobPostingText: COUPANG_EATS_VISUAL_DESIGN_POSTING })
  const detail = await buildDetailReport({
    analysis: {
      structured: preview.structured,
      freePreview: preview.freePreview,
    },
  })

  const hypothesisBlob = JSON.stringify(detail.detail.companyContext.jobConnectionHypotheses || [])
  const sourceBlob = JSON.stringify(detail.detail.companyContext.reportEvidence.companyEvidence || [])

  assert.equal(/영업|시장 실행|파트너십/.test(hypothesisBlob), false)
  assert.equal(/privacy-policy|공식 사이트/.test(sourceBlob), false)
})

test('detail display verdict stays aligned with free preview on known mismatch-prone samples', async () => {
  const { readFileSync } = await import('node:fs')
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/golden-set/golden-set-v3.confirmed.json', import.meta.url), 'utf8'))
  const sampleIds = ['W019', 'W060', 'W061', 'W154', 'W078']

  for (const sampleId of sampleIds) {
    const text = fixture.samples.find((sample) => sample.id === sampleId)?.posting_text || ''
    const preview = await buildPreview({ jobPostingText: text })
    const detail = await buildDetailReport({
      analysis: {
        structured: preview.structured,
        freePreview: preview.freePreview,
      },
    })

    assert.equal(detail.detail.displayVerdict?.riskLevel, preview.freePreview.riskLevel, sampleId)
    assert.equal(detail.detail.displayVerdict?.label, preview.freePreview.riskLevelLabel, sampleId)
  }
})

test('design contract posting does not reuse company-context questions as generic interview prompts', async () => {
  const preview = await buildPreview({ jobPostingText: COUPANG_EATS_VISUAL_DESIGN_POSTING })
  const detail = await buildDetailReport({
    analysis: {
      structured: preview.structured,
      freePreview: preview.freePreview,
    },
  })

  const companyQuestions = (detail.detail.companyContext.mustAskQuestions || []).map((item) => item.question)
  const interviewQuestions = (detail.detail.interviewQuestions || []).map((item) => item.question)
  const duplicates = companyQuestions.filter((question) =>
    interviewQuestions.includes(question) ||
    /성과는 어떤 지표|1년 뒤 이 역할|6개월 안에/i.test(question || ''),
  )

  assert.deepEqual(duplicates, [])
})

test('company context still keeps role-matched hypotheses on marketing sample', async () => {
  const { readFileSync } = await import('node:fs')
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/golden-set/golden-set-v3.confirmed.json', import.meta.url), 'utf8'))
  const text = fixture.samples.find((sample) => sample.id === 'W038')?.posting_text || ''
  const preview = await buildPreview({ jobPostingText: text })
  const companyContext = preview.structured.companyContext

  assert.equal(preview.structured.jobFamily.id, 'marketing')
  assert.equal(companyContext.jobConnectionHypotheses.length > 0, true)
  assert.equal(companyContext.reportEvidence.postingEvidence.length > 0, true)
})

test('sales posting does not inherit product-only ai company-context hypothesis', async () => {
  const { readFileSync } = await import('node:fs')
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/golden-set/golden-set-v3.confirmed.json', import.meta.url), 'utf8'))
  const text = fixture.samples.find((sample) => sample.id === 'W022')?.posting_text || ''
  const preview = await buildPreview({ jobPostingText: text })

  assert.equal(preview.structured.jobFamily.id, 'sales')
  assert.equal(preview.structured.companyContext.companyName, '코드잇')
  const hypothesisBlob = JSON.stringify(preview.structured.companyContext.jobConnectionHypotheses || [])
  assert.equal(/AI·데이터 서비스 신호/.test(hypothesisBlob), false)
  assert.equal(preview.structured.companyContext.mustAskQuestions.length, 0)
})

test('design contract posting avoids repeating the same evidence across multiple key axes', async () => {
  const preview = await buildPreview({ jobPostingText: COUPANG_EATS_VISUAL_DESIGN_POSTING })

  const evidenceQuotes = preview.structured.fiveAxes.map((axis) => axis.evidence?.quote).filter(Boolean)
  const quoteCounts = evidenceQuotes.reduce((acc, quote) => {
    acc.set(quote, (acc.get(quote) || 0) + 1)
    return acc
  }, new Map())
  const duplicateCount = [...quoteCounts.values()].filter((count) => count > 1).length

  assert.equal(duplicateCount, 0)
  assert.equal(preview.structured.sevenAxes.find((axis) => axis.key === 'responsibility')?.level === 'insufficient_info', false)
  assert.equal(preview.structured.sevenAxes.find((axis) => axis.key === 'learningFeedback')?.level === 'insufficient_info', false)
  assert.equal(preview.structured.sevenAxes.find((axis) => axis.key === 'transferable')?.level === 'insufficient_info', false)
})

test('design contract posting keeps positive design-axis evidence after detail sanitization', async () => {
  const preview = await buildPreview({ jobPostingText: COUPANG_EATS_VISUAL_DESIGN_POSTING })
  const detail = await buildDetailReport({
    analysis: {
      structured: preview.structured,
      freePreview: preview.freePreview,
    },
  })

  const responsibility = detail.detail.sevenAxes.find((axis) => axis.key === 'responsibility')
  const transferable = detail.detail.sevenAxes.find((axis) => axis.key === 'transferable')

  assert.equal(responsibility?.level === 'insufficient_info', false)
  assert.equal(transferable?.level === 'insufficient_info', false)
  assert.equal((responsibility?.evidence?.quote || '').includes('주도적으로 진행'), true)
  assert.equal((transferable?.evidence?.quote || '').includes('Figma'), true)
})

test('design contract posting upgrades measurable difficulty and scope with conservative signals', async () => {
  const preview = await buildPreview({ jobPostingText: COUPANG_EATS_VISUAL_DESIGN_POSTING })
  const detail = await buildDetailReport({
    analysis: {
      structured: preview.structured,
      freePreview: preview.freePreview,
    },
  })

  const previewMeasurable = preview.structured.sevenAxes.find((axis) => axis.key === 'measurable')
  const previewDifficulty = preview.structured.sevenAxes.find((axis) => axis.key === 'difficulty')
  const previewScope = preview.structured.sevenAxes.find((axis) => axis.key === 'scopeClarity')
  const detailMeasurable = detail.detail.sevenAxes.find((axis) => axis.key === 'measurable')
  const detailDifficulty = detail.detail.sevenAxes.find((axis) => axis.key === 'difficulty')
  const detailScope = detail.detail.sevenAxes.find((axis) => axis.key === 'scopeClarity')

  assert.equal(previewMeasurable?.level, 'mixed_signal')
  assert.equal(previewDifficulty?.level, 'positive_with_check')
  assert.equal(previewScope?.level, 'mixed_signal')
  assert.equal(detailMeasurable?.level, 'mixed_signal')
  assert.equal(detailDifficulty?.level, 'positive_with_check')
  assert.equal(detailScope?.level, 'mixed_signal')
  assert.equal((detailMeasurable?.summary || '').includes('품질') || (detailMeasurable?.summary || '').includes('납기'), true)
  assert.equal(
    (detailDifficulty?.evidence?.quote || '').includes('최우선 프로젝트') ||
      (detailDifficulty?.evidence?.quote || '').includes('경험을 정의') ||
      (detailDifficulty?.evidence?.quote || '').includes('솔루션을 제안'),
    true,
  )
  assert.equal(
    (detailScope?.evidence?.quote || '').includes('플랫폼 전체') ||
      (detailScope?.evidence?.quote || '').includes('브랜드 전체') ||
      (detailScope?.evidence?.quote || '').includes('아이콘, 프레젠테이션'),
    true,
  )
})
