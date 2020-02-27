import { Entity, Status } from "./entity";
import { Card } from "./card";
import { HeroPower } from "./heroPower";

class HeroStatus extends Status {
    public upgradeCost: number;
    public upgradeLevel: number;

    public maxGold: number;
    public curGold: number;

    public goldLimit: number;
    public buyPrice: number;
    public sellPrice: number;
    public refreshPrice: number;
    public freezePrice: number;
}

export class Hero extends Entity {
    private power: HeroPower;
    private isAlive: boolean;

    constructor(from: Card) {
        super(from);
        const eff = JSON.parse(from.effect);
        if (eff.STAT) {
            const stat = <HeroStatus>this.stat;
            if (eff.STAT.gold) {
                stat.maxGold = stat.curGold = eff.STAT.gold;
            }
            // console.log(stat);
            this.stat = <HeroStatus>stat;
        }
        this.RecalcStat();
        this.isAlive = true;
    }

    public get IsAlive() : boolean {
        return this.isAlive;
    }

    public SetAlive(val: boolean) {
        this.isAlive = val;
    }

    public get Power() : HeroPower {
        return this.power;
    }

    public set Power(power: HeroPower) {
        power.Socket = this.Socket;
        power.Init();
        this.power = power;
    }

    public get UpgradeLevel() : number {
        return (<HeroStatus>this.calcStat).upgradeLevel;
    }

    public get UpgradeCost() : number {
        return (<HeroStatus>this.calcStat).upgradeCost;
    }

    public set UpgradeCost(cost: number) {
        (<HeroStatus>this.stat).upgradeCost = cost;
    }

    public get MaxGold() {
        return (<HeroStatus>this.calcStat).maxGold;
    }

    public get Gold() {
        return (<HeroStatus>this.calcStat).curGold;
    }

    public get GoldLimit() {
        return (<HeroStatus>this.calcStat).goldLimit;
    }

    public get BuyPrice() {
        return (<HeroStatus>this.calcStat).buyPrice;
    }

    public get SellPrice() {
        return (<HeroStatus>this.calcStat).sellPrice;
    }

    public get RefreshPrice() {
        return (<HeroStatus>this.calcStat).refreshPrice;
    }

    public get FreezePrice() {
        return (<HeroStatus>this.calcStat).freezePrice;
    }

    public Upgrade() {
        (<HeroStatus>this.stat).upgradeLevel++;
        this.RecalcStat();
        this.Socket.session.upgradeEvent.Process(h => h.onUpgrade(this));
    }

    public AddMaxGold(amount: number) {
        const stat = <HeroStatus>this.stat;
        stat.maxGold += amount;
        if (stat.maxGold > stat.goldLimit) {
            stat.maxGold = stat.goldLimit;
        }
        this.RecalcStat();
    }

    public AddGold(amount: number) {
        const stat = <HeroStatus>this.stat;
        stat.curGold += amount;
        if (stat.curGold > stat.goldLimit) {
            stat.curGold = stat.goldLimit;
        }
        this.RecalcStat();
    }

    public RefillGold() {
        const stat = <HeroStatus>this.stat;
        stat.curGold = stat.maxGold;
        this.RecalcStat();
    }

    public DecreaseUpgradeCost(amount: number) {
        const stat = <HeroStatus>this.stat;
        if (stat.upgradeCost <= 0) return;

        stat.upgradeCost -= amount;
        this.RecalcStat();
    }
}