import { test, expect } from '@playwright/test';
test('HR specification loads in the editor and generates all 25 recursive work-log classes in its worker',async({page})=>{
 test.setTimeout(120000);
 await page.goto('/');await page.getByRole('button',{name:'Examples',exact:true}).click();
 await page.getByRole('textbox',{name:'Find an example'}).fill('HR management');
 await page.getByTestId('example-hr-management-reference').click();
 await expect(page.getByRole('img',{name:/HRManagement: APN boundary with 12 black method ports, 6 white gate ports/})).toBeAttached({timeout:30000});
 await page.getByTestId('toolbar-satel').click();await page.getByRole('button',{name:'APN source',exact:true}).click();
 await expect(page.getByLabel('APN class source')).toHaveValue(/Class HRManagement/);
 await page.getByRole('button',{name:'Generated tests',exact:true}).click();
 await page.getByRole('button',{name:'Generate tests',exact:true}).click();
 await expect(page.getByText('25/25 tests passed the reference oracle')).toBeVisible({timeout:90000});
});
