<template>
  <div v-if="isOpen" class="modal-backdrop" @click.self="close">
    <div class="proofread-dialog">
      <!-- 头部 -->
      <div class="modal-header">
        <div class="modal-title">
          <span class="header-icon">🔍</span>
          <div>
            <div class="title-main">智能文本纠错与病句诊断</div>
            <div class="title-sub">
              本地毫秒级上下文语义分析 · 错别字/语病/标点一键精修 · 专有名词白名单保护
            </div>
          </div>
        </div>
        <button class="close-btn" @click="close" title="关闭 (Esc)">✕</button>
      </div>

      <!-- 诊断统计概览条 -->
      <div class="metrics-bar">
        <div class="metrics-stats">
          <span class="stat-pill total">
            总诊断结果：<strong>{{ result.totalIssues }}</strong> 处
          </span>
          <span v-if="result.typoCount > 0" class="stat-pill typo">
            🔴 错别字：<strong>{{ result.typoCount }}</strong> 处
          </span>
          <span v-if="result.grammarCount > 0" class="stat-pill grammar">
            🟡 语法病句：<strong>{{ result.grammarCount }}</strong> 处
          </span>
          <span v-if="result.punctuationCount > 0" class="stat-pill punctuation">
            🔵 标点规范：<strong>{{ result.punctuationCount }}</strong> 处
          </span>
          <span class="stat-speed">⚡ 扫描耗时：{{ result.costMs }} 毫秒 ({{ result.checkedCharCount }} 字)</span>
        </div>

        <div class="metrics-actions">
          <button
            v-if="result.totalIssues > 0"
            class="batch-fix-btn"
            @click="handleApplyAllFixes"
            title="一键自动采纳并修复列表中的全部建议"
          >
            ⚡ 一键修复全部 ({{ result.totalIssues }}处)
          </button>
        </div>
      </div>

      <!-- 主体列表区域 -->
      <div class="modal-body">
        <!-- 零错误完美状态 -->
        <div v-if="result.totalIssues === 0" class="empty-state">
          <span class="empty-icon">🎉</span>
          <div class="empty-title">太棒了！本章节文稿未发现明显错别字或语病！</div>
          <div class="empty-sub">
            所有成语、同音量词、结构助词（的得地）及双引号标点均规范完整。
          </div>
        </div>

        <!-- 错误卡片流 -->
        <div v-else class="issues-list">
          <div
            v-for="(item, idx) in result.items"
            :key="item.id || idx"
            class="issue-card"
            :class="item.type"
          >
            <div class="card-header">
              <div class="tag-group">
                <span class="type-badge" :class="item.type">
                  {{ item.type === 'typo' ? '错别字' : item.type === 'grammar' ? '语法病句' : '标点规范' }}
                </span>
                <span class="subtype-name">{{ item.typeName }}</span>
                <span class="confidence-tag">置信度 {{ Math.round(item.confidence * 100) }}%</span>
              </div>

              <div class="card-actions">
                <button
                  class="action-btn replace-btn"
                  @click="handleApplySingleFix(item)"
                  title="采纳此条修改建议"
                >
                  ✓ 采纳修改
                </button>
                <button
                  class="action-btn ignore-btn"
                  @click="handleIgnoreItem(item)"
                  title="忽略此条并加入白名单"
                >
                  ✕ 忽略 / 加入白名单
                </button>
              </div>
            </div>

            <!-- 上下文高亮预览 -->
            <div class="card-snippet">
              <span class="snippet-prefix">语境预览：</span>
              <span class="snippet-body">
                {{ getSnippetBefore(item) }}
                <strong class="highlight-wrong">{{ item.originalText }}</strong>
                {{ getSnippetAfter(item) }}
              </span>
            </div>

            <!-- 建议修改对比 -->
            <div class="card-suggestion">
              <div class="diff-pill">
                <span class="wrong-val">{{ item.originalText }}</span>
                <span class="arrow">➔</span>
                <span class="correct-val">{{ item.suggestedText }}</span>
              </div>
              <div class="explanation-text">{{ item.explanation }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部操作栏 -->
      <div class="modal-footer">
        <div class="footer-tip">
          💡 提示：专有名词（如主角名、独创功法与地名）会自动加入白名单，绝不误报。
        </div>
        <button class="footer-btn primary" @click="close">完成检视</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { ProofreadResult, ProofreadItem } from '../utils/proofreader';

const props = defineProps<{
  isOpen: boolean;
  result: ProofreadResult;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'apply-fix', item: ProofreadItem): void;
  (e: 'apply-all-fixes', items: ProofreadItem[]): void;
  (e: 'ignore-item', item: ProofreadItem): void;
}>();

function close() {
  emit('close');
}

function handleApplySingleFix(item: ProofreadItem) {
  emit('apply-fix', item);
}

function handleApplyAllFixes() {
  emit('apply-all-fixes', props.result.items);
}

function handleIgnoreItem(item: ProofreadItem) {
  emit('ignore-item', item);
}

function getSnippetBefore(item: ProofreadItem): string {
  const s = item.contextSnippet;
  const idx = s.indexOf(item.originalText);
  return idx > 0 ? s.slice(0, idx) : '';
}

function getSnippetAfter(item: ProofreadItem): string {
  const s = item.contextSnippet;
  const idx = s.indexOf(item.originalText);
  return idx !== -1 ? s.slice(idx + item.originalText.length) : '';
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.proofread-dialog {
  width: 760px;
  max-width: 95vw;
  max-height: 85vh;
  background: var(--bg-primary, #ffffff);
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border-color, #e5e7eb);
}

.modal-header {
  padding: 16px 20px;
  background: var(--bg-secondary, #f9fafb);
  border-bottom: 1px solid var(--border-color, #e5e7eb);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon {
  font-size: 24px;
}

.title-main {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-main, #111827);
}

.title-sub {
  font-size: 11px;
  color: var(--text-muted, #6b7280);
  margin-top: 2px;
}

.close-btn {
  background: none;
  border: none;
  font-size: 18px;
  color: var(--text-muted, #9ca3af);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
}

.close-btn:hover {
  background: var(--bg-tertiary, #e5e7eb);
  color: var(--text-main, #111827);
}

/* 统计条 */
.metrics-bar {
  padding: 10px 20px;
  background: var(--bg-tertiary, #f3f4f6);
  border-bottom: 1px solid var(--border-color, #e5e7eb);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.metrics-stats {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.stat-pill {
  padding: 2px 8px;
  border-radius: 6px;
  font-weight: 500;
}

.stat-pill.total { background: #e0e7ff; color: #3730a3; }
.stat-pill.typo { background: #fee2e2; color: #991b1b; }
.stat-pill.grammar { background: #fef3c7; color: #92400e; }
.stat-pill.punctuation { background: #e0f2fe; color: #075985; }
.stat-speed { font-size: 11px; color: var(--text-muted, #6b7280); margin-left: 6px; }

.batch-fix-btn {
  padding: 5px 12px;
  background: #10b981;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.batch-fix-btn:hover {
  background: #059669;
  transform: translateY(-1px);
}

/* 列表区 */
.modal-body {
  padding: 16px 20px;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.empty-state {
  padding: 48px 20px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.empty-icon { font-size: 40px; }
.empty-title { font-size: 15px; font-weight: 700; color: #10b981; }
.empty-sub { font-size: 12px; color: var(--text-muted, #6b7280); }

.issues-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.issue-card {
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 8px;
  padding: 12px 16px;
  background: var(--bg-primary, #ffffff);
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: border-color 0.15s;
}

.issue-card:hover {
  border-color: #3b82f6;
}

.issue-card.typo { border-left: 4px solid #ef4444; }
.issue-card.grammar { border-left: 4px solid #f59e0b; }
.issue-card.punctuation { border-left: 4px solid #3b82f6; }

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.tag-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.type-badge {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
}

.type-badge.typo { background: #fee2e2; color: #b91c1c; }
.type-badge.grammar { background: #fef3c7; color: #b45309; }
.type-badge.punctuation { background: #dbeafe; color: #1d4ed8; }

.subtype-name { font-size: 12px; font-weight: 600; color: var(--text-main, #1f2937); }
.confidence-tag { font-size: 11px; color: var(--text-muted, #9ca3af); }

.card-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.action-btn {
  padding: 3px 10px;
  font-size: 11px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}

.replace-btn {
  background: #2563eb;
  color: #fff;
  border: 1px solid #2563eb;
}

.replace-btn:hover { background: #1d4ed8; }

.ignore-btn {
  background: var(--bg-secondary, #f3f4f6);
  color: var(--text-muted, #6b7280);
  border: 1px solid var(--border-color, #d1d5db);
}

.ignore-btn:hover { background: #e5e7eb; color: var(--text-main, #111827); }

.card-snippet {
  font-size: 13px;
  color: var(--text-main, #374151);
  background: var(--bg-secondary, #f9fafb);
  padding: 6px 10px;
  border-radius: 6px;
  line-height: 1.5;
}

.snippet-prefix { font-size: 11px; color: var(--text-muted, #9ca3af); }
.highlight-wrong {
  color: #dc2626;
  background: #fee2e2;
  padding: 1px 4px;
  border-radius: 3px;
  text-decoration: underline wavy #dc2626;
}

.card-suggestion {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.diff-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  padding: 2px 8px;
  background: var(--bg-tertiary, #f3f4f6);
  border-radius: 4px;
}

.wrong-val { color: #dc2626; text-decoration: line-through; }
.arrow { color: var(--text-muted, #9ca3af); font-size: 10px; }
.correct-val { color: #16a34a; }

.explanation-text {
  font-size: 11px;
  color: var(--text-muted, #6b7280);
  flex: 1;
}

/* 底部操作 */
.modal-footer {
  padding: 12px 20px;
  background: var(--bg-secondary, #f9fafb);
  border-top: 1px solid var(--border-color, #e5e7eb);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.footer-tip {
  font-size: 11px;
  color: var(--text-muted, #6b7280);
}

.footer-btn.primary {
  padding: 6px 18px;
  background: var(--accent, #3b82f6);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  font-weight: 500;
}

.footer-btn.primary:hover {
  background: #2563eb;
}
</style>
