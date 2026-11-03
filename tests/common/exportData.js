// tests/common/exportData.js
// Shared flow for the Export scripts (tests/Export/*AllColumnsExport.spec.js)
const fs = require('fs');
const zlib = require('zlib');
const { expect, test } = require('@playwright/test');
const { loginStaging } = require('./createDeal');

// Object type button -> name the export API uses for it, the scope and date range that cover every record
// (where the object offers them) and anything else the export request carries for it
const OBJECTS = {
  Deals: { type: 'deals', scope: 'All', request: { filters: { archiveStatus: 'all' } } }, // archived or not
  People: { type: 'contacts', scope: 'All records' },
  Organizations: { type: 'organizations', scope: 'All records' },
  Activities: { type: 'activities', scope: 'All records' },
  Leads: { type: 'leads', scope: 'All', request: { filters: { archiveStatus: 'all' } } },
  Notes: { type: 'notes', dateRange: 'Any', request: { contentFormat: 'plain' } }, // Content Format stays "Plain text"
  Files: { type: 'files', scope: 'All records', dateRange: 'Any' },
};
// Format button -> file extension (the app shows it upper case: "XLSX Export", Format column "XLSX")
const FORMATS = { CSV: 'csv', Excel: 'xlsx' };

/**
 * Logs in and opens Export from the sidebar's More menu.
 * @returns {Promise<object>} the column options of every object type, as the page loads them
 */
async function openExport(page) {
  await loginStaging(page);
  await page.getByRole('button', { name: 'More navigation options' }).click();
  // The link shows the number of exports, e.g. "Export 3"
  const [columns] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith('/api/exports/columns'), { timeout: 30000 }),
    page.getByRole('dialog').getByRole('link', { name: /^Export/ }).click(),
  ]);
  await expect(page).toHaveURL(/\/export$/);
  await expect(page.getByRole('heading', { name: 'Export Data', level: 1 })).toBeVisible();
  return (await columns.json()).data;
}

/**
 * Exports every record of an object type with all its columns, checks the success message, downloads the file
 * and checks it has every column and as many records as the Export History shows.
 * Screenshots are saved in screenshots/Export/, the downloaded file in the test's results folder.
 * @param {import('@playwright/test').Page} page
 * @param {'Deals'|'People'|'Organizations'|'Activities'|'Leads'|'Notes'|'Files'} object
 * @param {'CSV'|'Excel'} format
 */
async function exportAllColumns(page, object, format) {
  const shot = step => page.screenshot({ path: `screenshots/Export/${object}-${format}-${step}.png` });
  const { type, scope, dateRange, request = {} } = OBJECTS[object];
  const columns = (await openExport(page))[type].fields; // { title: 'Title', ... }
  const main = page.getByRole('main');

  // Object type and format
  const objectButton = main.getByRole('button', { name: object, exact: true });
  await objectButton.click();
  await expect(objectButton).toHaveClass(/--active/);
  const columnList = main.getByRole('list').filter({ has: page.getByRole('checkbox') });
  await expect(columnList.getByRole('listitem'), `${object} columns should be listed`).toHaveText(Object.values(columns));
  const formatButton = main.getByRole('button', { name: format, exact: true });
  await formatButton.click();
  await expect(formatButton).toHaveClass(/--active/);

  // Every record: the widest scope and date range the object offers
  for (const name of [scope, dateRange].filter(Boolean)) {
    const button = main.getByRole('button', { name, exact: true });
    await button.click();
    await expect(button).toHaveClass(/--active/);
  }
  if (scope === 'All') {
    await expect(main.getByText(`Will export all ${object.toLowerCase()} whether archived or not.`)).toBeVisible();
  }

  // All columns (Export needs at least one)
  const exportButton = main.getByRole('button', { name: 'Export', exact: true });
  await main.getByRole('button', { name: 'Select None', exact: true }).click();
  await expect(exportButton, 'Export should need at least one column').toBeDisabled();
  await main.getByRole('button', { name: 'Select All', exact: true }).click();
  for (const box of await columnList.getByRole('checkbox').all()) await expect(box).toBeChecked();
  await expect(exportButton).toBeEnabled();
  await shot('1-options');

  // Export
  const [created] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith('/api/exports') && r.request().method() === 'POST', { timeout: 30000 }),
    exportButton.click(),
  ]);
  expect(created.status(), `Export API returned ${created.status()}`).toBe(201);
  const sent = created.request().postDataJSON();
  expect(sent).toMatchObject({ objectType: type, format: FORMATS[format], scope: 'all', columns: Object.keys(columns), ...request });
  if (dateRange) expect(JSON.stringify(sent.filters ?? {}), 'Any date range should not limit the dates').not.toMatch(/date/i);
  const job = (await created.json()).data;

  // Success message once the file is ready
  const fileType = FORMATS[format].toUpperCase();
  const success = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: `${fileType} Export` }) });
  await expect(success, 'Success message should show when the export is ready').toBeVisible({ timeout: 60000 });
  await expect(success).toContainText('Your export has finished processing.');
  await shot('2-success');

  // Download it
  const fileName = `${object.toLowerCase()}_export_${job.id}.${FORMATS[format]}`; // People: people_export_N
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30000 }),
    success.getByRole('button', { name: 'Download' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe(fileName);
  const file = test.info().outputPath(fileName);
  await download.saveAs(file);
  await expect(success, 'Success message should close after the download').toBeHidden();
  const [header, ...records] = readRows(file);
  expect(header, 'File should have every column').toEqual(Object.values(columns));
  console.log(`${object} ${format}: ${fileName} has ${header.length} columns and ${records.length} records`);

  // Export History lists it as ready with the same number of records
  await main.getByRole('combobox').selectOption({ label: object });
  const row = main.getByRole('row').filter({ hasText: fileName });
  await expect(row, `${fileName} should be in the Export History`).toBeVisible();
  const cells = row.getByRole('cell'); // File Name, Date, Status, Records, Format, Available Until, Actions
  await expect(cells.nth(2)).toHaveText('Ready');
  await expect(cells.nth(3), 'Records should match the file').toHaveText(String(records.length));
  await expect(cells.nth(4)).toHaveText(fileType);
  await row.scrollIntoViewIfNeeded();
  await shot('3-history');
}

/** Rows of a downloaded export file as arrays of cell text, header first. */
function readRows(file) {
  const content = fs.readFileSync(file);
  return file.endsWith('.csv') ? parseCsv(content.toString('utf8').replace(/^﻿/, '')) : parseXlsx(content);
}

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const XML_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const xmlText = xml => xml.replace(/<[^>]+>/g, '').replace(/&(\w+);/g, (m, name) => XML_ENTITIES[name] ?? m);

// Only what the export needs: the first sheet's rows, with shared or inline strings
function parseXlsx(xlsx) {
  const shared = [...(zipEntry(xlsx, 'xl/sharedStrings.xml') ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => xmlText(m[1]));
  return [...zipEntry(xlsx, 'xl/worksheets/sheet1.xml').matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].map(([, cells]) =>
    [...cells.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)].map(([, attrs, value = '']) =>
      (/ t="s"/.test(attrs) ? shared[xmlText(value)] : xmlText(value))));
}

/** Text of one file inside a zip archive (an .xlsx file is a zip of XML files). */
function zipEntry(zip, name) {
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06])); // end of central directory record
  let p = zip.readUInt32LE(end + 16);
  for (let i = zip.readUInt16LE(end + 10); i > 0; i--) {
    const nameLength = zip.readUInt16LE(p + 28);
    if (zip.toString('utf8', p + 46, p + 46 + nameLength) === name) {
      const local = zip.readUInt32LE(p + 42);
      const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
      const data = zip.subarray(start, start + zip.readUInt32LE(p + 20));
      return (zip.readUInt16LE(p + 10) === 8 ? zlib.inflateRawSync(data) : data).toString('utf8');
    }
    p += 46 + nameLength + zip.readUInt16LE(p + 30) + zip.readUInt16LE(p + 32);
  }
  return null;
}

module.exports = { exportAllColumns };
