## Automatic Database Reconnection System

This system has been updated with automatic database reconnection capabilities. When the database server goes down and comes back online, the application will automatically reconnect without requiring manual intervention.

### What's Changed

1. **New `database.py` Module**: A centralized database connection manager with built-in reconnection logic
   - Automatic connection retry with exponential backoff (2s, 4s, 8s, 16s, 32s)
   - Connection health checks (ping) before each query
   - Automatic reconnection on connection loss
   - Logging for debugging connection issues

2. **Updated Python Scripts**: All Python scripts now use the new Database class
   - `export_dtr.py` - DTR export functionality
   - `fetch_biometric.py` - Biometric data fetching
   - `refresh_dtr_direct.py` - DTR refresh engine
   - `mass_export_dtr.py` - Bulk PDF export

### Key Features

#### Automatic Retry Logic
- Retries failed connections up to 5 times by default
- Uses exponential backoff to avoid overwhelming the database server
- Each retry waits longer than the previous one:
  - Attempt 1: Wait 2 seconds
  - Attempt 2: Wait 4 seconds
  - Attempt 3: Wait 8 seconds
  - Attempt 4: Wait 16 seconds
  - Attempt 5: Wait 32 seconds (capped at 60s)

#### Connection Health Checks
- Before each query, the system verifies the connection is still active
- Uses MySQL `PING` command to check connection status
- Automatically reconnects if the connection is stale or lost

#### Error Handling
- Graceful fallback when database is unavailable
- Detailed logging of connection events and errors
- Minimal impact on application stability

### Usage Examples

#### In Your Python Scripts
```python
from database import Database
from config import get_db_config

# Initialize database with automatic reconnection
db_config = get_db_config()
db = Database(
    host=db_config.get('host', '192.168.1.52'),
    database=db_config.get('database', 'bless_dtr_test'),
    user=db_config.get('user', 'adtr'),
    password=db_config.get('password', 'adtr'),
    port=db_config.get('port', 3306)
)

# Execute queries - reconnects automatically if needed
db.execute("SELECT * FROM employees WHERE id = %s", (123,))
result = db.fetchone()

# Close connection when done
db.close()
```

#### Logging Output
When the database reconnects, you'll see logs like:
```
2025-01-15 10:30:45 - INFO - DATABASE: Attempting to connect to 192.168.1.52:3306/bless_dtr_test (attempt 1/5)
2025-01-15 10:30:46 - WARNING - DATABASE: Connection failed: Can't connect to MySQL server. Retrying in 2s... (1/5)
2025-01-15 10:30:48 - INFO - DATABASE: Attempting to connect to 192.168.1.52:3306/bless_dtr_test (attempt 2/5)
2025-01-15 10:30:49 - INFO - DATABASE: ✓ Successfully connected to database: 192.168.1.52/bless_dtr_test
```

### Troubleshooting

#### Issue: Still getting "Cannot connect to database" errors
**Solution**: 
- Check that your database server is running: `mysql -h 192.168.1.52 -u adtr -p`
- Verify the credentials in `config.json` are correct
- Ensure the database user has proper permissions
- Check firewall rules allow MySQL connections on port 3306

#### Issue: Slow connection recovery
**Solution**: 
- The exponential backoff is intentional to avoid overwhelming the database server
- Maximum wait time is 5 retries with up to 32 seconds between attempts
- Total maximum wait time is around 62 seconds for all retries

#### Issue: Logs are not showing
**Solution**:
- Check that Python's logging module is properly configured
- Logs are printed to console and can be redirected to a file
- Enable debug logging by modifying database.py logging level to DEBUG

### Configuration

The database connection parameters are stored in `config.json` and loaded by `config.py`:

```json
{
  "database": {
    "host": "192.168.1.52",
    "user": "adtr",
    "password": "adtr",
    "database": "bless_dtr_test",
    "port": 3306
  },
  "export": {
    "path": "exports"
  }
}
```

### For 24/7 Operations

Since your database only runs during business hours (morning), here's a recommended setup:

1. **Ensure the application stays running**: Use a process manager or scheduled task
   - The Node.js server (`index.js`) should run continuously
   - Python background workers should restart on failure

2. **Check connection status**: The system now logs all connection attempts
   - Monitor logs for "Successfully connected" messages
   - Monitor for any timeout or connection errors

3. **Schedule maintenance**: Since the database runs intermittently
   - Allow time for the initial connection retry loop to complete (up to ~60 seconds)
   - After database restarts, the system will automatically reconnect within this timeframe

### Performance Impact

- Minimal overhead: Connection health checks only run before each query
- No constant polling or background threads
- Efficient use of exponential backoff to minimize database strain
- Already-connected sessions experience no performance impact

### Future Enhancements

Potential improvements for consideration:
- Connection pooling for better concurrency
- Configurable retry counts and delays
- Health check intervals for long-running connections
- Metrics/statistics on reconnection events
