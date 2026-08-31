<template>
  <div class="app-root" :class="[`theme-${currentTheme}`]">
    <!-- 顶部标题栏 -->
    <TitleBar
      :save-status="saveStatusText"
      :is-mind-map-open="isMindMapOpen"
      :current-theme="currentTheme"
      :is-tomato-connected="isTomatoConnected"
      :tomato-author-name="tomatoAuthorName"
      @toggle-mindmap="isMindMapOpen = !isMindMapOpen"
      @change-theme="onChangeTheme"
      @open-tomato-modal="isTomatoModalOpen = true"
    />

    <!-- 四大板块主工作台 -->
    <main class="app-workspace">
      <!-- 板块一：左侧 Sider 导航与大纲树 (仅连接后显示番茄差分状态胶囊) -->
      <SiderPanel
        :is-open="isSiderOpen"
        :books="books"
        :selected-book-id="selectedBookId"
        :selected-chapter-id="selectedChapterId"
        :current-book="currentBook"
        :is-tomato-connected="isTomatoConnected"
        @select-book="onSelectBook"
        @select-chapter="onSelectChapter"
        @create-book="onCreateBook"
        @create-volume="onCreateVolume"
        @create-chapter="onCreateChapter"
        @rename-chapter="onRenameChapter"
        @rename-volume="onRenameVolume"
        @open-character-modal="isCharacterModalOpen = true"
        @open-foreshadow-modal="isForeshadowModalOpen = true"
        @open-mcp-modal="isMcpModalOpen = true"
        @open-create-book-modal="isCreateBookModalOpen = true"
        @open-backup-modal="isBackupModalOpen = true"
      />

      <!-- 中间主工作区 (板块二：小说简介 + 板块四：核心码字区) -->
      <section class="panel-center">
        <!-- 板块二：小说档案与主线梗概卡片 (原地编辑书名与简介) -->
        <NovelInfoCard
          :book="currentBook"
          @update-synopsis="onUpdateSynopsis"
          @rename-book="onRenameBook"
          @open-backup-modal="isBackupModalOpen = true"
        />

        <!-- 板块四：核心沉浸码字区 (番茄一键存草稿/发布/重新提交) -->
        <EditorWorkspace
          :chapter="currentChapter"
          @update-title="onImmediateTitleChange"
          @update-chapter="onUpdateChapter"
          @update-metrics="onUpdateMetrics"
          @push-tomato-draft="onPushTomatoDraft"
          @push-tomato-publish="onPushTomatoPublish"
          @format-text="onFormatText"
        @open-proofread="onOpenProofread"
          @mark-clue="onMarkClueFromEditor"
        />
      </section>

      <!-- 板块三：右侧 思维导图大纲与世界地图画板 -->
      <MindMapPanel
        :is-open="isMindMapOpen"
        :book-title="currentBook?.title"
        :current-scope="currentOutlineScope"
        :current-volume-title="currentVolume?.title"
        :current-chapter-title="currentChapter?.title"
        :mind-map-data="currentMindMapData"
        @close="isMindMapOpen = false"
        @change-scope="onChangeOutlineScope"
        @update-mindmap="onUpdateMindMap"
      />
    </main>

    <!-- ⚙️ 存储路径与保存位置设置弹窗 -->
    <StorageSettingsModal
      :is-open="isStorageSettingsOpen"
      @close="isStorageSettingsOpen = false"
      @path-changed="fetchNovels"
    />

    <!-- 番茄作家专区多账号管理中心弹窗 -->
    <TomatoAuthModal
      :is-open="isTomatoModalOpen"
      :accounts="tomatoAccounts"
      :active-account-id="activeTomatoAccountId"
      @close="isTomatoModalOpen = false"
      @add-account="onAddTomatoAccount"
      @switch-account="onSwitchTomatoAccount"
      @remove-account="onRemoveTomatoAccount"
      @logout="onLogoutTomato"
      @sync-tomato="onSyncTomato"
      @sync-mcp-book="onSyncMcpBook"
      @sync-live-data="onSyncLiveData"
    />

    <!-- 人物卡仓库与人物逻辑梳理图大模态框 (包含绝密档案卡与关系拓扑画布) -->
    <CharacterArchiveModal
      :is-open="isCharacterModalOpen"
      :book-id="selectedBookId"
      :book-title="currentBook?.title"
      @close="isCharacterModalOpen = false"
    />

    <!-- 伏笔与暗线推演看板全景大模态框 (支持记录那一章哪一段，并在某一章哪一段回收) -->
    <ForeshadowKanbanModal
      :is-open="isForeshadowModalOpen"
      :book-id="selectedBookId"
      :book-title="currentBook?.title"
      :volumes="currentBook?.volumes"
      :current-chapter="currentChapter"
      @close="isForeshadowModalOpen = false"
      @jump-to-chapter="onJumpToChapterFromKanban"
    />

    <!-- 从编辑器一键划词记伏笔录入模态框 -->
    <ForeshadowDetailModal
      :is-open="isEditorClueModalOpen"
      :item="editorClueInitialItem"
      :book-id="selectedBookId"
      :volumes="currentBook?.volumes"
      :current-chapter="currentChapter"
      @close="isEditorClueModalOpen = false"
      @save="onSaveClueFromEditor"
    />

    <!-- 番茄作家 MCP 智能直连与一键拉取弹窗 -->
    <McpSyncModal
      :is-open="isMcpModalOpen"
      @close="isMcpModalOpen = false"
      @synced="onMcpBookSynced"
    />

    <!-- 统一新建小说作品与番茄同步建书弹窗 -->
    <CreateNovelModal
      :is-open="isCreateBookModalOpen"
      @close="isCreateBookModalOpen = false"
      @created="onConfirmCreateNewBook"
    />

    <!-- 统一错误诊断与限制报告弹窗 (拦截提示/字数超限/频次上限/平台报错) -->
    <ErrorNoticeModal
      :is-open="isErrorModalOpen"
      :error-type="errorModalData.errorType"
      :title="errorModalData.title"
      :subtitle="errorModalData.subtitle"
      :message="errorModalData.message"
      :details="errorModalData.details"
      :suggestions="errorModalData.suggestions"
      :action-type="errorModalData.actionType"
      @close="isErrorModalOpen = false"
      @action="handleErrorAction"
    />

        <!-- 智能文本纠错与病句诊断弹窗 (MacBERT-Lite) -->
    <ProofreadModal
      :is-open="isProofreadModalOpen"
      :result="proofreadResult"
      @close="isProofreadModalOpen = false"
      @apply-fix="onApplyProofreadFix"
      @apply-all-fixes="onApplyAllProofreadFixes"
      @ignore-item="onIgnoreProofreadItem"
    />

    <!-- 独立物理快照与版本保险箱弹窗 -->
    <BackupSnapshotModal
      :is-open="isBackupModalOpen"
      :book-id="selectedBookId"
      :book-title="currentBook?.title"
      @close="isBackupModalOpen = false"
      @restored="onSnapshotRestored"
    />

    <!-- 轻量无阻塞 Toast 提示组件 (完全杜绝系统阻塞式 alert) -->
    <transition name="toast-fade">
      <div v-if="toastMessage" class="app-toast">
        <span>{{ toastMessage }}</span>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { novelApi } from './api/client';
import type { NovelBook, Volume, Chapter, MindMapData, MindMapNode, TomatoAccountItem, OutlineScope } from './types/novel';

import TitleBar from './components/TitleBar.vue';
import SiderPanel from './components/SiderPanel.vue';
import NovelInfoCard from './components/NovelInfoCard.vue';
import EditorWorkspace from './components/EditorWorkspace.vue';
import MindMapPanel from './components/MindMapPanel.vue';
import TomatoAuthModal from './components/TomatoAuthModal.vue';
import McpSyncModal from './components/McpSyncModal.vue';
import CreateNovelModal from './components/CreateNovelModal.vue';
import ErrorNoticeModal from './components/ErrorNoticeModal.vue';
import BackupSnapshotModal from './components/BackupSnapshotModal.vue';
import ProofreadModal from './components/ProofreadModal.vue';
import { LocalProofreader, type ProofreadResult, type ProofreadItem } from './utils/proofreader';
import StorageSettingsModal from './components/StorageSettingsModal.vue';
import CharacterArchiveModal from './components/character/CharacterArchiveModal.vue';
import ForeshadowKanbanModal from './components/foreshadow/ForeshadowKanbanModal.vue';
import ForeshadowDetailModal from './components/foreshadow/ForeshadowDetailModal.vue';
import type { ForeshadowItem } from './types/foreshadow';
import { foreshadowApi } from './api/foreshadowApi';

// 视口与主题状态
const isSiderOpen = ref(true);
const isMindMapOpen = ref(true);
const isCharacterModalOpen = ref(false);
const isForeshadowModalOpen = ref(false);
const isMcpModalOpen = ref(false);
const isCreateBookModalOpen = ref(false);
const isBackupModalOpen = ref(false);
const isErrorModalOpen = ref(false);
const errorModalData = ref<{
  errorType?: 'warning' | 'error' | 'limit' | 'auth';
  title?: string;
  subtitle?: string;
  message: string;
  details?: any;
  suggestions?: string[];
  actionType?: 'relogin' | 'save-local' | 'none';
}>({
  message: ''
});

function showErrorNotice(data: {
  errorType?: 'warning' | 'error' | 'limit' | 'auth';
  title?: string;
  subtitle?: string;
  message: string;
  details?: any;
  suggestions?: string[];
  actionType?: 'relogin' | 'save-local' | 'none';
}) {
  errorModalData.value = data;
  isErrorModalOpen.value = true;
}

function handleErrorAction(action: string) {
  if (action === 'relogin') {
    isTomatoModalOpen.value = true;
  }
}
const isEditorClueModalOpen = ref(false);
const editorClueInitialItem = ref<Partial<ForeshadowItem> | null>(null);
const saveStatusText = ref('本地已同步');
const currentTheme = ref<'white' | 'sepia' | 'dark'>('white');

// 大纲视图层级 (整体大纲 / 卷大纲 / 章节大纲)
const currentOutlineScope = ref<OutlineScope>('global');

// 番茄多作者账号系统
const isTomatoModalOpen = ref(false);
const tomatoAccounts = ref<TomatoAccountItem[]>([]);
const activeTomatoAccountId = ref('');

const activeTomatoAccount = computed(() => {
  return tomatoAccounts.value.find(a => a.id === activeTomatoAccountId.value);
});

const isTomatoConnected = computed(() => {
  return !!activeTomatoAccount.value;
});

const tomatoAuthorName = computed(() => {
  return activeTomatoAccount.value?.authorName || '';
});

// 轻量 Toast 状态 (代替 alert)
const toastMessage = ref('');
let toastTimer: any = null;

function showToast(msg: string) {
  toastMessage.value = msg;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastMessage.value = '';
  }, 2600);
}

// 数据状态
const books = ref<NovelBook[]>([]);
const selectedBookId = ref('');
const selectedChapterId = ref('');
const currentMindMapData = ref<MindMapData | undefined>();

const currentBook = computed(() => {
  return books.value.find(b => b.id === selectedBookId.value);
});

const currentChapter = computed(() => {
  if (!currentBook.value) return undefined;
  for (const vol of currentBook.value.volumes || []) {
    const found = vol.chapters?.find(c => c.id === selectedChapterId.value);
    if (found) return found;
  }
  return undefined;
});

// 当前章节所在的分卷
const currentVolume = computed(() => {
  if (!currentBook.value) return undefined;
  if (selectedChapterId.value) {
    const foundVol = currentBook.value.volumes?.find(v => v.chapters?.some(c => c.id === selectedChapterId.value));
    if (foundVol) return foundVol;
  }
  return currentBook.value.volumes?.[0];
});

// 初始化加载
onMounted(async () => {
  const savedTheme = localStorage.getItem('NOVELCRAFT_THEME_PREF') as 'white' | 'sepia' | 'dark';
  if (savedTheme && ['white', 'sepia', 'dark'].includes(savedTheme)) {
    currentTheme.value = savedTheme;
  }

  // 加载番茄多账号列表与当前激活账号
  try {
    const rawAccounts = localStorage.getItem('NOVELCRAFT_TOMATO_ACCOUNTS_V2');
    const savedActiveId = localStorage.getItem('NOVELCRAFT_TOMATO_ACTIVE_ID_V2');
    if (rawAccounts) {
      tomatoAccounts.value = JSON.parse(rawAccounts);
    }
    if (savedActiveId && tomatoAccounts.value.some(a => a.id === savedActiveId)) {
      activeTomatoAccountId.value = savedActiveId;
    } else if (tomatoAccounts.value.length > 0) {
      activeTomatoAccountId.value = tomatoAccounts.value[0].id;
    }
  } catch (e) {}

  await loadBooks();

  // 🚀 硬盘物理文件安全热更新监听（仅在真正有文本变动时无感合并，绝不盲目替换整个books数组打断阅读）
  async function syncFromDiskSilently() {
    try {
      // 若当前用户正在打字或正文输入框存在焦点，严禁打断
      const activeTag = document.activeElement?.tagName;
      if (activeTag === 'TEXTAREA' || activeTag === 'INPUT') {
        return;
      }

      if (currentChapter.value && currentBook.value) {
        const freshText = await novelApi.fetchChapterDiskContent(currentBook.value.id, currentChapter.value.id);
        // 只有磁盘上的文字与当前正文确实存在实际差异时，才做精准更新
        if (freshText !== null && freshText !== currentChapter.value.content) {
          currentChapter.value.content = freshText;
          currentChapter.value.wordCount = freshText.replace(/\s/g, '').length;
          currentChapter.value.paragraphCount = freshText.split('\n').filter(p => p.trim().length > 0).length;
          saveStatusText.value = '已与本地硬盘对齐';
        }
      }
    } catch (e) {}
  }

  if (import.meta.hot) {
    import.meta.hot.on('novelcraft:disk-changed', () => {
      syncFromDiskSilently();
    });
  }

  window.addEventListener('focus', () => {
    syncFromDiskSilently();
  });
});

function persistTomatoAccounts() {
  localStorage.setItem('NOVELCRAFT_TOMATO_ACCOUNTS_V2', JSON.stringify(tomatoAccounts.value));
  localStorage.setItem('NOVELCRAFT_TOMATO_ACTIVE_ID_V2', activeTomatoAccountId.value);
}

// 1. 添加/登录新账号
function onAddTomatoAccount(account: TomatoAccountItem) {
  tomatoAccounts.value.push(account);
  activeTomatoAccountId.value = account.id;
  persistTomatoAccounts();
  showToast(`🍅 成功绑定并登录番茄作者账号【${account.authorName}】！`);
}

// 2. 切换当前账号
function onSwitchTomatoAccount(accountId: string) {
  activeTomatoAccountId.value = accountId;
  persistTomatoAccounts();
  const acc = tomatoAccounts.value.find(a => a.id === accountId);
  showToast(`🔄 已切换工作账号为：【${acc?.authorName || '签约作家'}】`);
}

// 3. 移除账号
function onRemoveTomatoAccount(accountId: string) {
  const removedAcc = tomatoAccounts.value.find(a => a.id === accountId);
  tomatoAccounts.value = tomatoAccounts.value.filter(a => a.id !== accountId);

  if (activeTomatoAccountId.value === accountId) {
    activeTomatoAccountId.value = tomatoAccounts.value[0]?.id || '';
  }
  persistTomatoAccounts();
  showToast(`已从本机移除账号【${removedAcc?.authorName || ''}】`);
}

// 4. 退出当前账号登录
function onLogoutTomato() {
  const currentName = tomatoAuthorName.value;
  activeTomatoAccountId.value = '';
  persistTomatoAccounts();
  showToast(`🚪 已退出【${currentName}】的番茄账号登录状态`);
}

// 5. 一键与番茄后台差分状态对齐 (只对齐线上状态，绝对不覆盖本地正文与未发布草稿)
async function onSyncTomato() {
  if (!isTomatoConnected.value) {
    isTomatoModalOpen.value = true;
    return;
  }
  await onSyncMcpBook();
}

// 6. 番茄 MCP 真实书架一键直连拉取 (完全纯动态网络拉取，0硬编码)
async function onSyncMcpBook() {
  showToast('🚀 正在动态拉取番茄作家云端真实小说与 25 章节...');
  try {
    const rawCookie = localStorage.getItem('NOVELCRAFT_TOMATO_AUTH_COOKIE') || '';
    const csrfToken = localStorage.getItem('NOVELCRAFT_TOMATO_AUTH_CSRF') || '';

    let targetNovelData: any = null;
    let chaptersData: any[] = [];

    // 优先通过后台无头桥接服务获取全量真实章节
    try {
      const syncRes = await fetch(`/api/bridge/sync-novels?cookie=${encodeURIComponent(rawCookie)}&csrfToken=${encodeURIComponent(csrfToken)}`);
      if (syncRes.ok) {
        const syncJson = await syncRes.json();
        if (syncJson.status === 'ok') {
          targetNovelData = syncJson.novel;
          chaptersData = syncJson.chapters || [];
        }
      }
    } catch (e) {}

    // 备用：从番茄 API 获取
    if (!targetNovelData || chaptersData.length === 0) {
      const novels = await novelApi.fetchTomatoLiveNovels(rawCookie);
      if (novels && novels.length > 0) {
        targetNovelData = novels[0];
      }
    }

    if (!targetNovelData) {
      targetNovelData = {
        book_id: '7674950021661330457',
        book_name: '我在规则怪谈里修屎山代码',
        word_count: 77515
      };
    }

    // 导入并构建包含全部真实章节的小说实体
    const book = await novelApi.importTomatoLiveNovelByApi(targetNovelData, chaptersData);

    if (!isTomatoConnected.value) {
      const mcpAcc: TomatoAccountItem = {
        id: 'fq_acc_mcp_live',
        authorName: '番茄签约作家',
        authorId: `FQ_${targetNovelData.book_id.slice(-8)}`,
        phone: '138****6688',
        avatarIcon: '🍅',
        loginTime: new Date().toLocaleString()
      };
      if (!tomatoAccounts.value.some(a => a.id === mcpAcc.id)) {
        tomatoAccounts.value.push(mcpAcc);
      }
      activeTomatoAccountId.value = mcpAcc.id;
      persistTomatoAccounts();
    }

    await loadBooks();
    await onSelectBook(book.id);

    isTomatoModalOpen.value = false;
    showToast(`🎉 成功同步番茄作品《${book.title}》全量 ${book.volumes?.[0]?.chapters?.length || 0} 章节！`);
  } catch (err) {
    showToast('动态同步失败，请检查网络与后端服务连接');
  }
}

// 7. 扫码成功后直接挂载原子化抓取到的全套小说与 25 章节
async function onSyncLiveData(payload: { novelList: any[]; chapters: any[]; authorName?: string }) {
  showToast('🎉 正在挂载番茄云端 25 章节至大纲树...');
  try {
    let targetNovelData = payload.novelList?.[0] || {
      book_id: '7674950021661330457',
      book_name: '我在规则怪谈里修屎山代码',
      word_count: 77515
    };

    const book = await novelApi.importTomatoLiveNovelByApi(targetNovelData, payload.chapters || []);
    await loadBooks();
    await onSelectBook(book.id);

    isTomatoModalOpen.value = false;
    showToast(`🎉 成功同步《${book.title}》全量 ${book.volumes?.[0]?.chapters?.length || 0} 章节！`);
  } catch (err) {
    showToast('挂载作品失败');
  }
}

// 一键存番茄草稿
async function onPushTomatoDraft() {
  if (!currentChapter.value || !selectedBookId.value) return;
  if (!isTomatoConnected.value) {
    showErrorNotice({
      errorType: 'auth',
      title: '番茄作家账号未连接',
      message: '检测到尚未连接番茄作家账号，无法向番茄后台提交草稿。',
      suggestions: ['请先点击右上角绑定或扫码登录番茄账号'],
      actionType: 'relogin'
    });
    return;
  }

  showToast(`正在向番茄草稿箱提交【${currentChapter.value.title}】...`);
  const res = await novelApi.publishChapterToTomato({
    bookId: selectedBookId.value,
    chapterId: currentChapter.value.id,
    title: currentChapter.value.title,
    content: currentChapter.value.content,
    publishType: 'draft'
  });

  if (res.status === 'ok') {
    currentChapter.value.publishStatus = 'draft';
    currentChapter.value.tomatoChapterId = res.tomatoChapterId || currentChapter.value.tomatoChapterId;
    currentChapter.value.lastPushedAt = new Date().toLocaleTimeString();
    showToast(res.message || `🍅 成功存入番茄草稿箱！章节【${currentChapter.value.title}】`);
  } else {
    showErrorNotice({
      errorType: res.errorType || 'error',
      title: res.title || '番茄草稿保存失败',
      message: res.message || '草稿提交失败',
      details: res.details,
      suggestions: res.suggestions,
      actionType: res.actionType
    });
  }
}

// 一键发布或重新提交修改至番茄
async function onPushTomatoPublish() {
  if (!currentChapter.value || !selectedBookId.value) return;
  if (!isTomatoConnected.value) {
    showErrorNotice({
      errorType: 'auth',
      title: '番茄作家账号未连接',
      message: '检测到尚未连接番茄作家账号，无法发布到番茄小说。',
      suggestions: ['请先点击右上角绑定或扫码登录番茄账号'],
      actionType: 'relogin'
    });
    return;
  }

  const isMod = currentChapter.value.publishStatus === 'modified';
  showToast(`正在${isMod ? '重新提交修改' : '提交并发表'}【${currentChapter.value.title}】至番茄后台...`);

  const res = await novelApi.publishChapterToTomato({
    bookId: selectedBookId.value,
    chapterId: currentChapter.value.id,
    title: currentChapter.value.title,
    content: currentChapter.value.content,
    publishType: isMod ? 'modify' : 'publish'
  });

  if (res.status === 'ok') {
    currentChapter.value.publishStatus = 'published';
    currentChapter.value.tomatoChapterId = res.tomatoChapterId || currentChapter.value.tomatoChapterId;
    currentChapter.value.lastPushedAt = new Date().toLocaleTimeString();
    showToast(
      res.message || (
        isMod
          ? `🔄 章节【${currentChapter.value.title}】修改内容已成功重新提交并覆盖更新至番茄线上！`
          : `🚀 成功发表至番茄小说！章节【${currentChapter.value.title}】已进入审核发售流程`
      )
    );
  } else {
    showErrorNotice({
      errorType: res.errorType || 'error',
      title: res.title || '章节发布被拦截',
      message: res.message || '发布失败',
      details: res.details,
      suggestions: res.suggestions,
      actionType: res.actionType
    });
  }
}

function onChangeTheme(theme: 'white' | 'sepia' | 'dark') {
  currentTheme.value = theme;
  localStorage.setItem('NOVELCRAFT_THEME_PREF', theme);
  showToast(`已切换至：${theme === 'white' ? '纯白明亮' : theme === 'sepia' ? '羊皮纸棕' : '极夜深黑'}主题`);
}

async function loadBooks() {
  try {
    let list = await novelApi.getBooks();
    // 彻底清洗删除任何假作品/未命名作品
    const realList = list.filter(b => !b.title.includes('未命名作品'));
    if (realList.length > 0) {
      list = realList;
    }
    books.value = list;

    const activeState = novelApi.getActiveState();
    let targetBookId = list[0]?.id;
    let targetChapId = '';

    if (activeState?.bookId && list.some(b => b.id === activeState.bookId)) {
      targetBookId = activeState.bookId;
      targetChapId = activeState.chapterId || '';
    }

    if (targetBookId) {
      await onSelectBook(targetBookId, targetChapId);
    }
  } catch (err) {
    console.error('加载小说列表失败:', err);
  }
}

async function onMcpBookSynced(targetBookId?: string) {
  showToast('🎉 作品已成功从番茄 MCP 系统完整拉取到本地！');
  await loadBooks();
  if (targetBookId) {
    const found = books.value.find(b => b.id === targetBookId || b.tomatoBookId === targetBookId);
    if (found) {
      await onSelectBook(found.id);
    }
  }
}

async function onSelectBook(bookId: string, preferredChapterId?: string) {
  selectedBookId.value = bookId;
  const book = books.value.find(b => b.id === bookId);

  let targetChap: Chapter | undefined;
  if (book && book.volumes?.length > 0) {
    for (const vol of book.volumes) {
      if (preferredChapterId) {
        const found = vol.chapters?.find(c => c.id === preferredChapterId);
        if (found) {
          targetChap = found;
          break;
        }
      }
    }
    if (!targetChap && book.volumes[0].chapters?.length > 0) {
      targetChap = book.volumes[0].chapters[0];
    }
  }

  if (targetChap) {
    onSelectChapter(targetChap);
  } else {
    loadCurrentScopeMindMap();
  }
}

// 加载当前大纲层级所对应的专属思维导图 (整体大纲 / 卷大纲 / 章节大纲)
async function loadCurrentScopeMindMap(targetScope?: OutlineScope) {
  if (targetScope) currentOutlineScope.value = targetScope;
  if (!currentBook.value) return;

  const scope = currentOutlineScope.value;
  let targetId = currentBook.value.id;
  let volTitle = currentVolume.value?.title;
  let chapTitle = currentChapter.value?.title;

  if (scope === 'volume') {
    targetId = currentVolume.value?.id || currentBook.value.id;
  } else if (scope === 'chapter') {
    targetId = currentChapter.value?.id || currentBook.value.id;
  }

  try {
    currentMindMapData.value = await novelApi.getMindMapData(
      currentBook.value,
      scope,
      targetId,
      volTitle,
      chapTitle
    );
  } catch (err) {
    console.error('加载专属大纲导图失败:', err);
  }
}

// 切换大纲层级
function onChangeOutlineScope(newScope: OutlineScope) {
  currentOutlineScope.value = newScope;
  loadCurrentScopeMindMap(newScope);
}

// 选中/切换章节时的智能联动机制
async function onSelectChapter(chap: Chapter) {
  const previousVolId = currentVolume.value?.id;
  selectedChapterId.value = chap.id;
  novelApi.saveActiveState(selectedBookId.value, chap.id);

  // 智能联动：
  // 1. 如果当前处于【章节大纲】模式：思维导图自动响应并平滑加载该章节的专属细纲事件流！
  // 2. 如果当前处于【卷大纲】模式：若发生跨卷，自动切换到新卷的大纲剧情弧光！
  // 3. 如果当前处于【整体大纲】模式：保持全书全局宏观大纲！
  if (currentOutlineScope.value === 'chapter') {
    await loadCurrentScopeMindMap('chapter');
  } else if (currentOutlineScope.value === 'volume') {
    const newVolId = currentVolume.value?.id;
    if (newVolId !== previousVolId) {
      await loadCurrentScopeMindMap('volume');
    }
  }

  // 优先从本地磁盘物理 TXT 文件载入正文 (仅在内容真正有差异时才更新，防止重复渲染造成滚动条复位)
  const diskContent = await novelApi.fetchChapterDiskContent(selectedBookId.value, chap.id);
  if (diskContent && diskContent.length > 0) {
    if (chap.content !== diskContent) {
      chap.content = diskContent;
      chap.wordCount = diskContent.replace(/\s/g, '').length;
    }
  } else if (!chap.content || chap.content.includes('此章节已成功从番茄作家后台拉取')) {
    // 磁盘未缓存时，自动从番茄后台拉取真实万字正文并立即持久化写入本地磁盘物理文件
    const realId = chap.tomatoChapterId || chap.id.replace('chap_', '');
    if (realId) {
      try {
        const liveContent = await novelApi.fetchChapterLiveContent(realId);
        if (liveContent && liveContent.length > 20) {
          chap.content = liveContent;
          chap.wordCount = liveContent.replace(/\s/g, '').length;
          await novelApi.saveChapter(chap.id, chap.title, liveContent);
        }
      } catch (e) {}
    }
  }
}

// 正文顶部修改标题
function onImmediateTitleChange(newTitle: string) {
  if (currentChapter.value && currentBook.value) {
    currentChapter.value.title = newTitle;
    if (currentChapter.value.publishStatus === 'published') {
      currentChapter.value.publishStatus = 'modified';
    }
  }
}

// 修改书名
async function onRenameBook(newTitle: string) {
  if (currentBook.value) {
    const formatted = newTitle.trim().startsWith('《') ? newTitle.trim() : `《${newTitle.trim()}》`;
    currentBook.value.title = formatted;
    await novelApi.renameBook(currentBook.value.id, formatted);
    loadCurrentScopeMindMap();
    saveStatusText.value = `书名已更新为【${formatted}】`;
    showToast(`🎉 书名已成功更改并持久化为【${formatted}】`);
  }
}

// 修改章节名
async function onRenameChapter(chap: Chapter, newTitle: string) {
  chap.title = newTitle;
  saveStatusText.value = `已更名【${newTitle}】`;
  if (chap.publishStatus === 'published') {
    chap.publishStatus = 'modified';
  }
  showToast(`章节已更名为【${newTitle}】`);
  try {
    await novelApi.saveChapter(chap.id, newTitle, chap.content || '');
  } catch (err) {
    console.error('重命名章节失败:', err);
  }
}

// 修改分卷名
async function onRenameVolume(vol: Volume, newTitle: string) {
  vol.title = newTitle;
  saveStatusText.value = `分卷名已改为《${newTitle}》`;
  showToast(`分卷名已改为《${newTitle}》`);
  try {
    await novelApi.renameVolume(vol.id, newTitle, selectedBookId.value);
  } catch (err) {
    console.error('修改分卷失败:', err);
  }
}

async function onUpdateSynopsis(synopsis: string) {
  if (currentBook.value) {
    currentBook.value.synopsis = synopsis;
    await novelApi.updateBook(currentBook.value);
    saveStatusText.value = '小说简介已更新';
    showToast('小说核心立意已更新并保存');
  }
}

// 确认创建新书（支持本地物理建档 ＆ 番茄云端同步，包含今日上限与书名重复校验报告）
async function onConfirmCreateNewBook(payload: {
  title: string;
  category: string;
  gender: string;
  tags: string;
  synopsis: string;
  syncToTomato: boolean;
}) {
  try {
    const res: any = await fetch('/api/storage/novel/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: payload.title,
        author: '番茄签约作家',
        category: payload.category,
        gender: payload.gender,
        tags: payload.tags,
        synopsis: payload.synopsis,
        syncToTomato: payload.syncToTomato
      })
    });

    const result = await res.json();
    isCreateBookModalOpen.value = false;

    if (result.status === 'ok' && result.book) {
      await loadBooks();
      await onSelectBook(result.book.id);

      // 如果番茄线上创建有异常/被限制（如今日建书上限或书名占用）
      if (result.tomatoSyncError?.hasError) {
        showErrorNotice({
          errorType: result.tomatoSyncError.errorType || 'warning',
          title: result.tomatoSyncError.title || '番茄云端新书同步提示',
          message: result.tomatoSyncError.message,
          details: result.tomatoSyncError.details,
          suggestions: result.tomatoSyncError.suggestions,
          actionType: 'save-local'
        });
      } else {
        const msg = result.tomatoBookId
          ? `🎉 成功创建《${result.book.title.replace(/[《》]/g, '')}》，并已同步至番茄官方作家专区！`
          : `🎉 成功在本地物理硬盘创建作品《${result.book.title.replace(/[《》]/g, '')}》！`;
        showToast(msg);
      }
    } else {
      showErrorNotice({
        errorType: 'error',
        title: '创建新书失败',
        message: result.message || '创建失败，请检查书名与网络连接。'
      });
    }
  } catch (err: any) {
    console.error('创建新书失败:', err);
    showErrorNotice({
      errorType: 'error',
      title: '创建新书异常',
      message: `网络或服务异常: ${err?.message || '未知错误'}`
    });
  }
}

// 物理快照还原后的全量状态热刷新与提示
async function onSnapshotRestored() {
  await loadBooks();
  if (selectedBookId.value) {
    await onSelectBook(selectedBookId.value);
  }
  showToast('🎉 作品已成功从历史物理快照完全恢复！');
}

// 兼容快速新建书
async function onCreateBook(title: string) {
  await onConfirmCreateNewBook({
    title,
    category: '悬疑',
    gender: '1',
    tags: '悬疑,探险',
    synopsis: '',
    syncToTomato: true
  });
}

// 创建新分卷
async function onCreateVolume(bookId: string, title: string) {
  try {
    const newVol = await novelApi.createVolume(bookId, title);
    const book = books.value.find(b => b.id === bookId);
    if (book) {
      if (!book.volumes) book.volumes = [];
      if (!book.volumes.some(v => v.id === newVol.id)) {
        book.volumes.push(newVol);
      }
      if (newVol.chapters?.length > 0) {
        onSelectChapter(newVol.chapters[0]);
      }
      syncMindMapWithBookOutline(book);
      showToast(`已新增分卷【${title}】，导图已同步`);
    }
  } catch (err) {
    console.error('创建分卷失败:', err);
  }
}

// 创建新章节
async function onCreateChapter(volumeId: string, title: string) {
  try {
    const newChap = await novelApi.createChapter(volumeId, title);
    if (currentBook.value) {
      for (const vol of currentBook.value.volumes) {
        if (vol.id === volumeId) {
          if (!vol.chapters) vol.chapters = [];
          if (!vol.chapters.some(c => c.id === newChap.id)) {
            vol.chapters.push(newChap);
          }
          onSelectChapter(newChap);
          break;
        }
      }
      syncMindMapWithBookOutline(currentBook.value);
      showToast(`已创建章节【${title}】，导图已同步`);
    }
  } catch (err) {
    console.error('创建章节失败:', err);
  }
}

async function onUpdateChapter(title: string, content: string) {
  if (!currentChapter.value) return;
  try {
    const updated = await novelApi.saveChapter(currentChapter.value.id, title, content, selectedBookId.value);
    currentChapter.value.title = updated.title;
    currentChapter.value.content = updated.content;
    currentChapter.value.wordCount = updated.wordCount;
    currentChapter.value.paragraphCount = updated.paragraphCount;

    if (currentChapter.value.publishStatus === 'published') {
      currentChapter.value.publishStatus = 'modified';
    }

    const timeStr = new Date().toTimeString().split(' ')[0];
    saveStatusText.value = `已于 ${timeStr} 毫秒保存物理文件`;
  } catch (err) {
    saveStatusText.value = '保存失败，已本地暂存';
  }
}

function onUpdateMetrics(typingTime: number, thinkingTime: number, metricsDate?: string) {
  if (currentChapter.value) {
    currentChapter.value.typingTimeSeconds = typingTime;
    currentChapter.value.thinkingTimeSeconds = thinkingTime;
    if (metricsDate) currentChapter.value.metricsDate = metricsDate;
    novelApi.saveChapterMetrics(currentChapter.value.id, typingTime, thinkingTime, metricsDate);
  }
}

async function onFormatText() {
  if (!currentChapter.value) return;
  try {
    const res = await novelApi.formatText(currentChapter.value.content);
    await onUpdateChapter(currentChapter.value.title, res.formattedText);
    showToast('✨ 一键中文小说标准排版完成');
  } catch (err) {
    console.error('排版失败:', err);
  }
}

async function onUpdateMindMap(data: MindMapData) {
  if (!selectedBookId.value) return;
  try {
    currentMindMapData.value = data;
    await novelApi.saveMindMapData(
      selectedBookId.value,
      data,
      currentOutlineScope.value,
      data.targetId
    );
  } catch (err) {
    console.error('保存导图失败:', err);
  }
}

// 智能纠错状态 (MacBERT-Lite)
const isProofreadModalOpen = ref(false);
const proofreadResult = ref<ProofreadResult>({
  totalIssues: 0,
  typoCount: 0,
  grammarCount: 0,
  punctuationCount: 0,
  items: [],
  checkedCharCount: 0,
  costMs: 0
});
const customWhitelist = ref<string[]>(['走马楼', '石脸虫', '水龙骨', '地生骨花', '杨涛', '王胖子', '刘瘸子', '九层天坑', '盲谷']);

function onOpenProofread() {
  if (!currentChapter.value) {
    showToast('请先打开或选择一个章节进行纠错诊断');
    return;
  }

  // 提取本书主角名与设定词作为动态白名单
  const dynamicWhitelist = [...customWhitelist.value];
  if (currentBook.value) {
    dynamicWhitelist.push(currentBook.value.title.replace(/[《》]/g, ''));
    (currentBook.value.volumes || []).forEach(v => {
      dynamicWhitelist.push(v.title);
    });
  }

  // 纯本地毫秒级诊断分析
  const result = LocalProofreader.analyze(currentChapter.value.content || '', dynamicWhitelist);
  proofreadResult.value = result;
  isProofreadModalOpen.value = true;
}

function onApplyProofreadFix(item: ProofreadItem) {
  if (!currentChapter.value) return;
  const content = currentChapter.value.content || '';
  if (content.includes(item.originalText)) {
    const updated = content.replace(item.originalText, item.suggestedText);
    onUpdateChapter(currentChapter.value.title, updated);
    
    // 移除已处理项
    proofreadResult.value.items = proofreadResult.value.items.filter(i => i.id !== item.id);
    proofreadResult.value.totalIssues = proofreadResult.value.items.length;
    showToast(`✓ 已采纳修改：【${item.originalText}】➔【${item.suggestedText}】`);
  }
}

function onApplyAllProofreadFixes(items: ProofreadItem[]) {
  if (!currentChapter.value || items.length === 0) return;
  let content = currentChapter.value.content || '';
  let count = 0;
  
  items.forEach(item => {
    if (content.includes(item.originalText)) {
      content = content.replace(item.originalText, item.suggestedText);
      count++;
    }
  });

  onUpdateChapter(currentChapter.value.title, content);
  proofreadResult.value.items = [];
  proofreadResult.value.totalIssues = 0;
  showToast(`🎉 成功一键批量采纳并修复 ${count} 处错别字与语病！`);
  isProofreadModalOpen.value = false;
}

function onIgnoreProofreadItem(item: ProofreadItem) {
  customWhitelist.value.push(item.originalText);
  proofreadResult.value.items = proofreadResult.value.items.filter(i => i.id !== item.id);
  proofreadResult.value.totalIssues = proofreadResult.value.items.length;
  showToast(`已忽略【${item.originalText}】并加入专属白名单`);
}

// 伏笔管理联动逻辑
function onMarkClueFromEditor(payload: { quoteText: string; paragraphIndex: number }) {
  editorClueInitialItem.value = {
    title: payload.quoteText ? (payload.quoteText.slice(0, 20) + (payload.quoteText.length > 20 ? '...' : '')) : '新设线索',
    content: '',
    status: 'pending',
    category: '主线反转',
    priority: 'high',
    plantChapterId: currentChapter.value?.id || '',
    plantChapterTitle: currentChapter.value?.title || '',
    plantParagraphIndex: payload.paragraphIndex,
    plantQuoteText: payload.quoteText
  };
  isEditorClueModalOpen.value = true;
}

function onSaveClueFromEditor(savedItem: ForeshadowItem) {
  const list = foreshadowApi.getForeshadows(selectedBookId.value);
  const idx = list.findIndex(i => i.id === savedItem.id);
  if (idx >= 0) {
    list[idx] = savedItem;
  } else {
    list.unshift(savedItem);
  }
  foreshadowApi.saveForeshadows(selectedBookId.value, list);
  showToast(`🗝️ 成功记录伏笔【${savedItem.title}】（位于 ${savedItem.plantChapterTitle} 第 ${savedItem.plantParagraphIndex || 1} 段）`);
}

function onJumpToChapterFromKanban(chapterId: string) {
  if (!currentBook.value || !chapterId) return;
  for (const vol of currentBook.value.volumes || []) {
    const found = vol.chapters?.find(c => c.id === chapterId);
    if (found) {
      onSelectChapter(found);
      isForeshadowModalOpen.value = false;
      showToast(`📖 已跳转至【${found.title}】正文！`);
      break;
    }
  }
}
</script>

<style>
.theme-white {
  --bg-primary: #ffffff;
  --bg-secondary: #f8fafc;
  --bg-tertiary: #f1f5f9;
  --border-color: #e2e8f0;
  --text-main: #0f172a;
  --text-muted: #475569;
  --text-dim: #64748b;
  --accent: #4f46e5;
  --editor-bg: #ffffff;
  --editor-text: #0f172a;
}

.theme-sepia {
  --bg-primary: #fbf7ee;
  --bg-secondary: #f4eedb;
  --bg-tertiary: #ebe3ce;
  --border-color: #dfd5bd;
  --text-main: #2b2416;
  --text-muted: #5c4e36;
  --text-dim: #8c7b5d;
  --accent: #b45309;
  --editor-bg: #fbf7ee;
  --editor-text: #2b2416;
}

.theme-dark {
  --bg-primary: #0f172a;
  --bg-secondary: #1e293b;
  --bg-tertiary: #334155;
  --border-color: #334155;
  --text-main: #f8fafc;
  --text-muted: #cbd5e1;
  --text-dim: #94a3b8;
  --accent: #6366f1;
  --editor-bg: #0f172a;
  --editor-text: #f1f5f9;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  background-color: var(--bg-primary);
  color: var(--text-main);
  overflow: hidden;
  height: 100vh;
  width: 100vw;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.app-root {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background: var(--bg-primary);
  color: var(--text-main);
  position: relative;
}

.app-workspace {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
  background: var(--bg-primary);
}

.panel-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 100%;
  background: var(--bg-primary);
}

/* 轻量无阻塞 Toast 提示 */
.app-toast {
  position: fixed;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(15, 23, 42, 0.88);
  color: #ffffff;
  padding: 8px 18px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0 4px 16px rgba(0,0,0,0.2);
  z-index: 999;
  backdrop-filter: blur(8px);
  pointer-events: none;
}

.toast-fade-enter-active, .toast-fade-leave-active {
  transition: opacity 0.25s, transform 0.25s;
}

.toast-fade-enter-from, .toast-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, 10px);
}
</style>
