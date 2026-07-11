function normalizeFeedbackLabel(rating) {
  if (rating === 'helpful') return '도움이 됐어요'
  if (rating === 'unclear') return '조금 애매해요'
  if (rating === 'wrong') return '해석이 어긋났어요'
  return rating || '미분류'
}

function stringifyPayload(value) {
  if (!value) return ''

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

async function postToFormsfree(endpoint, payload) {
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
}

export async function relayFeedbackToFormsfree({ analysisId, rating, note, analysis = null }) {
  const endpoint = String(process.env.FORMSPREE_FEEDBACK_URL || '').trim()
  if (!endpoint) return { relayed: false, skipped: true }

  const payload = new URLSearchParams({
    analysisId,
    rating,
    ratingLabel: normalizeFeedbackLabel(rating),
    note: note || '',
    jobPostingText: String(analysis?.jobPostingText || '').trim(),
    freePreview: stringifyPayload(analysis?.freePreview || null),
    paidDetail: stringifyPayload(analysis?.detail || null),
    source: 'jobrisk-paid-report',
    submittedAt: new Date().toISOString(),
    subject: `[JobRisk 피드백] ${normalizeFeedbackLabel(rating)} / ${analysisId}`,
  })

  await postToFormsfree(endpoint, payload)

  return { relayed: true, skipped: false }
}

export async function relayPaymentNotificationToFormsfree({ analysisId, orderId, paymentId, customerEmail, paidAt }) {
  const endpoint = String(process.env.FORMSPREE_PAYMENT_URL || '').trim()
  if (!endpoint) return { relayed: false, skipped: true }

  const payload = new URLSearchParams({
    analysisId,
    orderId,
    paymentId,
    customerEmail: customerEmail || '',
    paidAt: paidAt || new Date().toISOString(),
    source: 'jobrisk-payment',
    subject: `[JobRisk 결제 완료] ${customerEmail || '이메일 미확인'} / ${orderId}`,
  })

  await postToFormsfree(endpoint, payload)

  return { relayed: true, skipped: false }
}
