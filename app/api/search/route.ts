import { NextRequest, NextResponse } from 'next/server'
import { notion, DATABASE_PAGE_ID } from '@/lib/notion'

export async function POST(req: NextRequest) {
  const { query } = await req.json()
  if (!query?.trim()) {
    return NextResponse.json({ results: [] })
  }

  const results = await notion.search({
    query,
    ancestorId: DATABASE_PAGE_ID,
    filters: { isDeletedOnly: false, excludeTemplates: true, navigableBlockContentOnly: true },
    limit: 20,
  })

  return NextResponse.json(results)
}