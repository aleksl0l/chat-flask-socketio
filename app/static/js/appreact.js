var socket = io(location.protocol + '//' + document.domain + ':' + location.port + '/chat');
socket.open();

// class Chat extends React.Component {
//
// }
class Contact extends React.Component {
    constructor(props, context) {
        super(props, context);
        Contact.handleFocus = Contact.handleFocus.bind(this);
    }

    static handleFocus(event) {
        MessagesList.setCurrentUser(event.target.textContent);
        Contacts.setCurrentUser(event.target.textContent);
        return false;
    }

    render() {
        return <li className={this.props.isActive ? "contact active" : "contact"} onClick={Contact.handleFocus} >
            <div className="wrap">
                <span className="contact-status online"/>
                <img src="https://grand-vet.ru/wp-content/uploads/2017/11/default-avatar-250x250.png" alt/>
                <div className="meta">
                    <p login={this.props.login} className="name">{this.props.login}</p>
                </div>
            </div>
        </li>;
    }
}


class Contacts extends React.Component {
    constructor(props, context) {
        super(props, context);
        this.state = {
            users: [],
            current_user: " ",
            messages: {}
        };
        Contacts.setCurrentUser = Contacts.setCurrentUser.bind(this);
        Contacts.isActive = Contacts.isActive.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
    }

    componentDidMount() {

        socket.on(
            'users',
            data => {
                this.updateUsers(data);
            }
        );
        this.handleSubmit();
        setInterval(this.handleSubmit, 1000);
    }
    ////////////////////////////////UPDATE DATA
    updateUsers(data) {
        this.setState({users: data.data.users});
    }

    handleSubmit(event) {
        socket.emit('get_available_users');
        return false;
    }

    static setCurrentUser(user) {
        this.setState({current_user: user});
    }

    static isActive (login) {
        return this.state.current_user === login;
    }

    render() {
        return <div id="sidepanel">
            <div id="contacts">
                <ul>
                    {this.state.users.map(function (el) {
                        return <Contact key={el} login={el} isActive={Contacts.isActive(el)}/>;
                    })}
                </ul>
            </div>
        </div>;
    }
}


class Message extends React.Component {
    constructor(props, context) {
        super(props, context);
    }
    render() {
        if (this.props.to_me === true) {
            return <li className="sent">
                <p>{this.props.text}</p>
            </li>;
        }
        else
        {
            return <li className="replies">
                <p>{this.props.text}</p>
            </li>;
        }
    }
}


class MessagesList extends  React.Component {
    constructor(props, context) {
        super(props, context);
        this.state = {
            text: "",
            current_user: " ",
            messages: {" ": []}//{"123": [{id: 1, to_me: true, text: 'First Message'}, {id: 2, to_me:false, text:'Second'}], "def": []}
        };
        MessagesList.setCurrentUser = MessagesList.setCurrentUser.bind(this);
        this.handleKeyPress = this.handleKeyPress.bind(this);
        this.clickSendButton = this.clickSendButton.bind(this);
    }

    componentDidMount() {

        socket.on(
            'message',
            data => {
                this.handleMessage(data);
            }
        );

        socket.on(
            'get_history',
            data => {
                this.handleGetHistory(data);
            }
        );
    }

    handleGetHistory(data) {
        let messagesl = this.state.messages;
        console.log('histro', data.data.messages);
        messagesl[data.data.with_login].push(...data.data.messages);
        this.setState({messages: messagesl});
    }

    handleMessage(data) {
        console.log('There is a message!', data.data);
        let messagesl = this.state.messages;
        if ('from' in data.data) {
            if (data.data.from in messagesl) {
                messagesl[data.data.from].push({'to_me': true, 'text': data.data.message, 'id': data.data.id});
            }
            else {
                messagesl[data.data.from] = [{'to_me': true, 'text': data.data.message, 'id': data.data.id}];
            }
            this.setState({messages: messagesl});
        }
        else
        {
            console.log("test1", messagesl, data);
            messagesl[data.data.to].push({'to_me': false, 'text': data.data.message, 'id': data.data.id});
            this.setState({messages: messagesl});
        }
    }

    static setCurrentUser(user) {
        console.log(user, this.state.messages[user]);
        this.setState({current_user: user});
        if (!(user in this.state.messages)) {
            let messagesl = this.state.messages;
            messagesl[user] = [];
            console.log(messagesl);
            this.setState({messages: messagesl});
            socket.emit('get_history', {'with_login': user});
        }
    }

    handleKeyPress(event) {
        if (event.key === 'Enter' && this.state.current_user !== "") {
            this.sendMessage(this.state.current_user, event.target.value)
        }
    }

    clickSendButton(event) {
            this.sendMessage(this.state.current_user, this.refs.messageinput.value);
    }

    sendMessage(to, msg) {
        socket.emit('message', {'to': to, 'message': msg});
        this.refs.messageinput.value = "";
    }

    render() {
        return <div className="content">
            <div className="contact-profile">
                <img src="https://grand-vet.ru/wp-content/uploads/2017/11/default-avatar-250x250.png" alt="" />
                <p>Chat with {this.state.current_user}</p>
            </div>
            <div className="messages">
                <ul>
                    {
                        this.state.messages[this.state.current_user].map(function (el) {
                            return <Message key={el.id} to_me={el.to_me} text={el.text}/>;
                        })
                    }
                </ul>
            </div>
            <div className="message-input">
                <div className="wrap">
                    <input className="search-field" type="text" placeholder="Write a message" ref='messageinput'
                           onKeyPress={this.handleKeyPress}/>
                    <button className="submit"><i className="fa fa-paper-plane" aria-hidden="true" onClick={this.clickSendButton}/></button>
                </div>

            </div>
        </div>;
    }

}


class Auth extends React.Component {
    constructor(props, context) {
        super(props, context);
        this.state = {
            logged_user: "",
            login: "",
            password: "",
            message: ""
        };
        this.handleSignIn = this.handleSignIn.bind(this);
        this.handleSignUp = this.handleSignUp.bind(this);
        this.update_login = this.update_login.bind(this);
        this.update_password = this.update_password.bind(this);
    }

    componentDidMount() {
        socket.on(
            'signup_status',
            data => {
                this.handleSignUpStatus(data);
            }
        );
        socket.on(
            'login',
            data => {
                this.handleSignInStatus(data);
            }
        );
    }
    handleSignUpStatus(data) {
        console.log("sign up");
        if (data.status === "error") {
            this.setState({message: data.message});
        }
        else {
            this.setState({message: "You are successfully sign up"})
        }
    }
    handleSignInStatus(data) {
        if (data.status === "error") {
            console.log("sign in");
            this.setState({message: data.message});
        }
        else {
            this.setState({logged_user: this.state.login})
        }
    }

    handleSignIn(event) {
        socket.emit('login', {data: {'login': this.state.login, 'password': this.state.password}});
    }

    handleSignUp(event) {
        socket.emit('signup', {data: {'login': this.state.login, 'password': this.state.password}});
    }

    update_login(event) {
        this.setState({login: event.target.value});
    }

    update_password(event) {
        this.setState({password: event.target.value});
    }

    render() {
        if (this.state.logged_user === "") //not logged
        {
            return (
                <div>
                    <input type="text" placeholder="login" value={this.state.login} onChange={this.update_login}/>
                    <input type="password" placeholder="password" value={this.state.password} onChange={this.update_password}/>
                    <button onClick={this.handleSignIn}>
                        Sign in
                    </button>
                    <button onClick={this.handleSignUp}>
                        Sign up
                    </button>
                    <span>{this.state.message}</span>
                </div>
            );
        }
        else
        {
            return (<p>Welcome {this.state.logged_user}</p>);
        }
    }
}


ReactDOM.render(
    <div id="frame">
        <Auth />
        <Contacts />
        <MessagesList />
    </div>,
    document.getElementById('chat')
);