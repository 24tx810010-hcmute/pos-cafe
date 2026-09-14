import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import toast from 'react-hot-toast';
import { createMockPorts, createSeededMockState } from '@/adapters/mock';
import { AppError } from '@/core/appError';
import type { OperationView } from '@/domain';
import { PortsContext } from '@/features/shared/portsContext';
import { PaymentDrawer } from '@/app/drawers/pos/PaymentDrawer';
import { WriteLifecycle } from '@/app/WriteLifecycle';
import { useAppStore } from '@/app/useAppStore';

const clients: QueryClient[]=[];
const orderId='7e2f462b-e6ff-491a-85f8-9f4eb53d9c4c';
const draft=[{id:'93000000-0000-4000-8000-000000000001',menuItemId:'93000000-0000-4000-8000-000000000002',quantity:1,options:[]}];
afterEach(()=>{
  cleanup();clients.splice(0).forEach(c=>c.clear());vi.restoreAllMocks();
  useAppStore.setState({currentEmployee:null,drawer:null,orderContext:null,paymentOrderId:null,draftItems:[],receiptPreview:null,screen:'passcode'});
});
function Surface(){
  const employee=useAppStore(s=>s.currentEmployee),drawer=useAppStore(s=>s.drawer);
  return employee&&drawer==='payment'?<PaymentDrawer/>:null;
}
async function fixture(mode:'pay'|'split'){
  const state=createSeededMockState();state.session={storeId:state.settings.storeId,storeNo:1};
  const ports=createMockPorts(state),admin=state.employees.find(e=>e.role==='admin')!;
  await ports.employee.startSession(admin.id,state.pins[admin.id]);
  const client=new QueryClient({defaultOptions:{queries:{retry:false,staleTime:30000},mutations:{retry:false}}});clients.push(client);
  useAppStore.setState({currentEmployee:admin,drawer:'payment',paymentOrderId:orderId,orderContext:null,receiptPreview:null,draftItems:structuredClone(draft),screen:'passcode'});
  vi.spyOn(navigator,'onLine','get').mockReturnValue(true);
  render(<PortsContext.Provider value={ports}><QueryClientProvider client={client}><WriteLifecycle/><Surface/></QueryClientProvider></PortsContext.Provider>);
  await waitFor(()=>expect(screen.getByTestId('pay-select-all')).toBeChecked());
  if(mode==='split'){
    fireEvent.click(screen.getByTestId('pay-select-all'));
    fireEvent.click(screen.getAllByTestId('pay-item-checkbox')[0]);
    expect(screen.getAllByTestId('pay-item-quantity')[0]).toHaveTextContent('1/2');
  }
  await waitFor(()=>expect(screen.getByTestId('pay-button')).toBeEnabled());
  return {state,ports,admin,client,mode};
}
function transition(f:Awaited<ReturnType<typeof fixture>>,kind:'same_employee'|'offline_online'){
  if(kind==='same_employee'){
    const before=useAppStore.getState().employeeSessionVersion;
    act(()=>useAppStore.getState().setCurrentEmployee(f.admin));
    expect(useAppStore.getState().employeeSessionVersion).toBe(before+1);
  }else act(()=>{
    vi.spyOn(navigator,'onLine','get').mockReturnValue(false);window.dispatchEvent(new Event('offline'));
    vi.spyOn(navigator,'onLine','get').mockReturnValue(true);window.dispatchEvent(new Event('online'));
  });
}
async function errorSettled(client:QueryClient){
  await waitFor(()=>expect(client.getMutationCache().getAll().map(m=>m.state.status)).toEqual(['error']));
}
for(const mode of ['pay','split'] as const){
  for(const step of ['same_employee','offline_online'] as const)for(const code of ['AUTH_REQUIRED','EMPLOYEE_SESSION_REQUIRED'] as const){
    const tc=step==='offline_online'?'TC-IDEM-054':'TC-IDEM-053';
    test(`${tc}/core/payment=${mode}/transition=${step}/error=${code} ignores a rejected response from the previous payment lifetime`,async()=>{
      const f=await fixture(mode);let reject!:(reason:unknown)=>void;
      const register=vi.spyOn(f.ports.write,'register');
      const execute=vi.spyOn(f.ports.write,'execute').mockImplementationOnce(()=>new Promise<OperationView>((_,no)=>{reject=no}));
      fireEvent.click(screen.getByTestId('pay-button'));await waitFor(()=>expect(execute).toHaveBeenCalledTimes(1));
      expect(register.mock.calls[0][1].kind).toBe(mode==='pay'?'pay_order':'pay_order_items');
      transition(f,step);const current=useAppStore.getState();
      const error=vi.spyOn(toast,'error'),success=vi.spyOn(toast,'success'),revoke=vi.spyOn(f.ports.employee,'revokeSession');
      await act(async()=>{reject(new AppError(code,'Payment response from previous lifetime'));});await errorSettled(f.client);
      expect.soft(useAppStore.getState().currentEmployee).toBe(current.currentEmployee);
      expect.soft(useAppStore.getState().draftItems).toEqual(current.draftItems);
      expect.soft(useAppStore.getState().drawer).toBe('payment');
      expect.soft(useAppStore.getState().screen).toBe(current.screen);
      expect.soft(useAppStore.getState().receiptPreview).toBeNull();
      expect.soft(error).not.toHaveBeenCalled();expect.soft(success).not.toHaveBeenCalled();expect.soft(revoke).not.toHaveBeenCalled();
      expect(register).toHaveBeenCalledTimes(1);expect(execute).toHaveBeenCalledTimes(1);
    });
  }
  for(const step of ['same_employee','offline_online'] as const){
    const tc=step==='offline_online'?'TC-IDEM-054':'TC-IDEM-053';
    test(`${tc}/core/payment=${mode}/transition=${step}/response=applied keeps one business effect and no late payment UI effect`,async()=>{
      const f=await fixture(mode),original=f.ports.write.execute.bind(f.ports.write);let release!:()=>void;
      const register=vi.spyOn(f.ports.write,'register');
      const execute=vi.spyOn(f.ports.write,'execute').mockImplementationOnce(async(k,p)=>{
        const result=await original(k,p);expect(result.status).toBe('applied');await new Promise<void>(done=>{release=done});return result;
      });
      fireEvent.click(screen.getByTestId('pay-button'));await waitFor(()=>expect(release).toBeDefined());
      const business=structuredClone(f.state.orders);transition(f,step);
      const error=vi.spyOn(toast,'error'),success=vi.spyOn(toast,'success');
      await act(async()=>{release()});await errorSettled(f.client);
      expect(f.state.orders).toEqual(business);expect(register).toHaveBeenCalledTimes(1);expect(execute).toHaveBeenCalledTimes(1);
      expect.soft(useAppStore.getState().receiptPreview).toBeNull();expect.soft(useAppStore.getState().drawer).toBe('payment');
      expect.soft(useAppStore.getState().currentEmployee).toBe(f.admin);expect.soft(useAppStore.getState().draftItems).toEqual(draft);
      expect.soft(error).not.toHaveBeenCalled();expect.soft(success).not.toHaveBeenCalled();
    });
  }
  for(const code of ['AUTH_REQUIRED','EMPLOYEE_SESSION_REQUIRED'] as const){
    test(`TC-IDEM-006/core/payment=${mode}/error=${code} still handles a current payment authentication rejection`,async()=>{
      const f=await fixture(mode);const error=vi.spyOn(toast,'error'),revoke=vi.spyOn(f.ports.employee,'revokeSession');
      vi.spyOn(f.ports.write,'execute').mockRejectedValueOnce(new AppError(code,'Current payment authentication rejection'));
      fireEvent.click(screen.getByTestId('pay-button'));await errorSettled(f.client);
      expect(useAppStore.getState().currentEmployee).toBeNull();expect(useAppStore.getState().draftItems).toEqual([]);
      expect(useAppStore.getState().screen).toBe(code==='AUTH_REQUIRED'?'landing':'passcode');
      expect(error).toHaveBeenCalledTimes(1);expect(revoke).toHaveBeenCalledTimes(1);
    });
  }
  test(`TC-IDEM-051/core/payment=${mode}/response=current_applied keeps deliberate payment success and receipt preview`,async()=>{
    const f=await fixture(mode),execute=vi.spyOn(f.ports.write,'execute'),success=vi.spyOn(toast,'success');
    fireEvent.click(screen.getByTestId('pay-button'));
    await waitFor(()=>expect(f.client.getMutationCache().getAll().map(m=>m.state.status)).toEqual(['success']));
    expect(execute).toHaveBeenCalledTimes(1);expect(success).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().receiptPreview?.variant).toBe('receipt');
    expect(useAppStore.getState().drawer).toBe(mode==='pay'?null:'payment');
    if(mode==='split')expect(screen.getByTestId('payment-amount-due-value')).toHaveTextContent('0');
  });
}
