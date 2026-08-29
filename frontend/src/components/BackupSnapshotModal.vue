<template>
  <div v-if="isOpen" class="modal-backdrop" @click.self="close">
    <div class="backup-dialog">
      <!-- 头部 -->
      <div class="modal-header">
        <div class="header-left">
          <span class="header-icon">🛡️</span>
          <div>
            <div class="title-main">独立物理快照与版本保险箱</div>
            <div class="title-sub">
              当前作品：<strong class="highlight-title">{{ bookTitle || '未选择作品' }}</strong>
              · 全量章节/大纲/人物/伏笔全方位版本留存
            </div>
          </div>
        </div>
        <button class="close-btn" @click="close" title="关闭 (Esc)">✕</button>
      </div>

      <!-- 主体内容 -->
      <div class="modal-body">
        <!-- 立即创建快照栏 -->
        <div class="create-snapshot-card">
          <div class="input-with-btn">
            <span class="input-icon">✏️</span>
            <input
              v-model="snapshotNote"
              class="snapshot-note-input"
              placeholder="填写本次快照备注（例如：写完第4章重要转折点备份）..."
              @keydown.enter="handleCreateSnapshot"
            />
            <button
              class="create-snap-btn"
              :disabled="isCreating"
              @click="handleCreateSnapshot"
            >
              <span v-if="isCreating">⏳ 正在固化快照……</span>
              <span v-else>💾 立即保存当前快照</span>
            </button>
          </div>
        </div>

        <!-- 快照列表区域 -->
        <div class="snapshot-list-section">
          <div class="section-header">
            <div class="section-title">
              <span>🕒 历史快照版本流</span>
              <span class="count-badge">{{ snapshots.length }} 个安全快照</span>
            </div>
            <button class="refresh-btn" @click="loadSnapshots" title="刷新快照列表">
              🔄 刷新
            </button>
          </div>

          <!-- 快照列表 -->
          <div v-if="isLoading" class="state-container">
            <span class="loading-spinner"></span>
            <span>正在读取本地硬盘物理快照索引……</span>
          </div>

          <div v-else-if="snapshots.length === 0" class="state-container empty">
            <span class="empty-icon">📦</span>
            <div class="empty-title">当前作品暂无历史快照</div>
            <div class="empty-desc">点击上方【立即保存当前快照】即可为全书各章节与大纲建立物理备份</div>
          </div>

          <div v-else class="snapshot-scroll-list">
            <div
              v-for="snap in snapshots"
              :key="snap.id"
              class="snapshot-item"
            >
              <div class="snap-left">
                <div class="snap-badge-icon">📦</div>
                <div class="snap-info">
                  <div class="snap-title-row">
                    <span class="snap-date">{{ snap.dateStr }}</span>
                    <span class="snap-note-tag" :class="getNoteClass(snap.note)">{{ snap.note }}</span>
                  </div>
                  <div class="snap-meta-row">
                    <span class="meta-pill words">📝 {{ snap.totalWords.toLocaleString() }} 字</span>
                    <span class="meta-pill chapters">📑 {{ snap.chapterCount }} 章节</span>
                    <span class="meta-pill size">💾 {{ formatSize(snap.fileSize) }}</span>
                  </div>
                </div>
              </div>

              <div class="snap-actions">
                <button
                  class="snap-btn restore-btn"
                  :disabled="isRestoringId === snap.id"
                  @click="handleRestore(snap)"
                  title="将全书内容一键安全恢复到此快照版本"
                >
                  <span v-if="isRestoringId === snap.id">🔄 还原中…</span>
                  <span v-else>🔄 还原此版本</span>
                </button>
                <button
                  class="snap-btn delete-btn"
                  @click="handleDelete(snap)"
                  title="删除此快照"
                >
                  🗑️
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 底部安全保障提示 -->
        <div class="safety-tip-card">
          <span class="tip-icon">🛡️</span>
          <div class="tip-text">
            <strong>全自动安全保护机制</strong>：码字过程中系统每隔 15 分钟自动静默生成一个物理快照。
            且<strong>每次执行还原操作前，系统都会先对当前最新状态做一次自动安全保护</strong>，彻底做到 0 风险、0 丢稿！
          </div>
        </div>
      </div>

      <!-- 底部关闭栏 -->
      <div class="modal-footer">
        <button class="footer-btn primary-btn" @click="close">
          关闭
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { novelApi } from '../api/client';

const props = defineProps<{
  isOpen: boolean;
  bookId?: string;
  bookTitle?: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'restored'): void;
}>();

const snapshots = ref<Array<{
  id: string;
  timestamp: number;
  dateStr: string;
  note: string;
  totalWords: number;
  chapterCount: number;
  fileSize: number;
}>>([]);

const snapshotNote = ref('');
const isLoading = ref(false);
const isCreating = ref(false);
const isRestoringId = ref('');

function close() {
  emit('close');
}

async function loadSnapshots() {
  if (!props.bookId && !props.bookTitle) return;
  isLoading.value = true;
  try {
    const list = await novelApi.getBackups(props.bookId || props.bookTitle || '');
    snapshots.value = list;
  } catch (e) {
    console.error('加载快照失败:', e);
  } finally {
    isLoading.value = false;
  }
}

async function handleCreateSnapshot() {
  if (!props.bookId && !props.bookTitle) return;
  isCreating.value = true;
  try {
    const note = snapshotNote.value.trim() || '手动安全快照';
    const res = await novelApi.createBackup(props.bookId || props.bookTitle || '', note);
    if (res.status === 'ok') {
      snapshotNote.value = '';
      await loadSnapshots();
    }
  } catch (e) {
    console.error('创建快照失败:', e);
  } finally {
    isCreating.value = false;
  }
}

async function handleRestore(snap: any) {
  if (!props.bookId && !props.bookTitle) return;
  isRestoringId.value = snap.id;
  try {
    const res = await novelApi.restoreBackup(props.bookId || props.bookTitle || '', snap.id);
    if (res.status === 'ok') {
      emit('restored');
      await loadSnapshots();
    }
  } catch (e) {
    console.error('还原快照失败:', e);
  } finally {
    isRestoringId.value = '';
  }
}

async function handleDelete(snap: any) {
  if (!props.bookId && !props.bookTitle) return;
  try {
    await novelApi.deleteBackup(props.bookId || props.bookTitle || '', snap.id);
    snapshots.value = snapshots.value.filter(s => s.id !== snap.id);
  } catch (e) {
    console.error('删除快照失败:', e);
  }
}

function getNoteClass(note: string) {
  if (note.includes('自动')) return 'tag-auto';
  if (note.includes('还原')) return 'tag-safety';
  return 'tag-manual';
}

function formatSize(bytes: number) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

watch(
  () => props.isOpen,
  (val) => {
    if (val) {
      snapshotNote.value = '';
      loadSnapshots();
    }
  }
);
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.65);
  backdrop-filter: blur(5px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9400;
  padding: 20px;
}

.backup-dialog {
  width: 100%;
  max-width: 680px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  max-height: 85vh;
  overflow: hidden;
  animation: popIn 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes popIn {
  0% { opacity: 0; transform: scale(0.96) translateY(10px); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}

.modal-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg-secondary);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon {
  font-size: 28px;
}

.title-main {
  font-size: 16px;
  font-weight: 800;
  color: var(--text-main);
}

.title-sub {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}

.highlight-title {
  color: var(--accent);
}

.close-btn {
  background: none;
  border: none;
  font-size: 18px;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.15s;
}

.close-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-main);
}

.modal-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
}

.create-snapshot-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 12px 16px;
}

.input-with-btn {
  display: flex;
  align-items: center;
  gap: 10px;
}

.input-icon {
  font-size: 18px;
}

.snapshot-note-input {
  flex: 1;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 13px;
  color: var(--text-main);
  outline: none;
}

.snapshot-note-input:focus {
  border-color: var(--accent);
}

.create-snap-btn {
  padding: 8px 16px;
  background: linear-gradient(135deg, #10b981, #059669);
  border: none;
  border-radius: 6px;
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
  transition: all 0.15s;
  white-space: nowrap;
}

.create-snap-btn:hover:not(:disabled) {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

.snapshot-list-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 800;
  color: var(--text-main);
}

.count-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 7px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  color: var(--text-muted);
}

.refresh-btn {
  background: none;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.refresh-btn:hover {
  background: var(--bg-secondary);
  color: var(--text-main);
}

.snapshot-scroll-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 280px;
  overflow-y: auto;
  padding-right: 4px;
}

.snapshot-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  transition: all 0.15s;
}

.snapshot-item:hover {
  border-color: var(--accent);
  background: var(--bg-primary);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.snap-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.snap-badge-icon {
  font-size: 24px;
}

.snap-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.snap-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.snap-date {
  font-size: 13px;
  font-weight: 800;
  color: var(--text-main);
  font-family: monospace;
}

.snap-note-tag {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 4px;
}

.tag-auto {
  background: rgba(59, 130, 246, 0.12);
  color: #2563eb;
}

.tag-manual {
  background: rgba(16, 185, 129, 0.12);
  color: #059669;
}

.tag-safety {
  background: rgba(245, 158, 11, 0.12);
  color: #d97706;
}

.snap-meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.meta-pill {
  font-size: 11px;
  color: var(--text-muted);
}

.snap-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.snap-btn {
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
}

.restore-btn {
  background: rgba(79, 70, 229, 0.08);
  border: 1px solid var(--accent);
  color: var(--accent);
}

.restore-btn:hover:not(:disabled) {
  background: var(--accent);
  color: #fff;
}

.delete-btn {
  background: none;
  border: 1px solid var(--border-color);
  color: var(--text-muted);
  padding: 5px 8px;
}

.delete-btn:hover {
  background: rgba(239, 68, 68, 0.1);
  border-color: #ef4444;
  color: #ef4444;
}

.state-container {
  padding: 30px 20px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
  background: var(--bg-secondary);
  border-radius: 8px;
  border: 1px dashed var(--border-color);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.empty-icon {
  font-size: 32px;
}

.empty-title {
  font-weight: 700;
  color: var(--text-main);
}

.safety-tip-card {
  padding: 12px 14px;
  background: rgba(16, 185, 129, 0.06);
  border: 1px solid rgba(16, 185, 129, 0.25);
  border-radius: 8px;
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.tip-icon {
  font-size: 20px;
  line-height: 1;
}

.tip-text {
  font-size: 12px;
  color: var(--text-main);
  line-height: 1.5;
}

.modal-footer {
  padding: 12px 20px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);
  display: flex;
  justify-content: flex-end;
}

.footer-btn.primary-btn {
  padding: 6px 18px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  color: var(--text-main);
}

.footer-btn.primary-btn:hover {
  background: var(--bg-tertiary);
}
</style>
