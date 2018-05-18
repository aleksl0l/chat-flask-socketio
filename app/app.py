import datetime
import re
import uuid
from threading import Lock

from flask import Flask, session, request, jsonify
from flask_socketio import SocketIO, emit, join_room, disconnect
from werkzeug.security import generate_password_hash, check_password_hash
from flask_pymongo import PyMongo
import jwt

async_mode = None

app = Flask(__name__, static_url_path='')
app.config.from_pyfile('config.py')
mongo = PyMongo(app)
socketio = SocketIO(app, async_mode=async_mode)
thread = None
thread_lock = Lock()


@app.before_first_request
def activate_job():
    print("Hey")
    mongo.db.users.update_many({}, {'$set': {'online': False}})


@app.route('/')
def index():
    return app.send_static_file('index.html')


@app.route('/api/signup', methods=['GET', 'POST'])
def signup():
    data = request.args.to_dict(flat=True)
    hashed_password = generate_password_hash(data['password'], method='sha256')
    try:
        user = mongo.db.users.find_one({'login': data['login']})
        if user:
            return jsonify({'message': 'This login is already exist', 'data': None, 'status': 'error'})
        mongo.db.users.insert({'public_id': str(uuid.uuid4()),
                               'login': data['login'],
                               'password': hashed_password,
                               'online': False,
                               'date': datetime.datetime.utcnow()})
        return jsonify({'message': None, 'data': None, 'status': 'success'})
    except Exception as e:
        print(e)
        return jsonify({'message': 'Unexpected error', 'data': None, 'status': 'error'})


@socketio.on('signup', namespace='/chat')
def chat_signup(data):
    data = data['data']
    print(data['login'])
    if not bool(re.match(r'^[a-zA-Z0-9_]{5,}$', data['login'])):
        emit('signup_status',
             {'message': 'You must use only letters, digits and \'_\'', 'data': None, 'status': 'error'}
             )
        return
    hashed_password = generate_password_hash(data['password'], method='sha256')
    try:
        user = mongo.db.users.find_one({'login': data['login']})
        if user:
            emit('signup_status', {'message': 'This login is already exist', 'data': None, 'status': 'error'})
        mongo.db.users.insert({'public_id': str(uuid.uuid4()),
                               'login': data['login'],
                               'password': hashed_password,
                               'online': False,
                               'date': datetime.datetime.utcnow()})
        emit('signup_status', {'message': None, 'data': None, 'status': 'success'})
    except Exception as e:
        emit('signup_status', {'message': 'Unexpected error', 'data': None, 'status': 'error'})


@socketio.on('login', namespace='/chat')
def chat_connect(data):
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
        print(user['login'])
        join_room(user['login'])
        mongo.db.users.update_one({'login': user['login']}, {'$set': {'online': True}})
        emit('login', {'message': None, 'data': {'token': token.decode('UTF-8')}, 'status': 'success'})
    else:
        emit('login', {'message': 'Password or user is invalid', 'data': None, 'status': 'error'})


@socketio.on('disconnect', namespace='/chat')
def chat_disconnect():
    if 'login' in session:
        print('Client disconnected', session['login'])
        mongo.db.users.update_one({'login': session['login']}, {'$set': {'online': False}})


@socketio.on('get_available_users', namespace='/chat')
def get_available_users():
    users = mongo.db.users.find({'online': True})
    if 'login' in session:
        mongo.db.users.update_one({'login': session['login']}, {'$set': {'online': True}})
    users_list = []
    for user in users:
        users_list.append(user['login'])
    emit('users', {'message': None, 'data': {'users': users_list, 'status': 'success'}})


@socketio.on('message', namespace='/chat')
def chat_message(message):
    print(message)
    if 'login' in session:
        mongo.db.users.update_one({'login': session['login']}, {'$set': {'online': True}})
    emit('message',
         {
             'message': None,
             'data':
                 {
                     'message': message['message'].encode('latin-1').decode('utf-8'),
                     'from': session['login'],
                     'id': str(uuid.uuid4())
                 },
             'status': 'success'
         }, room=message['to'])
    emit('message',
         {
             'message': None,
             'data':
                 {
                     'message': message['message'].encode('latin-1').decode('utf-8'),
                     'to': message['to'],
                     'id': str(uuid.uuid4())
                 },
             'status': 'success'
         })


@socketio.on('disconnect_request', namespace='/chat')
def disconnect_request():
    emit('my_response', {'data': 'Disconnected!'})
    disconnect()


@socketio.on('my_ping', namespace='/chat')
def ping_pong():
    emit('my_pong')


if __name__ == '__main__':
    with app.app_context():
        mongo.db.users.update_many({}, {'$set': {'online': False}})
    socketio.run(app, debug=True)
