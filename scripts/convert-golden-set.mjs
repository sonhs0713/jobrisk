import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const WORKBOOK_PATH = path.resolve('server/test/fixtures/golden-set/source/jobrisk_golden_set_v3_confirmed_full_posting_text.xlsx')
const OUTPUT_PATH = path.resolve('server/test/fixtures/golden-set/golden-set-v3.confirmed.json')
const TARGET_SHEET = 'GoldenSet_v3_10'
const CONFIRMED = 'CONFIRMED'

function readUInt32LE(buffer, offset) {
  return buffer.readUInt32LE(offset)
}

function readUInt16LE(buffer, offset) {
  return buffer.readUInt16LE(offset)
}

function readZipEntries(filePath) {
  const buffer = fs.readFileSync(filePath)
  const endSignature = 0x06054b50
  let endOffset = -1
  for (let index = buffer.length - 22; index >= 0; index -= 1) {
    if (readUInt32LE(buffer, index) === endSignature) {
      endOffset = index
      break
    }
  }
  if (endOffset < 0) throw new Error(`ZIP end record not found: ${filePath}`)

  const centralDirectorySize = readUInt32LE(buffer, endOffset + 12)
  const centralDirectoryOffset = readUInt32LE(buffer, endOffset + 16)
  const entries = new Map()
  let cursor = centralDirectoryOffset
  const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize

  while (cursor < centralDirectoryEnd) {
    if (readUInt32LE(buffer, cursor) !== 0x02014b50) break
    const compression = readUInt16LE(buffer, cursor + 10)
    const compressedSize = readUInt32LE(buffer, cursor + 20)
    const fileNameLength = readUInt16LE(buffer, cursor + 28)
    const extraLength = readUInt16LE(buffer, cursor + 30)
    const commentLength = readUInt16LE(buffer, cursor + 32)
    const localHeaderOffset = readUInt32LE(buffer, cursor + 42)
    const name = buffer.slice(cursor + 46, cursor + 46 + fileNameLength).toString('utf8')

    const localNameLength = readUInt16LE(buffer, localHeaderOffset + 26)
    const localExtraLength = readUInt16LE(buffer, localHeaderOffset + 28)
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength
    const compressed = buffer.slice(dataStart, dataStart + compressedSize)
    let content
    if (compression === 0) content = compressed
    else if (compression === 8) content = zlib.inflateRawSync(compressed)
    else throw new Error(`Unsupported ZIP compression ${compression} for ${name}`)

    entries.set(name.replace(/\\/g, '/'), content.toString('utf8'))
    cursor += 46 + fileNameLength + extraLength + commentLength
  }

  return entries
}

function decodeXml(value = '') {
  return String(value)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

function columnIndex(cellRef = '') {
  const letters = String(cellRef).replace(/[^A-Z]/gi, '').toUpperCase()
  let index = 0
  for (const letter of letters) {
    index = index * 26 + letter.charCodeAt(0) - 64
  }
  return index - 1
}

function parseAttributes(tag = '') {
  const attributes = {}
  for (const match of tag.matchAll(/([A-Za-z_:][\w:.-]*)="([^"]*)"/g)) {
    attributes[match[1]] = decodeXml(match[2])
  }
  return attributes
}

function readSharedStrings(entries) {
  const xml = entries.get('xl/sharedStrings.xml')
  if (!xml) return []
  return [...xml.matchAll(/<si\b[\s\S]*?<\/si>/g)].map(([item]) => {
    const textParts = [...item.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((match) => decodeXml(match[1]))
    return textParts.join('')
  })
}

function readWorkbookSheets(entries) {
  const workbook = entries.get('xl/workbook.xml')
  const rels = entries.get('xl/_rels/workbook.xml.rels')
  if (!workbook || !rels) throw new Error('Workbook metadata is missing')

  const relationshipMap = new Map()
  for (const match of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const attributes = parseAttributes(match[0])
    relationshipMap.set(attributes.Id, attributes.Target)
  }

  return [...workbook.matchAll(/<sheet\b[^>]*>/g)].map((match) => {
    const attributes = parseAttributes(match[0])
    const target = relationshipMap.get(attributes['r:id'])
    return {
      name: attributes.name,
      path: target?.startsWith('xl/') ? target : `xl/${String(target || '').replace(/^\//, '')}`,
    }
  })
}

function readSheetRows(entries, sheetPath, sharedStrings) {
  const xml = entries.get(sheetPath)
  if (!xml) throw new Error(`Sheet XML not found: ${sheetPath}`)
  return [...xml.matchAll(/<row\b[^>]*>[\s\S]*?<\/row>/g)].map(([rowXml]) => {
    const row = []
    for (const match of rowXml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attributes = parseAttributes(match[1])
      const cellIndex = columnIndex(attributes.r)
      const cellXml = match[2] || ''
      const inline = cellXml.match(/<is\b[^>]*>[\s\S]*?<t\b[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/is>/)
      const valueMatch = cellXml.match(/<v>([\s\S]*?)<\/v>/)
      let value = ''
      if (attributes.t === 'inlineStr') value = inline ? decodeXml(inline[1]) : ''
      else if (valueMatch) {
        const raw = decodeXml(valueMatch[1])
        value = attributes.t === 's' ? sharedStrings[Number(raw)] || '' : raw
      }
      while (row.length <= cellIndex) row.push('')
      row[cellIndex] = value
    }
    return row
  })
}

function countBy(records, key) {
  return records.reduce((acc, record) => {
    const value = record[key] || '(blank)'
    acc[value] = (acc[value] || 0) + 1
    return acc
  }, {})
}

function main() {
  if (!fs.existsSync(WORKBOOK_PATH)) {
    throw new Error(`Golden set source file not found: ${WORKBOOK_PATH}`)
  }

  const entries = readZipEntries(WORKBOOK_PATH)
  const sharedStrings = readSharedStrings(entries)
  const sheets = readWorkbookSheets(entries)
  const sheet = sheets.find((item) => item.name === TARGET_SHEET)
  if (!sheet) throw new Error(`Target sheet not found: ${TARGET_SHEET}`)

  const rows = readSheetRows(entries, sheet.path, sharedStrings)
  const [headers, ...dataRows] = rows
  if (!headers?.length) throw new Error(`Header row not found in ${TARGET_SHEET}`)

  const records = dataRows.map((row) => {
    const record = {}
    for (const [index, header] of headers.entries()) {
      record[header] = row[index] || ''
    }
    return record
  })

  const confirmed = records.filter((record) => record.label_status === CONFIRMED)
  const exported = confirmed.map((record) => ({
    ...record,
    has_posting_text: Boolean(String(record.posting_text || '').trim()),
  }))
  const missingPostingTextCount = exported.filter((record) => !record.has_posting_text).length

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true })
  fs.writeFileSync(
    OUTPUT_PATH,
    `${JSON.stringify({
      schemaVersion: 'jobrisk-golden-set-v3',
      sourceFile: path.relative(process.cwd(), WORKBOOK_PATH).replace(/\\/g, '/'),
      sourceSheet: TARGET_SHEET,
      generatedAt: new Date().toISOString(),
      filters: { label_status: CONFIRMED },
      summary: {
        totalRows: records.length,
        confirmedRows: confirmed.length,
        exportedRows: exported.length,
        missingPostingTextCount,
        riskDistribution: countBy(exported, 'expected_risk'),
      },
      samples: exported,
    }, null, 2)}\n`,
    'utf8',
  )

  console.log('[golden:sync] completed')
  console.log(`- 전체 행 수: ${records.length}`)
  console.log(`- CONFIRMED 행 수: ${confirmed.length}`)
  console.log(`- JSON으로 내보낸 행 수: ${exported.length}`)
  console.log(`- posting_text 누락 수: ${missingPostingTextCount}`)
  console.log('- 위험도 분포:')
  for (const [risk, count] of Object.entries(countBy(exported, 'expected_risk'))) {
    console.log(`  - ${risk}: ${count}`)
  }
  console.log(`- output: ${path.relative(process.cwd(), OUTPUT_PATH)}`)
}

main()
