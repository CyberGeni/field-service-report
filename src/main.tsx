import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import App from './App.tsx';
import './index.css';
import { ToastProvider } from './components/ui/toast';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Follows the phone's "reduce motion" setting: slides and springs become fades */}
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <App />
      </ToastProvider>
    </MotionConfig>
  </StrictMode>
);
