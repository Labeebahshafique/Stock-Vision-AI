

import os
import time
import math
import heapq
import pandas as pd
import numpy as np
import requests
from flask import Flask, render_template, jsonify, request, send_from_directory
from flask_caching import Cache
from dotenv import load_dotenv


from dsa_components import CustomHashTable, StockGraph, SegmentTree, get_top_performing_stocks


load_dotenv()

app = Flask(__name__, template_folder='templates', static_folder='static')


cache_config = {
    "DEBUG": True,
    "CACHE_TYPE": "SimpleCache",
    "CACHE_DEFAULT_TIMEOUT": 300  # 5 minutes cache
}
app.config.from_mapping(cache_config)
cache = Cache(app)

FINNHUB_API_KEY = os.getenv("FINNHUB_API_KEY", "")
DEMO_MODE = not bool(FINNHUB_API_KEY)


STOCKS_METADATA = {
    "AAPL": {"name": "Apple Inc.", "sector": "Technology"},
    "MSFT": {"name": "Microsoft Corp.", "sector": "Technology"},
    "GOOGL": {"name": "Alphabet Inc.", "sector": "Technology"},
    "AMZN": {"name": "Amazon.com Inc.", "sector": "Consumer Cyclical"},
    "TSLA": {"name": "Tesla Inc.", "sector": "Consumer Cyclical"},
    "NVDA": {"name": "NVIDIA Corp.", "sector": "Technology"},
    "META": {"name": "Meta Platforms Inc.", "sector": "Technology"},
    "NFLX": {"name": "Netflix Inc.", "sector": "Communication Services"}
}


stock_graph = StockGraph()
for sym, metadata in STOCKS_METADATA.items():
    stock_graph.add_stock(sym, metadata["sector"])

# Add correlation links based on sector alignment
stock_graph.add_correlation("AAPL", "MSFT")
stock_graph.add_correlation("AAPL", "GOOGL")
stock_graph.add_correlation("MSFT", "GOOGL")
stock_graph.add_correlation("MSFT", "NVDA")
stock_graph.add_correlation("GOOGL", "META")
stock_graph.add_correlation("META", "NFLX")
stock_graph.add_correlation("AMZN", "TSLA")
stock_graph.add_correlation("TSLA", "NVDA")


def generate_fallback_candles(symbol: str, days: int = 100) -> dict:
   
    np.random.seed(hash(symbol) % 1000)
    
    
    base_prices = {
        "AAPL": 175.0, "MSFT": 420.0, "GOOGL": 170.0,
        "AMZN": 185.0, "TSLA": 175.0, "NVDA": 900.0,
        "META": 480.0, "NFLX": 600.0
    }
    base = base_prices.get(symbol, 100.0)
  
    dates = pd.date_range(end=pd.Timestamp.now(), periods=days, freq='D')
    prices = [base]
    for _ in range(days - 1):
       
        pct_change = np.random.normal(0.0005, 0.015)
        prices.append(prices[-1] * (1 + pct_change))
        
    prices = np.array(prices)
    volume = np.random.randint(1000000, 10000000, size=days).tolist()
    
   
    noise_high = np.random.uniform(1.002, 1.02, size=days)
    noise_low = np.random.uniform(0.98, 0.998, size=days)
    high = (prices * noise_high).tolist()
    low = (prices * noise_low).tolist()
    
    
    opened = [prices[0]]
    for i in range(1, days):
        opened.append(prices[i - 1])
        
    return {
        "c": prices.tolist(),
        "h": high,
        "l": low,
        "o": opened,
        "t": [int(d.timestamp()) for d in dates],
        "v": volume,
        "s": "ok"
    }


def analyze_stock_data_science(symbol: str, raw_data: dict) -> dict:
   
    symbol = symbol.upper()
    close_prices = raw_data["c"]
    times = raw_data["t"]
    
    
    df = pd.DataFrame({
        'Date': pd.to_datetime(times, unit='s'),
        'Close': close_prices,
    })
    
   
    df['SMA_20'] = df['Close'].rolling(window=20).mean()
  
    df['SMA_20'] = df['SMA_20'].bfill()
    
   
    prices_arr = np.array(close_prices)
    daily_returns = np.diff(prices_arr) / prices_arr[:-1]
    
    
    daily_vol = np.std(daily_returns)
    annualized_vol = daily_vol * np.sqrt(252) 
    
   
    if np.isnan(annualized_vol):
        annualized_vol = 0.15 
        
  
    volatility_score = round(min(max(annualized_vol * 150, 5), 100), 2)
    

    first_price = prices_arr[0]
    last_price = prices_arr[-1]
    years = len(prices_arr) / 252.0  
    if years <= 0:
        years = 1.0
    cagr = ((last_price / first_price) ** (1 / years) - 1)
    
  
    cagr_percent = round(cagr * 100, 2)
    
 
    sma_20_latest = df['SMA_20'].iloc[-1]
    last_sma_difference = ((last_price - sma_20_latest) / sma_20_latest) * 100
    
    
    pos_days = np.sum(daily_returns > 0)
    consistency_ratio = round(pos_days / len(daily_returns) * 100, 2)
    
   
    np.random.seed(hash(symbol) % 500)
    eps = round(np.random.uniform(1.2, 8.5), 2)
    revenue_trend = round(np.random.uniform(4.0, 18.0), 2)  
    

    if volatility_score > 40 or revenue_trend < 2 or eps < 0:
        risk_level = "High"
    elif volatility_score > 20 or revenue_trend < 7:
        risk_level = "Medium"
    else:
        risk_level = "Low"
        
   
    is_above_ma = last_price > sma_20_latest
    is_growth_positive = cagr_percent > 3.0
    is_volatility_low = volatility_score < 35
    
    if is_above_ma and is_growth_positive and is_volatility_low:
        recommendation = "BUY"
        confidence = round(80 + (5 * (1 - volatility_score/100)) + min(cagr_percent, 10), 1)
    elif not is_above_ma and (cagr_percent < 0 or volatility_score > 45):
        recommendation = "SELL"
        confidence = round(75 + volatility_score * 0.25, 1)
    else:
        recommendation = "HOLD"
        confidence = round(60 + (consistency_ratio * 0.2), 1)
        
    confidence = min(max(confidence, 40), 98)
    
  
    history_prices = [round(p, 2) for p in prices_arr[-30:].tolist()]
    
    return {
        "symbol": symbol,
        "price": round(last_price, 2),
        "change": round(last_price - prices_arr[-2], 2),
        "changePercent": round(((last_price - prices_arr[-2]) / prices_arr[-2]) * 100, 2),
        "volatility": volatility_score,
        "riskLevel": risk_level,
        "recommendation": recommendation,
        "confidence": confidence,
        "growth": cagr_percent,
        "eps": eps,
        "revenueTrend": revenue_trend,
        "history": history_prices,
        "sma_history": [round(s, 2) for s in df['SMA_20'].iloc[-30:].tolist()],
        "sector": STOCKS_METADATA.get(symbol, {}).get("sector", "Technology")
    }


@app.route("/api/stock", methods=["GET"])
def get_stock_details():
   
    symbol = request.args.get("symbol", "AAPL").upper()
    force_live = request.args.get("live", "false").lower() == "true"
    
    cache_key = f"stock_data_{symbol}"
    

    start_time = time.perf_counter()
 
    cached_response = cache.get(cache_key)
    
    if cached_response and not force_live:
        latency_ms = (time.perf_counter() - start_time) * 1000
        cached_response["latency_ms"] = float(f"{latency_ms:.3f}")
        cached_response["cached"] = True
        return jsonify(cached_response)
        
   
    raw_candles = None
    api_source = "Live API Fetch"
    
    if DEMO_MODE:
        raw_candles = generate_fallback_candles(symbol, days=120)
        api_source = "Demo Mode (Mock Synthesis)"
        time.sleep(0.08)  
    else:
        
        to_time = int(time.time())
        from_time = to_time - (120 * 86400)  
      
        url = f"https://finnhub.io/api/v1/stock/candle?symbol={symbol}&resolution=D&from={from_time}&to={to_time}&token=YOUR_ACTUAL_KEY_ENDING_IN_vi7900"
        
        try:
            response = requests.get(url, timeout=5)
            if response.status_code == 200:
                data = response.json()
                if data.get("s") == "ok":
                    raw_candles = data
                else:
                    raw_candles = generate_fallback_candles(symbol)
                    api_source = "Finnhub Node Fallback (Invalid Product Type / Empty response)"
            else:
                raw_candles = generate_fallback_candles(symbol)
                api_source = f"API Fetch Failed with Code {response.status_code}"
        except Exception as e:
            raw_candles = generate_fallback_candles(symbol)
            api_source = f"Net Connection Error: {str(e)}"
            

    metrics = analyze_stock_data_science(symbol, raw_candles)
    
  
    segment_tree = SegmentTree(raw_candles["c"])
    tree_total = len(raw_candles["c"])
    range_test = segment_tree.query(0, tree_total - 1)
    
    metrics["fullRangeQuery"] = range_test
    metrics["candle_count"] = tree_total
    metrics["segment_tree_total"] = tree_total
    

    latency_ms = (time.perf_counter() - start_time) * 1000
    
    response_data = {
        "success": True,
        "metrics": metrics,
        "api_source": api_source,
        "cached": False,
        "latency_ms": float(f"{latency_ms:.3f}"),
        "raw_prices": raw_candles["c"][-30:] # Last 30 daily prices
    }
    

    cache.set(cache_key, response_data, timeout=300)
    
    return jsonify(response_data)


@app.route("/api/segment-tree-query", methods=["GET"])
def query_segment_tree():
    
    symbol = request.args.get("symbol", "AAPL").upper()
    left_idx = int(request.args.get("left", 0))
    right_idx = int(request.args.get("right", 15))
    
    
    cache_key = f"stock_data_{symbol}"
    cached_response = cache.get(cache_key)
    
    if cached_response:
        raw_prices = cached_response["metrics"]["history"]  # Holds last 30 values matching UI
    else:
       
        candles = generate_fallback_candles(symbol)
        metrics = analyze_stock_data_science(symbol, candles)
        raw_prices = metrics["history"]
        
   
    left_idx = max(0, min(left_idx, len(raw_prices) - 1))
    right_idx = max(left_idx, min(right_idx, len(raw_prices) - 1))
    
    seg_tree = SegmentTree(raw_prices)
    result = seg_tree.query(left_idx, right_idx)
    
    return jsonify({
        "symbol": symbol,
        "left": left_idx,
        "right": right_idx,
        "min": result["min"],
        "max": result["max"],
        "avg": result["avg"],
        "count": len(raw_prices)
    })


@app.route("/api/market-insights", methods=["GET"])
def get_market_insights():
    
    all_metrics = []
    
    for sym in STOCKS_METADATA.keys():
        cache_key = f"stock_data_{sym}"
        cached = cache.get(cache_key)
        
        if not cached:
            candles = generate_fallback_candles(sym)
            evaluated = analyze_stock_data_science(sym, candles)
            cached = {
                "metrics": evaluated,
                "latency_ms": 1.25,
                "cached": False
            }
            cache.set(cache_key, cached, timeout=300)
            
        all_metrics.append(cached["metrics"])
        
   
    heap_elements = []
    for m in all_metrics:
        score = m["growth"] * 0.65 + m["confidence"] * 0.25 - m["volatility"] * 0.1
        heap_elements.append((m["symbol"], score, m))
        
    ranked_stocks = get_top_performing_stocks(heap_elements, k=5)
    

    start_point = request.args.get("start_stock", "AAPL").upper()
    bfs_result = stock_graph.bfs(start_point)
    dfs_result = stock_graph.dfs(start_point)
  
    low_risk_heap = []
    for m in all_metrics:
        score = -m["volatility"] 
        heapq.heappush(low_risk_heap, (score, m["symbol"], m))
        
    sorted_low_risk = []
    while low_risk_heap:
        sc, sym, m = heapq.heappop(low_risk_heap)
        sorted_low_risk.append(m)
        
    return jsonify({
        "success": True,
        "ranked_stocks": ranked_stocks,
        "low_risk_stocks": sorted_low_risk[:4],
        "all_stocks": all_metrics,
        "graph_connections": {
            "start": start_point,
            "bfs": bfs_result,
            "dfs": dfs_result,
            "adjacency": {k: list(v["edges"]) for k, v in stock_graph.adjacency_list.items()}
        }
    })


@app.route("/api/login", methods=["POST"])
def auth_login():
    data = request.json or {}
    username = data.get("username", "")
    password = data.get("password", "")
    
    if username == "admin" and password == "stockvision123":
        return jsonify({"success": True, "token": "sv_authenticated_token_98291", "user": "University Auditor"})
    else:
        return jsonify({"success": False, "message": "Invalid credential pair! Use admin / stockvision123"})



@app.route("/")
def render_index():
    return render_template("login.html")


@app.route("/dashboard")
def render_dashboard_page():
    return render_template("dashboard.html")


@app.route("/market-insights")
def render_insights_page():
    return render_template("market_insights.html")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print("--------------------------------------------------")
    print(f"DEMO_MODE: {DEMO_MODE}")
    if DEMO_MODE:
        print("[!] Running in DEMO MODE (Using mock simulated stock data).")
        print("    To use real-time stock data from Finnhub, set FINNHUB_API_KEY in your .env file.")
    else:
        masked_key = FINNHUB_API_KEY[:4] + "..." + FINNHUB_API_KEY[-4:] if len(FINNHUB_API_KEY) > 8 else "***"
        print(f"[✓] Live Mode Active! Loaded FINNHUB_API_KEY: \"{masked_key}\"")
        if FINNHUB_API_KEY.startswith('"') or FINNHUB_API_KEY.endswith('"') or FINNHUB_API_KEY.startswith("'") or FINNHUB_API_KEY.endswith("'"):
            print("[WARNING] Your API key in .env seems to contain quotes (e.g., \"key\" or 'key').")
            print("          Please remove any surrounding quotes inside your .env file!")
    print("--------------------------------------------------")
    app.run(host="0.0.0.0", port=port, debug=True)