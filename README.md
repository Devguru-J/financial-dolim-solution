# financial-dolim-solution

엑셀 워크북 기반의 멀티 금융사 자동차 금융 견적 플랫폼입니다.

이 프로젝트는 자동차 금융 상품을 웹에서 계산할 수 있도록 만드는 것을 목표로 합니다.

지원 대상 상품:

1. 운용리스
2. 금융리스
3. 할부 / 오토론

핵심 방향은 매월 금융사에서 전달하는 엑셀 견적 파일을 업로드하면, 그 파일 안의 데이터를 정규화해 반영하고, 웹에서 최신 기준으로 견적 계산이 가능하도록 만드는 것입니다.

## 현재 진행 기준

현재 첫 번째 대상 금융사는 **MG캐피탈** 입니다.

지금까지 구현된 범위:

1. `Bun + Hono + Cloudflare Pages Functions` 기반 프로젝트 스캐폴드
2. 월별 워크북 버전 관리를 위한 `Drizzle` 스키마 초안
3. 금융사 확장을 위한 lender adapter 구조
4. MG캐피탈 워크북 파서
   - 차량 데이터 파싱
   - 잔가 매트릭스 파싱
   - 브랜드별 기본 요율 정책 파싱
5. 업로드 미리보기 API
6. 업로드 데이터를 DB에 저장하는 import persistence 서비스
7. MG캐피탈 `운용리스` 1차 계산 API
8. 향후 여러 금융사를 붙이기 위한 planning 문서 세트

## 기술 스택

### Runtime / API

1. `Bun`
2. `Hono`
3. `Cloudflare Pages Functions`

### Database / BaaS

1. `Supabase`
2. `PostgreSQL 17+`
3. `Drizzle ORM`

### Frontend / UI

1. `shadcn/ui`
2. 공통 quote UI 위에 금융사/상품별 정책을 얹는 구조

### Workbook / Validation

1. `xlsx`
2. `zod`

## 왜 Prisma가 아니라 Drizzle인가

이 프로젝트에서는 **Drizzle**을 기본 ORM으로 선택했습니다.

이유:

1. `Bun` 및 서버리스 환경과의 궁합이 더 가볍고 단순합니다.
2. SQL 중심으로 제어하기 좋아서 금융 계산 도메인에 더 잘 맞습니다.
3. 월별 엑셀 업로드 버전 관리와 정규화 테이블 구조를 명확하게 다루기 좋습니다.
4. `Cloudflare Pages Functions` 기반 런타임에서 Prisma보다 운영 부담이 적습니다.

## 프로젝트 구조

```text
functions/
  api/
src/
  db/
  domain/
    imports/
    lenders/
  lib/
docs/
```

## 주요 파일

1. `src/app.ts`
   - Hono 앱 진입점
   - 헬스체크
   - 금융사 목록 API
   - import 목록 조회 API
   - 업로드 미리보기 API
   - 업로드 저장 API

2. `src/domain/lenders/mg-capital/workbook-parser.ts`
   - MG캐피탈 워크북을 파싱해 정규화 가능한 구조로 변환합니다.

3. `src/db/schema.ts`
   - 금융사, 상품, 워크북 import, 차량 프로그램, 잔가 매트릭스, 브랜드 요율 정책, quote snapshot 테이블 정의가 들어 있습니다.

4. `src/domain/imports/import-service.ts`
   - 파싱된 워크북 데이터를 DB에 저장하는 서비스입니다.
   - `DATABASE_URL`이 없으면 preview 전용 모드처럼 동작합니다.

5. `docs/platform-blueprint.md`
   - 멀티 금융사 구조로 확장하기 위한 전체 아키텍처 기준 문서입니다.

6. `docs/lender-onboarding-playbook.md`
   - 새로운 금융사를 추가할 때 따를 온보딩 절차 문서입니다.

## API 엔드포인트

### `GET /`

기본 서비스 메타 정보 반환

### `GET /health`

헬스체크 엔드포인트

### `GET /api/lenders`

현재 등록된 금융사 adapter 목록 반환

### `GET /api/imports`

저장된 workbook import 목록을 반환합니다.

`DATABASE_URL`이 없으면 연결되지 않은 상태로 빈 목록을 반환합니다.

### `POST /api/imports/preview`

엑셀 워크북 파일을 업로드하면 파싱 결과를 미리보기로 반환합니다.

요청 형식:

1. `multipart/form-data`
2. 필드명: `file`

### `POST /api/imports`

엑셀 워크북 파일을 업로드하면 파싱 후 저장까지 진행합니다.

`DATABASE_URL`이 설정되어 있으면 실제 DB에 저장하고, 없으면 저장은 건너뛰고 파싱 결과만 반환합니다.

요청 형식:

1. `multipart/form-data`
2. 필드명: `file`
3. 선택 필드: `activate=true|false`

### `POST /api/quotes/calculate`

현재는 `MG Capital`의 `operating_lease`만 지원합니다.

요청 예시:

```json
{
  "lenderCode": "mg-capital",
  "productType": "operating_lease",
  "brand": "AUDI",
  "modelName": "A3 40 TFSI Premium",
  "ownershipType": "company",
  "leaseTermMonths": 36,
  "upfrontPayment": 0
}
```

현재 계산 결과에는 차량가, 잔가율, 브랜드 기본 IRR, 월 납입금이 포함됩니다.

아직 미반영된 항목:

1. 취득세/등록세
2. 부대비용
3. workbook의 산재한 예외 규칙
4. residual promotion code 세부 반영

## 로컬 개발

의존성 설치:

```bash
bun install
```

타입 체크:

```bash
bun run typecheck
```

로컬 개발 서버 실행:

```bash
bun run dev
```

DB 스키마 반영:

```bash
bun run db:push
```

이 프로젝트의 `db:push`는 Supabase pooler 환경에서도 안정적으로 동작하도록
`generate + migrate` 순서로 실행됩니다.

또는 migration 적용:

```bash
bun run db:migrate
```

위 Drizzle 스크립트들은 루트의 `.dev.vars`를 자동으로 읽도록 맞춰져 있습니다.

## 환경 변수

### Preview 전용 모드

1. `APP_ENV`

### DB 저장 모드

1. `DATABASE_URL`

예시 파일:

1. `.env.example`
2. `.dev.vars.example`

빠른 시작:

```bash
cp .dev.vars.example .dev.vars
```

## 운영 메모

장기 운영 목표:

1. API는 `Cloudflare Pages Functions`에 배포
2. 비즈니스 데이터는 `Supabase PostgreSQL`에 저장
3. 월별 금융사 엑셀 업로드를 기준으로 활성 버전 관리

Cloudflare에서 Supabase Postgres로 운영 연결할 때는 `Hyperdrive` 같은 안정적인 연결 경로를 고려하는 것이 좋습니다.

## Planning 문서

1. [Project Planning Docs](./docs/README.md)
2. [Platform Blueprint](./docs/platform-blueprint.md)
3. [Lender Onboarding Playbook](./docs/lender-onboarding-playbook.md)
4. [Implementation Roadmap](./docs/implementation-roadmap.md)
5. [MG Capital Implementation Plan](./docs/mg-capital-implementation-plan.md)
6. [Supabase Setup](./docs/supabase-setup.md)

## 다음 구현 단계

1. 확장된 멀티 금융사 스키마 기준으로 마이그레이션 정리
2. `POST /api/imports`를 실제 Supabase 저장과 연결
3. MG캐피탈 `운용리스` 계산 엔진 1차 구현
4. 엑셀 결과와 비교하는 fixture 기반 검증 추가
5. 관리자용 업로드 / 활성화 UI 구현
