# 저장·개인정보 FAQ 검증 요약 (코드 기준, 2026)

## 코드로 확인한 사실

1. **미리보기 API (`/api/preview/analyze`)**  
   - 핸들러는 요청 본문의 `jobPostingText`로 분석 후 JSON을 반환하는 형태이며, **이 저장소의 핸들러만으로는 영구 DB 적재를 전제로 하지 않음**.  
   - 배포 환경에서 별도 로깅·APM·프록시가 본문을 저장하는지는 **인프라 설정에 따름**(여기서는 미확인).

2. **프론트 `sessionStorage`**  
   - 결제 전후 복원용으로 `earlybird_job_posting_text` 등이 **같은 브라우저에 남을 수 있음**(`App.jsx`, 결제 유틸).

3. **결제 완료 후 Formspree(또는 `VITE_FORMSPREE_*`)**  
   - `PaymentComplete.jsx`에서 `jobPostingText`를 폼 데이터에 포함해 전송할 수 있음 → **제3자 서비스 보관 정책 적용**.

4. **문의 폼**  
   - `App.jsx` 문의는 Formspree 엔드포인트로 전송 → **문의 내용은 해당 채널 정책**.

## FAQ 문구 방향

- 「서버에 장기 저장하지 않는다」만 단독으로 쓰기 어렵고, **sessionStorage·결제/문의 전송**을 함께 밝히는 것이 안전함.  
- 현재 FAQ는 `src/components/FAQ.jsx`의 `FAQ_ITEMS` 단일 소스에서 유지보수함.
