import React from 'react';
import ReactDOM from 'react-dom/client';
import { AdminApp } from './AdminApp';
import '../index.css';
import './admin.css';
import { initAnalytics } from '../analytics';

initAnalytics('admin');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AdminApp />
  </React.StrictMode>
);
