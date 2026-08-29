export type ForeshadowStatus = 'pending' | 'resolved' | 'abandoned';

export type ForeshadowCategory = '主线反转' | '身世之谜' | '关键信物' | '世界法则' | '生死危机' | '暗线细节' | '其他';

export interface ForeshadowItem {
  id: string;
  bookId: string;
  title: string;                 // 伏笔标题 / 核心线索名
  content: string;               // 伏笔具体内容 / 设计意图
  status: ForeshadowStatus;      // 状态: pending(待回收) | resolved(已回收) | abandoned(搁置)
  category: ForeshadowCategory;  // 伏笔类别
  priority: 'high' | 'medium' | 'low'; // 重要程度

  // 1. 埋设位置 (Planting Info)
  plantChapterId: string;        // 埋设章节 ID
  plantChapterTitle: string;     // 埋设章节名称 (例如: "第1章 罐笼夜升")
  plantParagraphIndex?: number;  // 埋设段落编号 (第X段，从1开始)
  plantQuoteText?: string;       // 埋设段落摘录原文

  // 2. 回收位置 (Resolving Info)
  resolveChapterId?: string;       // 回收章节 ID
  resolveChapterTitle?: string;   // 回收章节名称 (例如: "第10章 第七生铁锚")
  resolveParagraphIndex?: number; // 回收段落编号
  resolveQuoteText?: string;      // 回收段落摘录原文
  resolveNote?: string;           // 回收揭秘说明 / 反转效果说明
  resolvedAt?: string;            // 回收完成时间

  createdAt: string;
  updatedAt: string;
}

export interface ForeshadowStats {
  total: number;
  pending: number;
  resolved: number;
  abandoned: number;
  resolveRate: number; // 回收率百分比 0~100
}
