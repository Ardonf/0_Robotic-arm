# 前端与后端数据接口约定

> 版本: 1.3 · 日期: 2026-07-29 · 作者: 前端团队\
> 本文档定义前端三维模型展示模块与桌面端程序（C# 上位机）之间的通信协议。\
> **如有争议，以本文档为准。**

***

## 目录

- [1. 嵌入方案](#1-嵌入方案)
- [2. 通信协议](#2-通信协议)
- [3. 消息类型](#3-消息类型)
  - [3.1 姿态消息](#31-姿态消息-pose) [`pose`](#31-姿态消息-pose)
- [4. 字段参考](#4-字段参考)
- [5. C# 调用示例](#5-c-调用示例)
- [6. 搭建指引](#6-搭建指引)
- [7. 变更记录](#7-变更记录)
- [8. 后端程序员部署操作](#8-后端程序员部署操作)

***

## 1. 嵌入方案

前端支持以下两种通信方式，**可同时启用，互不冲突**。

### 方式 A：WebView2 桥接（嵌入式）

通过 **Microsoft Edge WebView2** 控件加载前端页面，C# 端通过 `PostWebMessageAsString` 实时推送关节数据。

#### 开发环境

前端开发服务器启动在本机 **5173** 端口，WebView2 加载：

```csharp
webView.Source = new Uri("http://localhost:5173");
```

#### 生产环境

前端执行 `npm run build` 后产物在 `dist/` 目录，将 `dist/` 内所有文件拷贝到部署路径，WebView2 加载 `index.html`：

```csharp
string path = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wwwroot", "index.html");
webView.Source = new Uri($"file:///{path.Replace("\\", "/")}");
```

> **前置条件**：桌面端需要安装 [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/)。

### 方式 B：REST API 轮询（后端 API）

前端通过定时轮询后端 `GET /Robot/position` 接口获取关节坐标。适用于前端部署到后端 `wwwroot` 的部署场景。

数据流：`PLC → HTTP POST → .NET 8 后端 → GET /Robot/position → 前端`

```bash
# 前端部署后，从 http://localhost:5000/ 加载页面
# 前端自动以 100ms（10Hz）间隔轮询同源 /Robot/position
```

> 前端使用相对路径 `/Robot/position`，部署到 `wwwroot` 后自动指向同源后端，**无需任何配置**。

#### REST API 响应格式

后端 `GET /Robot/position` 须返回以下 JSON：

```json
{
  "j0":  0.0,
  "j1":  0.1,
  "j2":  0.3,
  "j3": -0.2,
  "j4":  0.0,
  "j5":  0.5,
  "j6":  1.2,
  "j0x": 0.0,
  "j0y": 0.0,
  "j0z": 0.0
}
```

| 字段 | 类型 | 必须 | 单位 | 说明 |
|------|------|------|------|------|
| `j0` ~ `j6` | number | ✅ | 弧度 | 7 轴关节旋转角度 |
| `j0x` / `j0y` / `j0z` | number | ❌ | 模型坐标 | 底座 XYZ 位移 |

> **字段命名**：建议使用 camelCase（小驼峰）。如果后端返回 PascalCase（如 `J1`、`J0x`），需通知前端修改 [useRobotPolling.js](src/composables/useRobotPolling.js) 中的字段映射。

***

## 2. 通信协议

### 方式 A：WebView2 桥接

#### 方向

```
桌面端 (C#)  ──JSON──→  前端 (JS)
```

桌面端**主动推送**数据到前端，前端被动接收并渲染。通信方向为**单向**（C# → JS）。

#### 传输方式

C# 端通过 WebView2 的 `PostWebMessageAsString` API 发送 JSON 字符串：

```csharp
webView.CoreWebView2.PostWebMessageAsString(json);
```

前端在 `window.onCSharpMessage` 函数中接收：

```js
window.onCSharpMessage = (jsonStr) => {
  const msg = JSON.parse(jsonStr)
  // 根据 msg.type 分发到对应处理器
}
```

#### 通用格式

所有消息均为单行 JSON 对象，**必须**包含 `type` 字段：

```jsonc
{
  "type": "消息类型标识符",
  // ... 消息特定字段
}
```

### 方式 B：REST API 轮询

#### 方向

```
前端 (JS)  ──HTTP GET──→  后端 (C# API)  ──JSON──→  前端 (JS)
```

前端**主动轮询**后端接口，后端返回当前关节状态。默认间隔 100ms（10Hz）。

#### 轮询策略

- 成功后以 100ms 固定间隔继续轮询
- 请求失败时采用指数退避（最大 3s 间隔），避免后端未就绪时高频报错
- 后端恢复后自动恢复到 100ms 间隔

***

## 3. 消息类型

### 3.1 姿态消息 `pose`

**用途：** 推送机械臂 7 轴关节旋转角度及底座位移。

**推送频率：** ≥ 10 Hz（每秒至少 10 次）

**JSON Schema：**

```json
{
  "type": "pose",
  "j0":  0.0,
  "j1":  0.1,
  "j2":  0.3,
  "j3": -0.2,
  "j4":  0.0,
  "j5":  0.5,
  "j6":  1.2,
  "j0x": 0.0,
  "j0y": 0.0,
  "j0z": 0.0
}
```

| 字段     | 类型     | 必须 | 单位   | 说明                   |
| ------ | ------ | -- | ---- | -------------------- |
| `type` | string | ✅  | —    | 固定值 `"pose"`         |
| `j0`   | number | ✅  | 弧度   | 底座骨骼 (CS620-Base) 旋转 |
| `j1`   | number | ✅  | 弧度   | J1 关节旋转              |
| `j2`   | number | ✅  | 弧度   | J2 关节旋转              |
| `j3`   | number | ✅  | 弧度   | J3 关节旋转              |
| `j4`   | number | ✅  | 弧度   | J4 关节旋转              |
| `j5`   | number | ✅  | 弧度   | J5 关节旋转              |
| `j6`   | number | ✅  | 弧度   | J6 关节旋转（末端执行器）       |
| `j0x`  | number | ❌  | 模型坐标 | 底座 X 位移              |
| `j0y`  | number | ❌  | 模型坐标 | 底座 Y 位移              |
| `j0z`  | number | ❌  | 模型坐标 | 底座 Z 位移              |

> ⚠️ **注意：** 关节角度单位为**弧度**，非角度。频率不足会导致模型运动卡顿，建议 20\~50 Hz。

***

## 4. 字段参考

### 坐标系单位

| 类别      | 单位          | 说明                                              |
| ------- | ----------- | ----------------------------------------------- |
| 关节旋转    | 弧度 (rad)    | 1 rad ≈ 57.3°。桌面端如果使用角度，发送前需用 `角度 × π ÷ 180` 转换 |
| 位移 / 坐标 | 模型坐标系单位 (m) | 与 Blender glTF 导出单位一致                           |

### 错误处理

前端接收到消息后，如果 JSON 解析失败，会在浏览器控制台打印：

```
[Bridge] 消息解析失败: <错误详情>
```

桌面端应将此异常的捕获列入调试用例：如果反复出现此日志，说明发送的 JSON 格式有误。

***

## 5. C# 调用示例

### 方式 A：WebView2 桥接 — 推送关节姿态

```csharp
using System.Text.Json;

public static class FrontendBridge
{
    /// <summary>
    /// 推送机械臂关节姿态（频率 ≥10 Hz）
    /// 数据流：C# → PostWebMessageAsString → 前端 window.onCSharpMessage
    /// </summary>
    public static void SendPose(WebView2 webView,
        double j0, double j1, double j2,
        double j3, double j4, double j5, double j6,
        double j0x = 0, double j0y = 0, double j0z = 0)
    {
        var payload = new
        {
            type = "pose",
            j0, j1, j2, j3, j4, j5, j6, j0x, j0y, j0z
        };
        webView.CoreWebView2.PostWebMessageAsString(
            JsonSerializer.Serialize(payload));
    }
}
```

### 方式 B：REST API — 轮询端点实现

后端需实现 `GET /Robot/position`，返回当前关节状态（存储最近一次 PLC 推送的值）：

```csharp
// Controller 示例
[ApiController]
[Route("[controller]")]
public class RobotController : ControllerBase
{
    private static ArmPose _latestPose = new();

    /// <summary>PLC 上位机通过此接口推送最新关节坐标</summary>
    [HttpPost("position")]
    public IActionResult PostPosition([FromBody] ArmPose pose)
    {
        _latestPose = pose;
        return Ok();
    }

    /// <summary>前端通过此接口轮询获取当前关节坐标（100ms 间隔）</summary>
    [HttpGet("position")]
    public ActionResult<ArmPose> GetPosition()
    {
        return Ok(_latestPose);
    }
}

public class ArmPose
{
    public double j0  { get; set; }
    public double j1  { get; set; }
    public double j2  { get; set; }
    public double j3  { get; set; }
    public double j4  { get; set; }
    public double j5  { get; set; }
    public double j6  { get; set; }
    public double j0x { get; set; }
    public double j0y { get; set; }
    public double j0z { get; set; }
}
```

> **注意**：C# 默认序列化属性名为 PascalCase（首字母大写），但前端期望 camelCase。需在 `Program.cs` 中配置：
> ```csharp
> builder.Services.AddControllers()
>     .AddJsonOptions(opts =>
>         opts.JsonSerializerOptions.PropertyNamingPolicy =
>             System.Text.Json.JsonNamingPolicy.CamelCase);
> ```

***

## 6. 搭建指引

### 前端开发者

```bash
# 1. 下载整个 Project code 目录
# 2. 安装依赖（首次）
cd "Project code 所在目录"
npm install

# 3. 启动开发服务器
npm run dev

# 4. 浏览器打开 http://localhost:5173
```

### 生产打包

```bash
npm run build
```

产物在 `dist/` 目录。部署方式取决于通信模式：
- **方式 A (WebView2)**：将 `dist/` 内所有文件拷贝到桌面程序资源路径，WebView2 加载 `dist/index.html`
- **方式 B (REST 轮询)**：将 `dist/` 内所有文件拷贝到后端 `wwwroot/` 目录，浏览器访问后端地址即可

详见 [README.md](README.md)。

***

## 7. 变更记录

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| 1.3 | 2026-07-29 | 方式 B 由 SignalR WebSocket 改为 REST API 轮询（GET /Robot/position）；新增 REST API 响应格式说明和轮询策略描述；新增 C# Controller 实现示例；新增"后端程序员部署操作"章节 |
| 1.2 | 2026-05-22 | 新增 SignalR WebSocket 接入方式（方式 B）；两种方式可并存 |
| 1.1 | 2026-05-22 | 移除孔洞消息类型（holes / addHoles），精简为纯姿态通信 |
| 1.0 | 2026-05-22 | 初版：定义 pose / holes / addHoles 三种消息类型；嵌入方案说明；C# 调用示例 |

***

## 8. 后端程序员部署操作

### 你需要做的事情

#### 1. 确认 API 端点就绪

确保你的后端已实现并正常响应 `GET /Robot/position`：

```
GET http://localhost:5000/Robot/position
```

返回 JSON 格式参考本文档 [1. 嵌入方案 → 方式 B → REST API 响应格式](#方式-brest-api-轮询后端-api) 中的定义。

可在浏览器直接访问上述地址验证。

#### 2. 部署前端资源

前端已配置为从 `/Robot/position` 相对路径轮询，**无需修改任何代码**。

```powershell
# 在前端项目目录执行
cd "Project code 所在目录"
npm run build
```

将 `dist/` 目录下的**所有文件**（index.html、assets 文件夹等）复制到：

```
D:\InnerSightMaster\webapi\wwwroot\
```

#### 3. 验证部署

1. 启动后端服务
2. 浏览器访问 `http://localhost:5000/`
3. 确认页面正常加载，打开浏览器控制台（F12），应看到：
   ```
   [Polling] 启动，轮询间隔 100ms，地址: /Robot/position
   ```
4. 确认无跨域错误（CORS）。如果后端和前端部署在同源（同一端口），无跨域问题。

#### 4. 字段命名对齐（重要）

- 前端默认期望 **camelCase** 字段名（`j0`, `j1`, `j0x` 等）
- 如果你的后端返回 **PascalCase**（`J0`, `J1`, `J0x`），请在 `Program.cs` 中配置 JSON 序列化为 camelCase（见 [5. C# 调用示例 → 方式 B](#方式-brest-api--轮询端点实现) 中的说明），或通知前端团队修改字段映射

#### 5. 可选：PLC 上位机推送接口

后端还需暴露 `POST /Robot/position`（或类似接口），供 PLC 上位机将实时关节坐标写入后端内存，再由 `GET /Robot/position` 返回给前端。

完整数据流：
```
PLC → POST /Robot/position → 后端存储 → GET /Robot/position → 前端轮询
```

