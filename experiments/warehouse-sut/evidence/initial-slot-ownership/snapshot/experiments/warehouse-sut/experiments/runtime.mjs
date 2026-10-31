import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
export const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const editorRoot=[process.env.SATEL_EDITOR_ROOT,resolve(root,'../../petri-net-app'),resolve(root,'../Browser-Petri-Net-Editor/petri-net-app'),resolve(root,'../satel-review/petri-net-app')].filter(Boolean).find(p=>existsSync(resolve(p,'src/satel/core/IntentionPipeline.js')));
export const editorImport=path=>{if(!editorRoot)throw Error('Set SATEL_EDITOR_ROOT to the petri-net-app directory');return import(pathToFileURL(resolve(editorRoot,path)).href)};
export const playwright=async()=>{try{return await import('playwright')}catch{return import(pathToFileURL(resolve(editorRoot,'node_modules/playwright/index.mjs')).href)}};
