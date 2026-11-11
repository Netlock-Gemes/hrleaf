/** Who can open a note without a share link. "team" = admin + members, "private" = admin only. */
export type Visibility = "team" | "private";

export type ShareMode = "read" | "write";

/** A public share link: anyone with /s/<token> can read (or edit) this one note. */
export interface ShareLink {
  token: string;
  mode: ShareMode;
  created_at: string;
}

/** A document stored in MongoDB (collection: documents). */
export interface Document {
  /** URL slug; unique. */
  slug: string;
  /** Lexical editor state JSON, or null when empty. */
  content: object | null;
  /** Locked documents can be read but not edited (except by the admin's tools). */
  read_only: boolean;
  created_at?: string;
  updated_at?: string;
  version: number;

  /** Missing means "team". */
  visibility?: Visibility;
  share?: ShareLink | null;
  created_by?: string;
  updated_by?: string;

  /** Set when moved to the trash. A TTL index removes the note 30 days later. */
  deleted_at?: Date;
  deleted_by?: string;

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
  updated_by: string | null;
  previous_updated_at: string | null;
  visibility: Visibility;
  share: ShareLink | null;
  deleted: boolean;
}

/** Row shape for lists (no content body). */
export interface DocumentSummary {
  slug: string;
  read_only: boolean;
  created_at?: string;
  updated_at?: string;
  updated_by?: string;
  preview: string;
  size: number;
  is_empty: boolean;
  has_previous: boolean;
  visibility: Visibility;
  share: ShareLink | null;
  deleted_at?: string;
}

export type AdminFilter = "all" | "shared" | "private" | "locked" | "empty" | "trash";
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

export interface StorageInfo {
  /** Bytes used by this app's database. */
  appBytes: number;
  /** Bytes used by the whole cluster, when the server lets us ask. */
  clusterBytes: number | null;
  /** Atlas free tier limit. */
  limitBytes: number;
}

/* ---------------------------------- users --------------------------------- */

export type Role = "admin" | "member";

/** The signed-in person for this request. */
export interface Viewer {
  id: string;
  role: Role;
  username: string;
  name: string;
}

/** Row shape for the admin Users screen. */
export interface UserSummary {
  id: string;
  username: string;
  name: string;
  disabled: boolean;
  created_at: string;
  last_login_at: string | null;
}

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  action: string;
  target?: string;
  detail?: string;
  ip?: string;
}
