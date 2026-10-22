import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { commandNames } from '../generated/commands.js';
import { FakeBackend } from '../testing/fake-backend.js';
import { renderOpenApiDocument, runOpenApiSync } from './sync.js';

const committedPath = fileURLToPath(new URL('../../../../docs/openapi/api-docs.json', import.meta.url));

describe('the committed OpenAPI document', () => {
  // Like Luna's OpenApiDocumentTest: fails when the code changed without regenerating the copy
  it('is up to date with the code', async () => {
    expect(await runOpenApiSync({ outPath: committedPath, check: true })).toBe('unchanged');
  });
});

describe('the OpenAPI document', () => {
  it('describes every command, settings, key info and health', async () => {
    const document = JSON.parse(await renderOpenApiDocument());
    expect(document.openapi).toMatch(/^3\./);
    expect(Object.keys(document.paths).sort()).toEqual(
      [...commandNames.map(name => `/${name}`), '/health', '/me', '/settings'].sort(),
    );
  });

  it('gives every operation a unique, readable id built from the method and path', async () => {
    const document = JSON.parse(await renderOpenApiDocument());
    const ids = Object.values<Record<string, { operationId: string }>>(document.paths).flatMap(path => Object.values(path).map(operation => operation.operationId));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(['PostAt', 'PostAt12', 'GetSettings', 'PatchSettings', 'GetMe', 'GetHealth']));
  });

  it('requires the bearer key everywhere except the health check', async () => {
    const document = JSON.parse(await renderOpenApiDocument());
    expect(document.components.securitySchemes.BearerAuth).toMatchObject({ type: 'http', scheme: 'bearer' });
    for (const [path, methods] of Object.entries<Record<string, { security: unknown[] }>>(document.paths)) {
      for (const operation of Object.values(methods)) {
        expect(operation.security, path).toEqual(path === '/health' ? [] : [{ BearerAuth: [] }]);
      }
    }
  });

  it('is served at the stable url, with Swagger UI at the root', async () => {
    const app = createApp({ backend: new FakeBackend() });
    const spec = await app.request('/generated/api-docs.json');
    expect(spec.status).toBe(200);
    expect((await spec.json()).info.title).toBe('HammerTime API');

    const ui = await app.request('/');
    expect(ui.status).toBe(200);
    expect(await ui.text()).toContain('/generated/api-docs.json');
  });
});

describe('runOpenApiSync', () => {
  it('writes, then reports unchanged, and flags a stale copy in check mode without touching it', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hammertime-openapi-'));
    const outPath = join(dir, 'nested', 'api-docs.json');
    try {
      expect(await runOpenApiSync({ outPath, check: true })).toBe('stale');
      expect(await runOpenApiSync({ outPath })).toBe('written');
      expect(await runOpenApiSync({ outPath })).toBe('unchanged');

      writeFileSync(outPath, '{}\n');
      expect(await runOpenApiSync({ outPath, check: true })).toBe('stale');
      expect(readFileSync(outPath, 'utf8')).toBe('{}\n');
      expect(await runOpenApiSync({ outPath })).toBe('written');
      expect(readFileSync(outPath, 'utf8')).toBe(await renderOpenApiDocument());
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
