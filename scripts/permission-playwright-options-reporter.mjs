import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export default class PermissionPlaywrightOptionsReporter {
  onBegin(config, suite) {
    this.output = process.env.PERM_PLAYWRIGHT_OPTIONS_FILE;
    if (!this.output) throw new Error('PERM_PLAYWRIGHT_OPTIONS_FILE_REQUIRED');
    this.options = {
      runner: 'playwright-actual-options-v1',
      projects: config.projects.map(project => ({ id: project.name, retries: project.retries, repeatEach: project.repeatEach })),
      tests: suite.allTests().map(test => ({ project: test.parent.project()?.name ?? '', file: resolve(test.location.file).replaceAll('\\', '/'),
        name: test.title, retries: test.retries, repeatEachIndex: test.repeatEachIndex, expectedStatus: test.expectedStatus })),
    };
  }

  onEnd() {
    const output = resolve(this.output);
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, `${JSON.stringify(this.options, null, 2)}\n`);
  }
}
