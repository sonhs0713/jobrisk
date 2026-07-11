import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'

import { app } from '../src/index.js'
import { buildDetailReport, buildPreview, DETAIL_SCHEMA_VERSION } from '../src/lib/analysis.js'
import { verifyPortOnePayment } from '../src/lib/portone.js'
import {
  deleteOrderForTest,
  getAnalysis,
  markPaidReady,
  resetMemoryStoreForTest,
  saveAnalysis,
  saveGeneratedDetail,
} from '../src/lib/store.js'

process.env.OPENAI_API_KEY = ''
process.env.PORTONE_API_SECRET = ''
process.env.MONGODB_URI = ''

let server
let baseUrl

before(() => {
  server = app.listen(0)
  const address = server.address()
  baseUrl = `http://127.0.0.1:${address.port}`
})

after(() => {
  server.close()
})

beforeEach(() => {
  resetMemoryStoreForTest()
})

async function post(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await response.json()
  return { response, data }
}

async function get(path) {
  const response = await fetch(`${baseUrl}${path}`)
  const data = await response.json()
  return { response, data }
}

async function waitForDetailReady(analysisId, token, timeoutMs = 1500) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    const status = await get(`/api/analyze/${analysisId}/detail-status?token=${encodeURIComponent(token)}`)
    if (status.response.status === 200 && status.data.detailStatus === 'ready') return status.data
    if (status.response.status === 200 && status.data.detailStatus === 'failed') {
      throw new Error(`detail generation failed: ${status.data.detailErrorStage || 'unknown'}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 25))
  }

  throw new Error('detail generation did not reach ready status in time')
}

async function createPreview() {
  const text = `
JobRisk product manager hiring
Responsibilities
- Run repeated content upload checks and simple request handling every day.
- Support operational admin tasks and reporting.
Requirements
- Spreadsheet experience and basic communication skills.
Preferred
- Process improvement experience.
`

  const { response, data } = await post('/api/analyze/preview', { jobPostingText: text })
  assert.equal(response.status, 200)
  assert.equal(data.ok, true)
  assert.ok(data.analysisId)
  assert.equal(typeof data.engine, 'string')
  return data
}

async function createPaidAnalysisWithStoredDetail({ detailVersion = DETAIL_SCHEMA_VERSION } = {}) {
  const jobPostingText = `
뷰티 자사몰 마케팅 담당
주요업무
- CRM 캠페인 운영 및 프로모션 실행
- 채널별 전환율 분석과 성과 리포트 작성
- 인플루언서 협업 일정 조율 및 콘텐츠 성과 관리
자격요건
- 마케팅 운영 경험
`

  const preview = await buildPreview({ jobPostingText })
  const analysis = await saveAnalysis({
    jobPostingText,
    structured: preview.structured,
    freePreview: preview.freePreview,
    detail: null,
    paid: false,
    engine: preview.engine,
  })
  const detail = await buildDetailReport({
    analysis: {
      structured: preview.structured,
      freePreview: preview.freePreview,
    },
  })

  await saveGeneratedDetail({
    analysisId: analysis.analysisId,
    detail: detail.detail,
    decisionReport: detail.decisionReport,
    detailEngine: detail.engine,
    detailVersion,
  })

  const paid = await markPaidReady({
    analysisId: analysis.analysisId,
    orderId: `order_${detailVersion}`,
    paymentId: `payment_${detailVersion}`,
    amount: 3000,
    transactionId: `tx_${detailVersion}`,
  })

  return {
    analysisId: analysis.analysisId,
    reportAccessToken: paid.reportAccessToken,
    originalDetailVersion: detailVersion,
  }
}

test('preview rejects short job postings', async () => {
  const { response, data } = await post('/api/analyze/preview', { jobPostingText: 'too short' })

  assert.equal(response.status, 400)
  assert.equal(data.ok, false)
})

test('payment prepare creates an order for an existing analysis', async () => {
  const preview = await createPreview()

  const { response, data } = await post('/api/payments/prepare', {
    analysisId: preview.analysisId,
    customerEmail: 'buyer@example.com',
  })

  assert.equal(response.status, 200)
  assert.equal(data.ok, true)
  assert.equal(data.analysisId, preview.analysisId)
  assert.equal(data.amount, 3000)
  assert.ok(data.orderId)
})

test('payment prepare rejects a missing customer email', async () => {
  const preview = await createPreview()

  const { response, data } = await post('/api/payments/prepare', {
    analysisId: preview.analysisId,
    customerEmail: '',
  })

  assert.equal(response.status, 400)
  assert.equal(data.ok, false)
  assert.match(data.message, /이메일/)
})

test('detail is blocked before payment and with a wrong access token', async () => {
  const preview = await createPreview()

  const beforePayment = await get(`/api/analyze/${preview.analysisId}/detail?token=wrong`)
  assert.equal(beforePayment.response.status, 403)

  const prepared = await post('/api/payments/prepare', { analysisId: preview.analysisId, customerEmail: 'buyer@example.com' })
  const verified = await post('/api/payments/verify', {
    paymentId: 'dev_paid_1',
    analysisId: preview.analysisId,
    orderId: prepared.data.orderId,
    amount: 1,
  })
  assert.equal(verified.response.status, 200)

  const wrongToken = await get(`/api/analyze/${preview.analysisId}/detail?token=wrong`)
  assert.equal(wrongToken.response.status, 403)
})

test('payment verify uses the stored order amount and unlocks detail with token', async () => {
  const preview = await createPreview()
  const prepared = await post('/api/payments/prepare', { analysisId: preview.analysisId, customerEmail: 'buyer@example.com' })

  const verified = await post('/api/payments/verify', {
    paymentId: 'dev_paid_2',
    analysisId: preview.analysisId,
    orderId: prepared.data.orderId,
    amount: 1,
  })

  assert.equal(verified.response.status, 200)
  assert.equal(verified.data.ok, true)
  assert.ok(verified.data.reportAccessToken)
  assert.equal(verified.data.detailStatus, 'generating')

  const status = await waitForDetailReady(preview.analysisId, verified.data.reportAccessToken)
  assert.equal(status.detailStatus, 'ready')

  const detail = await get(
    `/api/analyze/${preview.analysisId}/detail?token=${encodeURIComponent(verified.data.reportAccessToken)}`,
  )
  assert.equal(detail.response.status, 200)
  assert.equal(detail.data.ok, true)
  assert.equal(typeof detail.data.detail.finalSummary, 'string')
  assert.equal(typeof detail.data.detailEngine, 'string')
})

test('stale paid detail falls back while a rebuild is scheduled', async () => {
  const stale = await createPaidAnalysisWithStoredDetail({ detailVersion: 'jobrisk-detail-v1' })

  const firstDetail = await get(`/api/analyze/${stale.analysisId}/detail?token=${encodeURIComponent(stale.reportAccessToken)}`)
  assert.equal(firstDetail.response.status, 200)
  assert.equal(firstDetail.data.ok, true)
  assert.equal(firstDetail.data.detailStale, true)
  assert.equal(firstDetail.data.detailVersion, 'jobrisk-detail-v1')
  assert.equal(firstDetail.data.detailStatus, 'generating')

  const status = await waitForDetailReady(stale.analysisId, stale.reportAccessToken, 2500)
  assert.equal(status.detailStatus, 'ready')
  assert.equal(status.detailStale, false)

  const refreshedAnalysis = await getAnalysis(stale.analysisId)
  assert.equal(refreshedAnalysis.detailVersion, DETAIL_SCHEMA_VERSION)

  const refreshedDetail = await get(`/api/analyze/${stale.analysisId}/detail?token=${encodeURIComponent(stale.reportAccessToken)}`)
  assert.equal(refreshedDetail.response.status, 200)
  assert.equal(refreshedDetail.data.detailStale, false)
  assert.equal(refreshedDetail.data.detailVersion, DETAIL_SCHEMA_VERSION)
})

test('payment verify rejects analysis and order mismatch', async () => {
  const first = await createPreview()
  const second = await createPreview()
  const prepared = await post('/api/payments/prepare', { analysisId: first.analysisId, customerEmail: 'buyer@example.com' })

  const verified = await post('/api/payments/verify', {
    paymentId: 'dev_paid_3',
    analysisId: second.analysisId,
    orderId: prepared.data.orderId,
  })

  assert.equal(verified.response.status, 400)
  assert.equal(verified.data.ok, false)
})

test('payment verify is idempotent after the order is already paid', async () => {
  const preview = await createPreview()
  const prepared = await post('/api/payments/prepare', { analysisId: preview.analysisId, customerEmail: 'buyer@example.com' })
  const body = {
    paymentId: 'dev_paid_4',
    analysisId: preview.analysisId,
    orderId: prepared.data.orderId,
  }

  const first = await post('/api/payments/verify', body)
  const second = await post('/api/payments/verify', body)

  assert.equal(first.response.status, 200)
  assert.equal(second.response.status, 200)
  assert.equal(second.data.reportAccessToken, first.data.reportAccessToken)
  assert.equal(typeof second.data.detailStatus, 'string')
})

test('payment verify recovers when local order is missing but PortOne confirms payment', async () => {
  const preview = await createPreview()
  const prepared = await post('/api/payments/prepare', { analysisId: preview.analysisId, customerEmail: 'buyer@example.com' })

  deleteOrderForTest(prepared.data.orderId)

  const originalFetch = globalThis.fetch
  const originalSecret = process.env.PORTONE_API_SECRET
  process.env.PORTONE_API_SECRET = 'test_secret'
  globalThis.fetch = async (input, init) => {
    const url = String(input)
    if (url.includes('api.portone.io/payments/')) {
      return new Response(
        JSON.stringify({
          status: 'PAID',
          orderId: prepared.data.orderId,
          totalAmount: 3000,
          transactionId: 'tx_recovered_1',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }
    return originalFetch(input, init)
  }

  try {
    const verified = await post('/api/payments/verify', {
      paymentId: prepared.data.orderId,
      analysisId: preview.analysisId,
      orderId: prepared.data.orderId,
      amount: 3000,
    })

    assert.equal(verified.response.status, 200)
    assert.equal(verified.data.ok, true)
    assert.ok(verified.data.reportAccessToken)
    assert.equal(typeof verified.data.detailStatus, 'string')
  } finally {
    globalThis.fetch = originalFetch
    process.env.PORTONE_API_SECRET = originalSecret
  }
})

test('payment verify relays a payment notification once after a successful payment', async () => {
  const preview = await createPreview()
  const prepared = await post('/api/payments/prepare', { analysisId: preview.analysisId, customerEmail: 'buyer@example.com' })

  const originalFetch = globalThis.fetch
  const originalEndpoint = process.env.FORMSPREE_PAYMENT_URL
  const relays = []
  process.env.FORMSPREE_PAYMENT_URL = 'https://example.com/formspree-payment'
  globalThis.fetch = async (input, init) => {
    const url = String(input)
    if (url === process.env.FORMSPREE_PAYMENT_URL) {
      relays.push(String(init?.body || ''))
      return new Response('ok', { status: 200 })
    }
    return originalFetch(input, init)
  }

  try {
    const body = {
      paymentId: 'dev_paid_notify_1',
      analysisId: preview.analysisId,
      orderId: prepared.data.orderId,
    }
    const first = await post('/api/payments/verify', body)
    const second = await post('/api/payments/verify', body)

    assert.equal(first.response.status, 200)
    assert.equal(second.response.status, 200)
    assert.equal(relays.length, 1)
    assert.match(relays[0], /customerEmail=buyer%40example.com/)
    assert.match(relays[0], /orderId=/)
  } finally {
    globalThis.fetch = originalFetch
    process.env.FORMSPREE_PAYMENT_URL = originalEndpoint
  }
})

test('payment verify returns a DB error instead of 404 when Mongo is configured but unavailable', async () => {
  const originalMongoUri = process.env.MONGODB_URI
  const originalMongoDb = process.env.MONGODB_DB
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:1/jobrisk-test'
  process.env.MONGODB_DB = 'jobrisk-test'

  try {
    const { response, data } = await post('/api/payments/verify', {
      paymentId: 'paid_db_error_1',
      analysisId: '6a30ea760d644878bf78d851',
      orderId: 'jobrisk_missing_order',
    })

    assert.equal(response.status, 503)
    assert.equal(data.ok, false)
    assert.match(data.message, /DB 연결 문제/)
  } finally {
    process.env.MONGODB_URI = originalMongoUri
    process.env.MONGODB_DB = originalMongoDb
    resetMemoryStoreForTest()
  }
})

test('PortOne verification rejects a paid response with the wrong amount', async () => {
  const originalFetch = globalThis.fetch
  const originalSecret = process.env.PORTONE_API_SECRET
  process.env.PORTONE_API_SECRET = 'test_secret'
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ status: 'PAID', orderId: 'order_1', totalAmount: 1 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })

  try {
    await assert.rejects(
      () => verifyPortOnePayment({ paymentId: 'payment_1', orderId: 'order_1', expectedAmount: 3000 }),
      /amount|금액|湲덉븸/,
    )
  } finally {
    globalThis.fetch = originalFetch
    process.env.PORTONE_API_SECRET = originalSecret
  }
})

test('PortOne dev payment bypass is blocked in production', async () => {
  const originalSecret = process.env.PORTONE_API_SECRET
  const originalNodeEnv = process.env.NODE_ENV
  process.env.PORTONE_API_SECRET = ''
  process.env.NODE_ENV = 'production'

  try {
    await assert.rejects(
      () => verifyPortOnePayment({ paymentId: 'dev_payment_1', orderId: 'order_1', expectedAmount: 3000 }),
      /PORTONE_API_SECRET/,
    )
  } finally {
    process.env.PORTONE_API_SECRET = originalSecret
    process.env.NODE_ENV = originalNodeEnv
  }
})
