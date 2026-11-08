import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './styles.css';
import './dark-theme.css';

document.documentElement.dataset.theme = 'dark';
document.documentElement.classList.add('dark');
document.documentElement.style.colorScheme = 'dark';
window.localStorage.removeItem('tadafuq-theme');

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
