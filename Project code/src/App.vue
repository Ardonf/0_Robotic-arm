<template>
  <RobotViewer ref="viewer" style="width: 100vw; height: 100vh;" />
</template>

<script setup>
import { ref } from 'vue'
import RobotViewer from './components/RobotViewer.vue'

const viewer = ref(null)

/**
 * WebView2 桥接入口
 * C# 层通过 webView.CoreWebView2.PostWebMessageAsString() 发送 JSON
 * 格式 A（关节）: { "type": "pose", "j0":0.1, "j1":0.1, ... }
 * 格式 B（孔洞）: { "type": "holes", "data": [...] }
 */
window.onCSharpMessage = (jsonStr) => {
  try {
    const msg = JSON.parse(jsonStr)
    if (msg.type === 'pose') {
      viewer.value?.onArmPoseReceived(msg)
    } else if (msg.type === 'holes') {
      viewer.value?.onHoleDataReceived(msg.data)
    } else if (msg.type === 'addHoles') {
      viewer.value?.addHoles(msg.data)
    }
  } catch (e) {
    console.error('[Bridge] 消息解析失败:', e)
  }
}
</script>
