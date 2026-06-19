import 'dotenv/config'
import fs from 'node:fs/promises'
import path from 'node:path'

import {
  DETAIL_MODEL,
  DETAIL_RESPONSE_FORMAT,
  PREVIEW_MODEL,
  buildDetailReport,
  buildPreview,
  callOpenAiDebug,
} from '../server/src/lib/analysis.js'

const DEFAULT_BASELINE_PROMPT_PATH = path.resolve('scripts/baseline_prompt_v1.template.md')
const DEFAULT_OUTPUT_DIR = path.resolve('tmp/compare-baseline')
const TEMPLATE_SENTINEL = 'TODO_REPLACE_WITH_YOUR_BASELINE_PROMPT_V1'

function printUsage() {
  console.log(`Usage:
  node scripts/compare-baseline-prompt.js --stdin [--same-model=gpt-5.2]
  node scripts/compare-baseline-prompt.js --input=path/to/posting.txt [--baseline-prompt-file=path/to/prompt.md]

Options:
  --stdin
  --input=PATH
  --baseline-prompt-file=PATH
  --same-model=MODEL
  --current-preview-model=MODEL
  --current-detail-model=MODEL
  --baseline-model=MODEL
  --adapter-model=MODEL
  --temperature=NUMBER
  --max-output-tokens=NUMBER
  --conditional-llm-risk-override
  --with-detail
  --with-adapt
  --full
  --output=PATH_TO_JSON`)
}

function parseArgs(argv) {
  const args = {
    stdin: false,
    inputPath: '',
    baselinePromptPath: DEFAULT_BASELINE_PROMPT_PATH,
    sameModel: '',
    currentPreviewModel: '',
    currentDetailModel: '',
    baselineModel: '',
    adapterModel: '',
    temperature: null,
    maxOutputTokens: null,
    conditionalLlmRiskOverride: false,
    withDetail: false,
    withAdapt: false,
    full: false,
    outputPath: '',
  }

  for (const item of argv) {
    if (item === '--stdin') args.stdin = true
    else if (item === '--help' || item === '-h') args.help = true
    else if (item === '--with-detail') args.withDetail = true
    else if (item === '--with-adapt') args.withAdapt = true
    else if (item === '--full') args.full = true
    else if (item === '--conditional-llm-risk-override') args.conditionalLlmRiskOverride = true
    else if (item.startsWith('--input=')) args.inputPath = path.resolve(item.slice('--input='.length))
    else if (item.startsWith('--baseline-prompt-file=')) args.baselinePromptPath = path.resolve(item.slice('--baseline-prompt-file='.length))
    else if (item.startsWith('--same-model=')) args.sameModel = item.slice('--same-model='.length).trim()
    else if (item.startsWith('--current-preview-model=')) args.currentPreviewModel = item.slice('--current-preview-model='.length).trim()
    else if (item.startsWith('--current-detail-model=')) args.currentDetailModel = item.slice('--current-detail-model='.length).trim()
    else if (item.startsWith('--baseline-model=')) args.baselineModel = item.slice('--baseline-model='.length).trim()
    else if (item.startsWith('--adapter-model=')) args.adapterModel = item.slice('--adapter-model='.length).trim()
    else if (item.startsWith('--temperature=')) args.temperature = Number(item.slice('--temperature='.length))
    else if (item.startsWith('--max-output-tokens=')) args.maxOutputTokens = Number(item.slice('--max-output-tokens='.length))
    else if (item.startsWith('--output=')) args.outputPath = path.resolve(item.slice('--output='.length))
    else throw new Error(`Unknown option: ${item}`)
  }

  if (args.temperature != null && Number.isNaN(args.temperature)) {
    throw new Error('Invalid --temperature value')
  }
  if (args.maxOutputTokens != null && (!Number.isInteger(args.maxOutputTokens) || args.maxOutputTokens <= 0)) {
    throw new Error('Invalid --max-output-tokens value')
  }

  if (args.full) {
    args.withDetail = true
    args.withAdapt = true
  }
  if (args.withAdapt) {
    args.withDetail = true
  }

  return args
}

async function readStdin() {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

async function loadJobPostingText(args) {
  if (args.stdin) return (await readStdin()).trim()
  if (args.inputPath) return (await fs.readFile(args.inputPath, 'utf8')).trim()
  throw new Error('Either --stdin or --input=PATH is required')
}

async function loadBaselinePromptTemplate(filePath) {
  const text = await fs.readFile(filePath, 'utf8')
  if (text.includes(TEMPLATE_SENTINEL)) {
    throw new Error(`Baseline prompt file still contains template sentinel. Replace it in ${filePath}`)
  }
  return text
}

function materializeBaselinePrompt(template, jobPostingText) {
  if (template.includes('{{JOB_POSTING_TEXT}}')) {
    return template.replaceAll('{{JOB_POSTING_TEXT}}', jobPostingText)
  }
  return `${template.trim()}\n\n[채용공고 원문]\n${jobPostingText}`
}

function timestampForFile(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
}

function stringifyForConsole(value) {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2)
}

function summarizeResponseFormat(format, compact = false) {
  if (!format) return null
  if (!compact) return format
  return {
    type: format.type || null,
    name: format.name || null,
    strict: format.strict ?? null,
  }
}

function summarizeRequestConfig(config, { compact = false } = {}) {
  return {
    model: config?.model || null,
    temperature: config?.temperature ?? null,
    max_tokens: config?.max_tokens ?? null,
    max_output_tokens: config?.max_output_tokens ?? null,
    response_format: summarizeResponseFormat(config?.response_format || null, compact),
  }
}

async function adaptBaselineMarkdownToJson({ rawMarkdown, jobPostingText, model, temperature, maxOutputTokens }) {
  return callOpenAiDebug({
    model,
    responseFormat: DETAIL_RESPONSE_FORMAT,
    temperature,
    maxOutputTokens,
    prompt: [
      {
        role: 'user',
        content: [
          '아래 baseline markdown 리포트를 현재 JobRisk 상세 리포트 JSON 스키마로 옮겨 주세요.',
          '목표는 markdown의 의미를 최대한 보존하는 것입니다.',
          '없는 정보는 지어내지 말고, 추가 확인 필요 또는 정보 부족에 맞게 보수적으로 채워 주세요.',
          '회사 평판, 소문, 조직문화 추정은 금지합니다.',
          '모든 quote는 아래 채용공고 원문이나 baseline markdown에 실제 보이는 표현만 사용해 주세요.',
          '',
          '[채용공고 원문]',
          jobPostingText,
          '',
          '[baseline markdown]',
          rawMarkdown,
        ].join('\n'),
      },
    ],
  })
}

function buildFinalResultJson({ previewResult, detailResult }) {
  return {
    freePreview: previewResult.freePreview,
    detail: detailResult?.detail || null,
    previewEngine: previewResult.engine,
    detailEngine: detailResult?.engine || null,
  }
}

function buildOutputPayload({
  args,
  jobPostingText,
  previewResult,
  previewExperiment,
  conditionalPreviewExperiment,
  detailResult,
  baselineRaw,
  baselineAdapted,
}) {
  return {
    generatedAt: new Date().toISOString(),
    input: {
      chars: jobPostingText.length,
      previewModelDefault: PREVIEW_MODEL,
      detailModelDefault: DETAIL_MODEL,
      baselinePromptFile: args.baselinePromptPath,
    },
    current: {
      rawLlmResponse: {
        preview: previewResult.debug?.previewLlm?.rawText || '',
        detail: detailResult?.debug?.detailLlm?.rawText || '',
      },
      finalResultJson: buildFinalResultJson({ previewResult, detailResult }),
      experimentFinalResultJson: {
        freePreview: previewExperiment.freePreview,
      },
      previewExperimentFreePreview: previewExperiment.freePreview,
      conditionalExperimentFinalResultJson: conditionalPreviewExperiment
        ? { freePreview: conditionalPreviewExperiment.freePreview }
        : null,
      conditionalPreviewExperimentFreePreview: conditionalPreviewExperiment?.freePreview || null,
      previewRisk: {
        fallbackRiskLevel: previewResult.debug?.previewRiskExperiment?.fallbackRiskLevel || null,
        llmReturnedRiskLevel: previewResult.debug?.previewRiskExperiment?.llmReturnedRiskLevel || null,
        experimentLlmAppliedRiskLevel: previewExperiment.debug?.previewRiskExperiment?.finalRiskLevel || null,
        fallbackLocked: previewResult.debug?.previewRiskExperiment?.fallbackLocked ?? null,
        wasLlmOverrideSuppressed: previewResult.debug?.previewRiskExperiment?.wasLlmOverrideSuppressed ?? null,
        conditionalOverrideAllowed: conditionalPreviewExperiment?.debug?.previewRiskExperiment?.conditionalOverrideAllowed ?? null,
        conditionalOverrideReason: conditionalPreviewExperiment?.debug?.previewRiskExperiment?.conditionalOverrideReason ?? '',
        conditionalOverrideBlockedReasons: conditionalPreviewExperiment?.debug?.previewRiskExperiment?.conditionalOverrideBlockedReasons ?? [],
        positiveSignalCount: conditionalPreviewExperiment?.debug?.previewRiskExperiment?.positiveSignalCount ?? null,
        positiveSignalCategories: conditionalPreviewExperiment?.debug?.previewRiskExperiment?.positiveSignalCategories ?? [],
        negativeSignalCount: conditionalPreviewExperiment?.debug?.previewRiskExperiment?.negativeSignalCount ?? null,
        quoteEvidenceVerified: conditionalPreviewExperiment?.debug?.previewRiskExperiment?.quoteEvidenceVerified ?? null,
      },
      previewInterpretationTrace: previewResult.debug?.previewInterpretationTrace || null,
      previewStages: previewResult.debug?.previewStages || null,
      previewExperimentStages: previewExperiment.debug?.previewStages || null,
      requestConfig: {
        preview: summarizeRequestConfig(previewResult.debug?.previewLlm?.requestConfig),
        detail: summarizeRequestConfig(detailResult?.debug?.detailLlm?.requestConfig),
        previewExperiment: summarizeRequestConfig(previewExperiment.debug?.previewLlm?.requestConfig),
        conditionalPreviewExperiment: summarizeRequestConfig(conditionalPreviewExperiment?.debug?.previewLlm?.requestConfig),
      },
      errors: {
        preview: previewResult.debug?.previewLlm?.error || null,
        detail: detailResult?.debug?.detailLlm?.error || null,
        previewExperiment: previewExperiment.debug?.previewLlm?.error || null,
        conditionalPreviewExperiment: conditionalPreviewExperiment?.debug?.previewLlm?.error || null,
      },
    },
    baselinePromptV1: {
      rawMarkdown: baselineRaw.rawText || '',
      adaptedJson: baselineAdapted.parsed || null,
      requestConfig: {
        rawMarkdown: summarizeRequestConfig(baselineRaw.requestConfig),
        adaptedJson: summarizeRequestConfig(baselineAdapted.requestConfig),
      },
      errors: {
        rawMarkdown: baselineRaw.error || null,
        adaptedJson: baselineAdapted.error || null,
      },
    },
  }
}

function printSection(title, value) {
  console.log(`\n=== ${title} ===`)
  console.log(stringifyForConsole(value))
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printUsage()
    return
  }

  const jobPostingText = await loadJobPostingText(args)
  if (jobPostingText.length < 40) {
    throw new Error('Job posting text must be at least 40 characters')
  }

  const baselinePromptTemplate = await loadBaselinePromptTemplate(args.baselinePromptPath)
  const baselinePromptText = materializeBaselinePrompt(baselinePromptTemplate, jobPostingText)

  const sharedModel = args.sameModel || ''
  const currentPreviewModel = args.currentPreviewModel || sharedModel || PREVIEW_MODEL
  const currentDetailModel = args.currentDetailModel || sharedModel || DETAIL_MODEL
  const baselineModel = args.baselineModel || sharedModel || currentDetailModel
  const adapterModel = args.adapterModel || sharedModel || currentDetailModel

  const previewResult = await buildPreview(
    { jobPostingText },
    {
      debug: true,
      llmModelOverride: currentPreviewModel,
      llmTemperature: args.temperature,
      llmMaxOutputTokens: args.maxOutputTokens,
    },
  )

  const previewExperiment = await buildPreview(
    { jobPostingText },
    {
      debug: true,
      allowLlmRiskOverride: true,
      llmModelOverride: currentPreviewModel,
      llmTemperature: args.temperature,
      llmMaxOutputTokens: args.maxOutputTokens,
    },
  )

  const conditionalPreviewExperiment = args.conditionalLlmRiskOverride
    ? await buildPreview(
        { jobPostingText },
        {
          debug: true,
          conditionalLlmRiskOverride: true,
          llmModelOverride: currentPreviewModel,
          llmTemperature: args.temperature,
          llmMaxOutputTokens: args.maxOutputTokens,
        },
      )
    : null

  const detailResult = args.withDetail
    ? await buildDetailReport(
        {
          analysis: {
            structured: previewResult.structured,
            freePreview: previewResult.freePreview,
          },
        },
        {
          debug: true,
          llmModelOverride: currentDetailModel,
          llmTemperature: args.temperature,
          llmMaxOutputTokens: args.maxOutputTokens,
        },
      )
    : null

  const baselineRaw = await callOpenAiDebug({
    model: baselineModel,
    temperature: args.temperature,
    maxOutputTokens: args.maxOutputTokens,
    parseJson: false,
    prompt: [
      {
        role: 'user',
        content: baselinePromptText,
      },
    ],
  })

  const baselineAdapted = args.withAdapt
    ? await adaptBaselineMarkdownToJson({
        rawMarkdown: baselineRaw.rawText || '',
        jobPostingText,
        model: adapterModel,
        temperature: args.temperature,
        maxOutputTokens: args.maxOutputTokens,
      })
    : { rawText: '', parsed: null, requestConfig: null, error: null }

  const payload = buildOutputPayload({
    args,
    jobPostingText,
    previewResult,
    previewExperiment,
    conditionalPreviewExperiment,
    detailResult,
    baselineRaw,
    baselineAdapted,
  })

  printSection('Current JobRisk Raw LLM Response', payload.current.rawLlmResponse)
  printSection('Current JobRisk Final Result JSON', payload.current.finalResultJson)
  printSection('Current JobRisk Experiment Preview', payload.current.previewExperimentFreePreview)
  if (args.conditionalLlmRiskOverride) {
    printSection('Current JobRisk Conditional Experiment Preview', payload.current.conditionalPreviewExperimentFreePreview)
  }
  printSection('Baseline Prompt V1 Raw Markdown', payload.baselinePromptV1.rawMarkdown)
  if (args.withAdapt) {
    printSection('Baseline Prompt V1 Adapted JSON', payload.baselinePromptV1.adaptedJson)
  }
  printSection('Preview Risk Comparison', payload.current.previewRisk)
  printSection('Preview Interpretation Trace', payload.current.previewInterpretationTrace)
  printSection('Request Config', {
    current: {
      preview: summarizeRequestConfig(previewResult.debug?.previewLlm?.requestConfig, { compact: true }),
      detail: summarizeRequestConfig(detailResult?.debug?.detailLlm?.requestConfig, { compact: true }),
      previewExperiment: summarizeRequestConfig(previewExperiment.debug?.previewLlm?.requestConfig, { compact: true }),
      conditionalPreviewExperiment: summarizeRequestConfig(conditionalPreviewExperiment?.debug?.previewLlm?.requestConfig, { compact: true }),
    },
    baselinePromptV1: {
      rawMarkdown: summarizeRequestConfig(baselineRaw.requestConfig, { compact: true }),
      adaptedJson: summarizeRequestConfig(baselineAdapted.requestConfig, { compact: true }),
    },
  })
  printSection('LLM Errors', {
    current: payload.current.errors,
    baselinePromptV1: payload.baselinePromptV1.errors,
  })

  const outputPath = args.outputPath || path.join(DEFAULT_OUTPUT_DIR, `compare-baseline-${timestampForFile()}.json`)
  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')

  console.log(`\nSaved JSON: ${outputPath}`)
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error))
  process.exitCode = 1
})
