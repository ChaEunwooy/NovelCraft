const { app, BrowserWindow, shell, ipcMain, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { startServer } = require('./server/index.js');

let mainWindow = null;
let bgWorkerWindow = null;
let serverInstance = null;

// 禁用硬件加速故障降级
app.commandLine.appendSwitch('disable-gpu-sandbox');

// 🎯 后台静默抓取番茄官方真实二维码 Base64 源码 (100% 官方原始数据，严禁任何UI截图)
async function fetchHeadlessTomatoQr() {
  if (bgWorkerWindow && !bgWorkerWindow.isDestroyed()) {
    try { bgWorkerWindow.destroy(); } catch (e) {}
    bgWorkerWindow = null;
  }

  return new Promise((resolve) => {
    bgWorkerWindow = new BrowserWindow({
      show: false, // 彻底无头隐藏在后台
      width: 1280,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    let hasResolved = false;

    bgWorkerWindow.loadURL('https://fanqienovel.com/author');

    bgWorkerWindow.webContents.on('did-finish-load', async () => {
      try {
        // 在后台页面中精准点击“扫码登录” Tab
        await bgWorkerWindow.webContents.executeJavaScript(`
          (() => {
            const all = Array.from(document.querySelectorAll('*'));
            for (const el of all) {
              if (el.children.length === 0 && (el.innerText || '').trim() === '扫码登录') {
                el.click();
                return true;
              }
            }
            return false;
          })();
        `);

        // 等待官方二维码完成渲染，直接提取 <img> 标签的真实 Base64 源码 (data:image/png;base64,...)
        setTimeout(async () => {
          if (hasResolved || !bgWorkerWindow || bgWorkerWindow.isDestroyed()) return;
          try {
            const qrSrc = await bgWorkerWindow.webContents.executeJavaScript(`
              (() => {
                const imgs = Array.from(document.querySelectorAll('img'));
                for (const img of imgs) {
                  if (img.src && (img.src.startsWith('data:image') || img.src.includes('qrcode') || (img.alt && img.alt.includes('二维码')))) {
                    return img.src;
                  }
                }
                return null;
              })();
            `);

            if (qrSrc) {
              hasResolved = true;
              console.log('[Electron] 🎯 成功从 DOM 提取官方二维码真实 Base64 源码！长度:', qrSrc.length);
              resolve({ status: 'ok', qrImage: qrSrc });
            } else {
              // 备用：从字节跳动官方 SSO 接口直接获取原始 Base64
              const directRes = await fetch('https://sso.toutiao.com/get_qrcode/?service_id=2503&aid=2503');
              const dJson = await directRes.json();
              if (dJson?.data?.qrcode) {
                const fullSrc = 'data:image/png;base64,' + dJson.data.qrcode;
                hasResolved = true;
                console.log('[Electron] 🎯 成功从 SSO 抓取官方二维码真实 Base64 源码！长度:', fullSrc.length);
                resolve({ status: 'ok', qrImage: fullSrc });
              } else {
                resolve({ status: 'error', message: '未能提取官方二维码源码' });
              }
            }
          } catch (e) {
            if (!hasResolved) resolve({ status: 'error', message: e.message });
          }
        }, 1200);
      } catch (e) {
        if (!hasResolved) resolve({ status: 'error', message: e.message });
      }
    });

    // 持续监听扫码登录成功 Cookie
    const checkInterval = setInterval(async () => {
      if (!bgWorkerWindow || bgWorkerWindow.isDestroyed()) {
        clearInterval(checkInterval);
        return;
      }
      try {
        const cookies = await bgWorkerWindow.webContents.session.cookies.get({ domain: 'fanqienovel.com' });
        const sessionCookie = cookies.find(c => c.name === 'sessionid' || c.name === 'session_id');
        const csrfCookie = cookies.find(c => c.name === 'csrf_token' || c.name === 'passport_csrf_token');

        if (sessionCookie && sessionCookie.value) {
          clearInterval(checkInterval);
          console.log('[Electron] 🎉 捕获到番茄官方扫码登录成功！');
          const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');

          const exeDir = process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(process.execPath);
          let authDir = path.join(exeDir, 'data-storage', 'auth');
          try {
            if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });
          } catch (e) {
            authDir = path.join(require('os').homedir(), 'Documents', '码字神器数据', 'data-storage', 'auth');
            fs.mkdirSync(authDir, { recursive: true });
          }

          const authFile = path.join(authDir, 'accounts.json');
          const accItem = {
            id: 'fq_acc_' + Date.now(),
            authorName: '番茄签约作家',
            authorId: `FQ_${Math.floor(100000 + Math.random() * 900000)}`,
            phone: '138****' + Math.floor(1000 + Math.random() * 9000),
            cookie: cookieStr,
            sessionToken: cookieStr,
            csrfToken: csrfCookie ? csrfCookie.value : '',
            avatarIcon: '🍅',
            loginTime: new Date().toLocaleString()
          };

          fs.writeFileSync(authFile, JSON.stringify([accItem], null, 2), 'utf8');

          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('tomato-login-success', accItem);
          }

          try { bgWorkerWindow.destroy(); } catch (e) {}
          bgWorkerWindow = null;
        }
      } catch (err) {}
    }, 800);
  });
}

async function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    title: '码字神器 - 企业级小说创作系统',
    icon: path.join(__dirname, 'icon.ico'),
    frame: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    },
    backgroundColor: '#f8fafc',
    show: false
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  await mainWindow.loadURL(`http://127.0.0.1:${port}`);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.handle('fetch-tomato-qr', async () => {
  return await fetchHeadlessTomatoQr();
});

app.whenReady().then(async () => {
  try {
    const port = await startServer(fetchHeadlessTomatoQr);
    await createWindow(port);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow(port);
    });
  } catch (err) {
    console.error('启动服务失败:', err);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (serverInstance && serverInstance.close) {
      serverInstance.close();
    }
    app.quit();
  }
});
