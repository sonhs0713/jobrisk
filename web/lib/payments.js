import { requestPayment } from '@portone/browser-sdk/v2'

export async function requestJobRiskPayment({ analysisId, orderId, amount, customerEmail }) {
  const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID
  const channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY

  if (!storeId || !channelKey) {
    throw new Error('PortOne 설정이 없습니다. NEXT_PUBLIC_PORTONE_STORE_ID, NEXT_PUBLIC_PORTONE_CHANNEL_KEY를 확인하세요.')
  }

  const paymentId = orderId
  const redirectUrl = `${window.location.origin}/payment-complete?paymentId=${encodeURIComponent(paymentId)}&analysisId=${encodeURIComponent(analysisId)}&amount=${encodeURIComponent(amount)}&orderId=${encodeURIComponent(orderId)}`

  const result = await requestPayment({
    storeId,
    channelKey,
    paymentId,
    orderName: 'JOBRISK 물경력 가능성 상세 분석',
    totalAmount: amount,
    currency: 'KRW',
    payMethod: 'CARD',
    customer: customerEmail ? { email: customerEmail } : undefined,
    customData: {
      analysisId,
      product: 'JOBRISK_DETAIL_REPORT',
    },
    redirectUrl,
    forceRedirect: true,
  })

  if (result && typeof result === 'object' && result.code) {
    throw new Error(result.message || '결제가 취소되었거나 실패했습니다.')
  }

  if (result?.paymentId) {
    window.location.assign(redirectUrl)
  }
}
