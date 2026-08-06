# QM팀 개인앱 아카이브 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** QM팀원이 개인적으로 만든 도구(exe/zip 등)를 업로드·다운로드할 수 있는 별도 웹앱을 만들고, DCS AI embedded-app으로 배포한다.

**Architecture:** Express(TypeScript) 백엔드 + React(Vite) 프론트엔드. 파일 바이트는 DCS AI S3 Presigned URL API, 메타데이터는 PostgreSQL. 인증은 DCS AI가 postMessage로 전달하는 사용자 정보를 그대로 신뢰(백엔드 자체 토큰 검증 없음 — 내부 도구, 낮은 민감도).

**Tech Stack:** Node.js 20+, Express, TypeScript, `pg`, Vite + React 18, Vitest, Docker(로컬 Postgres 전용).

## Global Constraints

- AWS SDK(`@aws-sdk/client-s3`, `boto3`) 직접 사용 금지 — S3는 반드시 Presigned URL API(`https://aviyup1kyk.execute-api.ap-northeast-2.amazonaws.com/prod`) 경유 (spec: 아키텍처)
- DB는 PostgreSQL만 허용, ORM 금지 — Raw SQL + `pg` 파라미터 바인딩(`$1, $2...`) (dcs-ai-common:embedded-app 표준)
- 자체 로그인/비밀번호 인증 금지 — DCS AI postMessage(`DCS_AUTH`)로 전달받은 `user.email`을 업로더로 사용 (spec: 인증)
- 파일당 대략 50MB 이하 기준 (spec: 범위)
- 삭제는 QM팀원 누구나 가능, 업로더 제한 없음 (spec: 삭제 권한)
- 카테고리는 자유텍스트, 목록에서 태그로 노출·필터 (spec: 데이터 모델)
- Pod 재시작 시 로컬 파일 전부 소멸 — 파일시스템에 아무것도 영구 저장하지 않음 (dcs-ai-common:embedded-app `deployment/prep.md`)

---

## File Structure

```
qm-personal-apps/
├── docker-compose.yml          # 로컬 개발용 Postgres
├── .env.example
├── .gitignore
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts            # 엔트리포인트
│       ├── app.ts               # Express app 설정
│       ├── config.ts            # 환경변수 스키마
│       ├── db/
│       │   ├── pool.ts          # pg Pool
│       │   └── schema.sql       # personal_apps 테이블 정의
│       ├── repositories/
│       │   └── personal-apps.repository.ts
│       ├── services/
│       │   └── s3.service.ts
│       ├── routes/
│       │   ├── index.ts
│       │   ├── health.ts
│       │   └── personal-apps.ts
│       └── types/
│           └── index.ts
└── client/
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── hooks/
        │   └── useDcsAuth.ts
        ├── contexts/
        │   └── AuthContext.tsx
        ├── services/
        │   └── api.ts
        ├── utils/
        │   └── filterApps.ts
        └── components/
            ├── UploadForm.tsx
            └── AppList.tsx
```

---

### Task 1: 백엔드 스캐폴드 + 헬스체크

**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/src/config.ts`
- Create: `server/src/app.ts`
- Create: `server/src/index.ts`
- Create: `server/src/routes/health.ts`
- Create: `server/src/routes/index.ts`
- Test: `server/src/routes/health.test.ts`

**Interfaces:**
- Produces: `app` (Express 인스턴스, `server/src/app.ts`에서 export), `config` (`server/src/config.ts`에서 export하는 파싱된 환경변수 객체 — `PORT: number`, `CORS_ORIGIN: string`, `POSTGRESQL_HOST/PORT/USERNAME/PASSWORD/DATABASE: string`)

- [ ] **Step 1: package.json 작성**

```json
{
  "name": "qm-personal-apps-server",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "express": "^4.19.0",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "multer": "^1.4.5-lts.1",
    "pg": "^8.11.5",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "@types/node": "^20.12.0",
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17",
    "@types/multer": "^1.4.11",
    "@types/pg": "^8.11.6",
    "tsx": "^4.7.0",
    "vitest": "^1.6.0",
    "supertest": "^7.0.0",
    "@types/supertest": "^6.0.2"
  }
}
```

- [ ] **Step 2: tsconfig.json 작성**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: config.ts 작성**

```typescript
// server/src/config.ts
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  CORS_ORIGIN: z.string().default('*'),

  POSTGRESQL_HOST: z.string(),
  POSTGRESQL_PORT: z.string().transform(Number).default('5432'),
  POSTGRESQL_USERNAME: z.string(),
  POSTGRESQL_PASSWORD: z.string(),
  POSTGRESQL_DATABASE: z.string(),

  S3_API_BASE_URL: z.string().default('https://aviyup1kyk.execute-api.ap-northeast-2.amazonaws.com/prod'),
  S3_API_KEY: z.string(),
  S3_BUCKET: z.string().default('svc-fnf-ax-platform-pub-s3'),
})

export const config = envSchema.parse(process.env)
```

- [ ] **Step 4: health 라우트 + 실패하는 테스트 작성**

```typescript
// server/src/routes/health.ts
import { Router, Request, Response } from 'express'

const router = Router()

router.get('/', (req: Request, res: Response) => {
  res.json({ success: true, data: { status: 'ok' } })
})

export { router as healthRoutes }
```

```typescript
// server/src/routes/index.ts
import { Router } from 'express'
import { healthRoutes } from './health'

const router = Router()
router.use('/health', healthRoutes)

export { router as routes }
```

```typescript
// server/src/app.ts
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { routes } from './routes'
import { config } from './config'

const app = express()

app.use(helmet())
app.use(cors({ origin: config.CORS_ORIGIN }))
app.use(express.json())
app.use('/api', routes)

export { app }
```

```typescript
// server/src/index.ts
import { app } from './app'
import { config } from './config'

app.listen(config.PORT, () => {
  console.log(`Server running on port ${config.PORT}`)
})
```

```typescript
// server/src/routes/health.test.ts
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../app'

describe('GET /api/health', () => {
  it('returns ok status', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true, data: { status: 'ok' } })
  })
})
```

- [ ] **Step 5: 의존성 설치 후 테스트 실행**

Run (in `server/`):
```bash
npm install
POSTGRESQL_HOST=localhost POSTGRESQL_USERNAME=x POSTGRESQL_PASSWORD=x POSTGRESQL_DATABASE=x S3_API_KEY=x npm test
```
Expected: PASS — `GET /api/health` 테스트 통과 (아직 DB 연결 안 함, config 파싱만 되면 통과)

- [ ] **Step 6: 커밋**

```bash
git add server/package.json server/tsconfig.json server/src
git commit -m "feat: scaffold backend with health check"
```

---

### Task 2: Postgres 스키마 + 리포지토리

**Files:**
- Create: `docker-compose.yml`
- Create: `server/src/db/schema.sql`
- Create: `server/src/db/pool.ts`
- Create: `server/src/repositories/personal-apps.repository.ts`
- Create: `server/src/types/index.ts`
- Test: `server/src/repositories/personal-apps.repository.test.ts`

**Interfaces:**
- Consumes: `config`(Task 1) — `POSTGRESQL_*` 필드
- Produces: `PersonalApp` 타입 (`server/src/types/index.ts`), `getPool(): Pool` (`server/src/db/pool.ts`), `PersonalAppsRepository` 클래스 — `create(dto: CreatePersonalAppDto): Promise<PersonalApp>`, `list(category?: string): Promise<PersonalApp[]>`, `findById(id: number): Promise<PersonalApp | null>`, `remove(id: number): Promise<void>` (`server/src/repositories/personal-apps.repository.ts`)

- [ ] **Step 1: docker-compose.yml 작성 (로컬 개발용 Postgres)**

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: qm_apps
      POSTGRES_PASSWORD: qm_apps_local
      POSTGRES_DB: qm_personal_apps
    ports:
      - "5433:5432"
```

- [ ] **Step 2: schema.sql 작성**

```sql
-- server/src/db/schema.sql
create table if not exists personal_apps (
    id                integer generated always as identity primary key,
    name              text not null,
    description       text,
    category          text,
    s3_key            text not null,
    original_filename text not null,
    file_size         integer not null,
    uploader_email    text not null,
    uploaded_at       timestamptz not null default now()
);
```

- [ ] **Step 3: pool.ts 작성**

```typescript
// server/src/db/pool.ts
import { Pool } from 'pg'
import { config } from '../config'

let pool: Pool | null = null

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host: config.POSTGRESQL_HOST,
      port: config.POSTGRESQL_PORT,
      user: config.POSTGRESQL_USERNAME,
      password: config.POSTGRESQL_PASSWORD,
      database: config.POSTGRESQL_DATABASE,
    })
  }
  return pool
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
  }
}
```

- [ ] **Step 4: 타입 정의**

```typescript
// server/src/types/index.ts
export interface PersonalApp {
  id: number
  name: string
  description: string | null
  category: string | null
  s3_key: string
  original_filename: string
  file_size: number
  uploader_email: string
  uploaded_at: Date
}

export interface CreatePersonalAppDto {
  name: string
  description: string | null
  category: string | null
  s3_key: string
  original_filename: string
  file_size: number
  uploader_email: string
}
```

- [ ] **Step 5: 실패하는 테스트 작성**

```typescript
// server/src/repositories/personal-apps.repository.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getPool, closePool } from '../db/pool'
import { PersonalAppsRepository } from './personal-apps.repository'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('PersonalAppsRepository', () => {
  const repo = new PersonalAppsRepository(getPool())

  beforeAll(async () => {
    const schema = readFileSync(join(__dirname, '../db/schema.sql'), 'utf-8')
    await getPool().query(schema)
  })

  beforeEach(async () => {
    await getPool().query('delete from personal_apps')
  })

  afterAll(async () => {
    await getPool().query('drop table if exists personal_apps')
    await closePool()
  })

  it('creates and lists an app', async () => {
    await repo.create({
      name: '패턴 요청 툴',
      description: '자동 회신용',
      category: '패턴툴',
      s3_key: 'qm-personal-apps/dev/uploads/1-tool.zip',
      original_filename: 'tool.zip',
      file_size: 1024,
      uploader_email: 'jade@fnfcorp.com',
    })

    const apps = await repo.list()
    expect(apps).toHaveLength(1)
    expect(apps[0].name).toBe('패턴 요청 툴')
    expect(apps[0].category).toBe('패턴툴')
  })

  it('filters by category', async () => {
    await repo.create({
      name: 'A', description: null, category: 'TD',
      s3_key: 'k1', original_filename: 'a.zip', file_size: 10, uploader_email: 'a@fnfcorp.com',
    })
    await repo.create({
      name: 'B', description: null, category: 'QA',
      s3_key: 'k2', original_filename: 'b.zip', file_size: 10, uploader_email: 'b@fnfcorp.com',
    })

    const tdOnly = await repo.list('TD')
    expect(tdOnly).toHaveLength(1)
    expect(tdOnly[0].name).toBe('A')
  })

  it('removes an app by id', async () => {
    const created = await repo.create({
      name: 'C', description: null, category: null,
      s3_key: 'k3', original_filename: 'c.zip', file_size: 10, uploader_email: 'c@fnfcorp.com',
    })

    await repo.remove(created.id)

    const found = await repo.findById(created.id)
    expect(found).toBeNull()
  })
})
```

- [ ] **Step 6: 테스트 실행하여 실패 확인**

```bash
docker compose up -d
cd server
POSTGRESQL_HOST=localhost POSTGRESQL_PORT=5433 POSTGRESQL_USERNAME=qm_apps POSTGRESQL_PASSWORD=qm_apps_local POSTGRESQL_DATABASE=qm_personal_apps S3_API_KEY=x npm test -- personal-apps.repository
```
Expected: FAIL — `Cannot find module './personal-apps.repository'`

- [ ] **Step 7: 리포지토리 구현**

```typescript
// server/src/repositories/personal-apps.repository.ts
import { Pool } from 'pg'
import { PersonalApp, CreatePersonalAppDto } from '../types'

export class PersonalAppsRepository {
  constructor(private pool: Pool) {}

  async create(dto: CreatePersonalAppDto): Promise<PersonalApp> {
    const result = await this.pool.query<PersonalApp>(
      `insert into personal_apps
          (name, description, category, s3_key, original_filename, file_size, uploader_email)
       values ($1, $2, $3, $4, $5, $6, $7)
       returning id, name, description, category, s3_key, original_filename,
                 file_size, uploader_email, uploaded_at`,
      [dto.name, dto.description, dto.category, dto.s3_key, dto.original_filename, dto.file_size, dto.uploader_email]
    )
    return result.rows[0]
  }

  async list(category?: string): Promise<PersonalApp[]> {
    if (category) {
      const result = await this.pool.query<PersonalApp>(
        `select id, name, description, category, s3_key, original_filename,
                file_size, uploader_email, uploaded_at
         from personal_apps
         where category = $1
         order by uploaded_at desc
         limit 500`,
        [category]
      )
      return result.rows
    }

    const result = await this.pool.query<PersonalApp>(
      `select id, name, description, category, s3_key, original_filename,
              file_size, uploader_email, uploaded_at
       from personal_apps
       order by uploaded_at desc
       limit 500`
    )
    return result.rows
  }

  async findById(id: number): Promise<PersonalApp | null> {
    const result = await this.pool.query<PersonalApp>(
      `select id, name, description, category, s3_key, original_filename,
              file_size, uploader_email, uploaded_at
       from personal_apps
       where id = $1`,
      [id]
    )
    return result.rows[0] ?? null
  }

  async remove(id: number): Promise<void> {
    await this.pool.query('delete from personal_apps where id = $1', [id])
  }
}
```

- [ ] **Step 8: 테스트 통과 확인**

```bash
npm test -- personal-apps.repository
```
Expected: PASS (3 tests)

- [ ] **Step 9: 커밋**

```bash
git add docker-compose.yml server/src/db server/src/repositories server/src/types
git commit -m "feat: add personal_apps schema and repository"
```

---

### Task 3: S3 서비스 레이어

**Files:**
- Create: `server/src/services/s3.service.ts`
- Test: `server/src/services/s3.service.test.ts`

**Interfaces:**
- Consumes: `config`(Task 1) — `S3_API_BASE_URL`, `S3_API_KEY`, `S3_BUCKET`
- Produces: `uploadFile(path: string, body: Buffer, contentType: string, fetchImpl?: typeof fetch): Promise<string>`, `downloadFile(path: string, fetchImpl?: typeof fetch): Promise<Buffer>`, `deleteFile(path: string, fetchImpl?: typeof fetch): Promise<void>`, `buildKey(path: string): string` (`server/src/services/s3.service.ts`) — `fetchImpl` 파라미터는 테스트에서 네트워크 없이 stub 주입하기 위함, 기본값은 전역 `fetch`

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
// server/src/services/s3.service.test.ts
import { describe, it, expect, vi } from 'vitest'
import { buildKey, uploadFile, downloadFile, deleteFile } from './s3.service'

function makeFetchStub(responses: Response[]) {
  let call = 0
  return vi.fn(async () => responses[call++])
}

describe('s3.service', () => {
  it('buildKey prefixes with service/env', () => {
    const key = buildKey('uploads/foo.zip')
    expect(key).toMatch(/^qm-personal-apps\/(dev|prd)\/uploads\/foo\.zip$/)
  })

  it('uploadFile requests a presigned PUT_OBJECT url then PUTs the body', async () => {
    const fetchStub = makeFetchStub([
      new Response(JSON.stringify({ url: 'https://s3.example/presigned-put' }), { status: 200 }),
      new Response(null, { status: 200 }),
    ])

    const key = await uploadFile('uploads/foo.zip', Buffer.from('hello'), 'application/zip', fetchStub)

    expect(key).toMatch(/uploads\/foo\.zip$/)
    expect(fetchStub).toHaveBeenCalledTimes(2)
    const [signCall, putCall] = fetchStub.mock.calls
    expect(signCall[0]).toContain('/sign')
    expect(JSON.parse(signCall[1].body).action).toBe('PUT_OBJECT')
    expect(putCall[0]).toBe('https://s3.example/presigned-put')
    expect(putCall[1].method).toBe('PUT')
  })

  it('downloadFile requests GET_OBJECT then fetches bytes', async () => {
    const fetchStub = makeFetchStub([
      new Response(JSON.stringify({ url: 'https://s3.example/presigned-get' }), { status: 200 }),
      new Response(Buffer.from('data'), { status: 200 }),
    ])

    const buf = await downloadFile('uploads/foo.zip', fetchStub)

    expect(buf.toString()).toBe('data')
    const [signCall] = fetchStub.mock.calls
    expect(JSON.parse(signCall[1].body).action).toBe('GET_OBJECT')
  })

  it('deleteFile requests DELETE_OBJECT then DELETEs', async () => {
    const fetchStub = makeFetchStub([
      new Response(JSON.stringify({ url: 'https://s3.example/presigned-delete' }), { status: 200 }),
      new Response(null, { status: 200 }),
    ])

    await deleteFile('uploads/foo.zip', fetchStub)

    const [signCall, deleteCall] = fetchStub.mock.calls
    expect(JSON.parse(signCall[1].body).action).toBe('DELETE_OBJECT')
    expect(deleteCall[1].method).toBe('DELETE')
  })
})
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

```bash
npm test -- s3.service
```
Expected: FAIL — `Cannot find module './s3.service'`

- [ ] **Step 3: S3 서비스 구현**

```typescript
// server/src/services/s3.service.ts
import { config } from '../config'

const SERVICE_NAME = 'qm-personal-apps'
const ENV = config.NODE_ENV === 'production' ? 'prd' : 'dev'

export function buildKey(path: string): string {
  return `${SERVICE_NAME}/${ENV}/${path}`
}

async function getPresignedUrl(
  key: string,
  action: 'PUT_OBJECT' | 'GET_OBJECT' | 'DELETE_OBJECT',
  fetchImpl: typeof fetch
): Promise<string> {
  const response = await fetchImpl(`${config.S3_API_BASE_URL}/sign`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': config.S3_API_KEY,
    },
    body: JSON.stringify({ bucket: config.S3_BUCKET, key, action }),
  })

  if (!response.ok) {
    throw new Error(`Presigned URL 발급 실패: ${response.status}`)
  }

  const data = await response.json()
  return data.url
}

export async function uploadFile(
  path: string,
  body: Buffer,
  contentType: string,
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  const key = buildKey(path)
  const presignedUrl = await getPresignedUrl(key, 'PUT_OBJECT', fetchImpl)

  const response = await fetchImpl(presignedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body,
  })

  if (!response.ok) {
    throw new Error(`S3 업로드 실패: ${response.status}`)
  }

  return key
}

export async function downloadFile(path: string, fetchImpl: typeof fetch = fetch): Promise<Buffer> {
  const key = path.startsWith(SERVICE_NAME) ? path : buildKey(path)
  const presignedUrl = await getPresignedUrl(key, 'GET_OBJECT', fetchImpl)

  const response = await fetchImpl(presignedUrl)
  if (!response.ok) {
    throw new Error(`S3 다운로드 실패: ${response.status}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

export async function deleteFile(path: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  const key = path.startsWith(SERVICE_NAME) ? path : buildKey(path)
  const presignedUrl = await getPresignedUrl(key, 'DELETE_OBJECT', fetchImpl)

  const response = await fetchImpl(presignedUrl, { method: 'DELETE' })
  if (!response.ok) {
    throw new Error(`S3 삭제 실패: ${response.status}`)
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npm test -- s3.service
```
Expected: PASS (4 tests)

- [ ] **Step 5: 커밋**

```bash
git add server/src/services
git commit -m "feat: add S3 presigned URL service"
```

---

### Task 4: API 라우트 (업로드/목록/다운로드/삭제)

**Files:**
- Create: `server/src/routes/personal-apps.ts`
- Modify: `server/src/routes/index.ts`
- Test: `server/src/routes/personal-apps.test.ts`

**Interfaces:**
- Consumes: `PersonalAppsRepository`(Task 2), `uploadFile`/`downloadFile`/`deleteFile`(Task 3)
- Produces: Express 라우터 (`personalAppsRoutes`), mount 경로 `/api/personal-apps`

- [ ] **Step 1: 실패하는 테스트 작성 (repository/s3 모킹)**

```typescript
// server/src/routes/personal-apps.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

const mockRepo = {
  create: vi.fn(),
  list: vi.fn(),
  findById: vi.fn(),
  remove: vi.fn(),
}

vi.mock('../repositories/personal-apps.repository', () => ({
  PersonalAppsRepository: vi.fn(() => mockRepo),
}))

vi.mock('../services/s3.service', () => ({
  uploadFile: vi.fn(async (path: string) => `qm-personal-apps/test/${path}`),
  downloadFile: vi.fn(async () => Buffer.from('file-bytes')),
  deleteFile: vi.fn(async () => {}),
}))

vi.mock('../db/pool', () => ({ getPool: vi.fn(() => ({})) }))

import { personalAppsRoutes } from './personal-apps'

const app = express()
app.use(express.json())
app.use('/api/personal-apps', personalAppsRoutes)

describe('personal-apps routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET / returns the list from the repository', async () => {
    mockRepo.list.mockResolvedValue([{ id: 1, name: 'Tool A' }])

    const res = await request(app).get('/api/personal-apps')

    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([{ id: 1, name: 'Tool A' }])
  })

  it('GET /?category=TD passes the filter through', async () => {
    mockRepo.list.mockResolvedValue([])

    await request(app).get('/api/personal-apps?category=TD')

    expect(mockRepo.list).toHaveBeenCalledWith('TD')
  })

  it('POST / uploads to S3 and stores metadata', async () => {
    mockRepo.create.mockResolvedValue({ id: 2, name: 'Tool B' })

    const res = await request(app)
      .post('/api/personal-apps')
      .field('name', 'Tool B')
      .field('description', 'desc')
      .field('category', 'QA')
      .field('uploaderEmail', 'jade@fnfcorp.com')
      .attach('file', Buffer.from('zipcontent'), 'tool.zip')

    expect(res.status).toBe(201)
    expect(res.body.data.name).toBe('Tool B')
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Tool B', category: 'QA', uploader_email: 'jade@fnfcorp.com' })
    )
  })

  it('POST / without a file returns 400', async () => {
    const res = await request(app)
      .post('/api/personal-apps')
      .field('name', 'Tool C')
      .field('uploaderEmail', 'jade@fnfcorp.com')

    expect(res.status).toBe(400)
  })

  it('GET /:id/download streams the file', async () => {
    mockRepo.findById.mockResolvedValue({ id: 3, s3_key: 'k', original_filename: 'tool.zip' })

    const res = await request(app).get('/api/personal-apps/3/download')

    expect(res.status).toBe(200)
    expect(res.text).toBe('file-bytes')
  })

  it('GET /:id/download returns 404 for unknown id', async () => {
    mockRepo.findById.mockResolvedValue(null)

    const res = await request(app).get('/api/personal-apps/999/download')

    expect(res.status).toBe(404)
  })

  it('DELETE /:id removes DB row and S3 object', async () => {
    mockRepo.findById.mockResolvedValue({ id: 4, s3_key: 'k' })
    mockRepo.remove.mockResolvedValue(undefined)

    const res = await request(app).delete('/api/personal-apps/4')

    expect(res.status).toBe(204)
    expect(mockRepo.remove).toHaveBeenCalledWith(4)
  })
})
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

```bash
npm test -- routes/personal-apps
```
Expected: FAIL — `Cannot find module './personal-apps'`

- [ ] **Step 3: 라우트 구현**

```typescript
// server/src/routes/personal-apps.ts
import { Router, Request, Response, NextFunction } from 'express'
import multer from 'multer'
import { PersonalAppsRepository } from '../repositories/personal-apps.repository'
import { getPool } from '../db/pool'
import { uploadFile, downloadFile, deleteFile } from '../services/s3.service'

const router = Router()
const upload = multer({ storage: multer.memoryStorage() })
const repo = new PersonalAppsRepository(getPool())

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const category = typeof req.query.category === 'string' ? req.query.category : undefined
    const apps = await repo.list(category)
    res.json({ success: true, data: apps })
  } catch (error) {
    next(error)
  }
})

router.post('/', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file provided' })
    }
    if (!req.body.name || !req.body.uploaderEmail) {
      return res.status(400).json({ success: false, error: 'name and uploaderEmail are required' })
    }

    const s3Key = await uploadFile(
      `uploads/${Date.now()}-${req.file.originalname}`,
      req.file.buffer,
      req.file.mimetype
    )

    const created = await repo.create({
      name: req.body.name,
      description: req.body.description ?? null,
      category: req.body.category ?? null,
      s3_key: s3Key,
      original_filename: req.file.originalname,
      file_size: req.file.size,
      uploader_email: req.body.uploaderEmail,
    })

    res.status(201).json({ success: true, data: created })
  } catch (error) {
    next(error)
  }
})

router.get('/:id/download', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const app = await repo.findById(Number(req.params.id))
    if (!app) {
      return res.status(404).json({ success: false, error: 'App not found' })
    }

    const buffer = await downloadFile(app.s3_key)
    res.setHeader('Content-Disposition', `attachment; filename="${app.original_filename}"`)
    res.send(buffer)
  } catch (error) {
    next(error)
  }
})

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const app = await repo.findById(Number(req.params.id))
    if (!app) {
      return res.status(404).json({ success: false, error: 'App not found' })
    }

    await repo.remove(app.id)

    try {
      await deleteFile(app.s3_key)
    } catch (s3Error) {
      console.error(`S3 삭제 실패 (DB는 이미 삭제됨), key=${app.s3_key}:`, s3Error)
    }

    res.status(204).send()
  } catch (error) {
    next(error)
  }
})

export { router as personalAppsRoutes }
```

```typescript
// server/src/routes/index.ts
import { Router } from 'express'
import { healthRoutes } from './health'
import { personalAppsRoutes } from './personal-apps'

const router = Router()
router.use('/health', healthRoutes)
router.use('/personal-apps', personalAppsRoutes)

export { router as routes }
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npm test -- routes/personal-apps
```
Expected: PASS (7 tests)

- [ ] **Step 5: 전체 백엔드 테스트 확인 후 커밋**

```bash
npm test
git add server/src/routes
git commit -m "feat: add personal-apps upload/list/download/delete routes"
```

---

### Task 5: 프론트엔드 (업로드 폼 + 목록 + 카테고리 필터)

**Files:**
- Create: `client/package.json`
- Create: `client/tsconfig.json`
- Create: `client/vite.config.ts`
- Create: `client/index.html`
- Create: `client/src/main.tsx`
- Create: `client/src/App.tsx`
- Create: `client/src/hooks/useDcsAuth.ts`
- Create: `client/src/contexts/AuthContext.tsx`
- Create: `client/src/services/api.ts`
- Create: `client/src/utils/filterApps.ts`
- Create: `client/src/components/UploadForm.tsx`
- Create: `client/src/components/AppList.tsx`
- Test: `client/src/utils/filterApps.test.ts`

**Interfaces:**
- Consumes: 백엔드 `/api/personal-apps` 엔드포인트(Task 4) — 응답 형태 `{ success: boolean, data: PersonalApp[] }`
- Produces: `filterApps(apps: PersonalApp[], category: string | null): PersonalApp[]` (`client/src/utils/filterApps.ts`)

- [ ] **Step 1: package.json 작성**

```json
{
  "name": "qm-personal-apps-client",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.4.0",
    "vite": "^5.2.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: vite.config.ts / tsconfig.json / index.html 작성**

```typescript
// client/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
})
```

```json
// client/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

```html
<!-- client/index.html -->
<!doctype html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>QM 개인앱 아카이브</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

- [ ] **Step 3: DCS 인증 훅/컨텍스트 작성 (`dcs-ai-common:embedded-app` `auth/guide.md` 패턴)**

```typescript
// client/src/hooks/useDcsAuth.ts
import { useState, useEffect } from 'react'

export interface DcsUser {
  id: string
  name: string | null
  email: string | null
  image: string | null
  role: string[]
}

const ALLOWED_ORIGINS = [
  'https://dcsai.fnf.co.kr',
  'https://dcsai-dev.fnf.co.kr',
  'http://localhost:3000',
]

export function useDcsAuth() {
  const [user, setUser] = useState<DcsUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (!ALLOWED_ORIGINS.includes(event.origin)) return
      if (event.data?.type !== 'DCS_AUTH') return
      setUser(event.data.user)
      setIsLoading(false)
    }

    window.addEventListener('message', handleMessage)
    const timeout = setTimeout(() => setIsLoading(false), 5000)

    return () => {
      window.removeEventListener('message', handleMessage)
      clearTimeout(timeout)
    }
  }, [])

  return { user, isLoading }
}
```

```typescript
// client/src/contexts/AuthContext.tsx
import { createContext, useContext, ReactNode } from 'react'
import { useDcsAuth, DcsUser } from '../hooks/useDcsAuth'

interface AuthContextType {
  user: DcsUser | null
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType>({ user: null, isLoading: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user, isLoading } = useDcsAuth()
  return <AuthContext.Provider value={{ user, isLoading }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
```

- [ ] **Step 4: API 클라이언트 작성**

```typescript
// client/src/services/api.ts
export interface PersonalApp {
  id: number
  name: string
  description: string | null
  category: string | null
  original_filename: string
  file_size: number
  uploader_email: string
  uploaded_at: string
}

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export async function listApps(category?: string): Promise<PersonalApp[]> {
  const qs = category ? `?category=${encodeURIComponent(category)}` : ''
  const res = await fetch(`/api/personal-apps${qs}`)
  const body: ApiResponse<PersonalApp[]> = await res.json()
  if (!body.success || !body.data) throw new Error(body.error || 'Failed to load apps')
  return body.data
}

export async function uploadApp(
  file: File,
  fields: { name: string; description: string; category: string; uploaderEmail: string }
): Promise<PersonalApp> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('name', fields.name)
  formData.append('description', fields.description)
  formData.append('category', fields.category)
  formData.append('uploaderEmail', fields.uploaderEmail)

  const res = await fetch('/api/personal-apps', { method: 'POST', body: formData })
  const body: ApiResponse<PersonalApp> = await res.json()
  if (!body.success || !body.data) throw new Error(body.error || 'Upload failed')
  return body.data
}

export function downloadAppUrl(id: number): string {
  return `/api/personal-apps/${id}/download`
}

export async function deleteApp(id: number): Promise<void> {
  const res = await fetch(`/api/personal-apps/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Delete failed')
}
```

- [ ] **Step 5: 카테고리 필터 함수 + 실패하는 테스트 작성**

```typescript
// client/src/utils/filterApps.test.ts
import { describe, it, expect } from 'vitest'
import { filterApps } from './filterApps'
import type { PersonalApp } from '../services/api'

const apps: PersonalApp[] = [
  { id: 1, name: 'A', description: null, category: 'TD', original_filename: 'a.zip', file_size: 1, uploader_email: 'a@fnfcorp.com', uploaded_at: '2026-01-01' },
  { id: 2, name: 'B', description: null, category: 'QA', original_filename: 'b.zip', file_size: 1, uploader_email: 'b@fnfcorp.com', uploaded_at: '2026-01-02' },
  { id: 3, name: 'C', description: null, category: 'TD', original_filename: 'c.zip', file_size: 1, uploader_email: 'c@fnfcorp.com', uploaded_at: '2026-01-03' },
]

describe('filterApps', () => {
  it('returns all apps when category is null', () => {
    expect(filterApps(apps, null)).toHaveLength(3)
  })

  it('returns only matching category', () => {
    const result = filterApps(apps, 'TD')
    expect(result.map(a => a.id)).toEqual([1, 3])
  })

  it('returns empty array when no app matches', () => {
    expect(filterApps(apps, '없는카테고리')).toEqual([])
  })
})
```

- [ ] **Step 6: 테스트 실행하여 실패 확인**

```bash
cd client && npm install && npm test -- filterApps
```
Expected: FAIL — `Cannot find module './filterApps'`

- [ ] **Step 7: filterApps 구현**

```typescript
// client/src/utils/filterApps.ts
import type { PersonalApp } from '../services/api'

export function filterApps(apps: PersonalApp[], category: string | null): PersonalApp[] {
  if (!category) return apps
  return apps.filter(app => app.category === category)
}
```

- [ ] **Step 8: 테스트 통과 확인**

```bash
npm test -- filterApps
```
Expected: PASS (3 tests)

- [ ] **Step 9: UploadForm / AppList / App 컴포넌트 작성**

```typescript
// client/src/components/UploadForm.tsx
import { useState } from 'react'
import { uploadApp } from '../services/api'

interface Props {
  uploaderEmail: string
  onUploaded: () => void
}

export function UploadForm({ uploaderEmail, onUploaded }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !name.trim()) {
      setError('파일과 이름은 필수입니다')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await uploadApp(file, { name, description, category, uploaderEmail })
      setFile(null)
      setName('')
      setDescription('')
      setCategory('')
      onUploaded()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input type="file" onChange={e => setFile(e.target.files?.[0] ?? null)} />
      <input placeholder="이름" value={name} onChange={e => setName(e.target.value)} />
      <input placeholder="설명" value={description} onChange={e => setDescription(e.target.value)} />
      <input placeholder="카테고리 (예: TD, QA, 패턴툴)" value={category} onChange={e => setCategory(e.target.value)} />
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <button type="submit" disabled={submitting}>{submitting ? '업로드 중...' : '업로드'}</button>
    </form>
  )
}
```

```typescript
// client/src/components/AppList.tsx
import type { PersonalApp } from '../services/api'
import { downloadAppUrl } from '../services/api'

interface Props {
  apps: PersonalApp[]
  categories: string[]
  activeCategory: string | null
  onCategorySelect: (category: string | null) => void
  onDelete: (id: number) => void
}

export function AppList({ apps, categories, activeCategory, onCategorySelect, onDelete }: Props) {
  return (
    <div>
      <div>
        <button onClick={() => onCategorySelect(null)} disabled={activeCategory === null}>전체</button>
        {categories.map(c => (
          <button key={c} onClick={() => onCategorySelect(c)} disabled={activeCategory === c}>{c}</button>
        ))}
      </div>
      <ul>
        {apps.map(app => (
          <li key={app.id}>
            <strong>{app.name}</strong> {app.category && <span>[{app.category}]</span>}
            <p>{app.description}</p>
            <small>{app.uploader_email} · {new Date(app.uploaded_at).toLocaleString('ko-KR')}</small>
            <a href={downloadAppUrl(app.id)}>다운로드</a>
            <button onClick={() => onDelete(app.id)}>삭제</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

```typescript
// client/src/App.tsx
import { useEffect, useState, useCallback, useMemo } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { listApps, deleteApp, PersonalApp } from './services/api'
import { filterApps } from './utils/filterApps'
import { UploadForm } from './components/UploadForm'
import { AppList } from './components/AppList'

function AppContent() {
  const { user, isLoading } = useAuth()
  const [apps, setApps] = useState<PersonalApp[]>([])
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  const refresh = useCallback(() => {
    listApps().then(setApps).catch(console.error)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const categories = useMemo(
    () => Array.from(new Set(apps.map(a => a.category).filter((c): c is string => !!c))),
    [apps]
  )

  const visibleApps = useMemo(() => filterApps(apps, activeCategory), [apps, activeCategory])

  const handleDelete = async (id: number) => {
    await deleteApp(id)
    refresh()
  }

  if (isLoading) return <div>Loading...</div>
  if (!user?.email) return <div>DCS AI 인증 정보를 받지 못했습니다.</div>

  return (
    <div>
      <h1>QM 개인앱 아카이브</h1>
      <UploadForm uploaderEmail={user.email} onUploaded={refresh} />
      <AppList
        apps={visibleApps}
        categories={categories}
        activeCategory={activeCategory}
        onCategorySelect={setActiveCategory}
        onDelete={handleDelete}
      />
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
```

```typescript
// client/src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 10: 로컬에서 수동 확인**

```bash
# 터미널 1
cd server && npm run dev
# 터미널 2
cd client && npm run dev
```
브라우저에서 `http://localhost:5173` 열기. `useDcsAuth`는 DCS AI 부모 프레임 밖에서는 5초 뒤 `isLoading=false, user=null`이 되므로 "DCS AI 인증 정보를 받지 못했습니다" 문구가 뜨는 게 정상 — 실제 인증 플로우는 배포 후 DCS AI iframe 안에서 확인.
콘솔에 `window.postMessage({ type: 'DCS_AUTH', user: { id: '1', name: '테스트', email: 'test@fnfcorp.com', image: null, role: ['user'] } }, '*')` 실행 시 업로드 폼이 나타나는지 확인, 파일 업로드 → 목록에 뜨는지 → 카테고리 버튼 클릭시 필터되는지 → 삭제 버튼으로 사라지는지 확인.

- [ ] **Step 11: 커밋**

```bash
git add client
git commit -m "feat: add upload form, app list, category filter UI"
```

---

### Task 6: 배포 준비 및 배포

**Files:**
- Create: `.env.example`
- Create: `.gitignore`
- Create: `.dcsai.json` (배포 성공 후)

**Interfaces:** 없음 (배포/운영 태스크)

- [ ] **Step 1: .gitignore 작성**

```
node_modules/
dist/
.env
.env.local
.env.production
```

- [ ] **Step 2: .env.example 작성**

```bash
# .env.example
NODE_ENV=production
PORT=3000
CORS_ORIGIN=*

POSTGRESQL_HOST=
POSTGRESQL_PORT=5432
POSTGRESQL_USERNAME=
POSTGRESQL_PASSWORD=
POSTGRESQL_DATABASE=

S3_API_BASE_URL=https://aviyup1kyk.execute-api.ap-northeast-2.amazonaws.com/prod
S3_API_KEY=
S3_BUCKET=svc-fnf-ax-platform-pub-s3
```

- [ ] **Step 3: 파일 I/O / 비표준 DB 전수 확인 (사전 점검)**

```bash
grep -rn "fs\.writeFile\|fs\.writeFileSync\|fs\.createWriteStream\|@aws-sdk\|aws-sdk" server/src client/src
grep -rn "sqlite\|mysql\|mongodb\|mongoose\|sequelize\|prisma\|typeorm\|knex" server/src server/package.json
```
Expected: 매치 없음(이미 S3 Presigned API + `pg` 로만 구현했으므로). 매치가 나오면 해당 코드를 `s3.service.ts`/`personal-apps.repository.ts` 패턴으로 옮긴다.

- [ ] **Step 4: 요청자 GitHub 사용자명 확인**

```bash
gh auth status
gh api user --jq .login
```
`gh` 미설치/미로그인이면 설치 후 로그인. 확인된 username을 다음 단계 메시지에 사용.

- [ ] **Step 5: 배포 요청 메시지 생성 및 전달 (사용자 액션)**

아래 메시지에서 `<username>`을 Step 4에서 확인한 값으로 채워 DCS AI QnA 채널에 전달한다:

```
안녕하세요, QM 개인앱 아카이브 배포 요청드립니다.

📌 프로젝트 개요
  - 구성: React(Vite) + Express(Node.js)
  - 기능: QM팀원이 개인 도구(exe/zip)를 업로드·다운로드하는 내부 아카이브

📦 필요한 리소스
  - GitHub 저장소 생성 (fnf-deepHeading 조직) + 초대받을 GitHub 사용자명: <username>
  - PostgreSQL DB 접속 정보
  - S3 버킷 접속 정보 (Presigned URL API x-api-key)
```

**이 단계는 사용자가 담당자에게 메시지를 전달하고, 아래 3가지를 수령할 때까지 대기한다:**
- GitHub 저장소 링크
- PostgreSQL 접속 정보 (host/port/username/password/database)
- S3 API Key

- [ ] **Step 6: 수령한 정보로 .env.production 작성**

수령한 값으로 `.env.production` 파일을 프로젝트 루트에 작성한다 (`.env.example`과 동일한 키, 실제 값 채움). 이 파일은 `.gitignore`에 포함되어 커밋되지 않는다.

- [ ] **Step 7: GitHub 저장소 연결 및 push**

```bash
git remote add origin <수령한 저장소 링크>
git add .
git commit -m "chore: runtime fetch 배포를 위한 정리"
git push -u origin main
```

- [ ] **Step 8: 배포 명령 실행**

```bash
dcs-ai-cli app deploy --type embedded \
  --name qm-personal-apps \
  --display-name "QM 개인앱 아카이브" \
  --github <owner/repo> \
  --runtime node \
  --start "npm start" \
  --install "npm ci && npm run build" \
  --port 3000 \
  --secret-file .env.production
```
배포 명령 실행 **전에** 접근 권한 범위(me/private/public)를 사용자에게 확인한다 (기본값 `me`).

- [ ] **Step 9: .dcsai.json 저장 및 커밋**

```json
{
  "slug": "qm-personal-apps",
  "displayName": "QM 개인앱 아카이브",
  "github": "<owner/repo>",
  "runtime": "node",
  "start": "npm start",
  "port": 3000
}
```

```bash
git add .dcsai.json
git commit -m "chore: dcsai 배포 설정 추가"
git push
```

- [ ] **Step 10: 앱 실행 확인**

`https://dcsai.fnf.co.kr/agents/my-dashboards`에서 `qm-personal-apps` 상태가 `Running`이 될 때까지 대기(1~2분). `Running` 확인 후 `https://dcsai.fnf.co.kr/apps/qm-personal-apps` 접속해 업로드→목록→다운로드→삭제 흐름을 실제로 한 번씩 실행해 확인.

- [ ] **Step 11: hero_section 트리에 링크 추가**

`hero_section/data.js`에 새 항목 추가 (위치는 사용자와 확인 후 결정):

```javascript
{
  label: '개인앱 아카이브',
  url: 'https://dcsai.fnf.co.kr/apps/qm-personal-apps',
},
```

`hero_section/test/test-data.js`의 top-level labels 배열에 `'개인앱 아카이브'`를 추가 위치에 맞게 반영, `node test/test-data.js` 통과 확인 후 `index.html`의 `?v=` 캐시버스터를 올리고 커밋, `dcs-ai-cli app update qm-hero --path .`로 재배포.
