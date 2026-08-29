<template>
  <div class="panel-novel-info">
    <div class="info-card">
      <!-- 官方真实封面 (支持番茄高清官方封面 ＆ 本地物理缓存，无封面时优雅降级为拟真精装书皮) -->
      <div class="novel-cover-wrapper">
        <img
          v-if="coverImageUrl"
          :src="coverImageUrl"
          class="novel-cover-img"
          alt="作品封面"
          @error="onCoverImgError"
        />
        <div v-else class="novel-cover" :style="{ background: coverGradient }">
          <span class="cover-text">{{ coverDisplayTitle }}</span>
          <span class="cover-tag">原创作品</span>
        </div>
      </div>

      <!-- 核心立意与主线 -->
      <div class="novel-meta-content">
        <div class="meta-header">
          <!-- 原地双击编辑书名 -->
          <input
            v-if="isEditingTitle"
            ref="titleInputRef"
            v-model="editTitleValue"
            class="inline-title-input"
            @keydown.enter="confirmEditTitle"
            @keydown.esc="isEditingTitle = false"
            @blur="confirmEditTitle"
          />
          <h2
            v-else
            class="novel-title"
            :title="book?.title + ' (双击修改书名)'"
            @dblclick="startEditTitle"
          >
            {{ book?.title || '未选择作品' }}
          </h2>

          <div class="novel-tags">
            <span v-for="tag in tagList" :key="tag" class="tag-badge">{{ tag }}</span>
            <button class="backup-quick-btn" @click="$emit('open-backup-modal')" title="打开本书独立物理快照与版本保险箱">
              🛡️ 备份快照
            </button>
          </div>
        </div>

        <!-- 原地编辑简介 -->
        <textarea
          v-if="isEditingSynopsis"
          ref="synopsisInputRef"
          v-model="editSynopsisValue"
          class="inline-synopsis-textarea"
          @keydown.esc="isEditingSynopsis = false"
          @blur="confirmEditSynopsis"
        ></textarea>
        <p
          v-else
          class="novel-synopsis"
          title="双击直接原地修改本书核心立意"
          @dblclick="startEditSynopsis"
        >
          {{ book?.synopsis || '【核心主线】：双击原地编辑本书主线立意梗概与核心金手指设定……' }}
        </p>
      </div>

      <!-- 写作统计与目标进度仪表盘 (真实字数与真实进度) -->
      <div class="novel-stats-dashboard">
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-value text-indigo">{{ (book?.todayWordCount || 0).toLocaleString() }}</span>
            <span class="stat-label">今日码字</span>
          </div>
          <div class="stat-item">
            <span class="stat-value text-emerald">{{ chapterCount }}</span>
            <span class="stat-label">已建章节</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ ((book?.totalWordCount || 0) / 10000).toFixed(2) }}万</span>
            <span class="stat-label">全书总字数</span>
          </div>
        </div>

        <div class="progress-container">
          <div class="progress-labels">
            <div class="daily-plan-header" @click="startEditDailyTarget" title="点击设置每日计划字数">
              <span>📅 每日创作计划</span>
              <button class="target-edit-pencil" title="修改目标">✏️</button>
            </div>

            <!-- 编辑模式 -->
            <div v-if="isEditingDailyTarget" class="daily-target-editor" @click.stop>
              <input
                ref="targetInputRef"
                v-model.number="tempDailyTarget"
                type="number"
                step="500"
                min="500"
                max="50000"
                class="inline-target-input"
                @keydown.enter="confirmDailyTarget"
                @keydown.esc="isEditingDailyTarget = false"
                @blur="confirmDailyTarget"
              />
              <span class="target-unit">字</span>
              <div class="quick-pills">
                <button
                  v-for="preset in [2000, 4000, 6000, 10000]"
                  :key="preset"
                  class="quick-pill-btn"
                  @mousedown.prevent="setQuickTarget(preset)"
                >
                  {{ preset >= 10000 ? '1万' : preset }}
                </button>
              </div>
            </div>

            <!-- 常规展示模式 -->
            <div v-else class="daily-progress-text" @click="startEditDailyTarget" title="点击修改每日计划字数">
              <span class="daily-counts">{{ (book?.todayWordCount || 0).toLocaleString() }} / {{ dailyTargetWords.toLocaleString() }} 字</span>
              <span class="daily-percent" :class="{ 'is-achieved': dailyPercent >= 100 }">({{ dailyPercent }}%)</span>
            </div>
          </div>

          <div class="progress-track" :title="`今日已写 ${(book?.todayWordCount || 0).toLocaleString()} 字 / 目标 ${dailyTargetWords.toLocaleString()} 字`">
            <div
              class="progress-bar"
              :class="{ 'is-achieved': dailyPercent >= 100 }"
              :style="{ width: Math.min(100, dailyPercent) + '%' }"
            ></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue';
import type { NovelBook } from '../types/novel';

const props = defineProps<{
  book?: NovelBook;
}>();

const emit = defineEmits<{
  (e: 'update-synopsis', synopsis: string): void;
  (e: 'rename-book', newTitle: string): void;
  (e: 'open-backup-modal'): void;
}>();

// 1. 原地编辑书名
const isEditingTitle = ref(false);
const editTitleValue = ref('');
const titleInputRef = ref<HTMLInputElement | null>(null);

function startEditTitle() {
  if (!props.book) return;
  editTitleValue.value = props.book.title;
  isEditingTitle.value = true;
  nextTick(() => {
    titleInputRef.value?.focus();
    titleInputRef.value?.select();
  });
}

function confirmEditTitle() {
  if (!isEditingTitle.value || !props.book) return;
  const name = editTitleValue.value.trim();
  if (name && name !== props.book.title) {
    emit('rename-book', name);
  }
  isEditingTitle.value = false;
}

// 2. 原地编辑简介
const isEditingSynopsis = ref(false);
const editSynopsisValue = ref('');
const synopsisInputRef = ref<HTMLTextAreaElement | null>(null);

function startEditSynopsis() {
  if (!props.book) return;
  editSynopsisValue.value = props.book.synopsis || '';
  isEditingSynopsis.value = true;
  nextTick(() => {
    synopsisInputRef.value?.focus();
    synopsisInputRef.value?.select();
  });
}

function confirmEditSynopsis() {
  if (!isEditingSynopsis.value || !props.book) return;
  const syn = editSynopsisValue.value.trim();
  if (syn !== props.book.synopsis) {
    emit('update-synopsis', syn);
  }
  isEditingSynopsis.value = false;
}

// 3. 每日创作计划目标管理
const isEditingDailyTarget = ref(false);
const targetInputRef = ref<HTMLInputElement | null>(null);
const currentDailyTargetState = ref(4000);

// 从本地持久化缓存中加载当前书籍的每日目标
function getSavedDailyTarget(bookId?: string): number {
  if (!bookId) return 4000;
  const key = `NOVELCRAFT_DAILY_TARGET_${bookId}`;
  const saved = localStorage.getItem(key);
  if (saved) {
    const num = parseInt(saved, 10);
    if (!isNaN(num) && num > 0) return num;
  }
  return 4000;
}

watch(
  () => props.book?.id,
  (newId) => {
    currentDailyTargetState.value = getSavedDailyTarget(newId);
  },
  { immediate: true }
);

const dailyTargetWords = computed({
  get() {
    return currentDailyTargetState.value;
  },
  set(val: number) {
    currentDailyTargetState.value = val;
    if (props.book?.id) {
      localStorage.setItem(`NOVELCRAFT_DAILY_TARGET_${props.book.id}`, String(val));
    }
  }
});

const tempDailyTarget = ref(4000);

function startEditDailyTarget() {
  tempDailyTarget.value = dailyTargetWords.value;
  isEditingDailyTarget.value = true;
  nextTick(() => {
    targetInputRef.value?.focus();
    targetInputRef.value?.select();
  });
}

function confirmDailyTarget() {
  if (tempDailyTarget.value && tempDailyTarget.value > 0) {
    dailyTargetWords.value = Math.max(100, Math.min(100000, tempDailyTarget.value));
  }
  isEditingDailyTarget.value = false;
}

function setQuickTarget(target: number) {
  dailyTargetWords.value = target;
  isEditingDailyTarget.value = false;
}

const dailyPercent = computed(() => {
  const target = dailyTargetWords.value || 4000;
  const today = props.book?.todayWordCount || 0;
  return Math.round((today / target) * 100);
});

const isCoverImgFailed = ref(false);

const coverImageUrl = computed(() => {
  if (isCoverImgFailed.value) return '';
  if (!props.book) return '';
  // 1. 优先使用本地物理封面流 /api/storage/novel/cover
  if (props.book.id || props.book.title) {
    return `/api/storage/novel/cover?bookId=${props.book.id || props.book.title}`;
  }
  // 2. 其次使用番茄线上封面链接
  return props.book.coverUrl || '';
});

function onCoverImgError() {
  isCoverImgFailed.value = true;
}

watch(() => props.book?.id, () => {
  isCoverImgFailed.value = false;
});

const coverGradient = computed(() => {
  return props.book?.coverGradient || 'linear-gradient(135deg, #4f46e5, #7c3aed)';
});

const coverDisplayTitle = computed(() => {
  if (!props.book?.title) return '小说';
  const clean = props.book.title.replace(/[《》\s]/g, '');
  return clean.slice(0, 4) || '小说';
});

const tagList = computed(() => {
  if (!props.book?.tags) return ['原创首发', '连载中'];
  return props.book.tags.split(',').map(t => t.trim()).filter(Boolean);
});

const chapterCount = computed(() => {
  if (!props.book?.volumes) return 0;
  return props.book.volumes.reduce((sum, v) => sum + (v.chapters?.length || 0), 0);
});
</script>

<style scoped>
.panel-novel-info {
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-color);
  padding: 14px 20px;
  flex-shrink: 0;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.info-card {
  display: flex;
  align-items: center;
  gap: 18px;
}

.novel-cover-wrapper {
  width: 72px;
  height: 96px;
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
}

.novel-cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.2s ease;
}

.novel-cover-img:hover {
  transform: scale(1.04);
}

.novel-cover {
  width: 72px;
  height: 96px;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  position: relative;
  box-shadow: 0 4px 10px rgba(0,0,0,0.1);
  flex-shrink: 0;
  padding: 4px;
  text-align: center;
}

.cover-text {
  font-size: 14px;
  font-weight: 900;
  letter-spacing: 1px;
  line-height: 1.3;
  word-break: break-all;
}

.cover-tag {
  position: absolute;
  bottom: 4px;
  font-size: 9px;
  background: rgba(0,0,0,0.3);
  padding: 1px 4px;
  border-radius: 3px;
}

.novel-meta-content {
  flex: 1;
  min-width: 0;
}

.meta-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.novel-title {
  font-size: 15px;
  font-weight: 800;
  color: var(--text-main);
  margin: 0;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  cursor: pointer;
  border-radius: 4px;
  padding: 1px 4px;
  transition: background-color 0.15s;
}

.novel-title:hover {
  background: var(--bg-secondary);
}

.inline-title-input {
  font-size: 15px;
  font-weight: 800;
  color: var(--text-main);
  background: var(--bg-primary);
  border: 1.5px solid var(--accent);
  border-radius: 4px;
  padding: 1px 6px;
  outline: none;
}

.inline-synopsis-textarea {
  width: 100%;
  height: 48px;
  font-size: 12px;
  color: var(--text-main);
  background: var(--bg-primary);
  border: 1.5px solid var(--accent);
  border-radius: 6px;
  padding: 4px 6px;
  outline: none;
  resize: none;
}

.novel-tags {
  display: flex;
  align-items: center;
  gap: 6px;
}

.backup-quick-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.35);
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  color: #059669;
  cursor: pointer;
  transition: all 0.15s;
  user-select: none;
}

.backup-quick-btn:hover {
  background: rgba(16, 185, 129, 0.2);
  border-color: #059669;
  transform: translateY(-1px);
}

.tag-badge {
  padding: 2px 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  color: var(--text-muted);
}

.novel-synopsis {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.5;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  cursor: pointer;
  border-radius: 4px;
  padding: 2px;
  transition: background-color 0.15s;
}

.novel-synopsis:hover {
  color: var(--accent);
  background: var(--bg-secondary);
}

.novel-stats-dashboard {
  width: 250px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 8px 12px;
  flex-shrink: 0;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.stats-grid {
  display: flex;
  justify-content: space-between;
  text-align: center;
  margin-bottom: 6px;
}

.stat-item {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 13px;
  font-weight: 800;
  color: var(--text-main);
}

.text-indigo { color: var(--accent); }
.text-emerald { color: #10b981; }

.stat-label {
  font-size: 9px;
  color: var(--text-dim);
}

.progress-container {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.progress-labels {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 10px;
  color: var(--text-muted);
}

.daily-plan-header {
  display: flex;
  align-items: center;
  gap: 3px;
  cursor: pointer;
  font-weight: 600;
  color: var(--text-main);
}

.target-edit-pencil {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 10px;
  padding: 0;
  opacity: 0.5;
  transition: all 0.15s;
}

.daily-plan-header:hover .target-edit-pencil {
  opacity: 1;
  transform: scale(1.15);
}

.daily-target-editor {
  display: flex;
  align-items: center;
  gap: 3px;
}

.inline-target-input {
  width: 50px;
  height: 18px;
  font-size: 11px;
  font-weight: 700;
  color: var(--accent);
  background: var(--bg-primary);
  border: 1px solid var(--accent);
  border-radius: 4px;
  padding: 0 4px;
  outline: none;
  text-align: right;
}

.target-unit {
  font-size: 9px;
  color: var(--text-dim);
}

.quick-pills {
  display: flex;
  gap: 2px;
  margin-left: 2px;
}

.quick-pill-btn {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  color: var(--text-muted);
  font-size: 9px;
  padding: 1px 4px;
  border-radius: 3px;
  cursor: pointer;
  line-height: 1.1;
  transition: all 0.15s;
}

.quick-pill-btn:hover {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.daily-progress-text {
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: color 0.15s;
}

.daily-progress-text:hover {
  color: var(--accent);
}

.daily-counts {
  font-weight: 600;
}

.daily-percent.is-achieved {
  color: #10b981;
  font-weight: 800;
}

.progress-track {
  height: 5px;
  background: var(--border-color);
  border-radius: 3px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #f59e0b, #06b6d4, #10b981);
  border-radius: 3px;
  transition: width 0.4s ease;
}

.progress-bar.is-achieved {
  background: linear-gradient(90deg, #10b981, #059669);
  box-shadow: 0 0 6px rgba(16, 185, 129, 0.4);
}
</style>
