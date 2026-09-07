// Robust fetch response .json() fallback for non-JSON or HTML responses
const originalFetchJson = Response.prototype.json;
Response.prototype.json = async function () {
  const clone = this.clone();
  try {
    return await originalFetchJson.call(this);
  } catch (err) {
    const text = await clone.text().catch(() => "");
    console.warn("Caught non-JSON response in fetch .json():", text);
    const cleanMsg = text && text.length < 200 && !text.includes("<html") ? text : "Gagal memproses respon server. Silakan coba kembali.";
    return { success: false, message: cleanMsg };
  }
};

import './index.css';
import './appScript.js';
import './modulesScript.js';
import './adminModules.js';
import './cbtModules.js';
import './pedagogyNonAIEngine.js';
import './modulAjarModule.js';
import './settingsAndMisc.js';
import './assessmentModule.js';
import './chatModule.js';
import './calendarModule.js';
import './bossModule.js';
import './gameModule.js';
import './lkpdModule.js';

// Smoothly dismiss the initial preloader once all styles and scripts are loaded
function removeInitialPreloader() {
  const preloader = document.getElementById('app-initial-loader');
  if (preloader) {
    preloader.classList.add('loaded');
    setTimeout(() => {
      try { preloader.remove(); } catch (_) {}
    }, 400);
  }
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  requestAnimationFrame(removeInitialPreloader);
} else {
  window.addEventListener('DOMContentLoaded', removeInitialPreloader);
  window.addEventListener('load', removeInitialPreloader);
}
// Guaranteed fallback so it never gets stuck
setTimeout(removeInitialPreloader, 1200);


