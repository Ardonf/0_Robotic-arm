# 采集系统后端服务

## 目录结构

```
Back-end Test/
├── README.md
├── BackendTest.csproj          ← .NET 8 Web API 项目文件
├── Program.cs                  ← 启动入口 + SignalR Hub 注册
├── appsettings.json            ← 配置文件（端口、日志等）
├── Hubs/
│   └── ArmHub.cs               ← SignalR Hub — 实时广播数据
├── Controllers/
│   ├── PoseController.cs       ← 接收机械臂关节坐标
│   └── HoleController.cs       ← 接收孔洞数据
├── Models/
│   ├── ArmPose.cs              ← 关节坐标数据模型
│   └── HoleData.cs             ← 孔洞数据模型
└── Services/
    └── DataForwardService.cs   ← 数据转发服务（扩展预留）
```

---

## 架构概述

```
┌──────────────┐     HTTP POST      ┌─────────────────┐     SignalR WebSocket     ┌────────────┐
│ Python 视觉   │ ────────────────→ │  .NET 8 Web API  │ ────────────────────────→ │ Vue3 前端   │
│ PLC / 上位机  │    关节坐标/孔洞   │  (本后端服务)    │      实时广播              │ Three.js   │
└──────────────┘                    └─────────────────┘                            └────────────┘
```

### 数据流

1. **第三方系统**（Python 视觉算法 / PLC 上位机）通过 **HTTP POST** 发送数据
2. **Controller** 接收并验证数据
3. **ArmHub** 通过 SignalR WebSocket **实时广播**给所有已连接的前端
4. **Vue3 前端**收到数据后驱动三维模型同步运动

---

## 快速开始

### 前置条件

- 安装 [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)

### 启动服务

```bash
cd "Back-end Test"
dotnet restore
dotnet run
```

启动后控制台输出：
```
╔══════════════════════════════════════════════════════════════╗
║           采集系统后端服务 已启动                            ║
║           API 地址: http://localhost:5000                    ║
║           Hub 端点: http://localhost:5000/hub/arm            ║
║  可用接口:                                                  ║
║    POST http://localhost:5000/api/pose   ← 机械臂关节坐标   ║
║    POST http://localhost:5000/api/hole   ← 孔洞数据         ║
╚══════════════════════════════════════════════════════════════╝
```

---

## API 接口

### 1. 推送关节坐标

```http
POST http://localhost:5000/api/pose
Content-Type: application/json

{
    "j1": 0.1,
    "j2": 0.3,
    "j3": 0.0,
    "j4": 0.0,
    "j5": 0.5,
    "j6": 1.2
}
```

推送频率建议：**≥ 10 Hz**（合同要求）

### 2. 推送孔洞数据（含检测状态）

```http
POST http://localhost:5000/api/hole
Content-Type: application/json

{
    "type": "holes",
    "data": [
        {
            "id":      "hole_001",
            "x":       0.1,
            "y":       0.5,
            "z":       0.2,
            "status":  "ok",
            "value":   "0.123",
            "time":    "2026-04-08 10:30",
            "imageId": "IMG_001"
        }
    ]
}
```

### 3. 推送孔洞坐标（纯坐标，无状态）

```http
POST http://localhost:5000/api/hole/positions
Content-Type: application/json

[
    { "id":"hole_001","x":0.1,"y":0.5,"z":0.2 },
    { "id":"hole_002","x":0.2,"y":0.5,"z":0.2 }
]
```

---

## 前端接入

### SignalR 连接（前端需要添加 `@microsoft/signalr` 包）

```js
import * as signalR from '@microsoft/signalr'

const connection = new signalR.HubConnectionBuilder()
  .withUrl('http://localhost:5000/hub/arm')
  .withAutomaticReconnect()
  .build()

// 监听关节坐标更新
connection.on('ArmPoseUpdate', (pose) => {
  viewer.onArmPoseReceived(pose)
})

// 监听孔洞数据更新
connection.on('HoleDataUpdate', (holes) => {
  viewer.onHoleDataReceived(holes)
})

// 监听孔洞坐标更新（addHoles 场景）
connection.on('HolePositions', (holes) => {
  viewer.addHoles(holes)
})

connection.start()
```

---

## 端口配置

端口在 [appsettings.json](appsettings.json) 中配置：

```json
"Urls": "http://localhost:5000"
```

修改此值即可更换端口。同时需要修改前端 SignalR 连接地址和第三方 POST 地址。

---

## ⚠️ 如果更改了文件夹名称

如果你将 `Back-end Test` 文件夹重命名为其他名字（如 `MyBackend`），你需要修改以下内容：

| 序号 | 文件 | 修改内容 |
|------|------|---------|
| 1 | **BackendTest.csproj** | 文件名可保持不变，也可改为新名.csproj |
| 2 | **Program.cs** 第 1 行 | `using BackendTest.Hubs` → `using MyBackend.Hubs` |
| 3 | **Hubs/ArmHub.cs** 第 4 行 | `namespace BackendTest.Hubs` → `namespace MyBackend.Hubs` |
| 4 | **Hubs/ArmHub.cs** 第 2 行 | `using BackendTest.Models` → `using MyBackend.Models` |
| 5 | **Controllers/PoseController.cs** 第 5 行 | `namespace BackendTest.Controllers` → `namespace MyBackend.Controllers` |
| 6 | **Controllers/PoseController.cs** 第 3-4 行 | `using BackendTest.*` → `using MyBackend.*` |
| 7 | **Controllers/HoleController.cs** 第 5 行 | `namespace BackendTest.Controllers` → `namespace MyBackend.Controllers` |
| 8 | **Controllers/HoleController.cs** 第 3-4 行 | `using BackendTest.*` → `using MyBackend.*` |
| 9 | **Models/ArmPose.cs** 第 1 行 | `namespace BackendTest.Models` → `namespace MyBackend.Models` |
| 10 | **Models/HoleData.cs** 第 1 行 | `namespace BackendTest.Models` → `namespace MyBackend.Models` |
| 11 | **Services/DataForwardService.cs** 第 4 行 | `namespace BackendTest.Services` → `namespace MyBackend.Services` |

> **提示**：可以在 VS Code 中全局搜索 `BackendTest` 并替换为新名称，一步完成。

---

## 其他电脑运行

```bash
cd "Back-end Test 所在目录"
dotnet restore     # 只需要跑一次
dotnet run
```
