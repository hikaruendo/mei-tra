import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const POOLER_PERMISSION = 'Database → Connection Pooling: Read';

export async function checkProductionPoolerAccess({
  accessToken,
  projectRef,
  fetchImpl = fetch,
}) {
  if (!accessToken || !projectRef) {
    throw new Error('SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF are required');
  }

  const url = `https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}/config/database/pooler`;
  const response = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15_000),
  });

  if (response.status === 403) {
    throw new Error(
      `Supabase token cannot read the IPv4 pooler config. Create a new project-scoped token with ${POOLER_PERMISSION}, then replace the production environment secret SUPABASE_ACCESS_TOKEN.`,
    );
  }
  if (!response.ok) {
    throw new Error(`Could not verify the Supabase IPv4 pooler config (HTTP ${response.status}).`);
  }

  const configs = await response.json();
  if (!Array.isArray(configs) || !configs.some(
    (config) => config.database_type === 'PRIMARY' && config.connection_string,
  )) {
    throw new Error('Supabase did not return a primary IPv4 pooler connection string.');
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await checkProductionPoolerAccess({
    accessToken: process.env.SUPABASE_ACCESS_TOKEN,
    projectRef: process.env.SUPABASE_PROJECT_REF,
  });
  console.log('Supabase IPv4 pooler config is accessible.');
}
