<template>
  <header class="app-titlebar">
    <div class="titlebar-left">
      <div class="logo-badge">
        <div class="logo-icon">码</div>
        <span>码字神器 <span class="badge-sub">Enterprise</span></span>
      </div>
      <div class="status-pill">
        <span class="status-dot"></span>
        <span>{{ saveStatus }}</span>
      </div>
      <button class="open-storage-btn" @click="$emit('open-storage-settings')" title="点击查看并自定义文稿与数据保存位置">
        ⚙️ 存储设置
      </button>
      <button class="open-storage-btn" @click="openLocalFolder" title="在 Windows 资源管理器中打开当前本地物理数据存档目录">
        📂 打开存档
      </button>
    </div>

    <div class="titlebar-right">
      <!-- 🍅 番茄作者后台直通车入口按钮 -->
      <button
        class="tomato-auth-btn"
        :class="{ connected: isTomatoConnected }"
        @click="$emit('open-tomato-modal')"
        :title="isTomatoConnected ? '番茄作家专区已连接 · 点击查看差分与同步' : '点击连接番茄小说作家后台'"
      >
        <span class="tomato-emoji">🍅</span>
        <span>{{ isTomatoConnected ? `番茄已连线 (${tomatoAuthorName || '签约作家'})` : '连接番茄后台' }}</span>
        <span class="status-indicator" :class="{ on: isTomatoConnected }"></span>
      </button>

      <!-- IDE 风格右侧思维导图展开/收起按钮 (保留) -->
      <button
        class="ide-toggle-btn"
        :class="{ active: isMindMapOpen }"
        @click="$emit('toggle-mindmap')"
        title="展开/隐藏右侧思维导图"
      >
        <svg class="ide-toggle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M15 3v18"/>
          <rect v-if="isMindMapOpen" x="15" y="3" width="6" height="18" fill="currentColor" opacity="0.3"/>
        </svg>
      </button>

      <!-- 三色主题快捷切换按钮组 (纯白 / 书卷棕 / 极夜黑) -->
      <div class="theme-switcher-group">
        <button
          class="theme-pill-btn"
          :class="{ active: currentTheme === 'white' }"
          @click="$emit('change-theme', 'white')"
          title="切换至：纯白明亮主题"
        >
          <span class="theme-dot dot-white"></span>
          <span>纯白明亮</span>
        </button>

        <button
          class="theme-pill-btn"
          :class="{ active: currentTheme === 'sepia' }"
          @click="$emit('change-theme', 'sepia')"
          title="切换至：书卷羊皮纸棕主题"
        >
          <span class="theme-dot dot-sepia"></span>
          <span>羊皮纸棕</span>
        </button>

        <button
          class="theme-pill-btn"
          :class="{ active: currentTheme === 'dark' }"
          @click="$emit('change-theme', 'dark')"
          title="切换至：极夜深黑主题"
        >
          <span class="theme-dot dot-dark"></span>
          <span>极夜深黑</span>
        </button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
defineProps<{
  saveStatus: string;
  isMindMapOpen: boolean;
  currentTheme: 'white' | 'sepia' | 'dark';
  isTomatoConnected?: boolean;
  tomatoAuthorName?: string;
}>();

defineEmits<{
  (e: 'toggle-mindmap'): void;
  (e: 'change-theme', theme: 'white' | 'sepia' | 'dark'): void;
  (e: 'open-tomato-modal'): void;
  (e: 'open-storage-settings'): void;
}>();

function openLocalFolder() {
  fetch('/api/storage/open-folder').catch(() => {});
}
</script>

<style scoped>
.open-storage-btn {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.15s;
}

.open-storage-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-main);
  border-color: var(--accent);
}

.app-titlebar {
  height: 48px;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  user-select: none;
  flex-shrink: 0;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.titlebar-left, .titlebar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 800;
  font-size: 14px;
  color: var(--text-main);
}

.logo-icon {
  width: 26px;
  height: 26px;
  background: var(--accent);
  color: #ffffff;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: bold;
}

.badge-sub {
  font-weight: normal;
  font-size: 11px;
  color: var(--text-dim);
  margin-left: 4px;
}

.status-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: var(--bg-secondary);
  border-radius: 20px;
  font-size: 11px;
  color: var(--text-muted);
  border: 1px solid var(--border-color);
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 6px #10b981;
}

/* 番茄后台直通车按钮 */
.tomato-auth-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-main);
  cursor: pointer;
  transition: all 0.15s ease;
}

.tomato-auth-btn:hover {
  border-color: #ea580c;
  background: rgba(234, 88, 12, 0.05);
}

.tomato-auth-btn.connected {
  border-color: #ea580c;
  color: #ea580c;
  background: rgba(234, 88, 12, 0.08);
}

.tomato-emoji {
  font-size: 14px;
}

.status-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #94a3b8;
}

.status-indicator.on {
  background: #10b981;
  box-shadow: 0 0 6px #10b981;
}

.ide-toggle-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 30px;
  border-radius: 6px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  color: var(--text-main);
  cursor: pointer;
  transition: all 0.15s ease;
}

.ide-toggle-btn:hover {
  background: var(--bg-secondary);
  border-color: var(--accent);
  color: var(--accent);
}

.ide-toggle-btn.active {
  background: rgba(79, 70, 229, 0.08);
  border-color: var(--accent);
  color: var(--accent);
}

.ide-toggle-icon {
  width: 17px;
  height: 17px;
}

/* 主题三色切换按钮组 */
.theme-switcher-group {
  display: flex;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  padding: 3px;
  border-radius: 8px;
  gap: 3px;
}

.theme-pill-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 9px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s ease;
}

.theme-pill-btn:hover {
  color: var(--text-main);
}

.theme-pill-btn.active {
  background: var(--bg-primary);
  border-color: var(--border-color);
  color: var(--text-main);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  font-weight: 700;
}

.theme-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  border: 1px solid rgba(0,0,0,0.15);
}

.dot-white { background: #ffffff; }
.dot-sepia { background: #dfd5bd; }
.dot-dark { background: #1e293b; }
</style>
