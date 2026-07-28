/**
 * useSignalR.js
 * 负责：通过 SignalR WebSocket 连接 .NET 8 后端，接收机械臂关节坐标
 *
 *  架构：
 *    PLC/上位机 → HTTP POST → .NET 8 API → SignalR Hub → 前端 (本文件)
 *
 *  使用方式（在 App.vue 中）：
 *    import { useSignalR } from './composables/useSignalR.js'
 *    useSignalR((pose) => viewer.value?.onArmPoseReceived(pose))
 *
 *  注意：
 *    - 如果后端未启动（WebView2 嵌入场景），连接会静默失败，不影响本地使用
 *    - 与 window.onCSharpMessage WebView2 桥接共存，两者互不冲突
 */
import { onMounted, onUnmounted } from 'vue'
import * as signalR from '@microsoft/signalr'

// ┌─────────────────────────────────────────────────────────────────────┐
// │  🔧 修改这里：后端 SignalR Hub 地址                                   │
// │     开发环境: http://localhost:5000/hub/arm                           │
// │     生产环境: 改为实际后端 IP 或域名                                   │
// └─────────────────────────────────────────────────────────────────────┘
const HUB_URL = 'http://localhost:5000/hub/arm'

export function useSignalR(onArmPose) {
  let connection = null

  onMounted(() => {
    connection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL)
      .withAutomaticReconnect([0, 2000, 10000, 30000]) // 重试策略：0ms → 2s → 10s → 30s
      .configureLogging(signalR.LogLevel.Warning)       // 生产调试时可改为 Information
      .build()

    connection.on('ArmPoseUpdate', (pose) => {
      // 收到的 JSON 字段名首字母大写（C# PascalCase → JS camelCase）
      // SignalR 默认保持服务端字段名，因此直接传原对象
      onArmPose(pose)
    })

    connection.onreconnecting(() => {
      console.warn('[SignalR] 正在重连...')
    })

    connection.onreconnected(() => {
      console.log('[SignalR] 已重连')
    })

    connection.onclose(() => {
      console.warn('[SignalR] 连接已关闭')
    })

    connection.start()
      .then(() => console.log('[SignalR] 已连接到后端'))
      .catch((err) => {
        // 后端未启动是正常情况（WebView2 嵌入场景），不报错
        console.info('[SignalR] 后端未连接，仅使用 WebView2 桥接模式')
      })
  })

  onUnmounted(() => {
    if (connection?.state === signalR.HubConnectionState.Connected) {
      connection.stop()
    }
  })
}
