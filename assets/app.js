'use strict'

const MAX_DEPTH = 1000

const worker = new Worker('./assets/worker.js')

/* app */
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
			stepInterval: 1,
			running: false,
			refPieces: null, // copy of initial states, as pieces is mutated to show progress.
			bestSequence: null,
			maxDepth: MAX_DEPTH, // max allowed depth in recursion before giving up on the path

			uiRounds: 0, // approx. number of moves processed.
			uiStates: 0, // approx. number of unique hashes encountered
			uiSubsamplingFactor: 100, // ui values are updated only 1/N times,
			trialsCounter: 0 // number of runs we've done
	},
	created: function(){
		this.refPieces = this.clone(this.pieces)

		worker.onmessage = (e) => {
			if (e.data.name === 'solve' && e.data.sequence){
				this.handleSuccess(e.data)
			}
			else if (e.data.name === 'tick'){
				this.updateStats(e.data)
			}
		}
	},
	methods: {
		startSolve: async function(e){
			worker.postMessage({
				action: 'start',
				board: this.board,
				pieces: this.refPieces,
				solution: this.solution
			})

			this.running = true
		},

		// adds solution to list, store the sequence.
		handleSuccess: function(args){
			this.bestSequence = args.sequence
			const newSolution = {
				round: args.rounds,
				trial: args.trial,
				sequenceLength: this.bestSequence.length,
				duration: (args.duration / 1e3).toFixed(2)
			}

			// limit the number of solutions we store & display
			this.solutions = [newSolution, ...this.solutions.slice(0, 4)]

			document.title = document.title.replace(/( \[\d+\])?$/, ` [${newSolution.sequenceLength}]`)
		},

		updateStats: function(data){
			// for the sake of simplicity, some number are rounded to nearest 10 or 100.
			this.uiRounds = Math.round(data.rounds / 100) * 100
			this.uiStates = Math.round(data.states / 10) * 10
			this.pieces = data.pieces
			this.trialsCounter = data.trial
		},

		// clone the pieces array
		clone: function(pieces){
			const clone = []
			for (let i = 0; i < pieces.length; i++){
				clone.push({...pieces[i]})
			}
			return clone
		},

		// copy sequence to clipboard
		copySequence: function(){
			if (! navigator.clipboard){
				alert('Clipboard API not supported')
				return
			}

			let content
			if (this.bestSequence){
				content = `[${this.bestSequence.length}] ` + this.bestSequence.map(m => `${m.id}:${m.fromX},${m.fromY}→${m.toX},${m.toY}`).join('\t')
			}
			else
				content = 'No sequence found'

			navigator.clipboard.writeText(content).then(() => {})
		}

	}
})
