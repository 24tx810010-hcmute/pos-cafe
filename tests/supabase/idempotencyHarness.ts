import { expect, type Page } from '@playwright/test';
import { ContractHarness } from '../contracts/harness.ts';
import { ids } from '../contracts/fixtures.ts';
export const serverHarness=new ContractHarness();
export async function pairAndUnlock(page:Page,actor:'A'|'B'|'C'|'E'='A') {
  const storeKey=process.env.IDEM_TEST_STORE_KEY;
  if(!storeKey)throw new Error('BLOCKED_E2E: IDEM_TEST_STORE_KEY for a real GoTrue fixture is required');
  const network:{path:string;status:number;code?:string}[]=[];
  const listener=async(response:any)=>{const path=new URL(response.url()).pathname;if(path.startsWith('/auth/v1/')||path==='/rest/v1/stores'){let data:any;try{data=await response.json();}catch{}network.push({path,status:response.status(),code:typeof data?.code==='string'?data.code:typeof data?.error_code==='string'?data.error_code:undefined});}};
  page.on('response',listener);
  await page.goto('/');await page.getByTestId('go-store-pairing').click();await page.getByTestId('store-key-input').fill(storeKey);await page.getByTestId('go-passcode').click();
  try{await page.getByTestId('passcode-screen').waitFor({timeout:10000});}catch{throw new Error(`REAL_PAIRING_FAILED: ${JSON.stringify(network)}`);}finally{page.off('response',listener);const input=page.getByTestId('store-key-input');if(await input.isVisible())await input.fill('');}
  await unlock(page,actor);
}
export async function unlock(page:Page,actor:'A'|'B'|'C'|'E'='A') {
  await page.getByTestId('passcode-screen').waitFor();await page.getByTestId(`employee-${ids[actor]}`).click();
  const pin={A:'123456',B:'111111',C:'222222',E:'333333'}[actor];for(const digit of pin)await page.getByTestId(`pin-${digit}`).click();
  await page.getByTestId('unlock-button').click();await expect(page.getByTestId('floor-view')).toBeVisible();
}
export async function openPayment(page:Page){await page.getByTestId(`table-${ids.B01}`).click();await page.getByTestId('submit-order-button-footer').click();await expect(page.getByTestId('payment-drawer')).toBeVisible();}
export async function openRecovery(page:Page,key=ids.K1){
  const notice=page.getByTestId('write-attempt-notice');
  if(await notice.isVisible())await notice.getByRole('button',{name:'Tra cứu thao tác',exact:true}).click();
  else await page.getByTestId('nav-write-recovery').click();
  await expect(page.getByTestId('write-recovery-drawer')).toBeVisible();await page.getByTestId(`operation-${key}`).click();await expect(page.getByTestId('operation-status')).toBeVisible();
}
export function watchWrites(page:Page){
  const requests:{name:string;body:any}[]=[];
  page.on('request',request=>{const name=request.url().split('/rpc/')[1];if(name&&['register_write_operation','execute_write_operation','cancel_write_operation'].includes(name))requests.push({name,body:request.postDataJSON()});});
  return requests;
}
export async function installPrintCounter(page:Page){
  await page.addInitScript(()=>{if(window===window.top)(window as any).__idemPrintCount=0;window.print=()=>{const host=window.top as any;host.__idemPrintCount=(host.__idemPrintCount??0)+1;};});
}
export const printCount=(page:Page)=>page.evaluate(()=>(window as any).__idemPrintCount??0);
export async function closeReceipt(page:Page){const receipt=page.getByTestId('receipt-preview');if(await receipt.isVisible())await receipt.getByTestId('receipt-close-footer').click();}
export async function currentOrders(){return (await serverHarness.snapshot()).orders;}
