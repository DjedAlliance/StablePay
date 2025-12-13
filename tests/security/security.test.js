import { InputValidator } from '../../stablepay-sdk/src/security/InputValidator.js';
import { RateLimiter } from '../../stablepay-sdk/src/security/RateLimiter.js';

// Simple Test Runner
const TestRunner = {
    passed: 0,
    failed: 0,

    describe(name, fn) {
        console.log('\n📋 ' + name);
        fn();
    },

    it(name, fn) {
        try {
            fn();
            this.passed++;
            console.log('  ✅ ' + name);
        } catch (error) {
            this.failed++;
            console.log('  ❌ ' + name);
            console.log('     Error: ' + error.message);
        }
    },

    expect(actual) {
        return {
            toBe(expected) {
                if (actual !== expected) {
                    throw new Error('Expected ' + expected + ' but got ' + actual);
                }
            },
            toEqual(expected) {
                if (JSON.stringify(actual) !== JSON.stringify(expected)) {
                    throw new Error('Expected ' + JSON.stringify(expected) + ' but got ' + JSON.stringify(actual));
                }
            },
            toBeTruthy() {
                if (!actual) {
                    throw new Error('Expected truthy value but got ' + actual);
                }
            },
            toBeFalsy() {
                if (actual) {
                    throw new Error('Expected falsy value but got ' + actual);
                }
            },
            toThrow(expectedMsg) {
                if (typeof actual !== 'function') {
                    throw new Error('Expected a function');
                }
                try {
                    actual();
                    throw new Error('Expected function to throw');
                } catch (e) {
                    if (e.message === 'Expected function to throw') throw e;
                    if (expectedMsg && !e.message.includes(expectedMsg)) {
                        throw new Error('Expected error containing "' + expectedMsg + '" but got "' + e.message + '"');
                    }
                }
            },
            toContain(expected) {
                if (!actual.includes(expected)) {
                    throw new Error('Expected "' + actual + '" to contain "' + expected + '"');
                }
            },
            toBeGreaterThan(expected) {
                if (actual <= expected) {
                    throw new Error('Expected ' + actual + ' to be greater than ' + expected);
                }
            },
            toBeLessThan(expected) {
                if (actual >= expected) {
                    throw new Error('Expected ' + actual + ' to be less than ' + expected);
                }
            },
            not: {
                toContain(expected) {
                    if (actual.includes(expected)) {
                        throw new Error('Expected "' + actual + '" not to contain "' + expected + '"');
                    }
                },
                toBe(expected) {
                    if (actual === expected) {
                        throw new Error('Expected ' + actual + ' not to be ' + expected);
                    }
                }
            }
        };
    },

    summary() {
        console.log('\n==================================================');
        console.log('📊 Test Results: ' + this.passed + ' passed, ' + this.failed + ' failed');
        console.log('==================================================\n');
        return this.failed === 0;
    }
};

console.log('🛡️ StablePay Security Module Tests\n');
console.log('==================================================');

// ============================================
// InputValidator - Address Validation Tests
// ============================================
TestRunner.describe('InputValidator - Address Validation', function() {
    const validator = new InputValidator();

    TestRunner.it('should accept valid EVM address', function() {
        const result = validator.validateAddress('0x742d35Cc6634C0532925a3b844Bc454e4438f44e');
        TestRunner.expect(result).toBe(true);
    });

    TestRunner.it('should accept valid lowercase address', function() {
        const result = validator.validateAddress('0x742d35cc6634c0532925a3b844bc454e4438f44e');
        TestRunner.expect(result).toBe(true);
    });

    TestRunner.it('should accept valid uppercase address', function() {
        const result = validator.validateAddress('0x742D35CC6634C0532925A3B844BC454E4438F44E');
        TestRunner.expect(result).toBe(true);
    });

    TestRunner.it('should reject empty address', function() {
        TestRunner.expect(function() { validator.validateAddress(''); }).toThrow('non-empty string');
    });

    TestRunner.it('should reject null address', function() {
        TestRunner.expect(function() { validator.validateAddress(null); }).toThrow('non-empty string');
    });

    TestRunner.it('should reject undefined address', function() {
        TestRunner.expect(function() { validator.validateAddress(undefined); }).toThrow('non-empty string');
    });

    TestRunner.it('should reject non-string address', function() {
        TestRunner.expect(function() { validator.validateAddress(12345); }).toThrow('non-empty string');
    });

    TestRunner.it('should reject invalid format - too short', function() {
        TestRunner.expect(function() { validator.validateAddress('0x123'); }).toThrow('Invalid address format');
    });

    TestRunner.it('should reject invalid format - too long', function() {
        TestRunner.expect(function() { validator.validateAddress('0x742d35Cc6634C0532925a3b844Bc454e4438f44e00'); }).toThrow('Invalid address format');
    });

    TestRunner.it('should reject invalid format - no 0x prefix', function() {
        TestRunner.expect(function() { validator.validateAddress('742d35Cc6634C0532925a3b844Bc454e4438f44e'); }).toThrow('Invalid address format');
    });

    TestRunner.it('should reject invalid format - invalid characters', function() {
        TestRunner.expect(function() { validator.validateAddress('0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG'); }).toThrow('Invalid address format');
    });

    TestRunner.it('should reject zero address', function() {
        TestRunner.expect(function() { validator.validateAddress('0x0000000000000000000000000000000000000000'); }).toThrow('blacklisted');
    });

    TestRunner.it('should reject dead address', function() {
        TestRunner.expect(function() { validator.validateAddress('0x000000000000000000000000000000000000dEaD'); }).toThrow('blacklisted');
    });

    TestRunner.it('should reject custom blacklisted address', function() {
        const customValidator = new InputValidator({
            blacklistedAddresses: ['0x1234567890123456789012345678901234567890']
        });
        TestRunner.expect(function() { 
            customValidator.validateAddress('0x1234567890123456789012345678901234567890'); 
        }).toThrow('blacklisted');
    });
});

// ============================================
// InputValidator - Amount Validation Tests
// ============================================
TestRunner.describe('InputValidator - Amount Validation', function() {
    const validator = new InputValidator();

    TestRunner.it('should accept valid positive string amount', function() {
        const result = validator.validateAmount('1000');
        TestRunner.expect(result).toBe('1000');
    });

    TestRunner.it('should accept valid large amount', function() {
        const result = validator.validateAmount('1000000000000000000');
        TestRunner.expect(result).toBe('1000000000000000000');
    });

    TestRunner.it('should accept minimum amount', function() {
        const result = validator.validateAmount('1');
        TestRunner.expect(result).toBe('1');
    });

    TestRunner.it('should reject zero amount', function() {
        TestRunner.expect(function() { validator.validateAmount('0'); }).toThrow('Amount below minimum');
    });

    TestRunner.it('should reject negative amount', function() {
        TestRunner.expect(function() { validator.validateAmount('-100'); }).toThrow('Amount below minimum');
    });

    TestRunner.it('should reject non-numeric string', function() {
        TestRunner.expect(function() { validator.validateAmount('abc'); }).toThrow('Invalid amount format');
    });

    TestRunner.it('should reject amount exceeding maximum', function() {
        const smallMaxValidator = new InputValidator({ maxAmount: '1000' });
        TestRunner.expect(function() { smallMaxValidator.validateAmount('1001'); }).toThrow('exceeds maximum');
    });

    TestRunner.it('should accept custom minimum amount', function() {
        const customValidator = new InputValidator({ minAmount: '100' });
        const result = customValidator.validateAmount('100');
        TestRunner.expect(result).toBe('100');
    });
});

// ============================================
// InputValidator - XSS Sanitization Tests
// ============================================
TestRunner.describe('InputValidator - XSS Sanitization', function() {
    const validator = new InputValidator();

    TestRunner.it('should sanitize script tags', function() {
        const result = validator.sanitizeText('<script>alert(1)</script>');
        TestRunner.expect(result).toContain('&lt;script&gt;');
        TestRunner.expect(result).not.toContain('<script>');
    });

    TestRunner.it('should sanitize HTML entities - less than', function() {
        const result = validator.sanitizeText('<div>');
        TestRunner.expect(result).toContain('&lt;');
    });

    TestRunner.it('should sanitize HTML entities - greater than', function() {
        const result = validator.sanitizeText('>test');
        TestRunner.expect(result).toContain('&gt;');
    });

    TestRunner.it('should sanitize HTML entities - ampersand', function() {
        const result = validator.sanitizeText('test & test');
        TestRunner.expect(result).toContain('&amp;');
    });

    TestRunner.it('should sanitize HTML entities - quotes', function() {
        const result = validator.sanitizeText('"test"');
        TestRunner.expect(result).toContain('&quot;');
    });

    TestRunner.it('should sanitize HTML entities - single quotes', function() {
        const result = validator.sanitizeText("'test'");
        TestRunner.expect(result).toContain('&#x27;');
    });

    TestRunner.it('should handle safe text unchanged', function() {
        const result = validator.sanitizeText('Hello World 123');
        TestRunner.expect(result).toBe('Hello World 123');
    });

    TestRunner.it('should return empty string for non-string input', function() {
        const result = validator.sanitizeText(12345);
        TestRunner.expect(result).toBe('');
    });

    TestRunner.it('should return empty string for null', function() {
        const result = validator.sanitizeText(null);
        TestRunner.expect(result).toBe('');
    });
});

// ============================================
// RateLimiter Tests
// ============================================
TestRunner.describe('RateLimiter - Basic Functionality', function() {
    TestRunner.it('should allow first request', function() {
        const limiter = new RateLimiter({ maxRequestsPerAddress: 5 });
        const result = limiter.checkRequest('0x111');
        TestRunner.expect(result).toBe(true);
        limiter.destroy();
    });

    TestRunner.it('should allow requests within limit', function() {
        const limiter = new RateLimiter({ maxRequestsPerAddress: 5 });
        for (let i = 0; i < 3; i++) {
            TestRunner.expect(limiter.checkRequest('0x222')).toBe(true);
        }
        limiter.destroy();
    });

    TestRunner.it('should block requests exceeding limit', function() {
        const limiter = new RateLimiter({ maxRequestsPerAddress: 3 });
        limiter.checkRequest('0x333');
        limiter.checkRequest('0x333');
        limiter.checkRequest('0x333');
        TestRunner.expect(function() { limiter.checkRequest('0x333'); }).toThrow('Rate limit exceeded');
        limiter.destroy();
    });

    TestRunner.it('should track different addresses separately', function() {
        const limiter = new RateLimiter({ maxRequestsPerAddress: 2 });
        limiter.checkRequest('0xAAA');
        limiter.checkRequest('0xAAA');
        // 0xAAA is now at limit
        TestRunner.expect(limiter.checkRequest('0xBBB')).toBe(true); // Different address
        limiter.destroy();
    });

    TestRunner.it('should enforce block after rate limit exceeded', function() {
        const limiter = new RateLimiter({ maxRequestsPerAddress: 2 });
        try {
            limiter.checkRequest('0x444');
            limiter.checkRequest('0x444');
            limiter.checkRequest('0x444');
        } catch (e) {}

        TestRunner.expect(function() { limiter.checkRequest('0x444'); }).toThrow('blocked');
        limiter.destroy();
    });

    TestRunner.it('should manually block address', function() {
        const limiter = new RateLimiter();
        limiter.blockAddress('0x555');
        TestRunner.expect(function() { limiter.checkRequest('0x555'); }).toThrow('blocked');
        limiter.destroy();
    });

    TestRunner.it('should return stats for address', function() {
        const limiter = new RateLimiter();
        limiter.checkRequest('0x666');
        const stats = limiter.getStats('0x666');
        TestRunner.expect(stats).toBeTruthy();
        TestRunner.expect(stats.count).toBe(1);
        limiter.destroy();
    });

    TestRunner.it('should return null for unknown address stats', function() {
        const limiter = new RateLimiter();
        const stats = limiter.getStats('0x777');
        TestRunner.expect(stats).toBe(null);
        limiter.destroy();
    });

    TestRunner.it('should handle requests without address (global only)', function() {
        const limiter = new RateLimiter();
        const result = limiter.checkRequest(null);
        TestRunner.expect(result).toBe(true);
        limiter.destroy();
    });
});

// ============================================
// Integration Tests
// ============================================
TestRunner.describe('Integration Tests', function() {
    TestRunner.it('should validate address then check rate limit', function() {
        const validator = new InputValidator();
        const limiter = new RateLimiter({ maxRequestsPerAddress: 5 });
        
        const address = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
        validator.validateAddress(address);
        const result = limiter.checkRequest(address);
        
        TestRunner.expect(result).toBe(true);
        limiter.destroy();
    });

    TestRunner.it('should reject invalid address before rate limiting', function() {
        const validator = new InputValidator();
        const limiter = new RateLimiter();
        
        const address = '0x0000000000000000000000000000000000000000';
        let rejected = false;
        
        try {
            validator.validateAddress(address);
            limiter.checkRequest(address);
        } catch (e) {
            rejected = true;
        }
        
        TestRunner.expect(rejected).toBe(true);
        limiter.destroy();
    });

    TestRunner.it('should sanitize then validate flow', function() {
        const validator = new InputValidator();
        
        const maliciousInput = '<script>steal()</script>';
        const sanitized = validator.sanitizeText(maliciousInput);
        
        TestRunner.expect(sanitized).not.toContain('<script>');
        TestRunner.expect(sanitized).toContain('&lt;');
    });

    TestRunner.it('should log violations', function() {
        const validator = new InputValidator();
        
        try { validator.validateAddress('invalid'); } catch (e) {}
        try { validator.validateAmount('abc'); } catch (e) {}
        
        const log = validator.getViolationLog();
        TestRunner.expect(log.length).toBeGreaterThan(0);
    });
});

// Run summary
const success = TestRunner.summary();

if (typeof process !== 'undefined' && process.exit) {
    process.exit(success ? 0 : 1);
}
