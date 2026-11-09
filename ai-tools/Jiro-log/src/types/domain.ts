export type Visit = {
  id: string; ownerId: string; shopName: string | null; visitedAt: string;
  status: 'draft' | 'completed'; note: string; photoPath: string | null;
};
export type PendingDraft = {
  id: string; ownerId: string; visitedAt: string; note: string;
  photo: { id: string; blob: Blob; width: number; height: number; path: string } | null;
};
