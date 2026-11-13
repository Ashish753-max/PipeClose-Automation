# 🚀 Pipeclose Automation Framework

<p align="center">

<img src="https://img.shields.io/badge/JavaScript-ES6+-yellow?style=for-the-badge&logo=javascript" />
<img src="https://img.shields.io/badge/TypeScript-5.x-blue?style=for-the-badge&logo=typescript" />
<img src="https://img.shields.io/badge/Playwright-Automation-green?style=for-the-badge&logo=playwright" />
<img src="https://img.shields.io/badge/GitHub-Version_Control-black?style=for-the-badge&logo=github" />
<img src="https://img.shields.io/badge/Jenkins-CI%2FCD-red?style=for-the-badge&logo=jenkins" />
<img src="https://img.shields.io/badge/Claude-AI-purple?style=for-the-badge" />
<img src="https://img.shields.io/badge/ChatGPT-AI-10A37F?style=for-the-badge&logo=openai" />

</p>

## 📌 Project Overview
End-to-End (E2E) UI automation for the PipeClose CRM, written in JavaScript with Playwright Test and run against staging (`https://staging.pipeclose.com`).

The suite has **231 spec files in 30 modules**: Login and Sign up, Leads, Lead details, Lead → Deal, Deals, Deal details, Contacts, Activities, Calendar, Notifications, Mail (send, drafts, scheduled, email actions), AI features (AI Reply, Summarizer, Suggest Next Email, AI Agent, Knowledge Base), Campaigns, Prospects, Global search, Company settings, Import and Export.

The full design is in **[AUTOMATION_FRAMEWORK_ARCHITECTURE.md](AUTOMATION_FRAMEWORK_ARCHITECTURE.md)**.

---

## 🛠️ Tech Stack
- **Language:** JavaScript (CommonJS)
- **Framework / runner:** Playwright Test (`@playwright/test` ^1.61.1), Chromium
- **Reporting:** Playwright HTML report, JUnit XML, videos and traces
- **CI/CD:** Jenkins (`Jenkinsfile`)
- **IDE / VCS:** Visual Studio Code, Git & GitHub

---

## 🏗️ Framework Architecture

```
tests/<Module>/*.spec.js     →  the scenario: test data and expected result
        │ require('../common/<helper>')
tests/common/*.js            →  the steps of each CRM workflow, shared by the tests
        │
playwright.config.js         →  browser, workers, retries, timeouts, reporters
        │
PipeClose CRM staging        →  https://staging.pipeclose.com
```

- **Spec files** are short: they call a helper and state the data and the expected result.
- **Helpers** in `tests/common/` hold each module's steps once (for example `dealDetails.js`: `openNewDeal` → `editField` → `expectSavedAfterReload`). A UI change is fixed in one place.
- **Each test creates its own data** with unique names (`Date.now()`), and cleans up or restores shared data where the flow allows.
- **Screenshots** are saved per module in `screenshots/<Module>/`.
- **Known staging bugs** are marked with `knownDefect(...)`; run with `SHOW_DEFECTS=1` to see them fail in the report.

---

## 📂 Project Structure

```
CRM/
├── playwright.config.js        # Playwright configuration
├── Jenkinsfile                 # Jenkins pipeline
├── package.json                # Dependencies and npm scripts
├── AUTOMATION_FRAMEWORK_ARCHITECTURE.md
├── JENKINS_SETUP.md / JENKINS_QUICK_START.md
│
├── tests/
│   ├── common/                 # Shared helpers
│   │   ├── auth.js, loginConfig.js            # Login
│   │   ├── createLead.js, leadDetails.js      # Leads
│   │   ├── createDeal.js, archiveDeal.js, dealDetails.js   # Deals
│   │   ├── activity.js, scheduleActivity.js   # Activities
│   │   ├── mail.js, emailFolders.js, starEmail.js          # Mail
│   │   ├── aiReply.js, summarizeEmail.js, knowledgeBase.js # AI features
│   │   ├── campaign.js, prospects.js, globalSearch.js
│   │   ├── exportData.js, companySettings.js, authPages.js
│   │   └── responsive.js                      # Phone/tablet layout checks
│   │
│   ├── Login/  SignOut/  Profile/  Dashboard/  Settings/
│   ├── Lead/  Lead Details/  LeadToDeal/  Deal/  Deal Details/  Contacts/
│   ├── Activities/  Calendar/  Notification/
│   ├── Email Sent/  Mail Draft/  ScheduleEmail/  Email Actions/  PipecloseToHostingerSync/
│   ├── AI Agent/  AI Reply/  Summarizer Email/  KnowledgeBase/
│   ├── Campaign/  Prospects/  Global Search/
│   ├── Import/  Export/
│   └── Basic Script/  Practice/   # Learning scripts, skipped on CI
│
├── screenshots/                # One folder per module: Activities/, Deal/, Lead/, DealDetails/, ...
├── test-results/               # Videos, traces, junit.xml (git-ignored)
└── playwright-report/          # HTML report (git-ignored)
```

---

## ▶️ Running the Tests

```bash
npm install
npx playwright install chromium

npx playwright test                              # whole suite
npx playwright test "tests/Deal Details"         # one module
npx playwright test tests/Lead/LeadSearch.spec.js  # one file
npx playwright test --headed                     # visible browser
npm run test:ui                                  # Playwright UI mode
npm run report                                   # open the last HTML report
```

| Environment variable | Effect |
|---|---|
| `WORKERS` | Tests run at the same time (CI default 2; staging slows down above about 4) |
| `CI` | CI settings: retries 2, list + HTML + JUnit reporters, videos only for failures, skip Practice/Basic Script |
| `SHOW_DEFECTS=1` | Make the known-defect tests fail so the report shows the defect |

---

## 📸 Screenshots, Videos and Traces
- **Screenshots:** saved by the tests at their checkpoints in `screenshots/<Module>/<Test>-<step>.png`
- **Videos:** `test-results/` - every test locally, failed tests on CI (1280×720)
- **Traces:** `test-results/` on the first retry of a failed test (`npx playwright show-trace <trace.zip>`)
- **Reports:** `playwright-report/index.html`, and `test-results/junit.xml` on CI

---

## 🧪 Modules Covered

| Module | What is tested |
|---|---|
| Login / Sign out / Profile | Log in, Sign up and Log in field validation, responsive auth pages, log out, profile |
| Lead | Create (basic, all fields), search, sort by, archive/delete, responsive |
| Lead Details | Edit person/organization fields, value, close date, field validation, UX and accessibility |
| Lead → Deal | Convert from the form and from the action menu |
| Deal | Create, search, archive and delete, responsive |
| Deal Details | Edit and validate fields, Won/Lost, Suggest Next Email (standard, deep research, save draft, dictate) |
| Contacts | People and Organizations search |
| Activities | Create/schedule every type, search, link to deal/person/organization, edit, priority, free/busy, done/to-do, delete |
| Calendar | Create, view, edit, delete events, mark done/not done |
| Notifications | Open, mark read, clear all, navigate to Inbox/Calendar |
| Mail | Send, Sent folder, drafts, scheduled emails, star, unread, Archive/Spam/Trash and back, delete forever |
| AI | AI Reply, Email Summarizer, AI Agent, Knowledge Base sections |
| Campaign | Sequence, email step, enrollment, sent/opened |
| Prospects | Include filters (company, job title, location, revenue, ...), responsive |
| Global Search | Leads, deals, organizations from the header |
| Settings | Company details: edit, validate, restore |
| Import / Export | Import and merge every object, rollback; CSV/XLSX exports with file content checks |

---

## 🐞 Debugging Failures
1. Open the HTML report: `npm run report`
2. Watch the test's video and open its trace from the report
3. Check the module's screenshots in `screenshots/<Module>/`
4. Re-run the single test with `--headed` or `--debug`

---

## 🔄 Continuous Integration
The `Jenkinsfile` runs the suite on a Windows Jenkins agent: Checkout → Install dependencies → Install browser → Run tests.
Build parameters: `TEST_PATH` (folder or file, empty = whole suite), `WORKERS` (default 2), `SHOW_DEFECTS`.
Failed tests make the build UNSTABLE; Jenkins publishes the JUnit results and the Playwright report, and archives the report, `test-results/` and `screenshots/`.
See [JENKINS_SETUP.md](JENKINS_SETUP.md) and [JENKINS_QUICK_START.md](JENKINS_QUICK_START.md).

---

## 📏 Conventions
- One folder per module in `tests/`, and the same module folder in `screenshots/`
- Workflow steps go in `tests/common/<module>.js`, not in spec files
- Unique test data with `Date.now()`; restore any shared record a test changes
- Wait for elements and API responses, not fixed delays
- Verify saves after a page reload and on the API response
- Credentials only in `tests/common/loginConfig.js`

---

## 🤝 Contribution Guidelines
1. Create a new branch
2. Add the test to its module folder and reuse or extend the module's helper
3. Save its screenshots in `screenshots/<Module>/`
4. Run the module locally
5. Commit the specs, helpers and screenshots of a module together and open a Pull Request

---

## 📌 Future Enhancements
- Credentials in environment variables
- `baseURL` in the Playwright config and a shared login state (`storageState`)
- API-level setup and clean-up
- Firefox and WebKit projects

---

## 👨‍💻 Author
Ashish Rai ||
QA Engineer
