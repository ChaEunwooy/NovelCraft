using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using NovelCraft.Core.Models;
using NovelCraft.Core.Storage;
using System.Collections.ObjectModel;

namespace NovelCraft.ViewModels;

/// <summary>
/// 思维导图 ViewModel
/// </summary>
public partial class MindMapViewModel : ObservableObject
{
    private readonly SqliteDatabaseService _dbService;

    [ObservableProperty]
    private MindMapNode _rootNode;

    [ObservableProperty]
    private MindMapNode? _selectedNode;

    [ObservableProperty]
    private double _zoomLevel = 1.0;

    [ObservableProperty]
    private double _panX = 40;

    [ObservableProperty]
    private double _panY = 100;

    [ObservableProperty]
    private string _statusMessage = "就绪";

    public ObservableCollection<MindMapNode> AllNodesFlat { get; } = new();

    public MindMapViewModel(SqliteDatabaseService dbService)
    {
        _dbService = dbService;

        // 初始化默认思维导图数据
        var root = new MindMapNode
        {
            Id = "root",
            Text = "《星渊之上》主线大纲",
            NodeType = "root-node",
            X = 30,
            Y = 160
        };

        var branch1 = new MindMapNode
        {
            Id = "b1",
            Text = "第一卷：拾荒觉醒",
            NodeType = "branch-node",
            X = 200,
            Y = 60,
            ParentId = "root"
        };
        branch1.Children.Add(new MindMapNode { Id = "b1_1", Text = "暗区废墟拾荒", X = 350, Y = 30, ParentId = "b1" });
        branch1.Children.Add(new MindMapNode { Id = "b1_2", Text = "融合超脑火种 (伏笔1)", X = 350, Y = 80, ParentId = "b1" });

        var branch2 = new MindMapNode
        {
            Id = "b2",
            Text = "第二卷：星环风暴 (当前)",
            NodeType = "branch-node",
            X = 200,
            Y = 180,
            ParentId = "root"
        };
        branch2.Children.Add(new MindMapNode { Id = "b2_1", Text = "第128章 虚空之眼降临", X = 350, Y = 150, ParentId = "b2" });
        branch2.Children.Add(new MindMapNode { Id = "b2_2", Text = "激活法则核心反杀", X = 350, Y = 200, ParentId = "b2" });
        branch2.Children.Add(new MindMapNode { Id = "b2_3", Text = "逃入未知暗星区", X = 350, Y = 250, ParentId = "b2" });

        var branch3 = new MindMapNode
        {
            Id = "b3",
            Text = "关键人物与势力",
            NodeType = "branch-node",
            X = 200,
            Y = 310,
            ParentId = "root"
        };
        branch3.Children.Add(new MindMapNode { Id = "b3_1", Text = "主角：林渊 (冷峻/果决)", X = 350, Y = 290, ParentId = "b3" });
        branch3.Children.Add(new MindMapNode { Id = "b3_2", Text = "宿敌：虚空议会", X = 350, Y = 340, ParentId = "b3" });

        root.Children.Add(branch1);
        root.Children.Add(branch2);
        root.Children.Add(branch3);

        _rootNode = root;
        _selectedNode = root;
        RefreshFlatNodes();
    }

    public void RefreshFlatNodes()
    {
        AllNodesFlat.Clear();
        void Traverse(MindMapNode node)
        {
            AllNodesFlat.Add(node);
            foreach (var child in node.Children)
            {
                Traverse(child);
            }
        }
        Traverse(RootNode);
    }

    [RelayCommand]
    public void SelectNode(MindMapNode node)
    {
        SelectedNode = node;
    }

    [RelayCommand]
    public void AddChildNode()
    {
        var target = SelectedNode ?? RootNode;
        var newNode = new MindMapNode
        {
            Id = "node_" + Guid.NewGuid().ToString("N")[..8],
            Text = "新剧情分支/灵感",
            NodeType = "leaf-node",
            X = target.X + 150,
            Y = target.Y + (target.Children.Count * 45) - 20,
            ParentId = target.Id
        };
        target.Children.Add(newNode);
        SelectedNode = newNode;
        RefreshFlatNodes();
        SaveMindMap();
    }

    [RelayCommand]
    public void DeleteNode()
    {
        if (SelectedNode == null || SelectedNode.Id == "root") return;

        bool RemoveRecursive(MindMapNode current)
        {
            var item = current.Children.FirstOrDefault(c => c.Id == SelectedNode.Id);
            if (item != null)
            {
                current.Children.Remove(item);
                return true;
            }
            foreach (var child in current.Children)
            {
                if (RemoveRecursive(child)) return true;
            }
            return false;
        }

        RemoveRecursive(RootNode);
        SelectedNode = RootNode;
        RefreshFlatNodes();
        SaveMindMap();
    }

    [RelayCommand]
    public void ZoomIn() => ZoomLevel = Math.Min(ZoomLevel * 1.15, 2.5);

    [RelayCommand]
    public void ZoomOut() => ZoomLevel = Math.Max(ZoomLevel * 0.85, 0.4);

    [RelayCommand]
    public void ResetView()
    {
        ZoomLevel = 1.0;
        PanX = 40;
        PanY = 100;
    }

    private void SaveMindMap()
    {
        _dbService.SaveMindMap("book_default", RootNode);
    }
}
