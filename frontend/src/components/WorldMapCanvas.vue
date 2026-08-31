<template>
  <div class="worldmap-container">
    <!-- 地图专业画板工具栏 -->
    <div class="worldmap-toolbar">
      <!-- 维度模式切换 (2D手绘 / 3D天体星系) -->
      <div class="tool-group mode-toggle-group">
        <button
          class="map-tool-btn mode-btn"
          :class="{ active: viewMode === '2d' }"
          @click="switchViewMode('2d')"
          title="切换至 2D 羊皮纸手绘自由画板"
        >
          🗺️ 2D 羊皮纸画板
        </button>
        <button
          class="map-tool-btn mode-btn galaxy-btn"
          :class="{ active: viewMode === '3d' }"
          @click="switchViewMode('3d')"
          title="切换至 3D 华夏北斗天体星系图谱"
        >
          🌌 3D 华夏北斗星系
        </button>
      </div>

      <!-- 2D 专属绘图工具 -->
      <template v-if="viewMode === '2d'">
        <div class="tool-group">
          <button
            class="map-tool-btn"
            :class="{ active: currentTool === 'brush' }"
            @click="currentTool = 'brush'"
            title="画笔工具"
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
            title="放置地标"
          >
            📍 放置地标
          </button>
          <button
            class="map-tool-btn"
            :class="{ active: currentTool === 'route' }"
            @click="currentTool = 'route'"
            title="绘制路线"
          >
            🚩 绘制路线
          </button>
          <button
            class="map-tool-btn"
            :class="{ active: currentTool === 'pan' }"
            @click="currentTool = 'pan'"
            title="漫游视角"
          >
            ✋ 漫游
          </button>
        </div>

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
            <option :value="16">宽带 16px</option>
            <option :value="32">涂抹 32px</option>
          </select>
        </div>

        <div v-if="currentTool === 'stamp'" class="tool-group tool-sub">
          <button
            v-for="st in stampList"
            :key="st.type"
            class="stamp-select-btn"
            :class="{ active: selectedStampType === st.type }"
            @click="selectedStampType = st.type"
          >
            <span>{{ st.icon }}</span>
            <span>{{ st.name }}</span>
          </button>
        </div>

        <div class="tool-group map-actions-right">
          <button class="map-tool-btn" @click="undo" :disabled="historyStack.length === 0">↩️ 撤销</button>
          <button class="map-tool-btn danger" @click="clearAll">🗑️ 清空画板</button>
          <button class="map-tool-btn highlight" @click="exportMapImage">💾 导出地图</button>
        </div>
      </template>

      <!-- 3D 专属控制工具 -->
      <template v-else>
        <div class="tool-group">
          <button class="map-tool-btn sci-btn" :class="{ active: autoRotate3D }" @click="toggleAutoRotate">
            {{ autoRotate3D ? '⏸️ 暂停自转' : '▶️ 宇宙自转' }}
          </button>
          <button class="map-tool-btn sci-btn" @click="resetCamera3D" title="重置视角">
            🎯 全景俯瞰
          </button>
          <button class="map-tool-btn sci-btn glow-purple" @click="focusCurrentVolumeStar" title="聚焦第二卷当前天璇星">
            ⭐ 锁定当前：第二卷（梵净山）
          </button>
        </div>
        <div class="tool-group map-actions-right">
          <span class="galaxy-tip">🌌 3D 宇宙全景 · 左键拖拽翻转 / 滚轮缩放 / 点击星球锁定密档</span>
        </div>
      </template>
    </div>

    <!-- 2D 手绘画布视口 -->
    <div
      v-show="viewMode === '2d'"
      ref="mapWrapperRef"
      class="worldmap-viewport"
      :class="[`cursor-${isRightPanning ? 'panning' : currentTool}`]"
      @mousedown="onMouseDown"
      @contextmenu.prevent
      @wheel.prevent="onWheel"
    >
      <div
        class="map-canvas-plane"
        :style="{
          transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
          transformOrigin: '0 0'
        }"
      >
        <canvas ref="drawingCanvasRef" class="map-drawing-layer" width="3600" height="2400"></canvas>
        <canvas ref="routeCanvasRef" class="map-route-layer" width="3600" height="2400"></canvas>

        <div
          v-for="marker in landmarks"
          :key="marker.id"
          class="placed-landmark-pin"
          :class="{ selected: selectedMarkerId === marker.id }"
          :style="{ left: `${marker.x}px`, top: `${marker.y}px` }"
          @mousedown.stop="onMarkerMouseDown($event, marker)"
        >
          <div class="pin-icon-wrap" :style="{ borderColor: marker.color || '#d4af37' }">
            <span class="pin-icon">{{ marker.icon }}</span>
          </div>
          <div class="pin-label" @dblclick.stop="editMarkerName(marker)">
            {{ marker.title }}
          </div>
          <button
            v-if="selectedMarkerId === marker.id"
            class="pin-del-btn"
            @click.stop="deleteMarker(marker.id)"
          >
            ×
          </button>
        </div>
      </div>

      <div class="zoom-controls-hud">
        <button class="hud-btn" @click="zoomIn">+</button>
        <div class="hud-scale">{{ Math.round(zoom * 100) }}%</div>
        <button class="hud-btn" @click="zoomOut">-</button>
        <button class="hud-btn" @click="resetView">⟲</button>
      </div>
    </div>

    <!-- 3D 宇宙天体星系视口 (Three.js WebGL) -->
    <div v-show="viewMode === '3d'" class="worldmap-3d-viewport">
      <div ref="threeCanvasRef" class="three-container"></div>

      <!-- 底部星系导航罗盘 HUD -->
      <div class="galaxy-bottom-hud">
        <div class="hud-cluster-title">🌌 华夏北斗龙脊天体图谱 (THE NORTH DIPPER MATRIX)</div>
        <div class="hud-star-buttons">
          <button
            v-for="p in sevenStarsPlanets"
            :key="p.id"
            class="hud-star-pill"
            :class="{ active: selectedPlanet?.id === p.id, current: p.id === 'star2' }"
            @click="focusPlanetById(p.id)"
          >
            <span class="pill-dot" :style="{ background: p.hexColor, boxShadow: `0 0 8px ${p.hexColor}` }"></span>
            <span class="pill-name">{{ p.starName.split(' ')[1] || p.starName }}</span>
            <span class="pill-loc">{{ p.name.split('·')[0] }}</span>
          </button>
        </div>
      </div>

      <!-- 星球详情信息浮层 (HUD) -->
      <transition name="fade">
        <div v-if="selectedPlanet" class="planet-dossier-card">
          <div class="card-header" :style="{ borderBottomColor: selectedPlanet.hexColor }">
            <span class="star-badge" :style="{ background: selectedPlanet.hexColor }">{{ selectedPlanet.starName }}</span>
            <h3 class="planet-title">{{ selectedPlanet.name }}</h3>
            <button class="close-card-btn" @click="selectedPlanet = null">×</button>
          </div>
          <div class="card-body">
            <div class="dossier-row">
              <span class="label">📍 地理位置：</span>
              <span class="val">{{ selectedPlanet.location }}</span>
            </div>
            <div class="dossier-row">
              <span class="label">📖 对应分卷：</span>
              <span class="val highlight" :style="{ color: selectedPlanet.hexColor }">{{ selectedPlanet.volume }}</span>
            </div>
            <div class="dossier-row">
              <span class="label">🌐 经纬坐标：</span>
              <span class="val mono">{{ selectedPlanet.coords[0] }}°E, {{ selectedPlanet.coords[1] }}°N</span>
            </div>
            <div class="dossier-row">
              <span class="label">🏯 核心奇观：</span>
              <span class="val">{{ selectedPlanet.marvel }}</span>
            </div>
            <div class="dossier-row">
              <span class="label">💀 致命威胁：</span>
              <span class="val danger">{{ selectedPlanet.hazard }}</span>
            </div>
            <div class="dossier-desc">
              {{ selectedPlanet.desc }}
            </div>
            <div class="dossier-actions">
              <button class="dossier-btn" @click="focusPlanetById(selectedPlanet.id)">
                🚀 环绕观察此星
              </button>
            </div>
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import * as THREE from 'three';

// ─── 维度切换 ─────────────────────────────────────────────────────────────
const viewMode = ref<'2d' | '3d'>('3d');

// ─── 2D 画板状态 ──────────────────────────────────────────────────────────
const currentTool = ref<'brush' | 'eraser' | 'stamp' | 'route' | 'pan'>('brush');
const brushColor = ref('#1c1c1c');
const brushWidth = ref(4);
const brushColors = [
  '#1c1c1c', '#795548', '#b71c1c', '#0d47a1', '#1b5e20', '#e65100', '#4a148c', '#ffd700'
];

interface StampItem { type: string; icon: string; name: string; color: string; }
const stampList: StampItem[] = [
  { type: 'tower', icon: '🏯', name: '走马古楼', color: '#ffd700' },
  { type: 'cave', icon: '🕳️', name: '绝险天坑', color: '#e65100' },
  { type: 'mountain', icon: '⛰️', name: '崇山峻岭', color: '#2e7d32' },
  { type: 'water', icon: '🌊', name: '地下暗河', color: '#0288d1' },
  { type: 'danger', icon: '💀', name: '死穴凶煞', color: '#d32f2f' },
  { type: 'camp', icon: '⛺', name: '宿营大营', color: '#8d6e63' }
];
const selectedStampType = ref('tower');

interface LandmarkPin { id: string; x: number; y: number; type: string; icon: string; title: string; color: string; }
const landmarks = ref<LandmarkPin[]>([]);
const selectedMarkerId = ref<string | null>(null);

const panX = ref(100);
const panY = ref(60);
const zoom = ref(0.75);
const isRightPanning = ref(false);
const isDrawing = ref(false);
const historyStack = ref<ImageData[]>([]);

const mapWrapperRef = ref<HTMLDivElement | null>(null);
const drawingCanvasRef = ref<HTMLCanvasElement | null>(null);
const routeCanvasRef = ref<HTMLCanvasElement | null>(null);

// ─── 3D 宇宙星系数据 ─────────────────────────────────────────────────────
const threeCanvasRef = ref<HTMLDivElement | null>(null);
const autoRotate3D = ref(true);

interface PlanetData {
  id: string;
  name: string;
  starName: string;
  volume: string;
  location: string;
  coords: [number, number];
  color: number;
  hexColor: string;
  size: number;
  position: [number, number, number];
  marvel: string;
  hazard: string;
  desc: string;
  satellites?: { name: string; color: number; dist: number; speed: number; }[];
}

const sevenStarsPlanets: PlanetData[] = [
  {
    id: 'core',
    name: '长沙 · 走马楼大本营',
    starName: '🏮 核心始发枢纽',
    volume: '故事起源 / 楚风文化工作室',
    location: '湖南省长沙市芙蓉区走马楼巷',
    coords: [112.977, 28.190],
    color: 0xffaa00,
    hexColor: '#ffaa00',
    size: 2.8,
    position: [0, 0, 0],
    marvel: '楚风文化工作室、2004时代市井、线索中枢',
    hazard: '贾老板等黑恶同行竞争与阴谋刺探',
    desc: '杨涛、胖子与刘菲的大本营，承接全国各地奇闻异事，所有地下探险的起点与归宿。',
    satellites: [
      { name: '杨涛 (主编)', color: 0x64b5f6, dist: 4.5, speed: 0.02 },
      { name: '胖子 (武装)', color: 0xffb74d, dist: 6.0, speed: 0.015 },
      { name: '刘菲 (后勤)', color: 0xf06292, dist: 7.5, speed: 0.01 }
    ]
  },
  {
    id: 'star1',
    name: '湖南郴州 · 骑田岭',
    starName: '⭐ 天枢星',
    volume: '第一卷：湘南溶洞 (已通关)',
    location: '湖南省郴州市苏仙区骑田岭深山712矿区',
    coords: [112.905, 25.639],
    color: 0x00e5ff,
    hexColor: '#00e5ff',
    size: 2.0,
    position: [16, -6, 8],
    marvel: '712废弃矿道、40米螺旋石筒、地下九层木楼',
    hazard: '石脸虫、水龙骨致幻花、地下暗河水脉决堤',
    desc: '第一座走马楼（天枢木楼）沉埋之地，已被声波共振暗河大暴发冲垮，带回6万酬金与夜郎木杯。',
    satellites: [
      { name: '712地质队遗物', color: 0x80deea, dist: 3.5, speed: 0.03 }
    ]
  },
  {
    id: 'star2',
    name: '贵州铜仁 · 梵净山',
    starName: '⭐ 天璇星 (🔥 当前征途)',
    volume: '第二卷：黔东天坑 (正在进行)',
    location: '贵州省铜仁地区梵净山西麓落水寨',
    coords: [108.694, 27.915],
    color: 0xba68c8,
    hexColor: '#ba68c8',
    size: 2.3,
    position: [-14, 10, 20],
    marvel: '千米垂直绝壁天坑、四根青铜玄铁索倒悬九层水月楼',
    hazard: '深潭盲眼水鳞蟒、水银重力天平失衡、突发高山暴雨山洪',
    desc: '第二座走马楼（天璇倒悬水月楼）。凭借门缝下的三重复合摩斯密信破译而来，已购置军绿吉普212整装出征！',
    satellites: [
      { name: '军绿吉普212', color: 0x81c784, dist: 3.8, speed: 0.025 },
      { name: '夜郎青铜古匙', color: 0xffd54f, dist: 5.2, speed: 0.018 }
    ]
  },
  {
    id: 'star3',
    name: '湖北宜昌 · 神农架',
    starName: '⭐ 天玑星',
    volume: '第三卷：华中冰窟',
    location: '湖北省西部神农架原始林区与三峡地缝',
    coords: [110.49, 31.74],
    color: 0x42a5f5,
    hexColor: '#42a5f5',
    size: 1.9,
    position: [-22, 24, 10],
    marvel: '华中屋脊万年高山地下冰洞、三峡绝壁巴人悬棺群',
    hazard: '极寒失温陷阱、远古冷杉寄生真菌、倒悬悬棺落石',
    desc: '第三座走马楼（天玑冰魂楼），深藏在零下二十度的地下冰川熔洞内部。'
  },
  {
    id: 'star4',
    name: '安徽六安 · 大别山',
    starName: '⭐ 天权星',
    volume: '第四卷：淮上石宫 (斗勺枢纽)',
    location: '安徽省六安市金寨县大别山天堂寨',
    coords: [115.77, 31.12],
    color: 0x66bb6a,
    hexColor: '#66bb6a',
    size: 1.9,
    position: [8, 34, 0],
    marvel: '白垩纪巨型花岗岩天险石窟、道家三十六洞天石室',
    hazard: '巨型磁石矿引发的罗盘失灵与磁场幻象、翻板连环锁',
    desc: '第四座走马楼（天权枢纽石宫），斗勺与斗柄的折角枢纽，镇守江淮龙脉分水岭。'
  },
  {
    id: 'star5',
    name: '山东泰安 · 东岳泰山',
    starName: '⭐ 玉衡星',
    volume: '第五卷：东岳封禅 (斗柄首星)',
    location: '山东省泰安市泰山傲徕峰与蒙山溶洞',
    coords: [117.10, 36.25],
    color: 0xffca28,
    hexColor: '#ffca28',
    size: 2.0,
    position: [22, 45, -12],
    marvel: '始皇封禅玉简沉埋秘窟、泰山石敢当镇煞大阵',
    hazard: '秦代青铜重弩死阵、地下水银灌注墓道',
    desc: '第五座走马楼（玉衡青铜阙），五岳独尊之龙脊，守卫着古代封禅大典绝密信物。'
  },
  {
    id: 'star6',
    name: '河北承德 · 燕山雾灵山',
    starName: '⭐ 开阳星',
    volume: '第六卷：燕山要塞',
    location: '河北省承德市兴隆县雾灵山古北口长城地底',
    coords: [117.48, 40.60],
    color: 0xff7043,
    hexColor: '#ff7043',
    size: 1.9,
    position: [16, 58, -26],
    marvel: '古长城绝壁地底古代军事屯兵防空要塞',
    hazard: '火药死锁封门、地底声波侦察死角、暗箭网',
    desc: '第六座走马楼（开阳战楼），明清两代秘密扩建的地下军事禁区。'
  },
  {
    id: 'star7',
    name: '内蒙古赤峰 · 大兴安岭',
    starName: '⭐ 摇光星 (终极破军)',
    volume: '第七卷：极北龙首 (大结局)',
    location: '内蒙古赤峰市克什克腾旗玄武岩熔岩隧道',
    coords: [118.87, 43.26],
    color: 0xffffff,
    hexColor: '#ffffff',
    size: 2.6,
    position: [30, 74, -40],
    marvel: '红山文化上古太阳神龙玉神坛、死火山熔岩深渊',
    hazard: '火山地热毒气、上古地磁倒转震荡、终极宿命考验',
    desc: '第七座走马楼（摇光总龙首）。七楼合一，解开跨越千年的华夏走马楼终极谜团！'
  }
];

const selectedPlanet = ref<PlanetData | null>(null);

let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let renderer: THREE.WebGLRenderer | null = null;
let animFrameId = 0;
let planetMeshes: THREE.Mesh[] = [];
let satelliteGroups: { group: THREE.Group; speed: number; }[] = [];
let targetCameraPos: THREE.Vector3 | null = null;
let targetLookAt: THREE.Vector3 = new THREE.Vector3(0, 20, 0);

// ─── 切换模式 ─────────────────────────────────────────────────────────────
function switchViewMode(mode: '2d' | '3d') {
  viewMode.value = mode;
  if (mode === '3d') {
    nextTick(() => {
      initThreeScene();
    });
  } else {
    cleanupThreeScene();
  }
}

// ─── 动态生成 3D 悬浮文字标签材质 ──────────────────────────────────────────
function createTextSprite(text: string, color = '#ffffff', subText = '') {
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Sprite();

  // 半透明深空渐变背景框
  ctx.fillStyle = 'rgba(10, 15, 30, 0.75)';
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(8, 8, 368, 112, 16);
  ctx.fill();
  ctx.stroke();

  // 主标题
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 30px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, 192, 54);

  // 副标题
  if (subText) {
    ctx.fillStyle = color;
    ctx.font = '20px monospace';
    ctx.fillText(subText, 192, 92);
  }

  const texture = new THREE.CanvasTexture(canvas);
  const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(10, 3.3, 1);
  return sprite;
}

// ─── 动态发光光晕粒子贴图 ─────────────────────────────────────────────────
function createGlowTexture(colorHex: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Texture();

  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, colorHex);
  gradient.addColorStop(0.3, colorHex);
  gradient.addColorStop(0.7, 'rgba(0,0,0,0.4)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

// ─── 初始化顶级 3D 宇宙星系 ───────────────────────────────────────────────
function initThreeScene() {
  if (!threeCanvasRef.value) return;
  cleanupThreeScene();

  const width = threeCanvasRef.value.clientWidth || 1200;
  const height = threeCanvasRef.value.clientHeight || 800;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x04060f);
  scene.fog = new THREE.FogExp2(0x04060f, 0.005);

  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
  camera.position.set(0, 35, 95);
  camera.lookAt(0, 20, 0);
  targetLookAt = new THREE.Vector3(0, 20, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  threeCanvasRef.value.appendChild(renderer.domElement);

  // 1. 璀璨星空背景粒子 + 彩色星云雾
  const starGeo = new THREE.BufferGeometry();
  const starCount = 5000;
  const starPos = new Float32Array(starCount * 3);
  const starColors = new Float32Array(starCount * 3);
  const colorPool = [
    new THREE.Color(0x64b5f6), new THREE.Color(0xba68c8), new THREE.Color(0xffd54f), new THREE.Color(0xffffff)
  ];

  for (let i = 0; i < starCount; i++) {
    starPos[i * 3] = (Math.random() - 0.5) * 600;
    starPos[i * 3 + 1] = (Math.random() - 0.5) * 600;
    starPos[i * 3 + 2] = (Math.random() - 0.5) * 600;
    const c = colorPool[Math.floor(Math.random() * colorPool.length)];
    starColors[i * 3] = c.r;
    starColors[i * 3 + 1] = c.g;
    starColors[i * 3 + 2] = c.b;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

  const starMat = new THREE.PointsMaterial({
    size: 1.2,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending
  });
  const starField = new THREE.Points(starGeo, starMat);
  scene.add(starField);

  // 2. 空间引力网格地板 (Cyberpunk Grid)
  const gridHelper = new THREE.GridHelper(180, 36, 0x3949ab, 0x1a237e);
  gridHelper.position.y = -15;
  (gridHelper.material as THREE.Material).transparent = true;
  (gridHelper.material as THREE.Material).opacity = 0.25;
  scene.add(gridHelper);

  // 3. 高级光源配置
  const ambientLight = new THREE.AmbientLight(0x283593, 2.0);
  scene.add(ambientLight);

  const sunLight = new THREE.PointLight(0xffb74d, 4.0, 150);
  sunLight.position.set(0, 0, 0);
  scene.add(sunLight);

  // 4. 构建北斗七星高颜值发光天体
  planetMeshes = [];
  satelliteGroups = [];
  const pointsForLine: THREE.Vector3[] = [];

  sevenStarsPlanets.forEach((p) => {
    const planetGroup = new THREE.Group();
    planetGroup.position.set(...p.position);
    scene?.add(planetGroup);

    // 行星本体 (带发光纹理与菲涅尔边缘光)
    const geo = new THREE.SphereGeometry(p.size, 32, 32);
    const mat = new THREE.MeshStandardMaterial({
      color: p.color,
      emissive: p.color,
      emissiveIntensity: p.id === 'core' ? 0.9 : (p.id === 'star2' ? 0.8 : 0.45),
      roughness: 0.2,
      metalness: 0.3
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData = p;
    planetGroup.add(mesh);
    planetMeshes.push(mesh);

    // 外层发光日冕光晕 (Corona Sprite)
    const glowMat = new THREE.SpriteMaterial({
      map: createGlowTexture(p.hexColor),
      color: p.color,
      transparent: true,
      blending: THREE.AdditiveBlending,
      opacity: p.id === 'star2' ? 0.9 : 0.6
    });
    const glowSprite = new THREE.Sprite(glowMat);
    glowSprite.scale.set(p.size * 4.5, p.size * 4.5, 1);
    planetGroup.add(glowSprite);

    // 全息引力光环 (Concentric Gravity Orbit)
    const ringGeo = new THREE.RingGeometry(p.size * 1.5, p.size * 1.7, 48);
    const ringMat = new THREE.MeshBasicMaterial({
      color: p.color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2.3;
    planetGroup.add(ringMesh);

    // 垂直地面全息定位激光束 (Vertical Holographic Laser Beam)
    const beamHeight = p.position[1] - (-15);
    const beamGeo = new THREE.CylinderGeometry(0.08, 0.08, beamHeight, 16);
    const beamMat = new THREE.MeshBasicMaterial({
      color: p.color,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending
    });
    const beamMesh = new THREE.Mesh(beamGeo, beamMat);
    beamMesh.position.y = -beamHeight / 2;
    planetGroup.add(beamMesh);

    // 3D 悬浮全息地标徽标 (Holographic Text Badge)
    const spriteLabel = createTextSprite(
      p.starName.split(' ')[1] || p.starName,
      p.hexColor,
      p.name
    );
    spriteLabel.position.set(0, p.size + 4.2, 0);
    planetGroup.add(spriteLabel);

    // 围绕星球公转的小卫星群 (Characters / Artifact Satellites)
    if (p.satellites && p.satellites.length > 0) {
      p.satellites.forEach(sat => {
        const satOrbitGroup = new THREE.Group();
        planetGroup.add(satOrbitGroup);

        const satGeo = new THREE.SphereGeometry(0.35, 16, 16);
        const satMat = new THREE.MeshStandardMaterial({
          color: sat.color,
          emissive: sat.color,
          emissiveIntensity: 0.8
        });
        const satMesh = new THREE.Mesh(satGeo, satMat);
        satMesh.position.set(sat.dist, 0, 0);
        satOrbitGroup.add(satMesh);

        // 卫星轨道虚线圈
        const orbitLineGeo = new THREE.RingGeometry(sat.dist - 0.04, sat.dist + 0.04, 64);
        const orbitLineMat = new THREE.MeshBasicMaterial({
          color: sat.color,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.25
        });
        const orbitLineMesh = new THREE.Mesh(orbitLineGeo, orbitLineMat);
        orbitLineMesh.rotation.x = Math.PI / 2;
        satOrbitGroup.add(orbitLineMesh);

        satelliteGroups.push({ group: satOrbitGroup, speed: sat.speed });
      });
    }

    if (p.id !== 'core') {
      pointsForLine.push(new THREE.Vector3(...p.position));
    }
  });

  // 5. 华夏北斗七星发光能量星座管道 (Glowing Constellation Energy Line)
  if (pointsForLine.length > 1) {
    const curve = new THREE.CatmullRomCurve3(pointsForLine, false, 'catmullrom', 0.1);
    const tubeGeo = new THREE.TubeGeometry(curve, 100, 0.25, 8, false);
    const tubeMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xffaa00,
      emissiveIntensity: 0.9,
      roughness: 0.1,
      metalness: 0.8,
      transparent: true,
      opacity: 0.85
    });
    const constellationTube = new THREE.Mesh(tubeGeo, tubeMat);
    scene.add(constellationTube);
  }

  // 6. 交互监听
  setup3DInteraction();

  // 7. 渲染循环
  function animate() {
    animFrameId = requestAnimationFrame(animate);

    // 宇宙慢速自转
    if (autoRotate3D.value && scene && !targetCameraPos) {
      scene.rotation.y += 0.0012;
    }

    // 卫星公转
    satelliteGroups.forEach(item => {
      item.group.rotation.y += item.speed;
    });

    // 平滑镜头过渡插值 (Smooth Camera Lerp)
    if (targetCameraPos && camera) {
      camera.position.lerp(targetCameraPos, 0.05);
      camera.lookAt(targetLookAt);
      if (camera.position.distanceTo(targetCameraPos) < 0.2) {
        targetCameraPos = null;
      }
    }

    renderer?.render(scene!, camera!);
  }
  animate();
}

function setup3DInteraction() {
  if (!threeCanvasRef.value || !renderer) return;
  const dom = renderer.domElement;
  let isDragging = false;
  let prevMouseX = 0;
  let prevMouseY = 0;

  dom.addEventListener('mousedown', (e) => {
    isDragging = true;
    prevMouseX = e.clientX;
    prevMouseY = e.clientY;
    targetCameraPos = null; // 用户打断镜头动画
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging || !scene || !camera) return;
    const deltaX = e.clientX - prevMouseX;
    const deltaY = e.clientY - prevMouseY;
    prevMouseX = e.clientX;
    prevMouseY = e.clientY;

    scene.rotation.y += deltaX * 0.004;
    camera.position.y = Math.max(-10, Math.min(90, camera.position.y - deltaY * 0.12));
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
  });

  dom.addEventListener('wheel', (e) => {
    if (!camera) return;
    camera.position.z = Math.max(12, Math.min(180, camera.position.z + e.deltaY * 0.06));
  });

  // 点击射线拾取星球
  dom.addEventListener('click', (e) => {
    if (!camera || !scene) return;
    const rect = dom.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(planetMeshes);

    if (intersects.length > 0) {
      const hit = intersects[0].object;
      selectedPlanet.value = hit.userData as PlanetData;
      flyToPlanet(hit.userData as PlanetData);
    }
  });
}

function flyToPlanet(p: PlanetData) {
  targetLookAt = new THREE.Vector3(...p.position);
  targetCameraPos = new THREE.Vector3(
    p.position[0] + (p.size * 3.5),
    p.position[1] + (p.size * 2.0),
    p.position[2] + (p.size * 5.5)
  );
}

function focusPlanetById(id: string) {
  const p = sevenStarsPlanets.find(item => item.id === id);
  if (p) {
    selectedPlanet.value = p;
    flyToPlanet(p);
  }
}

function toggleAutoRotate() {
  autoRotate3D.value = !autoRotate3D.value;
}

function resetCamera3D() {
  selectedPlanet.value = null;
  targetLookAt = new THREE.Vector3(0, 20, 0);
  targetCameraPos = new THREE.Vector3(0, 35, 95);
  if (scene) scene.rotation.set(0, 0, 0);
}

function focusCurrentVolumeStar() {
  focusPlanetById('star2');
}

function cleanupThreeScene() {
  if (animFrameId) cancelAnimationFrame(animFrameId);
  if (renderer && renderer.domElement) {
    renderer.domElement.remove();
  }
  scene = null;
  camera = null;
  renderer = null;
}

// ─── 2D 手绘画板逻辑 ─────────────────────────────────────────────────────
onMounted(() => {
  init2DCanvas();
});

onUnmounted(() => {
  cleanupThreeScene();
});

function init2DCanvas() {
  const dCanvas = drawingCanvasRef.value;
  if (!dCanvas) return;
  const ctx = dCanvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#f8f4eb';
  ctx.fillRect(0, 0, dCanvas.width, dCanvas.height);

  ctx.strokeStyle = '#ebdcc7';
  ctx.lineWidth = 1;
  for (let x = 0; x < dCanvas.width; x += 100) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, dCanvas.height); ctx.stroke();
  }
  for (let y = 0; y < dCanvas.height; y += 100) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(dCanvas.width, y); ctx.stroke();
  }

  saveHistory();
}

function saveHistory() {
  const dCanvas = drawingCanvasRef.value;
  if (!dCanvas) return;
  const ctx = dCanvas.getContext('2d');
  if (!ctx) return;
  if (historyStack.value.length > 20) historyStack.value.shift();
  historyStack.value.push(ctx.getImageData(0, 0, dCanvas.width, dCanvas.height));
}

function undo() {
  if (historyStack.value.length <= 1) return;
  historyStack.value.pop();
  const prev = historyStack.value[historyStack.value.length - 1];
  const dCanvas = drawingCanvasRef.value;
  if (!dCanvas || !prev) return;
  const ctx = dCanvas.getContext('2d');
  if (ctx) ctx.putImageData(prev, 0, 0);
}

function clearAll() {
  if (!confirm('确认清空所有手绘画笔和地标吗？')) return;
  landmarks.value = [];
  init2DCanvas();
}

function exportMapImage() {
  const dCanvas = drawingCanvasRef.value;
  if (!dCanvas) return;
  const link = document.createElement('a');
  link.download = `走马楼华夏全景地图_${Date.now()}.png`;
  link.href = dCanvas.toDataURL('image/png');
  link.click();
}

let lastX = 0;
let lastY = 0;

function onMouseDown(e: MouseEvent) {
  if (viewMode.value !== '2d') return;
  if (e.button === 2 || currentTool.value === 'pan') {
    isRightPanning.value = true;
    lastX = e.clientX;
    lastY = e.clientY;
    window.addEventListener('mousemove', onMouseMovePan);
    window.addEventListener('mouseup', onMouseUpPan);
    return;
  }

  if (e.button === 0) {
    const dCanvas = drawingCanvasRef.value;
    if (!dCanvas) return;
    const rect = dCanvas.getBoundingClientRect();
    const canvasX = (e.clientX - rect.left) / zoom.value;
    const canvasY = (e.clientY - rect.top) / zoom.value;

    if (currentTool.value === 'stamp') {
      const st = stampList.find(s => s.type === selectedStampType.value) || stampList[0];
      landmarks.value.push({
        id: `pin_${Date.now()}`,
        x: Math.round(canvasX),
        y: Math.round(canvasY),
        type: st.type,
        icon: st.icon,
        title: st.name,
        color: st.color
      });
      return;
    }

    if (currentTool.value === 'brush' || currentTool.value === 'eraser') {
      isDrawing.value = true;
      lastX = canvasX;
      lastY = canvasY;
      const ctx = dCanvas.getContext('2d');
      if (ctx) {
        ctx.beginPath();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = brushWidth.value;
        ctx.strokeStyle = currentTool.value === 'eraser' ? '#f8f4eb' : brushColor.value;
        ctx.moveTo(lastX, lastY);
      }
      window.addEventListener('mousemove', onMouseMoveDraw);
      window.addEventListener('mouseup', onMouseUpDraw);
    }
  }
}

function onMouseMoveDraw(e: MouseEvent) {
  if (!isDrawing.value) return;
  const dCanvas = drawingCanvasRef.value;
  if (!dCanvas) return;
  const rect = dCanvas.getBoundingClientRect();
  const canvasX = (e.clientX - rect.left) / zoom.value;
  const canvasY = (e.clientY - rect.top) / zoom.value;

  const ctx = dCanvas.getContext('2d');
  if (ctx) {
    ctx.lineTo(canvasX, canvasY);
    ctx.stroke();
  }
}

function onMouseUpDraw() {
  if (isDrawing.value) {
    isDrawing.value = false;
    saveHistory();
  }
  window.removeEventListener('mousemove', onMouseMoveDraw);
  window.removeEventListener('mouseup', onMouseUpDraw);
}

function onMouseMovePan(e: MouseEvent) {
  if (!isRightPanning.value) return;
  panX.value += e.clientX - lastX;
  panY.value += e.clientY - lastY;
  lastX = e.clientX;
  lastY = e.clientY;
}

function onMouseUpPan() {
  isRightPanning.value = false;
  window.removeEventListener('mousemove', onMouseMovePan);
  window.removeEventListener('mouseup', onMouseUpPan);
}

function onWheel(e: WheelEvent) {
  if (viewMode.value !== '2d') return;
  const delta = e.deltaY > 0 ? 0.9 : 1.1;
  const newZoom = Math.max(0.2, Math.min(3.0, zoom.value * delta));
  zoom.value = parseFloat(newZoom.toFixed(2));
}

function zoomIn() { zoom.value = Math.min(3.0, parseFloat((zoom.value + 0.15).toFixed(2))); }
function zoomOut() { zoom.value = Math.max(0.2, parseFloat((zoom.value - 0.15).toFixed(2))); }
function resetView() { panX.value = 100; panY.value = 60; zoom.value = 0.75; }

function onMarkerMouseDown(e: MouseEvent, marker: LandmarkPin) {
  selectedMarkerId.value = marker.id;
  let startX = e.clientX;
  let startY = e.clientY;
  const initPinX = marker.x;
  const initPinY = marker.y;

  function onMove(ev: MouseEvent) {
    const dx = (ev.clientX - startX) / zoom.value;
    const dy = (ev.clientY - startY) / zoom.value;
    marker.x = Math.round(initPinX + dx);
    marker.y = Math.round(initPinY + dy);
  }

  function onUp() {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
  }

  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}

function editMarkerName(marker: LandmarkPin) {
  const name = prompt('修改地标名称：', marker.title);
  if (name) marker.title = name;
}

function deleteMarker(id: string) {
  landmarks.value = landmarks.value.filter(m => m.id !== id);
}
</script>

<style scoped>
.worldmap-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: #04060f;
  position: relative;
  overflow: hidden;
  user-select: none;
}

/* 顶部高科技工具栏 */
.worldmap-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  background: rgba(13, 17, 34, 0.95);
  border-bottom: 1px solid rgba(83, 109, 254, 0.25);
  z-index: 20;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(12px);
}

.mode-toggle-group {
  background: #080a14;
  padding: 3px;
  border-radius: 8px;
  border: 1px solid rgba(123, 31, 162, 0.5);
}

.mode-btn {
  font-weight: bold;
  border-radius: 6px !important;
}

.mode-btn.galaxy-btn.active {
  background: linear-gradient(135deg, #7b1fa2, #303f9f) !important;
  box-shadow: 0 0 16px rgba(170, 0, 255, 0.8);
  color: #fff !important;
}

.tool-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.map-actions-right {
  margin-left: auto;
}

.map-tool-btn {
  padding: 6px 12px;
  background: #181d36;
  color: #cfd8dc;
  border: 1px solid #2f3863;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.map-tool-btn:hover {
  background: #252e54;
  border-color: #ffd700;
  color: #fff;
}

.map-tool-btn.active {
  background: #ffd700;
  color: #111;
  border-color: #ffd700;
  font-weight: bold;
}

.map-tool-btn.sci-btn {
  background: #121833;
  border-color: #3f51b5;
  color: #90caf9;
}

.map-tool-btn.sci-btn:hover {
  background: #1e285a;
  box-shadow: 0 0 10px rgba(63, 81, 181, 0.6);
}

.map-tool-btn.glow-purple {
  border-color: #ab47bc;
  color: #e1bee7;
}

.map-tool-btn.glow-purple:hover {
  background: #4a148c;
  box-shadow: 0 0 12px rgba(171, 71, 188, 0.8);
}

.map-tool-btn.highlight { background: #2e7d32; color: #fff; }
.map-tool-btn.danger { background: #b71c1c; color: #fff; }

.color-picker-row {
  display: flex;
  gap: 4px;
  background: #0f1325;
  padding: 4px 8px;
  border-radius: 6px;
}

.color-dot {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
}

.color-dot.active {
  border-color: #fff;
  transform: scale(1.2);
}

.stamp-select-btn {
  padding: 4px 8px;
  background: #181d36;
  border: 1px solid #2f3863;
  color: #cfd8dc;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
}

.stamp-select-btn.active {
  background: #ffd700;
  color: #111;
}

.galaxy-tip {
  font-size: 12px;
  color: #9fa8da;
}

/* 2D 画布视口 */
.worldmap-viewport {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: #161928;
}

.map-canvas-plane {
  position: absolute;
  width: 3600px;
  height: 2400px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.7);
}

.map-drawing-layer, .map-route-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.placed-landmark-pin {
  position: absolute;
  transform: translate(-50%, -100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: move;
  z-index: 10;
}

.pin-icon-wrap {
  width: 36px;
  height: 36px;
  background: rgba(26, 29, 45, 0.95);
  border: 2px solid #ffd700;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  box-shadow: 0 4px 10px rgba(0,0,0,0.5);
}

.pin-label {
  margin-top: 4px;
  background: rgba(0, 0, 0, 0.85);
  color: #fff;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  border: 1px solid #ffd700;
  white-space: nowrap;
}

.pin-del-btn {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #b71c1c;
  color: #fff;
  border: none;
  cursor: pointer;
}

.zoom-controls-hud {
  position: absolute;
  bottom: 20px;
  right: 20px;
  display: flex;
  flex-direction: column;
  background: rgba(26, 29, 45, 0.9);
  border: 1px solid #3d466b;
  border-radius: 8px;
  padding: 4px;
  gap: 4px;
  z-index: 15;
}

.hud-btn {
  width: 32px;
  height: 32px;
  background: #1e2235;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.hud-scale {
  text-align: center;
  font-size: 11px;
  color: #ffd700;
  padding: 2px 0;
}

/* 3D WebGL 视口 */
.worldmap-3d-viewport {
  flex: 1;
  position: relative;
  width: 100%;
  height: 100%;
  background: radial-gradient(circle at center, #080d24 0%, #03040a 100%);
}

.three-container {
  width: 100%;
  height: 100%;
}

/* 底部全息导航药丸栏 (Bottom HUD) */
.galaxy-bottom-hud {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  background: rgba(10, 14, 30, 0.85);
  border: 1px solid rgba(83, 109, 254, 0.4);
  padding: 8px 16px;
  border-radius: 30px;
  backdrop-filter: blur(12px);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.8), 0 0 20px rgba(48, 63, 159, 0.3);
  z-index: 25;
}

.hud-cluster-title {
  font-size: 11px;
  font-family: monospace;
  color: #8c9eff;
  letter-spacing: 1px;
}

.hud-star-buttons {
  display: flex;
  gap: 6px;
}

.hud-star-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: rgba(24, 30, 60, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  color: #cfd8dc;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.hud-star-pill:hover {
  background: rgba(48, 63, 159, 0.8);
  border-color: #ffd700;
  color: #fff;
  transform: translateY(-2px);
}

.hud-star-pill.active {
  background: #3949ab;
  border-color: #ffd700;
  color: #fff;
  box-shadow: 0 0 12px rgba(255, 215, 0, 0.5);
}

.hud-star-pill.current {
  border-color: #ab47bc;
  box-shadow: 0 0 10px rgba(171, 71, 188, 0.6);
}

.pill-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.pill-name {
  font-weight: bold;
}

.pill-loc {
  font-size: 10px;
  color: #90caf9;
}

/* 3D 悬浮密档卡片 */
.planet-dossier-card {
  position: absolute;
  top: 24px;
  right: 24px;
  width: 380px;
  background: rgba(10, 14, 30, 0.95);
  border: 1px solid #7b1fa2;
  border-radius: 12px;
  box-shadow: 0 15px 50px rgba(0, 0, 0, 0.9), 0 0 25px rgba(170, 0, 255, 0.4);
  backdrop-filter: blur(16px);
  color: #e0e0e0;
  z-index: 30;
  overflow: hidden;
}

.card-header {
  padding: 14px 16px;
  background: linear-gradient(135deg, rgba(123, 31, 162, 0.4), rgba(48, 63, 159, 0.4));
  border-bottom: 2px solid #7b1fa2;
  display: flex;
  align-items: center;
  position: relative;
}

.star-badge {
  font-size: 12px;
  color: #000;
  font-weight: bold;
  padding: 2px 8px;
  border-radius: 4px;
  margin-right: 8px;
  box-shadow: 0 0 8px currentColor;
}

.planet-title {
  margin: 0;
  font-size: 16px;
  color: #fff;
}

.close-card-btn {
  margin-left: auto;
  background: transparent;
  border: none;
  color: #aaa;
  font-size: 20px;
  cursor: pointer;
}

.card-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 13px;
}

.dossier-row {
  display: flex;
}

.dossier-row .label {
  color: #8c9eff;
  width: 90px;
  flex-shrink: 0;
}

.dossier-row .val {
  color: #fff;
  word-break: break-all;
}

.dossier-row .val.highlight {
  font-weight: bold;
}

.dossier-row .val.danger {
  color: #ff5252;
}

.dossier-row .val.mono {
  font-family: monospace;
  color: #69f0ae;
}

.dossier-desc {
  margin-top: 6px;
  padding-top: 10px;
  border-top: 1px dashed rgba(255, 255, 255, 0.15);
  font-size: 12px;
  line-height: 1.6;
  color: #b0bec5;
}

.dossier-actions {
  margin-top: 8px;
  display: flex;
  justify-content: flex-end;
}

.dossier-btn {
  padding: 6px 14px;
  background: linear-gradient(135deg, #7b1fa2, #303f9f);
  color: #fff;
  border: 1px solid #ab47bc;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 0 10px rgba(171, 71, 188, 0.5);
}

.dossier-btn:hover {
  background: linear-gradient(135deg, #9c27b0, #3f51b5);
  box-shadow: 0 0 15px rgba(171, 71, 188, 0.8);
  transform: scale(1.05);
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s, transform 0.3s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
