/**
 * useRaycaster.js
 * 负责：鼠标点击 → 射线拾取孔洞 → 回调通知 Vue 层显示详情
 */
import * as THREE from 'three'

export function useRaycaster() {
  const raycaster = new THREE.Raycaster()
  const pointer   = new THREE.Vector2()

  let _renderer = null
  let _camera   = null
  let _scene    = null
  let _callback = null

  function initRaycaster(renderer, camera, scene, onHoleClick) {
    _renderer = renderer
    _camera   = camera
    _scene    = scene
    _callback = onHoleClick

    renderer.domElement.addEventListener('click', onCanvasClick)
  }

  function onCanvasClick(event) {
    if (!_renderer || !_camera || !_scene) return

    const rect = _renderer.domElement.getBoundingClientRect()
    pointer.x = ((event.clientX - rect.left)  / rect.width)  * 2 - 1
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

    raycaster.setFromCamera(pointer, _camera)

    // 只检测孔洞 mesh（避免对整个场景做射线检测）
    const holeMeshes = []
    _scene.traverse((obj) => {
      if (obj.isInstancedMesh && obj.userData.isHoleMesh) holeMeshes.push(obj)
    })

    const intersects = raycaster.intersectObjects(holeMeshes)

    if (intersects.length === 0) {
      _callback?.(null, event)
      return
    }

    const hit        = intersects[0]
    const mesh       = hit.object
    const instanceId = hit.instanceId

    // 从 holeMap 反查孔洞信息
    if (instanceId === undefined || !mesh.userData.holeMap) {
      _callback?.(null, event)
      return
    }

    let foundHole = null
    for (const [id, entry] of mesh.userData.holeMap) {
      if (entry.instanceId === instanceId) {
        foundHole = { id, status: entry.status, ...entry.meta }
        break
      }
    }

    _callback?.(foundHole, event)
  }

  function dispose() {
    _renderer?.domElement.removeEventListener('click', onCanvasClick)
  }

  return { initRaycaster, dispose }
}
