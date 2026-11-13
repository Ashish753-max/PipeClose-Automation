# 🏗️ PipeClose CRM Automation Testing Framework - Architecture Documentation

**Project:** PipeClose CRM Automation Testing
**Framework:** Playwright Test + JavaScript (CommonJS)
**Application under test:** PipeClose CRM staging - `https://staging.pipeclose.com`
**Purpose:** End-to-End (E2E) UI automation of the CRM workflows
**Status:** Active development
**Last Updated:** November 13, 2026

---

## 📋 Table of Contents
1. [Framework Overview](#1-framework-overview)
2. [Technology Stack](#2-technology-stack)
3. [Architecture Design](#3-architecture-design)
4. [Directory Structure](#4-directory-structure)
5. [Test Modules](#5-test-modules)
6. [Shared Helpers (`tests/common/`)](#6-shared-helpers-testscommon)
7. [Test Execution Flow](#7-test-execution-flow)
8. [Configuration](#8-configuration)
9. [Test Patterns & Conventions](#9-test-patterns--conventions)
10. [Reporting & Artifacts](#10-reporting--artifacts)
11. [CI/CD with Jenkins](#11-cicd-with-jenkins)
12. [Maintenance & Extending the Framework](#12-maintenance--extending-the-framework)
13. [Roadmap](#13-roadmap)
- [Appendix A: Quick Reference Commands](#appendix-a-quick-reference-commands)
- [Appendix B: Framework Statistics](#appendix-b-framework-statistics)

---

## 1. Framework Overview

### Purpose
The framework tests PipeClose CRM end to end through its UI, on the staging environment. It covers:
- Log in, Sign up, Sign out and the user profile
- Leads: create, search, sort, archive, delete, the Lead details page and Lead → Deal conversion
- Deals: create, search, archive, delete, Won/Lost and the Deal details page
- Contacts (People and Organizations) search
- Activities and the Calendar
- Mail: send, drafts, scheduled emails, star, archive/spam/trash actions
- AI features: AI Reply, Email Summarizer, Suggest Next Email, Dictate, AI Agent, AI Knowledge Base
- Campaigns (sequences and enrollment)
- Prospects search filters
- Global search, Notifications, Company settings
- Import and Export of CRM data
- Responsive layout on phone and tablet screens

### Scope
- **In scope:** UI workflows, field validation, data saved and shown after reload, navigation, layout
- **Also checked:** the API responses behind UI actions (for example that "Create deal" returns a success status), read with `page.waitForResponse`
- **Out of scope:** standalone API tests, backend unit tests, direct database access

### Key Features
✅ **Shared helper layer** - each module's steps live once in `tests/common/` and are reused by its tests
✅ **Self-contained tests** - a test creates the data it needs (a lead, a deal, an activity) and cleans up where the flow allows
✅ **Unique test data** - titles and emails carry `Date.now()` so runs never clash
✅ **Module screenshot folders** - every test saves its screenshots in `screenshots/<Module>/`
✅ **Known-defect handling** - tests for known bugs are marked expected-to-fail, and `SHOW_DEFECTS=1` shows them
✅ **Parallel execution** with a configurable number of workers
✅ **HTML, JUnit and list reporting**, with videos and traces
✅ **Jenkins pipeline** with build parameters

---

## 2. Technology Stack

| Component | Version | Purpose |
|-----------|---------|---------|
| Node.js | LTS (v18+) | Runtime |
| @playwright/test | ^1.61.1 | Browser automation, test runner and assertions |
| @types/node | ^25.0.1 | Editor type hints |
| JavaScript (CommonJS) | ES2020+ | Test language (`require` / `module.exports`) |
| Chromium | Bundled with Playwright | Browser used for the suite |
| Jenkins | - | CI pipeline (`Jenkinsfile`) |

**Tools:** Visual Studio Code, Git & GitHub, Playwright HTML Reporter, Playwright Trace Viewer.

---

## 3. Architecture Design

The framework has three layers: **test specs** describe the scenario, **shared helpers** hold the steps for each CRM module, and **Playwright** drives the browser against staging.

```
┌──────────────────────────────────────────────────────────────────┐
│ TEST LAYER  - tests/<Module>/*.spec.js                           │
│   One scenario per file: the data and the expected result.       │
│   Lead · Deal · Deal Details · Lead Details · Activities · Mail  │
│   AI Reply · Campaign · Export · Import · Prospects · ...        │
└───────────────────────────────┬──────────────────────────────────┘
                                │ require('../common/<helper>')
┌───────────────────────────────▼──────────────────────────────────┐
│ HELPER LAYER - tests/common/*.js                                 │
│   Login:    auth.js, loginConfig.js, createDeal.loginStaging     │
│   Modules:  createLead, createDeal, dealDetails, leadDetails,    │
│             activity, campaign, mail, emailFolders, aiReply, ... │
│   Checks:   responsive.js (layout), authPages.knownDefect        │
└───────────────────────────────┬──────────────────────────────────┘
                                │ Page, Locator, expect, waitForResponse
┌───────────────────────────────▼──────────────────────────────────┐
│ PLAYWRIGHT LAYER - playwright.config.js                          │
│   Chromium project · workers · retries · timeouts · reporters    │
│   video / trace capture                                          │
└───────────────────────────────┬──────────────────────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────────┐
│ APPLICATION UNDER TEST - https://staging.pipeclose.com           │
└──────────────────────────────────────────────────────────────────┘

ARTIFACTS: screenshots/<Module>/ · test-results/ (videos, traces, junit.xml)
           playwright-report/ (HTML report) · Jenkins build page
```

**Why helpers instead of a classic Page Object Model:** each helper module is organised around a CRM workflow (for example `dealDetails.openNewDeal` → `editField` → `expectSavedAfterReload`) rather than one class per page. Tests stay a few lines long, and a UI change is fixed in one helper.

---

## 4. Directory Structure

```
C:/CRM/
├── package.json                          # Dependencies and npm scripts
├── playwright.config.js                  # Playwright configuration
├── Jenkinsfile                           # Jenkins pipeline
├── README.md                             # Project overview
├── AUTOMATION_FRAMEWORK_ARCHITECTURE.md  # This document
├── JENKINS_SETUP.md / JENKINS_QUICK_START.md
│
├── tests/
│   ├── common/                 # Shared helpers (see section 6)
│   │
│   ├── Login/                  # Log in, Sign up validation, responsive auth pages
│   ├── SignOut/                # Log out
│   ├── Profile/                # User profile
│   ├── Dashboard/              # Dashboard
│   ├── Settings/               # Company settings
│   │
│   ├── Lead/                   # Create, search, sort, archive/delete leads, responsive
│   ├── Lead Details/           # Edit and validate fields on a lead's page, UX checks
│   ├── LeadToDeal/             # Convert a lead into a deal
│   ├── Deal/                   # Create, search, archive/delete deals, responsive
│   ├── Deal Details/           # Edit and validate fields, Won/Lost, Suggest Next Email
│   ├── Contacts/               # People and Organizations search
│   │
│   ├── Activities/             # Create, schedule, search, link, edit, mark done, delete
│   ├── Calendar/               # Create, view, edit, delete events, mark done
│   ├── Notification/           # Notification panel and navigation
│   │
│   ├── Email Sent/             # Send emails, Sent folder
│   ├── Mail Draft/             # Save and reopen drafts
│   ├── ScheduleEmail/          # Schedule, edit, delete scheduled emails
│   ├── Email Actions/          # Star, mark unread, archive/spam/trash and back, delete forever
│   ├── PipecloseToHostingerSync/ # Mail sync with the Hostinger mailbox
│   │
│   ├── AI Agent/               # AI Agent
│   ├── AI Reply/               # AI-generated replies
│   ├── Summarizer Email/       # Email summarizer
│   ├── KnowledgeBase/          # AI Knowledge Base sections
│   ├── Campaign/               # Sequences and enrollment
│   ├── Prospects/              # Prospect search filters, responsive
│   ├── Global Search/          # Header search for leads, deals, organizations
│   │
│   ├── Import/                 # Import and merge people, organizations, leads, deals
│   ├── Export/                 # CSV/XLSX exports of every object
│   │
│   ├── Basic Script/           # Learning scripts (skipped on CI)
│   └── Practice/               # Learning scripts (skipped on CI)
│
├── screenshots/                # Screenshots saved by the tests, one folder per module
│   ├── Activities/  AIReply/  Campaign/  Contacts/  Dashboard/  Deal/  DealDetails/
│   ├── DealWonLost/  Dictate/  EmailActions/  EmailSent/  Export/  GlobalSearch/
│   ├── KnowledgeBase/  Lead/  LeadDetails/  LeadToDeal/  Login/  MailDraft/
│   ├── Profile/  Prospect-Filters/  Settings/  SignOut/  StarEmail/  SummarizerEmail/
│   └── *-Responsive/           # Auth-, Deal-, Lead-, Prospect-Responsive
│
├── test-results/               # Per-test output: videos, traces, junit.xml (git-ignored)
└── playwright-report/          # HTML report (git-ignored)
```

---

## 5. Test Modules

| Module (folder) | Tests | Helper(s) used | What is covered |
|---|---|---|---|
| `Login/` | 6 | `authPages.js`, `responsive.js` | Log in, Log in/Sign up field validation, responsive auth pages |
| `SignOut/` | 2 | `auth.js` | Log out and return to the home page |
| `Profile/`, `Dashboard/` | 1 + 1 | `auth.js` | Profile view, dashboard actions |
| `Settings/` | 1 | `companySettings.js` | Company details: edit, validate, restore |
| `Lead/` | 10 | `createLead.js`, `responsive.js` | Create (basic and all fields), search, sort by, archive/delete, responsive |
| `Lead Details/` | 18 | `leadDetails.js`, `dealDetails.js` | Edit person/organization fields, value, close date, field validation, UX/accessibility |
| `LeadToDeal/` | 6 | `createLead.js` | Convert a lead to a deal from the form and the action menu |
| `Deal/` | 13 | `createDeal.js`, `archiveDeal.js` | Create, search, archive and delete, responsive |
| `Deal Details/` | 16 | `dealDetails.js` | Edit and validate fields, Won/Lost, Suggest Next Email (standard, deep research, save draft, dictate) |
| `Contacts/` | 1 | `auth.js` | People and Organizations search |
| `Activities/` | 27 | `activity.js`, `scheduleActivity.js` | Create/schedule each type, search, link to deal/person/organization, edit, priority, free/busy, mark done/to-do, delete |
| `Calendar/` | 9 | `auth.js` | Create, view, edit, delete events, mark done/not done |
| `Notification/` | 6 | `auth.js` | Open, mark read, clear all, navigate to Inbox/Calendar |
| `Email Sent/` | 8 | `mail.js` | Send emails and check the Sent folder |
| `Mail Draft/` | 6 | `mail.js` | Save a draft and reopen it |
| `ScheduleEmail/` | 7 | `mail.js` | Schedule for a time/tomorrow/Monday, edit, delete |
| `Email Actions/` | 10 | `mail.js`, `emailFolders.js`, `starEmail.js` | Star, mark unread, move to/from Archive, Spam, Trash, delete forever, empty Trash |
| `AI Reply/` | 5 | `aiReply.js` | Generate an AI reply to Inbox emails and check the draft |
| `Summarizer Email/` | 5 | `summarizeEmail.js` | Summarize Inbox emails |
| `AI Agent/` | 1 | `auth.js` | AI Agent |
| `KnowledgeBase/` | 6 | `knowledgeBase.js` | Each Knowledge Base section: fill, save, reload, clear |
| `Campaign/` | 3 | `campaign.js`, `mail.js` | Create a sequence, add an email step, enroll a contact, check sent/opened |
| `Prospects/` | 9 | `prospects.js`, `responsive.js` | Include filters (company, job title, location, revenue...), responsive |
| `Global Search/` | 6 | `globalSearch.js` | Search leads, deals and organizations from the header |
| `Import/` | 10 | `auth.js` | Import people, organizations, leads, deals; merge; rollback; delete |
| `Export/` | 29 | `exportData.js` | CSV/XLSX exports (all, filtered, archived, all columns) and checking the file content |

---

## 6. Shared Helpers (`tests/common/`)

### 6.1 Login

| File | Exports | Notes |
|---|---|---|
| `auth.js` | `login(page)` | Opens staging, clicks "Log in", fills the credentials from `loginConfig.js`, submits |
| `loginConfig.js` | `{ email, password }` | The one place the test account is set |
| `createDeal.js` | `loginStaging(page)` | Login that waits for whichever of the "Log in" link or Email field shows first - used by most module helpers |

```javascript
const login = require('../common/auth');

test('...', async ({ page }) => {
  await login(page);
});
```

> **Security note:** the credentials are in `loginConfig.js`. Do not copy them into specs or docs; moving them to environment variables is on the roadmap.

### 6.2 Module helpers

| File | Main exports | Used by |
|---|---|---|
| `createLead.js` | `openLeads`, `addLead`, `leadCount` | Lead, Lead Details, LeadToDeal |
| `leadDetails.js` | `openNewLead`, `editValue`, `tryValue`, `expectValueRejected`, `reloadLead` | Lead Details |
| `createDeal.js` | `createDeal`, `addDeal`, `loginStaging` | Deal and most other helpers |
| `archiveDeal.js` | `findTodaysDeals`, `archiveDeal`, `openArchived`, `deleteArchivedDeal` | Deal (archive/delete) |
| `dealDetails.js` | `openNewDeal`, `fieldRow`, `editField`, `expectSavedAfterReload`, `expectRejected`, `errorToast` | Deal Details, Lead Details |
| `activity.js` | `createActivity`, `searchActivity`, `openEditForm`, `linkDeal`, `linkPerson`, `deleteActivity`, ... | Activities |
| `scheduleActivity.js` | `scheduleActivity`, `setTime` | Activities (schedule) |
| `mail.js` | `openMail`, `useMailbox`, `openSent`, `openFolder`, `emailRows`, `isEmailList`, `expectCount`, `scrollToEmailRow` | Mail, Email Actions, Campaign |
| `emailFolders.js` | `moveBackToInbox`, `deleteForever`, `emptyTrash` | Email Actions (Archive/Spam/Trash → Inbox, delete forever) |
| `starEmail.js` | `starEmail` | Email Actions (star) |
| `aiReply.js` | `aiReply(page, index)` | AI Reply |
| `summarizeEmail.js` | `summarizeEmail(page, index)` | Summarizer Email |
| `campaign.js` | `openCampaigns`, `createSequence`, `openSequence`, `openEnrolled`, `deleteSequence`, ... | Campaign |
| `knowledgeBase.js` | `openKnowledgeBase`, `openSection`, `saveSection`, `clearSection`, ... | KnowledgeBase |
| `prospects.js` | `openProspects`, `search`, `expectRows`, `openSection`, ... | Prospects |
| `globalSearch.js` | `globalSearch(page, query)` | Global Search |
| `exportData.js` | `exportAllColumns` (reads CSV and XLSX files) | Export |
| `companySettings.js` | `openCompanySettings`, `readCompany`, `restoreCompany`, `saveChanges`, ... | Settings |
| `authPages.js` | `openLogin`, `openSignUp`, `knownDefect`, `toast`, `watchRequests`, `expectNothingSent`, ... | Login (validation) |
| `responsive.js` | `findLayoutProblems`, `findCutOffPlaceholders`, `findClippedText`, `isTruncated`, ... | `*Responsive.spec.js` tests |
| `dictation-sample.wav` | Audio file | Suggest Next Email Dictate test |

### 6.3 Rules for helpers
- One helper file per CRM module or workflow, named after it.
- A helper opens what it needs (for example `openNewDeal` logs in, creates a deal and opens its page), so a test can start from one call.
- Helpers assert as they go with `expect(..., 'message')`, so a failure says which step broke.
- Helpers that change shared staging data put it back (`companySettings.restoreCompany`, `emailFolders` ends with the email back in the Inbox).
- Destructive helpers only touch test data (for example `emailFolders` only deletes emails whose subject starts with "Email Actions test").

---

## 7. Test Execution Flow

```
1. CONFIG      playwright.config.js: Chromium, workers, retries, timeouts, reporters
      │        (on CI: Practice/, Basic Script/ and the practice login tests are ignored)
      ▼
2. LOGIN       login(page) or loginStaging(page) on https://staging.pipeclose.com
      ▼
3. SETUP DATA  the helper creates what the test needs: a lead, a deal, an activity,
               a sequence... with a unique name (Date.now())
      ▼
4. ACTIONS     the test drives the UI through the helper
      ▼
5. VERIFY      expect() on the UI, often after page.reload(), plus the API response
               behind the action (page.waitForResponse)
      ▼
6. EVIDENCE    page.screenshot({ path: 'screenshots/<Module>/<Test>-<step>.png' })
      ▼
7. CLEAN UP    delete what was created, or restore what was changed, where the flow allows
      ▼
8. REPORT      list + HTML + JUnit (CI); video and trace kept as configured
```

### Parallel execution
- `fullyParallel: true` - tests run in parallel, also within a file.
- **Workers:** `WORKERS` environment variable; on CI 2 by default, locally Playwright's default. Staging slows down and pages time out above about 4 workers, and all tests share one account.
- **Retries:** 2 on CI, 0 locally.

---

## 8. Configuration

### 8.1 `playwright.config.js`

| Setting | Value |
|---|---|
| `testDir` | `./tests` |
| `testIgnore` (CI only) | `**/Practice/**`, `**/Basic Script/**`, `Login/LoginPractice.spec.js`, `Login/TMLoginSuccessful.spec.js` |
| `fullyParallel` | `true` |
| `forbidOnly` | `true` on CI |
| `retries` | 2 on CI, 0 locally |
| `workers` | `WORKERS` env var, else 2 on CI, else Playwright default |
| `reporter` | CI: `list` + `html` + `junit` (`test-results/junit.xml`); locally: `html` |
| `timeout` | 120 000 ms per test (long tests raise it with `test.setTimeout`) |
| `trace` | `on-first-retry` |
| `video` | Locally `on`; on CI `retain-on-failure`; 1280×720, saved in `test-results/` |
| Project | `chromium` (Desktop Chrome), output in `test-results/chromium` |

### 8.2 Environment variables

| Variable | Effect |
|---|---|
| `CI` | Turns on the CI settings above (set by the Jenkinsfile) |
| `WORKERS` | Number of tests that run at the same time |
| `SHOW_DEFECTS` | `1` makes the known-defect tests fail so the report shows the defect (see 9.4) |

### 8.3 npm scripts (`package.json`)

| Script | Command |
|---|---|
| `npm test` | `playwright test` |
| `npm run test:chrome` | `playwright test --project=chromium` |
| `npm run test:ui` | `playwright test --ui` |
| `npm run test:debug` | `playwright test --debug` |
| `npm run report` | `playwright show-report` |

### 8.4 Setup
```bash
npm install
npx playwright install chromium
```

---

## 9. Test Patterns & Conventions

### 9.1 Standard test
A spec holds the scenario's data and expected result; the steps come from the module helper.

```javascript
const { test } = require('@playwright/test');
const { openNewDeal, editField, expectSavedAfterReload } = require('../common/dealDetails');

test("Deal details - edit person email", async ({ page }) => {
  test.setTimeout(180000);
  await openNewDeal(page);

  // Unique per run: the app rejects an email already used by another deal
  const fields = [
    { section: 'Person', label: 'Email', value: `rahul.verma+${Date.now()}@gmail.com` },
  ];
  for (const field of fields) await editField(page, field);

  await expectSavedAfterReload(page, fields);
  await page.screenshot({ path: 'screenshots/DealDetails/DealDetails-EditPersonEmail.png' });
});
```

### 9.2 Naming
- **Folders:** one per CRM module, under `tests/`.
- **Spec files:** `<Action><Object>[N].spec.js`, for example `CreateDeal3.spec.js`, `ArchiveDeleteDeal2.spec.js`, `LeadSortBy.spec.js`.
- **Screenshots:** `screenshots/<Module>/<TestName>-<step>.png`, for example `screenshots/Deal/DealSearch-3-organization.png`. Numbered steps keep a test's screenshots in order.
- **Test data:** add `Date.now()` to names and emails that must be unique.

### 9.3 Waiting and verifying
- Wait for the element or the response, not a fixed time: `locator.waitFor()`, `expect(locator).toBeVisible()`, `page.waitForResponse(...)`.
- Check that a save really happened: reload the page and check the value (`expectSavedAfterReload`), and check the API status of the request.
- Short `waitForTimeout` pauses are used only where the staging UI needs them (for example between typing in login fields).
- Prefer role, label, placeholder and text locators (`getByRole`, `getByPlaceholder`, `getByText`); use XPath/CSS only where no accessible name exists.

### 9.4 Known defects
Tests for a known staging bug call `knownDefect('description')` (from `authPages.js`), which marks the test as expected to fail. The run stays green while the bug is open; Playwright flags the test when the bug is fixed. Run with `SHOW_DEFECTS=1` (Jenkins: `SHOW_DEFECTS` parameter) to see the failures in the report.

### 9.5 Shared staging data
All tests use one staging account, so:
- create your own records instead of relying on existing ones;
- restore anything you change on shared records;
- never sign up with a new email on staging unless the test is about sign up.

---

## 10. Reporting & Artifacts

| Artifact | Location | When |
|---|---|---|
| HTML report | `playwright-report/index.html` (`npm run report`) | Every run |
| JUnit results | `test-results/junit.xml` | CI runs |
| Videos | `test-results/<test>/video.webm` | Every test locally; failed tests on CI |
| Traces | `test-results/<test>/trace.zip` (`npx playwright show-trace`) | First retry of a failed test |
| Screenshots | `screenshots/<Module>/` | Saved by the tests at their checkpoints |

The screenshots folder is committed to the repository and sorted by module (`screenshots/Activities/`, `screenshots/Deal/`, `screenshots/Lead/`...), so each module's evidence is in one place.

---

## 11. CI/CD with Jenkins

**File:** `Jenkinsfile` (Windows agent, `bat` steps). Details: `JENKINS_SETUP.md`, `JENKINS_QUICK_START.md`.

**Stages:** Checkout → Install dependencies → Install browser → Run tests

**Build parameters:**

| Parameter | Default | Purpose |
|---|---|---|
| `TEST_PATH` | empty (whole suite) | Folder or file to run, for example `tests/Deal Details` |
| `WORKERS` | `2` | Tests that run at the same time |
| `SHOW_DEFECTS` | `false` | Make known-defect tests fail and show in the report |

**Options:** 6-hour timeout, last 20 builds kept (files for the last 10), no concurrent builds (they would share the account and data).

**Results:** failed tests make the build **UNSTABLE** (yellow); the build is **FAILED** (red) only when Playwright could not run. After every build Jenkins publishes the JUnit results and the "Playwright Test Report", and archives `playwright-report/`, `test-results/` and `screenshots/`.

---

## 12. Maintenance & Extending the Framework

### Adding a test to an existing module
1. Add `<Name>.spec.js` to the module's folder in `tests/`.
2. Use the module's helper from `tests/common/`; add a function there if a step is missing.
3. Save screenshots in `screenshots/<Module>/`.

### Adding a new module
1. Create `tests/<Module>/` and `screenshots/<Module>/`.
2. Create `tests/common/<module>.js` with the module's steps and `module.exports`.
3. Add the module to sections 4, 5 and 6 of this document and to `README.md`.

### Common issues

| Issue | Solution |
|---|---|
| Locator breaks after a UI change | Fix it once in the module helper |
| Timeouts on CI | Lower `WORKERS`; staging slows down above about 4 |
| Flaky step | Wait for the element or the API response instead of a fixed delay |
| Data clash between runs | Use `Date.now()` in names and emails |
| Known staging bug | Mark the test with `knownDefect(...)` |

### Git workflow
- Work on a feature branch, open a Pull Request to `main`.
- Commit specs, helpers and their screenshots together by module.

---

## 13. Roadmap

**Done**
- ✅ Shared helper layer for every module
- ✅ Module-based screenshot folders
- ✅ Jenkins pipeline with parameters, JUnit and HTML reports
- ✅ Responsive (phone/tablet) layout checks
- ✅ Known-defect handling

**Planned**
- 📋 Credentials in environment variables instead of `loginConfig.js`
- 📋 Base URL in `playwright.config.js` (`use.baseURL`) instead of in each helper
- 📋 Shared login state (`storageState`) to skip the UI login in each test
- 📋 API-level tests for setup and clean-up
- 📋 Firefox and WebKit projects

---

## Appendix A: Quick Reference Commands

```bash
# Install
npm install
npx playwright install chromium

# Run the whole suite
npx playwright test

# Run one module or one file
npx playwright test "tests/Deal Details"
npx playwright test tests/Lead/LeadSearch.spec.js

# Run with a visible browser / in the UI mode / in debug mode
npx playwright test --headed
npx playwright test --ui
npx playwright test --debug

# Choose the number of workers
npx playwright test --workers=1

# Show known defects as failures (PowerShell)
$env:SHOW_DEFECTS = '1'; npx playwright test tests/Login

# Open the last HTML report / a trace
npx playwright show-report
npx playwright show-trace test-results/<test>/trace.zip
```

---

## Appendix B: Framework Statistics

| | |
|---|---|
| Test modules (folders in `tests/`, without `common/`) | 30 |
| Spec files | 231 (223 run on CI, without Practice and Basic Script) |
| Shared helper files in `tests/common/` | 22 |
| Screenshot folders | 29 |
| Browser | Chromium |

---

**Author:** Ashish Rai - QA Engineer
