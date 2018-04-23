function getQueryStringByName(name) {

    var result = location.search.match(new RegExp("[\?\&]" + name + "=([^\&]+)", "i"));

    if (result == null || result.length < 1) {

        return "";

    }

    return result[1];

}

var CARD_TYPE = getQueryStringByName('card_type');

var UploadPanel = React.createClass({
    getInitialState: function () {
        return {
            pending_list: []
        };
    },

    doRefresh: function () {

        $.ajax({
            url: '/card/import/list?card_type=' + CARD_TYPE,
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
        //this.doStreamInfo();
        this.doRefresh();
    },

    doRest: function () {
        $.ajax({
            url: '/card/import/reset?card_type=' + CARD_TYPE,
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

    doReload: function () {
        if (!confirm("是否需要重新装载号码重复检测器？\n(一般用于手工清理卡之后)")) {
            return;
        }

        $.ajax({
            url: '/card/import/reload?card_type=' + CARD_TYPE,
            dataType: 'json',
            type: 'post',
            success: function (data) {
                alert(data.msg);
                if (data.status == 'ok') {
                    this.doRefresh();
                }
            }.bind(this),

            error: function (xhr, status, err) {
                alert("ERR " + err);
            }.bind(this)
        });
    },

    doCommitFiles: function () {
        $('#commit-btn').attr('disabled', 'true');

        $.ajax({
            url: '/card/import/commit?card_type=' + CARD_TYPE,
            dataType: 'json',
            type: 'post',
            success: function (data) {
                this.doRefresh();
                if (data.status != 'ok') {
                    alert(data.msg);
                }
                $('#commit-btn').removeAttr('disabled');
            }.bind(this),

            error: function (xhr, status, err) {
                alert("ERR " + err);
                $('#commit-btn').removeAttr('disabled');
            }.bind(this)
        });
    },

    render: function () {
        var pending_list = this.state.pending_list;

        return (
            <div className="form-horizontal">
                <OperationPanel refresh={this.doRefresh}/>
                <PendingList pending_list={pending_list}/>

                <div className="form-group">
                    <div className="col-md-offset-2 col-md-8">
                        <a id="commit-btn" className='btn btn-danger' href='#' onClick={this.doCommitFiles}>提交</a>
                    </div>
                    <div className="col-md-2">
                        <a className='btn btn-info' href='#' onClick={this.doRest}>重置</a>
                        <a className='btn btn-primary' href='#' onClick={this.doReload} title='重新装载卡号重复检测器'>刷新</a>
                    </div>
                </div>
            </div>
        );
    }
});

var OperationPanel = React.createClass({
    getInitialState: function () {
        return {
            price: '0',
            //buy_price: '',
            //sell_price: '',
            source: [],
            downstream: [],
            pool_list: []
        };
    },

    setPrice: function (price) {
        this.setState({price: price})
    },

    getPoolList: function () {
        $.ajax({
            url: _.str.sprintf('/admin/card_pool_list?card_type=%s&requ_type=%s',
                encodeURIComponent(CARD_TYPE),
                encodeURIComponent('get_pool_list')
            ),
            type: 'get',
            dataType: 'json',

            success: function (resp_data) {
                if (resp_data.status == 'ok') {
                    if (resp_data.data.pool_list.length <= 0) {
                        alert("卡池!!!!!!!!!!!");
                        window.location.replace("/admin/card_pool_list?card_type=" + CARD_TYPE);
                        return;
                    }


                    this.setState({pool_list: resp_data.data.pool_list});
                }
                else {
                    alert("卡池列表加载错误 " + resp_data.msg);
                }
            }.bind(this),

            error: function (xhr, status, err) {
                alert("卡池列表加载异常 " + err.toString());
                console.error(this.props.url, status, err.toString());
            }.bind(this)
        });
    },

    doStreamInfo: function () {
        $.ajax({
            url: '/card/import/stream?card_type=' + CARD_TYPE,
            dataType: 'json',
            type: 'get',
            success: function (data) {
                var new_value = {
                    source: data['source'],
                    downstream: data['downstream']
                };
                this.setState(new_value);

                $('#buy_price').val(data['source'][0]['discount'] / 100);
                $('#sell_price').val(data['downstream'][0]['discount'] / 100);

            }.bind(this)
        });
    },

    onChangeSource: function () {
        var current_src = $("#source").val();

        for (var i = 0; i < this.state.source.length; i++) {
            if (this.state.source[i].source_id == current_src) {
                $('#buy_price').val(this.state.source[i]['discount'] / 100);
                break;
            }
        }
    },

    onChangeUser: function () {
        var current_user = $("#user_id").val();

        for (var i = 0; i < this.state.downstream.length; i++) {
            if (this.state.downstream[i].user_id == current_user) {
                $('#sell_price').val(this.state.downstream[i]['discount'] / 100);
                break;
            }
        }
    },

    componentDidMount: function () {

        var url = '/card/import/upload?card_type=' + CARD_TYPE;
        $('#fileupload').fileupload({
            url: url,
            dataType: 'json',

            submit: function (e, data) {
                //alert(this.state.price);
                if (get_price_list().indexOf(this.state.price) == -1) {
                    alert('请先选择一种面值');
                    return false;
                }

                data.formData = {
                    price: this.state.price,
                    notes: $('#notes').val(),
                    user_id: $('#user_id').val(),
                    source_id: $('#source').val(),
                    buy_price: $('#buy_price').val(),
                    sell_price: $('#sell_price').val(),
                    package_no: $('#package_no').val(),
                    max_line: $('#max_line').val(),
                    card_type: CARD_TYPE,
                    card_pool: $('#up_pool').val()
                };
            }.bind(this),

            change: function (e, data) {
                //alert(this.state);
                //$.each(data.files, function (index, file) {
                //    $("#filename").text(file.name);
                //});
            }.bind(this),

            done: function (e, data) {
                if (data.result['status'] != 'ok') {
                    alert(data.result['msg']);
                }
                this.props.refresh();
            }.bind(this)
        });

        this.getPoolList();
    },

    render: function () {
        var current = this.state.price;

        var priceGroup = get_price_list().map(function (p, i) {
            var name = "m-bot15 btn btn-default";
            if (p == current) {
                name = 'm-bot15 btn btn-danger';
            }

            return (
                <a href="javascript:void(0);" className={name} onClick={this.setPrice.bind(this, p)}>{p}</a>
            );
        }.bind(this));

        var poolListNodes = this.state.pool_list.map(function (pool_info, i) {
            return (<option value={pool_info.pool_name}>
                {pool_info.display_name || pool_info.pool_name} ({pool_info.pool_name})</option>);
        });

        var upPoolNode = null;
        if(true)
        {
            upPoolNode =(
            <div>
                <label className="col-md-2 control-label">指定卡池</label>
                <div className="col-md-4">
                    <select id="up_pool" className="form-control m-bot15">
                        {poolListNodes}
                    </select>
                </div>
            </div>
            );
        }



        return (

            <div className="form-group">

                <label className="col-md-2 control-label">面值</label>

                <div id="price-group" className="col-md-4 btn-group" role="group" aria-label="">
                    {priceGroup}
                </div>

                <label className="col-md-2 control-label">箱号</label>

                <div className="col-md-4">
                    <input id="package_no" className="form-control m-bot15" type="text"/>
                </div>

                <label className="col-md-2 control-label">备注</label>

                <div className="col-md-10">
                    <input id="notes" className="form-control m-bot15" type="text"/>
                </div>

                <label className="col-md-2 control-label">进货价格</label>

                <div className="col-md-4">
                    <input id="buy_price" className="form-control m-bot15" type="text"/>
                </div>

                <label className="col-md-2 control-label">出货价格</label>

                <div className="col-md-4">
                    <input id="sell_price" className="form-control m-bot15" type="text"/>
                </div>

                <label className="col-md-2 control-label">最大行数</label>

                <div className="col-md-4">
                    <input id="max_line" className="form-control m-bot15" type="text"/>
                </div>

                {upPoolNode}

                <div className="col-md-offset-2 col-md-10">
                    <span className="btn btn-info fileinput-button">
                        <i className="icon-check"></i>
                        <span id="filename">上传卡密文件</span>
                        <input id="fileupload" name="card_file" multiple="true" type="file"/>
                    </span>
                </div>
            </div>
        )
    }
});

var PendingList = React.createClass({
    render: function () {

        var pendingRows = this.props.pending_list.map(function (pending, i) {
            return (
                <tr>
                    <td>{pending.package_no}</td>
                    <td>{pending.filename}</td>
                    <td>{pending.status}</td>
                    <td>{pending.msg}</td>
                    <td>{pending.price}</td>
                    <td>{pending.count}</td>
                    <td>{pending.card_pool}</td>
                    <td>{pending.user_id}</td>
                    <td>{pending.buy_price}</td>
                    <td>{pending.sell_price}</td>
                    <td>{pending.notes}</td>
                </tr>
            );
        });

        return (
            <div className="form-group table-responsive">
                <table className="table table-hover">
                    <thead>
                    <tr>
                        <th>箱号</th>
                        <th>文件名</th>
                        <th>状态</th>
                        <th>状态信息</th>
                        <th>面值</th>
                        <th>数量</th>
                        <th>卡池</th>
                        <th>用户ID</th>
                        <th>进货价格</th>
                        <th>出货价格</th>
                        <th>备注</th>
                    </tr>
                    </thead>
                    <tbody>
                    {pendingRows}
                    </tbody>
                </table>
            </div>
        );
    }
});

React.render(
    <UploadPanel />
    ,
    document.getElementById('content')
);
