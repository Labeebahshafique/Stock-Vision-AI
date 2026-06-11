/**
 * StockVision AI - NodeJS Express backend (AI Studio active preview runtime)
 * Mimics Flask routing, serving templates, static assets, and providing the Stock API.
 */

import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import {
  CustomHashTable,
  StockGraph,
  SegmentTree,
  getTopPerformingStocks,
  StockMetrics
} from './src/dsa_components';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Set up simple caching structure
interface CacheEntry {
  data: any;
  timestamp: number;
}
const localCache = new Map<string, CacheEntry>();
const CACHE_TTL = 300000; // 5 minutes (300,000 ms)

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || '';
const DEMO_MODE = !FINNHUB_API_KEY;

const STOCKS_METADATA: Record<string, { name: string; sector: string }> = {
  AAPL: { name: 'Apple Inc.', sector: 'Technology' },
  MSFT: { name: 'Microsoft Corp.', sector: 'Technology' },
  GOOGL: { name: 'Alphabet Inc.', sector: 'Technology' },
  AMZN: { name: 'Amazon.com Inc.', sector: 'Consumer Cyclical' },
  TSLA: { name: 'Tesla Inc.', sector: 'Consumer Cyclical' },
  NVDA: { name: 'NVIDIA Corp.', sector: 'Technology' },
  META: { name: 'Meta Platforms Inc.', sector: 'Technology' },
  NFLX: { name: 'Netflix Inc.', sector: 'Communication Services' }
};

// Graph setup - Adjacency graph matching python setup
const stockGraph = new StockGraph();
Object.entries(STOCKS_METADATA).forEach(([sym, m]) => {
  stockGraph.addStock(sym, m.sector);
});
stockGraph.addCorrelation('AAPL', 'MSFT');
stockGraph.addCorrelation('AAPL', 'GOOGL');
stockGraph.addCorrelation('MSFT', 'GOOGL');
stockGraph.addCorrelation('MSFT', 'NVDA');
stockGraph.addCorrelation('GOOGL', 'META');
stockGraph.addCorrelation('META', 'NFLX');
stockGraph.addCorrelation('AMZN', 'TSLA');
stockGraph.addCorrelation('TSLA', 'NVDA');


function generateFallbackCandles(symbol: string, days = 100) {
  // Deterministic seed generation based on symbol hash
  let seed = 0;
  for (let i = 0; i < symbol.length; i++) {
    seed += symbol.charCodeAt(i);
  }
  const random = () => {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };

  const basePrices: Record<string, number> = {
    AAPL: 175.0, MSFT: 420.0, GOOGL: 170.0,
    AMZN: 185.0, TSLA: 175.0, NVDA: 900.0,
    META: 480.0, NFLX: 600.0
  };
  const base = basePrices[symbol.toUpperCase()] || 100.0;

  const prices: number[] = [base];
  const dates: number[] = [];
  const nowSec = Math.floor(Date.now() / 1000);
  
  for (let i = days - 1; i >= 0; i--) {
    dates.push(nowSec - (i * 86400));
  }

  for (let i = 0; i < days - 1; i++) {
    // Random walk with standard normal distribution approximation
    const r1 = random();
    const r2 = random();
    const noise = Math.sqrt(-2 * Math.log(r1)) * Math.cos(2 * Math.PI * r2); // Box-Muller transform
    const pctChange = 0.0005 + (0.015 * noise);
    prices.push(prices[prices.length - 1] * (1 + pctChange));
  }

  const high: number[] = [];
  const low: number[] = [];
  const open: number[] = [prices[0]];
  const volume: number[] = [];

  for (let i = 0; i < days; i++) {
    const highNoise = 1.002 + (random() * 0.018);
    const lowNoise = 0.98 + (random() * 0.018);
    high.push(prices[i] * highNoise);
    low.push(prices[i] * lowNoise);
    volume.push(Math.floor(1000000 + random() * 9000000));
    if (i > 0) {
      open.push(prices[i - 1]);
    }
  }

  return {
    c: prices,
    h: high,
    l: low,
    o: open,
    t: dates,
    v: volume,
    s: 'ok'
  };
}


function analyzeStockDataScience(symbol: string, rawData: { c: number[]; t: number[] }): StockMetrics {
  const sym = symbol.toUpperCase();
  const close = rawData.c;
  const len = close.length;

  // Simple Moving Average
  const sma: number[] = [];
  for (let i = 0; i < len; i++) {
    if (i < 19) {
      // average so far
      let sum = 0;
      for (let j = 0; j <= i; j++) sum += close[j];
      sma.push(sum / (i + 1));
    } else {
      let sum = 0;
      for (let j = i - 19; j <= i; j++) sum += close[j];
      sma.push(sum / 20);
    }
  }

  // Daily Returns
  const dailyReturns: number[] = [];
  for (let i = 0; i < len - 1; i++) {
    dailyReturns.push((close[i + 1] - close[i]) / close[i]);
  }

  // Volatility calculation (Standard Deviation using NumPy logic)
  const meanReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
  const variance = dailyReturns.reduce((sum, val) => sum + Math.pow(val - meanReturn, 2), 0) / dailyReturns.length;
  const dailyVol = Math.sqrt(variance);
  const annualizedVol = dailyVol * Math.sqrt(252);
  const volatilityScore = Math.min(Math.max(annualizedVol * 150, 5), 100);

  // CAGR
  const firstPrice = close[0];
  const lastPrice = close[len - 1];
  const years = len / 252;
  const cagr = Math.pow(lastPrice / firstPrice, 1 / years) - 1;
  const cagrPercent = cagr * 100;

  // Consistency (positive days vs total days)
  const positiveDays = dailyReturns.filter(x => x > 0).length;
  const consistencyRatio = (positiveDays / dailyReturns.length) * 100;

  // Mock deterministic EPS and revenue YoY growth
  let hashVal = 0;
  for (let i = 0; i < sym.length; i++) hashVal += sym.charCodeAt(i);
  const eps = parseFloat((2.5 + (hashVal % 6) + ((hashVal % 10) / 10)).toFixed(2));
  const revenueTrend = parseFloat((4.5 + (hashVal % 15)).toFixed(2));

  // Risk logic
  let riskLevel: 'Low' | 'Medium' | 'High' = 'Medium';
  if (volatilityScore > 40 || revenueTrend < 2 || eps < 0) {
    riskLevel = 'High';
  } else if (volatilityScore < 20 && revenueTrend > 7) {
    riskLevel = 'Low';
  }

  // Recommendation indicators
  const sma20Latest = sma[len - 1];
  const isAboveMA = lastPrice > sma20Latest;
  const isGrowthPositive = cagrPercent > 3.0;
  const isVolatilityLow = volatilityScore < 35;

  let recommendation: 'BUY' | 'HOLD' | 'SELL' = 'HOLD';
  let confidence = 50;

  if (isAboveMA && isGrowthPositive && isVolatilityLow) {
    recommendation = 'BUY';
    confidence = Math.floor(80 + (5 * (1 - volatilityScore / 100)) + Math.min(cagrPercent, 10));
  } else if (!isAboveMA && (cagrPercent < 0 || volatilityScore > 45)) {
    recommendation = 'SELL';
    confidence = Math.floor(75 + volatilityScore * 0.25);
  } else {
    recommendation = 'HOLD';
    confidence = Math.floor(60 + (consistencyRatio * 0.2));
  }

  confidence = Math.min(Math.max(confidence, 40), 98);

  const history = close.slice(-30).map(x => parseFloat(x.toFixed(2)));
  const sector = STOCKS_METADATA[sym]?.sector || 'Technology';

  return {
    symbol: sym,
    price: parseFloat(lastPrice.toFixed(2)),
    change: parseFloat((lastPrice - close[len - 2]).toFixed(2)),
    changePercent: parseFloat((((lastPrice - close[len - 2]) / close[len - 2]) * 100).toFixed(2)),
    volatility: parseFloat(volatilityScore.toFixed(2)),
    riskLevel,
    recommendation,
    confidence,
    growth: parseFloat(cagrPercent.toFixed(2)),
    eps,
    revenueTrend,
    history,
    sector
  };
}


// Serve static directories cleanly
app.use('/static', express.static(path.join(process.cwd(), 'static')));

// Auth handler
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'stockvision123') {
    res.json({ success: true, token: 'sv_authenticated_token_98291', user: 'University Auditor' });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credential pair! Use admin / stockvision123' });
  }
});

// Stock detail API (mirrors Flask implementation on Node)
app.get('/api/stock', async (req, res) => {
  const symbol = (req.query.symbol as string || 'AAPL').toUpperCase();
  const forceLive = req.query.live === 'true';

  const cacheKey = `stock_data_${symbol}`;
  const startTime = process.hrtime();

  // Search local Cache first
  if (!forceLive && localCache.has(cacheKey)) {
    const entry = localCache.get(cacheKey)!;
    if (Date.now() - entry.timestamp < CACHE_TTL) {
      const diff = process.hrtime(startTime);
      const latencyMs = (diff[0] * 1000) + (diff[1] / 1000000);
      
      const cachedResponse = { ...entry.data };
      cachedResponse.latency_ms = parseFloat(latencyMs.toFixed(3));
      cachedResponse.cached = true;
      return res.json(cachedResponse);
    }
  }

  let rawCandles: any = null;
  let apiSource = 'Live API Fetch';

  if (DEMO_MODE) {
    rawCandles = generateFallbackCandles(symbol, 120);
    apiSource = 'Demo Mode (Mock Synthesis)';
    // Artificially delay slightly to mimic standard API payload latency
    await new Promise(resolve => setTimeout(resolve, 80));
  } else {
    const toTime = Math.floor(Date.now() / 1000);
    const fromTime = toTime - (120 * 86400);
    const url = `https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=D&from=${fromTime}&to=${toTime}&token=${FINNHUB_API_KEY}`;
    
    try {
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json() as any;
        if (data && data.s === 'ok') {
          rawCandles = data;
        } else {
          rawCandles = generateFallbackCandles(symbol);
          apiSource = 'Finnhub Node Fallback (Invalid product response)';
        }
      } else {
        rawCandles = generateFallbackCandles(symbol);
        apiSource = `API Fetch Failed with Code ${response.status}`;
      }
    } catch (e: any) {
      rawCandles = generateFallbackCandles(symbol);
      apiSource = `Net Connection Error: ${e.message}`;
    }
  }

  // Analyze Stock
  const metrics = analyzeStockDataScience(symbol, rawCandles);

  // Segment Tree computation
  const segmentTree = new SegmentTree(rawCandles.c);
  const fullRangeQuery = segmentTree.query(0, rawCandles.c.length - 1);

  const diff = process.hrtime(startTime);
  const latencyMs = (diff[0] * 1000) + (diff[1] / 1000000);

  const responseData = {
    success: true,
    metrics: {
      ...metrics,
      fullRangeQuery,
      candle_count: rawCandles.c.length,
      segment_tree_total: rawCandles.c.length
    },
    api_source: apiSource,
    cached: false,
    latency_ms: parseFloat(latencyMs.toFixed(3)),
    raw_prices: rawCandles.c.slice(-30)
  };

  // Cache response
  localCache.set(cacheKey, {
    data: responseData,
    timestamp: Date.now()
  });

  res.json(responseData);
});

// Segment Tree interval query in O(log N)
app.get('/api/segment-tree-query', (req, res) => {
  const symbol = (req.query.symbol as string || 'AAPL').toUpperCase();
  const leftIdx = parseInt(req.query.left as string || '0', 10);
  const rightIdx = parseInt(req.query.right as string || '10', 10);

  const cacheKey = `stock_data_${symbol}`;
  const entry = localCache.get(cacheKey);

  let rawPrices: number[] = [];
  if (entry) {
    rawPrices = entry.data.raw_prices;
  } else {
    rawPrices = generateFallbackCandles(symbol).c;
  }

  const left = Math.max(0, Math.min(leftIdx, rawPrices.length - 1));
  const right = Math.max(left, Math.min(rightIdx, rawPrices.length - 1));

  const segTree = new SegmentTree(rawPrices);
  const result = segTree.query(left, right);

  res.json({
    symbol,
    left,
    right,
    min: result.min,
    max: result.max,
    avg: result.avg,
    count: rawPrices.length
  });
});

// Market Insights Ranking & Traversals (Heap + Graph)
app.get('/api/market-insights', async (req, res) => {
  const startPoint = (req.query.start_stock as string || 'AAPL').toUpperCase();
  const allMetrics: StockMetrics[] = [];

  for (const sym of Object.keys(STOCKS_METADATA)) {
    const cacheKey = `stock_data_${sym}`;
    let metrics: StockMetrics;

    if (localCache.has(cacheKey)) {
      metrics = localCache.get(cacheKey)!.data.metrics;
    } else {
      const candles = generateFallbackCandles(sym);
      metrics = analyzeStockDataScience(sym, candles);
      
      const mockResponse = {
        success: true,
        metrics,
        api_source: 'Pre-cache initial loader',
        cached: false,
        latency_ms: 1.5,
        raw_prices: candles.c.slice(-30)
      };
      
      localCache.set(cacheKey, {
        data: mockResponse,
        timestamp: Date.now()
      });
    }
    allMetrics.push(metrics);
  }

  // 1. Heap PQ Ranking
  const heapElements = allMetrics.map(m => {
    // Score matches python exactly for composite sorting
    const score = m.growth * 0.65 + m.confidence * 0.25 - m.volatility * 0.1;
    return { symbol: m.symbol, score, details: m };
  });

  const rankedStocks = getTopPerformingStocks(heapElements, 5);

  // 2. Lowest Risk Stocks Sort
  const lowRiskStocks = [...allMetrics]
    .sort((a, b) => a.volatility - b.volatility)
    .slice(0, 4);

  // 3. Graph traversal results
  const bfsResult = stockGraph.bfs(startPoint);
  const dfsResult = stockGraph.dfs(startPoint);

  // Adjacency format
  const adjacency: Record<string, string[]> = {};
  Object.entries(stockGraph.adjacencyList).forEach(([k, v]) => {
    adjacency[k] = Array.from(v.edges);
  });

  res.json({
    success: true,
    ranked_stocks: rankedStocks,
    low_risk_stocks: lowRiskStocks,
    all_stocks: allMetrics,
    graph_connections: {
      start: startPoint,
      bfs: bfsResult,
      dfs: dfsResult,
      adjacency
    }
  });
});

// Front-end files serving routes
app.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'templates', 'login.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'templates', 'dashboard.html'));
});

app.get('/market-insights', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'templates', 'market_insights.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
