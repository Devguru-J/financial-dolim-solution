export function renderPlaygroundHtml() {
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MG Quote Playground</title>
    <style>
      :root {
        --bg: #f5efe5;
        --panel: rgba(255, 251, 245, 0.94);
        --ink: #1f1b17;
        --muted: #6c6259;
        --line: rgba(68, 47, 27, 0.12);
        --accent: #0f766e;
        --accent-strong: #115e59;
        --accent-soft: rgba(15, 118, 110, 0.1);
        --warn: #b45309;
        --shadow: 0 24px 60px rgba(73, 44, 20, 0.12);
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        min-height: 100vh;
        font-family: Georgia, "Times New Roman", serif;
        color: var(--ink);
        background:
          radial-gradient(circle at top left, rgba(15, 118, 110, 0.14), transparent 30%),
          radial-gradient(circle at top right, rgba(180, 83, 9, 0.12), transparent 24%),
          linear-gradient(180deg, #f8f2ea 0%, var(--bg) 100%);
      }

      .shell {
        width: min(1120px, calc(100% - 32px));
        margin: 32px auto 64px;
      }

      .hero {
        padding: 28px 28px 20px;
      }

      .eyebrow {
        display: inline-flex;
        padding: 6px 10px;
        border-radius: 999px;
        background: var(--accent-soft);
        color: var(--accent-strong);
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      h1 {
        margin: 18px 0 10px;
        font-size: clamp(32px, 6vw, 60px);
        line-height: 0.95;
        letter-spacing: -0.04em;
      }

      .hero p {
        margin: 0;
        max-width: 720px;
        color: var(--muted);
        font-size: 16px;
        line-height: 1.6;
      }

      .grid {
        display: grid;
        grid-template-columns: 1.05fr 0.95fr;
        gap: 20px;
      }

      .panel {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 28px;
        box-shadow: var(--shadow);
        overflow: hidden;
        backdrop-filter: blur(16px);
      }

      .panel-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px 22px 14px;
      }

      .panel-title {
        font-size: 20px;
        margin: 0;
      }

      .panel-sub {
        color: var(--muted);
        font-size: 13px;
      }

      form {
        padding: 0 22px 22px;
      }

      .form-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
      }

      .field {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .field.full {
        grid-column: 1 / -1;
      }

      label {
        font-size: 12px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--muted);
      }

      input, select, button, textarea {
        font: inherit;
      }

      input, select {
        width: 100%;
        border: 1px solid var(--line);
        border-radius: 16px;
        background: white;
        padding: 14px 15px;
        color: var(--ink);
      }

      input:focus, select:focus {
        outline: 2px solid rgba(15, 118, 110, 0.24);
        border-color: var(--accent);
      }

      .actions {
        display: flex;
        gap: 12px;
        margin-top: 18px;
      }

      button {
        border: 0;
        border-radius: 999px;
        padding: 14px 18px;
        cursor: pointer;
      }

      .primary {
        background: var(--accent);
        color: white;
        min-width: 170px;
      }

      .secondary {
        background: rgba(255,255,255,0.8);
        color: var(--ink);
        border: 1px solid var(--line);
      }

      .results {
        padding: 0 22px 22px;
      }

      .summary {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }

      .stat {
        padding: 16px;
        border-radius: 18px;
        background: rgba(255,255,255,0.7);
        border: 1px solid var(--line);
      }

      .stat-k {
        color: var(--muted);
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .stat-v {
        margin-top: 6px;
        font-size: 24px;
        letter-spacing: -0.03em;
      }

      .stack {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .callout {
        padding: 16px;
        border-radius: 18px;
        background: rgba(255,255,255,0.72);
        border: 1px solid var(--line);
      }

      .callout.warn {
        background: rgba(180, 83, 9, 0.09);
        border-color: rgba(180, 83, 9, 0.24);
      }

      .candidate-list {
        display: grid;
        gap: 10px;
      }

      .candidate {
        padding: 14px;
        border-radius: 18px;
        border: 1px solid var(--line);
        background: rgba(255,255,255,0.78);
      }

      .candidate-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
      }

      .candidate-name {
        font-size: 18px;
      }

      .candidate-meta {
        margin-top: 8px;
        color: var(--muted);
        font-size: 13px;
        line-height: 1.5;
      }

      .candidate button {
        margin-top: 12px;
        width: 100%;
        background: rgba(15, 118, 110, 0.09);
        color: var(--accent-strong);
        border: 1px solid rgba(15, 118, 110, 0.16);
      }

      pre {
        margin: 0;
        padding: 16px;
        overflow: auto;
        border-radius: 18px;
        background: #171411;
        color: #f5efe5;
        font-size: 12px;
        line-height: 1.5;
      }

      .muted {
        color: var(--muted);
      }

      .hidden {
        display: none;
      }

      @media (max-width: 900px) {
        .grid {
          grid-template-columns: 1fr;
        }

        .form-grid, .summary {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <section class="hero">
        <span class="eyebrow">MG Capital Playground</span>
        <h1>Residual Selection Testbed</h1>
        <p>
          로컬에서 바로 POST /api/quotes/calculate 를 때려보면서 hidden residual candidate,
          최종 잔가율 선택, 재계산 흐름까지 확인할 수 있는 테스트 페이지입니다.
        </p>
      </section>

      <section class="grid">
        <div class="panel">
          <div class="panel-head">
            <div>
              <h2 class="panel-title">Quote Input</h2>
              <div class="panel-sub">샘플 값을 바꿔가며 견적을 확인하세요.</div>
            </div>
          </div>
          <form id="quote-form">
            <div class="form-grid">
              <div class="field">
                <label for="brand">Brand</label>
                <select id="brand" name="brand">
                  <option value="AUDI">AUDI</option>
                  <option value="BMW">BMW</option>
                  <option value="BENZ">BENZ</option>
                  <option value="VOLVO">VOLVO</option>
                </select>
              </div>
              <div class="field">
                <label for="modelName">Model</label>
                <input id="modelName" name="modelName" value="A3 40 TFSI Premium" />
              </div>
              <div class="field">
                <label for="ownershipType">Ownership</label>
                <select id="ownershipType" name="ownershipType">
                  <option value="company">Company</option>
                  <option value="customer">Customer</option>
                </select>
              </div>
              <div class="field">
                <label for="leaseTermMonths">Lease Term</label>
                <select id="leaseTermMonths" name="leaseTermMonths">
                  <option value="36">36</option>
                  <option value="60">60</option>
                  <option value="48">48</option>
                  <option value="24">24</option>
                  <option value="12">12</option>
                </select>
              </div>
              <div class="field">
                <label for="annualMileageKm">Annual Mileage</label>
                <select id="annualMileageKm" name="annualMileageKm">
                  <option value="20000">20,000km</option>
                  <option value="10000">10,000km</option>
                  <option value="30000">30,000km</option>
                  <option value="35000">35,000km</option>
                </select>
              </div>
              <div class="field">
                <label for="quotedVehiclePrice">Quoted Vehicle Price</label>
                <input id="quotedVehiclePrice" name="quotedVehiclePrice" type="number" value="46400000" />
              </div>
              <div class="field">
                <label for="discountAmount">Discount Amount</label>
                <input id="discountAmount" name="discountAmount" type="number" value="0" />
              </div>
              <div class="field">
                <label for="upfrontPayment">Upfront Payment</label>
                <input id="upfrontPayment" name="upfrontPayment" type="number" value="0" />
              </div>
              <div class="field">
                <label for="depositAmount">Deposit Amount</label>
                <input id="depositAmount" name="depositAmount" type="number" value="0" />
              </div>
              <div class="field">
                <label for="annualIrrRateOverride">Displayed Annual IRR</label>
                <input id="annualIrrRateOverride" name="annualIrrRateOverride" type="number" step="0.000001" value="0.047" />
              </div>
              <div class="field">
                <label for="annualEffectiveRateOverride">Effective Annual IRR</label>
                <input id="annualEffectiveRateOverride" name="annualEffectiveRateOverride" type="number" step="0.000001" value="0.04699540291" />
              </div>
              <div class="field">
                <label for="paymentRateOverride">Payment Rate Override</label>
                <input id="paymentRateOverride" name="paymentRateOverride" type="number" step="0.00001" value="0.04709" />
              </div>
              <div class="field">
                <label for="selectedResidualRateOverride">Selected Residual Rate</label>
                <input id="selectedResidualRateOverride" name="selectedResidualRateOverride" type="number" step="0.000001" placeholder="e.g. 0.525" />
              </div>
              <div class="field">
                <label for="residualAmountOverride">Residual Amount Override</label>
                <input id="residualAmountOverride" name="residualAmountOverride" type="number" placeholder="e.g. 24360000" />
              </div>
              <div class="field">
                <label for="acquisitionTaxRateOverride">Acquisition Tax Rate</label>
                <input id="acquisitionTaxRateOverride" name="acquisitionTaxRateOverride" type="number" step="0.0001" value="0.07" />
              </div>
              <div class="field">
                <label for="stampDuty">Stamp Duty</label>
                <input id="stampDuty" name="stampDuty" type="number" value="10000" />
              </div>
            </div>
            <div class="actions">
              <button class="primary" type="submit">Calculate Quote</button>
              <button class="secondary" id="reset-sample" type="button">Load AUDI Sample</button>
            </div>
          </form>
        </div>

        <div class="stack">
          <div class="panel">
            <div class="panel-head">
              <div>
                <h2 class="panel-title">Quote Output</h2>
                <div class="panel-sub">적용된 잔가율과 월 납입금을 바로 확인합니다.</div>
              </div>
            </div>
            <div class="results">
              <div class="summary" id="summary"></div>
            </div>
          </div>

          <div class="panel">
            <div class="panel-head">
              <div>
                <h2 class="panel-title">Residual Candidates</h2>
                <div class="panel-sub">필요하면 후보를 눌러 최종 잔가율로 재계산합니다.</div>
              </div>
            </div>
            <div class="results stack">
              <div id="selection-guide" class="callout hidden"></div>
              <div id="warnings" class="stack"></div>
              <div id="candidate-list" class="candidate-list"></div>
            </div>
          </div>

          <div class="panel">
            <div class="panel-head">
              <div>
                <h2 class="panel-title">Raw Response</h2>
                <div class="panel-sub">API 응답 전체를 그대로 봅니다.</div>
              </div>
            </div>
            <div class="results">
              <pre id="raw-response">{}</pre>
            </div>
          </div>
        </div>
      </section>
    </main>

    <script>
      const form = document.getElementById("quote-form");
      const summary = document.getElementById("summary");
      const rawResponse = document.getElementById("raw-response");
      const warnings = document.getElementById("warnings");
      const candidateList = document.getElementById("candidate-list");
      const selectionGuide = document.getElementById("selection-guide");
      const resetSample = document.getElementById("reset-sample");

      const formatCurrency = (value) =>
        new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(Number(value || 0));

      const formatPercent = (value) =>
        new Intl.NumberFormat("ko-KR", { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 3 }).format(Number(value || 0));

      const samplePresets = {
        AUDI: {
          modelName: "A3 40 TFSI Premium",
          quotedVehiclePrice: 46400000,
          discountAmount: 0,
          annualIrrRateOverride: 0.047,
          annualEffectiveRateOverride: 0.04699540291,
          paymentRateOverride: 0.04709,
          selectedResidualRateOverride: "",
          residualAmountOverride: "",
        },
        BMW: {
          modelName: "X7 xDrive 40d DPE (6인승)",
          quotedVehiclePrice: 500000000,
          discountAmount: 8500000,
          annualIrrRateOverride: 0.047,
          annualEffectiveRateOverride: 0.047000978068,
          paymentRateOverride: 0.04701,
          selectedResidualRateOverride: "",
          residualAmountOverride: "",
        },
        BENZ: {
          modelName: "A 200d Sedan",
          quotedVehiclePrice: 46300000,
          discountAmount: 0,
          annualIrrRateOverride: 0.047,
          annualEffectiveRateOverride: 0.046995282907,
          paymentRateOverride: 0.04709,
          selectedResidualRateOverride: "",
          residualAmountOverride: "",
        },
        VOLVO: {
          modelName: "XC40 B4 AWD Ultra Dark",
          quotedVehiclePrice: 52100000,
          discountAmount: 0,
          annualIrrRateOverride: 0.047,
          annualEffectiveRateOverride: 0.046995767236,
          paymentRateOverride: 0.04708,
          selectedResidualRateOverride: "",
          residualAmountOverride: "",
        },
      };

      function applyPreset(brand) {
        const preset = samplePresets[brand];
        if (!preset) return;
        for (const [key, value] of Object.entries(preset)) {
          const field = form.elements.namedItem(key);
          if (field) field.value = value;
        }
      }

      function readPayload() {
        const data = new FormData(form);
        const payload = {
          lenderCode: "mg-capital",
          productType: "operating_lease",
          brand: data.get("brand"),
          modelName: data.get("modelName"),
          ownershipType: data.get("ownershipType"),
          leaseTermMonths: Number(data.get("leaseTermMonths")),
          annualMileageKm: Number(data.get("annualMileageKm")),
          upfrontPayment: Number(data.get("upfrontPayment") || 0),
          depositAmount: Number(data.get("depositAmount") || 0),
          quotedVehiclePrice: Number(data.get("quotedVehiclePrice") || 0),
          discountAmount: Number(data.get("discountAmount") || 0),
          annualIrrRateOverride: Number(data.get("annualIrrRateOverride") || 0),
          annualEffectiveRateOverride: Number(data.get("annualEffectiveRateOverride") || 0),
          paymentRateOverride: Number(data.get("paymentRateOverride") || 0),
          acquisitionTaxRateOverride: Number(data.get("acquisitionTaxRateOverride") || 0),
          stampDuty: Number(data.get("stampDuty") || 0),
        };

        const selectedResidualRateOverride = data.get("selectedResidualRateOverride");
        const residualAmountOverride = data.get("residualAmountOverride");

        if (selectedResidualRateOverride) {
          payload.selectedResidualRateOverride = Number(selectedResidualRateOverride);
        }

        if (residualAmountOverride) {
          payload.residualAmountOverride = Number(residualAmountOverride);
        }

        return payload;
      }

      function renderSummary(quote) {
        summary.innerHTML = "";
        const items = [
          ["Monthly Payment", formatCurrency(quote.monthlyPayment) + "원"],
          ["Residual Amount", formatCurrency(quote.residual.amount) + "원"],
          ["Applied Residual Rate", formatPercent(quote.residual.rateDecimal)],
          ["Displayed Annual IRR", formatPercent(quote.rates.annualRateDecimal)],
          ["Effective Annual IRR", formatPercent(quote.rates.effectiveAnnualRateDecimal)],
          ["Financed Principal", formatCurrency(quote.majorInputs.financedPrincipal) + "원"],
        ];
        for (const [label, value] of items) {
          const card = document.createElement("div");
          card.className = "stat";
          card.innerHTML = '<div class="stat-k">' + label + '</div><div class="stat-v">' + value + "</div>";
          summary.appendChild(card);
        }
      }

      function renderWarnings(quote) {
        warnings.innerHTML = "";
        for (const message of quote.warnings || []) {
          const item = document.createElement("div");
          item.className = "callout warn";
          item.textContent = message;
          warnings.appendChild(item);
        }
      }

      function renderSelectionGuide(quote) {
        const guide = quote.residual.selectionGuide;
        if (!guide) {
          selectionGuide.classList.add("hidden");
          selectionGuide.textContent = "";
          return;
        }

        selectionGuide.classList.remove("hidden");
        selectionGuide.className = "callout" + (guide.requiresUserConfirmation ? " warn" : "");
        selectionGuide.innerHTML =
          "<strong>Residual Selection</strong><br />" +
          "default: " + formatPercent(guide.defaultRateDecimal) +
          (guide.reason ? "<br />" + guide.reason : "");
      }

      function renderCandidates(quote) {
        candidateList.innerHTML = "";
        const candidates = quote.residual.candidateSummary?.candidates || [];
        for (const candidate of candidates) {
          const card = document.createElement("div");
          card.className = "candidate";
          card.innerHTML =
            '<div class="candidate-head">' +
              '<div class="candidate-name">' + candidate.name + "</div>" +
              "<strong>" + formatPercent(candidate.boostedRate) + "</strong>" +
            "</div>" +
            '<div class="candidate-meta">' +
              "base: " + formatPercent(candidate.baseRate) +
              "<br />mileage adjusted: " + formatPercent(candidate.mileageAdjustedRate) +
              "<br />boosted: " + formatPercent(candidate.boostedRate) +
            "</div>";

          const button = document.createElement("button");
          button.type = "button";
          button.textContent = "Use this residual rate";
          button.addEventListener("click", () => {
            form.elements.namedItem("selectedResidualRateOverride").value = candidate.boostedRate.toFixed(6);
            form.requestSubmit();
          });
          card.appendChild(button);
          candidateList.appendChild(card);
        }
      }

      async function calculate() {
        const payload = readPayload();
        rawResponse.textContent = "Loading...";
        try {
          const response = await fetch("/api/quotes/calculate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const data = await response.json();
          rawResponse.textContent = JSON.stringify(data, null, 2);

          if (!data.ok) {
            summary.innerHTML = "";
            warnings.innerHTML = '<div class="callout warn">' + (data.error || "Calculation failed.") + "</div>";
            candidateList.innerHTML = "";
            selectionGuide.classList.add("hidden");
            return;
          }

          renderSummary(data.quote);
          renderWarnings(data.quote);
          renderSelectionGuide(data.quote);
          renderCandidates(data.quote);
        } catch (error) {
          rawResponse.textContent = String(error);
        }
      }

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        await calculate();
      });

      form.elements.namedItem("brand").addEventListener("change", (event) => {
        applyPreset(event.target.value);
      });

      resetSample.addEventListener("click", () => {
        form.reset();
        form.elements.namedItem("brand").value = "AUDI";
        form.elements.namedItem("ownershipType").value = "company";
        form.elements.namedItem("leaseTermMonths").value = "36";
        form.elements.namedItem("annualMileageKm").value = "20000";
        applyPreset("AUDI");
      });

      applyPreset("AUDI");
      calculate();
    </script>
  </body>
</html>`;
}
