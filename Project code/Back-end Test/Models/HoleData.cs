namespace BackendTest.Models;

/// <summary>
/// 单个传热管孔的数据
/// 来源：视觉算法 → HTTP POST
/// </summary>
public class HoleItem
{
    public string Id { get; set; } = string.Empty;

    /// <summary>孔洞在世界坐标系中的位置</summary>
    public double X { get; set; }
    public double Y { get; set; }
    public double Z { get; set; }

    /// <summary>
    /// 检测状态: ok | ng | active | pending
    /// ok=合格(绿), ng=异常(红), active=检测中(黄), pending=未检测(灰)
    /// </summary>
    public string Status { get; set; } = "pending";

    /// <summary>检测数值（如孔径、深度等）</summary>
    public string? Value { get; set; }

    /// <summary>检测时间</summary>
    public string? Time { get; set; }

    /// <summary>关联图像编号</summary>
    public string? ImageId { get; set; }
}

/// <summary>
/// 视觉算法批量上报的孔洞数据
/// </summary>
public class HoleRequest
{
    public string Type { get; set; } = "holes";
    public List<HoleItem> Data { get; set; } = new();
}
