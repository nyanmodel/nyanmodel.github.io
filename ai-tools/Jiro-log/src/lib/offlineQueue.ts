import { openDB } from 'idb';
import type { PendingDraft } from '../types/domain';
const database = () => openDB('jiro-log-outbox', 1, { upgrade(db) { db.createObjectStore('drafts', { keyPath: 'id' }); } });
export async function enqueue(draft: PendingDraft) { await (await database()).put('drafts', draft); }
export async function pendingFor(ownerId: string): Promise<PendingDraft[]> {
  return (await (await database()).getAll('drafts')).filter((draft: PendingDraft) => draft.ownerId === ownerId);
}
export async function dequeue(id: string) { await (await database()).delete('drafts', id); }
// Serialize foreground submissions and reconnect retries within this tab.
const running = new Map<string, Promise<void>>();
export function flushQueue(ownerId: string, send: (draft: PendingDraft) => Promise<void>) {
  const current = running.get(ownerId);
  if (current) return current;
  const task = (async () => {
    while (true) {
      const drafts = await pendingFor(ownerId);
      if (!drafts.length) return;
      for (const draft of drafts) { await send(draft); await dequeue(draft.id); }
    }
  })().finally(() => { running.delete(ownerId); });
  running.set(ownerId, task);
  return task;
}
