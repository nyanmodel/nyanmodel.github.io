import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { enqueue, pendingFor, flushQueue } from '../src/lib/offlineQueue';
import type { PendingDraft } from '../src/types/domain';
const draft = (id: string, ownerId = 'alice'): PendingDraft => ({ id, ownerId, visitedAt: '2026-09-08T03:00:00Z', note: '', photo: { id: 'photo', blob: new Blob(['photo'], { type: 'image/webp' }), width: 100, height: 100, path: `${ownerId}/${id}/photo.webp` } });
describe('durable outbox', () => {
  it('retains failed uploads and retries with the original ids, path and image', async () => {
    await enqueue(draft('retry'));
    await expect(flushQueue('alice', async () => { throw new Error('offline'); })).rejects.toThrow('offline');
    const [pending] = await pendingFor('alice');
    expect(pending.id).toBe('retry'); expect(await pending.photo!.blob.text()).toBe('photo');
    const send = vi.fn(async () => {});
    await flushQueue('alice', send); expect(send.mock.calls[0][0].photo.path).toBe('alice/retry/photo.webp');
    expect(await pendingFor('alice')).toEqual([]);
  });
  it('isolates users and does not create duplicates for the same id', async () => {
    await enqueue(draft('shared')); await enqueue(draft('shared')); await enqueue(draft('bob-entry', 'bob'));
    expect(await pendingFor('alice')).toHaveLength(1);
    const send = vi.fn(async () => {}); await flushQueue('alice', send);
    expect(send).toHaveBeenCalledTimes(1); expect(await pendingFor('bob')).toHaveLength(1);
    await flushQueue('bob', async () => {});
  });
  it('serializes concurrent retries', async () => {
    await enqueue(draft('parallel'));
    const send = vi.fn(async () => { await Promise.resolve(); });
    await Promise.all([flushQueue('alice', send), flushQueue('alice', send)]);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
