# Supabase Setup

## 목적

이 문서는 `financial-dolim-solution` 프로젝트를 실제 `Supabase PostgreSQL`과 연결하기 위한 최소 설정 절차를 정리합니다.

현재 코드 기준:

1. `POST /api/imports/preview` 는 DB 없이도 동작합니다.
2. `POST /api/imports` 는 `DATABASE_URL`이 설정되면 실제 저장까지 수행합니다.
3. `GET /api/imports` 는 `DATABASE_URL`이 설정되면 저장된 import 목록을 조회합니다.

## 준비물

1. Supabase 프로젝트 생성
2. Supabase Postgres connection string
3. 로컬 개발용 `.dev.vars`
4. 필요 시 Drizzle migration 실행 권한

## 1. Supabase 프로젝트 생성

Supabase에서 새 프로젝트를 만든 뒤, Database 연결 정보를 확인합니다.

필요한 값:

1. DB host
2. DB password
3. database name
4. connection string

## 2. 환경 변수 설정

로컬 개발 시 `.dev.vars` 파일을 만들고 아래처럼 입력합니다.

```bash
APP_ENV=development
DATABASE_URL=postgresql://postgres:[YOUR_PASSWORD]@[YOUR_SUPABASE_HOST]:5432/postgres
```

참고:

1. 예시 파일은 `.dev.vars.example`, `.env.example`에 포함되어 있습니다.
2. 실제 비밀번호가 들어간 파일은 git에 올리지 않습니다.

## 3. 마이그레이션 준비

현재 생성된 마이그레이션 파일:

1. `drizzle/0000_cute_steel_serpent.sql`

스키마에는 아래 핵심 테이블이 포함됩니다.

1. `lenders`
2. `lender_products`
3. `workbook_imports`
4. `vehicle_programs`
5. `residual_matrix_rows`
6. `brand_rate_policies`
7. `quote_snapshots`

## 4. 마이그레이션 실행

환경 변수를 로드한 상태에서 실행합니다.

```bash
bun run db:push
```

또는 migration 기반으로 진행하려면:

```bash
bun run db:migrate
```

프로젝트 운영 방식에 따라 둘 중 하나를 통일해서 사용하는 것이 좋습니다.

추천:

1. 개발 초기: `db:push`
2. 운영 전환 이후: migration 파일 기반 관리

## 5. 연결 확인

연결이 끝나면 아래 흐름으로 확인합니다.

1. `GET /health`
2. `GET /api/lenders`
3. `GET /api/imports`
4. `POST /api/imports/preview`
5. `POST /api/imports`

## 6. 예상 동작

### DB 미연결 상태

`POST /api/imports` 응답에서:

1. `persisted: false`
2. `persistenceMode: "skipped"`

### DB 연결 상태

`POST /api/imports` 응답에서:

1. `persisted: true`
2. `persistenceMode: "database"`
3. import id 반환

## 7. Cloudflare 배포 시 참고

운영 배포에서는 `DATABASE_URL`을 Cloudflare 환경 변수 또는 secret으로 설정해야 합니다.

장기적으로는:

1. Cloudflare Pages Functions
2. Supabase Postgres
3. 필요 시 Hyperdrive

구조를 고려하는 것이 좋습니다.

## 8. 다음 연결 이후 작업

Supabase 연결 후 바로 이어서 할 작업:

1. 실제 import 저장 검증
2. import 목록/활성 버전 조회 화면
3. MG 운용리스 계산 엔진 저장 결과와 연결
