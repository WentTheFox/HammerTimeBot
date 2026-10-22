import pkg from '../package.json' with { type: 'json' };

/** major.minor of the package version, like Luna's API_VERSION */
export const API_VERSION = pkg.version.split('.').slice(0, 2).join('.');
