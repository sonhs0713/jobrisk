const ONCE_PREFIX = 'jobrisk:analytics:once:'
const DEBUG_HISTORY_PREFIX = 'jobrisk:analytics:debug:history'

function canUseBrowser() {
  return typeof window !== 'undefined'
}

function hasGtag() {
  return canUseBrowser() && typeof window.gtag === 'function'
}

function getStorage() {
  if (!canUseBrowser()) return null

  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

function shouldDebugAnalytics() {
  if (!canUseBrowser()) return false

  try {
    const search = new URLSearchParams(window.location.search)
    if (search.get('debug_analytics') === '1') return true
    if (window.localStorage?.getItem('jobrisk:analytics:debug') === '1') return true
  } catch {
    return false
  }

  return false
}

function recordDebugEvent(name, params) {
  if (!canUseBrowser()) return

  const entry = {
    name,
    params,
    recordedAt: new Date().toISOString(),
  }

  window.__JOBRISK_ANALYTICS_LAST_EVENT__ = entry

  const storage = getStorage()
  if (storage) {
    try {
      const history = JSON.parse(storage.getItem(DEBUG_HISTORY_PREFIX) || '[]')
      const nextHistory = [entry, ...history].slice(0, 10)
      storage.setItem(DEBUG_HISTORY_PREFIX, JSON.stringify(nextHistory))
    } catch {
      storage.removeItem(DEBUG_HISTORY_PREFIX)
    }
  }

  if (shouldDebugAnalytics()) {
    console.info('[jobrisk][analytics]', entry)
  }
}

export function trackEvent(name, params = {}) {
  if (!hasGtag()) return false
  recordDebugEvent(name, params)
  window.gtag('event', name, params)
  return true
}

export function trackEventOnce(key, name, params = {}) {
  const storage = getStorage()
  const storageKey = `${ONCE_PREFIX}${key}`

  if (storage?.getItem(storageKey)) return false

  const tracked = trackEvent(name, params)
  if (!tracked) return false

  storage?.setItem(storageKey, '1')
  return true
}
