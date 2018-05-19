import datetime
import os
import re
import uuid
from flask import Flask, session, request, jsonify, flash, redirect, url_for
from flask_socketio import SocketIO, emit, join_room
from werkzeug.security import generate_password_hash, check_password_hash
from flask_pymongo import PyMongo
import jwt
from werkzeug.utils import secure_filename

async_mode = None

app = Flask(__name__, static_url_path='')
app.config.from_pyfile('config.py')
mongo = PyMongo(app)
socketio = SocketIO(app, async_mode=async_mode)


@app.route('/')
def index():
    return app.send_static_file('index.html')


@app.route('/image', methods=['POST'])
def upload_file():
    if request.method == 'POST':
        # check if the post request has the file part
        if 'file' not in request.files:
            return jsonify({'message': 'No file found', 'data': None, 'status': 'error'})
        file = request.files['file']
        if file.filename == '':
            return jsonify({'message': 'No file found', 'data': None, 'status': 'error'})
        filename = file.filename
        filename = str(uuid.uuid4()) + filename[filename.rfind('.'):]

        file.save(os.path.join(app.root_path, 'static', 'images', filename))

        file_url = os.path.join(request.url_root, 'images', filename)
        mongo.db.users.update_one({'login': request.args['login']}, {'$set': {'url_img': file_url}})
        return jsonify({'message': None, 'data': None, 'status': 'success'})


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
    print(data['login'], len(data['login']))
    if len(data['login']) < 5:
        emit('signup_status', {'message': 'Minimum length of login is 5', 'data': None, 'status': 'error'})
        return
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
        url_img = user['url_img'] if user['url_img'] else os.path.join(request.url_root, 'images', 'def.jpeg')
        emit('login', {'message': None,
                       'data': {
                           'token': token.decode('UTF-8'),
                           'url_img': url_img
                       },
                       'status': 'success'})
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
    for u in users:
        users_list.append({'login': u['login'], 'url_img': u['url_img']})
    emit('users', {'message': None, 'data': {'users': users_list}, 'status': 'success'})


@socketio.on('get_history', namespace='/chat')
def get_history(data):
    if 'login' in session and 'with_login' in data:
        login = session['login']
        with_login = data['with_login']

        if login != with_login:
            conversation = mongo.db.convertations.find_one({'members': {'$all': [login, with_login]}})
        else:
            conversation = mongo.db.convertations.find_one({'members': [login, with_login]})
        if not conversation:
            emit('login', {'message': 'There is no message', 'data': None, 'status': 'error'})
        messages = mongo.db.messages.find({'id_conv': conversation['_id']})
        ret = []
        for m in messages:
            ret.append({'text': m['text'], 'to_me': (m['to'] == login), 'id': str(uuid.uuid4())})
        emit('get_history', {
                             'message': None,
                             'data': {
                                 'messages': ret,
                                 'with_login': with_login},
                             'status': 'success'
                             }
             )


@socketio.on('message', namespace='/chat')
def chat_message(message):
    print(message)
    if 'login_to' == " ":
        return
    if 'login' in session:
        login = session['login']
        login_to = message['to']
        mongo.db.users.update_one({'login': login}, {'$set': {'online': True}})
        # if there is conversation between

        if login != login_to:
            conversation = mongo.db.convertations.find_one({'members': {'$all': [login, login_to]}})
        else:
            conversation = mongo.db.convertations.find_one({'members': [login, login_to]})
        if not conversation:
            insert = mongo.db.convertations.insert_one({'members': [login, login_to]})
            conversation = mongo.db.convertations.find_one(insert.inserted_id)
        mongo.db.messages.insert_one({'id_conv': conversation['_id'], 'text': message['message'].encode('latin-1').decode('utf-8'), 'to': login_to})
    else:
        return
    if login != login_to:
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


if __name__ == '__main__':
    with app.app_context():
        conv = mongo.db.convertations.find_one({'members': ['alexl0l', 'alexl0l']})
        mess = mongo.db.messages.find({'id_conv': conv['_id']})
        for m in mess:
            print(m['text'])
        mongo.db.users.update_many({}, {'$set': {'online': False}})
    socketio.run(app, debug=True)
