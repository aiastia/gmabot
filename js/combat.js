// 战斗系统

class CombatSystem {
    constructor() {
        this.logs = [];       // 战斗日志
        this.maxLogs = 50;    // 最大日志数
        this.floatingTexts = []; // 浮动伤害数字
    }
    
    // 执行所有行动（同时结算）
    resolveActions(actions, grid, itemManager) {
        const newLogs = [];
        
        // 先处理移动和拾取，再处理战斗
        const moveActions = actions.filter(a => a.type === 'move');
        const pickActions = actions.filter(a => a.type === 'pick');
        const attackActions = actions.filter(a => a.type === 'attack');
        
        // 1. 处理移动
        for (const action of moveActions) {
            this._resolveMove(action, grid);
        }
        
        // 2. 处理拾取
        for (const action of pickActions) {
            const log = this._resolvePick(action, itemManager);
            if (log) newLogs.push(log);
        }
        
        // 检查移动后是否踩到物品
        for (const action of moveActions) {
            if (action.entity.alive) {
                const item = itemManager.getItemAt(action.entity.x, action.entity.y);
                if (item) {
                    const log = this._autoPickup(action.entity, item, itemManager);
                    if (log) newLogs.push(log);
                }
            }
        }
        
        // 检查陷阱触发（不可见，踩到才触发，一次性）
        for (const action of moveActions) {
            if (action.entity.alive) {
                const trap = itemManager.checkTraps(action.entity);
                if (trap) {
                    if (trap.type === 'damage') {
                        // 伤害陷阱
                        const wasAlive = action.entity.alive;
                        action.entity.takeDamage(trap.damage);
                        this.floatingTexts.push({
                            x: action.entity.x * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2,
                            y: action.entity.y * CONFIG.CELL_SIZE,
                            text: `💥-${trap.damage}`,
                            color: '#FF4400',
                            life: 30,
                        });
                        newLogs.push({
                            turn: 0,
                            text: `💥 ${action.entity.name} 踩到伤害陷阱！(-${trap.damage}HP)`,
                            color: '#FF4400',
                            important: false,
                        });
                        if (wasAlive && !action.entity.alive) {
                            newLogs.push({
                                turn: 0,
                                text: `💀 ${action.entity.name} 被陷阱击杀！`,
                                color: '#FF4400',
                                important: true,
                            });
                        }
                    } else if (trap.type === 'slow') {
                        // 减速陷阱
                        action.entity.slowed = trap.slowTurns;
                        this.floatingTexts.push({
                            x: action.entity.x * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2,
                            y: action.entity.y * CONFIG.CELL_SIZE,
                            text: `🐌减速${trap.slowTurns}回合`,
                            color: '#88AAFF',
                            life: 35,
                        });
                        newLogs.push({
                            turn: 0,
                            text: `🐌 ${action.entity.name} 踩到减速陷阱！(减速${trap.slowTurns}回合)`,
                            color: '#88AAFF',
                            important: false,
                        });
                    }
                }
            }
        }
        
        // 3. 处理战斗（所有攻击同时结算）
        const combatResults = this._resolveAttacks(attackActions);
        newLogs.push(...combatResults.logs);
        
        // 4. 处理死亡
        for (const result of combatResults.results) {
            if (result.killed && result.victim.alive === false) {
                grid.addDeadZone(result.victim.x, result.victim.y);
                newLogs.push({
                    turn: 0,
                    text: `💀 ${result.victim.name} 被 ${result.killer.name} 击杀！`,
                    color: result.killer.color,
                    important: true,
                });
            }
        }
        
        // 更新日志
        this.logs = [...newLogs, ...this.logs].slice(0, this.maxLogs);
        
        return {
            logs: newLogs,
            deaths: combatResults.results.filter(r => r.killed),
        };
    }
    
    // 移动结算（带碰撞检测）
    _resolveMove(action, grid, allActions) {
        const entity = action.entity;
        const nx = entity.x + action.dx;
        const ny = entity.y + action.dy;
        
        if (action.dx === 0 && action.dy === 0) return; // 没有移动
        
        if (!grid.isWalkable(nx, ny)) return; // 墙壁阻挡
        
        entity.x = nx;
        entity.y = ny;
    }
    
    // 移动后碰撞分离（防止重叠）
    _separateEntities(entities) {
        const maxIterations = 3;
        for (let iter = 0; iter < maxIterations; iter++) {
            let hasOverlap = false;
            for (let i = 0; i < entities.length; i++) {
                const a = entities[i];
                if (!a.alive) continue;
                for (let j = i + 1; j < entities.length; j++) {
                    const b = entities[j];
                    if (!b.alive) continue;
                    if (a.x === b.x && a.y === b.y) {
                        hasOverlap = true;
                        // 把后一个实体推回原位（随机偏移）
                        const dirs = [
                            { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
                            { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
                        ].sort(() => Math.random() - 0.5);
                        let pushed = false;
                        for (const d of dirs) {
                            const tx = b.x + d.dx;
                            const ty = b.y + d.dy;
                            if (this._isWalkableAndEmpty(tx, ty, entities, b.id)) {
                                b.x = tx;
                                b.y = ty;
                                pushed = true;
                                break;
                            }
                        }
                        if (!pushed) {
                            // 推不开就把 a 推开
                            for (const d of dirs) {
                                const tx = a.x + d.dx;
                                const ty = a.y + d.dy;
                                if (this._isWalkableAndEmpty(tx, ty, entities, a.id)) {
                                    a.x = tx;
                                    a.y = ty;
                                    break;
                                }
                            }
                        }
                    }
                }
            }
            if (!hasOverlap) break;
        }
    }
    
    _isWalkableAndEmpty(x, y, entities, excludeId) {
        // 这里需要 grid 引用，简化为检查边界
        if (x < 0 || x >= CONFIG.GRID_COLS || y < 0 || y >= CONFIG.GRID_ROWS) return false;
        const occupied = entities.some(e => e.alive && e.id !== excludeId && e.x === x && e.y === y);
        return !occupied;
    }
    
    // 拾取结算
    _resolvePick(action, itemManager) {
        const entity = action.entity;
        const item = action.target;
        
        if (!item || item.collected) return null;
        
        const log = this._pickupItem(entity, item, itemManager);
        return log;
    }
    
    // 自动拾取（移动到物品上）
    _autoPickup(entity, item, itemManager) {
        return this._pickupItem(entity, item, itemManager);
    }
    
    // 统一的物品拾取处理
    _pickupItem(entity, item, itemManager) {
        if (item.type === 'food') {
            entity.heal(item.data.heal);
            entity.hunger = Math.min(100, entity.hunger + 30);
            itemManager.removeItem(item);
            return {
                turn: 0,
                text: `🍖 ${entity.name} 吃了食物 (HP+${item.data.heal})`,
                color: entity.color,
                important: false,
            };
        } else if (item.type === 'weapon') {
            const equipped = entity.equipWeapon(item.data);
            if (equipped) {
                itemManager.removeItem(item);
                return {
                    turn: 0,
                    text: `⚔️ ${entity.name} 拾取了 ${item.data.name} (攻击+${item.data.power})`,
                    color: entity.color,
                    important: false,
                };
            }
        } else if (item.type === 'armor') {
            const equipped = entity.equipArmor(item.data);
            if (equipped) {
                itemManager.removeItem(item);
                return {
                    turn: 0,
                    text: `🛡️ ${entity.name} 装备了 ${item.data.name} (防御+${item.data.defense})`,
                    color: entity.color,
                    important: false,
                };
            }
        } else if (item.type === 'boots') {
            const equipped = entity.equipBoots(item.data);
            if (equipped) {
                itemManager.removeItem(item);
                return {
                    turn: 0,
                    text: `👢 ${entity.name} 穿上了 ${item.data.name} (闪避${Math.floor(item.data.dodge*100)}%)`,
                    color: entity.color,
                    important: false,
                };
            }
        }
        return null;
    }
    
    // 战斗结算（同时攻击）
    _resolveAttacks(attackActions) {
        const logs = [];
        const results = [];
        const damageMap = new Map(); // entity -> totalDamage
        
        // 计算所有伤害
        for (const action of attackActions) {
            const attacker = action.entity;
            const target = action.target;
            
            if (!attacker.alive || !target || !target.alive) continue;
            
            // 检查距离（使用攻击范围）
            const dist = Grid.distance(attacker.x, attacker.y, target.x, target.y);
            if (dist > CONFIG.ATTACK_RANGE) continue;
            
            // 远距离攻击伤害衰减
            const rangePenalty = dist > 1 ? 0.7 : 1.0;
            
            // 计算伤害（基础攻击力 + 随机波动 + 距离衰减）
            const baseDmg = attacker.getAttackPower();
            const variance = Math.floor(Math.random() * 5) - 2; // -2 ~ +2
            const damage = Math.max(1, Math.floor((baseDmg + variance) * rangePenalty));
            
            // 记录伤害
            if (!damageMap.has(target)) {
                damageMap.set(target, []);
            }
            damageMap.get(target).push({ attacker, damage });
            
            // 添加浮动文字
            this.floatingTexts.push({
                x: target.x * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2,
                y: target.y * CONFIG.CELL_SIZE,
                text: `-${damage}`,
                color: '#FF4444',
                life: 30,
            });
        }
        
        // 同时结算所有伤害
        for (const [target, damages] of damageMap) {
            let totalRawDamage = 0;
            let lastAttacker = null;
            
            for (const { attacker, damage } of damages) {
                totalRawDamage += damage;
                lastAttacker = attacker;
            }
            
            const wasAlive = target.alive;
            const hitResult = target.takeDamage(totalRawDamage);
            
            if (hitResult.dodged) {
                // 闪避成功
                this.floatingTexts.push({
                    x: target.x * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2,
                    y: target.y * CONFIG.CELL_SIZE - 10,
                    text: '闪避!',
                    color: '#00DDFF',
                    life: 35,
                });
                logs.push({
                    turn: 0,
                    text: `💨 ${target.name} 闪避了 ${lastAttacker.name} 的攻击！`,
                    color: '#00DDFF',
                    important: false,
                });
            } else {
                const actualDmg = hitResult.actualDamage;
                const blocked = totalRawDamage - actualDmg;
                
                // 防御减伤浮动文字
                if (blocked > 0) {
                    this.floatingTexts.push({
                        x: target.x * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE / 2 + 12,
                        y: target.y * CONFIG.CELL_SIZE - 5,
                        text: `🛡-${blocked}`,
                        color: '#778899',
                        life: 25,
                    });
                }
                
                for (const { attacker, damage } of damages) {
                    logs.push({
                        turn: 0,
                        text: `⚔️ ${attacker.name} 攻击 ${target.name} 造成 ${damage} 伤害`,
                        color: attacker.color,
                        important: false,
                    });
                }
            }
            
            results.push({
                victim: target,
                killer: wasAlive && !target.alive ? lastAttacker : null,
                killed: wasAlive && !target.alive,
                damage: hitResult.actualDamage,
            });
            
            // 击杀计数 + 掠夺装备
            if (wasAlive && !target.alive && lastAttacker) {
                lastAttacker.kills++;
                // 掠夺被击杀者的装备
                const lootMsg = lastAttacker.lootFrom(target);
                if (lootMsg.length > 0) {
                    logs.push({
                        turn: 0,
                        text: `💰 ${lastAttacker.name} 掠夺了 ${target.name} 的 ${lootMsg.join(' ')}`,
                        color: '#FFD700',
                        important: true,
                    });
                }
            }
        }
        
        return { logs, results };
    }
    
    // 获取浮动文字
    getFloatingTexts() {
        return this.floatingTexts.filter(ft => ft.life > 0);
    }
    
    // 更新浮动文字
    updateFloatingTexts() {
        for (const ft of this.floatingTexts) {
            ft.life--;
            ft.y -= 0.5;
        }
        this.floatingTexts = this.floatingTexts.filter(ft => ft.life > 0);
    }
}