import { client } from '../../lib/supabase';
import type { PendingDraft, Visit } from '../../types/domain';
import type { PhotoRow, VisitRow } from '../../types/database';
export async function sendDraft(draft: PendingDraft) {
  const db = client();
  const { data: auth, error: authError } = await db.auth.getUser();
  if (authError || auth.user?.id !== draft.ownerId) throw new Error('記録したアカウントでログインし直してください。');
  // Ignore duplicate rows: retrying a partially uploaded draft must not overwrite later edits.
  const { error } = await db.from('visits').upsert({ id: draft.id, created_by: draft.ownerId, visited_at: draft.visitedAt, note: draft.note || null, status: 'draft' }, { onConflict: 'id', ignoreDuplicates: true });
  if (error) throw error;
  if (!draft.photo) return;
  const photo = draft.photo;
  const { error: uploadError } = await db.storage.from('jiro-photos').upload(photo.path, photo.blob, { contentType: photo.blob.type, upsert: true });
  if (uploadError) throw uploadError;
  const { error: photoError } = await db.from('photos').upsert({ id: photo.id, visit_id: draft.id, created_by: draft.ownerId, storage_path: photo.path, width: photo.width, height: photo.height, file_size: photo.blob.size, mime_type: photo.blob.type, sort_order: 0 }, { onConflict: 'id', ignoreDuplicates: true });
  if (photoError) throw photoError;
}
export async function listVisits(): Promise<Visit[]> {
  const { data, error } = await client().from('visits').select('id,created_by,visited_at,status,note,shops(name),photos(storage_path,sort_order)').order('visited_at', { ascending: false }).limit(100);
  if (error) throw error;
  return (data ?? []).map(row => {
    const record = row as unknown as VisitRow & { shops: { name: string } | null; photos: Pick<PhotoRow, 'storage_path' | 'sort_order'>[] };
    return { id: record.id, ownerId: record.created_by, shopName: record.shops?.name ?? null, visitedAt: record.visited_at, status: record.status, note: record.note ?? '', photoPath: [...record.photos].sort((a, b) => a.sort_order - b.sort_order)[0]?.storage_path ?? null };
  });
}
