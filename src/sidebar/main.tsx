import ReactDOM from 'react-dom/client';
import { Workbench } from './components/Workbench';
import '../index.css';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <Workbench mode="sidebar" />
);

