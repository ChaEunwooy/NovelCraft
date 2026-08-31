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
          title="切换至 3D 角色星丛天体模拟器 (NEST-DRAMA 原生 3D 星丛)"
        >
          🌌 3D 角色星丛天体
        </button>
      </div>

      <!-- 2D 专属绘图工具 -->
      <template v-if="viewMode === '2d'">
        <div class="tool-group">
          <button class="map-tool-btn" :class="{ active: currentTool === 'brush' }" @click="currentTool = 'brush'">🖌️ 笔刷</button>
          <button class="map-tool-btn" :class="{ active: currentTool === 'eraser' }" @click="currentTool = 'eraser'">🧹 橡皮</button>
          <button class="map-tool-btn" :class="{ active: currentTool === 'stamp' }" @click="currentTool = 'stamp'">📍 放置地标</button>
          <button class="map-tool-btn" :class="{ active: currentTool === 'route' }" @click="currentTool = 'route'">🚩 绘制路线</button>
          <button class="map-tool-btn" :class="{ active: currentTool === 'pan' }" @click="currentTool = 'pan'">✋ 漫游</button>
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
            {{ autoRotate3D ? '⏸️ 暂停旋转' : '▶️ 宇宙推演' }}
          </button>
          <button class="map-tool-btn sci-btn" @click="resetCamera3D">
            🎯 居中全景
          </button>
          <button class="map-tool-btn sci-btn glow-purple" @click="focusNodeByName('梵净山·落水寨')">
            ⭐ 锁定第二卷：梵净山
          </button>
        </div>
        <div class="tool-group map-actions-right">
          <span class="galaxy-tip">🌌 NEST-DRAMA 3D 角色星丛 · 拖拽旋转 / 滚轮缩放 / 点击星球锁定实体</span>
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

    <!-- 3D NEST-DRAMA 原生星丛天体视口 (Three.js WebGL) -->
    <div v-show="viewMode === '3d'" class="worldmap-3d-viewport">
      <div ref="threeCanvasRef" class="three-container"></div>

      <!-- 底部星系过滤与快速定位 HUD -->
      <div class="galaxy-bottom-hud">
        <div class="hud-cluster-title">🌌 NEST-DRAMA 3D 角色星系推演场 (3D STAR CLUSTER)</div>
        <div class="hud-star-buttons">
          <button
            v-for="cat in categoryList"
            :key="cat.type"
            class="hud-star-pill"
            :class="{ active: activeCategory === cat.type }"
            @click="filterCategory(cat.type)"
          >
            <span class="pill-dot" :style="{ background: cat.color, boxShadow: `0 0 8px ${cat.color}` }"></span>
            <span class="pill-name">{{ cat.name }}</span>
            <span class="pill-loc">{{ cat.count }}个节点</span>
          </button>
        </div>
      </div>

      <!-- 星球详情信息浮层 (HUD) -->
      <transition name="fade">
        <div v-if="selectedNode" class="planet-dossier-card">
          <div class="card-header" :style="{ borderBottomColor: selectedNode.colorHex }">
            <span class="star-badge" :style="{ background: selectedNode.colorHex }">{{ selectedNode.category }}</span>
            <h3 class="planet-title">{{ selectedNode.name }}</h3>
            <button class="close-card-btn" @click="selectedNode = null">×</button>
          </div>
          <div class="card-body">
            <div class="dossier-row">
              <span class="label">🏷️ 角色身份：</span>
              <span class="val highlight" :style="{ color: selectedNode.colorHex }">{{ selectedNode.role }}</span>
            </div>
            <div class="dossier-row">
              <span class="label">📍 所属阵营：</span>
              <span class="val">{{ selectedNode.faction }}</span>
            </div>
            <div class="dossier-row">
              <span class="label">💫 轨道参数：</span>
              <span class="val mono">半径 {{ selectedNode.orbitRadius.toFixed(1) }} AU / 倾角 {{ (selectedNode.tiltX * 57.3).toFixed(1) }}°</span>
            </div>
            <div class="dossier-desc">
              {{ selectedNode.desc }}
            </div>
            <div class="dossier-actions">
              <button class="dossier-btn" @click="focusNode(selectedNode)">
                🚀 锁定此节点
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

// ─── 3D NEST-DRAMA 星丛数据结构 ──────────────────────────────────────────
const threeCanvasRef = ref<HTMLDivElement | null>(null);
const autoRotate3D = ref(true);

interface DramaNode {
  id: string;
  name: string;
  category: '主角团' | '市井对手' | '湘南遗迹' | '黔东天坑' | '七大星位';
  role: string;
  faction: string;
  color: number;
  colorHex: string;
  size: number;
  orbitRadius: number;
  speed: number;
  angle: number;
  tiltX: number;
  tiltY: number;
  tiltZ: number;
  desc: string;
}

const dramaNodes: DramaNode[] = [
  // 核心主角团 (内圈高亮轨道)
  {
    id: 'yt',
    name: '杨涛',
    category: '主角团',
    role: '楚风文化主编 / 工科智囊',
    faction: '走马楼大本营',
    color: 0x64b5f6,
    colorHex: '#64b5f6',
    size: 1.4,
    orbitRadius: 10,
    speed: 0.008,
    angle: 0.2,
    tiltX: 0.3,
    tiltY: 0.1,
    tiltZ: 0.2,
    desc: '故事第一人称主角。24岁，精通物理力学、周易八卦与工程密码学，冷静睿智。'
  },
  {
    id: 'pz',
    name: '胖子 · 邓杰',
    category: '主角团',
    role: '发小兄弟 / 武力坦克',
    faction: '走马楼大本营',
    color: 0xffb74d,
    colorHex: '#ffb74d',
    size: 1.6,
    orbitRadius: 13,
    speed: 0.006,
    angle: 1.8,
    tiltX: -0.4,
    tiltY: 0.5,
    tiltZ: -0.2,
    desc: '200斤体格，精通近身搏击，讲江湖义气，爱财嘴碎但绝不掉链子。'
  },
  {
    id: 'lf',
    name: '刘菲',
    category: '主角团',
    role: '工作室前台 / 后勤管家',
    faction: '走马楼大本营',
    color: 0xf06292,
    colorHex: '#f06292',
    size: 1.2,
    orbitRadius: 16,
    speed: 0.005,
    angle: 3.4,
    tiltX: 0.5,
    tiltY: -0.3,
    tiltZ: 0.4,
    desc: '长沙本地大学生，负责整理稿件、接听读者热线与账目核算，工作室的现实烟火锚点。'
  },

  // 长沙市井对手与帮手 (中内圈)
  {
    id: 'jtm',
    name: '贾天明 (贾秃子)',
    category: '市井对手',
    role: '博雅书业老板 / 垄断书商',
    faction: '长沙出版恶霸',
    color: 0xe57373,
    colorHex: '#e57373',
    size: 1.3,
    orbitRadius: 20,
    speed: -0.004,
    angle: 0.8,
    tiltX: -0.6,
    tiltY: 0.2,
    tiltZ: 0.5,
    desc: '开桑塔纳2000的大书商，妄图低价吞并楚风文化，被两万现钞当街打脸后暗中伺机报复。'
  },
  {
    id: 'hp',
    name: '黑皮哥',
    category: '主角团',
    role: '南门口汽修厂大哥',
    faction: '胖子发小铁哥们',
    color: 0x4dd0e1,
    colorHex: '#4dd0e1',
    size: 1.3,
    orbitRadius: 22,
    speed: 0.005,
    angle: 4.5,
    tiltX: 0.2,
    tiltY: 0.7,
    tiltZ: -0.4,
    desc: '南门口汽修厂硬茬，受胖子长途电话委托，带十几个弟兄在走马楼关门暴打贾秃子。'
  },

  // 第一卷湘南溶洞遗迹 (中圈)
  {
    id: 'lz',
    name: '周表叔',
    category: '湘南遗迹',
    role: '郴州老矿区工程承包商',
    faction: '湘南矿山',
    color: 0xa1887f,
    colorHex: '#a1887f',
    size: 1.2,
    orbitRadius: 25,
    speed: 0.003,
    angle: 2.2,
    tiltX: 0.8,
    tiltY: -0.4,
    tiltZ: 0.1,
    desc: '胖子表叔，因风钻打穿老水泥封门连通地下黑空洞，邀请主角团前往勘察。'
  },
  {
    id: 'ljz',
    name: '刘瘸子',
    category: '湘南遗迹',
    role: '郴州黑矿头目',
    faction: '湘南地头蛇',
    color: 0xff8a65,
    colorHex: '#ff8a65',
    size: 1.2,
    orbitRadius: 28,
    speed: -0.003,
    angle: 5.1,
    tiltX: -0.3,
    tiltY: -0.6,
    tiltZ: 0.6,
    desc: '开黑矿企图独占地下矿脉，身陷虫窟被杨涛胖子救出后，仗义拿出4万块感谢费。'
  },
  {
    id: 'cjg',
    name: '陈建国',
    category: '湘南遗迹',
    role: '1977地质七分队队长',
    faction: '历史科考队',
    color: 0x90a4ae,
    colorHex: '#90a4ae',
    size: 1.1,
    orbitRadius: 30,
    speed: 0.002,
    angle: 1.1,
    tiltX: 0.4,
    tiltY: 0.8,
    tiltZ: -0.5,
    desc: '绝笔日记作者，揭开70年代科考队因贪念与致幻花在九层木楼全军覆没的真相。'
  },
  {
    id: 'slc',
    name: '石脸虫',
    category: '湘南遗迹',
    role: '背生扭曲人脸剧毒古生物',
    faction: '地下盲谷凶煞',
    color: 0xef5350,
    colorHex: '#ef5350',
    size: 1.0,
    orbitRadius: 32,
    speed: 0.004,
    angle: 3.9,
    tiltX: -0.7,
    tiltY: 0.1,
    tiltZ: -0.3,
    desc: '白墙密布的肉食人面毒虫，四瓣裂口，对体温与强光极度敏感。'
  },
  {
    id: 'slg',
    name: '水龙骨水车',
    category: '湘南遗迹',
    role: '暗河驱动青铜齿轮组',
    faction: '先秦地下工巧',
    color: 0x81c784,
    colorHex: '#81c784',
    size: 1.1,
    orbitRadius: 34,
    speed: -0.002,
    angle: 0.5,
    tiltX: 0.6,
    tiltY: -0.5,
    tiltZ: 0.3,
    desc: '利用暗河落差驱动的千斤石门升降机械，连通40米螺旋石阶。'
  },

  // 第二卷黔东天坑关键实体 (中外圈)
  {
    id: 'jp',
    name: '军绿吉普212',
    category: '黔东天坑',
    role: '退役四驱硬汉座驾',
    faction: '主角团装备',
    color: 0x4caf50,
    colorHex: '#4caf50',
    size: 1.4,
    orbitRadius: 37,
    speed: 0.003,
    angle: 4.8,
    tiltX: -0.5,
    tiltY: 0.6,
    tiltZ: -0.1,
    desc: '花两万现金全款拿下的部队退役吉普，加装20L防爆铁油桶与钢丝绞盘，自驾出征贵州。'
  },
  {
    id: 'mb',
    name: '夜郎青铜古匙',
    category: '黔东天坑',
    role: '镂空透雕双头水虺信物',
    faction: '古夜郎秘宝',
    color: 0xffd54f,
    colorHex: '#ffd54f',
    size: 1.2,
    orbitRadius: 39,
    speed: 0.0025,
    angle: 2.7,
    tiltX: 0.3,
    tiltY: -0.7,
    tiltZ: 0.4,
    desc: '郴州地摊木杯热开水烫化蜂蜡后脱落的古夜郎钥匙，与第二座悬空水月楼暗槽吻合。'
  },
  {
    id: 'gh',
    name: '神秘寄信人',
    category: '黔东天坑',
    role: '“故人之后” / 密信引路人',
    faction: '未知隐秘势力',
    color: 0xce93d8,
    colorHex: '#ce93d8',
    size: 1.3,
    orbitRadius: 42,
    speed: -0.002,
    angle: 1.5,
    tiltX: -0.8,
    tiltY: -0.2,
    tiltZ: 0.7,
    desc: '清晨在门缝塞进朱砂蜡封摩斯密信的神秘高手，掌握七大古楼全景坐标。'
  },
  {
    id: 'fjs',
    name: '梵净山·落水寨',
    category: '黔东天坑',
    role: '第二卷千米天坑绝境',
    faction: '天璇星位',
    color: 0xab47bc,
    colorHex: '#ab47bc',
    size: 1.7,
    orbitRadius: 45,
    speed: 0.0018,
    angle: 3.1,
    tiltX: 0.4,
    tiltY: 0.5,
    tiltZ: -0.6,
    desc: '贵州铜仁梵净山西麓原始保护区深处，藏有四根青铜巨索倒悬的九层水月楼。'
  },

  // 华夏北斗七星总阵列 (外层宏观轨道)
  {
    id: 'star1_node',
    name: '天枢 · 郴州骑田岭',
    category: '七大星位',
    role: '第一卷已通关',
    faction: '北斗龙脊',
    color: 0x00e5ff,
    colorHex: '#00e5ff',
    size: 1.5,
    orbitRadius: 48,
    speed: 0.0015,
    angle: 0.3,
    tiltX: 0.6,
    tiltY: 0.3,
    tiltZ: 0.2,
    desc: '北斗第一星：712废弃矿道、40米螺旋石筒与地下九层木楼。'
  },
  {
    id: 'star2_node',
    name: '天璇 · 贵州梵净山',
    category: '七大星位',
    role: '第二卷正在进行',
    faction: '北斗龙脊',
    color: 0xba68c8,
    colorHex: '#ba68c8',
    size: 1.6,
    orbitRadius: 51,
    speed: 0.0013,
    angle: 1.2,
    tiltX: -0.5,
    tiltY: 0.7,
    tiltZ: -0.3,
    desc: '北斗第二星：千米天坑倒悬水月楼，盲眼水鳞蟒与水银重力天平。'
  },
  {
    id: 'star3_node',
    name: '天玑 · 湖北神农架',
    category: '七大星位',
    role: '第三卷华中冰窟',
    faction: '北斗龙脊',
    color: 0x42a5f5,
    colorHex: '#42a5f5',
    size: 1.4,
    orbitRadius: 54,
    speed: 0.0012,
    angle: 2.1,
    tiltX: 0.7,
    tiltY: -0.6,
    tiltZ: 0.1,
    desc: '北斗第三星：华中屋脊万年地下冰洞与三峡绝壁巴人悬棺。'
  },
  {
    id: 'star4_node',
    name: '天权 · 安徽大别山',
    category: '七大星位',
    role: '第四卷淮上石宫',
    faction: '北斗龙脊',
    color: 0x66bb6a,
    colorHex: '#66bb6a',
    size: 1.4,
    orbitRadius: 57,
    speed: 0.0011,
    angle: 3.0,
    tiltX: -0.4,
    tiltY: -0.4,
    tiltZ: 0.8,
    desc: '北斗第四星：斗勺枢纽，白垩纪花岗岩巨型石窟与天然磁场机关。'
  },
  {
    id: 'star5_node',
    name: '玉衡 · 山东泰山',
    category: '七大星位',
    role: '第五卷东岳封禅',
    faction: '北斗龙脊',
    color: 0xffca28,
    colorHex: '#ffca28',
    size: 1.5,
    orbitRadius: 60,
    speed: 0.0010,
    angle: 3.9,
    tiltX: 0.8,
    tiltY: 0.2,
    tiltZ: -0.4,
    desc: '北斗第五星：始皇帝封禅玉简地宫与泰山石敢当阵法。'
  },
  {
    id: 'star6_node',
    name: '开阳 · 河北燕山',
    category: '七大星位',
    role: '第六卷燕山要塞',
    faction: '北斗龙脊',
    color: 0xff7043,
    colorHex: '#ff7043',
    size: 1.4,
    orbitRadius: 63,
    speed: 0.0009,
    angle: 4.8,
    tiltX: -0.6,
    tiltY: 0.5,
    tiltZ: 0.2,
    desc: '北斗第六星：古长城绝壁地底古代军事屯兵防空要塞。'
  },
  {
    id: 'star7_node',
    name: '摇光 · 内蒙大兴安岭',
    category: '七大星位',
    role: '第七卷极北龙首',
    faction: '北斗龙脊',
    color: 0xffffff,
    colorHex: '#ffffff',
    size: 1.8,
    orbitRadius: 66,
    speed: 0.0008,
    angle: 5.7,
    tiltX: 0.3,
    tiltY: -0.8,
    tiltZ: 0.5,
    desc: '北斗第七星：红山文化太阳神龙玉神坛与死火山熔岩隧道大结局。'
  }
];

const categoryList = [
  { type: 'all', name: '全部星丛', color: '#90caf9', count: dramaNodes.length },
  { type: '主角团', name: '走马楼主角团', color: '#64b5f6', count: 4 },
  { type: '市井对手', name: '市井势力', color: '#e57373', count: 1 },
  { type: '湘南遗迹', name: '第一卷遗存', color: '#81c784', count: 5 },
  { type: '黔东天坑', name: '第二卷当前', color: '#ab47bc', count: 4 },
  { type: '七大星位', name: '北斗大阵', color: '#ffd700', count: 7 }
];
const activeCategory = ref('all');

const selectedNode = ref<DramaNode | null>(null);

let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let renderer: THREE.WebGLRenderer | null = null;
let animFrameId = 0;
let nodeMeshMap: Map<string, { mesh: THREE.Mesh; orbitGroup: THREE.Group; node: DramaNode }> = new Map();
let targetCameraPos: THREE.Vector3 | null = null;
let targetLookAt: THREE.Vector3 = new THREE.Vector3(0, 0, 0);

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

// ─── 动态生成 3D 悬浮极简科技文字标签 ─────────────────────────────────────────
function createHoloBadgeSprite(name: string, role: string, colorHex: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 80;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Sprite();

  // 极简全息深蓝暗底
  ctx.fillStyle = 'rgba(6, 10, 24, 0.85)';
  ctx.strokeStyle = colorHex;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(4, 4, 248, 72, 8);
  ctx.fill();
  ctx.stroke();

  // 节点名称
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(name, 128, 34);

  // 身份副标
  ctx.fillStyle = colorHex;
  ctx.font = '14px monospace';
  ctx.fillText(role, 128, 60);

  const texture = new THREE.CanvasTexture(canvas);
  const spriteMat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(6, 1.88, 1);
  return sprite;
}

// ─── 动态发光太阳日冕贴图 ─────────────────────────────────────────────────
function createSunGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Texture();

  const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, 'rgba(255, 200, 50, 1.0)');
  gradient.addColorStop(0.25, 'rgba(255, 140, 0, 0.8)');
  gradient.addColorStop(0.6, 'rgba(255, 60, 0, 0.25)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

// ─── 初始化 NEST-DRAMA 原生 3D 星丛场景 ────────────────────────────────────
function initThreeScene() {
  if (!threeCanvasRef.value) return;
  cleanupThreeScene();

  const width = threeCanvasRef.value.clientWidth || 1200;
  const height = threeCanvasRef.value.clientHeight || 800;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020308);

  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
  camera.position.set(0, 40, 110);
  camera.lookAt(0, 0, 0);
  targetLookAt = new THREE.Vector3(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.4;
  threeCanvasRef.value.appendChild(renderer.domElement);

  // 1. 深空稀疏星点
  const starGeo = new THREE.BufferGeometry();
  const starCount = 3000;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount * 3; i++) {
    starPos[i] = (Math.random() - 0.5) * 800;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0x7986cb, size: 1.0, transparent: true, opacity: 0.7 });
  const starField = new THREE.Points(starGeo, starMat);
  scene.add(starField);

  // 2. 环境光
  const ambientLight = new THREE.AmbientLight(0x303f9f, 2.5);
  scene.add(ambientLight);

  // 3. 中心引力金乌恒星 (【走马楼故事推演总枢】)
  const sunGroup = new THREE.Group();
  scene.add(sunGroup);

  const sunGeo = new THREE.SphereGeometry(3.5, 32, 32);
  const sunMat = new THREE.MeshStandardMaterial({
    color: 0xffd54f,
    emissive: 0xff8f00,
    emissiveIntensity: 1.8,
    roughness: 0.1
  });
  const sunMesh = new THREE.Mesh(sunGeo, sunMat);
  sunGroup.add(sunMesh);

  // 恒星耀斑发光日冕
  const sunGlowMat = new THREE.SpriteMaterial({
    map: createSunGlowTexture(),
    transparent: true,
    blending: THREE.AdditiveBlending,
    opacity: 0.95
  });
  const sunGlowSprite = new THREE.Sprite(sunGlowMat);
  sunGlowSprite.scale.set(18, 18, 1);
  sunGroup.add(sunGlowSprite);

  // 恒星中心光标
  const sunBadge = createHoloBadgeSprite('《走马楼笔记》', '世界推演总枢', '#ffaa00');
  sunBadge.position.set(0, -5.2, 0);
  sunGroup.add(sunBadge);

  const sunLight = new THREE.PointLight(0xffaa00, 5, 200);
  sunGroup.add(sunLight);

  // 4. 构建三维立体多倾角轨道环 (NEST-DRAMA 陀螺仪多能级轨道网)
  nodeMeshMap.clear();

  dramaNodes.forEach((node) => {
    // 每一个实体拥有自己独立的三维空间倾角轨道组
    const orbitGroup = new THREE.Group();
    orbitGroup.rotation.x = node.tiltX;
    orbitGroup.rotation.y = node.tiltY;
    orbitGroup.rotation.z = node.tiltZ;
    scene?.add(orbitGroup);

    // 细发光立体轨道线 (3D Elliptical Orbit Wireframe)
    const curve = new THREE.EllipseCurve(0, 0, node.orbitRadius, node.orbitRadius * 0.95, 0, 2 * Math.PI, false, 0);
    const points = curve.getPoints(128);
    const orbitGeo = new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(p.x, 0, p.y)));
    const orbitMat = new THREE.LineBasicMaterial({
      color: 0x5c6bc0,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending
    });
    const orbitLine = new THREE.Line(orbitGeo, orbitMat);
    orbitGroup.add(orbitLine);

    // 星球本体
    const planetGeo = new THREE.SphereGeometry(node.size, 24, 24);
    const planetMat = new THREE.MeshStandardMaterial({
      color: node.color,
      emissive: node.color,
      emissiveIntensity: 0.6,
      metalness: 0.8,
      roughness: 0.2
    });
    const planetMesh = new THREE.Mesh(planetGeo, planetMat);
    planetMesh.userData = node;
    orbitGroup.add(planetMesh);

    // 全息悬浮文字小标签
    const badgeSprite = createHoloBadgeSprite(node.name, node.role, node.colorHex);
    badgeSprite.position.set(0, node.size + 1.8, 0);
    planetMesh.add(badgeSprite);

    nodeMeshMap.set(node.id, { mesh: planetMesh, orbitGroup, node });
  });

  // 5. 交互设置
  setup3DInteraction();

  // 6. 渲染循环与立体星丛公转
  function animate() {
    animFrameId = requestAnimationFrame(animate);

    // 宇宙慢速自转
    if (autoRotate3D.value && scene && !targetCameraPos) {
      scene.rotation.y += 0.001;
    }

    // 各实体沿自身三维倾角轨道公转
    nodeMeshMap.forEach(({ mesh, node }) => {
      node.angle += node.speed;
      const x = Math.cos(node.angle) * node.orbitRadius;
      const z = Math.sin(node.angle) * (node.orbitRadius * 0.95);
      mesh.position.set(x, 0, z);
    });

    // 镜头平滑插值过渡
    if (targetCameraPos && camera) {
      camera.position.lerp(targetCameraPos, 0.05);
      camera.lookAt(targetLookAt);
      if (camera.position.distanceTo(targetCameraPos) < 0.3) {
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
    targetCameraPos = null;
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging || !scene || !camera) return;
    const deltaX = e.clientX - prevMouseX;
    const deltaY = e.clientY - prevMouseY;
    prevMouseX = e.clientX;
    prevMouseY = e.clientY;

    scene.rotation.y += deltaX * 0.004;
    scene.rotation.x = Math.max(-0.8, Math.min(0.8, scene.rotation.x + deltaY * 0.003));
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
  });

  dom.addEventListener('wheel', (e) => {
    if (!camera) return;
    camera.position.z = Math.max(15, Math.min(220, camera.position.z + e.deltaY * 0.08));
  });

  // 射线点击拾取
  dom.addEventListener('click', (e) => {
    if (!camera || !scene) return;
    const rect = dom.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    const meshes: THREE.Mesh[] = [];
    nodeMeshMap.forEach(v => meshes.push(v.mesh));

    const intersects = raycaster.intersectObjects(meshes);
    if (intersects.length > 0) {
      const hit = intersects[0].object;
      const node = hit.userData as DramaNode;
      selectedNode.value = node;
      focusNode(node);
    }
  });
}

function focusNode(node: DramaNode) {
  selectedNode.value = node;
  const entry = nodeMeshMap.get(node.id);
  if (!entry || !camera) return;

  const worldPos = new THREE.Vector3();
  entry.mesh.getWorldPosition(worldPos);

  targetLookAt = worldPos.clone();
  targetCameraPos = new THREE.Vector3(
    worldPos.x + 12,
    worldPos.y + 8,
    worldPos.z + 18
  );
}

function focusNodeByName(name: string) {
  const n = dramaNodes.find(item => item.name.includes(name));
  if (n) focusNode(n);
}

function filterCategory(cat: string) {
  activeCategory.value = cat;
  nodeMeshMap.forEach(({ mesh, node }) => {
    if (cat === 'all' || node.category === cat) {
      mesh.visible = true;
    } else {
      mesh.visible = false;
    }
  });
}

function toggleAutoRotate() {
  autoRotate3D.value = !autoRotate3D.value;
}

function resetCamera3D() {
  selectedNode.value = null;
  targetLookAt = new THREE.Vector3(0, 0, 0);
  targetCameraPos = new THREE.Vector3(0, 40, 110);
  if (scene) {
    scene.rotation.set(0, 0, 0);
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
  background: #020308;
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
  background: rgba(8, 12, 28, 0.95);
  border-bottom: 1px solid rgba(92, 107, 192, 0.3);
  z-index: 20;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(12px);
}

.mode-toggle-group {
  background: #060814;
  padding: 3px;
  border-radius: 8px;
  border: 1px solid rgba(92, 107, 192, 0.5);
}

.mode-btn {
  font-weight: bold;
  border-radius: 6px !important;
}

.mode-btn.galaxy-btn.active {
  background: linear-gradient(135deg, #3949ab, #1e88e5) !important;
  box-shadow: 0 0 16px rgba(30, 136, 229, 0.8);
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
  background: #10162f;
  color: #cfd8dc;
  border: 1px solid #283593;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.map-tool-btn:hover {
  background: #1a237e;
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
  background: #0d122b;
  border-color: #3f51b5;
  color: #90caf9;
}

.map-tool-btn.sci-btn:hover {
  background: #1a237e;
  box-shadow: 0 0 12px rgba(63, 81, 181, 0.8);
}

.map-tool-btn.glow-purple {
  border-color: #ab47bc;
  color: #e1bee7;
}

.map-tool-btn.glow-purple:hover {
  background: #4a148c;
  box-shadow: 0 0 14px rgba(171, 71, 188, 0.9);
}

.map-tool-btn.highlight { background: #2e7d32; color: #fff; }
.map-tool-btn.danger { background: #b71c1c; color: #fff; }

.color-picker-row {
  display: flex;
  gap: 4px;
  background: #090d1f;
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
  background: #10162f;
  border: 1px solid #283593;
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
  color: #8c9eff;
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
  background: radial-gradient(circle at center, #060a1c 0%, #010206 100%);
}

.three-container {
  width: 100%;
  height: 100%;
}

/* 底部星系过滤 HUD */
.galaxy-bottom-hud {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  background: rgba(8, 12, 28, 0.85);
  border: 1px solid rgba(92, 107, 192, 0.4);
  padding: 8px 18px;
  border-radius: 30px;
  backdrop-filter: blur(14px);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.9), 0 0 25px rgba(48, 63, 159, 0.4);
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
  padding: 5px 12px;
  background: rgba(16, 22, 48, 0.8);
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
  box-shadow: 0 0 14px rgba(255, 215, 0, 0.6);
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
  width: 360px;
  background: rgba(8, 12, 28, 0.95);
  border: 1px solid #3f51b5;
  border-radius: 12px;
  box-shadow: 0 15px 50px rgba(0, 0, 0, 0.9), 0 0 30px rgba(63, 81, 181, 0.4);
  backdrop-filter: blur(16px);
  color: #e0e0e0;
  z-index: 30;
  overflow: hidden;
}

.card-header {
  padding: 14px 16px;
  background: linear-gradient(135deg, rgba(48, 63, 159, 0.4), rgba(123, 31, 162, 0.4));
  border-bottom: 2px solid #3f51b5;
  display: flex;
  align-items: center;
  position: relative;
}

.star-badge {
  font-size: 11px;
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
  background: linear-gradient(135deg, #3949ab, #1e88e5);
  color: #fff;
  border: 1px solid #5c6bc0;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 0 10px rgba(92, 107, 192, 0.5);
}

.dossier-btn:hover {
  background: linear-gradient(135deg, #1e88e5, #00acc1);
  box-shadow: 0 0 15px rgba(0, 172, 193, 0.8);
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
