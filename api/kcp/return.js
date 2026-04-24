import { Buffer } from 'node:buffer'

function getBaseUrl(req) {
  const protocol = req.headers['x-forwarded-proto'] || 'https'
  const host = req.headers.host
  return `${protocol}://${host}`
}

function toSearchParamsFromObject(value) {
  const params = new URLSearchParams()
  Object.entries(value).forEach(([key, raw]) => {
    if (raw === undefined || raw === null) return
    params.set(key, String(raw))
  })
  return params
}

async function readBody(req) {
  if (req.body) {
    if (typeof req.body === 'string') return req.body
    if (Buffer.isBuffer(req.body)) return req.body.toString('utf8')
    if (typeof req.body === 'object') return toSearchParamsFromObject(req.body).toString()
  }

  const chunks = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks).toString('utf8')
}

function pickForwardParams(params) {
  const next = new URLSearchParams()
  const keys = ['ordr_idxx', 'good_mny', 'tno', 'res_cd', 'res_msg']

  keys.forEach((key) => {
    const value = params.get(key)
    if (value) next.set(key, value)
  })

  return next
}

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST')
    res.status(405).send('Method Not Allowed')
    return
  }

  const payloadParams =
    req.method === 'GET'
      ? new URLSearchParams(req.query || {})
      : new URLSearchParams(await readBody(req))

  const resultCode = payloadParams.get('res_cd')
  const transactionId = payloadParams.get('tno')
  const isSuccess = resultCode === '0000' && Boolean(transactionId)
  const path = isSuccess ? '/payment-complete' : '/payment-fail'
  const forward = pickForwardParams(payloadParams).toString()
  const nextUrl = `${getBaseUrl(req)}${path}${forward ? `?${forward}` : ''}`

  res.writeHead(303, { Location: nextUrl })
  res.end()
}
