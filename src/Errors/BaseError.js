/**
 * This class serves as basis for all Eleventy-specific errors.
 */
export default class BaseError extends Error {
	/**
	 * @param {string} message - The error message to display.
	 * @param {Error} [originalError] - The original error caught.
	 */
	constructor(message, originalError) {
		if (originalError) {
			super(message, { cause: originalError });
		} else {
			super(message);
		}

		this.name = this.constructor.name;

		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, this.constructor);
		}

		if (originalError) {
			this.originalError = originalError;
		}
	}
}
