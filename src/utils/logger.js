 // Mobile-friendly logger utility
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

export const logger = {
  log: (...args) => {
    if (isMobile) {
      // For mobile devices, we'll create a visible log on screen
      const logContainer = document.getElementById('mobile-logs') || createLogContainer();
      const logEntry = document.createElement('div');
      logEntry.style.padding = '8px';
      logEntry.style.borderBottom = '1px solid #eee';
      logEntry.style.fontSize = '12px';
      logEntry.style.color = '#333';
      logEntry.textContent = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      logContainer.appendChild(logEntry);
      // Keep only last 50 logs
      while (logContainer.children.length > 50) {
        logContainer.removeChild(logContainer.firstChild);
      }
    }
    // Still log to console for development
    console.log(...args);
  },

  error: (...args) => {
    if (isMobile) {
      const logContainer = document.getElementById('mobile-logs') || createLogContainer();
      const logEntry = document.createElement('div');
      logEntry.style.padding = '8px';
      logEntry.style.borderBottom = '1px solid #eee';
      logEntry.style.fontSize = '12px';
      logEntry.style.color = '#ff0000';
      logEntry.textContent = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      logContainer.appendChild(logEntry);
      while (logContainer.children.length > 50) {
        logContainer.removeChild(logContainer.firstChild);
      }
    }
    console.error(...args);
  }
};

function createLogContainer() {
  const container = document.createElement('div');
  container.id = 'mobile-logs';
  container.style.position = 'fixed';
  container.style.bottom = '0';
  container.style.left = '0';
  container.style.right = '0';
  container.style.maxHeight = '200px';
  container.style.overflowY = 'auto';
  container.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
  container.style.zIndex = '9999';
  container.style.padding = '8px';
  container.style.fontFamily = 'monospace';
  container.style.boxShadow = '0 -2px 10px rgba(0,0,0,0.1)';
  document.body.appendChild(container);
  return container;
}