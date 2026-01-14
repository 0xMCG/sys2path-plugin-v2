import ReactDOM from 'react-dom/client';
import { FullscreenWorkbench } from './components/FullscreenWorkbench';
import '../index.css';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(<FullscreenWorkbench />);
