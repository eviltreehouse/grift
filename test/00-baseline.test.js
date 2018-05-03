'use strict';
const assert = require('simple-assert');

describe("Baseline Tests", () => {

	context("Sanity checks", () => {

		it("Instantiates okay", () => {
			const Grift = require('../grift');
			assert(typeof Grift === 'function');
		});

	});

});