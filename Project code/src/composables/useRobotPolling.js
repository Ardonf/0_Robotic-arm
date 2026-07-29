/**
 * useRobotPolling.js
 * 负责：通过 GET /Robot/position 轮询后端获取机械臂关节坐标
 *
 *  架构：
 *    PLC/上位机 → C# 后端 → GET /Robot/position → 前端 (本文件)
 *
 *  使用方式（在 App.vue 中）：
 *    import { useRobotPolling } from './composables/useRobotPolling.js'
 *    useRobotPolling((pose) => viewer.value?.onArmPoseReceived(pose))
 *
 *  注意：
 *    - URL 使用相对路径，部署到 wwwroot 后自动指向同源后端
 *    - 轮询间隔 100ms（10Hz），满足合同要求的 ≥10Hz 推送频率
 *    - 与 window.onCSharpMessage WebView2 桥接共存，两者互不冲突
 *    - 如果后端未就绪（404/网络错误），静默等待，不阻塞 WebView2 桥接
 */
import { onMounted, onUnmounted } from 'vue'

// ┌─────────────────────────────────────────────────────────────────────┐
// │  🔧 修改这里：后端 API 地址                                           │
// │     生产环境: /Robot/position（同源相对路径，无需改动）                 │
// │     开发环境: 如果 vite dev server 和 API 不同源，改为完整 URL        │
// │              例如: http://localhost:5000/Robot/position               │
// └─────────────────────────────────────────────────────────────────────┘
const API_URL = '/Robot/position'

/** 轮询间隔 (ms)。100ms = 10Hz，满足合同要求 */
const POLL_INTERVAL = 100

export function useRobotPolling(onArmPose) {
  let timer = null

  // 保底重置轮询间隔上限（ms）
  const MAX_POLL_INTERVAL = 3000

  // 如果第一次就连接失败，后续避免高频重试
  let retryInterval = POLL_INTERVAL

  async function fetchPose() {
    try {
      const res = await fetch(API_URL, { cache: 'no-store' })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const data = await res.json()

      // ┌─────────────────────────────────────────────────────────────┐
      // │ 🔧 根据后端实际返回的 JSON 结构适配字段名                      │
      // │   如果后端返回 PascalCase (C# 默认): { "J1": 0.5, ... }      │
      // │   如果后端返回 camelCase:         { "j1": 0.5, ... }        │
      // │   当前默认：后端返回 camelCase                                │
      // └─────────────────────────────────────────────────────────────┘
      onArmPose(data)

      // 成功后恢复默认间隔
      retryInterval = POLL_INTERVAL

    } catch (e) {
      // 后端未就绪是正常状态，不打印错误堆栈
      console.info(`[Polling] API 未就绪 (${e.message})`)

      // 失败后指数退避，避免后端重启期间高频报错
      retryInterval = Math.min(retryInterval * 1.5, MAX_POLL_INTERVAL)

    } finally {
      // 每次成功或失败后都安排下一次轮询
      timer = setTimeout(fetchPose, retryInterval)
    }
  }

  onMounted(() => {
    console.log(`[Polling] 启动，轮询间隔 ${POLL_INTERVAL}ms，地址: ${API_URL}`)
    fetchPose()
  })

  onUnmounted(() => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    console.log('[Polling] 已停止')
  })
}
