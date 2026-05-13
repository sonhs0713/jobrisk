function Sample() {
  return (
    <section className="sample-section">
      <h2 className="sample-title">무료 미리보기와 유료 상세가 이렇게 나뉩니다</h2>

      <div className="sample-compare-grid">
        <article className="sample-box sample-before">
          <p className="sample-box-label">채용공고 원문(일부)</p>
          <h3 className="sample-before-title">[글로벌 뷰티 브랜드] 마케팅 담당자 채용</h3>
          <p className="sample-before-text">
            빠르게 성장 중인 뷰티 스타트업입니다.
            <br />
            인스타그램 팔로워 10만을 보유한 브랜드로,
            <br />
            더 큰 도약을 함께할 마케터를 찾습니다.
          </p>

          <div className="sample-before-group">
            <p className="sample-before-heading">주요업무</p>
            <ul className="sample-before-list">
              <li>· SNS 채널 운영 및 콘텐츠 제작 (인스타그램, 틱톡)</li>
              <li>· 디지털 광고 집행 및 성과 분석 (메타, 구글)</li>
              <li>· 인플루언서 섭외 및 협업 관리</li>
              <li>· 데이터 기반 마케팅 전략 수립</li>
            </ul>
          </div>

          <div className="sample-before-group">
            <p className="sample-before-heading">혜택</p>
            <ul className="sample-before-list">
              <li>· 자율 출퇴근</li>
              <li>· 연봉 협의</li>
              <li>· 소규모 팀에서 오너십 발휘 가능</li>
            </ul>
          </div>
        </article>

        <article className="sample-box sample-after">
          <p className="sample-box-label">무료 미리보기(감지)</p>

          <p className="sample-line">
            <span className="sample-key">한 줄</span>
            <span className="sample-value">추가 확인이 필요해 보여요 — 채널·광고·협업이 한 번에 묶여 있어요</span>
          </p>

          <div className="sample-line">
            <span className="sample-key">핵심 근거 1개</span>
            <ul className="sample-list">
              <li>
                <em>“SNS 채널 운영 및 콘텐츠 제작”</em> → 집행·운영 비중이 큰지, 전략·지표 소유가 있는지 면접에서 확인할 가치가
                있어요.
              </li>
            </ul>
          </div>

          <p className="sample-line">
            <span className="sample-key">짧은 이유</span>
            <ul className="sample-list">
              <li>· 역할 묶음이 넓어 우선순위 확인이 필요</li>
              <li>· 성과 지표 문장이 약하면 평가 방식 확인</li>
            </ul>
          </p>

          <p className="sample-line">
            <span className="sample-key">확인 질문 1개</span>
            <span className="sample-value">캠페인에서 전략·실험·지표 개선 중 무엇을 직접 결정하나요?</span>
          </p>

          <p className="sample-box-label sample-box-label-follow">유료 상세(검증) 예시</p>

          <p className="sample-line">
            <span className="sample-key">직무군 · 5개 축</span>
            <span className="sample-value">마케팅·브랜딩 기준으로 다섯 축을 풀어 정리합니다.</span>
          </p>

          <div className="sample-line">
            <span className="sample-key">근거 · 면접</span>
            <ul className="sample-list">
              <li>· 공고 원문 3~5개를 골라 근거로 묶습니다</li>
              <li>· 면접 질문 5~7개와 괜찮은 답 / 확인 필요 답변 가이드를 붙입니다</li>
            </ul>
          </div>
        </article>
      </div>
    </section>
  )
}

export default Sample
