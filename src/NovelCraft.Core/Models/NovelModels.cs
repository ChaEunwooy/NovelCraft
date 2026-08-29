namespace NovelCraft.Core.Models;

/// <summary>
/// 小说作品核心模型
/// </summary>
public class NovelBook
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Title { get; set; } = "未命名小说";
    public string Author { get; set; } = "创作者";
    public string CoverGradient { get; set; } = "linear-gradient(135deg, #3b82f6, #8b5cf6)";
    public string Tags { get; set; } = "科幻玄幻,升级暴爽,杀伐果断";
    public string Synopsis { get; set; } = "点击编辑小说简介与核心主线梗概...";
    public int TargetWordCount { get; set; } = 2000000;
    public int TotalWordCount { get; set; } = 0;
    public int TodayWordCount { get; set; } = 0;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public List<Volume> Volumes { get; set; } = new();
}

/// <summary>
/// 分卷模型
/// </summary>
public class Volume
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string BookId { get; set; } = string.Empty;
    public string Title { get; set; } = "第一卷";
    public int OrderIndex { get; set; } = 1;
    public int WordCount { get; set; } = 0;

    public List<Chapter> Chapters { get; set; } = new();
}

/// <summary>
/// 章节状态枚举
/// </summary>
public enum ChapterStatus
{
    Draft,      // 草稿
    Writing,    // 写作中
    Reviewing,  // 待润色
    Completed   // 已完结
}

/// <summary>
/// 章节核心模型
/// </summary>
public class Chapter
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string VolumeId { get; set; } = string.Empty;
    public string Title { get; set; } = "新章节";
    public string Content { get; set; } = string.Empty;
    public int WordCount { get; set; } = 0;
    public int ParagraphCount { get; set; } = 0;
    public ChapterStatus Status { get; set; } = ChapterStatus.Writing;
    public int OrderIndex { get; set; } = 1;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// 章节历史快照 (时光机)
/// </summary>
public class ChapterSnapshot
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string ChapterId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public int WordCount { get; set; } = 0;
    public string Reason { get; set; } = "自动保存快照";
    public DateTime SnapshotTime { get; set; } = DateTime.UtcNow;
}
