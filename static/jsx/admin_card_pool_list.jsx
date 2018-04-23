function getQueryStringByName(name) {
    var result = location.search.match(new RegExp("[\?\&]" + name + "=([^\&]+)", "i"));
    if (result == null || result.length < 1) {
        return "";
    }
    return result[1];
}
var CARD_TYPE = getQueryStringByName('card_type');

var MainContent = React.createClass({
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
                    //console.log(JSON.stringify(resp_data));
                    this.setState({ pool_list: resp_data.data.pool_list });;
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

    getPoolListConfig: function () {
        $.ajax({
            url: _.str.sprintf('/admin/card_pool_list?card_type=%s&requ_type=%s',
                               encodeURIComponent(CARD_TYPE),
                               encodeURIComponent('get_pool_list_config')
                              ),
            type: 'get',
            dataType: 'json',

            success: function (resp_data) {
                if (resp_data.status == 'ok') {
                    this.setState({ pool_list_config: resp_data.data });
                }
                else {
                    alert('卡池列表配置加载错误 ' + resp_data.msg);
                }
            }.bind(this),

            error: function (xhr, status, err) {
                alert('卡池列表配置加载异常 ' + err.toString());
                console.error(this.props.url, status, err.toString());
            }.bind(this)
        });
    },

    getInitialState: function () {
        return {
            pool_list: [],
            pool_list_config: {}
        };
    },

    componentDidMount: function () {
        this.getPoolList();
        this.getPoolListConfig();
    },

    //点击新增卡池
    onClickAddPool: function () {
        this.refs.AddPoolDlg.showDlg(this.state.pool_list, this.onAddPool);
    },

    //新增卡池
    onAddPool: function (new_pool_info) {
        var requ_data = {
            requ_type: 'add_pool',
            argu_list: {
                new_pool_info: new_pool_info,
            },
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
                    this.getPoolList();
                    alert(_.str.sprintf('新增卡池 %s 成功', new_pool_info.pool_name));
                }
                else {
                    alert(_.str.sprintf('新增卡池 %s 失败 %s!!!', new_pool_info.pool_name, resp_data.msg));
                }
            }.bind(this),

            error: function (xhr, status, err) {
                alert(_.str.sprintf('新增卡池 %s 异常 %s!!!', new_pool_info.pool_name, err.toString()));
                console.error(this.props.url, status, err.toString());
            }.bind(this)
        });
    },

    //删除卡池
    onDelPool: function (pool_info) {

        if (!window.confirm(_.str.sprintf('确认删除卡池 %s 吗?', pool_info.pool_name))) {
            if (pool_info.pool_name == this.state.pool_list_config.def_up_pool || this.state.pool_list_config.pub_use_pool) {

            }


            return;
        }

        var requ_data = {
            requ_type: 'remove_pool',
            argu_list: {
                pool_info: pool_info,
            },
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
                    this.getPoolList();
                    alert(_.str.sprintf('删除卡池 %s 成功', pool_info.pool_name));
                }
                else {
                    alert(_.str.sprintf('删除卡池 %s 失败 %s!!!', pool_info.pool_name, resp_data.msg));
                }
            }.bind(this),

            error: function (xhr, status, err) {
                alert(_.str.sprintf('删除卡池 %s 异常 %s!!!', pool_info.pool_name, err.toString()));
                console.error(this.props.url, status, err.toString());
            }.bind(this)
        });
    },

    //设置默认卡池
    onClickSetDefUpPool: function (pool_info) {
        this.setPoolListConfig('def_up_pool', pool_info.pool_name);
    },

    //设置公共卡池
    onClickSetPubUsePool: function (pool_info) {
        this.setPoolListConfig('pub_use_pool', pool_info.pool_name);
    },

    setPoolListConfig: function (key, value) {
        var keyname = '默认卡池';
        if (key != 'def_up_pool') {
            keyname = '公共卡池';
        }

        if (!window.confirm(_.str.sprintf('确认将卡池 %s 设为 %s 吗?', value, keyname))) {
            return;
        }

        var argu_list = {}
        argu_list[key] = value;

        var requ_data = {
            requ_type: 'set_pool_list_config',
            argu_list: argu_list,
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
                    this.getPoolListConfig();
                    this.getPoolList();
                    alert(_.str.sprintf('%s 卡池 %s 设置成功', keyname, value));
                }
                else {
                    alert('失败!! ' + resp_data.msg);
                }
            }.bind(this),

            error: function (xhr, status, err) {
                alert(err.toString());
                console.error(this.props.url, status, err.toString());
            }.bind(this)
        });
    },

    getLocalTime: function (e) {
        return new Date(parseInt(e) * 1000).toLocaleString();
    },

    //设置卡池缓存状态
    setPoolConfig: function (card_pool, key, value) {
        var argu_list = {}
        argu_list["card_pool"] = card_pool;
        argu_list["key"] = key;
        argu_list["value"] = value;

        var requ_data = {
            requ_type: 'set_pool_config',
            argu_list: argu_list,
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
                    this.getPoolList();
                    alert(_.str.sprintf('卡池 %s 设置缓存成功', card_pool));
                }
                else {
                    alert("修改卡池配置错误: " + resp_data.msg);
                }
            }.bind(this),

            error: function (xhr, status, err) {
                alert("修改卡池配置异常: " + err.toString());
                console.error(this.props.url, status, err.toString());
            }.bind(this)
        });
    },

    //打开缓存
    onOpenPoolConfig: function (pool_name) {
        if (!window.confirm(_.str.sprintf('确认将卡池缓存 %s 打开吗?', pool_name))) {
            return;
        }
        this.setPoolConfig(pool_name, "need_cache", 1);
    },

    //关闭缓存
    onClosePoolConfig: function (pool_name) {
        if (!window.confirm(_.str.sprintf('确认将卡池缓存 %s 关闭吗?', pool_name))) {
            return;
        }
        this.setPoolConfig(pool_name, "need_cache", 0);
    },

    render: function () {
        var DefaultPool = this.state.pool_list_config.def_up_pool;
        var PublicPool = this.state.pool_list_config.pub_use_pool;

        var PoolList = this.state.pool_list.map(function (pool_info, index) {

            var poolname = pool_info.pool_name;
            var OpenBtnId = "open" + poolname;
            var CloseBtnId = "close" + poolname;

            var needCacheNode = null;
            if (poolname != PublicPool) {
                if (pool_info.need_cache == 1) {
                    needCacheNode = (
                        <div className="row">
                            <div className="col-xs-4 poolalert alert-success text-center">状态: 打开</div>
                            <div className="col-xs-2 text-right">
                                <a id={CloseBtnId} href="javascript:void(0);" className="btn btn-danger btn-xs" onClick={this.onClosePoolConfig.bind(this,poolname)}>关闭</a>
                            </div>
                        </div>
                    );
                } else {
                    needCacheNode = (
                        <div className="row">
                            <div className="col-xs-4 poolalert alert-danger text-center">状态: 关闭</div>
                            <div className="col-xs-2">
                                <a id={OpenBtnId} href="javascript:void(0);" className="btn btn-info btn-xs" onClick={this.onOpenPoolConfig.bind(this,poolname)}>打开</a>
                            </div>
                        </div>
                    );
                }
            }

            var PoolCreateTime = this.getLocalTime(pool_info.create_tsp);

            var CfgBtn = (
                <div className="btn-group btn-group-xs" role="group" aria-label="">
                    <button type="button" href="javascript:void(0);" className="btn btn-success" onClick={this.onClickSetDefUpPool.bind(this,pool_info)}><i className="icon-bookmark" /> 默认卡池</button>
                    <button type="button" herf="javascript:void(0);" className="btn btn-primary" onClick={this.onClickSetPubUsePool.bind(this,pool_info)}><i className="icon-group" /> 公共卡池</button>
                </div>
            );

            if (poolname == PublicPool && poolname != DefaultPool) {
            CfgBtn = (
                     <button type="button" href="javascript:void(0);" className="btn btn-success" onClick={this.onClickSetDefUpPool.bind(this,pool_info)}><i className="icon-bookmark" /> 默认卡池</button>
                );
            } else if (poolname == DefaultPool && poolname != PublicPool) {
                CfgBtn = (
                    <button type="button" herf="javascript:void(0);" className="btn btn-primary" onClick={this.onClickSetPubUsePool.bind(this,pool_info)}><i className="icon-group" /> 公共卡池</button>
                );                
            } else if (poolname == DefaultPool && poolname == PublicPool) {
                CfgBtn = null;
            };

            var DelBtn = null;
            if (poolname != DefaultPool && poolname != PublicPool) {
                DelBtn = (
                    <button type="button" href="javascript:void(0);" className="btn btn-danger" onClick={this.onDelPool.bind(this,pool_info)}><i className="icon-trash" /> 删除</button>
                );
            }

            return (
                <tr>
                    <td>{poolname}</td>
                    <td>{PoolCreateTime}</td>
                    <td>{needCacheNode}</td>
                    <td>
                        <div className="btn-toolbar pull-right" role="toolbar" aria-label="">
                            <div className="btn-group btn-group-xs" role="group" aria-label="">
                                {DelBtn}
                            </div>
                            <div className="btn-group btn-group-xs" role="group" aria-label="">
                                {CfgBtn}
                            </div>
                        </div>
                    </td>
                </tr>
                );
        }.bind(this));

        return (
                <div className="wrapper">
                    <div className="col-md-12">
                       <section className="panel">
                        <header className="panel-heading row">
                            <span className="pull-left"><i className="icon-table"></i>卡池列表</span>
                            <a className="btn btn-info pull-right" href="javascript:void(0);" onClick={this.onClickAddPool}><i className="icon-plus"></i> 新增卡池</a>
                        </header>
                        <div className="col-xs-12">
                            <h5 className="text-danger"><strong><i className="icon-bookmark" /> 当前默认卡池： {DefaultPool}</strong></h5>
                            <h5 className="text-primary"><strong><i className="icon-group" />当前公共卡池： {PublicPool}</strong></h5>
                        </div>
                        <div className="panel-body">
                            <table className="table table-striped table-hover">
                                <thead>
                                    <tr>
                                        <th>卡池名称</th>
                                        <th>创建时间</th>
                                        <th><div className="col-xs-4 text-right">状态</div></th>
                                        <th><div className="col-xs-10 text-right">操作</div></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {PoolList}
                                </tbody>
                            </table>
                        </div>
                       </section>
                    </div>

                    <AddPoolDlg ref="AddPoolDlg" />
                </div>
         );
    }
});



//新增卡池弹窗
var AddPoolDlg = React.createClass({
    onOk: function () {
        var pool_name = $('#new_pool_name').val();

        //前台数据监测这个卡池名字是否已经存在了
        for (var i in this.state.pool_list) {
            if (pool_name == this.state.pool_list[i].pool_name) {
                alert("这个名字已经被使用了， 换一个!!!");
                return;
            }
        }

        var new_pool_info = {
            pool_name: pool_name,
        };

        this.state.onAddPool(new_pool_info);
        this.hideDlg();
    },

    onInputKeyUp: function (input_id) {
        $('#' + input_id).keydown(
            function (e) {
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

    showDlg: function (pool_list, onAddPool) {
        this.setState({
            pool_list: pool_list,
            onAddPool: onAddPool,
        });
        $('#addPoolDlg').modal('show');
        $('#new_pool_name').val('');
        $('#addnewpoolbtn').addClass('disabled');
    },

    hideDlg: function () {
        $('#addPoolDlg').modal('hide');
        this.clearInput();
    },

    clearInput: function () {
        this.setState({
            pool_list: [],
            onAddPool: null,
        });

        $('#new_pool_name').val('');
    },

    getInitialState: function () {
        return ({
            pool_list: [],
            onAddPool: null,
        });
    },

    componentDidUpdate: function () {
    },

    render: function () {
        return (
            <div className="modal" id="addPoolDlg" tabIndex="-1" role="dialog">
                <div className="modal-dialog">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h5 className="modal-title">新增卡池</h5>
                        </div>
                        <div className="modal-body form-horizontal">
                            <div className="form-group add-pro-body">

                                <label className="col-md-2 control-label">卡池名称</label>
                                <div className="col-md-10">
                                    <input maxLength="15" className="m-bot15 form-control input-sm" id="new_pool_name" onBlur={this.onInputKeyUp.bind(this,'new_pool_name')} onKeyUp={this.onInputKeyUp.bind(this,'new_pool_name')} placeholder="请输入卡池名称" />
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer form-horifooter">
                            <button id="addnewpoolbtn" type="button" className="btn btn-danger" onClick={this.onOk}>新建</button>
                            <button type="button" className="btn btn-default" data-dismiss="modal">取消</button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }
});


React.render(
    <MainContent />
    ,
    document.getElementById('main-content')
);