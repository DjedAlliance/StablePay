import { InputValidator } from './InputValidator.js';
import { RateLimiter } from './RateLimiter.js';

export const SecurityUtils = {
    validator: new InputValidator(),
    rateLimiter: new RateLimiter(),

    validateTransaction(address, amount, data = null) {
        this.rateLimiter.checkRequest(address);
        this.validator.validateAddress(address);
        const safeAmount = this.validator.validateAmount(amount);
        this.validator.validateTransactionData(data);

        return { address, amount: safeAmount, data };
    },

    sanitize(text) {
        return this.validator.sanitizeText(text);
    },

    reportViolation(type, details) {
        this.validator._logViolation(type, details);
    }
};

export { InputValidator, RateLimiter };

export function createSecuritySuite(config = {}) {
    return {
        validator: new InputValidator(config.validator),
        rateLimiter: new RateLimiter(config.rateLimiter)
    };
}
