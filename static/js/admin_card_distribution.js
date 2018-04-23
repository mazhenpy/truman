"use strict";

function getQueryStringByName(name) {
    var result = location.search.match(new RegExp("[\?\&]" + name + "=([^\&]+)", "i"));
    if (result == null || result.length < 1) {
        return "";
    }
    return result[1];
}
var CARD_TYPE = getQueryStringByName('card_type');

//计算列表的面值详情
var getValueInfo = function getValueInfo(box_list) {
    var total_value = 0;
    var price_value_info = new Array();
    for (var i in box_list) {
        var price = Number(box_list[i].price);

        if (!price_value_info[price]) {
            price_value_info[price] = 0;
        }
        var v = box_list[i].price * box_list[i].ready;

        price_value_info[price] += v;
        total_value += v;
    }

    total_value /= 10000;
    for (var i in price_value_info) {
        price_value_info[i] /= 10000;
    }

    var value_info_str = "  总面值(" + total_value + "万) ";
    for (var i in price_value_info) {
        value_info_str += i + "(" + price_value_info[i] + "万) ";
    }

    return value_info_str;
};

//显示全屏遮罩
var Showfullbg = function Showfullbg() {
    $("#reload_fullbg").show();
    $("#reload_icon").show();
};

//隐藏全屏遮罩
var Hidefullbg = function Hidefullbg() {
    $("#reload_fullbg").hide();
    $("#reload_icon").hide();
};

var MainContent = React.createClass({
    displayName: "MainContent",

    //读取卡池配置
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

    //读取所有的卡池列表
    getPoolList: function getPoolList() {
        $.ajax({
            url: _.str.sprintf('/admin/card_pool_list?card_type=%s&requ_type=%s', encodeURIComponent(CARD_TYPE), encodeURIComponent('get_pool_list')),
            type: 'get',
            dataType: 'json',

            success: (function (resp_data) {
                if (resp_data.status == 'ok') {
                    this.setState({ pool_list: resp_data.data.pool_list });
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

    removeSourceBoxList: function removeSourceBoxList(box_list) {
        this.refs.PendingBoxList.addBoxList(box_list);
    },

    removePendingBoxList: function removePendingBoxList(box_list) {
        this.refs.SourceCardPool.addBoxList(box_list);
    },

    onSourceCardPoolChange: function onSourceCardPoolChange(source_pool) {
        this.refs.PendingBoxList.onSourceCardPoolChange(source_pool);
    },

    selectSourceCardPool: function selectSourceCardPool(dest_pool) {
        this.refs.SourceCardPool.selectSourceCardPool(dest_pool);
    },

    getInitialState: function getInitialState() {
        return {
            pool_list_config: {},
            pool_list: []
        };
    },

    componentDidMount: function componentDidMount() {
        this.getPoolList();
        this.getPoolListConfig();
    },

    componentDidUpdate: function componentDidUpdate() {},

    render: function render() {
        return React.createElement(
            "div",
            { className: "wrapper" },
            React.createElement("div", { id: "reload_fullbg" }),
            React.createElement(
                "div",
                { id: "reload_icon" },
                React.createElement("i", { className: "icon-spinner icon-spin icon-4x" })
            ),
            React.createElement(
                "div",
                { className: "col-md-12" },
                React.createElement(
                    "div",
                    { className: "panel" },
                    React.createElement(
                        "div",
                        { className: "panel-heading row" },
                        React.createElement(
                            "span",
                            { className: "pull-left" },
                            React.createElement("i", { className: "icon-table" }),
                            "卡分配"
                        )
                    ),
                    React.createElement(
                        "div",
                        { className: "panel-body" },
                        React.createElement(SourceCardPool, { ref: "SourceCardPool",
                            pool_list: this.state.pool_list,
                            onReMoveBoxList: this.removeSourceBoxList,
                            onChangePool: this.onSourceCardPoolChange
                        }),
                        React.createElement(PendingBoxList, { ref: "PendingBoxList",
                            pool_list: this.state.pool_list,
                            onReMoveBoxList: this.removePendingBoxList,
                            selectSourceCardPool: this.selectSourceCardPool
                        })
                    )
                )
            )
        );
    }
});

var SourceCardPool = React.createClass({
    displayName: "SourceCardPool",

    selectSourceCardPool: function selectSourceCardPool(dest_pool) {
        //$("#selecte_source_pool").val(dest_pool);
        this.onChangePool();
    },

    getBoxList: function getBoxList(pool_name) {
        Showfullbg();
        $.ajax({
            url: _.str.sprintf('/admin/card_pool_list?card_type=%s&requ_type=%s&pool_name=%s', encodeURIComponent(CARD_TYPE), encodeURIComponent('get_box_list'), encodeURIComponent(pool_name)),
            type: 'get',
            dataType: 'json',

            success: (function (resp_data) {
                if (resp_data.status == 'ok') {
                    this.setState({
                        box_list: resp_data.data.box_list,
                        value_info: getValueInfo(resp_data.data.box_list)
                    });

                    Hidefullbg();
                } else {
                    Hidefullbg();
                    alert("读取盒号列表出错 " + resp_data.msg);
                }
            }).bind(this),

            error: (function (xhr, status, err) {
                Hidefullbg();
                alert("读取盒号列表异常 " + err.toString());
                console.error(this.props.url, status, err.toString());
            }).bind(this)
        });
    },

    onChangePool: function onChangePool() {
        var selected_pool = $("#selecte_source_pool").find("option:selected").val();
        this.getBoxList(selected_pool);
        this.props.onChangePool(selected_pool);
        this.refs.PoolHistory.getPoolHistory(selected_pool);
    },

    onRemoveBox: function onRemoveBox(box_id) {
        var box_list = this.state.box_list;
        var box_list2 = [];

        var remove_box = null;
        for (var i in box_list) {
            if (box_list[i].box_id == box_id) {
                remove_box = box_list[i];
            } else {
                box_list2.push(box_list[i]);
            }
        }

        this.props.onReMoveBoxList([remove_box]);

        this.setState({
            box_list: box_list2,
            value_info: getValueInfo(box_list2)
        });
    },

    removeALLBoxList: function removeALLBoxList() {
        this.props.onReMoveBoxList(this.state.box_list);
        this.setState({
            box_list: [],
            value_info: getValueInfo([])
        });
    },

    addBoxList: function addBoxList(box_list) {
        var b_list = this.state.box_list.concat(box_list);
        this.setState({
            box_list: b_list,
            value_info: getValueInfo(b_list)
        });
    },

    calcPageInfo: function calcPageInfo(page_index) {
        if (typeof page_index == "undefined" || page_index <= 0) {
            page_index = 1;
        }

        var count = this.state.box_list.length;
        var max_page = Number(Math.ceil(count / this.state.page_size));
        if (page_index > max_page) {
            page_index = max_page;
        }
        this.setState({ page_info: { page_index: page_index, max_page: max_page } });
    },

    getInitialState: function getInitialState() {
        return {
            box_list: [],
            value_info: "",
            page_info: {},
            page_size: 20
        };
    },

    componentDidMount: function componentDidMount() {},

    componentDidUpdate: function componentDidUpdate(prevProps, prevState) {
        if (this.props.pool_list != prevProps.pool_list) {
            this.onChangePool();
        }

        if (this.state.box_list != prevState.box_list) {
            this.calcPageInfo(this.state.page_info.page_index);
        }
    },

    render: function render() {
        var selectALLBtn = null;
        if (this.state.box_list.length > 0) {
            selectALLBtn = React.createElement(
                "a",
                { className: "btn btn-info", onClick: this.removeALLBoxList },
                "全选 ",
                React.createElement("i", { className: "icon-arrow-right" })
            );
            //var page_count = Math.ceil(this.state.box_list.length / 5);
            //console.log(page_count);
        }

        var poolListNodes = this.props.pool_list.map((function (pool_info, index) {
            return React.createElement(
                "option",
                { value: pool_info.pool_name },
                pool_info.pool_name
            );
        }).bind(this));

        //计算分页的开始和结束的下标
        var start_index = this.state.page_size * (this.state.page_info.page_index - 1);
        var end_index = start_index + this.state.page_size;

        //将会显示的下标
        var boxListNode = this.state.box_list.map((function (box_info, index) {
            if (index < start_index || index >= end_index) {
                return null;
            }

            return React.createElement(
                "tr",
                null,
                React.createElement(
                    "td",
                    null,
                    box_info.filename
                ),
                React.createElement(
                    "td",
                    null,
                    box_info["package"]
                ),
                React.createElement(
                    "td",
                    null,
                    box_info.box_id
                ),
                React.createElement(
                    "td",
                    null,
                    box_info.price
                ),
                React.createElement(
                    "td",
                    null,
                    box_info.create_time
                ),
                React.createElement(
                    "td",
                    null,
                    box_info.count
                ),
                React.createElement(
                    "td",
                    null,
                    box_info.ready
                ),
                React.createElement(
                    "td",
                    null,
                    box_info.inuse
                ),
                React.createElement(
                    "td",
                    null,
                    box_info.used
                ),
                React.createElement(
                    "td",
                    null,
                    box_info.error
                ),
                React.createElement(
                    "td",
                    null,
                    React.createElement("a", { href: "javascript:void(0);", className: "icon-arrow-right", onClick: this.onRemoveBox.bind(this, box_info.box_id) })
                )
            );
        }).bind(this));

        return React.createElement(
            "div",
            { className: "col-md-6" },
            React.createElement(
                "div",
                { className: "col-md-12" },
                React.createElement(
                    "div",
                    { className: "panel" },
                    React.createElement(
                        "div",
                        { className: "panel-heading row" },
                        React.createElement(
                            "span",
                            { className: "pull-left" },
                            React.createElement("i", { className: "icon-table" }),
                            "源卡池",
                            this.state.value_info
                        ),
                        React.createElement(
                            "select",
                            { className: "form-control", id: "selecte_source_pool", onChange: this.onChangePool },
                            poolListNodes
                        )
                    ),
                    React.createElement(PoolHistory, { ref: "PoolHistory" }),
                    React.createElement(
                        "div",
                        { className: "panel-body" },
                        React.createElement(
                            "span",
                            { className: "pull-right" },
                            selectALLBtn
                        ),
                        React.createElement(
                            "table",
                            { className: "table table-responsive table-striped table-hover" },
                            React.createElement(
                                "thead",
                                null,
                                React.createElement(
                                    "tr",
                                    null,
                                    React.createElement(
                                        "th",
                                        null,
                                        "文件名"
                                    ),
                                    React.createElement(
                                        "th",
                                        null,
                                        "箱号"
                                    ),
                                    React.createElement(
                                        "th",
                                        null,
                                        "盒号"
                                    ),
                                    React.createElement(
                                        "th",
                                        null,
                                        "面值"
                                    ),
                                    React.createElement(
                                        "th",
                                        null,
                                        "日期"
                                    ),
                                    React.createElement(
                                        "th",
                                        null,
                                        "总数"
                                    ),
                                    React.createElement(
                                        "th",
                                        null,
                                        "可用"
                                    ),
                                    React.createElement(
                                        "th",
                                        null,
                                        "在用"
                                    ),
                                    React.createElement(
                                        "th",
                                        null,
                                        "已用"
                                    ),
                                    React.createElement(
                                        "th",
                                        null,
                                        "错卡"
                                    ),
                                    React.createElement(
                                        "th",
                                        null,
                                        "操作"
                                    )
                                )
                            ),
                            React.createElement(
                                "tbody",
                                null,
                                boxListNode
                            )
                        ),
                        React.createElement(PageIndexGroup, { updatePage: this.calcPageInfo, page_info: this.state.page_info })
                    )
                )
            )
        );
    }
});

var PoolHistory = React.createClass({
    displayName: "PoolHistory",

    getPoolHistory: function getPoolHistory(pool_name) {
        Showfullbg();
        if (!pool_name) {
            return;
        }

        $.ajax({
            url: _.str.sprintf('/admin/card_pool_list?card_type=%s&requ_type=%s&pool_name=%s', encodeURIComponent(CARD_TYPE), encodeURIComponent('get_pool_history'), encodeURIComponent(pool_name)),
            type: 'get',
            dataType: 'json',

            success: (function (resp_data) {
                if (resp_data.status == 'ok') {
                    this.setState({ history_list: resp_data.data.history_list });
                    Hidefullbg();
                } else {
                    Hidefullbg();
                    alert("读取卡池历史出错 " + resp_data.msg);
                }
            }).bind(this),

            error: (function (xhr, status, err) {
                Hidefullbg();
                alert("读取卡池历史异常 " + err.toString());
                console.error(this.props.url, status, err.toString());
            }).bind(this)
        });
    },

    getInitialState: function getInitialState() {
        return { history_list: [] };
    },

    componentDidMount: function componentDidMount() {},

    render: function render() {
        var historyListNodes = this.state.history_list.map((function (history, index) {
            var h = history + "\n";
            return { h: h };
        }).bind(this));

        return React.createElement(
            "pre",
            { className: "col-md-12" },
            historyListNodes
        );
    }
});

var PendingBoxList = React.createClass({
    displayName: "PendingBoxList",

    onSourceCardPoolChange: function onSourceCardPoolChange(source_pool) {
        this.setState({ source_pool: source_pool });
        this.clearData();
    },

    resetBoxList: function resetBoxList() {
        this.props.onReMoveBoxList(this.state.box_list);

        this.clearData();
    },

    clearData: function clearData() {
        this.setState({
            box_list: [],
            value_info: getValueInfo([])
        });
    },

    onRemoveBox: function onRemoveBox(box_id) {
        var box_list = this.state.box_list;
        var box_list2 = [];

        var remove_box = null;
        for (var i in box_list) {
            if (box_list[i].box_id == box_id) {
                remove_box = box_list[i];
            } else {
                box_list2.push(box_list[i]);
            }
        }

        this.props.onReMoveBoxList([remove_box]);

        this.setState({
            box_list: box_list2,
            value_info: getValueInfo(box_list2)
        });
    },

    addBoxList: function addBoxList(box_list) {
        var b_list = this.state.box_list.concat(box_list);
        this.setState({
            box_list: b_list,
            value_info: getValueInfo(b_list)
        });
    },

    onDistribution: function onDistribution() {
        this.refs.ChooseDestPoolDlg.showDlg();
    },

    calcPageInfo: function calcPageInfo(page_index) {
        if (typeof page_index == "undefined" || page_index <= 0) {
            page_index = 1;
        }

        var count = this.state.box_list.length;
        var max_page = Number(Math.ceil(count / this.state.page_size));
        if (page_index > max_page) {
            page_index = max_page;
        }
        this.setState({ page_info: { page_index: page_index, max_page: max_page } });
    },

    getInitialState: function getInitialState() {
        return {
            source_pool: null,
            box_list: [],
            value_info: "",
            page_info: {},
            page_size: 20
        };
    },

    componentDidMount: function componentDidMount() {},

    componentDidUpdate: function componentDidUpdate(prevProps, prevState) {
        if (this.state.box_list != prevState.box_list) {
            this.calcPageInfo(this.state.page_info.page_index);
        }
    },

    render: function render() {
        //计算分页的开始和结束的下标
        var start_index = this.state.page_size * (this.state.page_info.page_index - 1);
        var end_index = start_index + this.state.page_size;

        //将会显示的下标
        var boxListNode = this.state.box_list.map((function (box_info, index) {
            console.info(box_info);
            if (index < start_index || index >= end_index) {
                return null;
            }
            return React.createElement(
                "tr",
                null,
                React.createElement(
                    "td",
                    null,
                    box_info.filename
                ),
                React.createElement(
                    "td",
                    null,
                    box_info["package"]
                ),
                React.createElement(
                    "td",
                    null,
                    box_info.box_id
                ),
                React.createElement(
                    "td",
                    null,
                    box_info.price
                ),
                React.createElement(
                    "td",
                    null,
                    box_info.create_time
                ),
                React.createElement(
                    "td",
                    null,
                    box_info.count
                ),
                React.createElement(
                    "td",
                    null,
                    box_info.ready
                ),
                React.createElement(
                    "td",
                    null,
                    box_info.inuse
                ),
                React.createElement(
                    "td",
                    null,
                    box_info.used
                ),
                React.createElement(
                    "td",
                    null,
                    box_info.error
                ),
                React.createElement(
                    "td",
                    null,
                    React.createElement("a", { href: "javascript:void(0);", className: "icon-remove", onClick: this.onRemoveBox.bind(this, box_info.box_id) })
                )
            );
        }).bind(this));

        var clearBtn = null;
        var distributionBtn = null;
        if (this.state.box_list.length > 0) {
            clearBtn = React.createElement(
                "a",
                { className: "btn btn-success", onClick: this.resetBoxList },
                "重置"
            );
            distributionBtn = React.createElement(
                "a",
                { className: "btn btn-danger", onClick: this.onDistribution },
                "分配"
            );
        }

        return React.createElement(
            "div",
            { className: "col-md-6" },
            React.createElement(
                "div",
                { className: "col-md-12" },
                React.createElement(
                    "div",
                    { className: "panel" },
                    React.createElement(
                        "div",
                        { className: "panel-heading row" },
                        React.createElement(
                            "span",
                            { className: "pull-left" },
                            React.createElement("i", { className: "icon-table" }),
                            "待分配列表",
                            this.state.value_info
                        ),
                        React.createElement(
                            "span",
                            { className: "pull-right" },
                            clearBtn,
                            distributionBtn
                        )
                    ),
                    React.createElement(
                        "div",
                        { className: "panel-body table-responsive" },
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
                                        "文件名"
                                    ),
                                    React.createElement(
                                        "th",
                                        null,
                                        "箱号"
                                    ),
                                    React.createElement(
                                        "th",
                                        null,
                                        "盒号"
                                    ),
                                    React.createElement(
                                        "th",
                                        null,
                                        "面值"
                                    ),
                                    React.createElement(
                                        "th",
                                        null,
                                        "日期"
                                    ),
                                    React.createElement(
                                        "th",
                                        null,
                                        "总数"
                                    ),
                                    React.createElement(
                                        "th",
                                        null,
                                        "可用"
                                    ),
                                    React.createElement(
                                        "th",
                                        null,
                                        "在用"
                                    ),
                                    React.createElement(
                                        "th",
                                        null,
                                        "已用"
                                    ),
                                    React.createElement(
                                        "th",
                                        null,
                                        "错卡"
                                    ),
                                    React.createElement(
                                        "th",
                                        null,
                                        "操作"
                                    )
                                )
                            ),
                            React.createElement(
                                "tbody",
                                null,
                                boxListNode
                            )
                        ),
                        React.createElement(PageIndexGroup, { updatePage: this.calcPageInfo, page_info: this.state.page_info })
                    )
                )
            ),
            React.createElement(ChooseDestPoolDlg, { ref: "ChooseDestPoolDlg",
                pool_list: this.props.pool_list,
                source_pool: this.state.source_pool,
                box_list: this.state.box_list,
                selectSourceCardPool: this.props.selectSourceCardPool
            })
        );
    }
});

//选择目的地卡池
var ChooseDestPoolDlg = React.createClass({
    displayName: "ChooseDestPoolDlg",

    onOk: function onOk() {
        var move_box_list = [];
        for (var i in this.props.box_list) {
            move_box_list.push(this.props.box_list[i].box_id);
        }

        var selected_pool = $("#select_dest_pool").find("option:selected").val();

        if (!selected_pool) {
            alert("目的池不能为空");
            return;
        }

        var requ_data = {
            requ_type: 'move_box_list',
            argu_list: {
                source_pool: this.props.source_pool,
                dest_pool: selected_pool,
                move_box_list: move_box_list
            }
        };
        $("#ChooseDestPoolDlg_OK").attr({ "disabled": "disabled" });
        $("#ChooseDestPoolDlg_CANCLE").attr({ "disabled": "disabled" });
        Showfullbg();
        $.ajax({
            url: _.str.sprintf('/admin/card_pool_list?card_type=%s', encodeURIComponent(CARD_TYPE)),
            type: 'post',
            dataType: 'json',
            data: JSON.stringify(requ_data),

            success: (function (resp_data) {
                if (resp_data.status == 'ok') {
                    this.props.selectSourceCardPool(selected_pool);
                    alert("操作成功");
                    this.hideDlg();
                } else {
                    alert("分配卡盒出错 " + resp_data.msg);
                }
            }).bind(this),

            error: (function (xhr, status, err) {
                alert("分配卡盒异常 " + err.toString());
                console.error(this.props.url, status, err.toString());
            }).bind(this),

            complete: (function () {
                $("#ChooseDestPoolDlg_OK").removeAttr("disabled");
                $("#ChooseDestPoolDlg_CANCLE").removeAttr("disabled");
            }).bind(this)
        });
    },

    showDlg: function showDlg() {
        $('#chooseDestPoolDlg').modal({ backdrop: 'static', keyboard: false });
    },

    hideDlg: function hideDlg() {
        Hidefullbg();
        $('#chooseDestPoolDlg').modal('hide');
    },

    getInitialState: function getInitialState() {
        return {};
    },

    componentDidMount: function componentDidMount() {},

    componentDidUpdate: function componentDidUpdate() {},

    render: function render() {
        var poolListNodes = this.props.pool_list.map((function (pool_info, index) {
            if (pool_info.pool_name != this.props.source_pool) {
                return React.createElement(
                    "option",
                    { value: pool_info.pool_name },
                    pool_info.pool_name
                );
            } else {
                return null;
            }
        }).bind(this));

        return React.createElement(
            "div",
            { className: "modal", id: "chooseDestPoolDlg", tabIndex: "-1", role: "dialog" },
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
                            "选择目的卡池"
                        )
                    ),
                    React.createElement(
                        "div",
                        { className: "modal-body form-horizontal" },
                        React.createElement(
                            "div",
                            { className: "form-group add-pro-body" },
                            React.createElement(
                                "div",
                                { className: "col-md-12" },
                                React.createElement(
                                    "select",
                                    { className: "form-control", id: "select_dest_pool" },
                                    poolListNodes
                                )
                            )
                        )
                    ),
                    React.createElement(
                        "div",
                        { className: "modal-footer form-horifooter" },
                        React.createElement(
                            "button",
                            { type: "button", className: "btn btn-danger", id: "ChooseDestPoolDlg_OK", onClick: this.onOk },
                            "选择"
                        ),
                        React.createElement(
                            "button",
                            { type: "button", className: "btn btn-default", id: "ChooseDestPoolDlg_CANCLE", "data-dismiss": "modal" },
                            "取消"
                        )
                    )
                )
            )
        );
    }
});

var PageIndexGroup = React.createClass({
    displayName: "PageIndexGroup",

    onClickPage: function onClickPage(page_index) {
        this.props.updatePage(page_index);
    },

    getInitialState: function getInitialState() {
        return {};
    },

    componentDidMount: function componentDidMount() {},

    componentDidUpdate: function componentDidUpdate(prevProps, prevState) {},

    render: function render() {
        if (this.props.page_info == null) {
            return null;
        }
        var page_index = this.props.page_info.page_index;
        var max_page = this.props.page_info.max_page;

        var page_start = page_index - 4 > 0 ? page_index - 4 : 1;
        var page_end = page_index + 4 > max_page ? max_page : page_index + 4;

        var page_index_list = [];
        for (var i = page_start; i <= page_end; ++i) {
            page_index_list.push(i);
        }

        var pageIndexBtnBodes = page_index_list.map((function (i, index) {
            var disabled = null;
            if (i == this.props.page_info.page_index) {
                disabled = "disabled";
            }
            return React.createElement(
                "button",
                { className: "btn btn-default", disabled: disabled, type: "button", onClick: this.onClickPage.bind(this, i) },
                i
            );
        }).bind(this));

        var fastBackwardDisabled = null;
        var backwardDisabled = null;
        if (page_index <= 1) {
            fastBackwardDisabled = "disabled";
            backwardDisabled = "disabled";
        }

        var forwardDisabled = null;
        var fastForwardDisabled = null;
        if (page_index >= max_page) {
            forwardDisabled = "disabled";
            fastForwardDisabled = "disabled";
        }

        return React.createElement(
            "div",
            { className: "row" },
            React.createElement(
                "div",
                { className: "col-sm-12" },
                React.createElement(
                    "div",
                    { className: "btn-row dataTables_filter" },
                    React.createElement(
                        "div",
                        { id: "page_group", className: "btn-group" },
                        React.createElement(
                            "button",
                            { className: "btn btn-default", type: "button", disabled: fastBackwardDisabled, onClick: this.onClickPage.bind(this, 1) },
                            React.createElement("i", { className: "icon-fast-backward" })
                        ),
                        React.createElement(
                            "button",
                            { className: "btn btn-default", type: "button", disabled: backwardDisabled, onClick: this.onClickPage.bind(this, page_index - 1) },
                            React.createElement("i", { className: "icon-backward" })
                        ),
                        pageIndexBtnBodes,
                        React.createElement(
                            "button",
                            { className: "btn btn-default", type: "button", disabled: forwardDisabled, onClick: this.onClickPage.bind(this, page_index + 1) },
                            React.createElement("i", { className: "icon-forward" })
                        ),
                        React.createElement(
                            "button",
                            { className: "btn btn-default", type: "button", disabled: fastForwardDisabled, onClick: this.onClickPage.bind(this, max_page) },
                            React.createElement("i", { className: "icon-fast-forward" })
                        )
                    )
                )
            )
        );
    }
});

React.render(React.createElement(MainContent, null), document.getElementById('main-content'));

