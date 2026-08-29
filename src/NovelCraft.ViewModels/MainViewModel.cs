using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using NovelCraft.Core.Models;
using NovelCraft.Core.Services;
using NovelCraft.Core.Storage;

namespace NovelCraft.ViewModels;

/// <summary>
/// 主工作台总控 ViewModel (支持多小说全局联动)
/// </summary>
public partial class MainViewModel : ObservableObject
{
    private readonly SqliteDatabaseService _dbService;
    private readonly TextFormatService _formatService;
    private readonly SensitiveWordScanner _scanner;

    [ObservableProperty]
    private SiderViewModel _sider;

    [ObservableProperty]
    private NovelInfoViewModel _novelInfo;

    [ObservableProperty]
    private EditorViewModel _editor;

    [ObservableProperty]
    private MindMapViewModel _mindMap;

    [ObservableProperty]
    private bool _isDarkTheme = false;

    [ObservableProperty]
    private bool _isMindMapCollapsed = false;

    public MainViewModel()
    {
        _dbService = new SqliteDatabaseService();
        _formatService = new TextFormatService();
        _scanner = new SensitiveWordScanner();

        _sider = new SiderViewModel();
        _novelInfo = new NovelInfoViewModel();
        _editor = new EditorViewModel(_formatService, _dbService, _scanner);
        _mindMap = new MindMapViewModel(_dbService);

        // 1. 联动切换章节
        _sider.OnChapterSelected = (chap) =>
        {
            _editor.CurrentChapterId = chap.Id;
            _editor.ChapterTitle = chap.Title;
            _editor.Content = string.IsNullOrEmpty(chap.Content)
                ? $"　　【{chap.Title}】正文起笔……"
                : chap.Content;
        };

        // 2. 联动切换工作小说
        _sider.OnBookSelected = (book) =>
        {
            _novelInfo.UpdateFromBook(book);

            // 切换编辑器为该书的首个或活动章节
            var firstChap = book.Volumes.FirstOrDefault()?.Chapters.FirstOrDefault();
            if (firstChap != null)
            {
                _sider.SelectChapter(firstChap);
            }

            // 切换思维导图的主线根节点
            _mindMap.RootNode.Text = $"{book.Title} 主线大纲";
            _mindMap.RefreshFlatNodes();
            _editor.SaveStatus = $"已切换至工作小说【{book.Title}】";
        };

        // 3. 码字联动统计
        _editor.OnContentChangedCallback = () =>
        {
            _novelInfo.IncrementTodayWords(1);
        };
    }

    [RelayCommand]
    public void ToggleTheme()
    {
        IsDarkTheme = !IsDarkTheme;
    }

    [RelayCommand]
    public void ToggleMindMap()
    {
        IsMindMapCollapsed = !IsMindMapCollapsed;
    }
}
