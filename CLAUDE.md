# financial-dolim-solution — Claude 참고 문서

이 파일은 Claude가 이 프로젝트에서 작업할 때 참고하는 컨텍스트입니다.

---

## 프로젝트 개요

한국 자동차 금융(운용리스) 견적 계산 플랫폼. MG 캐피탈 + BNK 캐피탈 2개 금융사 지원, 향후 다수 금융사 확장 예정.

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
        operating-lease-service.test.ts  # MG 패리티 테스트 (46개)
      bnk-capital/
        operating-lease-service.ts  # BNK 운용리스 계산 엔진
        workbook-parser.ts          # BNK 엑셀 파싱
        adapter.ts                  # BNK 어댑터
        operating-lease-service.test.ts  # BNK 패리티 테스트 (17개)
    vehicles/
      vehicle-key.ts              # extractVehicleKey — 크로스 금융사 차량 매칭
      vehicle-key.test.ts         # vehicleKey 유닛 테스트 (67개)
fixtures/
  mg-capital/operating-lease/     # MG 패리티 픽스처 (30개 JSON)
  bnk-capital/operating-lease/    # BNK 패리티 픽스처 (17개 JSON)
scripts/
  dev.ts                          # 백엔드+프론트엔드 동시 실행 (bun run start)
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
- 보이는 필드: **취득세 감면(드롭다운 4모드)**, 탁송료(체크+입력), 취득세 포함(체크+세액표시), 부대비용(체크+입력), 공채 할인(체크+입력), 취득원가(읽기전용)
- **취득세 감면 4개 모드** (2026-04-05):
  - `automatic` — 자동 (배기량 기준 7%/4%)
  - `ratio` — 면제 (0%)
  - `reduction` — 금액 감면 (자동세액에서 입력값만큼 차감) — 감면액 입력 필드 조건부 표시
  - `amount` — 고정 금액 (세액 직접 입력) — 세액 입력 필드 조건부 표시
- 숨긴 필드: `ownershipType`(company), `insuranceYearlyAmount`(0), `lossDamageAmount`(0)

#### 3. 견적 조건 (구: 잔가 및 금리)
- 4컬럼 그리드, 5행
- 보이는 필드:

| 왼쪽 | 오른쪽 |
|------|--------|
| 판매사 (드롭다운, 기본 "비활성") | 기간(개월) (12~60, **기본 60**) |
| 제휴수수료 면제 (라디오: 비해당/해당) | 약정거리 (10k~40k, 기본 20k, BNK는 15k/40k 추가) |
| 보증금 (금액/% 모드 토글 + 입력) | 잔존가치 (트림 선택 시 최대잔가 자동반영) |
| 선납금 (금액/% 모드 토글 + 입력) | CM수수료 (기본 0%) |
| 전기차 보조금 (비해당/해당 라디오 + 금액, **엔진 배선됨**) | AG수수료 (기본 0%) |

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

## 현재 진행 상태 (2026-04-04)

### MG 캐피탈
- ✅ 운용리스 계산 엔진 (Phase A + Phase B 완료)
- ✅ 패리티 테스트 41개 (25 픽스처 + 16 단위 테스트) — 전체 통과
- ✅ CQ27 자동금리 계산 경로 (baseIrrRate + resolvedMatrixGroup + maximumResidualRateOverride)
- ✅ 프론트엔드 React + shadcn 전환 완료 (playground.ts 폐기)
- ✅ UI/UX — 좌측 사이드바, DashboardPage, ImportPage 드래그앤드롭, 숫자 폰트 font-normal
- ✅ financedPrincipal 버그 수정 — gross acquisitionCost (upfrontPayment 차감 안 함)

### BNK 캐피탈 (2026-04-04 업데이트)
- ✅ **워크북 파서** (`workbook-parser.ts`) — CDB/RVs/Cond 시트 파싱, (brand, modelName) 중복제거
  - 3321 CDB행 → 2275개 유니크 차량 (최신 modelYear 유지)
  - **통합 BNK 잔가 테이블** (RVs!AG8:CW67) 파싱 — Es1이 실제 사용하는 테이블
    - matrixGroup = `BNK_{gradeLabel}` (예: BNK_9, BNK_3, BNK_7.5, BNK_S8)
    - 소규모 잔가사별 테이블(WS/CB/TY 등)은 참고용 — Es1은 통합 테이블만 사용
  - JY 잔가사 포함 — float("7.5")/string("S8"/"S10") 그레이드 모두 처리
  - Cond 시트 → 브랜드별 conditionType → baseIrr 매핑
- ✅ **BNK 어댑터** 등록 (`adapter.ts`, `lender-registry.ts`, `app.ts`)
- ✅ **운용리스 계산 엔진** (`operating-lease-service.ts`) — Excel Es1 시트 재현
  - PMT: `((PV - FV/factor) × rate) / (1 - 1/factor)`, monthlyRate = annualRate/12
  - 표시금액: ROUNDUP(rawPayment, -2) — 100원 단위 올림
  - 취득세: roundDown(discountedVehiclePrice/1.1 × rate, -1), 기본 7%(≥1600cc), 4%(기타)
  - financedPrincipal = gross (upfrontPayment 미차감 — MG와 동일)
  - 잔존가치: roundDown(discountedVehiclePrice × ratio, -3)
  - 잔가보증 수수료 (gap = 적용잔가율 - 표준잔가율, 양수 = 적용이 높음 → 수수료 발생):
    - gap ≤ 0%: 0%, >0%: 0.22%, >1%: 0.44%, >2%: 0.66%, >3%: 0.88%, >4%: 1.10%, >5%: 1.21%, >6%: 잔가사별 최대수수료
  - 잔가사별 최대수수료: WS 1.32%, CB 1.35%, TY 1.32%, JY 1.45%, CR 1.35%, ADB 1.45%
  - Phase B 자동금리: WS/CB/TY/JY/CR/ADB 6개 잔가사 중 수수료 가장 낮은 쪽 자동 선택 (2026-04-05 WS 추가)
  - 마일리지 조정: 1만km +2%, 1.5만km +1%, 2만km 0%, 3만km -4%, 4만km -9%
  - `calculateBnkOperatingLeaseQuoteFromContext` 순수함수 export (테스트용)
- ✅ **패리티 픽스처 13개** — 전체 통과 (엑셀 월납입금/금리 오차 0원)
  - Phase A (IRR override): base, deposit, upfront+deposit, customer, discount, 24m, 48m
  - Phase B (auto-rate): base, high-rv(fee 0.44%), CM+AG, 36m, mileage-30k, mileage-30k+high-rv
- ✅ **테스트 러너** (`operating-lease-service.test.ts`) — 59개 전체 통과 (MG 46 + BNK 13) — 2026-04-05 업데이트

### 멀티금융사 E2E 웹 플로우 (2026-04-04 완료)
- ✅ 카탈로그 API 멀티 워크북 지원 — lenderCode 미지정 시 모든 활성 워크북의 차량 합산
- ✅ stampDuty 금융사별 기본값 — 프론트엔드 하드코딩 제거, 엔진 기본값 사용 (MG=10000, BNK=0)
- ✅ 마일리지 옵션 확장 — 15000km/40000km 추가 (BNK 전용, MG는 35000km)
- ✅ BNK 잔가 카탈로그 분리 — BNK 차량은 MG 잔가 로직(summarizeMgResidualCandidates) 스킵
- ✅ fetchModels mg-capital 하드코딩 제거 — 전체 활성 워크북에서 모델 조회
- ✅ 단일 명령 로컬 실행 — `bun run start` (백엔드 8788 + 프론트엔드 5173 동시 실행)

### 2026-04-05 업데이트
- ✅ **MG 36m 변형 픽스처 5개 추가** — bmw-520i/320d/x5-30d/x3-20d, benz-e220d-36-exclusive (AppleScript 자동 추출)
- ✅ **BNK WS(웨스트) 잔가사 엔진 등록** — BNK_PROVIDERS 배열에 wsGrade 추가 (maxFee 1.32%), 워크북 파서 CDB 10/11열에서 wsGrade/wsPGrade 파싱
- ✅ **취득세 감면 4개 모드 UI 노출** — automatic(자동 7%) / ratio(면제 0%) / reduction(금액 감면) / amount(고정 금액)
  - Zod 스키마 + CanonicalQuoteInput 확장
  - BNK 엔진에도 동일 4개 모드 구현 (기존엔 rateOverride만)
  - AcquisitionCostCard 드롭다운 + 조건부 입력 필드
- ✅ **전기차 보조금 전체 배선** — dead UI → API까지 연결
  - `evSubsidyAmount` 필드 추가 (Zod 스키마, CanonicalQuoteInput, QuotePayload)
  - 양쪽 엔진: discountedVehiclePrice = max(0, quotedPrice - discountAmount - evSubsidyAmount)
  - QuotePage.buildPayload()에서 evSubsidy 상태 활용

### 2026-04-08 업데이트
- ✅ **vehicleKey 크로스 금융사 매칭** — MG 트림 선택 시 BNK 동일 차량 자동 매칭
  - `extractVehicleKey(brand, modelName)` 유틸 — BMW_320D, BENZ_E220D, VOLVO_XC40 등 정규화 키 추출
  - `resolveModelNameByVehicleKey` — 후보 배열에서 vehicleKey 매칭으로 차량 찾기
  - 양쪽 엔진 fallback: exact modelName 실패 → vehicleKey 매칭 (기존 로직 무변경)
  - 67개 유닛 테스트 (BMW/BENZ/AUDI/VOLVO/LEXUS/GENESIS 크로스 패리티 포함)
- ✅ **BNK 크로스브랜드 픽스처 4개** — BENZ CLE53, AUDI A7, VOLVO XC40, BMW 520i(90M) — Phase A (IRR override)
- ✅ **BNK RVs 파서 .xlsm 대응** — headerRow/dataRowStart/dataRowEnd 오프셋 수정
  - .xlsm에서 blankrows:false 시 헤더가 idx 4 (기존 6) → matrixGroup이 BNK_0.61... 대신 BNK_9, BNK_S1 등으로 정상 파싱
- ✅ **Trim 드롭다운 MG 전용** — BNK 차량명(vehiclePrice=0) 필터링, MG 기준만 표시
- ✅ **.xlsm 파일 업로드 허용** — ImportPage accept에 .xlsm 추가
- ✅ **테스트** — 130개 전체 통과 (MG 46 + BNK 17 + vehicleKey 67)

### 미완료
- 🟡 **BNK 제휴사 금리 매핑** — Cond 시트에 딜러별 conditionType 존재 (BMW-동성모터스→운용_세영=0.0521, BMW_비제휴→운용_기타브랜드=0.0681). 현재 파서는 브랜드 기본값만 읽음. Es1 VBA의 제휴사→conditionType 매핑을 파서에 구현 + UI 제휴사 선택 드롭다운 필요
- 🟡 BNK WS 픽스처 — WS 그레이드 있는 차량 찾아 Phase B auto-select 검증 필요
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

#### BNK 캐피탈 픽스처 (13개)

| 파일 | 모델 | 기간 | Phase | 비고 |
|------|------|------|-------|------|
| bmw-520i-60-base | BMW 520i | 60m | A | IRR override, 110M → 1,575,700원 |
| bmw-520i-24-base | BMW 520i | 24m | A | 24개월 기간 변형, 잔가 55% |
| bmw-520i-48-base | BMW 520i | 48m | A | 48개월 기간 변형, 잔가 45% |
| bmw-520i-60-deposit-20m | BMW 520i | 60m | A | 보증금 20M |
| bmw-520i-60-upfront-10m-deposit-10m | BMW 520i | 60m | A | 선납 10M + 보증금 10M |
| bmw-520i-60-customer | BMW 520i | 60m | A | 이용자명의, 10% 금리 |
| bmw-520i-60-discount-5m | BMW 520i | 60m | A | 할인 5M, 잔가율 40% |
| bmw-520i-60-phase-b-auto | BMW 520i | 60m | B | 자동금리, CB 선택 (fee=0%) |
| bmw-520i-60-phase-b-high-rv | BMW 520i | 60m | B | 잔가 53%, TY 선택 (fee=0.44%) |
| bmw-520i-60-phase-b-cm1-ag1 | BMW 520i | 60m | B | CM 1% + AG 1%, rate=7.21% |
| bmw-520i-36-phase-b-auto | BMW 520i | 36m | B | 36개월 자동금리 |
| bmw-520i-60-mileage-30k | BMW 520i | 60m | B | 3만km 마일리지 조정, TY 선택 |
| bmw-520i-60-mileage-30k-high-rv | BMW 520i | 60m | B | 3만km + 잔가 50%, TY fee=0.44% |

---

## 개발 명령어

```bash
bun run start        # 백엔드(8788) + 프론트엔드(5173) 동시 실행 (한 줄)
bun run dev          # 백엔드만 (Hono API 서버)
bun run dev:client   # 프론트엔드만 (Vite dev server)
bun test             # 패리티 테스트 (130개: MG 46 + BNK 17 + vehicleKey 67)
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
- CDB 그레이드 → 통합 BNK 테이블 (RVs!AG8:CW67) 조회. matrixGroup = `BNK_{gradeValue}`
  - cbGrade=9 → BNK_9, tyGrade=3 → BNK_3, jyGrade="7.5" → BNK_7.5, jyGrade="S8" → BNK_S8
- BMW 520i 60m 통합 테이블 기준: grade 9=0.46, grade 3=0.52, grade 6=0.49
- 잔가보증 수수료: gap = 적용잔가율 - 표준잔가율 (양수 = 적용이 표준보다 높음 → 수수료 발생)
  - 적용잔가 40%, CB 표준 46%일 때: gap = -0.06 → fee=0% (CB 선택)
  - 적용잔가 53%, TY 표준 52%일 때: gap = 0.01 → fee=0.44% (TY 선택)
- 마일리지 조정 (Es1 B240): 1만km +2%, 1.5만km +1%, 2만km 0%, 3만km -4%, 4만km -9%
  - 프로모션은 2만km에서만 적용 (Es1 B242: `IF(B42="2만km", VLOOKUP(...), 0)`)
- BNK 취득세 기본값: ≥1600cc 승용 → 7%, 그 외 → 4% (MG와 동일)
- BNK stampDuty 기본값: 0원 (MG는 10,000원 — 다름)
- 잔가사별 최대수수료 (gap > 6%): WS 1.32%, CB 1.35%, BR 0%, TY 1.32%, JY 1.45%, CR 1.35%, ADB 1.45% — WS 엔진 등록됨(2026-04-05), BR 미등록
- **⚠️ BNK 워크북 = VBA 매크로 기반** — 모든 시트에 셀 수식이 저장되지 않음 (Es1 포함 전체 0 formulas). 자동 추출 스크립트 빌드 불가능 → 크로스브랜드 픽스처는 Excel 수동 실행 후 값 기록 방식으로만 가능
- Phase B 테스트 픽스처 패턴: `annualIrrRateOverride` 제거 + `providerRates` 배열 + `policyBaseIrr` 설정
