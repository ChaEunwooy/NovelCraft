<template>
  <div class="worldmap-container">
    <!-- 地图专业工具栏 -->
    <div class="worldmap-toolbar">
      <!-- 模式选择组 -->
      <div class="tool-group">
        <button
          class="map-tool-btn"
          :class="{ active: currentTool === 'pan' }"
          @click="currentTool = 'pan'"
          title="抓手漫游视角 (按住拖拽画布)"
        >
          ✋ 漫游
        </button>
        <button
          class="map-tool-btn"
          :class="{ active: currentTool === 'brush' }"
          @click="currentTool = 'brush'"
          title="画笔工具 (绘制大陆轮廓、海岸线、边界)"
        >
          🖌️ 笔刷
        </button>
        <button
          class="map-tool-btn"
          :class="{ active: currentTool === 'eraser' }"
          @click="currentTool = 'eraser'"
          title="橡皮擦"
        >
          🧹 橡皮
        </button>
        <button
          class="map-tool-btn"
          :class="{ active: currentTool === 'stamp' }"
          @click="currentTool = 'stamp'"
          title="地标印章 (点击画布放置势力、山脉、要塞)"
        >
          🏰 地标印章
        </button>
        <button
          class="map-tool-btn"
          :class="{ active: currentTool === 'route' }"
          @click="currentTool = 'route'"
          title="行军路线 (点击两点绘制连线)"
        >
          🚩 行军路线
        </button>
      </div>

      <!-- 笔刷颜色与粗细 -->
      <div v-if="currentTool === 'brush'" class="tool-group tool-sub">
        <div class="color-picker-row">
          <button
            v-for="c in brushColors"
            :key="c"
            class="color-dot"
            :style="{ background: c }"
            :class="{ active: brushColor === c }"
            @click="brushColor = c"
          ></button>
        </div>
        <select v-model.number="brushWidth" class="tool-select">
          <option :value="2">细线 2px</option>
          <option :value="4">标准 4px</option>
          <option :value="8">粗轮廓 8px</option>
          <option :value="16">宽色块 16px</option>
        </select>
      </div>

      <!-- 印章图标选择 -->
      <div v-if="currentTool === 'stamp'" class="tool-group tool-sub">
        <button
          v-for="st in stampList"
          :key="st.type"
          class="stamp-select-btn"
          :class="{ active: selectedStampType === st.type }"
          @click="selectedStampType = st.type"
          :title="st.name"
        >
          <span>{{ st.icon }}</span>
          <span>{{ st.name }}</span>
        </button>
      </div>

      <!-- 画布操作组 -->
      <div class="tool-group map-actions-right">
        <button class="map-tool-btn" @click="undo" :disabled="historyStack.length === 0" title="撤销">↩️ 撤销</button>
        <button class="map-tool-btn" @click="clearCanvas" title="清空画板">🗑️ 清空</button>
        <button class="map-tool-btn highlight" @click="exportMapImage" title="导出高清地图图片">💾 导出</button>
      </div>
    </div>

    <!-- 地图画布视口 (左键绘制 + 按住右键漫游拖拽 + 滚轮缩放) -->
    <div
      ref="mapWrapperRef"
      class="worldmap-viewport"
      :class="[`cursor-${isRightPanning ? 'panning' : currentTool}`]"
      @mousedown="onMouseDown"
      @contextmenu.prevent
      @wheel.prevent="onWheel"
    >
      <div
        class="worldmap-pan-layer"
        :style="{ transform: `translate(${panX}px, ${panY}px) scale(${zoomLevel})` }"
      >
        <!-- 底层绘图 Canvas -->
        <canvas
          ref="canvasRef"
          width="2400"
          height="1600"
          class="map-drawing-canvas"
        ></canvas>

        <!-- 上层交互地标与路线层 -->
        <svg class="map-svg-layer">
          <!-- 行军路线虚线 -->
          <g v-for="route in mapRoutes" :key="route.id">
            <line
              :x1="route.x1"
              :y1="route.y1"
              :x2="route.x2"
              :y2="route.y2"
              class="route-line"
            />
            <text
              :x="(route.x1 + route.x2) / 2"
              :y="(route.y1 + route.y2) / 2 - 8"
              class="route-label"
            >
              {{ route.label }}
            </text>
          </g>
          <!-- 正在拉出的行军线 -->
          <line
            v-if="isDrawingRoute && tempRoute"
            :x1="tempRoute.x1"
            :y1="tempRoute.y1"
            :x2="tempRoute.x2"
            :y2="tempRoute.y2"
            class="route-line-temp"
          />
        </svg>

        <!-- 地标图元 DOM 层 (支持自由拖拽与原地改名) -->
        <div class="map-landmarks-layer">
          <div
            v-for="lm in mapLandmarks"
            :key="lm.id"
            class="landmark-item"
            :style="{ left: lm.x + 'px', top: lm.y + 'px' }"
            @mousedown.stop="startDragLandmark($event, lm)"
            @dblclick.stop="startEditLandmark(lm)"
          >
            <span class="landmark-icon">{{ lm.icon }}</span>
            <!-- 原地就地修改地名 -->
            <input
              v-if="editingLandmarkId === lm.id"
              ref="landmarkInputRef"
              v-model="editingLandmarkName"
              class="inline-landmark-input"
              @click.stop
              @mousedown.stop
              @keydown.enter="confirmEditLandmark(lm)"
              @keydown.esc="editingLandmarkId = ''"
              @blur="confirmEditLandmark(lm)"
            />
            <span v-else class="landmark-name">{{ lm.name }}</span>
            <button class="landmark-del-btn" @click.stop="deleteLandmark(lm)" title="删除此地标">✕</button>
          </div>
        </div>
      </div>

      <!-- 悬浮缩放控制器 -->
      <div class="map-floating-zoom">
        <button class="zoom-btn" @click="zoom(1.15)">+</button>
        <button class="zoom-btn" @click="zoom(0.85)">-</button>
        <button class="zoom-btn reset" @click="resetView">🎯</button>
      </div>

      <div class="map-hint">
        🗺️ 鼠标左键绘制/盖章 | 按住鼠标右键自由拖拽漫游画布 | 滚轮无级缩放
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue';

const props = defineProps<{
  bookId?: string;
}>();

const currentTool = ref<'pan' | 'brush' | 'eraser' | 'stamp' | 'route'>('brush');
const brushColor = ref('#2b2416');
const brushWidth = ref(4);

const brushColors = ['#2b2416', '#dc2626', '#2563eb', '#059669', '#7c3aed', '#d97706', '#64748b'];

const selectedStampType = ref('capital');
const stampList = [
  { type: 'capital', name: '皇都/王城', icon: '👑' },
  { type: 'city', name: '主要城邦', icon: '🏰' },
  { type: 'mountain', name: '险峰山脉', icon: '🏔️' },
  { type: 'sect', name: '古老宗门', icon: '⛩️' },
  { type: 'ruins', name: '上古遗迹', icon: '🏛️' },
  { type: 'forest', name: '迷雾森林', icon: '🌲' },
  { type: 'danger', name: '禁区险地', icon: '💀' }
];

interface Landmark {
  id: string;
  type: string;
  name: string;
  icon: string;
  x: number;
  y: number;
}

interface MapRoute {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
}

const mapLandmarks = ref<Landmark[]>([]);
const mapRoutes = ref<MapRoute[]>([]);

// 视口与缩放
const panX = ref(40);
const panY = ref(40);
const zoomLevel = ref(0.7);

const canvasRef = ref<HTMLCanvasElement | null>(null);
const mapWrapperRef = ref<HTMLDivElement | null>(null);

let ctx: CanvasRenderingContext2D | null = null;
let isDrawing = false;
let lastX = 0;
let lastY = 0;

// 历史记录撤销栈
const historyStack = ref<ImageData[]>([]);

// 原地编辑地标名称
const editingLandmarkId = ref('');
const editingLandmarkName = ref('');
const landmarkInputRef = ref<HTMLInputElement[] | null>(null);

function startEditLandmark(lm: Landmark) {
  editingLandmarkId.value = lm.id;
  editingLandmarkName.value = lm.name;
  nextTick(() => {
    if (landmarkInputRef.value && landmarkInputRef.value.length > 0) {
      landmarkInputRef.value[0].focus();
      landmarkInputRef.value[0].select();
    }
  });
}

function confirmEditLandmark(lm: Landmark) {
  if (editingLandmarkId.value !== lm.id) return;
  const val = editingLandmarkName.value.trim();
  if (val) {
    lm.name = val;
    saveMapData();
  }
  editingLandmarkId.value = '';
}

function deleteLandmark(lm: Landmark) {
  mapLandmarks.value = mapLandmarks.value.filter(l => l.id !== lm.id);
  saveMapData();
}

// 拖拽地标
let isDraggingLandmark = false;
let dragLandmark: Landmark | null = null;
let dragOffsetX = 0;
let dragOffsetY = 0;

function startDragLandmark(e: MouseEvent, lm: Landmark) {
  isDraggingLandmark = true;
  dragLandmark = lm;
  const rect = mapWrapperRef.value?.getBoundingClientRect();
  if (!rect) return;
  const logicalX = (e.clientX - rect.left - panX.value) / zoomLevel.value;
  const logicalY = (e.clientY - rect.top - panY.value) / zoomLevel.value;
  dragOffsetX = logicalX - lm.x;
  dragOffsetY = logicalY - lm.y;
}

// 行军路线绘制
const isDrawingRoute = ref(false);
const tempRoute = ref<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

// 初始化画板
onMounted(() => {
  if (canvasRef.value) {
    ctx = canvasRef.value.getContext('2d', { willReadFrequently: true });
    initCanvasBackground();
    loadMapData();
  }
  window.addEventListener('mousemove', onGlobalMouseMove);
  window.addEventListener('mouseup', onGlobalMouseUp);
});

onUnmounted(() => {
  window.removeEventListener('mousemove', onGlobalMouseMove);
  window.removeEventListener('mouseup', onGlobalMouseUp);
});

// 监听小说切换自动加载对应地图
watch(() => props.bookId, () => {
  loadMapData();
});

function initCanvasBackground() {
  if (!ctx || !canvasRef.value) return;
  ctx.fillStyle = '#fcf8ec'; // 羊皮纸复古底色
  ctx.fillRect(0, 0, canvasRef.value.width, canvasRef.value.height);

  // 绘制复古海域细网格点阵
  ctx.strokeStyle = '#e6dcbc';
  ctx.lineWidth = 0.8;
  const step = 40;
  for (let x = 0; x < canvasRef.value.width; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvasRef.value.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvasRef.value.height; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvasRef.value.width, y);
    ctx.stroke();
  }
}

function saveSnapshot() {
  if (!ctx || !canvasRef.value) return;
  if (historyStack.value.length >= 10) historyStack.value.shift();
  historyStack.value.push(ctx.getImageData(0, 0, canvasRef.value.width, canvasRef.value.height));
}

function undo() {
  if (historyStack.value.length === 0 || !ctx) return;
  const prev = historyStack.value.pop();
  if (prev) {
    ctx.putImageData(prev, 0, 0);
    saveMapData();
  }
}

function clearCanvas() {
  initCanvasBackground();
  mapLandmarks.value = [];
  mapRoutes.value = [];
  historyStack.value = [];
  saveMapData();
}

// 漫游拖拽状态
const isRightPanning = ref(false);
let isPanning = false;
let startPanX = 0;
let startPanY = 0;

function onMouseDown(e: MouseEvent) {
  const rect = mapWrapperRef.value?.getBoundingClientRect();
  if (!rect || !ctx || !canvasRef.value) return;

  // 1. 鼠标右键 (按住右键自由漫游拖拽画布)
  if (e.button === 2) {
    isRightPanning.value = true;
    startPanX = e.clientX - panX.value;
    startPanY = e.clientY - panY.value;
    return;
  }

  // 2. 鼠标左键 (绘制 / 盖章 / 行军线 / 漫游工具)
  if (e.button !== 0) return;

  const logicalX = (e.clientX - rect.left - panX.value) / zoomLevel.value;
  const logicalY = (e.clientY - rect.top - panY.value) / zoomLevel.value;

  if (currentTool.value === 'pan' || e.altKey) {
    isPanning = true;
    startPanX = e.clientX - panX.value;
    startPanY = e.clientY - panY.value;
    return;
  }

  if (currentTool.value === 'brush' || currentTool.value === 'eraser') {
    saveSnapshot();
    isDrawing = true;
    lastX = logicalX;
    lastY = logicalY;

    ctx.beginPath();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (currentTool.value === 'eraser') {
      ctx.strokeStyle = '#fcf8ec';
      ctx.lineWidth = brushWidth.value * 3;
    } else {
      ctx.strokeStyle = brushColor.value;
      ctx.lineWidth = brushWidth.value;
    }

    ctx.moveTo(lastX, lastY);
    return;
  }

  if (currentTool.value === 'stamp') {
    const stamp = stampList.find(s => s.type === selectedStampType.value) || stampList[0];
    const newLm: Landmark = {
      id: 'lm_' + Date.now(),
      type: stamp.type,
      name: stamp.name,
      icon: stamp.icon,
      x: Math.round(logicalX - 30),
      y: Math.round(logicalY - 20)
    };
    mapLandmarks.value.push(newLm);
    saveMapData();
    nextTick(() => {
      startEditLandmark(newLm);
    });
    return;
  }

  if (currentTool.value === 'route') {
    if (!isDrawingRoute.value) {
      isDrawingRoute.value = true;
      tempRoute.value = { x1: logicalX, y1: logicalY, x2: logicalX, y2: logicalY };
    } else if (tempRoute.value) {
      mapRoutes.value.push({
        id: 'route_' + Date.now(),
        x1: tempRoute.value.x1,
        y1: tempRoute.value.y1,
        x2: logicalX,
        y2: logicalY,
        label: '行军路线'
      });
      isDrawingRoute.value = false;
      tempRoute.value = null;
      saveMapData();
    }
  }
}

function onGlobalMouseMove(e: MouseEvent) {
  // 右键漫游拖拽优先级最高
  if (isRightPanning.value) {
    panX.value = e.clientX - startPanX;
    panY.value = e.clientY - startPanY;
    return;
  }

  if (isDraggingLandmark && dragLandmark) {
    const rect = mapWrapperRef.value?.getBoundingClientRect();
    if (!rect) return;
    const logicalX = (e.clientX - rect.left - panX.value) / zoomLevel.value;
    const logicalY = (e.clientY - rect.top - panY.value) / zoomLevel.value;
    dragLandmark.x = Math.round(logicalX - dragOffsetX);
    dragLandmark.y = Math.round(logicalY - dragOffsetY);
    return;
  }

  if (isPanning) {
    panX.value = e.clientX - startPanX;
    panY.value = e.clientY - startPanY;
    return;
  }

  if (isDrawing && ctx) {
    const rect = mapWrapperRef.value?.getBoundingClientRect();
    if (!rect) return;
    const logicalX = (e.clientX - rect.left - panX.value) / zoomLevel.value;
    const logicalY = (e.clientY - rect.top - panY.value) / zoomLevel.value;

    ctx.lineTo(logicalX, logicalY);
    ctx.stroke();
    lastX = logicalX;
    lastY = logicalY;
    return;
  }

  if (isDrawingRoute.value && tempRoute.value) {
    const rect = mapWrapperRef.value?.getBoundingClientRect();
    if (!rect) return;
    tempRoute.value.x2 = (e.clientX - rect.left - panX.value) / zoomLevel.value;
    tempRoute.value.y2 = (e.clientY - rect.top - panY.value) / zoomLevel.value;
  }
}

function onGlobalMouseUp(e: MouseEvent) {
  if (isRightPanning.value) {
    isRightPanning.value = false;
  }
  if (isDrawing) {
    isDrawing = false;
    saveMapData();
  }
  if (isDraggingLandmark) {
    isDraggingLandmark = false;
    dragLandmark = null;
    saveMapData();
  }
  isPanning = false;
}

function onWheel(e: WheelEvent) {
  const delta = e.deltaY < 0 ? 1.08 : 0.92;
  zoomLevel.value = Math.min(Math.max(0.3, zoomLevel.value * delta), 2.2);
}

function zoom(factor: number) {
  zoomLevel.value = Math.min(Math.max(0.3, zoomLevel.value * factor), 2.2);
}

function resetView() {
  zoomLevel.value = 0.7;
  panX.value = 40;
  panY.value = 40;
}

// 本地持久化储存地图数据
function saveMapData() {
  if (!props.bookId || !canvasRef.value) return;
  try {
    const dataUrl = canvasRef.value.toDataURL('image/png', 0.8);
    const mapObj = {
      drawingDataUrl: dataUrl,
      landmarks: mapLandmarks.value,
      routes: mapRoutes.value
    };
    localStorage.setItem(`NOVELCRAFT_WORLD_MAP_${props.bookId}`, JSON.stringify(mapObj));
  } catch (e) {}
}

function loadMapData() {
  if (!props.bookId || !ctx || !canvasRef.value) return;
  initCanvasBackground();
  try {
    const raw = localStorage.getItem(`NOVELCRAFT_WORLD_MAP_${props.bookId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.landmarks) mapLandmarks.value = parsed.landmarks;
      if (parsed.routes) mapRoutes.value = parsed.routes;
      if (parsed.drawingDataUrl) {
        const img = new Image();
        img.onload = () => {
          ctx?.drawImage(img, 0, 0);
        };
        img.src = parsed.drawingDataUrl;
      }
    }
  } catch (e) {}
}

// 导出地图为高清图片
function exportMapImage() {
  if (!canvasRef.value) return;
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = canvasRef.value.width;
  tempCanvas.height = canvasRef.value.height;
  const tCtx = tempCanvas.getContext('2d');
  if (!tCtx) return;

  // 1. 绘制底层笔刷
  tCtx.drawImage(canvasRef.value, 0, 0);

  // 2. 绘制行军路线
  tCtx.strokeStyle = '#dc2626';
  tCtx.lineWidth = 3;
  tCtx.setLineDash([8, 6]);
  mapRoutes.value.forEach(r => {
    tCtx.beginPath();
    tCtx.moveTo(r.x1, r.y1);
    tCtx.lineTo(r.x2, r.y2);
    tCtx.stroke();
  });

  // 3. 绘制地标
  tCtx.font = 'bold 16px sans-serif';
  tCtx.textAlign = 'center';
  tCtx.fillStyle = '#2b2416';
  mapLandmarks.value.forEach(lm => {
    tCtx.fillText(`${lm.icon} ${lm.name}`, lm.x + 30, lm.y + 16);
  });

  const a = document.createElement('a');
  a.download = `世界观设定地图_${Date.now()}.png`;
  a.href = tempCanvas.toDataURL('image/png');
  a.click();
}
</script>

<style scoped>
.worldmap-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-primary);
  overflow: hidden;
  user-select: none;
}

.worldmap-toolbar {
  padding: 8px 12px;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  z-index: 20;
}

.tool-group {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  padding: 3px;
  border-radius: 6px;
}

.map-tool-btn {
  padding: 4px 8px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.map-tool-btn:hover {
  color: var(--text-main);
  background: var(--bg-primary);
}

.map-tool-btn.active {
  background: var(--bg-primary);
  border-color: var(--accent);
  color: var(--accent);
  font-weight: 700;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}

.map-tool-btn.highlight {
  background: var(--accent);
  color: #ffffff;
  border: none;
}

.map-actions-right {
  margin-left: auto;
}

.color-picker-row {
  display: flex;
  gap: 4px;
  align-items: center;
  padding: 0 4px;
}

.color-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1px solid rgba(0,0,0,0.2);
  cursor: pointer;
  transition: transform 0.15s;
}

.color-dot.active {
  transform: scale(1.3);
  box-shadow: 0 0 0 2px var(--accent);
}

.tool-select {
  font-size: 11px;
  background: var(--bg-primary);
  color: var(--text-main);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 2px 4px;
  outline: none;
}

.stamp-select-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px 6px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  font-size: 10px;
  color: var(--text-muted);
  cursor: pointer;
}

.stamp-select-btn.active {
  background: var(--bg-primary);
  border-color: var(--accent);
  color: var(--accent);
  font-weight: 700;
}

.worldmap-viewport {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: #f4eedb; /* 复古羊皮纸外围 */
  cursor: default;
}

.cursor-panning { cursor: grabbing !important; }
.cursor-pan { cursor: grab; }
.cursor-pan:active { cursor: grabbing; }
.cursor-brush { cursor: crosshair; }
.cursor-eraser { cursor: cell; }
.cursor-stamp { cursor: copy; }
.cursor-route { cursor: crosshair; }

.worldmap-pan-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 2400px;
  height: 1600px;
  transform-origin: 0 0;
}

.map-drawing-canvas {
  position: absolute;
  top: 0;
  left: 0;
  box-shadow: 0 10px 40px rgba(0,0,0,0.15);
  border: 2px solid #dfd5bd;
}

.map-svg-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 2400px;
  height: 1600px;
  pointer-events: none;
  z-index: 5;
}

.route-line {
  stroke: #dc2626;
  stroke-width: 2.5;
  stroke-dasharray: 6, 4;
}

.route-line-temp {
  stroke: #d97706;
  stroke-width: 2;
  stroke-dasharray: 4, 4;
}

.route-label {
  font-size: 11px;
  font-weight: bold;
  fill: #dc2626;
  text-shadow: 0 1px 2px rgba(255,255,255,0.8);
}

.map-landmarks-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 2400px;
  height: 1600px;
  z-index: 10;
}

.landmark-item {
  position: absolute;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: rgba(253, 248, 237, 0.92);
  border: 1.5px solid #2b2416;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.12);
  cursor: grab;
  user-select: none;
  transition: box-shadow 0.15s, transform 0.15s;
}

.landmark-item:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 16px rgba(0,0,0,0.2);
}

.landmark-icon {
  font-size: 15px;
}

.landmark-name {
  font-size: 12px;
  font-weight: 800;
  color: #2b2416;
}

.inline-landmark-input {
  width: 90px;
  font-size: 11px;
  font-weight: 800;
  border: 1px solid var(--accent);
  background: #ffffff;
  border-radius: 3px;
  padding: 1px 3px;
  outline: none;
}

.landmark-del-btn {
  font-size: 9px;
  background: transparent;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 1px 3px;
  opacity: 0;
  transition: opacity 0.15s;
}

.landmark-item:hover .landmark-del-btn {
  opacity: 1;
}

.landmark-del-btn:hover {
  color: #dc2626;
}

.map-floating-zoom {
  position: absolute;
  bottom: 14px;
  right: 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 4px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  z-index: 30;
}

.zoom-btn {
  width: 28px;
  height: 26px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  font-size: 13px;
  font-weight: bold;
  color: var(--text-main);
  cursor: pointer;
}

.zoom-btn:hover {
  background: var(--bg-secondary);
}

.map-hint {
  position: absolute;
  bottom: 14px;
  left: 14px;
  font-size: 10px;
  font-weight: 500;
  color: var(--text-dim);
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  padding: 4px 10px;
  border-radius: 4px;
  pointer-events: none;
  z-index: 30;
}
</style>
