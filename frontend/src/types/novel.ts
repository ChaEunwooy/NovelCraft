export type PublishStatus = 'published' | 'draft' | 'unpushed' | 'modified';

export interface Chapter {
  id: string;
  volumeId?: string;
  title: string;
  content: string;
  wordCount: number;
  paragraphCount: number;
  typingTimeSeconds?: number;
  thinkingTimeSeconds?: number;
  metricsDate?: string;
  publishStatus?: PublishStatus;
  tomatoChapterId?: string;
  lastPushedAt?: string;
  status?: number;
  orderIndex?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Volume {
  id: string;
  bookId: string;
  title: string;
  orderIndex: number;
  wordCount: number;
  collapsed?: boolean;
  tomatoVolumeId?: string;
  chapters: Chapter[];
}

export interface NovelBook {
  id: string;
  title: string;
  author?: string;
  coverGradient?: string;
  tags?: string;
  synopsis?: string;
  targetWordCount: number;
  totalWordCount: number;
  todayWordCount: number;
  tomatoBookId?: string;
  tomatoBookTitle?: string;
  volumes: Volume[];
}

export type OutlineScope = 'global' | 'volume' | 'chapter';

export interface MindMapNode {
  id: string;
  text: string;
  nodeType?: string;
  x: number;
  y: number;
  tag?: string;
  description?: string;
  relatedChapterId?: string;
  children?: MindMapNode[];
}

export interface CrossLink {
  id: string;
  fromId: string;
  toId: string;
  label: string;
}

export interface MindMapData {
  bookId: string;
  scope?: OutlineScope;
  targetId?: string; // 书ID / 卷ID / 章节ID
  root: MindMapNode;
  crossLinks: CrossLink[];
}

export interface TomatoAccountItem {
  id: string;
  authorName: string;
  authorId: string;
  phone?: string;
  sessionToken?: string;
  avatarIcon?: string;
  loginTime: string;
}

export interface TomatoMultiAccountState {
  accounts: TomatoAccountItem[];
  activeAccountId: string;
}
