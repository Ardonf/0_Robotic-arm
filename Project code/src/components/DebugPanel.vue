<template>
  <div v-if="debug.enabled.value" class="debug-root">

    <!-- ━━━━━━━━━━ 骨骼标签 2D 覆层 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->
    <div
      v-for="label in boneLabels"
      :key="label.key"
      class="bone-label"
      :style="{ left: label.screenX + 'px', top: label.screenY + 'px' }"
    >{{ label.name }}</div>

    <!-- ━━━━━━━━━━ 面板主体 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->
    <Transition name="slide">
      <div v-if="open" class="debug-panel">

        <div class="panel-header">
          <span class="panel-title">调试面板</span>
          <button class="panel-close" @click="debug.enabled.value = false">✕</button>
        </div>

        <div class="panel-body">

          <!-- ══════════════════ 世界可视化 ═══════════════════ -->
          <fieldset class="panel-section">
            <legend>世界可视化</legend>
            <div class="checkbox-row">
              <label><input type="checkbox" @change="debug.toggleWorldAxes($event.target.checked)"> 显示世界坐标轴</label>
            </div>
            <div class="axis-legend">
              <span class="axis-dot axis-x">+X</span>
              <span class="axis-dot axis-y">+Y</span>
              <span class="axis-dot axis-z">+Z</span>
              <span class="axis-note">原点处箭头 · 长度 1.2m</span>
            </div>
          </fieldset>

          <!-- ══════════════════ 骨骼可视化 ═══════════════════ -->
          <fieldset class="panel-section">
            <legend>骨骼可视化</legend>
            <div class="checkbox-row">
              <label><input type="checkbox" @change="debug.toggleBoneAxes($event.target.checked)"> 显示骨骼轴向</label>
              <label><input type="checkbox" @change="debug.toggleBoneLabels($event.target.checked)"> 显示标签</label>
              <label><input type="checkbox" @change="debug.toggleBoneJoints($event.target.checked)"> 关节点</label>
            </div>
            <div class="checkbox-row" style="margin-top:4px">
              <label><input type="checkbox" @change="debug.toggleSkeletonOnly($event.target.checked)"> 棍状骨骼（隐藏网格体）</label>
            </div>
            <div class="bone-info" v-if="boneConfigs">
              <div class="bone-info-row" v-for="key in debug.JOINT_KEYS" :key="key">
                <code class="bone-key">{{ key }}</code>
                <span class="bone-name">{{ boneConfigs.BONE_NAMES[key] }}</span>
                <span class="bone-axis">轴:{{ boneConfigs.BONE_AXIS[key]?.axis?.toUpperCase() }}</span>
              </div>
            </div>
          </fieldset>

          <!-- ══════════════════ 关节控制 ═══════════════════ -->
          <fieldset class="panel-section">
            <legend>关节控制 (弧度)</legend>

            <!-- j0 特殊行（含 XYZ 位移） -->
            <div class="joint-row j0-row">
              <span class="joint-label">j0</span>
              <button class="btn-deg" @click="debug.addJointAngle('j0', -10)">−10°</button>
              <input class="joint-input" type="number" step="0.01" v-model.number="debug.jointForm.j0" @change="debug.applyJointForm()">
              <button class="btn-deg" @click="debug.addJointAngle('j0', 10)">+10°</button>
              <span class="j0-pos">
                X<input class="j0-pos-input" type="number" step="0.01" v-model.number="debug.jointForm.j0x" @change="debug.applyJointForm()">
                Y<input class="j0-pos-input" type="number" step="0.01" v-model.number="debug.jointForm.j0y" @change="debug.applyJointForm()">
                Z<input class="j0-pos-input" type="number" step="0.01" v-model.number="debug.jointForm.j0z" @change="debug.applyJointForm()">
              </span>
            </div>

            <div class="joint-row" v-for="key in debug.JOINT_KEYS.filter(k => k !== 'j0')" :key="key">
              <span class="joint-label">{{ key }}</span>
              <button class="btn-deg" @click="debug.addJointAngle(key, -10)">−10°</button>
              <input class="joint-input" type="number" step="0.01" v-model.number="debug.jointForm[key]" @change="debug.applyJointForm()">
              <button class="btn-deg" @click="debug.addJointAngle(key, 10)">+10°</button>
            </div>

            <div class="joint-actions">
              <button class="btn-sm" @click="debug.applyJointForm()">应用</button>
              <button class="btn-sm btn-reset" @click="debug.resetJointForm()">重置</button>
            </div>
          </fieldset>

          <!-- ══════════════════ J6 笛卡尔坐标 ═══════════════════ -->
          <fieldset class="panel-section">
            <legend>J6 末端笛卡尔坐标</legend>
            <div class="cartesian-grid">
              <div class="cart-item"><span class="cart-label">X</span><span class="cart-val">{{ fmt(j6.x) }}</span></div>
              <div class="cart-item"><span class="cart-label">Y</span><span class="cart-val">{{ fmt(j6.y) }}</span></div>
              <div class="cart-item"><span class="cart-label">Z</span><span class="cart-val">{{ fmt(j6.z) }}</span></div>
              <div class="cart-item"><span class="cart-label">Rx</span><span class="cart-val">{{ fmtDeg(j6.rx) }}</span></div>
              <div class="cart-item"><span class="cart-label">Ry</span><span class="cart-val">{{ fmtDeg(j6.ry) }}</span></div>
              <div class="cart-item"><span class="cart-label">Rz</span><span class="cart-val">{{ fmtDeg(j6.rz) }}</span></div>
            </div>
            <div class="cart-note">
              位置：模型坐标系 | 旋转：弧度 / 角度
            </div>
          </fieldset>

          <!-- ══════════════════ 孔洞调试 ═══════════════════ -->
          <fieldset class="panel-section">
            <legend>孔洞调试</legend>
            <div class="hole-form">
              <div class="hole-form-row">
                <label>偏移X<input type="number" step="0.01" v-model.number="debug.holeForm.offsetX"></label>
                <label>偏移Y<input type="number" step="0.01" v-model.number="debug.holeForm.offsetY"></label>
                <label>偏移Z<input type="number" step="0.01" v-model.number="debug.holeForm.offsetZ"></label>
              </div>
              <div class="hole-form-row">
                <label>高度<input type="number" step="0.001" v-model.number="debug.holeForm.height"></label>
                <label>直径<input type="number" step="0.001" v-model.number="debug.holeForm.diameter"></label>
              </div>
              <div class="hole-form-row">
                <label>状态
                  <select v-model="debug.holeForm.status" @change="debug.syncColorFromStatus()">
                    <option value="ok">合格(绿)</option>
                    <option value="ng">异常(红)</option>
                    <option value="active">检测中(黄)</option>
                    <option value="pending">未检测(灰)</option>
                  </select>
                </label>
                <label>颜色<input type="color" v-model="debug.holeForm.colorHex">
                  <code class="hex-display">{{ debug.holeForm.colorHex }}</code>
                </label>
              </div>
              <div class="hole-actions">
                <button class="btn-sm btn-add" @click="debug.addDebugHole()">添加孔洞</button>
                <button class="btn-sm" @click="debug.removeLastHole()" :disabled="!debug.debugHoles.value.length">撤回</button>
                <button class="btn-sm btn-clear" @click="debug.clearAllHoles()" :disabled="!debug.debugHoles.value.length">清除 ({{ debug.debugHoles.value.length }})</button>
              </div>
            </div>
          </fieldset>

        </div>
      </div>
    </Transition>

    <!-- ━━━━━━━━━━ 折叠切换条 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->
    <div class="debug-toggle" @click="open = !open">
      {{ open ? '▼ 调试面板' : '▶ 调试面板' }}
      <span class="toggle-hint">（上线前隐藏此面板：<code>debug.enabled = false</code>）</span>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

// ─── Props ──────────────────────────────────────────────────────────
// debug: useDebugManager() 返回的完整对象
// boneConfigs: armCtrl.boneConfigs（骨骼名称/轴向配置常量）
// j6Cartesian: armCtrl.j6Cartesian（每帧更新的 J6 笛卡尔坐标 ref）
const props = defineProps({
  debug:      { type: Object, required: true },
  boneConfigs: { type: Object, default: null },
})

// ─── 面板折叠 ────────────────────────────────────────────────────────
const open = ref(true)

// ─── J6 坐标读取 ─────────────────────────────────────────────────────
const j6 = computed(() => {
  const c = props.debug?.j6Cartesian?.value
  return c || { x:0, y:0, z:0, rx:0, ry:0, rz:0 }
})

function fmt(v)  { return typeof v === 'number' ? v.toFixed(4) : '—' }
function fmtDeg(v) {
  if (typeof v !== 'number') return '—'
  return (v * 180 / Math.PI).toFixed(2) + '°'
}

// ─── 骨骼标签 2D 覆层更新循环 ────────────────────────────────────────
const boneLabels = ref([])
let _rAF = null

function tick() {
  _rAF = requestAnimationFrame(tick)
  updateLabels()
}

function updateLabels() {
  if (!props.debug.showBoneLabels.value) {
    if (boneLabels.value.length) boneLabels.value = []
    return
  }
  const data = props.debug.getBoneLabelData()
  boneLabels.value = data
}

onMounted(() => {
  _rAF = requestAnimationFrame(tick)
})

onUnmounted(() => {
  cancelAnimationFrame(_rAF)
})
</script>

<style scoped>
.debug-root {
  position: fixed;
  z-index: 200;
  bottom: 0;
  left: 0;
  pointer-events: all;
}

/* ── 骨骼标签 2D 覆层 ────────────────────────────────────────────── */
.bone-label {
  position: fixed;
  transform: translate(-50%, -140%);
  font-size: 10px;
  color: #EF9F27;
  background: rgba(0,0,0,0.7);
  padding: 1px 5px;
  border-radius: 3px;
  pointer-events: none;
  z-index: 210;
  white-space: nowrap;
  font-family: 'Consolas', monospace;
}

/* ── 面板主体 ────────────────────────────────────────────────────── */
.debug-panel {
  width: 400px;
  max-height: 72vh;
  background: rgba(13,15,20,0.96);
  border: 0.5px solid #2a2d35;
  border-radius: 8px;
  margin: 0 12px 40px 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  backdrop-filter: blur(10px);
  font-family: 'Consolas', 'Source Code Pro', monospace;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 0.5px solid #2a2d35;
  background: rgba(255,255,255,0.03);
  flex-shrink: 0;
}
.panel-title { font-size: 13px; color: #ccc; font-weight: 500; }
.panel-close {
  background: none;
  border: none;
  color: #555;
  font-size: 14px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}
.panel-close:hover { color: #D85A30; }

.panel-body {
  padding: 10px 12px;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* ── 区块 ────────────────────────────────────────────────────────── */
.panel-section {
  border: 0.5px solid #222;
  border-radius: 6px;
  padding: 8px 10px;
  flex-shrink: 0;
}
.panel-section legend {
  font-size: 11px;
  color: #888;
  padding: 0 6px;
}

/* ── 世界可视化 ──────────────────────────────────────────────────── */
.axis-legend {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 6px;
}
.axis-dot {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 3px;
  font-family: 'Consolas', monospace;
}
.axis-x { color: #FF3B3B; }
.axis-y { color: #5BFF5B; }
.axis-z { color: #3B7BFF; }
.axis-note { font-size: 9px; color: #444; }

/* ── 骨骼可视化 ──────────────────────────────────────────────────── */
.checkbox-row {
  display: flex;
  gap: 14px;
  font-size: 11px;
  color: #999;
}
.checkbox-row label {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}
.checkbox-row input[type="checkbox"] { accent-color: #1D9E75; }
.bone-info { margin-top: 6px; }
.bone-info-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  padding: 2px 0;
  border-bottom: 0.5px solid #1a1d24;
}
.bone-key { color: #EF9F27; font-weight: 500; min-width: 22px; }
.bone-name { color: #aaa; flex: 1; overflow: hidden; text-overflow: ellipsis; }
.bone-axis { color: #555; font-size: 10px; }

/* ── 关节行 ──────────────────────────────────────────────────────── */
.joint-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 0;
}
.j0-row { flex-wrap: wrap; }
.joint-label { font-size: 11px; color: #EF9F27; font-weight: 500; min-width: 22px; }
.joint-input {
  width: 70px;
  background: #111;
  border: 0.5px solid #333;
  border-radius: 4px;
  color: #ccc;
  font-size: 12px;
  padding: 3px 6px;
  text-align: center;
  font-family: 'Consolas', monospace;
}
.joint-input:focus { outline: none; border-color: #1D9E75; }
.btn-deg {
  font-size: 10px;
  padding: 2px 5px;
  background: rgba(255,255,255,0.06);
  border: 0.5px solid #333;
  border-radius: 3px;
  color: #888;
  cursor: pointer;
}
.btn-deg:hover { background: rgba(255,255,255,0.12); color: #ccc; }

.j0-pos {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  color: #555;
  margin-left: 2px;
}
.j0-pos-input {
  width: 52px;
  background: #111;
  border: 0.5px solid #333;
  border-radius: 4px;
  color: #aaa;
  font-size: 10px;
  padding: 2px 4px;
  text-align: center;
  font-family: 'Consolas', monospace;
}
.j0-pos-input:focus { outline: none; border-color: #1D9E75; }

.joint-actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}
.btn-sm {
  font-size: 11px;
  padding: 4px 12px;
  background: rgba(255,255,255,0.06);
  border: 0.5px solid #333;
  border-radius: 4px;
  color: #999;
  cursor: pointer;
}
.btn-sm:hover { background: rgba(255,255,255,0.12); color: #ccc; }
.btn-reset { color: #D85A30; border-color: #3a1a1a; }
.btn-reset:hover { background: rgba(216,90,48,0.15); }
.btn-add { color: #1D9E75; border-color: #1a3a2a; }
.btn-add:hover { background: rgba(29,158,117,0.15); }
.btn-clear { color: #D85A30; border-color: #3a1a1a; }
.btn-sm:disabled { opacity: 0.35; cursor: default; }

/* ── J6 笛卡尔坐标 ──────────────────────────────────────────────── */
.cartesian-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 4px;
}
.cart-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 3px 6px;
  background: rgba(255,255,255,0.03);
  border-radius: 3px;
}
.cart-label { font-size: 11px; color: #555; }
.cart-val { font-size: 12px; color: #ccc; font-family: 'Consolas', monospace; }
.cart-note { font-size: 9px; color: #444; margin-top: 4px; }

/* ── 孔洞表单 ────────────────────────────────────────────────────── */
.hole-form { display: flex; flex-direction: column; gap: 6px; }
.hole-form-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.hole-form-row label {
  font-size: 10px;
  color: #777;
  display: flex;
  align-items: center;
  gap: 4px;
}
.hole-form-row input[type="number"],
.hole-form-row select {
  width: 66px;
  background: #111;
  border: 0.5px solid #333;
  border-radius: 4px;
  color: #ccc;
  font-size: 11px;
  padding: 3px 5px;
  font-family: 'Consolas', monospace;
}
.hole-form-row input[type="color"] {
  width: 36px;
  height: 22px;
  border: 0.5px solid #333;
  border-radius: 3px;
  background: none;
  cursor: pointer;
  padding: 0;
}
.hex-display { font-size: 10px; color: #aaa; margin-left: 2px; }
.hole-actions { display: flex; gap: 8px; margin-top: 4px; }

/* ── 折叠切换条 ──────────────────────────────────────────────────── */
.debug-toggle {
  padding: 5px 14px;
  font-size: 11px;
  color: #555;
  cursor: pointer;
  background: rgba(13,15,20,0.8);
  border: 0.5px solid #2a2d35;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin: 4px 12px;
  user-select: none;
}
.debug-toggle:hover { color: #aaa; }
.toggle-hint { font-size: 9px; color: #333; }
.toggle-hint code { color: #555; }

/* ── 过渡动画 ────────────────────────────────────────────────────── */
.slide-enter-active { transition: all 0.2s ease-out; }
.slide-leave-active { transition: all 0.15s ease-in; }
.slide-enter-from, .slide-leave-to { opacity: 0; transform: translateY(12px); }
</style>
