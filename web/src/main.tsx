import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppRouter } from './app/router';
import { AppProviders } from './app/providers';
import './styles/global.less';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AppProviders><AppRouter /></AppProviders>
    </BrowserRouter>
  </StrictMode>,
);
