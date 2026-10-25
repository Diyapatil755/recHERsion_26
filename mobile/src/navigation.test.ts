import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const tabs = resolve(process.cwd(), 'app/(tabs)');
const layout = readFileSync(resolve(tabs, '_layout.tsx'), 'utf8');
test('all five tab destinations have matching Expo Router route files', () => {
  const routes = ['index', 'safety', 'digital', 'evidence', 'profile'];
  for (const route of routes) {
    assert.ok(existsSync(resolve(tabs, `${route}.tsx`)), `missing tab route ${route}`);
    assert.match(layout, new RegExp(`Tabs\\.Screen name=[\"']${route}[\"']`), `tab ${route} not registered`);
  }
});
test('secondary routes remain outside the five tabs and P2 checkups are reachable from Profile', () => {
  assert.ok(existsSync(resolve(process.cwd(), 'app/journey.tsx')));
  assert.ok(existsSync(resolve(process.cwd(), 'app/simulator.tsx')));
  assert.ok(existsSync(resolve(process.cwd(), 'app/p2.tsx')));
  assert.match(readFileSync(resolve(tabs, 'profile.tsx'), 'utf8'), /router\.push\('\/p2'\)/);
});
