'use strict'

const app = new Vue({
	data: {
			board: { width: 4, height: 5},
			// solution: {
			// 	piece: {},
			// 	position: {x:1, y:1}
			// },
			// pieces: {
			// 	target: {width: }
			// }
			pieces: [
				{w: 1, h: 2, x: 1, y: 1, type: 'rect'},
				{w: 1, h: 2, x: 4, y: 1, type: 'rect'},
				{w: 1, h: 2, x: 1, y: 4, type: 'rect'},
				{w: 1, h: 2, x: 4, y: 4, type: 'rect'},
				{w: 2, h: 1, x: 2, y: 3, type: 'rect'},
				{w: 2, h: 2, x: 2, y: 1, type: 'target'},
				{w: 1, h: 1, x: 2, y: 4, type: 'square'},
				{w: 1, h: 1, x: 2, y: 5, type: 'square'},
				{w: 1, h: 1, x: 3, y: 4, type: 'square'},
				{w: 1, h: 1, x: 3, y: 5, type: 'square'},
			]
	},
	created: function(){
		console.debug('created')
	},
	mounted: function(){
		console.debug('mounted')
	},
	methods: {
		// finds the sequence of moves that resolves the problem, and records it.
		solve: function(){

		}
	}
})
