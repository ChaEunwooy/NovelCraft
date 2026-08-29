!macro customUnInstall
  MessageBox MB_YESNO|MB_ICONQUESTION "【码字神器】卸载向导：$\n$\n是否同时删除您保存在本地的所有【小说文稿、分卷大纲与历史快照备份】？$\n$\n👉 点击【是(Y)】：彻底清理并删除所有小说文稿与备份数据$\n👉 点击【否(N)】：保留您的小说创作资产（推荐，方便下次重装继续创作）" IDNO keep_user_novels
    DetailPrint "正在清理本地小说文稿与备份数据..."
    RMDir /r "$DOCUMENTS\码字神器数据"
    RMDir /r "$APPDATA\novelcraft-desktop"
  keep_user_novels:
!macroend
