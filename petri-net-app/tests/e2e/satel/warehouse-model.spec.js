import {test,expect} from '@playwright/test';
test('warehouse specification loads with thesis notation and generates its recursive basket tests in the browser worker',async({page})=>{
 test.setTimeout(120000);await page.goto('/');await page.getByRole('button',{name:'Examples',exact:true}).click();await page.getByRole('textbox',{name:'Find an example'}).fill('Warehouse orders');await page.getByTestId('example-warehouse-reference').click();
 await expect(page.getByRole('img',{name:/WarehouseOrders: APN boundary with 28 black method ports, 8 white gate ports and 42 gate synchronization edges/})).toBeAttached({timeout:30000});
 await page.getByTestId('toolbar-satel').click();await page.getByRole('button',{name:'APN source',exact:true}).click();await expect(page.getByLabel('APN class source')).toHaveValue(/Class WarehouseOrders/);
 await page.getByRole('button',{name:'Generated tests',exact:true}).click();await page.getByRole('button',{name:'Generate tests',exact:true}).click();await expect(page.getByText('12/12 tests passed the reference oracle')).toBeVisible({timeout:90000});
});
