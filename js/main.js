// 游戏主入口和主循环

// 游戏阶段
const GAME_PHASE = {
    BETTING: 'betting',   // 压注阶段
    PLAYING: 'playing',   // 战斗阶段
    RESULT: 'result',     // 结算阶段
};

class Game {
    constructor() {
        // 游戏系统
        this.grid = new Grid();
        this.itemManager = new ItemManager();
        this.aiController = new AIController();
        this.combatSystem = new CombatSystem();
        this.renderer = new Renderer('gameCanvas');
        
        // 实体列表
        this.entities = [];
        
        // 游戏状态
        this.turn = 0;
        this.gameOver = false;
        this.winner = null;
        this.paused = false;
        this.speedIndex = CONFIG.DEFAULT_SPEED_INDEX;
        this.phase = GAME_PHASE.BETTING;
        
        // 压注系统
        this.betTarget = null;       // 压注的角色ID
        this.betCountdown = CONFIG.BETTING_TIME;
        this.betTimer = null;
        this.betResult = null;       // 'win' | 'lose' | null
        
        // 定时器
        this.tickTimer = null;
        
        // 初始化
        this._initEntities();
        this._setupControls();
        this._setupBettingControls();
        this._startGame();
    }
    
    // 初始化实体
    _initEntities() {
        this.entities = [];
        for (let i = 0; i < CONFIG.AI_COUNT; i++) {
            const profile = CONFIG.AI_PROFILES[i];
            const personality = CONFIG.PERSONALITIES[Math.floor(Math.random() * CONFIG.PERSONALITIES.length)];
            const entity = new Entity(i, profile, personality);
            this.entities.push(entity);
        }
    }
    
    // 开始游戏
    _startGame() {
        this.turn = 0;
        this.gameOver = false;
        this.winner = null;
        this.phase = GAME_PHASE.BETTING;
        this.betTarget = null;
        this.betCountdown = CONFIG.BETTING_TIME;
        this.betResult = null;
        this.combatSystem.logs = [];
        this.combatSystem.floatingTexts = [];
        
        // 生成地图
        this.grid.generate();
        
        // 放置实体
        for (const entity of this.entities) {
            const pos = this.grid.getRandomEmptyCell(this.entities);
            if (pos) {
                entity.reset(pos.x, pos.y);
            }
        }
        
        // 生成物品
        this.itemManager.generate(this.grid);
        
        // 开始日志
        this.combatSystem.logs.push({
            turn: 0,
            text: '🎮 新游戏开始！观察战场，选择你压注的战士！',
            color: '#FFD700',
            important: true,
        });
        
        // 启动压注倒计时
        this._startBettingCountdown();
        
        // 启动渲染循环
        this._renderLoop();
    }
    
    // 启动压注倒计时
    _startBettingCountdown() {
        if (this.betTimer) clearInterval(this.betTimer);
        this.betCountdown = CONFIG.BETTING_TIME;
        
        this.betTimer = setInterval(() => {
            if (this.phase !== GAME_PHASE.BETTING) return;
            
            this.betCountdown--;
            
            if (this.betCountdown <= 0) {
                clearInterval(this.betTimer);
                this._startBattle();
            }
        }, 1000);
    }
    
    // 开始战斗
    _startBattle() {
        this.phase = GAME_PHASE.PLAYING;
        this.paused = false;
        
        this.combatSystem.logs.unshift({
            turn: 0,
            text: this.betTarget !== null 
                ? `⚔️ 压注完成！战斗开始！你压了 ${this.entities[this.betTarget].name}`
                : '⚔️ 未压注，观战模式！战斗开始！',
            color: '#FFD700',
            important: true,
        });
        
        this._startTick();
    }
    
    // 启动回合定时器
    _startTick() {
        if (this.tickTimer) clearInterval(this.tickTimer);
        this.tickTimer = setInterval(() => {
            if (!this.paused && !this.gameOver && this.phase === GAME_PHASE.PLAYING) {
                this._gameTick();
            }
        }, CONFIG.TICK_SPEEDS[this.speedIndex]);
    }
    
    // 游戏回合
    _gameTick() {
        this.turn++;
        
        // 1. AI 决策
        const actions = this.aiController.makeDecisions(
            this.entities, this.grid, this.itemManager
        );
        
        // 2. 执行行动
        const result = this.combatSystem.resolveActions(
            actions, this.grid, this.itemManager
        );
        
        // 2.5 移动后碰撞分离
        this.combatSystem._separateEntities(this.entities);
        
        // 3. 实体回合更新（饥饿等）
        for (const entity of this.entities) {
            entity.tick();
        }
        
        // 4. 更新死亡标记
        this.grid.updateDeadZones();
        
        // 5. 更新浮动文字
        this.combatSystem.updateFloatingTexts();
        
        // 6. 定期补充物品
        if (this.turn % 10 === 0) {
            this.itemManager.respawn(this.grid, this.entities);
        }
        
        // 7. 检查胜负
        this._checkWinCondition();
    }
    
    // 检查胜利条件
    _checkWinCondition() {
        const alive = this.entities.filter(e => e.alive);
        
        if (alive.length <= 1) {
            this.gameOver = true;
            this.winner = alive.length === 1 ? alive[0] : null;
            this.phase = GAME_PHASE.RESULT;
            
            // 判断压注结果
            if (this.betTarget !== null && this.winner) {
                this.betResult = this.winner.id === this.betTarget ? 'win' : 'lose';
            }
            
            if (this.winner) {
                this.combatSystem.logs.unshift({
                    turn: this.turn,
                    text: `🏆 ${this.winner.name} 赢得了胜利！`,
                    color: this.winner.color,
                    important: true,
                });
                
                if (this.betResult === 'win') {
                    this.combatSystem.logs.unshift({
                        turn: this.turn,
                        text: `🎉 你的压注成功！${this.winner.name} 获胜！`,
                        color: '#00FF88',
                        important: true,
                    });
                } else if (this.betResult === 'lose') {
                    this.combatSystem.logs.unshift({
                        turn: this.turn,
                        text: `😢 压注失败！你选的 ${this.entities[this.betTarget].name} 没能获胜`,
                        color: '#FF4444',
                        important: true,
                    });
                }
            } else {
                this.combatSystem.logs.unshift({
                    turn: this.turn,
                    text: '💀 所有战士同归于尽！',
                    color: '#FF4444',
                    important: true,
                });
            }
        }
    }
    
    // 渲染循环
    _renderLoop() {
        const gameState = this._getGameState();
        this.renderer.render(gameState);
        requestAnimationFrame(() => this._renderLoop());
    }
    
    // 获取游戏状态
    _getGameState() {
        return {
            grid: this.grid,
            itemManager: this.itemManager,
            entities: this.entities,
            combatSystem: this.combatSystem,
            turn: this.turn,
            gameOver: this.gameOver,
            winner: this.winner,
            paused: this.paused,
            speedIndex: this.speedIndex,
            phase: this.phase,
            betTarget: this.betTarget,
            betCountdown: this.betCountdown,
            betResult: this.betResult,
        };
    }
    
    // 设置压注控制（鼠标点击）
    _setupBettingControls() {
        this.canvas = document.getElementById('gameCanvas');
        
        this.canvas.addEventListener('click', (e) => {
            if (this.phase !== GAME_PHASE.BETTING) return;
            
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            const x = (e.clientX - rect.left) * scaleX;
            const y = (e.clientY - rect.top) * scaleY;
            
            // 检查是否点击了角色选择区域（底部压注面板）
            this._handleBettingClick(x, y);
        });
    }
    
    // 处理压注点击
    _handleBettingClick(x, y) {
        // 压注面板在地图区域底部
        const panelY = this.renderer.mapHeight;
        const panelHeight = this.renderer.logHeight;
        
        if (y < panelY || y > panelY + panelHeight) return;
        
        // 8 个角色卡片，均匀分布在底部
        const cardWidth = this.renderer.mapWidth / 8;
        const cardIndex = Math.floor(x / cardWidth);
        
        if (cardIndex >= 0 && cardIndex < this.entities.length) {
            this.betTarget = cardIndex;
            this.combatSystem.logs.unshift({
                turn: 0,
                text: `🎯 你压注了 ${this.entities[cardIndex].name}！`,
                color: this.entities[cardIndex].color,
                important: true,
            });
        }
    }
    
    // 设置控制
    _setupControls() {
        document.addEventListener('keydown', (e) => {
            switch (e.key) {
                case ' ':
                    e.preventDefault();
                    if (this.phase === GAME_PHASE.PLAYING) {
                        this.paused = !this.paused;
                    } else if (this.phase === GAME_PHASE.BETTING) {
                        // 空格跳过压注倒计时
                        clearInterval(this.betTimer);
                        this._startBattle();
                    }
                    break;
                case 'r':
                case 'R':
                    if (this.betTimer) clearInterval(this.betTimer);
                    if (this.tickTimer) clearInterval(this.tickTimer);
                    this._startGame();
                    break;
                case '1':
                    if (this.phase === GAME_PHASE.PLAYING) {
                        this.speedIndex = 0;
                        this._startTick();
                    }
                    break;
                case '2':
                    if (this.phase === GAME_PHASE.PLAYING) {
                        this.speedIndex = 1;
                        this._startTick();
                    }
                    break;
                case '3':
                    if (this.phase === GAME_PHASE.PLAYING) {
                        this.speedIndex = 2;
                        this._startTick();
                    }
                    break;
                case '4':
                    if (this.phase === GAME_PHASE.PLAYING) {
                        this.speedIndex = 3;
                        this._startTick();
                    }
                    break;
                case '5':
                    if (this.phase === GAME_PHASE.PLAYING) {
                        this.speedIndex = 4;
                        this._startTick();
                    }
                    break;
            }
        });
    }
}

// 页面加载后启动游戏
window.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
});