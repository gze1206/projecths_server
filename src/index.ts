import * as http from "http";
import * as socketIO from "socket.io";
import * as config from "../config.js";
import Axios from "axios";
import { SessionManager } from "./ingame/sessionManager";
import { ExtendedSocket } from "./customSocket";

function RunServer(port: number) {
    const server = http.createServer();
    const io = socketIO(server);

    Axios.defaults.baseURL = config.api;

    server.listen(port, () => {
        console.log(`Start server : listen port ${port}`);
        // const session = new Session(io);
        SessionManager.Instance.Server = io;
    });

    io.on('connection', so => {
        const socket = <ExtendedSocket>so;
        console.log('conn', socket.id);

        socket.on('match', msg => {
            socket.username = msg.name;
            console.log(socket.id, '->', socket.username);
            SessionManager.Instance.DoMatching(socket);
        });

        socket.on('disconnect', msg => {
            console.log('disconn', msg);
            console.log('sessionID : ', socket.sessionID);
            SessionManager.Instance.CancelMatch(socket);
            if (socket.session) {
                socket.session.Leave(socket);
            }
        });
    })
}

RunServer(config.port);