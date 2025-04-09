// src/index.js
import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import ReactWalletsProvider from './Conectores/ReactWalletsProvider';

ReactDOM.render(
  <React.StrictMode>
    <ReactWalletsProvider>
      <App />
    </ReactWalletsProvider>
  </React.StrictMode>,
  document.getElementById('root')
);
