// Phase 1 row types. Regenerate from Supabase when extending the schema (see README).
export type MemberRow = { user_id: string; display_name: string; role: 'member' | 'admin'; is_active: boolean; created_at: string };
export type VisitRow = { id: string; created_by: string; shop_id: string | null; visited_at: string; status: 'draft' | 'completed'; note: string | null; created_at: string; updated_at: string };
export type PhotoRow = { id: string; visit_id: string; created_by: string; storage_path: string; width: number | null; height: number | null; file_size: number | null; mime_type: string | null; captured_at: string | null; sort_order: number; created_at: string };
