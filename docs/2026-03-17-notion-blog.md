# Notion Blog (hyeonlog.com) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** hyeonlog.com을 Next.js 15 App Router + react-notion-x 기반으로 처음부터 구축한다. Notion 앱과 완전히 동일한 디자인으로 데이터베이스 뷰와 글 본문을 렌더링한다.

**Architecture:** `notion-client`로 Notion 페이지 데이터를 fetch하고, `react-notion-x`로 데이터베이스 뷰(글 목록)와 글 본문을 모두 Notion 원본 디자인 그대로 렌더링한다. `mapPageUrl` 옵션으로 Notion 내부 링크를 `/posts/[id]`로 리다이렉트. ISR(revalidate: 60)로 Notion publish 시 최대 60초 내 자동 반영.

**Tech Stack:** Next.js 15 (App Router), TypeScript, notion-client, react-notion-x, notion-utils, @giscus/react, Vercel

---

## File Structure

```
hyeonlog.com/
├── app/
│   ├── layout.tsx              # Root layout, react-notion-x CSS import
│   ├── page.tsx                # 홈: Notion 데이터베이스 뷰 그대로 렌더링
│   ├── posts/
│   │   └── [id]/
│   │       └── page.tsx        # 글 상세: Notion 디자인 + Giscus
│   ├── sitemap.ts              # 자동 생성 sitemap
│   └── robots.ts
├── components/
│   ├── NotionPage.tsx          # react-notion-x NotionRenderer wrapper (client)
│   └── GiscusComments.tsx      # Giscus 댓글 컴포넌트 (client)
└── lib/
    └── notion.ts               # notion-client 인스턴스 + fetch 헬퍼
```

---

## Task 0: Notion 설정 (수동 1회)

딱 한 번만 하면 이후 글 올릴 때 추가 작업 없음.

- [ ] **Step 1: Notion DB 만들기**
  - Notion에서 새 페이지 → Database (Full page)
  - 속성 추가:

    | 속성명 | 타입 | 용도 |
    |--------|------|------|
    | Title | 기본값 | 글 제목 |
    | Status | Select: Draft / Published | 공개 여부 필터용 |
    | Date | Date | 발행일 |
    | Tags | Multi-select | 태그 |

- [ ] **Step 2: DB에 "Published" 필터 뷰 만들기**
  - DB 우상단 + 버튼 → Add a view → List 또는 Gallery
  - 이 뷰에서 Filter → Status = Published 설정
  - 이 뷰의 URL에서 마지막 `?v=` 뒤 UUID 복사 → **Collection View ID**
  - DB URL에서 `?v=` 앞 32자리 hex → **Database Page ID**

  예: `https://notion.so/yourname/[DATABASE_PAGE_ID]?v=[COLLECTION_VIEW_ID]`

- [ ] **Step 3: DB 페이지 공개 설정**
  - DB 페이지 우상단 Share → "Share to web" ON
  - ⚠️ DB 전체를 공개로 설정 (개별 글 페이지도 자동으로 공개됨)
  - ⚠️ Step 2에서 만든 "Published" 필터 뷰를 **기본 뷰(Default view)**로 설정해야 함
    - DB 뷰 탭에서 우클릭 → "Set as default" (또는 드래그로 첫 번째로 이동)
    - 이렇게 해야 홈 페이지에서 Draft 글이 노출되지 않음

- [ ] **Step 4: 테스트 글 2개 만들기**
  - Status: Published 글 1개 (내용 몇 줄 이상 있어야 렌더링 확인 가능)
  - Status: Draft 글 1개 (Published 뷰에서 숨겨지는지 확인용)

---

## Task 1: 프로젝트 생성

**Files:**
- Create: 새 디렉터리 + 프로젝트 전체 (create-next-app)
- Create: `.env.local`

- [ ] **Step 1: 새 GitHub 레포 만들기**
  - https://github.com/new → Repository name: `hyeonlog.com`
  - 새 레포: Public, README 없이 빈 레포로 생성

- [ ] **Step 2: 새 디렉터리에 Next.js 프로젝트 생성**
  ```bash
  cd ~
  npx create-next-app@latest hyeonlog.com --typescript --app --no-tailwind --eslint --import-alias "@/*"
  cd hyeonlog.com
  ```
  - ✅ TypeScript
  - ✅ App Router
  - ❌ Tailwind (react-notion-x가 자체 CSS 처리)

- [ ] **Step 3: 새 GitHub 레포에 연결**
  ```bash
  git remote set-url origin https://github.com/hyeonji1220/hyeonlog.com.git
  ```

- [ ] **Step 4: 의존성 설치**
  ```bash
  npm install notion-client react-notion-x notion-utils @giscus/react
  npm install -D @types/react
  ```

- [ ] **Step 5: .env.local 생성**
  ```
  NOTION_DATABASE_PAGE_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  ```
  - Task 0 Step 2에서 복사한 Database Page ID (하이픈 없는 32자리 hex)

- [ ] **Step 6: 초기 commit + push**
  ```bash
  git add -A
  git commit -m "chore: initialize Next.js 15 + notion-client + react-notion-x"
  git push -u origin main
  ```

---

## Task 2: Notion 클라이언트 lib

**Files:**
- Create: `lib/notion.ts`

- [ ] **Step 1: lib/notion.ts 작성**
  ```ts
  import { NotionAPI } from 'notion-client'

  export const notion = new NotionAPI()

  export const DATABASE_PAGE_ID = process.env.NOTION_DATABASE_PAGE_ID!

  export async function getPage(pageId: string) {
    return notion.getPage(pageId)
  }
  ```

- [ ] **Step 2: commit**
  ```bash
  git add lib/notion.ts
  git commit -m "feat: add notion-client lib"
  ```

---

## Task 3: Root layout + CSS

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: layout.tsx 작성**
  ```tsx
  import type { Metadata } from 'next'
  import 'react-notion-x/src/styles.css'
  import './globals.css'

  export const metadata: Metadata = {
    title: 'hyeonlog',
    description: 'hyeonlog',
  }

  export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
      <html lang="ko">
        <body>{children}</body>
      </html>
    )
  }
  ```

- [ ] **Step 2: globals.css 최소화**
  - Next.js 생성 globals.css에서 내용을 모두 지우고 아래만 남기기:
  ```css
  * { box-sizing: border-box; }
  body { margin: 0; }
  ```

- [ ] **Step 3: commit**
  ```bash
  git add app/layout.tsx app/globals.css
  git commit -m "feat: root layout with react-notion-x CSS"
  ```

---

## Task 4: NotionPage 컴포넌트

`NotionRenderer`는 브라우저 전용 코드를 포함하므로 `'use client'` + dynamic import가 필요하다.

**Files:**
- Create: `components/NotionPage.tsx`

- [ ] **Step 1: components/NotionPage.tsx 작성**
  ```tsx
  'use client'

  import dynamic from 'next/dynamic'
  import { NotionRenderer } from 'react-notion-x'
  import type { ExtendedRecordMap } from 'notion-types'

  // 무거운 서드파티 컴포넌트는 dynamic import로 lazy load
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
    // 내부 페이지 링크를 /posts/[id]로 리다이렉트하는 함수
    mapPageUrl?: (pageId: string) => string
  }

  export default function NotionPage({ recordMap, rootPageId, mapPageUrl }: Props) {
    return (
      <NotionRenderer
        recordMap={recordMap}
        fullPage
        darkMode={false}
        rootPageId={rootPageId}
        mapPageUrl={mapPageUrl}
        components={{ Code, Collection, Equation }}
      />
    )
  }
  ```

- [ ] **Step 2: commit**
  ```bash
  git add components/NotionPage.tsx
  git commit -m "feat: add NotionPage renderer component"
  ```

---

## Task 5: 홈 페이지 (Notion DB 뷰)

데이터베이스 페이지 전체를 렌더링한다. Notion의 테이블/갤러리/리스트 뷰가 그대로 나온다.

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: app/page.tsx 작성**
  ```tsx
  import { getPage, DATABASE_PAGE_ID } from '@/lib/notion'
  import NotionPage from '@/components/NotionPage'

  export const revalidate = 60

  export default async function HomePage() {
    const recordMap = await getPage(DATABASE_PAGE_ID)

    return (
      <NotionPage
        recordMap={recordMap}
        rootPageId={DATABASE_PAGE_ID}
        mapPageUrl={(pageId) => `/posts/${pageId.replace(/-/g, '')}`}
      />
    )
  }
  ```

- [ ] **Step 2: 개발 서버 실행 후 확인**
  ```bash
  npm run dev
  ```
  - http://localhost:3000 에서 Notion 데이터베이스 뷰가 Notion 앱과 동일하게 보여야 함
  - Published 뷰로 만들었다면 Draft 글은 보이지 않아야 함

- [ ] **Step 3: commit**
  ```bash
  git add app/page.tsx
  git commit -m "feat: home page renders Notion database view (ISR 60s)"
  ```

---

## Task 6: 글 상세 페이지

**Files:**
- Create: `app/posts/[id]/page.tsx`

- [ ] **Step 1: app/posts/[id]/page.tsx 작성**
  ```tsx
  import { getPage } from '@/lib/notion'
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
    const title = block ? getBlockTitle(block, recordMap) : 'hyeonlog'
    return { title: `${title} | hyeonlog` }
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
          mapPageUrl={(pageId) => `/posts/${pageId.replace(/-/g, '')}`}
        />
        <GiscusComments />
      </>
    )
  }
  ```

- [ ] **Step 2: 개발 서버에서 글 상세 확인**
  - 홈에서 글 클릭 → `/posts/[id]`로 이동
  - Notion 앱에서 보이는 것과 동일한 디자인이어야 함 (폰트, 여백, 블록 구조)

- [ ] **Step 3: commit**
  ```bash
  git add app/posts/
  git commit -m "feat: post detail page with react-notion-x + metadata"
  ```

---

## Task 7: Giscus 댓글

GitHub Discussions 기반 무료 댓글 시스템. GitHub 로그인 사용자만 댓글 가능.

**Files:**
- Create: `components/GiscusComments.tsx`

- [ ] **Step 1: GitHub 설정 (1회)**
  - GitHub repo `hyeonji1220/hyeonlog.com` → Settings → Features → **Discussions** ✓ 체크
  - https://giscus.app 접속
  - Repository: `hyeonji1220/hyeonlog.com`
  - Page ↔ Discussion mapping: **pathname**
  - Discussion Category: **Announcements** (댓글만 봇이 생성 가능한 카테고리)
  - **data-repo-id, data-category-id 값 복사**
  - `.env.local`에 추가:
    ```
    NEXT_PUBLIC_GISCUS_REPO_ID=R_xxxxxxxxxx
    NEXT_PUBLIC_GISCUS_CATEGORY_ID=DIC_xxxxxxxxxx
    ```
  - Vercel 환경변수에도 동일하게 추가 (Task 9 Step 3에서)

- [ ] **Step 2: components/GiscusComments.tsx 작성**
  ```tsx
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
  ```

- [ ] **Step 3: 개발 서버에서 댓글 위젯 확인**
  - 글 상세 하단에 Giscus 위젯 로드 확인
  - GitHub 로그인 후 댓글 작성 테스트

- [ ] **Step 4: commit**
  ```bash
  git add components/GiscusComments.tsx
  git commit -m "feat: add Giscus comments component"
  ```

---

## Task 8: Sitemap + robots

**Files:**
- Create: `app/sitemap.ts`
- Create: `app/robots.ts`

글 목록을 sitemap에 포함하려면 DB의 블록 ID를 추출해야 한다.

- [ ] **Step 1: lib/notion.ts에 getPostIds 추가**
  ```ts
  // lib/notion.ts에 추가
  export async function getPostIds(): Promise<string[]> {
    const recordMap = await getPage(DATABASE_PAGE_ID)
    // parent_id는 하이픈 포함 UUID 형식이므로 양쪽을 하이픈 없이 비교
    const databaseId = DATABASE_PAGE_ID.replace(/-/g, '')
    return Object.keys(recordMap.block).filter(id => {
      const block = recordMap.block[id]?.value
      const parentId = block?.parent_id?.replace(/-/g, '') ?? ''
      return block?.type === 'page' && parentId === databaseId
    })
  }
  ```

- [ ] **Step 2: app/sitemap.ts 작성**
  ```ts
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
  ```

- [ ] **Step 3: app/robots.ts 작성**
  ```ts
  import type { MetadataRoute } from 'next'

  export default function robots(): MetadataRoute.Robots {
    return {
      rules: { userAgent: '*', allow: '/' },
      sitemap: 'https://hyeonlog.com/sitemap.xml',
    }
  }
  ```

- [ ] **Step 4: commit**
  ```bash
  git add lib/notion.ts app/sitemap.ts app/robots.ts
  git commit -m "feat: add sitemap and robots.txt"
  ```

---

## Task 9: Vercel 배포

- [ ] **Step 1: GitHub push**
  ```bash
  git push origin main
  ```

- [ ] **Step 2: Vercel 프로젝트 생성**
  - https://vercel.com → Add New Project
  - GitHub repo `hyeonji1220/hyeonlog.com` import
  - Framework: Next.js (자동 감지됨)

- [ ] **Step 3: 환경변수 설정**
  - Vercel 프로젝트 → Settings → Environment Variables
  - `NOTION_DATABASE_PAGE_ID` = Task 0에서 복사한 32자리 hex
  - `NEXT_PUBLIC_GISCUS_REPO_ID` = Task 7 Step 1에서 복사한 data-repo-id
  - `NEXT_PUBLIC_GISCUS_CATEGORY_ID` = Task 7 Step 1에서 복사한 data-category-id

- [ ] **Step 4: 첫 배포 확인**
  - Deploy → Build Logs에서 에러 없으면 OK
  - 생성된 `.vercel.app` 도메인에서 사이트 동작 확인

- [ ] **Step 5: 커스텀 도메인 연결**
  - Vercel 프로젝트 → Domains → `hyeonlog.com` 추가
  - DNS 레코드 업데이트 (도메인 등록 사이트에서 A 또는 CNAME 설정)

---

## Task 10: Google Search Console 등록

- [ ] **Step 1: Search Console 속성 추가**
  - https://search.google.com/search-console → Add Property
  - `https://hyeonlog.com` 입력

- [ ] **Step 2: 소유권 인증**
  - HTML tag 방법 → `<meta name="google-site-verification" content="xxx">` 복사
  - `app/layout.tsx`의 metadata에 추가 (xxx 자리에 복사한 코드 붙여넣기):
    ```ts
    export const metadata: Metadata = {
      title: 'hyeonlog',
      description: 'hyeonlog',
      verification: { google: 'xxx' },
    }
    ```
  - `git push` → Vercel 자동 배포 → Search Console에서 "인증" 클릭

- [ ] **Step 3: Sitemap 제출**
  - Search Console → Sitemaps → `https://hyeonlog.com/sitemap.xml` 제출

---

## 이후 글 쓰는 방법 (추가 작업 없음)

1. Notion DB에 새 row 추가 → 글 작성
2. **Status: Published** 로 변경
3. 끝. 최대 60초 후 자동으로 사이트에 반영됨 ✅

> Draft 상태인 글은 Task 0 Step 2에서 만든 "Published" 필터 뷰에 의해 홈에 노출되지 않음.
> DB 페이지 자체가 "Share to web"으로 공개되어 있으므로 개별 글에 별도 설정 불필요.
