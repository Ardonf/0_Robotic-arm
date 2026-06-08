using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using BackendTest.Models;
using BackendTest.Hubs;

namespace BackendTest.Controllers;

/// <summary>
/// 机械臂关节坐标接收接口
///
/// 合同 2.4(2)：第三方/Python 通过 HTTP POST 推送 6 轴关节坐标
/// 推送频率 ≥ 10 Hz
///
/// POST http://localhost:5000/api/pose
/// Body: { "j1":0.1, "j2":0.3, "j3":0.0, "j4":0.0, "j5":0.5, "j6":1.2 }
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class PoseController : ControllerBase
{
    private readonly IHubContext<ArmHub> _hub;

    public PoseController(IHubContext<ArmHub> hub)
    {
        _hub = hub;
    }

    /// <summary>
    /// 接收关节坐标并广播
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> Post([FromBody] ArmPose pose)
    {
        if (pose == null)
            return BadRequest(new { error = "请求体不能为空" });

        // 记录日志（SignalR 会异步广播给所有前端）
        Console.WriteLine(
            $"[{DateTime.Now:HH:mm:ss.fff}] 收到关节坐标 " +
            $"J0={pose.J0:F4} J1={pose.J1:F4} " +
            $"J2={pose.J2:F4} J3={pose.J3:F4} " +
            $"J4={pose.J4:F4} J5={pose.J5:F4} " +
            $"J6={pose.J6:F4} " +
            $"底座位移 (J0x={pose.J0x:F4} J0y={pose.J0y:F4} J0z={pose.J0z:F4})");

        // 广播给所有已连接的 SignalR 客户端
        await _hub.Clients.All.SendAsync("ArmPoseUpdate", pose);

        return Ok(new { status = "ok" });
    }
}
