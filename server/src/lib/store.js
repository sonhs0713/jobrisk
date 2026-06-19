import { randomBytes } from 'node:crypto'

import { MongoClient, ObjectId } from 'mongodb'

const memory = {
  analyses: new Map(),
  orders: new Map(),
  feedbacks: [],
}

let clientPromise

async function getDb() {
  const uri = process.env.MONGODB_URI
  if (!uri) return null
  if (!clientPromise) {
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 2000,
      connectTimeoutMS: 2000,
    })
    clientPromise = Promise.race([
      client.connect(),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('mongo_connect_timeout')), 1500)
      }),
    ]).catch(async () => {
      clientPromise = null
      await client.close().catch(() => {})
      return null
    })
  }
  const client = await clientPromise
  if (!client) return null
  return client.db(process.env.MONGODB_DB || 'jobrisk')
}

function now() {
  return new Date().toISOString()
}

function createReportAccessToken() {
  return randomBytes(32).toString('hex')
}

export async function saveAnalysis(input) {
  const createdAt = now()
  const db = await getDb()
  const doc = {
    detailStatus: 'idle',
    detailErrorStage: null,
    detailRequestedAt: null,
    detailCompletedAt: null,
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

export async function markPaid({ analysisId, orderId, paymentId, amount, detail, detailEngine, transactionId }) {
  return markPaidReady({
    analysisId,
    orderId,
    paymentId,
    amount,
    transactionId,
    detail,
    detailEngine,
  })
}

export async function markPaidReady({ analysisId, orderId, paymentId, amount, transactionId, detail = null, detailEngine = null }) {
  const db = await getDb()
  const paidAt = now()
  const paymentPatch = {
    status: 'PAID',
    paymentId,
    transactionId,
    amount,
    paidAt,
  }

  if (db) {
    const existing = await db.collection('analyses').findOne(
      { _id: new ObjectId(analysisId) },
      { projection: { reportAccessToken: 1, detail: 1, detailStatus: 1, detailEngine: 1, detailErrorStage: 1 } },
    )
    const reportAccessToken = existing?.reportAccessToken || createReportAccessToken()
    const hasExistingDetail = Boolean(existing?.detail || detail)
    const analysisPatch = {
      paid: true,
      reportAccessToken,
      paidAt,
      updatedAt: paidAt,
      detailStatus: hasExistingDetail ? 'ready' : 'generating',
      detailRequestedAt: hasExistingDetail ? existing?.detailRequestedAt || paidAt : paidAt,
      detailCompletedAt: hasExistingDetail ? paidAt : null,
      detailErrorStage: hasExistingDetail ? existing?.detailErrorStage || null : null,
    }
    if (hasExistingDetail) {
      analysisPatch.detail = detail || existing?.detail || null
      analysisPatch.detailEngine = detailEngine || existing?.detailEngine || 'stored_detail'
    }
    await db.collection('payments').updateOne({ orderId }, { $set: paymentPatch })
    await db.collection('analyses').updateOne({ _id: new ObjectId(analysisId) }, { $set: analysisPatch })
    return { reportAccessToken, detailStatus: analysisPatch.detailStatus }
  }

  const order = memory.orders.get(orderId)
  if (order) memory.orders.set(orderId, { ...order, ...paymentPatch, amount })
  const analysis = memory.analyses.get(analysisId)
  const reportAccessToken = analysis?.reportAccessToken || createReportAccessToken()
  const hasExistingDetail = Boolean(analysis?.detail || detail)
  const analysisPatch = {
    paid: true,
    reportAccessToken,
    paidAt,
    updatedAt: paidAt,
    detailStatus: hasExistingDetail ? 'ready' : 'generating',
    detailRequestedAt: hasExistingDetail ? analysis?.detailRequestedAt || paidAt : paidAt,
    detailCompletedAt: hasExistingDetail ? paidAt : null,
    detailErrorStage: hasExistingDetail ? analysis?.detailErrorStage || null : null,
  }
  if (hasExistingDetail) {
    analysisPatch.detail = detail || analysis?.detail || null
    analysisPatch.detailEngine = detailEngine || analysis?.detailEngine || 'stored_detail'
  }
  if (analysis) memory.analyses.set(analysisId, { ...analysis, ...analysisPatch })
  return { reportAccessToken, detailStatus: analysisPatch.detailStatus }
}

export async function saveGeneratedDetail({ analysisId, detail, detailEngine, detailErrorStage = null }) {
  const db = await getDb()
  const completedAt = now()
  const analysisPatch = {
    detail,
    detailEngine,
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
}
