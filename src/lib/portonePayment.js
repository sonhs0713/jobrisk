import { requestPayment } from '@portone/browser-sdk/v2'

const EARLY_BIRD_AMOUNT = 3000
const ORDER_NAME = 'JOBRISK 물경력 가능성 상세 분석(얼리버드)'

function buildPaymentId() {
  const random = Math.random().toString(36).slice(2, 10)
  return `earlybird_${Date.now()}_${random}`
}

function toPaymentCompleteUrl(paymentId, amount) {
  const params = new URLSearchParams()
  params.set('paymentId', paymentId)
  params.set('amount', String(amount))
  return `/payment-complete?${params.toString()}`
}

export async function requestEarlyBirdPayment(customerEmail) {
  const storeId = import.meta.env.VITE_PORTONE_STORE_ID
  const channelKey = import.meta.env.VITE_PORTONE_CHANNEL_KEY

  if (!storeId || !channelKey) {
    throw new Error('PortOne 설정이 없습니다. VITE_PORTONE_STORE_ID, VITE_PORTONE_CHANNEL_KEY를 확인해주세요.')
  }

  const paymentId = buildPaymentId()
  sessionStorage.setItem('earlybird_customer_email', customerEmail)
  sessionStorage.setItem('earlybird_payment_id', paymentId)
  // PortOne 퀵 가이드 기준으로 paymentId를 주문 고유 식별자로 사용합니다.
  sessionStorage.setItem('earlybird_order_id', paymentId)
  sessionStorage.setItem('earlybird_amount', String(EARLY_BIRD_AMOUNT))

  const redirectUrl = `${window.location.origin}${toPaymentCompleteUrl(paymentId, EARLY_BIRD_AMOUNT)}`
  const result = await requestPayment({
    storeId,
    channelKey,
    paymentId,
    orderName: ORDER_NAME,
    totalAmount: EARLY_BIRD_AMOUNT,
    currency: 'KRW',
    payMethod: 'CARD',
    customData: {
      product: 'EARLY_BIRD_ANALYSIS',
      amount: EARLY_BIRD_AMOUNT,
    },
    forceRedirect: true,
    customer: {
      email: customerEmail,
    },
    redirectUrl,
  })

  if (result && typeof result === 'object' && 'code' in result && result.code) {
    throw new Error(result.message || '결제가 취소되었거나 실패했습니다.')
  }

  if (result && typeof result === 'object' && 'paymentId' in result && result.paymentId) {
    window.location.assign(toPaymentCompleteUrl(String(result.paymentId), EARLY_BIRD_AMOUNT))
  }
}
