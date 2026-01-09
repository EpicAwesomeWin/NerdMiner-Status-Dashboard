# NerdMiner Status Dashboard

A comprehensive web-based status dashboard for monitoring NerdMiner devices with real-time updates, historical data tracking, and individual miner management.

## Features

### ️ Individual Miner Management
- Add miners by IP address (e.g., 192.168.1.32)
- Custom miner names for easy identification
- Real-time status monitoring (online/offline)
- Individual statistics per miner:
  - Current hashrate
  - Share count
  - Best difficulty
  - Temperature
- Individual hashrate graphs for each miner
- Remove miners with confirmation

### 📊 Total Statistics Dashboard
- Total number of miners
- Combined hashrate from all active miners
- Active vs offline miner count
- Aggregated hashrate graph

### ⚡ Auto-Update System
- Automatic data refresh every 3 seconds
- Real-time chart updates
- Smooth animations without page reload
- Maintains up to 20 data points per chart

### 💾 Historical Data Tracking
- SQLite database for persistent storage
- 30-day historical data retention
- Automatic cleanup of old records
- Performance metrics and trend analysis

## Installation

### Windows Quick Start
1. Double-click `SETUP.bat`
2. Double-click `START.bat`
3. Open browser to `http://localhost:8000`

### Manual Setup
1. Ensure Python 3.8+ is installed
2. Run `python init_database.py` (if using deployment package)
3. Run `python server.py` (default port 8000)
4. Open browser to `http://localhost:8000`

### Custom Port
- Run `python server.py 3000` for custom port
- Or use `START.bat` which prompts for port selection

## Usage

### Adding a Miner

1. Enter the miner's IP address in the "Miner IP Address" field
2. Optionally enter a custom name (e.g., "Living Room Miner")
3. Click "Add Miner"
4. The miner will appear in the Individual Miners section with live stats

## API Integration

The dashboard is designed to work with NerdMiner devices. To integrate with real miners:

### Miner API Endpoint
Replace the `fetchMinerData()` function in `script.js`:

```javascript
async function fetchMinerData(miner) {
    const response = await fetch(`http://${miner.ip}/api/status`);
    return await response.json();
}
```

Expected JSON response format:
```json
{
    "status": "online",
    "hashrate": 295.42,
    "shares": 1523,
    "bestDifficulty": 72.978,
    "temperature": 65,
    "lastShare": "2026-01-09T04:08:50Z",
    "uptime": 86400
}
```



## Configuration

### Server Configuration
- Default port: 8000
- Change via command line: `python server.py [port]`
- Or use START.bat for interactive port selection

### Data Retention
- Historical data stored in SQLite database
- Automatic cleanup of records older than 30 days
- 5-second cache duration to reduce ESP32 load

## Browser Compatibility

- Chrome/Edge (recommended)
- Firefox
- Safari
- Opera

Requires a modern browser with ES6+ support.

## Technologies Used

### Frontend
- **HTML5** - Structure
- **CSS3** - Styling with dark mode support
- **JavaScript (ES6+)** - Client-side logic
- **Bootstrap 5.3** - UI framework
- **Bootstrap Icons** - Icon set
- **Chart.js 4.4** - Data visualization

### Backend
- **Python 3.8+** - Server (standard library only)
- **SQLite3** - Database for historical tracking
- **HTTP Server** - Built-in Python server

### Zero External Dependencies
- No pip install required
- Uses only Python standard library
- Lightweight and portable

## Features in Detail

### Real-time Monitoring
- Data refreshes every 3 seconds
- Charts update smoothly without animation lag
- Status badges update instantly

### Responsive Design
- Mobile-friendly layout
- Adapts to different screen sizes
- Touch-friendly controls

### Visual Indicators
- Color-coded status badges
- Online/offline indicators
- Gradient card designs
- Hover effects for better UX

### Data Management
- SQLite database with automatic schema creation
- 30-day rolling data retention
- Efficient indexing for fast queries
- Real-time chart updates with caching

## Customization

### Changing Colors
Edit CSS custom properties in `styles.css`:

```css
:root {
    --primary-color: #00CFB6;
    --secondary-color: #00AD99;
    --success-color: #00844B;
    --danger-color: #DB1F1F;
    /* etc. */
}
```

### Adding More Statistics
Extend the miner object in `script.js` and update the UI accordingly.

## Troubleshooting

### Miners Not Updating
- Check if miner IPs are accessible from your network
- Verify CORS settings on miner devices
- Check browser console for errors

### Charts Not Displaying
- Ensure Chart.js CDN is accessible
- Check browser console for JavaScript errors
- Verify canvas elements exist in DOM

### Data Not Persisting
- Ensure database file has write permissions
- Check server console for database errors
- Verify `nerdminer_history.db` file exists

## License

This project is provided as-is for use with NerdMiner devices.

## Support

For issues or questions:
1. Check the browser console for errors
2. Verify API endpoints are configured correctly
3. Ensure network connectivity to miners
