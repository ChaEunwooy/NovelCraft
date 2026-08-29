using Avalonia.Controls;
using NovelCraft.ViewModels;

namespace NovelCraft.Desktop;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        DataContext = new MainViewModel();
    }
}