import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {test} from 'node:test';

const root=fileURLToPath(new URL('../../',import.meta.url));
const exists=p=>existsSync(path.join(root,p));
const text=p=>readFileSync(path.join(root,p),'utf8');

test('구 대시보드, 예제, 사용 종료된 프레임워크 산출물은 현재 소스에 없다',()=>{
 for(const p of [
  'legacy','examples','build','.openai','next.config.ts','.npmrc','cloudflare-env.d.ts',
  'pnpm-lock.yaml','pnpm-workspace.yaml','vite.legacy.config.ts',
  'frontend/public/workbench-data','frontend/components','frontend/hooks','frontend/lib',
  'scripts/connector-preview','scripts/install-pnpm.sh'
 ])assert.equal(exists(p),false,'obsolete path: '+p);
});

test('현재 ROAS 전용 UI 컴포넌트와 공개 폰트, 파비콘은 유지한다',()=>{
 for(const p of [
  'frontend/roas/components/ui/button.tsx',
  'frontend/roas/components/ui/tooltip.tsx',
  'frontend/roas/components/ui/selection-button.tsx',
  'frontend/roas/components/ui/selection-button.css',
  'frontend/roas/lib/utils.ts',
  'frontend/public/fonts/PretendardVariable.woff2',
  'frontend/public/fonts/SUIT-Variable.woff2',
  'frontend/public/favicon.svg'
 ])assert.equal(exists(p),true,'required ROAS asset: '+p);
 assert.match(text('vite.config.ts'),/publicDir:\s*["']public["']/);
 for(const p of [
  'frontend/roas/review-analysis-section.tsx','frontend/roas/roas-answer.tsx',
  'frontend/roas/training-scope-picker.tsx','frontend/roas/training-analysis-panel.tsx',
  'frontend/roas/training-dashboard.tsx'
 ])assert.doesNotMatch(text(p),/\.\.\/components\/ui\//,'old import: '+p);
});

test('현행 npm 명령과 의존성은 폐기한 런타임을 실행하지 않는다',()=>{
 const pkg=JSON.parse(text('package.json'));
 for(const name of ['test:legacy','dev:legacy','start:legacy-agents','db:generate:legacy','install:ci'])
  assert.equal(Object.hasOwn(pkg.scripts,name),false,'obsolete script: '+name);
 for(const name of ['next','vinext','wrangler','drizzle-orm','@cloudflare/vite-plugin','@cloudflare/workers-types','eslint-config-next'])
  assert.equal(name in pkg.dependencies || name in pkg.devDependencies,false,'obsolete dependency: '+name);
});
