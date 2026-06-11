

document.addEventListener('DOMContentLoaded', () => {
  
    const screenLoader = document.getElementById('screenLoader');
    const catalogRibbon = document.getElementById('quickButtons');
    const searchForm = document.getElementById('searchForm');
    const symbolInput = document.getElementById('symbolInput');
    

    const apiStatusAlert = document.getElementById('apiStatusAlert');
    const apiStatusText = document.getElementById('apiStatusText');

 
    const stockTickerEl = document.getElementById('stockTicker');
    const stockNameEl = document.getElementById('stockName');
    const stockSectorEl = document.getElementById('stockSector');
    const currPriceEl = document.getElementById('currPrice');
    const priceChangeEl = document.getElementById('priceChange');
    const priceChangeValEl = document.getElementById('priceChangeVal');

    const recBadgeEl = document.getElementById('recBadge');
    const recLogicEl = document.getElementById('recLogic');
    const confidenceValEl = document.getElementById('confidenceVal');
    const riskBadgeEl = document.getElementById('riskBadge');

    const statVolEl = document.getElementById('statVol');
    const statCAGREl = document.getElementById('statCAGR');
    const statEPSEl = document.getElementById('statEPS');
    const statRevEl = document.getElementById('statRev');


    const queryLatencyEl = document.getElementById('queryLatency');
    const latencyIndicator = document.getElementById('latencyIndicator');
    const cacheIndicatorMsg = document.getElementById('cacheIndicator');
    const cacheTextEl = document.getElementById('cacheText');
    const forceLiveBtn = document.getElementById('forceLiveBtn');


    const leftIndexSlider = document.getElementById('leftIndexSlider');
    const rightIndexSlider = document.getElementById('rightIndexSlider');
    const leftIndexLabel = document.getElementById('leftIndexLabel');
    const rightIndexLabel = document.getElementById('rightIndexLabel');
    const segMinEl = document.getElementById('segMin');
    const segMaxEl = document.getElementById('segMax');
    const segAvgEl = document.getElementById('segAvg');


    const sidebar = document.getElementById('sidebar');
    const sidebarMenuBtn = document.getElementById('sidebarMenu');
    const sidebarCloseBtn = document.getElementById('sidebarClose');
    const logoutBtn = document.getElementById('logoutBtn');

    let currentSymbol = 'AAPL';
    let chartInstance = null;
    let currentPricesHistory = [];
    let currentSMAHistory = [];


    if (sidebarMenuBtn) {
        sidebarMenuBtn.addEventListener('click', () => sidebar.classList.add('active'));
    }
    if (sidebarCloseBtn) {
        sidebarCloseBtn.addEventListener('click', () => sidebar.classList.remove('active'));
    }

  
    logoutBtn.addEventListener('click', () => {
        localStorage.clear();
        window.location.href = '/';
    });

 
    catalogRibbon.addEventListener('click', (e) => {
        const btn = e.target.closest('.ribbon-btn');
        if (!btn) return;

        document.querySelectorAll('.ribbon-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const sym = btn.getAttribute('data-symbol');
        loadStockDetails(sym);
    });


    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const sym = symbolInput.value.trim().toUpperCase();
        if (sym) {
          
            document.querySelectorAll('.ribbon-btn').forEach(b => {
                if (b.getAttribute('data-symbol') === sym) {
                    b.classList.add('active');
                } else {
                    b.classList.remove('active');
                }
            });
            loadStockDetails(sym);
            symbolInput.value = '';
        }
    });


    forceLiveBtn.addEventListener('click', () => {
        loadStockDetails(currentSymbol, true); 
    });


    
    async function loadStockDetails(symbol, bypassCache = false) {
        currentSymbol = symbol.toUpperCase();
        showScreenProgress(true);

        try {
            const url = `/api/stock?symbol=${currentSymbol}${bypassCache ? '&live=true' : ''}`;
            const response = await fetch(url);
            
            if (!response.ok) throw new Error('Query error');
            const data = await response.json();

            if (data.success && data.metrics) {
                const metrics = data.metrics;
                currentPricesHistory = metrics.history;
           
                currentSMAHistory = metrics.sma_history || calculateSMAArray(currentPricesHistory, 7);

         
                stockTickerEl.innerText = metrics.symbol;
                stockNameEl.innerText = STOCKS_MAP[metrics.symbol] || `${metrics.symbol} Inc.`;
                stockSectorEl.innerText = metrics.sector;
                currPriceEl.innerText = `$${metrics.price.toFixed(2)}`;
                
           
                const pct = metrics.changePercent;
                if (pct >= 0) {
                    priceChangeEl.className = 'stock-change positive';
                    priceChangeEl.innerHTML = `<i data-lucide="trending-up" class="w-4 h-4 mr-1"></i> <span>+$${metrics.change.toFixed(2)} (${pct.toFixed(2)}%)</span>`;
                } else {
                    priceChangeEl.className = 'stock-change negative';
                    priceChangeEl.innerHTML = `<i data-lucide="trending-down" class="w-4 h-4 mr-1"></i> <span>-$${Math.abs(metrics.change).toFixed(2)} (${pct.toFixed(2)}%)</span>`;
                }

             
                statVolEl.innerText = `${metrics.volatility.toFixed(2)}%`;
                statCAGREl.innerText = `${metrics.growth >= 0 ? '+' : ''}${metrics.growth.toFixed(2)}%`;
                statEPSEl.innerText = `$${metrics.eps.toFixed(2)}`;
                statRevEl.innerText = `+${metrics.revenueTrend.toFixed(2)}%`;

          
                recBadgeEl.innerText = metrics.recommendation;
                recBadgeEl.className = `recommendation-badge ${metrics.recommendation.toLowerCase()}`;
             
                if (metrics.recommendation === 'BUY') {
                    recLogicEl.innerText = "Target price above 20-day Simple Moving Average Index, low relative risk, and robust compound CAGR.";
                } else if (metrics.recommendation === 'SELL') {
                    recLogicEl.innerText = "Negative time-series growth consistency or high annualized volatility levels detected.";
                } else {
                    recLogicEl.innerText = "Stable asset indicators. Sideways market index consolidation holds price boundaries.";
                }

                confidenceValEl.innerText = `${metrics.confidence}%`;
                
                riskBadgeEl.innerText = `${metrics.riskLevel} Risk`;
                riskBadgeEl.className = `risk-badge ${metrics.riskLevel.toLowerCase()}`;

               
                queryLatencyEl.innerText = `${data.latency_ms.toFixed(3)} ms`;
                
                const latPercent = Math.min((data.latency_ms / 300) * 100, 100);
                latencyIndicator.style.width = `${latPercent}%`;

              
                if (data.cached) {
                    cacheTextEl.innerHTML = `<i data-lucide="database" class="w-4 h-4 mr-2"></i> Cache lookup hit! Extracted in <b>${data.latency_ms.toFixed(3)}ms</b>`;
                    if (cacheIndicatorMsg) cacheIndicatorMsg.className = "cache-status-indicator flex items-center";
                } else {
                    cacheTextEl.innerHTML = `<i data-lucide="globe" class="w-4 h-4 mr-2 text-rose-400"></i> Cache miss! Fresh server fetch in <b>${data.latency_ms.toFixed(3)}ms</b>`;
                    if (cacheIndicatorMsg) cacheIndicatorMsg.className = "cache-status-indicator flex items-center border-rose-500/20 bg-rose-500/5 text-rose-400";
                }
                   

                if (typeof lucide !== 'undefined') {
                    lucide.createIcons();
                }

          
                renderAnalyticsChart(currentPricesHistory, currentSMAHistory);

             
                resetSegmentTreeQueries();

                lucide.createIcons();
            }
        } catch (err) {
            console.error('Fetch error:', err);
        } finally {
            showScreenProgress(false);
        }
    }



    leftIndexSlider.addEventListener('input', runSegmentTreeEvaluation);
    rightIndexSlider.addEventListener('input', runSegmentTreeEvaluation);

    async function runSegmentTreeEvaluation() {
        let left = parseInt(leftIndexSlider.value);
        let right = parseInt(rightIndexSlider.value);

     
        if (left > right) {
      
            if (this.id === 'leftIndexSlider') {
                right = left;
                rightIndexSlider.value = right;
            } else {
                left = right;
                leftIndexSlider.value = left;
            }
        }

        leftIndexLabel.innerText = `Day ${left}`;
        rightIndexLabel.innerText = `Day ${right}`;

        try {
            const response = await fetch(`/api/segment-tree-query?symbol=${currentSymbol}&left=${left}&right=${right}`);
            const res = await response.json();
            
            segMinEl.innerText = `$${res.min.toFixed(2)}`;
            segMaxEl.innerText = `$${res.max.toFixed(2)}`;
            segAvgEl.innerText = `$${res.avg.toFixed(2)}`;

          
            if (chartInstance) {
                highlightChartInterval(left, right);
            }
        } catch (e) {
            console.error('DSA Tree error:', e);
        }
    }

    function resetSegmentTreeQueries() {
    
        leftIndexSlider.value = 0;
        rightIndexSlider.value = 15;
        leftIndexLabel.innerText = 'Day 0';
        rightIndexLabel.innerText = 'Day 15';
        
        runSegmentTreeEvaluation();
    }


    function renderAnalyticsChart(prices, sma) {
        const ctx = document.getElementById('priceHistoryChart').getContext('2d');
        
        if (chartInstance) {
            chartInstance.destroy();
        }

        const labels = Array.from({ length: prices.length }, (_, i) => `Day ${i}`);

       
        const priceGradiant = ctx.createLinearGradient(0, 0, 0, 300);
        priceGradiant.addColorStop(0, 'rgba(34, 211, 238, 0.4)');
        priceGradiant.addColorStop(1, 'rgba(34, 211, 238, 0.02)');

        chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Price',
                        data: prices,
                        borderColor: '#22d3ee',
                        borderWidth: 2.5,
                        backgroundColor: priceGradiant,
                        fill: true,
                        tension: 0.15,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        pointBackgroundColor: '#22d3ee',
                        pointHoverBackgroundColor: '#ffffff'
                    },
                    {
                        label: 'SMA 20 Model',
                        data: sma,
                        borderColor: '#f59e0b',
                        borderWidth: 1.5,
                        borderDash: [5, 5],
                        fill: false,
                        tension: 0.1,
                        pointRadius: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false 
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: '#11141a',
                        titleColor: '#f3f4f6',
                        bodyColor: '#e5e7eb',
                        borderColor: 'rgba(255, 255, 255, 0.08)',
                        borderWidth: 1,
                        padding: 10
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.02)'
                        },
                        ticks: {
                            color: '#9ca3af',
                            font: { family: 'JetBrains Mono' }
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.02)'
                        },
                        ticks: {
                            color: '#9ca3af',
                            font: { family: 'JetBrains Mono' },
                            callback: function(value) { return '$' + value; }
                        }
                    }
                }
            }
        });
    }

    function highlightChartInterval(left, right) {
        if (!chartInstance) return;

      
        const pointColors = currentPricesHistory.map((_, idx) => {
            if (idx >= left && idx <= right) {
                return '#10b981'; 
            }
            return '#22d3ee';
        });

        const pointRadii = currentPricesHistory.map((_, idx) => {
            if (idx >= left && idx <= right) {
                return 5.5; 
            }
            return 3;
        });

        chartInstance.data.datasets[0].pointBackgroundColor = pointColors;
        chartInstance.data.datasets[0].pointRadius = pointRadii;
        chartInstance.update('none'); 
    }


    function showScreenProgress(isActive) {
        if (isActive) {
            screenLoader.classList.remove('fade-out');
        } else {
            screenLoader.classList.add('fade-out');
        }
    }

    function calculateSMAArray(prices, window) {
        const sma = [];
        for (let i = 0; i < prices.length; i++) {
            if (i < window - 1) {
                let sum = 0;
                for (let j = 0; j <= i; j++) sum += prices[j];
                sma.push(sum / (i + 1));
            } else {
                let sum = 0;
                for (let j = i - (window - 1); j <= i; j++) sum += prices[j];
                sma.push(sum / window);
            }
        }
        return sma;
    }

    const STOCKS_MAP = {
        "AAPL": "Apple Inc.", "MSFT": "Microsoft Corp.", "GOOGL": "Alphabet Inc.",
        "AMZN": "Amazon.com Inc.", "TSLA": "Tesla Inc.", "NVDA": "NVIDIA Corp.",
        "META": "Meta Platforms Inc.", "NFLX": "Netflix Inc."
    };

    // Initial Bootstrap
    loadStockDetails('AAPL');
});
