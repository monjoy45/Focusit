import { describe, it, expect } from 'vitest';
import { migrate } from '../src/core/migrate';

describe('migrate', () => {
  it('treats missing schemaVersion as version 0 and walks it forward through registered steps', () => {
    const result = migrate({ name: 'alice' }, 2, {
      0: (d) => ({ ...d, name: String(d.name).toUpperCase() }), // pretend v1 renamed/transformed a field
      1: (d) => ({ ...d, greeting: `hi ${d.name}` }),
    });
    expect(result).toEqual({ name: 'ALICE', greeting: 'hi ALICE', schemaVersion: 2 });
  });

  it('is a no-op when already at the current version', () => {
    const result = migrate({ schemaVersion: 2, x: 1 }, 2, { 0: () => ({ broken: true }), 1: () => ({ broken: true }) });
    expect(result).toEqual({ schemaVersion: 2, x: 1 });
  });

  it('stops cleanly and stamps the partial version when a step is missing, rather than throwing', () => {
    const result = migrate({ x: 1 }, 5, { 0: (d) => ({ ...d, step: 1 }) }); // no step registered for version 1
    expect(result).toEqual({ x: 1, step: 1, schemaVersion: 1 });
  });

  it('treats null/non-object input as an empty object at version 0', () => {
    expect(migrate(null, 1, { 0: (d) => ({ ...d, filled: true }) })).toEqual({ filled: true, schemaVersion: 1 });
    expect(migrate('garbage', 1, { 0: (d) => ({ ...d, filled: true }) })).toEqual({ filled: true, schemaVersion: 1 });
  });

  it('runs steps in order, each receiving the previous step\'s output', () => {
    const order: number[] = [];
    migrate({}, 3, {
      0: (d) => { order.push(0); return d; },
      1: (d) => { order.push(1); return d; },
      2: (d) => { order.push(2); return d; },
    });
    expect(order).toEqual([0, 1, 2]);
  });
});
