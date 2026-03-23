import { loadTossPayments } from '@tosspayments/tosspayments-sdk'

const EARLY_BIRD_AMOUNT = 3000
const ORDER_NAME = '채용공고 분석 서비스 얼리버드 등록'

function buildOrderId() {
  const random = Math.random().toString(36).slice(2, 10)
  return `earlybird_${Date.now()}_${random}`
}

export async function requestEarlyBirdPayment(customerEmail) {
  const clientKey = import.meta.env.VITE_TOSS_CLIENT_KEY
  const customerKey = import.meta.env.VITE_TOSS_CUSTOMER_KEY
  const isTestMode = import.meta.env.VITE_TOSS_TEST_MODE === 'true'

  if (!clientKey || !customerKey) {
    throw new Error('결제 환경변수가 설정되지 않았습니다.')
  }

  const tossPayments = await loadTossPayments(clientKey)

  // 결제 성공 콜백에서 Formspree로 저장할 이메일을 임시 보관합니다.
  sessionStorage.setItem('earlybird_customer_email', customerEmail)

  const baseRequest = {
    orderId: buildOrderId(),
    orderName: ORDER_NAME,
    customerEmail,
    successUrl: `${window.location.origin}/payment-complete`,
    failUrl: `${window.location.origin}/payment-fail`,
  }

  if (isTestMode) {
    baseRequest.sandbox = { paymentResult: 'SUCCESS' }
  }

  // `gck` 키는 결제위젯 전용 키이므로 widgets API를 사용해야 합니다.
  if (clientKey.startsWith('test_gck_') || clientKey.startsWith('live_gck_')) {
    const widgets = tossPayments.widgets({ customerKey })
    await widgets.requestPaymentWindow({
      ...baseRequest,
      amount: {
        currency: 'KRW',
        value: EARLY_BIRD_AMOUNT,
      },
    })
    return
  }

  const payment = tossPayments.payment({ customerKey })
  await payment.requestPayment({
    ...baseRequest,
    method: 'CARD',
    amount: {
      currency: 'KRW',
      value: EARLY_BIRD_AMOUNT,
    },
  })
}
