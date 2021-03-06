function getQueryStringByName(name) {
    var result = location.search.match(new RegExp("[\?\&]" + name + "=([^\&]+)", "i"));
    if (result == null || result.length < 1) {
        return "";
    }
    return result[1];
}
var CARD_TYPE = getQueryStringByName('card_type');

var MainContent = React.createClass({displayName: "MainContent",
    getInitialState: function () {
        return {};
    },

    componentDidMount: function () {
    },

    componentDidUpdate: function (prevProps, prevState) {
    },

    render: function () {
        return (
            React.createElement("div", {className: "wrapper"}, 
                React.createElement(DownstreamUserList, null)
            )
        );
    }
});


var DownstreamUserList = React.createClass({displayName: "DownstreamUserList",
    onClickDeleteCardPool: function (user_info, card_pool) {
        if (!window.confirm(_.str.sprintf('确认删除用户 %s 的卡池 %s 吗?', user_info.user_name, card_pool))) {
            return;
        }

        var user_list = this.state.user_list;
        var user_list2 = [];

        for (var i in user_list) {
            if (user_info.user_id == user_list[i].user_id) {

                var remove_index = user_list[i].card_pool_list.indexOf(card_pool);
                user_list[i].card_pool_list.splice(remove_index, 1);
                user_list2.push(user_list[i]);
            }
            else {
                user_list2.push(user_list[i]);
            }
        }

        this.setState({
            user_list: user_list2,
        });

    },

    onClickDeleteUser: function (user_info) {
        if (!window.confirm(_.str.sprintf('确认删除用户 %s %s 吗?', user_info.user_id, user_info.user_name))) {
            return;
        }

        var requ_data = {
            requ_type: 'remove_user',
            argu_list: {
                user_info: user_info
            }
        };

        $.ajax({
            url: _.str.sprintf('/admin/card_pool_list?card_type=%s',
                               encodeURIComponent(CARD_TYPE)
                              ),
            type: 'post',
            dataType: 'json',
            data: JSON.stringify(requ_data),

            success: function (resp_data) {
                if (resp_data.status == 'ok') {
                    this.getUserList();
                    alert("删除用户成功");
                } else {
                    alert("删除用户出错 " + resp_data.msg);
                }
            }.bind(this),

            error: function (xhr, status, err) {
                alert("删除用户异常 " + err.toString());
                console.error(this.props.url, status, err.toString());
            }.bind(this)
        });
    },

    onClickAddUser: function () {
        this.refs.AddUserDlg.showDlg(this.state.user_list, this.onAddUserOk);
    },

    onAddUserOk: function (new_user_info) {
        var requ_data = {
            requ_type: 'add_user',
            argu_list: {
                new_user_info: new_user_info
            }
        };

        $.ajax({
            url: _.str.sprintf('/admin/card_pool_list?card_type=%s',
                               encodeURIComponent(CARD_TYPE)
                              ),
            type: 'post',
            dataType: 'json',
            data: JSON.stringify(requ_data),

            success: function (resp_data) {
                if (resp_data.status == 'ok') {
                    this.getUserList();
                    alert("新增用户成功");
                } else {
                    alert("新增用户出错 " + resp_data.msg);
                }
            }.bind(this),

            error: function (xhr, status, err) {
                alert("新增用户异常 " + err.toString());
                console.error(this.props.url, status, err.toString());
            }.bind(this)
        });
    },

    onClickChooseCardPool: function (user_info, card_pool_seq) {
        this.refs.ChooseUserCardPoolDlg.showDlg(user_info, card_pool_seq, this.state.card_pool_list, this.onChooseCardPoolOk);
    },

    onChooseCardPoolOk: function (user_info, card_pool_seq, card_pool_name) {
        var requ_data = {
            requ_type: 'set_user_card_pool',
            argu_list: {
                user_info: user_info,
                card_pool_seq: card_pool_seq,
                card_pool_name: card_pool_name,
            }
        };

        $.ajax({
            url: _.str.sprintf('/admin/card_pool_list?card_type=%s',
                               encodeURIComponent(CARD_TYPE)
                              ),
            type: 'post',
            dataType: 'json',
            data: JSON.stringify(requ_data),

            success: function (resp_data) {
                if (resp_data.status == 'ok') {
                    this.getUserList();
                } else {
                    alert("修改卡池出错 " + resp_data.msg);
                }
            }.bind(this),

            error: function (xhr, status, err) {
                alert("修改卡池异常 " + err.toString());
                console.error(this.props.url, status, err.toString());
            }.bind(this)
        });
    },

    getUserList: function () {
        $.ajax({
            url: _.str.sprintf('/admin/card_pool_list?card_type=%s&requ_type=%s',
                               encodeURIComponent(CARD_TYPE),
                               encodeURIComponent('get_user_list')
                              ),
            type: 'get',
            dataType: 'json',

            success: function (resp_data) {
                if (resp_data.status == 'ok') {
                    this.setState({ user_list: resp_data.data.user_list });
                }
                else {
                    alert("用户列表加载错误 " + resp_data.msg);
                }
            }.bind(this),

            error: function (xhr, status, err) {
                alert("用户列表加载异常 " + err.toString());
                console.error(this.props.url, status, err.toString());
            }.bind(this)
        });
    },

    getCardPoolList: function () {
        $.ajax({
            url: _.str.sprintf('/admin/card_pool_list?card_type=%s&requ_type=%s',
                               encodeURIComponent(CARD_TYPE),
                               encodeURIComponent('get_pool_list')
                              ),
            type: 'get',
            dataType: 'json',

            success: function (resp_data) {
                if (resp_data.status == 'ok') {
                    this.setState({ card_pool_list: resp_data.data.pool_list });
                }
                else {
                    alert("用户列表加载错误 " + resp_data.msg);
                }
            }.bind(this),

            error: function (xhr, status, err) {
                alert("用户列表加载异常 " + err.toString());
                console.error(this.props.url, status, err.toString());
            }.bind(this)
        });
    },

    getInitialState: function () {
        return {
            card_pool_list: [],
            user_list: [],
        };
    },

    componentDidMount: function () {
        this.getUserList();
        this.getCardPoolList();
    },

    componentDidUpdate: function (prevProps, prevState) {
    },

    render: function () {
        var userListNodes = this.state.user_list.map(function (user_info, index) {
            var cardPoolListBtnNodes = user_info.card_pool_seq_list.map(function (card_pool_seq, index) {
                var card_pool_name = user_info[card_pool_seq];
                if (card_pool_name == '') {
                    return (
                        React.createElement("a", {href: "javascript:void(0);", className: "btn btn-sm btn-default", 
                           style: {border:"1px dashed #CACACA", padding: "0 20px"}, 
                           onClick: this.onClickChooseCardPool.bind(this, user_info, card_pool_seq)}, 
                            React.createElement("i", {className: "icon-plus"})
                        )
                        );
                } else {
                    return (
                        React.createElement("a", {href: "javascript:void(0);", className: "btn btn-sm btn-info", 
                           style: {padding: "0px 10px"}, 
                           onClick: this.onClickChooseCardPool.bind(this, user_info, card_pool_seq)}, 
                            index + 1, ". ", card_pool_name
                        )
                    );
                }
            }.bind(this));

            var delUserBtnNode = (
                    React.createElement("a", {href: "javascript:void(0);", 
                       className: "btn btn-sm btn-danger", 
                       style: {padding: "0 10px"}, 
                       onClick: this.onClickDeleteUser.bind(this, user_info)}, 
                        React.createElement("i", {className: "icon-remove"}), " ", "删除"
                    )
                );

            return (
                    React.createElement("tr", null, 
                        React.createElement("td", null, user_info.user_id), 
                        React.createElement("td", null, user_info.user_name), 
                        React.createElement("td", null, cardPoolListBtnNodes), 
                        React.createElement("td", null, delUserBtnNode)
                    )
                );
        }.bind(this));


        return (
                React.createElement("div", {className: "col-md-12"}, 
                    React.createElement("div", {className: "panel"}, 
                        React.createElement("div", {className: "panel-heading row"}, 
                            React.createElement("span", {className: "pull-left"}, 
                            React.createElement("i", {className: "icon-th-list"}), "用户列表"
                            ), 
                            React.createElement("span", {className: "pull-right"}, 
                                React.createElement("a", {className: "btn btn-info", href: "javascript:void(0);", onClick: this.onClickAddUser}, React.createElement("i", {className: "icon-plus"}), " 新增用户")
                            )
                        ), 
                        React.createElement("div", {className: "panel-body"}, 
                            React.createElement("table", {className: "table table-responsive table-striped table-hover"}, 
                                React.createElement("thead", null, 
                                    React.createElement("tr", null, 
                                        React.createElement("th", null, "用户ID"), 
                                        React.createElement("th", null, "名称"), 
                                        React.createElement("th", null, "卡池使用表"), 
                                        React.createElement("th", null, "操作")
                                    )
                                ), 
                                React.createElement("tbody", null, 
                                    userListNodes
                                )
                            )
                        )
                    ), 
                    React.createElement(AddUserDlg, {ref: "AddUserDlg"}), 
                    React.createElement(ChooseUserCardPoolDlg, {ref: "ChooseUserCardPoolDlg"})
                )
        );
    }
});


//增加新用户
var AddUserDlg = React.createClass({displayName: "AddUserDlg",
    clearInput: function () {
        this.setState({
            user_list: [],
            onClickOk: null,
        });
    },

    onOk: function () {
        var new_user_info = {
            user_id: $('#new_user_id').val(),
            user_name: $('#new_user_name').val(),
        };

        this.state.onClickOk(new_user_info);

        this.hideDlg();
    },
   

    onInputKeyUp: function (input_id) {
        $('#' + input_id).keydown(
            function (e) {
                if (!e) var e = window.event;
                if (input_id == 'new_user_id'){
                    if (((e.keyCode >= 48) && (e.keyCode <= 57)) || ((e.keyCode >= 96) && (e.keyCode <= 105)) || e.keyCode == 8 || e.keyCode == 0) {
                    } else {
                        e.preventDefault();
                        e.stopPropagation();
                    };
                }else{
                    if (e.keyCode == 32) {
                        e.preventDefault();
                        e.stopPropagation();
                    };
                };
        });

        var idvalue = $("#new_user_id").val();
        if (idvalue.length != 6 || idvalue == null || idvalue == "" || idvalue == "null") {
            $('#new_user_name').attr({ 'disabled': 'disabled' });
            $('#new_user_id_msg').show();
        } else {
            $('#new_user_id_msg').hide();
            $('#new_user_name').removeAttr('disabled');
            var namevalue = $("#new_user_name").val();
            if (namevalue == '' || namevalue == null || namevalue == 'null') {
                $('#new_user_name_msg').show();
            } else if (idvalue.length == 6 && namevalue != '' && namevalue != null && namevalue != 'null') {
                $('#new_user_id_msg').hide();
                $('#new_user_name_msg').hide();
                $('#addokbtn').removeClass('disabled');
            };
        };

        $("#" + input_id).val();
    },

    showDlg: function (user_list, onClickOk) {
        this.setState({
            user_list: user_list,
            onClickOk: onClickOk,
        });

        $('#AddUserDlg').modal({ backdrop: 'static', keyboard: false });
        $('#new_user_id').val('');
        $('#new_user_name').val('');
        $('#new_user_id_msg').hide();
        $('#new_user_name_msg').hide();
        $('#new_user_name').attr({ 'disabled': 'disabled' });
        $('#addokbtn').addClass('disabled');
    },

    hideDlg: function () {
        this.clearInput();
        $('#AddUserDlg').modal('hide');
    },

    getInitialState: function () {
        return ({
            user_list: [],
            onClickOk: null,
        });
    },

    componentDidMount: function () {
    },

    render: function () {
        return (
            React.createElement("div", {className: "modal", id: "AddUserDlg", tabIndex: "-1", role: "dialog"}, 
                React.createElement("div", {className: "modal-dialog"}, 
                    React.createElement("div", {className: "modal-content"}, 
                        React.createElement("div", {className: "modal-header"}, 
                            React.createElement("h5", {className: "modal-title"}, "新增卡池用户")
                        ), 
                        React.createElement("div", {className: "modal-body form-horizontal"}, 
                            React.createElement("div", {className: "form-group add-pro-body"}, 
                                React.createElement("div", {className: "row"}, 
                                    React.createElement("label", {className: "col-xs-2 control-label"}, "用户ID"), 
                                    React.createElement("div", {className: "col-xs-6"}, 
                                        React.createElement("input", {maxLength: "6", className: "m-bot15 form-control input-sm", id: "new_user_id", placeholder: "请输入六位数的用户ID", onBlur: this.onInputKeyUp.bind(this,'new_user_id'), onKeyUp: this.onInputKeyUp.bind(this,'new_user_id')})
                                    ), 
                                    React.createElement("span", {className: "col-xs-3 alert alert-danger", id: "new_user_id_msg", style: {display: "none", padding:"5"}}, React.createElement("i", {className: "icon-remove"}), " 用户ID必须为六位")
                                ), 
                                React.createElement("div", {className: "row"}, 
                                    React.createElement("label", {className: "col-xs-2 control-label"}, "用户名称"), 
                                    React.createElement("div", {className: "col-xs-6"}, 
                                        React.createElement("input", {maxLength: "15", className: "m-bot15 form-control input-sm", id: "new_user_name", placeholder: "请输入用户名称", onBlur: this.onInputKeyUp.bind(this,'new_user_name'), onKeyUp: this.onInputKeyUp.bind(this,'new_user_name')})
                                    ), 
                                    React.createElement("span", {className: "col-xs-3 alert alert-danger", id: "new_user_name_msg", style: {display: "none", padding:"5"}}, React.createElement("i", {className: "icon-remove"}), " 用户名称不能为空")
                                )
                            )
                        ), 
                        React.createElement("div", {className: "modal-footer form-horifooter"}, 
                            React.createElement("button", {type: "button", id: "addokbtn", className: "btn btn-danger", onClick: this.onOk}, "增加"), 
                            React.createElement("button", {type: "button", className: "btn btn-default", "data-dismiss": "modal"}, "取消")
                        )
                    )
                )
            )
            )
    }
});


//选择卡池排序
var ChooseUserCardPoolDlg = React.createClass({displayName: "ChooseUserCardPoolDlg",
    onOk: function () {
        this.state.onClickOk(this.state.user_info, this.state.card_pool_seq, $('#user_select_card_pool').val());
        this.hideDlg();
    },

    showDlg: function (user_info, card_pool_seq, card_pool_list, onClickOk) {
        var empty_card_pool = {
            pool_name: '',
        };

        var card_pool_list2 = [empty_card_pool];
        card_pool_list2 = card_pool_list2.concat(card_pool_list);
        console.info(card_pool_list2);

        this.setState({
            user_info: user_info,
            card_pool_seq: card_pool_seq,
            card_pool_list: card_pool_list2,
            onClickOk: onClickOk,
        });

        $('#ChooseUserCardPoolDlg').modal('show');
    },

    hideDlg: function () {
        $('#ChooseUserCardPoolDlg').modal('hide');
        this.clearDlgData();
    },

    clearDlgData: function () {
        this.setState({
            user_info: null,
            card_pool_seq: null,
            card_pool_list: [],
            onClickOk: null,
        });
    },

    getInitialState: function () {
        return ({
            user_info: null,
            card_pool_seq: null,
            card_pool_list: [],
            onClickOk: null,
        });
    },

    componentDidMount: function () {
    },

    componentDidUpdate: function () {
    },

    render: function () {
        var cardPoolListNodes = this.state.card_pool_list.map(function (card_pool, index) {
            if (card_pool.pool_name == "") {
                return (React.createElement("option", {value: card_pool.pool_name}, "(空)"));
            }
            else {
                return (React.createElement("option", {value: card_pool.pool_name}, card_pool.pool_name));
            }
        }.bind(this));

        return (
        React.createElement("div", {className: "modal", id: "ChooseUserCardPoolDlg", tabIndex: "-1", role: "dialog"}, 
            React.createElement("div", {className: "modal-dialog"}, 
                React.createElement("div", {className: "modal-content"}, 
                    React.createElement("div", {className: "modal-header"}, 
                        React.createElement("h5", {className: "modal-title"}, "选择卡池")
                    ), 
                    React.createElement("div", {className: "modal-body form-horizontal"}, 
                        React.createElement("div", {className: "form-group add-pro-body"}, 
                            React.createElement("div", {className: "col-md-12"}, 
                                React.createElement("select", {className: "form-control", id: "user_select_card_pool"}, 
                                    cardPoolListNodes
                                )
                            )
                        )
                    ), 
                    React.createElement("div", {className: "modal-footer form-horifooter"}, 
                        React.createElement("button", {type: "button", className: "btn btn-danger", onClick: this.onOk}, "确定"), 
                        React.createElement("button", {type: "button", className: "btn btn-default", "data-dismiss": "modal"}, "取消")
                    )
                )
            )
        )
            )
    }
});


React.render(
    React.createElement(MainContent, null)
    ,
    document.getElementById('main-content')
);