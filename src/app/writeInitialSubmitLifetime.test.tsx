import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import toast from 'react-hot-toast';
import { AppError } from '@/core/appError';
import type { OperationView } from '@/domain';
import { createMockPorts, createSeededMockState } from '@/adapters/mock';
import { PortsContext } from '@/features/shared/portsContext';
import { OrderDrawer } from '@/app/drawers/pos/OrderDrawer';
import { WriteLifecycle } from '@/app/WriteLifecycle';
import { useAppStore } from '@/app/useAppStore';

const clients: QueryClient[] = [];
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); vi.restoreAllMocks(); useAppStore.setState({ currentEmployee: null, drawer: null, orderContext: null, paymentOrderId: null, draftItems: [], receiptPreview: null }); });
function Surface() { return useAppStore(state => state.drawer) === 'order' ? <OrderDrawer /> : null; }
async function fixture() {
  const state = createSeededMockState(); state.session = { storeId: state.settings.storeId, storeNo: 1 }; state.orders = [];
  state.menu.optionGroups = []; state.menu.optionValues = []; state.menu.menuItemOptionGroups = [];
  const ports = createMockPorts(state); const actor = state.employees.find(employee => employee.role === 'admin')!;
  await ports.employee.startSession(actor.id, state.pins[actor.id]);
  useAppStore.setState({ currentEmployee: actor, drawer: 'order', orderContext: { orderId: null, tableId: null, orderType: 'takeaway' }, draftItems: [], receiptPreview: null });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }); clients.push(client);
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  render(<PortsContext.Provider value={ports}><QueryClientProvider client={client}><WriteLifecycle /><Surface /></QueryClientProvider></PortsContext.Provider>);
  fireEvent.click(await screen.findByTestId(`menu-item-${state.menu.menuItems[0].id}`));
  return { state, ports, actor, client };
}
for (const transition of ['same_employee', 'offline_online'] as const) {
  for (const code of ['EMPLOYEE_SESSION_REQUIRED', 'AUTH_REQUIRED'] as const) {
    test(`${transition === "same_employee" ? "TC-IDEM-053" : "TC-IDEM-054"}/core/initial=submit/transition=${transition}/error=${code} preserves the current lifetime after a late authentication error`, async () => {
      const f = await fixture(); let reject!: (reason: unknown) => void;
      vi.spyOn(f.ports.write, 'execute').mockImplementationOnce(() => new Promise<OperationView>((_, fail) => { reject = fail; }));
      fireEvent.click(screen.getByTestId('submit-order-button')); await waitFor(() => expect(reject).toBeDefined());
      if (transition === 'same_employee') {
        await f.ports.employee.startSession(f.actor.id, f.state.pins[f.actor.id]);
        act(() => useAppStore.getState().setCurrentEmployee(f.actor));
      } else {
        act(() => { vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false); window.dispatchEvent(new Event('offline')); vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true); window.dispatchEvent(new Event('online')); });
      }
      const before = useAppStore.getState(); const error = vi.spyOn(toast, 'error'); const revoke = vi.spyOn(f.ports.employee, 'revokeSession');
      await act(async () => reject(new AppError(code, 'Old initial submit error')));
      await waitFor(() => expect(f.client.getMutationCache().getAll().map(mutation => mutation.state.status)).toEqual(['error']));
      expect.soft(useAppStore.getState().currentEmployee).toBe(f.actor);
      expect.soft(useAppStore.getState().draftItems).toEqual(before.draftItems);
      expect.soft(error).not.toHaveBeenCalled(); expect.soft(revoke).not.toHaveBeenCalled();
    });
  }
}
for (const code of ['EMPLOYEE_SESSION_REQUIRED', 'AUTH_REQUIRED'] as const) {
  test(`TC-IDEM-006/core/initial=submit/error=${code} still signs out on a current authentication error`, async () => {
    const f = await fixture();
    vi.spyOn(f.ports.write, 'execute').mockRejectedValueOnce(new AppError(code, 'Current initial submit error'));
    const error = vi.spyOn(toast, 'error'); const revoke = vi.spyOn(f.ports.employee, 'revokeSession');
    fireEvent.click(screen.getByTestId('submit-order-button'));
    await waitFor(() => expect(useAppStore.getState().currentEmployee).toBeNull());
    expect(useAppStore.getState().screen).toBe(code === 'AUTH_REQUIRED' ? 'landing' : 'passcode');
    expect(error).toHaveBeenCalledTimes(1); expect(revoke).toHaveBeenCalledTimes(1);
  });
}

for (const transition of ['same_employee', 'offline_online'] as const) {
  test(`${transition === "same_employee" ? "TC-IDEM-053" : "TC-IDEM-054"}/core/initial=submit/transition=${transition}/result=applied ignores an ACK from an old lifetime`, async () => {
    const f = await fixture(); let release!: () => void;
    const original = f.ports.write.execute.bind(f.ports.write);
    const register = vi.spyOn(f.ports.write, 'register');
    const execute = vi.spyOn(f.ports.write, 'execute').mockImplementationOnce(async (key, payload) => {
      const result = await original(key, payload);
      await new Promise<void>(resolve => { release = resolve; });
      return result;
    });
    fireEvent.click(screen.getByTestId('submit-order-button')); await waitFor(() => expect(release).toBeDefined());
    expect(f.state.orders).toHaveLength(1);
    if (transition === 'same_employee') {
      await f.ports.employee.startSession(f.actor.id, f.state.pins[f.actor.id]);
      act(() => useAppStore.getState().setCurrentEmployee(f.actor));
    } else {
      act(() => { vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false); window.dispatchEvent(new Event('offline')); vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true); window.dispatchEvent(new Event('online')); });
    }
    const before = useAppStore.getState(); const error = vi.spyOn(toast, 'error'); const success = vi.spyOn(toast, 'success');
    await act(async () => release());
    await waitFor(() => expect(f.client.getMutationCache().getAll().every(mutation => mutation.state.status !== 'pending')).toBe(true));
    expect(useAppStore.getState().currentEmployee).toBe(f.actor);
    expect(useAppStore.getState().draftItems).toEqual(before.draftItems);
    expect(useAppStore.getState().orderContext).toBe(before.orderContext);
    expect(useAppStore.getState().drawer).toBe(before.drawer);
    expect(useAppStore.getState().receiptPreview).toBeNull();
    expect(error).not.toHaveBeenCalled(); expect(success).not.toHaveBeenCalled();
    expect(register).toHaveBeenCalledTimes(1); expect(execute).toHaveBeenCalledTimes(1); expect(f.state.orders).toHaveLength(1);
  });
}
test('TC-IDEM-051/core/initial=submit/result=applied opens the initial kitchen preview once', async () => {
  const f = await fixture(); const register = vi.spyOn(f.ports.write, 'register'); const execute = vi.spyOn(f.ports.write, 'execute');
  const error = vi.spyOn(toast, 'error'); const success = vi.spyOn(toast, 'success');
  fireEvent.click(screen.getByTestId('submit-order-button'));
  await waitFor(() => expect(useAppStore.getState().drawer).toBeNull());
  expect(useAppStore.getState().currentEmployee).toBe(f.actor);
  expect(useAppStore.getState().receiptPreview?.variant).toBe('kitchen');
  expect(error).not.toHaveBeenCalled(); expect(success).toHaveBeenCalledTimes(1);
  expect(register).toHaveBeenCalledTimes(1); expect(execute).toHaveBeenCalledTimes(1); expect(f.state.orders).toHaveLength(1);
});
