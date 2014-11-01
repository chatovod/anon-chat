(function() {
    var sock = null;
    var heartbeatTimeoutFuture;
    var textNode;
    var messagesNode;
    var nextNode;
    var sendButtonNode;
    var nextButtonNode;
    var writingNode;
    var scrollFuture;
    var readyToSend = false;
    var connecting = false;
    var writing = false;

    /**
     * On document ready
      */
    $(function() {
        textNode = $("#text");
        sendButtonNode = $("#sendButton");
        nextButtonNode = $("#nextButton");
        nextNode = $("#next");
        messagesNode = $("#messages");
        writingNode = $("#writing");
        $("#form").submit(function(e) {
            e.preventDefault();
            sendMsg();
        });
        textNode.keyup(function() {
            if (!readyToSend) {
                writing = false;
                return;
            }
            if (textNode.val().length == 0) {
                if (writing) {
                    //send not writing
                    writing = false;
                    sock.send("9");
                }
            } else {
                if (!writing) {
                    //send writing
                    writing = true;
                    sock.send("8");
                }
            }
        });
        nextButtonNode.click(function() {
            if (!readyToSend) return;
            addMsg("Вы покинули чат", "sys");
            addMsg("Ожидание нового собеседника...", "sys");
            sock.send("1");
        });
        reconnect();
    });

    /**
     * Common functions
     */

    function reconnect() {
        if (!connecting) {
            addMsg("Подключение к серверу...", "con");
            connecting = true;
        }
        sock = new SockJS('https://anon.chatovod.ru/socket', null, {
            debug: true/*,
            protocols_whitelist: [
                'websocket', 'xdr-streaming', 'xhr-streaming', 'iframe-eventsource', 'iframe-htmlfile', 'xdr-polling',
                'xhr-polling', 'iframe-xhr-polling', 'jsonp-polling'
            ]*/
        });
        sock.onopen = function () {
            connecting = false;
            addMsg("Ожидание нового собеседника...", "sys");
            resetHeartbeatTimeout();
            sock.send("1");
        };

        sock.onclose = function () {
            cancelHeartbeatTimeout();
            sock = null;
            setReadyToSend(false);
            setTimeout(reconnect, 3000);
        };

        sock.onmessage = function (e) {
            resetHeartbeatTimeout();
            var data = e.data;
            var cmd = data.charAt(0);
            switch (cmd) {
                case '2':
                    //anon connected
                    setReadyToSend(true);
                    addMsg("Незнакомец вошёл в чат", "sys");
                    break;
                case '4':
                case '5':
                    //msg
                    var items = split(data, ',', 2);
                    var id = items[1];
                    var text = items[2];
                    var me = cmd == '4';
                    if (!me) writingNode.hide();
                    addMsg((me?"Я: ":"Незнакомец: ")+ text, me ? "me" : "anon");
                    //ack
                    sock.send("6,"+id);
                    break;
                case '7':
                    //anon disconnected
                    setReadyToSend(false);
                    addMsg("Незнакомец покинул чат", "sys");
                    addMsg("Ожидание нового собеседника...", "sys");
                    sock.send("1");
                    break;
                case '8':
                    //writing
                    writingNode.show();
                    scrollBottom();
                    break;
                case '9':
                    //not writing
                    writingNode.hide();
                    break;
                case 'o':
                    nextButtonNode.text("Следующий из "+data.substring(2) + " чел.");
                    break;
            }
        };

        sock.onheartbeat = resetHeartbeatTimeout;
    };

    function resetHeartbeatTimeout() {
        if (heartbeatTimeoutFuture) {
            clearTimeout(heartbeatTimeoutFuture);
        }
        heartbeatTimeoutFuture = setTimeout(heartbeatTimeout, 60000);
    };

    function cancelHeartbeatTimeout() {
        if (heartbeatTimeoutFuture) {
            clearTimeout(heartbeatTimeoutFuture);
            heartbeatTimeoutFuture = null;
        }
    };

    function heartbeatTimeout() {
        addMsg("Потеряна связь с сервером.", "con");
        sock.close();
        heartbeatTimeoutFuture = null;
    };

    function setReadyToSend(value) {
        readyToSend = value;

        textNode.prop("disabled", !value);
        sendButtonNode.prop("disabled", !value);
        nextButtonNode.prop("disabled", !value);
        if (value) {
            textNode.focus();
        } else {
            writingNode.hide();
        }
    };

    function sendMsg() {
        if (!readyToSend) {
            textNode.focus();
            return;
        }
        var text = textNode.val();
        if (text.length == 0) {
            textNode.focus();
            return;
        }
        sock.send("3," + text);
        textNode.val("");
        writing = false;
        textNode.focus();
    };

    function addMsg(text, className) {
        var msg = $("<div></div>");
        if (className) msg.addClass(className);
        msg.text(text);
        msg.insertBefore(writingNode);
        scrollBottom();
    };

    function scrollBottom() {
        if (!scrollFuture) {
            scrollFuture = setTimeout(function() {
                scrollFuture = null;
                messagesNode.scrollTop(messagesNode.prop("scrollHeight"));
            }, 0);
        }
    };

    function split(str, separator, limit) {
        str = str.split(separator);

        if(str.length > limit) {
            var ret = str.splice(0, limit);
            ret.push(str.join(separator));

            return ret;
        }

        return str;
    };

})();