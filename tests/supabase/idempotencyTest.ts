import { test as base, type BrowserContext, type Page } from '@playwright/test';

// Keep fresh-device cleanup in fixture teardown so it cannot replace a body
// failure (or the step that timed out) with a secondary context.close error.
export const test = base.extend<{ newRecoveryPage: () => Promise<Page> }>({
  newRecoveryPage: async ({ browser, baseURL }, use) => {
    const contexts: BrowserContext[] = [];
    await use(async () => {
      const context = await browser.newContext({ baseURL });
      contexts.push(context);
      return context.newPage();
    });
    const closed = await Promise.allSettled(contexts.map((context) => context.close()));
    const errors = closed.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
    if (errors.length) throw new AggregateError(errors.map((result) => result.reason), 'RECOVERY_CONTEXT_CLEANUP_FAILED');
  },
});
