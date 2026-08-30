<template>
  <div class="worldmap-container">
    <!-- 地图专业工具栏 -->
    <div class="worldmap-toolbar">
      <!-- 地图底图预设切换 -->
      <div class="tool-group preset-group">
        <span class="toolbar-label">🗺️ 底图模式:</span>
        <button
          class="map-preset-btn"
          :class="{ active: currentMapPreset === 'earth' }"
          @click="switchMapPreset('earth')"
          title="载入真实地球七大洲与大洋高精度世界地图"
        >
          🌍 真实地球世界地图
        </button>
        <button
          class="map-preset-btn"
          :class="{ active: currentMapPreset === 'china' }"
          @click="switchMapPreset('china')"
          title="载入中国全域探险地质图 (含长沙、郴州、秦岭、长白山、昆仑山等核心剧情地标)"
        >
          🇨🇳 华夏全域探险图
        </button>
        <button
          class="map-preset-btn"
          :class="{ active: currentMapPreset === 'blank' }"
          @click="switchMapPreset('blank')"
          title="空白复古羊皮纸画板 (自由手绘创作)"
        >
          📜 空白画板
        </button>
      </div>

      <div class="toolbar-divider"></div>

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
          title="画笔工具 (手绘山川、河流、秘境边界)"
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
          title="地标印章 (点击画布放置剧情势力、山脉、禁区)"
        >
          🏰 地标印章
        </button>
        <button
          class="map-tool-btn"
          :class="{ active: currentTool === 'route' }"
          @click="currentTool = 'route'"
          title="探险路线 (点击两点绘制连线)"
        >
          🚩 探险路线
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
        <button class="map-tool-btn" @click="resetPresetAndClear" title="重置当前底图与地标">🔄 重置</button>
        <button class="map-tool-btn highlight" @click="exportMapImage" title="导出超高清地图图片">💾 导出</button>
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
        <!-- 底层绘图 Canvas (2800 x 1800 高清分辨率) -->
        <canvas
          ref="canvasRef"
          width="2800"
          height="1800"
          class="map-drawing-canvas"
        ></canvas>

        <!-- 上层交互路线 SVG 层 -->
        <svg class="map-svg-layer">
          <!-- 探险/行军路线虚线 -->
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
          <!-- 正在拉出的路线 -->
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
        <button class="zoom-btn" @click="zoom(1.15)" title="放大">+</button>
        <button class="zoom-btn" @click="zoom(0.85)" title="缩小">-</button>
        <button class="zoom-btn reset" @click="resetView" title="重置视角居中">🎯</button>
      </div>

      <div class="map-hint">
        🗺️ 鼠标左键绘制/盖章/连线 | 拖拽可移动地标（双击改名） | 按住鼠标右键漫游 | 滚轮无级缩放
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue';

const props = defineProps<{
  bookId?: string;
}>();

type MapPreset = 'earth' | 'china' | 'blank';
const currentMapPreset = ref<MapPreset>('china');

const currentTool = ref<'pan' | 'brush' | 'eraser' | 'stamp' | 'route'>('pan');
const brushColor = ref('#8b4513');
const brushWidth = ref(4);

const brushColors = ['#8b4513', '#2b2416', '#dc2626', '#1e40af', '#065f46', '#7c3aed', '#d97706'];

const selectedStampType = ref('story_city');
const stampList = [
  { type: 'story_city', name: '剧情据点', icon: '📍' },
  { type: 'story_danger', name: '绝境古斗', icon: '💀' },
  { type: 'story_mountain', name: '灵山祖脉', icon: '🏔️' },
  { type: 'story_temple', name: '神秘古刹', icon: '⛩️' },
  { type: 'story_sea', name: '深海古沉船', icon: '⚓' },
  { type: 'story_secret', name: '地底暗道', icon: '🗝️' },
  { type: 'capital', name: '繁华都市', icon: '🏙️' }
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

// 视口与缩放 (默认中心居中)
const panX = ref(-100);
const panY = ref(-80);
const zoomLevel = ref(0.65);

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

// 行军路线绘制
const isDrawingRoute = ref(false);
const tempRoute = ref<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

// 初始化画板
onMounted(() => {
  if (canvasRef.value) {
    ctx = canvasRef.value.getContext('2d', { willReadFrequently: true });
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

// ==================== 🌍 地图底图绘制核心引擎 ====================

function switchMapPreset(preset: MapPreset) {
  currentMapPreset.value = preset;
  if (preset === 'china') {
    loadChinaMapPreset();
  } else if (preset === 'earth') {
    loadEarthMapPreset();
  } else {
    clearCanvas(false);
  }
}

function resetPresetAndClear() {
  if (currentMapPreset.value === 'china') {
    loadChinaMapPreset();
  } else if (currentMapPreset.value === 'earth') {
    loadEarthMapPreset();
  } else {
    clearCanvas(true);
  }
}

function drawParchmentBackground() {
  if (!ctx || !canvasRef.value) return;
  const w = canvasRef.value.width;
  const h = canvasRef.value.height;

  // 1. 羊皮纸复古暖底色
  ctx.fillStyle = '#f8f2e4';
  ctx.fillRect(0, 0, w, h);

  // 2. 绘制经纬网格度数线 (古风细虚线)
  ctx.save();
  ctx.strokeStyle = 'rgba(180, 160, 130, 0.35)';
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 8]);
  for (let x = 0; x < w; x += 140) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += 140) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.restore();

  // 3. 右下角绘制古典指南针罗盘玫瑰 (Compass Rose)
  drawCompassRose(w - 220, h - 220, 90);
}

// 绘制古典罗盘玫瑰
function drawCompassRose(cx: number, cy: number, r: number) {
  if (!ctx) return;
  ctx.save();
  ctx.strokeStyle = '#8b6f4e';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.75, 0, Math.PI * 2);
  ctx.stroke();

  // 指南针主尖角 (北/南/东/西)
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

  // 标注文王八卦/方位文字
  ctx.font = 'bold 18px "Microsoft YaHei", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#b91c1c';
  ctx.fillText('北 (N)', cx, cy - r - 22);
  ctx.fillStyle = '#5c4a38';
  ctx.fillText('南 (S)', cx, cy + r + 22);
  ctx.fillText('东 (E)', cx + r + 26, cy);
  ctx.fillText('西 (W)', cx - r - 26, cy);
  ctx.restore();
}

// ================= 🇨🇳 中国全域探险地图预设 =================
function loadChinaMapPreset() {
  if (!ctx || !canvasRef.value) return;
  drawParchmentBackground();

  ctx.save();
  // 1. 绘制中国大陆版图主体 (高精度古风水墨矢量轮廓)
  ctx.fillStyle = '#eddcc4'; // 陆地柔和杏黄
  ctx.strokeStyle = '#7c5a38'; // 棕褐海岸边界线
  ctx.lineWidth = 3.5;
  ctx.lineJoin = 'round';

  ctx.beginPath();
  // 起点：辽宁/鸭绿江口
  ctx.moveTo(1820, 680);
  ctx.bezierCurveTo(1850, 620, 1920, 520, 1960, 420); // 东北吉林/黑龙江轮廓
  ctx.bezierCurveTo(1990, 320, 1900, 240, 1800, 220); // 漠河/大兴安岭顶端
  ctx.bezierCurveTo(1680, 240, 1600, 320, 1520, 380); // 内蒙古呼伦贝尔
  ctx.bezierCurveTo(1380, 420, 1260, 460, 1100, 480); // 阴山/阿尔泰山脉
  ctx.bezierCurveTo(900, 480, 720, 420, 560, 460);   // 新疆准噶尔/天山北坡
  ctx.bezierCurveTo(460, 520, 420, 640, 460, 760);   // 帕米尔高原/喀喇昆仑
  ctx.bezierCurveTo(520, 840, 680, 940, 840, 1020);  // 青藏高原西南部/喜马拉雅
  ctx.bezierCurveTo(1000, 1080, 1140, 1140, 1260, 1200); // 云南滇池/横断山脉
  ctx.bezierCurveTo(1340, 1260, 1460, 1340, 1560, 1380); // 广西十万大山/北部湾
  ctx.bezierCurveTo(1640, 1400, 1720, 1360, 1800, 1320); // 广东雷州半岛/珠江口
  ctx.bezierCurveTo(1880, 1260, 1940, 1180, 1960, 1080); // 福建武夷山/台湾海峡
  ctx.bezierCurveTo(1980, 980, 1940, 880, 1880, 820);   // 浙江舟山/长江口
  ctx.bezierCurveTo(1840, 780, 1800, 760, 1780, 720);   // 山东半岛/渤海湾
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 2. 绘制台湾岛与海南岛
  ctx.beginPath();
  ctx.ellipse(2040, 1200, 30, 75, Math.PI / 8, 0, Math.PI * 2); // 台湾岛
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(1620, 1460, 45, 30, -Math.PI / 10, 0, Math.PI * 2); // 海南岛
  ctx.fill();
  ctx.stroke();

  // 3. 绘制长江与黄河大动脉 (水蓝波纹线条)
  ctx.strokeStyle = 'rgba(37, 99, 235, 0.65)';
  ctx.lineWidth = 3;
  // 长江巨脉 (自青藏高原发源，流经横断、巴蜀、湘鄂、江南入海)
  ctx.beginPath();
  ctx.moveTo(820, 920);
  ctx.bezierCurveTo(1060, 960, 1220, 1040, 1380, 980); // 金沙江/三峡
  ctx.bezierCurveTo(1500, 940, 1620, 1020, 1760, 960); // 洞庭湖/武汉
  ctx.bezierCurveTo(1840, 920, 1880, 900, 1940, 890); // 南京/上海入海口
  ctx.stroke();

  // 黄河巨脉 (几字大弯)
  ctx.strokeStyle = 'rgba(217, 119, 6, 0.6)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(780, 800);
  ctx.bezierCurveTo(940, 760, 1120, 680, 1300, 640); // 兰州/河套
  ctx.bezierCurveTo(1440, 620, 1480, 740, 1460, 820); // 晋陕大峡谷几字弯
  ctx.bezierCurveTo(1560, 840, 1680, 800, 1780, 730); // 洛阳/渤海入海口
  ctx.stroke();

  // 4. 绘制中华各大名山山脉骨架 (古风山脊符号)
  ctx.fillStyle = '#6b4f3b';
  ctx.font = 'italic 16px "Microsoft YaHei", serif';
  ctx.fillText('▲ 昆仑山脉 (万山之祖)', 680, 780);
  ctx.fillText('▲ 秦岭终南山 (华夏龙脊)', 1320, 880);
  ctx.fillText('▲ 南岭山脉 (莽山·骑田岭)', 1580, 1260);
  ctx.fillText('▲ 长白山天池', 1880, 460);
  ctx.fillText('▲ 巫山·三峡悬棺', 1420, 960);
  ctx.fillText('▲ 横断山脉·藏东大峡谷', 1080, 1040);
  ctx.restore();

  // 5. 初始化小说关键剧情地标
  mapLandmarks.value = [
    {
      id: 'lm_changsha',
      type: 'story_city',
      name: '湖南长沙 · 走马楼巷',
      icon: '🏮',
      x: 1640,
      y: 1120,
      lore: '楚风文化工作室大本营 · 杨涛/胖子/刘菲'
    },
    {
      id: 'lm_chenzhou',
      type: 'story_danger',
      name: '湖南郴州 · 盲谷古楼',
      icon: '💀',
      x: 1620,
      y: 1240,
      lore: '第一卷主战场 · 712矿道/石脸虫/水龙骨/地下九层木楼'
    },
    {
      id: 'lm_qinling',
      type: 'story_mountain',
      name: '陕西秦岭 · 盲修九锚',
      icon: '🏔️',
      x: 1360,
      y: 860,
      lore: '华夏地脉祖脊 · 终南山阴阳古道'
    },
    {
      id: 'lm_changbai',
      type: 'story_temple',
      name: '吉林白山 · 云顶天宫',
      icon: '⛩️',
      x: 1900,
      y: 440,
      lore: '长白山天池雪线 · 青铜巨门'
    },
    {
      id: 'lm_xisha',
      type: 'story_sea',
      name: '南海西沙 · 明代沉船',
      icon: '⚓',
      x: 1720,
      y: 1560,
      lore: '珊瑚螺旋 · 怒海海底古墓'
    },
    {
      id: 'lm_geermu',
      type: 'story_secret',
      name: '青海格尔木 · 疗养院',
      icon: '🗝️',
      x: 880,
      y: 780,
      lore: '柴达木盆地边缘 · 秘密档案室'
    }
  ];

  // 6. 默认连接长沙到郴州的探险路线 (第一卷行进路线)
  mapRoutes.value = [
    {
      id: 'route_vol1',
      x1: 1670,
      y1: 1140,
      x2: 1650,
      y2: 1260,
      label: '第一卷探险路线 (长沙 ➔ 郴州盲谷)'
    }
  ];

  saveMapData();
}

// ================= 🌍 真实地球七大洲世界地图预设 =================
function loadEarthMapPreset() {
  if (!ctx || !canvasRef.value) return;
  drawParchmentBackground();

  ctx.save();
  ctx.fillStyle = '#e8d8be';
  ctx.strokeStyle = '#6e4e32';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';

  // 1. 亚洲 + 欧洲大陆 (欧亚板块)
  ctx.beginPath();
  ctx.moveTo(1100, 680);
  ctx.bezierCurveTo(1000, 520, 920, 400, 840, 360);   // 欧洲西欧/斯堪的纳维亚
  ctx.bezierCurveTo(960, 280, 1200, 240, 1500, 220);  // 西伯利亚北部海岸
  ctx.bezierCurveTo(1800, 220, 2000, 280, 2150, 360); // 白令海峡边缘
  ctx.bezierCurveTo(2100, 500, 1950, 650, 1900, 750); // 东亚太平洋沿岸/日本海
  ctx.bezierCurveTo(1850, 900, 1700, 1050, 1550, 1100);// 东南亚半岛/印尼群岛
  ctx.bezierCurveTo(1400, 1050, 1300, 950, 1200, 850);// 印度半岛/阿拉伯海
  ctx.bezierCurveTo(1150, 800, 1120, 750, 1100, 680); // 地中海东岸
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 2. 非洲大陆
  ctx.beginPath();
  ctx.moveTo(1050, 720);
  ctx.bezierCurveTo(1140, 740, 1200, 850, 1220, 980); // 红海/东非之角
  ctx.bezierCurveTo(1200, 1150, 1120, 1350, 1050, 1420);// 好望角南端
  ctx.bezierCurveTo(960, 1350, 900, 1100, 880, 950);   // 几内亚湾
  ctx.bezierCurveTo(860, 850, 920, 760, 1050, 720);   // 直布罗陀/北非海岸
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 3. 北美洲大陆
  ctx.beginPath();
  ctx.moveTo(560, 320);
  ctx.bezierCurveTo(680, 260, 780, 340, 720, 480);   // 格陵兰/加拿大北部
  ctx.bezierCurveTo(680, 600, 640, 750, 580, 880);   // 佛罗里达/墨西哥湾
  ctx.bezierCurveTo(520, 980, 460, 1050, 420, 1080); // 中美洲峡地
  ctx.bezierCurveTo(360, 950, 320, 750, 340, 580);   // 加利福尼亚太平洋沿岸
  ctx.bezierCurveTo(360, 450, 440, 360, 560, 320);   // 阿拉斯加半岛
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 4. 南美洲大陆
  ctx.beginPath();
  ctx.moveTo(540, 1100);
  ctx.bezierCurveTo(640, 1150, 720, 1250, 700, 1380); // 巴西高原东北角
  ctx.bezierCurveTo(660, 1500, 580, 1680, 520, 1750); // 阿根廷合恩角南端
  ctx.bezierCurveTo(460, 1650, 440, 1400, 450, 1250); // 智利安第斯山脉
  ctx.bezierCurveTo(460, 1180, 500, 1120, 540, 1100);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 5. 大洋洲 (澳洲大陆)
  ctx.beginPath();
  ctx.ellipse(1950, 1350, 160, 110, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // 大洋与大洲古典花体字标注
  ctx.fillStyle = '#6b4f3b';
  ctx.font = 'bold 24px "Microsoft YaHei", serif';
  ctx.fillText('亚 洲 (ASIA)', 1580, 620);
  ctx.fillText('欧 洲 (EUROPE)', 960, 520);
  ctx.fillText('非 洲 (AFRICA)', 1020, 1060);
  ctx.fillText('北 美 洲 (N. AMERICA)', 480, 560);
  ctx.fillText('南 美 洲 (S. AMERICA)', 560, 1360);
  ctx.fillText('大 洋 洲 (OCEANIA)', 1920, 1360);

  ctx.fillStyle = 'rgba(30, 64, 175, 0.45)';
  ctx.font = 'italic 20px serif';
  ctx.fillText('~ 太 平 洋 (PACIFIC OCEAN) ~', 2200, 950);
  ctx.fillText('~ 大 西 洋 (ATLANTIC OCEAN) ~', 760, 1050);
  ctx.fillText('~ 印 度 洋 (INDIAN OCEAN) ~', 1450, 1280);
  ctx.restore();

  mapLandmarks.value = [
    {
      id: 'lm_global_china',
      type: 'story_city',
      name: '中国 · 长沙楚风编辑部',
      icon: '🏮',
      x: 1720,
      y: 720,
      lore: '东亚核心剧情起点'
    },
    {
      id: 'lm_global_pyramid',
      type: 'story_temple',
      name: '埃及 · 金字塔地下祭坛',
      icon: '🏛️',
      x: 1140,
      y: 740,
      lore: '世界古代神秘遗迹'
    },
    {
      id: 'lm_global_bermuda',
      type: 'story_danger',
      name: '百慕大三角 · 魔鬼海域',
      icon: '💀',
      x: 680,
      y: 780,
      lore: '空间磁场紊乱禁区'
    }
  ];

  mapRoutes.value = [];
  saveMapData();
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

function clearCanvas(clearData = true) {
  drawParchmentBackground();
  if (clearData) {
    mapLandmarks.value = [];
    mapRoutes.value = [];
  }
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

  // 2. 鼠标左键
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
      ctx.strokeStyle = '#f8f2e4';
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
      y: Math.round(logicalY - 20),
      lore: '点击双击编辑剧情地名与备注'
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
        label: '探险行进路线'
      });
      isDrawingRoute.value = false;
      tempRoute.value = null;
      saveMapData();
    }
  }
}

function onGlobalMouseMove(e: MouseEvent) {
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
  zoomLevel.value = Math.min(Math.max(0.25, zoomLevel.value * delta), 2.5);
}

function zoom(factor: number) {
  zoomLevel.value = Math.min(Math.max(0.25, zoomLevel.value * factor), 2.5);
}

function resetView() {
  zoomLevel.value = 0.65;
  panX.value = -100;
  panY.value = -80;
}

function saveMapData() {
  if (!props.bookId || !canvasRef.value) return;
  try {
    const dataUrl = canvasRef.value.toDataURL('image/png', 0.85);
    const mapObj = {
      preset: currentMapPreset.value,
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
      if (parsed.preset) currentMapPreset.value = parsed.preset;
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

  // 无存储记录时默认载入中国探险全图
  loadChinaMapPreset();
}

function exportMapImage() {
  if (!canvasRef.value) return;
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = canvasRef.value.width;
  tempCanvas.height = canvasRef.value.height;
  const tCtx = tempCanvas.getContext('2d');
  if (!tCtx) return;

  // 1. 绘制底层底图
  tCtx.drawImage(canvasRef.value, 0, 0);

  // 2. 绘制路线
  tCtx.strokeStyle = '#dc2626';
  tCtx.lineWidth = 3.5;
  tCtx.setLineDash([8, 6]);
  mapRoutes.value.forEach(r => {
    tCtx.beginPath();
    tCtx.moveTo(r.x1, r.y1);
    tCtx.lineTo(r.x2, r.y2);
    tCtx.stroke();
  });

  // 3. 绘制地标
  mapLandmarks.value.forEach(lm => {
    tCtx.font = 'bold 20px "Microsoft YaHei", sans-serif';
    tCtx.textAlign = 'center';
    tCtx.fillStyle = '#1c1917';
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
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #2a241e;
  overflow: hidden;
  position: relative;
  user-select: none;
}

/* 顶部工具栏 */
.worldmap-toolbar {
  height: 52px;
  background: #1f1a14;
  border-bottom: 1px solid #3d3328;
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 12px;
  z-index: 20;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
  flex-wrap: nowrap;
  overflow-x: auto;
}

.toolbar-label {
  font-size: 12px;
  color: #a89f91;
  font-weight: 600;
  margin-right: 4px;
}

.toolbar-divider {
  width: 1px;
  height: 24px;
  background: #3d3328;
}

.tool-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.map-preset-btn {
  padding: 5px 12px;
  background: #2d261e;
  color: #c9bda8;
  border: 1px solid #4a3e2f;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.map-preset-btn:hover {
  background: #3d3429;
  color: #f5ede0;
}

.map-preset-btn.active {
  background: #b45309;
  color: #fff;
  border-color: #f59e0b;
  box-shadow: 0 0 10px rgba(245, 158, 11, 0.4);
}

.map-tool-btn {
  padding: 5px 12px;
  background: #2a231b;
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
  background: #d97706;
  color: #fff;
  border-color: #f59e0b;
  font-weight: 600;
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

/* 颜色选择器 */
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
  padding: 3px 8px;
  background: #2a231b;
  color: #d6ccba;
  border: 1px solid #473a2b;
  border-radius: 5px;
  font-size: 11px;
}

/* 印章选择 */
.stamp-select-btn {
  padding: 3px 8px;
  background: #2a231b;
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

/* 视口与画布 */
.worldmap-viewport {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: radial-gradient(circle at center, #2e261f 0%, #17130f 100%);
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
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.75);
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
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5));
}

.route-line-temp {
  stroke: #f59e0b;
  stroke-width: 3;
  stroke-dasharray: 6, 6;
}

.route-label {
  fill: #fff;
  font-size: 14px;
  font-weight: bold;
  text-anchor: middle;
  paint-order: stroke fill;
  stroke: #1c1917;
  stroke-width: 4px;
}

/* 地标层 */
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
  background: rgba(28, 25, 23, 0.92);
  border: 1px solid #d97706;
  border-radius: 6px;
  padding: 3px 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
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

/* 浮动控件 */
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
  background: rgba(30, 25, 20, 0.85);
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
  background: rgba(20, 16, 12, 0.85);
  border: 1px solid #4a3e2f;
  border-radius: 6px;
  padding: 6px 14px;
  color: #c4b5a0;
  font-size: 11px;
  z-index: 10;
  pointer-events: none;
}
</style>
