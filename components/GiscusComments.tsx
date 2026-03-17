'use client'

import Giscus from '@giscus/react'

export default function GiscusComments() {
  return (
    <div style={{ maxWidth: 900, margin: '40px auto', padding: '0 24px' }}>
      <Giscus
        repo="hyeonji1220/hyeonlog.com"
        repoId={process.env.NEXT_PUBLIC_GISCUS_REPO_ID!}
        category="Announcements"
        categoryId={process.env.NEXT_PUBLIC_GISCUS_CATEGORY_ID!}
        mapping="pathname"
        strict="0"
        reactionsEnabled="1"
        emitMetadata="0"
        inputPosition="top"
        theme="light"
        lang="ko"
      />
    </div>
  )
}
