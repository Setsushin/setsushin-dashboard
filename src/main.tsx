import { createRoot } from 'react-dom/client';
import { installDemoMode } from './demo';
import './styles/tokens.css';
import './styles/styles.css';
import './styles/edit-mode.css';
import './widgets';
import { App } from './App';

// Patch fetch for guest demo mode before any widget requests (no-op otherwise).
installDemoMode();

const root = document.getElementById('root');
if (root) createRoot(root).render(<App />);
