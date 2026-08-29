using System.Text.Json.Serialization;

namespace NovelCraft.Core.Models;

/// <summary>
/// 思维导图节点模型
/// </summary>
public class MindMapNode
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Text { get; set; } = "新节点";
    public string NodeType { get; set; } = "branch-node"; // root-node, branch-node, leaf-node
    public double X { get; set; } = 0;
    public double Y { get; set; } = 0;
    public string? ParentId { get; set; }
    public string? ColorHex { get; set; }
    public string? LinkedChapterId { get; set; }

    public List<MindMapNode> Children { get; set; } = new();

    public MindMapNode Clone()
    {
        var node = new MindMapNode
        {
            Id = this.Id,
            Text = this.Text,
            NodeType = this.NodeType,
            X = this.X,
            Y = this.Y,
            ParentId = this.ParentId,
            ColorHex = this.ColorHex,
            LinkedChapterId = this.LinkedChapterId
        };
        foreach (var c in this.Children)
        {
            node.Children.Add(c.Clone());
        }
        return node;
    }
}

/// <summary>
/// 世界观与人物设定实体模型
/// </summary>
public class LoreEntity
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string BookId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = "人物"; // 人物, 势力, 地理, 功法/金手指, 宝物
    public string Description { get; set; } = string.Empty;
    public Dictionary<string, string> Attributes { get; set; } = new();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
