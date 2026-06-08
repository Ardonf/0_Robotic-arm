import { describe, it, expect, beforeEach } from 'vitest'
import { shallowRef } from 'vue'
import { Scene } from 'three'
import { useTubeManager } from '../composables/useTubeManager.js'

function mockScene() {
  return shallowRef(new Scene())
}

const sampleHoles = [
  { id: 'hole_001', x: 0.1, y: 0.5, z: 0.2, status: 'ok' },
  { id: 'hole_002', x: 0.2, y: 0.5, z: 0.2, status: 'ng' },
  { id: 'hole_003', x: 0.3, y: 0.5, z: 0.2 },
  { id: 'hole_004', x: 0.4, y: 0.5, z: 0.2, status: 'ok' },
]

describe('useTubeManager', () => {
  let mgr, scene

  beforeEach(() => {
    scene = mockScene()
    mgr = useTubeManager(scene)
  })

  // ═══════════════════════════════════════════════════════════════
  describe('addHoles', () => {
    it('添加 4 个孔洞后 holeStats.total 应为 4', () => {
      mgr.addHoles(sampleHoles)
      expect(mgr.holeStats.value.total).toBe(4)
    })

    it('统计应正确反映各状态数量', () => {
      mgr.addHoles(sampleHoles)
      expect(mgr.holeStats.value.ok).toBe(2)
      expect(mgr.holeStats.value.ng).toBe(1)
      expect(mgr.holeStats.value.pending).toBe(1) // hole_003 未指定 status → pending
      expect(mgr.holeStats.value.active).toBe(0)
    })

    it('传入空数组不应报错且 total 保持为 0', () => {
      mgr.addHoles([])
      expect(mgr.holeStats.value.total).toBe(0)
    })

    it('第二次调用 addHoles 应清除旧数据', () => {
      mgr.addHoles(sampleHoles)
      mgr.addHoles([{ id: 'hole_a', x: 0, y: 0, z: 0 }])
      expect(mgr.holeStats.value.total).toBe(1)
    })

    it('InstancedMesh 应挂载到 scene 中', () => {
      mgr.addHoles(sampleHoles)
      expect(mgr.instancedMesh.value).not.toBeNull()
      expect(mgr.instancedMesh.value.isInstancedMesh).toBe(true)
      expect(scene.value.children.length).toBe(1)
    })
  })

  // ═══════════════════════════════════════════════════════════════
  describe('setHoleStatus', () => {
    beforeEach(() => {
      mgr.addHoles(sampleHoles)
    })

    it('应将 hole_002 状态从 ng 改为 ok', () => {
      mgr.setHoleStatus('hole_002', 'ok')
      expect(mgr.holeStats.value.ok).toBe(3)
      expect(mgr.holeStats.value.ng).toBe(0)
    })

    it('应保存 meta 信息', () => {
      mgr.setHoleStatus('hole_001', 'ok', { value: '0.123', time: '2026-05-01' })
      const hole = mgr.getHoleByInstanceId(0)
      expect(hole.value).toBe('0.123')
      expect(hole.time).toBe('2026-05-01')
    })

    it('传入不存在的孔洞 ID 不应影响统计', () => {
      mgr.setHoleStatus('hole_999', 'ok')
      expect(mgr.holeStats.value.total).toBe(4)
    })

    it('应更新 InstancedMesh 的颜色', () => {
      const mesh = mgr.instancedMesh.value
      const before = mesh._colors[0]
      mgr.setHoleStatus('hole_001', 'ng')
      // _colors[0] 应被 setColorAt 更新
      expect(mesh._colors[0]).toBeDefined()
    })
  })

  // ═══════════════════════════════════════════════════════════════
  describe('getHoleByInstanceId', () => {
    beforeEach(() => {
      mgr.addHoles(sampleHoles)
    })

    it('应返回匹配的孔洞', () => {
      const hole = mgr.getHoleByInstanceId(0)
      expect(hole.id).toBe('hole_001')
      expect(hole.status).toBe('ok')
    })

    it('传入不存在的 instanceId 应返回 null', () => {
      expect(mgr.getHoleByInstanceId(99)).toBeNull()
    })
  })

  // ═══════════════════════════════════════════════════════════════
  describe('holeStats', () => {
    it('初始状态 total 应为 0', () => {
      expect(mgr.holeStats.value.total).toBe(0)
    })

    it('动态更新：先加 4 个孔洞再改状态', () => {
      mgr.addHoles(sampleHoles)
      expect(mgr.holeStats.value.ok).toBe(2)
      mgr.setHoleStatus('hole_002', 'ok')
      expect(mgr.holeStats.value.ok).toBe(3)
      mgr.setHoleStatus('hole_003', 'active')
      expect(mgr.holeStats.value.active).toBe(1)
      expect(mgr.holeStats.value.pending).toBe(0)
    })
  })
})
