var socket = io(location.protocol + '//' + document.domain + ':' + location.port + '/chat');
socket.open();


class Contact extends React.Component {
    constructor(props, context) {
        super(props, context);
        Contact.handleFocus = Contact.handleFocus.bind(this);
    }

    static handleFocus(event) {
        if (Auth.getLogin() === "") {
            return;
        }
        let login = null;
        if (event.target.localName === 'p') {
            login = event.target.textContent;
        }
        else if (event.target.localName === 'img') {
            login = event.target.parentElement.getElementsByClassName('name')['0'].innerText;
        }
        else {
            login = event.target.getElementsByClassName('name')['0'].textContent;
        }

        let user = login === "Saved messages" ? Auth.getLogin() : login;
        user = user.split(" ")[0];
        MessagesList.setCurrentUser(user);
        Contacts.setCurrentUser(user);
        return false;
    }

    render() {
        return <li className={this.props.isActive ? "contact active" : "contact"} onClick={Contact.handleFocus} >
            <div className="wrap">
                <span className="contact-status online"/>
                <img src={this.props.img} alt/>
                <div className="meta">
                    <p
                        login={this.props.login}
                        className="name">
                        {(this.props.isYou ? "Saved messages" : this.props.login)}
                    </p>
                    {this.props.numUnreadMsg ? <div id="not-read">{this.props.numUnreadMsg}</div> : null}
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
            numMsg: {}
        };
        Contacts.setCurrentUser = Contacts.setCurrentUser.bind(this);
        Contacts.isActive = Contacts.isActive.bind(this);
        Contacts.incrNumMsg = Contacts.incrNumMsg.bind(this);
        Contacts.getNumMsg = Contacts.getNumMsg.bind(this);

        Contacts.getImgLogin = Contacts.getImgLogin.bind(this);
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
        if (Auth.isLogIn()) {
            var my_acc = data.data.users.find(function (user) {
                return user.login === Auth.getLogin();
            });
            Auth.setUrlImg(my_acc.url_img);
        }
        this.setState({users: data.data.users});
    }

    handleSubmit(event) {
        socket.emit('get_available_users');
        return false;
    }

    static incrNumMsg(user) {
        if (user === this.state.current_user) {
            return;
        }
        let _numMsg = this.state.numMsg;
        if (_numMsg[user]) {
            _numMsg[user]++;
        }
        else {
            _numMsg[user] = 1;
        }
        this.setState({numMsg: _numMsg});
    }

    static getNumMsg(user) {
        if (this.state.numMsg[user]) {
            return this.state.numMsg[user];
        }
        else {
            return 0;
        }
    }

    static getImgLogin(login) {
        var user = data.data.users.find(function (user) {
            return user.login === login;
        });
        return user.url_img;
    }

    static setCurrentUser(user) {
        let _numMsg = this.state.numMsg;
        _numMsg[user] = 0;
        this.setState({current_user: user, numMsg: _numMsg});
    }

    static isActive(login) {
        return this.state.current_user === login;
    }

    render() {
        if (Auth.isLogIn()) {
            return <div id="sidepanel">
                <div id="profile">
                    <div className="wrap">
                        <img id="profile-img"
                             src={Auth.getUrlImg()}
                             className="online"
                             alt=""/>
                        <p>{Auth.getLogin()}</p>
                    </div>
                </div>
                <div id="contacts">
                    <ul>
                        {this.state.users.map(function (el) {
                            return <Contact key={el.login}
                                            login={el.login}
                                            img={el.url_img}
                                            numUnreadMsg={Contacts.getNumMsg(el.login)}
                                            isYou={el.login === Auth.getLogin()}
                                            isActive={Contacts.isActive(el.login)}/>;
                        })}
                    </ul>
                </div>
            </div>;
        }
        else {
            return null;
        }
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
            current_user_img: " ",
            messages: {" ": []}
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
        if (Auth.getLogin() === "") {
            return;
        }
        let messagesl = this.state.messages;
        messagesl[data.data.with_login].push(...data.data.messages);
        this.setState({messages: messagesl});
    }

    handleMessage(data) {
        let messagesl = this.state.messages;
        if ('from' in data.data) {
            if (data.data.from in messagesl) {
                messagesl[data.data.from].push({'to_me': true, 'text': data.data.message, 'id': data.data.id});
            }
            else {
                messagesl[data.data.from] = [{'to_me': true, 'text': data.data.message, 'id': data.data.id}];
            }
            this.setState({messages: messagesl});
            Contacts.incrNumMsg(data.data.from);
        }
        else
        {
            messagesl[data.data.to].push({'to_me': false, 'text': data.data.message, 'id': data.data.id});
            this.setState({messages: messagesl});
        }
    }

    static setCurrentUser(user) {
        this.setState({current_user: user});
        if (!(user in this.state.messages)) {
            let messagesl = this.state.messages;
            messagesl[user] = [];
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

    componentDidUpdate() {
        this.messagesEnd.scrollIntoView({ behavior: "instant" })
    }

    render() {
        return <div className="content">
            <div className="contact-profile">
                <img src={Auth.getUrlImg()} alt="" />
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
                <div style={{ float:"left", clear: "both" }} ref={(el) => { this.messagesEnd = el; }}>
                </div>
            </div>
            <div className="message-input">
                <div className="wrap">
                    <input className="search-field" type="text" placeholder="Write a message" ref='messageinput'
                           onKeyPress={this.handleKeyPress}/>
                    <button className="submit" onClick={this.clickSendButton}><i className="fa fa-paper-plane" aria-hidden="true"/></button>
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
            url_img: null,
            login: "",
            password: "",
            message: ""
        };
        this.handleSignIn = this.handleSignIn.bind(this);
        this.handleSignUp = this.handleSignUp.bind(this);
        this.update_login = this.update_login.bind(this);
        this.update_password = this.update_password.bind(this);
        Auth.addFile = Auth.addFile.bind(this);
        Auth.getLogin = Auth.getLogin.bind(this);
        Auth.isLogIn = Auth.isLogIn.bind(this);
        Auth.getUrlImg = Auth.getUrlImg.bind(this);
        Auth.setUrlImg = Auth.setUrlImg.bind(this);

        this.onFormSubmit = this.onFormSubmit.bind(this);
        this.onChange = this.onChange.bind(this);
        this.fileUpload = this.fileUpload.bind(this);
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

    static getLogin() {
        return this.state.logged_user;
    }

    static isLogIn() {
        console.log(this.state.logged_user !== "");
        return this.state.logged_user !== "";

    }

    static getUrlImg() {
        return this.state.url_img;
    }

    static setUrlImg(url) {
        this.setState({url_img: url});
    }

    handleSignUpStatus(data) {
        if (data.status === "error") {
            this.setState({message: data.message});
        }
        else {
            this.setState({message: "You are successfully sign up"})
        }
    }
    handleSignInStatus(data) {
        if (data.status === "error") {
            this.setState({message: data.message});
        }
        else {
            this.setState({logged_user: this.state.login, url_img: data.data.url_img});
            Chat.rerender();
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

    static addFile(event) {
        var formData = new FormData();
        formData.append("file", event.target.files[0]);

        var tmp = event;
        fetch('/image', {
            method: 'POST',
            headers: {'Content-Type':'multipart/form-data'},
            body: formData }).then(
        (response) => {
        }
    ).catch( () => {} );
    }


     onFormSubmit(e){
        e.preventDefault() ;// Stop form submit
        this.fileUpload(this.state.file).then((response)=>{
    })
  }
  onChange(e) {
    this.setState({file:e.target.files[0]})
  }

  fileUpload(file){
    const url = location.protocol + '//' + document.domain + ':' + location.port + '/image?login=' + Auth.getLogin();
    const formData = new FormData();
    formData.append('file', file);
    const config = {
        headers: {
            'content-type': 'multipart/form-data'
        }
    };
    return axios.post(url, formData,config)
  }

render() {
    if (!Auth.isLogIn()) //not logged
    {
        return (
            <div id="login-box">
                <input className="input-login" type="text" placeholder="login" value={this.state.login} onChange={this.update_login}/>
                <input className="input-login" type="password" placeholder="password" value={this.state.password} onChange={this.update_password}/>
                <a className="btn" onClick={this.handleSignIn}>
                    Sign in
                </a>
                <a className="btn btn-blue" onClick={this.handleSignUp}>
                    Sign up
                </a>
                <span>{this.state.message}</span>
            </div>
        );
    }
    else
    {
        return (
            <div>
                  <form onSubmit={this.onFormSubmit}>
                    <h1>Upload avatar</h1>
                    <input type="file" onChange={this.onChange} />
                    <button type="submit">Upload</button>
                  </form>
            </div>);

    }
}
}


class Chat extends React.Component {
        constructor(props, context) {
        super(props, context);
        Chat.rerender = Chat.rerender.bind(this);
    }

    static rerender() {
            this.forceUpdate();
    }

    render() {
        if (Auth.isLogIn())
        {
            return <div id="frame">
                <Contacts />
                <MessagesList />
            </div>
        }
        else
        {
            console.log("not login");
            return null;
        }
    }

}

ReactDOM.render(
    <div id="log">
        <Auth />
        <Chat/>
    </div>,
    document.getElementById('chat')
);