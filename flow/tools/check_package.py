"""Legacy Power Automate flow package checker.

Research tool written on 2026-09-24 while checking how flow import packages are built.
Its rules come from 21 community sample packages (pnp/powerautomate-samples) and a
2026 Power Automate export. It checks the package structure and cross-references only;
it does not prove a package will import. To be reviewed and extended at Stage 8.

Usage: python3 check_package.py <package.zip>
"""
import json,sys,zipfile,re
z=zipfile.ZipFile(sys.argv[1]); names=z.namelist(); err=[]
def J(p): return json.loads(z.read(p).decode('utf-8-sig'))
if 'manifest.json' not in names: err.append('no root manifest.json')
if any('\\' in n for n in names): err.append('backslash in zip path')
m=J('manifest.json'); fm=J('Microsoft.Flow/flows/manifest.json')
for k in ('schema','details','resources'): 
    if k not in m: err.append('root manifest missing '+k)
res=m['resources']
for rid,r in res.items():
    if 'suggestedCreationType' not in r: err.append(f'{rid} missing suggestedCreationType')
    for d in r.get('dependsOn',[]):
        if d not in res: err.append(f'{rid} dependsOn unknown {d}')
for fid in fm['flowAssets']['assetPaths']:
    if res.get(fid,{}).get('type')!='Microsoft.Flow/flows': err.append(f'asset {fid} not a flow resource')
    base=f'Microsoft.Flow/flows/{fid}/'
    d=J(base+'definition.json'); am=J(base+'apisMap.json'); cm=J(base+'connectionsMap.json')
    refs=d['properties']['connectionReferences']
    if set(refs)!=set(am) or set(refs)!=set(cm): err.append('connectionReferences keys != apisMap/connectionsMap keys')
    for k in refs:
        if not refs[k].get('connectionName'): err.append(f'empty connectionName {k}')
        a=res.get(am.get(k),{}); c=res.get(cm.get(k),{})
        if a.get('type')!='Microsoft.PowerApps/apis' or a.get('id')!=refs[k]['id']: err.append(f'apisMap {k} mismatch')
        if c.get('type')!='Microsoft.PowerApps/apis/connections' or am[k] not in c.get('dependsOn',[]): err.append(f'connectionsMap {k} mismatch')
        if am[k] not in res[fid]['dependsOn'] or cm[k] not in res[fid]['dependsOn']: err.append(f'flow dependsOn lacks {k}')
    used=set(re.findall(r'"connectionName": ?"([^"]+)"',json.dumps(d['properties']['definition'])))
    if used-set(refs): err.append(f'host.connectionName not in connectionReferences: {used-set(refs)}')
    if d.get('name')!=fid: err.append('definition name != asset GUID (portal exports differ; DriverAI 2026 says must match)')
print('OK' if not err else '\n'.join(err))
