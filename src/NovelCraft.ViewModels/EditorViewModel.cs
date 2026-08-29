using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using NovelCraft.Core.Models;
using NovelCraft.Core.Services;
using NovelCraft.Core.Storage;

namespace NovelCraft.ViewModels;

/// <summary>
/// 沉浸式码字编辑器 ViewModel
/// </summary>
public partial class EditorViewModel : ObservableObject
{
    private readonly TextFormatService _formatService;
    private readonly SqliteDatabaseService _dbService;
    private readonly SensitiveWordScanner _scanner;

    [ObservableProperty]
    private string _chapterTitle = "第128章 虚空之眼降临";

    [ObservableProperty]
    private string _content = string.Empty;

    [ObservableProperty]
    private int _wordCount = 0;

    [ObservableProperty]
    private int _paragraphCount = 0;

    [ObservableProperty]
    private string _saveStatus = "毫秒事务已同步 (零丢字防护)";

    [ObservableProperty]
    private bool _isTypewriterMode = false;

    [ObservableProperty]
    private string _currentChapterId = "chap_128";

    public Action? OnContentChangedCallback { get; set; }

    public EditorViewModel(TextFormatService formatService, SqliteDatabaseService dbService, SensitiveWordScanner scanner)
    {
        _formatService = formatService;
        _dbService = dbService;
        _scanner = scanner;

        Content = "　　狂暴的暗物质风暴如黑色的巨蟒般撕扯着星舰的外壳，合金装甲发出令人牙酸的扭曲悲鸣。\n" +
                  "　　林渊站在破碎的主控台前，瞳孔深处泛起一抹幽邃的苍蓝光泽。超脑火种正在以每秒八万亿次的速度解析着外界的能量波谱，无数淡金色的数据流在他眼底瀑布般垂落。\n" +
                  "　　“警告，虚空力场已突破第三道阈值，距离‘虚空之眼’完全睁开，还剩最后三分钟。”冰冷而熟悉的机械提示音在脑海中回荡。\n" +
                  "　　而在舷窗之外，无尽的深空裂隙之中，一颗足有行星般庞大的赤红巨瞳，正缓缓拨开星云，冷漠地俯瞰着这艘渺小如尘埃的巡洋舰。\n" +
                  "　　林渊缓缓抬起右手，掌心之中，那枚沉寂了数十万年的法则核心骤然爆发出一道刺破苍穹的炽烈光芒……";

        RecalculateStats();
    }

    partial void OnContentChanged(string value)
    {
        RecalculateStats();
        SaveContent();
        OnContentChangedCallback?.Invoke();
    }

    private void RecalculateStats()
    {
        WordCount = _formatService.CountWords(Content);
        ParagraphCount = _formatService.CountParagraphs(Content);
    }

    private void SaveContent()
    {
        SaveStatus = "正在写入本地事务缓存...";
        var chapter = new Chapter
        {
            Id = CurrentChapterId,
            Title = ChapterTitle,
            Content = Content,
            WordCount = WordCount,
            ParagraphCount = ParagraphCount,
            UpdatedAt = DateTime.UtcNow
        };
        _dbService.SaveChapter(chapter);
        SaveStatus = $"已于 {DateTime.Now:HH:mm:ss} 毫秒级落盘 (零丢字)";
    }

    [RelayCommand]
    public void FormatText()
    {
        Content = _formatService.FormatChineseNovel(Content);
        SaveStatus = "已完成一键标准中文排版！";
    }

    [RelayCommand]
    public void ToggleTypewriter()
    {
        IsTypewriterMode = !IsTypewriterMode;
        SaveStatus = IsTypewriterMode ? "已开启打字机居中模式" : "已恢复常规模式";
    }

    [RelayCommand]
    public void ScanSensitiveWords()
    {
        var matches = _scanner.ScanText(Content);
        if (matches.Count == 0)
        {
            SaveStatus = $"扫描完毕！本章共 {WordCount} 字，未检测到任何违禁词，内容完全合规。";
        }
        else
        {
            SaveStatus = $"检测到 {matches.Count} 处潜在敏感表达，请注意复核。";
        }
    }

    [RelayCommand]
    public void TriggerAiCoPilot()
    {
        Content += "\n　　“轰！”整片虚空仿佛在这一刻凝固，林渊眼眸中神火喷薄，战意已然滔天！";
        SaveStatus = "AI 创作副驾驶已注入灵感续写！";
    }
}
