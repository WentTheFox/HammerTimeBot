import { Ajv } from 'ajv';
import {
  parseCommandsFile,
  registerFrameworkSchemas,
  resolveCommandsSchemaRefs,
} from '@went.tf/discord-bot-framework/commands/schema';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { CommandsFile, generateSource, LocaleFile } from './generate.js';

export interface RunGenerateOptions {
  commandsPath: string;
  localePath: string;
  outPath: string;
  /** Write nothing and report whether the output on disk differs from what the input would produce */
  check?: boolean;
  /** Defaults to commands.schema.json next to the commands file */
  schemaPath?: string;
}

export type RunGenerateStatus = 'written' | 'unchanged' | 'stale';

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;

export const runGenerate = ({
  commandsPath,
  localePath,
  outPath,
  check = false,
  schemaPath = join(dirname(commandsPath), 'commands.schema.json'),
}: RunGenerateOptions): RunGenerateStatus => {
  // Same validation as the bot's command sync: the file's $refs point at the framework's schemas by relative
  // path (for editors), which have to be rewritten to the ids they are registered under
  const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
  registerFrameworkSchemas(ajv);
  const validate = ajv.compile(resolveCommandsSchemaRefs(readJson<object>(schemaPath)));
  const commands = parseCommandsFile<CommandsFile>(readJson<unknown>(commandsPath), { validate });

  const source = generateSource({ commands, locale: readJson<LocaleFile>(localePath) });

  let current: string | null = null;
  try {
    current = readFileSync(outPath, 'utf8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw e;
    }
  }
  if (current === source) {
    return 'unchanged';
  }
  if (check) {
    return 'stale';
  }

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, source);
  return 'written';
};
