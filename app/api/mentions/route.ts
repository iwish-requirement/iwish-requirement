import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

export const runtime = 'nodejs';

interface CommentRow {
  id: number;
  content: string;
  created_at: string;
  author_id: number;
  is_deleted?: boolean | null;
  parent_comment_id: number | null;
  reply_to_comment_id: number | null;
  demand_id: number;
}

interface UserRow {
  id: number;
  name: string | null;
  email: string | null;
}

interface DemandRow {
  id: number;
  title: string | null;
  fields: any;
}

function formatCreatedAt(value: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const userEmailRaw = url.searchParams.get('userEmail');
    const userEmail = userEmailRaw?.trim() || '';

    if (!userEmail) {
      return NextResponse.json(
        { error: 'userEmail is required' },
        { status: 400 }
      );
    }

    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, name, email')
      .eq('email', userEmail)
      .maybeSingle();

    if (userError || !user) {
      console.error('[api/mentions] load user error', userError);
      return NextResponse.json(
        { error: 'user not found', detail: userError?.message },
        { status: 400 }
      );
    }

    const email = (user.email || '').trim();
    const emailPrefix = email ? email.split('@')[0] || '' : '';
    const primaryDisplayName = (user.name || '').trim() || emailPrefix;

    if (!primaryDisplayName && !emailPrefix) {
      return NextResponse.json({ items: [] }, { status: 200 });
    }

    const candidateNames = new Set<string>();
    if (primaryDisplayName) {
      candidateNames.add(primaryDisplayName);
    }
    if (emailPrefix) {
      candidateNames.add(emailPrefix);
      candidateNames.add(emailPrefix.toUpperCase());
    }

    const orConditions = Array.from(candidateNames)
      .filter((name) => name)
      .map((name) => `content.ilike.%@${name}%`)
      .join(',');

    let commentsQuery = supabaseAdmin
      .from('demand_comments')
      .select('id, content, created_at, author_id, is_deleted, parent_comment_id, reply_to_comment_id, demand_id')
      .eq('is_deleted', false);

    if (orConditions) {
      commentsQuery = commentsQuery.or(orConditions);
    }

    const { data: rows, error: commentsError } = await commentsQuery
      .order('created_at', { ascending: false })
      .limit(100);

    if (commentsError) {
      console.error('[api/mentions] load comments error', commentsError);
      return NextResponse.json(
        { error: 'failed to load mentions', detail: commentsError.message },
        { status: 500 }
      );
    }

    const commentRows: CommentRow[] = (rows as CommentRow[]) || [];

    if (!commentRows.length) {
      return NextResponse.json({ items: [] }, { status: 200 });
    }

    const demandIds = Array.from(
      new Set(commentRows.map((row) => row.demand_id).filter(Boolean))
    ) as number[];
    const authorIds = Array.from(
      new Set(commentRows.map((row) => row.author_id).filter(Boolean))
    ) as number[];

    let demandsMap: Record<number, DemandRow> = {};
    let usersMap: Record<number, UserRow> = {};

    if (demandIds.length) {
      const { data: demands, error: demandsError } = await supabaseAdmin
        .from('demands')
        .select('id, title, fields')
        .in('id', demandIds);

      if (demandsError) {
        console.error('[api/mentions] load demands error', demandsError);
      } else if (demands) {
        demandsMap = (demands as DemandRow[]).reduce((acc, d) => {
          acc[d.id] = d;
          return acc;
        }, {} as Record<number, DemandRow>);
      }
    }

    if (authorIds.length) {
      const { data: users, error: usersError } = await supabaseAdmin
        .from('users')
        .select('id, name, email')
        .in('id', authorIds);

      if (usersError) {
        console.error('[api/mentions] load users error', usersError);
      } else if (users) {
        usersMap = (users as UserRow[]).reduce((acc, u) => {
          acc[u.id] = u;
          return acc;
        }, {} as Record<number, UserRow>);
      }
    }

    const items = commentRows.map((row) => {
      const demand = demandsMap[row.demand_id];
      const author = usersMap[row.author_id];
      const fields = (demand?.fields || {}) as any;
      const code: string = (fields.code as string | undefined) || '';

      const authorEmail = author?.email ?? '';
      const codeFromEmail = authorEmail ? authorEmail.split('@')[0]?.toUpperCase() : '';
      const authorLabel = author?.name || codeFromEmail || `用户#${row.author_id}`;

      return {
        id: row.id,
        content: row.content,
        createdAt: formatCreatedAt(row.created_at),
        authorLabel,
        demandCode: code,
        demandTitle: demand?.title ?? '',
        parentId: row.parent_comment_id,
        replyToCommentId: row.reply_to_comment_id,
      };
    });

    return NextResponse.json({ items }, { status: 200 });
  } catch (error: any) {
    console.error('[api/mentions] error', error);
    return NextResponse.json(
      {
        error: 'failed to load mentions',
        detail: error?.message ?? String(error),
      },
      { status: 500 }
    );
  }
}
