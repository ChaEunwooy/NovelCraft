<template>
  <div v-if="isOpen && character" class="char-modal-backdrop" @click.self="close">
    <div class="char-modal-container">
      <!-- 顶部操作栏 -->
      <div class="char-modal-toolbar">
        <div class="toolbar-left">
          <span class="toolbar-badge">📇 绝密档案编辑框架</span>
          <span class="toolbar-hint">（所有区域均可直接打字编辑，长文本滑动浏览全部）</span>
        </div>

        <div class="toolbar-right">
          <button class="nav-btn" @click="$emit('prev')" :disabled="!hasPrev" title="上一位人物">◀ 上一位</button>
          <button class="nav-btn" @click="$emit('next')" :disabled="!hasNext" title="下一位人物">下一位 ▶</button>
          <button class="delete-btn" @click="handleDelete" title="删除此人物卡档案">🗑️ 删除此卡</button>
          <button class="save-btn" @click="handleSave" title="保存所有修改">💾 保存档案</button>
          <button class="close-btn" @click="close" title="关闭窗口">✕</button>
        </div>
      </div>

      <!-- 人物卡主体纸质面板 (带有绝密建档框架，全区域可就地编辑) -->
      <div class="char-sheet-paper">
        <!-- 1. 档案编号与红色绝密印章 -->
        <div class="sheet-top-row">
          <div class="archive-no-box">
            <span class="label">档案编号：</span>
            <input
              v-model="editForm.archiveNo"
              class="paper-input-inline no-input"
              placeholder="749-SURVIVOR-NO.001"
              @change="autoSave"
            />
          </div>

          <div class="secret-stamp-box">
            <input
              v-model="editForm.stampText"
              class="paper-input-stamp"
              placeholder="地质世家第三代 · 绝密建档"
              @change="autoSave"
            />
          </div>
        </div>

        <!-- 2. 主姓名与身份栏 -->
        <div class="sheet-identity-row">
          <div class="identity-left">
            <input
              v-model="editForm.name"
              class="paper-input-title"
              placeholder="姓名"
              @change="autoSave"
            />
            <input
              v-model="editForm.subtitle"
              class="paper-input-subtitle"
              placeholder="(28岁 · 湖南籍 · 闷葫芦)"
              @change="autoSave"
            />
          </div>

          <div class="identity-right">
            <input
              v-model="editForm.identityBadge"
              class="paper-input-badge"
              placeholder="原省水文大坝助理工程师"
              @change="autoSave"
            />
          </div>
        </div>

        <!-- 3. 核心板块列表 (区域文字 Textarea，支持滑动浏览与编辑) -->
        <div class="sheet-sections-container">
          <div
            v-for="(sec, sIdx) in editForm.sections"
            :key="sIdx"
            class="sheet-section-card"
          >
            <!-- 板块标题与删除键 -->
            <div class="section-title-row">
              <span class="red-bar"></span>
              <input
                v-model="sec.title"
                class="paper-input-sec-title"
                placeholder="板块标题 (如:【家族渊源与至亲档案】)"
                @change="autoSave"
              />
              <button
                class="del-sec-btn"
                @click="deleteSection(sIdx)"
                title="删除整个板块"
              >
                ✕ 删除板块
              </button>
            </div>

            <!-- 板块内键值对列表 (区域文字 Textarea，滑动浏览全部) -->
            <div class="section-fields-list">
              <div
                v-for="(field, fIdx) in sec.fields"
                :key="fIdx"
                class="section-field-row"
              >
                <div class="field-label-col">
                  <input
                    v-model="field.label"
                    class="paper-input-field-label"
                    placeholder="标签"
                    @change="autoSave"
                  />
                  <span class="colon-mark">：</span>
                </div>

                <!-- 核心区域文字 (Textarea 容器，支持垂直滑动浏览与直接编辑) -->
                <div class="field-value-col">
                  <textarea
                    v-model="field.value"
                    class="paper-textarea-field scrollable-taretext"
                    rows="2"
                    placeholder="在此输入详情文字（内容超长时长文本域内可滚动滑动浏览全部）..."
                    @change="autoSave"
                  ></textarea>

                  <button
                    class="del-field-btn"
                    @click="deleteField(sec, fIdx)"
                    title="删除本行"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <!-- 添加新属性行按钮 -->
              <button
                class="add-field-btn"
                @click="addField(sec)"
              >
                + 添加档案明细项
              </button>
            </div>
          </div>

          <!-- 添加新板块按钮 -->
          <button
            class="add-section-btn"
            @click="addSection"
          >
            + 增加自定义属性板块
          </button>
        </div>

        <!-- 4. 生活习性与行事风格胶囊标签栏 -->
        <div class="sheet-section-card tags-card">
          <div class="section-title-row">
            <span class="red-bar"></span>
            <span class="section-title-text">【生活习性与行事风格标签】</span>
          </div>

          <div class="capsule-tags-row">
            <span
              v-for="(tag, tIdx) in editForm.tags"
              :key="tIdx"
              class="capsule-tag"
            >
              {{ tag }}
              <span
                class="remove-tag-x"
                @click="removeTag(tIdx)"
                title="删除标签"
              >✕</span>
            </span>

            <div class="add-tag-box">
              <input
                v-model="newTagInput"
                class="paper-input-tag"
                placeholder="输入特征标签敲回车..."
                @keydown.enter="addTag"
              />
              <button class="add-tag-confirm" @click="addTag" title="添加标签">+</button>
            </div>
          </div>
        </div>

        <!-- 5. 随身信物区 (区域文字 Textarea，支持滑动浏览全部) -->
        <div class="sheet-token-box">
          <div class="token-title">
            <span class="token-icon">🎒</span>
            <span class="token-label">随身信物：</span>
          </div>
          <div class="token-content">
            <textarea
              v-model="editForm.tokenBelongings"
              class="paper-textarea-token scrollable-taretext"
              rows="2"
              placeholder="随身携带的重要信物描写（可滑动浏览全部）..."
              @change="autoSave"
            ></textarea>
          </div>
        </div>

        <!-- 6. 底部经典名言金句 (虚线分割 + 区域文字 Textarea) -->
        <div class="sheet-quote-divider"></div>
        <div class="sheet-quote-box">
          <div class="quote-content">
            <span class="quote-mark">“</span>
            <textarea
              v-model="editForm.quoteText"
              class="paper-textarea-quote scrollable-taretext"
              rows="2"
              placeholder="输入震撼人心的核心语录（可滑动浏览全部）..."
              @change="autoSave"
            ></textarea>
            <span class="quote-mark">”</span>
          </div>

          <div class="quote-source">
            <input
              v-model="editForm.quoteSource"
              class="paper-input-source"
              placeholder="末日生存人物图鉴卡 · 编号 001 · 个人档案"
              @change="autoSave"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, reactive } from 'vue';
import type { CharacterCard, CharacterSection } from '../../types/character';

const props = defineProps<{
  isOpen: boolean;
  character?: CharacterCard;
  hasPrev?: boolean;
  hasNext?: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'prev'): void;
  (e: 'next'): void;
  (e: 'save', updated: CharacterCard): void;
  (e: 'delete', charId: string): void;
}>();

const newTagInput = ref('');

const editForm = reactive<CharacterCard>({
  id: '',
  bookId: '',
  categoryId: '',
  archiveNo: '',
  stampText: '',
  name: '',
  subtitle: '',
  identityBadge: '',
  sections: [],
  tags: [],
  tokenBelongings: '',
  quoteText: '',
  quoteSource: ''
});

watch(
  () => props.character,
  (c) => {
    if (c) {
      Object.assign(editForm, JSON.parse(JSON.stringify(c)));
    }
  },
  { immediate: true }
);

function close() {
  handleSave();
  emit('close');
}

function handleSave() {
  emit('save', JSON.parse(JSON.stringify(editForm)));
}

function autoSave() {
  emit('save', JSON.parse(JSON.stringify(editForm)));
}

function handleDelete() {
  if (confirm(`确认要删除人物卡【${editForm.name || '此角色'}】吗？该操作不可撤销。`)) {
    emit('delete', editForm.id);
  }
}

function addField(sec: CharacterSection) {
  sec.fields.push({ label: '新属性项', value: '' });
  autoSave();
}

function deleteField(sec: CharacterSection, idx: number) {
  sec.fields.splice(idx, 1);
  autoSave();
}

function addSection() {
  editForm.sections.push({
    title: '【新自定义属性板块】',
    fields: [{ label: '特征属性', value: '' }]
  });
  autoSave();
}

function deleteSection(idx: number) {
  editForm.sections.splice(idx, 1);
  autoSave();
}

function addTag() {
  const val = newTagInput.value.trim();
  if (val && !editForm.tags.includes(val)) {
    editForm.tags.push(val);
    newTagInput.value = '';
    autoSave();
  }
}

function removeTag(idx: number) {
  editForm.tags.splice(idx, 1);
  autoSave();
}
</script>

<style scoped>
.char-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.78);
  backdrop-filter: blur(8px);
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.char-modal-container {
  width: 100%;
  max-width: 900px;
  max-height: 94vh;
  display: flex;
  flex-direction: column;
  background: transparent;
  border-radius: 12px;
  overflow: hidden;
}

/* 顶部操作条 */
.char-modal-toolbar {
  height: 50px;
  background: #2b2416;
  color: #fbf7ee;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 18px;
  border-top-left-radius: 12px;
  border-top-right-radius: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  z-index: 10;
  flex-shrink: 0;
}

.toolbar-left, .toolbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.toolbar-badge {
  font-size: 13.5px;
  font-weight: 800;
  color: #d97706;
}

.toolbar-hint {
  font-size: 11px;
  color: #a8947c;
}

.nav-btn, .close-btn {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #fbf7ee;
  padding: 5px 10px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.nav-btn:hover:not(:disabled), .close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.nav-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.delete-btn {
  background: #b91c1c;
  color: #ffffff;
  border: none;
  border-radius: 6px;
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s;
}

.delete-btn:hover {
  background: #991b1b;
}

.save-btn {
  background: #16a34a;
  color: #ffffff;
  border: none;
  border-radius: 6px;
  padding: 5px 14px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(22, 163, 74, 0.4);
}

.save-btn:hover {
  background: #15803d;
}

/* 核心档案纸面 (复古网格绝密建档纸张质感) */
.char-sheet-paper {
  flex: 1;
  overflow-y: auto;
  background-color: #f7f1e3;
  background-image: 
    linear-gradient(rgba(180, 150, 110, 0.15) 1px, transparent 1px),
    linear-gradient(90deg, rgba(180, 150, 110, 0.15) 1px, transparent 1px);
  background-size: 20px 20px;
  border: 2px solid #5a4632;
  border-top: none;
  border-bottom-left-radius: 12px;
  border-bottom-right-radius: 12px;
  padding: 28px 36px;
  box-shadow: inset 0 0 40px rgba(120, 80, 40, 0.1), 0 20px 40px rgba(0,0,0,0.5);
  font-family: "Noto Serif SC", "Songti SC", "SimSun", serif;
  color: #2b2416;
}

/* 1. 档案编号与印章 */
.sheet-top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 2px solid #8c6d48;
  padding-bottom: 8px;
  margin-bottom: 16px;
}

.archive-no-box {
  display: flex;
  align-items: center;
  gap: 4px;
  font-family: "Courier New", Courier, monospace;
  font-size: 14px;
  font-weight: 700;
  color: #6b5235;
}

.paper-input-inline {
  background: transparent;
  border: 1px dashed transparent;
  border-radius: 4px;
  padding: 2px 6px;
  font-family: inherit;
  font-size: 14px;
  font-weight: 800;
  color: #3b2c1c;
  outline: none;
  transition: all 0.15s;
}

.paper-input-inline:hover, .paper-input-inline:focus {
  border-color: #d97706;
  background: #ffffff;
}

.secret-stamp-box {
  border: 2px solid #b91c1c;
  padding: 2px 10px;
  border-radius: 4px;
  box-shadow: 0 0 0 1px #b91c1c inset;
  transform: rotate(-0.5deg);
  background: rgba(254, 242, 242, 0.5);
}

.paper-input-stamp {
  background: transparent;
  border: none;
  font-size: 13px;
  font-weight: 900;
  color: #b91c1c;
  letter-spacing: 1.2px;
  outline: none;
  text-align: right;
  width: 220px;
}

/* 2. 主姓名与身份 */
.sheet-identity-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}

.identity-left {
  display: flex;
  align-items: baseline;
  gap: 12px;
  flex: 1;
}

.paper-input-title {
  font-size: 34px;
  font-weight: 900;
  color: #1a140d;
  letter-spacing: 2px;
  background: transparent;
  border: 1px dashed transparent;
  border-radius: 4px;
  padding: 2px 6px;
  width: 140px;
  outline: none;
  line-height: 1;
  font-family: inherit;
  transition: all 0.15s;
}

.paper-input-title:hover, .paper-input-title:focus {
  border-color: #d97706;
  background: #ffffff;
}

.paper-input-subtitle {
  font-size: 14.5px;
  font-weight: 600;
  color: #6b553d;
  background: transparent;
  border: 1px dashed transparent;
  border-radius: 4px;
  padding: 2px 6px;
  outline: none;
  flex: 1;
  font-family: inherit;
  transition: all 0.15s;
}

.paper-input-subtitle:hover, .paper-input-subtitle:focus {
  border-color: #d97706;
  background: #ffffff;
}

.paper-input-badge {
  background: #e5d8be;
  border: 1px solid #c2b18f;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 700;
  color: #3d2e1b;
  box-shadow: 0 2px 5px rgba(0,0,0,0.06);
  outline: none;
  font-family: inherit;
  width: 220px;
  text-align: center;
}

.paper-input-badge:focus {
  border-color: #ea580c;
  background: #ffffff;
}

/* 3. 核心板块卡片 */
.sheet-sections-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 20px;
}

.sheet-section-card {
  background: rgba(255, 255, 255, 0.75);
  border: 1px solid #dcd0b8;
  border-radius: 8px;
  padding: 16px 20px;
  box-shadow: 0 2px 6px rgba(100, 70, 30, 0.05);
}

.section-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
}

.red-bar {
  width: 4px;
  height: 16px;
  background: #991b1b;
  border-radius: 2px;
  flex-shrink: 0;
}

.paper-input-sec-title {
  font-size: 14px;
  font-weight: 800;
  color: #991b1b;
  letter-spacing: 0.8px;
  background: transparent;
  border: 1px dashed transparent;
  border-radius: 4px;
  padding: 2px 6px;
  outline: none;
  flex: 1;
  font-family: inherit;
}

.paper-input-sec-title:hover, .paper-input-sec-title:focus {
  border-color: #991b1b;
  background: #ffffff;
}

.del-sec-btn {
  background: transparent;
  border: 1px solid #fca5a5;
  color: #b91c1c;
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
}

.del-sec-btn:hover {
  background: #dc2626;
  color: #ffffff;
}

.section-fields-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-field-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 13.5px;
}

.field-label-col {
  width: 110px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.paper-input-field-label {
  width: 96px;
  font-weight: 700;
  color: #4a3b2c;
  background: transparent;
  border: 1px dashed transparent;
  border-radius: 4px;
  padding: 2px 4px;
  outline: none;
  font-family: inherit;
  font-size: 13.5px;
}

.paper-input-field-label:hover, .paper-input-field-label:focus {
  border-color: #d97706;
  background: #ffffff;
}

.colon-mark {
  font-weight: 700;
  color: #4a3b2c;
}

.field-value-col {
  flex: 1;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  min-width: 0;
}

/* 核心 Taretext (区域文字多行文本域，支持内部滚动滑动浏览) */
.scrollable-taretext {
  width: 100%;
  box-sizing: border-box;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid #e0d4be;
  border-radius: 6px;
  padding: 8px 12px;
  font-family: "Noto Serif SC", "Songti SC", "SimSun", serif;
  font-size: 13.5px;
  line-height: 1.6;
  color: #2b2416;
  outline: none;
  resize: vertical;
  max-height: 160px;
  overflow-y: auto;
  word-break: break-word;
  white-space: pre-wrap;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.scrollable-taretext:focus {
  border-color: #ea580c;
  background: #ffffff;
  box-shadow: 0 0 0 2px rgba(234, 88, 12, 0.15);
}

/* 细致复古滚动条 */
.scrollable-taretext::-webkit-scrollbar {
  width: 6px;
}
.scrollable-taretext::-webkit-scrollbar-thumb {
  background: #c2b18f;
  border-radius: 3px;
}
.scrollable-taretext::-webkit-scrollbar-thumb:hover {
  background: #ea580c;
}

.del-field-btn {
  background: transparent;
  border: none;
  color: #991b1b;
  cursor: pointer;
  font-size: 14px;
  font-weight: 900;
  padding: 4px;
  opacity: 0.6;
  transition: opacity 0.15s;
}

.del-field-btn:hover {
  opacity: 1;
  color: #dc2626;
}

.add-field-btn, .add-section-btn {
  background: #f4eedb;
  border: 1px dashed #c2b18f;
  color: #5c4e36;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  align-self: flex-start;
}

.add-field-btn:hover, .add-section-btn:hover {
  background: #d97706;
  color: #ffffff;
  border-color: #d97706;
}

/* 4. 胶囊标签 */
.capsule-tags-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.capsule-tag {
  background: #dfd2b7;
  border: 1px solid #c2b395;
  color: #3b2c1c;
  font-size: 12px;
  font-weight: 700;
  padding: 3px 12px;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.remove-tag-x {
  cursor: pointer;
  color: #991b1b;
  font-weight: 900;
}

.add-tag-box {
  display: flex;
  align-items: center;
  gap: 4px;
}

.paper-input-tag {
  background: #ffffff;
  border: 1px solid #c2b395;
  border-radius: 12px;
  padding: 3px 10px;
  font-size: 11.5px;
  outline: none;
  font-family: inherit;
}

.paper-input-tag:focus {
  border-color: #ea580c;
}

.add-tag-confirm {
  background: #ea580c;
  color: #ffffff;
  border: none;
  border-radius: 50%;
  width: 22px;
  height: 22px;
  cursor: pointer;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 5. 随身信物 */
.sheet-token-box {
  background: rgba(254, 242, 242, 0.85);
  border: 1px dashed #f87171;
  border-radius: 8px;
  padding: 12px 18px;
  margin-bottom: 20px;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 13.5px;
  line-height: 1.6;
}

.token-title {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  font-weight: 800;
  color: #b91c1c;
  padding-top: 4px;
}

.token-content {
  flex: 1;
  min-width: 0;
}

.paper-textarea-token {
  border-color: #fca5a5;
  background: rgba(255, 255, 255, 0.9);
}

/* 6. 经典语录金句 */
.sheet-quote-divider {
  border-top: 1.5px dashed #a8947c;
  margin: 16px 0 12px;
}

.sheet-quote-box {
  text-align: center;
  padding: 4px 12px;
}

.quote-content {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-bottom: 8px;
}

.quote-mark {
  font-size: 24px;
  color: #d97706;
  font-weight: 900;
  flex-shrink: 0;
}

.paper-textarea-quote {
  text-align: center;
  font-weight: 700;
  font-style: italic;
  color: #b45309;
  border-color: #fed7aa;
}

.quote-source {
  display: flex;
  justify-content: center;
}

.paper-input-source {
  text-align: center;
  font-size: 11px;
  color: #8c7b5d;
  letter-spacing: 0.5px;
  background: transparent;
  border: 1px dashed transparent;
  border-radius: 4px;
  padding: 2px 8px;
  outline: none;
  width: 320px;
}

.paper-input-source:focus {
  border-color: #d97706;
  background: #ffffff;
}
</style>
