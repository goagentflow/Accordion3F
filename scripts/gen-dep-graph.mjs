// Generate dependency graph SVG using dependency-cruiser + viz.js
// Writes to system-map/10_dependency_graph.svg
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import vizSyncPkg from '@aduh95/viz.js/sync';

const root = process.cwd();
const outDir = resolve(root, 'system-map');
mkdirSync(outDir, { recursive: true });
const dotPath = resolve(outDir, 'dep.dot');
const svgPath = resolve(outDir, '10_dependency_graph.svg');

// Create DOT with depcruise
execSync(`npx depcruise --no-config --ts-config ./tsconfig.json --include-only "src" --output-type dot src > ${dotPath}`, { stdio: 'inherit', shell: '/bin/bash' });

// Render DOT to SVG with viz.js
const dot = readFileSync(dotPath, 'utf8');
const { renderString } = vizSyncPkg;
const svg = renderString(dot, { engine: 'dot', format: 'svg' });
writeFileSync(svgPath, svg, 'utf8');
rmSync(dotPath, { force: true });
console.log(`✓ Wrote ${svgPath}`);
