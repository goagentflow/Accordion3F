// Generate a colour-coded dependency heatmap SVG
// Strategy: depcruise -> DOT -> inject node fill colours by path -> viz.js(synch) -> SVG
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import vizSyncPkg from '@aduh95/viz.js/sync';

const { renderString } = vizSyncPkg;
const root = process.cwd();
const outDir = resolve(root, 'system-map-change-guide');
mkdirSync(outDir, { recursive: true });
const tmpDot = resolve(outDir, 'heatmap.dot');
const outSvg = resolve(outDir, '06_dependency_heatmap.svg');

execSync(`npx depcruise --no-config --ts-config ./tsconfig.json --include-only "src" --output-type dot src > ${tmpDot}`, { stdio: 'inherit', shell: '/bin/bash' });

let dot = readFileSync(tmpDot, 'utf8');

// Colouring rules
function classify(path) {
  if (path.startsWith('src/services/') || path === 'src/v2/Orchestrator.tsx' || path.startsWith('src/reducers/')) return 'RED';
  if (path.startsWith('src/utils/') || path.startsWith('src/hooks/')) return 'AMBER';
  if (path.startsWith('src/components/')) return 'GREEN';
  return 'GREY';
}
function colourFor(cls) {
  switch (cls) {
    case 'RED': return '#e74c3c';
    case 'AMBER': return '#f39c12';
    case 'GREEN': return '#2ecc71';
    default: return '#bdc3c7';
  }
}

// Inject fillcolor/style into node attribute lists when we can find a label with path
dot = dot.replace(/(\w+\s*\[)([^\]]*label="([^"]+)"[^\]]*)(\])/g, (m, open, attrs, labelPath, close) => {
  const cls = classify(labelPath);
  const fill = colourFor(cls);
  const hasStyle = /style=/.test(attrs);
  const hasFill = /fillcolor=/.test(attrs);
  let newAttrs = attrs;
  if (!hasStyle) newAttrs += ',style=filled';
  if (!hasFill) newAttrs += `,fillcolor="${fill}"`;
  return `${open}${newAttrs}${close}`;
});

const svg = renderString(dot, { engine: 'dot', format: 'svg' });
writeFileSync(outSvg, svg, 'utf8');
console.log(`✓ Wrote ${outSvg}`);

