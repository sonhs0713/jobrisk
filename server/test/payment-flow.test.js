import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'

import { app } from '../src/index.js'
import { verifyPortOnePayment } from '../src/lib/portone.js'
import { resetMemoryStoreForTest } from '../src/lib/store.js'

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

test('detail is blocked before payment and with a wrong access token', async () => {
  const preview = await createPreview()

  const beforePayment = await get(`/api/analyze/${preview.analysisId}/detail?token=wrong`)
  assert.equal(beforePayment.response.status, 403)

  const prepared = await post('/api/payments/prepare', { analysisId: preview.analysisId })
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
  const prepared = await post('/api/payments/prepare', { analysisId: preview.analysisId })

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

test('payment verify rejects analysis and order mismatch', async () => {
  const first = await createPreview()
  const second = await createPreview()
  const prepared = await post('/api/payments/prepare', { analysisId: first.analysisId })

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
  const prepared = await post('/api/payments/prepare', { analysisId: preview.analysisId })
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
