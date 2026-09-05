import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export interface Credentials {
  agentId?: string;
  credential?: string;
  deviceId?: string;
}

function isCredentials(value: unknown): value is Credentials {
  if (!value || typeof value !== 'object') return false;
  return Object.values(value).every(
    (item) => item === undefined || typeof item === 'string',
  );
}

export async function loadCredentials(path: string): Promise<Credentials> {
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8')) as unknown;
    return isCredentials(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export async function saveCredentials(
  path: string,
  value: Credentials,
): Promise<void> {
  const temporaryPath = `${path}.tmp`;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(temporaryPath, JSON.stringify(value), { mode: 0o600 });
  await chmod(temporaryPath, 0o600);
  await rename(temporaryPath, path);
}
