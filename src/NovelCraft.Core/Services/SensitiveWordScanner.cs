namespace NovelCraft.Core.Services;

/// <summary>
/// 敏感词命中结果
/// </summary>
public record SensitiveMatch(string Word, int Index, int Length, string Suggestion);

/// <summary>
/// 违禁词与敏感词即时检测服务
/// </summary>
public class SensitiveWordScanner
{
    private readonly HashSet<string> _sensitiveWords = new(StringComparer.OrdinalIgnoreCase)
    {
        "违禁词示例A", "涉政词汇示例B", "低俗暴恐示例C"
    };

    public List<SensitiveMatch> ScanText(string text)
    {
        var matches = new List<SensitiveMatch>();
        if (string.IsNullOrWhiteSpace(text)) return matches;

        foreach (var word in _sensitiveWords)
        {
            int index = 0;
            while ((index = text.IndexOf(word, index, StringComparison.OrdinalIgnoreCase)) != -1)
            {
                matches.Add(new SensitiveMatch(word, index, word.Length, "建议修改表述或使用同义意象替代"));
                index += word.Length;
            }
        }

        return matches;
    }

    public void AddCustomWord(string word)
    {
        if (!string.IsNullOrWhiteSpace(word))
            _sensitiveWords.Add(word.Trim());
    }
}
