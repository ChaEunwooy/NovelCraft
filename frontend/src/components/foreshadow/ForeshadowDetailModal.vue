<template>
  <div v-if="isOpen" class="modal-backdrop" @click.self="close">
    <div class="modal-window">
      <!-- 弹窗顶栏 -->
      <div class="modal-header">
        <div class="header-left">
          <span class="header-icon">🗝️</span>
          <span class="header-title">{{ isEditing ? '编辑伏笔与回收链路' : '埋设新伏笔' }}</span>
        </div>
        <div class="header-right">
          <button class="close-btn" @click="close" title="关闭 (Esc)">✕</button>
        </div>
      </div>

      <!-- 表单主体内容 -->
      <div class="modal-body">
        <!-- 基础线索信息 -->
        <div class="form-section">
          <div class="section-title">📌 伏笔线索基础信息</div>
          <div class="form-row">
            <div class="form-group flex-2">
              <label class="form-label">伏笔名称 / 线索标题 <span class="required">*</span></label>
              <input
                v-model="form.title"
                type="text"
                class="form-input"
                placeholder="例如: 老周胸前折断的钥匙 / 卷扬机反向自转"
              />
            </div>
            <div class="form-group flex-1">
              <label class="form-label">分类标签</label>
              <select v-model="form.category" class="form-select">
                <option value="主线反转">主线反转</option>
                <option value="身世之谜">身世之谜</option>
                <option value="关键信物">关键信物</option>
                <option value="世界法则">世界法则</option>
                <option value="生死危机">生死危机</option>
                <option value="暗线细节">暗线细节</option>
                <option value="其他">其他</option>
              </select>
            </div>
            <div class="form-group flex-1">
              <label class="form-label">重要程度</label>
              <select v-model="form.priority" class="form-select">
                <option value="high">🔴 核心必收</option>
                <option value="medium">🟡 重要支线</option>
                <option value="low">🟢 细节暗线</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">伏笔意图 / 剧情设计思路</label>
            <textarea
              v-model="form.content"
              rows="2"
              class="form-textarea"
              placeholder="记录您当时埋下这个伏笔的构思、打算在后文起到的反转作用..."
            ></textarea>
          </div>
        </div>

        <!-- 埋设位置 (Planting) -->
        <div class="form-section planting-section">
          <div class="section-title">
            <span>🌱 伏笔埋设位置（在那一章的哪一段）</span>
            <span class="section-badge">出处</span>
          </div>

          <div class="form-row">
            <div class="form-group flex-2">
              <label class="form-label">埋设章节 <span class="required">*</span></label>
              <select v-model="form.plantChapterId" class="form-select" @change="onPlantChapterChange">
                <option value="" disabled>-- 请选择埋下伏笔的章节 --</option>
                <optgroup v-for="vol in allVolumes" :key="vol.id" :label="vol.title">
                  <option
                    v-for="chap in vol.chapters"
                    :key="chap.id"
                    :value="chap.id"
                  >
                    {{ chap.title }} ({{ chap.wordCount || 0 }}字)
                  </option>
                </optgroup>
              </select>
            </div>

            <div class="form-group flex-1">
              <label class="form-label">埋设段落序号</label>
              <div class="input-with-suffix">
                <input
                  v-model.number="form.plantParagraphIndex"
                  type="number"
                  min="1"
                  class="form-input"
                  placeholder="例如: 12"
                />
                <span class="suffix-text">段</span>
              </div>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">埋设段落原文摘录 / 关键句</label>
            <textarea
              v-model="form.plantQuoteText"
              rows="3"
              class="form-textarea quote-textarea"
              placeholder="粘贴该段落的关键伏笔句子，方便日后一目了然对照..."
            ></textarea>
          </div>
        </div>

        <!-- 状态与回收位置 (Resolving) -->
        <div class="form-section resolving-section" :class="{ 'is-resolved': form.status === 'resolved' }">
          <div class="section-title">
            <span>🌾 伏笔回收与反转揭秘（在某一章的哪一段回收）</span>
            <div class="status-toggle-group">
              <button
                type="button"
                class="status-btn"
                :class="{ active: form.status === 'pending' }"
                @click="form.status = 'pending'"
              >
                ⏳ 待回收 (悬空)
              </button>
              <button
                type="button"
                class="status-btn resolved"
                :class="{ active: form.status === 'resolved' }"
                @click="markResolved"
              >
                ✅ 已闭环回收
              </button>
              <button
                type="button"
                class="status-btn abandoned"
                :class="{ active: form.status === 'abandoned' }"
                @click="form.status = 'abandoned'"
              >
                ⚠️ 暂搁置/废弃
              </button>
            </div>
          </div>

          <div v-if="form.status === 'resolved'" class="resolving-content">
            <div class="form-row">
              <div class="form-group flex-2">
                <label class="form-label">回收章节 <span class="required">*</span></label>
                <select v-model="form.resolveChapterId" class="form-select" @change="onResolveChapterChange">
                  <option value="" disabled>-- 请选择回收/揭秘该伏笔的章节 --</option>
                  <optgroup v-for="vol in allVolumes" :key="vol.id" :label="vol.title">
                    <option
                      v-for="chap in vol.chapters"
                      :key="chap.id"
                      :value="chap.id"
                    >
                      {{ chap.title }} ({{ chap.wordCount || 0 }}字)
                    </option>
                  </optgroup>
                </select>
              </div>

              <div class="form-group flex-1">
                <label class="form-label">回收段落序号</label>
                <div class="input-with-suffix">
                  <input
                    v-model.number="form.resolveParagraphIndex"
                    type="number"
                    min="1"
                    class="form-input"
                    placeholder="例如: 24"
                  />
                  <span class="suffix-text">段</span>
                </div>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">回收段落原文摘录 / 揭秘高潮句</label>
              <textarea
                v-model="form.resolveQuoteText"
                rows="3"
                class="form-textarea quote-textarea"
                placeholder="粘贴揭示伏笔真相、造成反转效果的段落原文..."
              ></textarea>
            </div>

            <div class="form-group">
              <label class="form-label">揭秘说明 / 反转效果总结</label>
              <textarea
                v-model="form.resolveNote"
                rows="2"
                class="form-textarea"
                placeholder="总结该伏笔在此处的揭示效果与对后文的推动作用..."
              ></textarea>
            </div>
          </div>
          <div v-else class="resolving-placeholder">
            <span>此伏笔当前处于【{{ form.status === 'pending' ? '未回收状态' : '已废弃状态' }}】，如已在后文揭秘，请点击上方【✅ 已闭环回收】填写回收章节与段落。</span>
          </div>
        </div>
      </div>

      <!-- 弹窗底栏操作 -->
      <div class="modal-footer">
        <div class="footer-left">
          <button v-if="isEditing" class="delete-btn" @click="handleDelete">🗑️ 删除此伏笔</button>
        </div>
        <div class="footer-right">
          <button class="cancel-btn" @click="close">取消</button>
          <button class="save-btn" @click="handleSave">💾 保存伏笔记录</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted } from 'vue';
import type { ForeshadowItem, ForeshadowCategory, ForeshadowStatus } from '../../types/foreshadow';
import type { Volume, Chapter } from '../../types/novel';

const props = defineProps<{
  isOpen: boolean;
  item?: ForeshadowItem | null;
  bookId: string;
  volumes?: Volume[];
  currentChapter?: Chapter;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save', item: ForeshadowItem): void;
  (e: 'delete', id: string): void;
}>();

const isEditing = computed(() => !!props.item && !!props.item.id);
const allVolumes = computed(() => props.volumes || []);

const form = ref<Partial<ForeshadowItem>>({
  title: '',
  content: '',
  status: 'pending',
  category: '主线反转',
  priority: 'high',
  plantChapterId: '',
  plantChapterTitle: '',
  plantParagraphIndex: undefined,
  plantQuoteText: '',
  resolveChapterId: '',
  resolveChapterTitle: '',
  resolveParagraphIndex: undefined,
  resolveQuoteText: '',
  resolveNote: ''
});

// 打开或切换编辑项时填充表单
watch(
  () => props.isOpen,
  (val) => {
    if (val) {
      if (props.item) {
        form.value = { ...props.item };
      } else {
        // 新建：默认绑定当前章节
        form.value = {
          title: '',
          content: '',
          status: 'pending',
          category: '主线反转',
          priority: 'high',
          plantChapterId: props.currentChapter?.id || '',
          plantChapterTitle: props.currentChapter?.title || '',
          plantParagraphIndex: 1,
          plantQuoteText: '',
          resolveChapterId: '',
          resolveChapterTitle: '',
          resolveParagraphIndex: undefined,
          resolveQuoteText: '',
          resolveNote: ''
        };
      }
    }
  },
  { immediate: true }
);

function onPlantChapterChange() {
  for (const v of allVolumes.value) {
    const found = v.chapters?.find(c => c.id === form.value.plantChapterId);
    if (found) {
      form.value.plantChapterTitle = found.title;
      break;
    }
  }
}

function onResolveChapterChange() {
  for (const v of allVolumes.value) {
    const found = v.chapters?.find(c => c.id === form.value.resolveChapterId);
    if (found) {
      form.value.resolveChapterTitle = found.title;
      break;
    }
  }
}

function markResolved() {
  form.value.status = 'resolved';
  if (!form.value.resolveChapterId && props.currentChapter) {
    form.value.resolveChapterId = props.currentChapter.id;
    form.value.resolveChapterTitle = props.currentChapter.title;
  }
}

function close() {
  emit('close');
}

function handleSave() {
  if (!form.value.title?.trim()) {
    alert('请填写伏笔名称 / 线索标题！');
    return;
  }
  if (!form.value.plantChapterId) {
    alert('请选择埋下该伏笔的章节！');
    return;
  }

  const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);

  const payload: ForeshadowItem = {
    id: form.value.id || 'clue_' + Date.now(),
    bookId: props.bookId || 'default',
    title: form.value.title.trim(),
    content: form.value.content?.trim() || '',
    status: (form.value.status as ForeshadowStatus) || 'pending',
    category: (form.value.category as ForeshadowCategory) || '主线反转',
    priority: form.value.priority || 'medium',
    plantChapterId: form.value.plantChapterId,
    plantChapterTitle: form.value.plantChapterTitle || '未命名章节',
    plantParagraphIndex: form.value.plantParagraphIndex,
    plantQuoteText: form.value.plantQuoteText?.trim() || '',
    resolveChapterId: form.value.status === 'resolved' ? form.value.resolveChapterId : undefined,
    resolveChapterTitle: form.value.status === 'resolved' ? form.value.resolveChapterTitle : undefined,
    resolveParagraphIndex: form.value.status === 'resolved' ? form.value.resolveParagraphIndex : undefined,
    resolveQuoteText: form.value.status === 'resolved' ? form.value.resolveQuoteText?.trim() : undefined,
    resolveNote: form.value.status === 'resolved' ? form.value.resolveNote?.trim() : undefined,
    resolvedAt: form.value.status === 'resolved' ? (form.value.resolvedAt || nowStr) : undefined,
    createdAt: form.value.createdAt || nowStr,
    updatedAt: nowStr
  };

  emit('save', payload);
  close();
}

function handleDelete() {
  if (form.value.id && confirm(`确定要彻底删除伏笔【${form.value.title}】吗？`)) {
    emit('delete', form.value.id);
    close();
  }
}

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
  background-color: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.modal-window {
  width: 820px;
  max-width: 95vw;
  max-height: 90vh;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  color: var(--text-main);
  overflow: hidden;
}

.modal-header {
  height: 56px;
  padding: 0 20px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-icon {
  font-size: 20px;
}

.header-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-main);
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-dim);
  font-size: 18px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-main);
}

.modal-body {
  padding: 20px 24px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
  background: var(--bg-primary);
}

.form-section {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.planting-section {
  border-left: 4px solid #059669;
}

.resolving-section {
  border-left: 4px solid #d97706;
  transition: border-color 0.2s;
}

.resolving-section.is-resolved {
  border-left-color: #059669;
  background: var(--bg-secondary);
}

.section-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-main);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-badge {
  font-size: 12px;
  background: rgba(16, 185, 129, 0.12);
  color: #059669;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 600;
}

.status-toggle-group {
  display: flex;
  gap: 6px;
}

.status-btn {
  padding: 4px 10px;
  font-size: 12px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s;
}

.status-btn.active {
  background: #d97706;
  color: #ffffff;
  border-color: #d97706;
  font-weight: 600;
}

.status-btn.resolved.active {
  background: #059669;
  color: #ffffff;
  border-color: #059669;
  font-weight: 600;
}

.status-btn.abandoned.active {
  background: var(--bg-tertiary);
  color: var(--text-dim);
  border-color: var(--border-color);
}

.form-row {
  display: flex;
  gap: 14px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.flex-1 { flex: 1; }
.flex-2 { flex: 2; }

.form-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-main);
}

.required {
  color: #ef4444;
}

.form-input, .form-select, .form-textarea {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-main);
  font-size: 13px;
  padding: 8px 12px;
  outline: none;
  transition: border-color 0.2s;
  font-family: inherit;
}

.form-input:focus, .form-select:focus, .form-textarea:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.15);
}

.quote-textarea {
  font-family: "Noto Serif SC", "SimSun", serif;
  font-size: 13px;
  line-height: 1.6;
  background: var(--bg-tertiary);
  border-style: dashed;
  color: var(--text-main);
}

.input-with-suffix {
  display: flex;
  align-items: center;
  position: relative;
}

.input-with-suffix .form-input {
  width: 100%;
  padding-right: 32px;
}

.suffix-text {
  position: absolute;
  right: 12px;
  font-size: 12px;
  color: var(--text-muted);
}

.resolving-placeholder {
  padding: 12px;
  font-size: 12px;
  color: var(--text-dim);
  text-align: center;
  background: var(--bg-tertiary);
  border-radius: 6px;
}

.resolving-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.modal-footer {
  height: 64px;
  padding: 0 24px;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.delete-btn {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #dc2626;
  padding: 8px 14px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.delete-btn:hover {
  background: #dc2626;
  color: #ffffff;
}

.footer-right {
  display: flex;
  gap: 12px;
}

.cancel-btn {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  color: var(--text-main);
  padding: 8px 18px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.cancel-btn:hover {
  background: var(--bg-tertiary);
}

.save-btn {
  background: var(--accent);
  border: 1px solid var(--accent);
  color: #ffffff;
  padding: 8px 22px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: all 0.15s;
}

.save-btn:hover {
  opacity: 0.9;
}
</style>
