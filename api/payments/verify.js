import { Buffer } from 'node:buffer'

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function collectScalarMap(value, target = {}, depth = 0) {
  if (!isRecord(value) || depth > 6) return target

  Object.entries(value).forEach(([key, raw]) => {
    if (raw === undefined || raw === null) return

    if (isRecord(raw)) {
      collectScalarMap(raw, target, depth + 1)
      return
    }

    if (Array.isArray(raw)) {
      raw.forEach((entry) => {
        if (isRecord(entry)) collectScalarMap(entry, target, depth + 1)
      })
      return
    }

    if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
      const normalizedKey = key.toLowerCase()
      if (!(normalizedKey in target)) target[normalizedKey] = String(raw)
    }
  })

  return target
}

function pickValue(map, keys) {
  for (const key of keys) {
    const value = map[key.toLowerCase()]
    if (typeof value !== 'undefined' && String(value).trim() !== '') return String(value)
  }
  return ''
}

function getByPath(obj, path) {
  const keys = String(path || '').split('.')
  let current = obj
  for (const key of keys) {
    if (!current || typeof current !== 'object' || !(key in current)) return undefined
    current = current[key]
  }
  return current
}

function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN
  if (typeof value === 'string') {
    const normalized = value.replace(/[,\s]/g, '').trim()
    if (!normalized) return NaN
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : NaN
  }
  return NaN
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}')
  if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString('utf8') || '{}')

  const chunks = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  const bodyText = Buffer.concat(chunks).toString('utf8')
  return JSON.parse(bodyText || '{}')
}

function parsePortOneResponse(payload) {
  const normalized = collectScalarMap(payload)
  const amountFromPath =
    getByPath(payload, 'amount.total') ??
    getByPath(payload, 'amount.paid') ??
    getByPath(payload, 'paidAmount') ??
    getByPath(payload, 'payment.amount.total')

  return {
    status: pickValue(normalized, ['status', 'payment_status', 'state']),
    orderId: pickValue(normalized, ['order_id', 'orderid', 'merchant_uid', 'merchantid', 'customid']),
    amount:
      typeof amountFromPath !== 'undefined'
        ? String(amountFromPath)
        : pickValue(normalized, ['total_amount', 'amount', 'paid_amount', 'paidamount', 'total']),
    transactionId: pickValue(normalized, ['transaction_id', 'tx_id', 'pg_tx_id', 'pgtxid', 'transactionid']),
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ ok: false, isPaid: false, code: 'METHOD_NOT_ALLOWED', message: 'Method Not Allowed' })
    return
  }

  const apiSecret = process.env.PORTONE_API_SECRET || ''
  if (!apiSecret) {
    res.status(500).json({
      ok: false,
      isPaid: false,
      code: 'PORTONE_SECRET_MISSING',
      message: 'PORTONE_API_SECRET 환경변수가 설정되지 않았습니다.',
    })
    return
  }

  let payload
  try {
    payload = await readJsonBody(req)
  } catch {
    res.status(400).json({ ok: false, isPaid: false, code: 'INVALID_JSON', message: '요청 본문이 JSON 형식이 아닙니다.' })
    return
  }

  const paymentId = String(payload?.paymentId || '').trim()
  const expectedOrderId = String(payload?.orderId || '').trim()
  const expectedAmount = toNumber(payload?.amount)

  if (!paymentId || !expectedOrderId || !Number.isFinite(expectedAmount)) {
    res.status(400).json({
      ok: false,
      isPaid: false,
      code: 'INVALID_VERIFY_PAYLOAD',
      message: 'paymentId, orderId, amount가 모두 필요합니다.',
    })
    return
  }

  let portoneResponse
  try {
    portoneResponse = await fetch(`https://api.portone.io/payments/${encodeURIComponent(paymentId)}`, {
      method: 'GET',
      headers: {
        Authorization: `PortOne ${apiSecret}`,
        Accept: 'application/json',
      },
    })
  } catch (error) {
    res.status(502).json({
      ok: false,
      isPaid: false,
      code: 'PORTONE_FETCH_FAILED',
      message: error instanceof Error ? error.message : 'PortOne 조회 중 오류가 발생했습니다.',
    })
    return
  }

  let paymentData = {}
  try {
    paymentData = await portoneResponse.json()
  } catch {
    // ignore parse error
  }

  if (!portoneResponse.ok) {
    res.status(400).json({
      ok: false,
      isPaid: false,
      code: 'PORTONE_FETCH_NOT_OK',
      message: 'PortOne 결제 조회에 실패했습니다.',
    })
    return
  }

  const parsed = parsePortOneResponse(paymentData)
  const actualAmount = toNumber(parsed.amount)
  const isPaidStatus = String(parsed.status).toUpperCase() === 'PAID'

  if (!isPaidStatus) {
    res.status(400).json({
      ok: false,
      isPaid: false,
      code: 'PAYMENT_NOT_PAID',
      message: `결제 상태가 PAID가 아닙니다. (${parsed.status || 'UNKNOWN'})`,
    })
    return
  }

  if (parsed.orderId && parsed.orderId !== expectedOrderId) {
    res.status(400).json({
      ok: false,
      isPaid: false,
      code: 'ORDER_ID_MISMATCH',
      message: '주문번호가 일치하지 않습니다.',
    })
    return
  }

  const expectedAmountInt = Math.round(expectedAmount)
  const actualAmountInt = Math.round(actualAmount)
  if (!Number.isFinite(actualAmountInt) || actualAmountInt !== expectedAmountInt) {
    res.status(400).json({
      ok: false,
      isPaid: false,
      code: 'AMOUNT_MISMATCH',
      message: `결제 금액이 일치하지 않습니다. expected=${expectedAmountInt}, actual=${Number.isFinite(actualAmountInt) ? actualAmountInt : 'NaN'}`,
    })
    return
  }

  res.status(200).json({
    ok: true,
    isPaid: true,
    code: 'PAID',
    message: '결제 검증이 완료되었습니다.',
    paymentId,
    orderId: parsed.orderId || expectedOrderId,
    amount: actualAmountInt,
    transactionId: parsed.transactionId || paymentId,
    status: parsed.status,
  })
}
