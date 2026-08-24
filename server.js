const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'ПЕРЕХВАТ_FINAL.html'));
});

io.on('connection', (socket) => {
    console.log('Игрок подключился:', socket.id);

    socket.on('create_lobby', () => {
        const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        socket.join(roomCode);
        socket.emit('lobby_created', roomCode);
        console.log(`Лобби создано: ${roomCode}`);
    });

    socket.on('join_lobby', (code) => {
        const room = io.sockets.adapter.rooms.get(code);
        if (room && room.size < 3) {
            socket.join(code);
            socket.emit('joined_lobby', code);
            io.to(code).emit('player_joined', room.size + 1);
            console.log(`Игрок ${socket.id} присоединился к ${code}`);
            
            if (room.size === 2) {
                setTimeout(() => {
                    startGame(code);
                }, 1000);
            }
        } else {
            socket.emit('error', 'Лобби не найдено или заполнено');
        }
    });

    function startGame(roomCode) {
        const room = io.sockets.adapter.rooms.get(roomCode);
        if (!room) return;
        
        const players = Array.from(room);
        const roles = ['agent', 'fsb'];
        
        // Перемешиваем роли
        for (let i = roles.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [roles[i], roles[j]] = [roles[j], roles[i]];
        }
        
        io.to(roomCode).emit('game_started', {
            roles: players.reduce((acc, pid, i) => {
                acc[pid] = roles[i];
                return acc;
            }, {})
        });
        
        console.log(`Игра началась в ${roomCode}`);
    }

    socket.on('transmit_packet', (data) => {
        socket.to(data.roomCode).emit('packet_intercepted', data);
    });

    socket.on('submit_guess', (data) => {
        io.to(data.roomCode).emit('guess_submitted', data);
    });

    socket.on('round_end', (data) => {
        io.to(data.roomCode).emit('round_end', data);
    });

    socket.on('disconnect', () => {
        console.log('Игрок отключился:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
    console.log(`Откройте http://localhost:${PORT}`);
});
