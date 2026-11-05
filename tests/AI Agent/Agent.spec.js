const { test, expect } = require('@playwright/test');
test("Deal Creation",async function ({page, context}) {

    // Launch the page
    await page.goto("https://staging.pipeclose.com/")

    // Open the login form
    await page.getByRole('link', { name: /^Log in/ }).first().click()

    // Enter email address
    await page.getByPlaceholder("Email").type ("ashishappnox1@gmail.com")

    // Enter the Password
    await  page.getByPlaceholder("Password").type("Ashish@567")
    await page.waitForTimeout(1000)

    // Click on login button
    await page.locator("//button[@type ='submit']").click()

    // Wait for the AI Agent link to be visible
    await page.getByRole('link', { name: 'AI Agent' }).waitFor()

    // Click on AI Agent
    await page.getByRole('link', { name: 'AI Agent' }).click()
});