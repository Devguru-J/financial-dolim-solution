# Project Planning Docs

These documents are the long-term planning baseline for the lease calculator platform.

## Core docs

1. [Platform Blueprint](./platform-blueprint.md)
   - system shape for a multi-lender quote platform
   - runtime, DB, import, calculation, and deployment boundaries

2. [Lender Onboarding Playbook](./lender-onboarding-playbook.md)
   - step-by-step process for adding a new finance company
   - workbook analysis, parser design, validation, and release checklist

3. [Implementation Roadmap](./implementation-roadmap.md)
   - staged execution plan from current scaffold to production

4. [MG Capital Implementation Plan](./mg-capital-implementation-plan.md)
   - lender-specific analysis for the first implementation target

## How to use these docs

1. Read `Platform Blueprint` before changing architecture.
2. Use `Lender Onboarding Playbook` whenever a new monthly workbook or a new lender is added.
3. Use `Implementation Roadmap` to decide what to build next.
4. Keep lender-specific discoveries in a dedicated `<lender>-implementation-plan.md` file.
