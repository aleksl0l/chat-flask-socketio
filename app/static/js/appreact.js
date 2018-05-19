var socket = io(location.protocol + '//' + document.domain + ':' + location.port + '/chat');
socket.open();

// var prettyMessage = function (msg) {
//     let arr = msg.split(' ');
//
//     let i;
//     for (i = 0; i < arr.length; i++) {
//         if (arr[i].length > 40) {
//             let j = 40;
//             while (j < arr[i].length) {
//                 arr[i] = arr[i].slice(0, j) + '' + arr[i].slice(j, arr[i].length);
//                 j += 40 + 1;
//             }
//         }
//     }
//     return arr.join(' ');
// };

class Contact extends React.Component {
    constructor(props, context) {
        super(props, context);
        Contact.handleFocus = Contact.handleFocus.bind(this);
    }

    static handleFocus(event) {
        if (Auth.getLogin() === "") {
            return;
        }
        let user = event.target.textContent === "Saved messages" ? Auth.getLogin() : event.target.textContent;
        user = user.split(" ")[0];
        MessagesList.setCurrentUser(user);
        Contacts.setCurrentUser(user);
        return false;
    }

    render() {
        // console.log(this.props.login, this.props.isActive);
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
                    <span>{" "+ (this.props.numUnreadMsg ? this.props.numUnreadMsg : "")}</span>
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
        console.log(data.data.users);
        this.setState({users: data.data.users});
        // console.log('update', data.data.users)
    }

    handleSubmit(event) {
        socket.emit('get_available_users');
        return false;
    }

    static incrNumMsg(user) {
        let _numMsg = this.state.numMsg;
        if (_numMsg[user]) {
            _numMsg[user]++;
        }
        else {
            _numMsg[user] = 1;
        }
        this.setState({numMsg: _numMsg});
        console.log(this.state.numMsg);
    }

    static getNumMsg(user) {
        if (this.state.numMsg[user]) {
            return this.state.numMsg[user];
        }
        else {
            return 0;
        }
    }

    static setCurrentUser(user) {
        // console.log("Activete in Contacts", user);
        this.setState({current_user: user});
    }

    static isActive (login) {
        // console.log(login);
        // console.log(this.state.current_user);
        return this.state.current_user === login;
    }

    render() {
        return <div id="sidepanel">
            <div id="profile">
                <div className="wrap">
                    <img id="profile-img"
                         src={Auth.getUrlImg()}
                         className="online"
                         alt="" />
                        <p>{Auth.getLogin()}</p>
                </div>
            </div>
            <div id="contacts">
                <ul>
                    {this.state.users.map(function (el) {
                        // console.log(el.url_img);
                        return <Contact key={el.login}
                                        login={el.login}
                                        img={el.url_img}
                                        numUnreadMsg={Contacts.getNumMsg(el.login)}
                                        isYou={el.login===Auth.getLogin()}
                                        isActive={Contacts.isActive(el.login)}/>;
                    })}
                </ul>
            </div>
        </div>;
    }
}


class Message extends React.Component {
    constructor(props, context) {
        super(props, context);
        // console.log(props);
        // this.state = {
        //     text: prettyMessage(props.text)
        // }
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
        console.log('History');
        let messagesl = this.state.messages;
        messagesl[data.data.with_login].push(...data.data.messages);
        this.setState({messages: messagesl});
    }

    handleMessage(data) {
        // console.log('There is a message!', data.data);
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
        // console.log(user, this.state.messages[user]);
        this.setState({current_user: user});
        if (!(user in this.state.messages)) {
            let messagesl = this.state.messages;
            messagesl[user] = [];
            // console.log(messagesl);
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
        this.messagesEnd.scrollIntoView({ behavior: "smooth" })
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
        Auth.getUrlImg = Auth.getUrlImg.bind(this);

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
    static getUrlImg() {
        return this.state.url_img;
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
            this.setState({logged_user: this.state.login, url_img: data.data.url_img})
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
            console.log(response);
        }
    ).catch( () => {} );
    }


     onFormSubmit(e){
        e.preventDefault() ;// Stop form submit
        this.fileUpload(this.state.file).then((response)=>{
        console.log(response.data);
    })
  }
  onChange(e) {
    this.setState({file:e.target.files[0]})
  }

  fileUpload(file){
    const url = location.protocol + '//' + document.domain + ':' + location.port + '/chat?login=' + Auth.getLogin();
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

// class Chat extends React.Component {
//     render() {
//         if (Auth.getLogin() !== "")
//         {
//             return <div id="frame">
//                 <Auth />
//                 <Contacts />
//                 <MessagesList />
//             </div>
//         }
//         else
//         {
//             return
//         }
//     }
//
// }


ReactDOM.render(
    <div id="frame">
        <Auth />
        <Contacts />
        <MessagesList />
    </div>,
    document.getElementById('chat')
);