import { test, expect } from '@playwright/test';
async function load(page,id){
 await page.getByRole('button',{name:'Examples',exact:true}).click();
 await page.getByRole('textbox',{name:'Find an example'}).fill('Methods & gates');
 await page.getByTestId(`example-gates-${id}`).click();
}
async function sourceTab(page){
 await page.getByTestId('toolbar-satel').click();
 await page.getByRole('button',{name:'APN source',exact:true}).click();
}
test('converted account: inspect/edit source, generate in worker and replay frozen suite on a mutant',async({page},info)=>{
 await page.goto('/'); await load(page,'oracle-account-reference'); await sourceTab(page);
 const source=page.getByRole('textbox',{name:'APN class source'});
 await expect(source).toContainText('With this.ack');
 const text=await source.inputValue(); expect(text).toContain('balance : Nat'); expect(text).not.toContain('ack (0);');
 await source.fill(text.replace('this.ack (1)','this.missing (1)'));
 await page.getByRole('button',{name:'Apply class',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('Invalid gate call');
 await source.fill(text.replace('this.ack (1)', 'this.ack (\n  1\n)'));await page.getByRole('button',{name:'Apply class',exact:true}).click();
 await expect(page.getByText('Class applied. Gate occurrences are separate from the marking.')).toBeVisible();
 await page.screenshot({path:info.outputPath('gates-account-source.png')});
 await page.getByRole('button',{name:'Generated tests',exact:true}).click();
 await page.getByRole('button',{name:'Generate tests',exact:true}).click();
 await expect(page.getByText('4/4 tests passed the reference oracle')).toBeVisible({timeout:45000});
 await page.getByLabel('Close SATEL').click();await load(page,'oracle-account-no-debit');
 await page.getByTestId('toolbar-satel').click();
 await page.getByRole('button',{name:'Replay results',exact:true}).click();
 await page.getByRole('button',{name:'Replay frozen suite on loaded APN'}).click();
 await expect(page.getByTestId('oracle-target-results')).toContainText('2 passed · 2 failed · 0 errors');
});

test('GUI public call reports gates without accumulating output places',async({page},info)=>{
 await page.goto('/');await load(page,'oracle-account-reference');
 await page.getByRole('button',{name:'Call public method',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Call public method'});
 await dialog.getByLabel('deposit argument n').fill('5');await dialog.getByRole('button',{name:'Call deposit',exact:true}).click();
 await expect(dialog.getByRole('status')).toContainText('deposit(5): fired');
 await expect(dialog.getByRole('status')).toContainText('ack');
 await dialog.getByLabel('Close method calls').click();
 await sourceTab(page);
 await page.getByRole('button',{name:'Reload current model'}).click();
 const text=await page.getByLabel('APN class source').inputValue();
 expect(text).toContain('balance (5)');expect(text.split('  Places')[1].split('  Initial')[0]).not.toContain('ack');
 await page.screenshot({path:info.outputPath('gates-account-after-call.png')});
});

for(const type of ['string','list','pair']) test(`${type}: gate-based joint selection and replay in browser worker`,async({page})=>{
 await page.goto('/');await load(page,`hml-adt-${type}-reference`);
 await page.getByTestId('toolbar-satel').click();await page.getByRole('button',{name:'Generated tests',exact:true}).click();
 await page.getByRole('button',{name:'Generate tests',exact:true}).click();
 await expect(page.getByText('1/1 tests passed the reference oracle')).toBeVisible({timeout:45000});
 await page.getByLabel('Close SATEL').click();await load(page,`hml-adt-${type}-wrong-value`);
 await page.getByTestId('toolbar-satel').click();await page.getByRole('button',{name:'Replay results',exact:true}).click();
 await page.getByRole('button',{name:'Replay frozen suite on loaded APN'}).click();
 await expect(page.getByTestId('oracle-target-results')).toContainText('0 passed · 1 failed · 0 errors');
});
