# 견적 입력 — 차량 정보 섹션 재설계

**날짜:** 2026-03-25
**파일:** `src/playground.ts`
**범위:** 차량 정보 섹션 UI 변경 (계산 로직 변경 없음)

---

## 목표

- 불필요한 필드를 화면에서 숨겨 UX 단순화
- Brand → Model(비활성) → Trim 3단계 선택 구조 도입
- 나중에 다른 금융사 추가 시 공용으로 쓸 수 있는 구조 준비

---

## 레이아웃 변경

### 차량 정보 섹션 — 4컬럼 그리드 (label | value | label | value)

| 왼쪽 레이블 | 왼쪽 값 | 오른쪽 레이블 | 오른쪽 값 |
|---|---|---|---|
| Brand | 드롭다운 | 차량 가격 | 숫자 입력 (자동반영, 수정가능, 원 표기) |
| Model | 드롭다운 (disabled) | 옵션 가격 | 읽기전용, 기본 0원 |
| Trim | 드롭다운 (현재 모델 리스트) | 할인 가격 | 숫자 입력, 기본 0원 |

기존 `sheet-grid` CSS를 4컬럼 (`grid-template-columns: auto 1fr auto 1fr`)으로 변경.

### 하단 요약 행 (display-only, 폼에 직렬화 안 됨)

| 최종차량가 | 일반잔가 (잔가%) | 최대(고)잔가 (%) |
|---|---|---|
| `quotedVehiclePrice - discountAmount` (= 기존 `discountedVehiclePriceDisplay`) | `baseRate` (highResidual 가산 없이) | `previewMaximumResidualRate()` 결과 |

- 현재 선택된 `leaseTermMonths` 기준으로 계산
- Trim 미선택 시 `-` 표시
- 일반잔가: 기존 `previewMaximumResidualRate` 내부의 `baseRate` 계산 로직을 분리한 새 헬퍼 `previewBaseResidualRate(model, term)` 추가

기존 `vehicle-price-source-grid` (차량DB 기본값 / 현재 입력값)는 하단 요약 행으로 대체하여 제거.

---

## 숨김 처리 (hidden input으로 변환)

아래 필드들을 `<input type="hidden">`으로 변환. `id`/`name`은 유지.

| 필드 | 변경 후 | 기본값 |
|---|---|---|
| 제휴사 | `<input type="hidden" id="affiliateType" name="affiliateType" value="비제휴사">` | `비제휴사` |
| 차종직접입력 | `<input type="hidden" id="directModelEntry" name="directModelEntry" value="">` | `""` (= false) |
| 차종구분 | `<input type="hidden" id="manualVehicleClass" name="manualVehicleClass">` | — |
| 배기량 | `<input type="hidden" id="manualEngineDisplacementCc" name="manualEngineDisplacementCc">` | — |

---

## JS 변경 상세

### 1. Trim select 연결

- 기존 `<select id="modelName" name="modelName">` → `id="modelName"` 유지, `name` 속성 제거 (FormData에서 제외)
- 새 Trim select: `<select id="trimName" name="modelName">` — FormData 키(`modelName`) 유지
- JS 변수: `modelSelect` → 기존 modelName select (disabled 상태 유지), `trimSelect` → 새 trimName select
- `brandSelect` change 시: `trimSelect`에 모델 리스트 로딩 (기존 `renderCatalogModels` 로직 그대로)
- `trimSelect` change 시: 기존 `modelSelect` change 이벤트 로직 적용

### 2. `directModelEntry` 관련 수정

- `setAutoSummaryFromModel()` 내 `if (!directModelEntryInput.checked)` → `if (directModelEntryInput.value !== 'true')`로 변경 (항상 true가 되어 자동반영 유지)
- 폼 리셋 시 `quoteForm.elements.namedItem('directModelEntry').checked = false` → `.value = ''`로 변경
- FormData 읽기: `data.get('directModelEntry') != null` → `directModelEntry: false` 하드코딩 (항상 비활성이므로)
- `directModelEntryInput.addEventListener('change', ...)` 이벤트 리스너 **제거**

### 3. `affiliateType` 관련 수정

- `affiliateTypeInput.addEventListener('change', ...)` 이벤트 리스너 **제거** (고정값이므로 불필요)

### 4. 하단 요약 행 업데이트 시점

- Trim 선택 변경 시, `leaseTermMonths` 변경 시, 차량가격/할인 변경 시 재계산

---

## 범위 외

- 계산 로직(`operating-lease-service.ts`) 변경 없음
- `계약 및 부대비용`, `잔가 및 금리` 섹션 변경 없음
- `selected-model-meta` note div 유지 (Trim 선택 시 기존과 동일하게 자동반영 텍스트 표시)
