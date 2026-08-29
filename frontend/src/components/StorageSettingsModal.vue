<template>
  <div v-if="isOpen" class="modal-backdrop" @click.self="close">
    <div class="storage-modal-dialog">
      <!-- 头部 -->
      <div class="modal-header">
        <div class="modal-title">
          <span class="modal-icon">⚙️</span>
          <div>
            <div class="title-main">本地存档与存储位置设置</div>
            <div class="title-sub">自定义物理文稿、思维导图与快照备份在您电脑硬盘中的存放目录</div>
          </div>
        </div>
        <button class="close-btn" @click="close">✕</button>
      </div>

      <!-- 内容区 -->
      <div class="modal-body">
        <!-- 当前存储路径卡片 -->
        <div class="current-path-card">
          <div class="card-header">
            <span class="label">📂 当前物理存储目录：</span>
            <span v-if="isCustom" class="custom-pill">自定义路径</span>
            <span v-else class="default-pill">系统默认路径</span>
          </div>
          <div class="path-display-box" :title="currentPath">
            <code>{{ currentPath || '加载中……' }}</code>
          </div>
          <div class="path-actions">
            <button class="btn-sm" @click="openInExplorer">
              📂 在 Windows 资源管理器中打开
            </button>
            <button v-if="isCustom" class="btn-sm warning" @click="handleResetDefault" :disabled="isSaving">
              🔄 恢复默认位置
            </button>
          </div>
        </div>

        <!-- 更改新路径输入区 -->
        <div class="change-path-section">
          <div class="section-title">
            <span>🎯 选择新的保存文件夹：</span>
          </div>

          <div class="input-with-browser">
            <input
              v-model="newStoragePath"
              type="text"
              class="path-input"
              placeholder="例如：D:\我的小说文稿 或 E:\NovelProjects"
              :disabled="isSaving"
            />
            <button class="browse-btn" @click="handleBrowseFolder" :disabled="isSaving">
              📂 浏览文件夹...
            </button>
          </div>

          <!-- 迁移选项 -->
          <div class="migrate-option">
            <label class="checkbox-label">
              <input v-model="migrateExisting" type="checkbox" :disabled="isSaving" />
              <span>自动将当前所有小说文稿、分卷、人物大纲及历史快照<strong>完整迁移至新目录</strong>（推荐勾选）</span>
            </label>
          </div>

          <!-- 状态与提示信息 -->
          <div v-if="feedbackMsg" class="feedback-msg" :class="feedbackType">
            <span>{{ feedbackMsg }}</span>
          </div>
        </div>
      </div>

      <!-- 底部操作栏 -->
      <div class="modal-footer">
        <button class="footer-btn secondary" @click="close" :disabled="isSaving">取消</button>
        <button class="footer-btn primary" @click="handleSavePath" :disabled="isSaving || !newStoragePath">
          <span v-if="isSaving">💾 正在迁移数据并应用……</span>
          <span v-else>💾 保存并立即生效</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'path-changed', newPath: string): void;
}>();

const currentPath = ref('');
const defaultPath = ref('');
const isCustom = ref(false);
const newStoragePath = ref('');
const migrateExisting = ref(true);
const isSaving = ref(false);
const feedbackMsg = ref('');
const feedbackType = ref<'info' | 'success' | 'error'>('info');

// 1. 加载当前存储配置
async function loadStorageConfig() {
  try {
    const res = await fetch('/api/storage/config');
    if (res.ok) {
      const data = await res.json();
      currentPath.value = data.currentPath || '';
      defaultPath.value = data.defaultPath || '';
      isCustom.value = !!data.isCustom;
      newStoragePath.value = data.currentPath || '';
    }
  } catch (err) {
    console.error('加载存储配置失败:', err);
  }
}

// 2. 浏览文件夹 (桌面端直接调用原生弹窗)
async function handleBrowseFolder() {
  if ((window as any).electronAPI?.selectDirectory) {
    try {
      const selected = await (window as any).electronAPI.selectDirectory();
      if (selected) {
        newStoragePath.value = selected;
      }
    } catch (e) {
      console.error('选择文件夹失败:', e);
    }
  } else {
    feedbackMsg.value = '💡 请直接在上方的输入框中粘贴您电脑中的目标文件夹路径';
    feedbackType.value = 'info';
  }
}

// 3. 打开当前物理文件夹
function openInExplorer() {
  fetch('/api/storage/open-folder').catch(() => {});
}

// 4. 保存新路径
async function handleSavePath() {
  if (!newStoragePath.value.trim()) {
    feedbackMsg.value = '⚠️ 请输入或选择有效的文件夹路径！';
    feedbackType.value = 'error';
    return;
  }

  isSaving.value = true;
  feedbackMsg.value = '正在验证目录权限并迁移数据，请稍候……';
  feedbackType.value = 'info';

  try {
    const res = await fetch('/api/storage/config/change-path', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        newPath: newStoragePath.value.trim(),
        migrateExisting: migrateExisting.value
      })
    });

    const data = await res.json();
    if (res.ok && data.status === 'ok') {
      feedbackMsg.value = '🎉 存储路径修改成功！全部数据已成功就绪。';
      feedbackType.value = 'success';
      currentPath.value = data.currentPath;
      isCustom.value = true;
      emit('path-changed', data.currentPath);

      setTimeout(() => {
        isSaving.value = false;
        feedbackMsg.value = '';
        close();
      }, 1200);
    } else {
      feedbackMsg.value = `❌ 修改失败: ${data.message || '目录不可写或路径无效'}`;
      feedbackType.value = 'error';
      isSaving.value = false;
    }
  } catch (err: any) {
    feedbackMsg.value = `❌ 网络或服务异常: ${err.message}`;
    feedbackType.value = 'error';
    isSaving.value = false;
  }
}

// 5. 恢复默认路径
async function handleResetDefault() {
  if (!confirm('确定要恢复系统默认存储路径吗？')) return;

  isSaving.value = true;
  try {
    const res = await fetch('/api/storage/config/reset-default', { method: 'POST' });
    const data = await res.json();
    if (res.ok && data.status === 'ok') {
      currentPath.value = data.currentPath;
      newStoragePath.value = data.currentPath;
      isCustom.value = false;
      feedbackMsg.value = '✅ 已成功恢复系统默认存储目录！';
      feedbackType.value = 'success';
      emit('path-changed', data.currentPath);
    }
  } catch (err) {
    console.error('恢复默认路径失败:', err);
  } finally {
    isSaving.value = false;
  }
}

function close() {
  feedbackMsg.value = '';
  emit('close');
}

watch(
  () => props.isOpen,
  (open) => {
    if (open) loadStorageConfig();
  },
  { immediate: true }
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
  z-index: 9500;
  padding: 20px;
}

.storage-modal-dialog {
  width: 100%;
  max-width: 600px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 14px;
  box-shadow: 0 24px 50px rgba(0, 0, 0, 0.35);
  display: flex;
  flex-direction: column;
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

.modal-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.modal-icon {
  font-size: 26px;
}

.title-main {
  font-size: 16px;
  font-weight: 800;
  color: var(--text-main);
}

.title-sub {
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

.modal-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.current-path-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-main);
}

.custom-pill {
  font-size: 11px;
  font-weight: 700;
  color: #2563eb;
  background: rgba(37, 99, 235, 0.12);
  padding: 2px 8px;
  border-radius: 12px;
}

.default-pill {
  font-size: 11px;
  font-weight: 700;
  color: #059669;
  background: rgba(16, 185, 129, 0.12);
  padding: 2px 8px;
  border-radius: 12px;
}

.path-display-box {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  padding: 10px 12px;
  border-radius: 6px;
  overflow-x: auto;
}

.path-display-box code {
  font-family: 'Consolas', monospace;
  font-size: 12px;
  color: var(--text-main);
  word-break: break-all;
}

.path-actions {
  display: flex;
  gap: 10px;
}

.btn-sm {
  padding: 5px 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-main);
  cursor: pointer;
  transition: all 0.15s;
}

.btn-sm:hover {
  background: var(--bg-tertiary);
  border-color: var(--accent);
}

.btn-sm.warning {
  color: #d97706;
}

.change-path-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-main);
}

.input-with-browser {
  display: flex;
  gap: 10px;
}

.path-input {
  flex: 1;
  padding: 9px 12px;
  border: 1.5px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-secondary);
  color: var(--text-main);
  font-size: 13px;
  font-family: 'Consolas', monospace;
  outline: none;
  transition: all 0.15s;
}

.path-input:focus {
  border-color: var(--accent);
  background: var(--bg-primary);
}

.browse-btn {
  padding: 9px 16px;
  background: var(--accent);
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
}

.browse-btn:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
}

.migrate-option {
  padding: 6px 2px;
}

.checkbox-label {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 12px;
  color: var(--text-muted);
  cursor: pointer;
  line-height: 1.4;
}

.checkbox-label strong {
  color: var(--text-main);
}

.checkbox-label input {
  margin-top: 2px;
  cursor: pointer;
}

.feedback-msg {
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
}

.feedback-msg.info {
  background: rgba(37, 99, 235, 0.08);
  color: #2563eb;
  border: 1px solid rgba(37, 99, 235, 0.2);
}

.feedback-msg.success {
  background: rgba(16, 185, 129, 0.1);
  color: #059669;
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.feedback-msg.error {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.modal-footer {
  padding: 14px 20px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.footer-btn {
  padding: 9px 18px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
}

.footer-btn.secondary {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  color: var(--text-muted);
}

.footer-btn.primary {
  background: var(--accent);
  color: #ffffff;
  border: none;
}

.footer-btn.primary:hover:not(:disabled) {
  opacity: 0.92;
}
</style>
