const { test, expect } = require('@playwright/test');
const { loginStaging } = require('../common/createDeal');

// Renames the "Default Pipeline" from the edit (pencil) button next to the pipeline picker on the Deals board,
// saves it and checks the new name everywhere it shows. Also checks Cancel and its "You have unsaved changes" popup.
// Everyone on staging uses this pipeline, so its name is put back after the test (also when it fails).
// Screenshots are saved in screenshots/Deal/.

const BASE_URL = 'https://staging.pipeclose.com';
const PIPELINE = 'Default Pipeline';
const TEST_NAME = /^Default Pipeline Edit\d+$/; // names this test gives the pipeline

// Pipeline picker: the dropdown with the pencil button right after it ("Sort by" is the other dropdown).
// The pencil has no name, so it is found from the picker.
const pipelinePicker = page => page.locator('xpath=//*[@role="combobox"][following-sibling::*[1][self::button]]');
const editButton = page => pipelinePicker(page).locator('xpath=following-sibling::button[1]');
// Edit form: "Pipeline name" is plain text, not a label linked to the box
const nameBox = page => page.getByText('Pipeline name', { exact: true }).locator('xpath=following::input[1]');
const stageNameBoxes = page => page.getByRole('main').getByRole('listitem').getByRole('textbox');
// Board: one column per stage, titled with an h3
const stageColumns = page => page.getByRole('main').getByRole('heading', { level: 3 });

/** All pipelines with their stages, as the API stores them. */
async function getPipelines(page) {
  const response = await page.request.get(`${BASE_URL}/api/pipelines/get?includeStages=true`);
  expect(response.ok(), `Pipelines API returned ${response.status()}`).toBeTruthy();
  return (await response.json()).data.pipelines;
}

/** Renames a pipeline through the API, with the same request the edit form's "Save changes" sends. */
const renamePipeline = (page, id, name) =>
  page.request.put(`${BASE_URL}/api/pipelines/update/${id}`, { data: { name, stagesData: [], deletedStagesIds: [] } });

// Stage names in board order
const stageNames = pipeline => [...pipeline.stages].sort((a, b) => a.orderIndex - b.orderIndex).map(s => s.name);

/**
 * Opens the pipeline picker, checks `name` is listed and selected and `oldName` is not listed, takes a screenshot
 * and closes the list. (The picker cuts long names short, "Default Pipeline...": the open list shows them in full.)
 */
async function expectPipelineList(page, name, oldName, screenshot) {
  await pipelinePicker(page).click();
  await expect(page.getByRole('option', { name, exact: true }), `"${name}" should be listed and selected`)
    .toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('option', { name: oldName, exact: true }), `"${oldName}" should not be listed`).toHaveCount(0);
  await page.screenshot({ path: screenshot });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('listbox')).toBeHidden();
}

// The pipeline while it has the test name: renamed back after the test, also when it fails or times out
let renamed;
test.afterEach(async ({ page }) => {
  if (!renamed) return;
  const response = await renamePipeline(page, renamed.id, PIPELINE).catch(e => e);
  if (response.ok?.()) console.log(`Cleanup: pipeline ${renamed.id} renamed back to "${PIPELINE}"`);
  else console.warn(`Cleanup: could not rename pipeline ${renamed.id} back to "${PIPELINE}": ${response.status?.() ?? response.message}`);
  renamed = undefined;
});

test('Edit the name of the Default Pipeline and save it', async ({ page }) => {
  test.setTimeout(300000);
  const newName = `${PIPELINE} Edit${Date.now().toString().slice(-6)}`;
  let pipeline; // the Default Pipeline as stored before the edit

  await test.step('Deals board shows the Default Pipeline with an edit button', async () => {
    await loginStaging(page);
    await page.getByRole('button', { name: 'Pipeline View', exact: true }).click({ timeout: 30000 });

    // A run stopped before its cleanup (e.g. with Ctrl+C) leaves the test name behind: put the name back first
    let pipelines = await getPipelines(page);
    const leftover = pipelines.find(p => TEST_NAME.test(p.name));
    if (leftover && !pipelines.some(p => p.name === PIPELINE)) {
      expect((await renamePipeline(page, leftover.id, PIPELINE)).ok(), 'Could not put back the name left by an earlier run').toBeTruthy();
      console.log(`Pipeline ${leftover.id} was still named "${leftover.name}" by an earlier run: renamed back to "${PIPELINE}"`);
      pipelines = await getPipelines(page);
      await page.reload();
      await page.getByRole('button', { name: 'Pipeline View', exact: true }).click({ timeout: 30000 });
    }
    pipeline = pipelines.find(p => p.name === PIPELINE);
    expect(pipeline, `A pipeline named "${PIPELINE}" should exist`).toBeTruthy();
    console.log(`"${PIPELINE}" is pipeline ${pipeline.id}, stages: ${stageNames(pipeline).join(', ')}`);

    // The board opens the pipeline used last: pick the Default Pipeline if another one is shown
    const picker = pipelinePicker(page);
    await expect(picker).toBeVisible({ timeout: 30000 });
    if ((await picker.innerText()).trim() !== PIPELINE) {
      await picker.click();
      await page.getByRole('option', { name: PIPELINE, exact: true }).click();
    }
    await expect(picker).toHaveText(PIPELINE);
    await expect(stageColumns(page), 'Board columns should be the pipeline stages').toHaveText(stageNames(pipeline), { timeout: 30000 });
    await expect(editButton(page), 'Edit (pencil) button should be next to the pipeline picker').toBeVisible();
  });

  await test.step('Pencil opens the edit form with the current name and stages', async () => {
    await editButton(page).click();
    await expect(nameBox(page), 'Name box should show the current name').toHaveValue(PIPELINE, { timeout: 15000 });
    const stages = stageNameBoxes(page);
    await expect(stages).toHaveCount(pipeline.stages.length);
    for (const [i, name] of stageNames(pipeline).entries()) {
      await expect(stages.nth(i), `Stage ${i + 1} should be "${name}"`).toHaveValue(name);
    }
    for (const button of ['Save changes', 'Cancel', 'Archive']) {
      await expect(page.getByRole('button', { name: button, exact: true })).toBeVisible();
    }
    await page.screenshot({ path: 'screenshots/Deal/EditPipelineName-1-edit-form.png' });
  });

  await test.step('Cancel asks before dropping the typed name, and nothing is saved', async () => {
    const box = nameBox(page);
    await box.fill(newName);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    const unsaved = page.getByRole('heading', { name: 'You have unsaved changes', level: 2 });
    await expect(unsaved, 'Cancel should warn about the unsaved name').toBeVisible();
    await expect(page.getByText('Are you sure you wish to leave this page?', { exact: true })).toBeVisible();
    await page.screenshot({ path: 'screenshots/Deal/EditPipelineName-2-unsaved-changes.png' });

    // Continue editing: back in the form, the typed name is kept
    await page.getByRole('button', { name: 'Continue editing', exact: true }).click();
    await expect(unsaved).toBeHidden();
    await expect(box).toHaveValue(newName);

    // Leave this page: the form closes and the old name stays
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Leave this page', exact: true }).click();
    await expect(box, 'Edit form should close').toBeHidden();
    await expect(pipelinePicker(page), 'Picker should still show the old name').toHaveText(PIPELINE);
    const stored = (await getPipelines(page)).find(p => p.id === pipeline.id);
    expect(stored.name, 'Cancel should not save the typed name').toBe(PIPELINE);
  });

  await test.step('Save changes renames the pipeline', async () => {
    await editButton(page).click();
    const box = nameBox(page);
    await expect(box, 'Form should open with the stored name again').toHaveValue(PIPELINE, { timeout: 15000 });
    await box.fill(newName);

    renamed = pipeline; // from here on, the cleanup puts the name back
    const [response] = await Promise.all([
      page.waitForResponse(r => r.url().endsWith(`/api/pipelines/update/${pipeline.id}`) && r.request().method() === 'PUT', { timeout: 30000 }),
      page.getByRole('button', { name: 'Save changes', exact: true }).click(),
    ]);
    expect(response.ok(), `Update pipeline API returned ${response.status()}`).toBeTruthy();
    const sent = response.request().postDataJSON();
    expect(sent.name, 'Save should send the new name').toBe(newName);
    expect(sent.deletedStagesIds ?? [], 'Save should not delete any stage').toEqual([]);
    expect((await response.json()).data.name).toBe(newName);

    // No success message is shown: the form closes and the board shows the new name
    await expect(box, 'Edit form should close after saving').toBeHidden({ timeout: 15000 });
    await expect(pipelinePicker(page), 'Picker should show the new name').toHaveText(newName);
    await expect(stageColumns(page), 'Board should keep the same stages').toHaveText(stageNames(pipeline));
    console.log(`Renamed pipeline ${pipeline.id} to "${newName}"`);
  });

  await test.step('Pipeline list shows the new name instead of the old one', async () => {
    await expectPipelineList(page, newName, PIPELINE, 'screenshots/Deal/EditPipelineName-3-renamed.png');
  });

  await test.step('New name is kept after a reload, with the same stages', async () => {
    await page.reload();
    await page.getByRole('button', { name: 'Pipeline View', exact: true }).click({ timeout: 30000 });
    await expect(pipelinePicker(page), 'New name should stay after a reload').toHaveText(newName, { timeout: 30000 });
    await expect(stageColumns(page)).toHaveText(stageNames(pipeline), { timeout: 30000 });

    const stored = (await getPipelines(page)).find(p => p.id === pipeline.id);
    expect(stored.name, 'Stored name').toBe(newName);
    // Same stages, in the same order, with the same probabilities (deal counts are left out: other tests add deals)
    const shape = p => p.stages.map(({ id, name, orderIndex, probability }) => ({ id, name, orderIndex, probability }));
    expect(shape(stored), 'Renaming should not change the stages').toEqual(shape(pipeline));
    await expectPipelineList(page, newName, PIPELINE, 'screenshots/Deal/EditPipelineName-4-after-reload.png');
  });

  await test.step('A deal in the pipeline shows the new name', async () => {
    await page.getByRole('main').getByRole('heading', { level: 4 }).first().click();
    await expect(page).toHaveURL(/\/deals\/\d+$/, { timeout: 30000 });
    // The URL changes before the deal page replaces the board: wait for the page itself,
    // so the name found below is the deal page's and not the board's pipeline picker
    await expect(page.getByRole('button', { name: 'Won', exact: true }), 'Deal page should open').toBeVisible({ timeout: 30000 });
    await expect(pipelinePicker(page), 'Board toolbar should be gone').toHaveCount(0);
    // Breadcrumb under the stage bar: "<pipeline name> > <stage>"
    await expect(page.getByText(newName, { exact: true }), 'Deal page should show the new pipeline name')
      .toBeVisible({ timeout: 30000 });
    await page.screenshot({ path: 'screenshots/Deal/EditPipelineName-5-deal-page.png' });
  });
});
