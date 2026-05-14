// AI 决策系统 - 状态机 + 权重评分

class AIController {
    constructor() {
        this.logs = []; // AI决策日志
    }
    
    // 为所有存活实体做出决策
    makeDecisions(entities, grid, itemManager) {
        const actions = [];
        
        for (const entity of entities) {
            if (!entity.alive) continue;
            
            // 减速效果：50% 概率跳过本回合
            if (entity.isSlowed() && Math.random() < 0.5) {
                entity.lastAction = `🐌 减速中，无法行动`;
                actions.push({
                    entity: entity,
                    type: 'idle',
                    target: null,
                    targetPos: null,
                    dx: 0,
                    dy: 0,
                });
                continue;
            }
            
            const action = this._decideAction(entity, entities, grid, itemManager);
            actions.push(action);
        }
        
        return actions;
    }
    
    // 核心决策逻辑
    _decideAction(entity, entities, grid, itemManager) {
        const visibleEnemies = entity.getVisibleEntities(entities);
        const visibleItems = entity.getVisibleItems(itemManager);
        const hpRatio = entity.hp / entity.maxHp;
        const hungerRatio = entity.hunger / 100;
        
        // === 状态转换逻辑 ===
        
        // 1. 逃跑判定：HP 低于阈值
        if (hpRatio <= entity.personality.fleeThreshold && visibleEnemies.length > 0) {
            entity.state = AI_STATE.FLEE;
            // 找最近的威胁
            const closest = this._findClosest(entity, visibleEnemies);
            entity.targetEntity = closest;
        }
        // 2. 攻击判定：范围内有敌人且自己状态不错
        else if (visibleEnemies.length > 0) {
            const inRange = visibleEnemies.filter(e => 
                Grid.distance(entity.x, entity.y, e.x, e.y) <= CONFIG.ATTACK_RANGE
            );
            
            if (inRange.length > 0 && hpRatio > entity.personality.fleeThreshold) {
                entity.state = AI_STATE.ATTACK;
                // 选择最弱的范围内敌人
                entity.targetEntity = inRange.reduce((weakest, e) => 
                    e.hp < weakest.hp ? e : weakest
                );
            }
            // 3. 追杀判定：有信心打赢（降低门槛，更主动）
            else if (hpRatio > 0.25 && this._shouldHunt(entity, visibleEnemies)) {
                entity.state = AI_STATE.HUNT;
                entity.targetEntity = this._selectHuntTarget(entity, visibleEnemies);
            }
            // 4. 拾取判定
            else if (visibleItems.length > 0) {
                entity.state = AI_STATE.SEEK_ITEM;
                entity.targetItem = this._selectBestItem(entity, visibleItems);
            }
            // 5. 游荡
            else {
                entity.state = AI_STATE.WANDER;
            }
        }
        // 6. 没有敌人，寻找物品
        else if (visibleItems.length > 0) {
            entity.state = AI_STATE.SEEK_ITEM;
            entity.targetItem = this._selectBestItem(entity, visibleItems);
        }
        else {
            entity.state = AI_STATE.WANDER;
        }
        
        // === 执行行动 ===
        return this._executeAction(entity, grid, itemManager, entities);
    }
    
    // 执行具体行动
    _executeAction(entity, grid, itemManager, entities) {
        const action = {
            entity: entity,
            type: 'move',     // 'move' | 'attack' | 'pick' | 'idle'
            target: null,
            targetPos: null,
            dx: 0,
            dy: 0,
        };
        
        switch (entity.state) {
            case AI_STATE.ATTACK: {
                action.type = 'attack';
                action.target = entity.targetEntity;
                entity.lastAction = `攻击了 ${entity.targetEntity.name}`;
                break;
            }
            
            case AI_STATE.FLEE: {
                if (entity.targetEntity) {
                    // 逃跑时顺路拾取附近物品
                    const nearbyItems = itemManager.getActiveItems().filter(i => 
                        Grid.distance(entity.x, entity.y, i.x, i.y) <= 4
                    );
                    
                    const step = grid.getNextStepAwayWithPickup(
                        entity.x, entity.y,
                        entity.targetEntity.x, entity.targetEntity.y,
                        nearbyItems
                    );
                    if (step) {
                        action.dx = step.x - entity.x;
                        action.dy = step.y - entity.y;
                        action.targetPos = step;
                    }
                }
                entity.lastAction = `逃离 ${entity.targetEntity?.name || '危险'}`;
                break;
            }
            
            case AI_STATE.HUNT: {
                if (entity.targetEntity && entity.targetEntity.alive) {
                    // 检查是否在攻击范围内
                    const dist = Grid.distance(entity.x, entity.y, entity.targetEntity.x, entity.targetEntity.y);
                    if (dist <= CONFIG.ATTACK_RANGE) {
                        action.type = 'attack';
                        action.target = entity.targetEntity;
                        entity.lastAction = `追上并攻击 ${entity.targetEntity.name}`;
                    } else {
                        const step = grid.getNextStepTowards(
                            entity.x, entity.y,
                            entity.targetEntity.x, entity.targetEntity.y
                        );
                        if (step) {
                            action.dx = step.x - entity.x;
                            action.dy = step.y - entity.y;
                            action.targetPos = step;
                        }
                        entity.lastAction = `追杀 ${entity.targetEntity.name}`;
                    }
                } else {
                    entity.state = AI_STATE.WANDER;
                }
                break;
            }
            
            case AI_STATE.SEEK_ITEM: {
                if (entity.targetItem && !entity.targetItem.collected) {
                    // 检查是否已站在物品上
                    if (entity.x === entity.targetItem.x && entity.y === entity.targetItem.y) {
                        action.type = 'pick';
                        action.target = entity.targetItem;
                        entity.lastAction = `拾取了 ${entity.targetItem.data.name}`;
                    } else {
                        const step = grid.getNextStepTowards(
                            entity.x, entity.y,
                            entity.targetItem.x, entity.targetItem.y
                        );
                        if (step) {
                            action.dx = step.x - entity.x;
                            action.dy = step.y - entity.y;
                            action.targetPos = step;
                        }
                        entity.lastAction = `前往拾取 ${entity.targetItem.data.name}`;
                    }
                } else {
                    entity.state = AI_STATE.WANDER;
                }
                break;
            }
            
            case AI_STATE.WANDER:
            default: {
                // 随机移动，几乎不停留
                if (Math.random() < 0.05) {
                    entity.lastAction = '原地休息';
                    break;
                }
                
                const dirs = [
                    { dx: 0, dy: -1 },
                    { dx: 0, dy: 1 },
                    { dx: -1, dy: 0 },
                    { dx: 1, dy: 0 },
                ];
                
                // 随机选方向，但倾向于探索未走过的区域
                const shuffled = dirs.sort(() => Math.random() - 0.5);
                for (const dir of shuffled) {
                    const nx = entity.x + dir.dx;
                    const ny = entity.y + dir.dy;
                    if (grid.isWalkable(nx, ny)) {
                        // 检查是否有其他活着的实体
                        const blocked = entities.some(e => 
                            e.alive && e.id !== entity.id && e.x === nx && e.y === ny
                        );
                        if (!blocked) {
                            action.dx = dir.dx;
                            action.dy = dir.dy;
                            action.targetPos = { x: nx, y: ny };
                            break;
                        }
                    }
                }
                entity.lastAction = '四处游荡';
                break;
            }
        }
        
        return action;
    }
    
    // 是否应该追杀
    _shouldHunt(entity, visibleEnemies) {
        const aggression = entity.personality.aggressionWeight;
        
        for (const enemy of visibleEnemies) {
            const myScore = entity.getCombatScore();
            const enemyScore = enemy.getCombatScore();
            
            // 如果战力优势明显，追杀概率增加
            if (myScore > enemyScore * (1.2 - aggression)) {
                return true;
            }
        }
        return false;
    }
    
    // 选择追杀目标（选最弱的）
    _selectHuntTarget(entity, visibleEnemies) {
        return visibleEnemies.reduce((weakest, e) => {
            const eScore = e.getCombatScore();
            const wScore = weakest.getCombatScore();
            return eScore < wScore ? e : weakest;
        });
    }
    
    // 选择最佳物品（权重评分）
    _selectBestItem(entity, visibleItems) {
        let bestItem = null;
        let bestScore = -Infinity;
        
        const greedWeight = entity.personality.greedWeight || 0.5;
        const hpRatio = entity.hp / entity.maxHp;
        
        for (const item of visibleItems) {
            let score = 0;
            const dist = Grid.distance(entity.x, entity.y, item.x, item.y);
            
            if (item.type === 'food') {
                // HP 低时食物价值更高
                const foodNeed = 1 - hpRatio;
                score = (foodNeed * 50 + item.data.heal * 2) * greedWeight;
                score -= dist * 3;
            } else if (item.type === 'weapon') {
                // 没武器时武器价值更高
                const weaponNeed = entity.weapon ? (item.data.power > entity.weapon.power ? 1 : 0.1) : 2;
                score = item.data.power * 3 * weaponNeed * greedWeight;
                score -= dist * 3;
            } else if (item.type === 'armor') {
                // 没防具时防具价值更高
                const armorNeed = entity.armor ? (item.data.defense > entity.armor.defense ? 1 : 0.1) : 2;
                score = item.data.defense * 3 * armorNeed * greedWeight;
                score -= dist * 3;
            } else if (item.type === 'boots') {
                // 没鞋子时鞋子价值更高
                const bootNeed = entity.boots ? 0.3 : 1.5;
                score = (item.data.dodge * 100 + item.data.speed * 10) * bootNeed * greedWeight;
                score -= dist * 3;
            }
            
            if (score > bestScore) {
                bestScore = score;
                bestItem = item;
            }
        }
        
        return bestItem;
    }
    
    // 找最近的实体
    _findClosest(entity, targets) {
        return targets.reduce((closest, t) => {
            const d1 = Grid.distance(entity.x, entity.y, t.x, t.y);
            const d2 = Grid.distance(entity.x, entity.y, closest.x, closest.y);
            return d1 < d2 ? t : closest;
        });
    }
}