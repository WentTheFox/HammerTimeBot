import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createApp } from '../app.js';
import type { Backend } from '../backend.js';

/** The document does not depend on any backend call, so any use of one is a bug */
const unusedBackend: Backend = {
  validateKey: () => Promise.reject(new Error('The OpenAPI document must not need a backend')),
  getSettings: () => Promise.reject(new Error('The OpenAPI document must not need a backend')),
  updateSettings: () => Promise.reject(new Error('The OpenAPI document must not need a backend')),
  recordTelemetry: () => Promise.reject(new Error('The OpenAPI document must not need a backend')),
};

/** The OpenAPI document exactly as the running server serves it, in a stable text form */
export const renderOpenApiDocument = async (): Promise<string> => {
  const response = await createApp({ backend: unusedBackend }).request('/generated/api-docs.json');
  return `${JSON.stringify(await response.json(), null, 2)}\n`;
};

export type OpenApiSyncStatus = 'written' | 'unchanged' | 'stale';

/** Keeps the committed copy of the document in step with the code, like Luna's openapi:sync */
export const runOpenApiSync = async ({ outPath, check = false }: { outPath: string; check?: boolean }): Promise<OpenApiSyncStatus> => {
  const document = await renderOpenApiDocument();
  let current: string | null = null;
  try {
    current = readFileSync(outPath, 'utf8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw e;
    }
  }
  if (current === document) {
    return 'unchanged';
  }
  if (check) {
    return 'stale';
  }
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, document);
  return 'written';
};
