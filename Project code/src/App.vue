<template>
  <RobotViewer ref="viewer" style="width: 100vw; height: 100vh;" />
</template>

<script setup>
import { ref } from 'vue'
import RobotViewer from './components/RobotViewer.vue'
import { useRobotPolling } from './composables/useRobotPolling.js'

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
 * REST 轮询入口（方式 B）
 * 数据流: PLC → HTTP POST → .NET 8 → GET /Robot/position → 前端
 *
 * 部署到 wwwroot 后使用相对路径自动指向同源后端。
 * 如果后端未就绪，轮询会静默等待，不影响 WebView2 桥接模式。
 */
useRobotPolling((pose) => {
  viewer.value?.onArmPoseReceived(pose)
})
</script>
