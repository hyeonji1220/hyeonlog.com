import { NextRequest, NextResponse } from 'next/server'

const NOTION_TOKEN = process.env.NOTION_TOKEN!

export async function POST(req: NextRequest) {
  const { query } = await req.json()
  if (!query?.trim()) {
    return NextResponse.json({ results: [] })
  }

  const res = await fetch('https://api.notion.com/v1/search', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      filter: { value: 'page', property: 'object' },
      sort: { direction: 'descending', timestamp: 'last_edited_time' },
      page_size: 20,
    }),
  })

  if (!res.ok) {
    return NextResponse.json({ error: 'Search failed' }, { status: res.status })
  }

  const data = await res.json()
  const pages: any[] = data.results ?? []

  const block: Record<string, any> = {}
  const results: any[] = []

  for (const page of pages) {
    let titleText = ''
    for (const prop of Object.values(page.properties ?? {})) {
      if ((prop as any).type === 'title') {
        titleText = (prop as any).title?.map((t: any) => t.plain_text).join('') ?? ''
        break
      }
    }
    if (!titleText) continue

    const id = page.id
    block[id] = {
      value: {
        id,
        type: 'page',
        properties: { title: [[titleText]] },
        parent_table: 'collection',
      },
    }
    results.push({ id })
  }

  return NextResponse.json({ results, recordMap: { block } })
}
