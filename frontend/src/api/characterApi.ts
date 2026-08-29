import type { CharacterCard, CharacterCategory, CharacterLogicMapData } from '../types/character';
import { DEFAULT_CATEGORIES, DEFAULT_CHARACTERS, DEFAULT_LOGIC_MAP } from '../data/defaultCharacters';

const KEY_CATEGORIES_PREFIX = 'NOVELCRAFT_CHAR_CATEGORIES_';
const KEY_CHARACTERS_PREFIX = 'NOVELCRAFT_CHARACTERS_';
const KEY_LOGIC_MAP_PREFIX = 'NOVELCRAFT_CHAR_LOGIC_MAP_';

const STORAGE_API = '/api/storage';

export const characterApi = {
  // 1. 获取分类列表 (优先物理文件，双重缓存)
  getCategories(bookId: string): CharacterCategory[] {
    // 异步尝试从本地物理磁盘拉取最新文件并刷新缓存
    fetch(`${STORAGE_API}/categories?bookId=${bookId}`)
      .then(res => res.ok ? res.json() : null)
      .then(diskList => {
        if (Array.isArray(diskList) && diskList.length > 0) {
          localStorage.setItem(`${KEY_CATEGORIES_PREFIX}${bookId}`, JSON.stringify(diskList));
        }
      })
      .catch(() => {});

    try {
      const raw = localStorage.getItem(`${KEY_CATEGORIES_PREFIX}${bookId}`);
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list) && list.length > 0) return list;
      }
    } catch (e) {}

    const initial = DEFAULT_CATEGORIES.map(c => ({ ...c, bookId }));
    this.saveCategories(bookId, initial);
    return initial;
  },

  // 保存分类列表 (写入本地物理文件 + 写入浏览器镜像)
  saveCategories(bookId: string, list: CharacterCategory[]): void {
    try {
      localStorage.setItem(`${KEY_CATEGORIES_PREFIX}${bookId}`, JSON.stringify(list));
    } catch (e) {}

    // 实时持久化到本地物理文件: data-storage/characters/categories_{bookId}.json
    fetch(`${STORAGE_API}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookId, list })
    }).catch(() => {});
  },

  // 2. 获取人物卡列表 (优先物理文件，双重缓存)
  getCharacters(bookId: string): CharacterCard[] {
    // 异步尝试从本地物理磁盘拉取最新文件并刷新缓存
    fetch(`${STORAGE_API}/characters?bookId=${bookId}`)
      .then(res => res.ok ? res.json() : null)
      .then(diskList => {
        if (Array.isArray(diskList) && diskList.length > 0) {
          localStorage.setItem(`${KEY_CHARACTERS_PREFIX}${bookId}`, JSON.stringify(diskList));
        }
      })
      .catch(() => {});

    try {
      const raw = localStorage.getItem(`${KEY_CHARACTERS_PREFIX}${bookId}`);
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list) && list.length > 0) return list;
      }
    } catch (e) {}

    const initial = DEFAULT_CHARACTERS.map(c => ({ ...c, bookId }));
    this.saveCharacters(bookId, initial);
    return initial;
  },

  // 保存人物卡列表 (写入本地物理文件 + 写入浏览器镜像)
  saveCharacters(bookId: string, list: CharacterCard[]): void {
    try {
      localStorage.setItem(`${KEY_CHARACTERS_PREFIX}${bookId}`, JSON.stringify(list));
    } catch (e) {}

    // 实时持久化到本地物理文件: data-storage/characters/cards_{bookId}.json
    fetch(`${STORAGE_API}/characters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookId, list })
    }).catch(() => {});
  },

  // 3. 获取人物逻辑梳理图数据
  getLogicMap(bookId: string): CharacterLogicMapData {
    fetch(`${STORAGE_API}/logic-map?bookId=${bookId}`)
      .then(res => res.ok ? res.json() : null)
      .then(diskData => {
        if (diskData && Array.isArray(diskData.nodes)) {
          localStorage.setItem(`${KEY_LOGIC_MAP_PREFIX}${bookId}`, JSON.stringify(diskData));
        }
      })
      .catch(() => {});

    try {
      const raw = localStorage.getItem(`${KEY_LOGIC_MAP_PREFIX}${bookId}`);
      if (raw) {
        const data = JSON.parse(raw);
        if (data && Array.isArray(data.nodes)) return data;
      }
    } catch (e) {}

    const initial = { ...DEFAULT_LOGIC_MAP, bookId };
    this.saveLogicMap(bookId, initial);
    return initial;
  },

  // 保存人物逻辑图数据 (写入本地物理文件 + 写入浏览器镜像)
  saveLogicMap(bookId: string, data: CharacterLogicMapData): void {
    try {
      localStorage.setItem(`${KEY_LOGIC_MAP_PREFIX}${bookId}`, JSON.stringify(data));
    } catch (e) {}

    // 实时持久化到本地物理文件: data-storage/characters/logic_map_{bookId}.json
    fetch(`${STORAGE_API}/logic-map`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookId, data })
    }).catch(() => {});
  }
};
