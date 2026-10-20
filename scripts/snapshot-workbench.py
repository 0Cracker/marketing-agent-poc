from pathlib import Path
import hashlib, json, shutil, zipfile, subprocess
from datetime import datetime, timezone
repo=Path.cwd().resolve()
workspace=repo.parent.resolve()
snapshot=(workspace/'dashboard-design-history'/'2026-10-15-workbench-implementation').resolve()
assert snapshot.parent.parent == workspace
if snapshot.exists():
    raise RuntimeError('Existing snapshot is preserved; choose a new snapshot name')
snapshot.mkdir(parents=True)
items=['AGENTS.md','package.json','pnpm-lock.yaml','vite.config.ts','tsconfig.json','frontend','postcss.config.mjs','eslint.config.mjs','components.json','pnpm-workspace.yaml','scripts','docs/design','docs/research/marketing-ontology/batches/D003B/source','docs/research/marketing-ontology/batches/D003B/manifest.json','docs/research/marketing-ontology/schemas/marketing-records.schema.json','docs/research/marketing-ontology/work-log.md','docs/research/marketing-ontology/data-proposal.md','tests','dist']
for relative in items:
    src=repo/relative
    dst=snapshot/'workspace'/relative
    if src.is_dir(): shutil.copytree(src,dst)
    else:
        dst.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(src,dst)
readme='''# 마케팅 워크벤치 구현 스냅샷

2026-10-15. detached HEAD e52cef6과 미커밋 작업의 파일 보존본. Git 커밋·발행·배포가 아니다.

- `workspace/docs/design/marketing-workbench-spec.md`: 첨부 원문 바이트 그대로.
- `workspace/docs/design/marketing-workbench-type-map.json`: 40유형과 H01 매핑.
- `workspace/docs/design/marketing-workbench-acceptance.md`: 수치·브라우저 검증과 제한.
- `workspace/docs/design/workbench-validation/`: 실제 캡처·JSON 검증·CSV.
- `workspace/frontend/`: 독립 소스와 로컬 Pretendard·라이선스.
- `workspace/dist/`: 검증한 정적 빌드. 로컬 정적 서버의 SPA fallback으로 `/workbench`를 연다.
- `workspace/docs/design/dashboard-drafts/`: 이전 초안 사본. 기존 `../2026-10-15-drafts` 보존본과 디자인 조사 폴더를 덮어쓰지 않았다.
- `workspace/docs/research/marketing-ontology/batches/D003B/source/`: 승인된 11개 원천 사본. 신규 데이터가 아니다.
- `manifest.json`: 각 파일의 바이트 수와 SHA-256. ZIP의 모든 엔트리와 대조한다.

개발 재현은 workspace에서 기존 잠금 파일로 의존성을 설치하고 `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5174`를 실행한다. 수치 검산은 `node scripts/check-workbench.mjs`다. 설치 의존성과 Git 메타데이터는 보존본에 포함하지 않았다.
'''
(snapshot/'README.md').write_text(readme,encoding='utf-8')
files=[]
for path in sorted(snapshot.rglob('*')):
    if path.is_file():
        data=path.read_bytes()
        files.append({'path':path.relative_to(snapshot).as_posix(),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
manifest={'created_at':datetime.now(timezone.utc).isoformat(),'head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip(),'state':'detached HEAD + uncommitted work','files':files}
(snapshot/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
archive=snapshot.with_suffix('.zip')
if archive.exists(): raise RuntimeError('Existing ZIP is preserved')
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for path in sorted(snapshot.rglob('*')):
        if path.is_file(): z.write(path,path.relative_to(snapshot))
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    for entry in files:
        assert hashlib.sha256(z.read(entry['path'])).hexdigest()==entry['sha256']
    assert len(z.namelist()) == len(files)+1
sha=hashlib.sha256(archive.read_bytes()).hexdigest()
checksum={'archive':archive.name,'bytes':archive.stat().st_size,'sha256':sha,'verified_files':len(files),'entries':len(files)+1,'all_entry_hashes_match':True}
(snapshot.parent/(snapshot.name+'-checksum.json')).write_text(json.dumps(checksum,indent=2)+'\n',encoding='utf-8')
print(json.dumps(checksum))
