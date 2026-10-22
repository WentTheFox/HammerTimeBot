export const atLeastOneNonZeroKey = <T extends Record<string, number | undefined | null>>(obj: T): boolean =>
  Object.keys(obj).some(key => {
    const value = obj[key];
    return typeof value === 'number' && value > 0;
  });
