/**
 * Tests for non-Gemini provider auto-detection (issue #1201)
 * and Vertex AI auto-detection
 *
 * When requests are routed to non-Gemini providers,
 * or when running on Google Vertex AI, OMG should
 * auto-enable forceInherit to avoid passing Gemini-specific model tier
 * names (pro/ultra/flash) that might cause errors on other backends.
 */
export {};
//# sourceMappingURL=non-gemini-provider-detection.test.d.ts.map