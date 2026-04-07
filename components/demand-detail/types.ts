export interface AttachmentItem {
  id: number;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface CommentAttachment {
  id: number;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface DemandComment {
  id: number;
  content: string;
  authorLabel: string;
  authorEmail?: string;
  createdAt: string;
  parentId?: number | null;
  replyToCommentId?: number | null;
  attachments?: CommentAttachment[];
}

export interface MentionUser {
  id: number;
  name: string | null;
  email: string | null;
}

export interface MentionContext {
  type: 'main' | 'reply';
  parentId?: number;
}
