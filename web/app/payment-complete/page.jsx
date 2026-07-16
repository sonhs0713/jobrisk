'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'

import RebuildFlowShell from '../../components/RebuildFlowShell'
import styles from '../../components/rebuild-flow-shell.module.css'
import { apiFetch } from '../../lib/api'
import { trackEventOnce } from '../../lib/analytics'

function PaymentCompleteContent() {
  const [state, setState] = useState({
    phase: 'verifying',
    error: '',
    detailUrl: '',
    showSlowHint: false,
    showRetry: false,
  })

  const retryHref = useMemo(() => {
    if (typeof window === 'undefined') return '/'
    return window.location.href
  }, [])

  useEffect(() => {
    let active = true
    let redirectTimer
    let statusTimer

    function moveToDetail(detailUrl) {
      if (!active) return

      setState({
        phase: 'redirecting',
        error: '',
        detailUrl,
        showSlowHint: false,
        showRetry: false,
      })

      redirectTimer = window.setTimeout(() => {
        window.location.replace(detailUrl)
      }, 900)
    }

    function scheduleStatusPoll(nextAnalysisId, token, detailUrl) {
      statusTimer = window.setTimeout(async () => {
        try {
          const status = await apiFetch(`/api/analyze/${nextAnalysisId}/detail-status?token=${encodeURIComponent(token)}`)
          if (!active) return

          if (status.detailStatus === 'ready') {
            moveToDetail(detailUrl)
            return
          }

          if (status.detailStatus === 'failed') {
            setState({
              phase: 'error',
              error: '상세 리포트 생성에 실패했습니다. 다시 시도해 주세요.',
              detailUrl: '',
              showSlowHint: false,
              showRetry: true,
            })
            return
          }

          scheduleStatusPoll(nextAnalysisId, token, detailUrl)
        } catch (err) {
          if (!active) return
          setState({
            phase: 'error',
            error: err.message || '상세 리포트 상태를 확인하는 중 문제가 발생했습니다.',
            detailUrl: '',
            showSlowHint: false,
            showRetry: true,
          })
        }
      }, 2000)
    }

    async function verify() {
      try {
        const params = new URLSearchParams(window.location.search)
        const paymentId = params.get('paymentId')
        const analysisId = params.get('analysisId')
        const amount = params.get('amount')
        const orderId = params.get('orderId')

        const data = await apiFetch('/api/payments/verify', {
          method: 'POST',
          body: JSON.stringify({ paymentId, analysisId, amount, orderId }),
        })

        if (!data.reportAccessToken) {
          throw new Error('상세 리포트 접근 토큰을 받지 못했습니다.')
        }

        const token = data.reportAccessToken
        const detailUrl = `/report/${data.analysisId}?token=${encodeURIComponent(token)}`
        const purchaseValue = Number(data.amount) || Number(amount || '') || 3000
        const purchaseCurrency = String(data.currency || 'KRW').trim() || 'KRW'

        trackEventOnce(`purchase:${orderId || paymentId || data.analysisId}`, 'purchase', {
          transaction_id: orderId || paymentId || data.analysisId,
          value: purchaseValue,
          currency: purchaseCurrency,
          items: [
            {
              item_id: 'jobrisk_paid_analysis',
              item_name: 'JOBRISK Paid Analysis',
              price: purchaseValue,
              quantity: 1,
            },
          ],
        })

        if (!active) return

        if (data.detailStatus === 'ready') {
          moveToDetail(detailUrl)
          return
        }

        setState({
          phase: 'generating',
          error: '',
          detailUrl,
          showSlowHint: false,
          showRetry: false,
        })

        scheduleStatusPoll(data.analysisId, token, detailUrl)
      } catch (err) {
        if (!active) return
        setState({
          phase: 'error',
          error: err.message || '결제 확인 중 문제가 발생했습니다.',
          detailUrl: '',
          showSlowHint: false,
          showRetry: true,
        })
      }
    }

    verify()

    const slowHintTimer = window.setTimeout(() => {
      if (!active) return
      setState((current) =>
        ['verifying', 'generating'].includes(current.phase) && !current.error ? { ...current, showSlowHint: true } : current,
      )
    }, 7000)

    const retryTimer = window.setTimeout(() => {
      if (!active) return
      setState((current) =>
        ['verifying', 'generating'].includes(current.phase) && !current.error ? { ...current, showRetry: true } : current,
      )
    }, 18000)

    return () => {
      active = false
      window.clearTimeout(slowHintTimer)
      window.clearTimeout(retryTimer)
      if (statusTimer) window.clearTimeout(statusTimer)
      if (redirectTimer) window.clearTimeout(redirectTimer)
    }
  }, [])

  const title = state.error ? '진행할 수 없습니다.' : '상세 리포트를 생성하고 있습니다'
  const body = state.error
    ? state.error
    : state.phase === 'redirecting'
      ? '결제가 확인되었습니다. 결과 페이지로 곧 이어집니다.'
      : '결제가 확인되었습니다. 공고 기준의 상세 리포트를 정리하고 있습니다.'
  const statusLabel = state.phase === 'redirecting' ? '결과 페이지로 이동하고 있습니다.' : 'AI가 리포트를 정리하고 있습니다.'
  const statusHint =
    state.phase === 'redirecting'
      ? '잠시만 기다리시면 자동으로 결과로 이어집니다.'
      : state.showSlowHint
        ? '분석이 조금 더 걸리고 있습니다. 창을 닫지 않으면 자동으로 결과로 이어집니다.'
        : '보통 30초에서 1분 정도 걸립니다. 창을 닫지 않으면 자동으로 결과로 이어집니다.'

  return (
    <RebuildFlowShell bodyClassName={styles.bodyNarrow}>
      <section className={styles.stateCard}>
        <span className={styles.stateEyebrow}>PAYMENT COMPLETE</span>
        <h1 className={styles.stateTitle}>{title}</h1>
        <p className={styles.stateBody}>{body}</p>

        {!state.error ? (
          <div className={styles.loadingCard} aria-live="polite">
            <div className={styles.spinner} aria-hidden="true" />
            <div className={styles.loadingCopy}>
              <strong>{statusLabel}</strong>
              <p>{statusHint}</p>
            </div>
          </div>
        ) : null}

        {state.showRetry ? (
          <div className={styles.actions}>
            <a className={styles.secondaryButton} href={retryHref}>
              다시 확인하기
            </a>
          </div>
        ) : null}
      </section>
    </RebuildFlowShell>
  )
}

function PaymentCompleteFallback() {
  return (
    <RebuildFlowShell bodyClassName={styles.bodyNarrow}>
      <section className={styles.stateCard}>
        <span className={styles.stateEyebrow}>PAYMENT COMPLETE</span>
        <h1 className={styles.stateTitle}>상세 리포트를 생성하고 있습니다</h1>
        <p className={styles.stateBody}>결제가 확인되었습니다. 공고 기준의 상세 리포트를 정리하고 있습니다.</p>
        <div className={styles.loadingCard} aria-live="polite">
          <div className={styles.spinner} aria-hidden="true" />
          <div className={styles.loadingCopy}>
            <strong>AI가 리포트를 정리하고 있습니다.</strong>
            <p>보통 30초에서 1분 정도 걸립니다. 창을 닫지 않으면 자동으로 결과로 이어집니다.</p>
          </div>
        </div>
      </section>
    </RebuildFlowShell>
  )
}

export default function PaymentCompletePage() {
  return (
    <Suspense fallback={<PaymentCompleteFallback />}>
      <PaymentCompleteContent />
    </Suspense>
  )
}
