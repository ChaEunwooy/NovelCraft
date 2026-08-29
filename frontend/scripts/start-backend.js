import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. 自动清理可能占用的 5200 端口
try {
  if (process.platform === 'win32') {
    execSync('powershell -Command "Get-NetTCPConnection -LocalPort 5200 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"', { stdio: 'ignore' });
  }
} catch (e) {
  // 忽略清理异常
}

// 2. 自动检测并附加 .NET SDK 路径
const userDotnetPath = 'C:\\Users\\YT\\.dotnet';
const currentPath = process.env.PATH || '';
const newPath = fs.existsSync(userDotnetPath)
  ? `${userDotnetPath};${currentPath}`
  : currentPath;

const projectPath = path.resolve(__dirname, '../../backend/NovelCraft.Api/NovelCraft.Api.csproj');

console.log(`[Backend] 正在启动 ASP.NET Core API 服务: ${projectPath}`);

const child = spawn('dotnet', ['run', '--project', projectPath, '--urls', 'http://localhost:5200'], {
  env: {
    ...process.env,
    PATH: newPath,
    ASPNETCORE_ENVIRONMENT: 'Development'
  },
  stdio: 'inherit'
});

child.on('error', (err) => {
  console.error('[Backend Error]', err);
});

child.on('close', (code) => {
  console.log(`[Backend Exit] 进程退出，退出码: ${code}`);
});
