import { describe, expect, it } from 'vitest';
import pkg from '../package.json' with { type: 'json' };
import server from '../server.json' with { type: 'json' };

/**
 * server.json is what the MCP Registry lists. The registry validates it when it is published, which is too late to find out
 * about these: the workflow that publishes it runs these first.
 */
describe('server.json for the MCP Registry', () => {
  it('has a name in the namespace GitHub login proves, which is what the workflow authenticates with', () => {
    // The pattern is the one of the registry's schema: one slash, between the namespace and the name
    expect(server.name).toMatch(/^[a-zA-Z0-9.-]+\/[a-zA-Z0-9._-]+$/);
    expect(server.name.startsWith('io.github.WentTheFox/')).toBe(true);
  });

  it('is within the limits of the schema', () => {
    expect(server.description.length).toBeGreaterThan(0);
    expect(server.description.length).toBeLessThanOrEqual(100);
    expect(server.title.length).toBeLessThanOrEqual(100);
    // A version, not a range
    expect(server.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('is the version of the package, so a release changes both or neither', () => {
    expect(server.version).toBe(pkg.version);
  });

  it('lists the MCP endpoint of the API server, which is reachable by anyone', () => {
    expect(server.remotes).toHaveLength(1);
    expect(server.remotes[0]).toMatchObject({ type: 'streamable-http', url: 'https://api.hammertime.cyou/mcp' });
  });

  it('asks for the API key as a secret bearer token, and defines every placeholder it uses', () => {
    const [header] = server.remotes[0].headers;

    expect(header).toMatchObject({ name: 'Authorization', isRequired: true, value: 'Bearer {api_key}' });
    expect(Object.keys(header.variables)).toEqual(['api_key']);
    expect(header.variables.api_key).toMatchObject({ isRequired: true, isSecret: true });
  });

  it('points at the repository and the package in it', () => {
    expect(server.repository).toEqual({ url: 'https://github.com/WentTheFox/HammerTimeBot', source: 'github', subfolder: 'packages/api' });
  });
});
