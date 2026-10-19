import { render } from 'preact';
import { createGame } from './game/createGame.ts';
import { App } from './ui/App.tsx';
import './styles.css';

createGame(document.getElementById('game')!);
render(<App />, document.getElementById('ui')!);
