// 地图系统
const CELL_TYPE = {
    FLOOR: 0,
    WALL: 1,
};

class Grid {
    constructor() {
        this.cols = CONFIG.GRID_COLS;
        this.rows = CONFIG.GRID_ROWS;
        this.cells = [];
        this.deadZones = []; // 死亡标记 [{x, y, turnsLeft}]
    }
    
    // 生成地图
    generate() {
        this.cells = [];
        this.deadZones = [];
        
        // 初始化全空地
        for (let y = 0; y < this.rows; y++) {
            this.cells[y] = [];
            for (let x = 0; x < this.cols; x++) {
                this.cells[y][x] = CELL_TYPE.FLOOR;
            }
        }
        
        // 随机放置墙壁（确保连通性）
        this._generateWalls();
        
        // 确保边界是墙
        this._ensureBorders();
    }
    
    _generateWalls() {
        // 生成一些墙壁簇，让地图更有趣
        const wallCount = Math.floor(this.cols * this.rows * CONFIG.WALL_DENSITY);
        let placed = 0;
        
        // 随机种子点，然后向外扩展
        const clusterCount = Math.floor(wallCount / 5) + 3;
        for (let c = 0; c < clusterCount && placed < wallCount; c++) {
            const cx = Math.floor(Math.random() * (this.cols - 4)) + 2;
            const cy = Math.floor(Math.random() * (this.rows - 4)) + 2;
            
            // 从种子点扩展
            const size = Math.floor(Math.random() * 4) + 2;
            for (let i = 0; i < size && placed < wallCount; i++) {
                const dx = cx + Math.floor(Math.random() * 3) - 1;
                const dy = cy + Math.floor(Math.random() * 3) - 1;
                
                if (dx > 0 && dx < this.cols - 1 && dy > 0 && dy < this.rows - 1) {
                    if (this.cells[dy][dx] === CELL_TYPE.FLOOR) {
                        this.cells[dy][dx] = CELL_TYPE.WALL;
                        placed++;
                    }
                }
            }
        }
        
        // 再加一些散落的单个墙壁
        while (placed < wallCount) {
            const x = Math.floor(Math.random() * (this.cols - 2)) + 1;
            const y = Math.floor(Math.random() * (this.rows - 2)) + 1;
            if (this.cells[y][x] === CELL_TYPE.FLOOR) {
                this.cells[y][x] = CELL_TYPE.WALL;
                placed++;
            }
        }
    }
    
    _ensureBorders() {
        for (let x = 0; x < this.cols; x++) {
            this.cells[0][x] = CELL_TYPE.WALL;
            this.cells[this.rows - 1][x] = CELL_TYPE.WALL;
        }
        for (let y = 0; y < this.rows; y++) {
            this.cells[y][0] = CELL_TYPE.WALL;
            this.cells[y][this.cols - 1] = CELL_TYPE.WALL;
        }
    }
    
    // 检查是否可通行
    isWalkable(x, y) {
        if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return false;
        return this.cells[y][x] === CELL_TYPE.FLOOR;
    }
    
    // 获取随机空位（避开墙壁和指定实体）
    getRandomEmptyCell(entities = null) {
        let attempts = 0;
        while (attempts < 500) {
            const x = Math.floor(Math.random() * this.cols);
            const y = Math.floor(Math.random() * this.rows);
            
            if (this.cells[y][x] !== CELL_TYPE.FLOOR) {
                attempts++;
                continue;
            }
            
            // 检查是否有实体占据
            let occupied = false;
            if (entities) {
                for (const e of entities) {
                    if (e.alive && e.x === x && e.y === y) {
                        occupied = true;
                        break;
                    }
                }
            }
            
            if (!occupied) return { x, y };
            attempts++;
        }
        return null;
    }
    
    // 曼哈顿距离
    static distance(x1, y1, x2, y2) {
        return Math.abs(x1 - x2) + Math.abs(y1 - y2);
    }
    
    // 寻找最近的目标（BFS）
    findPathBFS(startX, startY, targetCheck) {
        const visited = new Set();
        const queue = [{ x: startX, y: startY, path: [] }];
        visited.add(`${startX},${startY}`);
        
        while (queue.length > 0) {
            const current = queue.shift();
            
            // 检查当前格是否满足条件
            if (targetCheck(current.x, current.y)) {
                return current.path;
            }
            
            // 四方向扩展
            const dirs = [
                { dx: 0, dy: -1 }, // 上
                { dx: 0, dy: 1 },  // 下
                { dx: -1, dy: 0 }, // 左
                { dx: 1, dy: 0 },  // 右
            ];
            
            for (const dir of dirs) {
                const nx = current.x + dir.dx;
                const ny = current.y + dir.dy;
                const key = `${nx},${ny}`;
                
                if (!visited.has(key) && this.isWalkable(nx, ny)) {
                    visited.add(key);
                    queue.push({
                        x: nx,
                        y: ny,
                        path: [...current.path, { x: nx, y: ny }],
                    });
                }
            }
        }
        
        return null; // 找不到路径
    }
    
    // 获取下一步方向（向目标移动）
    getNextStepTowards(fromX, fromY, toX, toY) {
        const path = this.findPathBFS(fromX, fromY, (x, y) => x === toX && y === toY);
        if (path && path.length > 0) {
            return path[0];
        }
        return null;
    }
    
    // 获取远离目标的下一步（带随机性，不总沿直线跑）
    getNextStepAway(fromX, fromY, fromThreatX, fromThreatY) {
        const dirs = [
            { dx: 0, dy: -1 },
            { dx: 0, dy: 1 },
            { dx: -1, dy: 0 },
            { dx: 1, dy: 0 },
        ];
        
        // 收集所有可行方向及其距离分数
        const candidates = [];
        for (const dir of dirs) {
            const nx = fromX + dir.dx;
            const ny = fromY + dir.dy;
            if (this.isWalkable(nx, ny)) {
                const dist = Grid.distance(nx, ny, fromThreatX, fromThreatY);
                candidates.push({ x: nx, y: ny, dist: dist });
            }
        }
        
        if (candidates.length === 0) return null;
        
        // 按距离排序（远的优先）
        candidates.sort((a, b) => b.dist - a.dist);
        
        // 从最好的2个方向中随机选择（增加逃跑路线多样性）
        const topN = Math.min(2, candidates.length);
        // 但只从距离 >= 最佳距离 -1 的候选中选（不会选到更差的）
        const bestDist = candidates[0].dist;
        const goodCandidates = candidates.filter(c => c.dist >= bestDist - 1);
        
        return goodCandidates[Math.floor(Math.random() * goodCandidates.length)];
    }
    
    // 获取远离威胁且顺路拾取物品的下一步
    getNextStepAwayWithPickup(fromX, fromY, fromThreatX, fromThreatY, nearbyItems) {
        const dirs = [
            { dx: 0, dy: -1 },
            { dx: 0, dy: 1 },
            { dx: -1, dy: 0 },
            { dx: 1, dy: 0 },
        ];
        
        const candidates = [];
        for (const dir of dirs) {
            const nx = fromX + dir.dx;
            const ny = fromY + dir.dy;
            if (!this.isWalkable(nx, ny)) continue;
            
            const dist = Grid.distance(nx, ny, fromThreatX, fromThreatY);
            
            // 检查是否有物品（顺路拾取加分）
            const item = nearbyItems ? nearbyItems.find(i => i.x === nx && i.y === ny) : null;
            let itemBonus = 0;
            if (item) {
                itemBonus = item.type === 'food' ? 20 : 15;
            }
            
            candidates.push({ 
                x: nx, y: ny, 
                score: dist * 2 + itemBonus
            });
        }
        
        if (candidates.length === 0) return null;
        
        // 按综合分数排序
        candidates.sort((a, b) => b.score - a.score);
        
        // 从前2名中随机选
        const topN = Math.min(2, candidates.length);
        const topCandidates = candidates.slice(0, topN);
        return topCandidates[Math.floor(Math.random() * topCandidates.length)];
    }
    
    // 添加死亡标记
    addDeadZone(x, y) {
        this.deadZones.push({ x, y, turnsLeft: 20 });
    }
    
    // 更新死亡标记
    updateDeadZones() {
        this.deadZones = this.deadZones.filter(dz => {
            dz.turnsLeft--;
            return dz.turnsLeft > 0;
        });
    }
}