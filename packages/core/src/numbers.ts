export enum PadDirection {
  LEFT,
  RIGHT,
}

export const pad = (n: number | string, length: number, direction: PadDirection = PadDirection.LEFT): string => {
  const sign = (typeof n === 'number' ? n < 0 : n.startsWith('-')) ? '-' : '';
  const nString = `${n}`.replace(/^-/, '');
  if (nString.length >= length) return sign + nString;

  const padStr = new Array(length - (nString.length - 1)).join('0');
  return sign + (direction === PadDirection.LEFT ? padStr + nString : nString + padStr);
};
