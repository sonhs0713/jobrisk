'use client'

import { useState } from 'react'

import { apiFetch } from '../../lib/api'
import styles from './rebuild.module.css'

const INITIAL_PREVIEW = {
  analysisId: '',
  headline: '물경력 위험이 높아 보입니다.',
  topEvidence: '다양한 업무, 운영 전반, 유관 업무 등 구체성이 낮은 표현이 반복됩니다.',
  shortReasons: ['구체적 성과 / 지표 언급 부족', '역할 범위가 모호함', '핵심 업무가 명확하지 않음'],
  verificationQuestion: '운영 전반을 경험한다는 정의가 어디까지인가요?',
}

const PAID_UPGRADE_POINTS = [
  '면접에서 바로 쓸 질문',
  '답변 해석 기준',
  '지원 전 최종 판단 가이드',
]

function normalizePreview(payload) {
  const freePreview = payload?.freePreview || {}
  const headline = freePreview.headline || INITIAL_PREVIEW.headline
  const topEvidenceQuote = freePreview.topEvidence?.quote || INITIAL_PREVIEW.topEvidence
  const topEvidenceInterpretation =
    freePreview.topEvidence?.interpretation && freePreview.topEvidence?.interpretation !== topEvidenceQuote
      ? freePreview.topEvidence.interpretation
      : ''
  const shortReasons =
    Array.isArray(freePreview.shortReasons) && freePreview.shortReasons.length
      ? freePreview.shortReasons.filter(Boolean).slice(0, 3)
      : INITIAL_PREVIEW.shortReasons
  const verificationQuestion = freePreview.verificationQuestion || INITIAL_PREVIEW.verificationQuestion

  return {
    analysisId: String(payload?.analysisId || '').trim(),
    headline,
    topEvidenceQuote,
    topEvidenceInterpretation,
    shortReasons,
    verificationQuestion,
  }
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export default function RebuildFreeAnalysisClient() {
  const [jobText, setJobText] = useState('')
  const [email, setEmail] = useState('')
  const [preview, setPreview] = useState(INITIAL_PREVIEW)
  const [previewJobText, setPreviewJobText] = useState('')
  const [loading, setLoading] = useState(false)
  const [paidLoading, setPaidLoading] = useState(false)
  const [error, setError] = useState('')
  const [upsellError, setUpsellError] = useState('')

  const normalizedEmail = email.trim()
  const emailError =
    !normalizedEmail || isValidEmail(normalizedEmail) ? '' : '올바른 이메일 주소를 입력해 주세요.'
  const canStartPaidAnalysis = Boolean(normalizedEmail) && !emailError && !paidLoading

  async function handleAnalyze() {
    const normalized = jobText.trim()

    if (normalized.length < 40) {
      setError('채용공고를 40자 이상 붙여 넣어 주세요.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await apiFetch('/api/analyze/preview', {
        method: 'POST',
        body: JSON.stringify({ jobPostingText: normalized }),
      })

      setPreview(normalizePreview(response))
      setPreviewJobText(normalized)
      setUpsellError('')
    } catch (requestError) {
      setError(requestError.message || '무료 분석 요청 중 문제가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  async function handlePaidAnalysisStart() {
    const normalizedJobText = jobText.trim()

    if (normalizedJobText.length < 40) {
      setUpsellError('채용공고를 40자 이상 입력해 주세요.')
      return
    }

    if (!normalizedEmail) {
      setUpsellError('상세 리포트를 받을 이메일을 입력해 주세요.')
      return
    }

    if (emailError) {
      setUpsellError(emailError)
      return
    }

    setPaidLoading(true)
    setUpsellError('')

    try {
      let analysisId = preview.analysisId

      if (!analysisId || previewJobText !== normalizedJobText) {
        const response = await apiFetch('/api/analyze/preview', {
          method: 'POST',
          body: JSON.stringify({ jobPostingText: normalizedJobText }),
        })

        const normalizedPreview = normalizePreview(response)
        setPreview(normalizedPreview)
        setPreviewJobText(normalizedJobText)
        analysisId = normalizedPreview.analysisId
      }

      if (!analysisId) {
        throw new Error('분석 결과를 준비하지 못했습니다.')
      }

      const params = new URLSearchParams({
        mode: 'dev',
        analysisId,
        email: normalizedEmail,
      })

      window.location.href = `/checkout?${params.toString()}`
    } catch (requestError) {
      setUpsellError(requestError.message || '유료 분석 준비 중 문제가 발생했습니다.')
      setPaidLoading(false)
    }
  }

  return (
    <div className={styles.freeAnalysisLayout}>
      <div className={styles.freeEntry}>
        <div className={styles.freeEntryCopy}>
          <h2>
            공고를 붙여 넣어
            <br />
            무료로 위험 신호를
            <br />
            확인하세요
          </h2>
        </div>

        <div className={styles.freeInputCard}>
          <div className={styles.freeInputBox}>
            <textarea
              aria-label="채용공고 입력"
              className={styles.freeTextarea}
              maxLength={3000}
              onChange={(event) => setJobText(event.target.value)}
              placeholder="채용 공고 전체를 이곳에 입력하세요"
              value={jobText}
            />
            <span>{jobText.length.toLocaleString('ko-KR')} / 3,000</span>
          </div>

          <button className={styles.freeInputButton} disabled={loading} onClick={handleAnalyze} type="button">
            {loading ? '분석 중입니다...' : '무료 분석 시작하기'}
            <span aria-hidden="true">→</span>
          </button>

          {error ? (
            <p className={styles.freeInputError}>{error}</p>
          ) : (
            <p className={styles.freeInputStatus}>실제 공고를 넣으면 오른쪽 결과가 바로 갱신됩니다.</p>
          )}
        </div>
      </div>

      <div aria-hidden="true" className={styles.freeAnalysisArrow}>
        →
      </div>

      <div className={styles.freePreviewColumn}>
        <div className={styles.freePreviewCard}>
          <div className={styles.freePreviewTop}>
            <strong>무료 분석 미리보기</strong>
            <span>전체 리포트는 유료 서비스에서 확인할 수 있습니다.</span>
          </div>

          <div className={styles.freePreviewVerdict}>
            <h3>{preview.headline}</h3>
          </div>

          <div className={styles.freePreviewGrid}>
            <article className={styles.freePreviewBlock}>
              <strong>가장 강한 근거</strong>
              <p>{preview.topEvidenceQuote || preview.topEvidence}</p>
              {preview.topEvidenceInterpretation ? <span>{preview.topEvidenceInterpretation}</span> : null}
            </article>

            <article className={styles.freePreviewBlock}>
              <strong>짧은 이유</strong>
              <ul className={styles.freeReasonList}>
                {preview.shortReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </article>

            <article className={styles.freePreviewBlock}>
              <strong>확인 질문</strong>
              <div className={styles.freeQuestionMark}>Q.</div>
              <p>{preview.verificationQuestion}</p>
            </article>
          </div>
        </div>

        <div className={styles.freeUpsellCard}>
          <div className={styles.freeUpsellCopy}>
            <span className={styles.freeUpsellEyebrow}>NEXT STEP</span>
            <h3>면접 질문과 답변 해석까지 이어서 확인하세요</h3>
            <p>무료 결과는 위험 신호 확인까지입니다. 유료 분석에서는 실제 지원 판단에 필요한 기준까지 제공합니다.</p>
          </div>

          <ul className={styles.freeUpsellList}>
            {PAID_UPGRADE_POINTS.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>

          <div className={styles.freeUpsellAction}>
            <label className={styles.freeUpsellLabel} htmlFor="paid-analysis-email">
              상세 리포트 확인용 이메일
            </label>
            <input
              className={styles.freeUpsellInput}
              id="paid-analysis-email"
              name="paid-analysis-email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              type="email"
              value={email}
            />
            {emailError ? <p className={styles.freeUpsellError}>{emailError}</p> : null}
            {upsellError && !emailError ? <p className={styles.freeUpsellError}>{upsellError}</p> : null}

            <button
              aria-disabled={!canStartPaidAnalysis}
              className={`${styles.freeUpsellButton} ${!canStartPaidAnalysis ? styles.freeUpsellButtonDisabled : ''}`}
              onClick={handlePaidAnalysisStart}
              type="button"
            >
              {paidLoading ? '유료 분석 준비 중...' : '유료 분석 시작하기'}
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
