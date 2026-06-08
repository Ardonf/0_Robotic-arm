using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using BackendTest.Models;
using BackendTest.Hubs;

namespace BackendTest.Controllers;

/// <summary>
/// 孔洞数据接收接口
///
/// 合同 2.1(3)：视觉算法完成标定后，每次移动到新拍照位置，
/// 视觉需给出实际的检测位置以及识别到的每个孔洞坐标
///
/// 合同 2.4(3)：管孔状态颜色编码
///   绿色=已检测(合格)、红色=已检测(异常)、黄色=检测中、灰色=未检测
///
/// POST http://localhost:5000/api/hole
/// Body:
/// {
///     "type": "holes",
///     "data": [
///         { "id":"hole_001","x":0.1,"y":0.5,"z":0.2,"status":"ok","value":"0.123","time":"2026-04-08 10:30","imageId":"IMG_001" }
///     ]
/// }
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class HoleController : ControllerBase
{
    private readonly IHubContext<ArmHub> _hub;

    public HoleController(IHubContext<ArmHub> hub)
    {
        _hub = hub;
    }

    /// <summary>
    /// 接收孔洞数据并广播
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> Post([FromBody] HoleRequest request)
    {
        if (request?.Data == null || request.Data.Count == 0)
            return BadRequest(new { error = "请求体不能为空" });

        Console.WriteLine(
            $"[{DateTime.Now:HH:mm:ss.fff}] 收到孔洞数据 " +
            $"共 {request.Data.Count} 个");

        // 广播给所有已连接的 SignalR 客户端
        await _hub.Clients.All.SendAsync("HoleDataUpdate", request.Data);

        return Ok(new { status = "ok", count = request.Data.Count });
    }

    /// <summary>
    /// 直接推送孔洞坐标（无状态，仅坐标列表）
    /// 用于 addHoles 场景
    /// </summary>
    [HttpPost("positions")]
    public async Task<IActionResult> PostPositions([FromBody] List<HoleItem> holes)
    {
        if (holes == null || holes.Count == 0)
            return BadRequest(new { error = "孔洞列表不能为空" });

        Console.WriteLine(
            $"[{DateTime.Now:HH:mm:ss.fff}] 收到孔洞坐标 " +
            $"共 {holes.Count} 个");

        await _hub.Clients.All.SendAsync("HolePositions", holes);

        return Ok(new { status = "ok", count = holes.Count });
    }
}
