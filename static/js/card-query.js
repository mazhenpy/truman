"use strict";

function getQueryStringByName(name) {
    var result = location.search.match(new RegExp("[\?\&]" + name + "=([^\&]+)", "i"));
    if (result == null || result.length < 1) {

        return "";
    }
    return result[1];
}

var CARD_TYPE = getQueryStringByName('card_type');
var QueryPanel = React.createClass({
    displayName: "QueryPanel",

    getInitialState: function getInitialState() {
        return {
            query_box: false,
            query_data: {
                status: '',
                price: '',
                page: 1,
                size: 16
            },
            query_card_data: {
                box: 0,
                status: '',
                page: 1,
                size: 20

            },
            box_data: { data: [] },
            package_data: { data: [] },
            card_data: { data: [] },
            box_info: {}
        };
    },

    onChangeQueryType: function onChangeQueryType(type) {
        this.setState({ query_box: type });
    },

    onQuery: function onQuery(query_data) {
        //alert(query_data);
        query_data.page = 1;
        query_data.size = 16;

        if (this.state.query_box) {
            this.doQueryPackage(query_data);
        } else {
            this.doQueryBox(query_data);
        }
    },

    onPage: function onPage(page) {
        //alert(page);
        var query_data = this.state.query_data;
        query_data.page = page;

        if (this.state.query_box) {
            this.doQueryPackage(query_data);
        } else {
            this.doQueryBox(query_data);
        }
    },

    doQueryPackage: function doQueryPackage(query_data) {
        query_data.card_type = CARD_TYPE;
        $.ajax({
            url: '/card/query/package',
            dataType: 'json',
            type: 'post',
            data: JSON.stringify(query_data),

            success: (function (data) {
                this.setState({ query_data: query_data, package_data: data });
            }).bind(this),

            error: (function (xhr, status, err) {
                alert("ERR " + err);
            }).bind(this)
        });
    },

    doQueryBox: function doQueryBox(query_data) {
        query_data.card_type = CARD_TYPE;
        $.ajax({
            url: '/card/query/box',
            dataType: 'json',
            type: 'post',
            data: JSON.stringify(query_data),

            success: (function (data) {
                //alert(JSON.stringify(data));
                this.setState({ query_data: query_data, box_data: data });
            }).bind(this),

            error: (function (xhr, status, err) {
                alert("ERR " + err);
            }).bind(this)
        });
    },

    onQueryCard: function onQueryCard(requ_type, box_info, status, page) {
        var box_id = box_info.box_id;
        var query_data = this.state.query_card_data;
        if (box_id) query_data.box = box_id;
        if (status) query_data.status = status;
        if (page) query_data.page = page;
        if (!requ_type) requ_type = 'query';
        query_data.requ_type = requ_type;

        $.ajax({
            url: '/card/query/card',
            dataType: 'json',
            type: 'post',
            data: JSON.stringify(query_data),

            success: (function (resp_data) {
                if (requ_type == 'query') {
                    this.setState({ box_info: box_info, query_card_data: query_data, card_data: resp_data });
                } else if (requ_type == 'export') {
                    var path = resp_data.path;
                    if (path) {
                        this.setState({ box_info: box_info, query_card_data: query_data });
                        window.location.assign(path);
                    } else {
                        alert("数据查询失败!!!");
                    }
                }
            }).bind(this),

            error: (function (xhr, status, err) {
                alert("ERR " + err);
            }).bind(this)
        });
    },

    onModifyCard: function onModifyCard() {
        var box_id = $('#box_id').val();
        var card_id = $('#card_id').val();
        var password = $('#password').val().replace(/[^\w\.\/]/ig, '');
        var no_modify = $('#no_modify').prop('checked');

        if (box_id == '' || card_id == '') {
            alert('请输入');
            return;
        }

        if (!no_modify) {
            if (CARD_TYPE == 'CMCC_FEE') {
                var password_table = /^\d{18}$/g;
                if (!password_table.test(password)) {
                    alert('输入有误,密码必须是18位数字!!!');
                    return;
                }
            } else if (CARD_TYPE == 'SINOPEC') {
                password_table = /^\d{20}$/g;
                if (!password_table.test(password)) {
                    alert('输入有误,密码必须是20位数字!!!');
                    return;
                }
            }
        }

        var request = {
            box_id: box_id,
            card_id: card_id,
            password: password,
            no_modify: no_modify
        };

        console.info(request);

        $.ajax({
            url: '/card/modify',
            dataType: 'json',
            type: 'post',
            data: JSON.stringify(request),
            success: (function (resp) {
                if (resp.status == 'ok') {
                    alert("修正成功");
                    $('#myModal').modal('hide');
                    this.onQueryCard('query', this.state.box_info);
                } else {
                    alert("修正失败!!!\n" + resp.msg);
                }
            }).bind(this),

            fail: function fail(data) {
                alert('error');
            }
        });
    },

    onCardMaintain: function onCardMaintain(operation, type, id) {
        if (!window.confirm("确认进行此项操作吗?")) {
            return;
        }

        var request_data = {
            "requ_type": operation,
            "argu_list": {
                "type": type,
                "id": id
            }
        };

        $.ajax({
            url: '/api/card/maintain',
            dataType: 'json',
            type: 'post',
            data: JSON.stringify(request_data),

            success: (function (data) {
                if (data.status == "ok") {
                    alert('操作成功');
                    this.onQuery(this.state.query_data);
                } else {
                    alert('操作失败 - ' + data.msg);
                }
            }).bind(this),

            error: (function (xhr, status, err) {
                alert("ERR " + err);
            }).bind(this)
        });
    },

    onExportErrorCards: function onExportErrorCards() {
        var request_data = {};

        $.ajax({
            url: '/api/card/export_error_cards',
            dataType: 'json',
            type: 'post',
            data: JSON.stringify(request_data),

            success: (function (data) {
                //alert(JSON.stringify(data));
                if (data.status == "ok") {
                    window.location.assign('/' + data.data);
                } else {
                    alert('操作失败 - ' + data.msg);
                }
            }).bind(this),

            error: (function (xhr, status, err) {
                alert("ERR " + err);
            }).bind(this)
        });
    },

    render: function render() {
        var fullNode = null;
        if (this.state.query_box) {
            fullNode = React.createElement(
                "div",
                { className: "row" },
                React.createElement(
                    "div",
                    { className: "col-md-12 col-lg-6" },
                    React.createElement(OperationPanel, { onchange: this.onChangeQueryType, doQuery: this.onQuery,
                        query_box: this.state.query_box }),
                    React.createElement(PackageResultPanel, { onpage: this.onPage, package_data: this.state.package_data })
                )
            );
        } else {
            fullNode = React.createElement(
                "div",
                { className: "row" },
                React.createElement(
                    "div",
                    { className: "col-md-12 col-lg-6" },
                    React.createElement(OperationPanel, { onchange: this.onChangeQueryType, doQuery: this.onQuery,
                        query_box: this.state.query_box, onExportErrorCards: this.onExportErrorCards }),
                    React.createElement(BoxResultPanel, { onpage: this.onPage, oncard: this.onQueryCard, box_data: this.state.box_data,
                        onCardMaintain: this.onCardMaintain
                    })
                ),
                React.createElement(
                    "div",
                    { className: "col-md-12 col-lg-6" },
                    React.createElement(CardResultPanel, { oncard: this.onQueryCard,
                        card_data: this.state.card_data,
                        query: this.state.query_card_data,
                        box_info: this.state.box_info
                    })
                )
            );
        }

        return React.createElement(
            "section",
            { id: "content", className: "wrapper" },
            fullNode,
            React.createElement(
                "div",
                { className: "modal fade", id: "myModal", tabindex: "-1", role: "dialog", "aria-labelledby": "myModalLabel",
                    "aria-hidden": "true" },
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
                                "button",
                                { type: "button", className: "close", "data-dismiss": "modal", "aria-label": "Close" },
                                React.createElement(
                                    "span",
                                    { "aria-hidden": "true" },
                                    "×"
                                )
                            ),
                            React.createElement(
                                "h4",
                                { className: "modal-title", id: "myModalLabel" },
                                "修改卡密"
                            )
                        ),
                        React.createElement(
                            "div",
                            { className: "modal-body" },
                            React.createElement(
                                "div",
                                { className: "form-group" },
                                React.createElement(
                                    "label",
                                    { className: "col-md-3 control-label" },
                                    "盒号"
                                ),
                                React.createElement(
                                    "div",
                                    { className: "col-md-9" },
                                    React.createElement("input", { id: "box_id", type: "text", readOnly: "true",
                                        className: "m-bot15 form-control input-sm" })
                                ),
                                React.createElement(
                                    "label",
                                    { className: "col-md-3 control-label" },
                                    "卡号"
                                ),
                                React.createElement(
                                    "div",
                                    { className: "col-md-9" },
                                    React.createElement("input", { id: "card_id", type: "text", readOnly: "true",
                                        className: "m-bot15 form-control input-sm" })
                                ),
                                React.createElement(
                                    "label",
                                    { className: "col-md-3 control-label" },
                                    "新的卡密"
                                ),
                                React.createElement(
                                    "div",
                                    { className: "col-md-9" },
                                    React.createElement("input", { id: "password", type: "text", className: "m-bot15 form-control input-sm" })
                                ),
                                React.createElement(
                                    "div",
                                    { className: "col-md-offset-3 col-md-9" },
                                    React.createElement(
                                        "div",
                                        { className: "checkbox" },
                                        React.createElement(
                                            "label",
                                            null,
                                            React.createElement("input", { type: "checkbox", id: "no_modify" }),
                                            "不修改密码，直接设置为可用"
                                        )
                                    )
                                )
                            )
                        ),
                        React.createElement(
                            "div",
                            { className: "modal-footer" },
                            React.createElement(
                                "a",
                                { href: "javascript:void(0);", className: "btn btn-default", "data-dismiss": "modal" },
                                "关闭"
                            ),
                            React.createElement(
                                "a",
                                { href: "javascript:void(0);", onClick: this.onModifyCard,
                                    className: "btn btn-danger" },
                                "修改"
                            )
                        )
                    )
                )
            )
        );
    }
});

var OperationPanel = React.createClass({
    displayName: "OperationPanel",

    onQuery: function onQuery() {
        var query_data = {
            start: $('#form_range_start').val(),
            end: $('#form_range_end').val(),
            status: $('#form_status').val(),
            price: $('#form_price').val(),
            "package": $('#form_package').val(),
            card_id: $('#form_card_id').val()
        };

        this.props.doQuery(query_data);
    },

    onChangeType: function onChangeType() {
        var type = $("#query-type").prop('checked');
        console.info(type);
        this.props.onchange(type);
    },

    componentDidMount: function componentDidMount() {
        var range = $('#form_range');
        range.daterangepicker({
            ranges: {
                '今天': [moment().startOf('days'), moment().startOf('days').add('days', 1)],
                '昨天': [moment().startOf('days').subtract('days', 1), moment().startOf('days')],
                '最近7天': [moment().startOf('days').subtract('days', 6), moment().startOf('days').add('days', 1)],
                '最近30天': [moment().startOf('days').subtract('days', 29), moment().startOf('days').add('days', 1)],
                '本月': [moment().startOf('month'), moment().startOf('month').add('month', 1)],
                '上月': [moment().subtract('month', 1).startOf('month'), moment().startOf('month')]
            },
            opens: 'left',
            format: 'YYYY/MM/DD HH:mm:ss',
            separator: ' - ',
            startDate: moment().add('days', -29),
            endDate: moment(),
            minDate: '2014/01/01',
            maxDate: '2025/12/31',
            timePicker: true,
            timePickerIncrement: 10,
            timePicker12Hour: false,
            locale: {
                applyLabel: '确认',
                fromLabel: '从',
                toLabel: '至',
                customRangeLabel: '自定义',
                daysOfWeek: ['日', '一', '二', '三', '四', '五', '六'],
                monthNames: ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'],
                firstDay: 1
            },
            showWeekNumbers: false
        }, function (start, end) {
            $('#form_range_start').val(moment(start).format('YYYY/MM/DD HH:mm:ss'));
            $('#form_range_end').val(moment(end).format('YYYY/MM/DD HH:mm:ss'));
        });

        // init
        var startDate = moment().startOf('days').add('days', -7);
        var endDate = moment().startOf('days').add('days', 1);

        range.data('daterangepicker').setStartDate(startDate);
        range.data('daterangepicker').setEndDate(endDate);

        $('#form_range_start').val(startDate.format('YYYY/MM/DD HH:mm:ss'));
        $('#form_range_end').val(endDate.format('YYYY/MM/DD HH:mm:ss'));
    },

    render: function render() {
        var priceGroup = get_price_list().map((function (p, i) {
            return React.createElement(
                "option",
                { value: p },
                p
            );
        }).bind(this));

        return React.createElement(
            "section",
            { className: "panel" },
            React.createElement(
                "div",
                { className: "panel-body" },
                React.createElement(
                    "form",
                    { className: "form-horizontal", method: "get" },
                    React.createElement(
                        "div",
                        { className: "form-group" },
                        React.createElement(
                            "label",
                            { className: "col-md-2 control-label" },
                            "入库时间"
                        ),
                        React.createElement(
                            "div",
                            { className: "col-md-10 m-bot15" },
                            React.createElement("input", { id: "form_range", type: "text", className: "form-control input-sm" }),
                            React.createElement("input", { id: "form_range_start", type: "hidden" }),
                            React.createElement("input", { id: "form_range_end", type: "hidden" })
                        ),
                        React.createElement(
                            "label",
                            { className: "col-md-2 control-label" },
                            "箱号"
                        ),
                        React.createElement(
                            "div",
                            { className: "col-md-4 m-bot15" },
                            React.createElement("input", { id: "form_package", type: "text", className: "form-control input-sm" })
                        ),
                        React.createElement(
                            "label",
                            { className: "col-md-2 control-label" },
                            "卡号"
                        ),
                        React.createElement(
                            "div",
                            { className: "col-md-4 m-bot15" },
                            React.createElement("input", { id: "form_card_id", type: "text", className: "form-control input-sm" })
                        ),
                        React.createElement(
                            "label",
                            { className: "col-md-2 control-label" },
                            "状态"
                        ),
                        React.createElement(
                            "div",
                            { className: "col-md-4" },
                            React.createElement(
                                "select",
                                { id: "form_status", className: "form-control m-bot15 input-sm" },
                                React.createElement(
                                    "option",
                                    { value: "ready" },
                                    "在用"
                                ),
                                React.createElement(
                                    "option",
                                    { value: "archived" },
                                    "归档"
                                ),
                                React.createElement(
                                    "option",
                                    { value: "frozen" },
                                    "冻结"
                                ),
                                React.createElement(
                                    "option",
                                    { value: "removed" },
                                    "已删除"
                                ),
                                React.createElement(
                                    "option",
                                    { value: "" },
                                    "全部"
                                )
                            )
                        ),
                        React.createElement(
                            "label",
                            { className: "col-md-2 control-label" },
                            "面值"
                        ),
                        React.createElement(
                            "div",
                            { className: "col-md-4" },
                            React.createElement(
                                "select",
                                { id: "form_price", className: "form-control m-bot15 input-sm" },
                                React.createElement(
                                    "option",
                                    { value: "" },
                                    "全部"
                                ),
                                priceGroup
                            )
                        ),
                        React.createElement(
                            "label",
                            { className: "col-md-2 control-label" },
                            "查询方式"
                        ),
                        React.createElement(
                            "div",
                            { className: "col-md-4 m-bot15 checkbox" },
                            React.createElement(
                                "label",
                                null,
                                React.createElement("input", { id: "query-type", type: "checkbox", onClick: this.onChangeType,
                                    checked: this.props.query_box }),
                                "按箱"
                            )
                        ),
                        React.createElement(
                            "div",
                            { className: "col-md-2" },
                            React.createElement(
                                "a",
                                { id: "act_query", href: "javascript:void(0);", className: "btn btn-danger",
                                    onClick: this.onQuery },
                                React.createElement("i", { className: "icon-search" }),
                                "查询"
                            )
                        ),
                        React.createElement(
                            "div",
                            { className: "col-md-2" },
                            React.createElement(
                                "a",
                                { id: "act_export_error", href: "javascript:void(0);", className: "btn btn-danger",
                                    onClick: this.props.onExportErrorCards },
                                React.createElement("i", { className: "icon-search" }),
                                "导出所有错卡"
                            )
                        )
                    )
                )
            )
        );
    }
});

var BoxResultPanel = React.createClass({
    displayName: "BoxResultPanel",

    getBoxStatusStr: function getBoxStatusStr(status) {
        var box_status_map = {
            'ready': '在用',
            'frozen': '冻结',
            'removed': '已删除',
            'archived': '归档'
        };
        return box_status_map[status];
    },

    onPage: function onPage(i) {
        this.props.onpage(i);
    },

    onCard: function onCard(box_info, opr) {
        this.props.oncard('query', box_info, 'error', undefined);
    },

    onCardMaintain: function onCardMaintain(operation, type, id) {
        this.props.onCardMaintain(operation, type, id);
    },

    render: function render() {

        var box_rows = this.props.box_data.data.map((function (box, i) {
            var query_error_card_btn = React.createElement(
                "button",
                { className: "btn btn-default btn-xs", onClick: this.onCard.bind(this, box) },
                "查错卡"
            );

            var freeze_btn = null;
            if (box.status == 'ready' && box.used < box.count) {
                freeze_btn = React.createElement(
                    "button",
                    { className: "btn btn-default btn-xs",
                        onClick: this.onCardMaintain.bind(this, 'freeze', 'box_id', box.box_id) },
                    "冻结"
                );
            } else if (box.status == 'frozen') {
                freeze_btn = React.createElement(
                    "button",
                    { className: "btn btn-default btn-xs",
                        onClick: this.onCardMaintain.bind(this, 'unfreeze', 'box_id', box.box_id) },
                    "解冻"
                );
            }

            var remove_btn = null;
            if (box.status == 'frozen' && box.count == box.ready) {
                remove_btn = React.createElement(
                    "button",
                    { className: "btn btn-default btn-xs",
                        onClick: this.onCardMaintain.bind(this, 'remove', 'box_id', box.box_id) },
                    "删除"
                );
            }

            return React.createElement(
                "tr",
                null,
                React.createElement(
                    "td",
                    null,
                    box.package_id
                ),
                React.createElement(
                    "td",
                    null,
                    box.price
                ),
                React.createElement(
                    "td",
                    null,
                    box.filename
                ),
                React.createElement(
                    "td",
                    null,
                    box.create_time
                ),
                React.createElement(
                    "td",
                    null,
                    box.count
                ),
                React.createElement(
                    "td",
                    null,
                    box.ready
                ),
                React.createElement(
                    "td",
                    null,
                    box.inuse
                ),
                React.createElement(
                    "td",
                    null,
                    box.used
                ),
                React.createElement(
                    "td",
                    null,
                    box.error
                ),
                React.createElement(
                    "td",
                    null,
                    this.getBoxStatusStr(box.status)
                ),
                React.createElement(
                    "td",
                    null,
                    box.status_time
                ),
                React.createElement(
                    "td",
                    null,
                    query_error_card_btn,
                    " ",
                    freeze_btn,
                    " ",
                    remove_btn
                )
            );
        }).bind(this));

        var p = parseInt(this.props.box_data.page);
        var max = parseInt(this.props.box_data.max);
        var start = p > 5 ? p - 5 : 1;
        var end = p + 5 > max ? max : p + 5;

        var page_list = [];

        if (p > 1) {
            page_list.push({ disable: false, index: 1, icon: "icon-fast-backward" });
            page_list.push({ disable: false, index: p - 1, icon: "icon-backward" });
        } else {
            page_list.push({ disable: true, icon: "icon-fast-backward" });
            page_list.push({ disable: true, icon: "icon-backward" });
        }

        for (var i = start; i <= end; i++) {
            page_list.push({ disable: false, index: i, title: i });
        }

        if (p < max) {
            page_list.push({ disable: false, index: p + 1, icon: "icon-forward" });
            page_list.push({ disable: false, index: max, icon: "icon-fast-forward" });
        } else {
            page_list.push({ disable: true, icon: "icon-forward" });
            page_list.push({ disable: true, icon: "icon-fast-forward" });
        }

        var page_group = page_list.map((function (b, i) {
            if (b.disable) {
                return React.createElement(
                    "button",
                    { key: 'p' + i, className: "btn btn-default disabled", type: "button" },
                    React.createElement("i", { className: b.icon })
                );
            } else if (b['icon']) {
                return React.createElement(
                    "button",
                    { key: 'p' + i, className: "btn btn-default", type: "button",
                        onClick: this.onPage.bind(this, b.index) },
                    React.createElement("i", { className: b.icon })
                );
            } else if (b.index == p) {
                return React.createElement(
                    "button",
                    { key: 'p' + i, className: "btn btn-primary", type: "button",
                        onClick: this.onPage.bind(this, b.index) },
                    b.title
                );
            } else {
                return React.createElement(
                    "button",
                    { key: 'p' + i, className: "btn btn-default", type: "button",
                        onClick: this.onPage.bind(this, b.index) },
                    b.title
                );
            }
        }).bind(this));

        return React.createElement(
            "section",
            { className: "panel" },
            React.createElement(
                "div",
                { className: "table-responsive" },
                React.createElement(
                    "table",
                    { id: "box_result", className: "table table-hover" },
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
                                "面值"
                            ),
                            React.createElement(
                                "th",
                                null,
                                "文件名"
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
                                "状态"
                            ),
                            React.createElement(
                                "th",
                                null,
                                "状态时间"
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
                        box_rows
                    )
                )
            ),
            React.createElement(
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
                            { id: "page_group1", className: "btn-group" },
                            page_group
                        )
                    )
                )
            )
        );
    }
});

var PackageResultPanel = React.createClass({
    displayName: "PackageResultPanel",

    onPage: function onPage(i) {
        this.props.onpage(i);
    },

    render: function render() {

        var package_rows = this.props.package_data.data.map(function (package_info, i) {
            //console.info(box);
            return React.createElement(
                "tr",
                null,
                React.createElement(
                    "td",
                    null,
                    package_info.name
                ),
                React.createElement(
                    "td",
                    null,
                    package_info.start,
                    "-",
                    package_info.end
                ),
                React.createElement(
                    "td",
                    null,
                    package_info.price
                ),
                React.createElement(
                    "td",
                    null,
                    package_info.c
                ),
                React.createElement(
                    "td",
                    null,
                    package_info.r
                )
            );
        });

        var p = parseInt(this.props.package_data.page);
        var max = parseInt(this.props.package_data.max);
        var start = p > 5 ? p - 5 : 1;
        var end = p + 5 > max ? max : p + 5;

        var page_list = [];

        if (p > 1) {
            page_list.push({ disable: false, index: 1, icon: "icon-fast-backward" });
            page_list.push({ disable: false, index: p - 1, icon: "icon-backward" });
        } else {
            page_list.push({ disable: true, icon: "icon-fast-backward" });
            page_list.push({ disable: true, icon: "icon-backward" });
        }

        for (var i = start; i <= end; i++) {
            page_list.push({ disable: false, index: i, title: i });
        }

        if (p < max) {
            page_list.push({ disable: false, index: p + 1, icon: "icon-forward" });
            page_list.push({ disable: false, index: max, icon: "icon-fast-forward" });
        } else {
            page_list.push({ disable: true, icon: "icon-forward" });
            page_list.push({ disable: true, icon: "icon-fast-forward" });
        }

        var page_group = page_list.map((function (b, i) {
            if (b.disable) {
                return React.createElement(
                    "button",
                    { key: 'p' + i, className: "btn btn-default disabled", type: "button" },
                    React.createElement("i", { className: b.icon })
                );
            } else if (b['icon']) {
                return React.createElement(
                    "button",
                    { key: 'p' + i, className: "btn btn-default", type: "button",
                        onClick: this.onPage.bind(this, b.index) },
                    React.createElement("i", { className: b.icon })
                );
            } else if (b.index == p) {
                return React.createElement(
                    "button",
                    { key: 'p' + i, className: "btn btn-primary", type: "button",
                        onClick: this.onPage.bind(this, b.index) },
                    b.title
                );
            } else {
                return React.createElement(
                    "button",
                    { key: 'p' + i, className: "btn btn-default", type: "button",
                        onClick: this.onPage.bind(this, b.index) },
                    b.title
                );
            }
        }).bind(this));

        return React.createElement(
            "section",
            { className: "panel" },
            React.createElement(
                "div",
                null,
                "共",
                this.props.package_data.package_count,
                "箱",
                this.props.package_data.box_count,
                " 盒",
                this.props.package_data.total_count,
                "张 面值合计 ",
                this.props.package_data.total_sum,
                "元 其中可用",
                this.props.package_data.ready_count,
                "张，可用面值合计",
                this.props.package_data.ready_sum,
                "元"
            ),
            React.createElement(
                "div",
                { className: "table-responsive" },
                React.createElement(
                    "table",
                    { id: "box_result", className: "table table-hover" },
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
                                "日期"
                            ),
                            React.createElement(
                                "th",
                                null,
                                "面值"
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
                            )
                        )
                    ),
                    React.createElement(
                        "tbody",
                        null,
                        package_rows
                    )
                )
            ),
            React.createElement(
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
                            { id: "page_group1", className: "btn-group" },
                            page_group
                        )
                    )
                )
            )
        );
    }
});

var CardResultPanel = React.createClass({
    displayName: "CardResultPanel",

    getCardStatusStr: function getCardStatusStr(status) {
        var card_status_map = {
            'ready': '可用',
            'inuse': '在用',
            'error': '错误',
            'used': '已用',
            'frozen': '冻结',
            'frozen_single': '冻结',
            'removed': '已删除',
            'removed_single': '已删除'
        };
        return card_status_map[status];
    },

    onClickExportErrorCards: function onClickExportErrorCards() {
        var requ_type = "export";
        var requ_data = {
            requ_type: requ_type,
            argu_list: {
                box_id: this.props.box_info.box_id
            }
        };
        var argu_list = "";
        for (var i in requ_data.argu_list) {
            argu_list += _.str.sprintf('&%s=%s', encodeURIComponent(i), encodeURIComponent(requ_data.argu_list[i]));
        }

        $.ajax({
            url: _.str.sprintf('/api/card/error_cards?&requ_type=%s%s', encodeURIComponent(requ_type), argu_list),
            type: "GET",
            dataType: "json",

            success: function success(resp_data) {
                if (resp_data.status == "ok") {
                    alert(JSON.stringify(resp_data.data));
                } else {
                    alert("数据导出失败\n" + resp_data.msg);
                }
            },

            error: (function (xhr, status, err) {
                console.error(this.props.url, status, err.toString());
            }).bind(this)
        });
    },

    onCard: function onCard(status, page) {
        this.props.oncard('query', this.props.box_info, status, page);
    },

    onExportCard: function onExportCard() {
        this.props.oncard('export', this.props.box_info);
    },

    onEdit: function onEdit(box_id, card_id) {
        $('#card_id').val(card_id);
        $('#box_id').val(box_id);
        $('#password').val('');

        $('#myModal').modal('show');
    },

    componentDidMount: function componentDidMount() {
        //初始化
        $('#upload_correction_cards').fileupload({
            pasteZone: null, //禁用粘贴事件
            dataType: 'json',
            done: function done(e, data) {
                var resp_data = data.result;
                var err_msg_list = "";
                for (var i in resp_data.msg) {
                    err_msg_list += resp_data.msg[i];
                    err_msg_list += "\n";
                }
                if (resp_data.status == 'ok') {
                    alert("密码修正成功\n" + err_msg_list);
                } else {
                    alert("密码修正错误\n" + err_msg_list);
                }
            },
            fail: function fail(e, data) {
                alert("上传修卡异常!!!");
            }
        });

        //按钮禁用
        $('#upload_correction_cards').attr('disabled', "true");
    },

    componentDidUpdate: function componentDidUpdate(prevProps, prevState) {
        if (this.props.box_info != prevProps.box_info) {
            //按钮启用
            $('#upload_correction_cards').removeAttr("disabled");
            $('#upload_correction_cards').fileupload('option', {
                url: _.str.sprintf('/upload/correction_box_file?card_type=%s&box_id=%s', encodeURIComponent(CARD_TYPE), encodeURIComponent(this.props.box_info.box_id))
            });
        }
    },

    render: function render() {
        var search_bar = [{ status: 'all', name: '全部' }, { status: 'inuse', name: '在用' }, { status: 'ready', name: '可用' }, { status: 'error', name: '错误' }, { status: 'used', name: '已用' }, { status: 'frozen', name: '冻结' }, { status: 'removed', name: '已删除' }].map((function (s) {
            if (s.status == this.props.query.status) {
                return React.createElement(
                    "a",
                    { href: "#", className: "btn btn-primary",
                        onClick: this.onCard.bind(this, s.status, undefined) },
                    s.name,
                    React.createElement(
                        "span",
                        { className: "badge" },
                        this.props.card_data.count
                    )
                );
            } else {
                return React.createElement(
                    "a",
                    { href: "#", className: "btn btn-default",
                        onClick: this.onCard.bind(this, s.status, undefined) },
                    s.name
                );
            }
        }).bind(this));

        var card_rows = this.props.card_data.data.map((function (card, i) {
            var btn = '';
            if (card.status == 'error') {
                btn = React.createElement(
                    "a",
                    { className: "btn btn-xs btn-danger", href: "javascript:void(0);",
                        onClick: this.onEdit.bind(this, card.box_id, card.card_id) },
                    React.createElement("span", { className: "icon-edit" }),
                    "修正"
                );
            }

            return React.createElement(
                "tr",
                null,
                React.createElement(
                    "td",
                    null,
                    card.id
                ),
                React.createElement(
                    "td",
                    null,
                    card.price
                ),
                React.createElement(
                    "td",
                    null,
                    card.card_id
                ),
                React.createElement(
                    "td",
                    null,
                    this.getCardStatusStr(card.status)
                ),
                React.createElement(
                    "td",
                    null,
                    card.status_time
                ),
                React.createElement(
                    "td",
                    null,
                    btn
                )
            );
        }).bind(this));

        //分页信息
        var p = parseInt(this.props.card_data.page);
        var max = parseInt(this.props.card_data.max);
        var start = p > 5 ? p - 5 : 1;
        var end = p + 5 > max ? max : p + 5;

        var page_list = [];

        if (p > 1) {
            page_list.push({ disable: false, index: 1, icon: "icon-fast-backward" });
            page_list.push({ disable: false, index: p - 1, icon: "icon-backward" });
        } else {
            page_list.push({ disable: true, icon: "icon-fast-backward" });
            page_list.push({ disable: true, icon: "icon-backward" });
        }

        for (var i = start; i <= end; i++) {
            page_list.push({ disable: false, index: i, title: i });
        }

        if (p < max) {
            page_list.push({ disable: false, index: p + 1, icon: "icon-forward" });
            page_list.push({ disable: false, index: max, icon: "icon-fast-forward" });
        } else {
            page_list.push({ disable: true, icon: "icon-forward" });
            page_list.push({ disable: true, icon: "icon-fast-forward" });
        }

        var page_group = page_list.map((function (b, i) {
            if (b.disable) {
                return React.createElement(
                    "button",
                    { key: 'p' + i, className: "btn btn-default disabled", type: "button" },
                    React.createElement("i", { className: b.icon })
                );
            } else if (b['icon']) {
                return React.createElement(
                    "button",
                    { key: 'p' + i, className: "btn btn-default", type: "button",
                        onClick: this.onCard.bind(this, undefined, b.index) },
                    React.createElement("i", { className: b.icon })
                );
            } else if (b.index == p) {
                return React.createElement(
                    "button",
                    { key: 'p' + i, className: "btn btn-primary", type: "button",
                        onClick: this.onCard.bind(this, undefined, b.index) },
                    b.title
                );
            } else {
                return React.createElement(
                    "button",
                    { key: 'p' + i, className: "btn btn-default", type: "button",
                        onClick: this.onCard.bind(this, undefined, b.index) },
                    b.title
                );
            }
        }).bind(this));

        var boxInfoNode = React.createElement(
            "span",
            null,
            "箱号:",
            this.props.box_info["package"],
            " 盒号:",
            this.props.box_info.box_id,
            " 文件名:",
            this.props.box_info.filename
        );
        return React.createElement(
            "section",
            { className: "panel" },
            React.createElement(
                "div",
                { className: "panel-heading row" },
                boxInfoNode
            ),
            React.createElement(
                "div",
                { className: "panel-body" },
                React.createElement(
                    "div",
                    { className: "col-md-6 btn-group" },
                    search_bar
                ),
                React.createElement(
                    "div",
                    { className: "col-md-6 btn-group" },
                    React.createElement(
                        "a",
                        { className: "btn btn-default",
                            onClick: this.onExportCard
                        },
                        React.createElement("i", { className: "icon-download-alt" }),
                        "导出数据"
                    ),
                    React.createElement(
                        "a",
                        { className: "btn btn-default fileinput-button"
                        },
                        React.createElement("i", { className: "icon-upload-alt" }),
                        React.createElement("input", {
                            id: "upload_correction_cards",
                            name: "correction_cards",
                            multiple: "",
                            type: "file",
                            accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                        }),
                        "上传修卡..."
                    )
                )
            ),
            React.createElement(
                "div",
                { className: "table-responsive" },
                React.createElement(
                    "table",
                    { id: "card_result", className: "table table-hover" },
                    React.createElement(
                        "thead",
                        null,
                        React.createElement(
                            "tr",
                            null,
                            React.createElement(
                                "th",
                                null,
                                "编号"
                            ),
                            React.createElement(
                                "th",
                                null,
                                "面值"
                            ),
                            React.createElement(
                                "th",
                                null,
                                "卡号"
                            ),
                            React.createElement(
                                "th",
                                null,
                                "状态"
                            ),
                            React.createElement(
                                "th",
                                null,
                                "状态时间"
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
                        card_rows
                    )
                )
            ),
            React.createElement(
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
                            { className: "btn-group" },
                            page_group
                        )
                    )
                )
            )
        );
    }
});

React.render(React.createElement(QueryPanel, null), document.getElementById('main-content'));

