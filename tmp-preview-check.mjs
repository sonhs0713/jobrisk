import { buildPreview } from './server/src/lib/analysis.js'
const text = [
  '운영 매니저 채용',
  '주요업무',
  '- 반복 운영 관리와 요청 처리',
  '- 일일 모니터링 운영',
  '- 데이터 취합 및 결과 보고',
  '자격요건',
  '- 엑셀 활용 능력',
  '우대사항',
  '- 프로세스 개선 경험',
].join('\n')
const result = await buildPreview({ jobPostingText: text })
console.log(JSON.stringify(result.freePreview, null, 2))
