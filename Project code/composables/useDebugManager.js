/**
 * useDebugManager.js
 * 负责：调试模式下的所有状态与 Three.js 操作，与 UI 面板解耦
 *
 *  使用方式（在 RobotViewer.vue 中）：
 *    const armCtrl = useArmController(scene)
 *    const debug = useDebugManager(scene, armCtrl)
 *    然后将 debug 传给 <DebugPanel :debug="debug" />
 *
 *  如果你需修改/迭代调试功能，只需改本文件和 DebugPanel.vue，
 *  RobotViewer.vue 不需要改动。
 */
import { ref, reactive, shallowRef } from 'vue'
import * as THREE from 'three'

export function useDebugManager(sceneRef, armCtrl, tubeManager) {
  // ═════════════════════════════════════════════════════════════════
  // 调试面板开关
  // ═════════════════════════════════════════════════════════════════
  const enabled = ref(false)

  // ═════════════════════════════════════════════════════════════════
  // 需求 0 — 世界坐标可视化（场景原点处的 XYZ 轴，仿 Blender 风格）
  // ═════════════════════════════════════════════════════════════════
  const showWorldAxes = ref(false)
  const _worldAxesGroup = []

  const AXIS_ARROWS = [
    { axis: [1,0,0], color: 0xFF3B3B, label: 'X' },
    { axis: [0,1,0], color: 0x5BFF5B, label: 'Y' },
    { axis: [0,0,1], color: 0x3B7BFF, label: 'Z' },
  ]

  function _createArrow(axis, color) {
    const group = new THREE.Group()
    const dir = new THREE.Vector3(...axis).normalize()
    const origin = new THREE.Vector3(0, 0, 0)

    const shaftLength = 1.2
    const shaftR = 0.015
    const headLength = 0.22
    const headR = 0.05

    const shaftGeo = new THREE.CylinderGeometry(shaftR, shaftR, shaftLength, 8)
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.1, depthTest: true, depthWrite: true })
    const shaft = new THREE.Mesh(shaftGeo, mat)
    shaft.position.y = shaftLength / 2
    group.add(shaft)

    const coneGeo = new THREE.ConeGeometry(headR, headLength, 8)
    const cone = new THREE.Mesh(coneGeo, mat)
    cone.position.y = shaftLength + headLength / 2
    group.add(cone)

    const quat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0), dir
    )
    group.setRotationFromQuaternion(quat)
    group.position.copy(origin)

    return group
  }

  function toggleWorldAxes(v) {
    showWorldAxes.value = v
    if (v) _createWorldAxes()
    else   _destroyWorldAxes()
  }

  function _createWorldAxes() {
    _destroyWorldAxes()
    if (!sceneRef.value) return
    AXIS_ARROWS.forEach(({ axis, color }) => {
      const arrow = _createArrow(axis, color)
      sceneRef.value.add(arrow)
      _worldAxesGroup.push(arrow)
    })
  }

  function _destroyWorldAxes() {
    _worldAxesGroup.forEach((g) => {
      sceneRef.value?.remove(g)
      g.traverse((child) => {
        if (child.geometry) child.geometry.dispose()
        if (child.material) child.material.dispose()
      })
    })
    _worldAxesGroup.length = 0
  }

  // ═════════════════════════════════════════════════════════════════
  // 需求 1 — 骨骼可视化
  // ═════════════════════════════════════════════════════════════════
  const showBoneAxes    = ref(false)
  const showBoneLabels  = ref(false)
  const showBoneJoints  = ref(false)

  const _boneAxes   = []
  const _boneSpheres = []
  const _boneLabelEls = []

  function toggleBoneAxes(v) {
    showBoneAxes.value = v
    if (v) _createBoneVisuals()
    else   _destroyBoneVisuals()
  }

  function toggleBoneLabels(v) {
    showBoneLabels.value = v
    _syncBoneLabels()
  }

  function toggleBoneJoints(v) {
    showBoneJoints.value = v
    if (v) _createBoneJoints()
    else   _destroyBoneJoints()
  }

  function _createBoneVisuals() {
    _destroyBoneVisuals()
    const bonesMap = armCtrl.bones?.value
    const configs  = armCtrl.boneConfigs
    if (!bonesMap || !configs) return
    Object.keys(configs.BONE_AXIS).forEach((key) => {
      const bone = bonesMap[key]
      if (!bone) return
      const helper = new THREE.AxesHelper(0.15)
      bone.add(helper)
      _boneAxes.push({ bone, helper })
    })
  }

  function _destroyBoneVisuals() {
    _boneAxes.forEach(({ bone, helper }) => {
      bone.remove(helper)
      helper.dispose?.()
    })
    _boneAxes.length = 0
  }

  function _createBoneJoints() {
    _destroyBoneJoints()
    const bonesMap = armCtrl.bones?.value
    const configs  = armCtrl.boneConfigs
    if (!bonesMap || !configs) return
    const geo = new THREE.SphereGeometry(0.03, 8, 8)
    const mat = new THREE.MeshBasicMaterial({ color: 0xEF9F27 })
    Object.keys(configs.BONE_AXIS).forEach((key) => {
      const bone = bonesMap[key]
      if (!bone) return
      const sphere = new THREE.Mesh(geo, mat)
      bone.add(sphere)
      _boneSpheres.push({ bone, sphere })
    })
  }

  function _destroyBoneJoints() {
    _boneSpheres.forEach(({ bone, sphere }) => {
      bone.remove(sphere)
      sphere.geometry.dispose()
    })
    _boneSpheres.length = 0
  }

  function _syncBoneLabels() {
    // 标签通过 CSS 2D 覆层实现，由 DebugPanel.vue 渲染
    // 本函数留空，标签数据由 getBoneLabelData() 提供
  }

  function getBoneLabelData() {
    const bonesMap = armCtrl.bones?.value
    const configs  = armCtrl.boneConfigs
    if (!bonesMap || !configs || !_cameraForLabel) return []
    const data = []
    Object.keys(configs.BONE_AXIS).forEach((key) => {
      const bone = bonesMap[key]
      if (!bone) return
      const worldPos = new THREE.Vector3()
      bone.getWorldPosition(worldPos)
      const pos = worldPos.clone().project(_cameraForLabel)
      data.push({
        key,
        name: configs.BONE_NAMES[key],
        screenX: (pos.x * 0.5 + 0.5) * window.innerWidth,
        screenY: (-pos.y * 0.5 + 0.5) * window.innerHeight,
      })
    })
    return data
  }

  let _cameraForLabel = null
  function setCameraForLabel(cam) { _cameraForLabel = cam }

  // ═════════════════════════════════════════════════════════════════
  // 需求 1.5 — 棍状骨骼模式（隐藏网格体，仅显示骨骼链为彩色线条）
  // ═════════════════════════════════════════════════════════════════
  const showSkeletonOnly = ref(false)
  const _stickLines = []
  const _stickSpheres = []
  const _hiddenMeshes = []
  let _stickRafId = null

  const BONE_CHAIN = ['j0','j1','j2','j3','j4','j5','j6']
  const STICK_COLORS = {
    j0: 0xFFFFFF, j1: 0xFFB3B3, j2: 0xB3FFB3,
    j3: 0xB3B3FF, j4: 0xFFE0B3, j5: 0xD9B3FF, j6: 0xB3FFE0,
  }

  function toggleSkeletonOnly(v) {
    showSkeletonOnly.value = v
    if (v) _enterSkeletonMode()
    else   _exitSkeletonMode()
  }

  function _enterSkeletonMode() {
    _exitSkeletonMode()
    const model = armCtrl.armModel?.value
    if (!model || !sceneRef.value) return

    model.traverse((obj) => {
      if (obj.isMesh && !obj.userData._isStickPart) {
        obj.visible = false
        _hiddenMeshes.push(obj)
      }
    })

    _createStickBones()
  }

  function _exitSkeletonMode() {
    cancelAnimationFrame(_stickRafId)
    _stickRafId = null

    _hiddenMeshes.forEach((m) => { m.visible = true })
    _hiddenMeshes.length = 0

    _stickSpheres.forEach((s) => {
      sceneRef.value?.remove(s)
      s.geometry.dispose()
      s.material.dispose()
    })
    _stickSpheres.length = 0

    _stickLines.forEach((l) => {
      sceneRef.value?.remove(l)
      l.geometry.dispose()
      l.material.dispose()
    })
    _stickLines.length = 0
  }

  function _createStickBones() {
    const bonesMap = armCtrl.bones?.value
    if (!bonesMap) return

    const sphereGeo = new THREE.SphereGeometry(0.02, 8, 8)

    BONE_CHAIN.forEach((key) => {
      const bone = bonesMap[key]
      if (!bone) return

      const color = STICK_COLORS[key] || 0xcccccc
      const spMat = new THREE.MeshBasicMaterial({ color, depthTest: true, depthWrite: true })
      const sphere = new THREE.Mesh(sphereGeo, spMat)
      sphere.userData._isStickPart = true
      sceneRef.value.add(sphere)
      _stickSpheres.push(sphere)

      const nextKey = BONE_CHAIN[BONE_CHAIN.indexOf(key) + 1]
      if (!nextKey) return
      const nextBone = bonesMap[nextKey]
      if (!nextBone) return

      const lineGeo = new THREE.BufferGeometry()
      const positions = new Float32Array(6)
      lineGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      const lineMat = new THREE.LineBasicMaterial({ color, linewidth: 1, depthTest: true, depthWrite: true })
      const line = new THREE.Line(lineGeo, lineMat)
      line.userData._isStickPart = true
      sceneRef.value.add(line)
      _stickLines.push(line)
    })

    _animateStickBones()
  }

  function _animateStickBones() {
    _stickRafId = requestAnimationFrame(_animateStickBones)
    const bonesMap = armCtrl.bones?.value
    if (!bonesMap) return
    const pos = new THREE.Vector3()
    const groundPos = new THREE.Vector3()
    let sphereIdx = 0

    BONE_CHAIN.forEach((key) => {
      const bone = bonesMap[key]
      if (!bone) return
      bone.getWorldPosition(pos)

      if (sphereIdx < _stickSpheres.length) {
        _stickSpheres[sphereIdx].position.copy(pos)
        sphereIdx++
      }

      const nextKey = BONE_CHAIN[BONE_CHAIN.indexOf(key) + 1]
      if (!nextKey) return
      const nextBone = bonesMap[nextKey]
      if (!nextBone) return
      nextBone.getWorldPosition(groundPos)

      const lineIdx = BONE_CHAIN.indexOf(key)
      if (lineIdx < _stickLines.length) {
        const positions = _stickLines[lineIdx].geometry.attributes.position.array
        positions[0] = pos.x; positions[1] = pos.y; positions[2] = pos.z
        positions[3] = groundPos.x; positions[4] = groundPos.y; positions[5] = groundPos.z
        _stickLines[lineIdx].geometry.attributes.position.needsUpdate = true
      }
    })
  }

  // ═════════════════════════════════════════════════════════════════
  // 需求 2 — 关节角度输入表单
  // ═════════════════════════════════════════════════════════════════
  const jointForm = reactive({
    j0:  0, j0x: 0, j0y: 0, j0z: 0,
    j1:  0, j2: 0, j3: 0, j4: 0, j5: 0, j6: 0,
  })

  const JOINT_KEYS = ['j0','j1','j2','j3','j4','j5','j6']
  const RAD_PER_10DEG = 10 * Math.PI / 180

  function applyJointForm() {
    armCtrl.updatePose({ ...jointForm })
  }

  function addJointAngle(joint, deg) {
    const rad = deg * Math.PI / 180
    jointForm[joint] += rad
    applyJointForm()
  }

  function resetJointForm() {
    JOINT_KEYS.forEach(k => { jointForm[k] = 0 })
    jointForm.j0x = 0
    jointForm.j0y = 0
    jointForm.j0z = 0
    applyJointForm()
  }

  // ═════════════════════════════════════════════════════════════════
  // 需求 3 — 调试孔洞圆柱体（通过 tubeManager 统一管理）
  // ═════════════════════════════════════════════════════════════════
  const debugHoles    = shallowRef([])
  const _debugHoleIds = []
  let _debugCounter   = 0

  const holeForm    = reactive({
    offsetX: 0, offsetY: -0.129, offsetZ: 0,
    height: 0.05, diameter: 0.3,
    status: 'pending',
    colorHex: '#888780',
  })

  const STATUS_COLOR_MAP = {
    ok:      '#1D9E75',
    ng:      '#D85A30',
    active:  '#EF9F27',
    pending: '#888780',
  }

  function syncColorFromStatus() {
    if (STATUS_COLOR_MAP[holeForm.status]) {
      holeForm.colorHex = STATUS_COLOR_MAP[holeForm.status]
    }
  }

  function addDebugHole() {
    const j6 = armCtrl.j6Cartesian?.value
    if (!j6 || !tubeManager) return
    const id = `debug_${Date.now()}_${_debugCounter++}`
    tubeManager.appendHoles([{
      id,
      x: j6.x + holeForm.offsetX,
      y: j6.y + holeForm.offsetY,
      z: j6.z + holeForm.offsetZ,
      status: holeForm.status,
      _custom: true,
      _radius: Math.max(holeForm.diameter / 2, 0.001),
      _height: holeForm.height || 0.01,
      _color: holeForm.colorHex,
    }])
    _debugHoleIds.push(id)
    debugHoles.value = [..._debugHoleIds]
  }

  function removeLastHole() {
    if (_debugHoleIds.length === 0) return
    const id = _debugHoleIds.pop()
    tubeManager.removeHoles([id])
    debugHoles.value = [..._debugHoleIds]
  }

  function clearAllHoles() {
    if (_debugHoleIds.length === 0) return
    tubeManager.removeHoles(_debugHoleIds)
    _debugHoleIds.length = 0
    debugHoles.value = []
  }

  // ═════════════════════════════════════════════════════════════════
  // 生命周期清理（组件卸载时调用）
  // ═════════════════════════════════════════════════════════════════
  function dispose() {
    _exitSkeletonMode()
    _destroyWorldAxes()
    _destroyBoneVisuals()
    _destroyBoneJoints()
    clearAllHoles()
  }

  return {
    enabled,
    // 世界可视化
    showWorldAxes,
    toggleWorldAxes,
    // 骨骼可视化
    showBoneAxes, showBoneLabels, showBoneJoints, showSkeletonOnly,
    toggleBoneAxes, toggleBoneLabels, toggleBoneJoints, toggleSkeletonOnly,
    getBoneLabelData, setCameraForLabel,
    // 关节控制
    jointForm, JOINT_KEYS, RAD_PER_10DEG,
    applyJointForm, addJointAngle, resetJointForm,
    // J6 笛卡尔坐标
    j6Cartesian: armCtrl.j6Cartesian,
    // 孔洞调试
    debugHoles, holeForm,
    syncColorFromStatus,
    addDebugHole, removeLastHole, clearAllHoles,
    // 生命周期
    dispose,
  }
}
