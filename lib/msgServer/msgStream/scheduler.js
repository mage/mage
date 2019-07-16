const mage = require('lib/mage');
const logger = mage.core.logger.context('msgStream', 'scheduler');

function* bucketsIterator(buckets) {
	while (1) {
		for (let i = 0; i < buckets.length; ++i) {
			yield buckets[i];
		}
	}
}

/**
 * Reduce the load of multiple calls of a given function
 * by splitting it's calls in different time frames
 */
class Scheduler {
	/**
	 * Constructor
	 *
	 * @param {number} cycleTime 		The time in ms it takes to make one schedule circle
	 * @param {number} bucketsNb 		The number of buckets
	 * @param {function} onSchedule		Called when executing a bucket
	 * Ex: with cycleTime = 60 and bucketsNb = 3 it will create the following schedules:
	 * - schedulerCreationTime + 0
	 * - schedulerCreationTime + 20
	 * - schedulerCreationTime + 40
	 */
	constructor(cycleTime, bucketsNb, onSchedule) {
		this.bucketsNb = bucketsNb;
		this.buckets = [];
		this.onSchedule = onSchedule;
		this.cycleTime = cycleTime;
		this.bucketTime = this.cycleTime / this.bucketsNb;
		this.bucketsIterator = this.getBucketsIterator();

		for (let i = 0; i < this.bucketsNb; ++i) {
			const startTime = i * this.bucketTime;
			const endTime = startTime + this.bucketTime;
			this.addBucket(i, startTime, endTime);
		}

		logger
			.verbose
			.data({
				cycleTime: this.cycleTime,
				bucketTime: this.bucketTime,
				bucketsNb: this.bucketsNb
			})
			.log('Init Scheduler');
	}

	addBucket(id, startTime, endTime) {
		this.buckets.push({
			elems: [],
			id: id,
			startTime: startTime,
			endTime: endTime
		});
	}

	getBucketsIterator() {
		return bucketsIterator(this.buckets);
	}

	/**
	 * Simulate sleep with setTimeout
	 *
	 * @param {ms} number of ms to wait
	 * @returns {promise} promise to await
	 */
	sleep(ms) {
		return new Promise(function (resolve) {
			setTimeout(function () {
				resolve();
			}, ms);
		});
	}

	run() {
		logger.verbose('Run Scheduler');

		/**
		 * Wait before executing next bucket and execute it
		 *
		 * @param {bucket} bucket to execute
		 * @param {timeout} number of ms to wait
		 * @param {lateSecs} number of ms we are late. It's always 0 or negative
		 */
		const that = this;
		const executeNextBucket = async function (bucket, timeout, lateSecs) {
			if (timeout > 0) {
				await that.sleep(timeout);
			}

			// Execute bucket and calculate execution time
			const start = Date.now();
			await that.onSchedule(bucket.elems);
			const end = Date.now();
			const executionTime = end - start;

			// Calculate when to execute next bucket
			// lateSecs is always 0 or negative
			const nextBucketExecution = that.bucketTime + lateSecs - executionTime;
			lateSecs = Math.min(0, nextBucketExecution) % that.cycleTime;

			// bucket.next can be modified for unit test to prevent infinite loop
			executeNextBucket(that.bucketsIterator.next().value, nextBucketExecution, lateSecs);
		};

		executeNextBucket(that.bucketsIterator.next().value, 0, 0);
	}

	/**
	 * Add an element to the bucket
	 *
	 * @param {any} elem The element to add
	 */
	schedule(elem) {
		// Get the bucket with less elements
		const iterator = this.getBucketsIterator();
		let choosedBucket = null;
		for (let i = 0; i < this.bucketsNb; ++i) {
			const bucket = iterator.next().value;
			if (!choosedBucket || choosedBucket.elems.length > bucket.elems.length) {
				choosedBucket = bucket;
			}
		}

		// Add to the bucket
		choosedBucket.elems.push(elem);
	}
}

module.exports = Scheduler;
