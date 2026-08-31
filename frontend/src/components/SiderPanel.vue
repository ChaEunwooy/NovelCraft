<template>
  <aside class="panel-sider" :class="{ collapsed: !isOpen }">
    <!-- 工作小说切换器与新建 -->
    <div class="sider-header">
      <div class="header-row">
        <span class="label-text">📚 当前工作小说</span>
        <div class="header-actions">
          <button class="tool-btn mcp-sync-btn" @click="$emit('open-mcp-modal')" title="从系统配置好的番茄作家 MCP 环境自动扫描与拉取全部签约作品">🍅 MCP 同步</button>
          <button class="tool-btn" @click="$emit('open-create-book-modal')" title="新建小说作品 (支持本地物理建档 ＆ 番茄云端同步)">+ 新建书</button>
        </div>
      </div>

      <!-- 原地新建书输入框 -->
      <div v-if="isCreatingBook" class="inline-create-box">
        <input
          ref="newBookInputRef"
          v-model="newBookTitle"
          class="inline-input"
          placeholder="输入书名敲回车 (如:《末日生存》)"
          @keydown.enter="confirmCreateBook"
          @keydown.esc="isCreatingBook = false"
          @blur="confirmCreateBook"
        />
      </div>

      <!-- 小说切换选择器 -->
      <select
        v-if="!isCreatingBook"
        class="novel-select"
        :value="selectedBookId"
        @change="$emit('select-book', ($event.target as HTMLSelectElement).value)"
      >
        <option v-for="b in books" :key="b.id" :value="b.id">
          {{ b.title }}
        </option>
      </select>

      <div class="header-row" style="margin-top: 8px;">
        <span class="label-text">卷章大纲</span>
        <button class="tool-btn" @click="startCreateVolume" title="创建新分卷">+ 新建卷</button>
      </div>

      <!-- 原地新建分卷输入框 -->
      <div v-if="isCreatingVolume" class="inline-create-box">
        <input
          ref="newVolInputRef"
          v-model="newVolumeTitle"
          class="inline-input"
          placeholder="输入新分卷名敲回车..."
          @keydown.enter="confirmCreateVolume"
          @keydown.esc="isCreatingVolume = false"
          @blur="confirmCreateVolume"
        />
      </div>
    </div>

    <!-- 目录大纲标签页 -->
    <div class="sider-tabs">
      <div class="sider-tab-item active">章节目录</div>
      <div class="sider-tab-item" @click="$emit('open-character-modal')" title="打开人物卡仓库与人物逻辑梳理图">👥 人物世界观</div>
      <div class="sider-tab-item" @click="$emit('open-foreshadow-modal')" title="打开伏笔与暗线推演看板">🗝️ 伏笔看板</div>
    </div>

    <!-- 动态分卷与章节大纲树 -->
    <div class="sider-tree-container">
      <div v-for="vol in currentBook?.volumes || []" :key="vol.id" class="tree-volume">
        <!-- 分卷头部 (点击文字/整行展开收起下拉框，点击✏️编辑按钮才出现编辑框) -->
        <div class="volume-header" @click="vol.collapsed = !vol.collapsed">
          <div class="vol-title-wrapper">
            <span class="collapse-arrow">{{ vol.collapsed ? '▶' : '▼' }}</span>

            <!-- 原地重命名分卷输入框 (仅在点击✏️后出现) -->
            <input
              v-if="editingVolumeId === vol.id"
              ref="editVolInputRef"
              v-model="editingVolumeTitle"
              class="inline-edit-input"
              @click.stop
              @keydown.enter="confirmRenameVolume(vol)"
              @keydown.esc="editingVolumeId = ''"
              @blur="confirmRenameVolume(vol)"
            />
            <span v-else class="vol-title" title="双击或点击✏️修改分卷名" @dblclick.stop="startRenameVolume(vol)">{{ vol.title }}</span>

            <span class="vol-meta">({{ vol.wordCount ? vol.wordCount.toLocaleString() + '字' : '新卷' }})</span>
          </div>

          <div class="vol-actions">
            <!-- 只有点击这个✏️编辑按钮才出现输入框 -->
            <button
              class="vol-icon-btn"
              @click.stop="startRenameVolume(vol)"
              title="编辑分卷名"
            >
              ✏️
            </button>
            <!-- 每一卷右侧专属的【+ 加章】按钮 (原地内联加章) -->
            <button
              class="vol-add-chap-btn"
              @click.stop="startAddChapter(vol)"
              title="在此卷下原地添加新章节"
            >
              + 加章
            </button>
          </div>
        </div>

        <!-- 章节列表 -->
        <div v-if="!vol.collapsed" class="chapter-list">
          <!-- 原地加章输入框 -->
          <div v-if="addingChapterVolId === vol.id" class="chapter-item creating">
            <input
              ref="newChapInputRef"
              v-model="newChapterTitle"
              class="inline-edit-input"
              placeholder="输入章节名敲回车..."
              @keydown.enter="confirmAddChapter(vol)"
              @keydown.esc="addingChapterVolId = ''"
              @blur="confirmAddChapter(vol)"
            />
          </div>

          <div
            v-for="chap in vol.chapters"
            :key="chap.id"
            class="chapter-item"
            :class="{ active: chap.id === selectedChapterId }"
            @click="$emit('select-chapter', chap)"
            title="点击切换章节（双击修改标题）"
          >
            <!-- 原地重命名章节输入框 (仅在点击✏️后出现) -->
            <input
              v-if="editingChapterId === chap.id"
              ref="editChapInputRef"
              v-model="editingChapterTitle"
              class="inline-edit-input"
              @click.stop
              @keydown.enter="confirmRenameChapter(chap)"
              @keydown.esc="editingChapterId = ''"
              @blur="confirmRenameChapter(chap)"
            />
            <span v-else class="chap-title" title="双击或点击✏️修改章节名" @dblclick.stop="startRenameChapter(chap)">{{ chap.title }}</span>

            <div class="chap-right">
              <span
                v-if="chap.publishStatus"
                class="chap-status-pill"
                :class="`status-${chap.publishStatus}`"
                :title="getStatusTitle(chap.publishStatus)"
              >
                {{ getStatusText(chap.publishStatus) }}
              </span>
              <span class="chap-meta">{{ chap.wordCount ? chap.wordCount.toLocaleString() + '字' : '草稿' }}</span>
              <button
                class="chap-rename-btn"
                @click.stop="startRenameChapter(chap)"
                title="编辑章节名"
              >
                ✏️
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部快捷工具 -->
    <div class="sider-footer">
      <button class="sider-footer-btn" @click="$emit('open-character-modal')" title="打开人物卡仓库与人物逻辑梳理图"><span>👥</span><span>人物卡</span></button>
      <button class="sider-footer-btn" @click="$emit('open-foreshadow-modal')" title="打开伏笔与暗线推演看板"><span>🗝️</span><span>伏笔看板</span></button>
      <button class="sider-footer-btn" @click="$emit('open-backup-modal')" title="打开独立物理快照与版本保险箱"><span>🛡️</span><span>快照备份</span></button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue';
import type { NovelBook, Volume, Chapter } from '../types/novel';

const props = defineProps<{
  isOpen: boolean;
  books: NovelBook[];
  selectedBookId: string;
  selectedChapterId: string;
  currentBook?: NovelBook;
  isTomatoConnected?: boolean;
}>();

const emit = defineEmits<{
  (e: 'select-book', id: string): void;
  (e: 'select-chapter', chapter: Chapter): void;
  (e: 'create-book', title: string): void;
  (e: 'create-volume', bookId: string, title: string): void;
  (e: 'create-chapter', volumeId: string, title: string): void;
  (e: 'rename-chapter', chapter: Chapter, newTitle: string): void;
  (e: 'rename-volume', volume: Volume, newTitle: string): void;
  (e: 'open-character-modal'): void;
  (e: 'open-foreshadow-modal'): void;
  (e: 'open-mcp-modal'): void;
  (e: 'open-create-book-modal'): void;
  (e: 'open-backup-modal'): void;
}>();

// 1. 原地新建书状态
const isCreatingBook = ref(false);
const newBookTitle = ref('');
const newBookInputRef = ref<HTMLInputElement | null>(null);

function confirmCreateBook() {
  if (!isCreatingBook.value) return;
  const name = newBookTitle.value.trim();
  if (name) {
    emit('create-book', name);
  }
  newBookTitle.value = '';
  isCreatingBook.value = false;
}

// 2. 原地新建分卷状态
const isCreatingVolume = ref(false);
const newVolumeTitle = ref('');
const newVolInputRef = ref<HTMLInputElement | null>(null);

function startCreateVolume() {
  if (!props.currentBook) return;
  const nextIdx = (props.currentBook.volumes?.length || 0) + 1;
  newVolumeTitle.value = `第${nextIdx}卷：新征程篇`;
  isCreatingVolume.value = true;
  nextTick(() => {
    newVolInputRef.value?.focus();
    newVolInputRef.value?.select();
  });
}

function confirmCreateVolume() {
  if (!isCreatingVolume.value || !props.currentBook) return;
  const name = newVolumeTitle.value.trim();
  if (name) {
    emit('create-volume', props.currentBook.id, name);
  }
  newVolumeTitle.value = '';
  isCreatingVolume.value = false;
}

// 3. 原地加章状态
const addingChapterVolId = ref('');
const newChapterTitle = ref('');
const newChapInputRef = ref<HTMLInputElement | null>(null);

function startAddChapter(vol: Volume) {
  const nextIdx = (vol.chapters?.length || 0) + 1;
  newChapterTitle.value = `第${nextIdx < 10 ? '00' + nextIdx : nextIdx}章 新篇章`;
  addingChapterVolId.value = vol.id;
  vol.collapsed = false;
  nextTick(() => {
    newChapInputRef.value?.focus();
    newChapInputRef.value?.select();
  });
}

function confirmAddChapter(vol: Volume) {
  if (addingChapterVolId.value !== vol.id) return;
  const name = newChapterTitle.value.trim();
  if (name) {
    emit('create-chapter', vol.id, name);
  }
  newChapterTitle.value = '';
  addingChapterVolId.value = '';
}

// 4. 原地重命名分卷状态
const editingVolumeId = ref('');
const editingVolumeTitle = ref('');
const editVolInputRef = ref<HTMLInputElement | null>(null);

function startRenameVolume(vol: Volume) {
  editingVolumeId.value = vol.id;
  editingVolumeTitle.value = vol.title;
  nextTick(() => {
    editVolInputRef.value?.focus();
    editVolInputRef.value?.select();
  });
}

function confirmRenameVolume(vol: Volume) {
  if (editingVolumeId.value !== vol.id) return;
  const name = editingVolumeTitle.value.trim();
  if (name && name !== vol.title) {
    emit('rename-volume', vol, name);
  }
  editingVolumeId.value = '';
}

// 5. 原地重命名章节状态
const editingChapterId = ref('');
const editingChapterTitle = ref('');
const editChapInputRef = ref<HTMLInputElement | null>(null);

function startRenameChapter(chap: Chapter) {
  editingChapterId.value = chap.id;
  editingChapterTitle.value = chap.title;
  nextTick(() => {
    editChapInputRef.value?.focus();
    editChapInputRef.value?.select();
  });
}

function confirmRenameChapter(chap: Chapter) {
  if (editingChapterId.value !== chap.id) return;
  const name = editingChapterTitle.value.trim();
  if (name && name !== chap.title) {
    emit('rename-chapter', chap, name);
  }
  editingChapterId.value = '';
}

function getStatusText(status?: string): string {
  switch (status) {
    case 'published': return '🟢 已发稿';
    case 'modified': return '🔴 待更新';
    case 'draft': return '🟡 草稿箱';
    case 'unpushed': return '🔵 未提交';
    default: return '🔵 未提交';
  }
}

function getStatusTitle(status?: string): string {
  switch (status) {
    case 'published': return '番茄线上已发表（内容与线上完全一致）';
    case 'modified': return '本地已修改（内容与线上版本不一致，点击提交修改后的版本）';
    case 'draft': return '番茄后台草稿箱中';
    case 'unpushed': return '本地新章节（尚未提交到番茄后台）';
    default: return '本地新章节，尚未提交到番茄后台';
  }
}
</script>

<style scoped>
.chap-status-pill {
  font-size: 9px;
  font-weight: 700;
  padding: 1px 4px;
  border-radius: 3px;
  white-space: nowrap;
}

.status-published { background: rgba(16, 185, 129, 0.12); color: #059669; }
.status-draft { background: rgba(245, 158, 11, 0.12); color: #d97706; }
.status-unpushed { background: rgba(59, 130, 246, 0.12); color: #2563eb; }
.status-modified { background: rgba(239, 68, 68, 0.12); color: #dc2626; }
.panel-sider {
  width: 260px;
  background: var(--bg-primary);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.2s ease, border-color 0.2s ease;
  overflow: hidden;
  flex-shrink: 0;
  user-select: none;
}

.panel-sider.collapsed {
  width: 0 !important;
  border-right: none;
}

.sider-header {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.label-text {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-dim);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.tool-btn {
  padding: 2px 7px;
  font-size: 10px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--text-main);
  cursor: pointer;
  transition: all 0.15s;
}

.tool-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: rgba(79, 70, 229, 0.05);
}

.tool-btn.mcp-sync-btn {
  background: rgba(16, 185, 129, 0.08);
  border-color: rgba(16, 185, 129, 0.35);
  color: #059669;
  font-weight: 700;
}

.tool-btn.mcp-sync-btn:hover {
  background: #10b981;
  border-color: #10b981;
  color: #fff;
  box-shadow: 0 2px 6px rgba(16, 185, 129, 0.3);
}

.inline-create-box {
  margin: 2px 0;
}

.inline-input {
  width: 100%;
  padding: 5px 8px;
  border-radius: 6px;
  border: 1.5px solid var(--accent);
  background: var(--bg-primary);
  font-size: 12px;
  color: var(--text-main);
  outline: none;
}

.inline-edit-input {
  flex: 1;
  padding: 2px 4px;
  border-radius: 4px;
  border: 1.5px solid var(--accent);
  background: var(--bg-primary);
  font-size: 12px;
  font-weight: 700;
  color: var(--text-main);
  outline: none;
  width: 100%;
}

.novel-select {
  width: 100%;
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  font-size: 12px;
  font-weight: 700;
  color: var(--text-main);
  outline: none;
  cursor: pointer;
}

.sider-tabs {
  display: flex;
  background: var(--bg-secondary);
  padding: 3px;
  margin: 8px 10px 4px;
  border-radius: 8px;
}

.sider-tab-item {
  flex: 1;
  text-align: center;
  padding: 5px 0;
  font-size: 11px;
  color: var(--text-muted);
  border-radius: 6px;
  cursor: pointer;
  transition: 0.15s;
}

.sider-tab-item.active {
  background: var(--bg-primary);
  color: var(--text-main);
  font-weight: 700;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}

.sider-tree-container {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.tree-volume {
  margin-bottom: 8px;
}

.volume-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  border-radius: 6px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  cursor: pointer;
  transition: 0.15s;
}

.volume-header:hover {
  background: var(--bg-tertiary);
}

.vol-title-wrapper {
  display: flex;
  align-items: center;
  gap: 4px;
  overflow: hidden;
  flex: 1;
}

.collapse-arrow {
  font-size: 10px;
  color: var(--text-dim);
}

.vol-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-main);
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}

.vol-meta {
  font-size: 10px;
  color: var(--text-dim);
  font-weight: normal;
  white-space: nowrap;
}

.vol-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.vol-icon-btn {
  padding: 1px 3px;
  font-size: 10px;
  background: transparent;
  border: none;
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 0.15s;
}

.vol-icon-btn:hover {
  opacity: 1;
}

.vol-add-chap-btn {
  padding: 2px 6px;
  font-size: 10px;
  font-weight: bold;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.vol-add-chap-btn:hover {
  background: var(--accent);
  border-color: var(--accent);
  color: #ffffff;
}

.chapter-list {
  margin-left: 8px;
  padding-left: 8px;
  border-left: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-top: 4px;
}

.chapter-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 12px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.chapter-item:hover {
  background: var(--bg-secondary);
  color: var(--text-main);
}

.chapter-item:hover .chap-rename-btn {
  display: inline-block;
}

.chapter-item.active {
  background: rgba(79, 70, 229, 0.08);
  color: var(--accent);
  font-weight: 700;
}

.chap-title {
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  flex: 1;
}

.chap-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.chap-meta {
  font-size: 10px;
  color: var(--text-dim);
  white-space: nowrap;
}

.chap-rename-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  background: transparent;
  border: none;
  cursor: pointer;
  opacity: 0.4;
  padding: 1px 2px;
  transition: opacity 0.15s, transform 0.15s;
}

.chap-rename-btn:hover {
  opacity: 1;
  transform: scale(1.15);
}

.sider-footer {
  padding: 8px;
  border-top: 1px solid var(--border-color);
  display: flex;
  gap: 4px;
  background: var(--bg-secondary);
}

.sider-footer-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 4px 0;
  font-size: 10px;
  color: var(--text-dim);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}

.sider-footer-btn:hover {
  background: var(--bg-primary);
  border-color: var(--border-color);
  color: var(--text-main);
}
</style>
