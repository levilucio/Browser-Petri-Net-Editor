import {resolve, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const editorRoot = process.env.SATEL_EDITOR_ROOT || resolve(root, '../../petri-net-app');
export const editorImport = path => import(pathToFileURL(resolve(editorRoot, path)).href);
export const playwright = () => import(pathToFileURL(resolve(editorRoot, 'node_modules/playwright/index.mjs')).href);
