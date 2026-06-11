

import heapq
from collections import deque


class CustomHashTable:
    
    def __init__(self):
        self.table = {}

    def insert(self, key: str, value: dict):
   
        self.table[key.upper()] = value

    def search(self, key: str) -> dict:
       
        return self.table.get(key.upper())

    def exists(self, key: str) -> bool:
   
        return key.upper() in self.table

    def get_all(self) -> dict:
      
        return self.table


class StockGraph:
    
    def __init__(self):
        self.adjacency_list = {}

    def add_stock(self, symbol: str, sector: str):
        symbol = symbol.upper()
        if symbol not in self.adjacency_list:
            self.adjacency_list[symbol] = {
                "sector": sector,
                "edges": set()
            }

    def add_correlation(self, stock1: str, stock2: str):
      
        stock1 = stock1.upper()
        stock2 = stock2.upper()
        if stock1 in self.adjacency_list and stock2 in self.adjacency_list:
            self.adjacency_list[stock1]["edges"].add(stock2)
            self.adjacency_list[stock2]["edges"].add(stock1)

    def bfs(self, start_stock: str) -> list:
       
        start_stock = start_stock.upper()
        if start_stock not in self.adjacency_list:
            return []
            
        visited = set()
        queue = deque([start_stock])
        result = []
        
        while queue:
            node = queue.popleft()
            if node not in visited:
                visited.add(node)
                result.append(node)
           
                neighbors = sorted(list(self.adjacency_list[node]["edges"]))
                for neighbor in neighbors:
                    if neighbor not in visited:
                        queue.append(neighbor)
                        
        return result

    def dfs(self, start_stock: str) -> list:
      
        start_stock = start_stock.upper()
        if start_stock not in self.adjacency_list:
            return []
            
        visited = set()
        result = []
        
        def dfs_helper(node):
            visited.add(node)
            result.append(node)
            neighbors = sorted(list(self.adjacency_list[node]["edges"]))
            for neighbor in neighbors:
                if neighbor not in visited:
                    dfs_helper(neighbor)
                    
        dfs_helper(start_stock)
        return result


class SegmentTree:
    
    def __init__(self, data: list):
        self.n = len(data)
       
        self.tree = [None] * (4 * self.n)
        self.data = data
        if self.n > 0:
            self._build(0, 0, self.n - 1)

    def _build(self, tree_index: int, left: int, right: int):
        if left == right:
            val = self.data[left]
            self.tree[tree_index] = {"min": val, "max": val, "sum": val}
            return

        mid = (left + right) // 2
        left_child = 2 * tree_index + 1
        right_child = 2 * tree_index + 2

        self._build(left_child, left, mid)
        self._build(right_child, mid + 1, right)

        l_node = self.tree[left_child]
        r_node = self.tree[right_child]

        self.tree[tree_index] = {
            "min": min(l_node["min"], r_node["min"]),
            "max": max(l_node["max"], r_node["max"]),
            "sum": l_node["sum"] + r_node["sum"]
        }

    def query(self, query_left: int, query_right: int) -> dict:
        """Query range [query_left, query_right] for minimum, maximum, and average price"""
        if self.n == 0 or query_left < 0 or query_right >= self.n or query_left > query_right:
            return {"min": 0, "max": 0, "avg": 0, "sum": 0}
        
        node = self._query_helper(0, 0, self.n - 1, query_left, query_right)
        total_elements = (query_right - query_left + 1)
        node["avg"] = round(node["sum"] / total_elements, 2)
        node["min"] = round(node["min"], 2)
        node["max"] = round(node["max"], 2)
        return node

    def _query_helper(self, tree_index: int, left: int, r_boundary: int, query_left: int, query_right: int) -> dict:
        if left >= query_left and r_boundary <= query_right:
            return self.tree[tree_index].copy()

        mid = (left + r_boundary) // 2
        left_child = 2 * tree_index + 1
        right_child = 2 * tree_index + 2

        if query_right <= mid:
            return self._query_helper(left_child, left, mid, query_left, query_right)
        elif query_left > mid:
            return self._query_helper(right_child, mid + 1, r_boundary, query_left, query_right)

        left_result = self._query_helper(left_child, left, mid, query_left, query_right)
        right_result = self._query_helper(right_child, mid + 1, r_boundary, query_left, query_right)

        return {
            "min": min(left_result["min"], right_result["min"]),
            "max": max(left_result["max"], right_result["max"]),
            "sum": left_result["sum"] + right_result["sum"]
        }


def get_top_performing_stocks(stocks: list, k: int = 5) -> list:
   
   
    heap = []
    for stock in stocks:
    
        symbol, score, details = stock
       
        if len(heap) < k:
            heapq.heappush(heap, (score, symbol, details))
        else:
            if score > heap[0][0]:
                heapq.heappushpop(heap, (score, symbol, details))
                
   
    top_stocks = sorted(heap, key=lambda x: x[0], reverse=True)
    return [{"symbol": symbol, "score": round(score, 2), "details": details} for score, symbol, details in top_stocks]
