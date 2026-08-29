using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace NovelCraft.Core.Services;

public class TomatoApiService
{
    private readonly HttpClient _httpClient;
    private const string BaseUrl = "https://fanqienovel.com";
    private const string UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

    public TomatoApiService()
    {
        _httpClient = new HttpClient();
        _httpClient.DefaultRequestHeaders.Add("User-Agent", UserAgent);
    }

    public async Task<JsonDocument?> GetNovelsAsync(string cookie, string csrfToken = "")
    {
        using var req = new HttpRequestMessage(HttpMethod.Get, $"{BaseUrl}/api/author/book/book_list/v0?aid=2503&app_name=muye_novel&page_index=0&page_count=50");
        req.Headers.Add("Cookie", cookie);
        req.Headers.Add("Origin", BaseUrl);
        req.Headers.Add("Referer", $"{BaseUrl}/main/writer/");
        if (!string.IsNullOrEmpty(csrfToken))
        {
            req.Headers.Add("X-Secsdk-Csrf-Token", csrfToken);
        }

        var res = await _httpClient.SendAsync(req);
        if (!res.IsSuccessStatusCode) return null;

        var json = await res.Content.ReadAsStringAsync();
        return JsonDocument.Parse(json);
    }

    public async Task<JsonDocument?> GetChaptersAsync(string bookId, string volumeId, string cookie, string csrfToken = "")
    {
        var url = $"{BaseUrl}/api/author/chapter/chapter_list/v1?aid=2503&app_name=muye_novel&book_id={bookId}&volume_id={volumeId}&page_index=0&page_count=100&status=0";
        using var req = new HttpRequestMessage(HttpMethod.Get, url);
        req.Headers.Add("Cookie", cookie);
        req.Headers.Add("Origin", BaseUrl);
        req.Headers.Add("Referer", $"{BaseUrl}/main/writer/");
        if (!string.IsNullOrEmpty(csrfToken))
        {
            req.Headers.Add("X-Secsdk-Csrf-Token", csrfToken);
        }

        var res = await _httpClient.SendAsync(req);
        if (!res.IsSuccessStatusCode) return null;

        var json = await res.Content.ReadAsStringAsync();
        return JsonDocument.Parse(json);
    }

    public async Task<JsonDocument?> PublishChapterAsync(string bookId, string title, string content, string cookie, string csrfToken = "", string volumeId = "")
    {
        var form = new Dictionary<string, string>
        {
            ["aid"] = "2503",
            ["app_name"] = "muye_novel",
            ["book_id"] = bookId,
            ["title"] = title,
            ["content"] = content,
            ["volume_id"] = volumeId,
            ["publish_status"] = "1",
            ["device_platform"] = "pc"
        };

        using var req = new HttpRequestMessage(HttpMethod.Post, $"{BaseUrl}/api/author/publish_article/v0/")
        {
            Content = new FormUrlEncodedContent(form)
        };
        req.Headers.Add("Cookie", cookie);
        req.Headers.Add("Origin", BaseUrl);
        req.Headers.Add("Referer", $"{BaseUrl}/main/writer/");
        if (!string.IsNullOrEmpty(csrfToken))
        {
            req.Headers.Add("X-Secsdk-Csrf-Token", csrfToken);
        }

        var res = await _httpClient.SendAsync(req);
        var json = await res.Content.ReadAsStringAsync();
        return JsonDocument.Parse(json);
    }
}
