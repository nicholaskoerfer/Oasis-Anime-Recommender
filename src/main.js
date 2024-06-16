import './css/global.css';
import App from './App.svelte';
import { isAndroid } from './js/others/helper';

try{
	if (!isAndroid()) {
		const channel = new BroadcastChannel('tab');
		channel.postMessage('changed-tab');
		channel.addEventListener('message', (msg) => {
			if (msg.data === 'changed-tab') {
				const url = "https://kanshi.changed.tab"
				try{
					window.location.href = url
				}catch{}
				try{
					window.open(url, '_self')
				}catch{}
			}
		});
	}
}catch{}

const app = new App({
	target: document.body
});

export default app;
