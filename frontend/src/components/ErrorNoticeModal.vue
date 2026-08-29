<template>
  <div v-if="isOpen" class="modal-backdrop" @click.self="close">
    <div class="error-notice-dialog">
      <!-- 头部 -->
      <div class="modal-header" :class="`type-${errorType}`">
        <div class="header-left">
          <span class="header-icon">{{ getIcon() }}</span>
          <div>
            <div class="title-main">{{ title || '番茄操作拦截提示' }}</div>
            <div class="title-sub">{{ subtitle || '系统已自动拦截并保护您的本地文稿' }}</div>
          </div>
        </div>
        <button class="close-btn" @click="close">✕</button>
      </div>

      <!-- 主体内容 -->
      <div class="modal-body">
        <!-- 核心错误原因警告框 -->
        <div class="alert-box" :class="`alert-${errorType}`">
          <div class="alert-title">{{ summaryTitle }}</div>
          <div class="alert-desc">{{ message }}</div>
        </div>

        <!-- 数据比对卡片（如果有字数或上限数据） -->
        <div v-if="details && (details.currentWords || details.limitWords || details.cloudStatus)" class="detail-card">
          <div class="detail-row" v-if="details.currentWords">
            <span class="detail-label">当前章节字数：</span>
            <span class="detail-val error-val">{{ details.currentWords.toLocaleString() }} 字</span>
          </div>
          <div class="detail-row" v-if="details.limitWords">
            <span class="detail-label">番茄官方要求范围：</span>
            <span class="detail-val standard-val">{{ details.limitWords }}</span>
          </div>
          <div class="detail-row" v-if="details.rawTomatoMsg">
            <span class="detail-label">番茄官方返回信息：</span>
            <span class="detail-val raw-msg">{{ details.rawTomatoMsg }}</span>
          </div>
        </div>

        <!-- 应对建议与解决办法 -->
        <div class="suggestion-box">
          <div class="sugg-header">
            <span>💡 建议应对方案：</span>
          </div>
          <ul class="sugg-list">
            <li v-for="(sugg, idx) in suggestions" :key="idx">{{ sugg }}</li>
          </ul>
        </div>
      </div>

      <!-- 底部操作按钮 -->
      <div class="modal-footer">
        <button v-if="actionType === 'relogin'" class="footer-btn action-btn" @click="handleAction('relogin')">
          🔑 重新扫码登录番茄
        </button>
        <button v-else-if="actionType === 'save-local'" class="footer-btn action-btn" @click="handleAction('save-local')">
          💾 保持为本地草稿
        </button>
        <button class="footer-btn primary-btn" @click="close">
          我知道了
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  isOpen: boolean;
  errorType?: 'warning' | 'error' | 'limit' | 'auth';
  title?: string;
  subtitle?: string;
  message: string;
  details?: {
    currentWords?: number;
    limitWords?: string;
    rawTomatoMsg?: string;
    cloudStatus?: string;
  };
  suggestions?: string[];
  actionType?: 'relogin' | 'save-local' | 'none';
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'action', type: string): void;
}>();

function close() {
  emit('close');
}

function handleAction(type: string) {
  emit('action', type);
  close();
}

function getIcon() {
  switch (props.errorType) {
    case 'limit': return '🚫';
    case 'auth': return '🔑';
    case 'warning': return '⚠️';
    default: return '❌';
  }
}

const summaryTitle = computed(() => {
  switch (props.errorType) {
    case 'limit': return '⚠️ 触发平台频次或字数上限';
    case 'auth': return '🔑 番茄账号登录态失效';
    case 'warning': return '⚠️ 章节字数或格式不符合发布标准';
    default: return '❌ 提交失败报告';
  }
});
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
  z-index: 9999;
  padding: 20px;
}

.error-notice-dialog {
  width: 100%;
  max-width: 520px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.3);
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
}

.modal-header.type-warning, .modal-header.type-limit {
  background: rgba(245, 158, 11, 0.08);
  border-bottom-color: rgba(245, 158, 11, 0.2);
}

.modal-header.type-error {
  background: rgba(239, 68, 68, 0.08);
  border-bottom-color: rgba(239, 68, 68, 0.2);
}

.modal-header.type-auth {
  background: rgba(79, 70, 229, 0.08);
  border-bottom-color: rgba(79, 70, 229, 0.2);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon {
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
  gap: 14px;
}

.alert-box {
  padding: 14px 16px;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.alert-warning, .alert-limit {
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.3);
  color: #b45309;
}

.alert-error {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #dc2626;
}

.alert-auth {
  background: rgba(79, 70, 229, 0.1);
  border: 1px solid rgba(79, 70, 229, 0.3);
  color: #4338ca;
}

.alert-title {
  font-size: 14px;
  font-weight: 800;
}

.alert-desc {
  font-size: 13px;
  line-height: 1.5;
}

.detail-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.detail-label {
  color: var(--text-muted);
  font-weight: 600;
}

.detail-val {
  font-weight: 700;
}

.error-val {
  color: #ef4444;
}

.standard-val {
  color: #10b981;
}

.raw-msg {
  color: #ea580c;
  font-family: monospace;
  max-width: 60%;
  text-align: right;
  word-break: break-all;
}

.suggestion-box {
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sugg-header {
  font-size: 12px;
  font-weight: 800;
  color: var(--text-main);
}

.sugg-list {
  margin: 0;
  padding-left: 18px;
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.6;
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
  padding: 7px 18px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
}

.footer-btn.primary-btn {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  color: var(--text-main);
}

.footer-btn.primary-btn:hover {
  background: var(--bg-tertiary);
}

.footer-btn.action-btn {
  background: linear-gradient(135deg, #4f46e5, #06b6d4);
  border: none;
  color: #fff;
  box-shadow: 0 2px 8px rgba(79, 70, 229, 0.3);
}

.footer-btn.action-btn:hover {
  filter: brightness(1.1);
  transform: translateY(-1px);
}
</style>
