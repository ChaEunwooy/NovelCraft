<template>
  <aside
    ref="panelRef"
    class="panel-mindmap"
    :class="{ collapsed: !isOpen, fullscreen: isFullscreen }"
    :style="panelStyle"
  >
    <!-- 悬浮贴在思维导图面板左外侧、上下垂直居中的全屏/恢复按键 -->
    <button
      class="mindmap-fullscreen-side-btn"
      :class="{ 'is-fullscreen': isFullscreen }"
      @click="toggleFullscreen"
      :title="isFullscreen ? '🗗 退出全屏 (恢复分屏模式)' : '⛶ 全屏沉浸展开思维导图与世界地图'"
    >
      <span class="side-btn-icon">{{ isFullscreen ? '🗗' : '⛶' }}</span>
      <span class="side-btn-text">{{ isFullscreen ? '退出全屏' : '全屏导图' }}</span>
    </button>

    <!-- 左侧可拖拽调宽分割线 -->
    <div
      class="mindmap-resizer"
      @mousedown="startResize"
      @dblclick="resetWidth"
      title="按住左右拖动调整面板宽度 | 双击恢复默认宽度"
    ></div>

    <!-- 头部工具栏 (大纲层级选择器 + 辅助工具) -->
    <div class="mindmap-header">
      <div class="mindmap-title" :title="scopeDisplayTitle">
        <span>{{ scopeIcon }} {{ scopeDisplayTitle }}</span>
      </div>

      <!-- 三段式大纲层级选择器 [ 🌟 整体大纲 ] [ 📖 卷大纲 ] [ 📝 章节大纲 ] -->
      <div v-if="currentTab === 'mindmap'" class="outline-scope-switcher">
        <button
          class="scope-btn"
          :class="{ active: currentScope === 'global' }"
          @click="onSelectScope('global')"
          title="全书核心立意、主线走向与终局设计"
        >
          🌟 整体大纲
        </button>
        <button
          class="scope-btn"
          :class="{ active: currentScope === 'volume' }"
          @click="onSelectScope('volume')"
          title="当前卷的剧情起承转合与阶段高潮"
        >
          📖 卷大纲
        </button>
        <button
          class="scope-btn"
          :class="{ active: currentScope === 'chapter' }"
          @click="onSelectScope('chapter')"
          title="当前章节的开篇钩子、核心事件与细纲流"
        >
          📝 章节大纲
        </button>
      </div>

      <div class="mindmap-toolbar">
        <template v-if="currentTab === 'mindmap'">
          <button class="mindmap-btn" @click="addChildNode" title="添加新剧情节点 (Tab)">+</button>
          <button class="mindmap-btn" @click="deleteNode" title="删除选中节点 (Del)">-</button>
          <button class="mindmap-btn" @click="resetView" title="重置视角">🎯</button>
        </template>
        <button
          class="mindmap-btn tab-switch-btn"
          :class="{ active: currentTab === 'worldmap' }"
          @click="currentTab = currentTab === 'mindmap' ? 'worldmap' : 'mindmap'"
          :title="currentTab === 'mindmap' ? '切换至世界观势力与地形地图画板' : '返回大纲思维导图'"
        >
          {{ currentTab === 'mindmap' ? '🗺️ 世界地图' : '🧠 大纲导图' }}
        </button>
      </div>
    </div>

    <!-- 视图 1：思维导图交互画布 -->
    <div
      v-if="currentTab === 'mindmap'"
      ref="wrapperRef"
      class="mindmap-canvas-wrapper"
      @mousedown="onCanvasMouseDown"
      @wheel.prevent="onWheel"
    >
      <div
        class="mindmap-viewport"
        :style="{ transform: `translate(${panX}px, ${panY}px) scale(${zoomLevel})` }"
      >
        <!-- SVG 连线层 (overflow: visible 确保节点拖到任意高度线条都不被截断) -->
        <svg class="mindmap-svg-connections" style="overflow: visible;">
          <!-- 树状层级主连线 -->
          <path
            v-for="line in treeLines"
            :key="line.id"
            :d="line.d"
            class="tree-link-path"
          />
          <!-- 跨分支自定义关联虚线 (点击直接删除，无弹窗) -->
          <path
            v-for="link in crossLinesRender"
            :key="link.id"
            :d="link.d"
            class="custom-link-path"
            @click.stop="removeCrossLink(link)"
            title="点击删除此关联连线"
          />
          <!-- 正在拉出的动态连线指示线 -->
          <path
            v-if="tempWireD"
            :d="tempWireD"
            class="temp-wire-path"
          />
        </svg>

        <!-- 节点 HTML 层 -->
        <div class="mindmap-nodes-layer">
          <div
            v-for="node in flatNodes"
            :key="node.id"
            :id="`node-${node.id}`"
            class="mind-node"
            :class="[node.nodeType, { selected: node.id === selectedNodeId }]"
            :style="{ left: node.x + 'px', top: node.y + 'px' }"
            @mousedown.stop="onNodeMouseDown($event, node)"
            @mouseup="onNodeMouseUp($event, node)"
            @dblclick.stop="startEditNode(node)"
          >
            <!-- 原地就地修改节点文本 -->
            <input
              v-if="editingNodeId === node.id"
              ref="nodeInputRef"
              v-model="editingNodeText"
              class="inline-node-input"
              @click.stop
              @mousedown.stop
              @keydown.enter="confirmEditNode(node)"
              @keydown.esc="editingNodeId = ''"
              @blur="confirmEditNode(node)"
            />
            <span v-else>{{ node.text }}</span>

            <!-- 节点右侧手动连线小圆点 (Port) -->
            <div
              class="node-port"
              title="按住并拖拽连线至其他节点"
              @mousedown.stop="startWireConnection($event, node)"
            ></div>
          </div>
        </div>
      </div>

      <!-- 悬浮缩放控制 -->
      <div class="mindmap-floating-controls">
        <button class="mindmap-btn" @click="zoom(1.1)" title="放大">+</button>
        <button class="mindmap-btn" @click="zoom(0.9)" title="缩小">-</button>
      </div>

      <div class="mindmap-hint">
        💡 自由推演大纲剧情 | 双击节点就地改名 | 拖拽右侧小圆点建立伏笔关联
      </div>
    </div>

    <!-- 视图 2：世界观与势力地图绘制画板 -->
    <WorldMapCanvas
      v-else
      :book-id="mindMapData?.bookId"
    />
  </aside>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue';
import type { MindMapNode, MindMapData, CrossLink, OutlineScope } from '../types/novel';
import WorldMapCanvas from './WorldMapCanvas.vue';

const props = defineProps<{
  isOpen: boolean;
  bookTitle?: string;
  currentScope?: OutlineScope;
  currentVolumeTitle?: string;
  currentChapterTitle?: string;
  mindMapData?: MindMapData;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'change-scope', scope: OutlineScope): void;
  (e: 'update-mindmap', data: MindMapData): void;
}>();

const currentTab = ref<'mindmap' | 'worldmap'>('mindmap');

const panelWidth = ref(480);
const isFullscreen = ref(false);

const panX = ref(40);
const panY = ref(100);
const zoomLevel = ref(1.0);

const selectedNodeId = ref('');

const currentScope = computed(() => props.currentScope || 'global');

const scopeIcon = computed(() => {
  if (currentTab.value === 'worldmap') return '🗺️';
  switch (currentScope.value) {
    case 'global': return '🌟';
    case 'volume': return '📖';
    case 'chapter': return '📝';
    default: return '🧠';
  }
});

const scopeDisplayTitle = computed(() => {
  if (currentTab.value === 'worldmap') {
    const clean = (props.bookTitle || '小说').replace(/[《》\s]/g, '');
    return `《${clean}》世界势力地图`;
  }

  const cleanBook = (props.bookTitle || '小说').replace(/[《》\s]/g, '');
  if (currentScope.value === 'global') {
    return `整体大纲 · 《${cleanBook}》`;
  } else if (currentScope.value === 'volume') {
    return `卷大纲 · ${props.currentVolumeTitle || '第一卷'}`;
  } else {
    return `章节大纲 · ${props.currentChapterTitle || '当前章节'}`;
  }
});

function onSelectScope(scope: OutlineScope) {
  emit('change-scope', scope);
}

// 原地编辑节点文字状态
const editingNodeId = ref('');
const editingNodeText = ref('');
const nodeInputRef = ref<HTMLInputElement[] | null>(null);

function startEditNode(node: MindMapNode) {
  editingNodeId.value = node.id;
  editingNodeText.value = node.text;
  nextTick(() => {
    if (nodeInputRef.value && nodeInputRef.value.length > 0) {
      nodeInputRef.value[0].focus();
      nodeInputRef.value[0].select();
    }
  });
}

function confirmEditNode(node: MindMapNode) {
  if (editingNodeId.value !== node.id || !props.mindMapData) return;
  const val = editingNodeText.value.trim();
  if (val && val !== node.text) {
    node.text = val;
    emit('update-mindmap', props.mindMapData);
  }
  editingNodeId.value = '';
}

// 拖拽节点状态
let isDraggingNode = false;
let activeDragNode: MindMapNode | null = null;
let dragNodeOffsetX = 0;
let dragNodeOffsetY = 0;

// 画布平移状态
let isPanningCanvas = false;
let startPanX = 0;
let startPanY = 0;

// 手动连线状态
const isConnectingWire = ref(false);
let wireSourceNode: MindMapNode | null = null;
const tempWireD = ref('');

const panelStyle = computed(() => {
  if (isFullscreen.value) return {};
  return { width: `${panelWidth.value}px` };
});

const currentRoot = computed(() => {
  return props.mindMapData?.root;
});

const currentCrossLinks = computed(() => {
  return props.mindMapData?.crossLinks || [];
});

// 平铺所有节点供渲染
const flatNodes = computed(() => {
  const list: MindMapNode[] = [];
  if (!currentRoot.value) return list;

  function traverse(node: MindMapNode) {
    list.push(node);
    if (node.children) {
      node.children.forEach(traverse);
    }
  }
  traverse(currentRoot.value);
  return list;
});

// 计算树状层级连线
const treeLines = computed(() => {
  const lines: { id: string; d: string }[] = [];
  if (!currentRoot.value) return lines;

  function traverse(parent: MindMapNode) {
    if (!parent.children) return;
    parent.children.forEach(child => {
      const x1 = parent.x + 120;
      const y1 = parent.y + 16;
      const x2 = child.x;
      const y2 = child.y + 16;
      const dx = Math.abs(x2 - x1) * 0.5;
      lines.push({
        id: `${parent.id}-${child.id}`,
        d: `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`
      });
      traverse(child);
    });
  }
  traverse(currentRoot.value);
  return lines;
});

// 计算跨分支自定义关联虚线
const crossLinesRender = computed(() => {
  const result: { id: string; fromId: string; toId: string; label: string; d: string }[] = [];
  const nodeMap = new Map<string, MindMapNode>();
  flatNodes.value.forEach(n => nodeMap.set(n.id, n));

  currentCrossLinks.value.forEach((link, idx) => {
    const from = nodeMap.get(link.fromId);
    const to = nodeMap.get(link.toId);
    if (from && to) {
      const x1 = from.x + 120;
      const y1 = from.y + 16;
      const x2 = to.x;
      const y2 = to.y + 16;
      const dx = Math.abs(x2 - x1) * 0.5;
      result.push({
        id: link.id || `cross_${idx}`,
        fromId: link.fromId,
        toId: link.toId,
        label: link.label,
        d: `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`
      });
    }
  });
  return result;
});

// 节点拖拽
function onNodeMouseDown(e: MouseEvent, node: MindMapNode) {
  selectedNodeId.value = node.id;
  isDraggingNode = true;
  activeDragNode = node;

  const wrapperRect = (e.currentTarget as HTMLElement).closest('.mindmap-canvas-wrapper')?.getBoundingClientRect();
  if (!wrapperRect) return;

  const mouseLogicalX = (e.clientX - wrapperRect.left - panX.value) / zoomLevel.value;
  const mouseLogicalY = (e.clientY - wrapperRect.top - panY.value) / zoomLevel.value;

  dragNodeOffsetX = mouseLogicalX - node.x;
  dragNodeOffsetY = mouseLogicalY - node.y;
}

// 开始手动拉线
function startWireConnection(e: MouseEvent, node: MindMapNode) {
  e.preventDefault();
  isConnectingWire.value = true;
  wireSourceNode = node;
}

// 在目标节点松开就地建立连线 (无弹窗)
function onNodeMouseUp(e: MouseEvent, targetNode: MindMapNode) {
  if (isConnectingWire.value && wireSourceNode && wireSourceNode.id !== targetNode.id && props.mindMapData) {
    if (!props.mindMapData.crossLinks) props.mindMapData.crossLinks = [];

    const exists = props.mindMapData.crossLinks.some(
      l => l.fromId === wireSourceNode!.id && l.toId === targetNode.id
    );

    if (!exists) {
      props.mindMapData.crossLinks.push({
        id: 'link_' + Date.now(),
        fromId: wireSourceNode.id,
        toId: targetNode.id,
        label: '伏笔关联'
      });
      emit('update-mindmap', props.mindMapData);
    }
  }
}

function removeCrossLink(link: { fromId: string; toId: string; label: string }) {
  if (!props.mindMapData) return;
  props.mindMapData.crossLinks = (props.mindMapData.crossLinks || []).filter(
    l => !(l.fromId === link.fromId && l.toId === link.toId)
  );
  emit('update-mindmap', props.mindMapData);
}

// 画布平移
function onCanvasMouseDown(e: MouseEvent) {
  if ((e.target as HTMLElement).closest('.mind-node') || (e.target as HTMLElement).closest('.mindmap-floating-controls')) return;
  isPanningCanvas = true;
  startPanX = e.clientX - panX.value;
  startPanY = e.clientY - panY.value;
}

function onGlobalMouseMove(e: MouseEvent) {
  if (isDraggingNode && activeDragNode) {
    const wrapper = document.querySelector('.mindmap-canvas-wrapper');
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    const logicalX = (e.clientX - rect.left - panX.value) / zoomLevel.value;
    const logicalY = (e.clientY - rect.top - panY.value) / zoomLevel.value;

    activeDragNode.x = Math.round(logicalX - dragNodeOffsetX);
    activeDragNode.y = Math.round(logicalY - dragNodeOffsetY);
    return;
  }

  if (isConnectingWire.value && wireSourceNode) {
    const wrapper = document.querySelector('.mindmap-canvas-wrapper');
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    const x1 = wireSourceNode.x + 120;
    const y1 = wireSourceNode.y + 16;
    const mouseX = (e.clientX - rect.left - panX.value) / zoomLevel.value;
    const mouseY = (e.clientY - rect.top - panY.value) / zoomLevel.value;
    const dx = Math.abs(mouseX - x1) * 0.5;
    tempWireD.value = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${mouseX - dx} ${mouseY}, ${mouseX} ${mouseY}`;
    return;
  }

  if (isPanningCanvas) {
    panX.value = e.clientX - startPanX;
    panY.value = e.clientY - startPanY;
  }
}

function onGlobalMouseUp() {
  if (isDraggingNode && props.mindMapData) {
    emit('update-mindmap', props.mindMapData);
  }
  isDraggingNode = false;
  activeDragNode = null;
  isPanningCanvas = false;

  if (isConnectingWire.value) {
    isConnectingWire.value = false;
    wireSourceNode = null;
    tempWireD.value = '';
  }
}

function onWheel(e: WheelEvent) {
  const delta = e.deltaY < 0 ? 1.08 : 0.92;
  zoomLevel.value = Math.min(Math.max(0.4, zoomLevel.value * delta), 2.5);
}

function zoom(factor: number) {
  zoomLevel.value = Math.min(Math.max(0.4, zoomLevel.value * factor), 2.5);
}

function resetView() {
  zoomLevel.value = 1.0;
  panX.value = 40;
  panY.value = 100;
}

function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value;
}

function addChildNode() {
  if (!props.mindMapData || !props.mindMapData.root) return;

  function findAndAdd(n: MindMapNode): boolean {
    if (n.id === selectedNodeId.value || (!selectedNodeId.value && n === props.mindMapData?.root)) {
      if (!n.children) n.children = [];
      const newId = 'node_' + Date.now();
      const newNode: MindMapNode = {
        id: newId,
        text: '新剧情节点',
        x: n.x + 140,
        y: n.y + (n.children.length * 48) - 20,
        children: []
      };
      n.children.push(newNode);
      selectedNodeId.value = newId;
      nextTick(() => {
        startEditNode(newNode);
      });
      return true;
    }
    if (n.children) {
      for (const child of n.children) {
        if (findAndAdd(child)) return true;
      }
    }
    return false;
  }

  findAndAdd(props.mindMapData.root);
  emit('update-mindmap', props.mindMapData);
}

function deleteNode() {
  if (!props.mindMapData || !props.mindMapData.root) return;
  if (selectedNodeId.value === props.mindMapData.root.id) {
    return;
  }

  function findAndDelete(n: MindMapNode): boolean {
    if (!n.children) return false;
    const idx = n.children.findIndex(c => c.id === selectedNodeId.value);
    if (idx !== -1) {
      n.children.splice(idx, 1);
      selectedNodeId.value = props.mindMapData!.root.id;
      return true;
    }
    for (const child of n.children) {
      if (findAndDelete(child)) return true;
    }
    return false;
  }

  findAndDelete(props.mindMapData.root);
  emit('update-mindmap', props.mindMapData);
}

// 左右拖拽调宽分割线
let isResizing = false;
let resizeStartX = 0;
let resizeStartWidth = 0;

function startResize(e: MouseEvent) {
  if (isFullscreen.value || !props.isOpen) return;
  isResizing = true;
  resizeStartX = e.clientX;
  resizeStartWidth = panelWidth.value;
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';

  const onMouseMove = (ev: MouseEvent) => {
    if (!isResizing) return;
    const delta = resizeStartX - ev.clientX;
    panelWidth.value = Math.max(280, Math.min(window.innerWidth * 0.85, resizeStartWidth + delta));
  };

  const onMouseUp = () => {
    isResizing = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  };

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
}

function resetWidth() {
  panelWidth.value = 440;
}

onMounted(() => {
  window.addEventListener('mousemove', onGlobalMouseMove);
  window.addEventListener('mouseup', onGlobalMouseUp);
});

onUnmounted(() => {
  window.removeEventListener('mousemove', onGlobalMouseMove);
  window.removeEventListener('mouseup', onGlobalMouseUp);
});
</script>

<style scoped>
.panel-mindmap {
  background: var(--bg-primary);
  border-left: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  overflow: visible;
  flex-shrink: 0;
  position: relative;
  user-select: none;
  opacity: 1;
  transform: translateX(0);
  transition: width 0.45s cubic-bezier(0.16, 1, 0.3, 1),
              opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1),
              transform 0.45s cubic-bezier(0.16, 1, 0.3, 1),
              background-color 0.2s ease,
              border-color 0.2s ease;
}

/* 贴在导图面板左外侧、上下垂直居中的全屏按键 */
.mindmap-fullscreen-side-btn {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translate(-100%, -50%);
  z-index: 60;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-right: none;
  border-radius: 8px 0 0 8px;
  box-shadow: -4px 0 12px rgba(0, 0, 0, 0.08);
  padding: 12px 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  color: var(--text-main);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  user-select: none;
}

.mindmap-fullscreen-side-btn:hover {
  background: var(--bg-secondary);
  border-color: var(--accent);
  color: var(--accent);
  box-shadow: -5px 0 16px rgba(79, 70, 229, 0.25);
  padding-left: 8px;
}

.mindmap-fullscreen-side-btn.is-fullscreen {
  left: 0;
  transform: translate(0, -50%);
  border-left: none;
  border-right: 1px solid var(--border-color);
  border-radius: 0 8px 8px 0;
  box-shadow: 4px 0 12px rgba(0, 0, 0, 0.15);
}

.mindmap-fullscreen-side-btn .side-btn-icon {
  font-size: 14px;
  line-height: 1;
}

.mindmap-fullscreen-side-btn .side-btn-text {
  writing-mode: vertical-lr;
  letter-spacing: 2px;
  font-size: 11px;
  font-weight: 700;
}

.panel-mindmap.collapsed {
  width: 0 !important;
  border-left: 1px solid transparent;
  opacity: 0;
  transform: translateX(20px);
  pointer-events: none;
}

.panel-mindmap.fullscreen {
  position: fixed;
  top: 48px;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw !important;
  height: calc(100vh - 48px) !important;
  z-index: 100;
  box-shadow: 0 0 30px rgba(0,0,0,0.15);
}

.mindmap-resizer {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 5px;
  cursor: col-resize;
  background: transparent;
  z-index: 40;
  transition: background 0.15s;
}

.mindmap-resizer:hover {
  background: var(--accent);
  box-shadow: 0 0 8px rgba(79, 70, 229, 0.4);
}

.mindmap-header {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg-primary);
  z-index: 10;
  gap: 8px;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.mindmap-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-main);
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}

/* 三段式大纲视图选择器 */
.outline-scope-switcher {
  display: flex;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  padding: 2px;
  border-radius: 6px;
  gap: 2px;
}

.scope-btn {
  padding: 3px 8px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.scope-btn:hover {
  color: var(--text-main);
}

.scope-btn.active {
  background: var(--bg-primary);
  border-color: var(--border-color);
  color: var(--accent);
  font-weight: 700;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}

.tab-switch-btn.active {
  background: var(--accent);
  color: #ffffff;
  border-color: var(--accent);
}

.mindmap-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.mindmap-btn {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.mindmap-btn:hover {
  background: var(--bg-secondary);
  border-color: var(--accent);
  color: var(--accent);
}

.mindmap-canvas-wrapper {
  flex: 1;
  position: relative;
  overflow: hidden;
  background-color: var(--bg-primary);
  background-image: radial-gradient(var(--border-color) 1.2px, transparent 1.2px);
  background-size: 22px 22px;
  cursor: grab;
  transition: background-color 0.2s ease;
}

.mindmap-canvas-wrapper:active {
  cursor: grabbing;
}

.mindmap-viewport {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  transform-origin: 0 0;
}

.mindmap-svg-connections {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
  z-index: 1;
}

.tree-link-path {
  fill: none;
  stroke: var(--accent);
  stroke-width: 2.2;
  opacity: 0.85;
}

.custom-link-path {
  fill: none;
  stroke: #d97706;
  stroke-width: 2;
  stroke-dasharray: 5, 3;
  opacity: 0.85;
  cursor: pointer;
  pointer-events: stroke;
}

.custom-link-path:hover {
  stroke: #dc2626;
  stroke-width: 3;
}

.temp-wire-path {
  fill: none;
  stroke: var(--accent);
  stroke-width: 2;
  stroke-dasharray: 4, 4;
}

.mindmap-nodes-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 2;
}

.mind-node {
  position: absolute;
  padding: 7px 14px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-main);
  background: var(--bg-primary);
  border: 1.5px solid var(--border-color);
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  white-space: nowrap;
  user-select: none;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: grab;
  transition: border-color 0.15s, box-shadow 0.15s, background-color 0.2s ease, color 0.2s ease;
}

.mind-node:hover {
  border-color: var(--accent);
  box-shadow: 0 0 10px rgba(79, 70, 229, 0.2);
}

.mind-node.selected {
  border-color: var(--accent);
  background: var(--bg-secondary);
  color: var(--accent);
  box-shadow: 0 0 12px rgba(79, 70, 229, 0.25);
  font-weight: 700;
}

.mind-node.root-node {
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  color: #ffffff;
  font-weight: 700;
  border-color: transparent;
}

.mind-node.branch-node {
  border-left: 4px solid #f59e0b;
}

.inline-node-input {
  background: var(--bg-primary);
  border: 1px solid var(--accent);
  border-radius: 4px;
  padding: 1px 4px;
  font-size: 12px;
  color: var(--text-main);
  outline: none;
}

.node-port {
  width: 10px;
  height: 10px;
  background: var(--bg-primary);
  border: 2px solid var(--accent);
  border-radius: 50%;
  position: absolute;
  right: -6px;
  top: 50%;
  transform: translateY(-50%);
  cursor: crosshair;
  transition: all 0.15s ease;
  z-index: 10;
}

.node-port:hover {
  transform: translateY(-50%) scale(1.4);
  background: var(--accent);
  box-shadow: 0 0 8px var(--accent);
}

.mindmap-floating-controls {
  position: absolute;
  bottom: 14px;
  right: 14px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 4px;
  display: flex;
  gap: 4px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  z-index: 20;
}

.mindmap-hint {
  position: absolute;
  bottom: 14px;
  left: 14px;
  font-size: 10px;
  font-weight: 500;
  color: var(--text-dim);
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  padding: 3px 8px;
  border-radius: 4px;
  pointer-events: none;
}
</style>
