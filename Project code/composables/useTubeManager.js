/**
 * useTubeManager.js
 * 负责：孔洞批量渲染 · 状态颜色切换 · 统计响应式数据
 *
 * 渲染策略（混合架构）：
 *   标准孔洞（来自视觉算法）→ InstancedMesh（高性能批量渲染）
 *   调试孔洞（自定义尺寸/颜色）→ 独立 Mesh（灵活控制）
 *   两者统一计入 holeStats
 *
 * 孔洞数据格式：
 *   { id, x, y, z, status, _custom?, _radius?, _height?, _color? }
 *   status: 'ok' | 'ng' | 'active' | 'pending'
 */
import { ref, computed, shallowRef } from 'vue'
import * as THREE from 'three'

const HOLE_GEOMETRY = {
  radius: 0.02,
  height: 0.008,
  segments: 8,
}

const STATUS_COLOR = {
  ok:      new THREE.Color(0x1D9E75),
  ng:      new THREE.Color(0xD85A30),
  active:  new THREE.Color(0xEF9F27),
  pending: new THREE.Color(0x888780),
}

export function useTubeManager(scene) {
  const holeMap        = new Map()
  const instancedMesh  = shallowRef(null)
  const standaloneMap  = new Map()

  const _allHoles = []

  const _stats = ref({ total: 0, ok: 0, ng: 0, active: 0, pending: 0 })
  const holeStats = computed(() => _stats.value)

  function _clearInstancedMesh() {
    if (instancedMesh.value) {
      scene.value.remove(instancedMesh.value)
      instancedMesh.value.geometry.dispose()
      instancedMesh.value.material.dispose()
      instancedMesh.value = null
    }
    holeMap.clear()
  }

  function _clearStandalone() {
    for (const [, entry] of standaloneMap) {
      scene.value.remove(entry.mesh)
      entry.mesh.geometry.dispose()
      entry.mesh.material.dispose()
    }
    standaloneMap.clear()
  }

  function _buildStandardMesh(holes) {
    const count = holes.length
    if (count === 0) return

    const geo = new THREE.CylinderGeometry(
      HOLE_GEOMETRY.radius,
      HOLE_GEOMETRY.radius,
      HOLE_GEOMETRY.height,
      HOLE_GEOMETRY.segments
    )
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.4,
      metalness: 0.1,
    })

    const mesh = new THREE.InstancedMesh(geo, mat, count)
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    mesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(count * 3), 3
    )

    const dummy = new THREE.Object3D()
    holes.forEach((hole, i) => {
      dummy.position.set(hole.x, hole.y - HOLE_GEOMETRY.height / 2, hole.z)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)

      const status = hole.status || 'pending'
      mesh.setColorAt(i, STATUS_COLOR[status])
      holeMap.set(hole.id, { instanceId: i, status, meta: {} })
    })

    mesh.instanceMatrix.needsUpdate = true
    mesh.instanceColor.needsUpdate  = true

    scene.value.add(mesh)
    instancedMesh.value = mesh

    mesh.userData.holeMap = holeMap
    mesh.userData.isHoleMesh = true
    mesh.userData.holes = holes
  }

  function _buildStandaloneHoles(holes) {
    holes.forEach((hole) => {
      const radius  = hole._radius  || HOLE_GEOMETRY.radius
      const height  = hole._height  || HOLE_GEOMETRY.height
      const color   = hole._color
        ? new THREE.Color(hole._color)
        : STATUS_COLOR[hole.status || 'pending']

      const geo = new THREE.CylinderGeometry(radius, radius, height, HOLE_GEOMETRY.segments)
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.1 })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(hole.x, hole.y - height / 2, hole.z)
      mesh.userData.holeId = hole.id
      mesh.userData.isHoleMesh = true
      mesh.userData.status = hole.status || 'pending'
      mesh.userData.meta = hole.meta || {}
      scene.value.add(mesh)

      standaloneMap.set(hole.id, { mesh, status: hole.status || 'pending', meta: {} })
    })
  }

  function _rebuild() {
    _clearInstancedMesh()
    _clearStandalone()

    const standardHoles = _allHoles.filter(h => !h._custom)
    const customHoles   = _allHoles.filter(h => h._custom)

    _buildStandardMesh(standardHoles)
    _buildStandaloneHoles(customHoles)

    updateStats()
  }

  function addHoles(holes) {
    _allHoles.length = 0
    _allHoles.push(...holes)
    _rebuild()
  }

  function appendHoles(holes) {
    _allHoles.push(...holes)
    _rebuild()
  }

  function removeHoles(ids) {
    const idSet = new Set(ids)
    const remaining = _allHoles.filter(h => !idSet.has(h.id))
    _allHoles.length = 0
    _allHoles.push(...remaining)
    _rebuild()
  }

  function setHoleStatus(id, status, meta = {}) {
    const entry = holeMap.get(id)
    if (entry && instancedMesh.value) {
      entry.status = status
      entry.meta   = meta
      const color = STATUS_COLOR[status] || STATUS_COLOR.pending
      instancedMesh.value.setColorAt(entry.instanceId, color)
      instancedMesh.value.instanceColor.needsUpdate = true
      updateStats()
      return
    }

    const sa = standaloneMap.get(id)
    if (sa) {
      sa.status = status
      sa.meta   = meta
      const color = STATUS_COLOR[status] || STATUS_COLOR.pending
      if (sa.mesh.material) {
        sa.mesh.material.color.copy(color)
      }
      updateStats()
    }
  }

  function updateStats() {
    const counts = { total: 0, ok: 0, ng: 0, active: 0, pending: 0 }
    holeMap.forEach(({ status }) => {
      counts.total++
      if (counts[status] !== undefined) counts[status]++
    })
    standaloneMap.forEach(({ status }) => {
      counts.total++
      if (counts[status] !== undefined) counts[status]++
    })
    _stats.value = counts
  }

  function getHoleByInstanceId(instanceId) {
    for (const [id, entry] of holeMap) {
      if (entry.instanceId === instanceId) {
        return { id, ...entry.meta, status: entry.status }
      }
    }
    return null
  }

  function getHoleById(id) {
    const entry = holeMap.get(id)
    if (entry) return { id, ...entry.meta, status: entry.status }
    const sa = standaloneMap.get(id)
    if (sa) return { id, ...sa.meta, status: sa.status }
    return null
  }

  return {
    addHoles,
    appendHoles,
    removeHoles,
    setHoleStatus,
    holeStats,
    getHoleByInstanceId,
    getHoleById,
    instancedMesh,
  }
}
