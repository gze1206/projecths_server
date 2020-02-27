import { Session } from "../../ingame/session";
import { Entity } from "../entity";
import { Card } from "../card";

export abstract class CardAction {
    private session: Session;
    private entity: Entity;

    constructor(session: Session, entity: Entity) {
        this.session = session;
        this.entity = entity;
        this.Init();
    }

    abstract Init();

    protected IsMine(entity: Entity) : boolean {
        if (entity == null) return false;
        return entity.Socket.id === this.entity.Socket.id;
    }

    protected GetCardByID(id: number) : Card {
        const result = this.Session.GetCards(c => c.id === id);
        if (result == null || result.length == 0) return null;
        return result[0];
    }

    protected GetRandomOf<T>(arr: T[]) : T {
        if (arr.length === 0) return null;
        if (arr.length === 1) return arr[0];
        return arr[Math.floor(Math.random() * arr.length)];
    }

    public get Session() : Session {
        return this.session;
    }

    public get Entity() : Entity {
        return this.entity;
    }
}