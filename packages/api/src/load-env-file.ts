import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_NAME = '@went.tf/hammertime-api';

/**
 * The directory of this package, found from where this file is: its src/ when it runs from the sources, dist/src/ when built.
 * A build has a copy of package.json of its own in dist/ (the version is imported from it), which is not the package.
 */
export const findPackageDir = (fromDir: string = dirname(fileURLToPath(import.meta.url))): string | null => {
  let dir = fromDir;
  for (;;) {
    const manifest = join(dir, 'package.json');
    if (basename(dir) !== 'dist' && existsSync(manifest) && (JSON.parse(readFileSync(manifest, 'utf8')) as { name?: string }).name === PACKAGE_NAME) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
};

/**
 * Reads the .env of this package into the environment, from where the package is and not from the working directory. pm2 starts
 * the workers of a cluster from a directory of its own, so a relative `--env-file` is not found there (it was not, on the server,
 * and the API did not start). What is already in the environment is not overridden, so a variable that is set for real wins.
 *
 * Returns the file that was read, or null when there is none (the settings can come from the environment alone).
 */
export const loadEnvFile = (
  dir: string | null = findPackageDir(),
  load: (path: string) => void = path => process.loadEnvFile(path),
): string | null => {
  if (!dir) return null;
  const file = join(dir, '.env');
  if (!existsSync(file)) return null;
  load(file);

  return file;
};
