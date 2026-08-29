using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using NovelCraft.Core.Models;
using System.Collections.ObjectModel;

namespace NovelCraft.ViewModels;

/// <summary>
/// 左侧大纲与小说书架切换 ViewModel
/// </summary>
public partial class SiderViewModel : ObservableObject
{
    [ObservableProperty]
    private NovelBook? _selectedBook;

    [ObservableProperty]
    private bool _isCollapsed = false;

    public ObservableCollection<NovelBook> Books { get; } = new();
    public ObservableCollection<Volume> Volumes { get; } = new();

    public Action<Chapter>? OnChapterSelected { get; set; }
    public Action<NovelBook>? OnBookSelected { get; set; }

    public SiderViewModel()
    {
        InitializeSampleBooks();
    }

    private void InitializeSampleBooks()
    {
        // 书籍 1：星渊之上
        var book1 = new NovelBook
        {
            Id = "book_1",
            Title = "《星渊之上：从废土拾荒到宇宙主宰》",
            Tags = "科幻玄幻,升级暴爽,杀伐果断,日更万字",
            Synopsis = "【核心主线】：灾变纪元300年，废土少年林渊偶获上古文明遗落的“超脑火种”，解析万物序列，重铸星际战神，撕裂深空旧神的统治阴影……",
            TotalWordCount = 386000,
            TargetWordCount = 2000000,
            TodayWordCount = 4280
        };

        var b1_v1 = new Volume { Id = "b1_v1", BookId = "book_1", Title = "第一卷：微末崛起与机械神核", OrderIndex = 1, WordCount = 84000 };
        b1_v1.Chapters.Add(new Chapter { Id = "b1_c1", VolumeId = "b1_v1", Title = "第001章 荒原拾荒者", WordCount = 3420, OrderIndex = 1, Content = "　　灰蒙蒙的酸雨淅淅沥沥地砸在生锈的钢铁残骸上，散发出一股刺鼻的硫磺味……" });
        b1_v1.Chapters.Add(new Chapter { Id = "b1_c2", VolumeId = "b1_v1", Title = "第002章 觉醒！超脑芯片", WordCount = 3180, OrderIndex = 2, Content = "　　那是一枚深蓝色的晶体芯片，静静躺在变异兽的心脏之中，散发着微弱的幽光……" });
        b1_v1.Chapters.Add(new Chapter { Id = "b1_c3", VolumeId = "b1_v1", Title = "第003章 暗夜的刺杀者", WordCount = 3650, OrderIndex = 3, Content = "　　阴影中，一道泛着寒芒的合金短刃悄无声息地贴向林渊的脖颈……" });

        var b1_v2 = new Volume { Id = "b1_v2", BookId = "book_1", Title = "第二卷：黑曜星环的风暴", OrderIndex = 2, WordCount = 6305 };
        b1_v2.Chapters.Add(new Chapter { Id = "b1_c127", VolumeId = "b1_v2", Title = "第127章 永恒星舰的残骸", WordCount = 3200, OrderIndex = 127, Content = "　　巨大的星舰残骸横亘在星环轨道上，犹如一具死去的远古巨兽……" });
        b1_v2.Chapters.Add(new Chapter { Id = "b1_c128", VolumeId = "b1_v2", Title = "第128章 虚空之眼降临", WordCount = 3105, OrderIndex = 128, Content = "　　狂暴的暗物质风暴如黑色的巨蟒般撕扯着星舰的外壳，合金装甲发出令人牙酸的扭曲悲鸣。\n　　林渊站在破碎的主控台前，瞳孔深处泛起一抹幽邃的苍蓝光泽……" });
        b1_v2.Chapters.Add(new Chapter { Id = "b1_c129", VolumeId = "b1_v2", Title = "第129章 【草稿】法则重构", WordCount = 0, OrderIndex = 129, Content = "　　【本章大纲草稿】：林渊利用超脑火种解析虚空之眼的法则结构，寻找破局死穴……" });

        book1.Volumes.Add(b1_v1);
        book1.Volumes.Add(b1_v2);

        // 书籍 2：剑起沧澜
        var book2 = new NovelBook
        {
            Id = "book_2",
            Title = "《剑起沧澜：从杂役到绝世剑仙》",
            Tags = "东方仙侠,凡人流,传统剑道,热血慢热",
            Synopsis = "【核心主线】：少年顾长青持残缺铁剑，入九玄剑宗，受尽冷眼，于生死间悟得无上剑意，一剑霜寒十四州！",
            TotalWordCount = 125000,
            TargetWordCount = 1500000,
            TodayWordCount = 2100
        };

        var b2_v1 = new Volume { Id = "b2_v1", BookId = "book_2", Title = "第一卷：青云试剑出凡尘", OrderIndex = 1, WordCount = 125000 };
        b2_v1.Chapters.Add(new Chapter { Id = "b2_c1", VolumeId = "b2_v1", Title = "第001章 杂役少年与生锈铁剑", WordCount = 3120, OrderIndex = 1, Content = "　　晨光熹微，九玄宗后山的洗剑池旁，少年正一下又一下地用粗麻布擦拭着手中的残剑……" });
        b2_v1.Chapters.Add(new Chapter { Id = "b2_c2", VolumeId = "b2_v1", Title = "第002章 洗剑池底的剑意残篇", WordCount = 3300, OrderIndex = 2, Content = "　　冰冷的池水浸透衣衫，顾长青指尖触碰到了石底那道深达三寸的古老剑痕……" });

        book2.Volumes.Add(b2_v1);

        // 书籍 3：诡秘侦探社
        var book3 = new NovelBook
        {
            Id = "book_3",
            Title = "《诡秘侦探社：雾都旧神降临事件》",
            Tags = "悬疑中式克苏鲁,硬核推理,蒸汽朋克",
            Synopsis = "【核心主线】：开在雾都深巷的第十三号事务所，专门接手巡捕房不敢碰的非自然离奇悬案……",
            TotalWordCount = 52000,
            TargetWordCount = 800000,
            TodayWordCount = 1600
        };
        var b3_v1 = new Volume { Id = "b3_v1", BookId = "book_3", Title = "第一卷：迷雾中的无面来客", OrderIndex = 1, WordCount = 52000 };
        b3_v1.Chapters.Add(new Chapter { Id = "b3_c1", VolumeId = "b3_v1", Title = "第001章 染血的银怀表", WordCount = 3400, OrderIndex = 1, Content = "　　煤气路灯在潮湿的夜雾中忽明忽暗，叮咚一声，门铃被拉响了……" });
        book3.Volumes.Add(b3_v1);

        Books.Add(book1);
        Books.Add(book2);
        Books.Add(book3);

        SelectedBook = book1;
        LoadVolumesForBook(book1);
    }

    partial void OnSelectedBookChanged(NovelBook? value)
    {
        if (value != null)
        {
            LoadVolumesForBook(value);
            OnBookSelected?.Invoke(value);
        }
    }

    private void LoadVolumesForBook(NovelBook book)
    {
        Volumes.Clear();
        foreach (var vol in book.Volumes)
        {
            Volumes.Add(vol);
        }
    }

    [RelayCommand]
    public void ToggleCollapse() => IsCollapsed = !IsCollapsed;

    [RelayCommand]
    public void SelectChapter(Chapter chapter)
    {
        OnChapterSelected?.Invoke(chapter);
    }

    [RelayCommand]
    public void AddNewChapter()
    {
        var lastVol = Volumes.LastOrDefault();
        if (lastVol != null)
        {
            var nextIndex = lastVol.Chapters.Count + 1;
            var chap = new Chapter
            {
                Id = "c_" + Guid.NewGuid().ToString("N")[..6],
                VolumeId = lastVol.Id,
                Title = $"第{nextIndex:D3}章 新起篇章",
                WordCount = 0,
                OrderIndex = nextIndex,
                Content = $"　　【新章节正文起笔】……"
            };
            lastVol.Chapters.Add(chap);
            OnChapterSelected?.Invoke(chap);
        }
    }

    [RelayCommand]
    public void CreateNewBook()
    {
        var newIndex = Books.Count + 1;
        var newBook = new NovelBook
        {
            Id = "book_" + Guid.NewGuid().ToString("N")[..6],
            Title = $"《未命名新作 {newIndex}》",
            Tags = "新题材,大纲构建中",
            Synopsis = "点击上方简介区域，可在此输入新作品的一句话亮点与主线故事大纲梗概……",
            TotalWordCount = 0,
            TargetWordCount = 1000000,
            TodayWordCount = 0
        };

        var v1 = new Volume { Id = "v_" + Guid.NewGuid().ToString("N")[..6], BookId = newBook.Id, Title = "第一卷：初入江湖/开端篇", OrderIndex = 1 };
        v1.Chapters.Add(new Chapter { Id = "c_" + Guid.NewGuid().ToString("N")[..6], VolumeId = v1.Id, Title = "第001章 序章/开篇", Content = "　　故事的开端总是发生在一个意想不到的瞬间……" });
        newBook.Volumes.Add(v1);

        Books.Add(newBook);
        SelectedBook = newBook;
    }
}

/// <summary>
/// 中上小说档案与数据看板 ViewModel
/// </summary>
public partial class NovelInfoViewModel : ObservableObject
{
    [ObservableProperty]
    private string _title = "《星渊之上：从废土拾荒到宇宙主宰》";

    [ObservableProperty]
    private string _tags = "科幻玄幻,升级暴爽,杀伐果断,日更万字";

    [ObservableProperty]
    private string _synopsis = "【核心主线】：灾变纪元300年，废土少年林渊偶获上古文明遗落的“超脑火种”，解析万物序列，重铸星际战神，撕裂深空旧神的统治阴影……";

    [ObservableProperty]
    private int _todayWordCount = 4280;

    [ObservableProperty]
    private int _typingSpeed = 1850;

    [ObservableProperty]
    private string _totalProgress = "38.6万 / 200万";

    [ObservableProperty]
    private string _progressPercentage = "19.3%";

    public void UpdateFromBook(NovelBook book)
    {
        Title = book.Title;
        Tags = book.Tags;
        Synopsis = book.Synopsis;
        TodayWordCount = book.TodayWordCount;
        TotalProgress = $"{book.TotalWordCount / 10000.0:F1}万 / {book.TargetWordCount / 10000.0:F1}万";
        if (book.TargetWordCount > 0)
        {
            var pct = (double)book.TotalWordCount / book.TargetWordCount * 100.0;
            ProgressPercentage = $"{pct:F1}%";
        }
    }

    public void IncrementTodayWords(int delta)
    {
        if (delta > 0)
        {
            TodayWordCount += delta;
        }
    }
}
