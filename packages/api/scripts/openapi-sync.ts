import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { runOpenApiSync } from '../src/openapi/sync.js';

const { values } = parseArgs({
  options: {
    out: { type: 'string', default: fileURLToPath(new URL('../../../docs/openapi/api-docs.json', import.meta.url)) },
    check: { type: 'boolean', default: false },
  },
});

const status = await runOpenApiSync({ outPath: values.out, check: values.check });
if (status === 'stale') {
  console.error(`${values.out} is out of date, run \`pnpm --filter @went.tf/hammertime-api run openapi:sync\``);
  process.exitCode = 1;
} else {
  console.log(`${values.out}: ${status}`);
}
