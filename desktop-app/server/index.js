const express = require('express');
const cors = require('cors');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

function startServer(openLoginCallback = null, preferredPort = 0) {
  return new Promise((resolve, reject) => {
    const app = express();
    app.use(cors());
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    // -------------------------------------------------------------
    // ⚙️ 自定义存储路径与持久化配置文件
    // -------------------------------------------------------------
    const CONFIG_FILE = path.join(os.homedir(), 'Documents', '码字神器数据', 'config.json');

    function loadConfig() {
      try {
        if (fs.existsSync(CONFIG_FILE)) {
          return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        }
      } catch (e) {}
      return {};
    }

    function saveConfig(cfg) {
      try {
        const p = path.dirname(CONFIG_FILE);
        if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
      } catch (e) {}
    }

    function getDefaultStorage() {
      const exeDir = process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(process.execPath);
      const localDir = path.join(exeDir, 'data-storage');
      try {
        if (!exeDir.includes('Program Files') && !exeDir.includes('Windows')) {
          if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
          fs.writeFileSync(path.join(localDir, '.write_test'), 'ok');
          fs.unlinkSync(path.join(localDir, '.write_test'));
          return localDir;
        }
      } catch (e) {}
      return path.join(os.homedir(), 'Documents', '码字神器数据', 'data-storage');
    }

    const cfg = loadConfig();
    let ROOT_STORAGE = (cfg.storagePath && typeof cfg.storagePath === 'string' && cfg.storagePath.trim())
      ? cfg.storagePath.trim()
      : getDefaultStorage();

    let NOVELS_DIR = path.join(ROOT_STORAGE, 'novels');
    let BACKUPS_DIR = path.join(ROOT_STORAGE, 'backups');
    let AUTH_DIR = path.join(ROOT_STORAGE, 'auth');

    function copyFolderRecursiveSync(source, target) {
      if (!fs.existsSync(source)) return;
      if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });
      const files = fs.readdirSync(source);
      for (const file of files) {
        const curSource = path.join(source, file);
        const curTarget = path.join(target, file);
        if (fs.lstatSync(curSource).isDirectory()) {
          copyFolderRecursiveSync(curSource, curTarget);
        } else {
          try {
            if (!fs.existsSync(curTarget)) {
              fs.copyFileSync(curSource, curTarget);
            }
          } catch (e) {}
        }
      }
    }

    function ensureDir(dir) {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }

    [ROOT_STORAGE, NOVELS_DIR, BACKUPS_DIR, AUTH_DIR].forEach(ensureDir);
    console.log(`[NovelCraft Server] 📂 物理数据存储根目录: ${ROOT_STORAGE}`);

    function getSafeBookDirName(title) {
      return (title || '未命名作品').trim().replace(/[\\/:*?"<>|]/g, '_');
    }

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
              if (
                meta.id === bookIdOrTitle ||
                meta.tomatoBookId === bookIdOrTitle ||
                meta.title === bookIdOrTitle ||
                name === bookIdOrTitle ||
                name.includes(bookIdOrTitle)
              ) {
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

    // 快照引擎
    const lastAutoSnapshotMap = {};

    function createBookSnapshot(bookIdOrTitle, note = '自动安全快照') {
      const nDir = findNovelDir(bookIdOrTitle);
      if (!nDir) return null;

      const dirName = path.basename(nDir);
      const bookBackupsDir = path.join(BACKUPS_DIR, dirName);
      ensureDir(bookBackupsDir);

      const jsonPath = path.join(nDir, 'novel.json');
      let novelMeta = {};
      if (fs.existsSync(jsonPath)) {
        try { novelMeta = JSON.parse(fs.readFileSync(jsonPath, 'utf8')); } catch (e) {}
      }

      const chapters = {};
      const chapDir = path.join(nDir, 'chapters');
      if (fs.existsSync(chapDir)) {
        for (const f of fs.readdirSync(chapDir)) {
          if (f.endsWith('.txt')) {
            chapters[f] = fs.readFileSync(path.join(chapDir, f), 'utf8');
          }
        }
      }

      const mindmaps = {};
      const mindmapDir = path.join(nDir, 'mindmaps');
      if (fs.existsSync(mindmapDir)) {
        for (const f of fs.readdirSync(mindmapDir)) {
          if (f.endsWith('.json')) {
            try { mindmaps[f] = JSON.parse(fs.readFileSync(path.join(mindmapDir, f), 'utf8')); } catch (e) {}
          }
        }
      }

      const characters = {};
      const charDir = path.join(nDir, 'characters');
      if (fs.existsSync(charDir)) {
        for (const f of fs.readdirSync(charDir)) {
          if (f.endsWith('.json')) {
            try { characters[f] = JSON.parse(fs.readFileSync(path.join(charDir, f), 'utf8')); } catch (e) {}
          }
        }
      }

      const foreshadows = {};
      const fDir = path.join(nDir, 'foreshadows');
      if (fs.existsSync(fDir)) {
        for (const f of fs.readdirSync(fDir)) {
          if (f.endsWith('.json')) {
            try { foreshadows[f] = JSON.parse(fs.readFileSync(path.join(fDir, f), 'utf8')); } catch (e) {}
          }
        }
      }

      const timestamp = Date.now();
      const dateStr = new Date(timestamp).toLocaleString('zh-CN', { hour12: false });
      const snapshotId = `snap_${timestamp}`;

      let totalWords = 0;
      let chapterCount = Object.keys(chapters).length;
      for (const content of Object.values(chapters)) {
        totalWords += content.replace(/\s/g, '').length;
      }

      const snapshotBundle = {
        id: snapshotId,
        timestamp,
        dateStr,
        bookId: novelMeta.id || bookIdOrTitle,
        bookTitle: novelMeta.title || dirName,
        note,
        totalWords,
        chapterCount,
        data: {
          novelMeta,
          chapters,
          mindmaps,
          characters,
          foreshadows
        }
      };

      const snapshotFile = path.join(bookBackupsDir, `${snapshotId}.json`);
      fs.writeFileSync(snapshotFile, JSON.stringify(snapshotBundle, null, 2), 'utf8');
      lastAutoSnapshotMap[dirName] = timestamp;

      return {
        id: snapshotId,
        timestamp,
        dateStr,
        note,
        totalWords,
        chapterCount,
        fileSize: fs.statSync(snapshotFile).size
      };
    }

    function restoreBookSnapshot(bookIdOrTitle, snapshotId) {
      const nDir = findNovelDir(bookIdOrTitle);
      if (!nDir) return { status: 'error', message: '未找到目标作品目录' };

      const dirName = path.basename(nDir);
      const snapshotFile = path.join(BACKUPS_DIR, dirName, `${snapshotId}.json`);
      if (!fs.existsSync(snapshotFile)) {
        return { status: 'error', message: '快照文件不存在' };
      }

      try {
        createBookSnapshot(bookIdOrTitle, '还原前自动安全备份');
        const bundle = JSON.parse(fs.readFileSync(snapshotFile, 'utf8'));
        const data = bundle.data || {};

        if (data.novelMeta) {
          fs.writeFileSync(path.join(nDir, 'novel.json'), JSON.stringify(data.novelMeta, null, 2), 'utf8');
        }

        const chapDir = path.join(nDir, 'chapters');
        ensureDir(chapDir);
        if (data.chapters) {
          for (const [fName, content] of Object.entries(data.chapters)) {
            fs.writeFileSync(path.join(chapDir, fName), String(content), 'utf8');
          }
        }

        const mindDir = path.join(nDir, 'mindmaps');
        ensureDir(mindDir);
        if (data.mindmaps) {
          for (const [fName, mData] of Object.entries(data.mindmaps)) {
            fs.writeFileSync(path.join(mindDir, fName), JSON.stringify(mData, null, 2), 'utf8');
          }
        }

        const charDir = path.join(nDir, 'characters');
        ensureDir(charDir);
        if (data.characters) {
          for (const [fName, cData] of Object.entries(data.characters)) {
            fs.writeFileSync(path.join(charDir, fName), JSON.stringify(cData, null, 2), 'utf8');
          }
        }

        const fDir = path.join(nDir, 'foreshadows');
        ensureDir(fDir);
        if (data.foreshadows) {
          for (const [fName, fData] of Object.entries(data.foreshadows)) {
            fs.writeFileSync(path.join(fDir, fName), JSON.stringify(fData, null, 2), 'utf8');
          }
        }

        return {
          status: 'ok',
          message: `成功将作品还原至【${bundle.dateStr}】快照状态！`,
          totalWords: bundle.totalWords,
          chapterCount: bundle.chapterCount
        };
      } catch (e) {
        return { status: 'error', message: `还原快照失败: ${e.message}` };
      }
    }

    // 番茄鉴权辅助
    function getTomatoAuth() {
      let cookie = '';
      let csrfToken = '';
      const accPath = path.join(AUTH_DIR, 'accounts.json');
      if (fs.existsSync(accPath)) {
        try {
          const accs = JSON.parse(fs.readFileSync(accPath, 'utf8'));
          if (Array.isArray(accs) && accs[0]) {
            cookie = accs[0].cookie || accs[0].sessionToken || '';
            csrfToken = accs[0].csrfToken || '';
          }
        } catch (e) {}
      }
      return { cookie, csrfToken };
    }

    async function tomatoMcpRequest(apiPath, params = {}) {
      const auth = getTomatoAuth();
      if (!auth.cookie) throw new Error('未检测到有效番茄作家登录态，请先点击右上角登录');
      const BASE = 'https://fanqienovel.com';
      const COMMON = { aid: '2503', app_name: 'muye_novel' };
      const qs = new URLSearchParams({ ...COMMON, ...params }).toString();
      const headers = {
        Cookie: auth.cookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json, text/plain, */*',
        Origin: BASE,
        Referer: `${BASE}/main/writer/`,
        'X-Secsdk-Csrf-Token': auth.csrfToken
      };
      const res = await fetch(`${BASE}${apiPath}?${qs}`, { headers });
      const json = await res.json();
      return json.data;
    }

    // 0. 打开本地数据目录
    app.all('/api/storage/open-folder', (req, res) => {
      exec(`explorer.exe "${ROOT_STORAGE}"`);
      res.json({ status: 'ok', path: ROOT_STORAGE });
    });

    // 1. 获取所有小说列表
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

    // 1.1 获取作品物理封面图片 (cover.jpg 或 cover.png)
    app.get('/api/storage/novel/cover', (req, res) => {
      const bookId = req.query.bookId || '';
      const nDir = findNovelDir(bookId);
      if (nDir) {
        for (const ext of ['cover.jpg', 'cover.png', 'cover.jpeg', 'cover.webp']) {
          const coverPath = path.join(nDir, ext);
          if (fs.existsSync(coverPath)) {
            const mime = ext.endsWith('png') ? 'image/png' : 'image/jpeg';
            res.setHeader('Content-Type', mime);
            return fs.createReadStream(coverPath).pipe(res);
          }
        }
      }
      res.status(404).send('Not Found');
    });

    // 2. 创建新小说 (支持纯本地独立物理建档 ＆ 番茄官方同步建书)
    app.post('/api/storage/novel/create', async (req, res) => {
      const { title, author, tags, synopsis, category, gender, syncToTomato } = req.body;
      if (!title) return res.status(400).json({ status: 'error', message: '缺少书名' });

      const rawTitle = title.trim();
      const cleanTitle = rawTitle.startsWith('《') ? rawTitle : `《${rawTitle}》`;
      const dirName = getSafeBookDirName(cleanTitle);

      const novelPath = path.join(NOVELS_DIR, dirName);
      const chaptersPath = path.join(novelPath, 'chapters');
      const mindmapsPath = path.join(novelPath, 'mindmaps');
      const charactersPath = path.join(novelPath, 'characters');
      const foreshadowsPath = path.join(novelPath, 'foreshadows');

      [novelPath, chaptersPath, mindmapsPath, charactersPath, foreshadowsPath].forEach(ensureDir);
      fs.writeFileSync(path.join(foreshadowsPath, 'items.json'), JSON.stringify([], null, 2), 'utf8');

      let tomatoBookId = '';
      let tomatoSyncError = null;

      if (syncToTomato) {
        try {
          const auth = getTomatoAuth();
          if (auth.cookie) {
            const BASE = 'https://fanqienovel.com';
            const COMMON = { aid: '2503', app_name: 'muye_novel' };
            const qs = new URLSearchParams(COMMON).toString();
            const createRes = await fetch(`${BASE}/api/author/book/create/v0/?${qs}`, {
              method: 'POST',
              headers: {
                Cookie: auth.cookie,
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0',
                Origin: BASE,
                Referer: `${BASE}/main/writer/`,
                'X-Secsdk-Csrf-Token': auth.csrfToken
              },
              body: JSON.stringify({
                book_name: rawTitle.replace(/[《》]/g, ''),
                author: author || '番茄签约作家',
                category: category || '悬疑',
                abstract: synopsis || `【番茄签约新书】${cleanTitle} 震撼上线！`,
                gender: String(gender || '1'),
                tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : ['悬疑']
              })
            });
            const tData = await createRes.json();
            if (tData.code === 0 && tData.data?.book_id) {
              tomatoBookId = String(tData.data.book_id);
            } else {
              tomatoSyncError = { hasError: true, message: tData.message || '番茄建书受限' };
            }
          } else {
            tomatoSyncError = { hasError: true, message: '未登录番茄作家账号' };
          }
        } catch (e) {
          tomatoSyncError = { hasError: true, message: e.message };
        }
      }

      const bookId = tomatoBookId ? `book_${tomatoBookId}` : `book_${Date.now()}`;
      const volId = 'vol_' + Date.now();
      const chapId = 'chap_' + Date.now();

      const firstChapFileName = '第001章 新的篇章.txt';
      const firstChapContent = `　　这里是《${cleanTitle.replace(/[《》]/g, '')}》第一章的起点，记录你的第一缕灵感与冒险...`;
      fs.writeFileSync(path.join(chaptersPath, firstChapFileName), firstChapContent, 'utf8');

      const novelMeta = {
        id: bookId,
        tomatoBookId: tomatoBookId || undefined,
        title: cleanTitle,
        author: author || '番茄签约作家',
        coverGradient: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
        tags: tags || '原创首发,连载中',
        synopsis: synopsis || '',
        targetWordCount: 1000000,
        totalWordCount: firstChapContent.replace(/\s/g, '').length,
        todayWordCount: 0,
        folderName: dirName,
        volumes: [
          {
            id: volId,
            bookId,
            title: '第一卷：初入江湖',
            orderIndex: 1,
            wordCount: firstChapContent.replace(/\s/g, '').length,
            collapsed: false,
            chapters: [
              {
                id: chapId,
                volumeId: volId,
                title: '第001章 新的篇章',
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

      fs.writeFileSync(path.join(novelPath, 'novel.json'), JSON.stringify(novelMeta, null, 2), 'utf8');

      // 初始化全局思维导图
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
              text: '💡 核心立意与设定',
              nodeType: 'branch-node',
              x: 240,
              y: 60,
              children: [{ id: `node_g_1_1_${bookId}`, text: '主角背景动机与冲突', x: 440, y: 40 }]
            }
          ]
        },
        crossLinks: []
      };
      fs.writeFileSync(path.join(mindmapsPath, 'global.json'), JSON.stringify(initialMindmap, null, 2), 'utf8');

      res.json({ status: 'ok', book: novelMeta, tomatoBookId, tomatoSyncError });
    });

    // 3. 创建新分卷
    app.post('/api/storage/volume/create', (req, res) => {
      const { bookId, title } = req.body;
      const nDir = findNovelDir(bookId);
      if (!nDir) return res.status(404).json({ status: 'error', message: '未找到作品目录' });

      const jsonPath = path.join(nDir, 'novel.json');
      if (!fs.existsSync(jsonPath)) return res.status(404).json({ status: 'error', message: '元数据不存在' });

      const meta = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      const volId = 'vol_' + Date.now();
      const newVol = {
        id: volId,
        bookId: meta.id || bookId,
        title: title || `第${(meta.volumes?.length || 0) + 1}卷`,
        orderIndex: (meta.volumes?.length || 0) + 1,
        wordCount: 0,
        collapsed: false,
        chapters: []
      };

      meta.volumes = meta.volumes || [];
      meta.volumes.push(newVol);
      fs.writeFileSync(jsonPath, JSON.stringify(meta, null, 2), 'utf8');
      res.json({ status: 'ok', volume: newVol });
    });

    // 4. 创建新章节
    app.post('/api/storage/chapter/create', (req, res) => {
      const { bookId, volumeId, title } = req.body;
      const nDir = findNovelDir(bookId);
      if (!nDir) return res.status(404).json({ status: 'error', message: '未找到作品目录' });

      const jsonPath = path.join(nDir, 'novel.json');
      const meta = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

      const chapId = 'chap_' + Date.now();
      const cleanTitle = (title || '新章节').replace(/[\\/:*?"<>|]/g, '_');
      const fileName = `${cleanTitle}.txt`;
      const initialContent = '　　在这里开始你的新篇章创作……';

      const chapDir = path.join(nDir, 'chapters');
      ensureDir(chapDir);
      fs.writeFileSync(path.join(chapDir, fileName), initialContent, 'utf8');

      const newChap = {
        id: chapId,
        volumeId,
        title: title || '新章节',
        fileName,
        content: initialContent,
        wordCount: initialContent.replace(/\s/g, '').length,
        paragraphCount: 1,
        publishStatus: 'draft'
      };

      let added = false;
      for (const vol of meta.volumes || []) {
        if (vol.id === volumeId) {
          vol.chapters = vol.chapters || [];
          vol.chapters.push(newChap);
          added = true;
          break;
        }
      }
      if (!added && meta.volumes && meta.volumes[0]) {
        meta.volumes[0].chapters.push(newChap);
      }

      fs.writeFileSync(jsonPath, JSON.stringify(meta, null, 2), 'utf8');
      res.json({ status: 'ok', chapter: newChap });
    });

    // 5. 读取章节物理正文
    app.get('/api/storage/chapter-file', (req, res) => {
      const bookId = req.query.bookId || '';
      const chapId = req.query.chapId || '';
      const nDir = findNovelDir(bookId);
      if (!nDir) return res.status(404).json({ status: 'error', message: '未找到小说目录' });

      const jsonPath = path.join(nDir, 'novel.json');
      if (fs.existsSync(jsonPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
          for (const vol of meta.volumes || []) {
            for (const chap of vol.chapters || []) {
              if (chap.id === chapId) {
                const chapFile = path.join(nDir, 'chapters', chap.fileName || `${chap.title}.txt`);
                if (fs.existsSync(chapFile)) {
                  const content = fs.readFileSync(chapFile, 'utf8');
                  return res.json({ status: 'ok', content });
                }
              }
            }
          }
        } catch (e) {}
      }
      res.status(404).json({ status: 'error', message: '章节文件不存在' });
    });

    // 6. 保存章节正文
    app.post('/api/storage/chapter-file', (req, res) => {
      const { bookId, chapterId, title, content } = req.body;
      const nDir = findNovelDir(bookId);
      if (!nDir) return res.status(404).json({ status: 'error', message: '未找到小说目录' });

      const chapDir = path.join(nDir, 'chapters');
      ensureDir(chapDir);

      const cleanTitle = (title || '未命名章节').replace(/[\\/:*?"<>|]/g, '_');
      const fileName = `${cleanTitle}.txt`;
      const filePath = path.join(chapDir, fileName);

      fs.writeFileSync(filePath, String(content || ''), 'utf8');

      // 更新 novel.json
      const jsonPath = path.join(nDir, 'novel.json');
      if (fs.existsSync(jsonPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
          let totalW = 0;
          for (const vol of meta.volumes || []) {
            let vW = 0;
            for (const chap of vol.chapters || []) {
              if (chap.id === chapterId) {
                chap.title = title;
                chap.fileName = fileName;
                chap.wordCount = String(content || '').replace(/\s/g, '').length;
              }
              vW += (chap.wordCount || 0);
              totalW += (chap.wordCount || 0);
            }
            vol.wordCount = vW;
          }
          meta.totalWordCount = totalW;
          fs.writeFileSync(jsonPath, JSON.stringify(meta, null, 2), 'utf8');
        } catch (e) {}
      }

      // 15分钟自动快照
      const bDirName = path.basename(nDir);
      const lastTime = lastAutoSnapshotMap[bDirName] || 0;
      const nowTime = Date.now();
      if (nowTime - lastTime > 15 * 60 * 1000) {
        createBookSnapshot(bookId, '每15分钟自动安全快照');
      }

      res.json({ status: 'ok' });
    });

    // 7. 修改简介
    app.post('/api/storage/synopsis', (req, res) => {
      const { bookId, synopsis } = req.body;
      const nDir = findNovelDir(bookId);
      if (nDir) {
        const jsonPath = path.join(nDir, 'novel.json');
        if (fs.existsSync(jsonPath)) {
          const meta = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
          meta.synopsis = synopsis;
          fs.writeFileSync(jsonPath, JSON.stringify(meta, null, 2), 'utf8');
        }
      }
      res.json({ status: 'ok' });
    });

    // 8. 重命名作品
    app.post('/api/storage/novel/rename', (req, res) => {
      const { bookId, newTitle } = req.body;
      const nDir = findNovelDir(bookId);
      if (nDir) {
        const jsonPath = path.join(nDir, 'novel.json');
        if (fs.existsSync(jsonPath)) {
          const meta = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
          meta.title = newTitle.startsWith('《') ? newTitle : `《${newTitle}》`;
          fs.writeFileSync(jsonPath, JSON.stringify(meta, null, 2), 'utf8');
        }
      }
      res.json({ status: 'ok' });
    });

    // 9. 读写人物卡
    app.all('/api/storage/characters', (req, res) => {
      const bookId = req.query.bookId || req.body.bookId || '';
      const nDir = findNovelDir(bookId);
      if (req.method === 'GET') {
        if (nDir) {
          const p = path.join(nDir, 'characters', 'cards.json');
          if (fs.existsSync(p)) return res.json(JSON.parse(fs.readFileSync(p, 'utf8')));
        }
        return res.json([]);
      }
      if (nDir) {
        const charDir = path.join(nDir, 'characters');
        ensureDir(charDir);
        fs.writeFileSync(path.join(charDir, 'cards.json'), JSON.stringify(req.body.list || [], null, 2), 'utf8');
      }
      res.json({ status: 'ok' });
    });

    // 10. 读写人物分类
    app.all('/api/storage/categories', (req, res) => {
      const bookId = req.query.bookId || req.body.bookId || '';
      const nDir = findNovelDir(bookId);
      if (req.method === 'GET') {
        if (nDir) {
          const p = path.join(nDir, 'characters', 'categories.json');
          if (fs.existsSync(p)) return res.json(JSON.parse(fs.readFileSync(p, 'utf8')));
        }
        return res.json([]);
      }
      if (nDir) {
        const charDir = path.join(nDir, 'characters');
        ensureDir(charDir);
        fs.writeFileSync(path.join(charDir, 'categories.json'), JSON.stringify(req.body.list || [], null, 2), 'utf8');
      }
      res.json({ status: 'ok' });
    });

    // 11. 读写人物逻辑图
    app.all('/api/storage/logic-map', (req, res) => {
      const bookId = req.query.bookId || req.body.bookId || '';
      const nDir = findNovelDir(bookId);
      if (req.method === 'GET') {
        if (nDir) {
          const p = path.join(nDir, 'characters', 'logic_map.json');
          if (fs.existsSync(p)) return res.json(JSON.parse(fs.readFileSync(p, 'utf8')));
        }
        return res.json({ bookId, nodes: [], relations: [] });
      }
      if (nDir) {
        const charDir = path.join(nDir, 'characters');
        ensureDir(charDir);
        fs.writeFileSync(path.join(charDir, 'logic_map.json'), JSON.stringify(req.body.data || {}, null, 2), 'utf8');
      }
      res.json({ status: 'ok' });
    });

    // 12. 读写思维导图
    app.all('/api/storage/mindmap', (req, res) => {
      const bookId = req.query.bookId || req.body.bookId || '';
      const scope = req.query.scope || req.body.scope || 'global';
      const targetId = req.query.targetId || req.body.targetId || bookId || 'default';
      const nDir = findNovelDir(bookId);

      if (req.method === 'GET') {
        if (nDir) {
          const key = `${scope}_${targetId}`;
          const p = path.join(nDir, 'mindmaps', `${key}.json`);
          if (fs.existsSync(p)) return res.json(JSON.parse(fs.readFileSync(p, 'utf8')));
          const pGlobal = path.join(nDir, 'mindmaps', 'global.json');
          if (scope === 'global' && fs.existsSync(pGlobal)) return res.json(JSON.parse(fs.readFileSync(pGlobal, 'utf8')));
        }
        return res.json(null);
      }

      if (nDir) {
        const mindDir = path.join(nDir, 'mindmaps');
        ensureDir(mindDir);
        const key = `${scope}_${targetId}`;
        fs.writeFileSync(path.join(mindDir, `${key}.json`), JSON.stringify(req.body.data || {}, null, 2), 'utf8');
        if (scope === 'global') {
          fs.writeFileSync(path.join(mindDir, 'global.json'), JSON.stringify(req.body.data || {}, null, 2), 'utf8');
        }
      }
      res.json({ status: 'ok' });
    });

    // 13. 读写伏笔看板
    app.all('/api/storage/foreshadows', (req, res) => {
      const bookId = req.query.bookId || req.body.bookId || '';
      const nDir = findNovelDir(bookId);
      if (req.method === 'GET') {
        if (nDir) {
          const p = path.join(nDir, 'foreshadows', 'items.json');
          if (fs.existsSync(p)) return res.json(JSON.parse(fs.readFileSync(p, 'utf8')));
        }
        return res.json([]);
      }
      if (nDir) {
        const fDir = path.join(nDir, 'foreshadows');
        ensureDir(fDir);
        fs.writeFileSync(path.join(fDir, 'items.json'), JSON.stringify(req.body.list || [], null, 2), 'utf8');
      }
      res.json({ status: 'ok' });
    });

    // 14. 快照管理
    app.get('/api/storage/backups', (req, res) => {
      const bookId = req.query.bookId || '';
      const nDir = findNovelDir(bookId);
      if (!nDir) return res.json([]);
      const dirName = path.basename(nDir);
      const bookBackupsDir = path.join(BACKUPS_DIR, dirName);
      ensureDir(bookBackupsDir);
      const files = fs.readdirSync(bookBackupsDir).filter(f => f.endsWith('.json'));
      const snapshots = [];
      for (const f of files) {
        try {
          const p = path.join(bookBackupsDir, f);
          const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
          snapshots.push({
            id: raw.id,
            timestamp: raw.timestamp,
            dateStr: raw.dateStr,
            note: raw.note,
            totalWords: raw.totalWords,
            chapterCount: raw.chapterCount,
            fileSize: fs.statSync(p).size
          });
        } catch (e) {}
      }
      snapshots.sort((a, b) => b.timestamp - a.timestamp);
      res.json(snapshots);
    });

    app.post('/api/storage/backups/create', (req, res) => {
      const { bookId, note } = req.body;
      const snapshot = createBookSnapshot(bookId, note || '手动安全快照');
      if (snapshot) return res.json({ status: 'ok', snapshot });
      res.status(400).json({ status: 'error', message: '无法创建快照' });
    });

    app.post('/api/storage/backups/restore', (req, res) => {
      const { bookId, snapshotId } = req.body;
      const result = restoreBookSnapshot(bookId, snapshotId);
      res.json(result);
    });

    app.post('/api/storage/backups/delete', (req, res) => {
      const { bookId, snapshotId } = req.body;
      const nDir = findNovelDir(bookId);
      if (nDir) {
        const dirName = path.basename(nDir);
        const p = path.join(BACKUPS_DIR, dirName, `${snapshotId}.json`);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }
      res.json({ status: 'ok' });
    });

    // 15. 番茄官方登录与桥接
    app.get('/api/bridge/qrcode', async (req, res) => {
      if (typeof openLoginCallback === 'function') {
        const qrResult = await openLoginCallback();
        return res.json(qrResult || { status: 'error', message: '未能捕获官方二维码' });
      }
      res.json({ status: 'error', message: '未注册二维码获取回调' });
    });
    app.all('/api/bridge/open-window', (req, res) => {
      if (typeof openLoginCallback === 'function') {
        openLoginCallback();
        return res.json({ status: 'ok', message: '已呼出官方登录窗口' });
      }
      res.json({ status: 'error', message: '未注册原生登录回调' });
    });

    app.get('/api/bridge/check-login', (req, res) => {
      const auth = getTomatoAuth();
      if (auth.cookie) {
        return res.json({
          status: 'success',
          cookie: auth.cookie,
          authorName: '番茄签约作家'
        });
      }
      res.json({ status: 'waiting' });
    });

    app.get('/api/mcp/status', (req, res) => {
      const auth = getTomatoAuth();
      res.json({
        connected: !!auth.cookie,
        hasCsrf: !!auth.csrfToken,
        accountName: auth.cookie ? '番茄签约作家' : '未连接'
      });
    });

    // 16. 从番茄拉取书籍
    app.get('/api/mcp/novels', async (req, res) => {
      try {
        const data = await tomatoMcpRequest('/api/author/book/book_list/v0', { page_index: 0, page_count: 50 });
        const list = Array.isArray(data) ? data : (data?.book_list || data?.list || []);
        res.json({ status: 'ok', count: list.length, novels: list });
      } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
      }
    });

    // 托管前端静态页面
    const distPath = path.join(__dirname, '..', 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        if (!req.path.startsWith('/api')) {
          res.sendFile(path.join(distPath, 'index.html'));
        }
      });
    }

    const server = http.createServer(app);
    server.listen(preferredPort, '127.0.0.1', () => {
      const port = server.address().port;
      console.log(`[NovelCraft Desktop Server] 🚀 服务已就绪: http://127.0.0.1:${port}`);
      resolve(port);
    });

    server.on('error', reject);
  });
}

module.exports = { startServer };
