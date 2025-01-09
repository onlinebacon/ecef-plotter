const req = await fetch('./pontchartrain.csv')
const raw = await req.text()

const data = raw
	.toLowerCase()
	.trim()
	.split('\n')
	.map((line) => {
		return line.split(/\s*,\s*/).map(Number)
	})

const dotRadius = 1

const Vec = {
	minus: ([ax, ay, az], [bx, by, bz]) => [ax - bx, ay - by, az - bz],
	plus: ([ax, ay, az], [bx, by, bz]) => [ax + bx, ay + by, az + bz],
	len: ([x, y, z]) => Math.sqrt(x * x + y * y + z * z),
	dist: (a, b) => Vec.len(Vec.minus(a, b)),
	scale: ([x, y, z], s) => [x * s, y * s, z * s],
	normalize: (v) => Vec.scale(v, 1 / Vec.len(v)),
}

function findFurthestPair(data) {
	let pair = null
	let distance = 0
	for (let i = 0; i < data.length; ++i) {
		let a = data[i]
		for (let j = i + 1; j < data.length; ++j) {
			let b = data[j]
			const dist = Vec.dist(a, b)
			if (dist > distance) {
				distance = dist
				pair = [a, b]
			}
		}
	}
	return pair
}

function alignWithX(dirRef, data) {
	function zRot() {
		const [x, y] = dirRef
		const len = Vec.len([x, y, 0])
		const sin = y / len
		const cos = x / len
		;[dirRef, ...data] = [dirRef, ...data].map((vec) => {
			const [x, y, z] = vec
			return [x * cos + y * sin, y * cos - x * sin, z]
		})
	}
	function yRot() {
		const [x, _, z] = dirRef
		const len = Vec.len([x, 0, z])
		const sin = z / len
		const cos = x / len
		;[dirRef, ...data] = [dirRef, ...data].map((vec) => {
			const [x, y, z] = vec
			return [x * cos + z * sin, y, z * cos - x * sin]
		})
	}
	zRot()
	yRot()
	return data
}

function pullCenterUp(data) {
	let sum = [0, 0, 0]
	for (const vec of data) {
		sum = Vec.plus(sum, vec)
	}
	const center = Vec.scale(sum, 1 / data.length)
	const [_, y, z] = center
	const len = Vec.len([0, y, z])
	const cos = y / len
	const sin = z / len
	return data.map((vec) => {
		const [x, y, z] = vec
		return [x, y * cos + z * sin, z * cos - y * sin]
	})
}

function startAtOrigin(data) {
	const [x, y, z] = data.reduce((a, b) => a[0] > b[0] ? b : a);
	return data.map((vec) => Vec.minus(vec, [x, y, z]))
}

function get2DPlot(data) {
	const [a, b] = findFurthestPair(data)
	const diff = Vec.minus(b, a)
	const dir = Vec.normalize(diff)
	data = alignWithX(dir, data)
	data = pullCenterUp(data)
	data = startAtOrigin(data)
	return data
}

let mouse = { x: 0, y: 0 }
const plotted = Array()
function plot(data, canvas, exageration = 1) {
	const ctx = canvas.getContext('2d')
	const width = (canvas.width = 800)
	const height = (canvas.height = 400)
	let [xMin, xMax] = [Infinity, -Infinity]
	let [yMin, yMax] = [Infinity, -Infinity]
	for (const [x, y, _] of data) {
		xMin = Math.min(xMin, x)
		yMin = Math.min(yMin, y)
		xMax = Math.max(xMax, x)
		yMax = Math.max(yMax, y)
	}
	const xDelta = xMax - xMin
	const yDelta = yMax - yMin
	let scale = 1
	if (xDelta / yDelta > width / height) {
		scale = width / xDelta
	} else {
		scale = height / yDelta
	}
	const xOffset = (width - xDelta * scale) / 2
	const yOffset = (height - yDelta * scale) / 2
	ctx.fillStyle = '#222'
	ctx.fillRect(0, 0, width, height)
	ctx.fillStyle = '#07f'
	let closest = -1
	let closestDist = 0
	for (let i = 0; i < data.length; ++i) {
		const [x, y, _] = data[i]
		const px = (x - xMin) * scale + xOffset
		const tempPy = height - (y - yMin) * scale - yOffset
		const py = (tempPy - height / 2) * exageration + height / 2
		ctx.beginPath()
		ctx.arc(px, py, dotRadius, 0, Math.PI * 2)
		ctx.fill()
		const dist = Math.sqrt((px - mouse.x) ** 2 + (py - mouse.y) ** 2)
		if (closest === -1 || dist < closestDist) {
			closest = i
			closestDist = dist
		}
	}
	const [x, y, z] = data[closest]
	const px = (x - xMin) * scale + xOffset
	const tempPy = height - (y - yMin) * scale - yOffset
	const py = (tempPy - height / 2) * exageration + height / 2
	ctx.strokeStyle = '#fff'
	ctx.fillStyle = '#fff'
	ctx.beginPath()
	ctx.arc(px, py, dotRadius * 4, 0, Math.PI * 2)
	ctx.stroke()
	ctx.beginPath()
	ctx.arc(px, py, dotRadius * 2, 0, Math.PI * 2)
	ctx.fill()
	ctx.textAlign = 'left'
	ctx.textBaseline = 'bottom'
	ctx.font = '16px monospace'
	ctx.fillText(
		data[closest].map((val) => Number(val.toFixed(2))).join(', '),
		10,
		height - 10
	)
}

const textarea = document.querySelector('textarea')
const canvas = document.querySelector('canvas')
const exagerationInput = document.querySelector('#exageration')
const offsetInput = document.querySelector('#offset')
const proportionInput = document.querySelector('#proportion')
const exportButton = document.querySelector('#export')

let plotData = get2DPlot(data)

textarea.value = data.map((vec) => vec.join(', ')).join('\n')

plot(plotData, canvas)
const update = () => {
	const exageration = Math.exp(exagerationInput.value)
	plot(plotData, canvas, exageration)
}

exagerationInput.addEventListener('input', update)

textarea.addEventListener('change', () => {
	const data = textarea.value
		.trim()
		.split(/\s*\n\s*/)
		.map((line) => {
			return line.split(/\s*,\s*/).map(Number)
		})
	plotData = get2DPlot(data)
	const exageration = Math.exp(exagerationInput.value)
	plot(plotData, canvas, exageration)
})

canvas.addEventListener('mousemove', (e) => {
	mouse = { x: e.offsetX, y: e.offsetY }
	update()
})

exportButton.addEventListener('click', () => {
	const text = plotData.map((vec) => vec.join(', ')).join('\n') + '\n'
	textarea.value = text
})
