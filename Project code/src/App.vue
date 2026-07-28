<template>
  <RobotViewer ref="viewer" style="width: 100vw; height: 100vh;" />
</template>

<script setup>
import { ref } from 'vue'
import RobotViewer from './components/RobotViewer.vue'
import { useSignalR } from './composables/useSignalR.js'

const viewer = ref(null)

/**
 * WebView2 桥接入口（方式 A）
 * C# 层通过 webView.CoreWebView2.PostWebMessageAsString() 发送 JSON
 * 格式（关节）: { "type": "pose", "j0":0.1, "j1":0.1, ... }
 */
window.onCSharpMessage = (jsonStr) => {
  try {
    const msg = JSON.parse(jsonStr)
    if (msg.type === 'pose') {
      viewer.value?.onArmPoseReceived(msg)
    }
  } catch (e) {
    console.error('[Bridge] 消息解析失败:', e)
  }
}

/**
 * SignalR 连接入口（方式 B）
 * 后端 .NET 8 API + SignalR Hub 推送关节角度
 * 数据流: PLC → HTTP POST → .NET 8 → SignalR → 前端
 *
 * 如果后端未启动（WebView2 嵌入场景），SignalR 连接会静默失败，
 * 不影响 WebView2 桥接模式的正常使用。两者可同时启用。
 */
useSignalR((pose) => {
  viewer.value?.onArmPoseReceived(pose)
})
</script>
