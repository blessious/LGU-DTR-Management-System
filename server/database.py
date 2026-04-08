#!/usr/bin/env python3
"""
Database connection manager with automatic reconnection support.
Handles connection pooling and automatic recovery from database server restarts.
"""

import mysql.connector
import time
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - DATABASE: %(message)s'
)
logger = logging.getLogger(__name__)


class Database:
    """
    Database connection manager with automatic reconnection capabilities.
    Automatically retries failed connections and reconnects if the database server restarts.
    """
    
    def __init__(self, host, database, user, password, port=3306, max_retries=5, retry_delay=2):
        """
        Initialize database connection with reconnection support.
        
        Args:
            host: Database host address
            database: Database name
            user: Database user
            password: Database password
            port: Database port (default: 3306)
            max_retries: Maximum number of connection retry attempts
            retry_delay: Initial delay between retry attempts in seconds (exponential backoff)
        """
        self.host = host
        self.database = database
        self.user = user
        self.password = password
        self.port = port
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self.connection = None
        self.cursor = None
        self._last_activity = datetime.now()
        
        # Connect with retries
        self._connect_with_retry()
    
    def _connect_with_retry(self):
        """
        Establish database connection with exponential backoff retry logic.
        Retries failed connections up to max_retries times.
        """
        retry_count = 0
        current_delay = self.retry_delay
        
        while retry_count < self.max_retries:
            try:
                logger.info(f"Attempting to connect to {self.host}:{self.port}/{self.database} "
                           f"(attempt {retry_count + 1}/{self.max_retries})")
                
                self.connection = mysql.connector.connect(
                    host=self.host,
                    database=self.database,
                    user=self.user,
                    password=self.password,
                    port=self.port,
                    autocommit=True,
                    connection_timeout=10
                )
                
                # Create cursor for this connection
                self.cursor = self.connection.cursor()
                self._last_activity = datetime.now()
                
                logger.info(f"✓ Successfully connected to database: {self.host}/{self.database}")
                return True
                
            except mysql.connector.Error as err:
                retry_count += 1
                if retry_count < self.max_retries:
                    logger.warning(f"✗ Connection failed: {err.msg}. "
                                 f"Retrying in {current_delay}s... ({retry_count}/{self.max_retries})")
                    time.sleep(current_delay)
                    # Exponential backoff: 2s, 4s, 8s, 16s, 32s
                    current_delay = min(current_delay * 2, 60)
                else:
                    logger.error(f"✗ Failed to connect after {self.max_retries} attempts: {err.msg}")
                    raise Exception(f"Database connection failed after {self.max_retries} retries: {err.msg}")
    
    def _ensure_connected(self):
        """
        Ensure database connection is active.
        Attempts to reconnect if connection is lost or stale.
        """
        try:
            if self.connection is None:
                logger.warning("Connection object is None, reconnecting...")
                self._connect_with_retry()
                return
            
            # Ping the connection to verify it's still active
            try:
                self.connection.ping(reconnect=True)
                self._last_activity = datetime.now()
                return
            except mysql.connector.Error as err:
                logger.warning(f"Connection ping failed: {err.msg}. Attempting to reconnect...")
                self._reconnect()
                
        except Exception as err:
            logger.error(f"Error ensuring connection: {err}")
            self._reconnect()
    
    def _reconnect(self):
        """
        Attempt to reconnect to the database.
        Closes any existing connection and establishes a new one with retries.
        """
        try:
            if self.connection:
                try:
                    self.cursor.close()
                except:
                    pass
                try:
                    self.connection.close()
                except:
                    pass
                
            logger.info("Reconnecting to database...")
            self._connect_with_retry()
            
        except Exception as err:
            logger.error(f"Reconnection failed: {err}")
            raise
    
    def execute(self, query, values=None):
        """
        Execute a database query with automatic reconnection on failure.
        
        Args:
            query: SQL query string
            values: Query parameters (for prepared statements)
            
        Returns:
            Query execution result (varies by query type)
        """
        try:
            self._ensure_connected()
            
            if values:
                self.cursor.execute(query, values)
            else:
                self.cursor.execute(query)
            
            self._last_activity = datetime.now()
            return self.cursor
            
        except mysql.connector.errors.DatabaseError as err:
            # Connection error - try to reconnect and retry once
            logger.warning(f"Database error during execute: {err.msg}. Attempting reconnection...")
            self._reconnect()
            
            # Retry once after reconnection
            try:
                if values:
                    self.cursor.execute(query, values)
                else:
                    self.cursor.execute(query)
                self._last_activity = datetime.now()
                return self.cursor
            except Exception as retry_err:
                logger.error(f"Query execution failed after reconnection: {retry_err}")
                raise
        
        except Exception as err:
            logger.error(f"Unexpected error during query execute: {err}")
            raise
    
    def fetchone(self):
        """Fetch one result from the last executed query."""
        return self.cursor.fetchone()
    
    def fetchall(self):
        """Fetch all results from the last executed query."""
        return self.cursor.fetchall()
    
    def commit(self):
        """Commit the current transaction."""
        try:
            self._ensure_connected()
            self.connection.commit()
        except Exception as err:
            logger.error(f"Commit failed: {err}")
            raise
    
    def rollback(self):
        """Rollback the current transaction."""
        try:
            if self.connection:
                self.connection.rollback()
        except Exception as err:
            logger.error(f"Rollback failed: {err}")
    
    def close(self):
        """Close the database connection."""
        try:
            if self.cursor:
                self.cursor.close()
            if self.connection:
                self.connection.close()
            logger.info("Database connection closed")
        except Exception as err:
            logger.error(f"Error closing connection: {err}")
    
    def __del__(self):
        """Cleanup on object destruction."""
        try:
            self.close()
        except:
            pass
    
    # Convenience methods used by existing code
    
    def employee_exists(self, employee_id):
        """Check if an employee exists in the database."""
        try:
            query = "SELECT id FROM employees WHERE id = %s LIMIT 1"
            self.execute(query, (employee_id,))
            result = self.fetchone()
            return result is not None
        except Exception as err:
            logger.error(f"Error checking employee existence: {err}")
            return False
    
    def get_employee(self, employee_id):
        """
        Get employee information by ID.
        
        Returns:
            Tuple of employee data (id, name, position, office, registered, am_in, am_out, pm_in, pm_out, noter, signatory, regular)
        """
        query = """
        SELECT id, name, position, office, registered, am_in, am_out, pm_in, pm_out, noter, signatory, regular 
        FROM employees 
        WHERE id = %s
        """
        self.execute(query, (employee_id,))
        return self.fetchone()
    
    def get_dtr_by_month(self, employee_id, month, year, cut='full'):
        """
        Get DTR records for an employee in a specific month.
        
        Args:
            employee_id: Employee ID
            month: Month number (1-12)
            year: Year
            cut: 'full' for whole month, 'first' for first half, 'last' for second half
            
        Returns:
            List of DTR records
        """
        if cut == 'full':
            query = """
            SELECT date, am_in, am_out, pm_in, pm_out 
            FROM dtrs 
            WHERE employee_id = %s AND YEAR(date) = %s AND MONTH(date) = %s
            ORDER BY date
            """
            self.execute(query, (employee_id, year, month))
        elif cut == 'first':
            query = """
            SELECT date, am_in, am_out, pm_in, pm_out 
            FROM dtrs 
            WHERE employee_id = %s AND YEAR(date) = %s AND MONTH(date) = %s AND DAY(date) < 16
            ORDER BY date
            """
            self.execute(query, (employee_id, year, month))
        elif cut == 'last':
            query = """
            SELECT date, am_in, am_out, pm_in, pm_out 
            FROM dtrs 
            WHERE employee_id = %s AND YEAR(date) = %s AND MONTH(date) = %s AND DAY(date) >= 16
            ORDER BY date
            """
            self.execute(query, (employee_id, year, month))
        else:
            raise ValueError(f"Invalid cut value: {cut}. Must be 'full', 'first', or 'last'")
        
        return self.fetchall()
