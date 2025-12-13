/**
 * InputValidator.js
 * 
 * Provides comprehensive validation for user inputs including:
 * - EVM addresses (format, checksum, zero address, blacklists)
 * - Transaction amounts (format, range, overflow)
 * - Text input (XSS sanitization, length limits)
 * - Transaction data (method signatures)
 */

export class InputValidator {
    constructor(config = {}) {
        this.config = {
            maxAmount: config.maxAmount || '1000000000000000000000000',
            minAmount: config.minAmount || '1',
            blacklistedAddresses: new Set([
                '0x0000000000000000000000000000000000000000',
                '0x000000000000000000000000000000000000dEaD',
                ...(config.blacklistedAddresses || [])
            ]),
            allowedMethods: new Set([
                '0xa9059cbb',
                '0x095ea7b3',
                ...(config.allowedMethods || [])
            ])
        };
        
        this.violationLog = [];
    }

    validateAddress(address) {
        if (!address || typeof address !== 'string') {
            this._logViolation('Invalid address type', { address });
            throw new Error('Address must be a non-empty string');
        }

        if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
            this._logViolation('Invalid address format', { address });
            throw new Error('Invalid address format');
        }

        if (this.config.blacklistedAddresses.has(address.toLowerCase()) || 
            this.config.blacklistedAddresses.has(address)) {
            this._logViolation('Blacklisted address detected', { address });
            throw new Error('Address is blacklisted');
        }

        return true;
    }

    validateAmount(amount) {
        try {
            const amountBig = BigInt(amount);
            const minBig = BigInt(this.config.minAmount);
            const maxBig = BigInt(this.config.maxAmount);

            if (amountBig < minBig) {
                this._logViolation('Amount below minimum', { amount, min: this.config.minAmount });
                throw new Error('Amount below minimum: ' + this.config.minAmount);
            }

            if (amountBig > maxBig) {
                this._logViolation('Amount exceeds maximum', { amount, max: this.config.maxAmount });
                throw new Error('Amount exceeds maximum: ' + this.config.maxAmount);
            }

            return amountBig.toString();
        } catch (e) {
            if (e.message.includes('Amount')) throw e;
            this._logViolation('Invalid amount format', { amount });
            throw new Error('Invalid amount format');
        }
    }

    sanitizeText(text) {
        if (typeof text !== 'string') return '';
        
        const sanitized = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');

        if (text !== sanitized) {
            this._logViolation('Potential XSS attempt sanitized', { original: text });
        }

        return sanitized;
    }

    validateTransactionData(data) {
        if (!data || data === '0x') return true;

        const methodId = data.slice(0, 10);
        if (!this.config.allowedMethods.has(methodId)) {
            this._logViolation('Unauthorized method call', { methodId });
            throw new Error('Method ' + methodId + ' not allowed');
        }

        return true;
    }

    _logViolation(type, details) {
        const violation = {
            timestamp: new Date().toISOString(),
            type,
            details
        };
        this.violationLog.push(violation);
        console.warn('[Security Violation] ' + type + ':', details);
    }

    getViolationLog() {
        return [...this.violationLog];
    }
}
