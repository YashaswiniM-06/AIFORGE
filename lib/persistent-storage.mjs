import { stat } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';

export async function verifyPersistentMount(dataDirectory, mountDirectory) {
  if (typeof mountDirectory !== 'string' || !mountDirectory.trim()) return false;
  const dataPath = resolve(dataDirectory);
  const mountPath = resolve(mountDirectory);
  if (dataPath !== mountPath && !dataPath.startsWith(mountPath + sep)) return false;
  try {
    const [mount, parent, data] = await Promise.all([
      stat(mountPath),
      stat(dirname(mountPath)),
      stat(dataPath),
    ]);
    return mount.dev !== parent.dev && data.dev === mount.dev;
  } catch {
    return false;
  }
}
