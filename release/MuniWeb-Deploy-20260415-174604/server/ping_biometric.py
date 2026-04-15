import sys
import json
import socket

def ping_device(ip, port):
    try:
        # Create socket with short timeout
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(3)  # 3 second timeout
        
        # Try to connect to the port
        result = sock.connect_ex((ip, int(port)))
        sock.close()
        
        # If result is 0, port is open
        if result == 0:
            return {
                "online": True,
                "userCount": 0,
                "attendanceCount": 0,
                "firmware": "Port Open"
            }
        else:
            return {
                "online": False,
                "userCount": 0,
                "attendanceCount": 0,
                "firmware": None,
                "error": f"Port closed (error {result})"
            }
            
    except socket.timeout:
        return {
            "online": False,
            "userCount": 0,
            "attendanceCount": 0,
            "firmware": None,
            "error": "Connection timeout"
        }
    except Exception as e:
        return {
            "online": False,
            "userCount": 0,
            "attendanceCount": 0,
            "firmware": None,
            "error": str(e)
        }

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(json.dumps({
            "online": False,
            "userCount": 0,
            "attendanceCount": 0,
            "firmware": None,
            "error": "Invalid arguments. Usage: python ping_biometric.py <ip> <port>"
        }))
        sys.exit(1)
    
    ip = sys.argv[1]
    port = sys.argv[2]
    result = ping_device(ip, port)
    print(json.dumps(result))