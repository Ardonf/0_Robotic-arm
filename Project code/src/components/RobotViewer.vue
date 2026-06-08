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

    <!-- 左上角：图例 -->
    <div class="legend">
      <div v-for="item in LEGEND" :key="item.status" class="legend-item">
        <span class="legend-dot" :style="{ background: item.color }" />
        <span>{{ item.label }}</span>
      </div>
    </div>

    <!-- 右上角：统计 -->
    <div class="stats-panel">
      <div class="stat-item">
        <span class="stat-val">{{ stats.total }}</span>
        <span class="stat-label">总孔洞</span>
      </div>
      <div class="stat-item ok">
        <span class="stat-val">{{ stats.ok }}</span>
        <span class="stat-label">正常</span>
      </div>
      <div class="stat-item ng">
        <span class="stat-val">{{ stats.ng }}</span>
        <span class="stat-label">异常</span>
      </div>
      <div class="stat-item pending">
        <span class="stat-val">{{ stats.pending }}</span>
        <span class="stat-label">未检测</span>
      </div>
    </div>

    <!-- 孔洞详情弹窗 -->
    <Transition name="panel">
      <div v-if="selectedHole" class="detail-panel" :style="detailPos">
        <div class="detail-header">
          <span class="detail-title">孔洞 {{ selectedHole.id }}</span>
          <button class="detail-close" @click="selectedHole = null">×</button>
        </div>
        <div class="detail-body">
          <div class="detail-row">
            <span class="detail-key">状态</span>
            <span class="detail-badge" :class="selectedHole.status">
              {{ STATUS_LABEL[selectedHole.status] }}
            </span>
          </div>
          <div class="detail-row">
            <span class="detail-key">检测值</span>
            <span class="detail-val">{{ selectedHole.value ?? '—' }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-key">检测时间</span>
            <span class="detail-val">{{ selectedHole.time ?? '—' }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-key">图像编号</span>
            <span class="detail-val">{{ selectedHole.imageId ?? '—' }}</span>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 调试面板 — 独立组件，上线前注释 <DebugPanel> 即可移除 -->
    <DebugPanel :debug="debug" :boneConfigs="boneConfigs" />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useSceneManager } from '../../composables/useSceneManager.js'
import { useArmController } from '../../composables/useArmController.js'
import { useTubeManager } from '../../composables/useTubeManager.js'
import { useRaycaster } from '../../composables/useRaycaster.js'
import { useDebugManager } from '../../composables/useDebugManager.js'
import DebugPanel from './DebugPanel.vue'

// ─── 颜色与状态常量 ───────────────────────────────────────────────────
const STATUS_COLOR = {
  ok:      '#1D9E75',   // 绿：正常
  ng:      '#D85A30',   // 红：异常
  active:  '#EF9F27',   // 黄：正在检测
  pending: '#888780',   // 灰：未检测
}

const STATUS_LABEL = {
  ok:      '正常',
  ng:      '异常',
  active:  '检测中',
  pending: '未检测',
}

const LEGEND = Object.entries(STATUS_COLOR).map(([status, color]) => ({
  status, color, label: STATUS_LABEL[status],
}))

// ─── Refs ────────────────────────────────────────────────────────────
const canvasContainer = ref(null)
const loading         = ref(true)
const loadProgress    = ref(0)
const selectedHole    = ref(null)
const detailPos       = ref({ left: '50%', top: '50%' })

// ─── Composables ─────────────────────────────────────────────────────
const { scene, camera, renderer, initScene, disposeScene } = useSceneManager()
const armCtrl                                             = useArmController(scene)
const { loadArm, updatePose, boneConfigs }                 = armCtrl
const tubeManager                                          = useTubeManager(scene)
const { addHoles, setHoleStatus, holeStats }               = tubeManager
const { initRaycaster }                                    = useRaycaster()
const debug = useDebugManager(scene, armCtrl, tubeManager)

// ─── 统计数据（响应式） ────────────────────────────────────────────────
const stats = computed(() => holeStats.value)

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

  // 初始化射线拾取
  initRaycaster(renderer.value, camera.value, scene.value, (hole, event) => {
    if (!hole) { selectedHole.value = null; return }
    selectedHole.value = hole
    // 弹窗跟随点击位置
    detailPos.value = {
      left: Math.min(event.clientX + 12, window.innerWidth  - 260) + 'px',
      top:  Math.min(event.clientY - 10, window.innerHeight - 220) + 'px',
    }
  })
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

/**
 * 程序员调用此函数批量更新孔洞状态
 * @param {Array} holes - [{ id, status, value, time, imageId }, ...]
 */
function onHoleDataReceived(holes) {
  holes.forEach(h => setHoleStatus(h.id, h.status, h))
}

// 暴露给父组件（用于 WebView2 桥接或 SignalR 回调）
defineExpose({ onArmPoseReceived, onHoleDataReceived, addHoles })
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

/* 图例 */
.legend {
  position: absolute;
  top: 16px;
  left: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: rgba(13,15,20,0.75);
  border: 0.5px solid #2a2d35;
  border-radius: 6px;
  padding: 10px 14px;
  backdrop-filter: blur(6px);
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #9a9a9a;
}
.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* 统计面板 */
.stats-panel {
  position: absolute;
  top: 16px;
  right: 16px;
  display: flex;
  gap: 2px;
  background: rgba(13,15,20,0.75);
  border: 0.5px solid #2a2d35;
  border-radius: 6px;
  overflow: hidden;
  backdrop-filter: blur(6px);
}
.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 16px;
  border-right: 0.5px solid #2a2d35;
  gap: 2px;
}
.stat-item:last-child { border-right: none; }
.stat-val { font-size: 20px; font-weight: 500; color: #ccc; }
.stat-label { font-size: 11px; color: #555; }
.stat-item.ok   .stat-val { color: #1D9E75; }
.stat-item.ng   .stat-val { color: #D85A30; }
.stat-item.pending .stat-val { color: #888780; }

/* 详情弹窗 */
.detail-panel {
  position: fixed;
  z-index: 100;
  width: 240px;
  background: rgba(18,20,26,0.95);
  border: 0.5px solid #2a2d35;
  border-radius: 8px;
  overflow: hidden;
  backdrop-filter: blur(12px);
  pointer-events: all;
}
.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  border-bottom: 0.5px solid #2a2d35;
  background: rgba(255,255,255,0.03);
}
.detail-title { font-size: 13px; color: #ccc; font-weight: 500; }
.detail-close {
  background: none;
  border: none;
  color: #555;
  font-size: 16px;
  cursor: pointer;
  line-height: 1;
  padding: 0;
}
.detail-close:hover { color: #ccc; }
.detail-body { padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; }
.detail-row { display: flex; justify-content: space-between; align-items: center; }
.detail-key { font-size: 11px; color: #555; }
.detail-val { font-size: 12px; color: #aaa; }
.detail-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 3px;
  font-weight: 500;
}
.detail-badge.ok      { background: #0d2e22; color: #1D9E75; }
.detail-badge.ng      { background: #2e1510; color: #D85A30; }
.detail-badge.active  { background: #2e2210; color: #EF9F27; }
.detail-badge.pending { background: #1e1e1e; color: #888780; }

/* 过渡动画 */
.fade-enter-active, .fade-leave-active { transition: opacity 0.4s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.panel-enter-active, .panel-leave-active { transition: opacity 0.15s, transform 0.15s; }
.panel-enter-from, .panel-leave-to { opacity: 0; transform: scale(0.96) translateY(-4px); }
</style>
