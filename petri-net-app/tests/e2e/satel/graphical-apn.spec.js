import { test, expect } from '@playwright/test';
async function load(page, id) {
  await page.getByRole('button', { name: 'Examples', exact: true }).click();
  await page.getByRole('textbox', { name: 'Find an example' }).fill('Methods & gates');
  await page.getByTestId(`example-gates-${id}`).click();
}
test('thesis graphical notation: quota boundary, ports and synchronizations', async ({ page }, info) => {
  const errors=[];page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await load(page,'exercise-quota-reference');
  await expect(page.getByRole('img', { name: /APN boundary with 3 black method ports, 4 white gate ports/ })).toBeAttached();
  await page.getByRole('button',{name:'Fit APN',exact:true}).click();
  await page.screenshot({path:info.outputPath('quota-boundary.png')});
  await page.getByRole('button',{name:'Call public method',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Call public method'});
  await dialog.getByLabel('reserve argument n').fill('3');
  await dialog.getByRole('button',{name:'Call reserve',exact:true}).click();
  await expect(dialog.getByRole('status')).toContainText('reserve(3): fired');
  await dialog.getByLabel('Close method calls').click();
  await page.getByRole('button',{name:'Fit APN',exact:true}).click();
  await page.screenshot({path:info.outputPath('quota-after-call.png')});
  expect(errors).toEqual([]);
});
test('source edits rebuild gate ports and synchronization edges', async ({page},info)=>{
  await page.goto('/');await load(page,'oracle-account-reference');
  await expect(page.getByRole('img',{name:/APN boundary with 4 black method ports, 3 white gate ports/})).toBeAttached();
  await page.getByTestId('toolbar-satel').click();
  await page.getByRole('button',{name:'APN source',exact:true}).click();
  const source=page.getByLabel('APN class source');
  const text=await source.inputValue();
  await source.fill(text.replace('  Gates\n','  Gates\n    extra : Nat;\n').replace('this.balanceResult (b)','this.balanceResult (b) // this.extra (b)'));
  await page.getByRole('button',{name:'Apply class',exact:true}).click();
  await expect(page.getByText('Class applied. Gate occurrences are separate from the marking.')).toBeVisible();
  await page.getByLabel('Close SATEL').click();
  await expect(page.getByRole('img',{name:/APN boundary with 4 black method ports, 4 white gate ports/})).toBeAttached();
  await page.getByRole('button',{name:'Fit APN',exact:true}).click();
  await page.screenshot({path:info.outputPath('account-boundary.png')});
});
