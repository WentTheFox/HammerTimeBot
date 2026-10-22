import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { runGenerate } from '../src/generator/run.js';

const fromPackage = (path: string) => fileURLToPath(new URL(path, import.meta.url));

const { values } = parseArgs({
  options: {
    commands: { type: 'string', default: fromPackage('../../../src/commands.json') },
    locale: { type: 'string', default: fromPackage('../../../src/locales/en-US/translation.json') },
    out: { type: 'string', default: fromPackage('../src/generated/commands.ts') },
    check: { type: 'boolean', default: false },
  },
});

try {
  const status = runGenerate({
    commandsPath: values.commands,
    localePath: values.locale,
    outPath: values.out,
    check: values.check,
  });
  if (status === 'stale') {
    console.error(`${values.out} is out of date, run \`pnpm --filter @went.tf/hammertime-api run generate\``);
    process.exitCode = 1;
  } else {
    console.log(`${values.out}: ${status}`);
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
}
