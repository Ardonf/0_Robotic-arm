using Microsoft.AspNetCore.SignalR;
using BackendTest.Models;

namespace BackendTest.Hubs;

/// <summary>
/// SignalR Hub — 负责将坐标/孔洞数据实时广播给所有已连接的前端
///
/// 前端接入代码示例（Vue 3）：
///   import * as signalR from '@microsoft/signalr'
///   const conn = new signalR.HubConnectionBuilder()
///     .withUrl('http://localhost:5000/hub/arm')
///     .build()
///   conn.on('ArmPoseUpdate', (pose) => { ... })
///   conn.on('HoleDataUpdate', (holes) => { ... })
///   conn.start()
/// </summary>
public class ArmHub : Hub
{
    /// <summary>
    /// 广播机械臂关节角度到所有前端
    /// 调用时机：PoseController 收到 HTTP POST 后
    /// </summary>
    public async Task SendArmPose(ArmPose pose)
    {
        await Clients.All.SendAsync("ArmPoseUpdate", pose);
    }

    /// <summary>
    /// 广播孔洞数据到所有前端
    /// 调用时机：HoleController 收到 HTTP POST 后
    /// </summary>
    public async Task SendHoleData(List<HoleItem> holes)
    {
        await Clients.All.SendAsync("HoleDataUpdate", holes);
    }
}
