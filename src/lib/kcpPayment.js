const EARLY_BIRD_AMOUNT = 3000
const ORDER_NAME = 'JOBRISK 물경력 가능성 상세 분석(얼리버드)'
const OFFER_PERIOD_TEXT = '결제 직후 웹 화면에서 결과 확인'
const DEFAULT_KCP_SCRIPT_URL = 'https://spay.kcp.co.kr/plugin/kcp_spay_hub.js'
const TEST_KCP_SCRIPT_URL = 'https://testspay.kcp.co.kr/plugin/kcp_spay_hub.js'

function buildOrderId() {
  const random = Math.random().toString(36).slice(2, 10)
  return `earlybird_${Date.now()}_${random}`
}

function appendHiddenInput(form, name, value) {
  const existing = form.querySelector(`input[name="${name}"]`)
  if (existing) {
    existing.value = value
    return
  }

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

function isLikelyTestSiteCode(siteCode) {
  return String(siteCode || '')
    .trim()
    .toUpperCase()
    .startsWith('T')
}

function resolveKcpScriptUrl(siteCode) {
  const configured = import.meta.env.VITE_KCP_JS_URL
  if (configured) return configured
  return isLikelyTestSiteCode(siteCode) ? TEST_KCP_SCRIPT_URL : DEFAULT_KCP_SCRIPT_URL
}

function getKcpFieldValue(payload, key) {
  if (!payload || !key) return ''

  const direct = payload[key]
  if (typeof direct === 'string' || typeof direct === 'number') return String(direct)
  if (direct && typeof direct.value !== 'undefined') return String(direct.value)

  if (typeof payload.get === 'function') {
    const fromGet = payload.get(key)
    if (typeof fromGet !== 'undefined' && fromGet !== null) return String(fromGet)
  }

  return ''
}

function installKcpCompletePaymentHandler(form, callbackUrl) {
  window.m_Completepayment = (payload) => {
    const keysToForward = [
      'res_cd',
      'res_msg',
      'tran_cd',
      'enc_data',
      'enc_info',
      'ordr_idxx',
      'good_mny',
      'pay_method',
      'site_cd',
    ]

    keysToForward.forEach((key) => {
      const value = getKcpFieldValue(payload, key)
      if (value) appendHiddenInput(form, key, value)
    })

    if (payload && typeof payload.submit === 'function') {
      payload.action = callbackUrl
      payload.method = 'POST'
      payload.acceptCharset = 'utf-8'
      payload.submit()
      return
    }

    form.action = callbackUrl
    form.submit()
  }
}

export async function requestEarlyBirdPayment(customerEmail) {
  const siteCode = import.meta.env.VITE_KCP_SITE_CODE
  const scriptUrl = resolveKcpScriptUrl(siteCode)

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
  // KCP 결제 결과 콜백을 받을 서버 엔드포인트입니다.
  const callbackUrl = `${window.location.origin}/api/kcp/return`
  form.action = callbackUrl
  form.style.display = 'none'

  appendHiddenInput(form, 'site_cd', siteCode)
  appendHiddenInput(form, 'site_name', 'MUNO')
  appendHiddenInput(form, 'ordr_idxx', orderId)
  appendHiddenInput(form, 'good_name', ORDER_NAME)
  appendHiddenInput(form, 'good_mny', amount)
  appendHiddenInput(form, 'good_expr', '0')
  appendHiddenInput(form, 'offerPeriod', OFFER_PERIOD_TEXT)
  appendHiddenInput(form, 'offer_period', OFFER_PERIOD_TEXT)
  appendHiddenInput(form, 'buyr_mail', customerEmail)
  // KCP는 Ret_URL로 POST를 보내므로 서버 엔드포인트에서 먼저 수신해야 합니다.
  appendHiddenInput(form, 'Ret_URL', callbackUrl)
  appendHiddenInput(form, 'pay_method', '100000000000')
  appendHiddenInput(form, 'currency', '410')

  document.body.appendChild(form)
  installKcpCompletePaymentHandler(form, callbackUrl)

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
