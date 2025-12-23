import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';

export const runtime = 'nodejs';

interface AttachmentRow {
  id: number;
  file_name: string;
  file_url: string;
  mime_type: string | null;
  size: number | null;
  created_at: string;
}

interface CommentRow {
  id: number;
  content: string;
  created_at: string;
  author_id: number;
  is_deleted?: boolean | null;
  parent_comment_id: number | null;
  reply_to_comment_id: number | null;
  demand_comment_attachments?: AttachmentRow[];
}

interface UserRow {
  id: number;
  name: string | null;
  email: string | null;
}

function mapAttachmentRow(row: AttachmentRow) {
  const createdAt = row.created_at
    ? new Date(row.created_at).toISOString().slice(0, 19).replace('T', ' ')
    : '';

  return {
    id: row.id,
    fileName: row.file_name,
    fileUrl: row.file_url,
    mimeType: row.mime_type ?? '',
    size: row.size ?? 0,
    createdAt,
  };
}

function mapCommentRow(row: CommentRow, user?: UserRow | null) {
  const createdAt = row.created_at
    ? new Date(row.created_at).toISOString().slice(0, 19).replace('T', ' ')
    : '';
  const email = user?.email ?? '';
  const code = email ? email.split('@')[0]?.toUpperCase() : '';
  const authorLabel = user?.name || code || `用户#${row.author_id}`;

  const rawAttachments = row.demand_comment_attachments || [];
  const attachments = rawAttachments.map(mapAttachmentRow);

  return {
    id: row.id,
    content: row.content,
    createdAt,
    authorLabel,
    authorEmail: email,
    parentId: row.parent_comment_id,
    replyToCommentId: row.reply_to_comment_id,
    attachments,
  };
}

export async function GET(
  req: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const code = context.params.id;

    if (!code) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const { data: demand, error: demandError } = await supabaseAdmin
      .from('demands')
      .select('id')
      .eq('fields->>code', code)
      .maybeSingle();

    if (demandError) {
      console.error('[api/demands/:id/comments] load demand error', demandError);
      return NextResponse.json(
        { error: 'failed to load demand', detail: demandError.message },
        { status: 500 }
      );
    }

    if (!demand) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }

    const { data: rows, error: commentsError } = await supabaseAdmin
      .from('demand_comments')
      .select('id, content, created_at, author_id, is_deleted, parent_comment_id, reply_to_comment_id, demand_comment_attachments (id, file_name, file_url, mime_type, size, created_at)')
      .eq('demand_id', demand.id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true });

    if (commentsError) {
      console.error('[api/demands/:id/comments] query error', commentsError);
      return NextResponse.json(
        { error: 'failed to load comments', detail: commentsError.message },
        { status: 500 }
      );
    }

    const commentsRows: CommentRow[] = (rows as CommentRow[]) || [];

    if (!commentsRows.length) {
      return NextResponse.json({ comments: [] });
    }

    const authorIds = Array.from(
      new Set(commentsRows.map((row) => row.author_id).filter(Boolean))
    ) as number[];

    let usersMap: Record<number, UserRow> = {};

    if (authorIds.length) {
      const { data: users, error: usersError } = await supabaseAdmin
        .from('users')
        .select('id, name, email')
        .in('id', authorIds);

      if (usersError) {
        console.error('[api/demands/:id/comments] load users error', usersError);
      } else if (users) {
        usersMap = (users as UserRow[]).reduce((acc, user) => {
          acc[user.id] = user;
          return acc;
        }, {} as Record<number, UserRow>);
      }
    }

    const comments = commentsRows.map((row) =>
      mapCommentRow(row, usersMap[row.author_id])
    );

    return NextResponse.json({ comments });
  } catch (error: any) {
    console.error('[api/demands/:id/comments] error', error);
    return NextResponse.json(
      {
        error: 'failed to load comments',
        detail: error?.message ?? String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const code = context.params.id;

    if (!code) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const body = await req.json();
    const rawContent = (body.content as string | undefined) ?? '';
    const content = rawContent.trim();
    const authorEmail = (body.authorEmail as string | undefined)?.trim();
    const parentIdRaw = body.parentId as number | string | undefined;
    const replyToRaw = body.replyToCommentId as number | string | undefined;

    if (!authorEmail) {
      return NextResponse.json(
        { error: 'authorEmail is required' },
        { status: 400 }
      );
    }

    let parentCommentId: number | null = null;
    if (typeof parentIdRaw === 'number' && Number.isFinite(parentIdRaw)) {
      parentCommentId = parentIdRaw;
    } else if (typeof parentIdRaw === 'string' && parentIdRaw.trim()) {
      const parsed = Number.parseInt(parentIdRaw.trim(), 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        parentCommentId = parsed;
      }
    }

    let replyToCommentId: number | null = null;
    if (typeof replyToRaw === 'number' && Number.isFinite(replyToRaw)) {
      replyToCommentId = replyToRaw;
    } else if (typeof replyToRaw === 'string' && replyToRaw.trim()) {
      const parsed = Number.parseInt(replyToRaw.trim(), 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        replyToCommentId = parsed;
      }
    }

    const [{ data: demand, error: demandError }, { data: user, error: userError }, parentCommentResult, replyToCommentResult] =
      await Promise.all([
        supabaseAdmin
          .from('demands')
          .select('id')
          .eq('fields->>code', code)
          .maybeSingle(),
        supabaseAdmin
          .from('users')
          .select('id, name, email')
          .eq('email', authorEmail)
          .maybeSingle(),
        parentCommentId
          ? supabaseAdmin
              .from('demand_comments')
              .select('id, demand_id')
              .eq('id', parentCommentId)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null } as any),
        replyToCommentId
          ? supabaseAdmin
              .from('demand_comments')
              .select('id, demand_id, parent_comment_id')
              .eq('id', replyToCommentId)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null } as any),
      ]);

    const { data: parentComment, error: parentCommentError } = parentCommentResult as {
      data: { id: number; demand_id: number } | null;
      error: any;
    };

    const { data: replyToComment, error: replyToCommentError } = replyToCommentResult as {
      data: { id: number; demand_id: number; parent_comment_id: number | null } | null;
      error: any;
    };

    if (demandError) {
      console.error('[api/demands/:id/comments] load demand error', demandError);
      return NextResponse.json(
        { error: 'failed to load demand', detail: demandError.message },
        { status: 500 }
      );
    }

    if (!demand) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }

    if (userError || !user) {
      console.error('[api/demands/:id/comments] user error', userError);
      return NextResponse.json(
        { error: 'user not found', detail: userError?.message },
        { status: 400 }
      );
    }

    if (parentCommentError) {
      console.error('[api/demands/:id/comments] load parent comment error', parentCommentError);
      return NextResponse.json(
        { error: 'failed to load parent comment', detail: parentCommentError.message },
        { status: 500 }
      );
    }

    if (replyToCommentError) {
      console.error('[api/demands/:id/comments] load replyTo comment error', replyToCommentError);
      return NextResponse.json(
        { error: 'failed to load replyTo comment', detail: replyToCommentError.message },
        { status: 500 }
      );
    }

    if (parentCommentId && (!parentComment || parentComment.demand_id !== demand.id)) {
      return NextResponse.json(
        { error: 'invalid parentId for this demand' },
        { status: 400 }
      );
    }

    if (replyToCommentId && (!replyToComment || replyToComment.demand_id !== demand.id)) {
      return NextResponse.json(
        { error: 'invalid replyToCommentId for this demand' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('demand_comments')
      .insert({
        demand_id: demand.id,
        author_id: user.id,
        content,
        parent_comment_id: parentCommentId,
        reply_to_comment_id: replyToCommentId,
      })
      .select('id, content, created_at, author_id, is_deleted, parent_comment_id, reply_to_comment_id, demand_comment_attachments (id, file_name, file_url, mime_type, size, created_at)')
      .maybeSingle();

    if (error || !data) {
      console.error('[api/demands/:id/comments] insert error', error);
      return NextResponse.json(
        {
          error: 'failed to create comment',
          detail: error?.message ?? 'insert failed',
        },
        { status: 500 }
      );
    }

    const comment = mapCommentRow(data as CommentRow, user as UserRow);

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error: any) {
    console.error('[api/demands/:id/comments] create error', error);
    return NextResponse.json(
      {
        error: 'failed to create comment',
        detail: error?.message ?? String(error),
      },
      { status: 500 }
    );
  }
}
