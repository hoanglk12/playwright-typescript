import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function isEntryPoint(moduleUrl: string, argv1: string | undefined): boolean {
  if (argv1 === undefined) return false;
  try {
    return realpathSync.native(fileURLToPath(moduleUrl)) === realpathSync.native(argv1);
  } catch {
    return false;
  }
}
