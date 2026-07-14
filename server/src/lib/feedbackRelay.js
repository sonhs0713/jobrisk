function normalizeFeedbackLabel(rating) {
  if (rating === 'helpful') return 'helpful'
  if (rating === 'unclear') return 'unclear'
  if (rating === 'wrong') return 'wrong'
  return rating || 'unknown'
}

function extractJobTitle(analysis) {
  return String(
    analysis?.freePreview?.structuredSummary?.jobTitle ||
      analysis?.structured?.jobTitle ||
      analysis?.detail?.jobFamily?.label ||
      '',
  ).trim()
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

export async function relayFeedbackToFormsfree({ analysisId, rating, note, customerEmail = '', analysis = null }) {
  const endpoint = String(process.env.FORMSPREE_FEEDBACK_URL || '').trim()
  if (!endpoint) return { relayed: false, skipped: true }

  const payload = new URLSearchParams({
    analysisId,
    customerEmail: customerEmail || '',
    rating,
    ratingLabel: normalizeFeedbackLabel(rating),
    note: note || '',
    jobTitle: extractJobTitle(analysis),
    previewHeadline: String(analysis?.freePreview?.headline || '').trim(),
    paidSummary: String(analysis?.detail?.finalSummary || '').trim(),
    decisionLabel: String(analysis?.detail?.displayVerdict?.label || analysis?.freePreview?.riskLevelLabel || '').trim(),
    source: 'jobrisk-paid-report',
    submittedAt: new Date().toISOString(),
    subject: `[JobRisk feedback] ${normalizeFeedbackLabel(rating)} / ${analysisId}`,
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
    subject: `[JobRisk payment] ${customerEmail || 'email-missing'} / ${orderId}`,
  })

  await postToFormsfree(endpoint, payload)

  return { relayed: true, skipped: false }
}
