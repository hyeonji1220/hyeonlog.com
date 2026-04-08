import { NotionAPI } from 'notion-client'
import type { ExtendedRecordMap } from 'notion-types'

export const notion = new NotionAPI()

export const DATABASE_PAGE_ID = process.env.NOTION_DATABASE_PAGE_ID!

function getPropertySortValue(block: any, property: string, schema: any): string | number | null {
  if (!block) return null

  const propType = schema?.[property]?.type

  if (propType === 'created_time') {
    return block.created_time ?? null
  }

  const propValue = block.properties?.[property]
  if (!propValue) return null

  if (propType === 'date') {
    // [["‣", [["d", {"start_date": "2024-08-17", ...}]]]]
    return propValue?.[0]?.[1]?.[0]?.[1]?.start_date ?? null
  }

  if (propType === 'number') {
    const n = Number(propValue?.[0]?.[0])
    return isNaN(n) ? null : n
  }

  return propValue?.[0]?.[0] ?? null
}

// 블로그에서 숨길 Notion 속성 이름 목록
const HIDDEN_PROPERTY_NAMES = ['Published']

// 공개 여부를 결정하는 체크박스 속성 이름
const PUBLISHED_PROPERTY_NAME = 'Published'

/** schema에서 이름으로 property key를 찾아 반환 */
function findPropertyKey(schema: Record<string, any>, name: string): string | null {
  for (const [key, field] of Object.entries(schema)) {
    if (field.name === name) return key
  }
  return null
}

/** Published 체크박스가 체크된 페이지만 collection_query의 blockIds에 남김 */
function filterUnpublished(recordMap: ExtendedRecordMap): ExtendedRecordMap {
  const collectionQuery = recordMap.collection_query as Record<string, Record<string, any>>
  const collection = recordMap.collection as Record<string, any>
  const block = recordMap.block as Record<string, any>

  for (const [collectionId, viewQueries] of Object.entries(collectionQuery ?? {})) {
    const schema = collection?.[collectionId]?.value?.value?.schema ?? {}
    const publishedKey = findPropertyKey(schema, PUBLISHED_PROPERTY_NAME)

    // Published 필드가 없는 컬렉션은 그대로 (Life tips, Travel Log 등)
    if (!publishedKey) continue

    for (const cq of Object.values(viewQueries ?? {})) {
      const target = cq?.collection_group_results ?? cq
      if (!target?.blockIds) continue

      target.blockIds = target.blockIds.filter((id: string) => {
        const b = block[id]?.value?.value
        // 체크박스 checked = [["Yes"]], unchecked/없음 = 비공개
        return b?.properties?.[publishedKey]?.[0]?.[0] === 'Yes'
      })
    }
  }

  return recordMap
}

function hideProperties(recordMap: ExtendedRecordMap): ExtendedRecordMap {
  const collectionView = recordMap.collection_view as Record<string, any>
  const collection = recordMap.collection as Record<string, any>

  // 숨길 속성의 property key 수집 (컬렉션별로 이름 → key 매핑)
  const hiddenKeysByCollection: Record<string, Set<string>> = {}
  for (const [collId, coll] of Object.entries(collection ?? {})) {
    const schema = coll?.value?.value?.schema ?? {}
    const keys = new Set<string>()
    for (const [key, field] of Object.entries(schema as Record<string, any>)) {
      if (HIDDEN_PROPERTY_NAMES.includes(field.name)) keys.add(key)
    }
    if (keys.size > 0) hiddenKeysByCollection[collId] = keys
  }

  // 각 뷰의 *_properties에서 해당 key를 visible: false 처리
  for (const [, cv] of Object.entries(collectionView ?? {})) {
    const view = cv?.value?.value
    if (!view) continue

    // 이 뷰가 속한 컬렉션 찾기
    const collId = Object.keys(hiddenKeysByCollection).find(id =>
      id === view.parent_id?.replace(/-/g, '')
    )
    if (!collId) continue
    const hiddenKeys = hiddenKeysByCollection[collId]

    const propLists = ['table_properties', 'gallery_properties', 'list_properties', 'board_properties']
    for (const listKey of propLists) {
      if (!view.format?.[listKey]) continue
      for (const prop of view.format[listKey]) {
        if (hiddenKeys.has(prop.property)) prop.visible = false
      }
    }
  }

  return recordMap
}

function applyCollectionSorts(recordMap: ExtendedRecordMap): ExtendedRecordMap {
  const collectionQuery = recordMap.collection_query as Record<string, Record<string, any>>
  const collectionView = recordMap.collection_view as Record<string, any>
  const collection = recordMap.collection as Record<string, any>
  const block = recordMap.block as Record<string, any>

  for (const [collectionId, viewQueries] of Object.entries(collectionQuery ?? {})) {
    const schema = collection?.[collectionId]?.value?.value?.schema

    for (const [viewId, cq] of Object.entries(viewQueries ?? {})) {
      const sorts: { property: string; direction: 'ascending' | 'descending' }[] =
        collectionView?.[viewId]?.value?.value?.query2?.sort ?? []

      if (sorts.length === 0) continue

      const blockIds: string[] =
        cq?.collection_group_results?.blockIds ?? cq?.blockIds ?? []

      if (blockIds.length === 0) continue

      const sorted = [...blockIds].sort((aId, bId) => {
        for (const { property, direction } of sorts) {
          const aVal = getPropertySortValue(block[aId]?.value?.value, property, schema)
          const bVal = getPropertySortValue(block[bId]?.value?.value, property, schema)

          const a = aVal ?? (direction === 'descending' ? '' : '\uffff')
          const b = bVal ?? (direction === 'descending' ? '' : '\uffff')

          let cmp = 0
          if (a < b) cmp = -1
          else if (a > b) cmp = 1

          if (cmp !== 0) return direction === 'descending' ? -cmp : cmp
        }
        return 0
      })

      if (cq.collection_group_results) {
        cq.collection_group_results.blockIds = sorted
      } else {
        cq.blockIds = sorted
      }
    }
  }

  return recordMap
}

export async function getPage(pageId: string): Promise<ExtendedRecordMap> {
  const recordMap = await notion.getPage(pageId)
  hideProperties(recordMap)
  filterUnpublished(recordMap)
  return applyCollectionSorts(recordMap)
}

export async function getPostIds(): Promise<string[]> {
  const recordMap = await getPage(DATABASE_PAGE_ID)
  const databaseId = DATABASE_PAGE_ID.replace(/-/g, '')

  // Posts 컬렉션 스키마에서 Published key 찾기
  const postsCollection = Object.values(recordMap.collection as Record<string, any>).find(c => {
    const schema = c?.value?.value?.schema ?? {}
    return findPropertyKey(schema, PUBLISHED_PROPERTY_NAME) !== null
  })
  const schema = postsCollection?.value?.value?.schema ?? {}
  const publishedKey = findPropertyKey(schema, PUBLISHED_PROPERTY_NAME)

  return Object.keys(recordMap.block).filter(id => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const block = (recordMap.block[id] as any)?.value?.value
    const parentId = block?.parent_id?.replace(/-/g, '') ?? ''
    if (block?.type !== 'page' || parentId !== databaseId) return false

    // Published 필드가 있으면 체크된 것만, 없으면 모두 공개
    if (!publishedKey) return true
    return block?.properties?.[publishedKey]?.[0]?.[0] === 'Yes'
  })
}
