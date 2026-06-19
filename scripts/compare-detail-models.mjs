import 'dotenv/config'
import fs from 'node:fs/promises'
import path from 'node:path'

import { buildDetailReport, buildPreview, DETAIL_MODEL, PREVIEW_MODEL } from '../server/src/lib/analysis.js'

const GOLDEN_SET_PATH = path.resolve('server/test/fixtures/golden-set/golden-set-v3.confirmed.json')
const EXTRA_GOLDEN_SET_PATH = path.resolve('server/test/fixtures/golden-set/extra/jobrisk_golden_set_extra.json')
const DEFAULT_OUTPUT_DIR = path.resolve('tmp/model-compare')
const DEFAULT_MODELS = ['gpt-5.2', 'gpt-5-mini']
const DEFAULT_SAMPLE_IDS = ['good_pm_regular_official', 'risky_dispatch_freelance_personal_email', 'W019', 'W061']

function parseArgs(argv) {
  const args = {
    models: [...DEFAULT_MODELS],
    sampleIds: [...DEFAULT_SAMPLE_IDS],
    outputPath: '',
    maxOutputTokens: null,
  }

  for (const item of argv) {
    if (item === '--help' || item === '-h') args.help = true
    else if (item.startsWith('--models=')) {
      args.models = item
        .slice('--models='.length)
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
    } else if (item.startsWith('--sample-ids=')) {
      args.sampleIds = item
        .slice('--sample-ids='.length)
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
    } else if (item.startsWith('--max-output-tokens=')) {
      args.maxOutputTokens = Number(item.slice('--max-output-tokens='.length))
    } else if (item.startsWith('--output=')) {
      args.outputPath = path.resolve(item.slice('--output='.length))
    } else {
      throw new Error(`Unknown option: ${item}`)
    }
  }

  if (!args.models.length) throw new Error('At least one model is required')
  if (!args.sampleIds.length) throw new Error('At least one sample id is required')
  if (
    args.maxOutputTokens != null &&
    (!Number.isInteger(args.maxOutputTokens) || args.maxOutputTokens <= 0)
  ) {
    throw new Error('Invalid --max-output-tokens value')
  }

  return args
}

function printUsage() {
  console.log(`Usage:
  node scripts/compare-detail-models.mjs
  node scripts/compare-detail-models.mjs --models=gpt-5.2,gpt-5-mini
  node scripts/compare-detail-models.mjs --sample-ids=good_pm_regular_official,W019
  node scripts/compare-detail-models.mjs --max-output-tokens=3500

Options:
  --models=MODEL1,MODEL2
  --sample-ids=ID1,ID2
  --max-output-tokens=NUMBER
  --output=PATH_TO_JSON`)
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'))
}

async function loadSamples(sampleIds) {
  const [goldenSet, extraSet] = await Promise.all([readJson(GOLDEN_SET_PATH), readJson(EXTRA_GOLDEN_SET_PATH)])
  const index = new Map()

  for (const sample of goldenSet.samples || []) {
    index.set(sample.id, {
      sampleId: sample.id,
      title: sample.title || sample.id,
      source: 'golden-set-v3',
      expectedRisk: sample.expected_risk || null,
      expectedJobFamily: sample.expected_job_family || null,
      postingText: sample.posting_text || '',
    })
  }

  for (const sample of extraSet.samples || []) {
    index.set(sample.sample_id, {
      sampleId: sample.sample_id,
      title: sample.title || sample.sample_id,
      source: 'golden-set-extra',
      expectedRisk: sample.expected_risk_level || null,
      expectedJobFamily: sample.expected_job_family || null,
      postingText: sample.posting_text || '',
    })
  }

  return sampleIds.map((sampleId) => {
    const sample = index.get(sampleId)
    if (!sample) throw new Error(`Sample not found: ${sampleId}`)
    if (!sample.postingText || sample.postingText.trim().length < 40) {
      throw new Error(`Sample has no usable posting text: ${sampleId}`)
    }
    return sample
  })
}

function timestampForFile(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
}

function detectQuestionRetention(detail) {
  const questionTexts = [
    ...(detail?.interviewQuestions || []).map((item) => item?.question || ''),
    ...(detail?.auxiliaryChecks || []).map((item) => item?.question || ''),
  ].join('\n')

  return {
    hasContractQuestion: /(계약|고용 형태|정규직|파견|프리랜서|소속)/.test(questionTexts),
    hasCompensationQuestion: /(보수|연봉|급여|처우)/.test(questionTexts),
    hasAuthorityQuestion: /(권한|의사결정|우선순위|오너십|주도|로드맵)/.test(questionTexts),
  }
}

function summarizeDetail(detailResult, durationMs) {
  const detail = detailResult?.detail || {}
  const usage = detailResult?.openAiUsage || {}
  const retention = detectQuestionRetention(detail)

  return {
    durationMs,
    engine: detailResult?.engine || null,
    inputTokens: usage.inputTokens ?? null,
    outputTokens: usage.outputTokens ?? null,
    totalTokens: usage.totalTokens ?? null,
    outputChars: detailResult?.openAiOutputChars ?? null,
    openAiErrorStage: detailResult?.openAiErrorStage ?? null,
    finalSummary: detail.finalSummary || '',
    jobFamily: detail.jobFamily?.id || null,
    riskLevels: (detail.sevenAxes || []).map((axis) => ({
      key: axis.key,
      level: axis.level,
      levelLabel: axis.levelLabel,
    })),
    keyEvidenceQuotes: (detail.keyEvidence || []).map((item) => item.quote).filter(Boolean),
    interviewQuestions: (detail.interviewQuestions || []).map((item) => item.question).filter(Boolean),
    auxiliaryQuestions: (detail.auxiliaryChecks || []).map((item) => item.question).filter(Boolean),
    retention,
  }
}

async function prepareAnalysisSample(sample) {
  const previewStartedAt = Date.now()
  const preview = await buildPreview({ jobPostingText: sample.postingText })
  const previewDurationMs = Date.now() - previewStartedAt

  return {
    sampleId: sample.sampleId,
    title: sample.title,
    source: sample.source,
    expectedRisk: sample.expectedRisk,
    expectedJobFamily: sample.expectedJobFamily,
    postingChars: sample.postingText.length,
    previewDurationMs,
    previewEngine: preview.engine,
    previewRiskLevel: preview.freePreview?.riskLevel || null,
    previewRiskLabel: preview.freePreview?.riskLevelLabel || null,
    analysis: {
      structured: preview.structured,
      freePreview: preview.freePreview,
    },
  }
}

async function runComparisonForSample(preparedSample, models, maxOutputTokens) {
  const byModel = {}

  for (const model of models) {
    console.log(`Running detail compare: ${preparedSample.sampleId} -> ${model}`)
    const startedAt = Date.now()
    const detailResult = await buildDetailReport(
      { analysis: preparedSample.analysis },
      {
        debug: true,
        llmModelOverride: model,
        llmMaxOutputTokens: maxOutputTokens,
      },
    )
    const durationMs = Date.now() - startedAt
    byModel[model] = summarizeDetail(detailResult, durationMs)
  }

  return {
    sampleId: preparedSample.sampleId,
    title: preparedSample.title,
    source: preparedSample.source,
    expectedRisk: preparedSample.expectedRisk,
    expectedJobFamily: preparedSample.expectedJobFamily,
    postingChars: preparedSample.postingChars,
    previewDurationMs: preparedSample.previewDurationMs,
    previewEngine: preparedSample.previewEngine,
    previewRiskLevel: preparedSample.previewRiskLevel,
    previewRiskLabel: preparedSample.previewRiskLabel,
    models: byModel,
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printUsage()
    return
  }

  const samples = await loadSamples(args.sampleIds)
  const preparedSamples = []
  for (const sample of samples) {
    console.log(`Preparing sample: ${sample.sampleId}`)
    preparedSamples.push(await prepareAnalysisSample(sample))
  }

  const results = []
  for (const preparedSample of preparedSamples) {
    results.push(await runComparisonForSample(preparedSample, args.models, args.maxOutputTokens))
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    config: {
      previewModel: PREVIEW_MODEL,
      detailModelDefault: DETAIL_MODEL,
      models: args.models,
      sampleIds: args.sampleIds,
      maxOutputTokens: args.maxOutputTokens,
    },
    results,
  }

  const outputPath = args.outputPath || path.join(DEFAULT_OUTPUT_DIR, `compare-detail-models-${timestampForFile()}.json`)
  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')

  console.log(`Saved JSON: ${outputPath}`)
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error))
  process.exitCode = 1
})
