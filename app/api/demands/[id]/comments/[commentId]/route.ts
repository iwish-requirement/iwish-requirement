import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../../lib/supabaseAdmin';

export const runtime = 'edge';

export async function DELETE(
  req: NextRequest,
  context: { params: { id: string; commentId: string } }
) {
  try {
    const code = context.params.id;
    const commentIdRaw = context.params.commentId;

    if (!code || !commentIdRaw) {
      return NextResponse.json({ error: 'id and commentId are required' }, { status: 400 });
    }

    const commentId = Number.parseInt(commentIdRaw, 10);
    if (!Number.isFinite(commentId) || commentId <= 0) {
      return NextResponse.json({ error: 'invalid commentId' }, { status: 400 });
    }

    let authorEmail: string | undefined;
    try {
      const body = await req.json();
      authorEmail = (body.authorEmail as string | undefined)?.trim();
    } catch {
      authorEmail = undefined;
    }

    if (!authorEmail) {
      return NextResponse.json(
        { error: 'authorEmail is required' },
        { status: 400 }
      );
    }

    const [{ data: demand, error: demandError }, { data: user, error: userError }] =
      await Promise.all([
        supabaseAdmin
          .from('demands')
          .select('id')
          .eq('fields->>code', code)
          .maybeSingle(),
        supabaseAdmin
          .from('users')
          .select('id, email')
          .eq('email', authorEmail)
          .maybeSingle(),
      ]);

    if (demandError) {
      console.error('[api/demands/:id/comments/:commentId] load demand error', demandError);
      return NextResponse.json(
        { error: 'failed to load demand', detail: demandError.message },
        { status: 500 }
      );
    }

    if (!demand) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }

    if (userError || !user) {
      console.error('[api/demands/:id/comments/:commentId] user error', userError);
      return NextResponse.json(
        { error: 'user not found', detail: userError?.message },
        { status: 400 }
      );
    }

    const { data: comment, error: commentError } = await supabaseAdmin
      .from('demand_comments')
      .select('id, demand_id, author_id, is_deleted, created_at')
      .eq('id', commentId)
      .maybeSingle();

    if (commentError) {
      console.error('[api/demands/:id/comments/:commentId] load comment error', commentError);
      return NextResponse.json(
        { error: 'failed to load comment', detail: commentError.message },
        { status: 500 }
      );
    }

    if (!comment || comment.demand_id !== demand.id) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }

    if (comment.is_deleted) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    if (comment.author_id !== user.id) {
      return NextResponse.json(
        { error: 'forbidden: only author can delete this comment at current stage' },
        { status: 403 }
      );
    }

    const { error: updateError } = await supabaseAdmin
      .from('demand_comments')
      .update({ is_deleted: true })
      .eq('id', comment.id);

    if (updateError) {
      console.error('[api/demands/:id/comments/:commentId] delete error', updateError);
      return NextResponse.json(
        { error: 'failed to delete comment', detail: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: any) {
    console.error('[api/demands/:id/comments/:commentId] delete error', error);
    return NextResponse.json(
      {
        error: 'failed to delete comment',
        detail: error?.message ?? String(error),
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: { id: string; commentId: string } }
) {
  try {
    const code = context.params.id;
    const commentIdRaw = context.params.commentId;

    if (!code || !commentIdRaw) {
      return NextResponse.json({ error: 'id and commentId are required' }, { status: 400 });
    }

    const commentId = Number.parseInt(commentIdRaw, 10);
    if (!Number.isFinite(commentId) || commentId <= 0) {
      return NextResponse.json({ error: 'invalid commentId' }, { status: 400 });
    }

    const body = await req.json();
    const content = (body.content as string | undefined)?.trim();
    const authorEmail = (body.authorEmail as string | undefined)?.trim();

    if (!content) {
      return NextResponse.json(
        { error: 'content is required' },
        { status: 400 }
      );
    }

    if (!authorEmail) {
      return NextResponse.json(
        { error: 'authorEmail is required' },
        { status: 400 }
      );
    }

    const [{ data: demand, error: demandError }, { data: user, error: userError }] =
      await Promise.all([
        supabaseAdmin
          .from('demands')
          .select('id')
          .eq('fields->>code', code)
          .maybeSingle(),
        supabaseAdmin
          .from('users')
          .select('id, email')
          .eq('email', authorEmail)
          .maybeSingle(),
      ]);

    if (demandError) {
      console.error('[api/demands/:id/comments/:commentId] load demand error', demandError);
      return NextResponse.json(
        { error: 'failed to load demand', detail: demandError.message },
        { status: 500 }
      );
    }

    if (!demand) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }

    if (userError || !user) {
      console.error('[api/demands/:id/comments/:commentId] user error', userError);
      return NextResponse.json(
        { error: 'user not found', detail: userError?.message },
        { status: 400 }
      );
    }

    const { data: comment, error: commentError } = await supabaseAdmin
      .from('demand_comments')
      .select('id, demand_id, author_id, is_deleted, created_at')
      .eq('id', commentId)
      .maybeSingle();

    if (commentError) {
      console.error('[api/demands/:id/comments/:commentId] load comment error', commentError);
      return NextResponse.json(
        { error: 'failed to load comment', detail: commentError.message },
        { status: 500 }
      );
    }

    if (!comment || comment.demand_id !== demand.id) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }

    if (comment.is_deleted) {
      return NextResponse.json(
        { error: 'comment already deleted' },
        { status: 400 }
      );
    }

    if (comment.author_id !== user.id) {
      return NextResponse.json(
        { error: 'forbidden: only author can edit this comment at current stage' },
        { status: 403 }
      );
    }

    const createdAt = comment.created_at ? new Date(comment.created_at) : null;
    if (!createdAt || Number.isNaN(createdAt.getTime())) {
      return NextResponse.json(
        { error: 'invalid comment createdAt' },
        { status: 500 }
      );
    }

    const fiveMinutesMs = 5 * 60 * 1000;
    const diffMs = Date.now() - createdAt.getTime();
    if (diffMs > fiveMinutesMs) {
      return NextResponse.json(
        { error: 'edit window has expired' },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabaseAdmin
      .from('demand_comments')
      .update({ content })
      .eq('id', comment.id);

    if (updateError) {
      console.error('[api/demands/:id/comments/:commentId] update error', updateError);
      return NextResponse.json(
        { error: 'failed to update comment', detail: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: any) {
    console.error('[api/demands/:id/comments/:commentId] patch error', error);
    return NextResponse.json(
      {
        error: 'failed to update comment',
        detail: error?.message ?? String(error),
      },
      { status: 500 }
    );
  }
}
