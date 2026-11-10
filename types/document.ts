/** A document stored in MongoDB (collection: documents). */
export interface Document {
  /** URL slug; unique. */
  slug: string;
  /** Lexical editor state JSON, or null when empty. */
  content: object | null;
  /** Locked documents can be read but not edited. */
  read_only: boolean;
  created_at?: string;
  updated_at?: string;
  version: number;

  /** The single previous version kept for "Restore previous". */
  previous_content?: object | null;
  previous_updated_at?: string;

  /** Denormalised on every save so lists never need to load content. */
  preview?: string;
  size?: number;
  is_empty?: boolean;
}

/** What the editor page needs (no previous body). */
export interface EditorDocument {
  slug: string;
  content: object | null;
  read_only: boolean;
  updated_at: string | null;
  previous_updated_at: string | null;
}

/** Row shape for the admin table (no content body). */
export interface DocumentSummary {
  slug: string;
  read_only: boolean;
  created_at?: string;
  updated_at?: string;
  preview: string;
  size: number;
  is_empty: boolean;
  has_previous: boolean;
}

export type AdminFilter = "all" | "locked" | "empty";
export type AdminSortKey = "slug" | "size" | "created_at" | "updated_at";

export interface AdminQuery {
  q: string;
  filter: AdminFilter;
  sort: AdminSortKey;
  desc: boolean;
  page: number;
}

export interface AdminListResult {
  rows: DocumentSummary[];
  total: number;
  counts: Record<AdminFilter, number>;
  pageSize: number;
}

export interface AdminStats {
  /** Last 30 days, oldest first. */
  days: { date: string; created: number; edited: number }[];
  largest: { slug: string; size: number }[];
  totalSize: number;
}
