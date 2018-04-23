var UploadPanel = React.createClass({displayName: "UploadPanel",
    getInitialState: function () {
        return {
            pending_list: []
        };
    },

    doRefresh: function () {

        $.ajax({
            url: '/api/easy_import/list',
            dataType: 'json',
            type: 'get',
            success: function (data) {
                this.setState({pending_list: data});
            }.bind(this),

            error: function (xhr, status, err) {
                alert("ERR " + err);
            }.bind(this)
        });
    },

    componentDidMount: function () {
        this.doRefresh();
    },

    doRest: function () {
        $.ajax({
            url: '/api/easy_import/reset',
            dataType: 'json',
            type: 'post',
            success: function (data) {
                this.doRefresh();
            }.bind(this),

            error: function (xhr, status, err) {
                alert("ERR " + err);
            }.bind(this)
        });
    },

    doRemove: function (card_id) {
        alert(card_id);

        var request = JSON.stringify({'id': card_id});
        $.ajax({
            url: '/api/easy_import/remove',
            dataType: 'json',
            type: 'post',
            data: request,
            success: function (data) {
                if (data.status != 'ok') {
                    alert(data.msg);
                } else {
                    this.doRefresh();
                }
            }.bind(this),

            error: function (xhr, status, err) {
                alert("系统错误:" + err);
            }.bind(this)
        });

    },

    doCommit: function () {
        $('#commit-btn').attr('disabled', 'true');

        $.ajax({
            url: '/api/easy_import/commit',
            dataType: 'json',
            type: 'post',
            success: function (data) {
                this.doRefresh();
                alert(data.msg);
                $('#commit-btn').removeAttr('disabled');
            }.bind(this),

            error: function (xhr, status, err) {
                alert("系统错误:" + err);
                $('#commit-btn').removeAttr('disabled');
            }.bind(this)
        });
    },

    onInput: function (event) {
        if (event.keyCode == 13) {
            var price = $("#form-value").val();
            if (price == '') {
                alert('请先输入价格');
                $("#form-input").val('').focus();
            }

            console.info('ENTER');
            var values = event.target.value.split('\n');
            console.info(values);

            if (values.length >= 3) {
                console.info('VERIFY');
                //Verify
                if (values[0].length != 16) {
                    alert('请检查您输入的卡号，应该是16位');
                    return;
                }
                if (values[1].length != 20) {
                    alert('请检查您输入的密码，应该是20位');
                    return;
                }

                var request = JSON.stringify({
                    'price': $('#form-value').val(),
                    'id': values[0],
                    'password': values[1]
                });

                // add
                $.ajax({
                    url: '/api/easy_import/add',
                    dataType: 'json',
                    type: 'post',
                    data: request,

                    success: function (response) {
                        if (response.status == 'ok') {
                            this.state.pending_list.push({'price': price, 'id': values[0], 'password': values[1]});
                            this.setState(this.state.pending_list);
                            $("#form-input").val('').focus();
                        } else {
                            alert(response.msg);
                        }
                    }.bind(this),

                    error: function (xhr, status, err) {
                        $('#commit-btn').removeAttr('disabled');
                    }.bind(this)
                });

            }
        }
    },

    cleanInput: function () {
        $('#form-input').val("").focus();
    },

    render: function () {
        var pendingRows = this.state.pending_list.map(function (pending, i) {
            return (
                React.createElement("tr", null, 
                    React.createElement("td", null, pending.price), 
                    React.createElement("td", null, pending.id), 
                    React.createElement("td", null, pending.password), 
                    React.createElement("td", null, React.createElement("a", {href: "#", onClick: this.doRemove.bind(this, pending.id)}, "删除"))
                )
            );
        }.bind(this));

        return (
            React.createElement("div", {className: "form-horizontal"}, 
                React.createElement("div", {className: "form-group"}, 

                    React.createElement("label", {className: "col-md-2 control-label"}, "面值"), 

                    React.createElement("div", {className: "col-md-4"}, 
                        React.createElement("input", {id: "form-value", className: "form-control m-bot15", type: "text"})
                    ), 

                    React.createElement("div", {className: "col-md-6"}, 
                        React.createElement("span", null)
                    )
                ), 
                React.createElement("div", {className: "form-group"}, 
                    React.createElement("label", {className: "col-md-2 control-label"}, "在此扫描卡号"), 

                    React.createElement("div", {className: "col-md-10"}, 
                        React.createElement("textarea", {id: "form-input", className: "form-control", onKeyUp: this.onInput})
                    ), 

                    React.createElement("div", {className: "col-md-offset-2 col-md-10"}, React.createElement("a", {href: "#", onClick: this.cleanInput}, "清空，重新输入"))
                ), 

                React.createElement("div", {className: "form-group"}, 
                    React.createElement("div", {className: "col-md-12 table-responsive"}, 
                        React.createElement("table", {className: "table table-hover"}, 
                            React.createElement("thead", null, 
                            React.createElement("tr", null, 
                                React.createElement("th", null, "面值"), 
                                React.createElement("th", null, "卡号"), 
                                React.createElement("th", null, "密码")
                            )
                            ), 
                            React.createElement("tbody", null, 
                            pendingRows
                            )
                        )
                    )
                ), 

                React.createElement("div", {className: "form-group"}, 
                    React.createElement("div", {className: "col-md-offset-2 col-md-6"}, 
                        React.createElement("a", {id: "commit-btn", className: "btn btn-danger", href: "#", onClick: this.doCommit}, "提交")
                    ), 
                    React.createElement("div", {className: "col-md-2"}, 
                        React.createElement("a", {className: "btn btn-info", href: "#", onClick: this.doRest}, "全部清除，重新开始")
                    )
                )
            )
        );
    }
});

React.render(
    React.createElement(UploadPanel, null)
    ,
    document.getElementById('content')
);
