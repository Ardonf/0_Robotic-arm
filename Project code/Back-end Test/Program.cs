using BackendTest.Hubs;

// ═══════════════════════════════════════════════════════════════════
// 如果你更改了 "Back-end Test" 文件夹名称，检查以下位置：
//   1. BackendTest.csproj 文件名（应与 AssemblyName 对应）
//   2. 所有 C# 文件顶部的 namespace BackendTest... → 改为新名字
//   3. 本文件 using BackendTest.Hubs  → 改为新名字.Hubs
// ═══════════════════════════════════════════════════════════════════

var builder = WebApplication.CreateBuilder(args);

// ── 注册服务 ─────────────────────────────────────────────────────
builder.Services.AddControllers();
builder.Services.AddSignalR(); // SignalR WebSocket 支持

// ── CORS — 允许前端跨域连接 ──────────────────────────────────────
// 开发环境允许 any，生产环境应限制为实际前端地址
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy
            .AllowAnyHeader()
            .AllowAnyMethod()
            .SetIsOriginAllowed(_ => true) // 开发用，生产应改为具体域名
            .AllowCredentials();
    });
});

var app = builder.Build();

// ── 中间件管道 ───────────────────────────────────────────────────
app.UseCors();
app.MapControllers();

// ── SignalR Hub 端点 ─────────────────────────────────────────────
// 前端通过 http://localhost:5000/hub/arm 连接
app.MapHub<ArmHub>("/hub/arm");

// ── 启动信息 ─────────────────────────────────────────────────────
var url = app.Urls.FirstOrDefault() ?? "http://localhost:5000";
Console.WriteLine("╔══════════════════════════════════════════════════════════════╗");
Console.WriteLine("║           采集系统后端服务 已启动                            ║");
Console.WriteLine($"║           API 地址: {url}                    ║");
Console.WriteLine($"║           Hub 端点: {url}/hub/arm            ║");
Console.WriteLine("║                                                            ║");
Console.WriteLine("║  可用接口:                                                  ║");
Console.WriteLine($"║    POST {url}/api/pose   ← 机械臂关节坐标                   ║");
Console.WriteLine($"║    POST {url}/api/hole   ← 孔洞数据                         ║");
Console.WriteLine("║                                                            ║");
Console.WriteLine("╚══════════════════════════════════════════════════════════════╝");

app.Run();
