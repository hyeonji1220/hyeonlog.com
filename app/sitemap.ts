import { getPostIds } from '@/lib/notion'
import type { MetadataRoute } from 'next'

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const postIds = await getPostIds()
  return [
    {
      url: 'https://hyeonlog.com',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    ...postIds.map(id => ({
      url: `https://hyeonlog.com/posts/${id}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ]
}
