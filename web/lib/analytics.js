const ONCE_PREFIX = 'jobrisk:analytics:once:'

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

export function trackEvent(name, params = {}) {
  if (!hasGtag()) return false
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
