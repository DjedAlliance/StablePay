/**
 * RateLimiter.js
 * 
 * Implements a sliding window rate limiter to prevent DoS attacks and spam.
 * Tracks requests per address and globally.
 */

export class RateLimiter {
    constructor(config = {}) {
        this.config = {
            windowMs: config.windowMs || 60000,
            maxRequestsPerAddress: config.maxRequestsPerAddress || 20,
            maxGlobalRequests: config.maxGlobalRequests || 1000,
            blockDurationMs: config.blockDurationMs || 300000,
            cleanupIntervalMs: config.cleanupIntervalMs || 60000,
        };

        this.requests = new Map();
        this.globalRequests = { count: 0, windowStart: Date.now() };
        
        if (typeof setInterval !== 'undefined') {
            this.cleanupInterval = setInterval(() => this._cleanup(), this.config.cleanupIntervalMs);
        }
    }

    checkRequest(address) {
        const now = Date.now();

        if (now - this.globalRequests.windowStart > this.config.windowMs) {
            this.globalRequests = { count: 0, windowStart: now };
        }
        
        if (this.globalRequests.count >= this.config.maxGlobalRequests) {
            throw new Error('Global rate limit exceeded. Please try again later.');
        }
        this.globalRequests.count++;

        if (!address) return true;

        let userData = this.requests.get(address);

        if (!userData) {
            userData = { count: 0, windowStart: now, blockedUntil: 0 };
            this.requests.set(address, userData);
        }

        if (userData.blockedUntil > now) {
            const remainingSeconds = Math.ceil((userData.blockedUntil - now) / 1000);
            throw new Error('Address blocked for ' + remainingSeconds + 's due to excessive requests');
        }

        if (now - userData.windowStart > this.config.windowMs) {
            userData.count = 0;
            userData.windowStart = now;
        }

        if (userData.count >= this.config.maxRequestsPerAddress) {
            userData.blockedUntil = now + this.config.blockDurationMs;
            throw new Error('Rate limit exceeded. Blocked for ' + (this.config.blockDurationMs / 1000) + 's');
        }

        userData.count++;
        return true;
    }

    blockAddress(address, durationMs) {
        const now = Date.now();
        const duration = durationMs || this.config.blockDurationMs;
        
        let userData = this.requests.get(address) || { count: 0, windowStart: now };
        userData.blockedUntil = now + duration;
        this.requests.set(address, userData);
    }

    getStats(address) {
        return this.requests.get(address) || null;
    }

    _cleanup() {
        const now = Date.now();
        for (const [address, data] of this.requests.entries()) {
            if (now - data.windowStart > this.config.windowMs && data.blockedUntil < now) {
                this.requests.delete(address);
            }
        }
    }

    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
    }
}
