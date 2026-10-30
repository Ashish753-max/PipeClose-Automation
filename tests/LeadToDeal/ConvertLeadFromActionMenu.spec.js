const { test, expect } = require('@playwright/test');
const { openLeads, addLead, leadCount } = require('../common/createLead');

// Checks the "N leads" counter: run this file on its own, other Lead scripts running alongside would change it
test("Convert a lead to a deal from the Action menu", async ({ page }) => {
  test.setTimeout(180000);
  await openLeads(page);
  // A fresh lead, so no real lead is ever converted
  const lead = await addLead(page, 'LeadConvert');
  const countBefore = await leadCount(page);
  const leadRow = page.getByRole('row').filter({ has: page.getByRole('cell', { name: lead.person, exact: true }) });

  // Three-dots menu in the Action column (the button has no label)
  await leadRow.first().getByRole('cell').last().getByRole('button').click();
  await page.getByRole('button', { name: 'Convert to Deal', exact: true }).click();

  // Add deal form opens filled in from the lead
  const form = page.getByRole('dialog');
  await expect(form.getByRole('heading', { name: 'Add deal', level: 3 }), 'Add deal form should open').toBeVisible();
  await expect.soft(form.getByRole('textbox', { name: 'Name' }).first(), 'Contact person should be the lead person as written')
    .toHaveValue(lead.person);
  await expect.soft(form.getByRole('textbox', { name: 'Name' }).nth(1), 'Organization should be the lead organization as written')
    .toHaveValue(lead.organization);
  await expect.soft(form.getByRole('textbox', { name: 'Deal title' }), 'Deal title should keep the names as written')
    .toHaveValue(`${lead.person} - ${lead.organization} Deal`);
  await expect(form.getByPlaceholder('0')).toHaveValue('2500');
  await expect(form.getByPlaceholder('Phone number')).toHaveValue('(987) 654-3210');
  await expect(form.getByPlaceholder('Email address')).toHaveValue(/^lead\.details\+\d+@gmail\.com$/);
  await page.screenshot({ path: 'screenshots/ConvertLead-form.png' });

  // Save creates the deal from this lead
  const [response] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/deals/create') && r.request().method() === 'POST'),
    form.getByRole('button', { name: 'Save', exact: true }).click(),
  ]);
  expect(response.ok(), `Convert API returned ${response.status()}`).toBeTruthy();
  const { deal } = (await response.json()).data;
  expect(deal.leadId, 'Deal should be linked to the lead').toBe(lead.id);

  // Success message, then the new deal on the Deals board
  await expect.soft(page.getByRole('heading', { name: /converted|deal created/i }),
    'A success message should be shown after converting').toBeVisible({ timeout: 5000 });
  await expect(page).toHaveURL(/\/deals$/, { timeout: 30000 });
  await expect(page.getByRole('heading', { name: deal.title, exact: true, level: 4 }).first(), 'New deal should be on the board')
    .toBeVisible({ timeout: 30000 });
  await page.screenshot({ path: 'screenshots/ConvertLead-deal.png' });
  console.log(`Lead ${lead.id} converted to deal ${deal.id} "${deal.title}"`);

  // Leads list: the lead is gone and the counter went down by one
  await page.goto('https://staging.pipeclose.com/leads');
  await expect.poll(() => leadCount(page), { message: `Lead count should go from ${countBefore} to ${countBefore - 1}`, timeout: 30000 })
    .toBe(countBefore - 1);
  await expect(page.getByRole('row').nth(1)).toBeVisible({ timeout: 30000 });
  await expect(leadRow, 'Converted lead should leave the Leads list').toHaveCount(0);

  // Listed under Converted to deals
  await page.getByRole('button', { name: 'Converted to deals', exact: true }).click();
  await expect(page.getByRole('cell', { name: lead.person, exact: true }), 'Lead should be listed under Converted to deals')
    .toBeVisible({ timeout: 30000 });
  await page.screenshot({ path: 'screenshots/ConvertLead-converted-view.png' });
});
