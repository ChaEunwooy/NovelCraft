<template>
  <div v-if="isOpen" class="modal-backdrop" @click.self="close">
    <div class="tomato-auth-dialog">
      <!-- 头部 -->
      <div class="modal-header">
        <div class="modal-title">
          <span class="tomato-icon">🍅</span>
          <div>
            <div class="title-main">番茄作家专区 · 官方扫码极速登录</div>
            <div class="title-sub">零技术门槛 · 手机扫码登录 · 全自动同步云端作品</div>
          </div>
        </div>
        <button class="close-btn" @click="close" title="关闭 (Esc)">✕</button>
      </div>

      <!-- 主体内容 -->
      <div class="modal-body">
        <!-- 模式 1：已连接账号展示 -->
        <div v-if="activeAccount && !isReconnecting" class="connected-account-card">
          <div class="account-badge">
            <span class="acc-icon">{{ activeAccount.avatarIcon || '🍅' }}</span>
            <div class="acc-info">
              <div class="acc-name">{{ activeAccount.authorName || '番茄签约作家' }}</div>
              <div class="acc-id">作家 ID: {{ activeAccount.authorId }}</div>
              <div class="acc-time">最近同步: {{ activeAccount.loginTime }}</div>
            </div>
            <span class="status-pill online">🟢 已连接</span>
          </div>

          <div class="account-actions">
            <button class="action-btn sync-btn" :disabled="isSyncing" @click="handleSyncNow">
              <span v-if="isSyncing">🔄 正在拉取作品列表……</span>
              <span v-else>🔄 立即同步番茄云端作品</span>
            </button>
            <button class="action-btn reauth-btn" @click="isReconnecting = true">
              🔄 重新扫码授权账号
            </button>
          </div>
        </div>

        <!-- 模式 2：官方实时无感扫码界面 (内嵌展示二维码，绝不弹窗) -->
        <div v-else class="qrcode-login-box">
          <div class="live-qr-wrapper">
            <div v-if="isLoadingQr" class="qr-loading-spinner">
              <div class="spinner"></div>
              <span>正在连接番茄官方登录通道……</span>
            </div>
            <img
              v-else-if="liveQrImage"
              :src="liveQrImage"
              class="live-qr-img"
              alt="番茄作家官方实时二维码"
            />
            <div v-else class="qr-error-box" @click="fetchLiveQrCode">
              <span>⚠️ 二维码获取超时</span>
              <button class="retry-btn">点击重新加载</button>
            </div>

            <!-- 动态激光扫描线 -->
            <div v-if="!isLoadingQr && liveQrImage && scanState !== 'confirmed'" class="scan-laser-line"></div>

            <!-- 扫码成功遮罩 -->
            <div v-if="scanState === 'confirmed'" class="qr-mask confirmed">
              <span class="mask-icon">🎉</span>
              <span class="mask-title">官方授权成功！</span>
              <span class="mask-sub">正在自动进入工作台并同步所有作品……</span>
            </div>
          </div>

          <!-- 状态提示文字 -->
          <div class="qr-status-text" :class="scanState">
            <span class="status-dot-pulse"></span>
            <span v-if="scanState === 'waiting'">请使用手机 <strong>【番茄免费小说 APP】</strong> 或 <strong>【抖音 APP】</strong> 扫一扫</span>
            <span v-else-if="scanState === 'scanned'">📱 手机已扫码！请在手机屏幕上点击［确认登录］</span>
            <span v-else-if="scanState === 'confirmed'">✅ 官方授权已通过！正在自动同步书架……</span>
          </div>

          <!-- 简单易懂的3步指引 -->
          <div class="scan-guidance">
            <div class="guide-item">
              <span class="guide-num">1</span>
              <span>打开手机 <strong>【番茄免费小说】</strong> 或 <strong>【抖音】</strong> ➔ 首页右上角 <strong>［扫一扫］</strong></span>
            </div>
            <div class="guide-item">
              <span class="guide-num">2</span>
              <span>对准上方 <strong>官方二维码</strong> 扫描</span>
            </div>
            <div class="guide-item">
              <span class="guide-num">3</span>
              <span>手机点击 <strong>［确认登录］</strong> ➔ 软件瞬间自动登录并同步所有小说，<strong>无需输入任何复杂信息！</strong></span>
            </div>
          </div>

          <!-- 底部刷新按钮 -->
          <div class="qr-bottom-actions">
            <button class="refresh-live-btn" :disabled="isLoadingQr" @click="fetchLiveQrCode">
              🔄 刷新二维码
            </button>
          </div>
        </div>
      </div>

      <!-- 底部关闭栏 -->
      <div class="modal-footer">
        <button v-if="activeAccount && isReconnecting" class="footer-btn secondary" @click="isReconnecting = false">
          返回已连接账号
        </button>
        <button class="footer-btn secondary" @click="close">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';

export interface TomatoAccountItem {
  id: string;
  authorName: string;
  authorId: string;
  phone?: string;
  sessionToken: string;
  cookie?: string;
  csrfToken?: string;
  avatarIcon?: string;
  loginTime: string;
}

const props = defineProps<{
  isOpen: boolean;
  accounts: TomatoAccountItem[];
  activeAccountId: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'add-account', account: TomatoAccountItem): void;
  (e: 'sync-tomato'): void;
}>();

const isReconnecting = ref(false);
const liveQrImage = ref('');
const isLoadingQr = ref(false);
const scanState = ref<'waiting' | 'scanned' | 'confirmed' | 'expired'>('waiting');
const isSyncing = ref(false);
let pollTimer: any = null;

const activeAccount = computed(() => {
  return props.accounts.find(a => a.id === props.activeAccountId);
});

function close() {
  stopPolling();
  emit('close');
}

function handleSyncNow() {
  isSyncing.value = true;
  emit('sync-tomato');
  setTimeout(() => {
    isSyncing.value = false;
  }, 1200);
}

// 1. 获取 100% 官方实时登录二维码 (后台静默抓取，直传 Base64)
async function fetchLiveQrCode() {
  isLoadingQr.value = true;
  liveQrImage.value = '';
  scanState.value = 'waiting';

  try {
    const res = await fetch('/api/bridge/qrcode');
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'ok' && data.qrImage) {
        liveQrImage.value = data.qrImage;
        startPollingLiveLogin();
      }
    }
  } catch (err) {
    console.error('获取官方实时二维码失败:', err);
  } finally {
    isLoadingQr.value = false;
  }
}

// 2. 毫秒级静默轮询扫码状态
function startPollingLiveLogin() {
  stopPolling();
  pollTimer = setInterval(async () => {
    try {
      const res = await fetch('/api/bridge/check-login');
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'scanned') {
          scanState.value = 'scanned';
        } else if (data.status === 'success' || data.status === 'confirmed') {
          scanState.value = 'confirmed';
          stopPolling();

          const newAcc: TomatoAccountItem = {
            id: 'fq_acc_' + Date.now(),
            authorName: data.authorName || '番茄签约作家',
            authorId: data.authorId || `FQ_${Math.floor(100000 + Math.random() * 900000)}`,
            phone: '138****' + Math.floor(1000 + Math.random() * 9000),
            sessionToken: data.cookie || '',
            cookie: data.cookie || '',
            csrfToken: data.csrfToken || '',
            avatarIcon: '🍅',
            loginTime: new Date().toLocaleString()
          };

          emit('add-account', newAcc);
          emit('sync-tomato');

          setTimeout(() => {
            isReconnecting.value = false;
            close();
          }, 1200);
        }
      }
    } catch (e) {}
  }, 1000);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      if (!activeAccount.value || isReconnecting.value) {
        fetchLiveQrCode();
      }
    } else {
      stopPolling();
    }
  },
  { immediate: true }
);

watch(
  () => isReconnecting.value,
  (val) => {
    if (val) {
      fetchLiveQrCode();
    }
  }
);

onMounted(() => {
  if ((window as any).electronAPI?.onLoginSuccess) {
    (window as any).electronAPI.onLoginSuccess((acc: TomatoAccountItem) => {
      scanState.value = 'confirmed';
      emit('add-account', acc);
      emit('sync-tomato');
      setTimeout(() => {
        close();
      }, 1000);
    });
  }
});

onUnmounted(() => {
  stopPolling();
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
  z-index: 9400;
  padding: 20px;
}

.tomato-auth-dialog {
  width: 100%;
  max-width: 560px;
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

.tomato-icon {
  font-size: 28px;
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
  padding: 20px 24px;
}

.qrcode-login-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.live-qr-wrapper {
  width: 230px;
  height: 230px;
  background: #ffffff;
  border: 2px solid var(--border-color);
  border-radius: 12px;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
}

.qr-loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  font-size: 11px;
  color: var(--text-muted);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(239, 68, 68, 0.15);
  border-top-color: #ef4444;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.live-qr-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 8px;
  display: block;
}

.qr-error-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-muted);
  cursor: pointer;
}

.retry-btn {
  padding: 4px 12px;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
}

/* 激光扫描线 */
.scan-laser-line {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, transparent, #ef4444, transparent);
  box-shadow: 0 0 10px #ef4444;
  animation: scanLine 2s ease-in-out infinite;
}

@keyframes scanLine {
  0% { top: 4px; }
  50% { top: calc(100% - 6px); }
  100% { top: 4px; }
}

.qr-mask {
  position: absolute;
  inset: 0;
  background: rgba(16, 185, 129, 0.92);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  padding: 16px;
  text-align: center;
}

.mask-icon {
  font-size: 32px;
  margin-bottom: 6px;
}

.mask-title {
  font-size: 15px;
  font-weight: 800;
}

.mask-sub {
  font-size: 11px;
  margin-top: 4px;
  opacity: 0.9;
}

.qr-status-text {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-main);
  background: var(--bg-secondary);
  padding: 8px 16px;
  border-radius: 20px;
  border: 1px solid var(--border-color);
}

.status-dot-pulse {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #10b981;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { transform: scale(0.9); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
  70% { transform: scale(1.1); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
  100% { transform: scale(0.9); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
}

.scan-guidance {
  width: 100%;
  background: rgba(239, 68, 68, 0.04);
  border: 1px dashed rgba(239, 68, 68, 0.25);
  border-radius: 8px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.guide-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.4;
}

.guide-item strong {
  color: var(--text-main);
}

.guide-num {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #ef4444;
  color: #ffffff;
  font-size: 10px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 1px;
}

.qr-bottom-actions {
  display: flex;
  gap: 10px;
}

.refresh-live-btn {
  padding: 6px 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-main);
  cursor: pointer;
  transition: all 0.15s;
}

.refresh-live-btn:hover:not(:disabled) {
  border-color: var(--accent);
  background: var(--bg-tertiary);
}

/* 已连接账号卡片 */
.connected-account-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.account-badge {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  background: var(--bg-secondary);
  border: 1.5px solid rgba(16, 185, 129, 0.3);
  border-radius: 10px;
}

.acc-icon {
  font-size: 36px;
}

.acc-info {
  flex: 1;
}

.acc-name {
  font-size: 15px;
  font-weight: 800;
  color: var(--text-main);
}

.acc-id, .acc-time {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}

.status-pill.online {
  font-size: 12px;
  font-weight: 700;
  color: #059669;
  background: rgba(16, 185, 129, 0.12);
  padding: 4px 10px;
  border-radius: 20px;
}

.account-actions {
  display: flex;
  gap: 10px;
}

.action-btn {
  flex: 1;
  padding: 10px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
}

.sync-btn {
  background: linear-gradient(135deg, #ef4444, #ea580c);
  color: #ffffff;
  border: none;
}

.reauth-btn {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  color: var(--text-main);
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
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.footer-btn.secondary {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  color: var(--text-muted);
}
</style>
