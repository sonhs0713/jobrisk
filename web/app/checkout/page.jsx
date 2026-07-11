'use client'

import { useEffect, useRef, useState } from 'react'

import RebuildFlowShell from '../../components/RebuildFlowShell'
import styles from '../../components/rebuild-flow-shell.module.css'
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
  const [status, setStatus] = useState('공고 근거를 바탕으로 상세 분석을 준비하고 있습니다.')
  const [error, setError] = useState('')

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    const params = new URLSearchParams(window.location.search)
    const mode = params.get('mode') || 'card'
    const analysisId = String(params.get('analysisId') || '').trim()
    const customerEmail = String(params.get('email') || '').trim()

    async function start() {
      if (!analysisId) {
        throw new Error('분석 결과가 없어 상세 리포트를 시작할 수 없습니다.')
      }

      if (!customerEmail) {
        throw new Error('메인 페이지에서 이메일 주소를 먼저 입력해 주세요.')
      }

      const prepared = await apiFetch('/api/payments/prepare', {
        method: 'POST',
        body: JSON.stringify({ analysisId, customerEmail }),
      })

      if (mode === 'dev') {
        setStatus('면접 질문과 답변 해석 기준을 정리하고 있습니다.')
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
      setError(err.message || '유료 분석 준비 중 문제가 발생했습니다.')
      setStatus('')
    })
  }, [])

  return (
    <RebuildFlowShell bodyClassName={styles.bodyNarrow}>
      <section className={styles.stateCard}>
        <span className={styles.stateEyebrow}>{error ? 'ENTRY CHECK' : 'PAID ANALYSIS'}</span>
        <h1 className={styles.stateTitle}>{error ? '진행할 수 없습니다.' : '상세 분석을 준비하고 있습니다.'}</h1>
        <p className={styles.stateBody}>
          {error || '공고 근거를 바탕으로 면접 질문, 답변 해석 기준, 최종 판단 가이드를 정리하는 중입니다.'}
        </p>

        {!error ? (
          <>
            <div aria-live="polite" className={styles.loadingCard}>
              <div aria-hidden="true" className={styles.spinner} />
              <div className={styles.loadingCopy}>
                <strong>{status || '상세 리포트를 준비하고 있습니다.'}</strong>
                <p>보통 5~10초 정도 걸립니다.</p>
              </div>
            </div>

            <div className={styles.note}>
              <p>입력한 이메일을 기준으로 상세 리포트 접근 정보를 연결합니다. 잠시만 기다리시면 자동으로 다음 단계로 이동합니다.</p>
            </div>
          </>
        ) : (
          <div className={styles.actions}>
            <a className={styles.primaryButton} href="/#free-analysis">
              메인 페이지로 돌아가기
            </a>
          </div>
        )}
      </section>
    </RebuildFlowShell>
  )
}
