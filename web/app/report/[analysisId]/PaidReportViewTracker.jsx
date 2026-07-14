'use client'

import { useEffect } from 'react'

import { trackEventOnce } from '../../../lib/analytics'

export default function PaidReportViewTracker({ analysisId }) {
  useEffect(() => {
    if (!analysisId) return

    trackEventOnce(`paid_report_viewed:${analysisId}`, 'paid_report_viewed', {
      analysis_id: analysisId,
      report_type: 'paid',
    })
  }, [analysisId])

  return null
}
