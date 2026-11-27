# 🏗️ PipeClose CRM Automation Testing Framework - Architecture Documentation

**Project:** PipeClose CRM Automation Testing
**Framework:** Playwright Test + JavaScript (CommonJS)
**Application under test:** PipeClose CRM staging - `https://staging.pipeclose.com`
**Purpose:** End-to-End (E2E) UI automation of the CRM workflows
**Status:** Active development
**Last Updated:** November 27, 2026

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
11. [CI/CD with Jenkins and GitHub Actions](#11-cicd-with-jenkins-and-github-actions)
12. [Maintenance & Extending the Framework](#12-maintenance--extending-the-framework)
13. [Roadmap](#13-roadmap)
- [Appendix A: Quick Reference Commands](#appendix-a-quick-reference-commands)
- [Appendix B: Framework Statistics](#appendix-b-framework-statistics)

---

## 1. Framework Overview

### Purpose
The framework tests PipeClose CRM end to end through its UI, on the staging environment. It covers:
- Log in, Sign up, Sign out and Profile settings
- Leads: create, search, sort, filter, page through, archive, unarchive and delete; the Lead details page and Lead → Deal conversion
- Deals: create, search, sort, archive, unarchive, delete, Won/Lost and reopen; the Deal details page; renaming a pipeline
- Contacts (People and Organizations) search
- Activities and creating Calendar events
- Mail: compose, send (Cc/Bcc, long formatted body, linked to a deal), reply, forward, search, drafts, scheduled emails, star, archive/spam/trash actions
- AI features: AI Reply, Email Summarizer, Suggest Next Email, Dictate, AI Agent, AI Knowledge Base
- Campaigns: create, rename, delete, search and filter campaigns; sequences, enrolling leads and the emails they send
- Prospects search filters
- Global search, Notifications, Company settings
- Import and Export of CRM data, including deleting an export and downloading it again
- Responsive layout on phone and tablet screens

### Scope
- **In scope:** UI workflows, field validation, data saved and shown after reload, navigation, layout
- **Also checked:** the API responses behind UI actions (for example that "Create deal" returns a success status), read with `page.waitForResponse`
- **API as a helper:** newer tests call the app's API (`page.request`) to read data and to remove what they created
- **Out of scope:** standalone API tests, backend unit tests, direct database access

### Key Features
✅ **Shared helper layer** - each module's steps live once in `tests/common/` and are reused by its tests
✅ **Self-contained tests** - a test creates the data it needs (a lead, a deal, an activity) and cleans up where the flow allows
✅ **Clean-up that also runs after a failure** - newer tests clean up in `test.afterEach`, often through the API, and clear what an interrupted run left behind at the start of the next one
✅ **Unique test data** - titles and emails carry `Date.now()` so runs never clash
✅ **Module screenshot folders** - every test saves its screenshots in `screenshots/<Module>/`
✅ **Evidence PDFs** - each module's test evidence handed over as a PDF in `test-results/`
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
| GitHub Actions | - | Workflow in `.github/workflows/playwright.yml` (see 11.2) |

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
│   Login:    createDeal.loginStaging, loginConfig.js              │
│   Modules:  createLead, createDeal, dealDetails, leadDetails,    │
│             activity, campaign, mail, emailFolders, aiReply, ... │
│   Checks:   responsive.js (layout), authPages.knownDefect        │
└───────────────────────────────┬──────────────────────────────────┘
                                │ Page, Locator, expect, waitForResponse,
                                │ page.request (API reads and clean-up)
┌───────────────────────────────▼──────────────────────────────────┐
│ PLAYWRIGHT LAYER - playwright.config.js                          │
│   Chromium project · workers · retries · timeouts · reporters    │
│   video / trace capture                                          │
└───────────────────────────────┬──────────────────────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────────┐
│ APPLICATION UNDER TEST - https://staging.pipeclose.com           │
└──────────────────────────────────────────────────────────────────┘

ARTIFACTS: screenshots/<Module>/ · test-results/ (videos, traces, junit.xml, evidence PDFs)
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
├── .github/workflows/playwright.yml      # GitHub Actions workflow (see 11.2)
├── README.md                             # Project overview
├── AUTOMATION_FRAMEWORK_ARCHITECTURE.md  # This document
├── JENKINS_SETUP.md / JENKINS_QUICK_START.md
├── PipeClose_*.pdf                       # Handover guides: framework architecture, handover,
│                                         #   Jenkins integration, Playwright basics, Git/GitHub
│
├── tests/
│   ├── common/                 # Shared helpers (see section 6)
│   │
│   ├── Login/                  # Log in, Sign up validation, responsive auth pages
│   ├── SignOut/                # Log out
│   ├── Profile/                # Profile settings (Account tab)
│   ├── Dashboard/              # Dashboard
│   ├── Settings/               # Company settings
│   │
│   ├── Lead/                   # Create, search, sort, filter, pages, archive/unarchive/delete, responsive
│   ├── Lead Details/           # Edit and validate fields on a lead's page, UX checks
│   ├── LeadToDeal/             # Convert a lead into a deal
│   ├── Deal/                   # Create, search, sort, archive/unarchive/delete, pipeline name, responsive
│   ├── Deal Details/           # Edit and validate fields, Won/Lost, reopen, Suggest Next Email
│   ├── Contacts/               # People and Organizations search
│   │
│   ├── Activities/             # Create, schedule, search, link, edit, mark done, delete
│   ├── Calendar/               # Create events
│   ├── Notification/           # Notification panel and navigation
│   │
│   ├── Email Sent/             # Send emails (Cc/Bcc, long body, linked deal), Sent folder
│   ├── Email Compose/          # Compose form validation
│   ├── Email Reply/            # Reply to an email
│   ├── Email Forward/          # Forward an email
│   ├── Email Search/           # Search a mailbox by sender
│   ├── Mail Draft/             # Save and reopen drafts, edit a draft and send it
│   ├── ScheduleEmail/          # Schedule, edit, delete scheduled emails
│   ├── Email Actions/          # Star, mark unread, archive/spam/trash and back, delete forever
│   ├── PipecloseToHostingerSync/ # Mail sync with the Hostinger mailbox
│   │
│   ├── AI Agent/               # AI Agent
│   ├── AI Reply/               # AI-generated replies
│   ├── Summarizer Email/       # Email summarizer
│   ├── KnowledgeBase/          # AI Knowledge Base sections
│   ├── Campaign/               # Campaigns, sequences and enrollment
│   ├── Prospects/              # Prospect search filters, responsive
│   ├── Global Search/          # Header search for leads, deals, organizations
│   │
│   ├── Import/                 # Import people, organizations, deals; merge, rollback, delete
│   ├── Export/                 # CSV/XLSX exports of every object, delete, download again
│   │
│   ├── Basic Script/           # Learning scripts (skipped on CI)
│   ├── Practice/               # Learning scripts (skipped on CI)
│   └── JavaScript-Guide.md, Playwright-docs.md   # Learning notes
│
├── screenshots/                # Screenshots saved by the tests, one folder per module
│   ├── Activities/  AIReply/  Campaign/  Contacts/  Dashboard/  Deal/  DealDetails/
│   ├── DealWonLost/  Dictate/  EmailActions/  EmailCompose/  EmailForward/  EmailReply/
│   ├── EmailSearch/  EmailSent/  Export/  GlobalSearch/  KnowledgeBase/  Lead/  LeadDetails/
│   ├── LeadToDeal/  Login/  MailDraft/  Profile/  Prospect-Filters/  Settings/  SignOut/
│   ├── StarEmail/  SummarizerEmail/
│   └── *-Responsive/           # Auth-, Deal-, Lead-, Prospect-Responsive
│
├── test-results/               # Per-test output in chromium/: videos, traces; junit.xml (git-ignored)
│                               #   + the committed evidence PDFs "PipeClose Evidence - <Module>.pdf"
├── playwright-report/          # HTML report (git-ignored)
├── e2e/example.spec.js         # Playwright's example test, not run (testDir is ./tests)
└── videos/login-trace.zip      # An old trace of the login
```

---

## 5. Test Modules

**Files** are the spec files Playwright collects, **Tests** the tests in them (a data-driven file holds many). *Own login* means the specs log in with their own steps instead of a helper (see 6.1).

| Module (folder) | Files | Tests | Helper(s) used | What is covered |
|---|---|---|---|---|
| `Login/` | 5 | 115 | `authPages.js`, `responsive.js`, `loginConfig.js` | Log in, Log in/Sign up field validation, responsive auth pages |
| `SignOut/` | 2 | 2 | own login | Log out and return to the home page |
| `Profile/` | 2 | 22 | `profileSettings.js`, `companySettings.js`, `authPages.js` | Profile settings, Account tab: saved values, edit, validation, profile picture; the profile is put back after the tests |
| `Dashboard/` | 1 | 1 | own login | Dashboard actions |
| `Settings/` | 1 | 15 | `companySettings.js` | Company details: edit, validate, restore |
| `Lead/` | 14 | 18 | `createLead.js`, `archiveLead.js`, `leadList.js`, `dealDetails.js` | Create (basic and all fields), search, sort by, filters (temperature, lists), rows per page and paging, archive, unarchive, delete (also from Archived), responsive |
| `Lead Details/` | 18 | 18 | `leadDetails.js`, `dealDetails.js` | Edit person/organization fields, value, close date, field validation, UX/accessibility |
| `LeadToDeal/` | 2 | 2 | `createLead.js` | Convert a lead to a deal from the form and the Action menu |
| `Deal/` | 16 | 17 | `createDeal.js`, `archiveDeal.js`, `responsive.js` | Create, search, sort by, archive (also from the Action menu), unarchive, delete, rename a pipeline, responsive |
| `Deal Details/` | 17 | 18 | `dealDetails.js` | Edit and validate fields, Cancel an edit, Won/Lost and reopen, Suggest Next Email (standard, deep research, save draft, dictate) |
| `Contacts/` | 1 | 2 | `createDeal.js` (login) | People and Organizations search |
| `Activities/` | 27 | 30 | `activity.js`, `scheduleActivity.js` | Create/schedule each type, search, link to deal/person/organization, edit, priority, free/busy, mark done/to-do, delete |
| `Calendar/` | 4 | 4 | own login | Create events. `Delete_Event`, `Edit_Event`, `MarkDone`, `MarkNotDone` and `View_Event.spec.js` are empty files |
| `Notification/` | 6 | 6 | own login | Open, mark read, clear all, navigate to Inbox/Calendar |
| `Email Sent/` | 11 | 11 | `mail.js`, `createDeal.js` | Send emails (Cc/Bcc, long formatted body, linked to a deal) and check them in the Sent folder |
| `Email Compose/` | 1 | 1 | `mail.js`, `createDeal.js` | Compose form validation |
| `Email Reply/` | 1 | 1 | `mail.js`, `createDeal.js` | Reply to an email |
| `Email Forward/` | 1 | 1 | `mail.js`, `createDeal.js` | Forward an email |
| `Email Search/` | 1 | 1 | `mail.js`, `createDeal.js` | Search a mailbox by sender |
| `Mail Draft/` | 7 | 7 | `mail.js`, `createDeal.js` | Save a draft and reopen it, edit a draft and send it |
| `ScheduleEmail/` | 7 | 7 | own login | Schedule for a time/tomorrow/Monday, edit, delete |
| `Email Actions/` | 10 | 11 | `emailFolders.js`, `starEmail.js`, `createDeal.js` | Star, mark unread, move to/from Archive, Spam, Trash, delete forever, empty Trash |
| `PipecloseToHostingerSync/` | 1 | 1 | own login | Mail sync with the Hostinger mailbox |
| `AI Reply/` | 5 | 5 | `aiReply.js` | Generate an AI reply to Inbox emails and check the draft |
| `Summarizer Email/` | 5 | 5 | `summarizeEmail.js` | Summarize Inbox emails |
| `AI Agent/` | 1 | 1 | own login | AI Agent |
| `KnowledgeBase/` | 6 | 6 | `knowledgeBase.js` | Each Knowledge Base section: fill, save, reload, clear |
| `Campaign/` | 12 | 12 | `campaign.js`, `mail.js`, `createDeal.js` | Create, rename, delete, search, filter by status (Completed, Draft); add and delete a sequence; sending account, email step, activate, enroll leads; the sent email (sender, subject, first name, unsubscribe link) |
| `Prospects/` | 9 | 10 | `prospects.js`, `responsive.js` | Include filters (company, job title, location, revenue...), responsive |
| `Global Search/` | 6 | 6 | `globalSearch.js` | Search leads, deals and organizations from the header |
| `Import/` | 6 | 6 | own login | Import people, organizations and deals; merge people; roll back and delete an import |
| `Export/` | 30 | 38 | `exportData.js`, `deleteExport.js` | CSV/XLSX exports (all, filtered, archived, all columns), Notes as HTML/plain text, delete an export, Download again, checking the file content |
| `Practice/`, `Basic Script/` | 4 + 4 | 8 | - | Learning scripts, not run on CI |

**Long tests:** `Campaign/CampaignTestCase2.spec.js` waits for scheduled campaign emails and can take about 45 minutes. It and `CampaignSequenceEnroll.spec.js` send real emails.

---

## 6. Shared Helpers (`tests/common/`)

### 6.1 Login

| File | Exports | Notes |
|---|---|---|
| `createDeal.js` | `loginStaging(page)` | The login the helpers and the newer specs use: opens staging and waits for whichever of the "Log in" link or the Email field shows first |
| `loginConfig.js` | `{ email, password }` | The one place the test account should be set |
| `auth.js` | `login(page)` | Older login with the same steps; no spec uses it now |

```javascript
const { loginStaging } = require('../common/createDeal');

test('...', async ({ page }) => {
  await loginStaging(page);
});
```

> **Security note:** newer specs take the credentials from `loginConfig.js` through `loginStaging`. Older specs (most of them titled "valid login") log in with their own steps and have the credentials written in. Do not copy the credentials into new specs or docs; moving them to environment variables is on the roadmap.

### 6.2 Module helpers

| File | Main exports | Used by |
|---|---|---|
| `createLead.js` | `openLeads`, `addLead`, `leadCount` | Lead, LeadToDeal; `leadDetails.js`, `archiveLead.js` |
| `leadDetails.js` | `openNewLead`, `editValue`, `tryValue`, `expectValueRejected`, `reloadLead`, ... | Lead Details |
| `archiveLead.js` | `leadRow`, `openRowMenu`, `archiveLead`, `openArchivedLeads`, `openListView`, `removeLeadForever`, ... | Lead (archive, unarchive, delete from Archived); `removeLeadForever` deletes a test lead through the API |
| `leadList.js` | `readLeads`, `loadLeads`, `expectTableShows`, `leadCounter`, `rowsPerPage`, `nextPage`, `previousPage`, ... | Lead (filters, pagination) |
| `createDeal.js` | `createDeal`, `addDeal`, `loginStaging` | Deal and most other helpers |
| `archiveDeal.js` | `findTodaysDeals`, `archiveDeal`, `openArchived`, `deleteArchivedDeal` | Deal (archive, unarchive, delete) |
| `dealDetails.js` | `openNewDeal`, `fieldRow`, `editField`, `expectSavedAfterReload`, `expectRejected`, `errorToast`, `reloadDeal`, `showDeals` | Deal Details, Lead Details, Lead |
| `activity.js` | `createActivity`, `searchActivity`, `openEditForm`, `linkDeal`, `linkPerson`, `deleteActivity`, ... | Activities |
| `scheduleActivity.js` | `scheduleActivity`, `setTime` | Activities (schedule) |
| `mail.js` | `openMail`, `useMailbox`, `openSent`, `openFolder`, `emailRows`, `isEmailList`, `expectCount`, `scrollToEmailRow` | Email Sent, Compose, Reply, Forward, Search, Mail Draft, Campaign; `emailFolders.js`, `starEmail.js` |
| `emailFolders.js` | `moveBackToInbox`, `deleteForever`, `emptyTrash` | Email Actions (Archive/Spam/Trash → Inbox, delete forever) |
| `starEmail.js` | `starEmail` | Email Actions (star) |
| `aiReply.js` | `aiReply(page, index)` | AI Reply |
| `summarizeEmail.js` | `summarizeEmail(page, index)` | Summarizer Email |
| `campaign.js` | `openCampaigns`, `openCampaign`, `createCampaign`, `renameCampaign`, `deleteCampaign`, `deleteCampaignIfExists`, `filterByStatus`, `createSequence`, `chooseSendingAccount`, `addEmailStep`, `activateSequence`, `enrollPickedLeads`, `openEnrolled`, `deleteSequence`, ... | Campaign |
| `knowledgeBase.js` | `openKnowledgeBase`, `openSection`, `saveSection`, `clearSection`, ... | KnowledgeBase |
| `prospects.js` | `openProspects`, `search`, `expectRows`, `openSection`, ... | Prospects |
| `globalSearch.js` | `globalSearch(page, query)` | Global Search |
| `exportData.js` | `openExport`, `exportAllColumns`, `readRows` (reads CSV and XLSX files) | Export |
| `deleteExport.js` | `deleteExport` | Export (delete an export) |
| `companySettings.js` | `openCompanySettings`, `readCompany`, `restoreCompany`, `saveChanges`, ... | Settings, Profile |
| `profileSettings.js` | `openProfileSettings`, `readProfile`, `restoreProfile`, `saveChanges`, `expectSaved`, `expectRefused`, `chooseCountry`, `makePicture`, ... | Profile; reads and puts back the profile through the API |
| `authPages.js` | `openLogin`, `openSignUp`, `knownDefect`, `toast`, `watchRequests`, `expectNothingSent`, ... | Login (validation), Profile |
| `responsive.js` | `findLayoutProblems`, `findCutOffPlaceholders`, `findClippedText`, `isTruncated`, ... | `*Responsive.spec.js` tests |
| `dictation-sample.wav` | Audio file | Suggest Next Email Dictate test |

### 6.3 Rules for helpers
- One helper file per CRM module or workflow, named after it.
- A helper opens what it needs (for example `openNewDeal` logs in, creates a deal and opens its page), so a test can start from one call.
- Helpers assert as they go with `expect(..., 'message')`, so a failure says which step broke.
- Helpers that change shared staging data put it back (`companySettings.restoreCompany`, `profileSettings.restoreProfile`, `emailFolders` ends with the email back in the Inbox).
- Destructive helpers only touch test data (for example `emailFolders` only deletes emails whose subject starts with "Email Actions test").
- Clean-up that must also run when a test fails goes through the app's API (`page.request`), for example `archiveLead.removeLeadForever`.

---

## 7. Test Execution Flow

```
1. CONFIG      playwright.config.js: Chromium, workers, retries, timeouts, reporters
      │        (on CI: Practice/, Basic Script/ and the practice login tests are ignored)
      ▼
2. LOGIN       loginStaging(page) (or the spec's own login steps) on https://staging.pipeclose.com
      ▼
3. SETUP DATA  the helper creates what the test needs: a lead, a deal, an activity,
               a campaign... with a unique name (Date.now())
      ▼
4. ACTIONS     the test drives the UI through the helper
      ▼
5. VERIFY      expect() on the UI, often after page.reload(), plus the API response
               behind the action (page.waitForResponse)
      ▼
6. EVIDENCE    page.screenshot({ path: 'screenshots/<Module>/<Test>-<step>.png' })
      ▼
7. CLEAN UP    delete what was created, or restore what was changed: newer tests do it in
               test.afterEach (often through the API), so it also runs after a failure
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
| `video` | Locally `on`; on CI `retain-on-failure`; 1280×720, saved in `test-results/chromium/` |
| Project | `chromium` (Desktop Chrome), output in `test-results/chromium` |

### 8.2 Environment variables

| Variable | Effect |
|---|---|
| `CI` | Turns on the CI settings above (set by the Jenkinsfile; GitHub Actions sets it too) |
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
| `npm run test:firefox` / `test:webkit` / `test:all` | Run the `firefox` / `webkit` / all three projects. They stop with "Project(s) not found" until those projects are added to the config |

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
- restore anything you change on shared records, in `test.afterEach` so it also happens when the test fails (for example `Deal/EditPipelineName.spec.js` puts the "Default Pipeline" name back through the API);
- a run stopped part-way (Ctrl+C, a CI time-out) skips the clean-up, so tests that can leave data behind clear it at the start of their next run (for example `campaign.deleteCampaignIfExists`);
- never sign up with a new email on staging unless the test is about sign up;
- staging rate-limits logins: after many runs in a short time, tests stop on the login page and time out. That is the rate limit, not a broken test; wait before running again.

---

## 10. Reporting & Artifacts

| Artifact | Location | When |
|---|---|---|
| HTML report | `playwright-report/index.html` (`npm run report`) | Every run |
| JUnit results | `test-results/junit.xml` | CI runs |
| Videos | `test-results/chromium/<test>/video.webm` | Every test locally; failed tests on CI |
| Traces | `test-results/chromium/<test>/trace.zip` (`npx playwright show-trace`) | First retry of a failed test |
| Screenshots | `screenshots/<Module>/` | Saved by the tests at their checkpoints |
| Evidence PDFs | `test-results/PipeClose Evidence - <Module>.pdf` (Campaign, Deal, Email, Export) | Made from a module's screenshots when its tests are handed over |

The screenshots folder is committed to the repository and sorted by module (`screenshots/Activities/`, `screenshots/Deal/`, `screenshots/Lead/`...), so each module's evidence is in one place.

The evidence PDFs are committed too, although `test-results/` is git-ignored: add a new one with `git add -f`. A run only clears `test-results/chromium/`, so the PDFs stay.

---

## 11. CI/CD with Jenkins and GitHub Actions

### 11.1 Jenkins

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

### 11.2 GitHub Actions

**File:** `.github/workflows/playwright.yml`. It runs on every push and Pull Request to `main` (or `master`), on an `ubuntu-latest` runner:

**Steps:** `npm ci` → `npx playwright install --with-deps` (all browsers) → `npx playwright test` (the whole suite, with the CI settings from 8.1) → upload `playwright-report/` as an artifact, kept 30 days.

**Current state:** the job has a 60-minute limit, but the whole suite takes a few hours. It has not passed once since February 2026: of its 92 runs, 31 failed and 61 were cancelled, the recent ones at the 60-minute limit. While it runs, it logs in and changes data on staging with the shared account, at the same time as local and Jenkins runs. See the Roadmap.

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
| Tests stop on the login page after many runs | Staging rate-limits logins: wait before running again, and run fewer tests at once |
| Test data left behind by a stopped run | Clear leftovers at the start of the test (see 9.5) |

### Git workflow
- Commit specs, helpers and their screenshots together by module, and push to `main`.
- Bigger or risky changes can go on a feature branch with a Pull Request to `main`.
- Every push to `main` starts the GitHub Actions workflow (see 11.2).

---

## 13. Roadmap

**Done**
- ✅ Shared helper layer for every module
- ✅ Module-based screenshot folders
- ✅ Jenkins pipeline with parameters, JUnit and HTML reports
- ✅ Responsive (phone/tablet) layout checks
- ✅ Known-defect handling
- ✅ Clean-up through the API in `test.afterEach` (newer Lead, Profile and Deal tests)
- ✅ Evidence PDFs for Campaign, Deal, Email and Export

**Planned**
- 📋 Credentials in environment variables (Jenkins credentials, GitHub secrets) instead of `loginConfig.js`, `auth.js` and the 90 older spec files that have them written in
- 📋 Move the older "valid login" specs (87 tests) onto the module helpers, with titles that say what they test
- 📋 Base URL in `playwright.config.js` (`use.baseURL`) instead of in each helper
- 📋 Shared login state (`storageState`) to skip the UI login in each test, which also keeps runs under the staging login rate limit
- 📋 API set-up and clean-up for the other modules
- 📋 GitHub Actions: run on demand, or only a short set of tests, so a push does not start an hour-long run on staging (see 11.2)
- 📋 Calendar: write or remove the 5 empty spec files
- 📋 Firefox and WebKit projects (the npm scripts already exist)

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

# List the tests without running them (count: last line)
npx playwright test --list

# Show known defects as failures (PowerShell)
$env:SHOW_DEFECTS = '1'; npx playwright test tests/Login

# Open the last HTML report / a trace
npx playwright show-report
npx playwright show-trace test-results/chromium/<test>/trace.zip
```

---

## Appendix B: Framework Statistics

| | |
|---|---|
| Test modules (folders in `tests/`, without `common/`) | 34 (32 CRM modules + Practice and Basic Script) |
| Spec files | 249 (Playwright collects 244: the 5 empty Calendar files have no test) |
| Tests | 408 (399 run on CI, without Practice, Basic Script and `LoginPractice`) |
| Shared helper files in `tests/common/` | 26 JavaScript files + 1 audio file |
| Screenshot folders | 33 |
| Browser | Chromium |

---

**Author:** Ashish Rai - QA Engineer
