import { cache } from 'react'
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
  const block = recordMap.block as Record<string, any>

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

  // 1. 각 뷰의 *_properties에서 visible: false 처리
  for (const [, cv] of Object.entries(collectionView ?? {})) {
    const view = cv?.value?.value
    if (!view) continue

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

  // 2. 컬렉션 스키마에서 제거 (개별 페이지 속성 표시 방지)
  for (const [collId, coll] of Object.entries(collection ?? {})) {
    const schema = coll?.value?.value?.schema
    if (!schema) continue
    const hiddenKeys = hiddenKeysByCollection[collId]
    if (!hiddenKeys) continue
    for (const key of hiddenKeys) delete schema[key]
  }

  // 3. 각 블록의 properties에서도 제거
  const allHiddenKeys = new Set(Object.values(hiddenKeysByCollection).flatMap(s => [...s]))
  for (const b of Object.values(block ?? {})) {
    const props = b?.value?.value?.properties
    if (!props) continue
    for (const key of allHiddenKeys) delete props[key]
  }

  return recordMap
}

/** date property 값에서 "YYYY-MM-DD" 추출 */
function extractDateString(propValue: any): string | null {
  return propValue?.[0]?.[1]?.[0]?.[1]?.start_date ?? null
}

function matchesFilter(block: any, filter: any): boolean {
  const { operator, filters, property, filter: condition } = filter

  // Compound filter (AND / OR)
  if (Array.isArray(filters)) {
    const results = filters.map((f: any) => matchesFilter(block, f))
    if (operator === 'and') return results.every(Boolean)
    if (operator === 'or') return results.some(Boolean)
    return true
  }

  // Leaf filter
  if (!property || !condition) return true

  const propValue = block?.properties?.[property]
  const { operator: op, value } = condition

  if (op === 'checkbox_is') {
    const checked = propValue?.[0]?.[0] === 'Yes'
    return checked === (value?.value === true)
  }

  if (op === 'enum_is') {
    const raw = propValue?.[0]?.[0] ?? ''
    const actual = raw.split(',').map((v: string) => v.trim())
    const target = value?.value ?? value
    return actual.includes(target)
  }

  if (op === 'enum_contains') {
    const raw = propValue?.[0]?.[0] ?? ''
    // multi_select은 콤마로 구분된 문자열로 저장됨
    const actual = raw.split(',').map((v: string) => v.trim())
    const targets: string[] = Array.isArray(value)
      ? value.map((v: any) => v?.value ?? v)
      : [value?.value ?? value]
    return targets.some(t => actual.includes(t))
  }

  if (op === 'date_is_after') {
    const propDate = extractDateString(propValue)
    const filterDate = value?.value?.start_date ?? null
    if (!propDate || !filterDate) return false
    return propDate > filterDate
  }

  if (op === 'date_is_before') {
    const propDate = extractDateString(propValue)
    const filterDate = value?.value?.start_date ?? null
    if (!propDate || !filterDate) return false
    return propDate < filterDate
  }

  if (op === 'date_is_within') {
    const propDate = extractDateString(propValue)
    const startDate = value?.value?.start_date ?? null
    const endDate = value?.value?.end_date ?? null
    if (!propDate) return false
    if (startDate && propDate < startDate) return false
    if (endDate && propDate > endDate) return false
    return true
  }

  if (op === 'date_is') {
    const propDate = extractDateString(propValue)
    const filterDate = value?.value?.start_date ?? null
    if (!propDate || !filterDate) return false
    return propDate === filterDate
  }

  // 미지원 operator — 기본 포함
  return true
}

function applyCollectionFilters(recordMap: ExtendedRecordMap): ExtendedRecordMap {
  const collectionQuery = recordMap.collection_query as Record<string, Record<string, any>>
  const collectionView = recordMap.collection_view as Record<string, any>
  const block = recordMap.block as Record<string, any>

  for (const [, viewQueries] of Object.entries(collectionQuery ?? {})) {
    for (const [viewId, cq] of Object.entries(viewQueries ?? {})) {
      const filter = collectionView?.[viewId]?.value?.value?.query2?.filter
      if (!filter?.filters?.length) continue

      const blockIds: string[] =
        cq?.collection_group_results?.blockIds ?? cq?.blockIds ?? []
      if (blockIds.length === 0) continue

      const filtered = blockIds.filter((id: string) => {
        const b = block[id]?.value?.value
        return matchesFilter(b, filter)
      })

      if (cq.collection_group_results) {
        cq.collection_group_results.blockIds = filtered
      } else {
        cq.blockIds = filtered
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

/**
 * place 타입 property 값에서 plain text만 남기고 annotation 제거.
 * react-notion-x가 place 타입을 지원하지 않아 raw annotation이 그대로 렌더링되는 문제 방지.
 */
function normalizePlaceProperties(recordMap: ExtendedRecordMap): ExtendedRecordMap {
  const collection = recordMap.collection as Record<string, any>
  const block = recordMap.block as Record<string, any>

  const placeKeys = new Set<string>()
  for (const coll of Object.values(collection ?? {})) {
    const schema = coll?.value?.value?.schema ?? {}
    for (const [key, field] of Object.entries(schema as Record<string, any>)) {
      if (field.type === 'place') placeKeys.add(key)
    }
  }
  if (placeKeys.size === 0) return recordMap

  for (const b of Object.values(block ?? {})) {
    const props = b?.value?.value?.properties
    if (!props) continue
    for (const key of placeKeys) {
      if (!props[key]) continue
      // Notion rich text: [[text, annotations?], ...] — annotation 제거해 plain text만 유지
      const text: string = (props[key] as any[])
        .filter((chunk: any) => typeof chunk[0] === 'string')
        .map((chunk: any) => chunk[0])
        .join('')
      props[key] = text ? [[text]] : []
    }
  }
  return recordMap
}

/** 포스트 본문 첫 번째 텍스트 블록에서 meta description용 plain text 추출 (최대 160자) */
export function getPageDescription(recordMap: ExtendedRecordMap, pageId: string): string {
  const blockMap = recordMap.block as Record<string, any>

  // notion URL은 dash 없는 ID를 쓰지만 block map 키는 dash 포함일 수 있음
  const normId = pageId.replace(/-/g, '')
  const pageBlock =
    blockMap[normId]?.value?.value ??
    blockMap[pageId]?.value?.value
  const childIds: string[] = pageBlock?.content ?? []

  for (const childId of childIds) {
    const child = blockMap[childId]?.value?.value
    if (!child) continue
    if (child.type !== 'text') continue
    const text: string = (child.properties?.title ?? [])
      .filter((chunk: any) => typeof chunk[0] === 'string')
      .map((chunk: any) => chunk[0] as string)
      .join('')
      .trim()
    if (text.length > 10) return text.slice(0, 160)
  }
  return ''
}

export const getPage = cache(async (pageId: string): Promise<ExtendedRecordMap> => {
  const recordMap = await notion.getPage(pageId)
  filterUnpublished(recordMap)        // Published 필터
  applyCollectionFilters(recordMap)   // 뷰별 필터 (type, tag, date 등)
  normalizePlaceProperties(recordMap) // place 타입 plain text 변환
  hideProperties(recordMap)           // 뷰 컬럼/스키마/블록에서 숨기기
  return applyCollectionSorts(recordMap)
})

export async function getPostIds(): Promise<string[]> {
  // hideProperties()가 Published 스키마/프로퍼티를 삭제하기 전의 raw 데이터 필요
  const recordMap = await notion.getPage(DATABASE_PAGE_ID)

  const collection = recordMap.collection as Record<string, any>
  const collectionQuery = recordMap.collection_query as Record<string, Record<string, any>>
  const block = recordMap.block as Record<string, any>

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const postsCollection = Object.values(collection ?? {}).find((c: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const schema = (c as any)?.value?.value?.schema ?? {}
    return findPropertyKey(schema, PUBLISHED_PROPERTY_NAME) !== null
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const schema = (postsCollection as any)?.value?.value?.schema ?? {}
  const publishedKey = findPropertyKey(schema, PUBLISHED_PROPERTY_NAME)

  // collection_query의 blockIds를 모든 뷰에서 합산 (parent_id 비교 우회)
  const candidateIds = new Set<string>()
  for (const viewQueries of Object.values(collectionQuery ?? {})) {
    for (const cq of Object.values(viewQueries ?? {})) {
      const ids: string[] = cq?.collection_group_results?.blockIds ?? cq?.blockIds ?? []
      for (const id of ids) candidateIds.add(id)
    }
  }

  return [...candidateIds].filter(id => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b = (block[id] as any)?.value?.value
    if (!b) return false
    if (!publishedKey) return true
    return b?.properties?.[publishedKey]?.[0]?.[0] === 'Yes'
  })
}
