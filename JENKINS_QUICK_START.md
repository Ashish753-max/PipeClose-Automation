# 🚀 Jenkins + Playwright Integration - Quick Start

## ✅ What Has Been Setup For You

| File | Purpose |
|------|---------|
| **Jenkinsfile** | The pipeline: install, run the tests, publish the reports |
| **playwright.config.js** | CI settings, switched on when `CI` is set (Jenkins sets it) |
| **JENKINS_SETUP.md** | Complete setup guide |

### What the pipeline does

1. **Checkout** the code from Git
2. **Install dependencies** with `npm ci` (exactly what `package-lock.json` lists)
3. **Install browser**: `npx playwright install chromium` (downloaded once, then reused)
4. **Run tests** against staging with `npx playwright test`
5. **Publish**: Test Results (JUnit), the Playwright HTML report, and the screenshots, plus videos and traces of failed tests

A build is **green** when every test passes, **yellow (UNSTABLE)** when some tests fail,
and **red** only when the pipeline itself breaks (e.g. `npm ci` fails).

---

## 🎯 Quick Setup (5 Minutes)

### **For Windows Users:**

1. **Prepare the Jenkins machine:**
   - Install **Node.js 18 or newer**: https://nodejs.org/ (`node` and `npm` must work in a Windows command prompt)
   - In Jenkins: **Manage Jenkins** → **Plugins**, check these are installed:
     **Pipeline**, **Git**, **HTML Publisher**, **JUnit**

2. **Start Jenkins** (if not running):
   ```bash
   java -jar jenkins.war
   ```

3. **Create Pipeline Job:**
   - Go to `http://localhost:8080`
   - Click **"New Item"**
   - Name: `Playwright-CRM-Tests`
   - Select **"Pipeline"**
   - In **Pipeline** → **Definition** → select **"Pipeline script from SCM"**
   - **SCM**: Git
   - **Repository URL**: `https://github.com/YOUR_USERNAME/CRM.git`
   - **Script Path**: `Jenkinsfile`
   - Click **Save**

4. **Run Tests:**
   - Click **"Build Now"** (the first build sets up the parameters below; after that the button is **"Build with Parameters"**)
   - View live console output
   - See **Test Results** and **Playwright Test Report** on the build page after completion

---

## 🎛️ Build with Parameters

| Parameter | Default | What it does |
|-----------|---------|--------------|
| **TEST_PATH** | *(empty)* | Folder or file to run, e.g. `tests/Login` or `tests/Email Sent`. Empty runs the whole suite. |
| **WORKERS** | `2` | How many tests run at once. Staging slows down and pages time out above about 4. |
| **SHOW_DEFECTS** | off | Makes the tests that check known defects fail, so the report shows the details. |

---

## 📊 Available Test Commands

Run these in terminal or Jenkins:

```bash
npm test                    # Run all tests
npm run test:chrome        # Chrome only
npm run test:firefox       # Firefox only
npm run test:webkit        # Safari only
npm run test:all           # All browsers
npm run test:ui            # Interactive UI mode
npm run test:debug         # Debug mode
npm run report             # View HTML report
```

---

## 🔄 Automated Testing on Git Push

Set up Jenkins to automatically run tests when you push code:

### **Step 1: Add GitHub Webhook**
1. Go to your GitHub repo → **Settings** → **Webhooks**
2. Click **"Add webhook"**
3. **Payload URL**: `http://YOUR_JENKINS_URL/github-webhook/`
4. **Content type**: `application/json`
5. Select **"Push events"**
6. Click **"Add webhook"**

### **Step 2: Enable Jenkins Trigger**
1. Jenkins → Your Job → **Configure**
2. **Build Triggers** → Check ✓ **"GitHub hook trigger for GITScm polling"**
3. Save

✅ **Now every git push automatically runs your tests!**

---

## 📈 Jenkins Dashboard Features

After each test run, you'll see:

- ✅ **Build Status** (Passed/Failed)
- 📊 **Test Results** (passed/failed count)
- 📸 **Screenshots** (the ones the tests save, in `screenshots/<Module>/`)
- 🎬 **Video Recordings and traces** (failed tests only)
- 📋 **HTML Report** (detailed test breakdown)
- 📝 **Console Output** (logs and errors)

---

## 🛠️ Troubleshooting

| Issue | Solution |
|-------|----------|
| **"java not found"** | Install Java JDK 11+: https://www.oracle.com/java/technologies/downloads/ |
| **"npm not found"** | Install Node.js: https://nodejs.org/ |
| **Tests timeout / pages do not load** | Staging is overloaded: lower **WORKERS** (e.g. 1 or 2) |
| **Permission denied** | Run Jenkins as Administrator (Windows) |
| **No report showing** | Install the "HTML Publisher" plugin in Jenkins |
| **Playwright report opens blank** | Jenkins' security policy blocks the report's scripts. Download `playwright-report` from the build's artifacts and open `index.html`, or ask the Jenkins admin to relax the Content Security Policy for HTML reports |
| **No "Test Results" on the build** | Install the "JUnit" plugin in Jenkins |

---

## 📝 Environment Variables

The pipeline sets `CI = 'true'`, `WORKERS` and `SHOW_DEFECTS` (from the build parameters).

`CI` switches on these settings in `playwright.config.js` (running locally without it is unchanged):

- Failed tests are retried up to 2 times, with a trace on the first retry
- 2 tests at a time (or the **WORKERS** parameter)
- Video kept only for failed tests
- Reports: a line per test in the console, the HTML report, and JUnit results (`test-results/junit.xml`)
- `test.only` left in the code fails the build
- Skipped on CI: `tests/Practice`, `tests/Basic Script`, `LoginPractice.spec.js` and `TMLoginSuccessful.spec.js`
  (practice scripts and tests of other websites)

To try the CI settings on your machine:

```bash
set CI=1&& npx playwright test tests/Login        (Windows cmd)
CI=1 npx playwright test tests/Login              (Git Bash)
```

---

## 🎓 Next Steps

1. ✅ **Install Node.js and the Jenkins plugins** (see Quick Setup)
2. ✅ **Read JENKINS_SETUP.md** for detailed guide
3. ✅ **Create Jenkins pipeline job**
4. ✅ **Connect your Git repository**
5. ✅ **Click "Build Now"** and watch tests run
6. ✅ **View reports** in Jenkins dashboard

---

## 💡 Pro Tips

- 📌 Keep Jenkinsfile in version control (commit to Git)
- 🔐 Use Jenkins credentials for sensitive data
- 📧 Set up email notifications for test failures
- 🗂️ Archive reports for historical tracking
- 🎯 Add build status badge to your README

---

## 📚 Resources

- **Jenkins Documentation**: https://jenkins.io/doc/
- **Playwright CI Guide**: https://playwright.dev/docs/ci
- **Jenkins Pipeline Syntax**: https://jenkins.io/doc/book/pipeline/syntax/

---

**Questions?** Check JENKINS_SETUP.md for complete guide!
