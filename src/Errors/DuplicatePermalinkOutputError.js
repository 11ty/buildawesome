import BaseError from "./BaseError.js";

export default class DuplicatePermalinkOutputError extends BaseError {
	get removeDuplicateErrorStringFromOutput() {
		return true;
	}
}
