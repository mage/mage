'use strict';


const assert = require('assert');
const sinon = require('sinon');

const Scheduler = require('lib/msgServer/msgStream/scheduler');

describe('scheduler', () => {
	let scheduler = null;
	let sleepStub = null;

	beforeEach(() => {
	});

	afterEach(() => {
		scheduler = null;

		if (sleepStub) {
			sleepStub.restore();
		}
	});

	it('creates correctly the scheduler', () => {
		const bucketsNb = 5;
		const cycleTime = 10;
		scheduler = new Scheduler(cycleTime, bucketsNb, () => {});

		assert(scheduler.bucketsNb === bucketsNb, `scheduler.bucketsNb should be equals to ${bucketsNb}`);
		assert(typeof scheduler.buckets === 'object', 'scheduler.buckets should be an object');
		assert(typeof scheduler.onSchedule === 'function', 'scheduler.onSchedule should be a function');
		assert(scheduler.cycleTime === cycleTime, `scheduler.cycleTime should be equal to ${cycleTime}`);
		assert(
			scheduler.bucketTime === cycleTime / bucketsNb,
			'scheduler.bucketTime should be equal to cycleTime / bucketsNb'
		);
	});

	it('adds a bucket', () => {
		scheduler = new Scheduler(10, 5, () => {});

		const data = {
			value: 2
		};
		scheduler.schedule(data);

		let scheduledData = null;
		const iterator = scheduler.getBucketsIterator();
		for (let i = 0; i < scheduler.bucketsNb; ++i) {
			const bucket = iterator.next().value;
			if (bucket.elems.length) {
				scheduledData = bucket.elems[0];
				break;
			}
		}

		assert.deepEqual(scheduledData, data);
	});

	it('runs and schedule buckets', (done) => {
		const dataArr = [];
		const bucketsNb = 5;
		let callbackSpy = null;
		const schedulesDone = () => {
			assert(callbackSpy.callCount === bucketsNb, `Scheduler callback should be called ${bucketsNb} times`);

			for (const data of dataArr) {
				sinon.assert.calledWithExactly(callbackSpy, [data]);
			}

			done();
		};

		// Setup schedule callback
		// We have to wait for all calls to be completed before asserting
		let calls = 0;
		callbackSpy = sinon.spy(() => {
			calls++;

			if (calls === bucketsNb) {
				schedulesDone();
				// Do not return Promise.resolve otherwise there could be an infinite loop
				return new Promise(() => {});
			} else {
				return Promise.resolve();
			}
		});

		// Setup scheduler
		scheduler = new Scheduler(10, bucketsNb, callbackSpy);
		sleepStub = sinon.stub(scheduler, 'sleep').returns(Promise.resolve());

		// Add schedules
		for (let i = 0; i < bucketsNb; ++i) {
			const data = {
				value: i
			};
			scheduler.schedule(data);
			dataArr.push(data);
		}

		// Run
		scheduler.run();
	});
});
