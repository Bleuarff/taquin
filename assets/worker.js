'use strict'

class Move{
		constructor(piece, direction){
			this.id = piece.id
			this.fromX = piece.x
			this.fromY = piece.y

			switch(direction){
				case 'up':
					this.toX = piece.x
					this.toY = piece.y - 1
					break;
				case 'right':
					this.toX =  piece.x + 1
					this.toY = piece.y
					break
				case 'down':
					this.toX = piece.x
					this.toY = piece.y + 1
					break
				case 'left':
					this.toX = piece.x - 1
					this.toY = piece.y
					break
				default:
					console.error('Unknown move ${direction}')
			}
		}

		toString(){
			return `${this.id}:${this.fromX},${this.fromY}→${this.toX},${this.toY}`
		}

		// whether the given move and the current instance are the reverse of each other,
		// i.e. playing them in sequence does not modifes the board.
		isReverse(move){
			if (!move) return false
			return this.id === move.id
							&& this.toX === move.fromX && this.toY === move.fromY
							&& this.fromX === move.toX && this.fromY === move.toY
		}
}


/******************************************************************************/
const MAX_DEPTH = 1000

let boardStates = null  // list of pieces' fingerprints
let trialsCounter = 0 // number of times we've tried to resolve the puzzle
let trialRounds = 0 // how many rounds when into the current counter (set after solve)
let maxDepth = 0 // max recursion depth authorized.Above that and we stop looking further down the search tree.

let solution = null // desired location to consider the puzzle resolved.

const refreshRate =  8 // in Hz
let lastRefresh = 0

// board dimensions
let boardWidth = 0,
		boardHeight = 0

const stepInterval = 1

// listens to messages from parent page
addEventListener('message', e => {
	if (!e.data?.action)
		return

	switch (e.data.action){
		case 'start':
			startSolve(e.data)
			break
		default:
			console.debug(`Unknown action '${e.data.action}'`)
	}
})

// launch puzzle solving, indefinitely
async function startSolve(args){
	// get basic parameters
	const { pieces } = args
	boardWidth = args.board.width
	boardHeight = args.board.height
	solution = args.solution
	maxDepth = args.maxDepth || MAX_DEPTH

	// Loop ad infinitum (until reload, or when we implement a stop feature)
	while(true){
		++trialsCounter

		// state resets
		boardStates = new Set()
		trialRounds = 0

		performance.mark('solve-start')
		const sequence = await solve(pieces)
		performance.measure('solve-duration', 'solve-start')

		const perfEntries = performance.getEntriesByName('solve-duration', 'measure'),
					duration = perfEntries[perfEntries.length -1].duration

		const results = {
			name: 'solve',
			trial: trialsCounter,
			rounds: trialRounds,
			duration
		}

		if (!sequence){
			console.log(`No solution found, dead-end after ${trialRounds} rounds and ${(duration/1e3).toFixed(2)}s.`)
		}
		else if (sequence.length <= maxDepth){
			maxDepth = sequence.length // lower the bar for the next search
			results.sequence = sequence

			console.clear()
			console.log(`[${sequence.length} moves][${(duration/1e3).toFixed(2)}s]\t` + sequence.join('\t'))
		}
		else{
			console.log(`Solution found in ${sequence.length} moves. ${trialRounds} rounds and ${(duration/1e3).toFixed(2)}s`)
		}

		postMessage(results)
	}
}

// finds the sequence of moves that resolves the problem, and records it.
async function solve(prevPieces, lastMove, depthCounter = 0){
	// give up on path if we're in too deep
	if (++depthCounter > maxDepth){
		return false
	}

	trialRounds++

	const pieces = clone(prevPieces)

	// apply current move to pieces
	if (lastMove){
		const piece = pieces.find(p => p.id == lastMove.id)
		piece.x = lastMove.toX
		piece.y = lastMove.toY

		// check if state is known
		const boardHash = getHash(pieces)
		if (boardStates.has(boardHash))
			return false // known state, no need to go further (avoids loops in the recursion)
		else
			boardStates.add(boardHash) // store hash for board state, won't be processed again

		// check winning condition
		if (lastMove && lastMove.id === 't' && lastMove.toX === solution.x && lastMove.toY === solution.y)
			return [lastMove]
	}

	// slow down refresh rate
	const now = Date.now()

	if (now - lastRefresh >= (1000 / refreshRate)){
		postMessage({
			name: 'tick',
			trial: trialsCounter,
			rounds: trialRounds,
			states: boardStates.size,
			depth: depthCounter,
			pieces
		})
		lastRefresh = now
	}

	// maps free cells on board. An array of bytes, where each element is 0 if cell is free, 255 otherwise.
	// array index is obtained from cell coordinates = idx = x * board_height + y
	const cells = mapCells(pieces)
	let moves = []

	// list possible moves: for each piece, each if can move up, right, down or left.
	// Create a big array with all immediate moves possible from current state.
	for (let i = 0; i < pieces.length; i++){
		const p = pieces[i]
		let up = true, down = true, left = true, right = true

		// check if piece is at board boundary
		if (p.x === 0) left = false
		if (p.y === 0) up = false
		if (p.x + p.w === boardWidth) right = false
		if (p.y + p.h === boardHeight) down = false

		// check if move possible
		for (let x = p.x; x < p.x + p.w; x++){
			up = up && cells[x * boardHeight + p.y - 1] === 0
			down = down && cells[x * boardHeight + p.y + p.h] === 0
		}
		for (let y = p.y; y < p.y + p.h; y++){
			left = left && cells[(p.x - 1) * boardHeight + y] === 0
			right = right && cells[(p.x + p.w) * boardHeight + y] === 0
		}

		if (up){
			const m = new Move(p, 'up')
			if (!m.isReverse(lastMove))
				moves.push(m)
		}
		if (right){
			const m = new Move(p, 'right')
			if (!m.isReverse(lastMove))
				moves.push(m)
		}
		if (down){
			const m = new Move(p, 'down')
			if (!m.isReverse(lastMove))
				moves.push(m)
		}
		if (left){
			const m = new Move(p, 'left')
			if (!m.isReverse(lastMove))
				moves.push(m)
		}
	}
	// console.debug(`#${this.round} [${lastMove}] moves: ${moves.join('  ')}`)

	// early return if no move possible
	if (moves.length === 0)
		return false

	// check for winner move among candidates. If found, use only this one.
	const winnerMove = moves.find(m => m.id === 't' && m.toX === solution.x && m.toY === solution.y)
	if (winnerMove){
		moves = [winnerMove]
	}

	// allow delay for visualization, and not blocking thread.
	if (stepInterval)
		await new Promise(resolve => { setTimeout(resolve, stepInterval) })

	// Sort array: moves for target piece are put first (and randomized between them),
	// other moves are randomized. No guarantee of it being bias-free.
	moves.sort((a, b) => {
		if (a.id === 't' && b.id !== 't')
			return -1
		else if (a.id !== 't' && b.id === 't')
			return 1
		else
			return (Math.random() * 10 >= 5) ? 1 : -1
	})

	let isOK = false

	// calls each possible move.
	// On sucess, the recursion's return chain results in the sequence of moves to solve the taquin.
	for (let i = 0; i < moves.length; i++){
		const sequence = await solve(pieces, moves[i], depthCounter)
		if (sequence){
			isOK = [moves[i], ...sequence]
			break
		}
	}

	// returns the current sequence
	return isOK
}

// returns a Uint8Array. Each element is a cell of the board, set to 0 free, 255 otherwise.
function mapCells(pieces){
	const cells = new Uint8Array(boardWidth * boardHeight)

	for (let i = 0; i < pieces.length; i++){
		const p = pieces[i]
		for (let x = p.x; x < (p.x + p.w); x++){
			for (let y = p.y; y < (p.y + p.h); y++){
				cells[x * boardHeight + y] = 255
			}
		}
	}
	return cells
}

// clone the pieces array
function clone(pieces){
	const clone = []
	for (let i = 0; i < pieces.length; i++){
		clone.push({...pieces[i]})
	}
	return clone
}

// fingerprint is the concatenation of the positions of each piece.
// Pieces of the same type are fungible: they can be switched with each other,
// and the hash remains the same, as the board is considered the same.
//
// 2 sets of 4 identical pieces means 4!² identical pieces, so that's 500 times less states to search!
function getHash(pieces){
	let tg = '',
			rh = ''
	const vRectPosList = [],
				squarePosList = []

	for (let i = 0; i < pieces.length; i++){
		const p = pieces[i],
					pos = p.x.toString() + p.y.toString()

		switch (p.type){
			case 'rect-v':
				vRectPosList.push(pos)
				break
			case 'square':
				squarePosList.push(pos)
				break
			case 'rect-h':
				rh = pos
				break
			case 'target':
				tg = pos
				break
		}
	}

	// fungible pieces: sort arrays
	vRectPosList.sort()
	squarePosList.sort()

	return tg + rh + vRectPosList.join('') + squarePosList.join('')
}
