/** Fills the {{placeholders}} of a locale string, leaving unknown ones untouched */
export const interpolate = (template: string, params: Record<string, string> = {}): string =>
  template.replace(/{{\s*(\w+)\s*}}/g, (match, key: string) => params[key] ?? match);
