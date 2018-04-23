$(function () {
    var select_class = 'btn-info';

    var re_value = /^[0-9]{1,5}(\.[0-9]{1,2})?$/;
    var re_token = /[0-9]{6}/;

    $("#form_value").change(function () {
        $("#form_value").removeClass("error");
        $("#for_value").text('');
    });
    $("#form_token").change(function () {
        $("#form_token").removeClass("error");
        $("#for_token").text('');
    });

    var valid = function (e) {
        var value = $("#form_value").val();
        if (!re_value.test(value)) {
            $("#form_value").addClass("error");
            $("#for_value").text("请输入正确的金额");
            return false;
        }

        var token = $("#form_token").val();
        if (!re_token.test(token)) {
            $("#form_token").addClass("error");
            $("#for_token").text("请输入六位数字");
            return false;
        }

        return true;
    };

    $("#act_query").click(function () {
        var order_id = $("#form_order_id").val();
        var user_id = $("#form_user_id").val();

        var q = '/admin/fund/order?order_id=' + order_id + "&user_id=" + user_id;

        $.get(q, function (data) {
            if (data.status == 'ok') {
                var i = parseInt(data.value) / 10000;
                $("#form_value").val(i);

                if ($("#form_notes").val() == "") {
                    $("#form_notes").val('订单' + data.order_id + '退款' + i + '元');
                }
            } else {
                alert("订单查询失败，请到订单查询界面核对");
            }
        }, 'json').fail(function (e) {
            alert("查询失败");
        });
    });

    $("#act_adding").click(function (e) {

        if (!valid()) return;

        var type = $("#form_type").val();
        var value = $("#form_value").val();
        var token = $("#form_token").val();
        var operator = $("#form_operator").val();
        var user_id = $("#form_user_id").val();
        var order_id = $("#form_order_id").val();
        var notes = $("#form_notes").val();

        //////////
        $("#act_adding").attr('disabled', 'true');
        var data = {
            type: type,
            order_id: order_id,
            operator: operator,
            income: value,
            token: token,
            user_id: user_id,
            notes: notes};

        $.post('/admin/fund', JSON.stringify(data)).done(function (data) {
            var m = JSON.parse(data);
            alert(m.msg);
        }).fail(function () {
            alert('fail');
        }).always(function () {
            $("#act_adding").removeAttr('disabled');
        });
    });

    $("#form_type").change(function () {
        if ($("#form_type").val() == 'refund-manual') {
            $("#form_order").show(200);
            $("#form_value").prop('readonly', true);
        } else {
            $("#form_order").hide(200);
            $("#form_value").prop('readonly', false);
        }
    });

    $("#form_order").hide();
})