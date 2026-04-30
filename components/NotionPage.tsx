'use client'

import dynamic from 'next/dynamic'
import { NotionRenderer } from 'react-notion-x'
import type { ExtendedRecordMap } from 'notion-types'

const Code = dynamic(() =>
  import('react-notion-x/build/third-party/code').then(m => m.Code)
)
// 홈 페이지용 — SSR 유지 (Google이 포스트 목록 링크를 초기 HTML에서 읽을 수 있음)
const CollectionSSR = dynamic(() =>
  import('react-notion-x/build/third-party/collection').then(m => m.Collection)
)
// 포스트 페이지용 — CSR (GracefulImage의 isBrowser 체크로 인한 hydration mismatch 방지)
const CollectionCSR = dynamic(
  () => import('react-notion-x/build/third-party/collection').then(m => m.Collection),
  { ssr: false }
)
const Equation = dynamic(() =>
  import('react-notion-x/build/third-party/equation').then(m => m.Equation)
)

interface Props {
  recordMap: ExtendedRecordMap
  rootPageId: string
  clientOnlyCollection?: boolean
}

const mapPageUrl = (pageId: string) =>
  `/posts/${pageId.replace(/-/g, '')}`

async function searchNotion(params: { query: string; ancestorId?: string }) {
  const res = await fetch('/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: params.query }),
  })
  return res.json()
}

export default function NotionPage({ recordMap, rootPageId, clientOnlyCollection = false }: Props) {
  const Collection = clientOnlyCollection ? CollectionCSR : CollectionSSR
  return (
    <NotionRenderer
      recordMap={recordMap}
      fullPage
      darkMode={false}
      rootPageId={rootPageId}
      mapPageUrl={mapPageUrl}
      searchNotion={searchNotion}
      components={{ Code, Collection, Equation }}
    />
  )
}
