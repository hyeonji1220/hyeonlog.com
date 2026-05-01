import { getPage, getPageDescription } from '@/lib/notion'
import { getBlockTitle } from 'notion-utils'
import NotionPage from '@/components/NotionPage'
import GiscusComments from '@/components/GiscusComments'
import type { Metadata } from 'next'

export const revalidate = 60

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params
  const recordMap = await getPage(id)
  const block = recordMap.block[id]?.value
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const title = block ? getBlockTitle(block as any, recordMap) : 'hyeonlog'
  const description = getPageDescription(recordMap, id)

  return {
    title,
    description: description || undefined,
    openGraph: {
      title,
      description: description || undefined,
      type: 'article',
      url: `https://hyeonlog-com.vercel.app/posts/${id}`,
    },
  }
}

export default async function PostPage(
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const recordMap = await getPage(id)

  return (
    <>
      <NotionPage
        recordMap={recordMap}
        rootPageId={id}
        clientOnlyCollection
      />
      <GiscusComments />
    </>
  )
}
