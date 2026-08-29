using System;
using System.Collections.Generic;
using System.Globalization;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Media;
using NovelCraft.Core.Models;
using NovelCraft.ViewModels;

namespace NovelCraft.Desktop.Controls;

/// <summary>
/// 高性能原生思维导图画布控件 (支持贝塞尔曲线连线、点阵背景、平移缩放、节点选中与交互)
/// </summary>
public class MindMapCanvas : Control
{
    public static readonly StyledProperty<MindMapViewModel?> ViewModelProperty =
        AvaloniaProperty.Register<MindMapCanvas, MindMapViewModel?>(nameof(ViewModel));

    public MindMapViewModel? ViewModel
    {
        get => GetValue(ViewModelProperty);
        set => SetValue(ViewModelProperty, value);
    }

    private bool _isPanning = false;
    private Point _startPanPoint;
    private double _initialPanX;
    private double _initialPanY;

    // 常用画刷与笔刷 (纯白明亮高对比度主题)
    private static readonly IBrush DotBrush = new SolidColorBrush(Color.Parse("#CBD5E1"));
    private static readonly IPen LinePen = new Pen(new SolidColorBrush(Color.Parse("#4F46E5")), 2.2);
    private static readonly IBrush NodeBgBrush = new SolidColorBrush(Color.Parse("#FFFFFF"));
    private static readonly IBrush NodeSelectedBgBrush = new SolidColorBrush(Color.Parse("#EEF2FF"));
    private static readonly IBrush RootNodeBgBrush = new SolidColorBrush(Color.Parse("#4F46E5"));
    private static readonly IPen NodeBorderPen = new Pen(new SolidColorBrush(Color.Parse("#CBD5E1")), 1.5);
    private static readonly IPen NodeSelectedBorderPen = new Pen(new SolidColorBrush(Color.Parse("#4F46E5")), 2.0);
    private static readonly IBrush BranchGoldBrush = new SolidColorBrush(Color.Parse("#D97706"));

    static MindMapCanvas()
    {
        AffectsRender<MindMapCanvas>(ViewModelProperty);
    }

    public MindMapCanvas()
    {
        ClipToBounds = true;
    }

    protected override void OnPropertyChanged(AvaloniaPropertyChangedEventArgs change)
    {
        base.OnPropertyChanged(change);
        if (change.Property == ViewModelProperty)
        {
            if (change.OldValue is MindMapViewModel oldVm)
            {
                oldVm.PropertyChanged -= OnViewModelPropertyChanged;
            }
            if (change.NewValue is MindMapViewModel newVm)
            {
                newVm.PropertyChanged += OnViewModelPropertyChanged;
            }
            InvalidateVisual();
        }
    }

    private void OnViewModelPropertyChanged(object? sender, System.ComponentModel.PropertyChangedEventArgs e)
    {
        InvalidateVisual();
    }

    public override void Render(DrawingContext context)
    {
        base.Render(context);

        var bounds = Bounds;
        if (bounds.Width <= 0 || bounds.Height <= 0) return;

        var vm = ViewModel;
        double panX = vm?.PanX ?? 40;
        double panY = vm?.PanY ?? 100;
        double zoom = vm?.ZoomLevel ?? 1.0;

        // 1. 绘制点阵网格背景 (Dot Grid)
        double gridStep = 22 * zoom;
        double startX = (panX % gridStep + gridStep) % gridStep;
        double startY = (panY % gridStep + gridStep) % gridStep;

        for (double x = startX; x < bounds.Width; x += gridStep)
        {
            for (double y = startY; y < bounds.Height; y += gridStep)
            {
                context.DrawEllipse(DotBrush, null, new Point(x, y), 1.2, 1.2);
            }
        }

        if (vm?.RootNode == null) return;

        // 2. 变换矩阵 (平移 + 缩放)
        using (context.PushTransform(Matrix.CreateTranslation(panX, panY) * Matrix.CreateScale(zoom, zoom)))
        {
            var nodeBoundsMap = new Dictionary<string, Rect>();

            // 计算所有节点的尺寸与位置
            void MeasureNode(MindMapNode node)
            {
                var text = node.Text;
                var ft = new FormattedText(
                    text,
                    CultureInfo.CurrentCulture,
                    FlowDirection.LeftToRight,
                    new Typeface("Microsoft YaHei, Segoe UI, PingFang SC, sans-serif", FontStyle.Normal, FontWeight.SemiBold),
                    12,
                    Brushes.Black
                );

                double paddingH = 14;
                double paddingV = 8;
                double width = ft.Width + paddingH * 2;
                double height = ft.Height + paddingV * 2;

                nodeBoundsMap[node.Id] = new Rect(node.X, node.Y, width, height);

                foreach (var child in node.Children)
                {
                    MeasureNode(child);
                }
            }

            MeasureNode(vm.RootNode);

            // 3. 绘制优美的三次贝塞尔曲线连线 (Cubic Bezier Curves)
            void DrawConnections(MindMapNode parent)
            {
                if (!nodeBoundsMap.TryGetValue(parent.Id, out var parentRect)) return;

                Point startPt = new Point(parentRect.Right, parentRect.Center.Y);

                foreach (var child in parent.Children)
                {
                    if (nodeBoundsMap.TryGetValue(child.Id, out var childRect))
                    {
                        Point endPt = new Point(childRect.Left, childRect.Center.Y);

                        var geo = new StreamGeometry();
                        using (var ctx = geo.Open())
                        {
                            ctx.BeginFigure(startPt, false);
                            double dx = Math.Abs(endPt.X - startPt.X) * 0.5;
                            Point c1 = new Point(startPt.X + dx, startPt.Y);
                            Point c2 = new Point(endPt.X - dx, endPt.Y);
                            ctx.CubicBezierTo(c1, c2, endPt);
                        }

                        context.DrawGeometry(null, LinePen, geo);
                    }

                    DrawConnections(child);
                }
            }

            DrawConnections(vm.RootNode);

            // 4. 绘制每个节点卡片
            void DrawNodes(MindMapNode node)
            {
                if (!nodeBoundsMap.TryGetValue(node.Id, out var rect)) return;

                bool isSelected = vm.SelectedNode?.Id == node.Id;
                bool isRoot = node.NodeType == "root-node" || node.Id == "root";
                bool isBranch = node.NodeType == "branch-node";

                IBrush bgBrush = isRoot ? RootNodeBgBrush : (isSelected ? NodeSelectedBgBrush : NodeBgBrush);
                IPen borderPen = isSelected ? NodeSelectedBorderPen : NodeBorderPen;
                IBrush textBrush = isRoot ? Brushes.White : (isSelected ? new SolidColorBrush(Color.Parse("#4F46E5")) : new SolidColorBrush(Color.Parse("#0F172A")));

                // 节点外框与圆角
                context.DrawRectangle(bgBrush, borderPen, new RoundedRect(rect, 6, 6));

                // 支线节点左侧金色条
                if (isBranch && !isRoot)
                {
                    var goldBarRect = new Rect(rect.Left, rect.Top + 2, 3.5, rect.Height - 4);
                    context.DrawRectangle(BranchGoldBrush, null, new RoundedRect(goldBarRect, 2, 2));
                }

                // 绘制节点文本
                var ft = new FormattedText(
                    node.Text,
                    CultureInfo.CurrentCulture,
                    FlowDirection.LeftToRight,
                    new Typeface("Microsoft YaHei, Segoe UI, PingFang SC, sans-serif", FontStyle.Normal, isRoot ? FontWeight.Bold : FontWeight.Medium),
                    isRoot ? 13 : 12,
                    textBrush
                );

                double textX = rect.Left + 14;
                double textY = rect.Top + (rect.Height - ft.Height) / 2;
                context.DrawText(ft, new Point(textX, textY));

                foreach (var child in node.Children)
                {
                    DrawNodes(child);
                }
            }

            DrawNodes(vm.RootNode);
        }
    }

    protected override void OnPointerPressed(PointerPressedEventArgs e)
    {
        base.OnPointerPressed(e);
        var pt = e.GetPosition(this);
        var vm = ViewModel;
        if (vm == null) return;

        double panX = vm.PanX;
        double panY = vm.PanY;
        double zoom = vm.ZoomLevel;

        // 逆变换求出逻辑坐标
        double logicalX = (pt.X - panX) / zoom;
        double logicalY = (pt.Y - panY) / zoom;

        MindMapNode? hitNode = null;

        void HitTest(MindMapNode node)
        {
            var ft = new FormattedText(
                node.Text,
                CultureInfo.CurrentCulture,
                FlowDirection.LeftToRight,
                new Typeface("Microsoft YaHei, Segoe UI, sans-serif", FontStyle.Normal, FontWeight.SemiBold),
                12,
                Brushes.Black
            );
            var rect = new Rect(node.X, node.Y, ft.Width + 28, ft.Height + 16);

            if (rect.Contains(new Point(logicalX, logicalY)))
            {
                hitNode = node;
                return;
            }

            foreach (var child in node.Children)
            {
                HitTest(child);
                if (hitNode != null) return;
            }
        }

        HitTest(vm.RootNode);

        if (hitNode != null)
        {
            vm.SelectedNode = hitNode;
            InvalidateVisual();
        }
        else
        {
            // 开始拖动画布
            _isPanning = true;
            _startPanPoint = pt;
            _initialPanX = vm.PanX;
            _initialPanY = vm.PanY;
        }
    }

    protected override void OnPointerMoved(PointerEventArgs e)
    {
        base.OnPointerMoved(e);
        if (_isPanning && ViewModel != null)
        {
            var curPt = e.GetPosition(this);
            ViewModel.PanX = _initialPanX + (curPt.X - _startPanPoint.X);
            ViewModel.PanY = _initialPanY + (curPt.Y - _startPanPoint.Y);
            InvalidateVisual();
        }
    }

    protected override void OnPointerReleased(PointerReleasedEventArgs e)
    {
        base.OnPointerReleased(e);
        _isPanning = false;
    }

    protected override void OnPointerWheelChanged(PointerWheelEventArgs e)
    {
        base.OnPointerWheelChanged(e);
        if (ViewModel != null)
        {
            double factor = e.Delta.Y > 0 ? 1.1 : 0.9;
            ViewModel.ZoomLevel = Math.Clamp(ViewModel.ZoomLevel * factor, 0.4, 2.5);
            InvalidateVisual();
        }
    }
}
