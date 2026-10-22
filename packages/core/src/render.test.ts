import { TZDate } from '@date-fns/tz';
import { describe, expect, it } from 'vitest';
import { isCommandError } from './resolvers.js';
import { mergeRenderOptions, renderTimestamp, RenderedTimestamp } from './render.js';
import { ResponseColumnChoices } from './settings.js';
import { supportedFormats } from './time.js';

const date = TZDate.tz('UTC', 0);
const render = (...args: Parameters<typeof renderTimestamp>): RenderedTimestamp => {
  const result = renderTimestamp(...args);
  if (isCommandError(result)) {
    throw new Error(`Unexpected error ${result.error}`);
  }
  return result;
};
const defaults = mergeRenderOptions(undefined, undefined);

describe('mergeRenderOptions', () => {
  it('should default to both columns, all formats and a header', () => {
    expect(defaults).toEqual({ columns: ResponseColumnChoices.BOTH, format: null, header: true });
  });

  it('should prefer the command option over the setting', () => {
    expect(mergeRenderOptions({ format: 'd' }, { format: 'F' as never, columns: null, header: false }))
      .toEqual({ columns: ResponseColumnChoices.BOTH, format: 'd', header: false });
  });

  it('should keep an explicit false header option over a true setting', () => {
    expect(mergeRenderOptions({ header: false }, { format: null, columns: null, header: true }).header).toBe(false);
  });
});

describe('renderTimestamp', () => {
  it('should list every format with a header by default', () => {
    const result = render(date, 'UTC', defaults, undefined);
    expect(result.formats).toEqual(supportedFormats);
    expect(result.singleFormat).toBeNull();
    expect(result.header).toContain('1970-01-01');
    expect(result.content).toBe(`${result.header}\n${result.table}`);
    expect(result.unix).toBe(0);
  });

  it('should omit the header when turned off', () => {
    const result = render(date, 'UTC', { ...defaults, header: false }, undefined);
    expect(result.header).toBeNull();
    expect(result.content).toBe(result.table);
  });

  it('should render a single format', () => {
    const result = render(date, 'UTC', { ...defaults, format: 'R', columns: ResponseColumnChoices.SYNTAX_ONLY }, undefined);
    expect(result.singleFormat).toBe('R');
    expect(result.table).toBe('`<t:0:R>`');
    expect(result.minimalReply).toBe(false);
  });

  it('should reduce a single format to the preview with the minimal reply setting', () => {
    const result = render(date, 'UTC', { ...defaults, format: 'R' }, { boldPreview: null, formatMinimalReply: true });
    expect(result).toMatchObject({ minimalReply: true, columns: ResponseColumnChoices.PREVIEW_ONLY, header: null, content: '<t:0:R>' });
  });

  it('should ignore the minimal reply setting when listing all formats', () => {
    expect(render(date, 'UTC', defaults, { boldPreview: null, formatMinimalReply: true }).minimalReply).toBe(false);
  });

  it('should bold the previews when listing all formats', () => {
    const result = render(date, 'UTC', { ...defaults, columns: ResponseColumnChoices.PREVIEW_ONLY }, { boldPreview: true, formatMinimalReply: null });
    expect(result.table.split('\n').every(line => line.startsWith('**<t:0:'))).toBe(true);
  });

  it('should reject an invalid date', () => {
    expect(renderTimestamp(new TZDate('invalid', 'UTC'), 'UTC', defaults, undefined))
      .toEqual({ error: 'commands.global.responses.invalidDate' });
  });
});
