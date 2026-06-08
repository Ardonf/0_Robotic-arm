namespace BackendTest.Models;

/// <summary>
/// 7 轴机械臂关节角度数据（j0 ~ j6）
/// 来源：第三方/Python 视觉算法 → HTTP POST
/// 单位：弧度
/// </summary>
public class ArmPose
{
    /// <summary>底座旋转（CS620-Base）</summary>
    public double J0 { get; set; }
    public double J1 { get; set; }
    public double J2 { get; set; }
    public double J3 { get; set; }
    public double J4 { get; set; }
    public double J5 { get; set; }
    public double J6 { get; set; }

    /// <summary>
    /// 底座 XYZ 位移（CS620-Base 的位置偏移，单位：模型坐标系）
    /// </summary>
    public double? J0x { get; set; }
    public double? J0y { get; set; }
    public double? J0z { get; set; }

    /// <summary>
    /// 笛卡尔坐标（可选，合同 2.4(2) 要求 X/Y/Z/Rx/Ry/Rz）
    /// </summary>
    public double? X  { get; set; }
    public double? Y  { get; set; }
    public double? Z  { get; set; }
    public double? Rx { get; set; }
    public double? Ry { get; set; }
    public double? Rz { get; set; }
}
