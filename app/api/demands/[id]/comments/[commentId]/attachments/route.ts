import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../../../lib/supabaseAdmin';

export const runtime = 'edge';

interface AttachmentRow {
  id: number;
  file_name: string;
  file_url: string;
  mime_type: string | null;
  size: number | null;
  created_at: string;
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

export async function POST(
  req: NextRequest,
  context: { params: { id: string; commentId: string } }
) {
  try {
    const code = context.params.id;
    const commentIdRaw = context.params.commentId;

    if (!code || !commentIdRaw) {
      return NextResponse.json(
        { error: 'id and commentId are required' },
        { status: 400 }
      );
    }

    const commentId = Number.parseInt(commentIdRaw, 10);
    if (!Number.isFinite(commentId) || commentId <= 0) {
      return NextResponse.json(
        { error: 'invalid commentId' },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file');
    const uploaderEmailRaw = formData.get('uploaderEmail');

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'file is required' },
        { status: 400 }
      );
    }

    const uploaderEmail = typeof uploaderEmailRaw === 'string' ? uploaderEmailRaw.trim() : '';

    if (!uploaderEmail) {
      return NextResponse.json(
        { error: 'uploaderEmail is required' },
        { status: 400 }
      );
    }

    const [demandResult, commentResult, userResult] = await Promise.all([
      supabaseAdmin
        .from('demands')
        .select('id')
        .eq('fields->>code', code)
        .maybeSingle(),
      supabaseAdmin
        .from('demand_comments')
        .select('id, demand_id')
        .eq('id', commentId)
        .maybeSingle(),
      supabaseAdmin
        .from('users')
        .select('id, email')
        .eq('email', uploaderEmail)
        .maybeSingle(),
    ]);

    const { data: demand, error: demandError } = demandResult;
    const { data: comment, error: commentError } = commentResult;
    const { data: user, error: userError } = userResult;

    if (demandError) {
      console.error('[api/demands/:id/comments/:commentId/attachments] load demand error', demandError);
      return NextResponse.json(
        { error: 'failed to load demand', detail: demandError.message },
        { status: 500 }
      );
    }

    if (!demand) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }

    if (commentError) {
      console.error('[api/demands/:id/comments/:commentId/attachments] load comment error', commentError);
      return NextResponse.json(
        { error: 'failed to load comment', detail: commentError.message },
        { status: 500 }
      );
    }

    if (!comment || comment.demand_id !== demand.id) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }

    if (userError || !user) {
      console.error('[api/demands/:id/comments/:commentId/attachments] user error', userError);
      return NextResponse.json(
        { error: 'user not found', detail: userError?.message },
        { status: 400 }
      );
    }

    const bucket = 'demand-attachments';
    const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const path = `comments/${comment.id}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(bucket)
      .upload(path, file, {
        contentType: file.type || undefined,
        upsert: false,
      });

    if (uploadError) {
      console.error('[api/demands/:id/comments/:commentId/attachments] upload error', uploadError);
      return NextResponse.json(
        { error: 'failed to upload attachment', detail: uploadError.message },
        { status: 500 }
      );
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from(bucket)
      .getPublicUrl(path);

    const fileUrl = publicUrlData.publicUrl;

    const { data, error } = await supabaseAdmin
      .from('demand_comment_attachments')
      .insert({
        comment_id: comment.id,
        uploader_id: user.id,
        file_name: file.name,
        file_url: fileUrl,
        mime_type: file.type || null,
        size: typeof file.size === 'number' ? file.size : null,
      })
      .select('id, file_name, file_url, mime_type, size, created_at')
      .maybeSingle();

    if (error || !data) {
      console.error('[api/demands/:id/comments/:commentId/attachments] insert error', error);
      return NextResponse.json(
        {
          error: 'failed to create comment attachment',
          detail: error?.message ?? 'insert failed',
        },
        { status: 500 }
      );
    }

    const attachment = mapAttachmentRow(data as AttachmentRow);

    return NextResponse.json({ attachment }, { status: 201 });
  } catch (error: any) {
    console.error('[api/demands/:id/comments/:commentId/attachments] create error', error);
    return NextResponse.json(
      {
        error: 'failed to create comment attachment',
        detail: error?.message ?? String(error),
      },
      { status: 500 }
    );
  }
}
