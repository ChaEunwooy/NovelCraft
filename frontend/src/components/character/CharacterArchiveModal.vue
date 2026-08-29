<template>
  <div v-if="isOpen" class="archive-modal-backdrop" @click.self="close">
    <div class="archive-modal-window">
      <!-- 弹窗顶栏 (标题 + 模式切换器 + 关闭按钮) -->
      <div class="archive-window-header">
        <div class="header-left">
          <span class="window-icon">👥</span>
          <span class="window-title">人物卡仓库与逻辑推演中枢</span>
          <span class="book-name-tag">{{ currentBookTitle }}</span>
        </div>

        <!-- 模式切换器：[ 📇 人物图鉴档案库 ] [ 🕸️ 人物逻辑梳理图 ] -->
        <div class="archive-view-switcher">
          <button
            class="view-switch-btn"
            :class="{ active: currentView === 'cards' }"
            @click="currentView = 'cards'"
          >
            📇 人物图鉴档案库
          </button>
          <button
            class="view-switch-btn"
            :class="{ active: currentView === 'logic' }"
            @click="currentView = 'logic'"
          >
            🕸️ 人物逻辑梳理图
          </button>
        </div>

        <div class="header-right">
          <button class="window-close-btn" @click="close" title="关闭窗口 (Esc)">✕</button>
        </div>
      </div>

      <!-- 视图 1：人物图鉴档案库 (左侧分类 + 右侧档案卡瀑布流) -->
      <div v-if="currentView === 'cards'" class="archive-cards-layout">
        <!-- 左侧分类侧边栏 -->
        <aside class="category-sidebar">
          <div class="category-header">
            <span class="cat-title">📁 人物阵营分类</span>
            <button class="add-cat-btn" @click="startCreateCategory" title="创建新分类">+ 新分类</button>
          </div>

          <!-- 原地创建分类输入框 -->
          <div v-if="isCreatingCategory" class="inline-cat-input-box">
            <input
              ref="catInputRef"
              v-model="newCategoryName"
              class="inline-cat-input"
              placeholder="分类名敲回车..."
              @keydown.enter="confirmCreateCategory"
              @keydown.esc="isCreatingCategory = false"
              @blur="confirmCreateCategory"
            />
          </div>

          <!-- 分类列表 -->
          <div class="category-list">
            <div
              class="category-item"
              :class="{ active: selectedCategoryId === 'ALL' }"
              @click="selectedCategoryId = 'ALL'"
            >
              <span class="cat-name">📋 全部角色</span>
              <span class="cat-count">{{ characters.length }}</span>
            </div>

            <div
              v-for="cat in categories"
              :key="cat.id"
              class="category-item"
              :class="{ active: selectedCategoryId === cat.id }"
              @click="selectedCategoryId = cat.id"
            >
              <span class="cat-name">{{ cat.name }}</span>
              <span class="cat-count">{{ getCategoryCount(cat.id) }}</span>
              <button
                class="del-cat-x"
                @click.stop="deleteCategory(cat.id)"
                title="删除分类"
              >
                ✕
              </button>
            </div>
          </div>
        </aside>

        <!-- 右侧人物卡展示区 -->
        <main class="cards-main-content">
          <!-- 顶部筛选与新建操作栏 -->
          <div class="cards-action-bar">
            <div class="action-left">
              <span class="current-cat-label">
                {{ selectedCategoryName }}
              </span>
              <span class="char-count-pill">{{ filteredCharacters.length }} 位建档角色</span>
            </div>

            <div class="action-right">
              <input
                v-model="searchKeyword"
                class="search-input"
                placeholder="🔍 搜索姓名/特征标签/身份..."
              />
              <button class="add-card-btn" @click="createNewCharacter">
                + 在本分类新建人物卡
              </button>
            </div>
          </div>

          <!-- 人物卡瀑布流网格 (100% 还原用户参考图设计排版，区域文字滑动浏览) -->
          <div class="cards-grid">
            <div
              v-for="(char, idx) in filteredCharacters"
              :key="char.id"
              class="mini-paper-card"
              :class="{
                'is-dragging': draggedCardId === char.id,
                'is-drag-over': dragOverCardId === char.id
              }"
              :draggable="true"
              @dragstart="onCardDragStart($event, char)"
              @dragover.prevent="onCardDragOver($event, char)"
              @dragleave="onCardDragLeave($event, char)"
              @drop="onCardDrop($event, char)"
              @dragend="onCardDragEnd"
              @contextmenu="onCardContextMenu"
              @click="handleCardClick(char)"
              title="💡 单击编辑档案 / 按住拖拽自由排序"
            >
              <!-- 顶部编号、印章与删除键 -->
              <div class="mini-top-row">
                <span class="mini-drag-handle" title="按住拖动自由排序">⠿ 拖动</span>
                <span class="mini-archive-no">{{ char.archiveNo }}</span>
                <span class="mini-stamp-badge">{{ char.stampText }}</span>
                <button
                  class="mini-card-delete-btn"
                  @click.stop="confirmDeleteCharacter(char)"
                  title="删除此人物卡档案"
                >
                  🗑️
                </button>
              </div>

              <!-- 姓名与身份 -->
              <div class="mini-identity-row">
                <div class="mini-name-box">
                  <span class="mini-hero-name">{{ char.name }}</span>
                  <span class="mini-subtitle">{{ char.subtitle }}</span>
                </div>
                <div class="mini-identity-badge">{{ char.identityBadge }}</div>
              </div>

              <!-- 核心属性板块 (区域文字 Taretext 容器，支持垂直滑动浏览全部) -->
              <div class="mini-sections-preview">
                <div
                  v-for="(sec, sIdx) in char.sections"
                  :key="sIdx"
                  class="mini-sec-box"
                >
                  <div class="mini-sec-title">
                    <span class="mini-red-bar"></span>
                    <span>{{ sec.title }}</span>
                  </div>

                  <!-- 区域文字容器：支持滚动滑动浏览全部文字，绝不穿框 -->
                  <div class="mini-taretext-area" @click.stop>
                    <div
                      v-for="(field, fIdx) in sec.fields"
                      :key="fIdx"
                      class="mini-field-row"
                    >
                      <span class="field-k">{{ field.label }}：</span>
                      <span class="field-v">{{ field.value }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 生活习性与行事风格胶囊标签 -->
              <div class="mini-tags-row">
                <span
                  v-for="(tag, tIdx) in char.tags.slice(0, 5)"
                  :key="tIdx"
                  class="mini-capsule-tag"
                >
                  {{ tag }}
                </span>
                <span v-if="char.tags.length > 5" class="mini-tag-more">+{{ char.tags.length - 5 }}</span>
              </div>

              <!-- 随身信物 (可滑动区域文字) -->
              <div class="mini-token-box">
                <span class="token-prefix">🎒 信物：</span>
                <div class="token-scroll-area">
                  <span class="token-desc">{{ char.tokenBelongings }}</span>
                </div>
              </div>

              <!-- 底部名言金句 (可滑动区域文字) -->
              <div class="mini-quote-box">
                <div class="quote-scroll-area">
                  <p class="mini-quote-text">“{{ char.quoteText }}”</p>
                </div>
                <span class="mini-quote-sub">{{ char.quoteSource }}</span>
              </div>

              <!-- 悬停放大编辑悬浮提示胶囊 -->
              <div class="card-hover-mask">
                <span class="mask-hint">✏️ 单击进入编辑框架</span>
              </div>
            </div>
          </div>
        </main>
      </div>

      <!-- 视图 2：人物逻辑梳理图 (画布视图) -->
      <div v-else class="archive-logic-layout">
        <CharacterRelationCanvas
          :book-id="currentBookId"
          :all-characters="characters"
          :logic-map-data="logicMapData"
          @update-logic-map="onUpdateLogicMap"
          @open-character-detail="openCardDetailById"
        />
      </div>

      <!-- 单击放大的超高清沉浸编辑模态框 (Hero Modal，所有区域直接编辑并带删除键) -->
      <CharacterCardDetailModal
        :is-open="isDetailModalOpen"
        :character="activeDetailCharacter"
        :has-prev="currentDetailIndex > 0"
        :has-next="currentDetailIndex < filteredCharacters.length - 1"
        @close="isDetailModalOpen = false"
        @prev="navigateDetail(-1)"
        @next="navigateDetail(1)"
        @save="onSaveCharacter"
        @delete="deleteCharacterById"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue';
import type { CharacterCard, CharacterCategory, CharacterLogicMapData } from '../../types/character';
import { characterApi } from '../../api/characterApi';
import CharacterCardDetailModal from './CharacterCardDetailModal.vue';
import CharacterRelationCanvas from './CharacterRelationCanvas.vue';

const props = defineProps<{
  isOpen: boolean;
  bookId?: string;
  bookTitle?: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const currentBookId = computed(() => props.bookId || 'book_1787729153499');
const currentBookTitle = computed(() => props.bookTitle || '《别听地脉：我在秦岭盲修九锚》');

// 模式：cards (档案库) | logic (逻辑梳理图)
const currentView = ref<'cards' | 'logic'>('cards');

const categories = ref<CharacterCategory[]>([]);
const characters = ref<CharacterCard[]>([]);
const logicMapData = ref<CharacterLogicMapData>({ bookId: '', nodes: [], relations: [] });

const selectedCategoryId = ref('ALL');
const searchKeyword = ref('');

// 新建分类状态
const isCreatingCategory = ref(false);
const newCategoryName = ref('');
const catInputRef = ref<HTMLInputElement | null>(null);

// 放大详情与编辑状态
const isDetailModalOpen = ref(false);
const activeDetailCharacter = ref<CharacterCard | undefined>();
const currentDetailIndex = ref(0);

// 拖拽排序逻辑 (支持鼠标按住拖拽与右键拖拽自由排序)
const draggedCardId = ref<string | null>(null);
const dragOverCardId = ref<string | null>(null);
const isDragSorting = ref(false);

function onCardDragStart(e: DragEvent, char: CharacterCard) {
  draggedCardId.value = char.id;
  isDragSorting.value = true;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', char.id);
  }
}

function onCardDragOver(e: DragEvent, char: CharacterCard) {
  if (!draggedCardId.value || draggedCardId.value === char.id) return;
  dragOverCardId.value = char.id;
}

function onCardDragLeave(e: DragEvent, char: CharacterCard) {
  if (dragOverCardId.value === char.id) {
    dragOverCardId.value = null;
  }
}

function onCardDrop(e: DragEvent, targetChar: CharacterCard) {
  if (!draggedCardId.value || draggedCardId.value === targetChar.id) {
    onCardDragEnd();
    return;
  }

  const fromIdx = characters.value.findIndex(c => c.id === draggedCardId.value);
  const toIdx = characters.value.findIndex(c => c.id === targetChar.id);

  if (fromIdx !== -1 && toIdx !== -1) {
    const [moved] = characters.value.splice(fromIdx, 1);
    characters.value.splice(toIdx, 0, moved);
    // 立即持久化落盘写入对应小说的 cards.json！
    characterApi.saveCharacters(currentBookId.value, characters.value);
  }

  onCardDragEnd();
}

function onCardDragEnd() {
  draggedCardId.value = null;
  dragOverCardId.value = null;
  setTimeout(() => {
    isDragSorting.value = false;
  }, 200);
}

function onCardContextMenu(e: MouseEvent) {
  // 阻止卡片上默认浏览器右键菜单，保障右键拖拽排序丝滑无干扰
  e.preventDefault();
}

function handleCardClick(char: CharacterCard) {
  // 若刚发生拖拽排序，拦截单击，避免误弹出详情
  if (isDragSorting.value) return;
  openCardDetail(char);
}

import { watch } from 'vue';

watch(
  [() => props.isOpen, () => props.bookId],
  ([isOpen]) => {
    if (isOpen) {
      loadAllData();
    }
  },
  { immediate: true }
);

onMounted(() => {
  loadAllData();
  window.addEventListener('keydown', onKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown);
});

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.isOpen && !isDetailModalOpen.value) {
    close();
  }
}

async function loadAllData() {
  const bId = currentBookId.value;
  if (!bId) return;

  // 1. 尝试直接从本地物理存储接口拉取最新实时数据
  try {
    const res = await fetch(`/api/storage/characters?bookId=${encodeURIComponent(bId)}`);
    if (res.ok) {
      const diskList = await res.json();
      if (Array.isArray(diskList)) {
        characters.value = diskList;
        try {
          localStorage.setItem(`NOVELCRAFT_CHARACTERS_${bId}`, JSON.stringify(diskList));
        } catch (e) {}
      }
    } else {
      characters.value = characterApi.getCharacters(bId);
    }
  } catch (e) {
    characters.value = characterApi.getCharacters(bId);
  }

  try {
    const catRes = await fetch(`/api/storage/categories?bookId=${encodeURIComponent(bId)}`);
    if (catRes.ok) {
      const diskCats = await catRes.json();
      if (Array.isArray(diskCats) && diskCats.length > 0) {
        categories.value = diskCats;
        try {
          localStorage.setItem(`NOVELCRAFT_CHAR_CATEGORIES_${bId}`, JSON.stringify(diskCats));
        } catch (e) {}
      } else {
        categories.value = characterApi.getCategories(bId);
      }
    } else {
      categories.value = characterApi.getCategories(bId);
    }
  } catch (e) {
    categories.value = characterApi.getCategories(bId);
  }

  // 确保当前选中的分类存在于新分类列表中，若不存在则重置为全部
  if (selectedCategoryId.value !== 'ALL') {
    const exists = categories.value.some(c => c.id === selectedCategoryId.value);
    if (!exists) {
      selectedCategoryId.value = 'ALL';
    }
  }

  logicMapData.value = characterApi.getLogicMap(bId);
}

function close() {
  emit('close');
}

const selectedCategoryName = computed(() => {
  if (selectedCategoryId.value === 'ALL') return '全部档案角色';
  const found = categories.value.find(c => c.id === selectedCategoryId.value);
  return found ? found.name : '全部档案角色';
});

function getCategoryCount(catId: string): number {
  return characters.value.filter(c => c.categoryId === catId).length;
}

const filteredCharacters = computed(() => {
  let list = characters.value;
  if (selectedCategoryId.value !== 'ALL') {
    list = list.filter(c => c.categoryId === selectedCategoryId.value);
  }
  if (searchKeyword.value.trim()) {
    const kw = searchKeyword.value.trim().toLowerCase();
    list = list.filter(c =>
      c.name.toLowerCase().includes(kw) ||
      c.identityBadge.toLowerCase().includes(kw) ||
      c.tags.some(t => t.toLowerCase().includes(kw)) ||
      c.quoteText.toLowerCase().includes(kw)
    );
  }
  return list;
});

// 分类管理
function startCreateCategory() {
  isCreatingCategory.value = true;
  newCategoryName.value = '';
  nextTick(() => {
    catInputRef.value?.focus();
  });
}

function confirmCreateCategory() {
  if (!isCreatingCategory.value) return;
  const name = newCategoryName.value.trim();
  if (name) {
    const newCat: CharacterCategory = {
      id: 'cat_' + Date.now(),
      bookId: currentBookId.value,
      name,
      orderIndex: categories.value.length + 1
    };
    categories.value.push(newCat);
    characterApi.saveCategories(currentBookId.value, categories.value);
    selectedCategoryId.value = newCat.id;
  }
  isCreatingCategory.value = false;
  newCategoryName.value = '';
}

function deleteCategory(catId: string) {
  categories.value = categories.value.filter(c => c.id !== catId);
  characterApi.saveCategories(currentBookId.value, categories.value);
  if (selectedCategoryId.value === catId) {
    selectedCategoryId.value = 'ALL';
  }
}

// 人物卡管理
function createNewCharacter() {
  const targetCatId = selectedCategoryId.value === 'ALL'
    ? (categories.value[0]?.id || 'cat_default')
    : selectedCategoryId.value;

  const nextNo = String(characters.value.length + 1).padStart(3, '0');

  const newChar: CharacterCard = {
    id: 'char_' + Date.now(),
    bookId: currentBookId.value,
    categoryId: targetCatId,
    archiveNo: `749-SURVIVOR-NO.${nextNo}`,
    stampText: '末日幸存者 · 绝密建档',
    name: '新人物',
    subtitle: '(年龄 · 籍贯 · 性格)',
    identityBadge: '未定职务/身份',
    sections: [
      {
        title: '家族渊源与至亲档案',
        fields: [
          { label: '籍贯身世', value: '点击放大就地补充身世背景...' },
          { label: '重要至亲', value: '父母与搭档情况...' }
        ]
      },
      {
        title: '实操能力与专业绝活',
        fields: [
          { label: '核心特长', value: '独门战斗/生存绝活...' }
        ]
      },
      {
        title: '生活习性与行事风格',
        fields: [
          { label: '习惯习性', value: '特殊生活嗜好或避险习惯...' }
        ]
      }
    ],
    tags: ['新人登场', '待补充标签'],
    tokenBelongings: '随身携带的重要信物...',
    quoteText: '在这里输入一句代表人物精神的核心名言金句。',
    quoteSource: `末日生存人物图鉴卡 · 编号 ${nextNo} · 新人物档案`
  };

  characters.value.unshift(newChar);
  characterApi.saveCharacters(currentBookId.value, characters.value);

  // 立即弹出放大编辑模态框
  openCardDetail(newChar);
}

function openCardDetail(char: CharacterCard) {
  activeDetailCharacter.value = char;
  currentDetailIndex.value = filteredCharacters.value.findIndex(c => c.id === char.id);
  isDetailModalOpen.value = true;
}

function openCardDetailById(charId: string) {
  const found = characters.value.find(c => c.id === charId);
  if (found) {
    openCardDetail(found);
  }
}

function navigateDetail(step: number) {
  const nextIdx = currentDetailIndex.value + step;
  if (nextIdx >= 0 && nextIdx < filteredCharacters.value.length) {
    currentDetailIndex.value = nextIdx;
    activeDetailCharacter.value = filteredCharacters.value[nextIdx];
  }
}

function onSaveCharacter(updated: CharacterCard) {
  const idx = characters.value.findIndex(c => c.id === updated.id);
  if (idx !== -1) {
    characters.value[idx] = updated;
    characterApi.saveCharacters(currentBookId.value, characters.value);
    activeDetailCharacter.value = updated;
  }
}

// 删除人物卡确认与执行
function confirmDeleteCharacter(char: CharacterCard) {
  if (confirm(`确认要彻底删除人物卡【${char.name}】吗？该操作不可撤销。`)) {
    deleteCharacterById(char.id);
  }
}

function deleteCharacterById(charId: string) {
  characters.value = characters.value.filter(c => c.id !== charId);
  characterApi.saveCharacters(currentBookId.value, characters.value);

  // 同步清理逻辑关系图谱中的关联节点与连线
  logicMapData.value.nodes = logicMapData.value.nodes.filter(n => n.characterId !== charId);
  logicMapData.value.relations = logicMapData.value.relations.filter(
    r => r.fromCharacterId !== charId && r.toCharacterId !== charId
  );
  characterApi.saveLogicMap(currentBookId.value, logicMapData.value);

  isDetailModalOpen.value = false;
}

function onUpdateLogicMap(newLogicMap: CharacterLogicMapData) {
  logicMapData.value = newLogicMap;
  characterApi.saveLogicMap(currentBookId.value, newLogicMap);
}
</script>

<style scoped>
.archive-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.82);
  backdrop-filter: blur(10px);
  z-index: 950;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.archive-modal-window {
  width: 96vw;
  max-width: 1440px;
  height: 92vh;
  background: #fbf7ee;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
  border: 1px solid #dcd0b8;
}

/* 顶栏 */
.archive-window-header {
  height: 52px;
  background: #2b2416;
  color: #fbf7ee;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  flex-shrink: 0;
  border-bottom: 1.5px solid #4a3b2c;
}

.header-left, .header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.window-icon {
  font-size: 18px;
}

.window-title {
  font-size: 15px;
  font-weight: 800;
  color: #fbf7ee;
  letter-spacing: 0.5px;
}

.book-name-tag {
  font-size: 12px;
  color: #d97706;
  background: rgba(217, 119, 6, 0.15);
  padding: 2px 8px;
  border-radius: 4px;
}

/* 模式切换胶囊 [ 📇 人物图鉴档案库 ] [ 🕸️ 人物逻辑梳理图 ] */
.archive-view-switcher {
  display: flex;
  background: rgba(255, 255, 255, 0.1);
  padding: 3px;
  border-radius: 8px;
  gap: 4px;
}

.view-switch-btn {
  background: transparent;
  border: 1px solid transparent;
  color: #d6c7a9;
  font-size: 12.5px;
  font-weight: 700;
  padding: 5px 16px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.view-switch-btn:hover {
  color: #ffffff;
}

.view-switch-btn.active {
  background: #ea580c;
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(234, 88, 12, 0.4);
}

.window-close-btn {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: #fbf7ee;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  transition: background 0.15s;
}

.window-close-btn:hover {
  background: #dc2626;
  color: #ffffff;
}

/* 视图 1：档案库布局 */
.archive-cards-layout {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* 分类侧边栏 */
.category-sidebar {
  width: 220px;
  background: #f4eedb;
  border-right: 1px solid #dfd5bd;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.category-header {
  padding: 14px 16px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #e5dcc7;
}

.cat-title {
  font-size: 13px;
  font-weight: 800;
  color: #4a3b2c;
}

.add-cat-btn {
  background: transparent;
  border: 1px dashed #b45309;
  color: #b45309;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}

.add-cat-btn:hover {
  background: #b45309;
  color: #ffffff;
}

.inline-cat-input-box {
  padding: 8px 12px;
}

.inline-cat-input {
  width: 100%;
  padding: 4px 8px;
  font-size: 12px;
  border: 1px solid #ea580c;
  border-radius: 4px;
  outline: none;
  background: #ffffff;
}

.category-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.category-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
  color: #5c4e36;
  font-size: 13px;
  font-weight: 600;
}

.category-item:hover {
  background: #ebe3ce;
  color: #2b2416;
}

.category-item.active {
  background: #dfd2b7;
  color: #b45309;
  font-weight: 800;
}

.cat-count {
  font-size: 11px;
  background: rgba(0,0,0,0.06);
  padding: 1px 6px;
  border-radius: 10px;
}

.del-cat-x {
  background: transparent;
  border: none;
  color: #991b1b;
  font-size: 10px;
  cursor: pointer;
  opacity: 0.3;
  padding: 2px;
}

.category-item:hover .del-cat-x {
  opacity: 1;
}

/* 主展示区 */
.cards-main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #faf6ed;
}

.cards-action-bar {
  height: 52px;
  padding: 0 24px;
  border-bottom: 1px solid #e5dcc7;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fbf7ee;
}

.action-left, .action-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.current-cat-label {
  font-size: 16px;
  font-weight: 800;
  color: #2b2416;
}

.char-count-pill {
  font-size: 12px;
  background: #dfd2b7;
  color: #5c4e36;
  padding: 2px 8px;
  border-radius: 12px;
  font-weight: 600;
}

.search-input {
  width: 240px;
  padding: 6px 12px;
  border: 1px solid #dcd0b8;
  border-radius: 6px;
  font-size: 12px;
  background: #ffffff;
  outline: none;
}

.search-input:focus {
  border-color: #ea580c;
}

.add-card-btn {
  background: #ea580c;
  color: #ffffff;
  border: none;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s;
  box-shadow: 0 2px 6px rgba(234, 88, 12, 0.3);
}

.add-card-btn:hover {
  background: #c2410c;
}

/* 人物卡网格 */
.cards-grid {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 24px;
}

/* 微缩档案卡样式 (100% 保持用户参考图比例与纸质肌理) */
.mini-paper-card {
  position: relative;
  background-color: #f7f1e3;
  background-image: 
    linear-gradient(rgba(180, 150, 110, 0.15) 1px, transparent 1px),
    linear-gradient(90deg, rgba(180, 150, 110, 0.15) 1px, transparent 1px);
  background-size: 16px 16px;
  border: 2px solid #5a4632;
  border-radius: 8px;
  padding: 18px 20px;
  box-shadow: 0 4px 12px rgba(90, 70, 50, 0.15);
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-family: "Noto Serif SC", "Songti SC", serif;
  user-select: none;
}

.mini-paper-card.is-dragging {
  opacity: 0.35;
  transform: scale(0.96);
  border: 2px dashed #b43228 !important;
  cursor: grabbing !important;
}

.mini-paper-card.is-drag-over {
  transform: translateY(-6px) scale(1.02);
  box-shadow: 0 12px 28px rgba(180, 50, 40, 0.3) !important;
  border-color: #b43228 !important;
}

.mini-drag-handle {
  font-size: 11px;
  font-weight: 700;
  color: #78350f;
  background: #fef3c7;
  border: 1px solid #fde68a;
  padding: 2px 6px;
  border-radius: 4px;
  cursor: grab;
  user-select: none;
  display: inline-flex;
  align-items: center;
  margin-right: 6px;
  transition: all 0.15s;
}

.mini-drag-handle:hover {
  background: #fde68a;
  color: #92400e;
  border-color: #f59e0b;
}

.mini-drag-handle:active {
  cursor: grabbing;
}

.mini-paper-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 10px 24px rgba(90, 70, 50, 0.25);
  border-color: #ea580c;
}

.mini-top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1.5px solid #8c6d48;
  padding-bottom: 6px;
  gap: 8px;
}

.mini-archive-no {
  font-family: monospace;
  font-size: 11px;
  font-weight: 700;
  color: #6b5235;
}

.mini-stamp-badge {
  font-size: 10px;
  font-weight: 900;
  color: #b91c1c;
  border: 1px solid #b91c1c;
  padding: 1px 6px;
  border-radius: 3px;
  letter-spacing: 0.5px;
}

.mini-card-delete-btn {
  background: rgba(185, 28, 28, 0.1);
  border: 1px solid rgba(185, 28, 28, 0.3);
  color: #b91c1c;
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
}

.mini-card-delete-btn:hover {
  background: #dc2626;
  color: #ffffff;
  border-color: #dc2626;
}

.mini-identity-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.mini-name-box {
  display: flex;
  align-items: baseline;
  gap: 6px;
  flex-wrap: nowrap;
  min-width: 0;
  flex-shrink: 0;
}

.mini-hero-name {
  font-size: 22px;
  font-weight: 900;
  color: #1a140d;
  white-space: nowrap;
}

.mini-subtitle {
  font-size: 11.5px;
  color: #6b553d;
  font-weight: 600;
  white-space: nowrap;
}

.mini-identity-badge {
  background: #e5d8be;
  border: 1px solid #c2b18f;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  color: #3d2e1b;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 1;
}

.mini-sections-preview {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mini-sec-box {
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid #dcd0b8;
  border-radius: 6px;
  padding: 8px 10px;
  min-width: 0;
}

.mini-sec-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  font-weight: 800;
  color: #991b1b;
  margin-bottom: 6px;
}

.mini-red-bar {
  width: 3px;
  height: 12px;
  background: #991b1b;
  flex-shrink: 0;
}

/* 核心区域文字容器 (Taretext Scroll Area，长文本内部垂直滚动滑动浏览全部，绝对不穿框) */
.mini-taretext-area {
  max-height: 90px;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 4px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.mini-taretext-area::-webkit-scrollbar {
  width: 4px;
}
.mini-taretext-area::-webkit-scrollbar-thumb {
  background: #c2b18f;
  border-radius: 2px;
}
.mini-taretext-area::-webkit-scrollbar-thumb:hover {
  background: #ea580c;
}

.mini-field-row {
  font-size: 11.5px;
  line-height: 1.5;
  color: #2b2416;
  word-break: break-word;
  overflow-wrap: anywhere;
  white-space: normal;
}

.field-k {
  font-weight: 700;
  color: #5c4e36;
}

.field-v {
  color: #2b2416;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.mini-tags-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.mini-capsule-tag {
  background: #dfd2b7;
  border: 1px solid #c2b395;
  color: #3b2c1c;
  font-size: 10.5px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 10px;
}

.mini-tag-more {
  font-size: 10.5px;
  color: #8c7b5d;
  align-self: center;
}

.mini-token-box {
  background: rgba(254, 242, 242, 0.8);
  border: 1px dashed #f87171;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 11px;
  color: #7f1d1d;
  display: flex;
  gap: 6px;
  align-items: flex-start;
}

.token-prefix {
  font-weight: 800;
  flex-shrink: 0;
}

.token-scroll-area {
  flex: 1;
  max-height: 48px;
  overflow-y: auto;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.token-scroll-area::-webkit-scrollbar {
  width: 3px;
}
.token-scroll-area::-webkit-scrollbar-thumb {
  background: #f87171;
  border-radius: 2px;
}

.mini-quote-box {
  border-top: 1px dashed #a8947c;
  padding-top: 6px;
  text-align: center;
}

.quote-scroll-area {
  max-height: 48px;
  overflow-y: auto;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.quote-scroll-area::-webkit-scrollbar {
  width: 3px;
}
.quote-scroll-area::-webkit-scrollbar-thumb {
  background: #d97706;
  border-radius: 2px;
}

.mini-quote-text {
  font-size: 12px;
  font-style: italic;
  color: #b45309;
  font-weight: 700;
  margin: 0 0 2px;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.mini-quote-sub {
  font-size: 9.5px;
  color: #8c7b5d;
}

/* 悬浮遮罩 */
.card-hover-mask {
  position: absolute;
  inset: 0;
  background: rgba(43, 36, 22, 0.08);
  opacity: 0;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.2s;
}

.mini-paper-card:hover .card-hover-mask {
  opacity: 1;
}

.mask-hint {
  background: #ea580c;
  color: #ffffff;
  font-size: 12px;
  font-weight: 700;
  padding: 6px 14px;
  border-radius: 20px;
  box-shadow: 0 4px 12px rgba(234, 88, 12, 0.4);
}

/* 视图 2：逻辑梳理图布局 */
.archive-logic-layout {
  flex: 1;
  height: 100%;
  position: relative;
}
</style>
