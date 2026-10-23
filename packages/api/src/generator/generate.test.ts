import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { API_COMMANDS, CommandsFile, generateSource, LocaleFile } from './generate.js';
import { runGenerate } from './run.js';

const repoFile = (path: string) => fileURLToPath(new URL(`../../../../${path}`, import.meta.url));
const realCommands = JSON.parse(readFileSync(repoFile('src/commands.json'), 'utf8')) as CommandsFile;
const realLocale = JSON.parse(readFileSync(repoFile('src/locales/en-US/translation.json'), 'utf8')) as LocaleFile;

describe('generateSource', () => {
  const source = generateSource({ commands: realCommands, locale: realLocale });

  it('is deterministic', () => {
    expect(generateSource({ commands: realCommands, locale: realLocale })).toBe(source);
  });

  it('only depends on the commands, not on their order in the file', () => {
    const reversed = { ...realCommands, commands: [...realCommands.commands].reverse() };
    expect(generateSource({ commands: reversed, locale: realLocale })).toBe(source);
  });

  it('exposes exactly the API commands, sorted', () => {
    expect(source).toContain(`export const commandNames = [${[...API_COMMANDS].sort().map(name => `"${name}"`).join(', ')}] as const;`);
  });

  it('turns the option definitions into constraints', () => {
    expect(source).toContain('"month": z.number().int().min(1).max(12).optional()');
    expect(source).toContain('"second": z.number().min(0).max(59.999).optional()');
    expect(source).toContain('"to": z.number().openapi(');
    expect(source).toContain('"value": z.string().min(10).max(25).openapi(');
    expect(source).toContain('"am": z.boolean().optional()');
  });

  it('turns choices into enums and keeps their names as data, not in the description', () => {
    expect(source).toContain('z.enum(["d", "f", "t", "D", "F", "s", "S", "R", "T", "all"])');
    expect(source).toContain(`'x-enum-labels': {"d":"short date","f":"date and time"`);
    expect(source).toMatch(/commandChoiceLabels[^]*"at": \{\n {4}"format": \{"d":"short date"/);
    expect(source).not.toContain('Choices:');
    expect(source).toContain('z.enum(["both", "preview", "syntax"])');
  });

  it('takes descriptions from the command, falling back to the shared option texts', () => {
    expect(source).toContain('"Specify the year (defaults to current year)"');
    expect(source).toContain('"Returns only the specified format in the response"');
  });

  it('reports the Discord option type of every option', () => {
    expect(source).toMatch(/"at": \{\n {4}"year": 4,/);
    expect(source).toContain('"hour": 3,');
    expect(source).toContain('"second": 10,');
    expect(source).toContain('"am": 5,');
  });

  it('includes the English texts of every error and the telemetry note', () => {
    expect(source).toContain('"commands.at.responses.hourRange": "When a meridiem is not specified');
    expect(source).toContain('"telemetryInfoCount": "This is execution #{{executionNumber}}');
  });

  it('fails when a command the API exposes is missing from commands.json', () => {
    const without = { ...realCommands, commands: realCommands.commands.filter(command => command.name !== 'snowflake') };
    expect(() => generateSource({ commands: without, locale: realLocale })).toThrow(/no command named "snowflake"/);
  });

  it('fails when the locale lacks a description', () => {
    const locale = structuredClone(realLocale) as { commands: { at: { options: { year: unknown } } } };
    delete (locale.commands.at.options as Record<string, unknown>).year;
    expect(() => generateSource({ commands: realCommands, locale: locale as unknown as LocaleFile })).toThrow(/no text at commands.global.options.year.description/);
  });

  it('fails on an option type it cannot represent', () => {
    const commands = structuredClone(realCommands);
    commands.commands.find(command => command.name === 'unix')!.options![0].type = 'USER';
    expect(() => generateSource({ commands, locale: realLocale })).toThrow(/unsupported type USER/);
  });
});

describe('runGenerate', () => {
  let dir: string;
  let commandsPath: string;
  let outPath: string;
  const run = (check = false) => runGenerate({
    commandsPath,
    localePath: repoFile('src/locales/en-US/translation.json'),
    outPath,
    check,
    schemaPath: repoFile('src/commands.schema.json'),
  });

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'hammertime-generate-'));
    commandsPath = join(dir, 'commands.json');
    outPath = join(dir, 'out', 'commands.ts');
    writeFileSync(commandsPath, JSON.stringify(realCommands));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('writes once, then reports nothing to do', () => {
    expect(run()).toBe('written');
    const first = readFileSync(outPath, 'utf8');
    expect(run()).toBe('unchanged');
    expect(readFileSync(outPath, 'utf8')).toBe(first);
  });

  it('writes nothing in check mode and reports a missing output as stale', () => {
    expect(run(true)).toBe('stale');
    expect(() => readFileSync(outPath)).toThrow();
  });

  it('reports a changed input as stale until regenerated', () => {
    run();
    expect(run(true)).toBe('unchanged');

    const changed = structuredClone(realCommands);
    changed.commands.find(command => command.name === 'at')!.options!.find(option => option.name === 'month')!.max_value = 11;
    writeFileSync(commandsPath, JSON.stringify(changed));
    expect(run(true)).toBe('stale');
    expect(run()).toBe('written');
    expect(run(true)).toBe('unchanged');
  });

  it('rejects a commands file that does not match the schema, without writing', () => {
    writeFileSync(commandsPath, JSON.stringify({ commands: [{ type: 'CHAT_INPUT', name: 'BAD NAME' }] }));
    expect(() => run()).toThrow();
    expect(() => readFileSync(outPath)).toThrow();
  });

  it('matches the generated module that is committed', () => {
    expect(runGenerate({
      commandsPath: repoFile('src/commands.json'),
      localePath: repoFile('src/locales/en-US/translation.json'),
      outPath: repoFile('packages/api/src/generated/commands.ts'),
      check: true,
    })).toBe('unchanged');
  });
});
