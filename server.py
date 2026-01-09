#!/usr/bin/env python3
"""
NerdMiner Status Dashboard Server
Pool API primary + HTML scraping fallback with caching + SQLite history
"""

import http.server
import socketserver
from urllib.parse import urlparse, parse_qs
import json
import urllib.request
import urllib.error
import re
from html.parser import HTMLParser
import time
import database
import sys

# Default port (can be overridden via command-line argument)
PORT = 8000

# Parse command-line arguments for custom port
if len(sys.argv) > 1:
    try:
        PORT = int(sys.argv[1])
        if PORT < 1 or PORT > 65535:
            print(f"⚠️  Invalid port number: {PORT}")
            print(f"   Port must be between 1 and 65535")
            print(f"   Using default port 8000 instead")
            PORT = 8000
    except ValueError:
        print(f"⚠️  Invalid port argument: {sys.argv[1]}")
        print(f"   Usage: python server.py [port]")
        print(f"   Using default port 8000 instead")
        PORT = 8000

# Initialize database on startup
database.init_database()

# Cache for miner data (IP -> {data, timestamp})
miner_cache = {}
CACHE_DURATION = 5  # seconds - reduce polling load on ESP32

class NerdMinerHTMLParser(HTMLParser):
    """Parse NerdMiner HTML to extract stats"""
    def __init__(self):
        super().__init__()
        self.data = {}
        self.current_tag = None
        self.current_attrs = {}
        self.in_val_span = False
        self.last_text = ""
        
    def handle_starttag(self, tag, attrs):
        self.current_tag = tag
        self.current_attrs = dict(attrs)
        # Check if this is a <span class="val">
        if tag == 'span' and self.current_attrs.get('class') == 'val':
            self.in_val_span = True
        
    def handle_endtag(self, tag):
        if tag == 'span':
            self.in_val_span = False
        
    def handle_data(self, data):
        text = data.strip()
        if not text:
            return
        
        # If we're in a val span, use the last_text to determine what this value is
        if self.in_val_span:
            # Hash Rate value
            if 'hash rate' in self.last_text.lower():
                match = re.search(r'([\d.]+)\s*(h/s|kh/s|mh/s)', text, re.IGNORECASE)
                if match:
                    hashrate = float(match.group(1))
                    unit = match.group(2).lower()
                    # Convert to H/s
                    if unit == 'kh/s':
                        hashrate = hashrate * 1000
                    elif unit == 'mh/s':
                        hashrate = hashrate * 1000000
                    self.data['hashrate'] = hashrate
            
            # Accepted Shares value
            elif 'accepted' in self.last_text.lower() and 'share' in self.last_text.lower():
                match = re.search(r'(\d+)', text)
                if match:
                    self.data['acceptedShares'] = int(match.group(1))
                    self.data['shares'] = int(match.group(1))  # Use same value for total shares
            
            # Best difficulty value
            elif 'best' in self.last_text.lower() and 'diff' in self.last_text.lower():
                match = re.search(r'([\d.]+)', text)
                if match:
                    self.data['bestDiff'] = float(match.group(1))
            
            # Temperature value (C or F)
            elif 'temp' in self.last_text.lower():
                match = re.search(r'([\d.]+)\s*[°]?\s*([cf])?', text, re.IGNORECASE)
                if match:
                    temp = float(match.group(1))
                    unit = match.group(2).lower() if match.group(2) else 'c'
                    # Convert Fahrenheit to Celsius if needed
                    if unit == 'f':
                        temp = (temp - 32) * 5.0 / 9.0
                    self.data['temp'] = round(temp, 1)
        
        # Save the current text for context
        self.last_text = text


def fetch_miner_with_cache(url):
    """Fetch miner data with intelligent caching to reduce load"""
    now = time.time()
    
    # Check cache first
    if url in miner_cache:
        cached_data, cached_time = miner_cache[url]
        if now - cached_time < CACHE_DURATION:
            return cached_data, True  # Cache hit
    
    # Fetch fresh data
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'NerdMiner-Dashboard'})
        with urllib.request.urlopen(req, timeout=18) as response:
            html_content = response.read().decode('utf-8', errors='ignore')
            
            parser = NerdMinerHTMLParser()
            parser.feed(html_content)
            
            # Cache the result
            miner_cache[url] = (parser.data, now)
            return parser.data, False  # Fresh fetch
            
    except Exception as e:
        error_msg = str(e)[:80]
        # Return stale cached data if available
        if url in miner_cache:
            cached_data, cached_time = miner_cache[url]
            age = int(now - cached_time)
            print(f"  ⚠ Using stale cache ({age}s old) for {url.split('/')[-1]} - Error: {error_msg}")
            return cached_data, True  # Stale cache
        print(f"  ✖ No cache available for {url.split('/')[-1]} - Error: {error_msg}")
        raise


class CORSRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Enable CORS
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()
    
    def do_GET(self):
        # Pool API proxy endpoint
        if self.path.startswith('/pool-api?'):
            parsed = urlparse(self.path)
            params = parse_qs(parsed.query)
            
            if 'wallet' not in params:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'Missing wallet parameter'}).encode())
                return
            
            wallet = params['wallet'][0]
            pool = params.get('pool', ['public-pool.io:40557'])[0]
            
            try:
                # Construct pool API URL based on pool type
                if 'public-pool.io' in pool:
                    # public-pool.io format
                    pool_url = f'https://{pool}/api/client/{wallet}'
                elif 'nerdminer' in pool.lower():
                    # pool.nerdminers.org format (might use different API path)
                    # Try common endpoints
                    if ':' not in pool:
                        pool = pool + ':3333'  # Default stratum port
                    pool_url = f'http://{pool}/api/stats/{wallet}'
                else:
                    # Generic format
                    pool_url = f'https://{pool}/api/client/{wallet}'
                    
                print(f"Fetching pool data from: {pool_url}")
                
                req = urllib.request.Request(pool_url)
                req.add_header('User-Agent', 'NerdMinerStatus/1.0')
                
                with urllib.request.urlopen(req, timeout=18) as response:
                    data = response.read()
                    
                try:
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(data)
                except (ConnectionAbortedError, BrokenPipeError):
                    pass
                
            except urllib.error.HTTPError as e:
                print(f"Pool API HTTP Error: {e.code} - {e.reason}")
                try:
                    self.send_response(e.code)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({'error': f'Pool API error: {e.reason}'}).encode())
                except (ConnectionAbortedError, BrokenPipeError):
                    pass
                
            except Exception as e:
                print(f"Pool API Error: {str(e)}")
                try:
                    self.send_response(500)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({'error': str(e)}).encode())
                except (ConnectionAbortedError, BrokenPipeError):
                    pass
            
            return
        
        # Proxy endpoint for fetching miner data
        if self.path.startswith('/proxy?'):
            parsed = urlparse(self.path)
            params = parse_qs(parsed.query)
            
            if 'url' not in params:
                self.send_error(400, "Missing 'url' parameter")
                return
            
            target_url = params['url'][0]
            
            try:
                # Fetch with caching
                data, from_cache = fetch_miner_with_cache(target_url)
                json_data = json.dumps(data)
                
                # Send successful response
                try:
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    # Add cache indicator header
                    self.send_header('X-Cache', 'HIT' if from_cache else 'MISS')
                    self.end_headers()
                    self.wfile.write(json_data.encode())
                except (ConnectionAbortedError, BrokenPipeError):
                    # Client closed connection - ignore
                    pass
                    
            except urllib.error.HTTPError as e:
                print(f"Proxy HTTP Error for {target_url}: {e.code}")
                try:
                    self.send_response(500)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    error_msg = json.dumps({'error': f'HTTP {e.code}', 'code': e.code})
                    self.wfile.write(error_msg.encode())
                except (ConnectionAbortedError, BrokenPipeError):
                    pass
                
            except Exception as e:
                print(f"Proxy Error for {target_url}: {str(e)}")
                try:
                    self.send_response(500)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    error_msg = json.dumps({'error': str(e)})
                    self.wfile.write(error_msg.encode())
                except (ConnectionAbortedError, BrokenPipeError):
                    pass
            return
        
        # History endpoint - get miner history
        if self.path.startswith('/history/miner?'):
            parsed = urlparse(self.path)
            params = parse_qs(parsed.query)
            
            miner_ip = params.get('ip', [None])[0]
            hours = int(params.get('hours', [24])[0])
            
            if not miner_ip:
                self.send_error(400, "Missing 'ip' parameter")
                return
            
            try:
                history = database.get_miner_history(miner_ip, hours)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(history).encode())
            except Exception as e:
                print(f"History Error: {str(e)}")
                self.send_error(500, str(e))
            return
        
        # History endpoint - get all miners history
        if self.path.startswith('/history/all'):
            parsed = urlparse(self.path)
            params = parse_qs(parsed.query)
            hours = int(params.get('hours', [24])[0])
            
            try:
                history = database.get_all_miners_history(hours)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(history).encode())
            except Exception as e:
                print(f"History Error: {str(e)}")
                self.send_error(500, str(e))
            return
        
        # History endpoint - get total stats history
        if self.path.startswith('/history/total'):
            parsed = urlparse(self.path)
            params = parse_qs(parsed.query)
            hours = int(params.get('hours', [24])[0])
            
            try:
                history = database.get_total_stats_history(hours)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(history).encode())
            except Exception as e:
                print(f"History Error: {str(e)}")
                self.send_error(500, str(e))
            return
        
        # Database stats endpoint
        if self.path == '/db/stats':
            try:
                stats = database.get_database_stats()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(stats).encode())
            except Exception as e:
                print(f"DB Stats Error: {str(e)}")
                self.send_error(500, str(e))
            return
        
        # Serve static files normally
        super().do_GET()
    
    def do_POST(self):
        # Save miner data endpoint
        if self.path == '/save':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data.decode('utf-8'))
                miner_ip = data.get('ip')
                miner_name = data.get('name')
                miner_data = data.get('data', {})
                
                if not miner_ip:
                    self.send_error(400, "Missing 'ip' field")
                    return
                
                # Save to database
                database.save_miner_data(miner_ip, miner_name, miner_data)
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': True}).encode())
            except Exception as e:
                print(f"Save Error: {str(e)}")
                self.send_error(500, str(e))
            return
        
        self.send_error(404)

if __name__ == '__main__':
    # Cleanup old data on startup (keep 30 days)
    try:
        database.cleanup_old_data(days=30)
    except Exception as e:
        print(f"⚠️  Cleanup error: {e}")
    
    with socketserver.TCPServer(("", PORT), CORSRequestHandler) as httpd:
        print(f"🚀 NerdMiner Dashboard Server running on http://localhost:{PORT}")
        print(f"📊 Miner data cached for {CACHE_DURATION}s to reduce ESP32 load")
        print(f"💾 SQLite history tracking enabled")
        print(f"⏱️  Update interval: 5s (most requests served from cache)")
        print(f"Press Ctrl+C to stop\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n👋 Server stopped")

