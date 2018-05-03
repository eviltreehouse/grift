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
			assert(g.executing === false);
			assert(g.result === null);
			gp = g.execute();
			assert(gp instanceof Promise);
		});

		it("Completes as expected", function(done) {
			gp.then((g) => {
				try {
					assert(g.success(), 'did not succeed!');
					assert(g.stepSucceeded('simple-sync'));
					assert(g.resultsFrom('simple-sync') === 2018);

					assert(
						JSON.stringify(g.resultsAll()) 
						== 
						'{"simple-sync":2018}', 
						JSON.stringify(g.resultsAll())
					);

					done();
				} catch(e) {
					done(e);
				}
			});
		});
	});

	context("Multiple steps: sync", () => {
		var g = new Grift();
		var gp;

		it("Accepts multiple adds()", () => {
			var result = g.add('mult-1', (ctx) => {
				return Promise.resolve(2018);
			})
			.add('mult-2', (ctx) => {
				return Promise.resolve(ctx['mult-1'] + 1);
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
					assert(g.stepSucceeded('mult-1'));
					assert(g.stepSucceeded('mult-2'));
					assert(g.resultsFrom('mult-1') === 2018);
					assert(g.resultsFrom('mult-2') === 2019);

					assert(
						JSON.stringify(g.resultsAll()) 
						== 
						'{"mult-1":2018,"mult-2":2019}', 
						JSON.stringify(g.resultsAll())
					);					

					done();
				} catch(e) {
					done(e);
				}
			});
		});		
	});

	context("Single step: async", () => {
		var g = new Grift();
		var gp;
		
		it("Accepts add()", () => {
			var result = g.add('simple-async', (ctx) => {
				return new Promise((resolve) => {
					setTimeout(() => {
						resolve(19191);
					}, 100);
				});
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
					assert(g.stepSucceeded('simple-async'));
					assert(g.resultsFrom('simple-async') === 19191);

					done();
				} catch(e) {
					done(e);
				}
			});
		});		
	});

	context("Multiple steps: async", () => {
		var g = new Grift();
		var gp;
		
		it("Accepts multiple adds()", () => {
			var result = g.add('mult-1', (ctx) => {
				return new Promise((resolve) => {
					setTimeout(() => { resolve(2018); }, 100);
				});
			})
			.add('mult-2', (ctx) => {
				return new Promise((resolve) => {
					setTimeout(() => { resolve(ctx['mult-1'] + 1); }, 100);
				});
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
					assert(g.stepSucceeded('mult-1'));
					assert(g.stepSucceeded('mult-2'));
					assert(g.resultsFrom('mult-1') === 2018);
					assert(g.resultsFrom('mult-2') === 2019);

					done();
				} catch(e) {
					done(e);
				}
			});
		});				
	});

	context("Single step: Failure", () => {
		var g = new Grift();
		var gp;

		it("Accepts add()", () => {
			var result = g.add('simple-sync', (ctx) => {
				return Promise.reject("failure code: 1");
			});

			assert(result instanceof Grift);
		});

		it("Executes", () => {
			assert(g.executing === false);
			assert(g.result === null);
			gp = g.execute();
			assert(gp instanceof Promise);
		});

		it("Completes as expected", function(done) {
			gp.then((g) => {
				try {
					assert(g.failed(), 'did not fail!');
					assert(g.stepFailed('simple-sync'));
					assert(g.errorFrom('simple-sync') === 'failure code: 1');

					assert(
						JSON.stringify(g.errorsAll()) 
						== 
						'{"simple-sync":"failure code: 1"}', 
						JSON.stringify(g.errorsAll())
					);

					done();
				} catch(e) {
					done(e);
				}
			});
		});		
	});

	context("Multiple steps: first step failure", () => {
		var g = new Grift();
		var gp;

		it("Accepts multiple adds()", () => {
			var result = g.add('mult-1', (ctx) => {
				return Promise.reject("err!");
			})
			.add('mult-2', (ctx) => {
				return Promise.resolve(ctx['mult-1'] + 1);
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
					assert(g.failed(), 'did not fail!');
					assert(g.stepFailed('mult-1'));
					assert(g.stepSkipped('mult-2'));
					assert(g.errorFrom('mult-1') === "err!");
					assert(g.resultsFrom('mult-2') == undefined);

					assert(
						JSON.stringify(g.resultsAll()) 
						== 
						'{}', 
						JSON.stringify(g.resultsAll())
					);					

					done();
				} catch(e) {
					done(e);
				}
			});
		});		
	});	
});