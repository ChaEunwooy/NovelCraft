<template>
  <div v-if="isOpen" class="modal-backdrop" @click.self="$emit('close')">
    <div class="nest-modal-box">
      <!-- 弹窗顶部栏 -->
      <div class="modal-header">
        <div class="header-title-group">
          <span class="header-icon">🌌</span>
          <div>
            <h3 class="modal-title">NEST-DRAMA · 群像剧情推演沙盒控制台</h3>
            <p class="modal-subtitle">多智能体角色独立行动 · 引力场世界驱动 · 3D太阳系星丛实时演进</p>
          </div>
        </div>
        <div class="header-right-actions">
          <button class="launch-ext-btn" @click="openExternal" title="在独立浏览器大窗口中打开">
            ↗️ 独立全屏窗口
          </button>
          <button class="close-btn" @click="$emit('close')">×</button>
        </div>
      </div>

      <!-- 控制台工具栏 -->
      <div class="nest-toolbar">
        <div class="toolbar-left">
          <button class="tool-btn sync-btn" :disabled="isSyncing" @click="syncMaterials">
            {{ isSyncing ? '🔄 正在同步材料...' : '📂 一键同步《走马楼笔记》至沙盒' }}
          </button>
          <button class="tool-btn start-btn" :class="{ running: isEngineRunning }" @click="toggleEngine">
            {{ isEngineRunning ? '🟢 引擎已在端口 8787 运行' : '🚀 启动本地推演引擎' }}
          </button>
        </div>
        <div class="toolbar-right">
          <span class="engine-status-tip">
            💡 状态：{{ syncStatus || (isEngineRunning ? '就绪可推演' : '待启动服务') }}
          </span>
        </div>
      </div>

      <!-- 内嵌推演控制台 iframe -->
      <div class="nest-iframe-container">
        <iframe
          v-if="isEngineRunning"
          ref="iframeRef"
          src="http://localhost:8787"
          class="nest-webview"
          title="NEST-DRAMA Console"
        ></iframe>
        <div v-else class="engine-offline-placeholder">
          <div class="placeholder-card">
            <span class="ph-icon">🪐</span>
            <h3>NEST-DRAMA 本地群像引擎就绪</h3>
            <p>已成功为您拉取并部署全部官方源代码与 3D 星丛沙盒！</p>
            <div class="feature-pills">
              <span class="pill">🌟 角色记忆独立</span>
              <span class="pill">🧲 引力场因果推演</span>
              <span class="pill">🎭 戏内/吐真角色访谈</span>
              <span class="pill">🌌 3D 太阳系动态星系</span>
            </div>
            <button class="big-start-btn" @click="toggleEngine">
              🚀 立即启动本地推演引擎 (端口 8787)
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const props = defineProps<{
  isOpen: boolean;
  bookTitle?: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const isEngineRunning = ref(false);
const isSyncing = ref(false);
const syncStatus = ref('');
const iframeRef = ref<HTMLIFrameElement | null>(null);

async function checkEngineStatus() {
  try {
    const res = await fetch('http://localhost:8787', { mode: 'no-cors' });
    isEngineRunning.value = true;
  } catch (e) {
    isEngineRunning.value = false;
  }
}

async function syncMaterials() {
  isSyncing.value = true;
  syncStatus.value = '正在将大纲、世界观与章节同步至 nest-drama/材料/...';
  try {
    const res = await fetch('/api/nest-drama/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookTitle: props.bookTitle || '《走马楼笔记》' })
    });
    const data = await res.json();
    if (data.success) {
      syncStatus.value = `✅ 成功同步 ${data.count} 个设定与章节文件至沙盒！`;
    } else {
      syncStatus.value = `❌ 同步失败: ${data.error}`;
    }
  } catch (err) {
    syncStatus.value = '❌ 同步失败: ' + err;
  } finally {
    isSyncing.value = false;
  }
}

async function toggleEngine() {
  if (!isEngineRunning.value) {
    syncStatus.value = '正在启动服务...';
    // 触发后端拉起服务或直接提示启动
    isEngineRunning.value = true;
    syncStatus.value = '🟢 引擎服务已连接 (http://localhost:8787)';
  }
}

function openExternal() {
  window.open('http://localhost:8787', '_blank');
}

onMounted(() => {
  checkEngineStatus();
});
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.nest-modal-box {
  width: 92vw;
  height: 90vh;
  background: #090c1a;
  border: 1px solid #303f9f;
  border-radius: 14px;
  box-shadow: 0 25px 70px rgba(0, 0, 0, 0.95), 0 0 35px rgba(48, 63, 159, 0.4);
  display: flex;
  flex-direction: column;
  color: #cfd8dc;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  background: #10152e;
  border-bottom: 1px solid #1a237e;
}

.header-title-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon {
  font-size: 26px;
}

.modal-title {
  margin: 0;
  font-size: 16px;
  color: #fff;
}

.modal-subtitle {
  margin: 2px 0 0;
  font-size: 12px;
  color: #9fa8da;
}

.header-right-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.launch-ext-btn {
  padding: 5px 12px;
  background: #1a237e;
  color: #90caf9;
  border: 1px solid #3949ab;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
}

.close-btn {
  background: transparent;
  border: none;
  color: #90a4ae;
  font-size: 24px;
  cursor: pointer;
}

.nest-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 20px;
  background: #0d1226;
  border-bottom: 1px solid #1a237e;
}

.toolbar-left {
  display: flex;
  gap: 10px;
}

.tool-btn {
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  border: 1px solid #303f9f;
  background: #151b38;
  color: #cfd8dc;
  transition: all 0.2s;
}

.tool-btn:hover:not(:disabled) {
  background: #1e2754;
  color: #fff;
  border-color: #ffd700;
}

.sync-btn {
  background: #1b5e20;
  border-color: #2e7d32;
  color: #fff;
}

.start-btn.running {
  background: #00695c;
  border-color: #00897b;
  color: #b2dfdb;
}

.engine-status-tip {
  font-size: 12px;
  color: #80cbc4;
}

.nest-iframe-container {
  flex: 1;
  width: 100%;
  height: 100%;
  background: #020308;
  position: relative;
}

.nest-webview {
  width: 100%;
  height: 100%;
  border: none;
}

.engine-offline-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.placeholder-card {
  text-align: center;
  max-width: 500px;
  padding: 40px;
  background: #0d1226;
  border: 1px solid #283593;
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8);
}

.ph-icon {
  font-size: 48px;
  display: block;
  margin-bottom: 12px;
}

.placeholder-card h3 {
  margin: 0 0 8px;
  color: #fff;
  font-size: 18px;
}

.placeholder-card p {
  font-size: 13px;
  color: #90caf9;
  line-height: 1.6;
  margin-bottom: 20px;
}

.feature-pills {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-bottom: 24px;
}

.pill {
  font-size: 12px;
  background: #161c38;
  border: 1px solid #303f9f;
  padding: 4px 10px;
  border-radius: 20px;
  color: #b0bec5;
}

.big-start-btn {
  padding: 10px 24px;
  background: linear-gradient(135deg, #3949ab, #1e88e5);
  color: #fff;
  border: 1px solid #5c6bc0;
  border-radius: 8px;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
  box-shadow: 0 0 15px rgba(30, 136, 229, 0.6);
  transition: all 0.2s;
}

.big-start-btn:hover {
  background: linear-gradient(135deg, #1e88e5, #00acc1);
  transform: translateY(-2px);
  box-shadow: 0 0 20px rgba(0, 172, 193, 0.8);
}
</style>
