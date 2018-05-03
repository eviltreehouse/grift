'use strict';
const assert = require('simple-assert');

const Grift = require('../grift');

describe("Simple Usage Tests", () => {
	context("Single step: sync", () => {
		var g = new Grift();
		var gp;

		it("Accepts add()", () => {
			var result = g.add('simple-sync', (ctx) => {
				return Promise.resolve(2018);
			});

			assert(result instanceof Grift);
		});

		it("Executes", () => {
			gp = g.execute();
			assert(gp instanceof Promise);
		});

		it("Completes as expected", function(done) {
			gp.then((g) => {
				try {
					assert(g.success(), 'did not succeed!');
					assert(g.stepSucceeded('simple-sync'));
					assert(g.resultsFrom('simple-sync') === 2018);

					done();
				} catch(e) {
					done(e);
				}
			});
		});
	});

	xcontext("Multiple steps: sync");

	xcontext("Single step: async");

	xcontext("Multiple steps: async");

});