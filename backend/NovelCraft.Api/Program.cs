using NovelCraft.Core.Models;
using NovelCraft.Core.Services;
using NovelCraft.Core.Storage;

var builder = WebApplication.CreateBuilder(args);

// 配置跨域 (CORS) 支持前端所有本地端口调用
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

// 注入核心服务单例
builder.Services.AddSingleton<SqliteDatabaseService>();
builder.Services.AddSingleton<TextFormatService>();
builder.Services.AddSingleton<SensitiveWordScanner>();
builder.Services.AddSingleton<TomatoApiService>();

var app = builder.Build();

app.UseCors("AllowAll");

// 1. 获取所有小说列表
app.MapGet("/api/books", (SqliteDatabaseService db) =>
{
    var books = db.GetAllBooks();
    return Results.Ok(books);
});

// 2. 获取单本小说详情 (含卷与章节)
app.MapGet("/api/books/{id}", (string id, SqliteDatabaseService db) =>
{
    var book = db.GetBook(id);
    return book != null ? Results.Ok(book) : Results.NotFound(new { error = "Book not found" });
});

// 3. 创建新小说
app.MapPost("/api/books", (NovelBook book, SqliteDatabaseService db) =>
{
    if (string.IsNullOrEmpty(book.Id)) book.Id = "book_" + Guid.NewGuid().ToString("N")[..8];
    if (book.Volumes.Count == 0)
    {
        var vol = new Volume
        {
            Id = "vol_" + Guid.NewGuid().ToString("N")[..8],
            BookId = book.Id,
            Title = "第一卷：开端篇",
            OrderIndex = 0,
            Chapters = new List<Chapter>
            {
                new Chapter
                {
                    Id = "chap_" + Guid.NewGuid().ToString("N")[..8],
                    Title = "第001章 宏图初起",
                    Content = $"　　【{book.Title}】正文起笔……",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                }
            }
        };
        book.Volumes.Add(vol);
    }
    db.SaveBook(book);
    return Results.Created($"/api/books/{book.Id}", book);
});

// 4. 新建分卷
app.MapPost("/api/books/{bookId}/volumes", (string bookId, Volume volume, SqliteDatabaseService db) =>
{
    var book = db.GetBook(bookId);
    if (book == null) return Results.NotFound(new { error = "Book not found" });

    if (string.IsNullOrEmpty(volume.Id)) volume.Id = "vol_" + Guid.NewGuid().ToString("N")[..8];
    volume.BookId = bookId;
    volume.OrderIndex = book.Volumes.Count;
    if (volume.Chapters.Count == 0)
    {
        volume.Chapters.Add(new Chapter
        {
            Id = "chap_" + Guid.NewGuid().ToString("N")[..8],
            VolumeId = volume.Id,
            Title = "第001章 卷首开篇",
            Content = $"　　【{volume.Title}】起笔……",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });
    }

    book.Volumes.Add(volume);
    db.SaveBook(book);
    return Results.Ok(volume);
});

// 5. 新建章节
app.MapPost("/api/volumes/{volumeId}/chapters", (string volumeId, Chapter chapter, SqliteDatabaseService db) =>
{
    var books = db.GetAllBooks();
    foreach (var b in books)
    {
        var vol = b.Volumes.FirstOrDefault(v => v.Id == volumeId);
        if (vol != null)
        {
            if (string.IsNullOrEmpty(chapter.Id)) chapter.Id = "chap_" + Guid.NewGuid().ToString("N")[..8];
            chapter.VolumeId = volumeId;
            chapter.OrderIndex = vol.Chapters.Count;
            chapter.CreatedAt = DateTime.UtcNow;
            chapter.UpdatedAt = DateTime.UtcNow;
            if (string.IsNullOrEmpty(chapter.Content)) chapter.Content = $"　　【{chapter.Title}】正文起笔……";

            vol.Chapters.Add(chapter);
            db.SaveBook(b);
            return Results.Ok(chapter);
        }
    }
    return Results.NotFound(new { error = "Volume not found" });
});

// 6. 保存章节正文
app.MapPut("/api/chapters/{id}", (string id, Chapter updateDto, SqliteDatabaseService db, TextFormatService formatService) =>
{
    var books = db.GetAllBooks();
    foreach (var b in books)
    {
        foreach (var vol in b.Volumes)
        {
            var chap = vol.Chapters.FirstOrDefault(c => c.Id == id);
            if (chap != null)
            {
                chap.Title = updateDto.Title;
                chap.Content = updateDto.Content;
                chap.WordCount = formatService.CountWords(updateDto.Content);
                chap.ParagraphCount = formatService.CountParagraphs(updateDto.Content);
                chap.UpdatedAt = DateTime.UtcNow;

                db.SaveChapter(chap);
                return Results.Ok(chap);
            }
        }
    }
    return Results.NotFound(new { error = "Chapter not found" });
});

// 7. 一键排版
app.MapPost("/api/text/format", (FormatRequest req, TextFormatService formatService) =>
{
    var formatted = formatService.FormatChineseNovel(req.Text);
    var words = formatService.CountWords(formatted);
    var paras = formatService.CountParagraphs(formatted);
    return Results.Ok(new { formattedText = formatted, wordCount = words, paragraphCount = paras });
});

// 8. 敏感词扫描
app.MapPost("/api/text/scan", (ScanRequest req, SensitiveWordScanner scanner) =>
{
    var matches = scanner.ScanText(req.Text);
    return Results.Ok(new { isClean = matches.Count == 0, count = matches.Count, matches });
});

// 9. 获取思维导图
app.MapGet("/api/mindmap/{bookId}", (string bookId, SqliteDatabaseService db) =>
{
    var node = db.LoadMindMap(bookId);
    if (node == null)
    {
        node = new MindMapNode
        {
            Id = "root",
            Text = "主线大纲",
            NodeType = "root-node",
            X = 30,
            Y = 160,
            Children = new List<MindMapNode>
            {
                new MindMapNode { Id = "b1", Text = "第一卷：起势", NodeType = "branch-node", X = 180, Y = 100 }
            }
        };
    }
    return Results.Ok(node);
});

// 10. 保存思维导图
app.MapPut("/api/mindmap/{bookId}", (string bookId, MindMapNode root, SqliteDatabaseService db) =>
{
    db.SaveMindMap(bookId, root);
    return Results.Ok(new { success = true, updatedAt = DateTime.UtcNow });
});

// 11. 【番茄云端真实动态代理】获取真实小说列表
app.MapPost("/api/tomato/novels", async (TomatoAuthReq req, TomatoApiService tomatoApi) =>
{
    var json = await tomatoApi.GetNovelsJsonAsync(req.Cookie, req.CsrfToken ?? "");
    return Results.Content(json, "application/json");
});

// 12. 【番茄云端真实动态代理】获取真实分卷与章节
app.MapPost("/api/tomato/chapters", async (TomatoChapterReq req, TomatoApiService tomatoApi) =>
{
    var json = await tomatoApi.GetChaptersJsonAsync(req.BookId, req.VolumeId ?? "", req.Cookie, req.CsrfToken ?? "");
    return Results.Content(json, "application/json");
});

// 13. 【番茄云端真实动态代理】获取单章真实正文
app.MapPost("/api/tomato/chapter-content", async (TomatoChapterContentReq req, TomatoApiService tomatoApi) =>
{
    var json = await tomatoApi.GetChapterContentJsonAsync(req.ItemId, req.Cookie, req.CsrfToken ?? "");
    return Results.Content(json, "application/json");
});

app.Run("http://0.0.0.0:5200");

public record FormatRequest(string Text);
public record ScanRequest(string Text);
public record TomatoAuthReq(string Cookie, string? CsrfToken);
public record TomatoChapterReq(string BookId, string? VolumeId, string Cookie, string? CsrfToken);
public record TomatoChapterContentReq(string ItemId, string Cookie, string? CsrfToken);
