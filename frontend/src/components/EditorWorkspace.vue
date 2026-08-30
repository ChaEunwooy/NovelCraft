<template>
  <div class="editor-workspace">
    <!-- 编辑器顶部快捷操作栏 -->
    <div class="editor-header">
      <div class="title-input-wrapper">
        <input
          type="text"
          class="chapter-title-input"
          v-model="localTitle"
          @focus="isEditorFocused = true"
          @blur="isEditorFocused = false"
          @input="onTitleInput"
          placeholder="在此输入章节标题..."
          title="点击即可直接修改本章标题"
        />
      </div>

      <div class="editor-actions">
        <!-- 实时码字时速与状态指示灯 -->
        <div class="timer-speed-badge" :title="`当前状态：${isCurrentlyTyping ? '正在飞速打字' : '正在构思剧情'}`">
          <span class="pulse-dot" :class="{ 'pulse-typing': isCurrentlyTyping, 'pulse-thinking': !isCurrentlyTyping }"></span>
          <span class="speed-text">⚡ {{ currentSpeed }} 字/时</span>
        </div>

        <button class="editor-btn proofread-btn" @click="$emit('open-proofread')" title="启动本地毫秒级错别字与语病智能诊断 (MacBERT-Lite)">
          <span>🔍 智能纠错</span>
        </button>
        <button class="editor-btn" @click="handleFormat" title="一键标准缩进与中文标点规范化">
          <span>✨ 一键排版</span>
        </button>
        <button class="editor-btn clue-btn" @click="handleMarkClue" title="将当前选中内容或光标所在段落记录为伏笔">
          <span>🗝️ 记伏笔</span>
        </button>
        <!-- 1. 检测到已发布但本地修改过 (modified) -> 提交修改后的版本 -->
        <button
          v-if="chapter?.publishStatus === 'modified'"
          class="editor-btn tomato-mod-btn"
          @click="$emit('push-tomato-publish')"
          title="检测到正文或标题在本地被修改，点击将修改后的最新版本提交更新至番茄后台"
        >
          <span>🚀 提交修改后的版本</span>
        </button>

        <!-- 2. 已发布且本地完全一致 (published) -> 显示已发稿徽标 -->
        <div
          v-else-if="chapter?.publishStatus === 'published'"
          class="editor-published-tag"
          title="本章已在番茄小说正式发稿，且本地内容与线上版本完全一致"
        >
          <span>🟢 番茄已发稿 (已对齐)</span>
        </div>

        <!-- 3. 本地未提交或草稿箱 (unpushed / draft) -->
        <template v-else>
          <button
            class="editor-btn tomato-btn"
            @click="$emit('push-tomato-draft')"
            title="一键直接提交到番茄小说作家后台草稿箱"
          >
            <span>🍅 存番茄草稿</span>
          </button>
          <button
            class="editor-btn tomato-pub-btn"
            @click="$emit('push-tomato-publish')"
            title="直接发表本章至番茄小说"
          >
            <span>🚀 提交发布到番茄</span>
          </button>
        </template>
      </div>
    </div>

    <!-- 沉浸式正文输入区 (自适应白/棕/黑主题 + 回车自动空两格) -->
    <div class="editor-body-container">
      <textarea
        ref="textareaRef"
        class="novel-textarea"
        v-model="localContent"
        @focus="isEditorFocused = true"
        @blur="isEditorFocused = false"
        @keydown="handleKeyDown"
        @input="onContentInput"
        placeholder="在此输入章节正文……"
      ></textarea>
    </div>

    <!-- 底部状态栏 (章节独立打字时间与思考时间看板) -->
    <footer class="editor-statusbar">
      <div class="statusbar-left">
        <span class="status-strong">本章字数：{{ (chapter?.wordCount || 0).toLocaleString() }} 字</span>
        <span>段落数：{{ chapter?.paragraphCount || 0 }} 段</span>
        <!-- 今日打字时间与思考时间 (每日0点自动重置) -->
        <span class="timer-item" title="今日累计键盘连续打字时间（每日0点自动清零重置）">
          ⌨️ 今日打字：<strong class="timer-value text-indigo">{{ formatDuration(typingSeconds) }}</strong>
        </span>
        <span class="timer-item" title="今日累计停顿构思思考时间（每日0点自动清零重置）">
          🤔 今日思考：<strong class="timer-value text-amber">{{ formatDuration(thinkingSeconds) }}</strong>
        </span>
        <button class="reset-metrics-pill" @click="resetDailyMetrics" title="手动重置今日码字与思考时间">
          🔄 重置今日统计
        </button>
      </div>

      <div class="statusbar-right">
        <span>回车：自动缩进全角两格</span>
        <span>存储：本地毫秒落盘</span>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue';
import type { Chapter } from '../types/novel';

const props = defineProps<{
  chapter?: Chapter;
}>();

const emit = defineEmits<{
  (e: 'update-title', title: string): void;
  (e: 'update-chapter', title: string, content: string): void;
  (e: 'update-metrics', typingTime: number, thinkingTime: number, metricsDate?: string): void;
  (e: 'push-tomato-draft'): void;
  (e: 'push-tomato-publish'): void;
  (e: 'format-text'): void;
  (e: 'open-proofread'): void;
  (e: 'mark-clue', payload: { quoteText: string; paragraphIndex: number }): void;
}>();

const textareaRef = ref<HTMLTextAreaElement | null>(null);

function handleMarkClue() {
  const el = textareaRef.value;
  let quote = '';
  let paraIdx = 1;

  if (el) {
    const text = el.value || '';
    const start = el.selectionStart || 0;
    const end = el.selectionEnd || 0;
    
    // 划词选中文本
    if (end > start) {
      quote = text.substring(start, end).trim();
    }
    
    // 计算段落号
    const beforeCursor = text.substring(0, start);
    const paragraphs = beforeCursor.split('\n').filter(p => p.trim());
    paraIdx = Math.max(1, paragraphs.length);

    if (!quote) {
      const allParas = text.split('\n').filter(p => p.trim());
      if (allParas[paraIdx - 1]) {
        quote = allParas[paraIdx - 1].trim();
      }
    }
  }

  emit('mark-clue', { quoteText: quote, paragraphIndex: paraIdx });
}

// 🚀 本地强响应式正文与标题缓存（v-model直连，彻底杜绝打字丢光标或被外部重置）
const localTitle = ref(props.chapter?.title || '');
const localContent = ref(props.chapter?.content || '');
const isEditorFocused = ref(false);

// 计时状态 (各章节完全独立)
const typingSeconds = ref(0);
const thinkingSeconds = ref(0);
const isCurrentlyTyping = ref(false);
const currentSpeed = ref(0);

let lastKeystrokeTime = 0;
let timerInterval: any = null;
let saveTimer: any = null;

function getTodayDateStr(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function resetDailyMetrics() {
  typingSeconds.value = 0;
  thinkingSeconds.value = 0;
  const today = getTodayDateStr();
  if (props.chapter) {
    props.chapter.typingTimeSeconds = 0;
    props.chapter.thinkingTimeSeconds = 0;
    props.chapter.metricsDate = today;
  }
  emit('update-metrics', 0, 0, today);
}

// 当切换章节时，重新对齐本章标题、正文与每日计时数据
watch(
  () => props.chapter?.id,
  (newId, oldId) => {
    const today = getTodayDateStr();
    // 1. 保存上一章的计时
    if (oldId) {
      emit('update-metrics', typingSeconds.value, thinkingSeconds.value, today);
    }
    // 2. 载入新章节的独立计时数据与正文 (跨天自动重置为0)
    if (props.chapter) {
      localTitle.value = props.chapter.title || '';
      localContent.value = props.chapter.content || '';
      
      // 🌟 跨天自动重置：如果保存的记录不是今天，则自动清零重置为 0
      if (props.chapter.metricsDate && props.chapter.metricsDate !== today) {
        typingSeconds.value = 0;
        thinkingSeconds.value = 0;
        props.chapter.typingTimeSeconds = 0;
        props.chapter.thinkingTimeSeconds = 0;
        props.chapter.metricsDate = today;
        emit('update-metrics', 0, 0, today);
      } else {
        typingSeconds.value = props.chapter.typingTimeSeconds || 0;
        thinkingSeconds.value = props.chapter.thinkingTimeSeconds || 0;
        props.chapter.metricsDate = today;
      }
    } else {
      localTitle.value = '';
      localContent.value = '';
      typingSeconds.value = 0;
      thinkingSeconds.value = 0;
    }
    isCurrentlyTyping.value = false;
    lastKeystrokeTime = 0;
    recalculateSpeed();
  },
  { immediate: true }
);

// 外部磁盘数据热推进来时，若当前用户未聚焦打字，则安全同步
watch(
  () => props.chapter?.content,
  (newVal) => {
    if (!isEditorFocused.value && newVal !== undefined && newVal !== localContent.value) {
      localContent.value = newVal;
    }
  }
);

watch(
  () => props.chapter?.title,
  (newVal) => {
    if (!isEditorFocused.value && newVal !== undefined && newVal !== localTitle.value) {
      localTitle.value = newVal;
    }
  }
);

onMounted(() => {
  // 启动 1 秒心跳计时器
  timerInterval = setInterval(() => {
    if (!props.chapter) return;

    const today = getTodayDateStr();
    // 🌟 实时跨天检测（例如写作跨过午夜0点时自动清零重置）
    if (props.chapter.metricsDate && props.chapter.metricsDate !== today) {
      typingSeconds.value = 0;
      thinkingSeconds.value = 0;
      props.chapter.typingTimeSeconds = 0;
      props.chapter.thinkingTimeSeconds = 0;
      props.chapter.metricsDate = today;
      emit('update-metrics', 0, 0, today);
      return;
    }

    const now = Date.now();
    // 如果最近 2.5 秒内有按键输入，判定为正在打字
    if (lastKeystrokeTime > 0 && now - lastKeystrokeTime < 2500) {
      isCurrentlyTyping.value = true;
      typingSeconds.value++;
    } else {
      // 超过 2.5 秒未击键，判定为构思思考时间
      isCurrentlyTyping.value = false;
      // 只要用户在当前章节打开停留，就累加思考时间
      thinkingSeconds.value++;
    }

    recalculateSpeed();

    // 每 10 秒自动固化一次计时数据
    if ((typingSeconds.value + thinkingSeconds.value) % 10 === 0) {
      emit('update-metrics', typingSeconds.value, thinkingSeconds.value, today);
    }
  }, 1000);
});

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval);
  if (saveTimer) clearTimeout(saveTimer);
});

// 计算实时码字时速 (字/小时)
function recalculateSpeed() {
  const words = props.chapter?.wordCount || 0;
  const tSeconds = typingSeconds.value;

  if (tSeconds >= 10 && words > 0) {
    const hours = tSeconds / 3600;
    currentSpeed.value = Math.min(12000, Math.round(words / hours));
  } else if (words > 0) {
    currentSpeed.value = Math.min(3500, words * 60);
  } else {
    currentSpeed.value = 0;
  }
}

// 格式化时间显示 (分:秒 或 时:分)
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}秒`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) {
    return `${mins}分${secs < 10 ? '0' + secs : secs}秒`;
  }
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hrs}小时${remMins}分`;
}

// 键盘按键事件监听 (回车自动首行缩进两个全角空格)
function handleKeyDown(e: KeyboardEvent) {
  lastKeystrokeTime = Date.now();
  isCurrentlyTyping.value = true;

  // 核心功能：回车自动空两个全角空格（\u3000\u3000）
  if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
    const textarea = textareaRef.value;
    if (!textarea) return;

    e.preventDefault();

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;

    // 插入 换行符 + 两个全角空格（\u3000\u3000）
    const insertText = '\n　　';
    const newContent = value.substring(0, start) + insertText + value.substring(end);

    // 更新文本框并精确定位光标到两个空格之后
    textarea.value = newContent;
    const newCursorPos = start + insertText.length;
    textarea.selectionStart = newCursorPos;
    textarea.selectionEnd = newCursorPos;

    localContent.value = newContent;
    onContentInput();
  }
}

function onTitleInput() {
  lastKeystrokeTime = Date.now();
  emit('update-title', localTitle.value);
  triggerDebouncedSave(localTitle.value, localContent.value);
}

function onContentInput() {
  lastKeystrokeTime = Date.now();
  triggerDebouncedSave(localTitle.value, localContent.value);
}

function triggerDebouncedSave(title: string, content: string) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    emit('update-chapter', title, content);
  }, 250);
}

function handleFormat() {
  emit('format-text');
}
</script>

<style scoped>
.editor-workspace {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--editor-bg);
  min-width: 0;
  height: 100%;
  transition: background-color 0.2s ease;
}

.editor-header {
  height: 48px;
  padding: 0 20px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg-primary);
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.title-input-wrapper {
  flex: 1;
  max-width: 50%;
}

.chapter-title-input {
  font-size: 15px;
  font-weight: 800;
  color: var(--text-main);
  border: 1px solid transparent;
  padding: 4px 8px;
  border-radius: 6px;
  outline: none;
  background: transparent;
  width: 100%;
  transition: all 0.15s ease;
}

.chapter-title-input:hover {
  background: var(--bg-secondary);
  border-color: var(--border-color);
}

.chapter-title-input:focus {
  background: var(--bg-primary);
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.1);
}

.editor-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 动态时速胶囊徽章 */
.timer-speed-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 9px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 20px;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-main);
}

.pulse-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.pulse-typing {
  background: #10b981;
  box-shadow: 0 0 8px #10b981;
  animation: pulse 1s infinite alternate;
}

.pulse-thinking {
  background: #f59e0b;
  box-shadow: 0 0 6px #f59e0b;
}

@keyframes pulse {
  0% { transform: scale(0.9); opacity: 0.7; }
  100% { transform: scale(1.3); opacity: 1; }
}

.editor-btn {
  padding: 4px 10px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.editor-btn:hover {
  background: var(--bg-secondary);
  border-color: var(--accent);
  color: var(--accent);
}

.editor-btn.clue-btn {
  border-color: rgba(245, 158, 11, 0.4);
  color: #f59e0b;
}

.editor-btn.clue-btn:hover {
  background: rgba(245, 158, 11, 0.15);
  border-color: #f59e0b;
  color: #fbbf24;
}

.editor-btn.active {
  background: rgba(79, 70, 229, 0.08);
  border-color: var(--accent);
  color: var(--accent);
}

.tomato-btn {
  border-color: #ea580c;
  color: #ea580c;
  background: rgba(234, 88, 12, 0.06);
}

.tomato-btn:hover {
  background: #ea580c;
  color: #ffffff;
}

.tomato-pub-btn {
  background: #ea580c;
  border-color: #ea580c;
  color: #ffffff;
  font-weight: 700;
}

.tomato-pub-btn:hover {
  background: #c2410c;
}

.tomato-mod-btn {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  border-color: #dc2626;
  color: #ffffff;
  font-weight: 700;
  box-shadow: 0 2px 8px rgba(220, 38, 38, 0.3);
}

.tomato-mod-btn:hover {
  background: #b91c1c;
  transform: translateY(-1px);
}

.editor-published-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(16, 185, 129, 0.35);
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  color: #059669;
  user-select: none;
}

.editor-body-container {
  flex: 1;
  overflow: hidden;
  padding: 16px 8%;
  display: flex;
  justify-content: center;
  background: var(--editor-bg);
  transition: background-color 0.2s ease;
}

.novel-textarea {
  width: 100%;
  max-width: 860px;
  height: 100%;
  padding: 20px 40px 160px 40px; /* 充足的呼吸留白，文字绝不贴着滚动条 */
  background: transparent;
  border: none;
  outline: none;
  resize: none;
  box-sizing: border-box;
  font-family: "Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", "SimSun", "Noto Serif SC", sans-serif;
  font-size: 17px;
  line-height: 1.95;
  color: var(--editor-text);
  letter-spacing: 0.6px;
  transition: color 0.2s ease;

  /* 优雅纤细滚动条支持 */
  scrollbar-width: thin;
  scrollbar-color: rgba(150, 150, 150, 0.2) transparent;
}

/* Chrome / Safari / Edge 纤细半透明悬浮滚动条 */
.novel-textarea::-webkit-scrollbar {
  width: 6px;
}

.novel-textarea::-webkit-scrollbar-track {
  background: transparent;
}

.novel-textarea::-webkit-scrollbar-thumb {
  background: rgba(150, 150, 150, 0.2);
  border-radius: 4px;
  transition: background 0.2s;
}

.novel-textarea::-webkit-scrollbar-thumb:hover {
  background: rgba(150, 150, 150, 0.45);
}

.novel-textarea::placeholder {
  color: var(--text-dim);
  opacity: 0.5;
  font-family: inherit;
  font-size: 17px;
  user-select: none;
  pointer-events: none;
}

.editor-statusbar {
  height: 32px;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  font-size: 11px;
  color: var(--text-dim);
  user-select: none;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.statusbar-left, .statusbar-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.status-strong {
  color: var(--text-main);
  font-weight: 700;
}

.timer-item {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.timer-value {
  font-weight: 700;
}

.text-indigo {
  color: var(--accent);
}

.text-amber {
  color: #d97706;
}
</style>

<style scoped>

.reset-metrics-pill {
  margin-left: 8px;
  padding: 2px 8px;
  background: var(--bg-tertiary, #f3f4f6);
  color: var(--text-muted, #6b7280);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 12px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s ease;
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.reset-metrics-pill:hover {
  background: #ef4444;
  color: #ffffff;
  border-color: #ef4444;
}

</style>

<style scoped>

.proofread-btn {
  background: rgba(59, 130, 246, 0.08) !important;
  color: #2563eb !important;
  border-color: rgba(59, 130, 246, 0.3) !important;
}

.proofread-btn:hover {
  background: #2563eb !important;
  color: #ffffff !important;
  border-color: #2563eb !important;
}

</style>
