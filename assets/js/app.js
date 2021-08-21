'use strict'

class Move{
		constructor(piece, direction){
			this.id = piece.id
			this.fromX = piece.x
			this.fromY = piece.y
			this.hash = ''

			this.children = []

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
			solution: {x:2, y:4},

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
			],

			// tree of all possible moves
			// each node is a move.
			moves: [],
			round: 0,
			sequence: [],
			boardStates: [], // list of pieces' fingerprints
			directions: ['up', 'right', 'down', 'left'],
			stepInterval: 75,
	},
	// created: function(){
	// 	console.debug('created')
	// },
	// mounted: function(){
	// 	console.debug('mounted')
	// },
	methods: {
		startSolve: async function(e){
			console.log('start solving...')

			this.moves = []
			this.sequence = []
			const res = await this.solve(this.clone(this.pieces))

			console.log('SUUUUUCCCEEEESSS ' + res)
		},
		// finds the sequence of moves that resolves the problem, and records it.
		// Must detect loops & reverts !!!
		solve: async function(pieces, lastMove){
			this.round++

			// apply last move to pieces
			if (lastMove){
				const piece = pieces.find(p => p.id == lastMove.id)
				piece.x = lastMove.toX
				piece.y = lastMove.toY

				lastMove.hash = this.getHash(pieces)
				if (this.boardStates.includes(lastMove.hash)){
					console.warn('Circular move !')
					return false
				}
				else
					this.boardStates.push(lastMove.hash)
			}

			this.pieces = pieces

			// find free cells
			const cells = this.mapCells(pieces)
			const moves = []

			// list possible moves
			for (const p of pieces){
				let up = true, down = true, left = true, right = true
				// let moveOk = [true, true, true, true] // follow top/right/bottom/left CSS convention

				// check if at board limit
				if (p.x === 0) left = false
				if (p.y === 0) up = false
				if (p.x + p.w === this.board.width) right = false
				if (p.y + p.h === this.board.height) down = false

				// console.debug(`${p.id}: ${p.x}, ${p.y}`)

				// check if move possible
				for (let x = p.x; x < p.x + p.w; x++){
					up = up && cells[x][p.y - 1] === true
					down = down && cells[x][p.y + p.h] === true
				}
				for (let y = p.y; y < p.y + p.h; y++){
					left = left && cells[p.x - 1][y] === true
					right = right && cells[p.x + p.w][y] === true
				}

				// create the allowed moves, with additional checks
				;[up, right, down, left].forEach((ok, i) => {
					if (ok){
						const m = new Move(p, this.directions[i])
						if (!m.isReverse(lastMove))
							moves.push(m)
					}
				})
			}
			console.debug(`#${this.round} [${lastMove}] moves: ${moves.join('  ')}`)

			if (moves.length === 0)
				return false

			if (moves.find(m => m.id === 't' && m.toX === this.solution.x && m.toY === this.solution.y)){
				console.log('VICTORY !!')
				return true
			}


			// this.sequence.push(moves[0].toString())

			if (this.stepInterval)
				await new Promise(resolve => {setTimeout(resolve, this.stepInterval)})

			// return this.solve(this.clone(pieces), moves[0])
			let isOK = false
			for (let i = 0; i < moves.length; i++){
				const res = await this.solve(this.clone(pieces), moves[i])
				if (res){
					isOK = true
					break
				}
			}

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
			// console.debug(`cells populated`)

			// const free = []
			//
			// for (let x = 0; x < this.board.width; x++){
			// 	for (let y = 0; y < this.board.height; y++){
			// 		if (cells[x][y] === true){
			// 			free.push(`x${x}y${y}`)
			// 		}
			// 	}
			// }
			//
			// console.debug(`free cells: ${free.join(', ')}`)
			return cells
		},

		// clone the pieces array
		clone: function(pieces){
			const clone = []
			for (const p of pieces){
				clone.push({...p})
			}
			return clone
		},

		// unique fingerprint is the concatenation of the position of each piece
		getHash: function(pieces){
			let hash = ''
			for (const p of pieces){
				hash += `${p.x}${p.y}`
			}
			// console.debug(`hash: ${hash}`)
			return hash
		}

	}
})
