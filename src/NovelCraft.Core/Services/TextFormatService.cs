using System.Text;
using System.Text.RegularExpressions;

namespace NovelCraft.Core.Services;

/// <summary>
/// 中文小说排版与字数统计服务
/// </summary>
public class TextFormatService
{
    private static readonly Regex MultipleSpacesRegex = new(@"[ \t]+", RegexOptions.Compiled);
    private static readonly Regex MultipleNewlinesRegex = new(@"\n{3,}", RegexOptions.Compiled);

    /// <summary>
    /// 一键标准中文网文排版：
    /// 1. 每段去除首尾多余空格
    /// 2. 首行统一缩进两个全角空格（\u3000\u3000）
    /// 3. 合并超过2个的连续空行
    /// 4. 规范化英文引号为中文全角引号
    /// </summary>
    public string FormatChineseNovel(string rawText)
    {
        if (string.IsNullOrWhiteSpace(rawText))
            return string.Empty;

        // 统一换行符
        string normalized = rawText.Replace("\r\n", "\n").Replace("\r", "\n");

        var lines = normalized.Split('\n');
        var sb = new StringBuilder();

        foreach (var line in lines)
        {
            var trimmed = line.Trim();
            if (string.IsNullOrEmpty(trimmed))
            {
                sb.AppendLine();
                continue;
            }

            // 过滤开头的已有全角或半角空格
            trimmed = trimmed.TrimStart(' ', '\t', '　');

            // 替换双引号为中文全角引号
            trimmed = StandardizePunctuation(trimmed);

            // 补充标准两个全角空格
            sb.AppendLine("　　" + trimmed);
        }

        var result = sb.ToString().TrimEnd();
        // 合并多余连续空行
        result = MultipleNewlinesRegex.Replace(result, "\n\n");
        return result;
    }

    /// <summary>
    /// 规范化常见中英文标点
    /// </summary>
    public string StandardizePunctuation(string text)
    {
        if (string.IsNullOrEmpty(text)) return text;
        return text
            .Replace("...", "……")
            .Replace("..", "……")
            .Replace("?", "？")
            .Replace("!", "！")
            .Replace(";", "；")
            .Replace(":", "：");
    }

    /// <summary>
    /// 统计字数（排除纯空白字符，网文标准统计）
    /// </summary>
    public int CountWords(string text)
    {
        if (string.IsNullOrWhiteSpace(text))
            return 0;

        int count = 0;
        foreach (char c in text)
        {
            if (!char.IsWhiteSpace(c))
            {
                count++;
            }
        }
        return count;
    }

    /// <summary>
    /// 统计有效段落数
    /// </summary>
    public int CountParagraphs(string text)
    {
        if (string.IsNullOrWhiteSpace(text))
            return 0;

        var lines = text.Split(new[] { "\r\n", "\r", "\n" }, StringSplitOptions.RemoveEmptyEntries);
        int count = 0;
        foreach (var l in lines)
        {
            if (!string.IsNullOrWhiteSpace(l)) count++;
        }
        return count;
    }
}
