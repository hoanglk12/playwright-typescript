---
name: "discover-e2e-flows"
description: Use when exploring web applications to discover, document, and draft end-to-end business flows and automation strategies for comprehensive test coverage.
---

## Purpose

This agent skill is designed to:

1. Explore website(s) deeply based on user-provided URLs
2. Discover and document key business flows and functional modules
3. Draft full end-to-end test scenarios
4. Propose a practical automation strategy and implementation roadmap

This skill is especially useful for:
- QA Engineers
- SDETs
- Test Architects
- Manual testers transitioning into automation
- Teams assessing test coverage for e-commerce or web platforms

---

## Skill Name

**website-e2e-explorer-and-automation-planner**

---

## Primary Goal

Given one or more website URLs from the user, the agent should:

- inspect the available pages/features
- infer the system structure and business flows
- produce comprehensive E2E scenarios
- group scenarios by module and priority
- define what should be automated first
- provide an automation plan with tooling, architecture, data strategy, and CI/CD approach

---

## Expected Input

```yaml
websites:
  - https://example-site-1.com
  - https://example-site-2.com

depth: deep
domain_hint: ecommerce | retail | cms | banking | saas | education | generic-web
output_format: markdown
```

### Minimal Input
```yaml
websites:
  - https://example.com
```

---

## Expected Output

The agent should produce a structured Markdown report containing:

1. **Exploration Summary**
2. **Feature/Module Inventory**
3. **Business Flow Map**
4. **Assumptions and Risks**
5. **Detailed E2E Scenarios**
6. **Scenario Prioritization**
7. **Automation Candidate Matrix**
8. **Automation Roadmap**
9. **Recommended Test Framework**
10. **CI/CD and Reporting Strategy**
11. **Open Questions / Clarifications Needed**

---

## Agent Behavior

The agent must behave like a **Senior QA Automation Engineer** with strong product thinking.

### Principles
- Be factual and transparent
- Clearly separate:
  - observed facts
  - inferred assumptions
  - unverified possibilities
- Prefer business-critical coverage first
- Think in terms of:
  - user journeys
  - risks
  - regression impact
  - automation maintainability

---

## Deep Exploration Framework

When exploring a site, the agent should inspect as many of these areas as possible.

### 1. Global Structure
- Homepage
- Header
- Footer
- Navigation menu
- Breadcrumbs
- Search
- Region/language/currency selector
- Support/help/contact links

### 2. Content and Discovery
- Home banners
- Promotional sections
- Featured products/items/content
- Category listing pages
- Search results
- Filters/facets
- Sorting
- Pagination / infinite scroll / load more

### 3. Product or Detail Experience
- Product detail page / content detail page
- Image gallery
- Variant selection
- Size/color/material selectors
- Pricing display
- Sale pricing
- Ratings/reviews
- Stock availability
- Delivery or pickup messaging
- Wishlist / save for later

### 4. Cart and Checkout
- Add to cart
- Mini cart
- Cart page
- Quantity update
- Remove item
- Promo code
- Shipping estimation
- Checkout start
- Guest checkout
- Logged-in checkout
- Shipping details
- Billing details
- Payment options
- Order review
- Order confirmation

### 5. Account and Identity
- Register
- Login
- Logout
- Forgot password
- My account dashboard
- Order history
- Address book
- Profile update
- Wishlist
- Loyalty or rewards

### 6. Cross-Cutting Areas
- Responsive/mobile behavior
- Error handling
- Empty states
- Validation messages
- Accessibility basics
- Performance-sensitive flows
- Analytics-sensitive CTAs
- Localization/regional differences

---

## Exploration Output Template

For each website, the agent should produce the following sections.

### Site Overview
- Site name
- Environment type if inferable
- Market/region if visible
- Likely domain/business type
- High-level purpose of the website

### Observed Modules
List all modules found, for example:
- Homepage
- Navigation
- Search
- Category/PLP
- PDP
- Cart
- Checkout
- Account
- Loyalty
- Store locator
- Help/support
- Promotions

### Key User Roles
Infer likely user roles such as:
- Guest user
- Registered customer
- Returning customer
- Mobile user
- Admin-facing role not accessible publicly
- Region-specific customer

### Core Business Journeys
Document the most important journeys such as:
- Browse → Search → PDP → Add to Cart → Checkout
- Browse promotion → Sale listing → Product → Cart
- Login → Account → Order History
- Forgot password → Reset flow
- Guest checkout → Order confirmation

### Constraints / Unknowns
Examples:
- Checkout not fully testable without payment sandbox
- Authentication flows may need test accounts
- Some promo behavior may be data-driven and unstable
- Some flows may differ by AU/NZ market

---

## Scenario Design Rules

The agent should create E2E scenarios using these rules:

### Rule 1: Group by Module
Examples:
- Homepage
- Navigation
- Search
- Listing Page
- Product Detail
- Cart
- Checkout
- Authentication
- Account
- Localization
- Mobile/Responsive

### Rule 2: Include Priority
Use:
- **P1** = critical revenue/business flow
- **P2** = important regression flow
- **P3** = nice-to-have / low business risk

### Rule 3: Include Automation Feasibility
Tag each scenario:
- **A1** = automate immediately
- **A2** = automate later
- **M** = keep manual for now

### Rule 4: Include Preconditions
Every scenario should include:
- environment
- required data
- required user state
- dependencies if any

### Rule 5: Cover Positive + Negative + Edge Cases
For example:
- happy path
- invalid promo code
- out-of-stock product
- empty cart
- session timeout
- invalid search term
- missing required fields

---

## E2E Scenario Output Format

Use this format for each scenario:

### Scenario ID
`E2E-<MODULE>-###`

### Title
Short clear scenario name

### Priority
P1 / P2 / P3

### Automation
A1 / A2 / M

### User Type
Guest / Logged-in / Returning / Mobile / Region-specific

### Preconditions
- item exists
- user account exists
- product is in stock
- payment sandbox available
- promo code active

### Test Steps
1. Open website
2. Navigate to target page
3. Perform user actions
4. Validate expected outcomes

### Expected Results
- page loads correctly
- CTA visible
- prices update correctly
- item added to cart
- order confirmation shown

### Notes / Risks
- data-dependent
- flaky if inventory changes
- depends on third-party payment provider

---

## Coverage Model

The agent should cover at least these scenario layers.

### 1. Smoke Coverage
Minimal confidence after deployment:
- homepage loads
- navigation works
- search works
- PDP loads
- add to cart works
- cart opens
- checkout entry works

### 2. Critical Path Regression
Revenue/business critical:
- browse to purchase
- guest checkout
- logged-in checkout
- promo application
- shipping method selection
- order confirmation

### 3. Functional Regression
Broader coverage:
- filters
- sorting
- wishlist
- login/logout
- registration
- forgot password
- account pages

### 4. Negative / Resilience Coverage
- invalid promo code
- empty search
- invalid login
- required field validation
- unavailable product variant
- cart persistence issue
- payment failure handling

### 5. Non-Functional Guidance
Not full performance testing, but note:
- slow loading banners
- broken images
- layout instability
- accessibility issues
- mobile rendering concerns

---

## Automation Planning Framework

After drafting scenarios, the agent must create an automation plan.

### 1. Recommended Tooling
Default recommendation for modern websites:
- **UI Automation:** Playwright
- **Language:** TypeScript
- **Assertion:** Playwright built-in expect
- **API Validation:** Playwright API or separate API client
- **Reporting:** Allure / HTML report
- **CI:** GitHub Actions / GitLab CI / Jenkins
- **Test Management Mapping:** Jira / Xray / TestRail if needed

Alternative stacks may be proposed if justified:
- Cypress
- WebdriverIO
- Selenium
- Robot Framework

### 2. Automation Scope Recommendation
Split scenarios into:
- Phase 1: smoke + critical path
- Phase 2: high-value regression
- Phase 3: broader coverage and negative scenarios

### 3. Framework Architecture Recommendation
The plan should describe:
- Page Object Model or Screenplay pattern
- test data factories
- environment config strategy
- selector strategy
- retry strategy
- reporting hooks
- screenshot/video/traces
- parallel execution approach

### 4. Test Data Strategy
The agent should define:
- static test accounts
- dynamic account creation if possible
- seeded products
- region-specific data
- promo code test data
- stock-stable product list
- cleanup strategy for carts/orders if needed

### 5. Environment Strategy
Recommend how to handle:
- staging vs production-like
- feature flags
- unstable test data
- region environments
- payment sandbox integration
- email/SMS verification constraints

### 6. CI/CD Strategy
Recommend:
- PR smoke suite
- nightly regression suite
- pre-release full regression
- flaky test quarantine process
- trend reporting
- failure triage ownership

---

## Automation Prioritization Matrix

The agent should classify scenarios using a matrix like this:

| Scenario Type | Business Risk | Execution Frequency | Automation Value | Priority |
|---|---:|---:|---:|---|
| Homepage smoke | High | High | High | Automate first |
| Search | High | High | High | Automate first |
| Add to cart | Critical | High | Very High | Automate first |
| Guest checkout | Critical | High | Very High | Automate first |
| Login/logout | Medium | High | High | Automate early |
| Filters/sorting | Medium | Medium | High | Automate phase 2 |
| Wishlist | Medium | Medium | Medium | Automate phase 2 |
| Forgot password | Medium | Low | Medium | Phase 2 or manual-assisted |
| 3rd-party payment failure | High | Low | Medium | Partial automation/manual |
| Visual merchandising content | Low | High | Low | Manual or visual testing |

---

## Required Final Deliverable Structure

The final report generated by this skill should follow this structure:

# 1. Executive Summary
- what the site appears to do
- main business journeys
- key risks discovered

# 2. Website Exploration Findings
## 2.1 Site A
## 2.2 Site B
## 2.3 Site C
## 2.4 Site D

# 3. Consolidated Feature Inventory

# 4. Assumptions and Test Constraints

# 5. Full E2E Scenario Set
## 5.1 Homepage
## 5.2 Navigation
## 5.3 Search
## 5.4 PLP / Listing
## 5.5 PDP
## 5.6 Cart
## 5.7 Checkout
## 5.8 Authentication
## 5.9 Account
## 5.10 Localization / Region
## 5.11 Mobile / Responsive
## 5.12 Negative / Error Handling

# 6. Recommended Automation Scope
- what to automate now
- what to automate later
- what to keep manual

# 7. Automation Framework Proposal

# 8. Test Data and Environment Plan

# 9. CI/CD Execution Plan

# 10. Risks, Gaps, and Open Questions

---

## Suggested Prompt Template for Using This Skill

Use this prompt format:

```text
Explore deeply these websites based on the user input.
Then draft full E2E scenarios.
After that, make a plan to automate those scenarios.

Websites:
- <url1>
- <url2>
- <url3>

Domain hint:
- ecommerce

Expectations:
- include feature inventory
- include prioritized E2E scenarios
- include automation roadmap
- include assumptions and risks
- output as markdown
```

---

## Example Execution Intent

### Input
```yaml
websites:
  - https://stag-platypus-au.accentgra.com/
  - https://stag-platypus-nz.accentgra.com/
  - https://stag-skechers-au.accentgra.com/
  - https://stag-skechers-nz.accentgra.com/
domain_hint: ecommerce
depth: deep
output_format: markdown
```

### Expected Analysis Focus
For e-commerce websites, the agent should pay extra attention to:
- promotional banners
- category navigation
- search and autocomplete
- product listings
- product variants
- quick add
- add to cart
- cart calculations
- checkout steps
- region/currency/promo differences
- guest vs logged-in customer paths

---

## Quality Bar

A strong output from this skill should be:
- structured
- practical
- testable
- automation-oriented
- honest about unknowns
- detailed enough for a QA team to execute from it

---

## Optional Enhancements

If enough information is available, the agent may additionally provide:
- risk-based test coverage heatmap
- scenario-to-module traceability table
- scenario-to-automation phase mapping
- suggested Playwright folder structure
- sample tags such as `@smoke`, `@regression`, `@checkout`, `@mobile`, `@au`, `@nz`

---

## Sample Automation Roadmap Format

### Phase 1 — Immediate Automation
- homepage smoke
- navigation smoke
- search smoke
- PDP load
- add to cart
- cart validation
- checkout entry

### Phase 2 — High-Value Regression
- filters and sorting
- quick add
- login/logout
- register
- wishlist
- promo code validation
- shipping selection

### Phase 3 — Advanced Coverage
- full guest checkout
- full logged-in checkout
- account management
- order history
- localization validation
- negative checkout cases
- mobile-specific flows

---

## Sample Output Style Rules

- Use clear headings
- Use bullet points for findings
- Use tables for prioritization
- Use numbered steps for scenarios
- Do not mix assumptions with facts
- Explicitly mark unknown items with:
  - **Unknown**
  - **Needs confirmation**
  - **Not directly observable**

---

## Final Instruction for the Agent

When given website URLs:

1. Explore as deeply as available content allows
2. Summarize what is actually observable
3. Infer missing flows carefully and label them as assumptions
4. Produce a complete E2E scenario library
5. Prioritize scenarios by business impact and automation value
6. Create a realistic automation plan that a QA team can implement

The result must be immediately useful to a real QA/QC team.

---
