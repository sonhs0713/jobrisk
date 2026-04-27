import crypto from 'node:crypto'
import { Buffer } from 'node:buffer'

async function readRawBody(req) {
  if (typeof req.body === 'string') return req.body
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8')
  if (req.body && typeof req.body === 'object') return JSON.stringify(req.body)

  const chunks = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks).toString('utf8')
}

function isValidSignature(rawBody, signature, webhookSecret) {
  if (!webhookSecret) return true
  if (!signature) return false

  const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ ok: false, message: 'Method Not Allowed' })
    return
  }

  const webhookSecret = process.env.PORTONE_WEBHOOK_SECRET || ''
  const signature =
    req.headers['x-portone-signature'] ||
    req.headers['X-Portone-Signature'] ||
    req.headers['x-portone-signature-v1'] ||
    ''

  let rawBody = ''
  try {
    rawBody = await readRawBody(req)
  } catch {
    res.status(400).json({ ok: false, message: '웹훅 본문을 읽지 못했습니다.' })
    return
  }

  if (!isValidSignature(rawBody, String(signature || ''), webhookSecret)) {
    res.status(401).json({ ok: false, message: '웹훅 서명이 유효하지 않습니다.' })
    return
  }

  let event
  try {
    event = JSON.parse(rawBody || '{}')
  } catch {
    res.status(400).json({ ok: false, message: '웹훅 JSON 파싱에 실패했습니다.' })
    return
  }

  // TODO: 실제 운영에서는 결제 상태를 DB에 upsert하고, 이미 처리한 이벤트는 중복 방지하세요.
  console.log('[portone-webhook]', {
    id: event?.id || '',
    type: event?.type || '',
    paymentId: event?.data?.paymentId || event?.data?.payment_id || '',
    occurredAt: event?.occurredAt || event?.createdAt || '',
  })

  res.status(200).json({ ok: true })
}
