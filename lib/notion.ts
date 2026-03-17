import { NotionAPI } from 'notion-client'

export const notion = new NotionAPI()

export const DATABASE_PAGE_ID = process.env.NOTION_DATABASE_PAGE_ID!

export async function getPage(pageId: string) {
  return notion.getPage(pageId)
}

export async function getPostIds(): Promise<string[]> {
  const recordMap = await getPage(DATABASE_PAGE_ID)
  // parent_id는 하이픈 포함 UUID 형식이므로 양쪽을 하이픈 없이 비교
  const databaseId = DATABASE_PAGE_ID.replace(/-/g, '')
  return Object.keys(recordMap.block).filter(id => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const block = (recordMap.block[id] as any)?.value
    const parentId = block?.parent_id?.replace(/-/g, '') ?? ''
    return block?.type === 'page' && parentId === databaseId
  })
}
