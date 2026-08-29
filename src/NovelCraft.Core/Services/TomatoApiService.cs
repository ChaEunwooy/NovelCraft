using System.Net.Http;
using System.Text.Json;

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

    public async Task<string> GetNovelsJsonAsync(string cookie, string csrfToken = "")
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
        return await res.Content.ReadAsStringAsync();
    }

    public async Task<string> GetVolumesJsonAsync(string bookId, string cookie, string csrfToken = "")
    {
        using var req = new HttpRequestMessage(HttpMethod.Get, $"{BaseUrl}/api/author/volume/volume_list/v1?aid=2503&app_name=muye_novel&book_id={bookId}");
        req.Headers.Add("Cookie", cookie);
        req.Headers.Add("Origin", BaseUrl);
        req.Headers.Add("Referer", $"{BaseUrl}/main/writer/");
        if (!string.IsNullOrEmpty(csrfToken))
        {
            req.Headers.Add("X-Secsdk-Csrf-Token", csrfToken);
        }

        var res = await _httpClient.SendAsync(req);
        return await res.Content.ReadAsStringAsync();
    }

    public async Task<string> GetChaptersJsonAsync(string bookId, string volumeId, string cookie, string csrfToken = "")
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
        return await res.Content.ReadAsStringAsync();
    }

    public async Task<string> GetChapterContentJsonAsync(string itemId, string cookie, string csrfToken = "")
    {
        var url = $"{BaseUrl}/api/author/chapter/chapter_content/v1?aid=2503&app_name=muye_novel&item_id={itemId}";
        using var req = new HttpRequestMessage(HttpMethod.Get, url);
        req.Headers.Add("Cookie", cookie);
        req.Headers.Add("Origin", BaseUrl);
        req.Headers.Add("Referer", $"{BaseUrl}/main/writer/");
        if (!string.IsNullOrEmpty(csrfToken))
        {
            req.Headers.Add("X-Secsdk-Csrf-Token", csrfToken);
        }

        var res = await _httpClient.SendAsync(req);
        return await res.Content.ReadAsStringAsync();
    }
}
