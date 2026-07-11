function pickScalar(value, keys) {
  const stack = [value]
  const found = {}
  while (stack.length) {
    const current = stack.pop()
    if (!current || typeof current !== 'object') continue
    for (const [key, raw] of Object.entries(current)) {
      const lower = key.toLowerCase()
      if (raw && typeof raw === 'object') stack.push(raw)
      else if (!(lower in found)) found[lower] = String(raw)
    }
  }
  for (const key of keys) {
    const valueForKey = found[key.toLowerCase()]
    if (valueForKey) return valueForKey
  }
  return ''
}

function parseAmount(value) {
  const number = Number(String(value || '').replace(/[,\s]/g, ''))
  return Number.isFinite(number) ? Math.round(number) : NaN
}

export async function verifyPortOnePayment({ paymentId, orderId, expectedAmount }) {
  if (process.env.NODE_ENV !== 'production' && paymentId.startsWith('dev_')) {
    return { transactionId: paymentId }
  }

  const secret = process.env.PORTONE_API_SECRET
  if (!secret) {
    throw new Error('PORTONE_API_SECRET이 설정되지 않았습니다.')
  }

  const response = await fetch(`https://api.portone.io/payments/${encodeURIComponent(paymentId)}`, {
    headers: {
      Authorization: `PortOne ${secret}`,
      Accept: 'application/json',
    },
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error('PortOne 결제 조회에 실패했습니다.')

  const status = pickScalar(data, ['status', 'state'])
  if (status.toUpperCase() !== 'PAID') {
    throw new Error(`결제 상태가 PAID가 아닙니다. 현재 상태: ${status || 'UNKNOWN'}`)
  }

  const actualOrderId = pickScalar(data, ['orderId', 'order_id', 'merchantUid', 'merchant_uid'])
  if (actualOrderId && actualOrderId !== orderId) {
    throw new Error('주문 ID가 일치하지 않습니다.')
  }

  const actualAmount = parseAmount(pickScalar(data, ['totalAmount', 'paidAmount', 'amount', 'total']))
  if (!Number.isFinite(actualAmount) || actualAmount !== Math.round(Number(expectedAmount))) {
    throw new Error('결제 금액이 일치하지 않습니다.')
  }

  return {
    transactionId: pickScalar(data, ['transactionId', 'transaction_id', 'txId']) || paymentId,
  }
}
