var UploadPanel = React.createClass({
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
                <tr>
                    <td>{pending.price}</td>
                    <td>{pending.id}</td>
                    <td>{pending.password}</td>
                    <td><a href="#" onClick={this.doRemove.bind(this, pending.id)}>删除</a></td>
                </tr>
            );
        }.bind(this));

        return (
            <div className="form-horizontal">
                <div className="form-group">

                    <label className="col-md-2 control-label">面值</label>

                    <div className="col-md-4">
                        <input id="form-value" className="form-control m-bot15" type="text"/>
                    </div>

                    <div className="col-md-6">
                        <span></span>
                    </div>
                </div>
                <div className="form-group">
                    <label className="col-md-2 control-label">在此扫描卡号</label>

                    <div className="col-md-10">
                        <textarea id="form-input" className="form-control" onKeyUp={this.onInput}></textarea>
                    </div>

                    <div className="col-md-offset-2 col-md-10"><a href="#" onClick={this.cleanInput}>清空，重新输入</a></div>
                </div>

                <div className="form-group">
                    <div className="col-md-12 table-responsive">
                        <table className="table table-hover">
                            <thead>
                            <tr>
                                <th>面值</th>
                                <th>卡号</th>
                                <th>密码</th>
                            </tr>
                            </thead>
                            <tbody>
                            {pendingRows}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="form-group">
                    <div className="col-md-offset-2 col-md-6">
                        <a id="commit-btn" className='btn btn-danger' href='#' onClick={this.doCommit}>提交</a>
                    </div>
                    <div className="col-md-2">
                        <a className='btn btn-info' href='#' onClick={this.doRest}>全部清除，重新开始</a>
                    </div>
                </div>
            </div>
        );
    }
});

React.render(
    <UploadPanel />
    ,
    document.getElementById('content')
);
