import assert from 'node:assert/strict'
import { test } from 'node:test'

import { buildPreview } from '../src/lib/analysis.js'
import { getCompanyContextSection } from '../../shared/companyContextView.js'

function createCompanyContext(overrides = {}) {
  return {
    companyName: 'Acme Japan Commerce',
    mustAskQuestions: [
      {
        question: '????븷???ㅼ젣濡?留〓뒗 ?쇰낯 ?쒖옣 踰붿쐞???대뵒源뚯??멸???',
        whyAsk: '援?? ?⑥쐞 KPI? ?ㅽ뻾 梨낆엫???덈뒗吏 ?뺤씤?댁빞 ?⑸땲??',
      },
    ],
    reportEvidence: {
      companyEvidence: [
        {
          title: 'Acme Japan Commerce expands Japan operations',
          summary: 'Acme Japan Commerce has expanded Japan operations and localization hiring.',
          url: 'https://example.com/acme-japan',
          sourceType: 'news',
          isOfficial: false,
        },
      ],
      postingEvidence: [
        {
          quote: '?쇰낯 ?쒖옣 ?꾩????댁쁺 ?꾨줈?몄뒪瑜??ㅺ퀎?섍퀬 ?ㅽ뻾?⑸땲??',
          signal:
            'Acme Japan Commerce???쇰낯 ?댁쁺 ?뺤옣 ?좏샇? 怨듦퀬???꾩????댁쁺 臾몄옣???④퍡 蹂대㈃, ????븷? ?쇰낯 ?쒖옣 ?ㅽ뻾 梨낆엫怨?吏곸젒 ?곌껐??媛?μ꽦???덉뒿?덈떎.',
        },
      ],
    },
    ...overrides,
  }
}

test('company context section hides when posting evidence is missing', () => {
  const section = getCompanyContextSection(
    createCompanyContext({
      reportEvidence: {
        companyEvidence: createCompanyContext().reportEvidence.companyEvidence,
        postingEvidence: [],
      },
    }),
  )

  assert.equal(section, null)
})

test('company context section hides when interpretation is generic', () => {
  const section = getCompanyContextSection(
    createCompanyContext({
      reportEvidence: {
        companyEvidence: createCompanyContext().reportEvidence.companyEvidence,
        postingEvidence: [
          {
            quote: '?쇰낯 ?쒖옣 ?꾩????댁쁺 ?꾨줈?몄뒪瑜??ㅺ퀎?섍퀬 ?ㅽ뻾?⑸땲??',
            signal: '?깆옣 媛?μ꽦???덉뼱 蹂댁씠硫??ㅼ뼇??寃쏀뿕???????덉뒿?덈떎.',
          },
        ],
      },
    }),
  )

  assert.equal(section, null)
})

test('company context section shows rich mode when company and posting evidence both qualify', () => {
  const section = getCompanyContextSection(createCompanyContext())

  assert.equal(section?.mode, 'rich')
  assert.equal(section?.companyEvidence.length, 1)
  assert.equal(section?.postingEvidence.length, 1)
  assert.equal(section?.questions.length, 1)
})

test('company context section shows light mode when only posting evidence is strong enough', () => {
  const section = getCompanyContextSection(
    createCompanyContext({
      reportEvidence: {
        companyEvidence: [],
        postingEvidence: [
          {
            quote: '而щ━ 怨좉컼怨?留덉???而ㅻ??덉??댁뀡??????댄빐',
            signal:
              '而щ━ 怨좉컼怨?而щ━ ?쒕퉬??臾몄옣??諛섎났?섏뼱, ????븷??而щ━ 釉뚮옖?쒖? 怨좉컼 寃쏀뿕 留λ씫 ?덉뿉???吏곸씤?ㅻ뒗 ?먯쓣 怨듦퀬 ?덉뿉??吏곸젒 ?뺤씤?????덉뒿?덈떎.',
          },
        ],
      },
      companyName: '而щ━',
    }),
  )

  assert.equal(section?.mode, 'light')
  assert.equal(section?.companyEvidence.length, 0)
  assert.equal(section?.postingEvidence.length, 1)
})

test('company context section stays hidden when company name exists but job connection is too weak', () => {
  const section = getCompanyContextSection(
    createCompanyContext({
      companyName: '而щ━',
      reportEvidence: {
        companyEvidence: [],
        postingEvidence: [
          {
            quote: '而щ━ ?쒕퉬?ㅼ뿉 ????좎젙???덉쑝??遺?',
            signal: '而щ━?쇰뒗 ?대쫫??蹂댁엯?덈떎.',
          },
        ],
      },
    }),
  )

  assert.equal(section, null)
})

test('preview builds reportEvidence signal with company and posting anchors', async () => {
  const { readFileSync } = await import('node:fs')
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/golden-set/golden-set-v3.confirmed.json', import.meta.url), 'utf8'))
  const text = fixture.samples.find((sample) => sample.id === 'W038')?.posting_text || ''
  const result = await buildPreview({ jobPostingText: text })
  const signal = result.structured.companyContext.reportEvidence.postingEvidence[0]?.signal || ''

  assert.equal(signal.includes(result.structured.companyContext.companyName), true)
  assert.equal(signal.includes('검색·AI 노출 기반 키워드 전략 수립 및 콘텐츠 로드맵 운영'), true)
})
