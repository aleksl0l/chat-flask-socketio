import datetime
import uuid
from threading import Lock

from flask import Flask, render_template, session, request, jsonify
from flask_socketio import SocketIO, send, emit, join_room, rooms, leave_room, close_room, disconnect
from werkzeug.security import generate_password_hash, check_password_hash
from flask_pymongo import PyMongo
import jwt

async_mode = None

app = Flask(__name__, static_url_path='')

app.config['MONGO_DBNAME'] = 'chat'
mongo = PyMongo(app)

app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, async_mode=async_mode)
thread = None
thread_lock = Lock()

# @app.route('/')
# def index():
#     return render_template('index.html', async_mode=socketio.async_mode)
#
# @socketio.on('message')
# def handle_message(msg):
#     print('Message: ' + msg)
#     send(msg, broadcast=True)


# def background_thread():
#     """Example of how to send server generated events to clients."""
#     count = 0
#     while True:
#         socketio.sleep(10)
#         count += 1
#         socketio.emit('my_response',
#                       {'data': 'Server generated event', 'count': count},
#                       namespace='/test')


@app.route('/')
def index():
    return app.send_static_file('index_chat.html')


@app.route('/chat')
def chat():
    return app.send_static_file('chat.html')


@app.route('/api/signup', methods=['GET', 'POST'])
def signup():
    data = request.args.to_dict(flat=True)
    hashed_password = generate_password_hash(data['password'], method='sha256')
    try:
        mongo.db.users.insert({'public_id': str(uuid.uuid4()),
                               'login': data['login'],
                               'password': hashed_password,
                               'online': False,
                               'date': datetime.datetime.utcnow()})
        return jsonify({'message': None, 'data': None, 'status': 'success'})
    except Exception as e:
        return jsonify({'message': 'Unexpected error', 'data': None, 'status': 'error'})


@socketio.on('login', namespace='/test')
def test_connect(data):
    data = data['data']
    user = mongo.db.users.find_one({'login': data['login']})
    print(user)

    if not user:
        emit('login', {'message': 'Password or user is invalid', 'data': None, 'status': 'error'})
        return

    if check_password_hash(user['password'], data['password']):
        token = jwt.encode({'public_id': user['public_id'],
                            'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=10)},
                           app.config.get('SECRET_KEY'))
        session['login'] = user['login']
        join_room(user['login'])
        mongo.db.users.update_one({'login': user['login']}, {'$set': {'online': True}})
        emit('login', {'message': None, 'data': {'token': token.decode('UTF-8')}, 'status': 'success'})


@socketio.on('disconnect', namespace='/test')
def test_disconnect():
    print('Client disconnected', request.sid, session['login'])
    mongo.db.users.update_one({'login': session['login']}, {'$set': {'online': False}})


@socketio.on('get_available_users', namespace='/test')
def get_available_users():
    users = mongo.db.users.find({'online': True})
    users_list = []
    for user in users:
        users_list.append(user['login'])
    emit('users', {'message': None, 'data': {'users': users_list, 'status': 'success'}})


@socketio.on('message', namespace='/test')
def test_message(message):
    emit('message', {'message': message['message'], 'from': session['login']}, room=message['to'])


@socketio.on('my_broadcast_event', namespace='/test')
def test_broadcast_message(message):
    session['receive_count'] = session.get('receive_count', 0) + 1
    emit('my_response',
         {'data': message['data'], 'count': session['receive_count']},
         broadcast=True)


@socketio.on('join', namespace='/test')
def join(message):
    join_room(message['room'])
    session['receive_count'] = session.get('receive_count', 0) + 1
    emit('my_response',
         {'data': 'In rooms: ' + ', '.join(rooms()),
          'count': session['receive_count']})


@socketio.on('leave', namespace='/test')
def leave(message):
    leave_room(message['room'])
    session['receive_count'] = session.get('receive_count', 0) + 1
    emit('my_response',
         {'data': 'In rooms: ' + ', '.join(rooms()),
          'count': session['receive_count']})


@socketio.on('close_room', namespace='/test')
def close(message):
    session['receive_count'] = session.get('receive_count', 0) + 1
    emit('my_response', {'data': 'Room ' + message['room'] + ' is closing.',
                         'count': session['receive_count']},
         room=message['room'])
    close_room(message['room'])


@socketio.on('my_room_event', namespace='/test')
def send_room_message(message):
    session['receive_count'] = session.get('receive_count', 0) + 1
    emit('my_response',
         {'data': message['data'], 'count': session['receive_count']},
         room=message['room'])


@socketio.on('disconnect_request', namespace='/test')
def disconnect_request():
    session['receive_count'] = session.get('receive_count', 0) + 1
    emit('my_response',
         {'data': 'Disconnected!', 'count': session['receive_count']})
    disconnect()


@socketio.on('my_ping', namespace='/test')
def ping_pong():
    emit('my_pong')





if __name__ == '__main__':
    socketio.run(app, debug=True)