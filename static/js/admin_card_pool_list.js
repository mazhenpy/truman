"use strict";

function getQueryStringByName(name) {
    var result = location.search.match(new RegExp("[\?\&]" + name + "=([^\&]+)", "i"));
    if (result == null || result.length < 1) {
        return "";
    }
    return result[1];
}
var CARD_TYPE = getQueryStringByName('card_type');

var MainContent = React.createClass({
    displayName: "MainContent",

    getPoolList: function getPoolList() {
        $.ajax({
            url: _.str.sprintf('/admin/card_pool_list?card_type=%s&requ_type=%s', encodeURIComponent(CARD_TYPE), encodeURIComponent('get_pool_list')),
            type: 'get',
            dataType: 'json',

            success: (function (resp_data) {
                if (resp_data.status == 'ok') {
                    //console.log(JSON.stringify(resp_data));
                    this.setState({ pool_list: resp_data.data.pool_list });;
                } else {
                    alert("卡池列表加载错误 " + resp_data.msg);
                }
            }).bind(this),

            error: (function (xhr, status, err) {
                alert("卡池列表加载异常 " + err.toString());
                console.error(this.props.url, status, err.toString());
            }).bind(this)
        });
    },

    getPoolListConfig: function getPoolListConfig() {
        $.ajax({
            url: _.str.sprintf('/admin/card_pool_list?card_type=%s&requ_type=%s', encodeURIComponent(CARD_TYPE), encodeURIComponent('get_pool_list_config')),
            type: 'get',
            dataType: 'json',

            success: (function (resp_data) {
                if (resp_data.status == 'ok') {
                    this.setState({ pool_list_config: resp_data.data });
                } else {
                    alert('卡池列表配置加载错误 ' + resp_data.msg);
                }
            }).bind(this),

            error: (function (xhr, status, err) {
                alert('卡池列表配置加载异常 ' + err.toString());
                console.error(this.props.url, status, err.toString());
            }).bind(this)
        });
    },

    getInitialState: function getInitialState() {
        return {
            pool_list: [],
            pool_list_config: {}
        };
    },

    componentDidMount: function componentDidMount() {
        this.getPoolList();
        this.getPoolListConfig();
    },

    //点击新增卡池
    onClickAddPool: function onClickAddPool() {
        this.refs.AddPoolDlg.showDlg(this.state.pool_list, this.onAddPool);
    },

    //新增卡池
    onAddPool: function onAddPool(new_pool_info) {
        var requ_data = {
            requ_type: 'add_pool',
            argu_list: {
                new_pool_info: new_pool_info
            }
        };

        $.ajax({
            url: _.str.sprintf('/admin/card_pool_list?card_type=%s', encodeURIComponent(CARD_TYPE)),
            type: 'post',
            dataType: 'json',
            data: JSON.stringify(requ_data),

            success: (function (resp_data) {
                if (resp_data.status == 'ok') {
                    this.getPoolList();
                    alert(_.str.sprintf('新增卡池 %s 成功', new_pool_info.pool_name));
                } else {
                    alert(_.str.sprintf('新增卡池 %s 失败 %s!!!', new_pool_info.pool_name, resp_data.msg));
                }
            }).bind(this),

            error: (function (xhr, status, err) {
                alert(_.str.sprintf('新增卡池 %s 异常 %s!!!', new_pool_info.pool_name, err.toString()));
                console.error(this.props.url, status, err.toString());
            }).bind(this)
        });
    },

    //删除卡池
    onDelPool: function onDelPool(pool_info) {

        if (!window.confirm(_.str.sprintf('确认删除卡池 %s 吗?', pool_info.pool_name))) {
            if (pool_info.pool_name == this.state.pool_list_config.def_up_pool || this.state.pool_list_config.pub_use_pool) {}

            return;
        }

        var requ_data = {
            requ_type: 'remove_pool',
            argu_list: {
                pool_info: pool_info
            }
        };

        $.ajax({
            url: _.str.sprintf('/admin/card_pool_list?card_type=%s', encodeURIComponent(CARD_TYPE)),
            type: 'post',
            dataType: 'json',
            data: JSON.stringify(requ_data),

            success: (function (resp_data) {
                if (resp_data.status == 'ok') {
                    this.getPoolList();
                    alert(_.str.sprintf('删除卡池 %s 成功', pool_info.pool_name));
                } else {
                    alert(_.str.sprintf('删除卡池 %s 失败 %s!!!', pool_info.pool_name, resp_data.msg));
                }
            }).bind(this),

            error: (function (xhr, status, err) {
                alert(_.str.sprintf('删除卡池 %s 异常 %s!!!', pool_info.pool_name, err.toString()));
                console.error(this.props.url, status, err.toString());
            }).bind(this)
        });
    },

    //设置默认卡池
    onClickSetDefUpPool: function onClickSetDefUpPool(pool_info) {
        this.setPoolListConfig('def_up_pool', pool_info.pool_name);
    },

    //设置公共卡池
    onClickSetPubUsePool: function onClickSetPubUsePool(pool_info) {
        this.setPoolListConfig('pub_use_pool', pool_info.pool_name);
    },

    setPoolListConfig: function setPoolListConfig(key, value) {
        var keyname = '默认卡池';
        if (key != 'def_up_pool') {
            keyname = '公共卡池';
        }

        if (!window.confirm(_.str.sprintf('确认将卡池 %s 设为 %s 吗?', value, keyname))) {
            return;
        }

        var argu_list = {};
        argu_list[key] = value;

        var requ_data = {
            requ_type: 'set_pool_list_config',
            argu_list: argu_list
        };

        $.ajax({
            url: _.str.sprintf('/admin/card_pool_list?card_type=%s', encodeURIComponent(CARD_TYPE)),
            type: 'post',
            dataType: 'json',
            data: JSON.stringify(requ_data),

            success: (function (resp_data) {
                if (resp_data.status == 'ok') {
                    this.getPoolListConfig();
                    this.getPoolList();
                    alert(_.str.sprintf('%s 卡池 %s 设置成功', keyname, value));
                } else {
                    alert('失败!! ' + resp_data.msg);
                }
            }).bind(this),

            error: (function (xhr, status, err) {
                alert(err.toString());
                console.error(this.props.url, status, err.toString());
            }).bind(this)
        });
    },

    getLocalTime: function getLocalTime(e) {
        return new Date(parseInt(e) * 1000).toLocaleString();
    },

    //设置卡池缓存状态
    setPoolConfig: function setPoolConfig(card_pool, key, value) {
        var argu_list = {};
        argu_list["card_pool"] = card_pool;
        argu_list["key"] = key;
        argu_list["value"] = value;

        var requ_data = {
            requ_type: 'set_pool_config',
            argu_list: argu_list
        };

        $.ajax({
            url: _.str.sprintf('/admin/card_pool_list?card_type=%s', encodeURIComponent(CARD_TYPE)),
            type: 'post',
            dataType: 'json',
            data: JSON.stringify(requ_data),

            success: (function (resp_data) {
                if (resp_data.status == 'ok') {
                    this.getPoolList();
                    alert(_.str.sprintf('卡池 %s 设置缓存成功', card_pool));
                } else {
                    alert("修改卡池配置错误: " + resp_data.msg);
                }
            }).bind(this),

            error: (function (xhr, status, err) {
                alert("修改卡池配置异常: " + err.toString());
                console.error(this.props.url, status, err.toString());
            }).bind(this)
        });
    },

    //打开缓存
    onOpenPoolConfig: function onOpenPoolConfig(pool_name) {
        if (!window.confirm(_.str.sprintf('确认将卡池缓存 %s 打开吗?', pool_name))) {
            return;
        }
        this.setPoolConfig(pool_name, "need_cache", 1);
    },

    //关闭缓存
    onClosePoolConfig: function onClosePoolConfig(pool_name) {
        if (!window.confirm(_.str.sprintf('确认将卡池缓存 %s 关闭吗?', pool_name))) {
            return;
        }
        this.setPoolConfig(pool_name, "need_cache", 0);
    },

    render: function render() {
        var DefaultPool = this.state.pool_list_config.def_up_pool;
        var PublicPool = this.state.pool_list_config.pub_use_pool;

        var PoolList = this.state.pool_list.map((function (pool_info, index) {

            var poolname = pool_info.pool_name;
            var OpenBtnId = "open" + poolname;
            var CloseBtnId = "close" + poolname;

            var needCacheNode = null;
            if (poolname != PublicPool) {
                if (pool_info.need_cache == 1) {
                    needCacheNode = React.createElement(
                        "div",
                        { className: "row" },
                        React.createElement(
                            "div",
                            { className: "col-xs-4 poolalert alert-success text-center" },
                            "状态: 打开"
                        ),
                        React.createElement(
                            "div",
                            { className: "col-xs-2 text-right" },
                            React.createElement(
                                "a",
                                { id: CloseBtnId, href: "javascript:void(0);", className: "btn btn-danger btn-xs", onClick: this.onClosePoolConfig.bind(this, poolname) },
                                "关闭"
                            )
                        )
                    );
                } else {
                    needCacheNode = React.createElement(
                        "div",
                        { className: "row" },
                        React.createElement(
                            "div",
                            { className: "col-xs-4 poolalert alert-danger text-center" },
                            "状态: 关闭"
                        ),
                        React.createElement(
                            "div",
                            { className: "col-xs-2" },
                            React.createElement(
                                "a",
                                { id: OpenBtnId, href: "javascript:void(0);", className: "btn btn-info btn-xs", onClick: this.onOpenPoolConfig.bind(this, poolname) },
                                "打开"
                            )
                        )
                    );
                }
            }

            var PoolCreateTime = this.getLocalTime(pool_info.create_tsp);

            var CfgBtn = React.createElement(
                "div",
                { className: "btn-group btn-group-xs", role: "group", "aria-label": "" },
                React.createElement(
                    "button",
                    { type: "button", href: "javascript:void(0);", className: "btn btn-success", onClick: this.onClickSetDefUpPool.bind(this, pool_info) },
                    React.createElement("i", { className: "icon-bookmark" }),
                    " 默认卡池"
                ),
                React.createElement(
                    "button",
                    { type: "button", herf: "javascript:void(0);", className: "btn btn-primary", onClick: this.onClickSetPubUsePool.bind(this, pool_info) },
                    React.createElement("i", { className: "icon-group" }),
                    " 公共卡池"
                )
            );

            if (poolname == PublicPool && poolname != DefaultPool) {
                CfgBtn = React.createElement(
                    "button",
                    { type: "button", href: "javascript:void(0);", className: "btn btn-success", onClick: this.onClickSetDefUpPool.bind(this, pool_info) },
                    React.createElement("i", { className: "icon-bookmark" }),
                    " 默认卡池"
                );
            } else if (poolname == DefaultPool && poolname != PublicPool) {
                CfgBtn = React.createElement(
                    "button",
                    { type: "button", herf: "javascript:void(0);", className: "btn btn-primary", onClick: this.onClickSetPubUsePool.bind(this, pool_info) },
                    React.createElement("i", { className: "icon-group" }),
                    " 公共卡池"
                );
            } else if (poolname == DefaultPool && poolname == PublicPool) {
                CfgBtn = null;
            };

            var DelBtn = null;
            if (poolname != DefaultPool && poolname != PublicPool) {
                DelBtn = React.createElement(
                    "button",
                    { type: "button", href: "javascript:void(0);", className: "btn btn-danger", onClick: this.onDelPool.bind(this, pool_info) },
                    React.createElement("i", { className: "icon-trash" }),
                    " 删除"
                );
            }

            return React.createElement(
                "tr",
                null,
                React.createElement(
                    "td",
                    null,
                    poolname
                ),
                React.createElement(
                    "td",
                    null,
                    PoolCreateTime
                ),
                React.createElement(
                    "td",
                    null,
                    needCacheNode
                ),
                React.createElement(
                    "td",
                    null,
                    React.createElement(
                        "div",
                        { className: "btn-toolbar pull-right", role: "toolbar", "aria-label": "" },
                        React.createElement(
                            "div",
                            { className: "btn-group btn-group-xs", role: "group", "aria-label": "" },
                            DelBtn
                        ),
                        React.createElement(
                            "div",
                            { className: "btn-group btn-group-xs", role: "group", "aria-label": "" },
                            CfgBtn
                        )
                    )
                )
            );
        }).bind(this));

        return React.createElement(
            "div",
            { className: "wrapper" },
            React.createElement(
                "div",
                { className: "col-md-12" },
                React.createElement(
                    "section",
                    { className: "panel" },
                    React.createElement(
                        "header",
                        { className: "panel-heading row" },
                        React.createElement(
                            "span",
                            { className: "pull-left" },
                            React.createElement("i", { className: "icon-table" }),
                            "卡池列表"
                        ),
                        React.createElement(
                            "a",
                            { className: "btn btn-info pull-right", href: "javascript:void(0);", onClick: this.onClickAddPool },
                            React.createElement("i", { className: "icon-plus" }),
                            " 新增卡池"
                        )
                    ),
                    React.createElement(
                        "div",
                        { className: "col-xs-12" },
                        React.createElement(
                            "h5",
                            { className: "text-danger" },
                            React.createElement(
                                "strong",
                                null,
                                React.createElement("i", { className: "icon-bookmark" }),
                                " 当前默认卡池： ",
                                DefaultPool
                            )
                        ),
                        React.createElement(
                            "h5",
                            { className: "text-primary" },
                            React.createElement(
                                "strong",
                                null,
                                React.createElement("i", { className: "icon-group" }),
                                "当前公共卡池： ",
                                PublicPool
                            )
                        )
                    ),
                    React.createElement(
                        "div",
                        { className: "panel-body" },
                        React.createElement(
                            "table",
                            { className: "table table-striped table-hover" },
                            React.createElement(
                                "thead",
                                null,
                                React.createElement(
                                    "tr",
                                    null,
                                    React.createElement(
                                        "th",
                                        null,
                                        "卡池名称"
                                    ),
                                    React.createElement(
                                        "th",
                                        null,
                                        "创建时间"
                                    ),
                                    React.createElement(
                                        "th",
                                        null,
                                        React.createElement(
                                            "div",
                                            { className: "col-xs-4 text-right" },
                                            "状态"
                                        )
                                    ),
                                    React.createElement(
                                        "th",
                                        null,
                                        React.createElement(
                                            "div",
                                            { className: "col-xs-10 text-right" },
                                            "操作"
                                        )
                                    )
                                )
                            ),
                            React.createElement(
                                "tbody",
                                null,
                                PoolList
                            )
                        )
                    )
                )
            ),
            React.createElement(AddPoolDlg, { ref: "AddPoolDlg" })
        );
    }
});

//新增卡池弹窗
var AddPoolDlg = React.createClass({
    displayName: "AddPoolDlg",

    onOk: function onOk() {
        var pool_name = $('#new_pool_name').val();

        //前台数据监测这个卡池名字是否已经存在了
        for (var i in this.state.pool_list) {
            if (pool_name == this.state.pool_list[i].pool_name) {
                alert("这个名字已经被使用了， 换一个!!!");
                return;
            }
        }

        var new_pool_info = {
            pool_name: pool_name
        };

        this.state.onAddPool(new_pool_info);
        this.hideDlg();
    },

    onInputKeyUp: function onInputKeyUp(input_id) {
        $('#' + input_id).keydown(function (e) {
            if (!e) var e = window.event;
            if (e.keyCode == 32) {
                e.preventDefault();
                e.stopPropagation();
            };
        });

        var value = $('#' + input_id).val();
        if (value != '' || value != null || value != 'null') {
            $('#addnewpoolbtn').removeClass('disabled');
        };
        $('#' + input_id).val();
    },

    showDlg: function showDlg(pool_list, onAddPool) {
        this.setState({
            pool_list: pool_list,
            onAddPool: onAddPool
        });
        $('#addPoolDlg').modal('show');
        $('#new_pool_name').val('');
        $('#addnewpoolbtn').addClass('disabled');
    },

    hideDlg: function hideDlg() {
        $('#addPoolDlg').modal('hide');
        this.clearInput();
    },

    clearInput: function clearInput() {
        this.setState({
            pool_list: [],
            onAddPool: null
        });

        $('#new_pool_name').val('');
    },

    getInitialState: function getInitialState() {
        return {
            pool_list: [],
            onAddPool: null
        };
    },

    componentDidUpdate: function componentDidUpdate() {},

    render: function render() {
        return React.createElement(
            "div",
            { className: "modal", id: "addPoolDlg", tabIndex: "-1", role: "dialog" },
            React.createElement(
                "div",
                { className: "modal-dialog" },
                React.createElement(
                    "div",
                    { className: "modal-content" },
                    React.createElement(
                        "div",
                        { className: "modal-header" },
                        React.createElement(
                            "h5",
                            { className: "modal-title" },
                            "新增卡池"
                        )
                    ),
                    React.createElement(
                        "div",
                        { className: "modal-body form-horizontal" },
                        React.createElement(
                            "div",
                            { className: "form-group add-pro-body" },
                            React.createElement(
                                "label",
                                { className: "col-md-2 control-label" },
                                "卡池名称"
                            ),
                            React.createElement(
                                "div",
                                { className: "col-md-10" },
                                React.createElement("input", { maxLength: "15", className: "m-bot15 form-control input-sm", id: "new_pool_name", onBlur: this.onInputKeyUp.bind(this, 'new_pool_name'), onKeyUp: this.onInputKeyUp.bind(this, 'new_pool_name'), placeholder: "请输入卡池名称" })
                            )
                        )
                    ),
                    React.createElement(
                        "div",
                        { className: "modal-footer form-horifooter" },
                        React.createElement(
                            "button",
                            { id: "addnewpoolbtn", type: "button", className: "btn btn-danger", onClick: this.onOk },
                            "新建"
                        ),
                        React.createElement(
                            "button",
                            { type: "button", className: "btn btn-default", "data-dismiss": "modal" },
                            "取消"
                        )
                    )
                )
            )
        );
    }
});

React.render(React.createElement(MainContent, null), document.getElementById('main-content'));

