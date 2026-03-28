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

### 섹션 구성 (2026-03-26 현재)
1. **차량 정보** — Brand / Model(비활성) / Trim 선택 + 가격 입력 + 하단 요약 행
2. **취득원가 산출** — 취득세·탁송료·부대비용·공채 등 + 취득원가 표시
3. **견적 조건** — 기간·약정거리·보증금·선납금·잔존가치·CM/AG 수수료 등

### 섹션별 상세

#### 1. 차량 정보
- **Brand → Model(비활성) → Trim** 3단계 구조 (미래 다금융사 확장 대비)
- Trim select: `id="trimName"`, `name="modelName"` (FormData 키 유지)
- Model select: `id="modelName"`, disabled — 미래 확장용 placeholder
- 숨긴 필드 (hidden input): `affiliateType`(비제휴사), `directModelEntry`, `manualVehicleClass`, `manualEngineDisplacementCc`
- 4컬럼 그리드: Brand/Model/Trim | 차량가격/옵션가격/할인가격
- 하단 요약 행: 최종차량가 / 일반잔가(%) / 최대(고)잔가(%)

#### 2. 취득원가 산출 (구: 계약 및 부대비용)
- 4컬럼 그리드, 3행
- 보이는 필드: 취득세 감면 여부(드롭다운), 탁송료(체크+입력), 취득세 포함 여부(체크+세액표시), 부대비용(체크+입력), 공채 할인 여부(체크+입력), 취득원가(읽기전용)
- 숨긴 필드: `ownershipType`(company), `acquisitionTaxRateOverride`(0.07)
- 숨긴 필드: `insuranceYearlyAmount`(0), `lossDamageAmount`(0)
- `#sheet-acquisition-cost` — 계산 후 `quote.majorInputs.financedPrincipal` 표시
- `includeAcquisitionTax` 체크박스 → `acquisitionTaxRateOverride` 0.07 ↔ 0 토글

#### 3. 견적 조건 (구: 잔가 및 금리)
- 4컬럼 그리드, 5행
- 보이는 필드:

| 왼쪽 | 오른쪽 |
|------|--------|
| 판매사 (드롭다운, 기본 "비활성") | 기간(개월) (12~60, **기본 60**) |
| 제휴수수료 면제 (라디오: 비해당/해당) | 약정거리 (10k~35k, 기본 20k) |
| 보증금 (금액/% 모드 토글 + 입력) | 잔존가치 (트림 선택 시 최대잔가 자동반영) |
| 선납금 (금액/% 모드 토글 + 입력) | CM수수료 (기본 0%) |
| 전기차 보조금 (비해당/해당 라디오 + 금액) | AG수수료 (기본 0%) |

- 숨긴 필드: `depositAmount`(보증금 실값), `upfrontPayment`(선납금 실값)
- 숨긴 필드: `annualIrrRateOverride`, `stampDuty`, `residualAmountOverride`
- 숨긴 readonly: `sheet-applied-residual-rate`, `sheet-min/max-residual-rate`, `sheet-residual-amount`, `sheet-high-residual`, `sheet-promo-code`

### 주요 JS 함수
| 함수 | 역할 |
|------|------|
| `renderCatalogBrands(brands)` | Brand 드롭다운 채우기 |
| `renderCatalogModels(brand, preferred)` | Trim 드롭다운 채우기 (trimSelect 사용) |
| `syncSelectedModelMeta()` | Trim 선택 시 차량 메타 + 최대잔가 자동반영 |
| `previewBaseResidualRate(model, term)` | 일반잔가율 계산 (highResidual +0.08 미적용) |
| `previewMaximumResidualRate(model, term)` | 최대잔가율 계산 |
| `renderVehicleSummaryRow(model)` | 하단 요약 행 업데이트 |
| `computeDepositAmount()` | 보증금 %/금액 모드 → `depositAmount` hidden 계산 |
| `computeUpfrontPayment()` | 선납금 %/금액 모드 → `upfrontPayment` hidden 계산 |
| `refreshDashboard()` | 페이지 로드 시 전체 데이터 갱신 |

### 보증금/선납금 % 모드 동작
- % 모드 선택 시: 실값 = `(quotedVehiclePrice - discountAmount) × 입력값 / 100`
- 차량가 또는 할인가 변경 시 자동 재계산
- `depositAmount` / `upfrontPayment` hidden input에 최종값 저장 → API 전송

---

## DB 의존성

`DATABASE_URL` 환경변수 필요 (`.dev.vars` 파일). 없으면:
- 워크북 preview는 가능 (메모리 내 파싱)
- 브랜드/모델 로딩 불가 → 견적 계산 불가

활성 워크북 import가 없으면 브랜드 목록이 비어있음 → Imports 탭에서 워크북 업로드 필요.

---

## 현재 진행 상태 (2026-03-28 오후)

- ✅ MG 캐피탈 운용리스 계산 엔진
- ✅ 차량 정보 섹션 Brand/Model/Trim 3단계 UI + 하단 요약 행
- ✅ 취득원가 산출 섹션 UI (6개 필드 표시, 나머지 hidden)
- ✅ 견적 조건 섹션 UI (10개 필드 표시, 나머지 hidden) — 기간·보증금·선납금·잔존가치 포함
- ✅ CQ27 자동금리 계산 경로 픽스처 검증 (BMW X7 76.5M 60M 54.5% → 4.823% / 913,100원 일치)
- ✅ 픽스처 패리티 수정 — BENZ A200d resolvedMatrixGroup(APS→SNK), BMW X7 36m maximumResidualRateOverride(0.595→0.735) 정정
- ✅ 다모델 픽스처 추가 (BMW 520i·320d·X5·X3, BENZ E220d — 60개월 기준, 총 33개 테스트 전체 통과)
- ✅ 견적 결과 UI 개선 — 4컬럼 테이블(월납입금·IRR·잔가·총구매비용) + 헤더 태그(법인/잔가종류/잔가보증사)
- 🟡 Excel 패리티 (BMW/BENZ/AUDI/VOLVO 대표 케이스 검증, 36개월·deposit/upfront 케이스 미완)
- 🟡 프론트엔드 React + shadcn 전환 진행 예정 (`client/` 서브앱 구조)
- ❌ 금융리스, 할부/오토론 미구현
- ❌ 두 번째 금융사 미온보딩

### 검증된 픽스처 목록 (2026-03-28 기준, 33개)

| 파일 | 모델 | 기간 | 잔가사 | 비고 |
|------|------|------|--------|------|
| bmw-x7-36-base | BMW X7 40d | 36m | APS | 기본 |
| bmw-x7-36-upfront-10m-deposit-30m | BMW X7 40d | 36m | APS | 선납+보증금 |
| bmw-x7-60-base | BMW X7 40d | 60m | APS | 기본 |
| bmw-x7-60-upfront-20m | BMW X7 40d | 60m | APS | 선납금 |
| bmw-x7-60-deposit-50m | BMW X7 40d | 60m | APS | 보증금 |
| bmw-x7-60-screenshot | BMW X7 40d | 60m | APS | 스크린샷 |
| bmw-520i-60-base | BMW 520i | 60m | APS | gap=0.05 → 0.44% 수수료 |
| bmw-320d-60-base | BMW 320d | 60m | APS | gap≥0.08 → 0% 수수료 |
| bmw-x5-30d-60-base | BMW X5 30d | 60m | APS | gap≥0.07 → 0% 수수료 |
| bmw-x3-20d-60-base | BMW X3 20d | 60m | SNK | SNK 프로모로 SNK 승 |
| benz-a200d-36-base | BENZ A200d | 36m | SNK | APS 미해당 모델 |
| benz-e220d-60-base | BENZ E220d 4MATIC | 60m | APS | gap≥0.085 → 0% 수수료 |
| audi-a3-36-base | AUDI A3 40 TFSI | 36m | SNK | 기본 |
| audi-a3-36-customer | AUDI A3 40 TFSI | 36m | SNK | 개인명의 / 고금리 |
| volvo-xc40-36-promo | VOLVO XC40 B4 | 36m | APS | 잔가 프로모 0.75 |
| lexus-rx350h-60-base | LEXUS RX 350h | 60m | APS | 하이브리드 |

---

## 개발 명령어

```bash
bun run dev          # 로컬 서버 (wrangler pages dev)
bun test             # 패리티 테스트
bun run typecheck    # TS 타입 검사
bun run db:push      # DB 스키마 마이그레이션
```

---

## 프론트엔드 구조 전환 계획 (2026-03-28~)

현재 `src/playground.ts`(HTML-in-string ~3000줄)를 React + shadcn/ui 기반으로 전환 예정.

```
프로젝트 루트/
  src/           ← Hono API 서버 (그대로 유지)
  functions/     ← Cloudflare Pages Functions (그대로 유지)
  client/        ← 신규 React + Vite + Tailwind + shadcn 앱
    src/
      pages/     ← 페이지 컴포넌트
      components/← shadcn 컴포넌트 + 도메인 컴포넌트
    dist/        ← Vite 빌드 아웃풋
```

- API 백엔드(Hono)는 변경 없음
- `wrangler.jsonc`의 `pages_build_output_dir`를 `client/dist`로 변경 예정
- playground.ts는 마이그레이션 완료 후 폐기 예정

## 알아두면 좋은 것들

- `operating-lease-service.ts`의 잔가 계산은 엑셀 셀 BK27 로직을 재현한 것
- SNK(에스앤케이모터스) vs APS 잔가 선택: `summarizeMgResidualCandidates`가 잔가보증 수수료가 낮은 쪽 자동 선택 (BMW X7 = APS가 수수료 낮음)
- 잔가보증 수수료: SNK 5% gap → 0.77%, APS 5% gap → 0.44% — 수수료 차이가 표시금리에 직접 반영
- 엔진 월납입금은 floor(PMT), UI 표시는 100원 단위 올림 (`roundUpToNearestHundred`) — Excel ROUNDUP(-2) 방식과 동일
- CQ27 자동계산 픽스처 패턴: `baseIrrRate` + `resolvedMatrixGroup` + `maximumResidualRateOverride` 설정, `annualIrrRateOverride` 미설정
- 리스기간별 최소잔가율: 12개월 50%, 24개월 40%, 36개월 30%, 48개월 20%, 60개월 15%
- `maximumResidualRateOverride` 산출 공식: `mileageAdjustedRate + highResidualBoost(0.08)` — APS 60m SA1 밴드 = 0.515+0.08=0.595
- BMW X3: SNK 잔가 프로모(0.015)로 SNK max(0.585) > APS max(0.57) → SNK 승 — 프로모 여부에 따라 승자가 바뀌는 대표 케이스
- `residualAmount` 산출: `roundDown(discountedVehiclePrice × ratio, -3)` — 천원 단위 절사
- `acquisitionTax` 산출: `roundDown((discountedVehiclePrice / 1.1) × taxRate, -1)` — 10원 단위 절사
- `financedPrincipal` = discountedVehiclePrice + acquisitionTax + stampDuty (잔가보증 수수료는 cq17에만 포함, financedPrincipal에는 미포함)
