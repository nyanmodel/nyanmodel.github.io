import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import { AuthProvider } from './features/auth/AuthProvider';
import { App } from './app/App';
import './styles/globals.css';
// Updates activate on a later launch; never reload an in-progress photo form.
registerSW({ immediate: true });
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><HashRouter><AuthProvider><App /></AuthProvider></HashRouter></React.StrictMode>);
