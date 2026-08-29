<template>
  <div v-if="isOpen" class="modal-backdrop" @click.self="close">
    <div class="create-novel-dialog">
      <!-- 头部 -->
      <div class="modal-header">
        <div class="header-left">
          <span class="header-icon">📖</span>
          <div>
            <div class="title-main">新建小说作品</div>
            <div class="title-sub">选择【纯本地物理建档】或【番茄官方同步建书】</div>
          </div>
        </div>
        <button class="close-btn" @click="close" title="关闭 (Esc)">✕</button>
      </div>

      <!-- 主体表单 -->
      <div class="modal-body">
        <!-- 核心建书模式二选一卡片 (超醒目视觉选择) -->
        <div class="mode-selection-grid">
          <div
            class="mode-card"
            :class="{ active: creationMode === 'local' }"
            @click="creationMode = 'local'"
          >
            <div class="mode-radio-circle">
              <div v-if="creationMode === 'local'" class="radio-inner"></div>
            </div>
            <div class="mode-content">
              <div class="mode-title-row">
                <span class="mode-icon">💻</span>
                <span class="mode-name">纯本地私密建档</span>
                <span class="mode-tag tag-local">无需登录 · 离线私密</span>
              </div>
              <div class="mode-desc">
                仅在本地硬盘创建专属小说文件夹、章节TXT正文、大纲导图、人物卡与伏笔看板。
              </div>
            </div>
          </div>

          <div
            class="mode-card"
            :class="{ active: creationMode === 'tomato' }"
            @click="creationMode = 'tomato'"
          >
            <div class="mode-radio-circle">
              <div v-if="creationMode === 'tomato'" class="radio-inner tomato"></div>
            </div>
            <div class="mode-content">
              <div class="mode-title-row">
                <span class="mode-icon">🍅</span>
                <span class="mode-name">番茄官方同步建书</span>
                <span class="mode-tag tag-tomato">官方云端 · 一键直发</span>
              </div>
              <div class="mode-desc">
                本地建档的同时，自动在【番茄作家专区】后台同步创建官方新书骨架，后续可一键发表。
              </div>
            </div>
          </div>
        </div>

        <!-- 基础信息表单 -->
        <div class="form-group">
          <label class="form-label">
            <span>作品书名</span>
            <span class="required">*</span>
          </label>
          <input
            ref="titleInputRef"
            v-model="formTitle"
            class="form-input highlight"
            placeholder="例如：《走马楼笔记：地下盲谷》..."
            @keydown.enter="handleConfirm"
          />
        </div>

        <!-- 番茄模式特有选项 (分类/频道/标签) -->
        <div v-if="creationMode === 'tomato'" class="tomato-extra-section">
          <div class="section-badge-bar">
            <span>🍅 番茄作家平台分类与签约属性</span>
          </div>

          <div class="form-row">
            <div class="form-group flex-1">
              <label class="form-label">作品主分类 / 题材：</label>
              <select v-model="formCategory" class="form-select">
                <option value="悬疑">🔍 悬疑灵异 / 中式民俗</option>
                <option value="都市">🏙️ 都市生活 / 职场逆袭</option>
                <option value="玄幻">⚡ 玄幻修真 / 东方神话</option>
                <option value="科幻">🚀 科幻未来 / 规则怪谈</option>
                <option value="历史">📜 历史架空 / 古代穿越</option>
                <option value="游戏">🎮 游戏竞技 / 异界征伐</option>
              </select>
            </div>

            <div class="form-group flex-1">
              <label class="form-label">频道受众：</label>
              <div class="gender-pill-group">
                <button
                  type="button"
                  class="gender-pill"
                  :class="{ active: formGender === '1' }"
                  @click="formGender = '1'"
                >
                  ♂️ 男频
                </button>
                <button
                  type="button"
                  class="gender-pill"
                  :class="{ active: formGender === '2' }"
                  @click="formGender = '2'"
                >
                  ♀️ 女频
                </button>
                <button
                  type="button"
                  class="gender-pill"
                  :class="{ active: formGender === '0' }"
                  @click="formGender = '0'"
                >
                  🌐 通用
                </button>
              </div>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">官方搜索标签 (逗号分隔)：</label>
            <input
              v-model="formTags"
              class="form-input"
              placeholder="例如：微观现实主义,中式微恐,探险,神级反转"
            />
          </div>
        </div>

        <!-- 通用简介立意 -->
        <div class="form-group">
          <label class="form-label">主线核心立意与简介 (选填，后续可随时双击修改)：</label>
          <textarea
            v-model="formSynopsis"
            class="form-textarea"
            placeholder="简述故事开端、核心悬念冲突与主角的欲望动机..."
          ></textarea>
        </div>
      </div>

      <!-- 底部操作栏 -->
      <div class="modal-footer">
        <button class="footer-btn secondary" @click="close">取消</button>
        <button
          class="footer-btn"
          :class="creationMode === 'tomato' ? 'primary-tomato' : 'primary-local'"
          :disabled="isCreating || !formTitle.trim()"
          @click="handleConfirm"
        >
          <span v-if="isCreating">⏳ 正在建立作品骨架……</span>
          <span v-else-if="creationMode === 'tomato'">🍅 同步创建番茄官方新书</span>
          <span v-else>💻 立即创建本地作品</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'created', payload: {
    title: string;
    category: string;
    gender: string;
    tags: string;
    synopsis: string;
    syncToTomato: boolean;
  }): void;
}>();

const creationMode = ref<'local' | 'tomato'>('local');
const formTitle = ref('');
const formCategory = ref('悬疑');
const formGender = ref('1');
const formTags = ref('悬疑,探险,民俗');
const formSynopsis = ref('');
const isCreating = ref(false);
const titleInputRef = ref<HTMLInputElement | null>(null);

function close() {
  emit('close');
}

function handleConfirm() {
  const t = formTitle.value.trim();
  if (!t) return;
  isCreating.value = true;
  emit('created', {
    title: t,
    category: formCategory.value,
    gender: formGender.value,
    tags: formTags.value,
    synopsis: formSynopsis.value,
    syncToTomato: creationMode.value === 'tomato'
  });
}

watch(
  () => props.isOpen,
  (val) => {
    if (val) {
      formTitle.value = '';
      formSynopsis.value = '';
      isCreating.value = false;
      nextTick(() => {
        titleInputRef.value?.focus();
      });
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
  z-index: 9300;
  padding: 20px;
}

.create-novel-dialog {
  width: 100%;
  max-width: 620px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  max-height: 90vh;
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
  gap: 16px;
  overflow-y: auto;
}

/* 核心二选一模式选择卡片 */
.mode-selection-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.mode-card {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 12px 16px;
  border: 1.5px solid var(--border-color);
  background: var(--bg-secondary);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.mode-card:hover {
  border-color: var(--accent);
  background: var(--bg-primary);
  transform: translateY(-1px);
}

.mode-card.active {
  border-color: var(--accent);
  background: rgba(79, 70, 229, 0.05);
  box-shadow: 0 4px 14px rgba(79, 70, 229, 0.1);
}

.mode-card.active:has(.tomato) {
  border-color: #ef4444;
  background: rgba(239, 68, 68, 0.05);
  box-shadow: 0 4px 14px rgba(239, 68, 68, 0.1);
}

.mode-radio-circle {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid var(--border-color);
  margin-top: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s;
}

.mode-card.active .mode-radio-circle {
  border-color: var(--accent);
}

.mode-card.active:has(.tomato) .mode-radio-circle {
  border-color: #ef4444;
}

.radio-inner {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--accent);
}

.radio-inner.tomato {
  background: #ef4444;
}

.mode-content {
  flex: 1;
}

.mode-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mode-icon {
  font-size: 16px;
}

.mode-name {
  font-size: 14px;
  font-weight: 800;
  color: var(--text-main);
}

.mode-tag {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 4px;
}

.tag-local {
  background: rgba(16, 185, 129, 0.12);
  color: #059669;
}

.tag-tomato {
  background: rgba(239, 68, 68, 0.12);
  color: #dc2626;
}

.mode-desc {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 4px;
  line-height: 1.4;
}

/* 番茄额外属性框 */
.tomato-extra-section {
  padding: 12px 14px;
  background: rgba(239, 68, 68, 0.04);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

.section-badge-bar {
  font-size: 12px;
  font-weight: 800;
  color: #dc2626;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-row {
  display: flex;
  gap: 12px;
}

.flex-1 {
  flex: 1;
}

.form-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-main);
  display: flex;
  align-items: center;
  gap: 4px;
}

.required {
  color: #ef4444;
}

.form-input {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 9px 12px;
  font-size: 13px;
  color: var(--text-main);
  outline: none;
  transition: all 0.15s;
}

.form-input:focus {
  border-color: var(--accent);
  background: var(--bg-primary);
}

.form-input.highlight {
  font-weight: 700;
}

.form-select {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 13px;
  color: var(--text-main);
  outline: none;
}

.form-select:focus {
  border-color: var(--accent);
}

.gender-pill-group {
  display: flex;
  gap: 6px;
}

.gender-pill {
  flex: 1;
  padding: 7px 0;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  font-size: 12px;
  font-weight: 700;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.gender-pill:hover {
  background: var(--bg-tertiary);
  color: var(--text-main);
}

.gender-pill.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #ffffff;
}

.form-textarea {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 9px 12px;
  font-size: 12px;
  color: var(--text-main);
  outline: none;
  min-height: 60px;
  resize: vertical;
}

.form-textarea:focus {
  border-color: var(--accent);
  background: var(--bg-primary);
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
  padding: 8px 20px;
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

.footer-btn.secondary:hover {
  background: var(--bg-tertiary);
  color: var(--text-main);
}

.footer-btn.primary-local {
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  border: none;
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(79, 70, 229, 0.3);
}

.footer-btn.primary-local:hover:not(:disabled) {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

.footer-btn.primary-tomato {
  background: linear-gradient(135deg, #ef4444, #ea580c);
  border: none;
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
}

.footer-btn.primary-tomato:hover:not(:disabled) {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

.footer-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
