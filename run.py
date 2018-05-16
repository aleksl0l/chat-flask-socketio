from app.app import app
import sys


if __name__ == '__main__':
    if len(sys.argv) == 2:
        host = sys.argv[1]
    else:
        host = '127.0.0.1'
    app.run(host=host, port=5001)
