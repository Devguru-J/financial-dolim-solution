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
  db/schema.ts                    # Drizzle DB 스키마
  domain/
    imports/
      catalog-queries.ts          # 브랜드/모델 DB 조회
      import-service.ts           # 워크북 DB 저장 (트랜잭션)
      lender-registry.ts          # 금융사 어댑터 레지스트리
    lenders/
      mg-capital/
        operating-lease-service.ts  # MG 운용리스 계산 엔진
        workbook-parser.ts          # MG 엑셀 파싱
        adapter.ts                  # MG 어댑터
        operating-lease-service.test.ts  # MG 패리티 테스트 (41개)
      bnk-capital/
        operating-lease-service.ts  # BNK 운용리스 계산 엔진
        workbook-parser.ts          # BNK 엑셀 파싱
        adapter.ts                  # BNK 어댑터
        operating-lease-service.test.ts  # BNK 패리티 테스트 (1개)
fixtures/
  mg-capital/operating-lease/     # MG 패리티 픽스처 (41개 JSON)
  bnk-capital/operating-lease/    # BNK 패리티 픽스처 (1개 JSON)
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

## 현재 진행 상태 (2026-03-29)

### MG 캐피탈
- ✅ 운용리스 계산 엔진 (Phase A + Phase B 완료)
- ✅ 패리티 픽스처 41개 — 전체 통과
- ✅ CQ27 자동금리 계산 경로 (baseIrrRate + resolvedMatrixGroup + maximumResidualRateOverride)
- ✅ 프론트엔드 React + shadcn 전환 완료 (playground.ts 폐기)
- ✅ UI/UX — 좌측 사이드바, DashboardPage, ImportPage 드래그앤드롭, 숫자 폰트 font-normal
- ✅ financedPrincipal 버그 수정 — gross acquisitionCost (upfrontPayment 차감 안 함)

### BNK 캐피탈 (2026-03-29 신규)
- ✅ **워크북 파서** (`workbook-parser.ts`) — CDB/RVs/Cond 시트 파싱, (brand, modelName) 중복제거
  - 3321 CDB행 → 2275개 유니크 차량 (최신 modelYear 유지)
  - 7개 잔가사 매트릭스 (WS통합/WS수입/CB/TY/JY/CR/ADB)
  - Cond 시트 → 브랜드별 conditionType → baseIrr 매핑
- ✅ **BNK 어댑터** 등록 (`adapter.ts`, `lender-registry.ts`, `app.ts`)
- ✅ **운용리스 계산 엔진** (`operating-lease-service.ts`) — Excel Es1 시트 재현
  - PMT: `((PV - FV/factor) × rate) / (1 - 1/factor)`, monthlyRate = annualRate/12
  - 표시금액: ROUNDUP(rawPayment, -2) — 100원 단위 올림
  - 취득세: roundDown(discountedVehiclePrice/1.1 × rate, -1), 기본 7%(≥1600cc), 4%(기타)
  - financedPrincipal = gross (upfrontPayment 미차감 — MG와 동일)
  - 잔존가치: roundDown(discountedVehiclePrice × ratio, -3)
  - 잔가보증 수수료 테이블 (gap = 표준잔가율 - 적용잔가율 기준):
    - gap ≤ 0%: 0%, ≤1%: 1.21%, ≤2%: 1.10%, ≤3%: 0.88%, ≤4%: 0.66%, ≤5%: 0.44%, ≤6%: 0.22%, >6%: 0%
  - Phase B 자동금리: CB/TY/CR/ADB 잔가사 중 수수료 가장 낮은 쪽 자동 선택
  - `calculateBnkOperatingLeaseQuoteFromContext` 순수함수 export (테스트용)
- ✅ **Phase A 픽스처 검증** — BMW 520i 60m, 차량가 110M, IRR 5.21% → 1,575,700원 ✓
  - `fixtures/bnk-capital/operating-lease/bmw-520i-60-base.json`
  - acqTax 7,000,000 / financedPrincipal 117,000,000 / residualAmount 44,000,000 — 모두 일치
- ✅ **테스트 러너** (`operating-lease-service.test.ts`) — 42개 전체 통과 (MG 41 + BNK 1)

### 미완료
- 🟡 BNK Phase B 픽스처 (providerRates 포함, 자동금리 경로 검증) — 다음 세션 우선순위
- 🟡 BNK 잔가 마일리지 조정 (RVs 테이블은 2만km 기준, 다른 거리 조정 공식 미구현)
- 🟡 BNK JY 잔가사 (float/string 그레이드 파싱 복잡, Phase B에서 처리 예정)
- 🟡 BNK 추가 픽스처 (기간 변형, 보증금/선납금, 고객명의, 크로스브랜드)
- ❌ 금융리스, 할부/오토론 미구현

### 검증된 픽스처 목록 (2026-03-29 기준, 42개)

| 파일 | 모델 | 기간 | 잔가사 | 비고 |
|------|------|------|--------|------|
| bmw-x7-24-base | BMW X7 40d | 24m | APS | 기간 변형 |
| bmw-x7-36-base | BMW X7 40d | 36m | APS | 기본 |
| bmw-x7-36-deposit-20m | BMW X7 40d | 36m | APS | 보증금 20M |
| bmw-x7-36-upfront-10m-deposit-30m | BMW X7 40d | 36m | APS | 선납+보증금 |
| bmw-x7-36-upfront-20m | BMW X7 40d | 36m | APS | 선납금 20M |
| bmw-x7-48-base | BMW X7 40d | 48m | APS | 기간 변형 |
| bmw-x7-60-base | BMW X7 40d | 60m | APS | 기본 |
| bmw-x7-60-upfront-20m | BMW X7 40d | 60m | APS | 선납금 20M |
| bmw-x7-60-upfront-20m-deposit-30m | BMW X7 40d | 60m | APS | 선납+보증금 |
| bmw-x7-60-deposit-50m | BMW X7 40d | 60m | APS | 보증금 50M |
| bmw-x7-60-screenshot | BMW X7 40d | 60m | APS | 스크린샷 |
| bmw-x7-60-mileage-30k | BMW X7 40d | 60m | SNK | 30k km, gap=2% → 1.1% 수수료 |
| bmw-x7-60-customer-base | BMW X7 40d | 60m | - | 고객명의, 10% 금리 |
| bmw-520i-60-base | BMW 520i | 60m | APS | gap=0.05 → 0.44% 수수료 |
| bmw-320d-60-base | BMW 320d | 60m | APS | gap≥0.08 → 0% 수수료 |
| bmw-x5-30d-60-base | BMW X5 30d | 60m | APS | gap≥0.07 → 0% 수수료 |
| bmw-x3-20d-60-base | BMW X3 20d | 60m | SNK | SNK 프로모로 SNK 승 |
| benz-a200d-36-base | BENZ A200d | 36m | SNK | APS 미해당 모델 |
| benz-e220d-36-base | BENZ E220d 4Matic | 36m | APS | 기간 변형 |
| benz-e220d-60-base | BENZ E220d 4Matic | 60m | APS | gap≥0.085 → 0% 수수료 |
| audi-a3-36-base | AUDI A3 40 TFSI | 36m | SNK | 기본 |
| audi-a3-36-customer | AUDI A3 40 TFSI | 36m | SNK | 개인명의 / 고금리 |
| volvo-xc40-36-promo | VOLVO XC40 B4 | 36m | APS | 잔가 프로모 0.75 |
| lexus-rx350h-60-base | LEXUS RX 350h | 60m | APS | 하이브리드 |

#### BNK 캐피탈 픽스처 (1개)

| 파일 | 모델 | 기간 | 잔가사 | 비고 |
|------|------|------|--------|------|
| bmw-520i-60-base | BMW 520i (BNK) | 60m | - | Phase A (IRR override), 110M → 1,575,700원 |

---

## 개발 명령어

```bash
bun run dev          # 로컬 서버 (wrangler pages dev)
bun test             # 패리티 테스트
bun run typecheck    # TS 타입 검사
bun run db:push      # DB 스키마 마이그레이션
```

---

## 프론트엔드 구조 (2026-03-28 완료)

`src/playground.ts`(HTML-in-string ~3000줄) → React + shadcn/ui 전환 완료.

```
프로젝트 루트/
  src/           ← Hono API 서버 (그대로 유지)
  functions/     ← Cloudflare Pages Functions (그대로 유지)
  client/        ← React + Vite + Tailwind v4 + shadcn/ui 앱
    src/
      pages/          ← QuotePage.tsx, ImportPage.tsx, DashboardPage.tsx
      components/     ← VehicleInfoCard, AcquisitionCostCard, QuoteConditionsCard, QuoteResultCard
      hooks/          ← useCatalog.ts, useQuote.ts
      lib/            ← api.ts, residual.ts, utils.ts
      types/          ← catalog.ts, quote.ts, imports.ts
    dist/        ← Vite 빌드 아웃풋 (wrangler pages_build_output_dir)
```

### 네비게이션 구조
- 좌측 사이드바 (w-220px, oklch 다크 배경)
- 순서: 대시보드 → 견적 계산 → 워크북 임포트
- 활성 항목: 좌측 accent bar + bg-white/10

### 디자인 시스템
- `index.css`: `fade-up`, `shimmer`, `ping-ring` 키프레임 + `.skeleton`, `.animate-fade-up`, `.ping-ring` 유틸
- dot-grid 배경 (radial-gradient, fixed attachment)
- oklch 색상 토큰, Geist Variable 폰트
- 숫자: `font-mono tabular-nums font-normal` (SF Mono, non-bold)

- API 백엔드(Hono) 변경 없음, 계산 엔진 완전 동일
- `wrangler.jsonc` `pages_build_output_dir` = `"client/dist"` ✅
- `playground.ts` 라우트 제거 완료 ✅

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

### BNK 캐피탈 엔진 메모

- BNK 워크북에는 차량가격 없음 — 사용자가 `quotedVehiclePrice` 직접 입력 필수
- BNK CDB 그레이드 인덱스 (cbGrade, tyGrade, crGrade, adbGrade) → matrixGroup `{PROVIDER}_{gradeIndex}` 로 변환
- BMW 520i 기준: cbGrade=9(CB_9) 표준잔가=37%, tyGrade=3(TY_3)=45%, crGrade=6(CR_6)=42% (60m)
- 적용잔가 40%일 때: CB gap=-0.03 → fee=0%, TY gap=0.05 → fee=0.44%, CR gap=0.02 → fee=0.88% → CB 선택
- BNK 잔가보증 수수료 방향 주의: gap = 표준잔가 - 적용잔가 (양수 = 적용이 표준보다 낮음 → 수수료 발생)
- BNK RVs 테이블은 2만km 기준 (`오토데이터베이스 / 2만KM` 헤더 확인), 다른 약정거리 조정 공식은 Es1 B366 셀 참조
- BNK 취득세 기본값: ≥1600cc 승용 → 7%, 그 외 → 4% (MG와 동일)
- BNK stampDuty 기본값: 0원 (MG는 10,000원 — 다름)
- BNK Es1 잔가보증 수수료 최대값: WS=1.32%, SE/CB=1.35%, BR=0%, TY=1.32%, JY=1.45%, CR=1.35%, ADB=1.45%
- BNK Phase B 테스트 픽스처 패턴: `annualIrrRateOverride` 제거 + `providerRates` 배열 + `policyBaseIrr` 설정
