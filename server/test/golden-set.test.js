import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const goldenSetPath = path.resolve(__dirname, 'fixtures/golden-set/golden-set-v3.confirmed.json')
const extraGoldenSetDir = path.resolve(__dirname, 'fixtures/golden-set/extra')

function loadGoldenSet() {
  assert.equal(fs.existsSync(goldenSetPath), true, 'Run npm run golden:sync before npm test')
  return JSON.parse(fs.readFileSync(goldenSetPath, 'utf8'))
}

function loadExtraGoldenSets() {
  if (!fs.existsSync(extraGoldenSetDir)) return []
  return fs
    .readdirSync(extraGoldenSetDir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => JSON.parse(fs.readFileSync(path.join(extraGoldenSetDir, name), 'utf8')))
}

test('golden set JSON has the expected structure', () => {
  const goldenSet = loadGoldenSet()
  assert.equal(goldenSet.schemaVersion, 'jobrisk-golden-set-v3')
  assert.equal(goldenSet.sourceSheet, 'GoldenSet_v3_10')
  assert.equal(Array.isArray(goldenSet.samples), true)
  assert.equal(goldenSet.samples.length > 0, true)
  for (const sample of goldenSet.samples) {
    assert.equal(typeof sample.id, 'string')
    assert.equal(typeof sample.expected_risk, 'string')
    assert.equal(typeof sample.posting_text, 'string')
  }
})

test('golden set JSON includes only CONFIRMED rows', () => {
  const goldenSet = loadGoldenSet()
  assert.equal(goldenSet.samples.every((sample) => sample.label_status === 'CONFIRMED'), true)
  assert.equal(goldenSet.samples.length, goldenSet.summary.exportedRows)
  assert.equal(goldenSet.summary.confirmedRows, goldenSet.summary.exportedRows)
})

test('golden set confirmed samples all include posting_text', () => {
  const goldenSet = loadGoldenSet()
  const missing = goldenSet.samples.filter((sample) => !String(sample.posting_text || '').trim())
  assert.equal(missing.length, goldenSet.summary.missingPostingTextCount)
  assert.equal(missing.length, 0)
})

test('extra golden set JSON files have executable sample structure', () => {
  const extraSets = loadExtraGoldenSets()
  assert.equal(extraSets.length > 0, true)
  for (const extraSet of extraSets) {
    assert.equal(Array.isArray(extraSet.samples), true)
    for (const sample of extraSet.samples) {
      assert.equal(typeof (sample.sample_id || sample.id), 'string')
      assert.equal(typeof sample.posting_text, 'string')
      assert.equal(Array.isArray(sample.must_include), true)
      assert.equal(Array.isArray(sample.must_not_include), true)
      assert.equal(Array.isArray(sample.expected_questions), true)
      if (sample.must_not_job_family != null) assert.equal(Array.isArray(sample.must_not_job_family), true)
      if (sample.required_report_type != null) assert.equal(Array.isArray(sample.required_report_type), true)
      if (sample.forbidden_report_type != null) assert.equal(Array.isArray(sample.forbidden_report_type), true)
    }
  }
})
