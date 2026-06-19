import assert from 'node:assert/strict'
import { test } from 'node:test'

import { bannedPhrases, claimStrengthRules, validatePersuasionCopy } from '../../shared/persuasionPolicy.js'

test('validatePersuasionCopy blocks banned pressure and social proof phrases', () => {
  const result = validatePersuasionCopy('지금 결제해야 손해를 피할 수 있습니다. 많은 지원자가 이미 확인하고 있습니다.', {
    surface: 'checkout',
    claimStrength: 'blocked',
  })

  assert.equal(result.ok, false)
  assert.equal(result.violations.some((item) => item.type === 'banned_phrase'), true)
  assert.equal(result.violations.some((item) => item.type === 'pressure_language'), true)
  assert.equal(result.violations.some((item) => item.type === 'social_proof_blocked'), true)
})

test('validatePersuasionCopy requires evidence for strict evidence claims', () => {
  const result = validatePersuasionCopy('성과 설명 기회는 있습니다.', {
    surface: 'preview',
    claimStrength: 'strict_evidence',
    hasEvidence: false,
  })

  assert.equal(claimStrengthRules.strict_evidence.requiresEvidence, true)
  assert.equal(result.ok, false)
  assert.equal(result.violations.some((item) => item.type === 'missing_evidence_for_strong_claim'), true)
})

test('validatePersuasionCopy allows soft inference without pressure language', () => {
  const result = validatePersuasionCopy('면접에서 권한 범위를 추가 확인하는 것이 안전합니다.', {
    surface: 'preview',
    claimStrength: 'soft_inference',
  })

  assert.equal(result.ok, true)
  assert.equal(bannedPhrases.includes('지금 결제'), true)
})
