// Diagnostic tool removed. No-op placeholder to avoid runtime errors.
// If you need a diagnostic tool again, reintroduce a secure implementation
// for development only and do not expose it in production builds.

// Keep a safe no-op function in case legacy code calls it.
window.runFirebaseDiagnostic = function() {
    console.log('runFirebaseDiagnostic() called but diagnostic tool was removed.');
    return Promise.resolve();
};
