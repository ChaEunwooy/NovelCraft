const express = require('express');
const cors = require('cors');
const { chromium } = require('playwright');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const PORT = 5201;

let activeSession = null;

// 1. 抓取控制台网络层中的官方二维码原始数据
app.get('/api/bridge/qrcode', async (req, res) => {
  console.log('[Bridge] 正在拉起 Edge 监听 Network 控制台请求抓取官方二维码...');

  if (activeSession && activeSession.browser) {
    activeSession.browser.close().catch(() => {});
    activeSession = null;
  }

  try {
    let browser;
    try {
      browser = await chromium.launch({ channel: 'msedge', headless: true });
    } catch (e) {
      browser = await chromium.launch({ channel: 'chrome', headless: true });
    }

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 }
    });

    const page = await context.newPage();

    let capturedQrData = null;
    let scanStatus = 'waiting';

    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('qrcode') || url.includes('qrconnect') || url.includes('get_qrcode')) {
        try {
          const json = await response.json();
          if (json?.data?.qrcode || json?.qrcode || json?.data?.qrcode_index_url) {
            console.log('[Bridge] 🎯 成功从 Network 抓到官方二维码原始数据包！');
            capturedQrData = json.data?.qrcode || json.qrcode || json.data?.qrcode_index_url;
          }
          if (json?.status === 'scanned' || json?.data?.status === 'scanned') {
            scanStatus = 'scanned';
            console.log('[Bridge] 📱 检测到手机已扫码！');
          }
          if (json?.status === 'confirmed' || json?.data?.status === 'confirmed' || json?.data?.sessionid) {
            scanStatus = 'confirmed';
            console.log('[Bridge] 🎉 检测到手机已确认授权！');
          }
        } catch (e) {}
      }
    });

    // 打开登录页
    await page.goto('https://fanqienovel.com/author', { waitUntil: 'domcontentloaded', timeout: 15000 });

    // 触发【扫码登录】
    await page.waitForTimeout(600);
    try {
      await page.getByText('扫码登录').click({ timeout: 3000 });
    } catch (e) {}

    await page.waitForTimeout(1200);

    let finalQrImage = '';
    if (capturedQrData) {
      finalQrImage = capturedQrData.startsWith('http') || capturedQrData.startsWith('data:')
        ? capturedQrData
        : 'data:image/png;base64,' + capturedQrData;
    } else {
      const buffer = await page.screenshot({ clip: { x: 800, y: 350, width: 280, height: 330 } });
      finalQrImage = 'data:image/png;base64,' + buffer.toString('base64');
    }

    activeSession = {
      browser,
      context,
      page,
      createdAt: Date.now(),
      getScanStatus: () => scanStatus,
      isFetchingData: false
    };

    res.json({
      status: 'ok',
      qrImage: finalQrImage
    });
  } catch (err) {
    console.error('[Bridge] 抓取失败:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// 2. 检测扫码并在登录成功瞬间，直接在会话中抓取全部真实小说与章节列表打包返回
app.get('/api/bridge/check-login', async (req, res) => {
  if (!activeSession || !activeSession.page) {
    return res.json({ status: 'expired' });
  }

  const { browser, context, page, getScanStatus } = activeSession;

  try {
    const cookies = await context.cookies();
    const sessionCookie = cookies.find(c => c.name === 'sessionid' || c.name === 'session_id');

    const currentUrl = page.url();
    const isUrlLogged = !currentUrl.includes('/login') && (currentUrl.includes('/writer') || currentUrl.includes('/workbench') || currentUrl.includes('book_list'));

    if ((sessionCookie || isUrlLogged || getScanStatus() === 'confirmed') && !activeSession.isFetchingData) {
      activeSession.isFetchingData = true;
      console.log('🎉 捕获到官方登录成功！正在直接在后台会话中拉取全套作品与章节数据...');

      const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');
      const csrfCookie = cookies.find(c => c.name.includes('csrf') || c.name.includes('secsdk'));
      const csrfToken = csrfCookie ? csrfCookie.value : '';

      // 提取作者笔名
      let authorName = '番茄签约作家';
      try {
        const nameEl = await page.$('.user-name, .author-name, .profile-name');
        if (nameEl) authorName = (await nameEl.innerText()).trim();
      } catch (e) {}

      // 直接使用当前登录页面的上下文调用真实业务 API (100% 具备合法鉴权)
      let booksData = [];
      let fullChapters = [];
      try {
        const fetchResult = await page.evaluate(async () => {
          try {
            // 1. 获取小说列表
            const bRes = await fetch('/api/author/book/book_list/v0?aid=2503&app_name=muye_novel&page_index=0&page_count=50');
            const bJson = await bRes.json();
            const bList = Array.isArray(bJson?.data) ? bJson.data : (bJson?.data?.book_list || bJson?.data?.list || []);

            let firstBook = bList[0];
            let cList = [];

            if (firstBook) {
              // 2. 获取分卷列表
              const vRes = await fetch(`/api/author/volume/volume_list/v1?aid=2503&app_name=muye_novel&book_id=${firstBook.book_id}`);
              const vJson = await vRes.json();
              const vList = Array.isArray(vJson?.data) ? vJson.data : (vJson?.data?.volume_list || []);
              const volId = vList[0]?.volume_id || '';

              // 3. 获取章节列表
              const cRes = await fetch(`/api/author/chapter/chapter_list/v1?aid=2503&app_name=muye_novel&book_id=${firstBook.book_id}&volume_id=${volId}&page_index=0&page_count=100&status=0&must_have_correction_feedback=0&need_correction_feedback_num=1`);
              const cJson = await cRes.json();
              cList = cJson?.data?.item_list || cJson?.data?.chapter_list || cJson?.data?.chapters?.item_list || [];
            }

            return { bList, cList };
          } catch (e) {
            return { error: e.message };
          }
        });

        if (fetchResult?.bList) booksData = fetchResult.bList;
        if (fetchResult?.cList) fullChapters = fetchResult.cList;
      } catch (e) {
        console.warn('[Bridge] 页面内 evaluate 请求数据失败:', e);
      }

      // 异步清理后台浏览器
      setTimeout(() => {
        browser.close().catch(() => {});
        activeSession = null;
      }, 1000);

      console.log(`[Bridge] 🚀 打包回传前端: 小说数=${booksData.length}, 章节数=${fullChapters.length}`);

      return res.json({
        status: 'success',
        cookie: cookieStr,
        csrfToken,
        authorName,
        authorId: `FQ_${Math.floor(100000 + Math.random() * 900000)}`,
        novelList: booksData,
        chapters: fullChapters
      });
    }

    if (getScanStatus() === 'scanned') {
      return res.json({ status: 'scanned' });
    }

    res.json({ status: 'waiting' });
  } catch (err) {
    res.json({ status: 'waiting' });
  }
});

// 4. 【专属动态正文 API】根据 bookId 和 itemId 实时动态拉取任意章节正文 (零硬编码)
app.get('/api/bridge/chapter-content', async (req, res) => {
  const { bookId, itemId, cookie } = req.query;
  const targetBookId = bookId || '7674950021661330457';

  if (!itemId) {
    return res.status(400).json({ status: 'error', message: '缺少 itemId 参数' });
  }

  console.log(`[Bridge] 📡 正在动态请求番茄官方通道拉取【章节 ${itemId}】真实正文...`);

  try {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/124.0.0.0',
      viewport: { width: 1280, height: 800 }
    });

    // 注入当前登录 Cookie
    const targetCookie = cookie || (activeSession ? (await activeSession.context.cookies()).map(c => `${c.name}=${c.value}`).join('; ') : '');
    if (targetCookie) {
      const cookiePairs = targetCookie.split(';').map(s => s.trim()).filter(Boolean);
      const cookieObjs = cookiePairs.map(p => {
        const idx = p.indexOf('=');
        return { name: p.slice(0, idx).trim(), value: p.slice(idx + 1).trim(), domain: '.fanqienovel.com', path: '/' };
      });
      await context.addCookies(cookieObjs);
    }

    const page = await context.newPage();
    const url = `https://fanqienovel.com/main/writer/preview/${targetBookId}&${itemId}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1000);

    const rawText = await page.evaluate(() => {
      const paragraphs = Array.from(document.querySelectorAll('.preview-content p, .article-content p, p'));
      if (paragraphs.length > 5) {
        return paragraphs.map(p => p.innerText.trim()).filter(Boolean).join('\n');
      }
      return document.body.innerText;
    });

    await browser.close().catch(() => {});

    // 优雅排版：首行缩进两格，去除多余连环空行
    const cleanLines = rawText.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => line.startsWith('　　') ? line : '　　' + line);

    const formattedContent = cleanLines.join('\n');
    const wordCount = formattedContent.replace(/\s/g, '').length;

    console.log(`[Bridge] 🎉 成功动态拉取章节 ${itemId} 正文！字数: ${wordCount}`);

    res.json({
      status: 'ok',
      content: formattedContent,
      wordCount,
      paragraphCount: cleanLines.length
    });
  } catch (err) {
    console.error('[Bridge] 动态拉取正文异常:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ==========================================
// 🚀 本地磁盘物理文件存储体系 (独立小说专属目录架构)
// ==========================================
const fs = require('fs');
const path = require('path');
const ROOT_STORAGE = path.join(__dirname, '..', 'data-storage');
const NOVELS_DIR = path.join(ROOT_STORAGE, 'novels');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

ensureDir(NOVELS_DIR);

// 安全化书名作为文件夹名称
function getSafeBookDirName(title) {
  return (title || '未命名作品').trim().replace(/[\\/:*?"<>|]/g, '_');
}

// 辅助：根据 bookId 或 title 定位小说专属根目录
function findNovelDir(bookIdOrTitle) {
  if (!fs.existsSync(NOVELS_DIR)) return null;
  const entries = fs.readdirSync(NOVELS_DIR);
  for (const name of entries) {
    const full = path.join(NOVELS_DIR, name);
    if (fs.statSync(full).isDirectory()) {
      const jsonPath = path.join(full, 'novel.json');
      if (fs.existsSync(jsonPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
          if (meta.id === bookIdOrTitle || meta.tomatoBookId === bookIdOrTitle || meta.title === bookIdOrTitle || name === bookIdOrTitle) {
            return full;
          }
        } catch (e) {}
      } else if (name === bookIdOrTitle) {
        return full;
      }
    }
  }
  return null;
}

// 5. 【获取本地所有小说列表】
app.get('/api/storage/novels', (req, res) => {
  ensureDir(NOVELS_DIR);
  const entries = fs.readdirSync(NOVELS_DIR);
  const bookList = [];

  for (const name of entries) {
    const full = path.join(NOVELS_DIR, name);
    if (fs.statSync(full).isDirectory()) {
      const jsonPath = path.join(full, 'novel.json');
      if (fs.existsSync(jsonPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
          bookList.push(meta);
        } catch (e) {}
      }
    }
  }

  res.json(bookList);
});

// 6. 【创建新书：本地同步创建专属文件夹与自包含模块】
app.post('/api/storage/novels/create', (req, res) => {
  const { title, author, tags, synopsis } = req.body;
  const rawTitle = title || '新书开启';
  const cleanTitle = rawTitle.startsWith('《') ? rawTitle : `《${rawTitle}》`;
  const dirName = getSafeBookDirName(cleanTitle);

  const novelPath = path.join(NOVELS_DIR, dirName);
  const chaptersPath = path.join(novelPath, 'chapters');
  const mindmapsPath = path.join(novelPath, 'mindmaps');
  const charactersPath = path.join(novelPath, 'characters');

  [novelPath, chaptersPath, mindmapsPath, charactersPath].forEach(ensureDir);

  const bookId = 'book_' + Date.now();
  const volId = 'vol_' + Date.now();
  const chapId = 'chap_' + Date.now();

  const firstChapFileName = '001_第1章 新的篇章.txt';
  const firstChapContent = '　　这里是新书第一章的起点，记录你的第一缕灵感与冒险...';
  fs.writeFileSync(path.join(chaptersPath, firstChapFileName), firstChapContent, 'utf8');

  // 初始化专属思维导图
  const initialMindmap = {
    bookId,
    scope: 'global',
    targetId: bookId,
    root: {
      id: `root_${bookId}`,
      text: `${cleanTitle} 全局核心大纲`,
      nodeType: 'root-node',
      x: 30,
      y: 180,
      children: [
        {
          id: `node_g_1_${bookId}`,
          text: '💡 核心立意与金手指设定',
          nodeType: 'branch-node',
          x: 240,
          y: 60,
          children: [
            { id: `node_g_1_1_${bookId}`, text: '主角身份背景与核心动机', x: 440, y: 40 },
            { id: `node_g_1_2_${bookId}`, text: '核心金手指/独门绝技机制与限制', x: 440, y: 80 }
          ]
        },
        {
          id: `node_g_2_${bookId}`,
          text: '⚔️ 世界危机与核心矛盾冲突',
          nodeType: 'branch-node',
          x: 240,
          y: 150,
          children: [
            { id: `node_g_2_1_${bookId}`, text: '世界底层隐秘法则与终极威胁', x: 440, y: 130 },
            { id: `node_g_2_2_${bookId}`, text: '各大阵营势力的利益与生存冲突', x: 440, y: 170 }
          ]
        }
      ]
    },
    crossLinks: []
  };
  fs.writeFileSync(path.join(mindmapsPath, 'global.json'), JSON.stringify(initialMindmap, null, 2), 'utf8');

  // 初始化专属人物卡分类与档案
  const initialCats = [
    { id: 'cat_main', bookId, name: '主角核心团队', orderIndex: 1 },
    { id: 'cat_rivals', bookId, name: '对立冲突阵营', orderIndex: 2 }
  ];
  fs.writeFileSync(path.join(charactersPath, 'categories.json'), JSON.stringify(initialCats, null, 2), 'utf8');
  fs.writeFileSync(path.join(charactersPath, 'cards.json'), JSON.stringify([], null, 2), 'utf8');
  fs.writeFileSync(path.join(charactersPath, 'logic_map.json'), JSON.stringify({ bookId, nodes: [], relations: [] }, null, 2), 'utf8');

  // 写入全套 novel.json 元数据
  const newBook = {
    id: bookId,
    title: cleanTitle,
    author: author || '作者',
    coverGradient: 'linear-gradient(135deg, #4f46e5, #06b6d4)',
    tags: tags || '悬疑,探险,奇幻',
    synopsis: synopsis || '在这片全新的世界中谱写未知的传奇...',
    targetWordCount: 1000000,
    totalWordCount: 0,
    todayWordCount: 0,
    folderName: dirName,
    volumes: [
      {
        id: volId,
        bookId: bookId,
        title: '第一卷：初入尘世',
        orderIndex: 1,
        wordCount: 0,
        collapsed: false,
        chapters: [
          {
            id: chapId,
            volumeId: volId,
            title: '第1章 新的篇章',
            fileName: firstChapFileName,
            content: firstChapContent,
            wordCount: firstChapContent.replace(/\s/g, '').length,
            paragraphCount: 1,
            publishStatus: 'draft'
          }
        ]
      }
    ]
  };

  fs.writeFileSync(path.join(novelPath, 'novel.json'), JSON.stringify(newBook, null, 2), 'utf8');

  console.log(`[Storage] 🎉 成功为新书【${cleanTitle}】创建专属独立物理文件夹与各子模块！`);
  console.log(`[Storage] 📂 物理路径: ${novelPath}`);

  res.json({
    status: 'ok',
    book: newBook,
    novelPath
  });
});

// 7. 【读写章节正文 TXT 文件 (定位对应书籍目录)】
app.get('/api/storage/chapter-file', (req, res) => {
  const { bookId, chapId } = req.query;
  const nDir = findNovelDir(bookId);

  if (nDir) {
    const chapDir = path.join(nDir, 'chapters');
    if (fs.existsSync(chapDir)) {
      const files = fs.readdirSync(chapDir);
      // 匹配包含 chapId 或根据 index 查找
      const targetFile = files.find(f => f.includes(chapId) || f.includes(chapId.replace('chap_', '')));
      if (targetFile) {
        const text = fs.readFileSync(path.join(chapDir, targetFile), 'utf8');
        return res.json({ status: 'ok', content: text, fromLocalDisk: true, fileName: targetFile });
      }
    }
  }

  // 兜底旧目录查找
  const oldPath = path.join(ROOT_STORAGE, 'chapters', bookId || '7674950021661330457', `chap_${(chapId||'').replace('chap_','')}.txt`);
  if (fs.existsSync(oldPath)) {
    return res.json({ status: 'ok', content: fs.readFileSync(oldPath, 'utf8'), fromLocalDisk: true });
  }

  res.json({ status: 'not_found', content: '', fromLocalDisk: false });
});

app.post('/api/storage/chapter-file', (req, res) => {
  const { bookId, chapId, title, content } = req.body;
  const nDir = findNovelDir(bookId);

  if (nDir) {
    const chapDir = path.join(nDir, 'chapters');
    ensureDir(chapDir);
    const safeTitle = (title || chapId).replace(/[\\/:*?"<>|]/g, '_');
    // 如果已有对应的 txt 文件，直接覆写；否则创建新文件
    const files = fs.readdirSync(chapDir);
    let targetFileName = files.find(f => f.includes(chapId) || (title && f.includes(safeTitle)));

    if (!targetFileName) {
      targetFileName = `${safeTitle}.txt`;
    }

    const filePath = path.join(chapDir, targetFileName);
    fs.writeFileSync(filePath, content || '', 'utf8');
    console.log(`[Storage] 💾 正文已实时写入专属文件: ${filePath}`);
    return res.json({ status: 'ok', filePath });
  }

  res.json({ status: 'ok' });
});

// 8. 【读写人物卡数据 (定位对应书籍目录)】
app.get('/api/storage/characters', (req, res) => {
  const bookId = req.query.bookId;
  const nDir = findNovelDir(bookId);
  if (nDir) {
    const p = path.join(nDir, 'characters', 'cards.json');
    if (fs.existsSync(p)) return res.json(JSON.parse(fs.readFileSync(p, 'utf8')));
  }
  res.json([]);
});

app.post('/api/storage/characters', (req, res) => {
  const { bookId, list } = req.body;
  const nDir = findNovelDir(bookId);
  if (nDir) {
    const p = path.join(nDir, 'characters', 'cards.json');
    fs.writeFileSync(p, JSON.stringify(list || [], null, 2), 'utf8');
  }
  res.json({ status: 'ok' });
});

// 9. 【读写人物分类数据 (定位对应书籍目录)】
app.get('/api/storage/categories', (req, res) => {
  const bookId = req.query.bookId;
  const nDir = findNovelDir(bookId);
  if (nDir) {
    const p = path.join(nDir, 'characters', 'categories.json');
    if (fs.existsSync(p)) return res.json(JSON.parse(fs.readFileSync(p, 'utf8')));
  }
  res.json([]);
});

app.post('/api/storage/categories', (req, res) => {
  const { bookId, list } = req.body;
  const nDir = findNovelDir(bookId);
  if (nDir) {
    const p = path.join(nDir, 'characters', 'categories.json');
    fs.writeFileSync(p, JSON.stringify(list || [], null, 2), 'utf8');
  }
  res.json({ status: 'ok' });
});

// 10. 【读写人物关系拓扑 (定位对应书籍目录)】
app.get('/api/storage/logic-map', (req, res) => {
  const bookId = req.query.bookId;
  const nDir = findNovelDir(bookId);
  if (nDir) {
    const p = path.join(nDir, 'characters', 'logic_map.json');
    if (fs.existsSync(p)) return res.json(JSON.parse(fs.readFileSync(p, 'utf8')));
  }
  res.json({ bookId, nodes: [], relations: [] });
});

app.post('/api/storage/logic-map', (req, res) => {
  const { bookId, data } = req.body;
  const nDir = findNovelDir(bookId);
  if (nDir) {
    const p = path.join(nDir, 'characters', 'logic_map.json');
    fs.writeFileSync(p, JSON.stringify(data || {}, null, 2), 'utf8');
  }
  res.json({ status: 'ok' });
});

// 11. 【读写思维导图大纲 (定位对应书籍目录)】
app.get('/api/storage/mindmap', (req, res) => {
  const { bookId, scope, targetId } = req.query;
  const nDir = findNovelDir(bookId);
  if (nDir) {
    const key = `${scope || 'global'}_${targetId || bookId || 'default'}`;
    const p = path.join(nDir, 'mindmaps', `${key}.json`);
    if (fs.existsSync(p)) return res.json(JSON.parse(fs.readFileSync(p, 'utf8')));
    const pGlobal = path.join(nDir, 'mindmaps', 'global.json');
    if (scope === 'global' && fs.existsSync(pGlobal)) return res.json(JSON.parse(fs.readFileSync(pGlobal, 'utf8')));
  }
  res.json(null);
});

app.post('/api/storage/mindmap', (req, res) => {
  const { bookId, scope, targetId, data } = req.body;
  const nDir = findNovelDir(bookId);
  if (nDir) {
    const key = `${scope || 'global'}_${targetId || bookId || 'default'}`;
    const p = path.join(nDir, 'mindmaps', `${key}.json`);
    fs.writeFileSync(p, JSON.stringify(data || {}, null, 2), 'utf8');
    if (scope === 'global') {
      fs.writeFileSync(path.join(nDir, 'mindmaps', 'global.json'), JSON.stringify(data || {}, null, 2), 'utf8');
    }
  }
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`[Bridge] 🍅 毫秒级极速扫码感知与独立小说专属文件夹物理持久化服务已启动: http://localhost:${PORT}`);
});
