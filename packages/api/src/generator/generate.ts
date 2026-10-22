import { commandErrorKeys } from '@went.tf/hammertime-core';

/** The bot commands that have an API endpoint and an MCP tool (`settings` is handled by hand) */
export const API_COMMANDS = ['at', 'at12', 'iso', 'unix', 'in', 'ago', 'add', 'subtract', 'snowflake'] as const;

// Discord's ApplicationCommandOptionType, which is what the bot reports to the telemetry endpoint
const OPTION_TYPE_IDS: Record<string, number> = {
  STRING: 3,
  INTEGER: 4,
  BOOLEAN: 5,
  NUMBER: 10,
};

export interface CommandOption {
  type: string;
  name: string;
  required?: boolean;
  min_value?: number;
  max_value?: number;
  min_length?: number;
  max_length?: number;
  choices?: { name: string; value: string | number }[];
}

export interface CommandEntry {
  type: string;
  name: string;
  options?: CommandOption[];
}

export interface CommandsFile {
  commands: CommandEntry[];
}

export type LocaleFile = Record<string, unknown>;

export interface GenerateInput {
  commands: CommandsFile;
  locale: LocaleFile;
  include?: readonly string[];
}

const lookup = (locale: LocaleFile, path: string[]): unknown =>
  path.reduce<unknown>((node, key) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[key] : undefined), locale);

const requireString = (locale: LocaleFile, path: string[]): string => {
  const value = lookup(locale, path);
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`The locale has no text at ${path.join('.')}`);
  }
  return value;
};

const optionDescription = (locale: LocaleFile, command: string, option: string): string => {
  const own = lookup(locale, ['commands', command, 'options', option, 'description']);
  if (typeof own === 'string' && own.length > 0) {
    return own;
  }
  return requireString(locale, ['commands', 'global', 'options', option, 'description']);
};

const literal = (value: unknown): string => JSON.stringify(value);

const pascalCase = (name: string): string => name.replace(/(^|[-_])(\w)/g, (_, __, char: string) => char.toUpperCase());

const zodExpression = (command: string, option: CommandOption, locale: LocaleFile): string => {
  let description = optionDescription(locale, command, option.name);
  let expression: string;
  switch (option.type) {
    case 'INTEGER':
    case 'NUMBER': {
      expression = option.type === 'INTEGER' ? 'z.number().int()' : 'z.number()';
      if (typeof option.min_value === 'number') expression += `.min(${option.min_value})`;
      if (typeof option.max_value === 'number') expression += `.max(${option.max_value})`;
      break;
    }
    case 'STRING': {
      if (option.choices && option.choices.length > 0) {
        expression = `z.enum([${option.choices.map(choice => literal(choice.value)).join(', ')}])`;
        description += ` Choices: ${option.choices.map(choice => `${choice.value} (${choice.name})`).join(', ')}.`;
      } else {
        expression = 'z.string()';
        if (typeof option.min_length === 'number') expression += `.min(${option.min_length})`;
        if (typeof option.max_length === 'number') expression += `.max(${option.max_length})`;
      }
      break;
    }
    case 'BOOLEAN': {
      expression = 'z.boolean()';
      break;
    }
    default:
      throw new Error(`Option ${command}.${option.name} has the unsupported type ${option.type}`);
  }
  if (!option.required) {
    expression += '.optional()';
  }
  return `${expression}.openapi({ description: ${literal(description)} })`;
};

/**
 * Builds the source of the generated module from the bot's `commands.json` and the English locale.
 * The output is deterministic (stable ordering, no timestamps) so a re-run on unchanged input is a no-op.
 */
export const generateSource = ({ commands, locale, include = API_COMMANDS }: GenerateInput): string => {
  const byName = new Map(commands.commands.map(entry => [entry.name, entry]));
  const names = [...include].sort();
  const entries = names.map(name => {
    const entry = byName.get(name);
    if (!entry) {
      throw new Error(`The commands file has no command named "${name}", which the API exposes`);
    }
    if (entry.type !== 'CHAT_INPUT') {
      throw new Error(`Command "${name}" is not a chat input command`);
    }
    return entry;
  });

  const summaries = entries.map(entry => `  ${literal(entry.name)}: ${literal(requireString(locale, ['commands', entry.name, 'description']))},`);
  const optionTypes = entries.map(entry => {
    const types = (entry.options ?? []).map(option => {
      const id = OPTION_TYPE_IDS[option.type];
      if (id === undefined) {
        throw new Error(`Option ${entry.name}.${option.name} has the unsupported type ${option.type}`);
      }
      return `    ${literal(option.name)}: ${id},`;
    });
    return `  ${literal(entry.name)}: {\n${types.join('\n')}\n  },`;
  });
  const schemas = entries.map(entry => {
    const fields = (entry.options ?? []).map(option => `    ${literal(option.name)}: ${zodExpression(entry.name, option, locale)},`);
    return `  ${literal(entry.name)}: z.object({\n${fields.join('\n')}\n  }).openapi(${literal(`${pascalCase(entry.name)}Request`)}),`;
  });
  const messages = commandErrorKeys.map(key => `  ${literal(key)}: ${literal(requireString(locale, key.split('.')))},`);
  const telemetry = ['telemetryInfoCount', 'telemetryThankYou', 'privacyPolicyLink'].map(
    key => `  ${literal(key)}: ${literal(requireString(locale, ['commands', 'global', 'components', key]))},`,
  );

  return `// Generated by \`pnpm --filter @went.tf/hammertime-api run generate\`; do not edit.
// Inputs: the bot's commands.json (names, option types, bounds, choices) and its en-US locale (descriptions, messages).
import { z } from '@hono/zod-openapi';
import type { CommandErrorKey } from '@went.tf/hammertime-core';

export const commandNames = [${names.map(literal).join(', ')}] as const;
export type CommandName = typeof commandNames[number];

export const commandSummaries: Record<CommandName, string> = {
${summaries.join('\n')}
};

/** Discord's option type ids, as reported to the telemetry endpoint */
export const commandOptionTypes: Record<CommandName, Record<string, number>> = {
${optionTypes.join('\n')}
};

export const commandRequestSchemas = {
${schemas.join('\n')}
} as const;

/** English texts of the error keys returned by the command resolvers, with {{placeholders}} */
export const errorMessages: Record<CommandErrorKey, string> = {
${messages.join('\n')}
};

export const telemetryMessages = {
${telemetry.join('\n')}
} as const;
`;
};
