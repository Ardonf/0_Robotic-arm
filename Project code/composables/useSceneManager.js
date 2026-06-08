/**
 * useSceneManager.js
 * 负责：WebGLRenderer 初始化 · Scene · 渲染循环 · resize 响应
 */
import { ref, shallowRef } from 'vue'
import * as THREE from 'three'

export function useSceneManager() {
  const scene    = shallowRef(null)
  const camera   = shallowRef(null)
  const renderer = shallowRef(null)

  let animFrameId = null
  let container   = null

  function initScene(el) {
    container = el

    // ── Scene ──────────────────────────────────────────────────────
    scene.value = new THREE.Scene()
    scene.value.background = new THREE.Color(0x0d0f14)
    scene.value.fog = new THREE.Fog(0x0d0f14, 8, 30)

    // ── Camera ─────────────────────────────────────────────────────
    camera.value = new THREE.PerspectiveCamera(
      45,
      el.clientWidth / el.clientHeight,
      0.01,
      100
    )
    camera.value.position.set(3, 2, 4)
    camera.value.lookAt(0, 0.5, 0)

    // ── Renderer ───────────────────────────────────────────────────
    renderer.value = new THREE.WebGLRenderer({ antialias: true })
    renderer.value.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.value.setSize(el.clientWidth, el.clientHeight)
    renderer.value.shadowMap.enabled = true
    renderer.value.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.value.toneMapping = THREE.ACESFilmicToneMapping
    renderer.value.toneMappingExposure = 1.2
    el.appendChild(renderer.value.domElement)

    // ── Lighting ───────────────────────────────────────────────────
    const ambient = new THREE.AmbientLight(0xffffff, 0.4)
    scene.value.add(ambient)

    const key = new THREE.DirectionalLight(0xffffff, 1.2)
    key.position.set(4, 6, 4)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    scene.value.add(key)

    const fill = new THREE.DirectionalLight(0x8899cc, 0.4)
    fill.position.set(-4, 2, -2)
    scene.value.add(fill)

    // 地面网格（工业感参考）
    const grid = new THREE.GridHelper(10, 20, 0x1a1d24, 0x1a1d24)
    scene.value.add(grid)

    // ── OrbitControls（动态引入，避免打包问题） ──────────────────────
    import('three/addons/controls/OrbitControls.js').then(({ OrbitControls }) => {
      const controls = new OrbitControls(camera.value, renderer.value.domElement)
      controls.enableDamping  = true
      controls.dampingFactor  = 0.08
      controls.minDistance    = 0.5
      controls.maxDistance    = 20
      controls.target.set(0, 0.5, 0)
      controls.update()
      // 挂到 renderer 上便于外部访问
      renderer.value._controls = controls
    })

    // ── Resize ────────────────────────────────────────────────────
    window.addEventListener('resize', onResize)

    // ── Render loop ───────────────────────────────────────────────
    function animate() {
      animFrameId = requestAnimationFrame(animate)
      renderer.value._controls?.update()
      renderer.value.render(scene.value, camera.value)
    }
    animate()
  }

  function onResize() {
    if (!container || !renderer.value) return
    const w = container.clientWidth
    const h = container.clientHeight
    camera.value.aspect = w / h
    camera.value.updateProjectionMatrix()
    renderer.value.setSize(w, h)
  }

  function disposeScene() {
    cancelAnimationFrame(animFrameId)
    window.removeEventListener('resize', onResize)
    renderer.value?.dispose()
    renderer.value?.domElement?.remove()
  }

  return { scene, camera, renderer, initScene, disposeScene }
}
