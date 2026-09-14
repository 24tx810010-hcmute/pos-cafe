import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { createMockPorts, createSeededMockState } from '@/adapters/mock';
import { PortsContext } from '@/features/shared/portsContext';
import { getWriteCoordinator } from '@/features/pos/writeOperationFlow';
import { OrderDrawer } from '@/app/drawers/pos/OrderDrawer';
import { WriteLifecycle } from '@/app/WriteLifecycle';
import { useAppStore } from '@/app/useAppStore';

const clients:QueryClient[]=[];
afterEach(()=>{cleanup();clients.splice(0).forEach(client=>client.clear());vi.restoreAllMocks();useAppStore.setState({currentEmployee:null,drawer:null,orderContext:null,paymentOrderId:null,draftItems:[],receiptPreview:null});});
function Surface(){return useAppStore(state=>state.drawer)==='order'?<OrderDrawer/>:null;}
async function fixture(){
  const state=createSeededMockState();state.session={storeId:state.settings.storeId,storeNo:1};state.orders=[];state.menu.optionGroups=[];state.menu.optionValues=[];state.menu.menuItemOptionGroups=[];
  const ports=createMockPorts(state);const actor=state.employees.find(employee=>employee.role==='admin')!;await ports.employee.startSession(actor.id,state.pins[actor.id]);
  useAppStore.setState({currentEmployee:actor,drawer:'order',orderContext:{orderId:null,tableId:null,orderType:'takeaway'},draftItems:[],receiptPreview:null});
  const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});clients.push(client);
  render(<PortsContext.Provider value={ports}><QueryClientProvider client={client}><WriteLifecycle/><Surface/></QueryClientProvider></PortsContext.Provider>);
  fireEvent.click(await screen.findByTestId(`menu-item-${state.menu.menuItems[0].id}`));
  return {state,ports,actor};
}
test('TC-IDEM-053/core/session=same_employee an ACK cannot cross a new employee-session generation',async()=>{
  const f=await fixture();const original=f.ports.write.execute.bind(f.ports.write);let release!:()=>void;
  vi.spyOn(f.ports.write,'execute').mockImplementation(async(k,p)=>{const result=await original(k,p);await new Promise<void>(resolve=>{release=resolve;});return result;});
  fireEvent.click(screen.getByTestId('submit-order-button'));await waitFor(()=>expect(release).toBeDefined());
  expect(f.state.orders).toHaveLength(1);const version=useAppStore.getState().employeeSessionVersion;
  act(()=>useAppStore.getState().setCurrentEmployee(f.actor));expect(useAppStore.getState().employeeSessionVersion).toBe(version+1);
  await act(async()=>release());
  await waitFor(()=>expect(getWriteCoordinator(f.ports.write).snapshot()?.status).not.toBe('executing'));
  expect(useAppStore.getState().receiptPreview).toBeNull();
});
