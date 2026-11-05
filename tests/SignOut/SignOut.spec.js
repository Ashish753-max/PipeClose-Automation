const { test, expect } = require('@playwright/test');

test("valid login", async ({ page }) => {

  await page.goto("https://staging.pipeclose.com/");

  await page.getByRole('link', { name: /^Log in/ }).first().click();

  await page.getByPlaceholder("Email")
            .fill("ashishappnox1@gmail.com");
  await page.waitForTimeout(1000)


  await page.getByPlaceholder("Password")
            .fill("Ashish@567");

  await page.locator("//button[@type='submit']").click();

  //  Click profile button
  await page.getByRole('button', { name: 'Ashish' }).click();
  await page.waitForTimeout(500)

/*  // Click on view profile 
  await page.locator("//button[normalize-space()='View Profile']").click();
    await page.waitForTimeout(1000)  */


  // Click on sign out 
  await page.getByText("Sign Out").click()
  
  // Wait for sign out to complete
  await page.waitForTimeout(2000);
  
  // Take screenshot after sign out is completed
  await page.screenshot({ path: 'screenshots/signout-success.png' });

});
