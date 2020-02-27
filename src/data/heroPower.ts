import { Card } from "./card";
import { Entity } from "./entity";

export class HeroPower extends Entity {
    private isUsed: boolean;
    private cost: number;

    constructor(card: Card) {
        super(card);
        this.card = card;
        this.cost = card.cost;
    }

    public Init() {
        this.isUsed = false;
    }

    public Do() {
        this.isUsed = true;
    }

    public get Card() : Card {
        return this.card;
    }
    public get IsUsed() : boolean {
        return this.isUsed;
    }

    public get Cost() : number {
        return this.cost;
    }
}