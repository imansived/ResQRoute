import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })

try {
  await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Generate dispatch plan' }).first().click()
  await page.getByRole('heading', { name: 'Dispatch center' }).waitFor()
  await page.getByRole('heading', { name: 'Feasible allocations' }).waitFor()
  const recommendationRows = page.locator('table tbody tr')
  assert.ok(await recommendationRows.count() > 0, 'dispatch plan should show feasible recommendation rows')
  const firstApprove = page.getByRole('button', { name: 'Approve' }).first()
  await firstApprove.click()
  await page.getByText('Reservation created for').waitFor()
  await page.getByRole('button', { name: 'Live shipments' }).click()
  await page.getByRole('heading', { name: 'Live shipments' }).waitFor()
  assert.ok(await page.getByText('SHP-').count() >= 1, 'approved plan should create a shipment record')
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Live shipments' }).click()
  await page.getByRole('heading', { name: 'Live shipments' }).waitFor()
  assert.ok(await page.getByText('SHP-').count() >= 1, 'shipment should persist after refresh')
  await page.getByRole('button', { name: 'Simulation lab' }).click()
  await page.getByRole('heading', { name: 'Simulation lab' }).waitFor()
  for (const letter of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']) {
    await page.getByRole('button', { name: 'Run scenario' }).nth('ABCDEFGH'.indexOf(letter)).click()
    await page.getByText(`Scenario ${letter} passed.`).waitFor()
  }
  assert.equal(errors.length, 0, `browser errors: ${errors.join(' | ')}`)
  console.log('UI smoke passed: dispatch generation, approval, navigation, refresh persistence, and scenarios A-H.')
} finally {
  await browser.close()
}
