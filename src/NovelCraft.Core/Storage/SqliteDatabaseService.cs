using Microsoft.Data.Sqlite;
using NovelCraft.Core.Models;
using System.Text.Json;

namespace NovelCraft.Core.Storage;

/// <summary>
/// 企业级 SQLite 本地存储引擎 (启用 WAL 预写日志与事务保护)
/// </summary>
public class SqliteDatabaseService : IDisposable
{
    private readonly string _connectionString;
    private readonly object _lock = new();

    public SqliteDatabaseService(string? dbPath = null)
    {
        if (string.IsNullOrEmpty(dbPath))
        {
            var appData = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "NovelCraft");
            Directory.CreateDirectory(appData);
            dbPath = Path.Combine(appData, "novelcraft_main.db");
        }

        _connectionString = $"Data Source={dbPath};Cache=Shared;";
        InitializeDatabase();
    }

    private void InitializeDatabase()
    {
        using var conn = new SqliteConnection(_connectionString);
        conn.Open();

        using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;
            PRAGMA foreign_keys = OFF;

            CREATE TABLE IF NOT EXISTS Books (
                Id TEXT PRIMARY KEY,
                Title TEXT NOT NULL,
                Author TEXT,
                CoverGradient TEXT,
                Tags TEXT,
                Synopsis TEXT,
                TargetWordCount INTEGER,
                TotalWordCount INTEGER,
                TodayWordCount INTEGER,
                CreatedAt TEXT,
                UpdatedAt TEXT
            );

            CREATE TABLE IF NOT EXISTS Volumes (
                Id TEXT PRIMARY KEY,
                BookId TEXT NOT NULL,
                Title TEXT NOT NULL,
                OrderIndex INTEGER,
                WordCount INTEGER
            );

            CREATE TABLE IF NOT EXISTS Chapters (
                Id TEXT PRIMARY KEY,
                VolumeId TEXT NOT NULL,
                Title TEXT NOT NULL,
                Content TEXT,
                WordCount INTEGER,
                ParagraphCount INTEGER,
                Status INTEGER,
                OrderIndex INTEGER,
                CreatedAt TEXT,
                UpdatedAt TEXT
            );

            CREATE TABLE IF NOT EXISTS Snapshots (
                Id TEXT PRIMARY KEY,
                ChapterId TEXT NOT NULL,
                Title TEXT,
                Content TEXT,
                WordCount INTEGER,
                Reason TEXT,
                SnapshotTime TEXT
            );

            CREATE TABLE IF NOT EXISTS MindMaps (
                BookId TEXT PRIMARY KEY,
                DataJson TEXT NOT NULL,
                UpdatedAt TEXT
            );

            -- 插入默认种子数据
            INSERT OR IGNORE INTO Books (Id, Title, Author, Tags, Synopsis, TargetWordCount, TotalWordCount, TodayWordCount)
            VALUES ('book_1', '《星渊之上：从废土拾荒到宇宙主宰》', '创作者', '科幻玄幻,升级暴爽,杀伐果断', '【核心主线】：灾变纪元300年，废土少年林渊偶获上古文明遗落的“超脑火种”……', 2000000, 386000, 4280);

            INSERT OR IGNORE INTO Books (Id, Title, Author, Tags, Synopsis, TargetWordCount, TotalWordCount, TodayWordCount)
            VALUES ('book_2', '《剑起沧澜：从杂役到绝世剑仙》', '创作者', '东方仙侠,凡人流,传统剑道', '【核心主线】：少年顾长青持残缺铁剑，入九玄剑宗，受尽冷眼……', 1500000, 125000, 2100);

            INSERT OR IGNORE INTO Books (Id, Title, Author, Tags, Synopsis, TargetWordCount, TotalWordCount, TodayWordCount)
            VALUES ('book_3', '《诡秘侦探社：雾都旧神降临事件》', '创作者', '悬疑克苏鲁,硬核推理', '【核心主线】：开在雾都深巷的第十三号事务所……', 800000, 52000, 1600);

            INSERT OR IGNORE INTO Volumes (Id, BookId, Title, OrderIndex, WordCount)
            VALUES ('b1_v1', 'book_1', '第一卷：微末崛起与机械神核', 1, 84000);

            INSERT OR IGNORE INTO Volumes (Id, BookId, Title, OrderIndex, WordCount)
            VALUES ('b1_v2', 'book_1', '第二卷：黑曜星环的风暴', 2, 6305);

            INSERT OR IGNORE INTO Chapters (Id, VolumeId, Title, Content, WordCount, ParagraphCount, OrderIndex)
            VALUES ('b1_c128', 'b1_v2', '第128章 虚空之眼降临', '　　狂暴的暗物质风暴如黑色的巨蟒般撕扯着星舰的外壳，合金装甲发出令人牙酸的扭曲悲鸣。\n　　林渊站在破碎的主控台前，瞳孔深处泛起一抹幽邃的苍蓝光泽。超脑火种正在以每秒八万亿次的速度解析着外界的能量波谱，无数淡金色的数据流在他眼底瀑布般垂落。', 3105, 5, 128);
        ";
        cmd.ExecuteNonQuery();
    }

    /// <summary>
    /// 获取所有书籍
    /// </summary>
    public List<NovelBook> GetAllBooks()
    {
        lock (_lock)
        {
            var books = new List<NovelBook>();
            using var conn = new SqliteConnection(_connectionString);
            conn.Open();

            using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT Id, Title, Author, CoverGradient, Tags, Synopsis, TargetWordCount, TotalWordCount, TodayWordCount FROM Books;";
            using var reader = cmd.ExecuteReader();

            while (reader.Read())
            {
                var book = new NovelBook
                {
                    Id = reader.GetString(0),
                    Title = reader.GetString(1),
                    Author = reader.IsDBNull(2) ? "" : reader.GetString(2),
                    CoverGradient = reader.IsDBNull(3) ? "" : reader.GetString(3),
                    Tags = reader.IsDBNull(4) ? "" : reader.GetString(4),
                    Synopsis = reader.IsDBNull(5) ? "" : reader.GetString(5),
                    TargetWordCount = reader.IsDBNull(6) ? 1000000 : reader.GetInt32(6),
                    TotalWordCount = reader.IsDBNull(7) ? 0 : reader.GetInt32(7),
                    TodayWordCount = reader.IsDBNull(8) ? 0 : reader.GetInt32(8),
                };
                book.Volumes = GetVolumesByBookId(book.Id, conn);
                books.Add(book);
            }

            return books;
        }
    }

    public NovelBook? GetBook(string id)
    {
        lock (_lock)
        {
            using var conn = new SqliteConnection(_connectionString);
            conn.Open();

            using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT Id, Title, Author, CoverGradient, Tags, Synopsis, TargetWordCount, TotalWordCount, TodayWordCount FROM Books WHERE Id = $id LIMIT 1;";
            cmd.Parameters.AddWithValue("$id", id);
            using var reader = cmd.ExecuteReader();

            if (reader.Read())
            {
                var book = new NovelBook
                {
                    Id = reader.GetString(0),
                    Title = reader.GetString(1),
                    Author = reader.IsDBNull(2) ? "" : reader.GetString(2),
                    CoverGradient = reader.IsDBNull(3) ? "" : reader.GetString(3),
                    Tags = reader.IsDBNull(4) ? "" : reader.GetString(4),
                    Synopsis = reader.IsDBNull(5) ? "" : reader.GetString(5),
                    TargetWordCount = reader.IsDBNull(6) ? 1000000 : reader.GetInt32(6),
                    TotalWordCount = reader.IsDBNull(7) ? 0 : reader.GetInt32(7),
                    TodayWordCount = reader.IsDBNull(8) ? 0 : reader.GetInt32(8),
                };
                book.Volumes = GetVolumesByBookId(book.Id, conn);
                return book;
            }

            return null;
        }
    }

    private List<Volume> GetVolumesByBookId(string bookId, SqliteConnection conn)
    {
        var volumes = new List<Volume>();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT Id, BookId, Title, OrderIndex, WordCount FROM Volumes WHERE BookId = $bookId ORDER BY OrderIndex ASC;";
        cmd.Parameters.AddWithValue("$bookId", bookId);
        using var reader = cmd.ExecuteReader();

        while (reader.Read())
        {
            var vol = new Volume
            {
                Id = reader.GetString(0),
                BookId = reader.GetString(1),
                Title = reader.GetString(2),
                OrderIndex = reader.GetInt32(3),
                WordCount = reader.IsDBNull(4) ? 0 : reader.GetInt32(4)
            };
            volumes.Add(vol);
        }

        foreach (var vol in volumes)
        {
            vol.Chapters = GetChaptersByVolumeId(vol.Id, conn);
        }

        return volumes;
    }

    private List<Chapter> GetChaptersByVolumeId(string volumeId, SqliteConnection conn)
    {
        var chapters = new List<Chapter>();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT Id, VolumeId, Title, Content, WordCount, ParagraphCount, Status, OrderIndex FROM Chapters WHERE VolumeId = $volId ORDER BY OrderIndex ASC;";
        cmd.Parameters.AddWithValue("$volId", volumeId);
        using var reader = cmd.ExecuteReader();

        while (reader.Read())
        {
            chapters.Add(new Chapter
            {
                Id = reader.GetString(0),
                VolumeId = reader.GetString(1),
                Title = reader.GetString(2),
                Content = reader.IsDBNull(3) ? "" : reader.GetString(3),
                WordCount = reader.IsDBNull(4) ? 0 : reader.GetInt32(4),
                ParagraphCount = reader.IsDBNull(5) ? 0 : reader.GetInt32(5),
                Status = (ChapterStatus)reader.GetInt32(6),
                OrderIndex = reader.GetInt32(7)
            });
        }

        return chapters;
    }

    public void SaveBook(NovelBook book)
    {
        lock (_lock)
        {
            using var conn = new SqliteConnection(_connectionString);
            conn.Open();
            using var tx = conn.BeginTransaction();

            using var cmd = conn.CreateCommand();
            cmd.Transaction = tx;
            cmd.CommandText = @"
                INSERT INTO Books (Id, Title, Author, CoverGradient, Tags, Synopsis, TargetWordCount, TotalWordCount, TodayWordCount, UpdatedAt)
                VALUES ($id, $title, $author, $gradient, $tags, $synopsis, $target, $total, $today, $updatedAt)
                ON CONFLICT(Id) DO UPDATE SET
                    Title = excluded.Title,
                    Author = excluded.Author,
                    Tags = excluded.Tags,
                    Synopsis = excluded.Synopsis,
                    TargetWordCount = excluded.TargetWordCount,
                    TotalWordCount = excluded.TotalWordCount,
                    TodayWordCount = excluded.TodayWordCount,
                    UpdatedAt = excluded.UpdatedAt;
            ";
            cmd.Parameters.AddWithValue("$id", book.Id);
            cmd.Parameters.AddWithValue("$title", book.Title);
            cmd.Parameters.AddWithValue("$author", book.Author ?? "");
            cmd.Parameters.AddWithValue("$gradient", book.CoverGradient ?? "");
            cmd.Parameters.AddWithValue("$tags", book.Tags ?? "");
            cmd.Parameters.AddWithValue("$synopsis", book.Synopsis ?? "");
            cmd.Parameters.AddWithValue("$target", book.TargetWordCount);
            cmd.Parameters.AddWithValue("$total", book.TotalWordCount);
            cmd.Parameters.AddWithValue("$today", book.TodayWordCount);
            cmd.Parameters.AddWithValue("$updatedAt", DateTime.UtcNow.ToString("O"));

            cmd.ExecuteNonQuery();

            foreach (var vol in book.Volumes)
            {
                SaveVolumeInternal(vol, conn, tx);
            }

            tx.Commit();
        }
    }

    public void SaveVolume(Volume volume)
    {
        lock (_lock)
        {
            using var conn = new SqliteConnection(_connectionString);
            conn.Open();
            using var tx = conn.BeginTransaction();
            SaveVolumeInternal(volume, conn, tx);
            tx.Commit();
        }
    }

    private void SaveVolumeInternal(Volume volume, SqliteConnection conn, SqliteTransaction tx)
    {
        using var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = @"
            INSERT INTO Volumes (Id, BookId, Title, OrderIndex, WordCount)
            VALUES ($id, $bookId, $title, $order, $words)
            ON CONFLICT(Id) DO UPDATE SET
                Title = excluded.Title,
                OrderIndex = excluded.OrderIndex,
                WordCount = excluded.WordCount;
        ";
        cmd.Parameters.AddWithValue("$id", volume.Id);
        cmd.Parameters.AddWithValue("$bookId", volume.BookId);
        cmd.Parameters.AddWithValue("$title", volume.Title);
        cmd.Parameters.AddWithValue("$order", volume.OrderIndex);
        cmd.Parameters.AddWithValue("$words", volume.WordCount);
        cmd.ExecuteNonQuery();

        foreach (var chap in volume.Chapters)
        {
            SaveChapterInternal(chap, conn, tx);
        }
    }

    public void SaveChapter(Chapter chapter)
    {
        lock (_lock)
        {
            using var conn = new SqliteConnection(_connectionString);
            conn.Open();
            using var tx = conn.BeginTransaction();
            SaveChapterInternal(chapter, conn, tx);
            tx.Commit();
        }
    }

    private void SaveChapterInternal(Chapter chapter, SqliteConnection conn, SqliteTransaction tx)
    {
        using var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = @"
            INSERT INTO Chapters (Id, VolumeId, Title, Content, WordCount, ParagraphCount, Status, OrderIndex, CreatedAt, UpdatedAt)
            VALUES ($id, $volId, $title, $content, $words, $paras, $status, $order, $createdAt, $updatedAt)
            ON CONFLICT(Id) DO UPDATE SET
                Title = excluded.Title,
                Content = excluded.Content,
                WordCount = excluded.WordCount,
                ParagraphCount = excluded.ParagraphCount,
                Status = excluded.Status,
                UpdatedAt = excluded.UpdatedAt;
        ";
        cmd.Parameters.AddWithValue("$id", chapter.Id);
        cmd.Parameters.AddWithValue("$volId", string.IsNullOrEmpty(chapter.VolumeId) ? "vol_1" : chapter.VolumeId);
        cmd.Parameters.AddWithValue("$title", chapter.Title);
        cmd.Parameters.AddWithValue("$content", chapter.Content ?? "");
        cmd.Parameters.AddWithValue("$words", chapter.WordCount);
        cmd.Parameters.AddWithValue("$paras", chapter.ParagraphCount);
        cmd.Parameters.AddWithValue("$status", (int)chapter.Status);
        cmd.Parameters.AddWithValue("$order", chapter.OrderIndex);
        cmd.Parameters.AddWithValue("$createdAt", chapter.CreatedAt.ToString("O"));
        cmd.Parameters.AddWithValue("$updatedAt", DateTime.UtcNow.ToString("O"));

        cmd.ExecuteNonQuery();
    }

    public void SaveMindMap(string bookId, MindMapNode root)
    {
        lock (_lock)
        {
            var json = JsonSerializer.Serialize(root);
            using var conn = new SqliteConnection(_connectionString);
            conn.Open();

            using var cmd = conn.CreateCommand();
            cmd.CommandText = @"
                INSERT INTO MindMaps (BookId, DataJson, UpdatedAt)
                VALUES ($bookId, $data, $updatedAt)
                ON CONFLICT(BookId) DO UPDATE SET
                    DataJson = excluded.DataJson,
                    UpdatedAt = excluded.UpdatedAt;
            ";
            cmd.Parameters.AddWithValue("$bookId", bookId);
            cmd.Parameters.AddWithValue("$data", json);
            cmd.Parameters.AddWithValue("$updatedAt", DateTime.UtcNow.ToString("O"));

            cmd.ExecuteNonQuery();
        }
    }

    public MindMapNode? LoadMindMap(string bookId)
    {
        lock (_lock)
        {
            using var conn = new SqliteConnection(_connectionString);
            conn.Open();

            using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT DataJson FROM MindMaps WHERE BookId = $bookId LIMIT 1;";
            cmd.Parameters.AddWithValue("$bookId", bookId);

            var result = cmd.ExecuteScalar() as string;
            if (string.IsNullOrEmpty(result)) return null;

            return JsonSerializer.Deserialize<MindMapNode>(result);
        }
    }

    public void Dispose()
    {
    }
}
