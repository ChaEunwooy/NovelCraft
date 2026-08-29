<template>
  <div v-if="isOpen" class="kanban-modal-backdrop" @click.self="close">
    <div class="kanban-modal-window">
      <!-- 1. 顶栏区域：标题 + 核心指标统计 + 视图切换 + 关闭 -->
      <div class="kanban-header">
        <div class="header-left">
          <span class="header-icon">🗝️</span>
          <div>
            <div class="header-title-row">
              <span class="header-title">伏笔与暗线推演看板</span>
              <span class="book-tag">{{ bookTitle || '当前小说' }}</span>
            </div>
            <p class="header-subtitle">全流程追踪每一章每一段的埋设与回收闭环，杜绝断线与烂尾</p>
          </div>
        </div>

        <!-- 统计指标小看板 -->
        <div class="header-stats">
          <div class="stat-pill">
            <span class="stat-num">{{ stats.total }}</span>
            <span class="stat-lbl">全部伏笔</span>
          </div>
          <div class="stat-pill pending">
            <span class="stat-num">{{ stats.pending }}</span>
            <span class="stat-lbl">待回收</span>
          </div>
          <div class="stat-pill resolved">
            <span class="stat-num">{{ stats.resolved }}</span>
            <span class="stat-lbl">已闭环</span>
          </div>
          <div class="stat-pill rate">
            <span class="stat-num">{{ stats.resolveRate }}%</span>
            <span class="stat-lbl">闭环率</span>
          </div>
        </div>

        <div class="header-right">
          <button class="new-clue-btn" @click="startCreateClue">+ 埋下新伏笔</button>
          <button class="close-btn" @click="close" title="关闭 (Esc)">✕</button>
        </div>
      </div>

      <!-- 2. 工具栏：搜索 + 类别过滤 + 视图切换 (看板 / 列表) -->
      <div class="kanban-toolbar">
        <div class="toolbar-left">
          <div class="search-box">
            <span class="search-icon">🔍</span>
            <input
              v-model="searchKeyword"
              type="text"
              placeholder="搜索伏笔名称、原文摘录、揭秘说明..."
              class="search-input"
            />
            <button v-if="searchKeyword" class="clear-search-btn" @click="searchKeyword = ''">✕</button>
          </div>

          <div class="filter-group">
            <span class="filter-label">分类:</span>
            <select v-model="selectedCategory" class="filter-select">
              <option value="ALL">全部标签 ({{ foreshadowList.length }})</option>
              <option value="主线反转">主线反转</option>
              <option value="身世之谜">身世之谜</option>
              <option value="关键信物">关键信物</option>
              <option value="世界法则">世界法则</option>
              <option value="生死危机">生死危机</option>
              <option value="暗线细节">暗线细节</option>
            </select>
          </div>
        </div>

        <div class="toolbar-right">
          <div class="view-switch-tabs">
            <button
              class="view-tab"
              :class="{ active: currentView === 'kanban' }"
              @click="currentView = 'kanban'"
            >
              📋 看板泳道
            </button>
            <button
              class="view-tab"
              :class="{ active: currentView === 'timeline' }"
              @click="currentView = 'timeline'"
            >
              📜 全景时间线
            </button>
          </div>
        </div>
      </div>

      <!-- 3. 主体内容区 -->
      <div class="kanban-body">
        <!-- 视图一：三列看板泳道 -->
        <div v-if="currentView === 'kanban'" class="kanban-columns-container">
          <!-- 泳道 1: 待回收 (Pending) -->
          <div class="kanban-column pending-col">
            <div class="col-header">
              <div class="col-title-left">
                <span class="col-dot pending"></span>
                <span class="col-title">⏳ 待回收 (悬空暗线)</span>
                <span class="col-count">{{ pendingList.length }}</span>
              </div>
              <button class="col-add-btn" @click="startCreateClue" title="快速新增待回收伏笔">+</button>
            </div>

            <div class="col-cards-list">
              <div v-if="pendingList.length === 0" class="col-empty">
                <span>暂无待回收的伏笔</span>
              </div>

              <div
                v-for="item in pendingList"
                :key="item.id"
                class="clue-card pending-card"
                @click="openEditModal(item)"
              >
                <div class="card-header">
                  <div class="card-header-tags">
                    <span class="card-category-tag" :class="item.category">{{ item.category }}</span>
                    <span v-if="item.priority === 'high'" class="card-priority-tag high">核心必收</span>
                    <span v-else-if="item.priority === 'medium'" class="card-priority-tag medium">重要支线</span>
                  </div>
                  <button class="card-delete-icon-btn" @click.stop="quickDeleteClue(item)" title="删除此伏笔">🗑️</button>
                </div>

                <div class="card-title">{{ item.title }}</div>
                <div v-if="item.content" class="card-desc">{{ item.content }}</div>

                <!-- 埋设位置标识 -->
                <div class="card-location plant-loc">
                  <span class="loc-icon">🌱 埋于:</span>
                  <span class="loc-chap-title">{{ item.plantChapterTitle }}</span>
                  <span v-if="item.plantParagraphIndex" class="loc-para-idx">第 {{ item.plantParagraphIndex }} 段</span>
                </div>

                <!-- 原文引言摘录预览 -->
                <div v-if="item.plantQuoteText" class="card-quote-preview">
                  “{{ item.plantQuoteText }}”
                </div>

                <!-- 卡片底部快捷操作 -->
                <div class="card-footer" @click.stop>
                  <button
                    class="quick-jump-btn"
                    @click="$emit('jump-to-chapter', item.plantChapterId)"
                    title="在编辑器中打开此章节正文"
                  >
                    📖 跳转阅读
                  </button>
                  <button
                    class="quick-resolve-btn"
                    @click="startResolveClue(item)"
                    title="在此处标记伏笔已被回收"
                  >
                    ⚡ 标记回收
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- 泳道 2: 已回收 (Resolved) -->
          <div class="kanban-column resolved-col">
            <div class="col-header">
              <div class="col-title-left">
                <span class="col-dot resolved"></span>
                <span class="col-title">✅ 已回收 (闭环反转)</span>
                <span class="col-count">{{ resolvedList.length }}</span>
              </div>
            </div>

            <div class="col-cards-list">
              <div v-if="resolvedList.length === 0" class="col-empty">
                <span>暂无已回收伏笔</span>
              </div>

              <div
                v-for="item in resolvedList"
                :key="item.id"
                class="clue-card resolved-card"
                @click="openEditModal(item)"
              >
                <div class="card-header">
                  <div class="card-header-tags">
                    <span class="card-category-tag" :class="item.category">{{ item.category }}</span>
                    <span class="card-status-badge resolved">已闭环</span>
                  </div>
                  <button class="card-delete-icon-btn" @click.stop="quickDeleteClue(item)" title="删除此伏笔">🗑️</button>
                </div>

                <div class="card-title">{{ item.title }}</div>

                <!-- 埋设与回收链路流转胶囊 -->
                <div class="card-flow-pipeline">
                  <div class="pipeline-item plant">
                    <span class="pipe-lbl">🌱 埋入</span>
                    <span class="pipe-chap">{{ item.plantChapterTitle }}</span>
                    <span v-if="item.plantParagraphIndex" class="pipe-para">第{{ item.plantParagraphIndex }}段</span>
                  </div>
                  <div class="pipeline-arrow">➔</div>
                  <div class="pipeline-item resolve">
                    <span class="pipe-lbl">🌾 回收</span>
                    <span class="pipe-chap">{{ item.resolveChapterTitle }}</span>
                    <span v-if="item.resolveParagraphIndex" class="pipe-para">第{{ item.resolveParagraphIndex }}段</span>
                  </div>
                </div>

                <!-- 回收揭秘说明 -->
                <div v-if="item.resolveNote" class="card-resolve-note">
                  <span class="note-prefix">💡 反转说明：</span>
                  <span>{{ item.resolveNote }}</span>
                </div>

                <!-- 回收原文 -->
                <div v-if="item.resolveQuoteText" class="card-quote-preview resolve-quote">
                  “{{ item.resolveQuoteText }}”
                </div>

                <!-- 卡片底部快捷操作 -->
                <div class="card-footer" @click.stop>
                  <button
                    class="quick-jump-btn"
                    @click="$emit('jump-to-chapter', item.resolveChapterId || item.plantChapterId)"
                    title="在编辑器中定位到回收章节"
                  >
                    📖 查看回收段落
                  </button>
                  <button
                    class="quick-unresolve-btn"
                    @click="unresolveClue(item)"
                    title="取消回收状态，退回待回收"
                  >
                    ↩ 重置为待收
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- 泳道 3: 已搁置/废弃 (Abandoned) -->
          <div class="kanban-column abandoned-col">
            <div class="col-header">
              <div class="col-title-left">
                <span class="col-dot abandoned"></span>
                <span class="col-title">⚠️ 暂搁置 / 作废归档</span>
                <span class="col-count">{{ abandonedList.length }}</span>
              </div>
            </div>

            <div class="col-cards-list">
              <div v-if="abandonedList.length === 0" class="col-empty">
                <span>暂无搁置伏笔</span>
              </div>

              <div
                v-for="item in abandonedList"
                :key="item.id"
                class="clue-card abandoned-card"
                @click="openEditModal(item)"
              >
                <div class="card-header">
                  <div class="card-header-tags">
                    <span class="card-category-tag" :class="item.category">{{ item.category }}</span>
                    <span class="card-status-badge abandoned">已搁置</span>
                  </div>
                  <button class="card-delete-icon-btn" @click.stop="quickDeleteClue(item)" title="彻底删除此伏笔">🗑️</button>
                </div>
                <div class="card-title strike-through">{{ item.title }}</div>
                <div v-if="item.content" class="card-desc">{{ item.content }}</div>

                <div class="card-location plant-loc">
                  <span class="loc-icon">🌱 原埋于:</span>
                  <span class="loc-chap-title">{{ item.plantChapterTitle }}</span>
                </div>

                <div class="card-footer" @click.stop>
                  <button
                    class="quick-restore-btn"
                    @click="restoreClue(item)"
                    title="恢复为待回收"
                  >
                    🔄 重新激活
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 视图二：全景时间线列表 -->
        <div v-else class="kanban-timeline-container">
          <div class="timeline-table-wrapper">
            <table class="timeline-table">
              <thead>
                <tr>
                  <th style="width: 70px;">状态</th>
                  <th style="width: 180px;">伏笔名称</th>
                  <th style="width: 100px;">分类</th>
                  <th style="width: 220px;">🌱 埋设位置（那一章哪一段）</th>
                  <th style="width: 220px;">🌾 回收位置（某一章哪一段）</th>
                  <th>反转揭秘与原理解释</th>
                  <th style="width: 150px; text-align: center;">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="item in filteredList"
                  :key="item.id"
                  class="timeline-row"
                  @click="openEditModal(item)"
                >
                  <td>
                    <span class="status-indicator" :class="item.status">
                      {{ item.status === 'resolved' ? '✅ 已收' : item.status === 'pending' ? '⏳ 待收' : '⚠️ 搁置' }}
                    </span>
                  </td>
                  <td>
                    <div class="table-clue-title">{{ item.title }}</div>
                  </td>
                  <td>
                    <span class="table-cat-badge">{{ item.category }}</span>
                  </td>
                  <td>
                    <div class="table-loc plant">
                      <span class="loc-tag">埋:</span>
                      <span class="loc-text">{{ item.plantChapterTitle }}</span>
                      <span v-if="item.plantParagraphIndex" class="para-tag">第{{ item.plantParagraphIndex }}段</span>
                    </div>
                    <div v-if="item.plantQuoteText" class="table-quote-mini" :title="item.plantQuoteText">
                      “{{ item.plantQuoteText }}”
                    </div>
                  </td>
                  <td>
                    <div v-if="item.status === 'resolved'" class="table-loc resolve">
                      <span class="loc-tag resolve">收:</span>
                      <span class="loc-text">{{ item.resolveChapterTitle || '未指定' }}</span>
                      <span v-if="item.resolveParagraphIndex" class="para-tag">第{{ item.resolveParagraphIndex }}段</span>
                    </div>
                    <div v-if="item.resolveQuoteText" class="table-quote-mini" :title="item.resolveQuoteText">
                      “{{ item.resolveQuoteText }}”
                    </div>
                    <span v-else-if="item.status === 'pending'" class="waiting-text">尚未回收...</span>
                    <span v-else class="abandoned-text">已作废</span>
                  </td>
                  <td>
                    <div class="table-note-cell">
                      {{ item.resolveNote || item.content || '-' }}
                    </div>
                  </td>
                  <td style="text-align: center;" @click.stop>
                    <div class="table-action-btns">
                      <button
                        class="tbl-btn"
                        @click="$emit('jump-to-chapter', item.plantChapterId)"
                        title="跳转正文"
                      >
                        📖 查看
                      </button>
                      <button
                        class="tbl-btn edit"
                        @click="openEditModal(item)"
                        title="编辑伏笔"
                      >
                        ✏️ 编辑
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- 4. 模态框：伏笔录入/编辑子弹窗 -->
      <ForeshadowDetailModal
        :is-open="isDetailModalOpen"
        :item="activeDetailItem"
        :book-id="bookId"
        :volumes="volumes"
        :current-chapter="currentChapter"
        @close="isDetailModalOpen = false"
        @save="onSaveClue"
        @delete="onDeleteClue"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import type { ForeshadowItem, ForeshadowStats } from '../../types/foreshadow';
import type { Volume, Chapter } from '../../types/novel';
import { foreshadowApi } from '../../api/foreshadowApi';
import ForeshadowDetailModal from './ForeshadowDetailModal.vue';

const props = defineProps<{
  isOpen: boolean;
  bookId: string;
  bookTitle?: string;
  volumes?: Volume[];
  currentChapter?: Chapter;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'jump-to-chapter', chapterId: string): void;
}>();

const currentView = ref<'kanban' | 'timeline'>('kanban');
const searchKeyword = ref('');
const selectedCategory = ref('ALL');

const foreshadowList = ref<ForeshadowItem[]>([]);
const isDetailModalOpen = ref(false);
const activeDetailItem = ref<ForeshadowItem | null>(null);

// 统计
const stats = computed<ForeshadowStats>(() => {
  return foreshadowApi.calcStats(foreshadowList.value);
});

// 加载当前书的专属伏笔列表 (从本地硬盘 data-storage/novels/{bookDir}/foreshadows/items.json 拉取)
async function loadData() {
  const currentId = props.bookId;
  if (!currentId) {
    foreshadowList.value = [];
    return;
  }
  // 先读缓存立即渲染
  foreshadowList.value = foreshadowApi.getForeshadows(currentId);
  // 同时异步直读物理磁盘，确保精准同步
  const diskData = await foreshadowApi.fetchForeshadows(currentId);
  if (props.bookId === currentId) {
    foreshadowList.value = diskData || [];
  }
}

watch(
  () => props.isOpen,
  (val) => {
    if (val) {
      loadData();
    }
  },
  { immediate: true }
);

watch(
  () => props.bookId,
  () => {
    loadData();
  }
);

// 过滤列表
const filteredList = computed(() => {
  return foreshadowList.value.filter((item) => {
    // 类别过滤
    if (selectedCategory.value !== 'ALL' && item.category !== selectedCategory.value) {
      return false;
    }
    // 搜索过滤
    if (searchKeyword.value.trim()) {
      const q = searchKeyword.value.trim().toLowerCase();
      const matchTitle = item.title?.toLowerCase().includes(q);
      const matchContent = item.content?.toLowerCase().includes(q);
      const matchPlantQuote = item.plantQuoteText?.toLowerCase().includes(q);
      const matchResolveQuote = item.resolveQuoteText?.toLowerCase().includes(q);
      const matchPlantChap = item.plantChapterTitle?.toLowerCase().includes(q);
      const matchResolveChap = item.resolveChapterTitle?.toLowerCase().includes(q);
      const matchNote = item.resolveNote?.toLowerCase().includes(q);
      if (
        !matchTitle &&
        !matchContent &&
        !matchPlantQuote &&
        !matchResolveQuote &&
        !matchPlantChap &&
        !matchResolveChap &&
        !matchNote
      ) {
        return false;
      }
    }
    return true;
  });
});

const pendingList = computed(() => filteredList.value.filter((i) => i.status === 'pending'));
const resolvedList = computed(() => filteredList.value.filter((i) => i.status === 'resolved'));
const abandonedList = computed(() => filteredList.value.filter((i) => i.status === 'abandoned'));

function close() {
  emit('close');
}

function startCreateClue() {
  activeDetailItem.value = null;
  isDetailModalOpen.value = true;
}

function openEditModal(item: ForeshadowItem) {
  activeDetailItem.value = { ...item };
  isDetailModalOpen.value = true;
}

function startResolveClue(item: ForeshadowItem) {
  activeDetailItem.value = {
    ...item,
    status: 'resolved',
    resolveChapterId: props.currentChapter?.id || '',
    resolveChapterTitle: props.currentChapter?.title || '',
    resolveParagraphIndex: 1
  };
  isDetailModalOpen.value = true;
}

function unresolveClue(item: ForeshadowItem) {
  item.status = 'pending';
  item.updatedAt = new Date().toISOString();
  saveCurrentList();
}

function restoreClue(item: ForeshadowItem) {
  item.status = 'pending';
  item.updatedAt = new Date().toISOString();
  saveCurrentList();
}

function onSaveClue(savedItem: ForeshadowItem) {
  const idx = foreshadowList.value.findIndex((i) => i.id === savedItem.id);
  if (idx >= 0) {
    foreshadowList.value[idx] = savedItem;
  } else {
    foreshadowList.value.unshift(savedItem);
  }
  saveCurrentList();
}

function onDeleteClue(clueId: string) {
  foreshadowList.value = foreshadowList.value.filter((i) => i.id !== clueId);
  saveCurrentList();
  isDetailModalOpen.value = false;
}

function quickDeleteClue(item: ForeshadowItem) {
  foreshadowList.value = foreshadowList.value.filter((i) => i.id !== item.id);
  saveCurrentList();
}

function saveCurrentList() {
  foreshadowApi.saveForeshadows(props.bookId || 'default', foreshadowList.value);
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.isOpen && !isDetailModalOpen.value) {
    close();
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<style scoped>
.kanban-modal-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  z-index: 9000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.kanban-modal-window {
  width: 1320px;
  max-width: 96vw;
  height: 90vh;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 14px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  color: var(--text-main);
  overflow: hidden;
}

/* 顶栏 */
.kanban-header {
  height: 72px;
  padding: 0 24px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.header-icon {
  font-size: 28px;
}

.header-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-title {
  font-size: 19px;
  font-weight: 700;
  color: var(--text-main);
}

.book-tag {
  font-size: 12px;
  background: rgba(79, 70, 229, 0.1);
  color: var(--accent);
  border: 1px solid var(--border-color);
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 600;
}

.header-subtitle {
  margin: 2px 0 0 0;
  font-size: 12px;
  color: var(--text-muted);
}

.header-stats {
  display: flex;
  align-items: center;
  gap: 12px;
}

.stat-pill {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  padding: 6px 14px;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 68px;
}

.stat-pill .stat-num {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-main);
  line-height: 1.1;
}

.stat-pill .stat-lbl {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}

.stat-pill.pending .stat-num { color: #d97706; }
.stat-pill.resolved .stat-num { color: #059669; }
.stat-pill.rate .stat-num { color: var(--accent); }

.header-right {
  display: flex;
  align-items: center;
  gap: 14px;
}

.new-clue-btn {
  background: var(--accent);
  border: 1px solid var(--accent);
  color: #ffffff;
  padding: 8px 18px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
  transition: all 0.2s;
}

.new-clue-btn:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-dim);
  font-size: 20px;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 6px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-main);
}

/* 工具栏 */
.kanban-toolbar {
  height: 52px;
  padding: 0 24px;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 10px;
  font-size: 13px;
  color: var(--text-dim);
}

.search-input {
  width: 280px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 6px 30px 6px 30px;
  color: var(--text-main);
  font-size: 12px;
  outline: none;
  transition: border-color 0.2s;
}

.search-input:focus {
  border-color: var(--accent);
}

.clear-search-btn {
  position: absolute;
  right: 8px;
  background: none;
  border: none;
  color: var(--text-dim);
  cursor: pointer;
  font-size: 12px;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-label {
  font-size: 12px;
  color: var(--text-muted);
}

.filter-select {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 5px 10px;
  color: var(--text-main);
  font-size: 12px;
  outline: none;
}

.view-switch-tabs {
  display: flex;
  background: var(--bg-secondary);
  padding: 3px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
}

.view-tab {
  background: none;
  border: none;
  color: var(--text-muted);
  padding: 5px 14px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.view-tab.active {
  background: var(--bg-primary);
  color: var(--accent);
  font-weight: 700;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

/* 主体容器 */
.kanban-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  background: var(--bg-primary);
}

/* 看板三泳道布局 */
.kanban-columns-container {
  flex: 1;
  display: flex;
  gap: 18px;
  padding: 18px 24px;
  overflow-x: auto;
}

.kanban-column {
  flex: 1;
  min-width: 360px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.pending-col { border-top: 3px solid #d97706; }
.resolved-col { border-top: 3px solid #059669; }
.abandoned-col { border-top: 3px solid #94a3b8; }

.col-header {
  height: 46px;
  padding: 0 16px;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.col-title-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.col-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.col-dot.pending { background: #d97706; }
.col-dot.resolved { background: #059669; }
.col-dot.abandoned { background: #94a3b8; }

.col-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-main);
}

.col-count {
  font-size: 11px;
  background: var(--bg-primary);
  color: var(--text-muted);
  padding: 2px 7px;
  border-radius: 10px;
  font-weight: 600;
  border: 1px solid var(--border-color);
}

.col-add-btn {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  color: var(--text-main);
  width: 22px;
  height: 22px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  transition: all 0.15s;
}

.col-add-btn:hover {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.col-cards-list {
  flex: 1;
  padding: 14px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.col-empty {
  text-align: center;
  color: var(--text-dim);
  font-size: 13px;
  margin-top: 40px;
}

/* 伏笔卡片 */
.clue-card {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 14px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.clue-card:hover {
  border-color: var(--accent);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-category-tag {
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 4px;
  background: rgba(79, 70, 229, 0.1);
  color: var(--accent);
  font-weight: 600;
}

.card-priority-tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
  font-weight: 600;
}

.card-priority-tag.high {
  background: rgba(239, 68, 68, 0.12);
  color: #dc2626;
  border: 1px solid rgba(239, 68, 68, 0.25);
}

.card-priority-tag.medium {
  background: rgba(245, 158, 11, 0.12);
  color: #d97706;
}

.card-status-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 600;
}

.card-status-badge.resolved {
  background: rgba(16, 185, 129, 0.12);
  color: #059669;
}

.card-status-badge.abandoned {
  background: rgba(148, 163, 184, 0.15);
  color: var(--text-dim);
}

.card-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-main);
  line-height: 1.4;
}

.card-title.strike-through {
  text-decoration: line-through;
  color: var(--text-dim);
}

.card-desc {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-location {
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  background: var(--bg-tertiary);
  border-radius: 4px;
}

.plant-loc {
  border-left: 3px solid #059669;
}

.loc-icon {
  color: #059669;
  font-weight: 600;
}

.loc-chap-title {
  color: var(--text-main);
  font-weight: 600;
}

.loc-para-idx {
  color: var(--text-muted);
  font-size: 11px;
}

.card-quote-preview {
  font-size: 11.5px;
  color: var(--text-muted);
  font-style: italic;
  background: var(--bg-tertiary);
  border-left: 2px dashed var(--border-color);
  padding: 6px 8px;
  border-radius: 0 4px 4px 0;
  line-height: 1.5;
}

.resolve-quote {
  border-left-color: var(--accent);
  color: var(--text-main);
}

/* 链路流转胶囊 */
.card-flow-pipeline {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 11px;
}

.pipeline-item {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.pipeline-item.plant .pipe-lbl { color: #059669; }
.pipeline-item.resolve .pipe-lbl { color: var(--accent); }

.pipe-lbl {
  font-size: 10px;
  font-weight: 700;
}

.pipe-chap {
  color: var(--text-main);
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pipe-para {
  color: var(--text-muted);
  font-size: 10px;
}

.pipeline-arrow {
  color: var(--accent);
  font-weight: bold;
}

.card-resolve-note {
  font-size: 12px;
  color: #059669;
  background: rgba(16, 185, 129, 0.08);
  border: 1px solid rgba(16, 185, 129, 0.2);
  padding: 6px 10px;
  border-radius: 6px;
  line-height: 1.4;
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
  padding-top: 8px;
  border-top: 1px solid var(--border-color);
}

.quick-jump-btn {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  color: var(--text-muted);
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}

.quick-jump-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-main);
  border-color: var(--accent);
}

.quick-resolve-btn {
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #059669;
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.15s;
}

.quick-resolve-btn:hover {
  background: #059669;
  color: #fff;
}

.quick-unresolve-btn, .quick-restore-btn {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  color: var(--text-muted);
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 4px;
  cursor: pointer;
}

.quick-unresolve-btn:hover, .quick-restore-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-main);
}

/* 时间线列表视图 */
.kanban-timeline-container {
  flex: 1;
  padding: 20px 24px;
  overflow-y: auto;
  background: var(--bg-primary);
}

.timeline-table-wrapper {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
}

.timeline-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.timeline-table th {
  background: var(--bg-secondary);
  color: var(--text-muted);
  font-weight: 700;
  text-align: left;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border-color);
}

.timeline-row {
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
  transition: background-color 0.15s;
}

.timeline-row:hover {
  background-color: var(--bg-secondary);
}

.timeline-table td {
  padding: 12px 14px;
  vertical-align: top;
  color: var(--text-main);
}

.status-indicator {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
}

.status-indicator.resolved { background: rgba(16, 185, 129, 0.12); color: #059669; }
.status-indicator.pending { background: rgba(245, 158, 11, 0.12); color: #d97706; }
.status-indicator.abandoned { background: rgba(148, 163, 184, 0.15); color: var(--text-dim); }

.table-clue-title {
  font-weight: 700;
  color: var(--text-main);
}

.table-cat-badge {
  font-size: 11px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  padding: 2px 6px;
  border-radius: 4px;
  color: var(--text-muted);
}

.table-loc {
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}

.table-loc.plant .loc-tag { color: #059669; }
.table-loc.resolve .loc-tag { color: var(--accent); }

.table-loc .para-tag {
  font-size: 11px;
  color: var(--text-muted);
}

.table-quote-mini {
  margin-top: 4px;
  font-size: 11px;
  color: var(--text-muted);
  font-style: italic;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}

.waiting-text {
  color: var(--text-dim);
  font-style: italic;
}

.abandoned-text {
  color: var(--text-dim);
}

.table-note-cell {
  color: var(--text-muted);
  line-height: 1.4;
}

.table-action-btns {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.card-header-tags {
  display: flex;
  align-items: center;
  gap: 6px;
}

.card-delete-icon-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 13px;
  opacity: 0.45;
  padding: 2px 5px;
  border-radius: 4px;
  transition: all 0.15s ease;
  line-height: 1;
}

.card-delete-icon-btn:hover {
  opacity: 1;
  background: rgba(239, 68, 68, 0.12);
  transform: scale(1.15);
}

.tbl-btn {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  color: var(--text-main);
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}

.tbl-btn:hover {
  background: var(--bg-tertiary);
  border-color: var(--accent);
  color: var(--accent);
}

.tbl-btn.delete {
  background: rgba(239, 68, 68, 0.08);
  color: #dc2626;
  border-color: rgba(239, 68, 68, 0.25);
}

.tbl-btn.delete:hover {
  background: rgba(239, 68, 68, 0.18);
  border-color: #dc2626;
  color: #b91c1c;
}
</style>
