import { getPage, DATABASE_PAGE_ID } from '@/lib/notion'
import NotionPage from '@/components/NotionPage'

export const revalidate = 60

export default async function HomePage() {
  const recordMap = await getPage(DATABASE_PAGE_ID)

  return (
    <NotionPage
      recordMap={recordMap}
      rootPageId={DATABASE_PAGE_ID}
    />
  )
}
