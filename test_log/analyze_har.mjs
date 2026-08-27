import fs from 'node:fs'

const rows = JSON.parse(fs.readFileSync('g:/0_Robotic arm/test_log/body.txt', 'utf8'))
console.log('样本数:', rows.length)
const ms0 = rows[0].t, ms1 = rows[rows.length - 1].t
console.log(`时间跨度: ${((ms1 - ms0) / 1000).toFixed(1)}s | 平均间隔: ${((ms1 - ms0) / (rows.length - 1) * 1000).toFixed(1)}ms`)

const KEYS = ['j0', 'j1', 'j2', 'j3', 'j4', 'j5', 'j6']

console.log('\n── 各关节取值范围（判断数据单位：若为弧度应≤2π≈6.28，若为角度可达±360）──')
for (const k of KEYS) {
  const vals = rows.map((r) => r[k]).filter((v) => Number.isFinite(v))
  const min = Math.min(...vals), max = Math.max(...vals)
  console.log(`${k}: min=${min.toFixed(3)}  max=${max.toFixed(3)}  跨度=${(max - min).toFixed(3)}`)
}

console.log('\n── 相邻采样最大跳变 / 最大角速度（数据本身动得快不快）──')
for (const k of KEYS) {
  let maxD = 0, maxV = 0, maxDIdx = 0
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1][k], b = rows[i][k]
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue
    const dt = (rows[i].t - rows[i - 1].t) / 1000
    if (dt <= 0) continue
    const d = Math.abs(b - a), v = d / dt
    if (d > maxD) { maxD = d; maxDIdx = i; maxV = v }
  }
  console.log(`${k}: 最大跳变=${maxD.toFixed(3)}  → 最大角速度=${maxV.toFixed(2)}°/s (= ${(maxV * Math.PI / 180).toFixed(3)} rad/s) @第${maxDIdx}条`)
}

// 抽样：前 3 条与后 3 条，确认数据基本静止
console.log('\n── 首尾抽样 ──')
for (const idx of [0, 1, rows.length - 2, rows.length - 1]) {
  const r = rows[idx]
  console.log(KEYS.map((k) => `${k}=${r[k].toFixed(2)}`).join(' '))
}
