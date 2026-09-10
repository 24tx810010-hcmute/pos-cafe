import { preflight } from '../contracts/preflight.ts';
export default async function setup() { await preflight({ requireBrowserStack: true }); }
