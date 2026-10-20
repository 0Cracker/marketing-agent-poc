"""Explicit online installation only. Model execution never calls this installer."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import urllib.request
import zipfile

HERE = Path(__file__).resolve().parent
COMMIT = '11572ea6b31cba29dd3f8a443e24311652f059de'
ARTIFACTS = {
    'source.zip': ('https://codeload.github.com/oeg-upm/OOPS/zip/' + COMMIT,
                   'sha256', '9b944cfc3d651e205fb49f43a57b9e4d1b32d3dc6b8d8b28cd95fc92172b9d56'),
    'jdk.zip': ('https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.20.1%2B1/OpenJDK17U-jdk_x64_windows_hotspot_17.0.20.1_1.zip',
                'sha256', 'e53a79c3c3d86865bd7e787903884331068e71321714ffd44f145785affc7cb0'),
    'maven.zip': ('https://archive.apache.org/dist/maven/maven-3/3.9.11/binaries/apache-maven-3.9.11-bin.zip',
                  'sha512', '03e2d65d4483a3396980629f260e25cac0d8b6f7f2791e4dc20bc83f9514db8d0f05b0479e699a5f34679250c49c8e52e961262ded468a20de0be254d8207076'),
}


def sha(path, algorithm='sha256'):
    return hashlib.new(algorithm, path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--tools', type=Path, required=True)
    parser.add_argument('--skip-upstream-tests', action='store_true')
    parser.add_argument('--configure-existing-build', action='store_true')
    args = parser.parse_args()
    target = args.tools.resolve() / 'logic/oops'
    target.mkdir(parents=True, exist_ok=True)
    source = target / ('OOPS-' + COMMIT)
    for name, (url, algorithm, expected) in ARTIFACTS.items():
        archive = target / name
        if not archive.exists():
            urllib.request.urlretrieve(url, archive)
        if sha(archive, algorithm) != expected:
            raise ValueError('archive checksum mismatch: ' + name)
        folder = source if name == 'source.zip' else target / ('jdk-17.0.20.1+1' if name == 'jdk.zip' else 'apache-maven-3.9.11')
        if not folder.exists():
            with zipfile.ZipFile(archive) as zipped:
                # Validate all archive paths before extraction, including on Windows.
                for entry in zipped.infolist():
                    if not (target / entry.filename).resolve().is_relative_to(target):
                        raise ValueError('unsafe archive path')
                zipped.extractall(target)
    jdk = target / 'jdk-17.0.20.1+1'
    maven = target / 'apache-maven-3.9.11/bin/mvn.cmd'
    env = {**os.environ, 'JAVA_HOME': str(jdk), 'PATH': str(jdk / 'bin') + os.pathsep + os.environ.get('PATH', '')}
    common = [str(maven), '-B', '-ntp', '-Dmaven.repo.local=' + str(target / 'm2')]
    fixes = json.loads((HERE / 'oops-local-fixes.json').read_text(encoding='utf-8'))
    for fix in fixes:
        path = source / fix['path']
        text = path.read_text(encoding='utf-8')
        if fix['after'] and fix['after'] in text:
            continue
        if fix['before'] in text:
            if text.count(fix['before']) != 1:
                raise ValueError('ambiguous upstream local fix')
            path.write_text(text.replace(fix['before'], fix['after']), encoding='utf-8')
        elif fix['after']:
            raise ValueError('pinned source no longer matches local fix')
        elif fix['before'] in text:
            raise ValueError('failed removal patch')
    if not args.configure_existing_build:
        command = common + ['package'] + (['-Dmaven.test.skip=true'] if args.skip_upstream_tests else [])
        with (target / 'setup-build.log').open('w', encoding='utf-8') as log:
            subprocess.run(command, cwd=source, env=env, stdout=log, stderr=subprocess.STDOUT, check=True)
    cp_file = target / 'classpath.txt'
    subprocess.run(common + ['dependency:build-classpath', '-DincludeScope=runtime', '-Dmdep.outputFile=' + str(cp_file)],
                   cwd=source, env=env, check=True)
    dependency_paths = [Path(p) for p in cp_file.read_text(encoding='utf-8').strip().split(os.pathsep)]
    classes = source / 'target/classes'
    if not classes.is_dir():
        raise ValueError('upstream compiled classes missing')
    adapter = target / 'adapter'
    adapter.mkdir(exist_ok=True)
    # A wildcard dependency directory keeps Windows command length bounded.
    libs = target / 'lib'
    libs.mkdir(exist_ok=True)
    import shutil
    names = set()
    for dependency in dependency_paths:
        if dependency.name in names:
            raise ValueError('duplicate dependency file name: ' + dependency.name)
        names.add(dependency.name)
        dest = libs / dependency.name
        if not dest.exists() or sha(dest) != sha(dependency):
            shutil.copyfile(dependency, dest)
    classpath = os.pathsep.join([str(adapter), str(classes), str(libs / '*')])
    subprocess.run([str(jdk / 'bin/javac.exe'), '-encoding', 'UTF-8', '-cp', classpath,
                    '-d', str(adapter), str(HERE / 'OopsLocal.java')], check=True)
    locked = list(classes.rglob('*')) + list(adapter.glob('*.class')) + list(libs.glob('*.jar'))
    locked += list(jdk.rglob('*'))
    locked += [HERE / 'OopsLocal.java', HERE / 'oops-local-fixes.json', HERE / 'setup-oops-local.py']
    import xml.etree.ElementTree as ET
    test_report = source / 'target/surefire-reports/TEST-es.upm.fi.oeg.oops.RegressionTests.xml'
    test_summary = {'status': 'not_run'}
    if test_report.is_file():
        test_root = ET.parse(test_report).getroot()
        test_summary = {k: int(test_root.get(k, '0')) for k in ('tests', 'failures', 'errors', 'skipped')}
        test_summary['status'] = 'pass' if test_summary['tests'] and not (test_summary['failures'] or test_summary['errors'] or test_summary['skipped']) else 'fail'
        test_summary['report_sha256'] = sha(test_report)
    lock = {'source_repository': 'https://github.com/oeg-upm/OOPS', 'source_commit': COMMIT,
            'license': 'Apache-2.0; upstream LICENSES and dependency licenses retained',
            'local_fixes': fixes,
            'archives': {name: {'url': url, 'algorithm': algorithm, 'checksum': checksum}
                         for name, (url, algorithm, checksum) in ARTIFACTS.items()},
            'java': str(jdk / 'bin/java.exe'), 'classpath': classpath,
            'upstream_tests': 'see build.log' if args.configure_existing_build else 'skipped' if args.skip_upstream_tests else 'executed by mvn package',
            'offline_test_profile': test_summary,
            'files': {str(p): sha(p) for p in sorted(locked) if p.is_file()},
            'java_version': subprocess.check_output([str(jdk / 'bin/java.exe'), '-version'], stderr=subprocess.STDOUT, text=True)}
    (target / 'install-lock.json').write_text(json.dumps(lock, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'status': 'pass', 'lock': str(target / 'install-lock.json'), 'locked_files': len(lock['files'])}))


if __name__ == '__main__':
    main()
