import type { ForeshadowItem, ForeshadowStats } from '../types/foreshadow';
import { DEFAULT_FORESHADOWS } from '../data/defaultForeshadows';

const KEY_FORESHADOW_PREFIX = 'NOVELCRAFT_FORESHADOWS_V1_';
const STORAGE_API = '/api/storage';

export const foreshadowApi = {
  // 1. 异步从本地物理存储 (data-storage/novels/{bookDir}/foreshadows/items.json) 加载专属伏笔列表
  async fetchForeshadows(bookId: string): Promise<ForeshadowItem[]> {
    if (!bookId) return [];
    try {
      const res = await fetch(`${STORAGE_API}/foreshadows?bookId=${encodeURIComponent(bookId)}`);
      if (res.ok) {
        const diskList = await res.json();
        if (Array.isArray(diskList)) {
          localStorage.setItem(`${KEY_FORESHADOW_PREFIX}${bookId}`, JSON.stringify(diskList));
          return diskList;
        }
      }
    } catch (e) {
      console.warn('[ForeshadowApi] 从物理磁盘拉取伏笔数据失败:', e);
    }
    return this.getForeshadows(bookId);
  },

  // 2. 同步读取缓存数据（严格单书隔离，严禁向新书混入其他书的示范数据）
  getForeshadows(bookId: string): ForeshadowItem[] {
    if (!bookId) return [];
    try {
      const raw = localStorage.getItem(`${KEY_FORESHADOW_PREFIX}${bookId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('[ForeshadowApi] 读取本地伏笔缓存失败:', e);
    }
    return [];
  },

  // 3. 实时保存伏笔列表至物理磁盘 data-storage/novels/{bookDir}/foreshadows/items.json
  saveForeshadows(bookId: string, list: ForeshadowItem[]): void {
    if (!bookId) return;
    try {
      localStorage.setItem(`${KEY_FORESHADOW_PREFIX}${bookId}`, JSON.stringify(list || []));
    } catch (e) {
      console.error('[ForeshadowApi] 写入伏笔缓存失败:', e);
    }

    // 实时持久化到后端物理存储
    fetch(`${STORAGE_API}/foreshadows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookId, list: list || [] })
    }).catch(() => {});
  },

  // 计算统计指标
  calcStats(list: ForeshadowItem[]): ForeshadowStats {
    const total = list.length;
    const pending = list.filter(i => i.status === 'pending').length;
    const resolved = list.filter(i => i.status === 'resolved').length;
    const abandoned = list.filter(i => i.status === 'abandoned').length;
    const resolveRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

    return { total, pending, resolved, abandoned, resolveRate };
  }
};
