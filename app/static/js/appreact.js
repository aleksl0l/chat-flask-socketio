var socket = io('http://127.0.01:5000/chat');

class Contacts extends React.Component {
    constructor(props, context) {
        super(props, context);
        this.state = {
            text: "",
            current_user: "",
            users: [],
            messages: {}
        };
        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleKeyPress = this.handleKeyPress.bind(this);
        Contacts.handleFocus = Contacts.handleFocus.bind(this);
    }

    componentDidMount() {
        // socket = io('http://127.0.01:5000/chat');

        socket.on(
            'users',
            data => {
                this.updateUsers(data);
            }
        );

        socket.open();
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
        this.setState({current_user: event.target.innerText});
        return false;
    }

    handleKeyPress(event) {
        if (event.key === 'Enter' && this.state.current_user !== "") {
            socket.emit('message', {'to': this.state.current_user, 'message': event.target.value});
            this.setState({text: ""});
            console.log(event.target.value);
        }
    }

    render() {
        return (
            <div>
                <div className="leftcontacts">
                    <ul>
                        <span>Available users</span>
                        {this.state.users.map(function (el) {
                            return <li key={el}>
                                <a href="#" onClick={Contacts.handleFocus}> {el}</a>
                            </li>;
                        })}
                    </ul>
                </div>
                <div className="rightcontacts">
                    <div>
                        <span>Chat with {this.state.current_user}</span>
                        <input className="search-field" type="text" placeholder="Write a message" value={this.state.text} onKeyPress={this.handleKeyPress}/>
                    </div>
                </div>
            </div>
        );
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
    </div>,
    document.getElementById('chat')
);