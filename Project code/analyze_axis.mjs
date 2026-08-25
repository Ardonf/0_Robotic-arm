import fs from 'fs'
import * as THREE from 'three'

const file = 'g:\\0_Robotic arm\\Project code\\public\\models\\robot_arm.glb'
const buf = fs.readFileSync(file)

// ── 解析 GLB JSON ────────────────────────────────────────────
let json = null
let offset = 12
while (offset < buf.length) {
  const chunkLen = buf.readUInt32LE(offset)
  const chunkType = buf.readUInt32LE(offset + 4)
  if (chunkType === 0x4e4f534a) json = JSON.parse(buf.subarray(offset + 8, offset + 8 + chunkLen).toString('utf8'))
  offset += 8 + chunkLen
}
const nodes = json.nodes

// ── 按 GLTFLoader 同等方式重建节点层级 ───────────────────────
const objs = nodes.map((n, i) => {
  const o = new THREE.Object3D()
  o.name = n.name || `node#${i}`
  if (n.translation) o.position.fromArray(n.translation)
  if (n.rotation) o.quaternion.fromArray(n.rotation)
  if (n.scale) o.scale.fromArray(n.scale)
  return o
})
nodes.forEach((n, i) => (n.children || []).forEach((c) => objs[i].add(objs[c])))
objs[17].updateMatrixWorld(true) // Armature 为根

// ── 模拟前端行为：baked 旋转 + 只驱动某一 Euler 轴 ────────────
// 返回：驱动 obj 的 euler[axis] 从 0→+5° 时，world 空间中实际旋转轴方向（单位向量）
function simulateAxis(obj, axis) {
  // 1. 保留 baked 的其余两轴，将被驱动轴置 0（前端静止时即此状态）
  const euler = new THREE.Euler().setFromQuaternion(obj.quaternion.clone(), 'XYZ')
  const target = 5 * Math.PI / 180
  euler[axis] = 0
  obj.quaternion.setFromEuler(euler)
  obj.updateMatrixWorld(true)
  const m0 = new THREE.Matrix4().copy(obj.matrixWorld)

  euler[axis] = target
  obj.quaternion.setFromEuler(euler)
  obj.updateMatrixWorld(true)
  const m1 = new THREE.Matrix4().copy(obj.matrixWorld)

  // 2. 子级运动增量旋转 = R1 * R0⁻¹，取其轴
  const r0 = new THREE.Matrix4().extractRotation(m0)
  const r1 = new THREE.Matrix4().extractRotation(m1)
  const delta = r1.multiply(r0.invert())
  const q = new THREE.Quaternion().setFromRotationMatrix(delta)
  const axisVec = new THREE.Vector3(q.x, q.y, q.z).normalize()
  const angle = 2 * Math.atan2(axisVec.length(), q.w) * 180 / Math.PI
  return { axis: axisVec.toArray().map((v) => +v.toFixed(3)), angle: +angle.toFixed(1) }
}

// 骨链顺序（按 glTF 的 j0..j6 配置）
const chain = [
  ['j0', 'CS620-Base'],
  ['j1', 'CS620-J1'],
  ['j2', 'CS620-J2_Link1_J3'],
  ['j3', 'CS620-Link2A_Link2B_J4'],
  ['j4', 'CS620-J5'],
  ['j5', 'CS620-J6'],
  ['j6', 'CS620-Flange'],
]

console.log('关节  骨骼名                    BONE_AXIS  驱动rotation.y时实际world旋转轴     驱动rotation.x时实际world旋转轴')
for (const [key, boneName] of chain) {
  const i = nodes.findIndex((n) => n.name === boneName)
  if (i < 0) { console.log(`${key}    ${boneName.padEnd(24)}  ⚠ 未找到`); continue }
  const o = objs[i]
  const rY = simulateAxis(o, 'y')
  const rX = simulateAxis(o, 'x')
  console.log(
    key.padEnd(4) + '  ' +
    boneName.padEnd(24) + '  ' +
    'y'.padEnd(10) + '  ' +
    `(${rY.axis.join(', ')})  +${rY.angle}°`.padEnd(36) +
    `(${rX.axis.join(', ')})  +${rX.angle}°`
  )
}

// j3 详情
const j3i = nodes.findIndex((n) => n.name === 'CS620-Link2A_Link2B_J4')
const j3 = objs[j3i]
const wp = new THREE.Vector3().setFromMatrixPosition(j3.matrixWorld)
console.log(`\nj3(${nodes[j3i].name}) world 位置: (${wp.toArray().map((v) => +v.toFixed(3)).join(', ')})`)
console.log(`j3 baked quaternion: (${nodes[j3i].rotation.join(', ')})`)
console.log(`j3 baked Euler(XYZ): (${new THREE.Euler().setFromQuaternion(j3.quaternion, 'XYZ').toArray().map((v) => +(v * 180 / Math.PI).toFixed(1)).join(', ')})°`)
