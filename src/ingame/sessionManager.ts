import * as conf from "../../config.js";
import { Session } from "./session";
import { ExtendedSocket } from "../customSocket";
import { v4 as uuid } from "uuid";
import { Server } from "socket.io";

export class SessionManager {
    //#region Singleton
    private static instance: SessionManager = null;
    public static get Instance() : SessionManager {
        if (SessionManager.instance == null) SessionManager.instance = new SessionManager();
        return SessionManager.instance;
    }
    //#endregion

    private io: Server;
    private nowMatching: ExtendedSocket[] = [];
    private sessions: { [id: string]: Session } = {};

    constructor() {
        setInterval(() => this.update(), 1000);
    }

    public set Server(val: Server) {
        this.io = val;
    }

    public DoMatching(cli: ExtendedSocket) {
        this.nowMatching.push(cli);
    }

    public CancelMatch(cli: ExtendedSocket) {
        this.nowMatching = this.nowMatching.filter(iter => cli.id !== iter.id);
    }

    private update() {
        const waitings = this.nowMatching.length;
        const max = conf.matching.max;
        const min = conf.matching.min;
        // console.log("REMAIN WAITING : ", this.nowMatching.length);
        if (waitings < min) return;

        // 그냥 먼저 매칭한 순서대로
        if (waitings >= max) {
            this.MakeSession(this.nowMatching.splice(0, max));
            return this.update();
        }
    }

    private MakeSession(members: ExtendedSocket[]) : Session {
        const newID = uuid();
        // 혹시 ID 중복이면 새로 생성
        if (this.sessions[newID]) {
            return this.MakeSession(members);
        }
        const session = new Session(newID, members, this.io);
        this.sessions[newID] = session;
        return session;
    }

    public CloseSession(session: Session) {
        const id = session.ID;
        console.log('Close session', id);
        this.sessions[id] = null;
    }
}