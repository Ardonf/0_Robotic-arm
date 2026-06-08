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
│   ├── useArmController.js     ← 机械臂骨骼驱动
│   ├── useTubeManager.js       ← 孔洞 InstancedMesh 管理
│   ├── useRaycaster.js         ← 鼠标点击拾取
│   └── useDebugManager.js      ← 调试面板状态与逻辑
├── tests/
│   ├── useArmController.test.js
│   ├── useTubeManager.test.js
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

## 孔洞数据对接

视觉算法识别到孔洞后，调用组件暴露的方法：

```js
// 1. 添加所有孔洞（一次性，坐标来自视觉算法）
viewer.addHoles([
  { id: 'hole_001', x: 0.1, y: 0.5, z: 0.2 },
  { id: 'hole_002', x: 0.2, y: 0.5, z: 0.2 },
  // ...
])

// 2. 更新孔洞状态（检测结果返回后调用）
viewer.onHoleDataReceived([
  { id: 'hole_001', status: 'ok', value: '0.123', time: '2026-04-08 10:30', imageId: 'IMG_001' },
  { id: 'hole_002', status: 'ng', value: '2.456', time: '2026-04-08 10:31', imageId: 'IMG_002' },
])
```

状态值说明：
| status | 颜色 | 含义 |
|--------|------|------|
| `ok`      | 绿 | 检测正常 |
| `ng`      | 红 | 检测异常 |
| `active`  | 黄 | 正在检测 |
| `pending` | 灰 | 未检测（默认） |

---

## 机械臂关节对接（SignalR）

程序员通过 SignalR 推送关节角度后，调用：

```js
viewer.onArmPoseReceived({
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
})
```

---

## 嵌入 C# WebView2

C# 端发送消息：

```csharp
// 推送关节角度
webView.CoreWebView2.PostWebMessageAsString(
  JsonSerializer.Serialize(new {
    type = "pose",
    j0 = 0.0, j1 = 0.1, j2 = 0.3, j3 = 0.0,
    j4 = 0.0, j5 = 0.0, j6 = 0.0,
    j0x = 0.0, j0y = 0.0, j0z = 0.0
  })
);

// 推送孔洞检测结果
webView.CoreWebView2.PostWebMessageAsString(
  JsonSerializer.Serialize(new { type = "holes", data = holeList })
);
```

前端接收入口已在 [App.vue](src/App.vue) 的 `window.onCSharpMessage` 中配置好。

---

## 调试面板

项目左下角内置调试面板（[DebugPanel.vue](src/components/DebugPanel.vue)），为 3D 艺术家和开发者提供：

| 功能 | 说明 |
|------|------|
| 骨骼可视化 | 显示骨骼轴向箭头、关节点、2D 标签覆层；骨骼名称与轴向对照表 |
| 关节控制 | j0 ~ j6 数值输入 + ±10° 快捷按钮；j0 额外提供 XYZ 位移输入 |
| J6 笛卡尔坐标 | 实时显示末端执行器的 X/Y/Z 位置和 Rx/Ry/Rz 旋转（通过骨骼链计算） |
| 孔洞调试 | 在 J6 末端位置添加调试圆柱体；可调位移、高度、直径、颜色 |

**上线前隐藏：** 在 [RobotViewer.vue](src/components/RobotViewer.vue) 中注释 `<DebugPanel>` 行，或设置 `debug.enabled.value = false`。

调试面板的 UI 和逻辑完全解耦（[DebugPanel.vue](src/components/DebugPanel.vue) + [useDebugManager.js](composables/useDebugManager.js)），迭代调试功能无需改动主视图组件。

---

## 后端服务（仅仅测试可行性）

`Back-end Test/` 目录包含 .NET 8 Web API + SignalR Hub 后端代码。

```bash
cd "Back-end Test"
dotnet restore
dotnet run
```

启动后提供以下接口：

| 接口 | 用途 |
|------|------|
| `POST /api/pose` | 接收 7 轴关节坐标 |
| `POST /api/hole` | 接收孔洞检测数据 |
| `ws://localhost:5000/hub/arm` | SignalR WebSocket 端点 |

详见 [Back-end Test/README.md](Back-end%20Test/README.md)。

---

## 单元测试

项目包含 27 个单元测试用例，覆盖 `useArmController` 和 `useTubeManager` 两个核心 composable。

```bash
npm test              # 一次性运行
npm run test:watch    # 持续监听，文件改动自动重跑
```

| 测试文件 | 用例数 | 覆盖内容 |
|---------|--------|---------|
| [useArmController.test.js](tests/useArmController.test.js) | 13 | updatePose 数据合并、boneConfigs 完整性验证、对外 API 结构校验 |
| [useTubeManager.test.js](tests/useTubeManager.test.js) | 14 | addHoles 批量添加与统计、setHoleStatus 状态切换与 meta 存储、getHoleByInstanceId 查询 |

测试使用 vitest + THREE.js 轻量 mock（`tests/__mocks__/`），不依赖 WebGL 或 DOM，可在 CI 流水线中运行。

---

## 生产打包

```bash
npm run build
```

产物在 `dist/` 目录。WebView2 加载 `dist/index.html` 即可。

---

## 其他电脑运行

```bash
cd "Project code 所在目录"
npm install     # 只需要跑一次
npm run dev
```

所有 import 路径均为相对路径或 Vite alias，无需修改任何代码即可在任意路径下运行。
