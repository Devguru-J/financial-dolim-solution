# financial-dolim-solution — Claude 참고 문서

이 파일은 Claude가 이 프로젝트에서 작업할 때 참고하는 컨텍스트입니다.

---

## 프로젝트 개요

한국 자동차 금융(운용리스) 견적 계산 플랫폼. 현재 MG 캐피탈 단일 금융사 지원, 향후 다수 금융사 확장 예정.

**스택:** Bun + Hono + Drizzle ORM + Supabase PostgreSQL + Cloudflare Pages

---

## 핵심 파일 구조

```
src/
  app.ts                          # Hono API 라우트 (8개 엔드포인트)
  playground.ts                   # 견적 계산 UI (HTML-in-string, ~3000줄)
  db/schema.ts                    # Drizzle DB 스키마
  domain/
    imports/
      catalog-queries.ts          # 브랜드/모델 DB 조회
      import-service.ts           # 워크북 DB 저장 (트랜잭션)
    lenders/mg-capital/
      operating-lease-service.ts  # MG 운용리스 계산 엔진
      workbook-parser.ts          # MG 엑셀 파싱
docs/
  platform-blueprint.md           # 전체 아키텍처 설계
  implementation-roadmap.md       # 구현 로드맵 (Phase 0-7)
  mg-capital-implementation-plan.md # MG 캐피탈 구현 계획
  lender-onboarding-playbook.md   # 신규 금융사 온보딩 7단계
```

---

## 데이터 흐름

```
엑셀 워크북 업로드 (POST /api/imports)
  → workbook-parser.ts (차량DB 638행, 잔가map 365행, 견적관리자용 125행)
  → Supabase DB (vehicle_programs, residual_matrix_rows, brand_rate_policies)
  → GET /api/catalog/brands → 브랜드 드롭다운
  → GET /api/catalog/models → 트림 드롭다운
  → POST /api/quotes/calculate → 월 납입금 계산
```

---

## 견적 계산 UI (playground.ts) 구조

### 섹션 구성
1. **차량 정보** — Brand / Model(비활성) / Trim 선택 + 가격 입력
2. **계약 및 부대비용** — 리스기간, 보증금, 취득세 등
3. **잔가 및 금리** — 잔가율, 금리 오버라이드

### 차량 정보 섹션 (2026-03-25 리디자인)
- **Brand → Model(비활성) → Trim** 3단계 구조 (미래 다금융사 확장 대비)
- 현재는 Trim이 MG 캐피탈 모델 리스트를 로딩 (`id="trimName", name="modelName"`)
- Model select (`id="modelName"`)는 disabled 유지 — 나중에 활성화 예정
- 숨긴 필드 (hidden input): 제휴사, 차종직접입력, 차종구분, 배기량
- 하단 요약 행: 최종차량가 / 일반잔가(%) / 최대(고)잔가(%)

### 주요 JS 함수
| 함수 | 역할 |
|------|------|
| `renderCatalogBrands(brands)` | Brand 드롭다운 채우기 |
| `renderCatalogModels(brand, preferred)` | Trim 드롭다운 채우기 (trimSelect 사용) |
| `syncSelectedModelMeta()` | Trim 선택 시 차량 메타 자동반영 |
| `previewBaseResidualRate(model, term)` | 일반잔가율 계산 (highResidual +0.08 미적용) |
| `previewMaximumResidualRate(model, term)` | 최대잔가율 계산 |
| `renderVehicleSummaryRow(model)` | 하단 요약 행 업데이트 |
| `refreshDashboard()` | 페이지 로드 시 전체 데이터 갱신 |

---

## DB 의존성

`DATABASE_URL` 환경변수 필요 (`.dev.vars` 파일). 없으면:
- 워크북 preview는 가능 (메모리 내 파싱)
- 브랜드/모델 로딩 불가 → 견적 계산 불가

활성 워크북 import가 없으면 브랜드 목록이 비어있음 → Imports 탭에서 워크북 업로드 필요.

---

## 현재 진행 상태 (2026-03-25)

- ✅ MG 캐피탈 운용리스 계산 엔진
- ✅ 차량 정보 섹션 Brand/Model/Trim 3단계 UI
- 🟡 Excel 패리티 (일부 모델 불일치)
- ❌ 금융리스, 할부/오토론 미구현
- ❌ 두 번째 금융사 미온보딩

---

## 개발 명령어

```bash
bun run dev          # 로컬 서버 (wrangler pages dev)
bun test             # 패리티 테스트
bun run typecheck    # TS 타입 검사
bun run db:push      # DB 스키마 마이그레이션
```

---

## 알아두면 좋은 것들

- `operating-lease-service.ts`의 잔가 계산은 엑셀 셀 BK27 로직을 재현한 것
- SNK(에스앤케이모터스) vs APS 잔가 선택은 사용자 입력 (자동 선택 아님)
- 월납입금은 100원 단위 올림 (Excel ROUNDUP 스타일)
- 리스기간별 최소잔가율: 12개월 50%, 24개월 40%, 36개월 30%, 48개월 20%, 60개월 15%
