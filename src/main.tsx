import { render } from 'preact';
import './styles/fonts.css';
import './styles/app.css';
import { App } from './app';

// The prototype runs inside a host that already pads for the status bar;
// the real app (Android, iPhone home screen) pads itself.
if (!__PROTOTYPE__) document.documentElement.classList.add('own-insets');

render(<App />, document.getElementById('app')!);
