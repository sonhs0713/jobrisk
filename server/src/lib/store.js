import { randomBytes } from 'node:crypto'

import { MongoClient, ObjectId } from 'mongodb'

import { DETAIL_SCHEMA_VERSION } from './analysis.js'

const memory = {
  analyses: new Map(),
  orders: new Map(),
  feedbacks: [],
}

let clientPromise

function buildDbUnavailableError(cause) {
  const error = new Error('db_unavailable')
  error.code = 'DB_UNAVAILABLE'
  error.cause = cause
  return error
}

async function getDb() {
  const uri = process.env.MONGODB_URI
  if (!uri) return null
  if (!clientPromise) {
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 2000,
      connectTimeoutMS: 2000,
    })
    clientPromise = client.connect().catch(async (error) => {
      clientPromise = null
      await client.close().catch(() => {})
      throw buildDbUnavailableError(error)
    })
  }
  const client = await clientPromise
  return client.db(process.env.MONGODB_DB || 'jobrisk')
}

function now() {
  return new Date().toISOString()
}

function createReportAccessToken() {
  return randomBytes(32).toString('hex')
}

export function hasCurrentDetailBundle(analysis) {
  return Boolean(
    analysis?.detail &&
      analysis?.decisionReport &&
      analysis?.detailVersion &&
      analysis.detailVersion === DETAIL_SCHEMA_VERSION,
  )
}

function buildPersistedDetailBundle({ detail = null, decisionReport = null, detailEngine = null, detailVersion = null }) {
  if (!detail) return null
  return {
    detail,
    decisionReport: decisionReport || null,
    detailEngine: detailEngine || 'stored_detail',
    detailVersion: detailVersion || null,
  }
}

export async function saveAnalysis(input) {
  const createdAt = now()
  const db = await getDb()
  const doc = {
    detailStatus: 'idle',
    detailErrorStage: null,
    detailRequestedAt: null,
    detailCompletedAt: null,
    detailVersion: null,
    ...input,
    createdAt,
    updatedAt: createdAt,
  }

  if (db) {
    const result = await db.collection('analyses').insertOne(doc)
    return { ...doc, analysisId: String(result.insertedId) }
  }

  const analysisId = new ObjectId().toString()
  memory.analyses.set(analysisId, { ...doc, analysisId })
  return { ...doc, analysisId }
}

export async function getAnalysis(analysisId) {
  const db = await getDb()
  if (db) {
    if (!ObjectId.isValid(analysisId)) return null
    const doc = await db.collection('analyses').findOne({ _id: new ObjectId(analysisId) })
    return doc ? { ...doc, analysisId: String(doc._id) } : null
  }
  return memory.analyses.get(analysisId) || null
}

export async function createOrder({ analysisId, amount, customerEmail }) {
  const order = {
    orderId: `jobrisk_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    analysisId,
    amount,
    customerEmail,
    status: 'READY',
    createdAt: now(),
  }

  const db = await getDb()
  if (db) await db.collection('payments').insertOne(order)
  else memory.orders.set(order.orderId, order)

  return order
}

export async function getOrder(orderId) {
  const db = await getDb()
  if (db) return db.collection('payments').findOne({ orderId })
  return memory.orders.get(orderId) || null
}

export async function getLatestOrderByAnalysisId(analysisId) {
  const db = await getDb()
  if (db) {
    return db.collection('payments').findOne(
      { analysisId },
      {
        sort: {
          paidAt: -1,
          createdAt: -1,
        },
      },
    )
  }

  const matches = Array.from(memory.orders.values()).filter((order) => order.analysisId === analysisId)
  if (!matches.length) return null

  matches.sort((left, right) => {
    const leftTime = Date.parse(left.paidAt || left.createdAt || 0)
    const rightTime = Date.parse(right.paidAt || right.createdAt || 0)
    return rightTime - leftTime
  })

  return matches[0] || null
}

export async function markPaid({
  analysisId,
  orderId,
  paymentId,
  amount,
  detail,
  decisionReport,
  detailEngine,
  detailVersion,
  transactionId,
}) {
  return markPaidReady({
    analysisId,
    orderId,
    paymentId,
    amount,
    transactionId,
    detail,
    decisionReport,
    detailEngine,
    detailVersion,
  })
}

export async function markPaidReady({
  analysisId,
  orderId,
  paymentId,
  amount,
  transactionId,
  detail = null,
  decisionReport = null,
  detailEngine = null,
  detailVersion = null,
}) {
  const db = await getDb()
  const paidAt = now()
  const paymentPatch = {
    orderId,
    analysisId,
    status: 'PAID',
    paymentId,
    transactionId,
    amount,
    paidAt,
  }

  if (db) {
    const existing = await db.collection('analyses').findOne(
      { _id: new ObjectId(analysisId) },
      {
        projection: {
          reportAccessToken: 1,
          detail: 1,
          decisionReport: 1,
          detailStatus: 1,
          detailEngine: 1,
          detailErrorStage: 1,
          detailVersion: 1,
          detailRequestedAt: 1,
          detailCompletedAt: 1,
        },
      },
    )
    const reportAccessToken = existing?.reportAccessToken || createReportAccessToken()
    const persistedDetailBundle = buildPersistedDetailBundle({
      detail: detail || existing?.detail || null,
      decisionReport: decisionReport || existing?.decisionReport || null,
      detailEngine: detailEngine || existing?.detailEngine || null,
      detailVersion: detailVersion || existing?.detailVersion || null,
    })
    const hasReusableDetailBundle = hasCurrentDetailBundle(persistedDetailBundle)
    const hasStoredDetail = Boolean(persistedDetailBundle?.detail)
    const analysisPatch = {
      paid: true,
      reportAccessToken,
      paidAt,
      updatedAt: paidAt,
      detailStatus: hasReusableDetailBundle ? 'ready' : 'generating',
      detailRequestedAt: hasReusableDetailBundle ? existing?.detailRequestedAt || paidAt : paidAt,
      detailCompletedAt: hasStoredDetail ? existing?.detailCompletedAt || paidAt : null,
      detailErrorStage: hasReusableDetailBundle ? existing?.detailErrorStage || null : null,
    }
    if (hasStoredDetail) {
      analysisPatch.detail = persistedDetailBundle.detail
      analysisPatch.decisionReport = persistedDetailBundle.decisionReport
      analysisPatch.detailEngine = persistedDetailBundle.detailEngine
      analysisPatch.detailVersion = persistedDetailBundle.detailVersion
    }
    await db.collection('payments').updateOne({ orderId }, { $set: paymentPatch }, { upsert: true })
    await db.collection('analyses').updateOne({ _id: new ObjectId(analysisId) }, { $set: analysisPatch })
    return {
      reportAccessToken,
      detailStatus: analysisPatch.detailStatus,
      detailStale: hasStoredDetail && !hasReusableDetailBundle,
    }
  }

  const order = memory.orders.get(orderId)
  memory.orders.set(orderId, { ...(order || {}), ...paymentPatch, amount })
  const analysis = memory.analyses.get(analysisId)
  const reportAccessToken = analysis?.reportAccessToken || createReportAccessToken()
  const persistedDetailBundle = buildPersistedDetailBundle({
    detail: detail || analysis?.detail || null,
    decisionReport: decisionReport || analysis?.decisionReport || null,
    detailEngine: detailEngine || analysis?.detailEngine || null,
    detailVersion: detailVersion || analysis?.detailVersion || null,
  })
  const hasReusableDetailBundle = hasCurrentDetailBundle(persistedDetailBundle)
  const hasStoredDetail = Boolean(persistedDetailBundle?.detail)
  const analysisPatch = {
    paid: true,
    reportAccessToken,
    paidAt,
    updatedAt: paidAt,
    detailStatus: hasReusableDetailBundle ? 'ready' : 'generating',
    detailRequestedAt: hasReusableDetailBundle ? analysis?.detailRequestedAt || paidAt : paidAt,
    detailCompletedAt: hasStoredDetail ? analysis?.detailCompletedAt || paidAt : null,
    detailErrorStage: hasReusableDetailBundle ? analysis?.detailErrorStage || null : null,
  }
  if (hasStoredDetail) {
    analysisPatch.detail = persistedDetailBundle.detail
    analysisPatch.decisionReport = persistedDetailBundle.decisionReport
    analysisPatch.detailEngine = persistedDetailBundle.detailEngine
    analysisPatch.detailVersion = persistedDetailBundle.detailVersion
  }
  if (analysis) memory.analyses.set(analysisId, { ...analysis, ...analysisPatch })
  return {
    reportAccessToken,
    detailStatus: analysisPatch.detailStatus,
    detailStale: hasStoredDetail && !hasReusableDetailBundle,
  }
}

export async function saveGeneratedDetail({
  analysisId,
  detail,
  decisionReport = null,
  detailEngine,
  detailVersion = DETAIL_SCHEMA_VERSION,
  detailErrorStage = null,
}) {
  const db = await getDb()
  const completedAt = now()
  const analysisPatch = {
    detail,
    decisionReport,
    detailEngine,
    detailVersion,
    detailStatus: 'ready',
    detailErrorStage,
    detailCompletedAt: completedAt,
    updatedAt: completedAt,
  }

  if (db) {
    await db.collection('analyses').updateOne({ _id: new ObjectId(analysisId) }, { $set: analysisPatch })
    return
  }

  const analysis = memory.analyses.get(analysisId)
  if (analysis) memory.analyses.set(analysisId, { ...analysis, ...analysisPatch })
}

export async function markDetailGenerating({ analysisId }) {
  const db = await getDb()
  const requestedAt = now()
  const analysisPatch = {
    detailStatus: 'generating',
    detailErrorStage: null,
    detailRequestedAt: requestedAt,
    updatedAt: requestedAt,
  }

  if (db) {
    await db.collection('analyses').updateOne({ _id: new ObjectId(analysisId) }, { $set: analysisPatch })
    return
  }

  const analysis = memory.analyses.get(analysisId)
  if (analysis) memory.analyses.set(analysisId, { ...analysis, ...analysisPatch })
}

export async function markDetailFailed({ analysisId, detailErrorStage = 'detail_generation_failed' }) {
  const db = await getDb()
  const completedAt = now()
  const analysisPatch = {
    detailStatus: 'failed',
    detailErrorStage,
    detailCompletedAt: completedAt,
    updatedAt: completedAt,
  }

  if (db) {
    await db.collection('analyses').updateOne({ _id: new ObjectId(analysisId) }, { $set: analysisPatch })
    return
  }

  const analysis = memory.analyses.get(analysisId)
  if (analysis) memory.analyses.set(analysisId, { ...analysis, ...analysisPatch })
}

export async function saveFeedback({ analysisId, rating, note }) {
  const feedback = { analysisId, rating, note, createdAt: now() }
  const db = await getDb()
  if (db) await db.collection('feedbacks').insertOne(feedback)
  else memory.feedbacks.push(feedback)
}

export function resetMemoryStoreForTest() {
  memory.analyses.clear()
  memory.orders.clear()
  memory.feedbacks.length = 0
  clientPromise = null
}

export function deleteOrderForTest(orderId) {
  memory.orders.delete(orderId)
}
