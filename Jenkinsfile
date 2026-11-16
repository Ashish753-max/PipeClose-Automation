// Jenkins pipeline for the PipeClose CRM Playwright tests (Windows agent: steps use `bat`).
// Runs the tests against staging, then publishes the Playwright HTML report and the JUnit results,
// and keeps the screenshots, plus the videos and traces of failed tests.
//
// "Build with Parameters" lets you choose what to run and how many tests run at once.
// Jenkins plugins used: Pipeline, Git, HTML Publisher, JUnit.
pipeline {
    agent any

    parameters {
        string(name: 'TEST_PATH', defaultValue: '',
               description: 'Folder or file to run, e.g. tests/Login or tests/Email Sent. Leave empty to run the whole suite.')
        string(name: 'WORKERS', defaultValue: '2',
               description: 'How many tests run at the same time. Staging slows down and pages time out above about 4.')
        booleanParam(name: 'SHOW_DEFECTS', defaultValue: false,
                     description: 'Make the tests that check known defects fail, so the report shows the details.')
    }

    options {
        // The whole suite takes a few hours against staging on 2 workers
        timeout(time: 6, unit: 'HOURS')
        // Builds keep reports, screenshots and videos: keep the last 20 builds, and files for the last 10
        buildDiscarder(logRotator(numToKeepStr: '20', artifactNumToKeepStr: '10'))
        // Two builds at once would share the test account and the staging data
        disableConcurrentBuilds()
    }

    environment {
        CI = 'true'
        WORKERS = "${params.WORKERS}"
        SHOW_DEFECTS = "${params.SHOW_DEFECTS ? '1' : ''}"
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install dependencies') {
            steps {
                bat 'node --version'
                // npm ci installs exactly what package-lock.json lists, starting from a clean node_modules
                bat 'npm ci'
            }
        }

        stage('Install browser') {
            steps {
                // Chromium is the only browser project in playwright.config.js. Downloaded once, then reused.
                bat 'npx playwright install chromium'
            }
        }

        stage('Run tests') {
            steps {
                script {
                    def target = (params.TEST_PATH ?: '').trim().replaceAll('^"|"$', '')
                    def command = target ? "npx playwright test \"${target}\"" : 'npx playwright test'
                    def status = bat(returnStatus: true, script: command)
                    if (status != 0) {
                        if (!fileExists('test-results/junit.xml')) {
                            error('Playwright stopped before running the tests: see the console output above')
                        }
                        // Failed tests make the build UNSTABLE (yellow), not FAILED (red): the pipeline itself worked
                        unstable('Some tests failed: see Test Results and the Playwright report')
                    }
                }
            }
        }
    }

    post {
        always {
            junit allowEmptyResults: true, testResults: 'test-results/junit.xml'
            publishHTML([
                reportDir: 'playwright-report',
                reportFiles: 'index.html',
                reportName: 'Playwright Test Report',
                keepAll: true,
                alwaysLinkToLastBuild: true,
                allowMissing: true
            ])
            archiveArtifacts artifacts: 'playwright-report/**/*,test-results/**/*,screenshots/**/*',
                             allowEmptyArchive: true
        }
        success {
            echo 'All tests passed'
        }
        unstable {
            echo 'Some tests failed: open "Playwright Test Report" or "Test Results" on the build page'
        }
        failure {
            echo 'The pipeline failed before the tests could finish: check the console output'
        }
    }
}
