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
          🗺️ 2D 手绘地图
        </button>
        <button
          class="map-tool-btn mode-btn galaxy-btn"
          :class="{ active: viewMode === '3d' }"
          @click="switchViewMode('3d')"
          title="切换至 3D 华夏北斗天体星系图谱 (NEST-DRAMA 宇宙视角)"
        >
          🌌 3D 北斗星系图
        </button>
      </div>

      <!-- 2D 专属绘图工具 -->
      <template v-if="viewMode === '2d'">
        <div class="tool-group">
          <button
            class="map-tool-btn"
            :class="{ active: currentTool === 'brush' }"
            @click="currentTool = 'brush'"
            title="画笔工具 (在画布上手绘地图、山脉、河流)"
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

        <!-- 笔刷调色盘 -->
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

        <!-- 地标选择 -->
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

        <div class="tool-group map-actions-right">
          <button class="map-tool-btn" @click="undo" :disabled="historyStack.length === 0" title="撤销">↩️ 撤销</button>
          <button class="map-tool-btn danger" @click="clearAll" title="清空画板">🗑️ 清空画板</button>
          <button class="map-tool-btn highlight" @click="exportMapImage" title="导出地图">💾 导出地图</button>
        </div>
      </template>

      <!-- 3D 专属控制工具 -->
      <template v-else>
        <div class="tool-group">
          <button class="map-tool-btn" :class="{ active: autoRotate3D }" @click="toggleAutoRotate">
            {{ autoRotate3D ? '⏸️ 暂停自转' : '▶️ 宇宙自转' }}
          </button>
          <button class="map-tool-btn" @click="resetCamera3D" title="重置视角">
            🎯 重置视角
          </button>
          <button class="map-tool-btn" @click="focusCurrentVolumeStar" title="定位到当前第二卷（天璇星）">
            ⭐ 聚焦第二卷（梵净山）
          </button>
        </div>
        <div class="tool-group map-actions-right">
          <span class="galaxy-tip">💡 拖拽旋转视角 / 滚轮缩放 / 点击星球查看密档</span>
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
            title="删除地标"
          >
            ×
          </button>
        </div>
      </div>

      <div class="zoom-controls-hud">
        <button class="hud-btn" @click="zoomIn" title="放大">+</button>
        <div class="hud-scale">{{ Math.round(zoom * 100) }}%</div>
        <button class="hud-btn" @click="zoomOut" title="缩小">-</button>
        <button class="hud-btn" @click="resetView" title="重置">⟲</button>
      </div>
    </div>

    <!-- 3D 宇宙天体星系视口 (Three.js WebGL) -->
    <div v-show="viewMode === '3d'" class="worldmap-3d-viewport">
      <div ref="threeCanvasRef" class="three-container"></div>

      <!-- 星球详情信息浮层 (HUD) -->
      <transition name="fade">
        <div v-if="selectedPlanet" class="planet-dossier-card">
          <div class="card-header">
            <span class="star-badge">{{ selectedPlanet.starName }}</span>
            <h3 class="planet-title">{{ selectedPlanet.name }}</h3>
            <button class="close-card-btn" @click="selectedPlanet = null">×</button>
          </div>
          <div class="card-body">
            <div class="dossier-row">
              <span class="label">📍 坐标位置：</span>
              <span class="val">{{ selectedPlanet.location }}</span>
            </div>
            <div class="dossier-row">
              <span class="label">📖 对应分卷：</span>
              <span class="val highlight">{{ selectedPlanet.volume }}</span>
            </div>
            <div class="dossier-row">
              <span class="label">🌐 经纬数据：</span>
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
const viewMode = ref<'2d' | '3d'>('2d');

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

// ─── 3D 宇宙星系状态 ─────────────────────────────────────────────────────
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
  size: number;
  position: [number, number, number];
  marvel: string;
  hazard: string;
  desc: string;
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
    size: 2.2,
    position: [0, 0, 0],
    marvel: '楚风文化工作室、2004时代市井、线索中枢',
    hazard: '贾老板等黑恶同行竞争与阴谋刺探',
    desc: '杨涛、胖子与刘菲的大本营，承接全国各地奇闻异事，所有地下探险的起点与归宿。'
  },
  {
    id: 'star1',
    name: '湖南郴州 · 骑田岭',
    starName: '⭐ 天枢星',
    volume: '第一卷：湘南溶洞 (已通关)',
    location: '湖南省郴州市苏仙区骑田岭深山712矿区',
    coords: [112.905, 25.639],
    color: 0x00e5ff,
    size: 1.6,
    position: [12, -4, 5],
    marvel: '712废弃矿道、40米螺旋石筒、地下九层木楼',
    hazard: '石脸虫、水龙骨致幻花、地下暗河水脉决堤',
    desc: '第一座走马楼（天枢木楼）沉埋之地，已被声波共振暗河大暴发冲垮，带回6万酬金与夜郎木杯。'
  },
  {
    id: 'star2',
    name: '贵州铜仁 · 梵净山',
    starName: '⭐ 天璇星 (🔥 当前征途)',
    volume: '第二卷：黔东天坑 (正在进行)',
    location: '贵州省铜仁地区梵净山西麓落水寨',
    coords: [108.694, 27.915],
    color: 0xaa00ff,
    size: 1.8,
    position: [-10, 8, 14],
    marvel: '千米垂直绝壁天坑、四根青铜玄铁索倒悬九层水月楼',
    hazard: '深潭盲眼水鳞蟒、水银重力天平失衡、突发高山暴雨山洪',
    desc: '第二座走马楼（天璇倒悬水月楼）。凭借门缝下的三重复合摩斯密信破译而来，已购置军绿吉普212整装出征！'
  },
  {
    id: 'star3',
    name: '湖北宜昌 · 神农架',
    starName: '⭐ 天玑星',
    volume: '第三卷：华中冰窟',
    location: '湖北省西部神农架原始林区与三峡地缝',
    coords: [110.49, 31.74],
    color: 0x2979ff,
    size: 1.5,
    position: [-16, 18, 8],
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
    color: 0x00e676,
    size: 1.5,
    position: [6, 24, 0],
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
    color: 0xffd600,
    size: 1.6,
    position: [16, 32, -8],
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
    color: 0xff3d00,
    size: 1.5,
    position: [12, 42, -18],
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
    size: 2.0,
    position: [22, 54, -28],
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
let constellationLine: THREE.Line | null = null;

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

// ─── 初始化 3D 宇宙星系 ───────────────────────────────────────────────────
function initThreeScene() {
  if (!threeCanvasRef.value) return;
  cleanupThreeScene();

  const width = threeCanvasRef.value.clientWidth || 1000;
  const height = threeCanvasRef.value.clientHeight || 700;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x060814);
  scene.fog = new THREE.FogExp2(0x060814, 0.008);

  camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
  camera.position.set(0, 25, 75);
  camera.lookAt(0, 20, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  threeCanvasRef.value.appendChild(renderer.domElement);

  // 1. 璀璨星空背景粒子
  const starGeo = new THREE.BufferGeometry();
  const starCount = 3000;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount * 3; i += 3) {
    starPos[i] = (Math.random() - 0.5) * 400;
    starPos[i + 1] = (Math.random() - 0.5) * 400;
    starPos[i + 2] = (Math.random() - 0.5) * 400;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0x88bbff, size: 0.8, transparent: true, opacity: 0.8 });
  const starField = new THREE.Points(starGeo, starMat);
  scene.add(starField);

  // 2. 环境光与点光源
  const ambientLight = new THREE.AmbientLight(0x404060, 2.5);
  scene.add(ambientLight);

  const sunLight = new THREE.PointLight(0xffaa00, 3, 100);
  sunLight.position.set(0, 0, 0);
  scene.add(sunLight);

  // 3. 构建北斗七星与长沙核心天体星球
  planetMeshes = [];
  const pointsForLine: THREE.Vector3[] = [];

  sevenStarsPlanets.forEach((p) => {
    const geo = new THREE.SphereGeometry(p.size, 32, 32);
    const mat = new THREE.MeshStandardMaterial({
      color: p.color,
      emissive: p.color,
      emissiveIntensity: p.id === 'star2' ? 0.8 : (p.id === 'core' ? 0.9 : 0.4),
      roughness: 0.3,
      metalness: 0.2
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...p.position);
    mesh.userData = p;
    scene?.add(mesh);
    planetMeshes.push(mesh);

    // 发光光晕光圈
    const ringGeo = new THREE.RingGeometry(p.size * 1.3, p.size * 1.5, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: p.color, side: THREE.DoubleSide, transparent: true, opacity: 0.4 });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2;
    mesh.add(ringMesh);

    // 记录连线点 (跳过中心核心，纯连七星)
    if (p.id !== 'core') {
      pointsForLine.push(new THREE.Vector3(...p.position));
    }
  });

  // 4. 北斗七星发光星座连线
  if (pointsForLine.length > 1) {
    const lineGeo = new THREE.BufferGeometry().setFromPoints(pointsForLine);
    const lineMat = new THREE.LineBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.85, linewidth: 2 });
    const line = new THREE.Line(lineGeo, lineMat);
    scene.add(line);
    constellationLine = line;
  }

  // 5. 交互：鼠标拖拽与射线拾取
  setup3DInteraction();

  // 6. 渲染循环
  function animate() {
    animFrameId = requestAnimationFrame(animate);
    if (autoRotate3D.value && scene) {
      scene.rotation.y += 0.0015;
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
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging || !scene || !camera) return;
    const deltaX = e.clientX - prevMouseX;
    const deltaY = e.clientY - prevMouseY;
    prevMouseX = e.clientX;
    prevMouseY = e.clientY;

    scene.rotation.y += deltaX * 0.005;
    camera.position.y = Math.max(-20, Math.min(80, camera.position.y - deltaY * 0.15));
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
  });

  dom.addEventListener('wheel', (e) => {
    if (!camera) return;
    camera.position.z = Math.max(15, Math.min(180, camera.position.z + e.deltaY * 0.05));
  });

  // 点击拾取星球
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
    }
  });
}

function toggleAutoRotate() {
  autoRotate3D.value = !autoRotate3D.value;
}

function resetCamera3D() {
  if (camera && scene) {
    camera.position.set(0, 25, 75);
    scene.rotation.set(0, 0, 0);
  }
}

function focusCurrentVolumeStar() {
  // 聚焦第二卷（梵净山天璇星）
  const star2 = sevenStarsPlanets.find(p => p.id === 'star2');
  if (star2) {
    selectedPlanet.value = star2;
    if (camera && scene) {
      camera.position.set(star2.position[0], star2.position[1] + 5, star2.position[2] + 18);
      scene.rotation.y = 0;
    }
  }
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

  // 浅色羊皮纸背景
  ctx.fillStyle = '#f8f4eb';
  ctx.fillRect(0, 0, dCanvas.width, dCanvas.height);

  // 极浅网格
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
  background: #111420;
  position: relative;
  overflow: hidden;
  user-select: none;
}

/* 工具栏 */
.worldmap-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  background: #1a1d2d;
  border-bottom: 1px solid #2d334d;
  z-index: 20;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.mode-toggle-group {
  background: #0f111c;
  padding: 3px;
  border-radius: 8px;
  border: 1px solid #3d466b;
}

.mode-btn {
  font-weight: bold;
  border-radius: 6px !important;
}

.mode-btn.galaxy-btn.active {
  background: linear-gradient(135deg, #7b1fa2, #303f9f) !important;
  box-shadow: 0 0 12px rgba(170, 0, 255, 0.6);
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
  background: #252a3f;
  color: #cfd8dc;
  border: 1px solid #3a4260;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.map-tool-btn:hover {
  background: #333a56;
  border-color: #ffd700;
  color: #fff;
}

.map-tool-btn.active {
  background: #ffd700;
  color: #111;
  border-color: #ffd700;
  font-weight: bold;
}

.map-tool-btn.highlight {
  background: #2e7d32;
  color: #fff;
}

.map-tool-btn.danger {
  background: #b71c1c;
  color: #fff;
}

.color-picker-row {
  display: flex;
  gap: 4px;
  background: #111420;
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
  background: #1e2235;
  border: 1px solid #333a56;
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
  border-color: #ffd700;
}

.galaxy-tip {
  font-size: 12px;
  color: #90caf9;
}

/* 2D 画布 */
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
}

.three-container {
  width: 100%;
  height: 100%;
}

/* 3D 悬浮密档卡片 */
.planet-dossier-card {
  position: absolute;
  top: 24px;
  right: 24px;
  width: 380px;
  background: rgba(16, 20, 36, 0.95);
  border: 1px solid #7b1fa2;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8), 0 0 20px rgba(170, 0, 255, 0.3);
  backdrop-filter: blur(10px);
  color: #e0e0e0;
  z-index: 30;
  overflow: hidden;
}

.card-header {
  padding: 14px 16px;
  background: linear-gradient(135deg, rgba(123, 31, 162, 0.4), rgba(48, 63, 159, 0.4));
  border-bottom: 1px solid rgba(170, 0, 255, 0.3);
  display: flex;
  align-items: center;
  position: relative;
}

.star-badge {
  font-size: 12px;
  background: #ffaa00;
  color: #000;
  font-weight: bold;
  padding: 2px 6px;
  border-radius: 4px;
  margin-right: 8px;
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
  color: #90caf9;
  width: 90px;
  flex-shrink: 0;
}

.dossier-row .val {
  color: #fff;
  word-break: break-all;
}

.dossier-row .val.highlight {
  color: #ffd700;
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

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s, transform 0.3s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
