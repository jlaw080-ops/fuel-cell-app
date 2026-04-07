# Next.js 16 변경점 메모 (Phase 2 작업 기준)

> 출처: `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md` 및 관련 가이드
> 작성: 2026-04-07
> 목적: AGENTS.md 경고("This is NOT the Next.js you know")에 따라 Phase 2 작업 전 학습 데이터와 다른 부분을 정리

---

## 1. 환경 / 빌드

| 항목 | Next 16 |
|---|---|
| Node.js | 20.9+ (18 미지원) |
| TypeScript | 5.1+ |
| 번들러 | **Turbopack 기본** (`next dev`/`next build` 모두). `--turbopack` 플래그 불필요 |
| 빌드 디렉토리 | `next dev` → `.next/dev`, `next build` → `.next` (동시 실행 가능) |
| `next.config.ts` Turbopack 설정 | `experimental.turbopack` → **최상위 `turbopack`** 으로 이동 (이미 [next.config.ts](../../next.config.ts)에 적용됨) |
| `next lint` 명령 | **제거됨**. ESLint CLI 직접 호출 (이미 [package.json](../../package.json) 적용됨) |

## 2. Async Request APIs (Phase 2 핵심 ⚠️)

**Next 16부터 동기 접근이 완전히 제거됨**. 다음은 모두 Promise:

- `cookies()`, `headers()`, `draftMode()` — 모두 await 필요
- `params` (in `layout.tsx`, `page.tsx`, `route.ts`)
- `searchParams` (in `page.tsx`)

```tsx
// ❌ Next 14/15
export default function Page({ params }: { params: { slug: string } }) {
  const { slug } = params;
}

// ✅ Next 16
export default async function Page(props: PageProps<'/[slug]'>) {
  const { slug } = await props.params;
}
```

**Phase 2 영향**: 탭1 입력 페이지가 dynamic segment를 쓰지는 않을 것이므로 큰 영향 없음. 단, Server Action 내에서 `cookies()`/`headers()` 사용 시 반드시 `await`.

### PageProps / LayoutProps / RouteContext 헬퍼

`npx next typegen`으로 자동 생성. 타입 안전성 ↑.

```tsx
export default async function Page(props: PageProps<'/blog/[slug]'>) { ... }
```

## 3. Server Actions (Phase 2 저장/불러오기 패턴)

**탭1 저장 = Server Action 사용 권장** (Route Handler 대신)

### 패턴 A — 별도 파일 (권장)

```ts filename="src/lib/actions/inputs.ts"
'use server';
import { supabase } from '@/lib/supabase/client';

export async function saveFuelCellInput(formData: FormData) {
  const payload = JSON.parse(formData.get('payload') as string);
  const { error } = await supabase.from('fuel_cell_inputs').upsert(payload);
  if (error) throw error;
}
```

```tsx filename="src/components/tabs/Tab1Input.tsx"
'use client';
import { saveFuelCellInput } from '@/lib/actions/inputs';

export function Tab1Input() {
  return (
    <form action={saveFuelCellInput}>
      <input type="hidden" name="payload" value={JSON.stringify(state)} />
      <button type="submit">저장</button>
    </form>
  );
}
```

### 보안 경고 (docs 인용)

> Server Functions are reachable via direct POST requests, not just through your application's UI. Always verify authentication and authorization inside every Server Function.

→ **Phase 2 영향**: 익명 + RLS 전체 허용 전략을 쓰더라도, Server Action 내부에서 입력 검증(zod 등) 필수.

### React 19 훅 (Server Action UX)

- `useActionState` — 서버 응답 상태 관리
- `useFormStatus` — 제출 중 상태
- `useOptimistic` — 낙관적 업데이트

## 4. Route Handlers (필요 시)

- 파일명: `app/api/.../route.ts`
- 함수: `export async function GET/POST/...`
- `params`는 **Promise**:
  ```ts
  export async function GET(req: Request, ctx: RouteContext<'/api/items/[id]'>) {
    const { id } = await ctx.params;
  }
  ```

**Phase 2 결정**: Server Action으로 충분하면 Route Handler 작성 불필요. 외부에서 호출되는 API가 필요할 때만 추가.

## 5. middleware → proxy

- `middleware.ts` → **`proxy.ts`로 리네임 권장** (Next 16부터 deprecated)
- 함수명: `middleware` → `proxy`
- 런타임: `nodejs` 고정 (edge 런타임 미지원, edge 필요 시 middleware 유지)
- 설정 플래그: `skipMiddlewareUrlNormalize` → `skipProxyUrlNormalize`

**Phase 2 영향**: 현재 미사용. Phase 5 이후 인증/CORS 추가 시 `proxy.ts`로 신규 작성.

## 6. Caching API 변화

| API | 설명 | 사용처 |
|---|---|---|
| `revalidateTag(tag, profile?)` | 백그라운드 재검증 (stale-while-revalidate) | 카탈로그성 데이터 |
| `updateTag(tag)` | **read-your-writes** 즉시 갱신 (Server Action 전용) | **폼 제출 후 즉시 반영 — Phase 2 적합** |
| `refresh()` | 클라이언트 라우터만 새로고침 | 부분 UI 갱신 |
| `cacheLife`, `cacheTag` | `unstable_` 접두사 제거 (stable) | — |

**Phase 2 권장**: 입력 저장 후 `updateTag('fuel-cell-inputs')` 호출하여 즉시 UI 반영.

## 7. 환경변수 (Phase 1에서 이미 적용)

- `serverRuntimeConfig` / `publicRuntimeConfig` **제거됨**
- `process.env.NEXT_PUBLIC_*` 사용 (현재 [.env.local](../../.env.local) 패턴 준수)
- **런타임 읽기**가 필요하면 `connection()` 후 `process.env` 접근 (빌드 타임 인라인 방지)

## 8. 기타 (Phase 2 직접 영향 없음)

- **Partial Prerendering (PPR)**: `cacheComponents: true` 옵션으로 변경 (`experimental_ppr` 제거). Phase 2에서는 활성화하지 않음.
- **Parallel Routes**: 모든 슬롯에 `default.js` 필수.
- **next/image**: `qualities` 기본값 `[75]`, `localPatterns.search` 필요 등 — 입력 화면에서 이미지 사용 거의 없음.
- **AMP**: 완전 제거.
- **React Compiler**: stable, 옵트인 (`reactCompiler: true`). Phase 2에서는 미사용.

---

## Phase 2 작업 시 적용 체크리스트

- [ ] `params`/`searchParams` 사용 시 반드시 `await`
- [ ] 폼 저장은 **Server Action** 패턴 (`'use server'` 별도 파일)
- [ ] Server Action 내부에 입력 검증 (zod) 추가
- [ ] 저장 성공 후 `updateTag()`로 즉시 UI 반영
- [ ] 클라이언트/서버 컴포넌트 경계 명확히 (`'use client'` 최소화)
- [ ] `next/image` 미사용 (입력 화면)
- [ ] 환경변수는 `NEXT_PUBLIC_*` 접두사 (이미 적용)
- [ ] Route Handler는 외부 API가 필요할 때만 작성

---

## 참조

- 전체 가이드: `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`
- Mutating Data: `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md`
- Server/Client Components: `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`
- Route Handlers: `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`
