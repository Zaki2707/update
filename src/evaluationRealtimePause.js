// EVALUATION_REALTIME_PAUSE_V1
// The Evaluasi page already refreshes its own server snapshot on a slow interval.
// Pausing the generic SSE state sync here prevents hundreds of activeExamSessions
// invalidations from competing with Preview/Koreksi requests after large CBT runs.
(() => {
  let pausedForEvaluation = false;

  function evaluationIsOpen() {
    const state = window.appState || {};
    return state.currentRoute === 'asesmen' && state.lastAssessmentSubTab === 'evaluasi';
  }

  function reconcileRealtimeMode() {
    const shouldPause = evaluationIsOpen();

    if (shouldPause && !pausedForEvaluation) {
      if (typeof window.__stopRealtimeSync === 'function') {
        window.__stopRealtimeSync();
      }
      pausedForEvaluation = true;
      return;
    }

    if (!shouldPause && pausedForEvaluation) {
      pausedForEvaluation = false;
      if (
        window.__onlineRuntimeReady === true &&
        window.appState &&
        window.appState.currentUser &&
        typeof window.initRealtimeSync === 'function'
      ) {
        window.initRealtimeSync();
      }
    }
  }

  window.__evaluationRealtimePauseTimer = window.setInterval(reconcileRealtimeMode, 750);
  window.addEventListener('beforeunload', () => {
    if (window.__evaluationRealtimePauseTimer) {
      window.clearInterval(window.__evaluationRealtimePauseTimer);
      window.__evaluationRealtimePauseTimer = null;
    }
  });
})();
