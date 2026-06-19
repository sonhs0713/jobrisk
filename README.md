# JobRisk v1

잡리스크 v1은 채용공고가 물경력으로 이어질 가능성이 있는지 분석하고, 결제 후 면접 확인 질문과 답변 해석 가이드를 제공하는 MVP입니다.

## 구조

- `web`: Next.js 프론트엔드. Vercel 배포 대상입니다.
- `server`: Heroku용 Node API 서버. OpenAI, MongoDB, PortOne 결제 검증은 여기서 처리합니다.

## 로컬 실행

```powershell
npm.cmd install
Copy-Item .env.example .env
npm.cmd run dev:api
npm.cmd run dev
```

## 핵심 흐름

1. 사용자가 채용공고를 입력합니다.
2. `POST /api/analyze/preview`가 무료 미리보기를 생성하고 `analysisId`를 저장합니다.
3. 사용자가 PortOne + NHN KCP로 결제합니다.
4. `POST /api/payments/verify`가 PortOne API로 결제 상태, 주문 ID, 금액을 검증합니다.
5. `GET /api/analyze/:analysisId/detail`이 유료 상세 리포트를 반환합니다.
6. `POST /api/feedback`이 결과 만족도와 오류 피드백을 저장합니다.

## 분석 원칙

- 물경력 가능성 하나에 집중합니다.
- 공고에 없는 사실은 단정하지 않습니다.
- 회사 평판, 야근, 조직문화, 블랙기업 판정은 v1에서 제외합니다.
- 모든 판단은 공고 원문 근거 문장과 연결합니다.
