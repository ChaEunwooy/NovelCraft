import type { Plugin } from 'vite';
import fs from 'fs';
import path from 'path';

export function localDiskStoragePlugin(): Plugin {
  return {
    name: 'vite-plugin-local-disk-storage',
    configureServer(server) {
      const rootDir = path.resolve(__dirname, '..', '..');
      const ROOT_STORAGE = path.join(rootDir, 'data-storage');
      const NOVELS_DIR = path.join(ROOT_STORAGE, 'novels');
      const BACKUPS_DIR = path.join(ROOT_STORAGE, 'backups');

      function ensureDir(dir: string) {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      }

      ensureDir(NOVELS_DIR);
      ensureDir(BACKUPS_DIR);

      // 上次自动快照时间戳缓存 (按书名/ID隔离)
      const lastAutoSnapshotMap: Record<string, number> = {};

      function createBookSnapshot(bookIdOrTitle: string, note = '自动安全快照'): any {
        const nDir = findNovelDir(bookIdOrTitle);
        if (!nDir) return null;

        const dirName = path.basename(nDir);
        const bookBackupsDir = path.join(BACKUPS_DIR, dirName);
        ensureDir(bookBackupsDir);

        const jsonPath = path.join(nDir, 'novel.json');
        let novelMeta: any = {};
        if (fs.existsSync(jsonPath)) {
          try { novelMeta = JSON.parse(fs.readFileSync(jsonPath, 'utf8')); } catch (e) {}
        }

        // 读取所有章节物理 TXT
        const chapters: Record<string, string> = {};
        const chapDir = path.join(nDir, 'chapters');
        if (fs.existsSync(chapDir)) {
          for (const f of fs.readdirSync(chapDir)) {
            if (f.endsWith('.txt')) {
              chapters[f] = fs.readFileSync(path.join(chapDir, f), 'utf8');
            }
          }
        }

        // 读取大纲导图
        const mindmaps: Record<string, any> = {};
        const mindmapDir = path.join(nDir, 'mindmaps');
        if (fs.existsSync(mindmapDir)) {
          for (const f of fs.readdirSync(mindmapDir)) {
            if (f.endsWith('.json')) {
              try { mindmaps[f] = JSON.parse(fs.readFileSync(path.join(mindmapDir, f), 'utf8')); } catch (e) {}
            }
          }
        }

        // 读取人物与伏笔
        const characters: Record<string, any> = {};
        const charDir = path.join(nDir, 'characters');
        if (fs.existsSync(charDir)) {
          for (const f of fs.readdirSync(charDir)) {
            if (f.endsWith('.json')) {
              try { characters[f] = JSON.parse(fs.readFileSync(path.join(charDir, f), 'utf8')); } catch (e) {}
            }
          }
        }

        const foreshadows: Record<string, any> = {};
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

        console.log(`[ViteStorage] 🛡️ 成功为《${novelMeta.title || dirName}》生成完整物理快照备份 (字数: ${totalWords.toLocaleString()}，章节: ${chapterCount})！`);
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

      function restoreBookSnapshot(bookIdOrTitle: string, snapshotId: string): any {
        const nDir = findNovelDir(bookIdOrTitle);
        if (!nDir) return { status: 'error', message: '未找到目标作品目录' };

        const dirName = path.basename(nDir);
        const snapshotFile = path.join(BACKUPS_DIR, dirName, `${snapshotId}.json`);
        if (!fs.existsSync(snapshotFile)) {
          return { status: 'error', message: '快照文件不存在' };
        }

        try {
          // 1. 还原前先自动对当前状态做一个安全回滚快照
          createBookSnapshot(bookIdOrTitle, '还原前自动安全备份');

          const bundle = JSON.parse(fs.readFileSync(snapshotFile, 'utf8'));
          const data = bundle.data || {};

          // 2. 还原 novel.json
          if (data.novelMeta) {
            fs.writeFileSync(path.join(nDir, 'novel.json'), JSON.stringify(data.novelMeta, null, 2), 'utf8');
          }

          // 3. 还原 chapters/
          const chapDir = path.join(nDir, 'chapters');
          ensureDir(chapDir);
          if (data.chapters) {
            for (const [fName, content] of Object.entries(data.chapters)) {
              fs.writeFileSync(path.join(chapDir, fName), String(content), 'utf8');
            }
          }

          // 4. 还原 mindmaps/
          const mindDir = path.join(nDir, 'mindmaps');
          ensureDir(mindDir);
          if (data.mindmaps) {
            for (const [fName, mData] of Object.entries(data.mindmaps)) {
              fs.writeFileSync(path.join(mindDir, fName), JSON.stringify(mData, null, 2), 'utf8');
            }
          }

          // 5. 还原 characters/
          const charDir = path.join(nDir, 'characters');
          ensureDir(charDir);
          if (data.characters) {
            for (const [fName, cData] of Object.entries(data.characters)) {
              fs.writeFileSync(path.join(charDir, fName), JSON.stringify(cData, null, 2), 'utf8');
            }
          }

          // 6. 还原 foreshadows/
          const fDir = path.join(nDir, 'foreshadows');
          ensureDir(fDir);
          if (data.foreshadows) {
            for (const [fName, fData] of Object.entries(data.foreshadows)) {
              fs.writeFileSync(path.join(fDir, fName), JSON.stringify(fData, null, 2), 'utf8');
            }
          }

          console.log(`[ViteStorage] 🔄 成功将作品《${bundle.bookTitle || dirName}》还原至快照【${bundle.dateStr}】！`);
          return {
            status: 'ok',
            message: `成功将作品还原至【${bundle.dateStr}】快照状态！`,
            totalWords: bundle.totalWords,
            chapterCount: bundle.chapterCount
          };
        } catch (e: any) {
          console.error('[ViteStorage] 还原快照失败:', e);
          return { status: 'error', message: `还原快照失败: ${e.message}` };
        }
      }

      function getSafeBookDirName(title: string) {
        return (title || '未命名作品').trim().replace(/[\\/:*?"<>|]/g, '_');
      }

      function findNovelDir(bookIdOrTitle: string): string | null {
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

      // 🚀 硬盘物理文件毫秒级热监听与 WebSocket 双向实时广播（无需手动刷新）
      let watchTimer: any = null;
      try {
        fs.watch(NOVELS_DIR, { recursive: true }, (eventType, filename) => {
          if (!filename) return;
          if (watchTimer) clearTimeout(watchTimer);
          watchTimer = setTimeout(() => {
            server.ws.send({
              type: 'custom',
              event: 'novelcraft:disk-changed',
              data: { filename: String(filename), timestamp: Date.now() }
            });
          }, 100);
        });
      } catch (e) {
        console.warn('[ViteStorage] 物理文件热监听启动异常:', e);
      }

      // 🚀 自动随 Vite 同步启动番茄免密登录与扫码服务 (实现1条指令启动全套系统)
      let bridgeProcess: any = null;
      try {
        const bridgeScript = path.resolve(ROOT_STORAGE, '../server-bridge/index.js');
        const bridgeDir = path.resolve(ROOT_STORAGE, '../server-bridge');
        if (fs.existsSync(bridgeScript)) {
          fetch('http://localhost:5201/api/bridge/check-login').catch(() => {
            console.log('[ViteStorage] 🍅 正在同步启动番茄官方免密扫码登录服务 (server-bridge)...');
            import('child_process').then(({ spawn }) => {
              bridgeProcess = spawn('node', [bridgeScript], {
                cwd: bridgeDir,
                stdio: 'ignore'
              });
            });
          });
        }
      } catch (err) {
        console.warn('[ViteStorage] 桥接服务自动拉起异常:', err);
      }

      process.on('exit', () => {
        if (bridgeProcess) bridgeProcess.kill();
      });

      function getTomatoMcpAuth() {
        const envPath = 'C:\\Users\\YT\\.gemini\\antigravity\\scratch\\tomato-writer-mcp\\.env';
        let cookie = '';
        let csrfToken = '';
        if (fs.existsSync(envPath)) {
          const raw = fs.readFileSync(envPath, 'utf8');
          for (const line of raw.split('\n')) {
            const trimmed = line.trim();
            if (trimmed.startsWith('TOMATO_COOKIE=')) {
              cookie = trimmed.slice('TOMATO_COOKIE='.length);
            } else if (trimmed.startsWith('TOMATO_CSRF_TOKEN=')) {
              csrfToken = trimmed.slice('TOMATO_CSRF_TOKEN='.length);
            }
          }
        }
        if (!cookie) {
          const accPath = path.join(ROOT_STORAGE, 'tomato', 'accounts.json');
          if (fs.existsSync(accPath)) {
            try {
              const accs = JSON.parse(fs.readFileSync(accPath, 'utf8'));
              if (Array.isArray(accs) && accs[0]) {
                cookie = accs[0].cookie || accs[0].sessionToken || '';
                csrfToken = accs[0].csrfToken || '';
              }
            } catch (e) {}
          }
        }
        return { cookie, csrfToken };
      }

      async function tomatoMcpRequest(apiPath: string, params: Record<string, any> = {}) {
        const auth = getTomatoMcpAuth();
        if (!auth.cookie) throw new Error('未检测到有效番茄作家 MCP 登录态');
        const BASE = 'https://fanqienovel.com';
        const COMMON = { aid: '2503', app_name: 'muye_novel' };
        const qs = new URLSearchParams({ ...COMMON, ...params }).toString();
        const headers: any = {
          Cookie: auth.cookie,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'application/json, text/plain, */*',
          Origin: BASE,
          Referer: `${BASE}/main/writer/`,
          'X-Secsdk-Csrf-Token': auth.csrfToken
        };
        const res = await fetch(`${BASE}${apiPath}?${qs}`, { headers });
        const json: any = await res.json();
        return json.data;
      }

      // 注册 Vite 开发服务器中间件，直接截获 /api/storage/* 和 /api/mcp/*
      server.middlewares.use(async (req, res, next) => {
        const urlStr = req.url || '';
        if (!urlStr.startsWith('/api/storage') && !urlStr.startsWith('/api/mcp')) {
          return next();
        }

        const parsedUrl = new URL(urlStr, 'http://localhost');
        const pathname = parsedUrl.pathname;

        // 辅助读取请求体
        const parseJsonBody = (callback: (body: any) => void) => {
          let bodyData = '';
          req.on('data', chunk => {
            bodyData += chunk;
          });
          req.on('end', () => {
            try {
              const parsed = bodyData ? JSON.parse(bodyData) : {};
              callback(parsed);
            } catch (err) {
              callback({});
            }
          });
        };

        const sendJson = (data: any, statusCode = 200) => {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.statusCode = statusCode;
          res.end(JSON.stringify(data));
        };

        // 1. 获取所有小说列表
        if (pathname === '/api/storage/novels' && req.method === 'GET') {
          ensureDir(NOVELS_DIR);
          const entries = fs.readdirSync(NOVELS_DIR);
          const bookList: any[] = [];
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
          return sendJson(bookList);
        }

        // 1.1 获取作品物理封面图片 (cover.jpg 或 cover.png)
        if (pathname === '/api/storage/novel/cover' && req.method === 'GET') {
          const bookId = parsedUrl.searchParams.get('bookId') || '';
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
          res.statusCode = 404;
          return res.end('Not Found');
        }

        // 2. 创建新小说独立文件夹与全套工程骨架 (支持同步在番茄后台创建)
        if (pathname === '/api/storage/novel/create' && req.method === 'POST') {
          return parseJsonBody(async body => {
            const { title, author, tags, synopsis, category, gender, syncToTomato } = body;
            if (!title) return sendJson({ status: 'error', message: '缺少书名' }, 400);

            const rawTitle = title.trim();
            const cleanTitle = rawTitle.startsWith('《') ? rawTitle : `《${rawTitle}》`;
            const dirName = getSafeBookDirName(cleanTitle);

            let tomatoBookId = '';
            let tomatoSyncError: any = null;

            // 如果开启了番茄同步创建
            if (syncToTomato) {
              try {
                const pureBookName = cleanTitle.replace(/[《》]/g, '');
                const createRes = await tomatoMcpRequest('/api/author/book/create_book/v1', {
                  book_name: pureBookName,
                  abstract: synopsis || `【番茄签约新书】${cleanTitle} 震撼上线，敬请关注！`,
                  category_id: category === '悬疑' ? '24' : category === '都市' ? '1' : category === '玄幻' ? '2' : '24',
                  gender: gender || '1',
                  tags: tags || '悬疑,探险',
                  need_first_chapter: 0
                });
                if (createRes?.book_id) {
                  tomatoBookId = String(createRes.book_id);
                  tomatoCreationNote = `已在番茄作家后台成功创建 (ID: ${tomatoBookId})`;
                  console.log(`[ViteStorage] 🍅 成功在番茄后台同步创建新书【${cleanTitle}】(ID: ${tomatoBookId})！`);
                }
              } catch (err: any) {
                const errMsg = err?.message || '';
                console.warn('[ViteStorage] 番茄作家后台线上创建新书提示:', errMsg);
                let friendlyReason = `【番茄官方反馈】：${errMsg || '线上建书服务响应异常'}`;
                let suggestions = ['您可先在本地撰写大纲与前三章，稍后再次同步'];
                let errorType: 'warning' | 'error' | 'limit' | 'auth' = 'warning';

                if (errMsg.includes('上限') || errMsg.includes('limit') || errMsg.includes('频率')) {
                  errorType = 'limit';
                  friendlyReason = '您今日在番茄平台创建新书已达官方单日上限，番茄官方暂时限制继续在线建书。';
                  suggestions = [
                    '番茄作者账号每日创建新书有严格配额限制',
                    '本地物理工程已为您完整创建并安全保存，您可照常创作，明日一键推送到线上'
                  ];
                } else if (errMsg.includes('存在') || errMsg.includes('重复') || errMsg.includes('占用')) {
                  errorType = 'error';
                  friendlyReason = '该书名已被其他签约作者占用，线上建书失败。';
                  suggestions = [
                    '建议在书名中增加副标题（如《走马楼笔记：地下盲谷》）以提高辨识度与签约过审率',
                    '或者稍后在作品卡片中直接重命名书名'
                  ];
                }

                tomatoSyncError = {
                  hasError: true,
                  errorType,
                  title: '番茄云端新书同步限制',
                  message: friendlyReason,
                  details: {
                    rawTomatoMsg: errMsg
                  },
                  suggestions
                };
                tomatoCreationNote = '本地已建档 (番茄线上限制)';
              }
            }

            const novelPath = path.join(NOVELS_DIR, dirName);
            const chaptersPath = path.join(novelPath, 'chapters');
            const mindmapsPath = path.join(novelPath, 'mindmaps');
            const charactersPath = path.join(novelPath, 'characters');
            const foreshadowsPath = path.join(novelPath, 'foreshadows');

            [novelPath, chaptersPath, mindmapsPath, charactersPath, foreshadowsPath].forEach(ensureDir);
            fs.writeFileSync(path.join(foreshadowsPath, 'items.json'), JSON.stringify([], null, 2), 'utf8');

            const bookId = 'book_' + Date.now();
            const volId = 'vol_' + Date.now();
            const chapId = 'chap_' + Date.now();

            const firstChapFileName = '第001章 新的篇章.txt';
            const firstChapContent = `　　这里是《${cleanTitle.replace(/[《》]/g, '')}》第一章的起点，记录你的第一缕灵感与冒险...`;
            fs.writeFileSync(path.join(chaptersPath, firstChapFileName), firstChapContent, 'utf8');

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

            const initialCats = [
              { id: 'cat_main', bookId, name: '核心主角团', orderIndex: 1 },
              { id: 'cat_others', bookId, name: '重要配角', orderIndex: 2 }
            ];
            fs.writeFileSync(path.join(charactersPath, 'categories.json'), JSON.stringify(initialCats, null, 2), 'utf8');
            fs.writeFileSync(path.join(charactersPath, 'cards.json'), JSON.stringify([], null, 2), 'utf8');
            fs.writeFileSync(path.join(charactersPath, 'logic_map.json'), JSON.stringify({ bookId, nodes: [], relations: [] }, null, 2), 'utf8');

            const newBook = {
              id: bookId,
              tomatoBookId: tomatoBookId || '',
              title: cleanTitle,
              author: author || '番茄签约作家',
              coverGradient: 'linear-gradient(135deg, #4f46e5, #06b6d4)',
              tags: tags || '悬疑,探险',
              synopsis: synopsis || '',
              targetWordCount: 1000000,
              totalWordCount: 0,
              todayWordCount: 0,
              folderName: dirName,
              volumes: [
                {
                  id: volId,
                  bookId,
                  title: '第一卷：开端篇',
                  orderIndex: 1,
                  wordCount: 0,
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
                      publishStatus: 'unpushed'
                    }
                  ]
                }
              ]
            };

            fs.writeFileSync(path.join(novelPath, 'novel.json'), JSON.stringify(newBook, null, 2), 'utf8');
            console.log(`[ViteStorage] 🎉 成功为新书【${cleanTitle}】在磁盘创建自包含物理目录！`);
            sendJson({ status: 'ok', book: newBook, novelPath, tomatoBookId, tomatoSyncError });
          });
        }

        // 2.05 重命名整本书 (同步重命名物理文件夹与 novel.json)
        if (pathname === '/api/storage/novel/rename' && req.method === 'POST') {
          return parseJsonBody(body => {
            const { bookId, newTitle } = body;
            if (!bookId || !newTitle) return sendJson({ status: 'error', message: '缺少参数' }, 400);
            const cleanTitle = (newTitle || '').trim().startsWith('《') ? newTitle.trim() : `《${newTitle.trim()}》`;
            const nDir = findNovelDir(bookId);
            if (nDir) {
              const jsonPath = path.join(nDir, 'novel.json');
              try {
                let meta: any = {};
                if (fs.existsSync(jsonPath)) {
                  meta = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
                }
                const oldTitle = meta.title;
                const newDirName = getSafeBookDirName(cleanTitle);
                const newNovelPath = path.join(NOVELS_DIR, newDirName);

                meta.title = cleanTitle;
                meta.folderName = newDirName;
                fs.writeFileSync(jsonPath, JSON.stringify(meta, null, 2), 'utf8');

                // 若文件夹名变化且目标路径不存在，执行物理重命名
                if (nDir !== newNovelPath && !fs.existsSync(newNovelPath)) {
                  fs.renameSync(nDir, newNovelPath);
                  console.log(`[ViteStorage] 📂 成功将作品目录【${oldTitle}】重命名为【${newDirName}】！`);
                }
                console.log(`[ViteStorage] 💾 成功更新作品标题为【${cleanTitle}】！`);
                return sendJson({ status: 'ok', title: cleanTitle, folderName: newDirName });
              } catch (e) {
                console.error('[ViteStorage] 重命名书籍失败:', e);
              }
            }
            sendJson({ status: 'ok' });
          });
        }

        // 2.1 更新小说元数据 (分卷名/章节名/简介/总字数等即时落盘至 novel.json)
        if ((pathname === '/api/storage/novels/update' || pathname === '/api/storage/books') && req.method === 'POST') {
          return parseJsonBody(body => {
            const book = body.book || body;
            if (!book || (!book.id && !book.title)) return sendJson({ status: 'ignored' });
            const nDir = findNovelDir(book.id) || findNovelDir(book.title);
            if (nDir) {
              const jsonPath = path.join(nDir, 'novel.json');
              try {
                let oldMeta: any = {};
                if (fs.existsSync(jsonPath)) {
                  oldMeta = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
                }
                const merged = { ...oldMeta, ...book };
                fs.writeFileSync(jsonPath, JSON.stringify(merged, null, 2), 'utf8');
                console.log(`[ViteStorage] 💾 成功将作品【${book.title}】的最新分卷与章节元数据落盘至 novel.json！`);
                return sendJson({ status: 'ok', updated: true });
              } catch (err) {
                console.error('[ViteStorage] novel.json 写入失败:', err);
              }
            }
            sendJson({ status: 'ok' });
          });
        }

        // 2.2 分卷重命名独立持久化
        if (pathname === '/api/storage/volume/rename' && req.method === 'POST') {
          return parseJsonBody(body => {
            const { bookId, volumeId, title } = body;
            const nDir = findNovelDir(bookId);
            if (nDir) {
              const jsonPath = path.join(nDir, 'novel.json');
              if (fs.existsSync(jsonPath)) {
                try {
                  const nMeta = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
                  let found = false;
                  for (const v of nMeta.volumes || []) {
                    if (v.id === volumeId) {
                      v.title = (title || v.title).trim();
                      found = true;
                      break;
                    }
                  }
                  if (found) {
                    fs.writeFileSync(jsonPath, JSON.stringify(nMeta, null, 2), 'utf8');
                    console.log(`[ViteStorage] 💾 成功更新分卷名【${title}】至 novel.json！`);
                  }
                  return sendJson({ status: 'ok' });
                } catch (e) {}
              }
            }
            sendJson({ status: 'ok' });
          });
        }

        // 2.3 新建章节独立落盘
        if (pathname === '/api/storage/chapter/create' && req.method === 'POST') {
          return parseJsonBody(body => {
            const { bookId, volumeId, chapter } = body;
            const nDir = findNovelDir(bookId);
            if (nDir && chapter) {
              const chapDir = path.join(nDir, 'chapters');
              ensureDir(chapDir);
              const safeTitle = (chapter.title || '新章节').replace(/[\\/:*?"<>|]/g, '_');
              const fileName = `${safeTitle}.txt`;
              const filePath = path.join(chapDir, fileName);
              if (!fs.existsSync(filePath)) {
                fs.writeFileSync(filePath, chapter.content || '', 'utf8');
              }
              const jsonPath = path.join(nDir, 'novel.json');
              if (fs.existsSync(jsonPath)) {
                try {
                  const nMeta = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
                  let volFound = false;
                  for (const v of nMeta.volumes || []) {
                    if (v.id === volumeId) {
                      if (!v.chapters) v.chapters = [];
                      const exists = v.chapters.some((c: any) => c.id === chapter.id);
                      if (!exists) {
                        v.chapters.push({
                          id: chapter.id,
                          volumeId,
                          title: chapter.title,
                          fileName,
                          content: chapter.content || '',
                          wordCount: (chapter.content || '').replace(/\s/g, '').length,
                          paragraphCount: 0,
                          publishStatus: 'draft'
                        });
                        volFound = true;
                      }
                      break;
                    }
                  }
                  if (volFound) {
                    fs.writeFileSync(jsonPath, JSON.stringify(nMeta, null, 2), 'utf8');
                    console.log(`[ViteStorage] 💾 成功将新章节【${chapter.title}】落盘至 novel.json 及物理 TXT！`);
                  }
                } catch (e) {}
              }
              return sendJson({ status: 'ok', fileName, filePath });
            }
            sendJson({ status: 'ok' });
          });
        }

        // 2.4 新建分卷独立落盘
        if (pathname === '/api/storage/volume/create' && req.method === 'POST') {
          return parseJsonBody(body => {
            const { bookId, volume } = body;
            const nDir = findNovelDir(bookId);
            if (nDir && volume) {
              const jsonPath = path.join(nDir, 'novel.json');
              if (fs.existsSync(jsonPath)) {
                try {
                  const nMeta = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
                  if (!nMeta.volumes) nMeta.volumes = [];
                  const exists = nMeta.volumes.some((v: any) => v.id === volume.id);
                  if (!exists) {
                    nMeta.volumes.push(volume);
                    fs.writeFileSync(jsonPath, JSON.stringify(nMeta, null, 2), 'utf8');
                    console.log(`[ViteStorage] 💾 成功将新分卷【${volume.title}】落盘至 novel.json！`);
                  }
                } catch (e) {}
              }
            }
            sendJson({ status: 'ok' });
          });
        }

        // 2.5 提交章节至番茄平台（存草稿/正式发布/重新提交修改），包含前置字数校验与官方错误诊断报告
        if (pathname === '/api/storage/novel/publish-chapter' && req.method === 'POST') {
          return parseJsonBody(async body => {
            const { bookId, chapterId, title, content, publishType } = body;
            const pureTitle = (title || '').trim();
            const pureContent = (content || '');
            const wordCount = pureContent.replace(/\s/g, '').length;

            // 1. 前置校验：标题规范
            if (!pureTitle) {
              return sendJson({
                status: 'error',
                errorCode: 'TITLE_EMPTY',
                errorType: 'warning',
                title: '章节标题不能为空',
                message: '请输入清晰规范的章节名称（如：第10章 绝壁逢生），标题不能留空。',
                suggestions: ['在上方章节标题输入框中填写章节名称后再试']
              }, 400);
            }

            if (pureTitle.length > 35) {
              return sendJson({
                status: 'error',
                errorCode: 'TITLE_TOO_LONG',
                errorType: 'warning',
                title: '章节标题过长',
                message: `当前标题长度为 ${pureTitle.length} 字，番茄官方单章标题上限为 35 字。`,
                suggestions: ['建议精简章节标题至 30 字以内']
              }, 400);
            }

            // 2. 前置校验：字数上下限（存草稿最低50字，正式发布签约作品要求1000~20000字）
            if (publishType === 'publish' || publishType === 'modify') {
              if (wordCount < 1000) {
                return sendJson({
                  status: 'error',
                  errorCode: 'WORD_COUNT_TOO_LOW',
                  errorType: 'warning',
                  title: '章节字数不足（低于番茄签约标准）',
                  message: `当前单章正文字数仅为 ${wordCount.toLocaleString()} 字。番茄小说官方要求正式发布的章节单章至少达到 1,000 字（推荐 2,000 ~ 3,500 字最佳）。`,
                  details: {
                    currentWords: wordCount,
                    limitWords: '1,000 ~ 20,000 字'
                  },
                  suggestions: [
                    '继续充实本章人物对话、动作描写与环境渲染，字数满 1,000 字后再正式提交发布',
                    '或者点击【🍅 存番茄草稿】，先将文稿暂存至番茄后台草稿箱中'
                  ],
                  actionType: 'save-local'
                }, 400);
              }
            }

            if (wordCount > 20000) {
              return sendJson({
                status: 'error',
                errorCode: 'WORD_COUNT_TOO_HIGH',
                errorType: 'limit',
                title: '章节字数超出上限（超过平台单章物理限制）',
                message: `当前单章正文字数达 ${wordCount.toLocaleString()} 字，已超过番茄官方单章 20,000 字的物理限制，平台审核系统将强制拒收！`,
                details: {
                  currentWords: wordCount,
                  limitWords: '上限 20,000 字 / 章'
                },
                suggestions: [
                  '建议将本章拆分为【上篇】与【下篇】（或两个独立章节）后再分别提交',
                  '单章保持在 2,000 ~ 4,000 字能够给读者带来最佳的追读体验与翻页留存率'
                ],
                actionType: 'save-local'
              }, 400);
            }

            // 3. 寻找本地小说及番茄关联信息
            const nDir = findNovelDir(bookId);
            if (!nDir) {
              return sendJson({
                status: 'error',
                errorCode: 'NOVEL_NOT_FOUND',
                errorType: 'error',
                title: '未找到本地作品',
                message: '无法在磁盘定位当前作品工程目录。'
              }, 404);
            }

            const jsonPath = path.join(nDir, 'novel.json');
            let nMeta: any = {};
            if (fs.existsSync(jsonPath)) {
              try { nMeta = JSON.parse(fs.readFileSync(jsonPath, 'utf8')); } catch (e) {}
            }

            const tomatoBookId = nMeta.tomatoBookId || (nMeta.id ? nMeta.id.replace(/^book_/, '') : '');
            if (!tomatoBookId) {
              return sendJson({
                status: 'error',
                errorCode: 'NO_TOMATO_BOOK_ID',
                errorType: 'warning',
                title: '未关联番茄线上作品',
                message: '当前作品尚未在番茄作家专区关联对应的线上签约作品，请先点击【🍅 MCP 同步】或在建书时勾选同步建书。',
                suggestions: [
                  '在侧边栏点击【🍅 MCP 同步】拉取或关联番茄线上作品',
                  '本章已在本地磁盘毫秒级安全存储，文稿绝不丢失'
                ]
              }, 400);
            }

            // 4. 调用番茄官方发布接口
            try {
              let targetChap: any = null;
              for (const v of nMeta.volumes || []) {
                for (const c of v.chapters || []) {
                  if (c.id === chapterId || c.title === pureTitle) {
                    targetChap = c;
                    break;
                  }
                }
                if (targetChap) break;
              }

              let itemId = targetChap?.tomatoChapterId;
              if (!itemId) {
                // 先在番茄创建草稿获取 itemId
                const draftRes = await tomatoMcpRequest('/api/author/draft/new_draft/v1', {
                  book_id: tomatoBookId
                });
                itemId = draftRes?.item_id || draftRes?.data?.item_id;
              }

              const isDraft = publishType === 'draft';
              const pubRes = await tomatoMcpRequest('/api/author/publish_article/v0/', {
                item_id: itemId,
                book_id: tomatoBookId,
                content: pureContent,
                title: pureTitle,
                publish_status: isDraft ? 0 : 1,
                need_pay: 0,
                use_ai: 2,
                device_platform: 'pc'
              });

              if (targetChap) {
                targetChap.publishStatus = isDraft ? 'draft' : 'published';
                targetChap.tomatoChapterId = String(itemId);
                targetChap.onlineWordCount = wordCount;
                targetChap.lastPushedAt = new Date().toLocaleTimeString();
                fs.writeFileSync(jsonPath, JSON.stringify(nMeta, null, 2), 'utf8');
              }

              console.log(`[ViteStorage] 🍅 成功向番茄平台提交【${pureTitle}】(状态: ${isDraft ? '草稿' : '已发稿'})！`);
              return sendJson({
                status: 'ok',
                publishStatus: isDraft ? 'draft' : 'published',
                tomatoChapterId: String(itemId),
                message: isDraft
                  ? `🍅 成功存入番茄草稿箱！章节【${pureTitle}】(字数: ${wordCount})`
                  : `🚀 成功发表至番茄小说！章节【${pureTitle}】已进入审核发售流程`
              });
            } catch (err: any) {
              const errMsg = err?.message || '番茄接口返回异常';
              let errType: 'warning' | 'error' | 'limit' | 'auth' = 'error';
              let friendlyTitle = '番茄平台提交被拦截';
              let friendlyMessage = `【番茄官方反馈】：${errMsg}`;
              let suggestions = ['稍后重试或检查番茄作家助手状态'];
              let actionType: 'relogin' | 'save-local' | 'none' = 'save-local';

              if (errMsg.includes('上限') || errMsg.includes('limit') || errMsg.includes('频率') || errMsg.includes('频次')) {
                errType = 'limit';
                friendlyTitle = '今日发布频次已达上限';
                friendlyMessage = `番茄官方限制作者账号单日最大发章数量。当前触发提示：【${errMsg}】。`;
                suggestions = [
                  '您今天在番茄平台发布的章节已达上限，平台暂时限制继续推送',
                  '文稿已在本地物理硬盘安全保存，可先继续构思创作后续章节，明日一键提交'
                ];
              } else if (errMsg.includes('cookie') || errMsg.includes('token') || errMsg.includes('登录') || errMsg.includes('auth') || errMsg.includes('未登录')) {
                errType = 'auth';
                friendlyTitle = '番茄作家账号登录态已过期';
                friendlyMessage = '检测到您当前的番茄作家后台凭证已失效或未登录，无法直接推送至平台。';
                suggestions = [
                  '点击下方【重新扫码登录番茄】按钮，1 秒即可更新授权',
                  '本地物理文稿不受任何影响，已实时安全落盘'
                ];
                actionType = 'relogin';
              } else if (errMsg.includes('敏感') || errMsg.includes('违规') || errMsg.includes('审核')) {
                errType = 'warning';
                friendlyTitle = '章节内容触发平台合规拦截';
                friendlyMessage = `番茄官方审核过滤系统提示：【${errMsg}】。`;
                suggestions = [
                  '请检查本章中是否包含违规或易触发风控的词汇',
                  '修改微调后再次点击提交'
                ];
              }

              return sendJson({
                status: 'error',
                errorType,
                title: friendlyTitle,
                message: friendlyMessage,
                details: {
                  currentWords: wordCount,
                  rawTomatoMsg: errMsg
                },
                suggestions,
                actionType
              }, 400);
            }
          });
        }

        // 3. 读写章节正文 TXT
        if (pathname === '/api/storage/chapter-file') {
          if (req.method === 'GET') {
            const bookId = parsedUrl.searchParams.get('bookId') || '';
            const chapId = parsedUrl.searchParams.get('chapId') || '';
            const nDir = findNovelDir(bookId);

            if (nDir) {
              const chapDir = path.join(nDir, 'chapters');
              if (fs.existsSync(chapDir)) {
                const files = fs.readdirSync(chapDir).filter(f => f.endsWith('.txt'));
                // 1. 尝试直接包含匹配
                let target = files.find(f => f.includes(chapId) || f.includes(chapId.replace('chap_', '')));
                // 2. 尝试从 novel.json 中根据 chapId 查找记录的 fileName 或 title
                if (!target) {
                  const nJsonPath = path.join(nDir, 'novel.json');
                  if (fs.existsSync(nJsonPath)) {
                    try {
                      const nMeta = JSON.parse(fs.readFileSync(nJsonPath, 'utf8'));
                      for (const v of nMeta.volumes || []) {
                        const foundC = v.chapters?.find((c: any) => c.id === chapId);
                        if (foundC) {
                          if (foundC.fileName && files.includes(foundC.fileName)) {
                            target = foundC.fileName;
                            break;
                          }
                          const safeT = (foundC.title || '').replace(/[\\/:*?"<>|]/g, '_');
                          if (safeT) {
                            target = files.find(f => f.includes(safeT));
                            if (target) break;
                          }
                        }
                      }
                    } catch (e) {}
                  }
                }
                // 3. 兜底：若该书目前只有一个章节文件，直接返回
                if (!target && files.length === 1) {
                  target = files[0];
                }

                if (target) {
                  const text = fs.readFileSync(path.join(chapDir, target), 'utf8');
                  return sendJson({ status: 'ok', content: text, fromLocalDisk: true, fileName: target });
                }
              }
            }
            return sendJson({ status: 'not_found', content: '', fromLocalDisk: false });
          }

          if (req.method === 'POST') {
            return parseJsonBody(body => {
              const { bookId, chapId, title, content } = body;
              const nDir = findNovelDir(bookId);
              if (nDir) {
                const chapDir = path.join(nDir, 'chapters');
                ensureDir(chapDir);
                const safeTitle = (title || chapId || '章节').replace(/[\\/:*?"<>|]/g, '_');
                const desiredFileName = `${safeTitle}.txt`;
                const jsonPath = path.join(nDir, 'novel.json');
                
                let oldFileName = '';
                if (fs.existsSync(jsonPath)) {
                  try {
                    const nMeta = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
                    for (const v of nMeta.volumes || []) {
                      const foundC = v.chapters?.find((c: any) => c.id === chapId);
                      if (foundC && foundC.fileName) {
                        oldFileName = foundC.fileName;
                        break;
                      }
                    }
                  } catch (e) {}
                }

                // 如果旧物理文件存在且名字不同，直接无损重命名
                if (oldFileName && oldFileName !== desiredFileName && fs.existsSync(path.join(chapDir, oldFileName))) {
                  try {
                    fs.renameSync(path.join(chapDir, oldFileName), path.join(chapDir, desiredFileName));
                    console.log(`[ViteStorage] 📝 成功将物理文件【${oldFileName}】重命名为【${desiredFileName}】！`);
                  } catch (err) {}
                }

                const filePath = path.join(chapDir, desiredFileName);
                fs.writeFileSync(filePath, content || '', 'utf8');

                // 🌟 同步更新 novel.json 中对应章节的 title, fileName, wordCount
                if (fs.existsSync(jsonPath)) {
                  try {
                    const nMeta = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
                    const cleanLen = (content || '').replace(/\s/g, '').length;
                    let updatedMeta = false;
                    for (const v of nMeta.volumes || []) {
                      for (const c of v.chapters || []) {
                        if (c.id === chapId) {
                          if (title) c.title = title;
                          c.fileName = desiredFileName;
                          c.wordCount = cleanLen;
                          c.updatedAt = new Date().toISOString();
                          updatedMeta = true;
                          break;
                        }
                      }
                    }
                    if (updatedMeta) {
                      fs.writeFileSync(jsonPath, JSON.stringify(nMeta, null, 2), 'utf8');
                      console.log(`[ViteStorage] 💾 成功将章节【${title}】的最新字数与标题同步写入 novel.json！`);
                    }
                  } catch (e) {}
                }

                return sendJson({ status: 'ok', filePath, fileName: desiredFileName });
              }
              sendJson({ status: 'ok' });
            });
          }
        }

        // 4. 读写人物卡
        if (pathname === '/api/storage/characters') {
          const bookId = parsedUrl.searchParams.get('bookId') || '';
          const nDir = findNovelDir(bookId);
          if (req.method === 'GET') {
            if (nDir) {
              const p = path.join(nDir, 'characters', 'cards.json');
              if (fs.existsSync(p)) return sendJson(JSON.parse(fs.readFileSync(p, 'utf8')));
            }
            return sendJson([]);
          }
          if (req.method === 'POST') {
            return parseJsonBody(body => {
              if (nDir) {
                const p = path.join(nDir, 'characters', 'cards.json');
                fs.writeFileSync(p, JSON.stringify(body.list || [], null, 2), 'utf8');
              }
              sendJson({ status: 'ok' });
            });
          }
        }

        // 5. 读写人物分类
        if (pathname === '/api/storage/categories') {
          const bookId = parsedUrl.searchParams.get('bookId') || '';
          const nDir = findNovelDir(bookId);
          if (req.method === 'GET') {
            if (nDir) {
              const p = path.join(nDir, 'characters', 'categories.json');
              if (fs.existsSync(p)) return sendJson(JSON.parse(fs.readFileSync(p, 'utf8')));
            }
            return sendJson([]);
          }
          if (req.method === 'POST') {
            return parseJsonBody(body => {
              if (nDir) {
                const p = path.join(nDir, 'characters', 'categories.json');
                fs.writeFileSync(p, JSON.stringify(body.list || [], null, 2), 'utf8');
              }
              sendJson({ status: 'ok' });
            });
          }
        }

        // 6. 读写人物逻辑图
        if (pathname === '/api/storage/logic-map') {
          const bookId = parsedUrl.searchParams.get('bookId') || '';
          const nDir = findNovelDir(bookId);
          if (req.method === 'GET') {
            if (nDir) {
              const p = path.join(nDir, 'characters', 'logic_map.json');
              if (fs.existsSync(p)) return sendJson(JSON.parse(fs.readFileSync(p, 'utf8')));
            }
            return sendJson({ bookId, nodes: [], relations: [] });
          }
          if (req.method === 'POST') {
            return parseJsonBody(body => {
              if (nDir) {
                const p = path.join(nDir, 'characters', 'logic_map.json');
                fs.writeFileSync(p, JSON.stringify(body.data || {}, null, 2), 'utf8');
              }
              sendJson({ status: 'ok' });
            });
          }
        }

        // 7. 读写大纲思维导图
        if (pathname === '/api/storage/mindmap') {
          const bookId = parsedUrl.searchParams.get('bookId') || '';
          const scope = parsedUrl.searchParams.get('scope') || 'global';
          const targetId = parsedUrl.searchParams.get('targetId') || bookId || 'default';
          const nDir = findNovelDir(bookId);

          if (req.method === 'GET') {
            if (nDir) {
              const key = `${scope}_${targetId}`;
              const p = path.join(nDir, 'mindmaps', `${key}.json`);
              if (fs.existsSync(p)) return sendJson(JSON.parse(fs.readFileSync(p, 'utf8')));
              const pGlobal = path.join(nDir, 'mindmaps', 'global.json');
              if (scope === 'global' && fs.existsSync(pGlobal)) return sendJson(JSON.parse(fs.readFileSync(pGlobal, 'utf8')));
            }
            return sendJson(null);
          }

          if (req.method === 'POST') {
            return parseJsonBody(body => {
              if (nDir) {
                const key = `${body.scope || 'global'}_${body.targetId || bookId || 'default'}`;
                const p = path.join(nDir, 'mindmaps', `${key}.json`);
                fs.writeFileSync(p, JSON.stringify(body.data || {}, null, 2), 'utf8');
                if (body.scope === 'global') {
                  fs.writeFileSync(path.join(nDir, 'mindmaps', 'global.json'), JSON.stringify(body.data || {}, null, 2), 'utf8');
                }
              }
              sendJson({ status: 'ok' });
            });
          }
        }

        // 8. 读写小说专属伏笔看板 (真正实现每本书独立文件夹与物理落盘隔离存储)
        if (pathname === '/api/storage/foreshadows') {
          const bookId = parsedUrl.searchParams.get('bookId') || '';
          const nDir = findNovelDir(bookId);
          if (req.method === 'GET') {
            if (nDir) {
              const p = path.join(nDir, 'foreshadows', 'items.json');
              if (fs.existsSync(p)) {
                try {
                  return sendJson(JSON.parse(fs.readFileSync(p, 'utf8')));
                } catch (e) {}
              }
            }
            return sendJson([]);
          }
          if (req.method === 'POST') {
            return parseJsonBody(body => {
              const targetBookId = body.bookId || bookId;
              const targetDir = findNovelDir(targetBookId);
              if (targetDir) {
                const fDir = path.join(targetDir, 'foreshadows');
                ensureDir(fDir);
                const p = path.join(fDir, 'items.json');
                fs.writeFileSync(p, JSON.stringify(body.list || [], null, 2), 'utf8');
                console.log(`[ViteStorage] 💾 成功将作品【${path.basename(targetDir)}】的专属伏笔数据落盘到 foreshadows/items.json！`);
              }
              sendJson({ status: 'ok' });
            });
          }
        }

                // 8.1 获取作品历史物理快照列表
        if (pathname === '/api/storage/backups' && req.method === 'GET') {
          const bookId = parsedUrl.searchParams.get('bookId') || '';
          const nDir = findNovelDir(bookId);
          if (!nDir) return sendJson([]);
          const dirName = path.basename(nDir);
          const bookBackupsDir = path.join(BACKUPS_DIR, dirName);
          ensureDir(bookBackupsDir);
          const files = fs.readdirSync(bookBackupsDir).filter(f => f.endsWith('.json'));
          const snapshots: any[] = [];
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
          return sendJson(snapshots);
        }

        // 8.2 手动或触发创建新快照
        if (pathname === '/api/storage/backups/create' && req.method === 'POST') {
          return parseJsonBody(body => {
            const { bookId, note } = body;
            const snapshot = createBookSnapshot(bookId, note || '手动安全快照');
            if (snapshot) {
              return sendJson({ status: 'ok', snapshot });
            }
            return sendJson({ status: 'error', message: '无法为该作品创建快照' }, 400);
          });
        }

        // 8.3 还原特定快照
        if (pathname === '/api/storage/backups/restore' && req.method === 'POST') {
          return parseJsonBody(body => {
            const { bookId, snapshotId } = body;
            const res = restoreBookSnapshot(bookId, snapshotId);
            return sendJson(res);
          });
        }

        // 8.4 删除特定快照
        if (pathname === '/api/storage/backups/delete' && req.method === 'POST') {
          return parseJsonBody(body => {
            const { bookId, snapshotId } = body;
            const nDir = findNovelDir(bookId);
            if (nDir) {
              const dirName = path.basename(nDir);
              const p = path.join(BACKUPS_DIR, dirName, `${snapshotId}.json`);
              if (fs.existsSync(p)) fs.unlinkSync(p);
            }
            return sendJson({ status: 'ok' });
          });
        }

        // 9. MCP 状态与连通性检查
        if (pathname === '/api/mcp/status' && req.method === 'GET') {
          const auth = getTomatoMcpAuth();
          return sendJson({
            connected: !!auth.cookie,
            hasCsrf: !!auth.csrfToken,
            accountName: auth.cookie ? '番茄签约作家' : '未连接'
          });
        }

        // 10. 从 MCP 获取番茄官方作品列表（自动比对本地是否已存在）
        if (pathname === '/api/mcp/novels' && req.method === 'GET') {
          try {
            const data = await tomatoMcpRequest('/api/author/book/book_list/v0', { page_index: 0, page_count: 50 });
            const list = Array.isArray(data) ? data : (data?.book_list || data?.list || []);
            
            const enrichedList = list.map((b: any) => {
              const bookIdStr = String(b.book_id);
              const localDir = findNovelDir(bookIdStr) || findNovelDir(b.book_name);
              let isLocal = false;
              let localMeta: any = null;
              if (localDir) {
                isLocal = true;
                const jsonP = path.join(localDir, 'novel.json');
                if (fs.existsSync(jsonP)) {
                  try { localMeta = JSON.parse(fs.readFileSync(jsonP, 'utf8')); } catch (e) {}
                }
              }
              return {
                book_id: bookIdStr,
                book_name: b.book_name,
                word_count: b.word_count || 0,
                read_count: b.read_count || 0,
                creation_status: b.creation_status,
                abstract: b.abstract || '',
                isLocal,
                localFolderName: localDir ? path.basename(localDir) : '',
                localTotalWords: localMeta?.totalWordCount || 0
              };
            });
            return sendJson({ status: 'ok', count: enrichedList.length, novels: enrichedList });
          } catch (err: any) {
            return sendJson({ status: 'error', message: err?.message || '请求番茄 MCP 接口失败' }, 500);
          }
        }

        // 11. 一键从 MCP 拉取单本书籍与章节目录到本地硬盘 (data-storage/novels/《书名》/)
        if (pathname === '/api/mcp/pull-book' && req.method === 'POST') {
          return parseJsonBody(async body => {
            const { bookId } = body;
            if (!bookId) return sendJson({ status: 'error', message: '缺少 bookId' }, 400);

            try {
              const novelsData = await tomatoMcpRequest('/api/author/book/book_list/v0', { page_index: 0, page_count: 50 });
              const nList = Array.isArray(novelsData) ? novelsData : (novelsData?.book_list || novelsData?.list || []);
              const targetNovel = nList.find((b: any) => String(b.book_id) === String(bookId));
              const rawTitle = targetNovel?.book_name || `番茄作品_${bookId}`;
              const cleanTitle = rawTitle.startsWith('《') ? rawTitle : `《${rawTitle}》`;
              const dirName = getSafeBookDirName(cleanTitle);

              const novelPath = path.join(NOVELS_DIR, dirName);
              const chaptersPath = path.join(novelPath, 'chapters');
              const mindmapsPath = path.join(novelPath, 'mindmaps');
              const charactersPath = path.join(novelPath, 'characters');
              const foreshadowsPath = path.join(novelPath, 'foreshadows');

              [novelPath, chaptersPath, mindmapsPath, charactersPath, foreshadowsPath].forEach(ensureDir);

              const volData = await tomatoMcpRequest('/api/author/volume/volume_list/v1', { book_id: bookId });
              const vList = Array.isArray(volData) ? volData : (volData?.volume_list || volData?.list || []);

              const finalVolumes: any[] = [];
              let totalCalculatedWords = 0;

              for (let vIdx = 0; vIdx < (vList.length > 0 ? vList.length : 1); vIdx++) {
                const rawV = vList[vIdx];
                const volId = rawV ? String(rawV.volume_id) : `vol_${Date.now()}_${vIdx}`;
                const volName = rawV ? rawV.volume_name : `第一卷：默认分卷`;

                const chapData = rawV
                  ? await tomatoMcpRequest('/api/author/chapter/chapter_list/v1', {
                      book_id: bookId,
                      volume_id: rawV.volume_id,
                      page_index: 0,
                      page_count: 100,
                      status: 0
                    })
                  : null;

                const cList = Array.isArray(chapData) ? chapData : (chapData?.item_list || chapData?.list || []);
                // 按照 index 正序排列
                cList.sort((a: any, b: any) => (a.index || 0) - (b.index || 0));

                const convertedChapters: any[] = [];
                let volWords = 0;

                for (let cIdx = 0; cIdx < cList.length; cIdx++) {
                  const c = cList[cIdx];
                  const chapId = String(c.item_id || `chap_${vIdx}_${cIdx}`);
                  const safeChapTitle = (c.title || `第${cIdx + 1}章`).replace(/[\\/:*?"<>|]/g, '_');
                  const fileName = `${safeChapTitle}.txt`;
                  const chapFilePath = path.join(chaptersPath, fileName);

                  let chapContent = '';
                  if (fs.existsSync(chapFilePath)) {
                    chapContent = fs.readFileSync(chapFilePath, 'utf8');
                  } else {
                    chapContent = `　　${c.title}\n\n　　（本章已于番茄小说发布，字数：${c.word_number || 0}字。在线章节ID：${c.item_id}）`;
                    fs.writeFileSync(chapFilePath, chapContent, 'utf8');
                  }

                  const wCount = c.word_number || chapContent.replace(/\s/g, '').length;
                  volWords += wCount;

                  convertedChapters.push({
                    id: chapId,
                    volumeId: volId,
                    title: c.title || `第${cIdx + 1}章`,
                    fileName,
                    content: chapContent,
                    wordCount: wCount,
                    paragraphCount: Math.max(1, chapContent.split('\n').filter(p => p.trim()).length),
                    publishStatus: c.display_status === 1 ? 'published' : 'draft',
                    tomatoChapterId: String(c.item_id),
                    lastPushedAt: '已从番茄MCP对齐'
                  });
                }

                totalCalculatedWords += volWords;
                finalVolumes.push({
                  id: volId,
                  bookId: 'book_' + bookId,
                  title: volName,
                  orderIndex: vIdx + 1,
                  wordCount: volWords,
                  collapsed: false,
                  chapters: convertedChapters
                });
              }

              let existingNovelJson: any = {};
              const jsonPath = path.join(novelPath, 'novel.json');
              if (fs.existsSync(jsonPath)) {
                try { existingNovelJson = JSON.parse(fs.readFileSync(jsonPath, 'utf8')); } catch (e) {}
              }

              // 自动下载官方高清封面图片 cover.jpg
              const thumbUri = targetNovel?.thumb_uri || '';
              let coverUrl = '';
              if (thumbUri) {
                const cleanUri = thumbUri.replace(/^novel-pic\//, '');
                coverUrl = `https://p3-novel.byteimg.com/novel-pic/${cleanUri}~tplv-resize:225:300.image`;
                try {
                  const coverRes = await fetch(coverUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                  });
                  if (coverRes.ok) {
                    const buf = Buffer.from(await coverRes.arrayBuffer());
                    fs.writeFileSync(path.join(novelPath, 'cover.jpg'), buf);
                    console.log(`[ViteStorage] 🖼️ 成功下载【${cleanTitle}】官方高清封面！`);
                  }
                } catch (e) {}
              }

              const newBookMeta = {
                id: existingNovelJson.id || ('book_' + bookId),
                tomatoBookId: String(bookId),
                title: cleanTitle,
                author: existingNovelJson.author || '番茄签约作家',
                coverGradient: existingNovelJson.coverGradient || 'linear-gradient(135deg, #10b981, #059669)',
                coverUrl: coverUrl || targetNovel?.thumb_url || existingNovelJson.coverUrl || '',
                thumbUri: thumbUri || existingNovelJson.thumbUri || '',
                tags: targetNovel?.category_name || existingNovelJson.tags || '番茄首发,连载中',
                synopsis: targetNovel?.abstract || existingNovelJson.synopsis || '【番茄官方签约作品】：动态从番茄作家 MCP 系统拉取落盘。',
                targetWordCount: existingNovelJson.targetWordCount || 1000000,
                totalWordCount: totalCalculatedWords || targetNovel?.word_count || 0,
                todayWordCount: existingNovelJson.todayWordCount || 0,
                folderName: dirName,
                volumes: finalVolumes.length > 0 ? finalVolumes : (existingNovelJson.volumes || [])
              };

              fs.writeFileSync(jsonPath, JSON.stringify(newBookMeta, null, 2), 'utf8');

              const gMindmap = path.join(mindmapsPath, 'global.json');
              if (!fs.existsSync(gMindmap)) {
                fs.writeFileSync(gMindmap, JSON.stringify({
                  bookId: newBookMeta.id,
                  scope: 'global',
                  targetId: newBookMeta.id,
                  root: { id: `root_${newBookMeta.id}`, text: `${cleanTitle} 核心大纲`, nodeType: 'root-node', x: 30, y: 180, children: [] },
                  crossLinks: []
                }, null, 2), 'utf8');
              }

              const fItems = path.join(foreshadowsPath, 'items.json');
              if (!fs.existsSync(fItems)) {
                fs.writeFileSync(fItems, JSON.stringify([], null, 2), 'utf8');
              }

              const cCards = path.join(charactersPath, 'cards.json');
              if (!fs.existsSync(cCards)) {
                fs.writeFileSync(cCards, JSON.stringify([], null, 2), 'utf8');
                fs.writeFileSync(path.join(charactersPath, 'categories.json'), JSON.stringify([
                  { id: 'cat_main', bookId: newBookMeta.id, name: '主角团', orderIndex: 1 }
                ], null, 2), 'utf8');
                fs.writeFileSync(path.join(charactersPath, 'logic_map.json'), JSON.stringify({ bookId: newBookMeta.id, nodes: [], relations: [] }, null, 2), 'utf8');
              }

              console.log(`[ViteStorage] 🎉 成功从 MCP 系统完整拉取作品【${cleanTitle}】(${totalCalculatedWords}字)至物理磁盘！`);
              return sendJson({ status: 'ok', book: newBookMeta, novelPath });
            } catch (err: any) {
              console.error('[ViteStorage] 拉取书籍失败:', err);
              return sendJson({ status: 'error', message: err?.message || '拉取作品失败' }, 500);
            }
          });
        }

        next();
      });
    }
  };
}
