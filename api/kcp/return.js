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
  const keys = ['ordr_idxx', 'good_mny', 'tno', 'res_cd', 'res_msg', 'pay_method']

  keys.forEach((key) => {
    const value = params.get(key)
    if (value) next.set(key, value)
  })

  return next
}

function resolvePayType(value) {
  const raw = String(value || '').trim().toUpperCase()
  const map = {
    CARD: 'PACA',
    BANK: 'PABK',
    MOBX: 'PAMC',
    TPNT: 'PAPT',
    GIFT: 'PATK',
    '100000000000': 'PACA',
    '010000000000': 'PABK',
    '000010000000': 'PAMC',
    '000100000000': 'PAPT',
    '000000001000': 'PATK',
  }
  return map[raw] || ''
}

function parseApprovalResponse(bodyText) {
  const raw = String(bodyText || '').trim()
  if (!raw) return {}

  try {
    return JSON.parse(raw)
  } catch {
    // ignore
  }

  const params = new URLSearchParams(raw)
  if (params.size > 0) {
    return Object.fromEntries(params.entries())
  }

  return {}
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function collectScalarMap(value, target = {}, depth = 0) {
  if (depth > 4 || !isRecord(value)) return target

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
      const normalized = key.toLowerCase()
      if (!(normalized in target)) target[normalized] = String(raw)
    }
  })

  return target
}

function pickNormalizedValue(map, keys) {
  for (const key of keys) {
    const value = map[key.toLowerCase()]
    if (typeof value !== 'undefined' && value !== null && String(value).trim() !== '') {
      return String(value)
    }
  }
  return ''
}

function extractApprovalFields(parsed, fallback = {}) {
  const normalized = collectScalarMap(parsed)

  const resCd = pickNormalizedValue(normalized, ['res_cd', 'rescode', 'response_code', 'code']) || fallback.res_cd || ''
  const resMsg =
    pickNormalizedValue(normalized, ['res_msg', 'resmessage', 'response_message', 'message']) || fallback.res_msg || ''
  const tno = pickNormalizedValue(normalized, ['tno', 'transaction_no', 'tran_no', 'tx_no']) || fallback.tno || ''
  const amount = pickNormalizedValue(normalized, ['amount', 'good_mny', 'card_mny']) || fallback.good_mny || ''
  const payMethod =
    pickNormalizedValue(normalized, ['pay_method', 'pay_type', 'payment_method']) || fallback.pay_method || ''
  const orderNo =
    pickNormalizedValue(normalized, ['order_no', 'ordr_no', 'ordr_idxx', 'orderid']) || fallback.order_no || ''

  return { res_cd: resCd, res_msg: resMsg, tno, good_mny: amount, pay_method: payMethod, order_no: orderNo, normalized }
}

async function requestApproval(payloadParams) {
  const approvalUrl = process.env.KCP_APPROVAL_URL
  const certInfo = process.env.KCP_CERT_INFO
  const siteCode = payloadParams.get('site_cd') || process.env.KCP_SITE_CODE
  const encData = payloadParams.get('enc_data')
  const encInfo = payloadParams.get('enc_info')
  const tranCd = payloadParams.get('tran_cd') || '00100000'
  const orderNo = payloadParams.get('ordr_idxx') || payloadParams.get('ordr_no')
  const orderAmount = payloadParams.get('good_mny') || payloadParams.get('ordr_mony')
  const payType = resolvePayType(payloadParams.get('pay_method') || payloadParams.get('pay_type'))

  if (!approvalUrl) {
    return { ok: false, res_cd: 'NO_APPROVAL_URL', res_msg: 'KCP 승인요청 URL이 설정되지 않았습니다.' }
  }
  if (!certInfo) {
    return { ok: false, res_cd: 'NO_CERT_INFO', res_msg: 'KCP 서비스 인증서가 설정되지 않았습니다.' }
  }
  if (!siteCode || !encData || !encInfo || !orderNo || !orderAmount || !payType) {
    return { ok: false, res_cd: 'INVALID_APPROVAL_PAYLOAD', res_msg: '승인요청 필수 파라미터가 누락되었습니다.' }
  }

  const approvalPayload = {
    tran_cd: tranCd,
    kcp_cert_info: certInfo,
    site_cd: siteCode,
    enc_data: encData,
    enc_info: encInfo,
    ordr_mony: String(orderAmount),
    pay_type: payType,
    ordr_no: String(orderNo),
  }

  try {
    const response = await fetch(approvalUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/plain, */*',
      },
      body: JSON.stringify(approvalPayload),
    })

    const rawText = await response.text()
    const parsed = parseApprovalResponse(rawText)
    const extracted = extractApprovalFields(parsed, {
      good_mny: String(orderAmount),
      pay_method: payType,
      order_no: String(orderNo),
    })
    const resultCode = extracted.res_cd || ''
    const resultMessage = extracted.res_msg || ''

    if (!response.ok) {
      return {
        ok: false,
        res_cd: resultCode || 'APPROVAL_HTTP_ERROR',
        res_msg: resultMessage || `승인요청 HTTP 오류(${response.status})`,
      }
    }

    return {
      ok: resultCode === '0000' && Boolean(extracted.tno),
      res_cd: resultCode || 'NO_RES_CD',
      res_msg:
        resultMessage ||
        (resultCode === '0000' && !extracted.tno
          ? `승인번호를 찾지 못했습니다. 응답 키: ${Object.keys(extracted.normalized).join(', ')}`
          : '승인 응답코드가 없습니다.'),
      tno: extracted.tno,
      good_mny: extracted.good_mny,
      pay_method: extracted.pay_method,
      order_no: extracted.order_no,
    }
  } catch (error) {
    return {
      ok: false,
      res_cd: 'APPROVAL_REQUEST_FAILED',
      res_msg: error instanceof Error ? error.message : '승인요청 중 오류가 발생했습니다.',
    }
  }
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

  const forwardParams = pickForwardParams(payloadParams)
  const hasAuthPayload = Boolean(payloadParams.get('enc_data') && payloadParams.get('enc_info'))
  const hasApprovalResult = Boolean(payloadParams.get('res_cd'))

  let finalResultCode = payloadParams.get('res_cd') || ''
  let finalResultMessage = payloadParams.get('res_msg') || ''
  let finalTno = payloadParams.get('tno') || ''
  let finalAmount = payloadParams.get('good_mny') || ''
  let finalOrderNo = payloadParams.get('ordr_idxx') || ''
  let finalPayMethod = payloadParams.get('pay_method') || ''

  if (!hasApprovalResult && hasAuthPayload) {
    const approved = await requestApproval(payloadParams)
    finalResultCode = approved.res_cd || ''
    finalResultMessage = approved.res_msg || ''
    finalTno = approved.tno || finalTno
    finalAmount = approved.good_mny || finalAmount
    finalOrderNo = approved.order_no || finalOrderNo
    finalPayMethod = approved.pay_method || finalPayMethod
  }

  const isSuccess = finalResultCode === '0000' && Boolean(finalTno)
  const path = isSuccess ? '/payment-complete' : '/payment-fail'

  if (finalOrderNo) forwardParams.set('ordr_idxx', finalOrderNo)
  if (finalAmount) forwardParams.set('good_mny', finalAmount)
  if (finalPayMethod) forwardParams.set('pay_method', finalPayMethod)
  if (finalTno) forwardParams.set('tno', finalTno)

  if (!isSuccess) {
    if (!finalResultCode) {
      finalResultCode = hasAuthPayload ? 'NO_APPROVAL_RESPONSE' : 'NO_RES_CD'
      finalResultMessage = hasAuthPayload
        ? '승인요청 응답코드(res_cd)를 확인할 수 없습니다.'
        : 'KCP 응답코드(res_cd)가 전달되지 않았습니다.'
    }
    if (finalResultCode === '0000' && !finalTno) {
      finalResultCode = 'NO_TNO'
      finalResultMessage = 'KCP 승인번호(tno)가 전달되지 않았습니다.'
    }
  }

  if (finalResultCode) forwardParams.set('res_cd', finalResultCode)
  if (finalResultMessage) forwardParams.set('res_msg', finalResultMessage)

  const forward = forwardParams.toString()
  const nextUrl = `${getBaseUrl(req)}${path}${forward ? `?${forward}` : ''}`

  res.writeHead(303, { Location: nextUrl })
  res.end()
}
