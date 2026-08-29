<template>
  <div class="relation-canvas-container" @mousedown="onCanvasMouseDown" @wheel.prevent="onWheel">
    <!-- 顶部工具栏 -->
    <div class="canvas-top-bar" @mousedown.stop>
      <div class="bar-left">
        <span class="bar-title">🕸️ 人物逻辑梳理拓扑图</span>
        <button class="tool-btn add-char-btn" @click="showAddCharMenu = !showAddCharMenu">
          + 添加人物卡片到画布
        </button>

        <!-- 添加人物弹层 -->
        <div v-if="showAddCharMenu" class="add-char-popover">
          <div class="pop-header">选择要放置的人物：</div>
          <div class="pop-list">
            <div
              v-for="c in allCharacters"
              :key="c.id"
              class="pop-item"
              :class="{ disabled: isNodeOnCanvas(c.id) }"
              @click="addCharacterToCanvas(c)"
            >
              <span class="pop-name">{{ c.name }}</span>
              <span class="pop-badge">{{ c.identityBadge }}</span>
              <span v-if="isNodeOnCanvas(c.id)" class="pop-status">已在画布</span>
            </div>
          </div>
        </div>
      </div>

      <div class="bar-right">
        <button class="tool-btn" @click="zoom(1.1)" title="放大">+</button>
        <button class="tool-btn" @click="zoom(0.9)" title="缩小">-</button>
        <button class="tool-btn" @click="resetView" title="重置视角">🎯 重置视角</button>
        <span class="canvas-hint">💡 拖动卡片调整布局 | 拖动小圆点连接人物并在线条上标记关系</span>
      </div>
    </div>

    <!-- 视口缩放与平移区域 -->
    <div
      class="canvas-viewport"
      :style="{ transform: `translate(${panX}px, ${panY}px) scale(${zoomLevel})` }"
    >
      <!-- SVG 关系连线层 -->
      <svg class="canvas-svg-layer" style="overflow: visible;">
        <!-- 箭头标记定义 -->
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#b45309" />
          </marker>
        </defs>

        <!-- 已有人物关系连线 -->
        <g v-for="rel in renderedRelations" :key="rel.id">
          <!-- 曲线底色感应区 (方便点击) -->
          <path
            :d="rel.d"
            class="relation-path-hover"
            @click.stop="selectRelation(rel)"
          />
          <!-- 真实关系连线 -->
          <path
            :d="rel.d"
            class="relation-path-line"
            :class="{ selected: selectedRelationId === rel.id }"
            marker-end="url(#arrowhead)"
          />
        </g>

        <!-- 正在拉出的动态连线 -->
        <path
          v-if="tempWireD"
          :d="tempWireD"
          class="relation-temp-wire"
        />
      </svg>

      <!-- 关系连线中间的文字标签徽章层 (支持就地双击修改关系名称) -->
      <div class="relation-labels-layer">
        <div
          v-for="rel in renderedRelations"
          :key="`label-${rel.id}`"
          class="relation-label-badge"
          :style="{ left: `${rel.midX}px`, top: `${rel.midY}px` }"
          @click.stop="startEditRelation(rel)"
          title="点击修改关系名称"
        >
          <input
            v-if="editingRelationId === rel.id"
            ref="relationInputRef"
            v-model="editingRelationText"
            class="relation-input"
            @click.stop
            @keydown.enter="confirmEditRelation(rel)"
            @keydown.esc="editingRelationId = ''"
            @blur="confirmEditRelation(rel)"
          />
          <template v-else>
            <span class="label-text">{{ rel.relationText || '关联' }}</span>
            <button
              class="del-rel-btn"
              @click.stop="deleteRelation(rel.id)"
              title="删除此关系"
            >
              ✕
            </button>
          </template>
        </div>
      </div>

      <!-- 人物卡片节点层 -->
      <div class="canvas-nodes-layer">
        <div
          v-for="node in localNodes"
          :key="node.characterId"
          class="canvas-char-card"
          :style="{ left: `${node.x}px`, top: `${node.y}px` }"
          @mousedown.stop="onCardMouseDown($event, node)"
          @dblclick.stop="openCardDetail(node.characterId)"
        >
          <!-- 卡片头部 (档案号 + 移除按钮) -->
          <div class="card-header-row">
            <span class="card-archive-no">{{ getChar(node.characterId)?.archiveNo }}</span>
            <button
              class="remove-card-btn"
              @click.stop="removeNodeFromCanvas(node.characterId)"
              title="从画布移除此人物卡"
            >
              ✕
            </button>
          </div>

          <!-- 卡片主体信息 -->
          <div class="card-body">
            <div class="card-name-row">
              <span class="card-name">{{ getChar(node.characterId)?.name }}</span>
              <span class="card-stamp-badge">{{ getChar(node.characterId)?.stampText }}</span>
            </div>
            <div class="card-identity-badge">{{ getChar(node.characterId)?.identityBadge }}</div>
            <div class="card-quote-preview">
              *“{{ (getChar(node.characterId)?.quoteText || '').slice(0, 32) }}...”*
            </div>
          </div>

          <!-- 4 个方位的连接端点 (用于拉线连结其他人物) -->
          <div
            class="port port-top"
            @mousedown.stop="startWire($event, node, 'top')"
            @mouseup.stop="endWire(node)"
            title="拉线连接"
          ></div>
          <div
            class="port port-right"
            @mousedown.stop="startWire($event, node, 'right')"
            @mouseup.stop="endWire(node)"
            title="拉线连接"
          ></div>
          <div
            class="port port-bottom"
            @mousedown.stop="startWire($event, node, 'bottom')"
            @mouseup.stop="endWire(node)"
            title="拉线连接"
          ></div>
          <div
            class="port port-left"
            @mousedown.stop="startWire($event, node, 'left')"
            @mouseup.stop="endWire(node)"
            title="拉线连接"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue';
import type { CharacterCard, CharacterCanvasNode, CharacterRelation, CharacterLogicMapData } from '../../types/character';

const props = defineProps<{
  bookId: string;
  allCharacters: CharacterCard[];
  logicMapData: CharacterLogicMapData;
}>();

const emit = defineEmits<{
  (e: 'update-logic-map', data: CharacterLogicMapData): void;
  (e: 'open-character-detail', charId: string): void;
}>();

const panX = ref(60);
const panY = ref(60);
const zoomLevel = ref(1.0);

const showAddCharMenu = ref(false);

const localNodes = ref<CharacterCanvasNode[]>([]);
const localRelations = ref<CharacterRelation[]>([]);

// 监听并复制数据
onMounted(() => {
  localNodes.value = JSON.parse(JSON.stringify(props.logicMapData?.nodes || []));
  localRelations.value = JSON.parse(JSON.stringify(props.logicMapData?.relations || []));

  window.addEventListener('mousemove', onGlobalMouseMove);
  window.addEventListener('mouseup', onGlobalMouseUp);
});

onUnmounted(() => {
  window.removeEventListener('mousemove', onGlobalMouseMove);
  window.removeEventListener('mouseup', onGlobalMouseUp);
});

function getChar(id: string): CharacterCard | undefined {
  return props.allCharacters.find(c => c.id === id);
}

function isNodeOnCanvas(charId: string): boolean {
  return localNodes.value.some(n => n.characterId === charId);
}

function addCharacterToCanvas(c: CharacterCard) {
  if (isNodeOnCanvas(c.id)) return;
  const newNode: CharacterCanvasNode = {
    characterId: c.id,
    x: Math.round(-panX.value / zoomLevel.value + 200 + Math.random() * 80),
    y: Math.round(-panY.value / zoomLevel.value + 150 + Math.random() * 80)
  };
  localNodes.value.push(newNode);
  showAddCharMenu.value = false;
  emitChanges();
}

function removeNodeFromCanvas(charId: string) {
  localNodes.value = localNodes.value.filter(n => n.characterId !== charId);
  localRelations.value = localRelations.value.filter(
    r => r.fromCharacterId !== charId && r.toCharacterId !== charId
  );
  emitChanges();
}

// 拖拽卡片
let isDraggingCard = false;
let activeDragNode: CharacterCanvasNode | null = null;
let dragStartX = 0;
let dragStartY = 0;
let nodeStartX = 0;
let nodeStartY = 0;

function onCardMouseDown(e: MouseEvent, node: CharacterCanvasNode) {
  isDraggingCard = true;
  activeDragNode = node;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  nodeStartX = node.x;
  nodeStartY = node.y;
}

// 画布平移
let isPanningCanvas = false;
let panStartX = 0;
let panStartY = 0;

function onCanvasMouseDown(e: MouseEvent) {
  isPanningCanvas = true;
  panStartX = e.clientX - panX.value;
  panStartY = e.clientY - panY.value;
  showAddCharMenu.value = false;
}

// 拖拽连线
const isConnecting = ref(false);
let wireSourceCharId = '';
let wireSourcePort = '';
const tempWireD = ref('');

function startWire(e: MouseEvent, node: CharacterCanvasNode, port: string) {
  isConnecting.value = true;
  wireSourceCharId = node.characterId;
  wireSourcePort = port;
  updateTempWire(e.clientX, e.clientY);
}

function endWire(targetNode: CharacterCanvasNode) {
  if (isConnecting.value && wireSourceCharId && targetNode.characterId !== wireSourceCharId) {
    // 检查是否已经存在该关系
    const exists = localRelations.value.some(
      r => (r.fromCharacterId === wireSourceCharId && r.toCharacterId === targetNode.characterId) ||
           (r.fromCharacterId === targetNode.characterId && r.toCharacterId === wireSourceCharId)
    );
    if (!exists) {
      const newRel: CharacterRelation = {
        id: 'rel_' + Date.now(),
        fromCharacterId: wireSourceCharId,
        toCharacterId: targetNode.characterId,
        relationText: '关系链接',
        relationType: 'friendly'
      };
      localRelations.value.push(newRel);
      emitChanges();
    }
  }
  isConnecting.value = false;
  tempWireD.value = '';
  wireSourceCharId = '';
}

function updateTempWire(clientX: number, clientY: number) {
  const srcNode = localNodes.value.find(n => n.characterId === wireSourceCharId);
  if (!srcNode) return;

  const srcX = (srcNode.x + 130) * zoomLevel.value + panX.value;
  const srcY = (srcNode.y + 70) * zoomLevel.value + panY.value;

  const canvasX = (clientX - panX.value) / zoomLevel.value;
  const canvasY = (clientY - panY.value) / zoomLevel.value;

  tempWireD.value = `M ${srcNode.x + 130} ${srcNode.y + 70} L ${canvasX} ${canvasY}`;
}

function onGlobalMouseMove(e: MouseEvent) {
  if (isDraggingCard && activeDragNode) {
    const dx = (e.clientX - dragStartX) / zoomLevel.value;
    const dy = (e.clientY - dragStartY) / zoomLevel.value;
    activeDragNode.x = Math.round(nodeStartX + dx);
    activeDragNode.y = Math.round(nodeStartY + dy);
  } else if (isPanningCanvas) {
    panX.value = e.clientX - panStartX;
    panY.value = e.clientY - panStartY;
  } else if (isConnecting.value) {
    updateTempWire(e.clientX, e.clientY);
  }
}

function onGlobalMouseUp() {
  if (isDraggingCard) {
    isDraggingCard = false;
    activeDragNode = null;
    emitChanges();
  }
  isPanningCanvas = false;
  if (isConnecting.value) {
    isConnecting.value = false;
    tempWireD.value = '';
    wireSourceCharId = '';
  }
}

function onWheel(e: WheelEvent) {
  const delta = e.deltaY < 0 ? 1.08 : 0.92;
  zoomLevel.value = Math.min(Math.max(0.4, zoomLevel.value * delta), 2.2);
}

function zoom(factor: number) {
  zoomLevel.value = Math.min(Math.max(0.4, zoomLevel.value * factor), 2.2);
}

function resetView() {
  panX.value = 60;
  panY.value = 60;
  zoomLevel.value = 1.0;
}

// 关系连线计算
const CARD_WIDTH = 260;
const CARD_HEIGHT = 140;

const renderedRelations = computed(() => {
  const nodeMap = new Map<string, CharacterCanvasNode>();
  localNodes.value.forEach(n => nodeMap.set(n.characterId, n));

  return localRelations.value.map(rel => {
    const src = nodeMap.get(rel.fromCharacterId);
    const tgt = nodeMap.get(rel.toCharacterId);
    if (!src || !tgt) return null;

    const x1 = src.x + CARD_WIDTH / 2;
    const y1 = src.y + CARD_HEIGHT / 2;
    const x2 = tgt.x + CARD_WIDTH / 2;
    const y2 = tgt.y + CARD_HEIGHT / 2;

    const cx1 = x1 + (x2 - x1) * 0.4;
    const cy1 = y1;
    const cx2 = x1 + (x2 - x1) * 0.6;
    const cy2 = y2;

    const d = `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;

    // 中点用于放置关系文字标签
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    return {
      id: rel.id,
      relationText: rel.relationText,
      d,
      midX,
      midY
    };
  }).filter(Boolean) as any[];
});

// 编辑关系标签文字
const editingRelationId = ref('');
const editingRelationText = ref('');
const relationInputRef = ref<HTMLInputElement[] | null>(null);
const selectedRelationId = ref('');

function startEditRelation(rel: any) {
  editingRelationId.value = rel.id;
  editingRelationText.value = rel.relationText;
  nextTick(() => {
    if (relationInputRef.value && relationInputRef.value.length > 0) {
      relationInputRef.value[0].focus();
      relationInputRef.value[0].select();
    }
  });
}

function confirmEditRelation(rel: any) {
  if (editingRelationId.value !== rel.id) return;
  const found = localRelations.value.find(r => r.id === rel.id);
  if (found && editingRelationText.value.trim()) {
    found.relationText = editingRelationText.value.trim();
    emitChanges();
  }
  editingRelationId.value = '';
}

function deleteRelation(relId: string) {
  localRelations.value = localRelations.value.filter(r => r.id !== relId);
  emitChanges();
}

function selectRelation(rel: any) {
  selectedRelationId.value = rel.id;
}

function openCardDetail(charId: string) {
  emit('open-character-detail', charId);
}

function emitChanges() {
  emit('update-logic-map', {
    bookId: props.bookId,
    nodes: JSON.parse(JSON.stringify(localNodes.value)),
    relations: JSON.parse(JSON.stringify(localRelations.value))
  });
}
</script>

<style scoped>
.relation-canvas-container {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  background-color: #f5eedc;
  background-image: 
    radial-gradient(#d6c7a9 1.5px, transparent 1.5px),
    linear-gradient(rgba(214, 199, 169, 0.25) 1px, transparent 1px),
    linear-gradient(90deg, rgba(214, 199, 169, 0.25) 1px, transparent 1px);
  background-size: 32px 32px, 16px 16px, 16px 16px;
  cursor: grab;
  user-select: none;
}

.relation-canvas-container:active {
  cursor: grabbing;
}

/* 顶部工具栏 */
.canvas-top-bar {
  position: absolute;
  top: 12px;
  left: 16px;
  right: 16px;
  height: 44px;
  background: rgba(43, 36, 22, 0.92);
  backdrop-filter: blur(6px);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  z-index: 100;
  box-shadow: 0 4px 12px rgba(0,0,0,0.18);
}

.bar-left, .bar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.bar-title {
  font-size: 13px;
  font-weight: 700;
  color: #fbf7ee;
}

.tool-btn {
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fbf7ee;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.tool-btn:hover {
  background: #d97706;
  border-color: #d97706;
}

.add-char-btn {
  background: #ea580c;
  border-color: #ea580c;
  color: #ffffff;
  font-weight: 700;
}

.canvas-hint {
  font-size: 11px;
  color: #d6c7a9;
}

/* 添加人物弹层 */
.add-char-popover {
  position: absolute;
  top: 50px;
  left: 14px;
  width: 280px;
  max-height: 360px;
  background: #fbf7ee;
  border: 2px solid #5a4632;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.3);
  overflow-y: auto;
  z-index: 200;
  padding: 8px;
}

.pop-header {
  font-size: 12px;
  font-weight: 700;
  color: #5a4632;
  margin-bottom: 6px;
  padding: 4px;
}

.pop-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}

.pop-item:hover:not(.disabled) {
  background: #ecdcb9;
}

.pop-item.disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.pop-name {
  font-weight: 700;
  color: #1a140d;
  font-size: 13px;
}

.pop-badge {
  font-size: 11px;
  background: #dfd2b7;
  padding: 2px 6px;
  border-radius: 4px;
  color: #451a03;
}

.pop-status {
  font-size: 11px;
  color: #991b1b;
}

/* 视口 */
.canvas-viewport {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  transform-origin: 0 0;
}

.canvas-svg-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
}

.relation-path-hover {
  fill: none;
  stroke: transparent;
  stroke-width: 16;
  cursor: pointer;
  pointer-events: stroke;
}

.relation-path-line {
  fill: none;
  stroke: #b45309;
  stroke-width: 2.5;
  pointer-events: none;
  transition: stroke 0.2s;
}

.relation-path-line.selected {
  stroke: #dc2626;
  stroke-width: 3.5;
}

.relation-temp-wire {
  fill: none;
  stroke: #ea580c;
  stroke-width: 2.5;
  stroke-dasharray: 6 4;
}

/* 关系文字标签 */
.relation-labels-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 10;
}

.relation-label-badge {
  position: absolute;
  transform: translate(-50%, -50%);
  background: #fbf7ee;
  border: 1.5px solid #b45309;
  border-radius: 12px;
  padding: 3px 10px;
  display: flex;
  align-items: center;
  gap: 6px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.15);
  font-size: 11.5px;
  font-weight: 700;
  color: #92400e;
  cursor: pointer;
  pointer-events: auto;
  transition: transform 0.15s, border-color 0.15s;
}

.relation-label-badge:hover {
  transform: translate(-50%, -50%) scale(1.08);
  border-color: #dc2626;
}

.del-rel-btn {
  background: transparent;
  border: none;
  color: #dc2626;
  cursor: pointer;
  font-size: 10px;
  font-weight: 900;
  padding: 0;
}

.relation-input {
  border: 1px solid #ea580c;
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 11px;
  outline: none;
  width: 100px;
}

/* 人物卡节点 */
.canvas-nodes-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 5;
}

.canvas-char-card {
  position: absolute;
  width: 260px;
  background-color: #f7f1e3;
  background-image: 
    linear-gradient(rgba(180, 150, 110, 0.15) 1px, transparent 1px),
    linear-gradient(90deg, rgba(180, 150, 110, 0.15) 1px, transparent 1px);
  background-size: 12px 12px;
  border: 2px solid #5a4632;
  border-radius: 8px;
  box-shadow: 0 6px 16px rgba(90, 70, 50, 0.25);
  padding: 10px 12px;
  cursor: grab;
  transition: box-shadow 0.2s, border-color 0.2s;
  font-family: "Noto Serif SC", "Songti SC", serif;
}

.canvas-char-card:hover {
  border-color: #ea580c;
  box-shadow: 0 8px 20px rgba(234, 88, 12, 0.3);
}

.canvas-char-card:active {
  cursor: grabbing;
}

.card-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #a8947c;
  padding-bottom: 4px;
  margin-bottom: 6px;
}

.card-archive-no {
  font-family: monospace;
  font-size: 10px;
  font-weight: 700;
  color: #6b5235;
}

.remove-card-btn {
  background: transparent;
  border: none;
  color: #991b1b;
  cursor: pointer;
  font-weight: 900;
  font-size: 11px;
}

.card-name-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.card-name {
  font-size: 18px;
  font-weight: 900;
  color: #1a140d;
}

.card-stamp-badge {
  font-size: 9.5px;
  font-weight: 800;
  color: #b91c1c;
  border: 1px solid #b91c1c;
  padding: 1px 4px;
  border-radius: 2px;
}

.card-identity-badge {
  font-size: 11px;
  font-weight: 700;
  color: #451a03;
  background: #e5d8be;
  padding: 2px 6px;
  border-radius: 4px;
  display: inline-block;
  margin-bottom: 6px;
}

.card-quote-preview {
  font-size: 11px;
  font-style: italic;
  color: #b45309;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 4 端点 */
.port {
  position: absolute;
  width: 12px;
  height: 12px;
  background: #ea580c;
  border: 2px solid #ffffff;
  border-radius: 50%;
  cursor: crosshair;
  transition: transform 0.15s, background 0.15s;
  z-index: 20;
}

.port:hover {
  transform: scale(1.4);
  background: #b91c1c;
}

.port-top {
  top: -6px;
  left: calc(50% - 6px);
}

.port-right {
  top: calc(50% - 6px);
  right: -6px;
}

.port-bottom {
  bottom: -6px;
  left: calc(50% - 6px);
}

.port-left {
  top: calc(50% - 6px);
  left: -6px;
}
</style>
