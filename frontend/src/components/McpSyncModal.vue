<template>
  <div v-if="isOpen" class="modal-backdrop" @click.self="close">
    <div class="mcp-modal-window">
      <!-- 顶栏 -->
      <div class="mcp-header">
        <div class="header-left">
          <span class="mcp-icon">🍅</span>
          <div>
            <div class="mcp-title">番茄作家 MCP 智能直连中心</div>
            <div class="mcp-subtitle">已自动读取系统配置好的 MCP 环境，支持一键将线上作品、卷章目录与正文拉取落盘</div>
          </div>
        </div>
        <button class="close-btn" @click="close" title="关闭 (Esc)">✕</button>
      </div>

      <!-- 主体内容 -->
      <div class="mcp-body">
        <!-- 连通性状态指示条 -->
        <div class="status-banner" :class="{ 'is-connected': isConnected, 'is-loading': isLoading }">
          <div class="status-left">
            <span class="status-dot"></span>
            <span v-if="isLoading" class="status-text">🔄 正在与番茄作家 MCP 服务握手通信中……</span>
            <span v-else-if="isConnected" class="status-text">
              🟢 <strong>MCP 系统直连正常</strong> · 已关联番茄作家专区，检测到 <strong>{{ novelsList.length }}</strong> 部签约作品
            </span>
            <span v-else class="status-text">⚠️ 未检测到有效 MCP 登录凭证，请检查系统 MCP 配置</span>
          </div>
          <button class="refresh-mcp-btn" :disabled="isLoading" @click="loadMcpNovels" title="重新检测 MCP 系统">
            🔄 刷新云端书库
          </button>
        </div>

        <!-- 错误提示 -->
        <div v-if="errorMessage" class="error-banner">
          <span>⚠️ {{ errorMessage }}</span>
        </div>

        <!-- 小说卡片列表 -->
        <div class="novels-grid-container">
          <div v-if="isLoading && novelsList.length === 0" class="loading-state">
            <div class="spinner"></div>
            <span>正在从 MCP 系统拉取小说列表……</span>
          </div>

          <div v-else-if="novelsList.length === 0" class="empty-state">
            <span>暂未在当前 MCP 账号下扫描到作品</span>
          </div>

          <div
            v-for="novel in novelsList"
            :key="novel.book_id"
            class="mcp-novel-card"
            :class="{ 'is-local': novel.isLocal, 'is-pulling': pullingBookId === novel.book_id }"
          >
            <div class="card-cover-badge" :style="{ background: getCoverGradient(novel.book_id) }">
              <span class="cover-txt">{{ (novel.book_name || '小说').slice(0, 4) }}</span>
              <span class="cover-tag">{{ novel.creation_status === 1 ? '连载中' : '已完结' }}</span>
            </div>

            <div class="card-content">
              <div class="card-title-row">
                <h3 class="novel-name" :title="novel.book_name">《{{ novel.book_name }}》</h3>
                <span v-if="novel.isLocal" class="local-tag success">✅ 本地已就绪</span>
                <span v-else class="local-tag cloud">☁️ 仅云端存在</span>
              </div>

              <div class="card-meta-row">
                <span>ID: {{ novel.book_id }}</span>
                <span>· 线上字数: <strong>{{ (novel.word_count || 0).toLocaleString() }}</strong> 字</span>
                <span v-if="novel.localFolderName">· 本地目录: <code>{{ novel.localFolderName }}</code></span>
              </div>

              <p v-if="novel.abstract" class="novel-abstract">
                {{ novel.abstract }}
              </p>
              <p v-else class="novel-abstract default">
                暂无作品立意简介，拉取后可直接在本地原地双击编辑。
              </p>

              <!-- 卡片操作底栏 -->
              <div class="card-actions">
                <button
                  class="action-btn pull-btn"
                  :class="{ 'update-mode': novel.isLocal }"
                  :disabled="pullingBookId === novel.book_id"
                  @click="pullSingleNovel(novel)"
                >
                  <span v-if="pullingBookId === novel.book_id">🔄 正在拉取分卷与章节……</span>
                  <span v-else-if="novel.isLocal">🔄 增量对齐更新</span>
                  <span v-else>⚡ 一键拉取到本地</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部全局操作栏 -->
      <div class="mcp-footer">
        <div class="footer-left-tip">
          <span>💡 拉取后将在 <code>data-storage/novels/</code> 自动生成完整工程文件与 TXT 正文</span>
        </div>
        <div class="footer-right">
          <button class="footer-btn secondary" @click="close">关闭</button>
          <button
            class="footer-btn primary-pull-all"
            :disabled="isLoading || isPullingAll || novelsList.length === 0"
            @click="pullAllNovels"
          >
            <span v-if="isPullingAll">🔄 正在全量拉取中……</span>
            <span v-else>🚀 全部作品一键拉取落盘 ({{ novelsList.length }}本)</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'synced', bookId: string): void;
}>();

const isConnected = ref(false);
const isLoading = ref(false);
const isPullingAll = ref(false);
const pullingBookId = ref<string | null>(null);
const errorMessage = ref('');
const novelsList = ref<any[]>([]);

function close() {
  emit('close');
}

// 动态封面渐变
function getCoverGradient(id: string): string {
  const gradients = [
    'linear-gradient(135deg, #4f46e5, #06b6d4)',
    'linear-gradient(135deg, #10b981, #059669)',
    'linear-gradient(135deg, #f59e0b, #d97706)',
    'linear-gradient(135deg, #ec4899, #8b5cf6)'
  ];
  const hash = String(id).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return gradients[hash % gradients.length];
}

// 加载 MCP 小说列表
async function loadMcpNovels() {
  isLoading.value = true;
  errorMessage.value = '';
  try {
    const res = await fetch('/api/mcp/novels');
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'ok') {
        isConnected.value = true;
        novelsList.value = data.novels || [];
        return;
      }
    }
    const errData = await res.json().catch(() => ({}));
    errorMessage.value = errData.message || '获取 MCP 书籍列表失败';
    isConnected.value = false;
  } catch (err: any) {
    errorMessage.value = err?.message || '无法连接至 MCP 本地服务';
    isConnected.value = false;
  } finally {
    isLoading.value = false;
  }
}

// 一键拉取单本书
async function pullSingleNovel(novel: any) {
  pullingBookId.value = novel.book_id;
  errorMessage.value = '';
  try {
    const res = await fetch('/api/mcp/pull-book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookId: novel.book_id })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'ok') {
        novel.isLocal = true;
        novel.localFolderName = `《${novel.book_name}》`;
        emit('synced', data.book?.id || novel.book_id);
      }
    } else {
      const err = await res.json().catch(() => ({}));
      errorMessage.value = err.message || '拉取作品失败';
    }
  } catch (e: any) {
    errorMessage.value = e?.message || '网络连接异常';
  } finally {
    pullingBookId.value = null;
  }
}

// 一键全部拉取
async function pullAllNovels() {
  if (novelsList.value.length === 0) return;
  isPullingAll.value = true;
  errorMessage.value = '';
  try {
    for (const novel of novelsList.value) {
      await pullSingleNovel(novel);
    }
  } catch (e: any) {
    errorMessage.value = e?.message || '批量拉取过程中断';
  } finally {
    isPullingAll.value = false;
  }
}

watch(
  () => props.isOpen,
  (val) => {
    if (val) {
      loadMcpNovels();
    }
  },
  { immediate: true }
);

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.isOpen) {
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
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(5px);
  z-index: 9200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.mcp-modal-window {
  width: 100%;
  max-width: 820px;
  max-height: 85vh;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: modalPop 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes modalPop {
  0% { opacity: 0; transform: scale(0.96) translateY(10px); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}

.mcp-header {
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

.mcp-icon {
  font-size: 26px;
  line-height: 1;
}

.mcp-title {
  font-size: 16px;
  font-weight: 800;
  color: var(--text-main);
}

.mcp-subtitle {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
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

.mcp-body {
  flex: 1;
  overflow-y: auto;
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.status-banner {
  padding: 10px 14px;
  border-radius: 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.status-banner.is-connected {
  border-color: rgba(16, 185, 129, 0.4);
  background: rgba(16, 185, 129, 0.06);
}

.status-left {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-main);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 6px rgba(16, 185, 129, 0.6);
}

.refresh-mcp-btn {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 11px;
  color: var(--text-main);
  cursor: pointer;
  transition: all 0.15s;
}

.refresh-mcp-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.error-banner {
  padding: 8px 12px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 6px;
  color: #dc2626;
  font-size: 12px;
}

.novels-grid-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.loading-state, .empty-state {
  text-align: center;
  padding: 40px 0;
  color: var(--text-muted);
  font-size: 13px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.spinner {
  width: 24px;
  height: 24px;
  border: 2.5px solid var(--border-color);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.mcp-novel-card {
  display: flex;
  gap: 16px;
  padding: 14px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  transition: all 0.2s ease;
}

.mcp-novel-card:hover {
  border-color: var(--accent);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06);
}

.mcp-novel-card.is-local {
  border-left: 4px solid #10b981;
}

.card-cover-badge {
  width: 68px;
  height: 90px;
  border-radius: 6px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 8px 4px;
  color: #fff;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.15);
}

.cover-txt {
  font-size: 12px;
  font-weight: 800;
  text-align: center;
  line-height: 1.2;
}

.cover-tag {
  font-size: 9px;
  background: rgba(0, 0, 0, 0.35);
  padding: 1px 4px;
  border-radius: 3px;
}

.card-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.card-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.novel-name {
  font-size: 15px;
  font-weight: 800;
  color: var(--text-main);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.local-tag {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 4px;
  white-space: nowrap;
}

.local-tag.success {
  background: rgba(16, 185, 129, 0.12);
  color: #059669;
}

.local-tag.cloud {
  background: rgba(59, 130, 246, 0.12);
  color: #2563eb;
}

.card-meta-row {
  font-size: 11px;
  color: var(--text-dim);
  display: flex;
  align-items: center;
  gap: 6px;
}

.card-meta-row code {
  background: var(--bg-tertiary);
  padding: 1px 4px;
  border-radius: 3px;
  color: var(--accent);
}

.novel-abstract {
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.4;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.novel-abstract.default {
  font-style: italic;
  color: var(--text-dim);
}

.card-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 4px;
}

.action-btn {
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid var(--accent);
  background: var(--accent);
  color: #fff;
  transition: all 0.15s;
}

.action-btn:hover {
  filter: brightness(1.1);
  box-shadow: 0 2px 8px rgba(79, 70, 229, 0.3);
}

.action-btn.update-mode {
  background: var(--bg-primary);
  color: var(--accent);
}

.action-btn.update-mode:hover {
  background: var(--accent);
  color: #fff;
}

.mcp-footer {
  padding: 14px 20px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.footer-left-tip {
  font-size: 11px;
  color: var(--text-dim);
}

.footer-left-tip code {
  background: var(--bg-tertiary);
  padding: 1px 4px;
  border-radius: 3px;
}

.footer-right {
  display: flex;
  gap: 10px;
}

.footer-btn {
  padding: 7px 16px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
}

.footer-btn.secondary {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  color: var(--text-main);
}

.footer-btn.primary-pull-all {
  background: linear-gradient(135deg, #10b981, #059669);
  border: none;
  color: #fff;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
}

.footer-btn.primary-pull-all:hover:not(:disabled) {
  filter: brightness(1.1);
  transform: translateY(-1px);
}
</style>
