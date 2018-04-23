"use strict";

function getQueryStringByName(name) {

    var result = location.search.match(new RegExp("[\?\&]" + name + "=([^\&]+)", "i"));

    if (result == null || result.length < 1) {

        return "";
    }

    return result[1];
}

var CARD_TYPE = getQueryStringByName('card_type');
var UploadPanel = React.createClass({
    displayName: "UploadPanel",

    getInitialState: function getInitialState() {
        return {
            pending_list: []
        };
    },

    doRefresh: function doRefresh() {
        $('#pendingbtn,#pendinglist').addClass('hide');
        $.ajax({
            url: '/card/import/list?card_type=' + CARD_TYPE,
            dataType: 'json',
            type: 'get',
            success: (function (data) {
                this.setState({ pending_list: data });
                $('input:radio[value!="common"]').attr('checked', 'true');
            }).bind(this),

            error: (function (xhr, status, err) {
                alert("ERR " + err);
            }).bind(this)
        });
    },

    componentDidMount: function componentDidMount() {
        //this.doStreamInfo();
        this.doRefresh();
    },

    doRest: function doRest() {
        $.ajax({
            url: '/card/import/reset?card_type=' + CARD_TYPE,
            dataType: 'json',
            type: 'post',
            success: (function (data) {
                this.doRefresh();
            }).bind(this),

            error: (function (xhr, status, err) {
                alert("ERR " + err);
            }).bind(this)
        });
    },

    doReload: function doReload() {
        if (!confirm("是否需要重新装载号码重复检测器？\n(一般用于手工清理卡之后)")) {
            return;
        }

        $.ajax({
            url: '/card/import/reload?card_type=' + CARD_TYPE,
            dataType: 'json',
            type: 'post',
            success: (function (data) {
                alert(data.msg);
                if (data.status == 'ok') {
                    this.doRefresh();
                }
            }).bind(this),

            error: (function (xhr, status, err) {
                alert("ERR " + err);
            }).bind(this)
        });
    },

    doCommitFiles: function doCommitFiles() {
        $('#commit-btn').attr('disabled', 'true');
        $.ajax({
            url: '/card/import/commit?card_type=' + CARD_TYPE,
            dataType: 'json',
            type: 'post',
            success: (function (data) {
                this.doRefresh();
                if (data.status != 'ok') {
                    alert(data.msg);
                }
                alert("提交成功!");
                $('#commit-btn').removeAttr('disabled');
            }).bind(this),

            error: (function (xhr, status, err) {
                alert("ERR " + err);
                $('#commit-btn').removeAttr('disabled');
            }).bind(this)
        });
    },

    render: function render() {
        var pending_list = this.state.pending_list;

        return React.createElement(
            "div",
            { className: "form-horizontal" },
            React.createElement(OperationPanel, { refresh: this.doRefresh }),
            React.createElement(PendingList, { pending_list: pending_list }),
            React.createElement(
                "div",
                { id: "pendingbtn", className: "form-group" },
                React.createElement(
                    "div",
                    { className: "col-md-offset-2 col-md-8" },
                    React.createElement(
                        "a",
                        { id: "commit-btn", className: "btn btn-danger", href: "#", onClick: this.doCommitFiles },
                        "提交"
                    )
                ),
                React.createElement(
                    "div",
                    { className: "col-md-2" },
                    React.createElement(
                        "a",
                        { className: "btn btn-info m-right5", href: "#", onClick: this.doRest },
                        "重置"
                    ),
                    React.createElement(
                        "a",
                        { className: "btn btn-primary", href: "#", onClick: this.doReload, title: "重新装载卡号重复检测器" },
                        "刷新"
                    )
                )
            )
        );
    }
});

var OperationPanel = React.createClass({
    displayName: "OperationPanel",

    getInitialState: function getInitialState() {
        return {
            price: '0',
            //buy_price: '',
            //sell_price: '',
            source: [],
            downstream: [],
            pool_list: []
        };
    },

    setPrice: function setPrice(price) {
        this.setState({ price: price });
    },

    getPoolList: function getPoolList() {
        $.ajax({
            url: _.str.sprintf('/admin/card_pool_list?card_type=%s&requ_type=%s', encodeURIComponent(CARD_TYPE), encodeURIComponent('get_pool_list')),
            type: 'get',
            dataType: 'json',

            success: (function (resp_data) {
                if (resp_data.status == 'ok') {
                    if (resp_data.data.pool_list.length <= 0) {
                        alert("卡池!!!!!!!!!!!");
                        window.location.replace("/admin/card_pool_list?card_type=" + CARD_TYPE);
                        return;
                    }

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

    doStreamInfo: function doStreamInfo() {
        $.ajax({
            url: '/card/import/stream?card_type=' + CARD_TYPE,
            dataType: 'json',
            type: 'get',
            success: (function (data) {
                var new_value = {
                    source: data['source'],
                    downstream: data['downstream']
                };
                this.setState(new_value);

                $('#buy_price').val(data['source'][0]['discount'] / 100);
                $('#sell_price').val(data['downstream'][0]['discount'] / 100);
            }).bind(this)
        });
    },

    onChangeSource: function onChangeSource() {
        var current_src = $("#source").val();

        for (var i = 0; i < this.state.source.length; i++) {
            if (this.state.source[i].source_id == current_src) {
                $('#buy_price').val(this.state.source[i]['discount'] / 100);
                break;
            }
        }
    },

    onChangeUser: function onChangeUser() {
        var current_user = $("#user_id").val();

        for (var i = 0; i < this.state.downstream.length; i++) {
            if (this.state.downstream[i].user_id == current_user) {
                $('#sell_price').val(this.state.downstream[i]['discount'] / 100);
                break;
            }
        }
    },

    componentDidMount: function componentDidMount() {
        var url = '/card/import/upload?card_type=' + CARD_TYPE;

        $('#fileupload').fileupload({
            url: url,
            dataType: 'json',

            submit: (function (e, data) {
                //alert(this.state.price);
                if (get_price_list().indexOf(this.state.price) == -1) {
                    alert('请先选择一种面值');
                    return false;
                }

                var card_pool = $('input:radio[name="RadioOptions"]:checked').val();
                if (this.state.pool_list.length > 2) {
                    card_pool = $('#up_pool').val();
                }

                data.formData = {
                    price: this.state.price,
                    notes: $('#notes').val(),
                    user_id: $('#user_id').val(),
                    source_id: $('#source').val(),
                    buy_price: $('#buy_price').val(),
                    sell_price: $('#sell_price').val(),
                    package_no: $('#package_no').val(),
                    card_type: CARD_TYPE,
                    card_pool: card_pool
                };
            }).bind(this),

            change: (function (e, data) {
                //alert(this.state);
                //$.each(data.files, function (index, file) {
                //    $("#filename").text(file.name);
                //});
            }).bind(this),

            done: (function (e, data) {
                if (data.result['status'] != 'ok') {
                    alert(data.result['msg']);
                }
                this.props.refresh();
                $('#pendingbtn,#pendinglist').removeClass('hide');
            }).bind(this)
        });

        this.getPoolList();
    },

    render: function render() {
        var current = this.state.price;

        var priceGroup = get_price_list().map((function (p, i) {
            var name = "m-bot15 btn btn-default";
            if (p == current) {
                name = 'm-bot15 btn btn-danger';
            }

            return React.createElement(
                "a",
                { href: "javascript:void(0);", className: name, onClick: this.setPrice.bind(this, p) },
                p
            );
        }).bind(this));

        var poolListNodes = this.state.pool_list.map(function (pool_info, i) {
            return React.createElement(
                "label",
                { className: "radio-inline m-right10" },
                React.createElement("input", { type: "radio", name: "RadioOptions", value: pool_info.pool_name }),
                React.createElement(
                    "b",
                    null,
                    pool_info.display_name || pool_info.pool_name,
                    " (",
                    pool_info.pool_name,
                    ")"
                )
            );
        });

        var upPoolNode = React.createElement(
            "div",
            { className: "row m-bot10" },
            React.createElement(
                "label",
                { className: "col-sm-2 col-md-3 control-label" },
                "指定卡池"
            ),
            React.createElement(
                "div",
                { className: "col-sm-8 col-md-8 m-bot10" },
                poolListNodes
            )
        );

        if (this.state.pool_list.length > 2) {
            poolListNodes = this.state.pool_list.map(function (pool_info, i) {
                return React.createElement(
                    "option",
                    { value: pool_info.pool_name },
                    pool_info.display_name || pool_info.pool_name,
                    " (",
                    pool_info.pool_name,
                    ")"
                );
            });

            upPoolNode = React.createElement(
                "div",
                { className: "row m-bot15" },
                React.createElement(
                    "label",
                    { className: "col-sm-2 col-md-3 control-label" },
                    "指定卡池"
                ),
                React.createElement(
                    "div",
                    { className: "col-sm-6 col-md-4" },
                    React.createElement(
                        "select",
                        { id: "up_pool", className: "form-control m-bot15" },
                        poolListNodes
                    )
                )
            );
        }

        return React.createElement(
            "div",
            { className: "col-md-8 col-md-offset-1" },
            React.createElement(
                "div",
                { className: "row m-bot15" },
                React.createElement(
                    "label",
                    { className: "col-sm-2 col-md-3 control-label" },
                    "批次号"
                ),
                React.createElement(
                    "div",
                    { className: "col-sm-6 col-md-4" },
                    React.createElement("input", { id: "package_no", className: "form-control", type: "text" })
                )
            ),
            React.createElement(
                "div",
                { className: "row" },
                React.createElement(
                    "label",
                    { className: "col-sm-2 col-md-3 control-label" },
                    "面值"
                ),
                React.createElement(
                    "div",
                    { id: "price-group", className: "col-md-9 btn-group", role: "group", "aria-label": "" },
                    priceGroup
                )
            ),
            React.createElement(
                "div",
                { className: "row m-bot15" },
                React.createElement(
                    "label",
                    { className: "col-sm-2 col-md-3 control-label" },
                    "进货价格"
                ),
                React.createElement(
                    "div",
                    { className: "col-sm-6 col-md-4" },
                    React.createElement("input", { id: "buy_price", className: "form-control", type: "text" })
                ),
                React.createElement(
                    "label",
                    { className: "col-sm-3 col-md-2 control-label text-danger" },
                    "单张卡进货价格"
                )
            ),
            React.createElement(
                "div",
                { className: "row m-bot15" },
                React.createElement(
                    "label",
                    { className: "col-sm-2 col-md-3 control-label" },
                    "供货价格"
                ),
                React.createElement(
                    "div",
                    { className: "col-sm-6 col-md-4" },
                    React.createElement("input", { id: "sell_price", className: "form-control", type: "text" })
                ),
                React.createElement(
                    "label",
                    { className: "col-sm-3 col-md-2 control-label text-danger" },
                    "单张卡供货价格"
                )
            ),
            upPoolNode,
            React.createElement(
                "div",
                { className: "row m-bot15" },
                React.createElement(
                    "label",
                    { className: "col-sm-2 col-md-3 control-label" },
                    "备注"
                ),
                React.createElement(
                    "div",
                    { className: "col-sm-6 col-md-4" },
                    React.createElement("input", { id: "notes", className: "form-control", type: "text" })
                )
            ),
            React.createElement(
                "div",
                { className: "row" },
                React.createElement(
                    "div",
                    { className: "col-sm-8 col-sm-offset-3 col-md-4" },
                    React.createElement(
                        "span",
                        { className: "btn btn-info fileinput-button" },
                        React.createElement("i", { className: "icon-check" }),
                        React.createElement(
                            "span",
                            { id: "filename" },
                            "上传卡密文件"
                        ),
                        React.createElement("input", { id: "fileupload", name: "card_file", multiple: "true", type: "file" })
                    )
                )
            )
        );
    }
});

var PendingList = React.createClass({
    displayName: "PendingList",

    render: function render() {

        var pendingRows = this.props.pending_list.map(function (pending, i) {
            return React.createElement(
                "tr",
                null,
                React.createElement(
                    "td",
                    null,
                    pending.package_no
                ),
                React.createElement(
                    "td",
                    null,
                    pending.filename
                ),
                React.createElement(
                    "td",
                    null,
                    pending.status
                ),
                React.createElement(
                    "td",
                    null,
                    pending.msg
                ),
                React.createElement(
                    "td",
                    null,
                    pending.price
                ),
                React.createElement(
                    "td",
                    null,
                    pending.count
                ),
                React.createElement(
                    "td",
                    null,
                    pending.card_pool
                ),
                React.createElement(
                    "td",
                    null,
                    pending.user_id
                ),
                React.createElement(
                    "td",
                    null,
                    pending.buy_price
                ),
                React.createElement(
                    "td",
                    null,
                    pending.sell_price
                ),
                React.createElement(
                    "td",
                    null,
                    pending.notes
                )
            );
        });

        return React.createElement(
            "div",
            { id: "pendinglist", className: "form-group table-responsive" },
            React.createElement(
                "table",
                { className: "table table-hover" },
                React.createElement(
                    "thead",
                    null,
                    React.createElement(
                        "tr",
                        null,
                        React.createElement(
                            "th",
                            null,
                            "箱号"
                        ),
                        React.createElement(
                            "th",
                            null,
                            "文件名"
                        ),
                        React.createElement(
                            "th",
                            null,
                            "状态"
                        ),
                        React.createElement(
                            "th",
                            null,
                            "状态信息"
                        ),
                        React.createElement(
                            "th",
                            null,
                            "面值"
                        ),
                        React.createElement(
                            "th",
                            null,
                            "数量"
                        ),
                        React.createElement(
                            "th",
                            null,
                            "卡池"
                        ),
                        React.createElement(
                            "th",
                            null,
                            "用户ID"
                        ),
                        React.createElement(
                            "th",
                            null,
                            "进货价格"
                        ),
                        React.createElement(
                            "th",
                            null,
                            "出货价格"
                        ),
                        React.createElement(
                            "th",
                            null,
                            "备注"
                        )
                    )
                ),
                React.createElement(
                    "tbody",
                    null,
                    pendingRows
                )
            )
        );
    }
});

React.render(React.createElement(UploadPanel, null), document.getElementById('content'));

