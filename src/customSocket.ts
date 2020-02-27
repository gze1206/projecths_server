import { Socket } from "socket.io";
import Shop from "./ingame/shop";
import { Session } from "./ingame/session";

export interface ExtendedSocket extends Socket {
    username: string;
    sessionID: string;
    session: Session;
}