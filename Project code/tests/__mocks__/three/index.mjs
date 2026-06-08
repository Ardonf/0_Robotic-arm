/**
 * Minimal mock of THREE.js — 仅模拟 useArmController / useTubeManager 使用的 API
 */

export const DynamicDrawUsage = 35048

export const Color = class {
  constructor(hex) { this._hex = hex; this.r = 1; this.g = 1; this.b = 1 }
  getHex() { return this._hex }
}

export class Vector2 { constructor(x, y) { this.x = x || 0; this.y = y || 0 } }

export class Vector3 {
  constructor(x, y, z) { this.x = x || 0; this.y = y || 0; this.z = z || 0 }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this }
  copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this }
  clone() { return new Vector3(this.x, this.y, this.z) }
}

export class Quaternion {
  constructor() { this._x = 0; this._y = 0; this._z = 0; this._w = 1 }
}

export class Euler {
  constructor(x, y, z) {
    this.x = x || 0; this.y = y || 0; this.z = z || 0
  }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this }
  setFromQuaternion(q) {
    this.x = q._x || 0; this.y = q._y || 0; this.z = q._z || 0
    return this
  }
}

export class Object3D {
  constructor() {
    this.position = new Vector3()
    this.rotation = {}
    this.matrix = { elements: new Float32Array(16) }
    this.userData = {}
    this.parent = null
    this.children = []
  }
  add(child) { child.parent = this; this.children.push(child); return this }
  remove(child) {
    const idx = this.children.indexOf(child)
    if (idx >= 0) { this.children.splice(idx, 1); child.parent = null }
    return this
  }
  updateMatrix() {}
  traverse(fn) { fn(this); this.children.forEach(c => c.traverse(fn)) }
}

export class Bone extends Object3D {
  constructor() { super(); this.isBone = true }
  getWorldPosition(v) { v.copy(this.position); return v }
  getWorldQuaternion(q) { return q }
}

export class Mesh extends Object3D {
  constructor(geo, mat) {
    super()
    this.geometry = geo
    this.material = mat
    this.isMesh = true
  }
}

export class InstancedMesh extends Mesh {
  constructor(geo, mat, count) {
    super(geo, mat)
    this.isInstancedMesh = true
    this.count = count
    this.instanceMatrix = {
      needsUpdate: false,
      setUsage() {},
    }
    this.instanceColor = null
    this._matrices = []
    this._colors = []
  }
  setMatrixAt(i, matrix) { this._matrices[i] = matrix }
  setColorAt(i, color) { this._colors[i] = color }
}

export class InstancedBufferAttribute {
  constructor(arr, size) { this.array = arr; this.itemSize = size; this.needsUpdate = false }
}

export class SphereGeometry {
  constructor(r) { this.radius = r || 1; this.type = 'SphereGeometry' }
  dispose() {}
}

export class CylinderGeometry {
  constructor(rt, rb, h, seg) {
    this.radiusTop = rt; this.radiusBottom = rb; this.height = h; this.segments = seg
    this.type = 'CylinderGeometry'
  }
  dispose() {}
}

export class BufferGeometry {
  constructor() { this.type = 'BufferGeometry' }
  dispose() {}
}

export class MeshStandardMaterial {
  constructor(opts) {
    this.color = null
    this.vertexColors = false
    Object.assign(this, opts)
  }
  dispose() {}
  clone() { return new MeshStandardMaterial({ ...this }) }
}

export class MeshBasicMaterial {
  constructor(opts) { Object.assign(this, opts) }
  dispose() {}
}

export class AxesHelper extends Object3D {
  constructor(size) { super(); this._size = size }
  dispose() {}
}

export const MathUtils = {
  lerp(a, b, t) { return a + (b - a) * t },
}

export class Scene extends Object3D {
  constructor() { super(); this.isScene = true }
}
