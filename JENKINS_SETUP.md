# Jenkins Setup Guide for Playwright Project

## Prerequisites
- Jenkins installed and running (v2.400+)
- Node.js 18+ installed on Jenkins server
- Git installed on Jenkins server
- Your project pushed to a Git repository (GitHub, GitLab, etc.)

---

## Automatic Setup Instructions (Recommended)

### Option 1️⃣: Quick Setup (Using This Jenkinsfile)

Your project now includes a **Jenkinsfile** at the root. Follow these steps:

#### 1. **Login to Jenkins Dashboard**
   - Go to `http://localhost:8080` (or your Jenkins server URL)
   - Login with your credentials

#### 2. **Create a New Pipeline Job**
   - Click **"New Item"**
   - Enter job name: `Playwright-CRM-Tests`
   - Select **"Pipeline"**
   - Click **OK**

#### 3. **Configure the Pipeline**
   - Scroll to **"Pipeline"** section
   - In **Definition** dropdown, select: **"Pipeline script from SCM"**
   - In **SCM** dropdown, select: **"Git"**
   
   - **Repository URL**: Enter your Git repo URL
     ```
     https://github.com/YOUR_USERNAME/CRM.git
     ```
   
   - **Credentials**: Add your GitHub credentials (if private repo)
   - **Branch Specifier**: `*/main` (or your main branch)
   - **Script Path**: `Jenkinsfile` (already exists in your project)

#### 4. **Save and Build**
   - Click **Save**
   - Click **"Build Now"**
   - Watch the console output for test execution

---

## Manual Setup Instructions (Alternative)

### Option 2️⃣: Manual Pipeline Configuration

If you prefer not to use Jenkinsfile:

#### 1. **Create New Pipeline Job** (same as above)

#### 2. **Select "Pipeline" and Configure**
   - Select **Definition**: **"Pipeline script"**
   - Paste the contents of the project's `Jenkinsfile` in the **Script** box
   - A pasted script is not linked to Git, so in the **Checkout** stage replace `checkout scm` with:

```groovy
git url: 'https://github.com/Ashish753-max/CRM-Automation.git', branch: 'main'
```

Option 1 (Pipeline script from SCM) is better: the pipeline then always matches the `Jenkinsfile` in Git.

---

## Step-by-Step Jenkins Installation (If Not Already Installed)

### For Windows:

#### 1. **Download Jenkins**
   - Go to https://jenkins.io/download/
   - Download **Windows installer (WAR)**

#### 2. **Install Jenkins**
   ```bash
   java -jar jenkins.war
   ```
   - Jenkins will start on `http://localhost:8080`

#### 3. **Install Node.js Plugin**
   - In Jenkins: **Manage Jenkins** → **Plugin Manager**
   - Search for: **"NodeJS Plugin"**
   - Install and Restart

#### 4. **Configure Node.js in Jenkins**
   - **Manage Jenkins** → **Tools**
   - Add **NodeJS Installation**:
     - Name: `NodeJS-18`
     - Version: `18.17.0` (or latest)
   - Save

---

## Verify Setup is Working

### ✓ Check Jenkins Job Status
1. Go to your job dashboard
2. Click **"Build Now"**
3. Wait for build to complete
4. Click the build number → **Console Output**

### ✓ View Test Reports
1. After build completes, click **"Playwright Report"** link
2. View detailed test results with:
   - ✓ Passed/Failed tests
   - 📸 Screenshots
   - 🎬 Video recordings

### ✓ Check Artifacts
- Click **"Build Artifacts"**
- Download screenshots, videos, test results

---

## Configure Automated Builds (Optional)

### Trigger builds on Git Push:

#### For GitHub:
1. Go to your GitHub repo → **Settings** → **Webhooks**
2. Click **"Add webhook"**
3. **Payload URL**: `http://YOUR_JENKINS_URL/github-webhook/`
4. **Content type**: `application/json`
5. **Events**: Select **"Push events"**
6. Click **"Add webhook"**

#### In Jenkins:
1. Job → **Configure**
2. Under **Build Triggers**, check: **"GitHub hook trigger for GITScm polling"**
3. Save

Now every Git push will automatically trigger a test run! 🚀

---

## Test Commands Available

After setup, you can run these commands:

```bash
npm test                    # Run all tests (default)
npm run test:chrome        # Run only Chrome tests
npm run test:firefox       # Run only Firefox tests
npm run test:webkit        # Run only Safari tests
npm run test:all           # Run all browsers
npm run test:ui            # Run with UI mode
npm run test:debug         # Run with debugging
npm run report             # Show HTML report
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| **"npm: command not found"** | Install Node.js on Jenkins server or configure NodeJS plugin |
| **"Tests timeout"** | Increase timeout in playwright.config.js |
| **"Port already in use"** | Change Jenkins port: `java -jar jenkins.war --httpPort=8090` |
| **"Permission denied"** | Run Jenkins with elevated permissions |
| **Reports not showing** | Install **Publish HTML Reports** plugin in Jenkins |

---

## Summary

✅ **Your project now has:**
- ✓ Jenkinsfile configured for automated testing
- ✓ npm scripts ready for CI/CD
- ✓ HTML report generation
- ✓ Screenshot & video artifact archival

🚀 **Next Steps:**
1. Push code to Git repository
2. Create Jenkins Pipeline job
3. Point to your repository
4. Click "Build Now"
5. Watch tests run automatically!

---

Need help? Check the console output in Jenkins for error messages.
