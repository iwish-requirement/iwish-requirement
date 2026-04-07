import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';

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
      console.error('[api/demands/:id/attachments] load demand error', demandError);
      return NextResponse.json(
        { error: 'failed to load demand', detail: demandError.message },
        { status: 500 }
      );
    }

    if (!demand) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }

    const { data: rows, error: attachmentsError } = await supabaseAdmin
      .from('demand_attachments')
      .select('id, file_name, file_url, mime_type, size, created_at')
      .eq('demand_id', demand.id)
      .order('created_at', { ascending: false });

    if (attachmentsError) {
      console.error('[api/demands/:id/attachments] query error', attachmentsError);
      return NextResponse.json(
        { error: 'failed to load attachments', detail: attachmentsError.message },
        { status: 500 }
      );
    }

    const attachmentsRows: AttachmentRow[] = (rows as AttachmentRow[]) || [];
    const attachments = attachmentsRows.map(mapAttachmentRow);

    return NextResponse.json({ attachments });
  } catch (error: any) {
    console.error('[api/demands/:id/attachments] error', error);
    return NextResponse.json(
      {
        error: 'failed to load attachments',
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

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const uploaderEmailRaw = formData.get('uploaderEmail');

    // 在 Edge Runtime 环境下，不同执行上下文中的 File 可能导致 instanceof 判断失效
    // 这里仅检查字段是否存在，具体类型交由存储 SDK 再做验证
    if (!file) {
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
          .eq('email', uploaderEmail)
          .maybeSingle(),
      ]);

    if (demandError) {
      console.error('[api/demands/:id/attachments] load demand error', demandError);
      return NextResponse.json(
        { error: 'failed to load demand', detail: demandError.message },
        { status: 500 }
      );
    }

    if (!demand) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }

    if (userError || !user) {
      console.error('[api/demands/:id/attachments] user error', userError);
      return NextResponse.json(
        { error: 'user not found', detail: userError?.message },
        { status: 400 }
      );
    }

    const bucket = 'demand-attachments';
    const extension = file.name.includes('.')
      ? file.name.substring(file.name.lastIndexOf('.'))
      : '';
    const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const path = `${code}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(bucket)
      .upload(path, file, {
        contentType: file.type || undefined,
        upsert: false,
      });

    if (uploadError) {
      console.error('[api/demands/:id/attachments] upload error', uploadError);
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
      .from('demand_attachments')
      .insert({
        demand_id: demand.id,
        uploader_id: user.id,
        file_name: file.name,
        file_url: fileUrl,
        mime_type: file.type || null,
        size: typeof file.size === 'number' ? file.size : null,
      })
      .select('id, file_name, file_url, mime_type, size, created_at')
      .maybeSingle();

    if (error || !data) {
      console.error('[api/demands/:id/attachments] insert error', error);
      return NextResponse.json(
        {
          error: 'failed to create attachment',
          detail: error?.message ?? 'insert failed',
        },
        { status: 500 }
      );
    }

    const attachment = mapAttachmentRow(data as AttachmentRow);

    return NextResponse.json({ attachment }, { status: 201 });
  } catch (error: any) {
    console.error('[api/demands/:id/attachments] create error', error);
    return NextResponse.json(
      {
        error: 'failed to create attachment',
        detail: error?.message ?? String(error),
      },
      { status: 500 }
    );
  }
}
