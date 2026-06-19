function normalizeFeedbackLabel(rating) {
  if (rating === 'helpful') return '도움이 됐어요'
  if (rating === 'unclear') return '조금 애매해요'
  if (rating === 'wrong') return '해석이 어긋났어요'
  return rating || '미분류'
}

export async function relayFeedbackToFormsfree({ analysisId, rating, note }) {
  const endpoint = String(process.env.FORMSFREE_FEEDBACK_URL || '').trim()
  if (!endpoint) return { relayed: false, skipped: true }

  const payload = new URLSearchParams({
    analysisId,
    rating,
    ratingLabel: normalizeFeedbackLabel(rating),
    note: note || '',
    source: 'jobrisk-paid-report',
    submittedAt: new Date().toISOString(),
    subject: `[JobRisk 피드백] ${normalizeFeedbackLabel(rating)}`,
  })

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: payload.toString(),
  })

  if (!response.ok) {
    throw new Error(`Formsfree relay failed (${response.status})`)
  }

  return { relayed: true, skipped: false }
}
