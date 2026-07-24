# 前端与后端数据接口约定

> 版本: 1.0 · 日期: 2026-05-22 · 作者: 前端团队  
> 本文档定义前端三维模型展示模块与桌面端程序（C# 上位机）之间的通信协议。  
> **如有争议，以本文档为准。**

---

## 目录

- [1. 嵌入方案](#1-嵌入方案)
- [2. 通信协议](#2-通信协议)
- [3. 消息类型](#3-消息类型)
  - [3.1 姿态消息 `pose`](#31-姿态消息-pose)
  - [3.2 孔洞数据消息 `holes`](#32-孔洞数据消息-holes)
  - [3.3 孔洞坐标消息 `addHoles`](#33-孔洞坐标消息-addholes)
- [4. 字段参考](#4-字段参考)
- [5. C# 调用示例](#5-c-调用示例)
- [6. 搭建指引](#6-搭建指引)
- [7. 变更记录](#7-变更记录)

---

## 1. 嵌入方案

桌面端通过 **Microsoft Edge WebView2** 控件加载前端页面。

### 开发环境

前端开发服务器启动在本机 **5173** 端口，WebView2 加载：

```csharp
webView.Source = new Uri("http://localhost:5173");
```

### 生产环境

前端执行 `npm run build` 后产物在 `dist/` 目录，将整个目录拷贝到桌面端程序的资源路径下，WebView2 加载：

```csharp
string path = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wwwroot", "dist", "index.html");
webView.Source = new Uri($"file:///{path.Replace("\\", "/")}");
```

> **前置条件**：桌面端需要安装 [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/)。

---

## 2. 通信协议

### 方向

```
桌面端 (C#)  ──JSON──→  前端 (JS)
```

桌面端**主动推送**数据到前端，前端被动接收并渲染。通信方向为**单向**（C# → JS）。

### 传输方式

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

### 通用格式

所有消息均为单行 JSON 对象，**必须**包含 `type` 字段：

```jsonc
{
  "type": "消息类型标识符",
  // ... 消息特定字段
}
```

---

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

| 字段 | 类型 | 必须 | 单位 | 说明 |
|------|------|------|------|------|
| `type` | string | ✅ | — | 固定值 `"pose"` |
| `j0` | number | ✅ | 弧度 | 底座骨骼 (CS620-Base) 旋转 |
| `j1` | number | ✅ | 弧度 | J1 关节旋转 |
| `j2` | number | ✅ | 弧度 | J2 关节旋转 |
| `j3` | number | ✅ | 弧度 | J3 关节旋转 |
| `j4` | number | ✅ | 弧度 | J4 关节旋转 |
| `j5` | number | ✅ | 弧度 | J5 关节旋转 |
| `j6` | number | ✅ | 弧度 | J6 关节旋转（末端执行器） |
| `j0x` | number | ❌ | 模型坐标 | 底座 X 位移 |
| `j0y` | number | ❌ | 模型坐标 | 底座 Y 位移 |
| `j0z` | number | ❌ | 模型坐标 | 底座 Z 位移 |

> ⚠️ **注意：** 关节角度单位为**弧度**，非角度。频率不足会导致模型运动卡顿，建议 20~50 Hz。

---

### 3.2 孔洞数据消息 `holes`

**用途：** 推送视觉算法检测完成的孔洞状态。

**JSON Schema：**

```json
{
  "type": "holes",
  "data": [
    {
      "id":      "hole_001",
      "status":  "ok",
      "value":   "0.123",
      "time":    "2026-04-08 10:30:15",
      "imageId": "IMG_20260408_001"
    },
    {
      "id":      "hole_002",
      "status":  "ng",
      "value":   "2.456",
      "time":    "2026-04-08 10:31:00",
      "imageId": "IMG_20260408_002"
    }
  ]
}
```

| 字段 | 类型 | 必须 | 说明 |
|------|------|------|------|
| `type` | string | ✅ | 固定值 `"holes"` |
| `data` | array | ✅ | 孔洞状态列表 |
| `data[].id` | string | ✅ | 孔洞唯一标识符 |
| `data[].status` | string | ✅ | 检测结果（见状态表） |
| `data[].value` | string | ❌ | 检测数值（如孔径、深度） |
| `data[].time` | string | ❌ | 检测时间 |
| `data[].imageId` | string | ❌ | 关联的内窥镜图像编号 |

**状态值说明：**

| status | 渲染颜色 | 含义 |
|--------|---------|------|
| `ok` | 🟢 `#1D9E75` | 合格 |
| `ng` | 🔴 `#D85A30` | 异常 |
| `active` | 🟡 `#EF9F27` | 正在检测 |
| `pending` | ⚪ `#888780` | 未检测（默认值） |

> **注意：** `holes` 消息仅更新已有孔洞的状态和颜色。孔洞的三维坐标需要通过 `addHoles` 消息预先注册。

---

### 3.3 孔洞坐标消息 `addHoles`

**用途：** 视觉算法完成标定后，一次性注册所有孔洞在世界坐标系中的三维位置。

**JSON Schema：**

```json
{
  "type": "addHoles",
  "data": [
    { "id": "hole_001", "x": 0.10, "y": 0.50, "z": 0.20 },
    { "id": "hole_002", "x": 0.20, "y": 0.52, "z": 0.19 },
    { "id": "hole_003", "x": 0.30, "y": 0.48, "z": 0.21 }
  ]
}
```

| 字段 | 类型 | 必须 | 单位 | 说明 |
|------|------|------|------|------|
| `type` | string | ✅ | — | 固定值 `"addHoles"` |
| `data` | array | ✅ | — | 孔洞坐标列表 |
| `data[].id` | string | ✅ | — | 孔洞唯一标识符 |
| `data[].x` | number | ✅ | 模型坐标 | X 轴位置 |
| `data[].y` | number | ✅ | 模型坐标 | Y 轴位置 |
| `data[].z` | number | ✅ | 模型坐标 | Z 轴位置 |

> **调用顺序：** 先调用 `addHoles` 注册孔洞位置，后续通过 `holes` 消息更新各孔洞的检测状态。

---

## 4. 字段参考

### 坐标系单位

| 类别 | 单位 | 说明 |
|------|------|------|
| 关节旋转 | 弧度 (rad) | 1 rad ≈ 57.3°。桌面端如果使用角度，发送前需用 `角度 × π ÷ 180` 转换 |
| 位移 / 坐标 | 模型坐标系单位 (m) | 与 Blender glTF 导出单位一致 |

### 错误处理

前端接收到消息后，如果 JSON 解析失败，会在浏览器控制台打印：

```
[Bridge] 消息解析失败: <错误详情>
```

桌面端应将此异常的捕获列入调试用例：如果反复出现此日志，说明发送的 JSON 格式有误。

---

## 5. C# 调用示例

```csharp
using System.Text.Json;

public static class FrontendBridge
{
    /// <summary>
    /// 推送机械臂关节姿态（频率 ≥10 Hz）
    /// </summary>
    public static void SendPose(WebView2 webView, double j0, double j1, double j2,
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

    /// <summary>
    /// 推送孔洞检测状态
    /// </summary>
    public static void SendHoleStatus(WebView2 webView, List<HoleResult> results)
    {
        var payload = new { type = "holes", data = results };
        webView.CoreWebView2.PostWebMessageAsString(
            JsonSerializer.Serialize(payload));
    }

    /// <summary>
    /// 注册孔洞三维坐标
    /// </summary>
    public static void SendHolePositions(WebView2 webView, List<HolePosition> positions)
    {
        var payload = new { type = "addHoles", data = positions };
        webView.CoreWebView2.PostWebMessageAsString(
            JsonSerializer.Serialize(payload));
    }
}

public record HoleResult(string Id, string Status,
    string? Value, string? Time, string? ImageId);

public record HolePosition(string Id, double X, double Y, double Z);
```

---

## 6. 搭建指引

### 桌面端开发者

```bash
# 1. 克隆/下载整个 Project code 目录
# 2. 安装依赖（首次）
cd "Project code 所在目录"
npm install

# 3. 启动开发服务器
npm run dev

# 4. WebView2 加载 http://localhost:5173
```

### 后端 API 路径（可选）

如不使用 WebView2 桥接，也可通过 .NET 8 后端 API + SignalR 通信：

```bash
cd "Back-end Test"
dotnet run
```

详见 [Back-end Test/README.md](Back-end%20Test/README.md)。

---

## 7. 变更记录

| 版本 | 日期 | 变更内容 |
|------|------|---------|
| 1.0 | 2026-05-22 | 初版：定义 pose / holes / addHoles 三种消息类型；嵌入方案说明；C# 调用示例 |
