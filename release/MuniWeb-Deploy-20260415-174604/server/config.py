#!/usr/bin/env python3
"""
Shared database configuration for all Python scripts
Reads from config.json file that can be updated via the settings UI
"""

import json
import os


def _default_config():
    return {
        'database': {
            'host': os.getenv('MYSQL_HOST', 'localhost'),
            'user': os.getenv('MYSQL_USER', 'root'),
            'password': os.getenv('MYSQL_PASSWORD', ''),
            'database': os.getenv('MYSQL_DATABASE', 'bless_dtr_test'),
            'port': int(os.getenv('MYSQL_PORT', '3306'))
        },
        'export': {
            'path': os.getenv('EXPORT_PATH', 'exports')
        }
    }


def _merge_with_env(config):
    merged = config.copy() if isinstance(config, dict) else {}
    db = merged.get('database', {})
    export = merged.get('export', {})

    merged['database'] = {
        'host': os.getenv('MYSQL_HOST', db.get('host', 'localhost')),
        'user': os.getenv('MYSQL_USER', db.get('user', 'root')),
        'password': os.getenv('MYSQL_PASSWORD', db.get('password', '')),
        'database': os.getenv('MYSQL_DATABASE', db.get('database', 'bless_dtr_test')),
        'port': int(os.getenv('MYSQL_PORT', str(db.get('port', 3306))))
    }
    merged['export'] = {
        'path': os.getenv('EXPORT_PATH', export.get('path', 'exports'))
    }
    return merged

def get_config_path():
    """Get the path to config.json"""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(script_dir, 'config.json')

def load_config():
    """Load configuration from config.json"""
    config_path = get_config_path()
    default_config = _default_config()
    
    try:
        if os.path.exists(config_path):
            with open(config_path, 'r') as f:
                config = json.load(f)
                return _merge_with_env(config)
        else:
            # Create default config file if it doesn't exist
            save_config(default_config)
            return default_config
    except Exception as e:
        print(f"Error loading config: {e}")
        return default_config

def save_config(config):
    """Save configuration to config.json"""
    config_path = get_config_path()
    try:
        with open(config_path, 'w') as f:
            json.dump(config, f, indent=2)
        return True
    except Exception as e:
        print(f"Error saving config: {e}")
        return False

def get_db_config():
    """Get database configuration"""
    config = load_config()
    return config.get('database', {})

def get_export_path():
    """Get export path configuration"""
    config = load_config()
    return config.get('export', {}).get('path', 'exports')

def ensure_export_directories():
    """Ensure all required export directories exist"""
    export_path = get_export_path()
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Convert to absolute path if relative
    if not os.path.isabs(export_path):
        export_path = os.path.join(script_dir, export_path)
    
    # Create main export directory
    os.makedirs(export_path, exist_ok=True)
    
    # Create previews subdirectory
    previews_dir = os.path.join(export_path, 'previews')
    os.makedirs(previews_dir, exist_ok=True)
    
    return export_path