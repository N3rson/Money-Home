import { render } from 'preact';
import './styles/fonts.css';
import './styles/app.css';
import { App } from './app';

render(<App />, document.getElementById('app')!);
