<template>
  <div class="viewer-root">
    <!-- 三维画布 -->
    <div ref="canvasContainer" class="canvas-container" />

    <!-- 加载遮罩 -->
    <Transition name="fade">
      <div v-if="loading" class="loading-overlay">
        <div class="loading-inner">
          <div class="loading-bar"><div class="loading-fill" :style="{ width: loadProgress + '%' }" /></div>
          <span class="loading-text">加载模型 {{ loadProgress }}%</span>
        </div>
      </div>
    </Transition>

    <!-- 调试面板 — 独立组件，上线前注释 <DebugPanel> 即可移除 -->
    <DebugPanel :debug="debug" :boneConfigs="boneConfigs" />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useSceneManager } from '../../composables/useSceneManager.js'
import { useArmController } from '../../composables/useArmController.js'
import { useDebugManager } from '../../composables/useDebugManager.js'
import DebugPanel from './DebugPanel.vue'

// ─── Refs ────────────────────────────────────────────────────────────
const canvasContainer = ref(null)
const loading         = ref(true)
const loadProgress    = ref(0)

// ─── Composables ─────────────────────────────────────────────────────
const { scene, camera, renderer, initScene, disposeScene } = useSceneManager()
const armCtrl                                             = useArmController(scene)
const { loadArm, updatePose, boneConfigs }                 = armCtrl
const debug = useDebugManager(scene, armCtrl)

// ─── 生命周期 ─────────────────────────────────────────────────────────
onMounted(async () => {
  initScene(canvasContainer.value)

  // 加载机械臂模型
  // ↓↓↓ 修改此处为你的 glTF 文件名 ↓↓↓
  await loadArm('./models/robot_arm.glb', (p) => {
    loadProgress.value = Math.round(p * 100)
  })
  loading.value = false

  debug.setCameraForLabel(camera.value)
  debug.enabled.value = true
})

onUnmounted(() => {
  debug.dispose()
  disposeScene()
})

// ─── 供外部调用的接口（SignalR接入点） ────────────────────────────────

/**
 * 程序员调用此函数推送机械臂关节角度
 * @param {Object} pose - { j0, j1, j2, j3, j4, j5, j6, j0x, j0y, j0z } 单位：弧度
 */
function onArmPoseReceived(pose) {
  updatePose(pose)
  Object.assign(debug.jointForm, pose)
}

// 暴露给父组件（用于 WebView2 桥接或 SignalR 回调）
defineExpose({ onArmPoseReceived })
</script>

<style scoped>
.viewer-root {
  position: relative;
  width: 100%;
  height: 100%;
  background: #0d0f14;
  overflow: hidden;
  font-family: 'Consolas', 'Source Code Pro', monospace;
}

.canvas-container {
  width: 100%;
  height: 100%;
}

/* 加载遮罩 */
.loading-overlay {
  position: absolute;
  inset: 0;
  background: #0d0f14;
  display: flex;
  align-items: center;
  justify-content: center;
}
.loading-inner { text-align: center; }
.loading-bar {
  width: 200px;
  height: 2px;
  background: #222;
  border-radius: 1px;
  overflow: hidden;
  margin-bottom: 12px;
}
.loading-fill {
  height: 100%;
  background: #1D9E75;
  transition: width 0.2s;
}
.loading-text { font-size: 12px; color: #555; letter-spacing: 0.1em; }

/* 过渡动画 */
.fade-enter-active, .fade-leave-active { transition: opacity 0.4s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
