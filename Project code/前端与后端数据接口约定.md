# 前端与后端数据接口约定

> 本文档供 **后端开发人员** 阅读，说明前端 Three.js 三维可视化程序需要什么样的数据、按什么格式发送，以及如何与调试面板协作。

---

## 目录

1. [整体架构](#1-整体架构)
2. [通信方式：两种方案](#2-通信方式两种方案)
3. [机械臂关节角度数据](#3-机械臂关节角度数据)
4. [孔洞数据](#4-孔洞数据)
5. [状态颜色约定](#5-状态颜色约定)
6. [坐标系约定](#6-坐标系约定)
7. [调试面板说明](#7-调试面板说明)
8. [常见问题排查](#8-常见问题排查)
9. [无后端时的测试方式](#9-无后端时的测试方式)

---

## 1. 整体架构

```
第三方系统               后端 (你的代码)               前端 (Three.js)
(Python/PLC)                                   ┌─────────────────────┐
     │                                         │  App.vue            │
     │  HTTP POST 或 其他协议                    │  └─ onCSharpMessage │
     ├────────────────→  后端服务器              │       │             │
     │                    ├─ 接收数据            │       ├─ "pose"     │
     │                    ├─ 格式转换            │       │   → 骨骼动画 │
     │                    └─ 推送给前端          │       ├─ "holes"    │
     │                                         │       │   → 颜色更新  │
     │                    ┌─ C# WebView2 ──────┤       └─ "addHoles"  │
     │                    │ PostWebMessageAsString │         → 渲染新增  │
     │                    └─────────────────────┘                     │
     │                                         └─────────────────────┘
```

### 前端接收数据的两种方式

| 方式 | 适用场景 | 说明 |
|------|---------|------|
| **WebView2 Bridge** | 桌面客户端（WPF / WinForms 嵌入 WebView2） | C# 宿主调用 `PostWebMessageAsString()` 发送 JSON 字符串 |
| **SignalR WebSocket** | 浏览器端 / 独立前端 | 前端直接连接后端 SignalR Hub |

两种方式最终都汇聚到前端的同一个入口函数，因此 **后端开发不需要关心前端用哪种方式接收**，只需确保送出的数据格式正确。

---

## 2. 通信方式：两种方案

### 方案 A：通过 C# WebView2 Bridge（桌面客户端）

```
后端服务器                  C# 宿主程序                   前端
收到数据                                   (WebView2 内)
    │                          │
    │ SignalR / HTTP           │ PostWebMessageAsString(json)
    ├────────────────→  C# 端 ───────────────────────────→  window.onCSharpMessage
                         订阅 SignalR Hub
                         接收数据后转发
```

C# 宿主应建立 SignalR 连接，监听以下事件，然后逐条转发给 WebView2。

### 方案 B：前端直连 SignalR Hub（浏览器端）

前端可以直接用 `@microsoft/signalr` 包连接后端 Hub：

```javascript
import * as signalR from '@microsoft/signalr'

const connection = new signalR.HubConnectionBuilder()
  .withUrl('http://localhost:5000/hub/arm')  // 后端地址
  .withAutomaticReconnect()
  .build()

connection.on('ArmPoseUpdate', (pose) => {
  viewer.onArmPoseReceived(pose)
})

connection.on('HoleDataUpdate', (holes) => {
  viewer.onHoleDataReceived(holes)
})

connection.on('HolePositions', (holes) => {
  viewer.addHoles(holes)
})

connection.start()
```

---

## 3. 机械臂关节角度数据

### 3.1 数据格式

```json
{
  "type": "pose",
  "j0": 0.0,
  "j1": 0.1,
  "j2": 0.3,
  "j3": 0.0,
  "j4": 0.0,
  "j5": 0.5,
  "j6": 1.2,
  "j0x": 0.0,
  "j0y": 0.0,
  "j0z": 0.0
}
```

### 3.2 字段说明

| 字段 | 类型 | 必需 | 单位 | 说明 |
|------|------|------|------|------|
| `type` | string | **是** | — | 固定值 `"pose"` |
| `j0` | number | **是** | 弧度 | 底座旋转角度 |
| `j1` | number | **是** | 弧度 | 关节 1 |
| `j2` | number | **是** | 弧度 | 关节 2（大臂） |
| `j3` | number | **是** | 弧度 | 关节 3（小臂） |
| `j4` | number | **是** | 弧度 | 关节 4（腕部旋转） |
| `j5` | number | **是** | 弧度 | 关节 5（腕部弯曲） |
| `j6` | number | **是** | 弧度 | 关节 6（末端执行器） |
| `j0x` | number | 否 | 米 | 底座 X 位移 |
| `j0y` | number | 否 | 米 | 底座 Y 位移 |
| `j0z` | number | 否 | 米 | 底座 Z 位移 |

> **单位速记**：所有 j0~j6 → 弧度，所有 j0x/j0y/j0z → 米。

### 3.3 重要规定

- **单位必须是弧度**，不是角度（度）。如果后端或 PLC 传的是角度，前端不会自动转换
- **推送频率建议 ≥ 10 Hz**。太低会导致动画卡顿
- **所有关节值每次都要全量发送**，即使某个关节值没有变化
- 骨骼的正/反向由前端 `BONE_AXIS` 配置控制（由 3D 艺术家在 Blender 中调好），后端不需要关心

### 3.4 前端的处理方式

```
收到 type:"pose" → onArmPoseReceived(pose)
                    ├─ updatePose(pose)           → 驱动 Three.js 骨骼动画
                    └─ Object.assign(jointForm, pose) → 同步调试面板显示
```

---

## 4. 孔洞数据

前端用 InstancedMesh 批量渲染数百个孔洞，每个孔洞通过状态显示不同颜色，同时在右上角统计各状态数量。

### 4.1 消息类型 A：初始添加孔洞（含三维坐标）

第一次加载时，或需要**重置所有孔洞**时使用。这个操作会**清除之前的所有孔洞再重建**。

```json
{
  "type": "addHoles",
  "data": [
    { "id": "hole_001", "x": 0.12, "y": 0.45, "z": -0.03, "status": "pending" },
    { "id": "hole_002", "x": 0.15, "y": 0.50, "z": -0.01, "status": "pending" },
    { "id": "hole_003", "x": 0.09, "y": 0.48, "z": -0.05, "status": "pending" }
  ]
}
```

**`data[]` 每个元素字段**：

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `id` | string | **是** | 孔洞唯一标识 |
| `x` | number | **是** | 世界坐标系 X（米） |
| `y` | number | **是** | 世界坐标系 Y（米） |
| `z` | number | **是** | 世界坐标系 Z（米） |
| `status` | string | 否 | 默认 `"pending"`。可选值见[第 5 节](#5-状态颜色约定) |

### 4.2 消息类型 B：批量更新孔洞检测状态

视觉算法每检测完一个孔洞，就会更新其状态。可一次性批量发送。

```json
{
  "type": "holes",
  "data": [
    { "id": "hole_001", "status": "ok", "value": 0.05, "time": "2026-05-23 10:00:00", "imageId": "img_001" },
    { "id": "hole_002", "status": "ng", "value": 0.15, "time": "2026-05-23 10:00:01", "imageId": "img_002" }
  ]
}
```

**`data[]` 每个元素字段**：

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `id` | string | **是** | 孔洞唯一标识，必须与 `addHoles` 中的 ID 一致 |
| `status` | string | **是** | 新状态。可选值见[第 5 节](#5-状态颜色约定) |
| `value` | string | 否 | 检测数值（如孔径、深度），显示在详情弹窗 |
| `time` | string | 否 | 检测时间，显示在详情弹窗 |
| `imageId` | string | 否 | 关联图像编号，显示在详情弹窗 |

> 注意：`holes` 类型**只更新状态，不改变位置**。位置必须在之前通过 `addHoles` 传入。

### 4.3 前端的处理方式

```
收到 type:"addHoles"
  → viewer.value.addHoles(msg.data)
    → tubeManager.addHoles(holes)
      → 清除旧渲染器 → 重建 InstancedMesh → 更新右上角统计

收到 type:"holes"
  → viewer.value.onHoleDataReceived(msg.data)
    → 遍历调用 tubeManager.setHoleStatus(id, status, meta)
      → 更新颜色 → 更新右上角统计
```

---

## 5. 状态颜色约定

| 状态值 | 颜色 | 色值 | 含义 | 统计面板显示 |
|--------|------|------|------|-----------|
| `"ok"` | 绿色 | `#1D9E75` | 合格（已检测） | 正常 |
| `"ng"` | 红色 | `#D85A30` | 异常（已检测） | 异常 |
| `"active"` | 黄色 | `#EF9F27` | 检测中 | 检测中 |
| `"pending"` | 灰色 | `#888780` | 未检测（默认） | 未检测 |

---

## 6. 坐标系约定

### 6.1 三维场景

- 使用 **右手坐标系**（Y 轴向上）
- 所有位置单位为 **米**
- 孔洞的 `x, y, z` 为世界坐标系中的绝对位置

### 6.2 关节角度

- 所有角度单位均为 **弧度**（rad）
- 角度正负遵循**右手螺旋定则**
- 如果关节转向与实际相反，由 3D 艺术家在前端的 `BONE_AXIS` 配置中调整 `sign: 1` 或 `sign: -1`，**后端不需要处理**

### 6.3 骨骼配置（仅 3D 艺术家关注）

骨骼名称与关节的对应关系在 [useArmController.js](file:///g:/0_Robotic%20arm/Project%20code/composables/useArmController.js#L19-L26) 中配置，由 3D 艺术家根据 Blender 模型中的骨骼命名设置：

```javascript
const BONE_NAMES = {
  j0: 'CS620-Base',             // 底座
  j1: 'CS620-J1',               // 关节 1
  j2: 'CS620-J2_Link1_J3',      // 关节 2（大臂）
  j3: 'CS620-Link2A_Link2B_J4', // 关节 3（小臂）
  j4: 'CS620-J5',               // 关节 4
  j5: 'CS620-J6',               // 关节 5
  j6: 'CS620-Flange',           // 关节 6（末端）
}
```

后端传的 `j0` ~ `j6` 数据会按索引对应到这些骨骼。**后端只需要传正确的 j0~j6 值，不需要知道骨骼名称。**

---

## 7. 调试面板说明

前端内置了调试面板（[DebugPanel.vue](file:///g:/0_Robotic%20arm/Project%20code/src/components/DebugPanel.vue)），供开发调试使用。

### 7.1 手动控制模式

当后端未连接时，可以通过调试面板手动输入关节角度驱动机械臂动画。输入后点击"应用"即可。

### 7.2 实时数据回显

当后端通过 SignalR 推送数据时，调试面板的关节输入框会自动回显后端发送的值。**调试面板与后端数据始终同步。**

### 7.3 调试孔洞

调试面板可在 J6 末端位置手动添加孔洞圆柱体，用于验证孔洞位置是否准确。调试孔洞会进入统一的统计系统，与真实孔洞一样在右上角显示统计数字。

### 7.4 对后端开发的价值

调试面板让后端开发者在**完全没有前端代码修改**的情况下就能验证：
- 后端推送的数据是否被前端正确接收
- 关节角度数据是否合理
- 孔洞位置和状态是否正确渲染

---

## 8. 常见问题排查

### 问题 1：机械臂不动

| 排查步骤 | 说明 |
|---------|------|
| 检查消息 `type` 是否为 `"pose"` | 其他字段会被忽略 |
| 检查角度单位是否为弧度 | 如果是角度，数值会非常大或非常小 |
| 检查骨骼名称是否匹配 | 3D 艺术家需要确认 Blender 骨骼名与 `BONE_NAMES` 一致 |
| 在调试面板查看关节值是否回显 | 如果回显了，说明前端接收成功；不回显说明消息格式有问题 |

### 问题 2：孔洞不显示

| 排查步骤 | 说明 |
|---------|------|
| 检查消息 `type` 是否为 `"addHoles"` | |
| 检查 `id` 是否唯一 | 重复 ID 会覆盖前一个 |
| 检查坐标是否在场景可视范围内 | 坐标超出相机视野范围 |
| 检查统计面板数字是否有变化 | 如果统计数字增加但不显示，说明坐标位置不对 |

### 问题 3：孔洞颜色不对

| 排查步骤 | 说明 |
|---------|------|
| 检查 `status` 值是否拼写正确 | 必须是 `"ok"` / `"ng"` / `"active"` / `"pending"` |
| 大小写敏感 | 必须小写 |

### 问题 4：WebView2 Bridge 连接失败

| 排查步骤 | 说明 |
|---------|------|
| 检查 `window.onCSharpMessage` 是否被调用 | 可在浏览器 DevTools Console 中查看 |
| 检查 JSON 是否合法 | 可使用 `JSON.parse()` 测试 |
| 检查 C# 端是否调用了 `PostWebMessageAsString` | |

---

## 9. 无后端时的测试方式

在新后端开发完成前，可以用以下方式测试前端：

### 9.1 使用浏览器 DevTools 手动模拟

打开前端页面（`http://localhost:5173/`），在浏览器控制台执行：

```javascript
// 驱动机械臂运动
window.onCSharpMessage(JSON.stringify({
  type: "pose",
  j0: 0, j1: 0.5, j2: -0.3, j3: 0.2, j4: 0, j5: 0, j6: 0
}))

// 添加孔洞
window.onCSharpMessage(JSON.stringify({
  type: "addHoles",
  data: [
    { id: "test_001", x: 0.1, y: 0.5, z: 0.2, status: "pending" },
    { id: "test_002", x: 0.2, y: 0.5, z: 0.2, status: "ok" },
    { id: "test_003", x: 0.3, y: 0.5, z: 0.2, status: "ng" }
  ]
}))

// 更新孔洞状态
window.onCSharpMessage(JSON.stringify({
  type: "holes",
  data: [
    { id: "test_001", status: "active" },
    { id: "test_002", status: "ok" }
  ]
}))
```

### 9.2 使用前端调试面板

前端内置的调试面板提供完整的手动控制功能：
- **关节控制**：手动输入每个关节的角度，驱动骨骼动画
- **J6 笛卡尔坐标**：实时显示末端执行器的世界坐标和欧拉角
- **孔洞调试**：在末端位置手动添加测试孔洞，自定义尺寸/颜色

调试面板的数据流与后端推送的数据流**完全一致**，均经过同一套处理逻辑。

### 9.3 使用 Postman / curl 模拟后端

启动后端项目后，可以用以下命令测试：

```bash
# 推送关节角度
curl -X POST http://localhost:5000/api/pose \
  -H "Content-Type: application/json" \
  -d '{"j1":0.1,"j2":0.3,"j3":0.0,"j4":0.0,"j5":0.5,"j6":1.2}'

# 推送孔洞数据
curl -X POST http://localhost:5000/api/hole \
  -H "Content-Type: application/json" \
  -d '{"type":"holes","data":[{"id":"hole_001","status":"ok","value":"0.123"}]}'
```

---

## 附录：前端关键文件说明

| 文件 | 作用 |
|------|------|
| [App.vue](file:///g:/0_Robotic%20arm/Project%20code/src/App.vue) | 消息总入口：`window.onCSharpMessage` |
| [RobotViewer.vue](file:///g:/0_Robotic%20arm/Project%20code/src/components/RobotViewer.vue) | 主视图组件，暴露 `onArmPoseReceived` / `onHoleDataReceived` / `addHoles` |
| [useArmController.js](file:///g:/0_Robotic%20arm/Project%20code/composables/useArmController.js) | 机械臂骨骼驱动逻辑，配置骨骼名称与旋转轴 |
| [useTubeManager.js](file:///g:/0_Robotic%20arm/Project%20code/composables/useTubeManager.js) | 孔洞渲染与统计管理 |
| [DebugPanel.vue](file:///g:/0_Robotic%20arm/Project%20code/src/components/DebugPanel.vue) | 调试面板 UI |

---

> **给后端开发的一句话总结**：
> 前端只认三种消息（`pose` / `holes` / `addHoles`），格式固定为 JSON，单位用弧度/米。
> 只要按本文档约定的格式发送数据，前端就能正确驱动机械臂动画和孔洞渲染。
> 调试面板可以作为后端数据是否正确送达的实时指示器。
