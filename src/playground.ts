import { mgResidualMatrixLookup } from "@/mg-catalog";

type PlaygroundCatalogBrand = {
  brand: string;
  modelCount: number;
};

type PlaygroundCatalogModel = {
  modelName: string;
  vehiclePrice: number;
  vehicleClass: string | null;
  engineDisplacementCc: number | null;
  highResidualAllowed: boolean | null;
  hybridAllowed: boolean | null;
  residualPromotionCode: string | null;
  snkResidualBand: string | null;
  residuals?: Partial<Record<12 | 24 | 36 | 48 | 60, number>>;
  snkResiduals?: Partial<Record<12 | 24 | 36 | 48 | 60, number>>;
  apsResidualBand?: string | null;
  apsResiduals?: Partial<Record<12 | 24 | 36 | 48 | 60, number>>;
  chatbotResiduals?: Partial<Record<12 | 24 | 36 | 48 | 60, number>>;
  apsPromotionRate?: number | null;
  snkPromotionRate?: number | null;
  maxResidualRates?: Partial<Record<12 | 24 | 36 | 48 | 60, number>>;
};

export function renderPlaygroundHtml() {
  const residualMatrixLookupJson = JSON.stringify(mgResidualMatrixLookup);
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>정밀 견적 터미널</title>
    <style>
      :root {
        --background: #f7f9fb;
        --surface: #ffffff;
        --surface-low: #f2f4f6;
        --surface-high: #e6e8ea;
        --surface-ink: #191c1e;
        --muted: #5f6670;
        --muted-soft: #7b838d;
        --primary: #041627;
        --primary-strong: #0d2236;
        --primary-container: #1a2b3c;
        --accent: #6ffbbe;
        --accent-strong: #0d8a62;
        --warning: #b26a00;
        --warning-soft: rgba(178, 106, 0, 0.12);
        --danger: #ba1a1a;
        --danger-soft: rgba(186, 26, 26, 0.1);
        --line: rgba(116, 119, 125, 0.18);
        --line-strong: rgba(116, 119, 125, 0.32);
        --shadow: 0 18px 60px rgba(4, 22, 39, 0.06);
        --shadow-float: 0 24px 80px rgba(4, 22, 39, 0.12);
        --radius: 10px;
        --radius-sm: 8px;
        --sidebar-width: 264px;
      }

      * {
        box-sizing: border-box;
      }

      html {
        scroll-behavior: smooth;
      }

      body {
        margin: 0;
        min-height: 100vh;
        background:
          radial-gradient(circle at top left, rgba(111, 251, 190, 0.08), transparent 24%),
          radial-gradient(circle at top right, rgba(26, 43, 60, 0.08), transparent 28%),
          linear-gradient(180deg, #fbfcfd 0%, var(--background) 100%);
        color: var(--surface-ink);
        font-family: "Pretendard", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 14px;
        line-height: 1.5;
      }

      button,
      input,
      select,
      textarea {
        font: inherit;
      }

      button {
        cursor: pointer;
      }

      a {
        color: inherit;
        text-decoration: none;
      }

      .shell {
        min-height: 100vh;
      }

      .sidebar {
        position: fixed;
        inset: 0 auto 0 0;
        width: var(--sidebar-width);
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.06), transparent 20%),
          linear-gradient(180deg, #07192b 0%, #04111d 100%);
        color: rgba(255, 255, 255, 0.92);
        display: flex;
        flex-direction: column;
        border-right: 1px solid rgba(255, 255, 255, 0.08);
        z-index: 20;
      }

      .brand {
        padding: 28px 24px 22px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }

      .brand-mark {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 14px;
      }

      .brand-badge {
        width: 38px;
        height: 38px;
        border-radius: 12px;
        background: linear-gradient(135deg, rgba(111, 251, 190, 0.26), rgba(111, 251, 190, 0.08));
        color: var(--accent);
        display: grid;
        place-items: center;
        font-weight: 800;
        letter-spacing: 0.08em;
      }

      .brand-title {
        font-size: 18px;
        font-weight: 800;
        letter-spacing: -0.03em;
      }

      .brand-subtitle {
        color: rgba(210, 228, 251, 0.7);
        font-size: 12px;
      }

      .nav {
        padding: 18px 12px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .nav-button {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 12px;
        border: 0;
        border-left: 3px solid transparent;
        border-radius: var(--radius-sm);
        padding: 12px 14px;
        background: transparent;
        color: rgba(255, 255, 255, 0.68);
        text-align: left;
        transition: 140ms ease;
      }

      .nav-button:hover {
        color: #fff;
        background: rgba(255, 255, 255, 0.06);
      }

      .nav-button.active {
        color: var(--accent);
        border-left-color: var(--accent);
        background: rgba(111, 251, 190, 0.08);
      }

      .nav-kicker {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.5);
      }

      .sidebar-foot {
        margin-top: auto;
        padding: 20px 18px 22px;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
      }

      .status-chip {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border-radius: 999px;
        padding: 6px 10px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.02em;
        background: rgba(111, 251, 190, 0.12);
        color: var(--accent);
      }

      .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 999px;
        background: currentColor;
      }

      .content {
        margin-left: var(--sidebar-width);
        min-height: 100vh;
      }

      .topbar {
        position: sticky;
        top: 0;
        z-index: 15;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 18px;
        padding: 18px 28px;
        backdrop-filter: blur(18px);
        background: rgba(247, 249, 251, 0.78);
        border-bottom: 1px solid rgba(116, 119, 125, 0.12);
      }

      .topbar-title {
        font-size: 22px;
        font-weight: 800;
        letter-spacing: -0.04em;
      }

      .topbar-subtitle {
        color: var(--muted);
        font-size: 13px;
      }

      .topbar-meta {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }

      .pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-height: 34px;
        padding: 7px 12px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.82);
        border: 1px solid rgba(116, 119, 125, 0.16);
        color: var(--muted);
        font-size: 12px;
        font-weight: 700;
      }

      .page {
        padding: 28px;
      }

      .section {
        display: none;
        animation: fade-up 180ms ease;
      }

      .section.active {
        display: block;
      }

      @keyframes fade-up {
        from {
          opacity: 0;
          transform: translateY(6px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .page-stack {
        display: flex;
        flex-direction: column;
        gap: 22px;
      }

      .hero-grid,
      .summary-grid,
      .dashboard-grid,
      .import-grid,
      .quote-grid,
      .debug-grid {
        display: grid;
        gap: 18px;
      }

      .hero-grid {
        grid-template-columns: 1.4fr 1fr;
      }

      .summary-grid {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }

      .dashboard-grid,
      .quote-grid {
        grid-template-columns: 1.1fr 0.9fr;
      }

      .import-grid,
      .debug-grid {
        grid-template-columns: 0.95fr 1.05fr;
      }

      .card {
        background: rgba(255, 255, 255, 0.82);
        border: 1px solid rgba(116, 119, 125, 0.14);
        border-radius: var(--radius);
        box-shadow: var(--shadow);
        overflow: hidden;
      }

      .card.hero {
        background:
          linear-gradient(135deg, rgba(4, 22, 39, 0.98), rgba(26, 43, 60, 0.92));
        color: white;
        position: relative;
      }

      .card.hero::after {
        content: "";
        position: absolute;
        inset: auto -80px -80px auto;
        width: 240px;
        height: 240px;
        border-radius: 999px;
        background: radial-gradient(circle, rgba(111, 251, 190, 0.18), transparent 62%);
      }

      .card-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        padding: 18px 18px 12px;
      }

      .card-body {
        padding: 0 18px 18px;
      }

      .hero-body {
        padding: 24px;
        position: relative;
        z-index: 1;
      }

      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border-radius: 999px;
        padding: 6px 10px;
        background: rgba(111, 251, 190, 0.12);
        color: var(--accent);
        font-size: 11px;
        font-weight: 700;
      }

      h1,
      h2,
      h3,
      h4 {
        margin: 0;
        letter-spacing: -0.03em;
      }

      .hero-title {
        margin-top: 18px;
        font-size: clamp(28px, 4vw, 44px);
        line-height: 1.02;
        font-weight: 800;
      }

      .hero-copy {
        margin-top: 12px;
        max-width: 700px;
        color: rgba(255, 255, 255, 0.74);
        font-size: 15px;
      }

      .hero-metrics {
        margin-top: 22px;
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
      }

      .hero-metric {
        padding: 14px;
        border-radius: var(--radius-sm);
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.08);
      }

      .hero-metric-label,
      .label,
      .table-label {
        color: var(--muted-soft);
        font-size: 11px;
        font-weight: 700;
      }

      .card.hero .hero-metric-label {
        color: rgba(255, 255, 255, 0.62);
      }

      .hero-metric-value {
        margin-top: 6px;
        font-size: 22px;
        font-weight: 800;
      }

      .card-title {
        font-size: 17px;
        font-weight: 800;
      }

      .card-subtitle {
        color: var(--muted);
        font-size: 12px;
        margin-top: 3px;
      }

      .stat-card {
        padding: 18px;
      }

      .stat-value {
        margin-top: 10px;
        font-size: 28px;
        font-weight: 800;
        letter-spacing: -0.04em;
      }

      .stat-foot {
        margin-top: 10px;
        color: var(--muted);
        font-size: 12px;
      }

      .toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        min-height: 40px;
        border-radius: 10px;
        border: 1px solid transparent;
        padding: 0 14px;
        background: var(--surface);
        color: var(--surface-ink);
        font-weight: 700;
        letter-spacing: -0.01em;
        transition: 140ms ease;
      }

      .btn:hover {
        transform: translateY(-1px);
      }

      .btn-primary {
        background: var(--primary);
        color: white;
      }

      .btn-primary:hover {
        background: var(--primary-strong);
      }

      .btn-secondary {
        border-color: rgba(116, 119, 125, 0.16);
        background: rgba(255, 255, 255, 0.7);
      }

      .btn-tonal {
        background: rgba(111, 251, 190, 0.14);
        color: #0d6f50;
        border-color: rgba(111, 251, 190, 0.24);
      }

      .btn-danger {
        background: var(--danger-soft);
        color: var(--danger);
        border-color: rgba(186, 26, 26, 0.18);
      }

      .table-wrap {
        overflow: auto;
      }

      table {
        width: 100%;
        border-collapse: collapse;
      }

      th,
      td {
        padding: 12px 14px;
        text-align: left;
        vertical-align: top;
        border-bottom: 1px solid rgba(116, 119, 125, 0.12);
      }

      th {
        position: sticky;
        top: 0;
        background: rgba(242, 244, 246, 0.92);
        backdrop-filter: blur(12px);
        font-size: 11px;
        color: var(--muted);
        font-weight: 800;
      }

      td {
        font-size: 13px;
      }

      .mono,
      .tabular {
        font-variant-numeric: tabular-nums;
        font-feature-settings: "tnum";
      }

      .mono {
        font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
      }

      .kpi-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }

      .mini-card {
        padding: 14px;
        border-radius: 10px;
        background: var(--surface-low);
      }

      .mini-value {
        margin-top: 6px;
        font-size: 20px;
        font-weight: 800;
      }

      .list {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .list-row {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 12px;
        padding: 14px;
        border-radius: 10px;
        background: var(--surface-low);
      }

      .list-title {
        font-weight: 700;
      }

      .list-subtitle {
        color: var(--muted);
        font-size: 12px;
        margin-top: 3px;
      }

      .badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 9px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 700;
        white-space: nowrap;
      }

      .badge.success {
        background: rgba(111, 251, 190, 0.14);
        color: #0d6f50;
      }

      .badge.warning {
        background: var(--warning-soft);
        color: var(--warning);
      }

      .badge.neutral {
        background: rgba(4, 22, 39, 0.08);
        color: var(--primary);
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

      .field.span-2 {
        grid-column: 1 / -1;
      }

      .field label {
        font-size: 11px;
        font-weight: 800;
        color: var(--muted);
      }

      .input,
      .select,
      .textarea {
        width: 100%;
        min-height: 44px;
        border-radius: 10px;
        border: 1px solid rgba(116, 119, 125, 0.18);
        background: rgba(255, 255, 255, 0.86);
        padding: 11px 12px;
        color: var(--surface-ink);
        transition: 120ms ease;
      }

      .textarea {
        min-height: 120px;
        resize: vertical;
      }

      .input:focus,
      .select:focus,
      .textarea:focus {
        outline: none;
        border-color: rgba(4, 22, 39, 0.34);
        box-shadow: 0 0 0 4px rgba(4, 22, 39, 0.06);
      }

      .form-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 18px;
      }

      .inline-hint {
        color: var(--muted);
        font-size: 12px;
      }

      .result-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }

      .result-card {
        padding: 14px;
        border-radius: 10px;
        background: var(--surface-low);
      }

      .result-card.primary {
        grid-column: 1 / -1;
        background: linear-gradient(135deg, rgba(4, 22, 39, 0.96), rgba(26, 43, 60, 0.92));
        color: white;
      }

      .result-card.primary .label {
        color: rgba(255, 255, 255, 0.58);
      }

      .result-value {
        margin-top: 8px;
        font-size: 22px;
        font-weight: 800;
        letter-spacing: -0.03em;
      }

      .result-card.primary .result-value {
        font-size: 34px;
        color: var(--accent);
      }

      .callout {
        padding: 14px;
        border-radius: 10px;
        background: var(--surface-low);
        border: 1px solid rgba(116, 119, 125, 0.12);
      }

      .callout.warning {
        background: var(--warning-soft);
        border-color: rgba(178, 106, 0, 0.22);
      }

      .callout.danger {
        background: var(--danger-soft);
        border-color: rgba(186, 26, 26, 0.2);
      }

      .candidate-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .candidate-card {
        padding: 14px;
        border-radius: 10px;
        background: var(--surface-low);
        border: 1px solid rgba(116, 119, 125, 0.12);
      }

      .candidate-top {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: start;
      }

      .candidate-title {
        font-size: 15px;
        font-weight: 800;
      }

      .candidate-meta {
        margin-top: 8px;
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
      }

      .candidate-meta .mini-card {
        background: rgba(255, 255, 255, 0.7);
      }

      .json {
        margin: 0;
        padding: 16px;
        min-height: 320px;
        max-height: 620px;
        overflow: auto;
        border-radius: 10px;
        background: #06111e;
        color: #dde6f0;
        font-size: 12px;
        line-height: 1.55;
      }

      .split {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }

      .catalog-list {
        display: grid;
        gap: 10px;
        max-height: 360px;
        overflow: auto;
      }

      .catalog-brand {
        padding: 12px 14px;
        border-radius: 10px;
        background: var(--surface-low);
      }

      .catalog-brand-title {
        font-weight: 800;
      }

      .catalog-models {
        margin-top: 6px;
        color: var(--muted);
        font-size: 12px;
        line-height: 1.6;
      }

      .empty-state {
        padding: 20px;
        border-radius: 10px;
        background: var(--surface-low);
        color: var(--muted);
      }

      .hidden {
        display: none !important;
      }

      .auto-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 12px;
        margin: 0 0 18px;
      }

      .auto-card {
        padding: 14px;
        border-radius: 10px;
        background: var(--surface-low);
      }

      .auto-value {
        margin-top: 8px;
        font-size: 18px;
        font-weight: 800;
        letter-spacing: -0.02em;
      }

      .quote-sheet {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .sheet-block {
        border: 1px solid rgba(116, 119, 125, 0.14);
        border-radius: 12px;
        overflow: hidden;
        background: rgba(255, 255, 255, 0.74);
      }

      .sheet-block-title {
        padding: 12px 14px;
        background: linear-gradient(180deg, rgba(4, 22, 39, 0.94), rgba(13, 34, 54, 0.94));
        color: white;
        font-size: 13px;
        font-weight: 800;
        letter-spacing: -0.02em;
      }

      .sheet-grid {
        display: grid;
        grid-template-columns: 148px minmax(0, 1fr) 148px minmax(0, 1fr);
      }

      .sheet-label,
      .sheet-value {
        min-height: 48px;
        display: flex;
        align-items: center;
        padding: 10px 12px;
        border-right: 1px solid rgba(116, 119, 125, 0.12);
        border-bottom: 1px solid rgba(116, 119, 125, 0.12);
      }

      .sheet-label {
        background: #0c2034;
        color: rgba(255, 255, 255, 0.92);
        font-size: 12px;
        font-weight: 800;
      }

      .sheet-value {
        background: rgba(255, 251, 220, 0.38);
      }

      .sheet-value:last-child {
        border-right: 0;
      }

      .sheet-grid > *:nth-child(4n) {
        border-right: 0;
      }

      .sheet-field {
        width: 100%;
        min-height: 34px;
        border: 1px solid rgba(116, 119, 125, 0.18);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.86);
        padding: 7px 10px;
        color: var(--surface-ink);
      }

      .sheet-field.readonly {
        background: rgba(245, 247, 249, 0.9);
      }

      .sheet-inline {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
      }

      .sheet-inline .sheet-field {
        flex: 1;
      }

      .sheet-help {
        display: block;
        margin-top: 6px;
        color: var(--muted);
        font-size: 11px;
      }

      .sheet-note {
        padding: 10px 14px 14px;
        color: var(--muted);
        font-size: 12px;
      }

      .sheet-source-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
        padding: 0 14px 14px;
      }

      .sheet-source-card {
        border: 1px solid rgba(116, 119, 125, 0.16);
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.82);
        padding: 10px 12px;
      }

      .sheet-source-card.warn {
        border-color: rgba(178, 106, 0, 0.32);
        background: rgba(178, 106, 0, 0.08);
      }

      .sheet-source-label {
        color: var(--muted);
        font-size: 11px;
        margin-bottom: 4px;
      }

      .sheet-source-value {
        font-size: 15px;
        font-weight: 800;
        letter-spacing: -0.02em;
      }

      .advanced-panel {
        border: 1px dashed rgba(116, 119, 125, 0.24);
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.68);
      }

      .advanced-panel summary {
        cursor: pointer;
        list-style: none;
        padding: 14px 16px;
        font-weight: 800;
      }

      .advanced-panel summary::-webkit-details-marker {
        display: none;
      }

      .advanced-body {
        padding: 0 16px 16px;
      }

      @media (max-width: 1280px) {
        .summary-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .hero-grid,
        .dashboard-grid,
        .quote-grid,
        .import-grid,
        .debug-grid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 960px) {
        :root {
          --sidebar-width: 100%;
        }

        .sidebar {
          position: static;
          width: 100%;
          height: auto;
        }

        .content {
          margin-left: 0;
        }

        .topbar {
          position: static;
        }

        .page {
          padding: 18px;
        }

        .summary-grid,
        .hero-metrics,
        .form-grid,
        .auto-grid,
        .result-grid,
        .split,
        .candidate-meta,
        .sheet-grid {
          grid-template-columns: 1fr;
        }

        .sheet-label,
        .sheet-value {
          border-right: 0;
        }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-mark">
            <div class="brand-badge">DL</div>
            <div>
              <div class="brand-title">도림 자동차 견적 해결표</div>
              <div class="brand-subtitle">Precision Ledger · 한국어 운영 콘솔</div>
            </div>
          </div>
          <div class="nav-kicker">월별 워크북 업로드부터 잔가 선택형 견적 계산까지 한 화면에서 검증합니다.</div>
        </div>

        <nav class="nav">
          <button class="nav-button active" data-target="dashboard" type="button">대시보드</button>
          <button class="nav-button" data-target="quotes" type="button">견적 계산</button>
          <button class="nav-button" data-target="imports" type="button">워크북 업로드</button>
          <button class="nav-button" data-target="debug" type="button">디버그</button>
        </nav>

        <div class="sidebar-foot">
          <div class="status-chip">
            <span class="status-dot"></span>
            MG 캐피탈 운용리스 백엔드 연결됨
          </div>
        </div>
      </aside>

      <div class="content">
        <header class="topbar">
          <div>
            <div class="topbar-title">한글 운영 화면 프리뷰</div>
            <div class="topbar-subtitle">현재 스택에 맞춘 서버 렌더링 UI입니다. 계산 API와 업로드 API를 직접 호출합니다.</div>
          </div>
          <div class="topbar-meta">
            <div class="pill" id="env-pill">환경 확인 중</div>
            <div class="pill" id="version-pill">활성 버전 조회 중</div>
          </div>
        </header>

        <main class="page">
          <div class="page-stack">
            <section class="section active" data-section="dashboard">
              <div class="page-stack">
                <div class="hero-grid">
                  <article class="card hero">
                    <div class="hero-body">
                      <div class="eyebrow">운영형 자동차 금융 플랫폼</div>
                      <h1 class="hero-title">각 금융사 워크북을 웹 계산기로 연결하는 한글 업무 화면</h1>
                      <div class="hero-copy">
                        MG캐피탈 월별 엑셀 정책을 업로드하고, 활성 버전을 기준으로 운용리스 견적을 계산하고,
                        hidden residual 후보를 사용자 확인형 UX로 검증할 수 있도록 구성했습니다.
                      </div>
                      <div class="hero-metrics">
                        <div class="hero-metric">
                          <div class="hero-metric-label">현재 구현 상품</div>
                          <div class="hero-metric-value">운용리스</div>
                        </div>
                        <div class="hero-metric">
                          <div class="hero-metric-label">활성 금융사</div>
                          <div class="hero-metric-value" id="hero-lender-count">1</div>
                        </div>
                        <div class="hero-metric">
                          <div class="hero-metric-label">업로드 이력</div>
                          <div class="hero-metric-value" id="hero-import-count">0</div>
                        </div>
                      </div>
                    </div>
                  </article>

                  <article class="card">
                    <div class="card-head">
                      <div>
                        <h2 class="card-title">빠른 액션</h2>
                        <div class="card-subtitle">지금 바로 로컬에서 확인할 핵심 흐름</div>
                      </div>
                    </div>
                    <div class="card-body">
                      <div class="toolbar">
                        <button class="btn btn-primary" data-target-jump="quotes" type="button">견적 계산 테스트</button>
                        <button class="btn btn-secondary" data-target-jump="imports" type="button">워크북 미리보기</button>
                        <button class="btn btn-tonal" id="refresh-dashboard" type="button">상태 새로고침</button>
                      </div>
                      <div class="list" style="margin-top: 16px">
                        <div class="list-row">
                          <div>
                            <div class="list-title">잔가 후보 선택 UX</div>
                            <div class="list-subtitle">selectionGuide와 candidateSummary를 한국어 운영 화면으로 노출</div>
                          </div>
                          <div class="badge success">연결됨</div>
                        </div>
                        <div class="list-row">
                          <div>
                            <div class="list-title">워크북 업로드 및 활성화</div>
                            <div class="list-subtitle">preview와 persist를 같은 화면에서 검증</div>
                          </div>
                          <div class="badge neutral">로컬 가능</div>
                        </div>
                        <div class="list-row">
                          <div>
                            <div class="list-title">Cloudflare Pages Functions 호환</div>
                            <div class="list-subtitle">정적 빌드 없이 Functions 경로에서 바로 렌더링</div>
                          </div>
                          <div class="badge neutral">현재 구조 유지</div>
                        </div>
                      </div>
                    </div>
                  </article>
                </div>

                <div class="summary-grid">
                  <article class="card stat-card">
                    <div class="label">시스템 상태</div>
                    <div class="stat-value" id="health-status">확인 중</div>
                    <div class="stat-foot" id="health-subtext">/health 응답 대기</div>
                  </article>
                  <article class="card stat-card">
                    <div class="label">최근 활성 버전</div>
                    <div class="stat-value" id="active-version">미확인</div>
                    <div class="stat-foot" id="active-version-subtext">업로드 이력 조회 대기</div>
                  </article>
                  <article class="card stat-card">
                    <div class="label">등록된 금융사</div>
                    <div class="stat-value" id="lender-count">0</div>
                    <div class="stat-foot">현재 API가 반환하는 lender 목록 기준</div>
                  </article>
                  <article class="card stat-card">
                    <div class="label">업로드 누적 건수</div>
                    <div class="stat-value" id="import-count">0</div>
                    <div class="stat-foot">Supabase 기준 workbook import rows</div>
                  </article>
                </div>

                <div class="dashboard-grid">
                  <article class="card">
                    <div class="card-head">
                      <div>
                        <h2 class="card-title">최근 워크북 이력</h2>
                        <div class="card-subtitle">활성 버전과 최근 반영 기록을 빠르게 읽습니다.</div>
                      </div>
                    </div>
                    <div class="card-body table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>버전</th>
                            <th>파일명</th>
                            <th>상태</th>
                            <th>업로드 시각</th>
                          </tr>
                        </thead>
                        <tbody id="imports-table-body">
                          <tr>
                            <td colspan="4" class="inline-hint">아직 데이터를 불러오지 않았습니다.</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </article>

                  <article class="card">
                    <div class="card-head">
                      <div>
                        <h2 class="card-title">현재 연결 상황</h2>
                        <div class="card-subtitle">실제 API 기준으로 프론트 연결 상태를 요약합니다.</div>
                      </div>
                    </div>
                    <div class="card-body">
                      <div class="kpi-grid">
                        <div class="mini-card">
                          <div class="label">활성 금융사</div>
                          <div class="mini-value" id="dashboard-lender-name">MG Capital</div>
                        </div>
                        <div class="mini-card">
                          <div class="label">기본 상품</div>
                          <div class="mini-value">운용리스</div>
                        </div>
                        <div class="mini-card">
                          <div class="label">잔가 선택 UX</div>
                          <div class="mini-value">사용자 확인형</div>
                        </div>
                        <div class="mini-card">
                          <div class="label">프론트 방식</div>
                          <div class="mini-value">서버 렌더링</div>
                        </div>
                        <div class="mini-card">
                          <div class="label">브랜드 수</div>
                          <div class="mini-value" id="catalog-brand-count">0</div>
                        </div>
                        <div class="mini-card">
                          <div class="label">모델 수</div>
                          <div class="mini-value" id="catalog-model-count">0</div>
                        </div>
                      </div>
                    </div>
                  </article>
                </div>
              </div>
            </section>

            <section class="section" data-section="quotes">
              <div class="page-stack">
                <div class="quote-grid">
                  <article class="card">
                    <div class="card-head">
                      <div>
                        <h2 class="card-title">견적 입력</h2>
                        <div class="card-subtitle">엑셀 견적 시트와 같은 항목 이름과 흐름으로 맞춘 입력 화면입니다.</div>
                      </div>
                    </div>
                    <div class="card-body">
                      <form id="quote-form">
                        <div class="quote-sheet">
                          <div class="sheet-block">
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
                          </div>

                          <div class="sheet-block">
                            <div class="sheet-block-title">계약 및 부대비용</div>
                            <div class="sheet-grid">
                              <div class="sheet-label">차량명의</div>
                              <div class="sheet-value">
                                <select class="sheet-field" id="ownershipType" name="ownershipType">
                                  <option value="company">법인</option>
                                  <option value="customer">고객명의</option>
                                </select>
                              </div>
                              <div class="sheet-label">공채</div>
                              <div class="sheet-value">
                                <div class="sheet-inline">
                                  <label class="sheet-check"><input id="includePublicBondCost" name="includePublicBondCost" type="checkbox" checked /> 포함</label>
                                  <input class="sheet-field tabular" id="publicBondCost" name="publicBondCost" type="number" value="0" />
                                </div>
                              </div>

                              <div class="sheet-label">리스기간(개월)</div>
                              <div class="sheet-value">
                                <select class="sheet-field" id="leaseTermMonths" name="leaseTermMonths">
                                  <option value="12">12</option>
                                  <option value="24">24</option>
                                  <option value="36" selected>36</option>
                                  <option value="48">48</option>
                                  <option value="60">60</option>
                                </select>
                              </div>
                              <div class="sheet-label">장기선수금</div>
                              <div class="sheet-value">
                                <input class="sheet-field tabular" id="upfrontPayment" name="upfrontPayment" type="number" value="0" />
                              </div>

                              <div class="sheet-label">보증금</div>
                              <div class="sheet-value">
                                <input class="sheet-field tabular" id="depositAmount" name="depositAmount" type="number" value="0" />
                              </div>
                              <div class="sheet-label">약정주행거리</div>
                              <div class="sheet-value">
                                <select class="sheet-field" id="annualMileageKm" name="annualMileageKm">
                                  <option value="10000">10,000km</option>
                                  <option value="20000" selected>20,000km</option>
                                  <option value="30000">30,000km</option>
                                  <option value="35000">35,000km</option>
                                </select>
                              </div>

                              <div class="sheet-label">취득세율</div>
                              <div class="sheet-value">
                                <input class="sheet-field tabular" id="acquisitionTaxRateOverride" name="acquisitionTaxRateOverride" type="number" step="0.0001" value="0.07" />
                              </div>
                              <div class="sheet-label">취득세</div>
                              <div class="sheet-value">
                                <input class="sheet-field readonly tabular" id="sheet-acquisition-tax-amount" type="text" readonly value="-" />
                              </div>

                              <div class="sheet-label">기타부대비</div>
                              <div class="sheet-value">
                                <div class="sheet-inline">
                                  <label class="sheet-check"><input id="includeMiscFeeAmount" name="includeMiscFeeAmount" type="checkbox" checked /> 포함</label>
                                  <input class="sheet-field tabular" id="miscFeeAmount" name="miscFeeAmount" type="number" value="0" />
                                </div>
                              </div>
                              <div class="sheet-label">탁송료</div>
                              <div class="sheet-value">
                                <div class="sheet-inline">
                                  <label class="sheet-check"><input id="includeDeliveryFeeAmount" name="includeDeliveryFeeAmount" type="checkbox" checked /> 포함</label>
                                  <input class="sheet-field tabular" id="deliveryFeeAmount" name="deliveryFeeAmount" type="number" value="0" />
                                </div>
                              </div>

                              <div class="sheet-label">자동차세</div>
                              <div class="sheet-value">
                                <input class="sheet-field readonly" id="sheet-car-tax" type="text" readonly value="미포함" />
                              </div>
                              <div class="sheet-label">보험료(年)</div>
                              <div class="sheet-value">
                                <input class="sheet-field tabular" id="insuranceYearlyAmount" name="insuranceYearlyAmount" type="number" value="0" />
                              </div>

                              <div class="sheet-label">이손액(수입수수료)</div>
                              <div class="sheet-value">
                                <input class="sheet-field tabular" id="lossDamageAmount" name="lossDamageAmount" type="number" value="0" />
                              </div>
                              <div class="sheet-label">영업담당자</div>
                              <div class="sheet-value">
                                <input class="sheet-field readonly" id="sheet-sales-owner" type="text" readonly value="-" />
                              </div>

                              <div class="sheet-label">부가서비스</div>
                              <div class="sheet-value">
                                <input class="sheet-field readonly" id="sheet-extra-service" type="text" readonly value="-" />
                              </div>
                              <div class="sheet-label">보증금률 표시기준</div>
                              <div class="sheet-value">
                                <input class="sheet-field readonly" id="sheet-deposit-basis" type="text" readonly value="차량가 기준" />
                              </div>
                            </div>
                          </div>

                          <div class="sheet-block">
                            <div class="sheet-block-title">잔가 및 금리</div>
                            <div class="sheet-grid">
                              <div class="sheet-label">최종 잔가율(BK27)</div>
                              <div class="sheet-value">
                                <input class="sheet-field tabular" id="selectedResidualRateOverride" name="selectedResidualRateOverride" type="text" inputmode="decimal" placeholder="예: 52 또는 52.5" />
                                <span class="sheet-help">선택하지 않으면 후보 잔가 기준으로 계산합니다.</span>
                              </div>
                              <div class="sheet-label">적용 잔가율</div>
                              <div class="sheet-value">
                                <input class="sheet-field readonly tabular" id="sheet-applied-residual-rate" type="text" readonly value="-" />
                              </div>

                              <div class="sheet-label">최소잔가</div>
                              <div class="sheet-value">
                                <input class="sheet-field readonly tabular" id="sheet-min-residual-rate" type="text" readonly value="-" />
                              </div>
                              <div class="sheet-label">최대잔가</div>
                              <div class="sheet-value">
                                <input class="sheet-field readonly tabular" id="sheet-max-residual-rate" type="text" readonly value="-" />
                              </div>

                              <div class="sheet-label">잔가금액</div>
                              <div class="sheet-value">
                                <input class="sheet-field readonly tabular" id="sheet-residual-amount" type="text" readonly value="-" />
                              </div>
                              <div class="sheet-label">적용금리</div>
                              <div class="sheet-value">
                                <input class="sheet-field tabular" id="annualIrrRateOverride" name="annualIrrRateOverride" type="text" inputmode="decimal" placeholder="자동 반영" />
                                <span class="sheet-help" id="annual-rate-help">비워두면 현재 정책 기준 금리를 자동 적용합니다.</span>
                              </div>

                              <div class="sheet-label">고잔가</div>
                              <div class="sheet-value">
                                <input class="sheet-field readonly" id="sheet-high-residual" type="text" readonly value="-" />
                              </div>
                              <div class="sheet-label">프로모션</div>
                              <div class="sheet-value">
                                <input class="sheet-field readonly" id="sheet-promo-code" type="text" readonly value="-" />
                              </div>

                              <div class="sheet-label">AG수수료율</div>
                              <div class="sheet-value">
                                <input class="sheet-field tabular" id="agFeeRate" name="agFeeRate" type="text" inputmode="decimal" value="0%" />
                              </div>
                              <div class="sheet-label">CM수수료율</div>
                              <div class="sheet-value">
                                <input class="sheet-field tabular" id="cmFeeRate" name="cmFeeRate" type="text" inputmode="decimal" value="0%" />
                              </div>

                              <div class="sheet-label">인지세</div>
                              <div class="sheet-value">
                                <input class="sheet-field tabular" id="stampDuty" name="stampDuty" type="number" value="" placeholder="자동(10,000)" />
                              </div>
                              <div class="sheet-label">잔가금액 override</div>
                              <div class="sheet-value">
                                <input class="sheet-field tabular" id="residualAmountOverride" name="residualAmountOverride" type="number" placeholder="예: 24360000" />
                              </div>
                            </div>
                          </div>

                          <details class="advanced-panel">
                            <summary>고급 override 열기</summary>
                            <div class="advanced-body">
                              <div class="form-grid">
                                <div class="field">
                                  <label for="annualEffectiveRateOverride">유효 IRR override</label>
                                  <input class="input tabular" id="annualEffectiveRateOverride" name="annualEffectiveRateOverride" type="number" step="0.000001" />
                                </div>
                                <div class="field">
                                  <label for="paymentRateOverride">월 납입률 override</label>
                                  <input class="input tabular" id="paymentRateOverride" name="paymentRateOverride" type="number" step="0.00001" />
                                </div>
                              </div>
                            </div>
                          </details>
                        </div>
                        <div class="form-actions">
                          <button class="btn btn-secondary" id="reset-workbook-defaults" type="button">엑셀 기본값 적용</button>
                          <button class="btn btn-primary" id="quote-submit-button" type="button">견적 계산</button>
                          <button class="btn btn-secondary" id="reset-selected-residual" type="button">잔가 선택값 지우기</button>
                        </div>
                        <div class="callout warning hidden" id="workbook-diff-warning" style="margin-top: 10px"></div>
                        <div class="inline-hint" id="quote-submit-status" style="margin-top: 10px">입력값을 바꾸면 자동으로 재계산되고, 버튼으로도 즉시 계산할 수 있습니다.</div>
                      </form>
                    </div>
                  </article>

                  <div class="page-stack">
                    <article class="card">
                      <div class="card-head">
                        <div>
                          <h2 class="card-title">활성 카탈로그</h2>
                          <div class="card-subtitle">현재 활성 워크북에 들어 있는 전체 브랜드와 모델 목록입니다.</div>
                        </div>
                      </div>
                      <div class="card-body">
                        <div class="split">
                          <div class="mini-card">
                            <div class="label">브랜드 수</div>
                            <div class="mini-value" id="quote-catalog-brand-count">0</div>
                          </div>
                          <div class="mini-card">
                            <div class="label">모델 수</div>
                            <div class="mini-value" id="quote-catalog-model-count">0</div>
                          </div>
                        </div>
                        <div class="catalog-list" id="catalog-list" style="margin-top: 14px">
                          <div class="empty-state">카탈로그를 불러오는 중입니다.</div>
                        </div>
                      </div>
                    </article>

                    <article class="card">
                      <div class="card-head">
                        <div>
                          <h2 class="card-title">견적 결과</h2>
                          <div class="card-subtitle">월 납입금, 잔가, 금리 정보를 즉시 확인합니다.</div>
                        </div>
                      </div>
                      <div class="card-body">
                        <div class="result-grid" id="quote-summary">
                          <div class="empty-state">아직 계산 결과가 없습니다. 왼쪽에서 값을 입력하고 견적 계산을 눌러주세요.</div>
                        </div>
                      </div>
                    </article>

                    <article class="card">
                      <div class="card-head">
                        <div>
                          <h2 class="card-title">잔가 후보 선택</h2>
                          <div class="card-subtitle">BK27 성격의 최종 선택값을 웹에서 다루는 영역입니다.</div>
                        </div>
                      </div>
                      <div class="card-body">
                        <div id="selection-guide" class="callout hidden"></div>
                        <div id="quote-warnings" class="page-stack"></div>
                        <div id="candidate-list" class="candidate-list"></div>
                      </div>
                    </article>
                  </div>
                </div>
              </div>
            </section>

            <section class="section" data-section="imports">
              <div class="page-stack">
                <div class="import-grid">
                  <article class="card">
                    <div class="card-head">
                      <div>
                        <h2 class="card-title">워크북 업로드</h2>
                        <div class="card-subtitle">실제 preview/import API를 사용합니다.</div>
                      </div>
                    </div>
                    <div class="card-body">
                      <form id="import-form">
                        <div class="form-grid">
                          <div class="field">
                            <label for="import-lender-code">금융사 코드</label>
                            <select class="select" id="import-lender-code" name="lenderCode">
                              <option value="mg-capital">mg-capital</option>
                            </select>
                          </div>
                          <div class="field">
                            <label for="activate-import">업로드 후 활성화</label>
                            <select class="select" id="activate-import" name="activate">
                              <option value="true">예</option>
                              <option value="false">아니오</option>
                            </select>
                          </div>
                          <div class="field span-2">
                            <label for="workbook-file">엑셀 파일</label>
                            <input class="input" id="workbook-file" name="file" type="file" accept=".xlsx,.xlsm,.xls" />
                            <div class="inline-hint">preview는 DB 저장 없이 파싱만 확인하고, import는 실제 Supabase에 저장합니다.</div>
                          </div>
                        </div>
                        <div class="form-actions">
                          <button class="btn btn-secondary" id="preview-import" type="button">미리보기</button>
                          <button class="btn btn-primary" id="commit-import" type="button">업로드 및 저장</button>
                        </div>
                      </form>
                    </div>
                  </article>

                  <article class="card">
                    <div class="card-head">
                      <div>
                        <h2 class="card-title">워크북 분석 결과</h2>
                        <div class="card-subtitle">sheet, 차량 수, 정책 수, anomaly를 운영자 관점으로 표시합니다.</div>
                      </div>
                    </div>
                    <div class="card-body">
                      <div class="split">
                        <div class="mini-card">
                          <div class="label">탐지된 버전</div>
                          <div class="mini-value" id="preview-version">대기 중</div>
                        </div>
                        <div class="mini-card">
                          <div class="label">시트 수</div>
                          <div class="mini-value" id="preview-sheet-count">0</div>
                        </div>
                        <div class="mini-card">
                          <div class="label">차량 프로그램 수</div>
                          <div class="mini-value" id="preview-vehicle-count">0</div>
                        </div>
                        <div class="mini-card">
                          <div class="label">잔가 매트릭스 수</div>
                          <div class="mini-value" id="preview-matrix-count">0</div>
                        </div>
                      </div>
                      <div class="page-stack" style="margin-top: 14px">
                        <div id="preview-status" class="callout">아직 미리보기 결과가 없습니다.</div>
                        <pre class="json" id="preview-json">{}</pre>
                      </div>
                    </div>
                  </article>
                </div>
              </div>
            </section>

            <section class="section" data-section="debug">
              <div class="page-stack">
                <div class="debug-grid">
                  <article class="card">
                    <div class="card-head">
                      <div>
                        <h2 class="card-title">운영 디버그 패널</h2>
                        <div class="card-subtitle">selectionGuide, candidate summary, import response를 한 번에 검토합니다.</div>
                      </div>
                    </div>
                    <div class="card-body">
                      <div class="list">
                        <div class="list-row">
                          <div>
                            <div class="list-title">BK27 성격</div>
                            <div class="list-subtitle">현재 구현은 workbook 최종 선택값을 사용자 입력형 override로 취급합니다.</div>
                          </div>
                          <div class="badge warning">중요</div>
                        </div>
                        <div class="list-row">
                          <div>
                            <div class="list-title">candidateSummary</div>
                            <div class="list-subtitle">SNK / APS / 차봇 후보 잔가율을 함께 노출해 UI가 직접 선택할 수 있게 합니다.</div>
                          </div>
                          <div class="badge success">연결됨</div>
                        </div>
                        <div class="list-row">
                          <div>
                            <div class="list-title">Cloudflare Pages 적합성</div>
                            <div class="list-subtitle">서버 렌더링 HTML이라 추가 프런트 빌드 없이 Functions에서 그대로 동작합니다.</div>
                          </div>
                          <div class="badge neutral">유지 쉬움</div>
                        </div>
                      </div>
                    </div>
                  </article>

                  <article class="card">
                    <div class="card-head">
                      <div>
                        <h2 class="card-title">마지막 API 응답</h2>
                        <div class="card-subtitle">견적 계산 또는 업로드 응답 전체를 그대로 확인합니다.</div>
                      </div>
                    </div>
                    <div class="card-body">
                      <pre class="json" id="raw-response">{}</pre>
                    </div>
                  </article>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>

    <script>
      const residualMatrixLookup = ${residualMatrixLookupJson};
      const navButtons = Array.from(document.querySelectorAll('.nav-button'));
      const initialBrands = [];
      const sections = Array.from(document.querySelectorAll('.section'));
      const jumpButtons = Array.from(document.querySelectorAll('[data-target-jump]'));

      const envPill = document.getElementById('env-pill');
      const versionPill = document.getElementById('version-pill');
      const heroLenderCount = document.getElementById('hero-lender-count');
      const heroImportCount = document.getElementById('hero-import-count');
      const healthStatus = document.getElementById('health-status');
      const healthSubtext = document.getElementById('health-subtext');
      const activeVersion = document.getElementById('active-version');
      const activeVersionSubtext = document.getElementById('active-version-subtext');
      const lenderCount = document.getElementById('lender-count');
      const importCount = document.getElementById('import-count');
      const importsTableBody = document.getElementById('imports-table-body');
      const dashboardLenderName = document.getElementById('dashboard-lender-name');
      const catalogBrandCount = document.getElementById('catalog-brand-count');
      const catalogModelCount = document.getElementById('catalog-model-count');

      const quoteForm = document.getElementById('quote-form');
      const brandSelect = document.getElementById('brand');
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
      const optionAmountDisplay = document.getElementById('optionAmountDisplay');
      const discountedVehiclePriceDisplay = document.getElementById('discountedVehiclePriceDisplay');
      const sheetAcquisitionTaxAmount = document.getElementById('sheet-acquisition-tax-amount');
      const sheetAppliedResidualRate = document.getElementById('sheet-applied-residual-rate');
      const sheetMinResidualRate = document.getElementById('sheet-min-residual-rate');
      const sheetMaxResidualRate = document.getElementById('sheet-max-residual-rate');
      const sheetResidualAmount = document.getElementById('sheet-residual-amount');
      const annualIrrRateInput = document.getElementById('annualIrrRateOverride');
      const annualRateHelp = document.getElementById('annual-rate-help');
      const sheetHighResidual = document.getElementById('sheet-high-residual');
      const sheetPromoCode = document.getElementById('sheet-promo-code');
      const miscFeeAmountInput = document.getElementById('miscFeeAmount');
      const deliveryFeeAmountInput = document.getElementById('deliveryFeeAmount');
      const sheetCarTax = document.getElementById('sheet-car-tax');
      const insuranceYearlyAmountInput = document.getElementById('insuranceYearlyAmount');
      const sheetExtraService = document.getElementById('sheet-extra-service');
      const sheetSalesOwner = document.getElementById('sheet-sales-owner');
      const sheetDepositBasis = document.getElementById('sheet-deposit-basis');
      const lossDamageAmountInput = document.getElementById('lossDamageAmount');
      const agFeeRateInput = document.getElementById('agFeeRate');
      const cmFeeRateInput = document.getElementById('cmFeeRate');
      const quoteCatalogBrandCount = document.getElementById('quote-catalog-brand-count');
      const quoteCatalogModelCount = document.getElementById('quote-catalog-model-count');
      const catalogList = document.getElementById('catalog-list');
      const quoteSubmitButton = document.getElementById('quote-submit-button');
      const quoteSubmitStatus = document.getElementById('quote-submit-status');
      const resetSelectedResidualButton = document.getElementById('reset-selected-residual');
      const resetWorkbookDefaultsButton = document.getElementById('reset-workbook-defaults');
      const workbookDiffWarning = document.getElementById('workbook-diff-warning');
      const quoteSummary = document.getElementById('quote-summary');
      const quoteWarnings = document.getElementById('quote-warnings');
      const candidateList = document.getElementById('candidate-list');
      const selectionGuide = document.getElementById('selection-guide');
      const rawResponse = document.getElementById('raw-response');
      const selectedResidualRateInput = document.getElementById('selectedResidualRateOverride');

      const importForm = document.getElementById('import-form');
      const previewButton = document.getElementById('preview-import');
      const commitButton = document.getElementById('commit-import');
      const previewVersion = document.getElementById('preview-version');
      const previewSheetCount = document.getElementById('preview-sheet-count');
      const previewVehicleCount = document.getElementById('preview-vehicle-count');
      const previewMatrixCount = document.getElementById('preview-matrix-count');
      const previewStatus = document.getElementById('preview-status');
      const previewJson = document.getElementById('preview-json');
      const refreshDashboardButton = document.getElementById('refresh-dashboard');
      let activeCatalog = initialBrands;
      let activeModels = [];
      let activeWorkbookContract = null;
      let autoCalculateTimer = null;
      let quoteRequestController = null;
      let quoteRequestSequence = 0;
      let quoteCalculationInFlight = false;

      function setSection(target) {
        navButtons.forEach((button) => {
          button.classList.toggle('active', button.dataset.target === target);
        });
        sections.forEach((section) => {
          section.classList.toggle('active', section.dataset.section === target);
        });
      }

      navButtons.forEach((button) => {
        button.addEventListener('click', () => setSection(button.dataset.target));
      });

      jumpButtons.forEach((button) => {
        button.addEventListener('click', () => setSection(button.dataset.targetJump));
      });

      function formatNumber(value) {
        return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(Number(value || 0));
      }

      function formatPercent(value) {
        return new Intl.NumberFormat('ko-KR', {
          style: 'percent',
          minimumFractionDigits: 2,
          maximumFractionDigits: 3,
        }).format(Number(value || 0));
      }

      function roundUpToNearestHundred(value) {
        return Math.ceil(Number(value || 0) / 100) * 100;
      }

      function minimumResidualRateByTerm(termMonths) {
        const lookup = {
          12: 0.5,
          24: 0.4,
          36: 0.3,
          48: 0.2,
          60: 0.15,
        };
        return lookup[Number(termMonths)] ?? null;
      }

      function previewMaximumResidualRate(model, termMonths) {
        if (!model) return null;

        const term = Number(termMonths);
        const apiMaxRate = Number(model.maxResidualRates?.[term]);
        if (Number.isFinite(apiMaxRate)) {
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
        if (baseRate == null) return null;
        return model.highResidualAllowed ? baseRate + 0.08 : baseRate;
      }

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

      function updateResidualPreviewFromInputs(model) {
        const term = Number(quoteForm.elements.namedItem('leaseTermMonths').value || 0);
        const minimumRate = minimumResidualRateByTerm(term);
        const maximumRate = previewMaximumResidualRate(model, term);

        if (sheetAppliedResidualRate.value === '-' || !sheetAppliedResidualRate.value) {
          setFieldValue(sheetAppliedResidualRate, maximumRate == null ? '-' : formatPercent(maximumRate));
        }
        setFieldValue(sheetMinResidualRate, minimumRate == null ? '-' : formatPercent(minimumRate));
        setFieldValue(sheetMaxResidualRate, maximumRate == null ? '-' : formatPercent(maximumRate));
      }

      function setRawResponse(value) {
        rawResponse.textContent = JSON.stringify(value, null, 2);
      }

      function setQuoteSubmitState(state, message) {
        if (quoteSubmitButton) {
          quoteSubmitButton.disabled = state === 'loading';
          quoteSubmitButton.textContent = state === 'loading' ? '계산 중...' : '견적 계산';
        }

        if (quoteSubmitStatus) {
          quoteSubmitStatus.textContent = message;
        }
      }

      function parseJsonSafely(text) {
        try {
          return JSON.parse(text);
        } catch {
          return null;
        }
      }

      function setFieldValue(field, value) {
        if (!field) return;
        field.value = value;
      }

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

      function contractFieldValue(name) {
        return activeWorkbookContract && activeWorkbookContract.fields ? activeWorkbookContract.fields[name] : null;
      }

      function contractNumber(name) {
        const field = contractFieldValue(name);
        if (!field) return undefined;
        const value = field.value;
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        if (typeof value === 'string') {
          const parsed = Number(String(value).replace(/,/g, '').trim());
          return Number.isFinite(parsed) ? parsed : undefined;
        }
        return undefined;
      }

      function contractText(name) {
        const field = contractFieldValue(name);
        if (!field) return undefined;
        if (typeof field.value === 'string' && field.value.trim()) return field.value.trim();
        if (field.displayText && field.displayText.trim()) return field.displayText.trim();
        return undefined;
      }

      function getContractVehiclePriceForCurrentSelection() {
        if (
          activeWorkbookContract &&
          activeWorkbookContract.consistency &&
          activeWorkbookContract.consistency.vehiclePriceMatches === false
        ) {
          return undefined;
        }

        const contractBrand = contractText('brand');
        const contractModel = contractText('modelName');
        const contractBasicVehiclePrice = contractNumber('basicVehiclePrice');

        if (
          contractBasicVehiclePrice != null &&
          contractBrand &&
          contractModel &&
          brandSelect.value === contractBrand &&
          trimSelect.value === contractModel
        ) {
          return contractBasicVehiclePrice;
        }

        return undefined;
      }

      function canUseWorkbookContractDefaults() {
        return !(
          activeWorkbookContract &&
          activeWorkbookContract.consistency &&
          activeWorkbookContract.consistency.vehiclePriceMatches === false
        );
      }

      function updateDiscountedVehiclePriceDisplay() {
        const basePrice = Number(quoteForm.elements.namedItem('quotedVehiclePrice').value || 0);
        const discountAmount = Number(quoteForm.elements.namedItem('discountAmount').value || 0);
        const optionAmount = Number(optionAmountDisplay.value || 0);
        const discountedVehiclePrice = Math.max(0, basePrice + optionAmount - discountAmount);
        discountedVehiclePriceDisplay.value = discountedVehiclePrice > 0 ? '₩ ' + formatNumber(discountedVehiclePrice) : '-';
      }

      function resetWorkbookDefaults(options) {
        const preserveResidualSelection = options && options.preserveResidualSelection === true;
        const model = activeModels.find((entry) => entry.modelName === trimSelect.value) || null;
        const useContractDefaults = canUseWorkbookContractDefaults();

        const contractOwnership = useContractDefaults ? contractText('ownershipLabel') : undefined;
        const contractLeaseTermMonths = useContractDefaults ? contractNumber('leaseTermMonths') : undefined;
        const contractAnnualMileageKm = useContractDefaults ? contractNumber('annualMileageKm') : undefined;
        const contractDiscountAmount = useContractDefaults ? contractNumber('discountAmount') : undefined;
        const contractPublicBondAmount = useContractDefaults ? contractNumber('publicBondAmount') : undefined;
        const contractMiscFeeAmount = useContractDefaults ? contractNumber('miscFeeAmount') : undefined;
        const contractDeliveryFeeAmount = useContractDefaults ? contractNumber('deliveryFeeAmount') : undefined;
        const contractUpfrontPaymentAmount = useContractDefaults ? contractNumber('upfrontPaymentAmount') : undefined;
        const contractAcquisitionTaxRate = useContractDefaults ? contractNumber('acquisitionTaxRate') : undefined;
        const contractInsuranceYearlyAmount = useContractDefaults ? contractNumber('insuranceYearlyAmount') : undefined;
        const contractLossDamageAmount = useContractDefaults ? contractNumber('lossDamageAmount') : undefined;
        const contractCmFeeRate = useContractDefaults ? contractNumber('cmFeeRate') : undefined;
        const contractSelectedResidualRate = useContractDefaults ? contractNumber('selectedResidualRate') : undefined;
        const contractAppliedAnnualRate = useContractDefaults ? contractNumber('appliedAnnualRate') : undefined;

        if (model) {
          quoteForm.elements.namedItem('quotedVehiclePrice').value = String(model.vehiclePrice);
        }

        quoteForm.elements.namedItem('ownershipType').value =
          contractOwnership && contractOwnership.includes('고객') ? 'customer' : 'company';
        quoteForm.elements.namedItem('leaseTermMonths').value = String(contractLeaseTermMonths ?? 36);
        quoteForm.elements.namedItem('annualMileageKm').value = String(contractAnnualMileageKm ?? 20000);
        quoteForm.elements.namedItem('discountAmount').value = String(contractDiscountAmount ?? 0);
        quoteForm.elements.namedItem('includePublicBondCost').checked = true;
        quoteForm.elements.namedItem('publicBondCost').value = String(contractPublicBondAmount ?? 0);
        quoteForm.elements.namedItem('includeMiscFeeAmount').checked = true;
        quoteForm.elements.namedItem('miscFeeAmount').value = String(contractMiscFeeAmount ?? 0);
        quoteForm.elements.namedItem('includeDeliveryFeeAmount').checked = true;
        quoteForm.elements.namedItem('deliveryFeeAmount').value = String(contractDeliveryFeeAmount ?? 0);
        quoteForm.elements.namedItem('upfrontPayment').value = String(contractUpfrontPaymentAmount ?? 0);
        quoteForm.elements.namedItem('depositAmount').value = '0';
        quoteForm.elements.namedItem('acquisitionTaxRateOverride').value = String(contractAcquisitionTaxRate ?? 0.07);
        quoteForm.elements.namedItem('stampDuty').value = '';
        quoteForm.elements.namedItem('insuranceYearlyAmount').value = String(contractInsuranceYearlyAmount ?? 0);
        quoteForm.elements.namedItem('lossDamageAmount').value = String(contractLossDamageAmount ?? 0);
        quoteForm.elements.namedItem('affiliateType').value = '비제휴사';
        quoteForm.elements.namedItem('directModelEntry').value = '';
        agFeeRateInput.value = '0%';
        cmFeeRateInput.value = formatPercentInputValue(contractCmFeeRate ?? 0) + '%';

        if (!preserveResidualSelection) {
          quoteForm.elements.namedItem('selectedResidualRateOverride').value = '';
          quoteForm.elements.namedItem('residualAmountOverride').value = '';
        }

        annualIrrRateInput.dataset.manual = 'false';
        annualIrrRateInput.value = '';
        if (contractAppliedAnnualRate != null) {
          setAnnualRateAutoDisplay(contractAppliedAnnualRate);
        } else {
          setAnnualRateAutoDisplay(undefined);
        }
        manualVehicleClassInput.readOnly = true;
        manualEngineDisplacementCcInput.readOnly = true;
        updateDiscountedVehiclePriceDisplay();
        renderVehicleSummaryRow(model);
      }

      function updateWorkbookDiffWarning() {
        const model = activeModels.find((entry) => entry.modelName === trimSelect.value) || null;
        const diffs = [];
        const contractVehiclePrice = getContractVehiclePriceForCurrentSelection();
        const currentVehiclePrice = Number(quoteForm.elements.namedItem('quotedVehiclePrice').value || 0);

        if (model) {
          if (currentVehiclePrice !== Number(model.vehiclePrice)) {
            diffs.push('기본차량가가 차량DB 기준값(₩ ' + formatNumber(model.vehiclePrice) + ')과 다릅니다.');
          }
        }

        if (
          activeWorkbookContract &&
          activeWorkbookContract.consistency &&
          activeWorkbookContract.consistency.message
        ) {
          diffs.push(activeWorkbookContract.consistency.message);
        }

        if (contractVehiclePrice != null && model && Number(contractVehiclePrice) !== Number(model.vehiclePrice)) {
          diffs.push(
            '현재 운용리스 시트 저장값(₩ ' +
              formatNumber(contractVehiclePrice) +
              ')이 차량DB 기준값과 다릅니다. 이 값은 비교용 참고값이며 자동 기본차량가로는 사용하지 않습니다.',
          );
        }

        const agFeeRate = parsePercentInput(agFeeRateInput.value) ?? 0;
        const cmFeeRate = parsePercentInput(cmFeeRateInput.value) ?? 0;

        if (agFeeRate !== 0) {
          diffs.push('AG수수료율이 엑셀 기본값 0%와 다릅니다.');
        }

        if (cmFeeRate !== 0) {
          diffs.push('CM수수료율이 엑셀 기본값 0%와 다릅니다.');
        }

        const publicBondCost = Number(quoteForm.elements.namedItem('publicBondCost').value || 0);
        const includePublicBondCost = quoteForm.elements.namedItem('includePublicBondCost').checked;
        if (!includePublicBondCost) {
          diffs.push('공채 포함 체크가 해제되어 있습니다.');
        } else if (publicBondCost !== 0) {
          diffs.push('공채 값이 수동 입력 상태입니다.');
        }

        const miscFeeAmount = Number(quoteForm.elements.namedItem('miscFeeAmount').value || 0);
        const includeMiscFeeAmount = quoteForm.elements.namedItem('includeMiscFeeAmount').checked;
        if (!includeMiscFeeAmount) {
          diffs.push('기타부대비 포함 체크가 해제되어 있습니다.');
        } else if (miscFeeAmount !== 0) {
          diffs.push('기타부대비가 엑셀 기본값 0원과 다릅니다.');
        }

        const deliveryFeeAmount = Number(quoteForm.elements.namedItem('deliveryFeeAmount').value || 0);
        const includeDeliveryFeeAmount = quoteForm.elements.namedItem('includeDeliveryFeeAmount').checked;
        if (!includeDeliveryFeeAmount) {
          diffs.push('탁송료 포함 체크가 해제되어 있습니다.');
        } else if (deliveryFeeAmount !== 0) {
          diffs.push('탁송료가 엑셀 기본값 0원과 다릅니다.');
        }

        const insuranceYearlyAmount = Number(quoteForm.elements.namedItem('insuranceYearlyAmount').value || 0);
        if (insuranceYearlyAmount !== 0) {
          diffs.push('보험료(年)가 엑셀 기본값 0원과 다릅니다.');
        }

        const lossDamageAmount = Number(quoteForm.elements.namedItem('lossDamageAmount').value || 0);
        if (lossDamageAmount !== 0) {
          diffs.push('이손액이 엑셀 기본값 0원과 다릅니다.');
        }

        if (diffs.length === 0) {
          workbookDiffWarning.classList.add('hidden');
          workbookDiffWarning.textContent = '';
          return;
        }

        workbookDiffWarning.classList.remove('hidden');
        workbookDiffWarning.innerHTML =
          '<strong>현재 입력은 엑셀 기본값과 다릅니다.</strong><div style="margin-top:6px">' + diffs.join('<br />') + '</div>';
      }

      function setAutoSummaryFromModel(model) {
        if (directModelEntryInput.value !== 'true') {
          setFieldValue(manualEngineDisplacementCcInput, model && model.engineDisplacementCc ? model.engineDisplacementCc : '');
          setFieldValue(manualVehicleClassInput, model && model.vehicleClass ? model.vehicleClass : '-');
        }
        setFieldValue(sheetHighResidual, model ? (model.highResidualAllowed ? '가능' : '기본') : '-');
        setFieldValue(sheetPromoCode, model && model.residualPromotionCode ? model.residualPromotionCode : '-');
        optionAmountDisplay.value = '0';
        updateDiscountedVehiclePriceDisplay();
        updateResidualPreviewFromInputs(model);
      }

      function setAutoSummaryFromQuote(quote) {
        if (!quote) {
          setFieldValue(sheetAppliedResidualRate, '-');
          setAnnualRateAutoDisplay(undefined);
          setFieldValue(sheetResidualAmount, '-');
          setFieldValue(sheetAcquisitionTaxAmount, '-');
          setFieldValue(sheetMinResidualRate, '-');
          setFieldValue(sheetMaxResidualRate, '-');
          setFieldValue(sheetCarTax, '미포함');
          setFieldValue(sheetExtraService, '-');
          setFieldValue(sheetSalesOwner, '-');
          setFieldValue(sheetDepositBasis, '차량가 기준');
          renderVehicleSummaryRow(activeModels.find((entry) => entry.modelName === trimSelect.value) || null);
          return;
        }

        const candidates = quote.residual?.candidateSummary?.candidates || [];

        setFieldValue(sheetAppliedResidualRate, formatPercent(quote.residual.rateDecimal));
        setAnnualRateAutoDisplay(quote.rates.annualRateDecimal);
        setFieldValue(sheetResidualAmount, '₩ ' + formatNumber(quote.residual.amount));
        setFieldValue(sheetAcquisitionTaxAmount, '₩ ' + formatNumber(quote.feesAndTaxes.acquisitionTax));
        setFieldValue(sheetMinResidualRate, quote.residual.minRateDecimal == null ? '-' : formatPercent(quote.residual.minRateDecimal));
        setFieldValue(sheetMaxResidualRate, quote.residual.maxRateDecimal == null ? '-' : formatPercent(quote.residual.maxRateDecimal));
        setFieldValue(sheetDepositBasis, '차량가 기준');
        renderVehicleSummaryRow(activeModels.find((entry) => entry.modelName === trimSelect.value) || null);
      }

      function scheduleAutoCalculate() {
        if (autoCalculateTimer) {
          clearTimeout(autoCalculateTimer);
          autoCalculateTimer = null;
        }

        autoCalculateTimer = setTimeout(() => {
          autoCalculateTimer = null;
          if (quoteCalculationInFlight) {
            scheduleAutoCalculate();
            return;
          }
          void runQuoteCalculation();
        }, 250);
      }

      function renderCatalogBrands(brands) {
        if (!brands || brands.length === 0) {
          brandSelect.innerHTML = '<option value="">브랜드 없음</option>';
          brandSelect.disabled = true;
          return;
        }

        brandSelect.disabled = false;
        brandSelect.innerHTML = brands
          .map((entry) => '<option value="' + entry.brand + '">' + entry.brand + '</option>')
          .join('');
      }

      async function renderCatalogModels(brand, preferredModelName) {
        if (!brand) {
          activeModels = [];
          trimSelect.innerHTML = '<option value="">모델 없음</option>';
          trimSelect.disabled = true;
          selectedModelMeta.textContent = '활성 워크북에서 브랜드를 먼저 선택해주세요.';
          return;
        }

        trimSelect.innerHTML = '<option value="">모델 불러오는 중</option>';
        trimSelect.disabled = true;

        try {
          const response = await fetch('/api/catalog/models?lenderCode=mg-capital&brand=' + encodeURIComponent(brand));
          const json = await response.json();

          if (!response.ok || !json.ok) {
            throw new Error(json.error || '모델 카탈로그를 불러오지 못했습니다.');
          }

          activeModels = Array.isArray(json.models) ? json.models : [];
        } catch (error) {
          activeModels = [];
          trimSelect.innerHTML = '<option value="">모델 없음</option>';
          trimSelect.disabled = true;
          selectedModelMeta.textContent =
            error instanceof Error ? error.message : '선택한 브랜드의 모델을 불러오지 못했습니다.';
          return;
        }

        if (activeModels.length === 0) {
          trimSelect.innerHTML = '<option value="">모델 없음</option>';
          trimSelect.disabled = true;
          selectedModelMeta.textContent = '선택한 브랜드의 모델을 불러오지 못했습니다.';
          return;
        }

        trimSelect.disabled = false;

        trimSelect.innerHTML = activeModels
          .map((model) => '<option value="' + model.modelName + '">' + model.modelName + '</option>')
          .join('');

        if (preferredModelName && activeModels.some((model) => model.modelName === preferredModelName)) {
          trimSelect.value = preferredModelName;
        } else if (activeModels[0]) {
          trimSelect.value = activeModels[0].modelName;
        }

        syncSelectedModelMeta();
      }

      function syncSelectedModelMeta() {
        const model = activeModels.find((entry) => entry.modelName === trimSelect.value) || null;

        if (!model) {
          selectedModelMeta.textContent = '현재 선택된 모델의 메타데이터가 없습니다.';
          setAutoSummaryFromModel(null);
          renderVehicleSummaryRow(null);
          return;
        }

        const flags = [];
        if (model.highResidualAllowed) flags.push('고잔가 가능');
        if (model.hybridAllowed) flags.push('하이브리드 허용');
        if (model.residualPromotionCode) flags.push('프로모션 ' + model.residualPromotionCode);

        selectedModelMeta.textContent =
          '기본차량가 ₩ ' +
          formatNumber(model.vehiclePrice) +
          (model.vehicleClass ? ' · 차종 ' + model.vehicleClass : '') +
          (model.engineDisplacementCc ? ' · ' + formatNumber(model.engineDisplacementCc) + 'cc' : '') +
          (flags.length > 0 ? ' · ' + flags.join(' · ') : '');
        quoteForm.elements.namedItem('quotedVehiclePrice').value = String(model.vehiclePrice);
        setAutoSummaryFromModel(model);
        updateWorkbookDiffWarning();
        renderVehicleSummaryRow(model);
      }

      function renderCatalogList(brands) {
        if (!brands || brands.length === 0) {
          catalogList.innerHTML = '<div class="empty-state">활성 워크북 카탈로그가 없습니다.</div>';
          return;
        }

        catalogList.innerHTML = brands
          .map((entry) => {
            return (
              '<div class="catalog-brand">' +
              '<div class="catalog-brand-title">' + entry.brand + ' <span class="badge neutral" style="margin-left:8px">' + formatNumber(entry.modelCount) + '개</span></div>' +
              '<div class="catalog-models">' +
              '활성 워크북에 등록된 모델 ' + formatNumber(entry.modelCount) + '개' +
              '</div>' +
              '</div>'
            );
          })
          .join('');
      }

      function readNumber(data, key) {
        const value = data.get(key);
        if (value === null || value === '') return undefined;
        return Number(value);
      }

      function readText(data, key) {
        const value = data.get(key);
        if (value == null) return undefined;
        const normalized = String(value).trim();
        return normalized ? normalized : undefined;
      }

      function parsePercentInput(rawValue) {
        if (rawValue == null) return undefined;
        const normalized = String(rawValue).replace(/%/g, '').replace(/,/g, '').trim();
        if (!normalized) return undefined;
        const parsed = Number(normalized);
        if (!Number.isFinite(parsed)) return undefined;
        return parsed > 1 ? parsed / 100 : parsed;
      }

      function formatPercentInputValue(rateDecimal) {
        if (rateDecimal == null || !Number.isFinite(Number(rateDecimal))) return '';
        const percentage = Number(rateDecimal) * 100;
        const rounded = Math.round(percentage * 1000) / 1000;
        return Number.isInteger(rounded) ? String(rounded) : String(rounded);
      }

      function applyResidualInputDisplay() {
        const parsed = parsePercentInput(selectedResidualRateInput.value);
        if (parsed == null) {
          selectedResidualRateInput.value = '';
          return;
        }
        selectedResidualRateInput.value = formatPercentInputValue(parsed) + '%';
      }

      function applyPercentInputDisplay(field) {
        const parsed = parsePercentInput(field.value);
        if (parsed == null) {
          field.value = '';
          return;
        }
        field.value = formatPercentInputValue(parsed) + '%';
      }

      function isManualAnnualRateOverride() {
        return annualIrrRateInput.dataset.manual === 'true';
      }

      function setAnnualRateAutoDisplay(rateDecimal) {
        if (rateDecimal == null || !Number.isFinite(Number(rateDecimal))) {
          if (!isManualAnnualRateOverride()) {
            annualIrrRateInput.value = '';
          }
          annualRateHelp.textContent = '비워두면 현재 정책 기준 금리를 자동 적용합니다.';
          return;
        }

        if (!isManualAnnualRateOverride()) {
          annualIrrRateInput.value = formatPercentInputValue(rateDecimal) + '%';
        }
        annualRateHelp.textContent = '현재 자동 반영 금리: ' + formatPercent(rateDecimal);
      }

      function readQuotePayload() {
        const data = new FormData(quoteForm);
        const annualIrrRateOverride = isManualAnnualRateOverride()
          ? parsePercentInput(data.get('annualIrrRateOverride'))
          : undefined;
        const payload = {
          lenderCode: 'mg-capital',
          productType: 'operating_lease',
          brand: String(data.get('brand')),
          modelName: String(data.get('modelName')),
          affiliateType: String(data.get('affiliateType') || '비제휴사'),
          directModelEntry: false,
          manualVehicleClass: readText(data, 'manualVehicleClass'),
          manualEngineDisplacementCc: readNumber(data, 'manualEngineDisplacementCc'),
          ownershipType: String(data.get('ownershipType')),
          leaseTermMonths: Number(data.get('leaseTermMonths')),
          annualMileageKm: Number(data.get('annualMileageKm')),
          upfrontPayment: Number(data.get('upfrontPayment') || 0),
          depositAmount: Number(data.get('depositAmount') || 0),
          quotedVehiclePrice: readNumber(data, 'quotedVehiclePrice'),
          discountAmount: readNumber(data, 'discountAmount'),
          includePublicBondCost: data.get('includePublicBondCost') != null,
          publicBondCost: readNumber(data, 'publicBondCost'),
          includeMiscFeeAmount: data.get('includeMiscFeeAmount') != null,
          miscFeeAmount: readNumber(data, 'miscFeeAmount'),
          includeDeliveryFeeAmount: data.get('includeDeliveryFeeAmount') != null,
          deliveryFeeAmount: readNumber(data, 'deliveryFeeAmount'),
          annualIrrRateOverride,
          annualEffectiveRateOverride: readNumber(data, 'annualEffectiveRateOverride'),
          paymentRateOverride: readNumber(data, 'paymentRateOverride'),
          selectedResidualRateOverride: parsePercentInput(data.get('selectedResidualRateOverride')),
          residualAmountOverride: readNumber(data, 'residualAmountOverride'),
          acquisitionTaxRateOverride: readNumber(data, 'acquisitionTaxRateOverride'),
          stampDuty: readNumber(data, 'stampDuty'),
          agFeeRate: parsePercentInput(data.get('agFeeRate')),
          cmFeeRate: parsePercentInput(data.get('cmFeeRate')),
          insuranceYearlyAmount: readNumber(data, 'insuranceYearlyAmount'),
          lossDamageAmount: readNumber(data, 'lossDamageAmount'),
        };

        return payload;
      }

      function renderQuoteWarnings(warnings) {
        quoteWarnings.innerHTML = '';
        if (!warnings || warnings.length === 0) {
          quoteWarnings.innerHTML = '<div class="callout">경고가 없습니다. 현재 입력으로 계산이 정상 완료되었습니다.</div>';
          return;
        }

        warnings.forEach((warning) => {
          const node = document.createElement('div');
          node.className = 'callout warning';
          node.textContent = warning;
          quoteWarnings.appendChild(node);
        });
      }

      function renderSelectionGuide(guide) {
        if (!guide) {
          selectionGuide.classList.add('hidden');
          selectionGuide.textContent = '';
          return;
        }

        selectionGuide.classList.remove('hidden');
        selectionGuide.className = 'callout ' + (guide.requiresUserConfirmation ? 'warning' : '');
        const defaultRate = guide.defaultRateDecimal == null ? '-' : formatPercent(guide.defaultRateDecimal);
        selectionGuide.innerHTML =
          '<strong>선택 가이드</strong><div style="margin-top:6px">' +
          (guide.requiresUserConfirmation ? '사용자 확인이 필요합니다. ' : '자동 후보를 사용할 수 있습니다. ') +
          '기본 제안 잔가율: ' + defaultRate +
          (guide.reason ? '<br />사유: ' + guide.reason : '') +
          '</div>';
      }

      function renderCandidateList(candidateSummary) {
        candidateList.innerHTML = '';

        if (!candidateSummary || !Array.isArray(candidateSummary.candidates) || candidateSummary.candidates.length === 0) {
          candidateList.innerHTML = '<div class="empty-state">후보 잔가 데이터가 없습니다.</div>';
          return;
        }

        candidateSummary.candidates.forEach((candidate) => {
          const card = document.createElement('div');
          card.className = 'candidate-card';

          const isSelected = candidate.name === candidateSummary.selectedCandidateName;
          const top = document.createElement('div');
          top.className = 'candidate-top';
          top.innerHTML =
            '<div>' +
            '<div class="candidate-title">' + candidate.name + '</div>' +
            '<div class="card-subtitle">엑셀 hidden residual candidate 기준 요약</div>' +
            '</div>' +
            '<div class="badge ' + (isSelected ? 'success' : 'neutral') + '">' +
            (isSelected ? '기본 후보' : '후보') +
            '</div>';
          card.appendChild(top);

          const meta = document.createElement('div');
          meta.className = 'candidate-meta';
          meta.innerHTML =
            '<div class="mini-card"><div class="label">기본</div><div class="mini-value tabular">' + formatPercent(candidate.baseRate) + '</div></div>' +
            '<div class="mini-card"><div class="label">주행거리 반영</div><div class="mini-value tabular">' + formatPercent(candidate.mileageAdjustedRate) + '</div></div>' +
            '<div class="mini-card"><div class="label">최종 후보</div><div class="mini-value tabular">' + formatPercent(candidate.boostedRate) + '</div></div>';
          card.appendChild(meta);

          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'btn btn-tonal';
          button.style.marginTop = '12px';
          button.textContent = '이 잔가율로 재계산';
          button.addEventListener('click', () => {
            quoteForm.elements.namedItem('selectedResidualRateOverride').value = formatPercentInputValue(candidate.boostedRate) + '%';
            void runQuoteCalculation();
          });
          card.appendChild(button);
          candidateList.appendChild(card);
        });
      }

      function renderQuoteSummary(quote) {
        if (!quote) {
          quoteSummary.innerHTML = '<div class="empty-state">계산 결과가 없습니다.</div>';
          return;
        }

        const workbookLabel = quote.workbookImport ? quote.workbookImport.versionLabel : '-';
        const matrixGroup = quote.residual && quote.residual.matrixGroup ? quote.residual.matrixGroup : '미지정';
        const displayMonthlyPayment = roundUpToNearestHundred(quote.monthlyPayment);
        const currentInputSummary =
          quote.resolvedVehicle.brand +
          ' · ' +
          quote.resolvedVehicle.modelName +
          ' · 차량가 ₩ ' +
          formatNumber(quote.majorInputs.vehiclePrice) +
          ' · ' +
          quote.majorInputs.leaseTermMonths +
          '개월 · ' +
          (quote.majorInputs.ownershipType === 'company' ? '법인' : '고객명의');
        quoteSummary.innerHTML =
          '<div class="result-card primary">' +
          '<div class="label">월 납입금</div>' +
          '<div class="result-value tabular">₩ ' + formatNumber(displayMonthlyPayment) + '</div>' +
          '<div class="card-subtitle" style="color: rgba(255,255,255,0.7); margin-top: 8px;">' + workbookLabel + ' 기준 · ' + matrixGroup + '</div>' +
          '<div class="card-subtitle" style="color: rgba(255,255,255,0.82); margin-top: 6px;">' + currentInputSummary + '</div>' +
          '<div class="card-subtitle" style="color: rgba(255,255,255,0.62); margin-top: 4px;">내부 계산값 ₩ ' + formatNumber(quote.monthlyPayment) + '</div>' +
          '</div>' +
          '<div class="result-card"><div class="label">적용 잔가율</div><div class="result-value tabular">' + formatPercent(quote.residual.rateDecimal) + '</div></div>' +
          '<div class="result-card"><div class="label">잔가금액</div><div class="result-value tabular">₩ ' + formatNumber(quote.residual.amount) + '</div></div>' +
          '<div class="result-card"><div class="label">조달원금</div><div class="result-value tabular">₩ ' + formatNumber(quote.majorInputs.financedPrincipal) + '</div></div>' +
          '<div class="result-card"><div class="label">표시 IRR</div><div class="result-value tabular">' + formatPercent(quote.rates.annualRateDecimal) + '</div></div>' +
          '<div class="result-card"><div class="label">유효 IRR</div><div class="result-value tabular">' + formatPercent(quote.rates.effectiveAnnualRateDecimal) + '</div></div>' +
          '<div class="result-card"><div class="label">취득세</div><div class="result-value tabular">₩ ' + formatNumber(quote.feesAndTaxes.acquisitionTax) + '</div></div>' +
          '<div class="result-card"><div class="label">인지세</div><div class="result-value tabular">₩ ' + formatNumber(quote.feesAndTaxes.stampDuty) + '</div></div>';
      }

      async function requestQuoteCalculation(payload, requestId) {
        if (quoteRequestController) {
          quoteRequestController.abort();
        }

        const controller = new AbortController();
        quoteRequestController = controller;

        let timeoutId = null;
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => {
            controller.abort();
            reject(new Error('계산 요청 시간이 초과되었습니다.'));
          }, 8000);
        });

        try {
          const response = await Promise.race([
            fetch('/api/quotes/calculate', {
              method: 'POST',
              headers: {
                'content-type': 'application/json',
              },
              body: JSON.stringify(payload),
              signal: controller.signal,
            }),
            timeoutPromise,
          ]);

          const rawText = await Promise.race([response.text(), timeoutPromise]);
          return {
            response,
            rawText,
            json: parseJsonSafely(rawText),
          };
        } finally {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          if (quoteRequestController === controller) {
            quoteRequestController = null;
          }
        }
      }

      async function runQuoteCalculation() {
        if (quoteCalculationInFlight) {
          setQuoteSubmitState('loading', '이전 계산 요청을 처리 중입니다. 잠시만 기다려주세요...');
          return;
        }

        quoteCalculationInFlight = true;
        const requestId = ++quoteRequestSequence;
        const payload = readQuotePayload();
        setQuoteSubmitState('loading', '견적 계산 요청을 보내는 중입니다...');
        quoteSummary.innerHTML = '<div class="empty-state">견적 계산 중입니다. 잠시만 기다려주세요.</div>';
        quoteWarnings.innerHTML = '';
        renderSelectionGuide(null);
        renderCandidateList(null);

        try {
          const { response, rawText, json } = await requestQuoteCalculation(payload, requestId);

          if (requestId !== quoteRequestSequence) {
            return;
          }

          setRawResponse(json ?? { ok: false, rawText });

          if (!json) {
            renderQuoteSummary(null);
            renderSelectionGuide(null);
            renderCandidateList(null);
            setAutoSummaryFromQuote(null);
            quoteWarnings.innerHTML =
              '<div class="callout danger">계산 API가 JSON이 아닌 응답을 반환했습니다.</div>';
            setQuoteSubmitState('error', '서버가 예상하지 않은 응답을 반환했습니다. 디버그 응답을 확인해주세요.');
            return;
          }

          if (!response.ok || !json.ok) {
            renderQuoteSummary(null);
            renderSelectionGuide(null);
            renderCandidateList(null);
            setAutoSummaryFromQuote(null);
            quoteWarnings.innerHTML = '<div class="callout danger">' + (json.error || '견적 계산에 실패했습니다.') + '</div>';
            setQuoteSubmitState('error', '계산에 실패했습니다. 오른쪽 경고 또는 디버그 응답을 확인해주세요.');
            return;
          }

          renderQuoteSummary(json.quote);
          renderQuoteWarnings(json.quote.warnings);
          renderSelectionGuide(json.quote.residual.selectionGuide);
          renderCandidateList(json.quote.residual.candidateSummary);
          setAutoSummaryFromQuote(json.quote);
          setQuoteSubmitState('success', '계산이 완료되었습니다. 결과 카드와 잔가 후보를 확인해주세요.');
        } catch (error) {
          if (requestId !== quoteRequestSequence) {
            return;
          }

          renderQuoteSummary(null);
          renderSelectionGuide(null);
          renderCandidateList(null);
          setAutoSummaryFromQuote(null);
          const message =
            error instanceof Error && error.name === 'AbortError'
              ? '계산 요청 시간이 초과되었습니다.'
              : error instanceof Error
                ? error.message
                : '알 수 없는 오류가 발생했습니다.';
          quoteWarnings.innerHTML = '<div class="callout danger">계산 요청 중 오류가 발생했습니다: ' + message + '</div>';
          setRawResponse({ ok: false, error: message });
          setQuoteSubmitState('error', '요청이 지연되었거나 실패했습니다. 입력값과 로컬 서버 로그를 확인해주세요.');
        } finally {
          if (requestId === quoteRequestSequence) {
            quoteCalculationInFlight = false;
          }
        }
      }

      quoteForm.addEventListener('submit', (event) => {
        event.preventDefault();
        void runQuoteCalculation();
      });

      quoteSubmitButton.addEventListener('click', () => {
        void runQuoteCalculation();
      });

      brandSelect.addEventListener('change', () => {
        if (!isManualAnnualRateOverride()) {
          annualIrrRateInput.value = '';
        }
        void renderCatalogModels(brandSelect.value);
        resetWorkbookDefaults({ preserveResidualSelection: false });
        updateWorkbookDiffWarning();
        scheduleAutoCalculate();
      });

      trimSelect.addEventListener('change', () => {
        syncSelectedModelMeta();
        updateResidualPreviewFromInputs(activeModels.find((entry) => entry.modelName === trimSelect.value) || null);
        scheduleAutoCalculate();
      });

      modelSelect.addEventListener('change', () => {
        if (!isManualAnnualRateOverride()) {
          annualIrrRateInput.value = '';
        }
        syncSelectedModelMeta();
        resetWorkbookDefaults({ preserveResidualSelection: false });
        updateWorkbookDiffWarning();
        scheduleAutoCalculate();
      });

      annualIrrRateInput.addEventListener('focus', () => {
        const parsed = parsePercentInput(annualIrrRateInput.value);
        if (parsed != null) {
          annualIrrRateInput.value = formatPercentInputValue(parsed);
        }
      });

      annualIrrRateInput.addEventListener('blur', () => {
        if (!annualIrrRateInput.value.trim()) {
          annualIrrRateInput.dataset.manual = 'false';
          setAnnualRateAutoDisplay(undefined);
          return;
        }
        annualIrrRateInput.dataset.manual = 'true';
        applyPercentInputDisplay(annualIrrRateInput);
      });

      annualIrrRateInput.addEventListener('change', () => {
        annualIrrRateInput.dataset.manual = annualIrrRateInput.value.trim() ? 'true' : 'false';
        if (annualIrrRateInput.value.trim()) {
          applyPercentInputDisplay(annualIrrRateInput);
        }
        updateWorkbookDiffWarning();
        scheduleAutoCalculate();
      });

      selectedResidualRateInput.addEventListener('focus', () => {
        const parsed = parsePercentInput(selectedResidualRateInput.value);
        if (parsed != null) {
          selectedResidualRateInput.value = formatPercentInputValue(parsed);
        }
      });

      selectedResidualRateInput.addEventListener('blur', () => {
        applyResidualInputDisplay();
      });

      selectedResidualRateInput.addEventListener('change', () => {
        applyResidualInputDisplay();
        updateWorkbookDiffWarning();
        scheduleAutoCalculate();
      });

      selectedResidualRateInput.addEventListener('input', () => {
        scheduleAutoCalculate();
      });

      [agFeeRateInput, cmFeeRateInput].forEach((field) => {
        field.addEventListener('focus', () => {
          const parsed = parsePercentInput(field.value);
          if (parsed != null) {
            field.value = formatPercentInputValue(parsed);
          }
        });

        field.addEventListener('blur', () => {
          applyPercentInputDisplay(field);
        });

        field.addEventListener('change', () => {
          applyPercentInputDisplay(field);
          updateWorkbookDiffWarning();
          scheduleAutoCalculate();
        });
      });

      ['ownershipType', 'leaseTermMonths', 'annualMileageKm', 'quotedVehiclePrice', 'discountAmount', 'upfrontPayment', 'depositAmount', 'publicBondCost', 'miscFeeAmount', 'deliveryFeeAmount', 'insuranceYearlyAmount', 'lossDamageAmount', 'acquisitionTaxRateOverride', 'stampDuty', 'includePublicBondCost', 'includeMiscFeeAmount', 'includeDeliveryFeeAmount'].forEach((name) => {
        const field = quoteForm.elements.namedItem(name);
        if (field) {
          field.addEventListener('change', () => {
            if ((name === 'ownershipType' || name === 'leaseTermMonths') && !isManualAnnualRateOverride()) {
              annualIrrRateInput.value = '';
            }
            if (name === 'leaseTermMonths') {
              const model = activeModels.find((entry) => entry.modelName === trimSelect.value) || null;
              updateResidualPreviewFromInputs(model);
            }
            updateDiscountedVehiclePriceDisplay();
            updateWorkbookDiffWarning();
            if (name === 'quotedVehiclePrice') {
              renderVehicleSummaryRow(activeModels.find((entry) => entry.modelName === trimSelect.value) || null);
            }
            scheduleAutoCalculate();
          });
          field.addEventListener('input', () => {
            updateDiscountedVehiclePriceDisplay();
            updateWorkbookDiffWarning();
            if (name === 'quotedVehiclePrice') {
              renderVehicleSummaryRow(activeModels.find((entry) => entry.modelName === trimSelect.value) || null);
            }
            scheduleAutoCalculate();
          });
        }
      });

      resetSelectedResidualButton.addEventListener('click', () => {
        quoteForm.elements.namedItem('selectedResidualRateOverride').value = '';
        quoteForm.elements.namedItem('residualAmountOverride').value = '';
        updateWorkbookDiffWarning();
        scheduleAutoCalculate();
      });

      resetWorkbookDefaultsButton.addEventListener('click', () => {
        resetWorkbookDefaults({ preserveResidualSelection: false });
        updateWorkbookDiffWarning();
        scheduleAutoCalculate();
      });

      function renderImportPreview(workbook) {
        if (!workbook) return;

        previewVersion.textContent = workbook.detectedVersionLabel || '미확인';
        previewSheetCount.textContent = String((workbook.sheetNames || []).length);
        previewVehicleCount.textContent = formatNumber((workbook.vehiclePrograms || []).length);
        previewMatrixCount.textContent = formatNumber((workbook.residualMatrixRows || []).length);

        const anomalyCount = workbook.analysis && Array.isArray(workbook.analysis.anomalies)
          ? workbook.analysis.anomalies.length
          : 0;

        previewStatus.className = 'callout ' + (anomalyCount > 0 ? 'warning' : '');
        previewStatus.innerHTML =
          '<strong>미리보기 완료</strong><div style="margin-top:6px">차량 프로그램 ' +
          formatNumber((workbook.vehiclePrograms || []).length) +
          '건, 잔가 매트릭스 ' +
          formatNumber((workbook.residualMatrixRows || []).length) +
          '건, anomaly ' +
          anomalyCount +
          '건</div>';

        previewJson.textContent = JSON.stringify(workbook, null, 2);
      }

      async function submitImport(mode) {
        const formData = new FormData(importForm);
        const lenderCode = String(formData.get('lenderCode') || 'mg-capital');

        if (!(formData.get('file') instanceof File) || formData.get('file').size === 0) {
          previewStatus.className = 'callout danger';
          previewStatus.textContent = '먼저 엑셀 파일을 선택해주세요.';
          return;
        }

        const endpoint = mode === 'preview' ? '/api/imports/preview?lenderCode=' + encodeURIComponent(lenderCode) : '/api/imports?lenderCode=' + encodeURIComponent(lenderCode);

        const response = await fetch(endpoint, {
          method: 'POST',
          body: formData,
        });

        const json = await response.json();
        setRawResponse(json);

        if (!response.ok || !json.ok) {
          previewStatus.className = 'callout danger';
          previewStatus.textContent = json.error || '워크북 처리에 실패했습니다.';
          previewJson.textContent = JSON.stringify(json, null, 2);
          return;
        }

        renderImportPreview(json.workbook);

        if (mode === 'commit') {
          previewStatus.className = 'callout';
          previewStatus.innerHTML =
            '<strong>업로드 완료</strong><div style="margin-top:6px">버전 ' +
            json.import.versionLabel +
            ' 이 저장되었습니다.</div>';
          await refreshDashboard();
        }
      }

      previewButton.addEventListener('click', async () => {
        await submitImport('preview');
      });

      commitButton.addEventListener('click', async () => {
        await submitImport('commit');
      });

      function renderImportsTable(imports) {
        if (!imports || imports.length === 0) {
          importsTableBody.innerHTML = '<tr><td colspan="4" class="inline-hint">아직 import 이력이 없습니다.</td></tr>';
          return;
        }

        importsTableBody.innerHTML = imports
          .slice(0, 8)
          .map((item) => {
            const statusClass = item.isActive ? 'success' : item.status === 'validated' ? 'warning' : 'neutral';
            const importedAt = item.importedAt ? new Date(item.importedAt).toLocaleString('ko-KR') : '-';
            return '<tr>' +
              '<td><div style="font-weight: 700">' + item.versionLabel + '</div><div class="card-subtitle">' + item.lenderName + '</div></td>' +
              '<td class="mono">' + item.sourceFileName + '</td>' +
              '<td><span class="badge ' + statusClass + '">' + (item.isActive ? '활성' : item.status) + '</span></td>' +
              '<td class="tabular">' + importedAt + '</td>' +
            '</tr>';
          })
          .join('');
      }

      async function refreshCatalog() {
        try {
          const response = await fetch('/api/catalog/brands?lenderCode=mg-capital');
          const json = await response.json();

          if (!response.ok || !json.ok) {
            throw new Error(json.error || '브랜드 카탈로그를 불러오지 못했습니다.');
          }

          activeCatalog = Array.isArray(json.brands) ? json.brands : [];
        } catch (error) {
          activeCatalog = [];
          catalogBrandCount.textContent = '0';
          catalogModelCount.textContent = '0';
          quoteCatalogBrandCount.textContent = '0';
          quoteCatalogModelCount.textContent = '0';
          renderCatalogList([]);
          renderCatalogBrands([]);
          modelSelect.innerHTML = '<option value="">모델 없음</option>';
          modelSelect.disabled = true;
          activeModels = [];
          selectedModelMeta.textContent =
            error instanceof Error ? error.message : '활성 워크북 카탈로그를 불러오지 못했습니다.';
          return;
        }

        const totalModels = activeCatalog.reduce((sum, entry) => sum + entry.modelCount, 0);

        catalogBrandCount.textContent = formatNumber(activeCatalog.length);
        catalogModelCount.textContent = formatNumber(totalModels);
        quoteCatalogBrandCount.textContent = formatNumber(activeCatalog.length);
        quoteCatalogModelCount.textContent = formatNumber(totalModels);
        renderCatalogList(activeCatalog);

        if (activeCatalog.length === 0) {
          renderCatalogBrands([]);
          modelSelect.innerHTML = '';
          modelSelect.disabled = true;
          activeModels = [];
          selectedModelMeta.textContent = '활성 워크북 카탈로그가 없습니다.';
          return;
        }

        renderCatalogBrands(activeCatalog);

        const currentBrand = brandSelect.value;
        const hasCurrentBrand = activeCatalog.some((entry) => entry.brand === currentBrand);
        const nextBrand = hasCurrentBrand ? currentBrand : activeCatalog[0].brand;
        brandSelect.value = nextBrand;
        await renderCatalogModels(nextBrand, trimSelect.value || undefined);
      }

      async function refreshDashboard() {
        const [healthRes, lenderRes, importsRes, contractRes] = await Promise.all([
          fetch('/health'),
          fetch('/api/lenders'),
          fetch('/api/imports?lenderCode=mg-capital'),
          fetch('/api/workbook-contract?lenderCode=mg-capital'),
        ]);

        const healthJson = await healthRes.json();
        const lenderJson = await lenderRes.json();
        const importsJson = await importsRes.json();
        const contractJson = await contractRes.json();
        activeWorkbookContract =
          contractJson && contractJson.ok && contractJson.sheetContracts && contractJson.sheetContracts.operatingLease
            ? contractJson.sheetContracts.operatingLease
            : null;

        healthStatus.textContent = healthJson.ok ? '정상' : '장애';
        healthSubtext.textContent = 'APP_ENV=' + (healthJson.env || 'unknown') + ' · ' + healthJson.timestamp;
        envPill.textContent = '환경 · ' + (healthJson.env || 'unknown');

        const lenders = Array.isArray(lenderJson.lenders) ? lenderJson.lenders : [];
        lenderCount.textContent = formatNumber(lenders.length);
        heroLenderCount.textContent = formatNumber(lenders.length);
        dashboardLenderName.textContent = lenders[0] ? lenders[0].lenderName : '없음';

        const imports = Array.isArray(importsJson.imports) ? importsJson.imports : [];
        importCount.textContent = formatNumber(imports.length);
        heroImportCount.textContent = formatNumber(imports.length);
        renderImportsTable(imports);

        const active = imports.find((entry) => entry.isActive) || imports[0];
        if (active) {
          activeVersion.textContent = active.versionLabel;
          activeVersionSubtext.textContent = active.sourceFileName;
          versionPill.textContent = '활성 버전 · ' + active.versionLabel;
        } else {
          activeVersion.textContent = '없음';
          activeVersionSubtext.textContent = '아직 저장된 import가 없습니다.';
          versionPill.textContent = '활성 버전 없음';
        }

        await refreshCatalog();
      }

      refreshDashboardButton.addEventListener('click', refreshDashboard);
      brandSelect.innerHTML = '<option value="">브랜드 불러오는 중</option>';
      brandSelect.disabled = true;
      modelSelect.innerHTML = '<option value="">모델 불러오는 중</option>';
      modelSelect.disabled = true;
      updateDiscountedVehiclePriceDisplay();
      setAutoSummaryFromQuote(null);
      updateWorkbookDiffWarning();
      refreshDashboard();
    </script>
  </body>
</html>`;
}
