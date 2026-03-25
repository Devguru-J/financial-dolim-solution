# 견적 입력 차량 정보 섹션 재설계 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `src/playground.ts`의 차량 정보 섹션을 Brand→Model(비활성)→Trim 3단계 구조로 재편하고, 불필요한 필드 4개를 hidden input으로 변환하여 UI를 단순화한다.

**Architecture:** HTML 템플릿 섹션(차량 정보 블록)을 재작성하고, JS에서 `modelSelect` 로직을 `trimSelect`로 연결한다. 계산 엔진(`operating-lease-service.ts`)은 건드리지 않는다.

**Tech Stack:** TypeScript (HTML-in-string template), vanilla JS (DOM), no framework

**Task 순서 의존성:** Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6. Task 3은 반드시 Task 2 완료 후 실행 (Task 3의 새 함수들이 Task 2에서 선언한 DOM 변수들을 참조함).

---

## Files

- Modify: `src/playground.ts`
  - HTML 섹션 (~lines 1262–1323): 차량 정보 블록 재작성
  - JS 섹션 (~lines 1727–1736): DOM 변수 선언 업데이트
  - JS 함수 (~lines 1835–1858): `previewBaseResidualRate` 헬퍼 추가
  - JS 함수 (~lines 1861–1871): `updateResidualPreviewFromInputs` — 요약 행 업데이트 포함
  - JS 함수 (~lines 1901–1917): `renderVehiclePriceSources` → `renderVehicleSummaryRow`로 교체
  - JS 함수 (~lines 1961, 1987): `getContractVehiclePriceForCurrentSelection`, `resetWorkbookDefaults` — modelSelect.value → trimSelect.value
  - JS 함수 (~lines 2027): 폼 리셋 `directModelEntry` 처리
  - JS 함수 (~lines 2133–2136): `setAutoSummaryFromModel` 체크 수정
  - JS 함수 (~lines 2202–2251): `renderCatalogModels` — trimSelect 타겟
  - JS 함수 (~lines 2254–2278): `syncSelectedModelMeta` — trimSelect 참조
  - JS 함수 (~lines 2049–2050): `updateWorkbookDiffWarning` — trimSelect 참조
  - JS (~lines 2374–2380): FormData 읽기 — `directModelEntry` 하드코딩
  - JS (~lines 2676–2693): 이벤트 리스너 2개 제거
  - JS (~lines 2761–2788): `discountAmount` 변경 시 요약 행 업데이트 추가
  - JS (~lines 2769, 2775, 2783, 2939–2945): 남은 `modelSelect.value` → `trimSelect.value`

---

## Task 1: HTML — 차량 정보 블록 재작성

**Files:**
- Modify: `src/playground.ts` (~lines 1262–1323)

- [ ] **Step 1: 기존 차량 정보 블록 교체**

  lines 1262–1323 (`<div class="sheet-block-title">차량 정보</div>` 부터 `</div>` 끝까지) 를 아래로 교체한다:

  ```html
  <div class="sheet-block-title">차량 정보</div>
  <div class="sheet-grid">
    <div class="sheet-label">Brand</div>
    <div class="sheet-value">
      <select class="sheet-field" id="brand" name="brand"></select>
    </div>
    <div class="sheet-label">차량 가격</div>
    <div class="sheet-value">
      <input class="sheet-field tabular" id="quotedVehiclePrice" name="quotedVehiclePrice" type="number" />
    </div>

    <div class="sheet-label">Model</div>
    <div class="sheet-value">
      <select class="sheet-field" id="modelName" disabled style="opacity:0.4;cursor:not-allowed"></select>
    </div>
    <div class="sheet-label">옵션 가격</div>
    <div class="sheet-value">
      <input class="sheet-field readonly tabular" id="optionAmountDisplay" type="text" readonly value="0" />
    </div>

    <div class="sheet-label">Trim</div>
    <div class="sheet-value">
      <select class="sheet-field" id="trimName" name="modelName"></select>
    </div>
    <div class="sheet-label">할인 가격</div>
    <div class="sheet-value">
      <input class="sheet-field tabular" id="discountAmount" name="discountAmount" type="number" value="0" />
    </div>
  </div>

  <!-- hidden inputs: 계산에 사용되지만 화면에 표시 안 함 -->
  <input type="hidden" id="affiliateType" name="affiliateType" value="비제휴사" />
  <input type="hidden" id="directModelEntry" name="directModelEntry" value="" />
  <input type="hidden" id="manualVehicleClass" name="manualVehicleClass" />
  <input type="hidden" id="manualEngineDisplacementCc" name="manualEngineDisplacementCc" />

  <div class="sheet-note" id="selected-model-meta">선택한 모델의 차종, 배기량, 고잔가 여부와 프로모션 코드가 자동 반영됩니다.</div>

  <!-- 하단 요약 행 -->
  <div class="sheet-source-grid" id="vehicle-summary-row" style="grid-template-columns: repeat(3, 1fr)">
    <div class="sheet-source-card">
      <div class="sheet-source-label">최종차량가</div>
      <div class="sheet-source-value tabular" id="summary-final-price">-</div>
    </div>
    <div class="sheet-source-card">
      <div class="sheet-source-label">일반잔가 <span id="summary-base-residual-pct" style="font-weight:400"></span></div>
      <div class="sheet-source-value tabular" id="summary-base-residual">-</div>
    </div>
    <div class="sheet-source-card">
      <div class="sheet-source-label">최대(고)잔가 <span id="summary-max-residual-pct" style="font-weight:400"></span></div>
      <div class="sheet-source-value tabular" id="summary-max-residual">-</div>
    </div>
  </div>
  ```

  > 주의: `<select id="modelName">`에서 `name="modelName"` 속성을 제거한다 (FormData에서 제외).
  > 새 `<select id="trimName" name="modelName">`이 FormData 키를 담당한다.

- [ ] **Step 2: Commit**

  ```bash
  git add src/playground.ts
  git commit -m "feat: redesign vehicle info section — 3-level Brand/Model/Trim layout"
  ```

---

## Task 2: JS — DOM 변수 선언 업데이트

**Files:**
- Modify: `src/playground.ts` (~lines 1727–1736)

- [ ] **Step 1: DOM 변수 선언 업데이트**

  lines 1727–1736 에서 아래와 같이 변경한다:

  **변경 전:**
  ```js
  const modelSelect = document.getElementById('modelName');
  const selectedModelMeta = document.getElementById('selected-model-meta');
  const vehiclePriceSourceModel = document.getElementById('vehicle-price-source-model');
  const vehiclePriceSourceContract = document.getElementById('vehicle-price-source-contract');
  const vehiclePriceSourceInput = document.getElementById('vehicle-price-source-input');
  const vehiclePriceSourceGrid = document.getElementById('vehicle-price-source-grid');
  const manualVehicleClassInput = document.getElementById('manualVehicleClass');
  const manualEngineDisplacementCcInput = document.getElementById('manualEngineDisplacementCc');
  const affiliateTypeInput = document.getElementById('affiliateType');
  const directModelEntryInput = document.getElementById('directModelEntry');
  ```

  **변경 후:**
  ```js
  const modelSelect = document.getElementById('modelName'); // disabled, 미래 확장용
  const trimSelect = document.getElementById('trimName');   // 현재 실제 모델 선택
  const selectedModelMeta = document.getElementById('selected-model-meta');
  const summaryFinalPrice = document.getElementById('summary-final-price');
  const summaryBaseResidual = document.getElementById('summary-base-residual');
  const summaryBaseResidualPct = document.getElementById('summary-base-residual-pct');
  const summaryMaxResidual = document.getElementById('summary-max-residual');
  const summaryMaxResidualPct = document.getElementById('summary-max-residual-pct');
  const manualVehicleClassInput = document.getElementById('manualVehicleClass');
  const manualEngineDisplacementCcInput = document.getElementById('manualEngineDisplacementCc');
  const directModelEntryInput = document.getElementById('directModelEntry');
  ```

  > `vehiclePriceSourceModel`, `vehiclePriceSourceContract`, `vehiclePriceSourceInput`, `vehiclePriceSourceGrid`, `affiliateTypeInput` 변수는 삭제한다.

- [ ] **Step 2: Commit**

  ```bash
  git add src/playground.ts
  git commit -m "refactor: update DOM variable declarations for trimSelect and summary row"
  ```

---

## Task 3: JS — `previewBaseResidualRate` 헬퍼 추가 및 `renderVehicleSummaryRow` 추가

> **전제조건:** Task 2가 완료되어야 한다. 이 Task의 새 함수들이 Task 2에서 선언한 `summaryFinalPrice` 등 DOM 변수를 참조한다.

**Files:**
- Modify: `src/playground.ts` (~lines 1835–1917)

- [ ] **Step 1: `previewBaseResidualRate` 헬퍼 추가**

  `previewMaximumResidualRate` 함수(~line 1835) 바로 다음에 추가한다.

  > **주의:** `maxResidualRates` 분기에서는 0.08을 빼지 않는다. `previewMaximumResidualRate`가 그 분기에서 +0.08을 더하지 않고 그대로 반환하기 때문이다. `+0.08` 가산은 matrix/direct 폴백 분기에서만 발생한다.

  ```js
  function previewBaseResidualRate(model, termMonths) {
    if (!model) return null;
    const term = Number(termMonths);
    const apiMaxRate = Number(model.maxResidualRates?.[term]);
    if (Number.isFinite(apiMaxRate)) {
      // maxResidualRates는 이미 최종 최대 잔가율을 저장 — +0.08 없이 반환하므로 base와 동일
      return apiMaxRate;
    }
    const band = model.snkResidualBand;
    const fromMatrix =
      band && residualMatrixLookup[band] && residualMatrixLookup[band][term]
        ? Number(
            residualMatrixLookup[band][term]['에스앤케이모터스'] ??
              residualMatrixLookup[band][term]['APS'] ??
              Object.values(residualMatrixLookup[band][term])[0],
          )
        : null;
    const directRate =
      Number(model.residuals?.[term] ?? model.snkResiduals?.[term] ?? model.apsResiduals?.[term] ?? model.chatbotResiduals?.[term]);
    const baseRate = Number.isFinite(fromMatrix) ? fromMatrix : Number.isFinite(directRate) ? directRate : null;
    return baseRate; // highResidual +0.08 없이 순수 base rate
  }
  ```

- [ ] **Step 2: `renderVehicleSummaryRow` 함수 추가 (기존 `renderVehiclePriceSources` 대체)**

  기존 `renderVehiclePriceSources` 함수(~lines 1901–1917)를 아래로 교체한다:

  ```js
  function renderVehicleSummaryRow(model) {
    const inputPrice = Number(quoteForm.elements.namedItem('quotedVehiclePrice').value || 0);
    const discount = Number(quoteForm.elements.namedItem('discountAmount').value || 0);
    const finalPrice = inputPrice - discount;
    const term = Number(quoteForm.elements.namedItem('leaseTermMonths').value || 36);

    summaryFinalPrice.textContent = finalPrice > 0 ? '₩ ' + formatNumber(finalPrice) : '-';

    const baseRate = previewBaseResidualRate(model, term);
    const maxRate = previewMaximumResidualRate(model, term);

    summaryBaseResidual.textContent = baseRate != null ? '₩ ' + formatNumber(Math.round(finalPrice * baseRate)) : '-';
    summaryBaseResidualPct.textContent = baseRate != null ? '(' + formatPercent(baseRate) + ')' : '';

    summaryMaxResidual.textContent = maxRate != null ? '₩ ' + formatNumber(Math.round(finalPrice * maxRate)) : '-';
    summaryMaxResidualPct.textContent = maxRate != null ? '(' + formatPercent(maxRate) + ')' : '';
  }
  ```

- [ ] **Step 3: 모든 `renderVehiclePriceSources(` 호출 → `renderVehicleSummaryRow(`로 교체**

  파일 전체에서 `renderVehiclePriceSources(` 를 검색하여 모두 `renderVehicleSummaryRow(`로 교체.
  확인 위치: ~lines 2046, 2157, 2170, 2260, 2278, 2775, 2783

- [ ] **Step 4: Commit**

  ```bash
  git add src/playground.ts
  git commit -m "feat: add previewBaseResidualRate helper and vehicle summary row renderer"
  ```

---

## Task 4: JS — `renderCatalogModels` 및 관련 함수 trimSelect 연결

**Files:**
- Modify: `src/playground.ts` (~lines 1961, 1987, 2049, 2202–2278, 2769, 2939–2945)

- [ ] **Step 1: `renderCatalogModels` 내부 `modelSelect` → `trimSelect` 교체**

  `renderCatalogModels` 함수(~lines 2202–2252) **내부에서만** 아래 참조를 교체한다:
  - `modelSelect.innerHTML = ...` → `trimSelect.innerHTML = ...`
  - `modelSelect.disabled = ...` → `trimSelect.disabled = ...`
  - `modelSelect.value = ...` → `trimSelect.value = ...`

  > 주의: 함수 바깥 lines 2914–2915, 2932–2933의 `modelSelect.innerHTML`/`modelSelect.disabled`는 그대로 둔다. 이 라인들은 영구 disabled인 Model 표시용 select의 placeholder를 설정하는 것으로, 의도된 동작이다.

- [ ] **Step 2: `syncSelectedModelMeta` 내 `modelSelect.value` → `trimSelect.value`**

  ~line 2255: `entry.modelName === modelSelect.value` → `entry.modelName === trimSelect.value`

- [ ] **Step 3: `updateWorkbookDiffWarning` 내 `modelSelect.value` → `trimSelect.value`**

  ~line 2050: `entry.modelName === modelSelect.value` → `entry.modelName === trimSelect.value`

- [ ] **Step 4: `getContractVehiclePriceForCurrentSelection` 내 `modelSelect.value` → `trimSelect.value`**

  ~line 1961: `modelSelect.value === contractModel` → `trimSelect.value === contractModel`

- [ ] **Step 5: `resetWorkbookDefaults` 내 `modelSelect.value` → `trimSelect.value`**

  ~line 1987: `entry.modelName === modelSelect.value` → `entry.modelName === trimSelect.value`

- [ ] **Step 6: 나머지 `modelSelect.value` 전체 sweep**

  파일 전체에서 `modelSelect.value` 를 검색한다. 아직 남아있는 것들을 모두 `trimSelect.value`로 교체한다.

  > **제외**: `const modelSelect = document.getElementById('modelName')` 선언 라인은 건드리지 않는다.
  > **제외**: `modelSelect.innerHTML`, `modelSelect.disabled` (Step 1 에서 이미 처리하거나 의도적으로 유지)

  확인 위치: ~lines 2157, 2170, 2769, 2775, 2783, 2939–2945

- [ ] **Step 7: `trimSelect` change 이벤트 리스너 추가**

  `brandSelect.addEventListener('change', ...)` 블록 다음에 추가:

  ```js
  trimSelect.addEventListener('change', () => {
    syncSelectedModelMeta();
    updateResidualPreviewFromInputs(activeModels.find((entry) => entry.modelName === trimSelect.value) || null);
    scheduleAutoCalculate();
  });
  ```

- [ ] **Step 8: Commit**

  ```bash
  git add src/playground.ts
  git commit -m "refactor: wire trimSelect to model loading, sync, and contract logic"
  ```

---

## Task 5: JS — `directModelEntry` / `affiliateType` 정리

**Files:**
- Modify: `src/playground.ts` (~lines 2027, 2134, 2378, 2676–2693)

- [ ] **Step 1: 폼 리셋 `directModelEntry` 수정**

  ~line 2027:
  ```js
  quoteForm.elements.namedItem('directModelEntry').checked = false;
  ```
  →
  ```js
  quoteForm.elements.namedItem('directModelEntry').value = '';
  ```

- [ ] **Step 2: `setAutoSummaryFromModel` 조건 수정**

  ~line 2134:
  ```js
  if (!directModelEntryInput.checked) {
  ```
  →
  ```js
  if (directModelEntryInput.value !== 'true') {
  ```

- [ ] **Step 3: FormData 읽기 수정**

  ~line 2378:
  ```js
  directModelEntry: data.get('directModelEntry') != null,
  ```
  →
  ```js
  directModelEntry: false,
  ```

- [ ] **Step 4: `directModelEntryInput` change 이벤트 리스너 제거**

  ~lines 2676–2685 블록 전체 삭제:
  ```js
  directModelEntryInput.addEventListener('change', () => {
    ...
  });
  ```

- [ ] **Step 5: `affiliateTypeInput` change 이벤트 리스너 제거**

  ~lines 2687–2693 블록 전체 삭제:
  ```js
  affiliateTypeInput.addEventListener('change', () => {
    ...
  });
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add src/playground.ts
  git commit -m "refactor: convert directModelEntry/affiliateType to hidden inputs, remove dead listeners"
  ```

---

## Task 6: JS — 요약 행 업데이트 트리거 연결

**Files:**
- Modify: `src/playground.ts` (~lines 1861–1871, 2761–2788)

- [ ] **Step 1: `updateResidualPreviewFromInputs`에 요약 행 업데이트 추가**

  `updateResidualPreviewFromInputs` 함수(~lines 1861–1871) 마지막 줄에 추가:

  ```js
  function updateResidualPreviewFromInputs(model) {
    const term = Number(quoteForm.elements.namedItem('leaseTermMonths').value || 0);
    const minimumRate = minimumResidualRateByTerm(term);
    const maximumRate = previewMaximumResidualRate(model, term);

    if (sheetAppliedResidualRate.value === '-' || !sheetAppliedResidualRate.value) {
      setFieldValue(sheetAppliedResidualRate, maximumRate == null ? '-' : formatPercent(maximumRate));
    }
    setFieldValue(sheetMinResidualRate, minimumRate == null ? '-' : formatPercent(minimumRate));
    setFieldValue(sheetMaxResidualRate, maximumRate == null ? '-' : formatPercent(maximumRate));
    renderVehicleSummaryRow(model); // 추가
  }
  ```

- [ ] **Step 2: `discountAmount` 변경 시 요약 행 업데이트 추가**

  ~lines 2761–2788의 필드 이벤트 루프에서 `quotedVehiclePrice` 처리 블록과 나란히 `discountAmount`도 처리하도록 수정:

  **change 핸들러 (~line 2774):**
  ```js
  if (name === 'quotedVehiclePrice' || name === 'discountAmount') {
    renderVehicleSummaryRow(activeModels.find((entry) => entry.modelName === trimSelect.value) || null);
  }
  ```

  **input 핸들러 (~line 2782):**
  ```js
  if (name === 'quotedVehiclePrice' || name === 'discountAmount') {
    renderVehicleSummaryRow(activeModels.find((entry) => entry.modelName === trimSelect.value) || null);
  }
  ```

- [ ] **Step 3: 전체 동작 확인**

  앱 실행 후 체크리스트:
  1. Brand 선택 → Trim에 모델 리스트 로딩됨
  2. Trim 선택 → 차량 가격 자동반영, 하단 요약 행(최종차량가/일반잔가/최대잔가) 업데이트됨
  3. 할인 금액 수정 → 최종차량가 및 잔가 금액 재계산됨
  4. 리스기간 변경 → 잔가 금액 재계산됨
  5. 제휴사, 차종구분, 배기량 화면에 안 보임
  6. 견적 계산 → 정상 결과 반환

- [ ] **Step 4: Final commit**

  ```bash
  git add src/playground.ts
  git commit -m "feat: connect summary row update to term, price, and discount changes"
  ```
