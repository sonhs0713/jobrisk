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

function normalizeEndpoint(value) {
  const normalized = String(value || '').trim()
  if (!normalized || normalized === 'undefined' || normalized === 'null') return ''
  return normalized
}

function normalizeEmailAddress(value) {
  return normalizeEndpoint(value)
}

function extractTopEvidenceQuote(analysis) {
  return String(analysis?.freePreview?.topEvidence?.quote || '').trim()
}

function extractTopEvidenceInterpretation(analysis) {
  return String(analysis?.freePreview?.topEvidence?.interpretation || '').trim()
}

function extractShortReasons(analysis) {
  if (!Array.isArray(analysis?.freePreview?.shortReasons)) return ''
  return analysis.freePreview.shortReasons
    .map((reason) => String(reason || '').trim())
    .filter(Boolean)
    .slice(0, 3)
    .join('\n- ')
}

function buildFreePreviewMessage({
  analysisId,
  decisionLabel,
  headline,
  topEvidenceQuote,
  topEvidenceInterpretation,
  shortReasons,
  verificationQuestion,
  jobPostingText,
}) {
  const sections = [
    'JOBRISK 무료 분석 결과',
    `분석 ID: ${analysisId}`,
    `판정: ${decisionLabel || '미분류'}`,
    '',
    '[한 줄 결론]',
    headline || '-',
    '',
    '[가장 강한 근거]',
    topEvidenceQuote || '-',
    topEvidenceInterpretation ? `해석: ${topEvidenceInterpretation}` : '',
    '',
    '[짧은 이유]',
    shortReasons ? `- ${shortReasons}` : '-',
    '',
    '[확인 질문]',
    verificationQuestion || '-',
    '',
    '[채용공고 원문]',
    jobPostingText || '-',
  ]

  return sections.filter((line) => line !== '').join('\n')
}

function buildFreePreviewSubject({ analysisId, decisionLabel }) {
  return `[JobRisk free analysis] ${decisionLabel || '결과 확인'} / ${analysisId}`
}

async function postToResend(apiKey, payload) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    let detail = ''
    try {
      detail = await response.text()
    } catch {
      detail = ''
    }
    throw new Error(`Resend relay failed (${response.status})${detail ? `: ${detail}` : ''}`)
  }

  return response.json()
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
  const endpoint = normalizeEndpoint(process.env.FORMSPREE_FEEDBACK_URL)
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

export async function relayFreePreviewByEmail({ analysisId, analysis = null }) {
  const apiKey = normalizeEndpoint(process.env.RESEND_API_KEY)
  const toEmail = normalizeEmailAddress(process.env.RESEND_FREE_PREVIEW_TO_EMAIL)
  const fromEmail = normalizeEmailAddress(process.env.RESEND_FREE_PREVIEW_FROM_EMAIL) || 'JOBRISK <onboarding@resend.dev>'
  if (!apiKey || !toEmail) {
    return {
      relayed: false,
      skipped: true,
      provider: 'resend',
      reason: !apiKey ? 'missing_resend_api_key' : 'missing_resend_free_preview_to_email',
    }
  }

  const headline = String(analysis?.freePreview?.headline || '').trim()
  const topEvidenceQuote = extractTopEvidenceQuote(analysis)
  const topEvidenceInterpretation = extractTopEvidenceInterpretation(analysis)
  const shortReasons = extractShortReasons(analysis)
  const verificationQuestion = String(analysis?.freePreview?.verificationQuestion || '').trim()
  const jobPostingText = String(analysis?.jobPostingText || '').trim()
  const jobTitle = extractJobTitle(analysis)
  const decisionLabel = String(analysis?.freePreview?.riskLevelLabel || '').trim()
  const message = buildFreePreviewMessage({
    analysisId,
    decisionLabel,
    headline,
    topEvidenceQuote,
    topEvidenceInterpretation,
    shortReasons,
    verificationQuestion,
    jobPostingText,
  })

  const subject = buildFreePreviewSubject({ analysisId, decisionLabel })
  const response = await postToResend(apiKey, {
    from: fromEmail,
    to: [toEmail],
    subject,
    text: message,
    tags: [
      { name: 'source', value: 'jobrisk-free-preview' },
      { name: 'analysis_id', value: String(analysisId || '').trim() || 'unknown' },
    ],
  })

  return {
    relayed: true,
    skipped: false,
    provider: 'resend',
    toEmail,
    emailId: response?.id || null,
    jobTitle,
  }
}

export async function relayPaymentNotificationToFormsfree({ analysisId, orderId, paymentId, customerEmail, paidAt }) {
  const endpoint = normalizeEndpoint(process.env.FORMSPREE_PAYMENT_URL)
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
