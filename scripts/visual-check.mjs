import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const baseUrl = process.env.VISUAL_CHECK_BASE_URL || 'http://127.0.0.1:3000'
const reportUrl = process.env.VISUAL_CHECK_REPORT_URL || ''
const checkoutUrl = process.env.VISUAL_CHECK_CHECKOUT_URL || ''
const apiHealthUrl = process.env.VISUAL_CHECK_API_HEALTH_URL || 'http://127.0.0.1:4000/health'
const outputDir = path.resolve('artifacts', 'visual-check')

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true })
}

async function waitForUrl(url, timeoutMs = 30000) {
  const start = Date.now()
  let lastError = 'unknown error'

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url, { redirect: 'manual' })
      if (response.ok || (response.status >= 300 && response.status < 400)) {
        return
      }
      lastError = `HTTP ${response.status}`
    } catch (error) {
      lastError = error.message
    }

    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  throw new Error(`Could not reach ${url} within ${timeoutMs}ms (${lastError})`)
}

async function assertVisible(page, selector, label) {
  await page.waitForSelector(selector, { state: 'visible', timeout: 15000 })
  console.log(`OK: ${label}`)
}

async function assertNotVisible(page, selector, label) {
  const locator = page.locator(selector)
  const count = await locator.count()
  if (count > 0 && (await locator.first().isVisible())) {
    throw new Error(`Unexpected state: ${label}`)
  }
  console.log(`OK: ${label} not visible`)
}

async function saveFailureArtifacts(page, name) {
  const screenshotPath = path.join(outputDir, `${name}-failure.png`)
  const htmlPath = path.join(outputDir, `${name}-failure.html`)
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {})
  const html = await page.content().catch(() => '')
  if (html) {
    await fs.writeFile(htmlPath, html, 'utf8').catch(() => {})
  }
  console.log(`Saved failure artifacts: ${screenshotPath}`)
}

async function capturePage(page, { url, name, checks, rejectChecks = [] }) {
  console.log(`\nChecking ${name}: ${url}`)
  await waitForUrl(url)
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })

  try {
    for (const rejectCheck of rejectChecks) {
      await assertNotVisible(page, rejectCheck.selector, rejectCheck.label)
    }

    for (const check of checks) {
      await assertVisible(page, check.selector, check.label)
    }
  } catch (error) {
    await saveFailureArtifacts(page, name)
    throw error
  }

  const screenshotPath = path.join(outputDir, `${name}.png`)
  await page.screenshot({ path: screenshotPath, fullPage: true })
  console.log(`Saved screenshot: ${screenshotPath}`)
}

async function main() {
  await ensureDir(outputDir)

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 2200 } })

  try {
    await capturePage(page, {
      url: baseUrl,
      name: 'home',
      rejectChecks: [{ selector: 'text=Internal Server Error', label: 'home error page' }],
      checks: [
        { selector: '.landing-hero h1', label: 'landing hero headline' },
        { selector: '.hero-report-card', label: 'hero result example card' },
        { selector: '#analyze textarea', label: 'job posting textarea' },
        { selector: '.analysis-preview-card', label: 'free result example card' },
        { selector: '#criteria .criteria-item', label: 'criteria cards' },
        { selector: '.final-cta-card', label: 'final CTA card' },
      ],
    })

    if (reportUrl) {
      await waitForUrl(apiHealthUrl)
      await capturePage(page, {
        url: reportUrl,
        name: 'report',
        rejectChecks: [
          { selector: 'text=리포트를 찾을 수 없습니다.', label: 'report error state' },
          { selector: 'text=Internal Server Error', label: 'report internal server error' },
        ],
        checks: [
          { selector: '.report-hero h1', label: 'report headline' },
          { selector: '.report-summary-box', label: 'report summary checklist' },
          { selector: '#report-checklist-heading', label: 'report checklist heading' },
          { selector: '#deep-dive-heading', label: 'deep dive section' },
          { selector: '#questions-heading', label: 'interview questions section' },
        ],
      })
    } else {
      console.log('\nSkipped report page check. Set VISUAL_CHECK_REPORT_URL to include it.')
    }

    if (checkoutUrl) {
      await capturePage(page, {
        url: checkoutUrl,
        name: 'checkout',
        rejectChecks: [{ selector: 'text=Internal Server Error', label: 'checkout error page' }],
        checks: [
          { selector: '.report-state-card h1', label: 'checkout headline' },
          { selector: '.briefing-bullets', label: 'checkout bullet list' },
        ],
      })
    } else {
      console.log('\nSkipped checkout page check. Set VISUAL_CHECK_CHECKOUT_URL to include it.')
    }
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
