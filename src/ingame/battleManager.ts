import { Session } from "./session";
import { Entity } from "../data/entity";
import { ExtendedSocket } from "../customSocket";
import { Tag, DmgType } from "../data/enums";
import { IDamageHandler } from "../eventHandler";

class BattlePair {
    public first: ExtendedSocket;
    public second: ExtendedSocket;
}

export class BattleManager {
    private session: Session;
    private pairs: BattlePair[];

    constructor(session: Session) {
        this.session = session;
    }

    public get Pairs() : BattlePair[] {
        return this.pairs;
    }

    public CalcPairs(sockets: ExtendedSocket[]) : BattlePair[] {
        const arr: BattlePair[] = [];
        for (let i = 0, max = sockets.length; i < max; i+=2) {
            const a = sockets[i];
            const b = (i >= sockets.length) ? null : sockets[i+1];
            arr.push({
                first: a,
                second: b,
            });
        }
        this.pairs = arr;
        return arr;
    }

    public FindTarget(arr: Entity[]) : Entity {
        if (arr.length === 0) return null;
        const taunts = arr.filter(e => e.HasTag(Tag.TAUNT));
        if (taunts.length > 0) return this.PickRandom(taunts);
        return this.PickRandom(arr);
    }

    private PickRandom(arr: Entity[]) : Entity {
        if (arr.length === 0) return null;
        const idx = Math.floor(Math.random() * arr.length);
        console.log('RANDOM IDX : ', idx);
        return arr[idx];
    }

    public Attack(from: Entity, to: Entity) {
        from.DamageTo(to, from.CalcStat.Attack);
        to.DamageTo(from, to.CalcStat.Attack, DmgType.COUNTER);
    }

    public Process(a: ExtendedSocket, b: ExtendedSocket) : ExtendedSocket {
        const af = a == null ? [] : this.session.Field(a).Entities;
        const bf = b == null ? [] : this.session.Field(b).Entities;

        const backupA = [...af];
        const backupB = [...bf];

        const rollback = () => {
            af.splice(0, af.length);
            af.push(...backupA);
            bf.splice(0, bf.length);
            bf.push(...backupB);
            console.log('rollback', af.length, bf.length)
        };

        let aIsFirst = (af.length > bf.length) ? true :
                        (bf.length > af.length) ? false :
                        (Math.random() <= 0.5) ? true : false;
        console.log(`FIRST IS ${aIsFirst ? a?.username : b?.username}`);
        const first: Entity[] = aIsFirst ? af : bf;
        const second: Entity[] = aIsFirst ? bf : af;

        let attacker = { arr: first, nextIDX: 0 };
        let defencer = { arr: second, nextIDX: 0 };
        let target: Entity = null;

        const handler: IDamageHandler = {
            onAttack: () => {},
            onDamaged: (sender: Entity, by: Entity, dmg: number, type: DmgType) => {
                const data = {
                    phase: 'damaged',
                    atkOwner: by.Socket.username,
                    atk: by.CardName,
                    targetOwner: sender.Socket.username,
                    target: sender.CardName,
                    dmg: dmg,
                    type: DmgType[type],
                };
                a.emit('battle', data);
                b.emit('battle', data);
            },
            onGuard: (sender: Entity, by: Entity, dmg: number, type: DmgType) => {
                const data = {
                    phase: 'guard',
                    atkOwner: by.Socket.username,
                    atk: by.CardName,
                    targetOwner: sender.Socket.username,
                    target: sender.CardName,
                    dmg: dmg,
                    type: DmgType[type],
                };
                a.emit('battle', data);
                b.emit('battle', data);
            },
            onKilled: () => {},
            onDead: (sender: Entity) => {
                if (sender.Socket.id === a.id) {
                    const idx = af.findIndex(e => e.ID === sender.ID);
                    af.splice(idx, 1);
                } else if (sender.Socket.id === b.id) {
                    const idx = bf.findIndex(e => e.ID === sender.ID);
                    bf.splice(idx, 1);
                } else return;
        
                console.log('Remain', af.length, bf.length);
                const data = {
                    phase: 'dead',
                    owner: sender.Socket.username,
                    entity: sender.CardName,
                };
                a.emit('battle', data);
                b.emit('battle', data);

                if (attacker.arr.length === 0) return;
                const idx = attacker.nextIDX % attacker.arr.length;
                const atk = attacker.arr[idx];
                if (sender.ID === atk.ID) {
                    attacker.nextIDX--;
                }
            },
        };
        this.session.damageEvent.On(handler);

        let atkCount = 0, maxAtk = 1;
        while (true) {
            if (attacker.arr.length === 0) break;
            target = this.FindTarget(defencer.arr);
            if (target == null) break;

            const idx = attacker.nextIDX % attacker.arr.length;
            const atk = attacker.arr[idx];
            if (atk.CalcStat.HP <= 0) continue;

            maxAtk = atk.HasTag(Tag.WINDFURY) ? 2 : 1;

            atkCount++;
            const data = {
                phase: 'attack',
                atkOwner: atk.Socket.username,
                atk: atk.CardName,
                targetOwner: target.Socket.username,
                target: target.CardName,
            };
            a.emit('battle', data);
            b.emit('battle', data);

            this.Attack(atk, target);
            if (atkCount >= maxAtk) {
                atkCount = 0;
                attacker.nextIDX = idx+1;
                
                const temp = defencer;
                defencer = attacker;
                attacker = temp;
            }
        }
        this.session.damageEvent.Off(handler);
        this.session.damageEvent.CleanUp();

        const diff = Math.abs(af.length - bf.length);
        if (diff == 0) {
            rollback();
            return null;
        }
        const heroA = this.session.Hero(a);
        const heroB = this.session.Hero(b);

        const sumTier = (prev: number, cur: Entity) => {
            prev += cur.Tier;
            return prev;
        }
        const reportDmg = (atk: ExtendedSocket, target: ExtendedSocket, dmg: number) => {
            const data = {
                phase: 'hero_damaged',
                atk: atk.username,
                target: target.username,
                dmg: dmg,
            };
            a.emit('battle', data);
            b.emit('battle', data);
        }

        if (af.length > 0) {
            const dmg = af.reduce(sumTier, heroA.UpgradeLevel);
            rollback();
            heroA.DamageTo(heroB, dmg);
            reportDmg(a, b, dmg);
            return a;
        }
        if (bf.length > 0) {
            const dmg = bf.reduce(sumTier, heroB.UpgradeLevel);
            rollback();
            heroB.DamageTo(heroA, dmg);
            reportDmg(b, a, dmg);
            return b;
        }

    }

}