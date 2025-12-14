import './style.css'
import { generateShape, type ViewDir } from './blockGenerator'
import { ThreeBlockRenderer } from './threeRenderer'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('Missing #app')

app.innerHTML = `
  <div class="layout">
    <header class="header">
      <div class="title">ブロック数あてゲーム</div>
      <div class="sub">不正解なら別角度で最大3回まで</div>
    </header>

    <main class="main">
      <section class="stage">
        <div class="canvasWrap" id="canvasWrap"></div>
      </section>

      <section class="panel">
        <div class="row">
          <label class="label" for="sizeSelect">サイズ</label>
          <select id="sizeSelect" class="select">
            <option value="3" selected>3×3</option>
            <option value="4">4×4</option>
            <option value="5">5×5</option>
          </select>
        </div>
        <div class="row">
          <label class="label" for="answerInput">ブロック数</label>
          <input id="answerInput" class="input" type="number" inputmode="numeric" min="0" step="1" />
          <button id="answerBtn" class="btn" type="button">回答</button>
        </div>
        <div class="row meta">
          <div id="attemptText"></div>
          <div id="viewText"></div>
        </div>
        <div id="message" class="message"></div>
        <div class="row actions">
          <button id="nextBtn" class="btn secondary" type="button">次の問題</button>
        </div>
      </section>
    </main>
  </div>
`

const canvasWrap = document.querySelector<HTMLDivElement>('#canvasWrap')
const sizeSelect = document.querySelector<HTMLSelectElement>('#sizeSelect')
const input = document.querySelector<HTMLInputElement>('#answerInput')
const answerBtn = document.querySelector<HTMLButtonElement>('#answerBtn')
const nextBtn = document.querySelector<HTMLButtonElement>('#nextBtn')
const message = document.querySelector<HTMLDivElement>('#message')
const attemptText = document.querySelector<HTMLDivElement>('#attemptText')
const viewText = document.querySelector<HTMLDivElement>('#viewText')

if (!canvasWrap || !sizeSelect || !input || !answerBtn || !nextBtn || !message || !attemptText || !viewText) {
  throw new Error('Missing UI elements')
}

const views: ViewDir[] = ['XP', 'XN', 'ZP']

let attempt = 1
let viewIndex = 0
let currentAnswer = 0
let boardSize = 5

const renderer = new ThreeBlockRenderer({ container: canvasWrap })

const setMessage = (text: string): void => {
  message.textContent = text
}

const updateMeta = (): void => {
  attemptText.textContent = `チャレンジ: ${attempt}/3`
  viewText.textContent = `視点: ${viewIndex + 1}/3`
}

const getCountRange = (size: number): { min: number; max: number } => {
  if (size === 3) return { min: 4, max: 10 }
  if (size === 4) return { min: 6, max: 18 }
  return { min: 8, max: 26 }
}

const startNewQuestion = (): void => {
  boardSize = Number(sizeSelect.value) || 5
  const range = getCountRange(boardSize)
  const shape = generateShape({
    sizeX: boardSize,
    sizeY: boardSize,
    sizeZ: boardSize,
    blockCountMin: range.min,
    blockCountMax: range.max,
    views,
    initialView: 'XP',
    fillOccludedInInitialView: true,
  })

  currentAnswer = shape.answer
  attempt = 1
  viewIndex = 0
  renderer.setBlocks(shape.blocks)
  renderer.setView(views[viewIndex])
  input.value = ''
  input.focus()
  updateMeta()
  setMessage('')
}

const onSubmit = (): void => {
  const raw = input.value.trim()
  const n = Number(raw)
  if (!raw || !Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
    setMessage('数値を入力してください')
    return
  }

  if (n === currentAnswer) {
    setMessage('正解')
    return
  }

  if (attempt >= 3) {
    setMessage(`不正解。正解は ${currentAnswer}`)
    return
  }

  attempt++
  viewIndex = Math.min(viewIndex + 1, views.length - 1)
  renderer.setView(views[viewIndex])
  updateMeta()
  setMessage('不正解。別角度からもう一度')
  input.select()
}

answerBtn.addEventListener('click', onSubmit)
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') onSubmit()
})

nextBtn.addEventListener('click', () => {
  startNewQuestion()
})

sizeSelect.addEventListener('change', () => {
  startNewQuestion()
})

startNewQuestion()
