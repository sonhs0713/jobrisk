const EARLY_BIRD_AMOUNT = 3000
const ORDER_NAME = '채용공고 분석 서비스 얼리버드 등록'
const OFFER_PERIOD_TEXT = '결제 후 1시간 이내 (평일 10시~18시)'
const DEFAULT_KCP_SCRIPT_URL = 'https://spay.kcp.co.kr/plugin/kcp_spay_hub.js'

function buildOrderId() {
  const random = Math.random().toString(36).slice(2, 10)
  return `earlybird_${Date.now()}_${random}`
}

function appendHiddenInput(form, name, value) {
  const input = document.createElement('input')
  input.type = 'hidden'
  input.name = name
  input.value = value
  form.appendChild(input)
}

function isScriptLoaded(scriptElement) {
  if (!scriptElement) return false
  if (scriptElement.dataset.loaded === 'true') return true
  return scriptElement.readyState === 'loaded' || scriptElement.readyState === 'complete'
}

function isKcpRuntimeReady() {
  return (
    typeof window.KCP_Pay_Execute_Web === 'function' &&
    typeof window.chkAvailablePostMessage === 'function'
  )
}

function ensureKcpScript(scriptUrl) {
  return new Promise((resolve, reject) => {
    if (canUseKcpPopupExecute()) {
      resolve()
      return
    }

    const existing = document.querySelector(`script[data-kcp-script="true"]`)
    if (existing) {
      if (isScriptLoaded(existing)) {
        resolve()
        return
      }
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('KCP 스크립트 로드에 실패했습니다.')), {
        once: true,
      })
      return
    }

    const script = document.createElement('script')
    script.src = scriptUrl
    script.async = true
    script.dataset.kcpScript = 'true'
    script.onload = () => {
      script.dataset.loaded = 'true'
      resolve()
    }
    script.onerror = () => reject(new Error('KCP 스크립트 로드에 실패했습니다.'))
    document.head.appendChild(script)
  })
}

function waitForKcpExecuteReady(timeoutMs = 10000, intervalMs = 100) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now()

    const timer = window.setInterval(() => {
      if (isKcpRuntimeReady()) {
        window.clearInterval(timer)
        resolve()
        return
      }

      if (Date.now() - startedAt >= timeoutMs) {
        window.clearInterval(timer)
        reject(new Error('KCP 결제 스크립트 초기화가 지연되고 있습니다. 잠시 후 다시 시도해주세요.'))
      }
    }, intervalMs)
  })
}

function canUseKcpPopupExecute() {
  return typeof window.KCP_Pay_Execute_Web === 'function'
}

export async function requestEarlyBirdPayment(customerEmail) {
  const siteCode = import.meta.env.VITE_KCP_SITE_CODE
  const scriptUrl = import.meta.env.VITE_KCP_JS_URL || DEFAULT_KCP_SCRIPT_URL

  if (!siteCode) {
    throw new Error('KCP Site Code가 설정되지 않았습니다.')
  }

  const orderId = buildOrderId()
  const amount = String(EARLY_BIRD_AMOUNT)

  // 결제 완료 페이지에서 사용할 값을 보관합니다.
  sessionStorage.setItem('earlybird_customer_email', customerEmail)
  sessionStorage.setItem('earlybird_order_id', orderId)
  sessionStorage.setItem('earlybird_amount', amount)

  await ensureKcpScript(scriptUrl)
  await waitForKcpExecuteReady()

  const form = document.createElement('form')
  form.name = 'order_info'
  form.method = 'POST'
  form.acceptCharset = 'utf-8'
  form.action = window.location.href
  form.style.display = 'none'

  appendHiddenInput(form, 'site_cd', siteCode)
  appendHiddenInput(form, 'site_name', 'MUNO')
  appendHiddenInput(form, 'ordr_idxx', orderId)
  appendHiddenInput(form, 'good_name', ORDER_NAME)
  appendHiddenInput(form, 'good_mny', amount)
  appendHiddenInput(form, 'good_expr', '1')
  appendHiddenInput(form, 'offerPeriod', OFFER_PERIOD_TEXT)
  appendHiddenInput(form, 'offer_period', OFFER_PERIOD_TEXT)
  appendHiddenInput(form, 'buyr_mail', customerEmail)
  appendHiddenInput(form, 'Ret_URL', `${window.location.origin}/payment-complete`)
  appendHiddenInput(form, 'pay_method', '100000000000')
  appendHiddenInput(form, 'currency', '410')

  document.body.appendChild(form)

  if (canUseKcpPopupExecute()) {
    try {
      window.KCP_Pay_Execute_Web(form)
      return
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      if (message.includes('chkAvailablePostMessage')) {
        await waitForKcpExecuteReady(4000, 80)
        window.KCP_Pay_Execute_Web(form)
        return
      }
      const detail = error instanceof Error && error.message ? ` (${error.message})` : ''
      throw new Error(`KCP 결제창 실행에 실패했습니다. 스크립트 설정을 확인해주세요.${detail}`)
    }
  }

  throw new Error('KCP 결제 스크립트가 로드되지 않았습니다. VITE_KCP_JS_URL을 확인해주세요.')
}
