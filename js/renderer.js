 // Canvas 渲染系统

class Renderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.cellSize = CONFIG.CELL_SIZE;
        
        // 地图区域大小
        this.mapWidth = CONFIG.GRID_COLS * this.cellSize;
        this.mapHeight = CONFIG.GRID_ROWS * this.cellSize;
        
        // 右侧面板宽度
        this.panelWidth = 280;
        
        // 底部日志高度
        this.logHeight = 140;
        
        // 设置画布大小
        this.canvas.width = this.mapWidth + this.panelWidth;
        this.canvas.height = this.mapHeight + this.logHeight;
        
        // 动画帧计数
        this.frame = 0;
    }
    
    // 主渲染
    render(gameState) {
        this.frame++;
        const ctx = this.ctx;
        
        // 清空画布
        ctx.fillStyle = CONFIG.COLORS.BG;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 渲染地图
        this._renderGrid(ctx, gameState.grid, gameState.itemManager);
        
        // 渲染死亡标记
        this._renderDeadZones(ctx, gameState.grid);
        
        // 渲染物品
        this._renderItems(ctx, gameState.itemManager);
        
        // 渲染实体
        this._renderEntities(ctx, gameState.entities, gameState);
        
        // 渲染浮动文字
        this._renderFloatingTexts(ctx, gameState.combatSystem);
        
        // 渲染右侧面板
        this._renderPanel(ctx, gameState);
        
        // 渲染底部日志
        this._renderLog(ctx, gameState.combatSystem, gameState.turn);
        
        // 渲染压注阶段覆盖
        if (gameState.phase === 'betting') {
            this._renderBettingUI(ctx, gameState);
        }
        
        // 渲染游戏状态覆盖
        if (gameState.gameOver) {
            this._renderGameOver(ctx, gameState);
        }
    }
    
    // 渲染地图网格
    _renderGrid(ctx, grid, itemManager) {
        // 渲染地板和墙壁
        for (let y = 0; y < grid.rows; y++) {
            for (let x = 0; x < grid.cols; x++) {
                const px = x * this.cellSize;
                const py = y * this.cellSize;
                
                if (grid.cells[y][x] === CELL_TYPE.WALL) {
                    // 墙壁
                    ctx.fillStyle = CONFIG.COLORS.WALL;
                    ctx.fillRect(px, py, this.cellSize, this.cellSize);
                    // 墙壁顶部高光
                    ctx.fillStyle = CONFIG.COLORS.WALL_TOP;
                    ctx.fillRect(px, py, this.cellSize, 4);
                    ctx.fillRect(px, py, 4, this.cellSize);
                } else {
                    // 地板
                    ctx.fillStyle = CONFIG.COLORS.FLOOR;
                    ctx.fillRect(px, py, this.cellSize, this.cellSize);
                    // 网格线
                    ctx.strokeStyle = CONFIG.COLORS.GRID_LINE;
                    ctx.lineWidth = 0.5;
                    ctx.strokeRect(px, py, this.cellSize, this.cellSize);
                }
            }
        }
    }
    
    // 渲染死亡标记
    _renderDeadZones(ctx, grid) {
        for (const dz of grid.deadZones) {
            const px = dz.x * this.cellSize;
            const py = dz.y * this.cellSize;
            const alpha = Math.min(0.6, dz.turnsLeft / 20);
            
            ctx.fillStyle = `rgba(100, 0, 0, ${alpha})`;
            ctx.fillRect(px, py, this.cellSize, this.cellSize);
            
            // 骷髅标记
            ctx.fillStyle = `rgba(200, 200, 200, ${alpha})`;
            ctx.font = `${this.cellSize - 4}px serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('💀', px + this.cellSize / 2, py + this.cellSize / 2);
        }
    }
    
    // 渲染物品
    _renderItems(ctx, itemManager) {
        const items = itemManager.getActiveItems();
        
        for (const item of items) {
            const px = item.x * this.cellSize;
            const py = item.y * this.cellSize;
            const centerX = px + this.cellSize / 2;
            const centerY = py + this.cellSize / 2;
            
            if (item.type === 'food') {
                // 食物 - 红色圆形 + 发光
                const glowSize = 12 + Math.sin(this.frame * 0.1) * 3;
                const gradient = ctx.createRadialGradient(
                    centerX, centerY, 2, centerX, centerY, glowSize
                );
                gradient.addColorStop(0, 'rgba(233, 69, 96, 0.8)');
                gradient.addColorStop(1, 'rgba(233, 69, 96, 0)');
                ctx.fillStyle = gradient;
                ctx.fillRect(px - 4, py - 4, this.cellSize + 8, this.cellSize + 8);
                
                ctx.fillStyle = CONFIG.COLORS.FOOD;
                ctx.beginPath();
                ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
                ctx.fill();
                
                // 十字标记
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(centerX - 3, centerY);
                ctx.lineTo(centerX + 3, centerY);
                ctx.moveTo(centerX, centerY - 3);
                ctx.lineTo(centerX, centerY + 3);
                ctx.stroke();
            } else if (item.type === 'weapon') {
                // 武器 - 根据类型不同颜色
                const glowSize = 10 + Math.sin(this.frame * 0.08) * 2;
                const gradient = ctx.createRadialGradient(
                    centerX, centerY, 2, centerX, centerY, glowSize
                );
                gradient.addColorStop(0, item.data.color + 'CC');
                gradient.addColorStop(1, item.data.color + '00');
                ctx.fillStyle = gradient;
                ctx.fillRect(px - 4, py - 4, this.cellSize + 8, this.cellSize + 8);
                
                // 菱形
                ctx.fillStyle = item.data.color;
                ctx.beginPath();
                ctx.moveTo(centerX, centerY - 6);
                ctx.lineTo(centerX + 6, centerY);
                ctx.lineTo(centerX, centerY + 6);
                ctx.lineTo(centerX - 6, centerY);
                ctx.closePath();
                ctx.fill();
                
                // 武器符号
                ctx.fillStyle = '#fff';
                ctx.font = '8px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const symbols = { '木棍': 'T', '铁剑': '†', '神剑': '★' };
                ctx.fillText(symbols[item.data.name] || '?', centerX, centerY);
            } else if (item.type === 'armor') {
                // 防具 - 盾牌形状 + 发光
                const glowSize = 10 + Math.sin(this.frame * 0.07 + 1) * 2;
                const gradient = ctx.createRadialGradient(
                    centerX, centerY, 2, centerX, centerY, glowSize
                );
                gradient.addColorStop(0, item.data.color + 'CC');
                gradient.addColorStop(1, item.data.color + '00');
                ctx.fillStyle = gradient;
                ctx.fillRect(px - 4, py - 4, this.cellSize + 8, this.cellSize + 8);
                
                // 盾牌形状
                ctx.fillStyle = item.data.color;
                ctx.beginPath();
                ctx.moveTo(centerX, centerY - 6);
                ctx.lineTo(centerX + 5, centerY - 3);
                ctx.lineTo(centerX + 5, centerY + 2);
                ctx.lineTo(centerX, centerY + 6);
                ctx.lineTo(centerX - 5, centerY + 2);
                ctx.lineTo(centerX - 5, centerY - 3);
                ctx.closePath();
                ctx.fill();
                
                // 防御符号
                ctx.fillStyle = '#fff';
                ctx.font = '7px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const armorSymbols = { '布甲': 'B', '铁甲': 'I', '金甲': 'G' };
                ctx.fillText(armorSymbols[item.data.name] || '?', centerX, centerY);
            } else if (item.type === 'boots') {
                // 鞋子 - 小鞋形状 + 发光
                const glowSize = 9 + Math.sin(this.frame * 0.09 + 2) * 2;
                const gradient = ctx.createRadialGradient(
                    centerX, centerY, 2, centerX, centerY, glowSize
                );
                gradient.addColorStop(0, item.data.color + 'CC');
                gradient.addColorStop(1, item.data.color + '00');
                ctx.fillStyle = gradient;
                ctx.fillRect(px - 4, py - 4, this.cellSize + 8, this.cellSize + 8);
                
                // 鞋子形状（椭圆）
                ctx.fillStyle = item.data.color;
                ctx.beginPath();
                ctx.ellipse(centerX, centerY - 1, 5, 3, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.ellipse(centerX, centerY + 3, 4, 2, 0, 0, Math.PI * 2);
                ctx.fill();
                
                // 闪避符号
                ctx.fillStyle = '#fff';
                ctx.font = '7px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const bootSymbols = { '草鞋': 'S', '皮靴': 'L', '风靴': 'W' };
                ctx.fillText(bootSymbols[item.data.name] || '?', centerX, centerY);
            }
        }
    }
    
    // 渲染实体
    _renderEntities(ctx, entities, gameState) {
        for (const entity of entities) {
            if (!entity.alive) continue;
            
            const px = entity.x * this.cellSize;
            const py = entity.y * this.cellSize;
            const centerX = px + this.cellSize / 2;
            const centerY = py + this.cellSize / 2;
            const radius = this.cellSize / 2 - 2;
            
            // 减速效果（蓝色光晕）
            if (entity.slowed > 0) {
                ctx.fillStyle = 'rgba(100, 150, 255, 0.25)';
                ctx.fillRect(px - 3, py - 3, this.cellSize + 6, this.cellSize + 6);
                ctx.strokeStyle = 'rgba(100, 150, 255, 0.5)';
                ctx.lineWidth = 1;
                ctx.strokeRect(px - 1, py - 1, this.cellSize + 2, this.cellSize + 2);
            }
            
            // 受伤闪烁效果
            if (entity.damageFlash > 0 && entity.damageFlash % 2 === 0) {
                ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
                ctx.fillRect(px - 2, py - 2, this.cellSize + 4, this.cellSize + 4);
            }
            
            // 角色光环
            const glowGradient = ctx.createRadialGradient(
                centerX, centerY, radius - 2, centerX, centerY, radius + 4
            );
            glowGradient.addColorStop(0, entity.color + '40');
            glowGradient.addColorStop(1, entity.color + '00');
            ctx.fillStyle = glowGradient;
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius + 4, 0, Math.PI * 2);
            ctx.fill();
            
            // 角色主体（圆形）
            ctx.fillStyle = entity.color;
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.fill();
            
            // 边框
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.stroke();
            
            // 武器标记（右上角小点）
            if (entity.weapon) {
                const weaponColors = { '木棍': '#8B4513', '铁剑': '#C0C0C0', '神剑': '#FFD700' };
                ctx.fillStyle = weaponColors[entity.weapon.name] || '#fff';
                ctx.beginPath();
                ctx.arc(px + this.cellSize - 3, py + 3, 3, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // 防具标记（左上角小方块）
            if (entity.armor) {
                const armorColors = { '布甲': '#8B7355', '铁甲': '#778899', '金甲': '#DAA520' };
                ctx.fillStyle = armorColors[entity.armor.name] || '#778899';
                ctx.fillRect(px + 1, py + 1, 4, 4);
            }
            
            // 鞋子标记（左下角小三角）
            if (entity.boots) {
                const bootColors = { '草鞋': '#9ACD32', '皮靴': '#CD853F', '风靴': '#00CED1' };
                ctx.fillStyle = bootColors[entity.boots.name] || '#9ACD32';
                ctx.beginPath();
                ctx.moveTo(px + 1, py + this.cellSize - 1);
                ctx.lineTo(px + 5, py + this.cellSize - 1);
                ctx.lineTo(px + 3, py + this.cellSize - 5);
                ctx.closePath();
                ctx.fill();
            }
            
            // 角色名首字
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(entity.name[0], centerX, centerY);
            
            // HP 条
            const barWidth = this.cellSize - 2;
            const barHeight = 3;
            const barX = px + 1;
            const barY = py - 5;
            
            // 背景
            ctx.fillStyle = CONFIG.COLORS.HP_BAR_BG;
            ctx.fillRect(barX, barY, barWidth, barHeight);
            
            // HP
            const hpRatio = entity.hp / entity.maxHp;
            ctx.fillStyle = hpRatio > 0.3 ? CONFIG.COLORS.HP_BAR : CONFIG.COLORS.HP_BAR_LOW;
            ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);
            
            // 饥饿指示器（饱食度低于30时显示）
            if (entity.hunger < 30) {
                const hungerBarY = barY - 4;
                ctx.fillStyle = '#553300';
                ctx.fillRect(barX, hungerBarY, barWidth, 2);
                ctx.fillStyle = '#FFaa00';
                ctx.fillRect(barX, hungerBarY, barWidth * (entity.hunger / 100), 2);
            }
            
            // 压注标记（战斗阶段显示）
            if (gameState.betTarget === entity.id && gameState.phase === 'playing') {
                const pulse = 0.6 + Math.sin(this.frame * 0.12) * 0.4;
                ctx.fillStyle = `rgba(255, 215, 0, ${pulse})`;
                ctx.font = '10px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('🎲', centerX, py - 8);
            }
        }
    }
    
    // 渲染浮动文字
    _renderFloatingTexts(ctx, combatSystem) {
        const texts = combatSystem.getFloatingTexts();
        for (const ft of texts) {
            const alpha = ft.life / 30;
            ctx.fillStyle = ft.color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(ft.text, ft.x, ft.y);
        }
    }
    
    // 渲染右侧面板
    _renderPanel(ctx, gameState) {
        const panelX = this.mapWidth;
        const panelY = 0;
        
        // 面板背景
        ctx.fillStyle = CONFIG.COLORS.PANEL_BG;
        ctx.fillRect(panelX, panelY, this.panelWidth, this.mapHeight + this.logHeight);
        
        // 分隔线
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(panelX, 0);
        ctx.lineTo(panelX, this.mapHeight + this.logHeight);
        ctx.stroke();
        
        // 标题
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⚔ 2D 网格生存战 ⚔', panelX + this.panelWidth / 2, 25);
        
        // 回合信息
        ctx.fillStyle = CONFIG.COLORS.TEXT;
        ctx.font = '13px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`回合: ${gameState.turn}`, panelX + 15, 50);
        
        const alive = gameState.entities.filter(e => e.alive).length;
        ctx.fillText(`存活: ${alive}/${gameState.entities.length}`, panelX + 100, 50);
        
        // 速度控制提示
        ctx.fillStyle = CONFIG.COLORS.TEXT_DIM;
        ctx.font = '11px sans-serif';
        ctx.fillText(`速度: ${CONFIG.TICK_SPEEDS[gameState.speedIndex]}ms (按 1-5 调整)`, panelX + 15, 68);
        ctx.fillText('空格暂停 | R 重开', panelX + 15, 82);
        
        // 角色列表
        let yPos = 105;
        
        // 排序：存活在前，按HP降序
        const sorted = [...gameState.entities].sort((a, b) => {
            if (a.alive !== b.alive) return a.alive ? -1 : 1;
            return b.hp - a.hp;
        });
        
        for (const entity of sorted) {
            if (!entity.alive) {
                // 已死亡
                ctx.fillStyle = '#555';
                ctx.font = '12px sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText(`💀 ${entity.name} (击杀:${entity.kills})`, panelX + 15, yPos);
                yPos += 16;
                continue;
            }
            
            // 角色色块
            ctx.fillStyle = entity.color;
            ctx.fillRect(panelX + 10, yPos - 10, 8, 8);
            
            // 名字和状态
            ctx.fillStyle = entity.color;
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(entity.name, panelX + 22, yPos);
            
            // 击杀数
            ctx.fillStyle = '#FFD700';
            ctx.font = '10px sans-serif';
            ctx.fillText(`⚔${entity.kills}`, panelX + this.panelWidth - 40, yPos);
            
            // 状态标签
            const stateLabels = {
                'WANDER': '游荡',
                'SEEK_ITEM': '拾取',
                'HUNT': '追杀',
                'FLEE': '逃跑',
                'ATTACK': '战斗',
            };
            ctx.fillStyle = CONFIG.COLORS.TEXT_DIM;
            ctx.fillText(stateLabels[entity.state] || '', panelX + this.panelWidth - 75, yPos);
            
            yPos += 4;
            
            // HP 条
            const barWidth = this.panelWidth - 30;
            const barHeight = 8;
            const barX = panelX + 15;
            
            ctx.fillStyle = CONFIG.COLORS.HP_BAR_BG;
            ctx.fillRect(barX, yPos, barWidth, barHeight);
            
            const hpRatio = entity.hp / entity.maxHp;
            ctx.fillStyle = hpRatio > 0.3 ? CONFIG.COLORS.HP_BAR : CONFIG.COLORS.HP_BAR_LOW;
            ctx.fillRect(barX, yPos, barWidth * hpRatio, barHeight);
            
            // HP 文字
            ctx.fillStyle = '#fff';
            ctx.font = '9px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`${entity.hp}/${entity.maxHp}`, barX + barWidth / 2, yPos + 7);
            
            yPos += 12;
            
            // 饥饿条
            ctx.fillStyle = '#333';
            ctx.fillRect(barX, yPos, barWidth, 4);
            ctx.fillStyle = entity.hunger > 30 ? '#FFaa00' : '#FF4400';
            ctx.fillRect(barX, yPos, barWidth * (entity.hunger / 100), 4);
            
            yPos += 8;
            
            // 装备信息（两行）
            ctx.fillStyle = CONFIG.COLORS.TEXT_DIM;
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'left';
            const weaponText = entity.weapon ? `${entity.weapon.name}(+${entity.weapon.power})` : '无';
            const armorText = entity.armor ? `${entity.armor.name}(+${entity.armor.defense})` : '无';
            ctx.fillText(`⚔${weaponText} 🛡${armorText}`, panelX + 15, yPos);
            
            yPos += 12;
            const bootsText = entity.boots ? `${entity.boots.name}(闪避${Math.floor(entity.boots.dodge*100)}%)` : '无';
            ctx.fillText(`👢${bootsText}  攻击:${entity.getAttackPower()} 防御:${entity.getDefense()}`, panelX + 15, yPos);
            
            yPos += 14;
            
            // 上回合行为
            ctx.fillStyle = '#666';
            ctx.font = '9px sans-serif';
            ctx.fillText(entity.lastAction || '', panelX + 15, yPos);
            
            yPos += 20;
        }
    }
    
    // 渲染底部日志
    _renderLog(ctx, combatSystem, turn) {
        const logY = this.mapHeight;
        
        // 日志背景
        ctx.fillStyle = CONFIG.COLORS.LOG_BG;
        ctx.fillRect(0, logY, this.mapWidth, this.logHeight);
        
        // 分隔线
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, logY);
        ctx.lineTo(this.mapWidth, logY);
        ctx.stroke();
        
        // 日志标题
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('📋 战斗日志', 10, logY + 15);
        
        // 日志内容
        const logs = combatSystem.logs.slice(0, 8);
        ctx.font = '11px sans-serif';
        
        for (let i = 0; i < logs.length; i++) {
            const log = logs[i];
            ctx.fillStyle = log.important ? '#FFD700' : (log.color || CONFIG.COLORS.TEXT);
            ctx.globalAlpha = 1 - i * 0.1;
            ctx.fillText(log.text, 10, logY + 32 + i * 14);
        }
        ctx.globalAlpha = 1;
    }
    
    // 渲染压注阶段 UI
    _renderBettingUI(ctx, gameState) {
        const entities = gameState.entities;
        const betTarget = gameState.betTarget;
        const countdown = gameState.betCountdown;
        
        // === 顶部倒计时横幅 ===
        const bannerH = 60;
        const bannerY = 10;
        
        // 半透明背景
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, bannerY, this.mapWidth, bannerH);
        
        // 金色边框
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2;
        ctx.strokeRect(2, bannerY, this.mapWidth - 4, bannerH);
        
        // 倒计时
        ctx.textAlign = 'center';
        
        // 倒计时数字（大号）
        const pulse = 1 + Math.sin(this.frame * 0.15) * 0.1;
        ctx.save();
        ctx.translate(this.mapWidth / 2, bannerY + 18);
        ctx.scale(pulse, pulse);
        ctx.fillStyle = countdown <= 5 ? '#FF4444' : '#FFD700';
        ctx.font = 'bold 32px sans-serif';
        ctx.fillText(`${countdown}s`, 0, 0);
        ctx.restore();
        
        // 提示文字
        ctx.fillStyle = '#e0e0e0';
        ctx.font = '14px sans-serif';
        ctx.fillText('观察战场，点击下方角色卡压注！', this.mapWidth / 2, bannerY + 48);
        
        // === 底部角色选择卡片 ===
        const logY = this.mapHeight;
        const cardAreaH = this.logHeight;
        
        // 替换日志区域为压注面板
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.fillRect(0, logY, this.mapWidth, cardAreaH);
        
        // 提示
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('🎯 点击选择压注目标（空格跳过）', 10, logY + 16);
        
        // 角色卡片
        const cardCount = entities.length;
        const cardW = (this.mapWidth - 20) / cardCount;
        const cardH = cardAreaH - 30;
        const cardY = logY + 24;
        
        for (let i = 0; i < cardCount; i++) {
            const entity = entities[i];
            const cardX = 10 + i * cardW;
            const isSelected = betTarget === i;
            
            // 卡片背景
            ctx.fillStyle = isSelected ? entity.color + '44' : 'rgba(30, 30, 50, 0.8)';
            ctx.fillRect(cardX + 2, cardY, cardW - 4, cardH);
            
            // 选中边框
            if (isSelected) {
                ctx.strokeStyle = entity.color;
                ctx.lineWidth = 3;
                ctx.strokeRect(cardX + 2, cardY, cardW - 4, cardH);
                
                // 选中标记
                ctx.fillStyle = '#FFD700';
                ctx.font = '12px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('✅ 已压注', cardX + cardW / 2, cardY + cardH - 4);
            } else {
                ctx.strokeStyle = '#444';
                ctx.lineWidth = 1;
                ctx.strokeRect(cardX + 2, cardY, cardW - 4, cardH);
            }
            
            // 角色圆圈
            const circleX = cardX + cardW / 2;
            const circleY = cardY + 22;
            const r = 14;
            
            ctx.fillStyle = entity.color;
            ctx.beginPath();
            ctx.arc(circleX, circleY, r, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.strokeStyle = isSelected ? '#FFD700' : '#fff';
            ctx.lineWidth = isSelected ? 2 : 1;
            ctx.beginPath();
            ctx.arc(circleX, circleY, r, 0, Math.PI * 2);
            ctx.stroke();
            
            // 名字首字
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 14px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(entity.name[0], circleX, circleY);
            ctx.textBaseline = 'alphabetic';
            
            // 名字
            ctx.fillStyle = entity.color;
            ctx.font = 'bold 11px sans-serif';
            ctx.fillText(entity.name, cardX + cardW / 2, cardY + 48);
            
            // 性格
            ctx.fillStyle = '#888';
            ctx.font = '9px sans-serif';
            ctx.fillText(entity.personality.name, cardX + cardW / 2, cardY + 60);
            
            // HP
            ctx.fillStyle = '#aaa';
            ctx.font = '9px sans-serif';
            ctx.fillText(`HP:${entity.hp}`, cardX + cardW / 2, cardY + 72);
            
            // 战力评分
            const score = entity.getCombatScore();
            ctx.fillStyle = score > 150 ? '#44ff44' : score > 100 ? '#FFaa00' : '#ff4444';
            ctx.font = 'bold 10px sans-serif';
            ctx.fillText(`⚡${score}`, cardX + cardW / 2, cardY + 84);
        }
        
        // 右侧面板 - 压注状态
        const panelX = this.mapWidth;
        ctx.fillStyle = CONFIG.COLORS.PANEL_BG;
        ctx.fillRect(panelX, 0, this.panelWidth, this.mapHeight + this.logHeight);
        
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(panelX, 0);
        ctx.lineTo(panelX, this.mapHeight + this.logHeight);
        ctx.stroke();
        
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🎲 压注阶段 🎲', panelX + this.panelWidth / 2, 25);
        
        if (betTarget !== null) {
            const target = entities[betTarget];
            ctx.fillStyle = target.color;
            ctx.font = 'bold 18px sans-serif';
            ctx.fillText(`已选择: ${target.name}`, panelX + this.panelWidth / 2, 60);
            
            ctx.fillStyle = CONFIG.COLORS.TEXT;
            ctx.font = '12px sans-serif';
            ctx.fillText(`性格: ${target.personality.name}`, panelX + this.panelWidth / 2, 85);
            ctx.fillText(`HP: ${target.hp}  攻击: ${target.getAttackPower()}`, panelX + this.panelWidth / 2, 105);
            ctx.fillText(`战力: ${target.getCombatScore()}`, panelX + this.panelWidth / 2, 125);
        } else {
            ctx.fillStyle = CONFIG.COLORS.TEXT_DIM;
            ctx.font = '14px sans-serif';
            ctx.fillText('点击下方角色卡选择', panelX + this.panelWidth / 2, 60);
        }
        
        // 所有角色战力排行
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('📊 战力排行', panelX + 15, 165);
        
        const ranked = [...entities].sort((a, b) => b.getCombatScore() - a.getCombatScore());
        let rankY = 185;
        for (let i = 0; i < ranked.length; i++) {
            const e = ranked[i];
            const isBet = e.id === betTarget;
            
            ctx.fillStyle = isBet ? '#FFD700' : '#aaa';
            ctx.font = (isBet ? 'bold ' : '') + '11px sans-serif';
            ctx.fillText(`${i + 1}. ${e.name} ⚡${e.getCombatScore()}`, panelX + 15, rankY);
            rankY += 16;
        }
        
        // 操作提示
        ctx.fillStyle = CONFIG.COLORS.TEXT_DIM;
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('空格 = 跳过倒计时开始战斗', panelX + this.panelWidth / 2, this.mapHeight + this.logHeight - 15);
    }
    
    // 渲染游戏结束
    _renderGameOver(ctx, gameState) {
        // 半透明遮罩
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, this.mapWidth, this.mapHeight + this.logHeight);
        
        const centerX = this.mapWidth / 2;
        const centerY = this.mapHeight / 2;
        
        // 根据压注结果调整面板
        const betResult = gameState.betResult;
        const panelW = 380;
        const panelH = betResult ? 300 : 220;
        
        // 面板背景
        let borderColor = '#FFD700';
        if (betResult === 'win') borderColor = '#00FF88';
        if (betResult === 'lose') borderColor = '#FF4444';
        
        ctx.fillStyle = '#1a1a2e';
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 3;
        ctx.fillRect(centerX - panelW / 2, centerY - panelH / 2, panelW, panelH);
        ctx.strokeRect(centerX - panelW / 2, centerY - panelH / 2, panelW, panelH);
        
        // 压注结果
        if (betResult === 'win') {
            // === 压注成功 ===
            ctx.fillStyle = '#00FF88';
            ctx.font = 'bold 36px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('🎉 压注成功！🎉', centerX, centerY - 80);
            
            ctx.fillStyle = '#88FFCC';
            ctx.font = '16px sans-serif';
            ctx.fillText('你的眼光真准！', centerX, centerY - 50);
        } else if (betResult === 'lose') {
            // === 压注失败 ===
            ctx.fillStyle = '#FF4444';
            ctx.font = 'bold 36px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('😢 压注失败', centerX, centerY - 80);
            
            ctx.fillStyle = '#FF8888';
            ctx.font = '14px sans-serif';
            const betEntity = gameState.entities[gameState.betTarget];
            ctx.fillText(`${betEntity.name} 没能活到最后...`, centerX, centerY - 50);
        }
        
        // 胜者信息
        const winner = gameState.winner;
        const infoStartY = betResult ? centerY - 20 : centerY - 50;
        
        if (winner) {
            ctx.fillStyle = winner.color;
            ctx.font = 'bold 24px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`🏆 ${winner.name} 获胜！`, centerX, infoStartY);
            
            ctx.fillStyle = CONFIG.COLORS.TEXT;
            ctx.font = '13px sans-serif';
            ctx.fillText(`击杀: ${winner.kills}  回合: ${gameState.turn}`, centerX, infoStartY + 25);
            
            // 装备信息
            ctx.font = '11px sans-serif';
            ctx.fillStyle = '#FFD700';
            const w = winner.weapon ? `⚔${winner.weapon.name}(+${winner.weapon.power})` : '⚔无';
            const a = winner.armor ? `🛡${winner.armor.name}(+${winner.armor.defense})` : '🛡无';
            const b = winner.boots ? `👢${winner.boots.name}(闪避${Math.floor(winner.boots.dodge*100)}%)` : '👢无';
            ctx.fillText(`${w}  ${a}`, centerX, infoStartY + 48);
            ctx.fillText(b, centerX, infoStartY + 66);
        }
        
        ctx.fillStyle = CONFIG.COLORS.TEXT_DIM;
        ctx.font = '13px sans-serif';
        ctx.fillText('按 R 重新开始', centerX, centerY + panelH / 2 - 20);
    }
}
