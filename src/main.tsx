import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './style.css';
import { ShopWindow } from './RoomControls';

createRoot(document.getElementById('root')!).render(<StrictMode>{location.hash === '#shop' ? <ShopWindow /> : <App />}</StrictMode>);
