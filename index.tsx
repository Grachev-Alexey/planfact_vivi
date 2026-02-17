import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

document.addEventListener('wheel', (e) => {
  const el = document.activeElement;
  if (el && el instanceof HTMLInputElement && el.type === 'number') {
    el.blur();
  }
}, { passive: true });

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
