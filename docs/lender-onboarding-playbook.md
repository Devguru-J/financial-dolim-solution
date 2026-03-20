# Lender Onboarding Playbook

## Purpose

Use this document whenever we add:

1. a brand new finance company
2. a materially new workbook structure from an existing company

The goal is to avoid ad hoc lender integrations.

## Phase 1. Intake

Collect the following first:

1. workbook file for at least one month
2. ideally two or more historical workbook versions
3. sample quote outputs from the lender
4. notes about business exceptions from the sales team
5. known restrictions such as high residual only, region caps, dealer exemptions

## Phase 2. Workbook reconnaissance

Before coding, answer these questions:

1. Which sheets are user-facing quote sheets?
2. Which sheets are monthly data tables?
3. Which sheets are static forms only?
4. Where are the hidden calculation blocks?
5. Which cells are real inputs vs derived outputs?
6. Which values change monthly and therefore must be imported as data?
7. Which values are lender business rules and therefore belong in code?

Expected artifact:

1. one lender-specific implementation plan markdown file

## Phase 3. Domain decomposition

Break the workbook into these categories:

1. vehicle catalog data
2. residual tables
3. rate and fee policies
4. restrictions and eligibility rules
5. derived calculation formulas
6. printable quote layout only

Rule:

If it changes monthly, prefer data.
If it is business logic, prefer code.

## Phase 4. Adapter design

Create one lender adapter with four responsibilities:

1. identify workbook format
2. parse workbook into extracted raw sections
3. normalize extracted data into shared tables
4. expose a lender quote calculator

Suggested adapter interface:

```ts
type LenderAdapter = {
  lenderCode: string;
  canParseWorkbook(fileName: string, workbookMeta: unknown): boolean;
  previewImport(input: ArrayBuffer): Promise<ImportPreview>;
  persistImport(preview: ImportPreview): Promise<PersistedImport>;
  calculateQuote(input: CanonicalQuoteInput): Promise<CanonicalQuoteResult>;
};
```

## Phase 5. Schema fit check

Before creating lender-specific tables, confirm the shared schema cannot represent the data cleanly.

Create lender-specific tables only if:

1. the rule shape is truly unique
2. forcing it into shared tables makes the model misleading
3. we expect repeated reads of this rule at runtime

## Phase 6. Validation fixture creation

Create at least:

1. one happy-path quote per product
2. one edge-case quote with manual overrides
3. one restriction/failure case
4. one maximum or high residual case

Each fixture should record:

1. exact workbook version
2. exact quote inputs
3. exact Excel outputs
4. notes about any tolerance

## Phase 7. Release readiness

A lender integration is not ready until all items below are complete:

1. workbook preview works
2. import persistence works
3. active version switching works
4. catalog APIs work
5. quote calculation works
6. regression fixtures pass
7. admin can diagnose import warnings

## Monthly update process for an existing lender

For an existing lender with same workbook structure:

1. upload workbook
2. preview diff
3. run validation suite against active fixtures
4. activate new version

For an existing lender with changed structure:

1. duplicate the lender implementation plan
2. record changed sheets and changed cell semantics
3. update adapter parsing rules
4. add new regression fixtures

## Red flags

Stop and investigate if any of these appear:

1. formulas reference new hidden sheets
2. a formerly numeric column becomes mixed text/code
3. rate or residual logic moves from data table into hardcoded sheet formulas
4. dealer-specific exceptions are embedded in deeply nested formulas
5. outputs differ from Excel without a clear reason

## Definition of done for a new lender

1. The lender can be imported from workbook to DB.
2. The lender can produce quotes from the shared API shape.
3. The shared frontend can render that lender with configuration rather than custom page forks.
4. Output parity has fixture coverage.
