<template>
  <div v-if="isOpen" class="modal-backdrop" @click.self="$emit('close')">
    <div class="dupian-modal-box">
      <!-- 弹窗顶部标题栏 -->
      <div class="modal-header">
        <div class="header-title-group">
          <span class="header-icon">🛡️</span>
          <div>
            <h3 class="modal-title">毒编机检 · 零 Token 去 AI 腔智能诊断</h3>
            <p class="modal-subtitle">基于 NEST-DRAMA 人类小说百万语料基线 · 零成本毫秒级脱水修复</p>
          </div>
        </div>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>

      <!-- 弹窗主体内容 -->
      <div class="modal-body">
        <!-- 正在加载中 -->
        <div v-if="isLoading" class="loading-state">
          <div class="spinner"></div>
          <p>正在运用千万字人类小说语料基线比对诊断中...</p>
        </div>

        <!-- 诊断结果展示 -->
        <template v-else>
          <!-- 顶部评分与核心仪表盘 -->
          <div class="score-dashboard">
            <div class="score-circle-card" :class="scoreClass">
              <div class="score-num">{{ humanScore }}</div>
              <div class="score-label">真人质感指数</div>
              <div class="score-status">{{ scoreStatusText }}</div>
            </div>

            <!-- 5 大核心人类语料对比指标 -->
            <div class="metrics-grid">
              <div class="metric-card">
                <div class="m-label">句长变异系数 (CV)</div>
                <div class="m-val">{{ metrics['CV'] ?? '-' }}</div>
                <div class="m-hint">人类基线: 0.71 (越不匀越真实)</div>
              </div>
              <div class="metric-card">
                <div class="m-label">短句占比 (≤10字)</div>
                <div class="m-val">{{ formatPercent(metrics['短句率']) }}</div>
                <div class="m-hint">人类基线: 12.1%</div>
              </div>
              <div class="metric-card">
                <div class="m-label">对话交互占比</div>
                <div class="m-val">{{ formatPercent(metrics['对话率']) }}</div>
                <div class="m-hint">人类基线: 20.8%</div>
              </div>
              <div class="metric-card">
                <div class="m-label">情绪词浓度</div>
                <div class="m-val">{{ metrics['情绪词'] ?? 0 }} 处</div>
                <div class="m-hint">人类基线: 5.27‰</div>
              </div>
              <div class="metric-card">
                <div class="m-label">微动作按键</div>
                <div class="m-val">{{ metrics['微动作'] ?? 0 }} 处</div>
                <div class="m-hint">人类基线: 0.035‰ (越少越好)</div>
              </div>
              <div class="metric-card">
                <div class="m-label">全章总字数</div>
                <div class="m-val">{{ metrics['字数'] ?? 0 }}</div>
                <div class="m-hint">总小句: {{ metrics['句数'] ?? 0 }} 句</div>
              </div>
            </div>
          </div>

          <!-- 诊断出的病灶清单 -->
          <div class="hits-section">
            <div class="section-title-row">
              <h4 class="section-title">
                🩺 检出 AI 典型病灶与超额词：<span class="hit-count">{{ hits.length }} 处</span>
              </h4>
              <span v-if="hits.length === 0" class="clean-badge">🎉 本章毫无机械 AI 腔，质感完美！</span>
            </div>

            <div v-if="hits.length > 0" class="hits-list">
              <div v-for="(hit, idx) in hits" :key="idx" class="hit-item">
                <div class="hit-header">
                  <span class="hit-badge" :class="`action-${hit.action}`">
                    {{ hit.action === '删' ? '建议删除' : (hit.action === '删句' ? '删除短句' : '建议调整') }}
                  </span>
                  <span class="hit-rule">{{ hit.rule }}</span>
                  <span class="hit-word">「{{ hit.word }}」</span>
                </div>
                <div class="hit-snippet">“...{{ hit.snippet }}...”</div>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- 弹窗底部操作栏 -->
      <div class="modal-footer">
        <button class="action-btn secondary" @click="runDiagnose">
          🔄 重新诊断
        </button>
        <button
          class="action-btn primary repair-btn"
          :disabled="isLoading || hits.length === 0"
          @click="runRepair"
          title="执行零 Token 本地确定性无损脱水，瞬间清洗全部超额 AI 腔"
        >
          ✨ 一键无损脱水修复 (零 Token 消耗)
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';

const props = defineProps<{
  isOpen: boolean;
  content: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'apply-repaired', newContent: string): void;
}>();

const isLoading = ref(false);
const humanScore = ref(100);
const metrics = ref<Record<string, any>>({});
const hits = ref<Array<{ rule: string; action: string; word: string; snippet: string; }>>([]);

const scoreClass = computed(() => {
  if (humanScore.value >= 85) return 'score-good';
  if (humanScore.value >= 70) return 'score-warn';
  return 'score-danger';
});

const scoreStatusText = computed(() => {
  if (humanScore.value >= 85) return '🟢 质感极佳 (番茄免死)';
  if (humanScore.value >= 70) return '🟡 轻度微瑕 (建议脱水)';
  return '🔴 重度AI腔 (急需清洗)';
});

function formatPercent(val: any) {
  if (val === undefined || val === null) return '-';
  return `${Math.round(Number(val) * 100)}%`;
}

async function runDiagnose() {
  if (!props.content) return;
  isLoading.value = true;
  try {
    const res = await fetch('/api/dupian/diagnose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: props.content })
    });
    const data = await res.json();
    if (data.metrics) {
      metrics.value = data.metrics;
      humanScore.value = data.humanScore ?? 100;
      hits.value = data.hits ?? [];
    }
  } catch (err) {
    console.error('诊断失败:', err);
  } finally {
    isLoading.value = false;
  }
}

async function runRepair() {
  if (!props.content) return;
  isLoading.value = true;
  try {
    const res = await fetch('/api/dupian/repair', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: props.content })
    });
    const data = await res.json();
    if (data.cleanedText) {
      emit('apply-repaired', data.cleanedText);
      alert(`🎉 已完成零 Token 无损脱水清洗！\n清洗前: ${data.originalLength} 字 ➔ 清洗后: ${data.cleanedLength} 字\n已剔除 ${data.hits?.length || 0} 处机械 AI 口癖！`);
      emit('close');
    }
  } catch (err) {
    alert('修复失败: ' + err);
  } finally {
    isLoading.value = false;
  }
}

watch(() => props.isOpen, (open) => {
  if (open) {
    runDiagnose();
  }
});
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.dupian-modal-box {
  width: 780px;
  max-height: 85vh;
  background: #111422;
  border: 1px solid #3949ab;
  border-radius: 14px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.9), 0 0 30px rgba(57, 73, 171, 0.4);
  display: flex;
  flex-direction: column;
  color: #cfd8dc;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: #161c36;
  border-bottom: 1px solid #283593;
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
  color: #90caf9;
}

.close-btn {
  background: transparent;
  border: none;
  color: #90a4ae;
  font-size: 24px;
  cursor: pointer;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
  gap: 12px;
}

.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid #283593;
  border-top-color: #ffd700;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.score-dashboard {
  display: flex;
  gap: 16px;
  background: #161c36;
  padding: 16px;
  border-radius: 10px;
  border: 1px solid #283593;
}

.score-circle-card {
  width: 140px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  padding: 12px;
  text-align: center;
  flex-shrink: 0;
}

.score-good {
  background: rgba(46, 125, 50, 0.2);
  border: 2px solid #4caf50;
  color: #81c784;
}

.score-warn {
  background: rgba(245, 127, 23, 0.2);
  border: 2px solid #ffb300;
  color: #ffd54f;
}

.score-danger {
  background: rgba(183, 28, 28, 0.2);
  border: 2px solid #f44336;
  color: #ef5350;
}

.score-num {
  font-size: 40px;
  font-weight: 900;
  line-height: 1;
}

.score-label {
  font-size: 11px;
  margin-top: 4px;
  opacity: 0.8;
}

.score-status {
  font-size: 11px;
  font-weight: bold;
  margin-top: 6px;
}

.metrics-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.metric-card {
  background: #0e1224;
  border: 1px solid #252e54;
  border-radius: 6px;
  padding: 8px 12px;
}

.m-label {
  font-size: 11px;
  color: #90caf9;
}

.m-val {
  font-size: 16px;
  font-weight: bold;
  color: #fff;
  margin: 2px 0;
}

.m-hint {
  font-size: 10px;
  color: #78909c;
}

.hits-section {
  background: #161c36;
  border: 1px solid #283593;
  border-radius: 10px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-title {
  margin: 0;
  font-size: 14px;
  color: #fff;
}

.hit-count {
  color: #ffca28;
}

.clean-badge {
  font-size: 12px;
  color: #69f0ae;
  font-weight: bold;
}

.hits-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 240px;
  overflow-y: auto;
}

.hit-item {
  background: #0e1224;
  border: 1px solid #252e54;
  border-radius: 6px;
  padding: 8px 12px;
}

.hit-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.hit-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
  font-weight: bold;
}

.hit-badge.action-删 { background: #b71c1c; color: #fff; }
.hit-badge.action-删句 { background: #c2185b; color: #fff; }
.hit-badge.action-议 { background: #f57f17; color: #fff; }

.hit-rule {
  font-size: 12px;
  font-weight: bold;
  color: #90caf9;
}

.hit-word {
  font-size: 12px;
  color: #ffd54f;
}

.hit-snippet {
  font-size: 12px;
  color: #b0bec5;
  line-height: 1.5;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 14px 20px;
  background: #161c36;
  border-top: 1px solid #283593;
}

.action-btn {
  padding: 8px 18px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.2s;
}

.action-btn.secondary {
  background: #252e54;
  color: #cfd8dc;
  border-color: #3949ab;
}

.action-btn.primary {
  background: linear-gradient(135deg, #2e7d32, #1b5e20);
  color: #fff;
  border-color: #4caf50;
  font-weight: bold;
  box-shadow: 0 0 12px rgba(76, 175, 80, 0.5);
}

.action-btn.primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #388e3c, #2e7d32);
  box-shadow: 0 0 18px rgba(76, 175, 80, 0.8);
  transform: translateY(-1px);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
