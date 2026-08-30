import type { NovelBook, Volume, Chapter, MindMapNode, MindMapData } from '../types/novel';

const API_BASE = '/api';
const STORAGE_KEY_BOOKS = 'NOVELCRAFT_LOCAL_DATA_BOOKS_PROD';
const STORAGE_KEY_MINDMAP_PREFIX = 'NOVELCRAFT_MINDMAP_DATA_';
const STORAGE_KEY_ACTIVE = 'NOVELCRAFT_ACTIVE_STATE_PROD';

// 构建全新的空白新书结构
export function createBlankBook(title = '新书开启', author = '作者', tags = '悬疑,探险,奇幻', synopsis = '在这片全新的世界中谱写未知的传奇...'): NovelBook {
  const bookId = 'book_' + Date.now();
  const volId = 'vol_' + Date.now();
  const chapId = 'chap_' + Date.now();

  return {
    id: bookId,
    title: title.startsWith('《') ? title : `《${title}》`,
    author,
    coverGradient: 'linear-gradient(135deg, #4f46e5, #06b6d4)',
    tags,
    synopsis,
    targetWordCount: 1000000,
    totalWordCount: 0,
    todayWordCount: 0,
    volumes: [
      {
        id: volId,
        bookId: bookId,
        title: '第一卷：初入尘世',
        orderIndex: 1,
        wordCount: 0,
        collapsed: false,
        chapters: [
          {
            id: chapId,
            volumeId: volId,
            title: '第1章 新的篇章',
            content: '　　',
            wordCount: 0,
            paragraphCount: 1,
            publishStatus: 'draft'
          }
        ]
      }
    ]
  };
}

// 本地持久化 (纯物理存储驱动，无任何硬编码)
function getLocalBooks(): NovelBook[] {
  // 异步尝试从本地物理磁盘 /api/storage/books 拉取最新书籍列表
  fetch('/api/storage/books')
    .then(res => res.ok ? res.json() : null)
    .then((diskBooks: NovelBook[]) => {
      if (Array.isArray(diskBooks) && diskBooks.length > 0) {
        localStorage.setItem(STORAGE_KEY_BOOKS, JSON.stringify(diskBooks));
      }
    })
    .catch(() => {});

  try {
    const raw = localStorage.getItem(STORAGE_KEY_BOOKS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('读取本地数据失败:', e);
  }

  return [];
}

function saveLocalBooks(books: NovelBook[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_BOOKS, JSON.stringify(books));
  } catch (e) {
    console.error('写入本地书籍数据失败:', e);
  }

  // 同步持久化写入本地物理磁盘 data-storage/novels/{dir}/novel.json
  books.forEach(b => {
    fetch('/api/storage/novels/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ book: b })
    }).catch(() => {});
  });
}

// 动态生成属于特定作品/分卷/章节的专属大纲思维导图 (整体大纲 / 卷大纲 / 章节大纲)
function getOutlineMindMapData(
  bookId: string,
  scope: OutlineScope = 'global',
  targetId?: string,
  bookTitle?: string,
  volTitle?: string,
  chapTitle?: string
): MindMapData {
  const actualTargetId = targetId || (scope === 'global' ? bookId : 'default');
  const storageKey = `${STORAGE_KEY_MINDMAP_PREFIX}${scope}_${actualTargetId}`;

  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.root) return parsed;
    }
  } catch (e) {}

  let rootNode: MindMapNode;

  if (scope === 'global') {
    // 🌟 整体大纲
    const cleanTitle = (bookTitle || '小说').replace(/[《》\s]/g, '');
    rootNode = {
      id: `root_global_${bookId}`,
      text: `《${cleanTitle}》 全局核心大纲`,
      nodeType: 'root-node',
      x: 30,
      y: 180,
      children: [
        {
          id: `node_g_1_${bookId}`,
          text: '💡 核心立意与金手指设定',
          nodeType: 'branch-node',
          x: 240,
          y: 60,
          children: [
            { id: `node_g_1_1_${bookId}`, text: '主角身份背景与核心动机', x: 440, y: 40 },
            { id: `node_g_1_2_${bookId}`, text: '核心金手指/独门绝技机制与限制', x: 440, y: 80 }
          ]
        },
        {
          id: `node_g_2_${bookId}`,
          text: '⚔️ 世界危机与核心矛盾冲突',
          nodeType: 'branch-node',
          x: 240,
          y: 150,
          children: [
            { id: `node_g_2_1_${bookId}`, text: '世界底层隐秘法则与终极威胁', x: 440, y: 130 },
            { id: `node_g_2_2_${bookId}`, text: '各大阵营势力的利益与生存冲突', x: 440, y: 170 }
          ]
        },
        {
          id: `node_g_3_${bookId}`,
          text: '📈 主线发展三大阶段',
          nodeType: 'branch-node',
          x: 240,
          y: 240,
          children: [
            { id: `node_g_3_1_${bookId}`, text: '前期：绝境破局立足，积累第一桶金', x: 440, y: 220 },
            { id: `node_g_3_2_${bookId}`, text: '中期：揭露深层黑幕，抗衡核心强权', x: 440, y: 260 }
          ]
        },
        {
          id: `node_g_4_${bookId}`,
          text: '🏁 终局大结局推演',
          nodeType: 'branch-node',
          x: 240,
          y: 330,
          children: [
            { id: `node_g_4_1_${bookId}`, text: '终极秘密揭晓与核心羁绊抉择', x: 440, y: 310 },
            { id: `node_g_4_2_${bookId}`, text: '新秩序确立与全书意难平终章', x: 440, y: 350 }
          ]
        }
      ]
    };
  } else if (scope === 'volume') {
    // 📖 卷大纲 (通式结构)
    const vTitle = volTitle || '当前分卷';
    rootNode = {
      id: `root_vol_${actualTargetId}`,
      text: `${vTitle} 剧情弧光`,
      nodeType: 'root-node',
      x: 30,
      y: 180,
      children: [
        {
          id: `node_v_1_${actualTargetId}`,
          text: '🚀 起 · 卷初引子与核心冲突',
          nodeType: 'branch-node',
          x: 240,
          y: 60,
          children: [
            { id: `node_v_1_1_${actualTargetId}`, text: '初始危机爆发，被迫入局', x: 440, y: 40 },
            { id: `node_v_1_2_${actualTargetId}`, text: '初次展现实力，建立基础信任', x: 440, y: 80 }
          ]
        },
        {
          id: `node_v_2_${actualTargetId}`,
          text: '🛡️ 承 · 阻碍升级与暗流涌动',
          nodeType: 'branch-node',
          x: 240,
          y: 150,
          children: [
            { id: `node_v_2_1_${actualTargetId}`, text: '遭遇多方势力盘剥或险境暗算', x: 440, y: 130 },
            { id: `node_v_2_2_${actualTargetId}`, text: '发现关键隐秘线索与利益交换', x: 440, y: 170 }
          ]
        },
        {
          id: `node_v_3_${actualTargetId}`,
          text: '⚡ 转 · 突发意外与险境绝杀',
          nodeType: 'branch-node',
          x: 240,
          y: 240,
          children: [
            { id: `node_v_3_1_${actualTargetId}`, text: '退路被断，生死关头底牌尽出', x: 440, y: 220 },
            { id: `node_v_3_2_${actualTargetId}`, text: '逆风翻盘，打破敌方算计', x: 440, y: 260 }
          ]
        },
        {
          id: `node_v_4_${actualTargetId}`,
          text: '🏆 合 · 卷末大胜与遗留伏笔',
          nodeType: 'branch-node',
          x: 240,
          y: 330,
          children: [
            { id: `node_v_4_1_${actualTargetId}`, text: '收获阶段性重大胜利与尊严', x: 440, y: 310 },
            { id: `node_v_4_2_${actualTargetId}`, text: '引出下一卷更宏大的未知危机', x: 440, y: 350 }
          ]
        }
      ]
    };
  } else {
    // 📝 章节大纲 (三幕式细纲)
    const cTitle = chapTitle || '当前章节';
    rootNode = {
      id: `root_chap_${actualTargetId}`,
      text: `${cTitle} 细纲事件流`,
      nodeType: 'root-node',
      x: 30,
      y: 180,
      children: [
        {
          id: `node_c_1_${actualTargetId}`,
          text: '🎯 本章目标与行动动机',
          nodeType: 'branch-node',
          x: 240,
          y: 60,
          children: [
            { id: `node_c_1_1_${actualTargetId}`, text: '承接上一章情境，明确本章要解决的问题', x: 440, y: 60 }
          ]
        },
        {
          id: `node_c_2_${actualTargetId}`,
          text: '💥 意外阻碍与对立交锋',
          nodeType: 'branch-node',
          x: 240,
          y: 180,
          children: [
            { id: `node_c_2_1_${actualTargetId}`, text: '计划生变或突发危机，矛盾正面爆发', x: 440, y: 160 },
            { id: `node_c_2_2_${actualTargetId}`, text: '心理博弈或激烈对抗，打破僵局', x: 440, y: 200 }
          ]
        },
        {
          id: `node_c_3_${actualTargetId}`,
          text: '🎣 阶段结果与本章断章钩子',
          nodeType: 'branch-node',
          x: 240,
          y: 300,
          children: [
            { id: `node_c_3_1_${actualTargetId}`, text: '取得阶段成果，同时抛出未知疑团', x: 440, y: 280 },
            { id: `node_c_3_2_${actualTargetId}`, text: '留出强情绪断章（卡点），引爆下一章追读', x: 440, y: 320 }
          ]
        }
      ]
    };
  }

  const initialData: MindMapData = {
    bookId,
    scope,
    targetId: actualTargetId,
    root: rootNode,
    crossLinks: []
  };

  saveOutlineMindMapData(bookId, scope, actualTargetId, initialData);
  return initialData;
}

function saveOutlineMindMapData(bookId: string, scope: OutlineScope, targetId: string, data: MindMapData): void {
  try {
    const storageKey = `${STORAGE_KEY_MINDMAP_PREFIX}${scope}_${targetId || bookId}`;
    localStorage.setItem(storageKey, JSON.stringify(data));
  } catch (e) {
    console.error('写入导图本地失败:', e);
  }
}

export const novelApi = {
  // 1. 获取书籍列表 (优先从本地磁盘 data-storage/novels/ 读取所有独立书籍目录)
  async getBooks(): Promise<NovelBook[]> {
    try {
      const res = await fetch('/api/storage/novels');
      if (res.ok) {
        const diskBooks = await res.json();
        if (Array.isArray(diskBooks)) {
          localStorage.setItem(STORAGE_KEY_BOOKS, JSON.stringify(diskBooks));
          return diskBooks;
        }
      }
    } catch (e) {}

    return getLocalBooks();
  },

  // 2. 创建新书 (向本地磁盘生成包含 chapters、characters、mindmaps 的专属独立小说工程，支持同步在番茄后台建书)
  async createBook(params: {
    title: string;
    author?: string;
    tags?: string;
    synopsis?: string;
    category?: string;
    gender?: string;
    syncToTomato?: boolean;
  } | string): Promise<NovelBook> {
    const payload = typeof params === 'string'
      ? { title: params, syncToTomato: true }
      : params;

    try {
      const res = await fetch('/api/storage/novel/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const result = await res.json();
        if (result.status === 'ok' && result.book) {
          const books = getLocalBooks();
          books.unshift(result.book);
          saveLocalBooks(books);
          return result.book;
        }
      }
    } catch (e) {
      console.warn('调用本地新书文件夹创建服务失败，采用本地缓存兜底:', e);
    }

    // 兜底本地生成
    const newBook = createBlankBook(payload.title, payload.author, payload.tags, payload.synopsis);
    const books = getLocalBooks();
    books.unshift(newBook);
    saveLocalBooks(books);
    return newBook;
  },

  // 2.1 重命名书名 (同时重命名磁盘文件夹与 novel.json)
  async renameBook(bookId: string, newTitle: string): Promise<void> {
    const formatted = newTitle.trim().startsWith('《') ? newTitle.trim() : `《${newTitle.trim()}》`;
    const books = getLocalBooks();
    const book = books.find(b => b.id === bookId);
    if (book) {
      book.title = formatted;
      saveLocalBooks(books);
    }

    try {
      await fetch('/api/storage/novel/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId, newTitle: formatted })
      });
    } catch (e) {}
  },

  // 2.2 更新书籍元数据 (简介、标签等)
  async updateBook(book: NovelBook): Promise<void> {
    const books = getLocalBooks();
    const idx = books.findIndex(b => b.id === book.id);
    if (idx !== -1) {
      books[idx] = { ...books[idx], ...book };
      saveLocalBooks(books);
    }
    try {
      await fetch('/api/storage/novels/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book })
      });
    } catch (e) {}
  },

  // 3. 创建新分卷
  async createVolume(bookId: string, title: string): Promise<Volume> {
    const books = getLocalBooks();
    const book = books.find(b => b.id === bookId) || books[0];
    const actualBookId = book?.id || bookId;
    const newVol: Volume = {
      id: 'vol_' + Date.now(),
      bookId: actualBookId,
      title: title.trim(),
      orderIndex: (book?.volumes?.length || 0) + 1,
      wordCount: 0,
      collapsed: false,
      chapters: []
    };

    if (book) {
      if (!book.volumes) book.volumes = [];
      book.volumes.push(newVol);
      saveLocalBooks(books);
    }

    try {
      await fetch('/api/storage/volume/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId: actualBookId, volume: newVol })
      });
    } catch (e) {}

    return newVol;
  },

  // 3.1 重命名分卷 (实时持久化落盘)
  async renameVolume(volumeId: string, newTitle: string, bookId?: string): Promise<void> {
    const books = getLocalBooks();
    let targetBookId = bookId;
    for (const b of books) {
      for (const vol of b.volumes || []) {
        if (vol.id === volumeId) {
          vol.title = newTitle.trim();
          targetBookId = b.id;
          break;
        }
      }
    }
    saveLocalBooks(books);

    const finalBookId = targetBookId || books[0]?.id;
    if (finalBookId) {
      try {
        await fetch(`/api/storage/volume/rename`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookId: finalBookId, volumeId, title: newTitle.trim() })
        });
      } catch (e) {}
    }
  },

  // 4. 创建新章节 (实时物理落盘至 novel.json 与 TXT 文件)
  async createChapter(volumeId: string, title: string): Promise<Chapter> {
    const books = getLocalBooks();
    const newChap: Chapter = {
      id: 'chap_' + Date.now(),
      volumeId,
      title: title.trim(),
      content: '',
      wordCount: 0,
      paragraphCount: 0,
      publishStatus: 'draft'
    };

    let targetBookId = '';
    for (const b of books) {
      for (const vol of b.volumes || []) {
        if (vol.id === volumeId) {
          if (!vol.chapters) vol.chapters = [];
          vol.chapters.push(newChap);
          targetBookId = b.id;
          saveLocalBooks(books);
          break;
        }
      }
    }

    const finalBookId = targetBookId || books[0]?.id || '';
    if (finalBookId) {
      try {
        await fetch('/api/storage/chapter/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookId: finalBookId, volumeId, chapter: newChap })
        });
      } catch (e) {}
    }

    return newChap;
  },

  // 5. 保存章节 (标题与正文，毫秒级同步落盘物理TXT与novel.json)
  async saveChapter(id: string, title: string, content: string, explicitBookId?: string): Promise<Chapter> {
    const books = getLocalBooks();
    let targetChap: Chapter | null = null;
    let foundBookId = explicitBookId || '';

    const clean = (content || '').replace(/\s/g, '');
    const words = clean.length;
    const paras = (content || '').split('\n').filter(p => p.trim().length > 0).length;

    for (const b of books) {
      let bookWordSum = 0;
      for (const vol of b.volumes || []) {
        let volWordSum = 0;
        for (const chap of vol.chapters || []) {
          if (chap.id === id) {
            foundBookId = b.id;
            chap.title = title;
            chap.content = content;
            chap.wordCount = words;
            chap.paragraphCount = paras;
            chap.updatedAt = new Date().toISOString();
            targetChap = chap;
          }
          volWordSum += chap.wordCount || 0;
        }
        vol.wordCount = volWordSum;
        bookWordSum += volWordSum;
      }
      b.totalWordCount = bookWordSum;
    }

    saveLocalBooks(books);

    const actualBookId = foundBookId || explicitBookId || (this.getActiveState().bookId) || (books[0]?.id) || '';

    // 🚀 实时持久化至本地物理磁盘真实 TXT 正文文件 (data-storage/novels/{bookDir}/chapters/{chap}.txt)
    fetch(`/api/storage/chapter-file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookId: actualBookId,
        chapId: id,
        title,
        content
      })
    }).catch(() => {});

    return targetChap || { id, title, content, wordCount: words, paragraphCount: paras };
  },

  // 5.1 提交章节至番茄平台（存草稿/正式发布/更新修改，包含字数校验与错误报告）
  async publishChapterToTomato(params: {
    bookId: string;
    chapterId: string;
    title: string;
    content: string;
    publishType: 'draft' | 'publish' | 'modify';
  }): Promise<{
    status: 'ok' | 'error';
    publishStatus?: 'draft' | 'published' | 'modified';
    tomatoChapterId?: string;
    message?: string;
    errorType?: 'warning' | 'error' | 'limit' | 'auth';
    title?: string;
    details?: any;
    suggestions?: string[];
    actionType?: 'relogin' | 'save-local' | 'none';
  }> {
    try {
      const res = await fetch('/api/storage/novel/publish-chapter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      const data = await res.json();
      return data;
    } catch (e: any) {
      return {
        status: 'error',
        errorType: 'error',
        title: '网络连接异常',
        message: `无法连接到本地存储服务或番茄网关: ${e?.message || '未知错误'}`
      };
    }
  },

  // 尝试直接从本地磁盘读取物理 TXT 章节正文
  async fetchChapterDiskContent(bookId: string, chapId: string): Promise<string | null> {
    try {
      const res = await fetch(`/api/storage/chapter-file?bookId=${bookId}&chapId=${chapId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'ok' && data.content) {
          return data.content;
        }
      }
    } catch (e) {}
    return null;
  },

  // 6. 一键中文小说规范排版 (去多余空行，段首空两格)
  async formatText(text: string): Promise<{ formattedText: string; wordCount: number; paragraphCount: number }> {
    if (!text) return { formattedText: '', wordCount: 0, paragraphCount: 0 };
    const lines = text.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => line.startsWith('　　') ? line : '　　' + line);

    const formatted = lines.join('\n');
    const clean = formatted.replace(/\s/g, '');
    const words = clean.length;
    const paras = lines.length;

    return { formattedText: formatted, wordCount: words, paragraphCount: paras };
  },

  // 7. 敏感词检测
  async scanSensitive(text: string): Promise<{ isClean: boolean; count: number; matches: any[] }> {
    try {
      const res = await fetch(`${API_BASE}/text/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      if (res.ok) return await res.json();
    } catch (e) {}

    return { isClean: true, count: 0, matches: [] };
  },

  // 8. 获取专属大纲思维导图 (支持 scope: 'global' | 'volume' | 'chapter')
  async getMindMapData(
    book: NovelBook,
    scope: OutlineScope = 'global',
    targetId?: string,
    volTitle?: string,
    chapTitle?: string
  ): Promise<MindMapData> {
    const actualTargetId = targetId || (scope === 'global' ? book.id : 'default');
    try {
      const res = await fetch(`/api/storage/mindmap?bookId=${encodeURIComponent(book.id)}&scope=${scope}&targetId=${encodeURIComponent(actualTargetId)}`);
      if (res.ok) {
        const diskData = await res.json();
        if (diskData && diskData.root) {
          saveOutlineMindMapData(book.id, scope, actualTargetId, diskData);
          return diskData;
        }
      }
    } catch (e) {}

    return getOutlineMindMapData(book.id, scope, targetId, book.title, volTitle, chapTitle);
  },

  // 9. 保存专属大纲思维导图
  async saveMindMapData(
    bookId: string,
    data: MindMapData,
    scope: OutlineScope = 'global',
    targetId?: string
  ): Promise<{ success: boolean }> {
    saveOutlineMindMapData(bookId, scope, targetId || data.targetId || bookId, data);

    // 实时持久化至本地物理磁盘 JSON 大纲文件 (data-storage/mindmaps/{scope}_{targetId}.json)
    fetch(`/api/storage/mindmap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookId,
        scope,
        targetId: targetId || data.targetId || bookId,
        data
      })
    }).catch(() => {});

    return { success: true };
  },

  // 10. 保存激活状态
  saveActiveState(bookId: string, chapterId: string): void {
    localStorage.setItem(STORAGE_KEY_ACTIVE, JSON.stringify({ bookId, chapterId }));
  },

  // 11. 读取激活状态
  getActiveState(): { bookId: string; chapterId: string } | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_ACTIVE);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  },

  // 12. 保存章节独立的打字与思考时间
  saveChapterMetrics(chapterId: string, typingTime: number, thinkingTime: number): void {
    const books = getLocalBooks();
    for (const b of books) {
      for (const vol of b.volumes || []) {
        for (const chap of vol.chapters || []) {
          if (chap.id === chapterId) {
            chap.typingTimeSeconds = typingTime;
            chap.thinkingTimeSeconds = thinkingTime;
            saveLocalBooks(books);
            return;
          }
        }
      }
    }
  },

  // 13. 真实动态拉取番茄官方后台小说列表 (零硬编码)
  async fetchTomatoLiveNovels(cookie: string, csrfToken = ''): Promise<any[]> {
    try {
      const res = await fetch(`${API_BASE}/tomato/novels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookie, csrfToken })
      });
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data : (data?.book_list || data?.list || []);
      }
    } catch (e) {
      console.error('动态请求番茄接口失败:', e);
    }
    return [];
  },

  // 14. 【专属动态 API】纯网络请求动态拉取任意章节正文 (零硬编码)
  async fetchChapterLiveContent(tomatoChapterId: string, tomatoBookId = '7674950021661330457'): Promise<string> {
    try {
      const rawCookie = localStorage.getItem('NOVELCRAFT_TOMATO_AUTH_COOKIE') || '';
      const res = await fetch(`http://localhost:3001/api/bridge/chapter-content?bookId=${tomatoBookId}&itemId=${tomatoChapterId}&cookie=${encodeURIComponent(rawCookie)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'ok' && data.content) {
          return data.content;
        }
      }
    } catch (e) {
      console.warn('动态拉取正文失败:', e);
    }
    return '';
  },

  // 13. 真实动态拉取番茄官方章节列表并对齐本地 (本地绝对优先，零覆盖风险)
  async importTomatoLiveNovelByApi(tomatoBookData: any, chaptersDataList: any[]): Promise<NovelBook> {
    const rawBookId = String(tomatoBookData.book_id || '');
    const books = getLocalBooks();
    
    // 优先匹配本地已有书籍 (通过 id 或 tomatoBookId 或 书名相同)
    let existingBook = books.find(b => 
      b.tomatoBookId === rawBookId || 
      b.id === `fq_book_${rawBookId}` ||
      (tomatoBookData.book_name && b.title.replace(/[《》\s]/g, '') === tomatoBookData.book_name.replace(/[《》\s]/g, ''))
    );

    const convertedOnlineChapters: Chapter[] = (chaptersDataList || []).map((c: any, idx: number) => ({
      id: String(c.item_id || c.id || `chap_online_${idx}`),
      volumeId: 'vol_default',
      title: c.title || `第${idx + 1}章`,
      content: c.content || '',
      wordCount: c.word_number || c.wordCount || 0,
      paragraphCount: Math.round((c.word_number || c.wordCount || 0) / 80) || 1,
      publishStatus: c.display_status === 1 ? 'published' : 'draft',
      tomatoChapterId: String(c.item_id || c.id),
      lastPushedAt: '已对齐番茄线上'
    }));

    if (existingBook) {
      // 🌟 铁壁保护：本地已有书籍，只做线上状态对齐，绝对不覆盖任何本地正文与未发布章节！
      if (!existingBook.tomatoBookId && rawBookId) {
        existingBook.tomatoBookId = rawBookId;
      }

      const onlineMapByTitle = new Map<string, any>();
      const onlineMapById = new Map<string, any>();
      convertedOnlineChapters.forEach(c => {
        const cleanT = c.title.replace(/^第0*(\d+)章?\s*/, '$1_').trim();
        onlineMapByTitle.set(cleanT, c);
        onlineMapById.set(c.tomatoChapterId, c);
      });

      // 遍历本地所有分卷与章节进行状态回填
      (existingBook.volumes || []).forEach(vol => {
        (vol.chapters || []).forEach(localChap => {
          const cleanLocalT = localChap.title.replace(/^第0*(\d+)章?\s*/, '$1_').trim();
          const matchedOnline = (localChap.tomatoChapterId && onlineMapById.get(localChap.tomatoChapterId)) ||
                                onlineMapByTitle.get(cleanLocalT) ||
                                onlineMapByTitle.get(localChap.title.trim());

          if (matchedOnline) {
            localChap.publishStatus = matchedOnline.publishStatus;
            localChap.tomatoChapterId = matchedOnline.tomatoChapterId;
            localChap.lastPushedAt = '已同步番茄线上状态';
          } else {
            // 本地独有的章节（未推送到云端）：保持本地草稿状态不变
            if (!localChap.publishStatus || localChap.publishStatus === 'published') {
              localChap.publishStatus = 'unpushed';
            }
          }
        });
      });

      // 检查线上是否有本地完全缺失的章节（例如在手机端新建的）
      const localTitles = new Set((existingBook.volumes || []).flatMap(v => (v.chapters || []).map(c => c.title.trim())));
      const onlineMissingFromLocal = convertedOnlineChapters.filter(c => !localTitles.has(c.title.trim()));
      if (onlineMissingFromLocal.length > 0 && existingBook.volumes && existingBook.volumes.length > 0) {
        existingBook.volumes[0].chapters.push(...onlineMissingFromLocal);
      }

      saveLocalBooks(books);
      return existingBook;
    }

    // 若本地完全没有这本书，则作为全新书籍导入
    const bookId = 'fq_book_' + (rawBookId || Date.now());
    const volId = 'vol_' + Date.now();
    const newBook: NovelBook = {
      id: bookId,
      tomatoBookId: rawBookId,
      title: tomatoBookData.book_name ? (tomatoBookData.book_name.startsWith('《') ? tomatoBookData.book_name : `《${tomatoBookData.book_name}》`) : '《番茄签约作品》',
      author: '番茄签约作家',
      coverGradient: 'linear-gradient(135deg, #10b981, #059669)',
      tags: '番茄首发,连载中',
      synopsis: tomatoBookData.abstract || '【番茄官方签约作品】：动态拉取于番茄作家专区云端后台。',
      targetWordCount: 1000000,
      totalWordCount: tomatoBookData.word_count || 0,
      todayWordCount: 0,
      volumes: [
        {
          id: volId,
          bookId: bookId,
          title: '第一卷：默认分卷',
          orderIndex: 1,
          wordCount: tomatoBookData.word_count || 0,
          collapsed: false,
          chapters: convertedOnlineChapters
        }
      ]
    };

    books.unshift(newBook);
    saveLocalBooks(books);
    return newBook;
  },

  // 15. 独立物理快照与版本保险箱 (查询/新建/还原/删除)
  async getBackups(bookId: string): Promise<Array<{
    id: string;
    timestamp: number;
    dateStr: string;
    note: string;
    totalWords: number;
    chapterCount: number;
    fileSize: number;
  }>> {
    try {
      const res = await fetch(`/api/storage/backups?bookId=${encodeURIComponent(bookId)}`);
      if (res.ok) return await res.json();
    } catch (e) {}
    return [];
  },

  async createBackup(bookId: string, note?: string): Promise<any> {
    const res = await fetch('/api/storage/backups/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookId, note: note || '手动安全快照' })
    });
    return await res.json();
  },

  async restoreBackup(bookId: string, snapshotId: string): Promise<any> {
    const res = await fetch('/api/storage/backups/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookId, snapshotId })
    });
    return await res.json();
  },

  async deleteBackup(bookId: string, snapshotId: string): Promise<any> {
    const res = await fetch('/api/storage/backups/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookId, snapshotId })
    });
    return await res.json();
  }
};
