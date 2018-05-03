'use strict';
const assert = require('simple-assert');
const Grift = require('../grift');

const RollbackData = require('./fixtures/rollback-data');

describe("Rollbacks Usage Tests", () => {
	context("Single step rollback", () => {
		var g = new Grift();
		var gp;
		var data = RollbackData();

		it("Setup", () => {
			g.add('step1', 
				() => { 
					for (var i in data.original) {
						data.mutated[i] = data.original[i] + "X";
					}

					return Promise.resolve('ok');
				},
				() => { 
					data.pre_rollback = JSON.parse(JSON.stringify(data.mutated));
					for (var i in data.original) {
						data.mutated[i] = data.original[i];
					}
				}
			)
			.add('stepf', () => { return Promise.reject('choke'); })
			;

			gp = g.execute();
		});

		it("Rollback as expected", function(done) {
			gp.then((g) => {
				try {
					assert(g.success() === false);
					assert(g.stepSucceeded("step1"));
					assert(g.stepFailed("stepf"), JSON.stringify(g.resultsAll()));

					assert(
						JSON.stringify(data.mutated)
						===
						'["a","b","c","d","e","f"]',
						JSON.stringify(data.mutated)
					);

					assert(
						JSON.stringify(data.pre_rollback)
						===
						'["aX","bX","cX","dX","eX","fX"]',
						JSON.stringify(data.pre_rollback)
					);

					done();
				} catch(e) { done(e); }
			});
		});
	});

	xcontext("Multiple step rollback");
});