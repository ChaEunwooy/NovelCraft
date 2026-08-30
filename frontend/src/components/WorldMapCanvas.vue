<template>
  <div class="worldmap-container">
    <!-- 地图专业工具栏 -->
    <div class="worldmap-toolbar">
      <!-- 模式切换 -->
      <div class="tool-group">
        <button
          class="map-tool-btn"
          :class="{ active: currentTool === 'pan' }"
          @click="currentTool = 'pan'"
          title="漫游视角 (按住左键/右键拖拽地图)"
        >
          ✋ 漫游
        </button>
        <button
          class="map-tool-btn"
          :class="{ active: currentTool === 'stamp' }"
          @click="currentTool = 'stamp'"
          title="放置地标 (在地球任意经纬度点击打下剧情坐标)"
        >
          📍 新建地标
        </button>
        <button
          class="map-tool-btn"
          :class="{ active: currentTool === 'route' }"
          @click="currentTool = 'route'"
          title="绘制路线 (点击两点绘制连线)"
        >
          🚩 探险路线
        </button>
        <button
          class="map-tool-btn"
          :class="{ active: currentTool === 'brush' }"
          @click="currentTool = 'brush'"
          title="手绘笔刷 (在地图上手绘标记/圈定势力)"
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
      </div>

      <!-- 地标类型快速切换 -->
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
          <option :value="8">粗线 8px</option>
          <option :value="16">宽带 16px</option>
        </select>
      </div>

      <!-- 画布操作组 -->
      <div class="tool-group map-actions-right">
        <button class="map-tool-btn" @click="undo" :disabled="historyStack.length === 0" title="撤销上一步绘制">↩️ 撤销</button>
        <button class="map-tool-btn" @click="redrawEarth" title="重绘真实地球底图">🌍 刷新底图</button>
        <button class="map-tool-btn" @click="clearAllData" title="清空所有地标与路线">🗑️ 清空标记</button>
        <button class="map-tool-btn highlight" @click="exportMapImage" title="导出超高清世界地图图片">💾 导出地图</button>
      </div>
    </div>

    <!-- 地图画布视口 (左键/右键漫游 + 滚轮缩放) -->
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
        <!-- 真实地球高精度 Canvas (3200 x 1600 像素，标准 2:1 等经纬度投影) -->
        <canvas
          ref="canvasRef"
          width="3200"
          height="1600"
          class="map-drawing-canvas"
        ></canvas>

        <!-- 上层路线 SVG 层 -->
        <svg class="map-svg-layer">
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
          <line
            v-if="isDrawingRoute && tempRoute"
            :x1="tempRoute.x1"
            :y1="tempRoute.y1"
            :x2="tempRoute.x2"
            :y2="tempRoute.y2"
            class="route-line-temp"
          />
        </svg>

        <!-- 地标图元 DOM 层 (支持自由拖拽与原地双击改名) -->
        <div class="map-landmarks-layer">
          <div
            v-for="lm in mapLandmarks"
            :key="lm.id"
            class="landmark-item"
            :class="[lm.type, { selected: selectedLandmarkId === lm.id }]"
            :style="{ left: lm.x + 'px', top: lm.y + 'px' }"
            @mousedown.stop="startDragLandmark($event, lm)"
            @click.stop="selectLandmark(lm)"
            @dblclick.stop="startEditLandmark(lm)"
          >
            <div class="landmark-pin-wrapper">
              <span class="landmark-icon">{{ lm.icon }}</span>
              <span class="landmark-glow"></span>
            </div>
            <!-- 双击就地修改地名 -->
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
            <div v-else class="landmark-badge">
              <span class="landmark-name">{{ lm.name }}</span>
              <span v-if="lm.lore" class="landmark-lore-hint">{{ lm.lore }}</span>
            </div>
            <button class="landmark-del-btn" @click.stop="deleteLandmark(lm)" title="删除此地标">✕</button>
          </div>
        </div>
      </div>

      <!-- 悬浮缩放与导航控制器 -->
      <div class="map-floating-zoom">
        <button class="zoom-btn" @click="zoom(1.18)" title="放大">+</button>
        <button class="zoom-btn" @click="zoom(0.82)" title="缩小">-</button>
        <button class="zoom-btn reset" @click="resetView" title="重置视角">🎯</button>
      </div>

      <!-- 底部实时经纬度与操作提示 -->
      <div class="map-hint">
        🌍 真实地球地理坐标系统 | 当前光标: {{ mouseCoordsText }} | 点击【新建地标】在地球任意位置放置剧情坐标 (双击改名)
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { worldGeoData } from '../assets/worldGeoData';
import { chinaGeoData } from '../assets/chinaGeoData';

const props = defineProps<{
  bookId?: string;
}>();

const currentTool = ref<'pan' | 'stamp' | 'route' | 'brush' | 'eraser'>('pan');
const brushColor = ref('#8b4513');
const brushWidth = ref(4);

const brushColors = ['#8b4513', '#2b2416', '#dc2626', '#1e40af', '#065f46', '#7c3aed', '#d97706'];

const selectedStampType = ref('story_point');
const stampList = [
  { type: 'story_point', name: '剧情节点', icon: '📍' },
  { type: 'story_base', name: '主角据点', icon: '🏮' },
  { type: 'story_danger', name: '秘境古迹', icon: '💀' },
  { type: 'story_mountain', name: '名山祖脉', icon: '🏔️' },
  { type: 'story_water', name: '水系暗河', icon: '🌊' },
  { type: 'story_secret', name: '地底暗室', icon: '🗝️' },
  { type: 'story_city', name: '重要城市', icon: '🏙️' }
];

interface Landmark {
  id: string;
  type: string;
  name: string;
  icon: string;
  x: number;
  y: number;
  lore?: string;
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
const selectedLandmarkId = ref('');
const mouseCoordsText = ref('东经 112.9° 北纬 28.2° (中国·长沙)');

// 视口与缩放 (默认聚焦中国与东亚区域)
const panX = ref(-700);
const panY = ref(-250);
const zoomLevel = ref(0.7);

const canvasRef = ref<HTMLCanvasElement | null>(null);
const mapWrapperRef = ref<HTMLDivElement | null>(null);

let ctx: CanvasRenderingContext2D | null = null;
let isDrawing = false;
let lastX = 0;
let lastY = 0;

const historyStack = ref<ImageData[]>([]);

const editingLandmarkId = ref('');
const editingLandmarkName = ref('');
const landmarkInputRef = ref<HTMLInputElement[] | null>(null);

function selectLandmark(lm: Landmark) {
  selectedLandmarkId.value = lm.id;
}

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

const isDrawingRoute = ref(false);
const tempRoute = ref<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

onMounted(() => {
  if (canvasRef.value) {
    ctx = canvasRef.value.getContext('2d', { willReadFrequently: true });
    redrawEarth();
    loadMapData();
  }
  window.addEventListener('mousemove', onGlobalMouseMove);
  window.addEventListener('mouseup', onGlobalMouseUp);
});

onUnmounted(() => {
  window.removeEventListener('mousemove', onGlobalMouseMove);
  window.removeEventListener('mouseup', onGlobalMouseUp);
});

watch(() => props.bookId, () => {
  loadMapData();
});

// ==================== 🌍 真实地球高精度等经纬度渲染 ====================

function projectLonLat(lon: number, lat: number, width: number, height: number): [number, number] {
  const x = ((lon + 180.0) / 360.0) * width;
  const y = ((90.0 - lat) / 180.0) * height;
  return [x, y];
}

function redrawEarth() {
  if (!ctx || !canvasRef.value) return;
  const w = canvasRef.value.width;
  const h = canvasRef.value.height;

  // 1. 真实地球海洋底色 (古典复古羊皮水域色)
  ctx.fillStyle = '#f4efe4';
  ctx.fillRect(0, 0, w, h);

  // 2. 真实经纬度网格度数线 (每30度一条标准虚线，赤道与本初子午线实线)
  ctx.save();
  for (let lon = -180; lon <= 180; lon += 30) {
    const [x] = projectLonLat(lon, 0, w, h);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.strokeStyle = lon === 0 ? 'rgba(180, 83, 9, 0.45)' : 'rgba(180, 160, 130, 0.28)';
    ctx.lineWidth = lon === 0 ? 1.5 : 1;
    ctx.setLineDash(lon === 0 ? [] : [4, 6]);
    ctx.stroke();
  }

  for (let lat = -90; lat <= 90; lat += 30) {
    const [, y] = projectLonLat(0, lat, w, h);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.strokeStyle = lat === 0 ? 'rgba(180, 83, 9, 0.45)' : 'rgba(180, 160, 130, 0.28)';
    ctx.lineWidth = lat === 0 ? 1.5 : 1;
    ctx.setLineDash(lat === 0 ? [] : [4, 6]);
    ctx.stroke();
  }
  ctx.restore();

  // 3. 渲染真实地球 177 个国家与大洲高精度多边形边界
  ctx.save();
  ctx.fillStyle = '#dfd2bc'; // 陆地柔和大地色
  ctx.strokeStyle = '#7c5a38'; // 真实海岸线深褐色
  ctx.lineWidth = 1.2;
  ctx.lineJoin = 'round';

  const renderPolygon = (coords: any[]) => {
    if (!ctx) return;
    ctx.beginPath();
    for (let i = 0; i < coords.length; i++) {
      const ring = coords[i];
      if (!Array.isArray(ring) || ring.length === 0) continue;
      const first = projectLonLat(ring[0][0], ring[0][1], w, h);
      ctx.moveTo(first[0], first[1]);
      for (let j = 1; j < ring.length; j++) {
        const pt = projectLonLat(ring[j][0], ring[j][1], w, h);
        ctx.lineTo(pt[0], pt[1]);
      }
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };

  const features = (worldGeoData as any)?.features || [];
  for (const feat of features) {
    const geom = feat?.geometry;
    if (!geom) continue;
    if (geom.type === 'Polygon') {
      renderPolygon(geom.coordinates);
    } else if (geom.type === 'MultiPolygon') {
      for (const poly of geom.coordinates) {
        renderPolygon(poly);
      }
    }
  }

  // 4. 高亮真实中国各省份精细边界
  ctx.fillStyle = '#eddcc4';
  ctx.strokeStyle = '#a27b52';
  ctx.lineWidth = 0.8;
  const chinaFeatures = (chinaGeoData as any)?.features || [];
  for (const feat of chinaFeatures) {
    const geom = feat?.geometry;
    if (!geom) continue;
    if (geom.type === 'Polygon') {
      renderPolygon(geom.coordinates);
    } else if (geom.type === 'MultiPolygon') {
      for (const poly of geom.coordinates) {
        renderPolygon(poly);
      }
    }
  }

  // 5. 大洋真实地理标注
  ctx.fillStyle = 'rgba(30, 64, 175, 0.4)';
  ctx.font = 'italic 20px "Microsoft YaHei", serif';
  ctx.textAlign = 'center';
  const [pacX, pacY] = projectLonLat(160, -10, w, h);
  ctx.fillText('~ 太 平 洋 (PACIFIC OCEAN) ~', pacX, pacY);

  const [atlX, atlY] = projectLonLat(-35, 20, w, h);
  ctx.fillText('~ 大 西 洋 (ATLANTIC OCEAN) ~', atlX, atlY);

  const [indX, indY] = projectLonLat(80, -20, w, h);
  ctx.fillText('~ 印 度 洋 (INDIAN OCEAN) ~', indX, indY);

  const [arcX, arcY] = projectLonLat(0, 80, w, h);
  ctx.fillText('~ 北 冰 洋 (ARCTIC OCEAN) ~', arcX, arcY);

  // 6. 右下角古典指南针罗盘
  drawCompassRose(w - 180, h - 180, 75);
  ctx.restore();
}

function drawCompassRose(cx: number, cy: number, r: number) {
  if (!ctx) return;
  ctx.save();
  ctx.strokeStyle = '#8b6f4e';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  const angles = [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2];
  angles.forEach((a, i) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-r * 0.18, -r * 0.2);
    ctx.lineTo(0, -r);
    ctx.closePath();
    ctx.fillStyle = i === 0 ? '#b91c1c' : '#5c4a38';
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(r * 0.18, -r * 0.2);
    ctx.lineTo(0, -r);
    ctx.closePath();
    ctx.fillStyle = '#dfd3be';
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  });

  ctx.font = 'bold 15px "Microsoft YaHei", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#b91c1c';
  ctx.fillText('北 (N)', cx, cy - r - 18);
  ctx.fillStyle = '#5c4a38';
  ctx.fillText('南 (S)', cx, cy + r + 18);
  ctx.fillText('东 (E)', cx + r + 22, cy);
  ctx.fillText('西 (W)', cx - r - 22, cy);
  ctx.restore();
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

function clearAllData() {
  mapLandmarks.value = [];
  mapRoutes.value = [];
  historyStack.value = [];
  redrawEarth();
  saveMapData();
}

// 漫游拖拽
const isRightPanning = ref(false);
let isPanning = false;
let startPanX = 0;
let startPanY = 0;

function onMouseDown(e: MouseEvent) {
  const rect = mapWrapperRef.value?.getBoundingClientRect();
  if (!rect || !ctx || !canvasRef.value) return;

  if (e.button === 2) {
    isRightPanning.value = true;
    startPanX = e.clientX - panX.value;
    startPanY = e.clientY - panY.value;
    return;
  }

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
      ctx.strokeStyle = '#f4efe4';
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
      x: Math.round(logicalX),
      y: Math.round(logicalY),
      lore: ''
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
        label: '剧情路线'
      });
      isDrawingRoute.value = false;
      tempRoute.value = null;
      saveMapData();
    }
  }
}

function onGlobalMouseMove(e: MouseEvent) {
  const rect = mapWrapperRef.value?.getBoundingClientRect();
  if (rect && canvasRef.value) {
    const logicalX = (e.clientX - rect.left - panX.value) / zoomLevel.value;
    const logicalY = (e.clientY - rect.top - panY.value) / zoomLevel.value;
    const lon = ((logicalX / canvasRef.value.width) * 360.0 - 180.0).toFixed(1);
    const lat = (90.0 - (logicalY / canvasRef.value.height) * 180.0).toFixed(1);
    mouseCoordsText.value = `${Number(lon) >= 0 ? '东经 ' + lon : '西经 ' + Math.abs(Number(lon))}°  ${Number(lat) >= 0 ? '北纬 ' + lat : '南纬 ' + Math.abs(Number(lat))}°`;
  }

  if (isRightPanning.value) {
    panX.value = e.clientX - startPanX;
    panY.value = e.clientY - startPanY;
    return;
  }

  if (isDraggingLandmark && dragLandmark) {
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
  const delta = e.deltaY < 0 ? 1.12 : 0.88;
  zoomLevel.value = Math.min(Math.max(0.2, zoomLevel.value * delta), 3.0);
}

function zoom(factor: number) {
  zoomLevel.value = Math.min(Math.max(0.2, zoomLevel.value * factor), 3.0);
}

function resetView() {
  zoomLevel.value = 0.7;
  panX.value = -700;
  panY.value = -250;
}

function saveMapData() {
  if (!props.bookId || !canvasRef.value) return;
  try {
    const dataUrl = canvasRef.value.toDataURL('image/png', 0.85);
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
        return;
      }
    }
  } catch (e) {}

  // 默认放置您唯一的原创真实坐标：湖南长沙与郴州
  if (canvasRef.value) {
    const [csX, csY] = projectLonLat(112.98, 28.19, canvasRef.value.width, canvasRef.value.height);
    const [czX, czY] = projectLonLat(113.01, 25.77, canvasRef.value.width, canvasRef.value.height);

    mapLandmarks.value = [
      {
        id: 'lm_changsha',
        type: 'story_base',
        name: '湖南长沙 · 走马楼巷',
        icon: '🏮',
        x: Math.round(csX),
        y: Math.round(csY),
        lore: '楚风文化工作室大本营'
      },
      {
        id: 'lm_chenzhou',
        type: 'story_danger',
        name: '湖南郴州 · 莽山盲谷',
        icon: '💀',
        x: Math.round(czX),
        y: Math.round(czY),
        lore: '第一卷：712地下九层木楼'
      }
    ];

    mapRoutes.value = [
      {
        id: 'route_vol1',
        x1: Math.round(csX),
        y1: Math.round(csY),
        x2: Math.round(czX),
        y2: Math.round(czY),
        label: '第一卷行进路线'
      }
    ];
  }
}

function exportMapImage() {
  if (!canvasRef.value) return;
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = canvasRef.value.width;
  tempCanvas.height = canvasRef.value.height;
  const tCtx = tempCanvas.getContext('2d');
  if (!tCtx) return;

  tCtx.drawImage(canvasRef.value, 0, 0);

  tCtx.strokeStyle = '#dc2626';
  tCtx.lineWidth = 3.5;
  tCtx.setLineDash([8, 6]);
  mapRoutes.value.forEach(r => {
    tCtx.beginPath();
    tCtx.moveTo(r.x1, r.y1);
    tCtx.lineTo(r.x2, r.y2);
    tCtx.stroke();
  });

  mapLandmarks.value.forEach(lm => {
    tCtx.font = 'bold 20px "Microsoft YaHei", sans-serif';
    tCtx.textAlign = 'center';
    tCtx.fillStyle = '#1c1917';
    tCtx.fillText(`${lm.icon} ${lm.name}`, lm.x, lm.y - 12);
  });

  const a = document.createElement('a');
  a.download = `走马楼笔记_真实地球剧情地图_${Date.now()}.png`;
  a.href = tempCanvas.toDataURL('image/png');
  a.click();
}
</script>

<style scoped>
.worldmap-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #1c1813;
  overflow: hidden;
  position: relative;
  user-select: none;
}

.worldmap-toolbar {
  height: 52px;
  background: #191510;
  border-bottom: 1px solid #382e22;
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 12px;
  z-index: 20;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  flex-wrap: nowrap;
  overflow-x: auto;
}

.tool-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.map-tool-btn {
  padding: 6px 14px;
  background: #272018;
  color: #d6ccba;
  border: 1px solid #473a2b;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.map-tool-btn:hover {
  background: #3a3126;
  color: #fff;
}

.map-tool-btn.active {
  background: #b45309;
  color: #fff;
  border-color: #f59e0b;
  font-weight: 600;
  box-shadow: 0 0 10px rgba(245, 158, 11, 0.35);
}

.map-tool-btn.highlight {
  background: #059669;
  border-color: #10b981;
  color: #fff;
  font-weight: 600;
}

.map-tool-btn.highlight:hover {
  background: #047857;
}

.color-picker-row {
  display: flex;
  align-items: center;
  gap: 5px;
}

.color-dot {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid #574635;
  cursor: pointer;
  transition: transform 0.1s;
}

.color-dot.active {
  border-color: #fff;
  transform: scale(1.2);
}

.tool-select {
  padding: 4px 8px;
  background: #272018;
  color: #d6ccba;
  border: 1px solid #473a2b;
  border-radius: 5px;
  font-size: 11px;
}

.stamp-select-btn {
  padding: 4px 8px;
  background: #272018;
  color: #d6ccba;
  border: 1px solid #473a2b;
  border-radius: 5px;
  font-size: 11px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 3px;
  white-space: nowrap;
}

.stamp-select-btn.active {
  background: #7c3aed;
  color: #fff;
  border-color: #a78bfa;
}

.map-actions-right {
  margin-left: auto;
}

.worldmap-viewport {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: radial-gradient(circle at center, #251e18 0%, #120e0a 100%);
}

.cursor-pan { cursor: grab; }
.cursor-panning { cursor: grabbing !important; }
.cursor-brush { cursor: crosshair; }
.cursor-eraser { cursor: cell; }
.cursor-stamp { cursor: copy; }
.cursor-route { cursor: pointer; }

.worldmap-pan-layer {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
  will-change: transform;
}

.map-drawing-canvas {
  display: block;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.85);
}

.map-svg-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.route-line {
  stroke: #dc2626;
  stroke-width: 3.5;
  stroke-dasharray: 8, 6;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.6));
}

.route-line-temp {
  stroke: #f59e0b;
  stroke-width: 3;
  stroke-dasharray: 6, 6;
}

.route-label {
  fill: #fff;
  font-size: 13px;
  font-weight: bold;
  text-anchor: middle;
  paint-order: stroke fill;
  stroke: #1c1917;
  stroke-width: 4px;
}

.map-landmarks-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.landmark-item {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: grab;
  pointer-events: auto;
  transform: translate(-50%, -100%);
  transition: transform 0.1s;
}

.landmark-item:hover {
  transform: translate(-50%, -105%) scale(1.08);
  z-index: 30;
}

.landmark-pin-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.landmark-icon {
  font-size: 28px;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.6));
}

.landmark-badge {
  margin-top: -2px;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgba(24, 20, 16, 0.95);
  border: 1px solid #d97706;
  border-radius: 6px;
  padding: 3px 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.6);
  white-space: nowrap;
}

.landmark-name {
  font-size: 12px;
  font-weight: 700;
  color: #fef3c7;
}

.landmark-lore-hint {
  font-size: 10px;
  color: #d1d5db;
  margin-top: 1px;
}

.inline-landmark-input {
  margin-top: 2px;
  background: #1c1917;
  color: #fff;
  border: 1px solid #3b82f6;
  border-radius: 4px;
  font-size: 12px;
  padding: 2px 6px;
  text-align: center;
}

.landmark-del-btn {
  position: absolute;
  top: -8px;
  right: -8px;
  background: #ef4444;
  color: #fff;
  border: none;
  border-radius: 50%;
  width: 16px;
  height: 16px;
  font-size: 10px;
  display: none;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.landmark-item:hover .landmark-del-btn {
  display: flex;
}

.map-floating-zoom {
  position: absolute;
  right: 20px;
  bottom: 24px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  z-index: 10;
}

.zoom-btn {
  width: 38px;
  height: 38px;
  border-radius: 8px;
  background: rgba(28, 22, 16, 0.9);
  border: 1px solid #4a3e2f;
  color: #f5ede0;
  font-size: 18px;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
  transition: all 0.15s;
}

.zoom-btn:hover {
  background: #d97706;
  color: #fff;
  border-color: #f59e0b;
}

.map-hint {
  position: absolute;
  left: 20px;
  bottom: 20px;
  background: rgba(18, 14, 10, 0.9);
  border: 1px solid #4a3e2f;
  border-radius: 6px;
  padding: 6px 14px;
  color: #c4b5a0;
  font-size: 11px;
  z-index: 10;
  pointer-events: none;
}
</style>
