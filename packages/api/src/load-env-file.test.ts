import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { findPackageDir, loadEnvFile } from './load-env-file.js';

const made: string[] = [];
const packageDir = (files: { manifestName?: string; env?: string } = {}) => {
  const dir = mkdtempSync(join(tmpdir(), 'hammertime-api-env-'));
  made.push(dir);
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: files.manifestName ?? '@went.tf/hammertime-api' }));
  if (files.env !== undefined) writeFileSync(join(dir, '.env'), files.env);

  return dir;
};

afterEach(() => {
  made.splice(0).forEach(dir => rmSync(dir, { recursive: true, force: true }));
  delete process.env.LOAD_ENV_FILE_TEST_A;
  delete process.env.LOAD_ENV_FILE_TEST_B;
});

describe('findPackageDir', () => {
  it('finds the package from the directory the code runs from, however deep in it', () => {
    const dir = packageDir();
    mkdirSync(join(dir, 'dist', 'src'), { recursive: true });

    expect(findPackageDir(join(dir, 'dist', 'src'))).toBe(dir);
    expect(findPackageDir(join(dir, 'dist'))).toBe(dir);
    expect(findPackageDir(dir)).toBe(dir);
  });

  it('is the package and not the copy of its package.json that a build has in dist/, which is where the server runs from', () => {
    const dir = packageDir({ env: 'LOAD_ENV_FILE_TEST_A=from-the-package\n' });
    mkdirSync(join(dir, 'dist', 'src'), { recursive: true });
    writeFileSync(join(dir, 'dist', 'package.json'), JSON.stringify({ name: '@went.tf/hammertime-api' }));

    expect(findPackageDir(join(dir, 'dist', 'src'))).toBe(dir);
    expect(loadEnvFile(findPackageDir(join(dir, 'dist', 'src')))).toBe(join(dir, '.env'));
    expect(process.env.LOAD_ENV_FILE_TEST_A).toBe('from-the-package');
  });

  it('is this package when asked from where this file is', () => {
    expect(findPackageDir()).toMatch(/packages\/api$/);
  });

  it('skips a package.json that belongs to something else', () => {
    const outer = packageDir();
    const inner = join(outer, 'node_modules', 'other');
    mkdirSync(inner, { recursive: true });
    writeFileSync(join(inner, 'package.json'), JSON.stringify({ name: 'other' }));

    expect(findPackageDir(inner)).toBe(outer);
  });

  it('is null when there is no such package above', () => {
    const dir = mkdtempSync(join(tmpdir(), 'hammertime-api-nothing-'));
    made.push(dir);

    // The temp directory is not inside the repository, so nothing above it is the API package either
    expect(findPackageDir(dir)).toBeNull();
  });
});

describe('loadEnvFile', () => {
  it('reads the .env of the package into the environment, whatever the working directory is', () => {
    const dir = packageDir({ env: 'LOAD_ENV_FILE_TEST_A=from-file\n' });
    const before = process.cwd();
    process.chdir(tmpdir());
    try {
      expect(loadEnvFile(dir)).toBe(join(dir, '.env'));
    } finally {
      process.chdir(before);
    }

    expect(process.env.LOAD_ENV_FILE_TEST_A).toBe('from-file');
  });

  it('does not override what is already set in the environment', () => {
    process.env.LOAD_ENV_FILE_TEST_B = 'from-the-environment';
    const dir = packageDir({ env: 'LOAD_ENV_FILE_TEST_B=from-file\n' });

    loadEnvFile(dir);

    expect(process.env.LOAD_ENV_FILE_TEST_B).toBe('from-the-environment');
  });

  it('does nothing, without an error, when there is no .env or no package', () => {
    const load = vi.fn();

    expect(loadEnvFile(packageDir(), load)).toBeNull();
    expect(loadEnvFile(null, load)).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });
});
