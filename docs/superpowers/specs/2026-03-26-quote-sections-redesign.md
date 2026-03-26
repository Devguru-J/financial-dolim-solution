# 견적 입력 — 취득원가 산출 & 견적 조건 섹션 재설계

**날짜:** 2026-03-26
**파일:** `src/playground.ts`
**범위:** 섹션 2, 3 UI 변경 (계산 로직 변경 없음)

---

## 목표

- 기존 "계약 및 부대비용" → **취득원가 산출** 으로 단순화
- 기존 "잔가 및 금리" → **견적 조건** 으로 재구성
- 핵심 입력값만 노출, 나머지는 hidden input 유지
- 보증금/선납금에 %/금액 모드 토글 도입
- 잔존가치 자동 반영 (트림 선택 → 최대잔가 채움)

---

## 섹션 2: 취득원가 산출 (구: 계약 및 부대비용)

### 레이아웃 — 4컬럼 그리드 (label | value | label | value)

| 왼쪽 레이블 | 왼쪽 값 | 오른쪽 레이블 | 오른쪽 값 |
|---|---|---|---|
| 취득세 감면 여부 | 드롭다운 (해당없음) | 탁송료 | 체크박스 + 숫자 입력 |
| 취득세 포함 여부 | 체크박스 + 취득세 금액 표시 | 부대비용 | 체크박스 + 숫자 입력 |
| 공채 할인 여부 | 체크박스 + 숫자 입력 | 취득원가 | 읽기전용 (`#sheet-acquisition-cost`) |

### 숨김 처리 (hidden input)

| 필드 ID | name | 기본값 |
|---|---|---|
| `ownershipType` | `ownershipType` | `company` |
| `acquisitionTaxRateOverride` | `acquisitionTaxRateOverride` | `0.07` |
| `insuranceYearlyAmount` | `insuranceYearlyAmount` | `0` |
| `lossDamageAmount` | `lossDamageAmount` | `0` |
| `sheet-car-tax` | — | (JS 기록용) |
| `sheet-sales-owner` | — | (JS 기록용) |
| `sheet-extra-service` | — | (JS 기록용) |
| `sheet-deposit-basis` | — | (JS 기록용) |

### 취득원가 표시
- `#sheet-acquisition-cost` → 계산 후 `quote.majorInputs.financedPrincipal` 표시
- `upfrontPayment = 0` 고정이므로 `financedPrincipal = acquisitionCost`

### 취득세 포함 여부 체크박스
- 체크 해제 → `acquisitionTaxRateOverride = 0` → 재계산 트리거
- 체크 → `acquisitionTaxRateOverride = 0.07` → 재계산 트리거

---

## 섹션 3: 견적 조건 (구: 잔가 및 금리)

### 레이아웃 — 4컬럼 그리드 (label | value | label | value)

| 왼쪽 레이블 | 왼쪽 값 | 오른쪽 레이블 | 오른쪽 값 |
|---|---|---|---|
| 판매사 | 드롭다운 (기본: 비활성) | 기간(개월) | 드롭다운 12~60, **기본 60** |
| 제휴수수료 면제 | 라디오: 비해당(기본) / 해당 | 약정거리 | 드롭다운 10k~35k, 기본 20,000km |
| 보증금 | 금액/% 모드 + 숫자 입력 | 잔존가치 | 텍스트 입력 (트림 선택 시 최대잔가 자동반영) |
| 선납금 | 금액/% 모드 + 숫자 입력 | CM수수료 | % 텍스트 입력, 기본 0% |
| 전기차 보조금 | 라디오: 비해당(기본) / 해당 + 금액 | AG수수료 | % 텍스트 입력, 기본 0% |

### 숨김 처리 (hidden input)

| 필드 ID | name | 기본값 | 비고 |
|---|---|---|---|
| `depositAmount` | `depositAmount` | `0` | 보증금 모드에서 실제값 계산 후 저장 |
| `upfrontPayment` | `upfrontPayment` | `0` | 선납금 모드에서 실제값 계산 후 저장 |
| `annualIrrRateOverride` | `annualIrrRateOverride` | `""` | 빈값 = 자동 |
| `stampDuty` | `stampDuty` | `""` | 빈값 = 자동(10,000) |
| `residualAmountOverride` | `residualAmountOverride` | `""` | BK27 금액 override |
| `sheet-applied-residual-rate` | — | `-` | JS 기록용 |
| `sheet-min/max-residual-rate` | — | `-` | JS 기록용 |
| `sheet-residual-amount` | — | `-` | JS 기록용 |
| `sheet-high-residual` | — | `-` | JS 기록용 |
| `sheet-promo-code` | — | `-` | JS 기록용 |

### 보증금/선납금 % 모드

```
실제값 = round((quotedVehiclePrice - discountAmount) × 입력값 / 100)
```

- `depositMode` / `upfrontMode` select: `amount`(기본) | `pct`
- 차량가 또는 할인가 변경 시 → `computeDepositAmount()` / `computeUpfrontPayment()` 자동 재계산
- `depositAmount` / `upfrontPayment` hidden input에 저장 → FormData로 API 전달

### 잔존가치 자동반영

- Trim 선택 시 `selectedResidualRateInput`이 비어있으면 `previewMaximumResidualRate(model, term)` 결과 자동 입력
- 기간(leaseTermMonths) 변경 시도 동일하게 재계산
- 사용자가 직접 입력한 경우 덮어쓰지 않음

---

## 범위 외

- `operating-lease-service.ts` 계산 로직 변경 없음
- 차량 정보 섹션 변경 없음
- 고급 override 패널(`annualEffectiveRateOverride`, `paymentRateOverride`) 유지
