#!/usr/bin/env python3
"""
SQLite database for NerdMiner history tracking
"""

import sqlite3
import json
from datetime import datetime, timedelta
import os

DB_FILE = 'nerdminer_history.db'

def init_database():
    """Initialize the database with required tables"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # Miner stats history table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS miner_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            miner_ip TEXT NOT NULL,
            miner_name TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            status TEXT,
            hashrate REAL,
            shares INTEGER,
            accepted_shares INTEGER,
            best_difficulty REAL,
            temperature INTEGER,
            uptime INTEGER
        )
    ''')
    
    # Create index for faster queries
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_miner_timestamp 
        ON miner_history(miner_ip, timestamp)
    ''')
    
    # Miner metadata table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS miners (
            ip TEXT PRIMARY KEY,
            name TEXT,
            first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    conn.close()
    print(f"✅ Database initialized: {DB_FILE}")

def save_miner_data(miner_ip, miner_name, data):
    """Save miner data to history"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # Update or insert miner metadata
    cursor.execute('''
        INSERT INTO miners (ip, name, last_seen)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(ip) DO UPDATE SET
            name = excluded.name,
            last_seen = CURRENT_TIMESTAMP
    ''', (miner_ip, miner_name))
    
    # Insert history record
    cursor.execute('''
        INSERT INTO miner_history 
        (miner_ip, miner_name, status, hashrate, shares, accepted_shares, 
         best_difficulty, temperature, uptime)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        miner_ip,
        miner_name,
        data.get('status', 'offline'),
        data.get('hashrate', 0),
        data.get('shares', 0),
        data.get('acceptedShares', 0),
        data.get('bestDiff', 0),
        data.get('temp', 0),
        data.get('uptime', 0)
    ))
    
    conn.commit()
    conn.close()

def get_miner_history(miner_ip, hours=24):
    """Get historical data for a specific miner with zero-filled gaps"""
    from datetime import datetime, timedelta
    
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT
            timestamp,
            status,
            hashrate,
            shares,
            accepted_shares,
            best_difficulty,
            temperature,
            uptime
        FROM miner_history
        WHERE miner_ip = ?
            AND timestamp >= datetime('now', '-' || ? || ' hours')
        ORDER BY timestamp ASC
    ''', (miner_ip, hours))
    
    rows = cursor.fetchall()
    conn.close()
    
    history = []
    for row in rows:
        history.append({
            'timestamp': row[0],
            'status': row[1],
            'hashrate': row[2],
            'shares': row[3],
            'accepted_shares': row[4],
            'best_difficulty': row[5],
            'temperature': row[6],
            'uptime': row[7]
        })
    
    return history

def get_all_miners_history(hours=24):
    """Get historical data for all miners"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT DISTINCT miner_ip, miner_name
        FROM miner_history
        WHERE timestamp >= datetime('now', '-' || ? || ' hours')
    ''', (hours,))
    
    miners = cursor.fetchall()
    result = {}
    
    for miner_ip, miner_name in miners:
        result[miner_ip] = {
            'name': miner_name,
            'history': get_miner_history(miner_ip, hours)
        }
    
    conn.close()
    return result

def get_total_stats_history(hours=24):
    """Get aggregated stats history across all miners"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT 
            timestamp,
            SUM(hashrate) as total_hashrate,
            SUM(accepted_shares) as total_shares,
            COUNT(DISTINCT miner_ip) as active_miners
        FROM miner_history
        WHERE timestamp >= datetime('now', '-' || ? || ' hours')
            AND status = 'online'
        GROUP BY timestamp
        ORDER BY timestamp ASC
    ''', (hours,))
    
    rows = cursor.fetchall()
    conn.close()
    
    history = []
    for row in rows:
        history.append({
            'timestamp': row[0],
            'total_hashrate': row[1],
            'total_shares': row[2],
            'active_miners': row[3]
        })
    
    return history

def cleanup_old_data(days=30):
    """Remove history older than specified days"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    cursor.execute('''
        DELETE FROM miner_history
        WHERE timestamp < datetime('now', '-' || ? || ' days')
    ''', (days,))
    
    deleted = cursor.rowcount
    conn.commit()
    conn.close()
    
    print(f"🧹 Cleaned up {deleted} old records (older than {days} days)")
    return deleted

def get_database_stats():
    """Get statistics about the database"""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # Total records
    cursor.execute('SELECT COUNT(*) FROM miner_history')
    total_records = cursor.fetchone()[0]
    
    # Unique miners
    cursor.execute('SELECT COUNT(*) FROM miners')
    total_miners = cursor.fetchone()[0]
    
    # Oldest record
    cursor.execute('SELECT MIN(timestamp) FROM miner_history')
    oldest = cursor.fetchone()[0]
    
    # Newest record
    cursor.execute('SELECT MAX(timestamp) FROM miner_history')
    newest = cursor.fetchone()[0]
    
    # Database file size
    file_size = os.path.getsize(DB_FILE) if os.path.exists(DB_FILE) else 0
    
    conn.close()
    
    return {
        'total_records': total_records,
        'total_miners': total_miners,
        'oldest_record': oldest,
        'newest_record': newest,
        'file_size_mb': round(file_size / (1024 * 1024), 2)
    }

if __name__ == '__main__':
    # Initialize database if run directly
    init_database()
    stats = get_database_stats()
    print(f"\n📊 Database Stats:")
    print(f"   Records: {stats['total_records']}")
    print(f"   Miners: {stats['total_miners']}")
    print(f"   Size: {stats['file_size_mb']} MB")
    if stats['oldest_record']:
        print(f"   Oldest: {stats['oldest_record']}")
        print(f"   Newest: {stats['newest_record']}")
