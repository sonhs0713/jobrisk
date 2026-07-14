import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { buildDetailReport, buildPreview, DETAIL_SCHEMA_VERSION } from './lib/analysis.js'
import { relayFeedbackToFormsfree, relayPaymentNotificationToFormsfree } from './lib/feedbackRelay.js'
import {
  createOrder,
  getAnalysis,
  getLatestOrderByAnalysisId,
  getOrder,
  hasCurrentDetailBundle,
  markDetailGenerating,
  markDetailFailed,
  markPaidReady,
  saveAnalysis,
  saveFeedback,
  saveGeneratedDetail,
} from './lib/store.js'
import { verifyPortOnePayment } from './lib/portone.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const timingLogPath = path.resolve(__dirname, '../../jobrisk-timing.log')
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

export const app = express()
const port = Number(process.env.PORT || 4000)
const productAmount = Number(process.env.JOBRISK_PRODUCT_AMOUNT || 3000)
const enableConditionalPreviewOverride =
  String(process.env.JOBRISK_ENABLE_CONDITIONAL_PREVIEW_OVERRIDE || '').toLowerCase().trim() === 'true'

app.use(cors())
app.use(express.json({ limit: '1mb' }))

const activeDetailGenerations = new Set()

async function appendTimingLog(event, payload) {
  try {
    const line = JSON.stringify({
      loggedAt: new Date().toISOString(),
      event,
      ...payload,
    })
    await fs.appendFile(timingLogPath, `${line}\n`, 'utf8')
  } catch (error) {
    console.error('[jobrisk][timing-log] append failed', error?.message || String(error))
  }
}

function buildOpenAiTimingFields(result) {
  const usage = result?.openAiUsage || {}
  return {
    inputTokens: usage.inputTokens ?? null,
    outputTokens: usage.outputTokens ?? null,
    totalTokens: usage.totalTokens ?? null,
    outputChars: result?.openAiOutputChars ?? null,
    openAiErrorStage: result?.openAiErrorStage ?? null,
  }
}

function getDetailStatus(analysis) {
  if (analysis?.detailStatus) return analysis.detailStatus
  if (analysis?.detail) return 'ready'
  return 'idle'
}

function hasStoredDetail(analysis) {
  return Boolean(analysis?.detail)
}

function isDetailStale(analysis) {
  return hasStoredDetail(analysis) && !hasCurrentDetailBundle(analysis)
}

function buildDetailMeta(analysis, overrides = {}) {
  const detailStale = overrides.detailStale ?? isDetailStale(analysis)
  return {
    detailStatus: overrides.detailStatus ?? getDetailStatus(analysis),
    detailStale,
    detailVersion: analysis?.detailVersion || null,
    detailEngine: analysis?.detailEngine || (analysis?.detail ? 'stored_detail' : null),
  }
}

async function scheduleDetailRebuildIfNeeded({ analysisId, analysis }) {
  if (!analysis?.paid) {
    return { scheduled: false, ...buildDetailMeta(analysis, { detailStale: false }) }
  }

  if (hasCurrentDetailBundle(analysis)) {
    return { scheduled: false, ...buildDetailMeta(analysis, { detailStatus: 'ready', detailStale: false }) }
  }

  const detailStatus = getDetailStatus(analysis)
  const detailStale = isDetailStale(analysis)
  if (detailStatus === 'generating') {
    setTimeout(() => {
      void startDetailGeneration({ analysisId })
    }, 0)
    return { scheduled: false, ...buildDetailMeta(analysis, { detailStatus, detailStale }) }
  }

  await markDetailGenerating({ analysisId })
  setTimeout(() => {
    void startDetailGeneration({ analysisId })
  }, 0)

  return { scheduled: true, ...buildDetailMeta(analysis, { detailStatus: 'generating', detailStale }) }
}

function isDbUnavailableError(error) {
  return error?.code === 'DB_UNAVAILABLE' || error?.message === 'db_unavailable'
}

function getPublicErrorMessage(error, fallbackMessage) {
  if (isDbUnavailableError(error)) {
    return 'DB 연결 문제로 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'
  }
  return error?.message || fallbackMessage
}

function getStatusCodeForError(error, fallbackStatus = 500) {
  if (isDbUnavailableError(error)) return 503
  return fallbackStatus
}

function isValidEmail(value) {
  const normalized = String(value || '').trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
}

async function notifyPaymentCompleted({ analysisId, orderId, paymentId, customerEmail, paidAt }) {
  try {
    await relayPaymentNotificationToFormsfree({
      analysisId,
      orderId,
      paymentId,
      customerEmail,
      paidAt,
    })
  } catch (error) {
    console.error('[jobrisk][payments/notify] failed', {
      analysisId,
      orderId,
      paymentId,
      message: error?.message || String(error),
    })
  }
}

async function startDetailGeneration({ analysisId }) {
  if (activeDetailGenerations.has(analysisId)) return
  activeDetailGenerations.add(analysisId)

  const startedAt = Date.now()
  let detailBuildDurationMs = 0
  let saveDurationMs = 0

  try {
    const analysis = await getAnalysis(analysisId)
    if (!analysis || !analysis.paid) return
    if (getDetailStatus(analysis) === 'ready' && hasCurrentDetailBundle(analysis)) return

    const detailBuildStartedAt = Date.now()
    const builtDetail = await buildDetailReport({ analysis })
    detailBuildDurationMs = Date.now() - detailBuildStartedAt

    const saveStartedAt = Date.now()
    await saveGeneratedDetail({
      analysisId,
      detail: builtDetail.detail,
      decisionReport: builtDetail.decisionReport || null,
      detailEngine: builtDetail.engine,
      detailVersion: builtDetail.detailVersion || DETAIL_SCHEMA_VERSION,
      detailErrorStage: builtDetail.openAiErrorStage ?? null,
    })
    saveDurationMs = Date.now() - saveStartedAt

    const generationLogPayload = {
      analysisId,
      detailBuildDurationMs,
      saveDurationMs,
      totalDurationMs: Date.now() - startedAt,
      detailStatus: 'ready',
      detailEngine: builtDetail.engine,
      ...buildOpenAiTimingFields(builtDetail),
    }
    console.info('[jobrisk][detail/generate]', generationLogPayload)
    await appendTimingLog('detail/generate', generationLogPayload)
  } catch (error) {
    const detailErrorStage = error?.stage || 'detail_generation_failed'
    await markDetailFailed({ analysisId, detailErrorStage })
    const generationErrorLogPayload = {
      analysisId,
      detailBuildDurationMs,
      saveDurationMs,
      totalDurationMs: Date.now() - startedAt,
      detailStatus: 'failed',
      detailEngine: null,
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      outputChars: null,
      openAiErrorStage: detailErrorStage,
    }
    console.error('[jobrisk][detail/generate] failed', {
      analysisId,
      detailErrorStage,
      message: error?.message || String(error),
    })
    await appendTimingLog('detail/generate', generationErrorLogPayload)
  } finally {
    activeDetailGenerations.delete(analysisId)
  }
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'jobrisk-server' })
})

app.post('/api/analyze/preview', async (req, res) => {
  try {
    const requestStartedAt = Date.now()
    const jobPostingText = String(req.body?.jobPostingText || '').trim()
    if (jobPostingText.length < 40) {
      res.status(400).json({ ok: false, message: '채용공고 원문을 40자 이상 입력해 주세요.' })
      return
    }

    const previewBuildStartedAt = Date.now()
    const previewResult = await buildPreview(
      { jobPostingText },
      { conditionalLlmRiskOverride: enableConditionalPreviewOverride },
    )
    const previewBuildDurationMs = Date.now() - previewBuildStartedAt
    const saveStartedAt = Date.now()
    const analysis = await saveAnalysis({
      jobPostingText,
      structured: previewResult.structured,
      freePreview: previewResult.freePreview,
      detail: null,
      paid: false,
      engine: previewResult.engine,
    })
    const saveDurationMs = Date.now() - saveStartedAt
    const totalDurationMs = Date.now() - requestStartedAt
    const previewLogPayload = {
      analysisId: analysis.analysisId,
      previewBuildDurationMs,
      saveDurationMs,
      totalDurationMs,
      engine: previewResult.engine,
      jobPostingChars: jobPostingText.length,
      ...buildOpenAiTimingFields(previewResult),
    }
    console.info('[jobrisk][analyze/preview]', previewLogPayload)
    await appendTimingLog('analyze/preview', previewLogPayload)

    res.json({
      ok: true,
      analysisId: analysis.analysisId,
      freePreview: previewResult.freePreview,
      engine: previewResult.engine,
      price: { amount: productAmount, currency: 'KRW' },
    })
  } catch (error) {
    res.status(getStatusCodeForError(error, 500)).json({ ok: false, message: getPublicErrorMessage(error, '무료 분석 중 오류가 발생했습니다.') })
  }
})

app.post('/api/payments/prepare', async (req, res) => {
  try {
    const analysisId = String(req.body?.analysisId || '').trim()
    const customerEmail = String(req.body?.customerEmail || '').trim()
    if (!analysisId) {
      res.status(400).json({ ok: false, message: 'analysisId가 필요합니다.' })
      return
    }
    if (!customerEmail) {
      res.status(400).json({ ok: false, message: '이메일 주소를 입력해 주세요.' })
      return
    }
    if (!isValidEmail(customerEmail)) {
      res.status(400).json({ ok: false, message: '올바른 이메일 주소를 입력해 주세요.' })
      return
    }

    const analysis = await getAnalysis(analysisId)
    if (!analysis) {
      res.status(404).json({ ok: false, message: '분석 결과를 찾을 수 없습니다.' })
      return
    }

    const order = await createOrder({
      analysisId,
      amount: productAmount,
      customerEmail,
    })

    res.json({
      ok: true,
      orderId: order.orderId,
      analysisId,
      amount: productAmount,
      currency: 'KRW',
      orderName: 'JOBRISK 물경력 가능성 상세 분석',
    })
  } catch (error) {
    res.status(getStatusCodeForError(error, 500)).json({ ok: false, message: getPublicErrorMessage(error, '결제 준비 중 오류가 발생했습니다.') })
  }
})

app.post('/api/payments/verify', async (req, res) => {
  try {
    const requestStartedAt = Date.now()
    const paymentId = String(req.body?.paymentId || '').trim()
    const analysisId = String(req.body?.analysisId || '').trim()
    const orderId = String(req.body?.orderId || '').trim()
    if (!paymentId || !analysisId || !orderId) {
      res.status(400).json({ ok: false, message: 'paymentId, analysisId, orderId가 필요합니다.' })
      return
    }

    const analysis = await getAnalysis(analysisId)
    if (!analysis) {
      res.status(404).json({ ok: false, message: '분석 결과를 찾을 수 없습니다.' })
      return
    }

    const order = await getOrder(orderId)
    if (!order) {
      const paymentVerifyStartedAt = Date.now()
      const verified = await verifyPortOnePayment({ paymentId, orderId, expectedAmount: productAmount })
      const paymentVerifyDurationMs = Date.now() - paymentVerifyStartedAt

      const saveStartedAt = Date.now()
      const paid = await markPaidReady({
        analysisId,
        orderId,
        paymentId,
        amount: productAmount,
        transactionId: verified.transactionId,
      })
      const saveDurationMs = Date.now() - saveStartedAt
      const totalDurationMs = Date.now() - requestStartedAt
      const refreshedAnalysis = await getAnalysis(analysisId)
      const rebuild = await scheduleDetailRebuildIfNeeded({ analysisId, analysis: refreshedAnalysis })
      const detailStatus = rebuild.detailStatus || paid.detailStatus || getDetailStatus(refreshedAnalysis)
      const detailStale = rebuild.detailStale ?? paid.detailStale ?? isDetailStale(refreshedAnalysis)
      const detailEngine = refreshedAnalysis?.detailEngine || (refreshedAnalysis?.detail ? 'stored_detail' : null)

      const recoveredPaymentLogPayload = {
        analysisId,
        orderId,
        paymentId,
        paymentVerifyDurationMs,
        detailBuildDurationMs: 0,
        saveDurationMs,
        totalDurationMs,
        reusedStoredDetail: Boolean(refreshedAnalysis?.detail),
        detailStatus,
        detailEngine,
        recoveredMissingOrder: true,
        detailStale,
        ...buildOpenAiTimingFields({ openAiErrorStage: refreshedAnalysis?.detailErrorStage || null }),
      }
      console.warn('[jobrisk][payments/verify] recovered missing order', recoveredPaymentLogPayload)
      await appendTimingLog('payments/verify', recoveredPaymentLogPayload)
      await notifyPaymentCompleted({
        analysisId,
        orderId,
        paymentId,
        customerEmail: '',
        paidAt: new Date().toISOString(),
      })

      res.json({
        ok: true,
        isPaid: true,
        analysisId,
        paymentId,
        reportAccessToken: paid.reportAccessToken,
        detailEngine,
        detailStatus,
        detailStale,
        detailVersion: refreshedAnalysis?.detailVersion || null,
      })
      return
    }
    if (order.analysisId !== analysisId) {
      res.status(400).json({ ok: false, isPaid: false, message: '주문과 분석 결과가 일치하지 않습니다.' })
      return
    }

    if (order.status === 'PAID' && analysis.paid && analysis.reportAccessToken) {
      const rebuild = await scheduleDetailRebuildIfNeeded({ analysisId, analysis })
      const detailStatus = rebuild.detailStatus || getDetailStatus(analysis)
      const detailStale = rebuild.detailStale ?? isDetailStale(analysis)
      const detailEngine = analysis.detailEngine || (analysis.detail ? 'stored_detail' : null)
      const reusedPaidLogPayload = {
        analysisId,
        orderId,
        paymentId: order.paymentId || paymentId,
        paymentVerifyDurationMs: 0,
        detailBuildDurationMs: 0,
        saveDurationMs: 0,
        totalDurationMs: Date.now() - requestStartedAt,
        reusedStoredDetail: true,
        detailStatus,
        detailEngine,
        detailStale,
        ...buildOpenAiTimingFields({ openAiErrorStage: analysis.detailErrorStage || null }),
      }
      console.info('[jobrisk][payments/verify]', reusedPaidLogPayload)
      await appendTimingLog('payments/verify', reusedPaidLogPayload)
      res.json({
        ok: true,
        isPaid: true,
        analysisId,
        paymentId: order.paymentId || paymentId,
        reportAccessToken: analysis.reportAccessToken,
        detailEngine,
        detailStatus,
        detailStale,
        detailVersion: analysis.detailVersion || null,
      })
      return
    }

    const paymentVerifyStartedAt = Date.now()
    const verified = await verifyPortOnePayment({ paymentId, orderId, expectedAmount: order.amount })
    const paymentVerifyDurationMs = Date.now() - paymentVerifyStartedAt

    const saveStartedAt = Date.now()
    const paid = await markPaidReady({
      analysisId,
      orderId,
      paymentId,
      amount: order.amount,
      transactionId: verified.transactionId,
    })
    const saveDurationMs = Date.now() - saveStartedAt
    const totalDurationMs = Date.now() - requestStartedAt
    const refreshedAnalysis = await getAnalysis(analysisId)
    const rebuild = await scheduleDetailRebuildIfNeeded({ analysisId, analysis: refreshedAnalysis })
    const detailStatus = rebuild.detailStatus || paid.detailStatus || getDetailStatus(refreshedAnalysis)
    const detailStale = rebuild.detailStale ?? paid.detailStale ?? isDetailStale(refreshedAnalysis)
    const detailEngine = refreshedAnalysis?.detailEngine || (refreshedAnalysis?.detail ? 'stored_detail' : null)

    const paymentLogPayload = {
      analysisId,
      orderId,
      paymentId,
      paymentVerifyDurationMs,
      detailBuildDurationMs: 0,
      saveDurationMs,
      totalDurationMs,
      reusedStoredDetail: Boolean(refreshedAnalysis?.detail),
      detailStatus,
      detailEngine,
      detailStale,
      ...buildOpenAiTimingFields({ openAiErrorStage: refreshedAnalysis?.detailErrorStage || null }),
    }
    console.info('[jobrisk][payments/verify]', paymentLogPayload)
    await appendTimingLog('payments/verify', paymentLogPayload)
    await notifyPaymentCompleted({
      analysisId,
      orderId,
      paymentId,
      customerEmail: order.customerEmail || '',
      paidAt: new Date().toISOString(),
    })

    res.json({
      ok: true,
      isPaid: true,
      analysisId,
      paymentId,
      reportAccessToken: paid.reportAccessToken,
      detailEngine,
      detailStatus,
      detailStale,
      detailVersion: refreshedAnalysis?.detailVersion || null,
    })
  } catch (error) {
    res
      .status(getStatusCodeForError(error, 400))
      .json({ ok: false, isPaid: false, message: getPublicErrorMessage(error, '결제 검증에 실패했습니다.') })
  }
})

app.get('/api/analyze/:analysisId/detail-status', async (req, res) => {
  try {
    const analysis = await getAnalysis(String(req.params.analysisId || ''))
    if (!analysis) {
      res.status(404).json({ ok: false, message: '遺꾩꽍 寃곌낵瑜?李얠쓣 ???놁뒿?덈떎.' })
      return
    }
    if (!analysis.paid) {
      res.status(403).json({ ok: false, message: '寃곗젣 寃利??꾩뿉留??곸꽭 由ы룷?몃? 蹂????덉뒿?덈떎.' })
      return
    }

    const reportAccessToken = String(req.query?.token || req.get('x-report-access-token') || '').trim()
    if (!analysis.reportAccessToken || reportAccessToken !== analysis.reportAccessToken) {
      res.status(403).json({ ok: false, message: '?좊즺 由ы룷???묎렐 沅뚰븳???뺤씤?????놁뒿?덈떎.' })
      return
    }

    const rebuild = await scheduleDetailRebuildIfNeeded({ analysisId: analysis.analysisId, analysis })

    res.json({
      ok: true,
      analysisId: analysis.analysisId,
      detailStatus: rebuild.detailStatus || getDetailStatus(analysis),
      detailStale: rebuild.detailStale ?? isDetailStale(analysis),
      detailVersion: analysis.detailVersion || null,
      detailEngine: analysis.detailEngine || null,
      detailErrorStage: analysis.detailErrorStage || null,
    })
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message || '?곸꽭 由ы룷???곹깭 議고쉶 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.' })
  }
})

app.get('/api/analyze/:analysisId/detail', async (req, res) => {
  try {
    const analysis = await getAnalysis(String(req.params.analysisId || ''))
    if (!analysis) {
      res.status(404).json({ ok: false, message: '분석 결과를 찾을 수 없습니다.' })
      return
    }
    if (!analysis.paid) {
      res.status(403).json({ ok: false, message: '결제 검증 후에만 상세 리포트를 볼 수 있습니다.' })
      return
    }

    const reportAccessToken = String(req.query?.token || req.get('x-report-access-token') || '').trim()
    if (!analysis.reportAccessToken || reportAccessToken !== analysis.reportAccessToken) {
      res.status(403).json({ ok: false, message: '유료 리포트 접근 권한을 확인할 수 없습니다.' })
      return
    }

    const rebuild = await scheduleDetailRebuildIfNeeded({ analysisId: analysis.analysisId, analysis })
    const detailStatus = rebuild.detailStatus || getDetailStatus(analysis)
    const detailStale = rebuild.detailStale ?? isDetailStale(analysis)
    if (detailStatus === 'generating' && !analysis.detail) {
      res.status(409).json({ ok: false, detailStatus, message: '?곸꽭 由ы룷?몃? ?앹꽦?섍퀬 ?덉뒿?덈떎. ?좎떆留? ??寃곌낵瑜??뺤씤?댁＜?몄슂.' })
      return
    }
    if (detailStatus === 'failed' && !analysis.detail) {
      res.status(409).json({
        ok: false,
        detailStatus,
        detailErrorStage: analysis.detailErrorStage || null,
        message: '?곸꽭 由ы룷???앹꽦?쇰뒗???놁뒿?덈떎. ?ㅼ떆 ?쒕룄?댁＜?몄슂.',
      })
      return
    }
    if (!analysis.detail) {
      res.status(409).json({ ok: false, detailStatus, message: '?곸꽭 由ы룷媛 ?꾩쭅 以鍮꾨릺吏 ?딆븯?듬땲??' })
      return
    }

    res.json({
      ok: true,
      detail: analysis.detail,
      decisionReport: analysis.decisionReport || null,
      detailEngine: analysis.detailEngine || 'stored_detail',
      detailStatus,
      detailStale,
      detailVersion: analysis.detailVersion || null,
    })
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message || '상세 리포트 조회 중 오류가 발생했습니다.' })
  }
})

app.post('/api/feedback', async (req, res) => {
  try {
    const analysisId = String(req.body?.analysisId || '').trim()
    const reportAccessToken = String(req.body?.reportAccessToken || req.get('x-report-access-token') || '').trim()
    const rating = String(req.body?.rating || '').trim()
    if (!reportAccessToken) {
      res.status(400).json({ ok: false, message: 'reportAccessToken이 필요합니다.' })
      return
    }
    if (!analysisId || !rating) {
      res.status(400).json({ ok: false, message: 'analysisId와 rating이 필요합니다.' })
      return
    }

    const analysis = await getAnalysis(analysisId)
    if (!analysis || !analysis.paid) {
      res.status(404).json({ ok: false, message: '유료 분석 결과를 찾을 수 없습니다.' })
      return
    }
    if (!analysis.reportAccessToken || reportAccessToken !== analysis.reportAccessToken) {
      res.status(403).json({ ok: false, message: '유료 리포트 확인 권한이 없어 피드백을 보낼 수 없습니다.' })
      return
    }
    const order = await getLatestOrderByAnalysisId(analysisId)
    const note = String(req.body?.note || '').trim()

    await saveFeedback({
      analysisId,
      rating,
      note,
    })
    await relayFeedbackToFormsfree({
      analysisId,
      rating,
      note,
      customerEmail: order?.customerEmail || '',
      analysis,
    })
    res.json({ ok: true })
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message || '피드백 저장 중 오류가 발생했습니다.' })
  }
})

export function startServer() {
  return app.listen(port, () => {
    console.log(`JobRisk API listening on http://localhost:${port}`)
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer()
}
