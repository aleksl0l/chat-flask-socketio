var socket = io(location.protocol + '//' + document.domain + ':' + location.port + '/chat');
socket.open();

// class Chat extends React.Component {
//
// }

class Contacts extends React.Component {
    constructor(props, context) {
        super(props, context);
        this.state = {
            users: [],
            messages: {}
        };
        this.handleSubmit = this.handleSubmit.bind(this);
        Contacts.handleFocus = Contacts.handleFocus.bind(this);
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

    static handleFocus(event) {
        console.log(event);
        console.log(event.target.innerText);
        MessagesList.setCurrentUser(event.target.innerText);
        return false;
    }

    render() {
        return <div id="sidepanel">
        <div id="contacts">
                <ul>
                    {this.state.users.map(function (el) {
                        return <li className="contact" key={el} onClick={Contacts.handleFocus}>
                                <div className="wrap">
                                    <span className="contact-status online" />
                                    <img src="https://pp.userapi.com/c847021/v847021314/3ee09/zDgSsmKhxbo.jpg" alt />
                                    <div className="meta">
                                        <p className="name">{el}</p>
                                    </div>
                                </div>
                        </li>;
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
            return <li className="replies">
                {this.props.text}
            </li>;
        }
        else
        {
            return <li className="sent">
                {this.props.text}
            </li>;
        }
    }
}

class MessagesList extends  React.Component {
    constructor(props, context) {
        super(props, context);
        this.state = {
            text: "",
            current_user: "",
            messages: {'123': [{to_me: true, text: 'First Message'}, {to_me:false, text:'Second'}], "": []}
        };
        MessagesList.setCurrentUser = MessagesList.setCurrentUser.bind(this);
        this.handleKeyPress = this.handleKeyPress.bind(this);
    }

    componentDidMount() {

        socket.on(
            'message',
            data => {
                this.handleMessage(data);
            }
        );
    }

    handleMessage(data) {
        let messagesl = this.state.messages;
        if (data.data.from in messagesl) {
            messagesl[data.data.from].push({'to_me': true, 'text': data.data.message});
        }
        else {
            messagesl[data.data.from] = [{'to_me': true, 'text': data.data.message}];
        }
        this.setState({messages: messagesl});
    }

    static setCurrentUser(user) {
        console.log("setCurrentUser");
        this.setState({current_user: user});
        if (!(user in this.state.messages))
        {
            let messagesl = this.state.messages;
            messagesl[user] = [];
            this.setState({messages: messagesl});
        }
    }

    handleKeyPress(event) {
        if (event.key === 'Enter' && this.state.current_user !== "") {
            socket.emit('message', {'to': this.state.current_user, 'message': event.target.value});

            let messagesl = this.state.messages;
            messagesl[this.state.current_user].push({to_me: false, text: event.target.value});
            this.setState({messages: messagesl});

            this.refs.messageinput.value = "";
            console.log(event.target.value);
        }
    }

    render() {
        return <div className="content">
            <div className="contact-profile">
                <img src="https://pp.userapi.com/c637927/v637927052/2894f/6zuAtDAetX4.jpg" alt="" />
                <p>Chat with {this.state.current_user}</p>
            </div>
            <div className="messages">
                <ul>
                    {
                            this.state.messages[this.state.current_user].map(function (el) {
                            return <Message to_me={el.to_me} text={el.text}/>;
                            })
                    }
                </ul>
            </div>
            <div className="message-input">
                <div className="wrap">
                                    <input className="search-field" type="text" placeholder="Write a message" ref='messageinput'
                       onKeyPress={this.handleKeyPress}/>
                        <button className="submit"><i className="fa fa-paper-plane" aria-hidden="true"/></button>
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
    <div>
        <Auth />
        <Contacts />
        <MessagesList id="contacts" />
    </div>,
    document.getElementById('frame')
);