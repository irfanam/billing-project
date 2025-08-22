import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { SettingsProvider } from './context/SettingsContext';
import './index.css'

createRoot(document.getElementById('root')).render(
	<React.StrictMode>
		<SettingsProvider>
			<App />
		</SettingsProvider>
	</React.StrictMode>
)
