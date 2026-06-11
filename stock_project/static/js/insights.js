

document.addEventListener('DOMContentLoaded', () => {
    const screenLoader = document.getElementById('screenLoader');
    const rankingTableBody = document.querySelector('#rankingTable tbody');
    const lowRiskList = document.getElementById('lowRiskList');
    const logoutBtn = document.getElementById('logoutBtn');

    // Graph elements
    const startNodeSelect = document.getElementById('startNode');
    const runBfsBtn = document.getElementById('runBfsBtn');
    const runDfsBtn = document.getElementById('runDfsBtn');
    const pathDisplay = document.getElementById('pathDisplay');

    const STOCKS_MAP = {
        "AAPL": "Apple Inc.", "MSFT": "Microsoft Corp.", "GOOGL": "Alphabet Inc.",
        "AMZN": "Amazon.com Inc.", "TSLA": "Tesla Inc.", "NVDA": "NVIDIA Corp.",
        "META": "Meta Platforms Inc.", "NFLX": "Netflix Inc."
    };

    let graphData = null;
    let canvas = document.getElementById('graphCanvas');
    let ctx = canvas.getContext('2d');
    let nodePositions = {};
    let animationTimer = null;


    function setupCanvasDPI() {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * devicePixelRatio;
        canvas.height = 380 * devicePixelRatio;
        ctx.scale(devicePixelRatio, devicePixelRatio);
    }


    window.addEventListener('resize', () => {
        if (canvas) {
            setupCanvasDPI();
            drawGraph();
        }
    });

   
    logoutBtn.addEventListener('click', () => {
        localStorage.clear();
        window.location.href = '/';
    });



    async function loadMarketInsights(startSymbol = 'AAPL') {
        showScreenProgress(true);
        try {
            const response = await fetch(`/api/market-insights?start_stock=${startSymbol}`);
            if (!response.ok) throw new Error('Insights fetch failed');
            const data = await response.json();

            if (data.success) {
                graphData = data.graph_connections;
                
             
                populateRankingTable(data.ranked_stocks);

            
                populateLowRiskSection(data.low_risk_stocks);

            
                calculateNodeCoordinates();
                drawGraph();
            }
        } catch (err) {
            console.error('Insights error:', err);
        } finally {
            showScreenProgress(false);
        }
    }


    function populateRankingTable(rankedStocks) {
        rankingTableBody.innerHTML = '';
        rankedStocks.forEach((item, index) => {
            const sym = item.symbol;
            const det = item.details;
            const rank = index + 1;
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="tbl-rank-col">#0${rank}</td>
                <td><span class="tbl-sym-badge">${sym}</span></td>
                <td>${STOCKS_MAP[sym] || sym}</td>
                <td class="tbl-score">${item.score.toFixed(2)}</td>
                <td class="tbl-cagr text-emerald-400">${det.growth >= 0 ? '+' : ''}${det.growth.toFixed(2)}%</td>
                <td><span class="tbl-signal-label ${det.recommendation.toLowerCase()}">${det.recommendation}</span></td>
            `;
            rankingTableBody.appendChild(tr);
        });
    }

    function populateLowRiskSection(lowRiskStocks) {
        lowRiskList.innerHTML = '';
        lowRiskStocks.forEach(stock => {
            const div = document.createElement('div');
            div.className = 'low-risk-item';
            div.innerHTML = `
                <div class="meta">
                    <span class="ticker">${stock.symbol}</span>
                    <span class="name">${STOCKS_MAP[stock.symbol] || stock.symbol}</span>
                </div>
                <div class="score-block">
                    <span class="score-val">${stock.volatility.toFixed(2)}</span>
                    <span class="score-lbl">Volatility</span>
                </div>
            `;
            lowRiskList.appendChild(div);
        });
    }


    
    function calculateNodeCoordinates() {
        const rect = canvas.getBoundingClientRect();
        const width = rect.width;
        const height = 380;
        const centerX = width / 2;
        const centerY = height / 2;
        const radialMultiplier = Math.min(centerX, centerY) - 45;

        const nodes = Object.keys(STOCKS_MAP);
        const nodeCount = nodes.length;

        
        nodes.forEach((sym, idx) => {
            const angle = (idx / nodeCount) * 2 * Math.PI - Math.PI / 2;
            nodePositions[sym] = {
                x: centerX + radialMultiplier * Math.cos(angle),
                y: centerY + radialMultiplier * Math.sin(angle)
            };
        });
    }

    function drawGraph(activePath = [], activeNode = null, queueNodes = []) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (!graphData) return;

        const adjacency = graphData.adjacency;

     
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1.5;
        
        Object.entries(adjacency).forEach(([fromNode, edges]) => {
            const pos1 = nodePositions[fromNode];
            if (!pos1) return;
            
            edges.forEach(toNode => {
                const pos2 = nodePositions[toNode];
                if (!pos2) return;

               
                let isHighlighted = false;
                const idx1 = activePath.indexOf(fromNode);
                const idx2 = activePath.indexOf(toNode);
                
                
                if (idx1 !== -1 && idx2 !== -1 && Math.abs(idx1 - idx2) === 1) {
                    isHighlighted = true;
                }

                if (isHighlighted) {
                    ctx.strokeStyle = 'rgba(16, 185, 129, 0.65)';
                    ctx.lineWidth = 2.5;
                } else {
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
                    ctx.lineWidth = 1.25;
                }

                ctx.beginPath();
                ctx.moveTo(pos1.x, pos1.y);
                ctx.lineTo(pos2.x, pos2.y);
                ctx.stroke();
            });
        });

    
        Object.keys(STOCKS_MAP).forEach(sym => {
            const pos = nodePositions[sym];
            if (!pos) return;

           
            let nodeBg = 'rgba(15, 15, 17, 0.85)';
            let strokeColor = 'rgba(255, 255, 255, 0.08)';
            let textColor = '#9ca3af';
            let glowGlow = false;

            if (sym === activeNode) {
           
                nodeBg = '#10b981';
                strokeColor = '#ffffff';
                textColor = '#ffffff';
                glowGlow = true;
            } else if (activePath.includes(sym)) {
             
                nodeBg = 'rgba(16, 185, 129, 0.15)';
                strokeColor = '#10b981';
                textColor = '#34d399';
            } else if (queueNodes.includes(sym)) {
            
                nodeBg = 'rgba(34, 211, 238, 0.15)';
                strokeColor = '#22d3ee';
                textColor = '#e0f7fa';
            }

        
            if (glowGlow) {
                ctx.shadowColor = 'rgba(16, 185, 129, 0.8)';
                ctx.shadowBlur = 15;
            } else {
                ctx.shadowBlur = 0;
            }

           
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 20, 0, 2 * Math.PI);
            ctx.fillStyle = nodeBg;
            ctx.fill();
            
            ctx.lineWidth = 2;
            ctx.strokeStyle = strokeColor;
            ctx.stroke();

          
            ctx.shadowBlur = 0; 
            ctx.fillStyle = textColor;
            ctx.font = 'bold 10px "JetBrains Mono"';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(sym, pos.x, pos.y);
        });
    }



    function triggerTraversal(type) {
        clearInterval(animationTimer);
        const startPoint = startNodeSelect.value;
        const traversalArray = type === 'BFS' ? graphData.bfs : graphData.dfs;

        pathDisplay.innerHTML = `<span class="text-indigo-400">Loading ${type} Sequence...</span>`;
        
        let step = 0;
        const visitedPath = [];
        const queueFrontier = [];

        animationTimer = setInterval(() => {
            if (step >= traversalArray.length) {
                clearInterval(animationTimer);
             
                pathDisplay.innerHTML = traversalArray.join(' <b class="text-indigo-500 font-bold">&rarr;</b> ');
                drawGraph(traversalArray, null, []);
                return;
            }

            const activeNode = traversalArray[step];
            visitedPath.push(activeNode);

         
            let displayQueue = [];
            if (type === 'BFS') {
                const adj = graphData.adjacency[activeNode] || [];
                adj.forEach(n => {
                    if (!visitedPath.includes(n)) displayQueue.push(n);
                });
            }

       
            pathDisplay.innerHTML = visitedPath.join(' &rarr; ') + ' <span class="animate-pulse text-indigo-400">&bull;&bull;&bull;</span>';
            
            drawGraph(visitedPath, activeNode, displayQueue);
            step++;
        }, 800); 
    }

    runBfsBtn.addEventListener('click', () => triggerTraversal('BFS'));
    runDfsBtn.addEventListener('click', () => triggerTraversal('DFS'));
    startNodeSelect.addEventListener('change', () => {
        const startPoint = startNodeSelect.value;
        loadMarketInsights(startPoint);
    });


    function showScreenProgress(isActive) {
        if (isActive) {
            screenLoader.classList.remove('fade-out');
        } else {
            screenLoader.classList.add('fade-out');
        }
    }

  
    setupCanvasDPI();
    loadMarketInsights('AAPL');
});
