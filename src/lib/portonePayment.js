import { requestPayment } from '@portone/browser-sdk/v2'

const EARLY_BIRD_AMOUNT = 3000
const ORDER_NAME = '채용공고 분석 서비스 얼리버드 등록'

function buildPaymentId() {
  const random = Math.random().toString(36).slice(2, 10)
  return `earlybird_${Date.now()}_${random}`
}

function buildOrderId() {
  const random = Math.random().toString(36).slice(2, 10)
  return `order_${Date.now()}_${random}`
}

function toPaymentCompleteUrl(paymentId, orderId, amount) {
  const params = new URLSearchParams()
  params.set('paymentId', paymentId)
  params.set('orderId', orderId)
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
  const orderId = buildOrderId()

  sessionStorage.setItem('earlybird_customer_email', customerEmail)
  sessionStorage.setItem('earlybird_payment_id', paymentId)
  sessionStorage.setItem('earlybird_order_id', orderId)
  sessionStorage.setItem('earlybird_amount', String(EARLY_BIRD_AMOUNT))

  const redirectUrl = `${window.location.origin}${toPaymentCompleteUrl(paymentId, orderId, EARLY_BIRD_AMOUNT)}`
  const result = await requestPayment({
    storeId,
    channelKey,
    paymentId,
    orderName: ORDER_NAME,
    totalAmount: EARLY_BIRD_AMOUNT,
    currency: 'KRW',
    payMethod: 'CARD',
    customData: {
      orderId,
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
    window.location.assign(toPaymentCompleteUrl(String(result.paymentId), orderId, EARLY_BIRD_AMOUNT))
  }
}
