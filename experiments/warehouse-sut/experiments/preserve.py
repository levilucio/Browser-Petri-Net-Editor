"""Freeze an observed failure BEFORE editing the implicated implementation."""
import argparse,datetime,hashlib,json,pathlib,platform,shutil,subprocess,sqlite3
root=pathlib.Path(__file__).resolve().parents[1];repo=root.parents[1]
p=argparse.ArgumentParser();p.add_argument('name');p.add_argument('--report',required=True);p.add_argument('--description',required=True);p.add_argument('--reproduce',required=True);p.add_argument('--artifact',action='append',default=[]);a=p.parse_args()
if not a.name.replace('-','').isalnum():raise SystemExit('Use letters/numbers/hyphens for evidence name')
out=root/'evidence'/a.name
if out.exists():raise SystemExit('Evidence already exists; refusing overwrite')
out.mkdir(parents=True)
paths=[]
for directory in [root/'backend',root/'frontend',root/'experiments',root/'specification',root/'tests',repo/'petri-net-app/src/satel/examples/warehouse']:
    paths.extend(f for f in directory.rglob('*') if f.is_file() and '__pycache__' not in f.parts)
paths.extend(f for f in [root/'CONTRACT.md',root/'results/suites.json',root/'results/generation.json'] if f.exists())
for name in a.artifact:
    f=pathlib.Path(name).resolve();f.relative_to(repo);paths.append(f)
hashes={}
for f in paths:
    rel=f.relative_to(repo);dest=out/'snapshot'/rel;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(f,dest);hashes[str(rel)]=hashlib.sha256(f.read_bytes()).hexdigest()
report=pathlib.Path(a.report).resolve();shutil.copyfile(report,out/'failure-report.json')
manifest=dict(timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),description=a.description,reproduce=a.reproduce,classification='unclassified observed baseline failure',parent_commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip(),python=platform.python_version(),sqlite=sqlite3.sqlite_version,seed=1,files=hashes,report_sha256=hashlib.sha256(report.read_bytes()).hexdigest())
(out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
(out/'README.md').write_text('# Preserved baseline failure: '+a.name+'\n\n'+a.description+'\n\nCaptured before corrective edits. Initial classification is unresolved.\n\nReproduce from the captured source:\n\n```sh\n'+a.reproduce+'\n```\n\n`manifest.json` identifies source hashes and the parent commit; the snapshot\ncontains the uncommitted source that actually failed, not just that parent.\n')
print(out)
