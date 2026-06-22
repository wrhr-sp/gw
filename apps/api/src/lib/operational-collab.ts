import type { Board, BoardComment, BoardPost, DocumentFile, DocumentSpace, ReadReceipt } from "@gw/shared";
import { createOperationalSql, type PostgresEnv } from "./postgres";

type BoardRow = {
  id: string;
  company_id: string;
  code: string;
  name: string;
  board_type: Board["boardType"];
  visibility: Board["visibility"];
  status: Board["status"];
  created_by: string | null;
  created_at: string | Date;
  updated_at: string | Date;
};

type BoardPostRow = {
  id: string;
  company_id: string;
  board_id: string;
  author_user_id: string;
  author_employee_id: string | null;
  title: string;
  body: string;
  is_notice: boolean;
  published_at: string | Date | null;
  status: BoardPost["status"];
  created_at: string | Date;
  updated_at: string | Date;
};

type BoardCommentRow = {
  id: string;
  company_id: string;
  post_id: string;
  author_user_id: string;
  author_employee_id: string | null;
  parent_comment_id: string | null;
  body: string;
  deleted_at: string | Date | null;
  status: BoardComment["status"];
  created_at: string | Date;
  updated_at: string | Date;
};

type DocumentSpaceRow = {
  id: string;
  company_id: string;
  code: string;
  name: string;
  visibility: DocumentSpace["visibility"];
  owner_employee_id: string | null;
  owner_user_id: string | null;
  status: DocumentSpace["status"];
  created_at: string | Date;
  updated_at: string | Date;
};

type DocumentFileRow = {
  file_id: string;
  company_id: string;
  space_id: string;
  owner_employee_id: string | null;
  owner_user_id: string | null;
  version_id: string | null;
  file_name: string;
  content_type: string;
  file_size: number | string;
  version_label: string | null;
  visibility: DocumentSpace["visibility"];
  document_status: string | null;
  checksum_sha256: string | null;
  bucket: string;
  created_at: string | Date;
  updated_at: string | Date;
  file_deleted_at: string | Date | null;
};

function toIsoString(value: string | Date | null | undefined, fallback: string) {
  if (!value) {
    return fallback;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
}

function mapBoard(row: BoardRow): Board {
  return {
    id: row.id,
    companyId: row.company_id,
    boardType: row.board_type,
    name: row.name,
    slug: row.code,
    visibility: row.visibility,
    isNoticeOnly: row.board_type === "notice",
    status: row.status,
    createdBy: row.created_by ?? "system",
    createdAt: toIsoString(row.created_at, new Date(0).toISOString()),
    updatedAt: toIsoString(row.updated_at, new Date(0).toISOString()),
    placeholder: true,
  };
}

function mapBoardPost(row: BoardPostRow): BoardPost {
  return {
    id: row.id,
    companyId: row.company_id,
    boardId: row.board_id,
    authorEmployeeId: row.author_employee_id ?? row.author_user_id,
    title: row.title,
    bodyPreview: row.body,
    isNotice: row.is_notice,
    publishedAt: row.published_at ? toIsoString(row.published_at, new Date(0).toISOString()) : null,
    pinnedUntil: null,
    status: row.status,
    createdBy: row.author_user_id,
    createdAt: toIsoString(row.created_at, new Date(0).toISOString()),
    updatedAt: toIsoString(row.updated_at, new Date(0).toISOString()),
    placeholder: true,
  };
}

function mapBoardComment(row: BoardCommentRow): BoardComment {
  return {
    id: row.id,
    companyId: row.company_id,
    postId: row.post_id,
    authorEmployeeId: row.author_employee_id ?? row.author_user_id,
    parentCommentId: row.parent_comment_id,
    body: row.body,
    deletedAt: row.deleted_at ? toIsoString(row.deleted_at, new Date(0).toISOString()) : null,
    status: row.status,
    createdBy: row.author_user_id,
    createdAt: toIsoString(row.created_at, new Date(0).toISOString()),
    updatedAt: toIsoString(row.updated_at, new Date(0).toISOString()),
    placeholder: true,
  };
}

function mapDocumentSpace(row: DocumentSpaceRow): DocumentSpace {
  const ownerEmployeeId = row.owner_employee_id ?? row.owner_user_id ?? "system";
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    slug: row.code,
    visibility: row.visibility,
    ownerEmployeeId,
    isPublicWithinCompany: row.visibility === "company",
    status: row.status,
    createdBy: row.owner_user_id ?? ownerEmployeeId,
    createdAt: toIsoString(row.created_at, new Date(0).toISOString()),
    updatedAt: toIsoString(row.updated_at, new Date(0).toISOString()),
    placeholder: true,
  };
}

function mapDocumentFile(row: DocumentFileRow): DocumentFile {
  const status = row.file_deleted_at || row.document_status === "archived" ? "deleted" : row.document_status === "pending_upload" ? "pending" : "ready";
  const provider = row.bucket === "mock" ? "mock" : "r2";
  const ownerEmployeeId = row.owner_employee_id ?? row.owner_user_id ?? "system";
  return {
    id: row.file_id,
    companyId: row.company_id,
    spaceId: row.space_id,
    ownerEmployeeId,
    versionId: row.version_id ?? `document_version_${row.file_id}`,
    fileName: row.file_name,
    contentType: row.content_type,
    fileSize: Number(row.file_size),
    versionLabel: row.version_label ?? "v1",
    isPublicWithinCompany: row.visibility === "company",
    storageProvider: provider,
    storageStatus: status,
    checksumSha256: row.checksum_sha256,
    status: status === "deleted" ? "archived" : "active",
    createdAt: toIsoString(row.created_at, new Date(0).toISOString()),
    updatedAt: toIsoString(row.updated_at, new Date(0).toISOString()),
    placeholder: true,
  };
}

export async function listOperationalBoards(env: PostgresEnv | undefined, companyId: string) {
  const sql = createOperationalSql(env);
  if (!sql) {
    return null;
  }

  const rows = await sql`
    select id, company_id, code, name, board_type, visibility, status, created_by, created_at, updated_at
    from boards
    where company_id = ${companyId}
      and deleted_at is null
    order by name, id
  `;

  return rows.map((row) => mapBoard(row as BoardRow));
}

export async function createOperationalBoard(
  env: PostgresEnv | undefined,
  input: Pick<Board, "id" | "companyId" | "boardType" | "name" | "slug" | "visibility" | "status" | "createdBy" | "createdAt" | "updatedAt">,
) {
  const sql = createOperationalSql(env);
  if (!sql) {
    return null;
  }

  const rows = await sql`
    insert into boards (id, company_id, code, name, board_type, visibility, status, created_by, created_at, updated_at)
    values (
      ${input.id},
      ${input.companyId},
      ${input.slug},
      ${input.name},
      ${input.boardType},
      ${input.visibility},
      ${input.status},
      ${input.createdBy},
      ${input.createdAt}::timestamptz,
      ${input.updatedAt}::timestamptz
    )
    on conflict (company_id, code) do update set
      name = excluded.name,
      board_type = excluded.board_type,
      visibility = excluded.visibility,
      status = excluded.status,
      created_by = excluded.created_by,
      updated_at = excluded.updated_at
    where boards.company_id = excluded.company_id
      and boards.code = excluded.code
    returning id, company_id, code, name, board_type, visibility, status, created_by, created_at, updated_at
  `;

  return mapBoard(rows[0] as BoardRow);
}

export async function listOperationalBoardPosts(env: PostgresEnv | undefined, companyId: string, boardId?: string) {
  const sql = createOperationalSql(env);
  if (!sql) {
    return null;
  }

  const rows = await sql`
    select
      p.id,
      p.company_id,
      p.board_id,
      p.author_user_id,
      e.id as author_employee_id,
      p.title,
      p.body,
      p.is_notice,
      p.published_at,
      p.status,
      p.created_at,
      p.updated_at
    from posts p
    left join employees e on e.user_id = p.author_user_id and e.company_id = p.company_id and e.deleted_at is null
    where p.company_id = ${companyId}
      and (${boardId ?? null}::text is null or p.board_id = ${boardId ?? null})
      and p.deleted_at is null
    order by coalesce(p.published_at, p.created_at) desc, p.id desc
  `;

  return rows.map((row) => mapBoardPost(row as BoardPostRow));
}

export async function findOperationalBoardPost(env: PostgresEnv | undefined, companyId: string, postId: string) {
  const sql = createOperationalSql(env);
  if (!sql) {
    return null;
  }

  const rows = await sql`
    select
      p.id,
      p.company_id,
      p.board_id,
      p.author_user_id,
      e.id as author_employee_id,
      p.title,
      p.body,
      p.is_notice,
      p.published_at,
      p.status,
      p.created_at,
      p.updated_at
    from posts p
    left join employees e on e.user_id = p.author_user_id and e.company_id = p.company_id and e.deleted_at is null
    where p.company_id = ${companyId}
      and p.id = ${postId}
      and p.deleted_at is null
    limit 1
  `;

  const row = rows[0] as BoardPostRow | undefined;
  return row ? mapBoardPost(row) : null;
}

export async function createOperationalBoardPost(
  env: PostgresEnv | undefined,
  input: Pick<BoardPost, "id" | "companyId" | "boardId" | "authorEmployeeId" | "title" | "bodyPreview" | "isNotice" | "status" | "createdBy" | "createdAt" | "updatedAt"> & {
    publishedAt: string | null;
  },
) {
  const sql = createOperationalSql(env);
  if (!sql) {
    return null;
  }

  const rows = await sql`
    insert into posts (id, company_id, board_id, author_user_id, title, body, status, is_notice, published_at, created_at, updated_at)
    values (
      ${input.id},
      ${input.companyId},
      ${input.boardId},
      ${input.createdBy},
      ${input.title},
      ${input.bodyPreview},
      ${input.status},
      ${input.isNotice},
      ${input.publishedAt}::timestamptz,
      ${input.createdAt}::timestamptz,
      ${input.updatedAt}::timestamptz
    )
    on conflict (id) do update set
      title = excluded.title,
      body = excluded.body,
      status = excluded.status,
      is_notice = excluded.is_notice,
      published_at = excluded.published_at,
      updated_at = excluded.updated_at
    returning id, company_id, board_id, author_user_id, ${input.authorEmployeeId}::text as author_employee_id, title, body, is_notice, published_at, status, created_at, updated_at
  `;

  return mapBoardPost(rows[0] as BoardPostRow);
}

export async function listOperationalBoardComments(env: PostgresEnv | undefined, companyId: string, postId: string) {
  const sql = createOperationalSql(env);
  if (!sql) {
    return null;
  }

  const rows = await sql`
    select
      c.id,
      c.company_id,
      c.post_id,
      c.author_user_id,
      e.id as author_employee_id,
      c.parent_comment_id,
      c.body,
      c.deleted_at,
      c.status,
      c.created_at,
      c.updated_at
    from comments c
    left join employees e on e.user_id = c.author_user_id and e.company_id = c.company_id and e.deleted_at is null
    where c.company_id = ${companyId}
      and c.post_id = ${postId}
      and c.deleted_at is null
    order by c.created_at asc, c.id asc
  `;

  return rows.map((row) => mapBoardComment(row as BoardCommentRow));
}

export async function createOperationalBoardComment(
  env: PostgresEnv | undefined,
  input: Pick<BoardComment, "id" | "companyId" | "postId" | "authorEmployeeId" | "parentCommentId" | "body" | "status" | "createdBy" | "createdAt" | "updatedAt">,
) {
  const sql = createOperationalSql(env);
  if (!sql) {
    return null;
  }

  const rows = await sql`
    insert into comments (id, company_id, post_id, author_user_id, parent_comment_id, body, status, created_at, updated_at)
    values (
      ${input.id},
      ${input.companyId},
      ${input.postId},
      ${input.createdBy},
      ${input.parentCommentId},
      ${input.body},
      ${input.status},
      ${input.createdAt}::timestamptz,
      ${input.updatedAt}::timestamptz
    )
    on conflict (id) do update set
      parent_comment_id = excluded.parent_comment_id,
      body = excluded.body,
      status = excluded.status,
      updated_at = excluded.updated_at
    returning id, company_id, post_id, author_user_id, ${input.authorEmployeeId}::text as author_employee_id, parent_comment_id, body, null::timestamptz as deleted_at, status, created_at, updated_at
  `;

  return mapBoardComment(rows[0] as BoardCommentRow);
}

export async function listOperationalDocumentSpaces(env: PostgresEnv | undefined, companyId: string) {
  const sql = createOperationalSql(env);
  if (!sql) {
    return null;
  }

  const rows = await sql`
    select
      ds.id,
      ds.company_id,
      ds.code,
      ds.name,
      ds.visibility,
      e.id as owner_employee_id,
      ds.owner_user_id,
      ds.status,
      ds.created_at,
      ds.updated_at
    from document_spaces ds
    left join employees e on e.user_id = ds.owner_user_id and e.company_id = ds.company_id and e.deleted_at is null
    where ds.company_id = ${companyId}
      and ds.deleted_at is null
    order by ds.name, ds.id
  `;

  return rows.map((row) => mapDocumentSpace(row as DocumentSpaceRow));
}

export async function createOperationalDocumentSpace(
  env: PostgresEnv | undefined,
  input: Pick<DocumentSpace, "id" | "companyId" | "name" | "slug" | "visibility" | "ownerEmployeeId" | "status" | "createdBy" | "createdAt" | "updatedAt">,
) {
  const sql = createOperationalSql(env);
  if (!sql) {
    return null;
  }

  const rows = await sql`
    insert into document_spaces (id, company_id, code, name, visibility, owner_user_id, status, created_at, updated_at)
    values (
      ${input.id},
      ${input.companyId},
      ${input.slug},
      ${input.name},
      ${input.visibility},
      ${input.createdBy},
      ${input.status},
      ${input.createdAt}::timestamptz,
      ${input.updatedAt}::timestamptz
    )
    on conflict (company_id, code) do update set
      name = excluded.name,
      visibility = excluded.visibility,
      owner_user_id = excluded.owner_user_id,
      status = excluded.status,
      updated_at = excluded.updated_at
    where document_spaces.company_id = excluded.company_id
      and document_spaces.code = excluded.code
    returning id, company_id, code, name, visibility, ${input.ownerEmployeeId}::text as owner_employee_id, owner_user_id, status, created_at, updated_at
  `;

  return mapDocumentSpace(rows[0] as DocumentSpaceRow);
}

export async function listOperationalDocumentFiles(env: PostgresEnv | undefined, companyId: string, spaceId?: string) {
  const sql = createOperationalSql(env);
  if (!sql) {
    return null;
  }

  const rows = await sql`
    select
      fo.id as file_id,
      fo.company_id,
      d.space_id,
      e.id as owner_employee_id,
      coalesce(fo.owner_user_id, d.owner_user_id) as owner_user_id,
      d.id as version_id,
      coalesce(fo.file_name, d.title) as file_name,
      fo.content_type,
      fo.file_size,
      d.summary as version_label,
      ds.visibility,
      d.status as document_status,
      fo.checksum_sha256,
      fo.bucket,
      fo.created_at,
      coalesce(d.updated_at, fo.created_at) as updated_at,
      fo.deleted_at as file_deleted_at
    from file_objects fo
    join documents d on d.id = fo.document_id and d.company_id = fo.company_id and d.deleted_at is null
    join document_spaces ds on ds.id = d.space_id and ds.company_id = fo.company_id and ds.deleted_at is null
    left join employees e on e.user_id = coalesce(fo.owner_user_id, d.owner_user_id) and e.company_id = fo.company_id and e.deleted_at is null
    where fo.company_id = ${companyId}
      and (${spaceId ?? null}::text is null or ds.id = ${spaceId ?? null})
      and fo.deleted_at is null
    order by fo.created_at desc, fo.id desc
  `;

  return rows.map((row) => mapDocumentFile(row as DocumentFileRow));
}

export async function findOperationalDocumentFile(env: PostgresEnv | undefined, companyId: string, fileId: string) {
  const sql = createOperationalSql(env);
  if (!sql) {
    return null;
  }

  const rows = await sql`
    select
      fo.id as file_id,
      fo.company_id,
      d.space_id,
      e.id as owner_employee_id,
      coalesce(fo.owner_user_id, d.owner_user_id) as owner_user_id,
      d.id as version_id,
      coalesce(fo.file_name, d.title) as file_name,
      fo.content_type,
      fo.file_size,
      d.summary as version_label,
      ds.visibility,
      d.status as document_status,
      fo.checksum_sha256,
      fo.bucket,
      fo.created_at,
      coalesce(d.updated_at, fo.created_at) as updated_at,
      fo.deleted_at as file_deleted_at
    from file_objects fo
    join documents d on d.id = fo.document_id and d.company_id = fo.company_id and d.deleted_at is null
    join document_spaces ds on ds.id = d.space_id and ds.company_id = fo.company_id and ds.deleted_at is null
    left join employees e on e.user_id = coalesce(fo.owner_user_id, d.owner_user_id) and e.company_id = fo.company_id and e.deleted_at is null
    where fo.company_id = ${companyId}
      and fo.id = ${fileId}
    limit 1
  `;

  const row = rows[0] as DocumentFileRow | undefined;
  return row ? mapDocumentFile(row) : null;
}

export async function createOperationalDocumentFile(
  env: PostgresEnv | undefined,
  input: Pick<DocumentFile, "id" | "companyId" | "spaceId" | "ownerEmployeeId" | "versionId" | "fileName" | "contentType" | "fileSize" | "versionLabel" | "status" | "createdAt" | "updatedAt"> & {
    createdBy?: string;
    storageProvider: DocumentFile["storageProvider"];
    storageStatus: DocumentFile["storageStatus"];
    checksumSha256: string | null;
  },
) {
  const sql = createOperationalSql(env);
  if (!sql) {
    return null;
  }

  const bucket = input.storageProvider === "r2" ? "gw-files" : "mock";
  const objectKey = `companies/${input.companyId}/spaces/${input.spaceId}/files/${input.id}/${input.versionId}`;
  const documentStatus = input.storageStatus === "deleted" ? "archived" : input.storageStatus === "pending" ? "pending_upload" : "active";
  const createdBy = input.createdBy ?? input.ownerEmployeeId;

  await sql`
    insert into documents (id, company_id, space_id, owner_user_id, title, summary, status, created_at, updated_at)
    values (
      ${input.versionId},
      ${input.companyId},
      ${input.spaceId},
      ${createdBy},
      ${input.fileName},
      ${input.versionLabel},
      ${documentStatus},
      ${input.createdAt}::timestamptz,
      ${input.updatedAt}::timestamptz
    )
    on conflict (id) do update set
      title = excluded.title,
      summary = excluded.summary,
      status = excluded.status,
      updated_at = excluded.updated_at
  `;

  const rows = await sql`
    insert into file_objects (id, company_id, document_id, bucket, object_key, file_name, content_type, file_size, checksum_sha256, owner_user_id, created_at, deleted_at)
    values (
      ${input.id},
      ${input.companyId},
      ${input.versionId},
      ${bucket},
      ${objectKey},
      ${input.fileName},
      ${input.contentType},
      ${input.fileSize},
      ${input.checksumSha256},
      ${createdBy},
      ${input.createdAt}::timestamptz,
      ${input.storageStatus === "deleted" ? input.updatedAt : null}::timestamptz
    )
    on conflict (id) do update set
      document_id = excluded.document_id,
      bucket = excluded.bucket,
      object_key = excluded.object_key,
      file_name = excluded.file_name,
      content_type = excluded.content_type,
      file_size = excluded.file_size,
      checksum_sha256 = excluded.checksum_sha256,
      owner_user_id = excluded.owner_user_id,
      deleted_at = excluded.deleted_at
    returning
      id as file_id,
      company_id,
      ${input.spaceId}::text as space_id,
      ${input.ownerEmployeeId}::text as owner_employee_id,
      owner_user_id,
      ${input.versionId}::text as version_id,
      file_name,
      content_type,
      file_size,
      ${input.versionLabel}::text as version_label,
      (select visibility from document_spaces where id = ${input.spaceId}) as visibility,
      ${documentStatus}::text as document_status,
      checksum_sha256,
      bucket,
      created_at,
      ${input.updatedAt}::timestamptz as updated_at,
      deleted_at as file_deleted_at
  `;

  return mapDocumentFile(rows[0] as DocumentFileRow);
}

export async function markOperationalDocumentFileUploaded(
  env: PostgresEnv | undefined,
  input: { companyId: string; fileId: string; versionId: string; checksumSha256: string | null; updatedAt: string },
) {
  const sql = createOperationalSql(env);
  if (!sql) {
    return null;
  }

  await sql`
    update documents
    set status = 'active', updated_at = ${input.updatedAt}::timestamptz
    where id = ${input.versionId}
      and company_id = ${input.companyId}
  `;

  await sql`
    update file_objects
    set checksum_sha256 = ${input.checksumSha256}, deleted_at = null
    where id = ${input.fileId}
      and company_id = ${input.companyId}
  `;

  return findOperationalDocumentFile(env, input.companyId, input.fileId);
}

export async function archiveOperationalDocumentFile(
  env: PostgresEnv | undefined,
  input: { companyId: string; fileId: string; versionId: string; updatedAt: string },
) {
  const sql = createOperationalSql(env);
  if (!sql) {
    return null;
  }

  await sql`
    update documents
    set status = 'archived', updated_at = ${input.updatedAt}::timestamptz
    where id = ${input.versionId}
      and company_id = ${input.companyId}
  `;

  await sql`
    update file_objects
    set deleted_at = ${input.updatedAt}::timestamptz
    where id = ${input.fileId}
      and company_id = ${input.companyId}
  `;

  return findOperationalDocumentFile(env, input.companyId, input.fileId);
}

export async function upsertOperationalReadReceipt(
  env: PostgresEnv | undefined,
  input: Pick<ReadReceipt, "id" | "companyId" | "targetType" | "targetId" | "employeeId" | "readAt" | "createdAt" | "updatedAt"> & { userId: string },
) {
  const sql = createOperationalSql(env);
  if (!sql) {
    return null;
  }

  await sql`
    insert into read_receipts (id, company_id, target_type, target_id, user_id, read_at)
    values (
      ${input.id},
      ${input.companyId},
      ${input.targetType},
      ${input.targetId},
      ${input.userId},
      ${input.readAt}::timestamptz
    )
    on conflict (company_id, target_type, target_id, user_id)
    do update set read_at = excluded.read_at
  `;

  return {
    id: input.id,
    companyId: input.companyId,
    targetType: input.targetType,
    targetId: input.targetId,
    employeeId: input.employeeId,
    readAt: input.readAt,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  } satisfies ReadReceipt;
}
