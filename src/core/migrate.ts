export type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

/**
 * Walks a raw stored object forward through versioned migration steps until it reaches
 * currentVersion, then stamps that version onto the result. An unknown/missing schemaVersion
 * is treated as 0 -- this covers data written before version tracking existed at all.
 *
 * If no step is registered for the version the data claims to be at, migration stops there:
 * normalization (which always runs right after this, in storage.ts/session.ts) fills in
 * defaults for anything that didn't carry forward, so a gap in the migration table can never
 * crash anything -- it just falls back to defaults for the fields it couldn't migrate.
 */
export function migrate(raw: unknown, currentVersion: number, migrations: Record<number, Migration>): Record<string, unknown> {
  let data = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  let version = typeof data.schemaVersion === 'number' ? data.schemaVersion : 0;
  while (version < currentVersion) {
    const step = migrations[version];
    if (!step) break;
    data = step(data);
    version++;
  }
  return { ...data, schemaVersion: version };
}
