/**
 * useArmController.js
 * 负责：加载机械臂 glTF 模型 · 骨骼关节驱动 · 插值平滑
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  骨骼名称配置区 — 根据你的 Blender 骨骼命名修改以下内容 
 * ╚══════════════════════════════════════════════════════════════════╝
 */
import { shallowRef } from 'vue'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

// ┌─────────────────────────────────────────────────────────────────────┐
// │  🔧 修改这里：将右侧字符串替换为你在 Blender 中设置的骨骼名称
// │  查看方法：Blender → 选中 Armature → Pose Mode → 点击骨骼 → 
// │           右侧 Properties > Bone 面板中的骨骼名称即为此处的值
// └─────────────────────────────────────────────────────────────────────┘
const BONE_NAMES = {
  j0: 'CS620-Base',            // ← 底座骨骼（旋转 + XYZ 位移）
  j1: 'CS620-J1',              // ← 修改：底座旋转轴（绕 Y 轴）
  j2: 'CS620-J2_Link1_J3',     // ← 修改：大臂俯仰
  j3: 'CS620-Link2A_Link2B_J4',// ← 修改：小臂俯仰
  j4: 'CS620-J5',              // ← 修改：腕部旋转
  j5: 'CS620-J6',              // ← 修改：腕部弯曲
  j6: 'CS620-Flange',          // ← 修改：末端执行器旋转
}

// ┌─────────────────────────────────────────────────────────────────────┐
// │ 修改这里：每根骨骼受 PLC 关节值影响的旋转轴
// │  通常：底座 = Y轴，俯仰关节 = X轴，腕部 = Z轴
// │  如果关节转向相反，把 1 改为 -1
// └─────────────────────────────────────────────────────────────────────┘
const BONE_AXIS = {
  j0: { axis: 'y', sign:  1 },
  j1: { axis: 'y', sign:  1 },
  j2: { axis: 'y', sign:  1 },
  j3: { axis: 'y', sign:  -1 },
  j4: { axis: 'y', sign:  1 },
  j5: { axis: 'y', sign:  1 },
  j6: { axis: 'y', sign:  1 },
}

// ┌─────────────────────────────────────────────────────────────────────┐
// │  🔧 j0 底座 XYZ 位移配置
// │  sign=-1 表示输入的正值使骨骼向负方向移动
// └─────────────────────────────────────────────────────────────────────┘
const BASE_POS_AXIS = {
  x: { sign:  1 },
  y: { sign:  1 },
  z: { sign:  1 },
}

// ┌─────────────────────────────────────────────────────────────────────┐
// │  单位换算：PLC 返回的底座位移单位是毫米 (mm)                          │
// │  glTF 场景单位是米 (m)，1 m = 1000 mm，因此 mm → m 除以 1000         │
// │  实测本模型包围盒约 2.09 单位（≈2.09 米），确认场景单位为米           │
// └─────────────────────────────────────────────────────────────────────┘
const MM_TO_UNIT = 1 / 1000

export function useArmController(scene) {
  const bones        = shallowRef({})  // 骨骼引用映射
  const restQuats    = {}              // 各骨骼静止四元数（叠加关节旋转用，避免覆盖静止位姿）
  const armModel     = shallowRef(null) // 模型根节点引用（供调试面板隐藏网格体用）
  const targetPose   = shallowRef({ j0:0, j1:0, j2:0, j3:0, j4:0, j5:0, j6:0 })
  const currentPose  = { j0:0, j1:0, j2:0, j3:0, j4:0, j5:0, j6:0 }

  // j0 底座 XYZ 位移值（单位：模型坐标系单位）
  const targetPos    = shallowRef({ x:0, y:0, z:0 })
  const currentPos   = { x:0, y:0, z:0 }

  // 插值平滑系数（0=不插值直接跳变, 1=完全不动; 推荐 0.12~0.2）
  const LERP_FACTOR = 0.15

  // 关节旋转轴方向（骨骼局部坐标系，与 BONE_AXIS 的 axis 对应）
  const JOINT_AXIS_VEC = {
    x: new THREE.Vector3(1, 0, 0),
    y: new THREE.Vector3(0, 1, 0),
    z: new THREE.Vector3(0, 0, 1),
  }
  const _deltaQuat = new THREE.Quaternion() // 增量旋转临时变量

  /**
   * 加载 glTF 模型
   * @param {string} url          - 模型路径（相对 public 目录）
   * @param {Function} onProgress - 进度回调 (0~1)
   */
  async function loadArm(url, onProgress) {
    return new Promise((resolve, reject) => {
      const loader = new GLTFLoader()
      loader.load(
        url,
        (gltf) => {
          const model = gltf.scene
          scene.value.add(model)
          armModel.value = model

          // ── 自动收集骨骼 ─────────────────────────────────────────
          const found = {}
          model.traverse((obj) => {
            if (obj.isBone) {
              Object.entries(BONE_NAMES).forEach(([key, name]) => {
                if (obj.name === name) found[key] = obj
              })
            }
          })
          bones.value = found

          // ── 保存每根骨骼的静止四元数 ─────────────────────────────
          // 后续每帧把关节增量旋转乘在静止旋转之上，保证 joints=0 时
          // 显示的就是 glb 原始静止位姿（不会丢失 Blender 里调的骨骼拧转）
          Object.entries(found).forEach(([key, bone]) => {
            restQuats[key] = bone.quaternion.clone()
          })

          // ── 提示未匹配的骨骼（开发时排查用） ──────────────────────
          Object.entries(BONE_NAMES).forEach(([key, name]) => {
            if (!found[key]) {
              console.warn(
                `[ArmController] 未找到骨骼 "${name}" (${key})。` +
                `请检查 BONE_NAMES 中 ${key} 的值是否与 Blender 中的骨骼名一致。`
              )
            }
          })

          // ── 启动插值循环 ──────────────────────────────────────────
          startInterpolationLoop()

          resolve(gltf)
        },
        (xhr) => {
          if (onProgress && xhr.total) {
            onProgress(xhr.loaded / xhr.total)
          }
        },
        (err) => {
          console.error('[ArmController] 模型加载失败:', err)
          reject(err)
        }
      )
    })
  }

  /**
   * 接收 SignalR 推送的关节角度（程序员调用此函数）
   * @param {Object} pose - { j0, j1, j2, j3, j4, j5, j6, j0x, j0y, j0z } 单位：弧度
   *   j0 ~ j6: 各关节旋转角度（弧度）
   *   j0x/j0y/j0z: 底座 XYZ 位移（单位：毫米），内部自动换算为场景单位
   */
  function updatePose(pose) {
    Object.assign(targetPose.value, pose)

    // 提取底座位移值并写入 targetPos（单位：毫米 → 场景单位米，除以 1000）
    if (pose.j0x !== undefined) targetPos.value.x = pose.j0x * MM_TO_UNIT
    if (pose.j0y !== undefined) targetPos.value.y = pose.j0y * MM_TO_UNIT
    if (pose.j0z !== undefined) targetPos.value.z = pose.j0z * MM_TO_UNIT
  }

  /**
   * 插值循环：在 requestAnimationFrame 节奏下平滑驱动骨骼
   * （避免 SignalR 推送间隔造成关节跳变）
   */
  function startInterpolationLoop() {
    function tick() {
      requestAnimationFrame(tick)
      const bonesMap = bones.value
      if (!bonesMap || !Object.keys(bonesMap).length) return

      // ── 关节旋转插值 ─────────────────────────────────────────────
      Object.entries(BONE_AXIS).forEach(([key, { axis, sign }]) => {
        const bone = bonesMap[key]
        if (!bone) return

        // 线性插值当前角度 → 目标角度
        currentPose[key] = THREE.MathUtils.lerp(
          currentPose[key],
          targetPose.value[key] * sign,
          LERP_FACTOR
        )

        // 将关节角作为"绕骨骼自身局部轴的增量旋转"，叠加在静止四元数之上。
        // 不能直接写 bone.rotation[axis]，否则会覆盖静止欧拉角的该分量，
        // 导致 joints=0 时也偏离 glb 原始静止位姿（丢失 Blender 里的骨骼拧转）。
        _deltaQuat.setFromAxisAngle(JOINT_AXIS_VEC[axis], currentPose[key])
        bone.quaternion.copy(restQuats[key]).multiply(_deltaQuat)
      })

      // ── j0 底座 XYZ 位移插值 ─────────────────────────────────────
      const baseBone = bonesMap['j0']
      if (baseBone) {
        Object.entries(BASE_POS_AXIS).forEach(([axis, { sign }]) => {
          currentPos[axis] = THREE.MathUtils.lerp(
            currentPos[axis],
            targetPos.value[axis] * sign,
            LERP_FACTOR
          )
          baseBone.position[axis] = currentPos[axis]
        })
      }

      // ── J6 末端笛卡尔坐标计算 ────────────────────────────────────
      //
      //  通过追踪 model 中 j6 骨骼（CS620-Flange）的 worldMatrix，
      //  提取末端执行器在世界坐标系中的位置（X/Y/Z）和旋转（Rx/Ry/Rz）。
      //
      //  THREE.Bone 继承 Object3D，getWorldPosition/getWorldQuaternion
      //  会自动计算整个父级骨骼链的累积变换，因此无需手动逐级相乘。
      //
      const j6Bone = bonesMap['j6']
      if (j6Bone) {
        j6Bone.getWorldPosition(_j6WorldPos)
        j6Bone.getWorldQuaternion(_j6WorldQuat)
        _j6Euler.setFromQuaternion(_j6WorldQuat, 'XYZ')
        j6Cartesian.value = {
          x:  _j6WorldPos.x,
          y:  _j6WorldPos.y,
          z:  _j6WorldPos.z,
          rx: _j6Euler.x,
          ry: _j6Euler.y,
          rz: _j6Euler.z,
        }
      }
    }
    tick()
  }

  // ── J6 末端笛卡尔坐标 ───────────────────────────────────────────
  const _j6WorldPos  = new THREE.Vector3()
  const _j6WorldQuat = new THREE.Quaternion()
  const _j6Euler     = new THREE.Euler()
  const j6Cartesian  = shallowRef({ x:0, y:0, z:0, rx:0, ry:0, rz:0 })

  return {
    loadArm,
    updatePose,
    // 暴露给调试面板
    bones,
    armModel,
    j6Cartesian,
    boneConfigs: { BONE_NAMES, BONE_AXIS, BASE_POS_AXIS },
  }
}
