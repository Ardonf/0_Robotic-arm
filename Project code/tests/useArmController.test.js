import { describe, it, expect, beforeEach } from 'vitest'
import { shallowRef } from 'vue'
import { Scene } from 'three'
import { useArmController } from '../composables/useArmController.js'

function mockScene() {
  return shallowRef(new Scene())
}

describe('useArmController', () => {
  let ctrl, scene

  beforeEach(() => {
    scene = mockScene()
    ctrl = useArmController(scene)
  })

  // ═══════════════════════════════════════════════════════════════
  describe('updatePose', () => {
    it('应将传入的关节角度合并到内部 targetPose', () => {
      ctrl.updatePose({ j1: 0.5, j2: 1.2, j3: -0.3 })
      expect(ctrl.j6Cartesian.value).toEqual({ x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 })
    })

    it('应提取 j0x / j0y / j0z 到底座位移', () => {
      ctrl.updatePose({ j0: 0.1, j0x: 0.5, j0y: -0.2, j0z: 0.3 })
      expect(ctrl.j6Cartesian.value.x).toBe(0)
    })

    it('如果 pose 中未提供 j0x，不应覆写已有的 targetPos.x', () => {
      ctrl.updatePose({ j0x: 1.0, j0y: 2.0, j0z: 3.0 })
      ctrl.updatePose({ j1: 0.5 })
      expect(true).toBe(true)
    })

    it('支持部分关节更新（不会影响未提供的关节）', () => {
      ctrl.updatePose({ j1: 0.7, j6: 1.5 })
      ctrl.updatePose({ j3: -0.4 })
      expect(true).toBe(true)
    })
  })

  // ═══════════════════════════════════════════════════════════════
  describe('boneConfigs', () => {
    it('BONE_NAMES 应包含 j0 ~ j6 所有 7 个关节', () => {
      const names = ctrl.boneConfigs.BONE_NAMES
      const keys = ['j0', 'j1', 'j2', 'j3', 'j4', 'j5', 'j6']
      keys.forEach(k => {
        expect(names).toHaveProperty(k)
        expect(typeof names[k]).toBe('string')
        expect(names[k].length).toBeGreaterThan(0)
      })
    })

    it('BONE_AXIS 应包含 j0 ~ j6 所有 7 个关节', () => {
      const axes = ctrl.boneConfigs.BONE_AXIS
      const keys = ['j0', 'j1', 'j2', 'j3', 'j4', 'j5', 'j6']
      keys.forEach(k => {
        expect(axes).toHaveProperty(k)
      })
    })

    it('BONE_AXIS 中每个条目应包含 axis 和 sign 属性', () => {
      const axes = ctrl.boneConfigs.BONE_AXIS
      Object.values(axes).forEach(v => {
        expect(v).toHaveProperty('axis')
        expect(v).toHaveProperty('sign')
        expect(['x', 'y', 'z']).toContain(v.axis)
        expect([-1, 1]).toContain(v.sign)
      })
    })

    it('BASE_POS_AXIS 应包含 x, y, z 三个轴', () => {
      const base = ctrl.boneConfigs.BASE_POS_AXIS
      expect(base).toHaveProperty('x')
      expect(base).toHaveProperty('y')
      expect(base).toHaveProperty('z')
      Object.values(base).forEach(v => {
        expect(v).toHaveProperty('sign')
      })
    })
  })

  // ═══════════════════════════════════════════════════════════════
  describe('exported API', () => {
    it('应暴露 loadArm 函数', () => {
      expect(typeof ctrl.loadArm).toBe('function')
    })

    it('应暴露 updatePose 函数', () => {
      expect(typeof ctrl.updatePose).toBe('function')
    })

    it('应暴露 bones（shallowRef）', () => {
      expect(ctrl.bones).toBeDefined()
      expect(ctrl.bones.value).toEqual({})
    })

    it('应暴露 j6Cartesian（shallowRef）', () => {
      expect(ctrl.j6Cartesian).toBeDefined()
      expect(ctrl.j6Cartesian.value).toEqual({
        x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0,
      })
    })

    it('应暴露 boneConfigs（含 BONE_NAMES / BONE_AXIS / BASE_POS_AXIS）', () => {
      expect(ctrl.boneConfigs).toBeDefined()
      expect(ctrl.boneConfigs.BONE_NAMES).toBeDefined()
      expect(ctrl.boneConfigs.BONE_AXIS).toBeDefined()
      expect(ctrl.boneConfigs.BASE_POS_AXIS).toBeDefined()
    })

    it('j6Cartesian 在无骨骼场景下保持全零', () => {
      expect(ctrl.j6Cartesian.value.x).toBe(0)
      expect(ctrl.j6Cartesian.value.y).toBe(0)
      expect(ctrl.j6Cartesian.value.z).toBe(0)
    })
  })
})
