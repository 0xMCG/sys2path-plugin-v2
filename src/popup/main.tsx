import React from 'react';
import ReactDOM from 'react-dom/client';
import { SettingsDialog } from './components/SettingsDialog';
import '../index.css';
import './popup.css';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <SettingsDialog />
  </React.StrictMode>
);
