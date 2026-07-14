'use client'

import { useState } from 'react'

import { apiFetch } from '../../../lib/api'

const feedbackOptions = [
  { value: 'helpful', label: '네, 판단에 도움이 됐어요' },
  { value: 'unclear', label: '일부는 도움됐지만 아직 애매해요' },
  { value: 'wrong', label: '기대보다 근거나 해석이 부족했어요' },
]

export default function ReportFeedbackCard({ analysisId, reportAccessToken }) {
  const [feedback, setFeedback] = useState({ rating: 'helpful', note: '' })
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  async function submitFeedback() {
    if (isSubmitting || isSubmitted) return

    setIsSubmitting(true)
    setStatus('')
    setError('')

    try {
      await apiFetch('/api/feedback', {
        method: 'POST',
        body: JSON.stringify({
          analysisId,
          reportAccessToken,
          rating: feedback.rating,
          note: feedback.note.trim(),
        }),
      })

      setStatus('의견이 저장되었습니다. 다음 리포트 개선에 반영하겠습니다.')
      setIsSubmitted(true)
    } catch (err) {
      setError(err.message || '의견 저장 중 문제가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="report-rebuild-feedback-inline report-rebuild-panel" aria-labelledby="report-feedback-card-heading">
      <div className="report-rebuild-feedback-inline-head">
        <span className="report-rebuild-card-label">PAID REPORT FEEDBACK</span>
        <div>
          <h3 id="report-feedback-card-heading">이 분석이 지원 판단에 도움이 되었나요?</h3>
        </div>
      </div>

      <div className="feedback-choice-group report-rebuild-feedback-inline-choices" role="group" aria-label="유료 분석 피드백">
        {feedbackOptions.map((option) => (
          <button
            key={option.value}
            className={feedback.rating === option.value ? 'feedback-choice active' : 'feedback-choice'}
            type="button"
            aria-pressed={feedback.rating === option.value}
            onClick={() => setFeedback((current) => ({ ...current, rating: option.value }))}
            disabled={isSubmitting || isSubmitted}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="report-rebuild-feedback-inline-form">
        <label className="field-label" htmlFor="report-feedback-note">
          어떤 부분이 가장 도움됐거나 아쉬웠나요?
        </label>
        <textarea
          id="report-feedback-note"
          className="feedback-note"
          value={feedback.note}
          onChange={(event) => setFeedback((current) => ({ ...current, note: event.target.value }))}
          placeholder="예: 면접 질문은 좋았지만, 최종 행동 가이드는 조금 더 구체적이면 좋겠습니다."
          disabled={isSubmitting || isSubmitted}
        />
      </div>

      <div className="report-rebuild-feedback-inline-actions">
        <button className="feedback-submit report-rebuild-feedback-inline-submit" type="button" onClick={submitFeedback} disabled={isSubmitting || isSubmitted}>
          {isSubmitted ? '의견 반영 완료' : isSubmitting ? '의견 저장 중...' : '의견 보내기'}
        </button>
        {status ? <p className="status-text">{status}</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
      </div>
    </section>
  )
}
