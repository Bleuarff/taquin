'use strict'

const MAX_DEPTH = 1000

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

const app = new Vue({
	data: {
			board: { width: 4, height: 5},
			solution: {x:1, y:3},

			pieces: [
				{w: 1, h: 2, x: 0, y: 0, type: 'rect-v', id: 'r1'},
				{w: 1, h: 2, x: 0, y: 3, type: 'rect-v', id: 'r2'},
				{w: 1, h: 2, x: 3, y: 0, type: 'rect-v', id: 'r3'},
				{w: 1, h: 2, x: 3, y: 3, type: 'rect-v', id: 'r4'},
				{w: 2, h: 1, x: 1, y: 2, type: 'rect-h', id: 'r5'},
				{w: 2, h: 2, x: 1, y: 0, type: 'target', id: 't'},
				{w: 1, h: 1, x: 1, y: 3, type: 'square', id: 's1'},
				{w: 1, h: 1, x: 1, y: 4, type: 'square', id: 's2'},
				{w: 1, h: 1, x: 2, y: 3, type: 'square', id: 's3'},
				{w: 1, h: 1, x: 2, y: 4, type: 'square', id: 's4'},

				// solved board
				// {w: 1, h: 2, x: 3, y: 0, type: 'rect-v', id: 'r1'},
				// {w: 1, h: 2, x: 3, y: 3, type: 'rect-v', id: 'r2'},
				// {w: 1, h: 2, x: 0, y: 0, type: 'rect-v', id: 'r3'},
				// {w: 1, h: 2, x: 2, y: 3, type: 'rect-v', id: 'r4'},
				// {w: 2, h: 1, x: 1, y: 2, type: 'rect-h', id: 'r5'},
				// {w: 2, h: 2, x: 1, y: 3, type: 'target', id: 't'},
				// {w: 1, h: 1, x: 1, y: 1, type: 'square', id: 's1'},
				// {w: 1, h: 1, x: 0, y: 2, type: 'square', id: 's2'},
				// {w: 1, h: 1, x: 0, y: 4, type: 'square', id: 's3'},
				// {w: 1, h: 1, x: 0, y: 3, type: 'square', id: 's4'},
			],

			solutions: [], // list of found solutions. Sorted  by sequence length, ascending.
			round: 0, // number of states analyzed this round
			boardStates: null, // list of pieces' fingerprints
			stepInterval: 1,
			running: false,
			refPieces: null, // copy of initial states, as pieces is mutated to show progress.
			bestSequence: null,
			maxDepth: MAX_DEPTH, // max allowed depth in recursion before giving up on the path

			uiRounds: 0, // approx. number of moves processed.
			uiStates: 0, // approx. number of unique hashes encountered
			uiSubsamplingFactor: 100, // ui values are updated only 1/N times,
	},
	created: function(){
		this.refPieces = this.clone(this.pieces)
	},
	methods: {
		startSolve: async function(e){

			const startTime = Date.now()

			// reset various counters
			this.round = this.uiRounds = this.uiStates = 0
			this.running = true
			this.boardStates = new Set()

			this.pieces = this.clone(this.refPieces)
			const sequence = await this.solve(this.pieces)

			const endTime = Date.now()
			this.running = false

			const duration = ((endTime - startTime) / 1e3).toFixed(2)

			const upperBoundary = this.bestSequence?.length || this.maxDepth

			if (!sequence){
				console.log(`No solution found, dead-end after ${this.round} rounds.`)
			}
			else if (sequence.length <= upperBoundary){
				this.bestSequence = sequence // records the best sequence.
				this.maxDepth = sequence.length // lower the bar for the next search

				// store only solutions that are better than the current best.
				this.solutions.unshift({
					round: this.round,
					sequenceLength: sequence.length,
					duration,
				})

				console.log(`[${sequence.length} moves][${duration}s]\t` + sequence.join('\t'))
			}
			else{
				console.log(`Solution found in ${sequence.length} moves. ${this.round} rounds and ${duration}s`)
			}

			// ad infinitum...
			this.startSolve()
		},


		// finds the sequence of moves that resolves the problem, and records it.
		solve: async function(pieces, lastMove, depthCounter = 0){
			this.round++
			if (this.round % this.uiSubsamplingFactor === 0){
				this.uiRounds = this.round
				this.uiStates = this.boardStates.size
			}

			// give up on path if we're in too deep
			if (++depthCounter > this.maxDepth){
				return false
			}

			// apply current move to pieces
			if (lastMove){
				const piece = pieces.find(p => p.id == lastMove.id)
				piece.x = lastMove.toX
				piece.y = lastMove.toY

				// check if state is known
				const boardHash = this.getHash(pieces)
				if (this.boardStates.has(boardHash))
					return false // known state, no need to go further (avoids loops in the recursion)
				else
					this.boardStates.add(boardHash) // store hash for board state, won't be processed again

				this.pieces = pieces // update UI

				// check winning condition
				if (lastMove && lastMove.id === 't' && lastMove.toX === this.solution.x && lastMove.toY === this.solution.y)
					return [lastMove]
			}

			// maps pieces to board, aka a [x][y] double array. Each cell is true if free, false otherwise.
			const cells = this.mapCells(pieces)
			let moves = []

			// list possible moves: for each piece, each if can move up, right, down or left.
			// Create a big array with all immediate moves possible from current state.
			for (let i = 0; i < pieces.length; i++){
				const p = pieces[i]
				let up = true, down = true, left = true, right = true

				// check if piece is at board boundary
				if (p.x === 0) left = false
				if (p.y === 0) up = false
				if (p.x + p.w === this.board.width) right = false
				if (p.y + p.h === this.board.height) down = false

				// check if move possible
				for (let x = p.x; x < p.x + p.w; x++){
					up = up && cells[x][p.y - 1] === true
					down = down && cells[x][p.y + p.h] === true
				}
				for (let y = p.y; y < p.y + p.h; y++){
					left = left && cells[p.x - 1][y] === true
					right = right && cells[p.x + p.w][y] === true
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
			const winnerMove = moves.find(m => m.id === 't' && m.toX === this.solution.x && m.toY === this.solution.y)
			if (winnerMove){
				moves = [winnerMove]
			}

			// allow delay for visualization, and not blocking thread.
			if (this.stepInterval)
				await new Promise(resolve => {setTimeout(resolve, this.stepInterval)})

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
				const sequence = await this.solve(this.clone(pieces), moves[i], depthCounter)
				if (sequence){
					isOK = [moves[i], ...sequence]
					break
				}
			}

			// returns the current sequence
			return isOK
		},

		mapCells: function(pieces){
			const cells = []
			for (let x = 0; x < this.board.width; x++){
				cells[x] = []

				for (let y = 0; y < this.board.height; y++){
					cells[x][y] = true;
				}
			}
			// console.debug(`cells initialized`)

			for (const p of pieces){
				for(let x = p.x; x < (p.x + p.w); x++){
					for (let y = p.y; y < (p.y + p.h); y++){
						cells[x][y] = false
					}
				}
			}
			return cells
		},

		// clone the pieces array
		clone: function(pieces){
			const clone = []
			for (let i = 0; i < pieces.length; i++){
				clone.push({...pieces[i]})
			}
			return clone
		},

		// fingerprint is the concatenation of the positions of each piece.
		// Pieces of the same type are fungible: they can be switched with each other,
		// and the hash remains the same, as the board is considered the same.
		//
		// 2 sets of 4 identical pieces means 4!² identical pieces, so that's 500 times less states to search!
		getHash: function(pieces){
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
		},

		// copy sequence to clipboard
		copySequence: function(){
			if (! navigator.clipboard){
				alert('Clipboard API not supported')
				return
			}

			let content
			if (this.bestSequence){
				content = `[${this.bestSequence.length}] ` + this.bestSequence.join('\t')
			}
			else
				content = 'No sequence found'

			navigator.clipboard.writeText(content).then(() => {})
		}

	}
})
