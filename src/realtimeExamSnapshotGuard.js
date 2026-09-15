// Prevent legacy full-tenant CBT snapshot refreshes from being triggered by SSE.
// Modern CBT monitoring already receives micro-events (progress/heartbeat/violation/
// finish/presence) and uses /api/exams/:examId/monitor for explicit/fallback pulls.
// Keeping the legacy activeExamSessions state-update event alive here would cause
// appScript.js to fetch /api/exam-monitoring-state, which includes large answer,
// question, grade and monitoring maps and can overwhelm a browser after soak tests.
(() => {
    const NativeEventSource = window.EventSource;
    if (!NativeEventSource || window.__madrasahExamSnapshotGuardInstalled) return;

    const nativeOnMessageDescriptor = Object.getOwnPropertyDescriptor(NativeEventSource.prototype, 'onmessage');
    if (!nativeOnMessageDescriptor || typeof nativeOnMessageDescriptor.set !== 'function') return;

    function shouldSuppress(event) {
        try {
            const payload = JSON.parse(event?.data || 'null');
            return payload?.type === 'state-update' && payload?.key === 'activeExamSessions';
        } catch (_) {
            return false;
        }
    }

    function GuardedEventSource(url, eventSourceInitDict) {
        const source = new NativeEventSource(url, eventSourceInitDict);
        let userHandler = null;

        try {
            Object.defineProperty(source, 'onmessage', {
                configurable: true,
                enumerable: true,
                get() {
                    return userHandler;
                },
                set(handler) {
                    userHandler = typeof handler === 'function' ? handler : null;
                    const wrapped = userHandler
                        ? function(event) {
                            if (shouldSuppress(event)) return;
                            return userHandler.call(source, event);
                        }
                        : null;
                    nativeOnMessageDescriptor.set.call(source, wrapped);
                }
            });
        } catch (_) {
            // If a browser refuses the instance property override, leave the native
            // EventSource behavior untouched rather than risking realtime breakage.
        }

        return source;
    }

    GuardedEventSource.prototype = NativeEventSource.prototype;
    Object.setPrototypeOf(GuardedEventSource, NativeEventSource);

    try {
        window.EventSource = GuardedEventSource;
        window.__madrasahExamSnapshotGuardInstalled = true;
    } catch (_) {}
})();
