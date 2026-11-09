import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PendingDraft } from '../src/types/domain';
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), visit: vi.fn(), photo: vi.fn(), upload: vi.fn() }));
vi.mock('../src/lib/supabase', () => ({ client: () => ({
  auth: { getUser: mocks.getUser },
  from: (table: string) => ({ upsert: table === 'visits' ? mocks.visit : mocks.photo }),
  storage: { from: () => ({ upload: mocks.upload }) }
}) }));
import { sendDraft } from '../src/features/visits/api';
const draft: PendingDraft = { id: 'visit', ownerId: 'alice', visitedAt: '2026-09-08T00:00:00Z', note: '', photo: { id: 'photo', blob: new Blob(['image'], { type: 'image/webp' }), width: 10, height: 10, path: 'alice/visit/photo.webp' } };
beforeEach(() => { vi.resetAllMocks(); mocks.getUser.mockResolvedValue({ data: { user: { id: 'alice' } }, error: null }); for (const mock of [mocks.visit, mocks.photo, mocks.upload]) mock.mockResolvedValue({ error: null }); });
describe('photo draft submission', () => {
  it('uses stable ids and paths and preserves existing rows when retrying', async () => {
    await sendDraft(draft); await sendDraft(draft);
    expect(mocks.visit).toHaveBeenCalledWith(expect.objectContaining({ id: 'visit', status: 'draft', note: null }), { onConflict: 'id', ignoreDuplicates: true });
    expect(mocks.upload).toHaveBeenLastCalledWith('alice/visit/photo.webp', draft.photo!.blob, { contentType: 'image/webp', upsert: true });
    expect(mocks.photo).toHaveBeenCalledTimes(2);
  });
  it('stops on upload failure and does not insert photo metadata prematurely', async () => {
    mocks.upload.mockResolvedValue({ error: new Error('network') });
    await expect(sendDraft(draft)).rejects.toThrow('network');
    expect(mocks.photo).not.toHaveBeenCalled();
  });
  it('rejects a queue entry from another account before writing', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'bob' } }, error: null });
    await expect(sendDraft(draft)).rejects.toThrow('アカウント');
    expect(mocks.visit).not.toHaveBeenCalled();
  });
  it('supports a timestamp-only draft', async () => {
    await sendDraft({ ...draft, photo: null });
    expect(mocks.visit).toHaveBeenCalledOnce(); expect(mocks.upload).not.toHaveBeenCalled();
  });
});
