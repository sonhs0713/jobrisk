'use client'

import { useEffect, useRef, useState } from 'react'

import SiteFooter from '../../components/SiteFooter'
import SiteHeader from '../../components/SiteHeader'
import { allowedTemplates } from '../../../shared/persuasionPolicy.js'
import { apiFetch } from '../../lib/api'
import { requestJobRiskPayment } from '../../lib/payments'

function buildReportUrl(analysisId, token) {
  return `/report/${analysisId}?token=${encodeURIComponent(token)}`
}

function buildPaymentCompleteUrl({ paymentId, analysisId, amount, orderId }) {
  return `/payment-complete?paymentId=${encodeURIComponent(paymentId)}&analysisId=${encodeURIComponent(analysisId)}&amount=${encodeURIComponent(amount || '')}&orderId=${encodeURIComponent(orderId)}`
}

export default function CheckoutPage() {
  const startedRef = useRef(false)
  const [status, setStatus] = useState('결제를 준비하고 있습니다.')
  const [error, setError] = useState('')
  const isLoading = !error

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    const params = new URLSearchParams(window.location.search)
    const mode = params.get('mode') || 'card'
    const analysisId = String(params.get('analysisId') || '').trim()
    const customerEmail = String(params.get('email') || '').trim()

    async function start() {
      if (!analysisId) {
        throw new Error('분석 결과 ID가 없어 결제를 시작할 수 없습니다.')
      }

      const prepared = await apiFetch('/api/payments/prepare', {
        method: 'POST',
        body: JSON.stringify({ analysisId, customerEmail }),
      })

      if (mode === 'dev') {
        setStatus('분석 결과를 정리하고 있습니다.')
        const verified = await apiFetch('/api/payments/verify', {
          method: 'POST',
          body: JSON.stringify({
            paymentId: `dev_${prepared.orderId}`,
            analysisId,
            orderId: prepared.orderId,
          }),
        })

        if (!verified.reportAccessToken) {
          throw new Error('상세 리포트 접근 토큰을 받지 못했습니다.')
        }

        if (verified.detailStatus === 'ready') {
          window.location.replace(buildReportUrl(verified.analysisId || analysisId, verified.reportAccessToken))
          return
        }

        window.location.replace(
          buildPaymentCompleteUrl({
            paymentId: `dev_${prepared.orderId}`,
            analysisId: verified.analysisId || analysisId,
            amount: prepared.amount,
            orderId: prepared.orderId,
          }),
        )
        return
      }

      setStatus('결제 정보를 확인하고 있습니다.')
      await requestJobRiskPayment({
        analysisId,
        orderId: prepared.orderId,
        amount: prepared.amount,
        customerEmail,
      })
    }

    start().catch((err) => {
      setError(err.message || '결제 준비 중 문제가 발생했습니다.')
      setStatus('')
    })
  }, [])

  return (
    <>
      <SiteHeader variant="landing" />
      <main className="report-page report-state-page">
        <section className="report-state-card">
          <p className="report-kicker">JobRisk 결제 준비</p>
          <h1>{error ? '진행할 수 없습니다.' : allowedTemplates.checkout.title}</h1>
          <p>{error || allowedTemplates.checkout.body}</p>
          {!error ? (
            <div className="report-state-loading" aria-live="polite">
              <div className="report-state-spinner" aria-hidden="true" />
              <div className="report-state-copy">
                <strong>{status || '분석 결과를 정리하고 있습니다.'}</strong>
                <p>보통 5~10초 정도 걸립니다.</p>
              </div>
            </div>
          ) : null}
          {!error ? (
            <ul className="briefing-bullets report-state-bullets" aria-hidden={isLoading ? 'true' : undefined}>
              {allowedTemplates.checkout.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
