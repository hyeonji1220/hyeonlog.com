'use client'

import dynamic from 'next/dynamic'
import { NotionRenderer } from 'react-notion-x'
import type { ExtendedRecordMap } from 'notion-types'

const Code = dynamic(() =>
  import('react-notion-x/build/third-party/code').then(m => m.Code)
)
const Collection = dynamic(() =>
  import('react-notion-x/build/third-party/collection').then(m => m.Collection)
)
const Equation = dynamic(() =>
  import('react-notion-x/build/third-party/equation').then(m => m.Equation)
)

interface Props {
  recordMap: ExtendedRecordMap
  rootPageId: string
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

export default function NotionPage({ recordMap, rootPageId }: Props) {
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
