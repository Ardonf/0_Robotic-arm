using BackendTest.Hubs;
using BackendTest.Models;

namespace BackendTest.Services;

/// <summary>
/// 数据转发服务 — 业务逻辑层
/// 负责：接收来自第三方/Python 的数据，校验后通过 SignalR 转发
///
/// 当前为预留的扩展点，Controller 已直接调用 Hub。
/// 如果未来需要添加数据持久化、消息队列等逻辑，在此处实现。
/// </summary>
public class DataForwardService
{
    // ─── 扩展空间 ─────────────────────────────────────────────────
    // 示例：保存数据到 SQLite / 共享目录
    // public void SavePoseToFile(ArmPose pose) { ... }
    // public void SaveHoleToFile(List<HoleItem> holes) { ... }
}
