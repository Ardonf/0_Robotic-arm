# 三维模型展示模块

## 目录结构

```
Project code/
├── index.html
├── package.json
├── vite.config.js              ← Vite 构建配置
├── vitest.config.js            ← 单元测试配置
├── public/
│   └── models/
│       └── robot_arm.glb       ← 把你的 glTF 文件放这里
├── src/
│   ├── main.js                 ← Vue 入口
│   ├── App.vue                 ← 根组件（WebView2 桥接入口）
│   └── components/
│       ├── RobotViewer.vue     ← 主视图组件
│       └── DebugPanel.vue      ← 调试面板组件（上线可隐藏）
├── composables/
│   ├── useSceneManager.js      ← Three.js 场景初始化
│   ├── useArmController.js     ← 机械臂骨骼驱动 ⚠️ 需改骨骼名
│   ├── useRobotPolling.js      ← REST 轮询后端 API
│   └── useDebugManager.js      ← 调试面板状态与逻辑
├── tests/
│   ├── useArmController.test.js
│   └── __mocks__/              ← THREE.js 轻量 mock
├── Back-end Test/              ← .NET 8 后端服务（详见其内部 README.md）
└── dist/                       ← 生产构建产物
```

---

## 快速开始

```bash
cd "Project code 所在目录"
npm install
npm run dev
```

浏览器打开 http://localhost:5173

```
可用脚本：
  npm run dev         启动 Vite 开发服务器
  npm run build       生产构建 → dist/
  npm run preview     预览生产构建
  npm test            运行单元测试
  npm run test:watch  持续监听并重跑测试
```

---

## 骨骼驱动说明

打开 [composables/useArmController.js](composables/useArmController.js)，找到 `BONE_NAMES` 对象：

```js
const BONE_NAMES = {
  j0: 'CS620-Base',            // 底座根骨骼Root（旋转 + XYZ 位移）
  j1: 'CS620-J1',              // CS620-J1
  j2: 'CS620-J2_Link1_J3',     // CS620-J2_Link1_J3
  j3: 'CS620-Link2A_Link2B_J4',// CS620-Link2A_Link2B_J4
  j4: 'CS620-J5',              // CS620-J5
  j5: 'CS620-J6',              // CS620-J6
  j6: 'CS620-Flange',          // CS620-Flange
}
```

**查看骨骼名称的方法：**
1. 打开 Blender，选中机械臂的 Armature 对象
2. 进入 Pose Mode（Ctrl+Tab）
3. 点击某根骨骼
4. 右侧 Properties 面板 → Bone 选项卡 → 最上方的名称框即为骨骼名

**如果关节转向反了：** 修改 `BONE_AXIS` 中对应的 `sign: 1` 为 `sign: -1`

**如果底座位移方向反了：** 修改 `BASE_POS_AXIS` 中对应轴的 `sign: 1` 为 `sign: -1`

### 骨骼配置说明

| 关节 | 骨骼名 | 旋转轴 | 额外控制 |
|------|--------|--------|---------|
| j0 | CS620-Base | Y 轴 | XYZ 位移（j0x / j0y / j0z） |
| j1 | CS620-J1 | Y 轴 | — |
| j2 | CS620-J2_Link1_J3 | Y 轴 | — |
| j3 | CS620-Link2A_Link2B_J4 | Y 轴 | — |
| j4 | CS620-J5 | Y 轴 | — |
| j5 | CS620-J6 | Y 轴 | — |
| j6 | CS620-Flange | Y 轴 | 实时计算末端笛卡尔坐标 |

---

## 机械臂关节对接

前端支持两种通信方式，**可同时启用，互不冲突**。

### 方式 A：WebView2 桥接（嵌入式）

C# 端通过 `PostWebMessageAsString` 发送 JSON：

```csharp
webView.CoreWebView2.PostWebMessageAsString(
  JsonSerializer.Serialize(new {
    type = "pose",
    j0 = 0.0, j1 = 0.1, j2 = 0.3, j3 = 0.0,
    j4 = 0.0, j5 = 0.0, j6 = 0.0,
    j0x = 0.0, j0y = 0.0, j0z = 0.0
  })
);
```

前端接收入口在 [App.vue](src/App.vue) 的 `window.onCSharpMessage` 中配置。

### 方式 B：REST 轮询（后端 API）

数据流：`PLC → C# 后端 → GET /Robot/position → 前端`

前端部署到后端 `wwwroot` 后，使用相对路径 `/Robot/position` 自动指向同源后端，**无需任何配置**。

默认 100ms 间隔轮询（10Hz），满足合同要求的推送频率。

> 如果后端未就绪，轮询会静默等待，不影响 WebView2 桥接模式的正常使用。

API 地址可在 [useRobotPolling.js](src/composables/useRobotPolling.js) 中修改。

### 数据格式

两种方式使用相同的数据格式：

```js
{
  j0:  0.0,   // 单位：弧度
  j1:  0.1,
  j2:  0.3,
  j3: -0.2,
  j4:  0.0,
  j5:  0.5,
  j6:  1.2,
  j0x: 0.0,   // 底座 XYZ 位移（可选，模型坐标系单位）
  j0y: 0.0,
  j0z: 0.0,
}
```

---

## 调试面板

项目左下角内置调试面板（[DebugPanel.vue](src/components/DebugPanel.vue)），为 3D 艺术家和开发者提供：

| 功能 | 说明 |
|------|------|
| 骨骼可视化 | 显示骨骼轴向箭头、关节点、2D 标签覆层；骨骼名称与轴向对照表；棍状骨骼模式 |
| 关节控制 | j0 ~ j6 数值输入 + ±10° 快捷按钮；j0 额外提供 XYZ 位移输入 |
| J6 笛卡尔坐标 | 实时显示末端执行器的 X/Y/Z 位置和 Rx/Ry/Rz 旋转（通过骨骼链计算） |

**上线前隐藏：** 在 [RobotViewer.vue](src/components/RobotViewer.vue) 中注释 `<DebugPanel>` 行，或设置 `debug.enabled.value = false`。

调试面板的 UI 和逻辑完全解耦（[DebugPanel.vue](src/components/DebugPanel.vue) + [useDebugManager.js](composables/useDebugManager.js)），迭代调试功能无需改动主视图组件。

---

## 后端服务

`Back-end Test/` 目录包含 .NET 8 Web API 后端代码，提供 REST API 供前端轮询和 PLC 数据接入。

```bash
cd "Back-end Test"
dotnet restore
dotnet run   # 启动后端，默认 http://localhost:5000
```

启动后提供以下接口：

| 接口 | 方法 | 用途 |
|------|------|------|
| `/Robot/position` | GET | 获取当前关节坐标（前端轮询，100ms 间隔） |
| `/Robot/position` | POST | 接收 PLC 上位机推送的关节坐标（写入后端内存） |

详见 [Back-end Test/README.md](Back-end%20Test/README.md) 和 [Frontend-Backend API Contract.md](Frontend-Backend%20API%20Contract.md)。

---

## 单元测试

项目包含 14 个单元测试用例，覆盖 `useArmController` 核心 composable。

```bash
npm test              # 一次性运行
npm run test:watch    # 持续监听，文件改动自动重跑
```

| 测试文件 | 用例数 | 覆盖内容 |
|---------|--------|---------|
| [useArmController.test.js](tests/useArmController.test.js) | 14 | updatePose 数据合并、boneConfigs 完整性验证、对外 API 结构校验 |

测试使用 vitest + THREE.js 轻量 mock（`tests/__mocks__/`），不依赖 WebGL 或 DOM，可在 CI 流水线中运行。

---

## 生产打包与部署

```bash
npm run build
```

产物在 `dist/` 目录。

### 部署方式

| 通信模式 | 部署操作 |
|----------|----------|
| **方式 A (WebView2)** | 将 `dist/` 内所有文件拷贝到桌面程序资源路径，WebView2 加载 `dist/index.html` |
| **方式 B (REST 轮询)** | 将 `dist/` 内所有文件拷贝到后端 `wwwroot/` 目录（如 `D:\InnerSightMaster\webapi\wwwroot\`），浏览器访问 `http://localhost:5000/` 即可 |

> `vite.config.js` 已配置 `base: './'`，构建产物使用相对路径，可部署到任意子目录。
> 
> `useRobotPolling.js` 使用相对路径 `/Robot/position`，部署到 `wwwroot` 后自动指向同源后端，无需额外配置。

---

## 其他电脑运行

```bash
cd "Project code 所在目录"
npm install     # 只需要跑一次
npm run dev
```

所有 import 路径均为相对路径或 Vite alias，无需修改任何代码即可在任意路径下运行。
