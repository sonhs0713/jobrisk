'use client'

import { useState } from 'react'
import { apiFetch } from '../../../lib/api'

const feedbackOptions = [
  { value: 'helpful', label: '도움이 됐어요' },
  { value: 'unclear', label: '조금 애매해요' },
  { value: 'wrong', label: '해석이 어긋났어요' },
]

export default function ReportFeedback({ analysisId }) {
  const [feedback, setFeedback] = useState({ rating: 'helpful', note: '' })
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  async function submitFeedback() {
    setStatus('')
    setError('')
    try {
      await apiFetch('/api/feedback', {
        method: 'POST',
        body: JSON.stringify({ analysisId, ...feedback }),
      })
      setStatus('피드백을 보냈습니다.')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <section className="report-section report-feedback" aria-labelledby="feedback-heading">
      <div>
        <h2 id="feedback-heading">이 분석이 도움이 되었나요?</h2>
        <p>부족했던 점을 남겨주시면 다음 분석 품질을 개선하는 데 반영하겠습니다.</p>
      </div>

      <div className="feedback-choice-group" role="group" aria-label="피드백 평가">
        {feedbackOptions.map((option) => (
          <button
            className={feedback.rating === option.value ? 'feedback-choice active' : 'feedback-choice'}
            key={option.value}
            type="button"
            aria-pressed={feedback.rating === option.value}
            onClick={() => setFeedback({ ...feedback, rating: option.value })}
          >
            {option.label}
          </button>
        ))}
      </div>

      <label className="field-label" htmlFor="report-feedback-note">
        추가로 남길 내용
      </label>
      <textarea
        id="report-feedback-note"
        className="feedback-note"
        value={feedback.note}
        onChange={(event) => setFeedback({ ...feedback, note: event.target.value })}
        placeholder="예: 책임 범위 해석이 조금 더 구체적이면 좋겠습니다."
      />
      <button className="button-primary feedback-submit" type="button" onClick={submitFeedback}>
        피드백 보내기
      </button>
      {status ? <p className="status-text">{status}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
    </section>
  )
}
