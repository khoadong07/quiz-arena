import { io } from 'socket.io-client';

const isProd = import.meta.env.PROD;
const URL = isProd ? window.location.origin : `http://${window.location.hostname}:3001`;

export const socket = io(URL, { 
    autoConnect: false,
    transports: ['websocket', 'polling']
});
