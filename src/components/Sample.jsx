function Sample() {
  return (
    <section className="sample-section">
      <h2 className="sample-title">채용공고의 행간을 이렇게 읽어드립니다</h2>

      <div className="sample-compare-grid">
        <article className="sample-box sample-before">
          <p className="sample-box-label">채용공고 원문</p>
          <h3 className="sample-before-title">[글로벌 뷰티 브랜드] 마케팅 담당자 채용</h3>
          <p className="sample-before-text">
            We are hiring.
            <br />
            <br />
            저희는 빠르게 성장 중인 뷰티 스타트업입니다.
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
            <p className="sample-before-heading">자격요건</p>
            <ul className="sample-before-list">
              <li>· 경력 2년 이상</li>
              <li>· SNS 채널 운영 경험 보유</li>
            </ul>
          </div>

          <div className="sample-before-group">
            <p className="sample-before-heading">우대사항</p>
            <ul className="sample-before-list">
              <li>· 뷰티/패션 업종 경험자</li>
              <li>· 포토샵, 프리미어 활용 가능자</li>
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
          <p className="sample-box-label">AI 분석 결과</p>

          <p className="sample-line">
            <span className="sample-key">물경력 위험도</span>
            <span className="sample-risk">⚠️ 높음</span>
          </p>

          <div className="sample-line">
            <span className="sample-key">위험 신호</span>
            <ul className="sample-list">
              <li>· SNS·콘텐츠·광고·데이터 동시 담당 → 전문성 없이 잡일 가능성</li>
              <li>· 작은 팀 + 오너십 강조 → 혼자 다 해야 하는 구조</li>
              <li>· 연봉 협의 → 정보 비대칭 상태에서 협상 불리</li>
            </ul>
          </div>

          <p className="sample-line">
            <span className="sample-key">적정 연봉</span>
            <span className="sample-value">경력 3년 기준 3,800~4,200만원 예상</span>
          </p>

          <p className="sample-line">
            <span className="sample-key">커리어 패스 전망</span>
            <span className="sample-value">
              마케터 → 퍼포먼스 마케터 성장 가능성 낮음.
              <br />
              직무 범위가 넓어 전문성 축적이 어렵습니다.
              <br />
              3년 후 이직 시 &apos;무엇을 잘하는 사람&apos;으로
              <br />
              포지셔닝하기 어려울 수 있습니다
            </span>
          </p>

          <div className="sample-line">
            <span className="sample-key">면접 필수 질문</span>
            <ul className="sample-list">
              <li>· 이 포지션 전임자는 왜 퇴사했나요?</li>
              <li>· 팀 규모와 각자 담당 업무가 어떻게 되나요?</li>
            </ul>
          </div>
        </article>
      </div>
    </section>
  )
}

export default Sample
