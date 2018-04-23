$(function () {
    var last_head = null;
    var last_prod = null;

    var select_class = 'btn-info';

    var patt1 = new RegExp("[0-9]{0,11}");
    var patt2 = new RegExp("[0-9]{11}");

    var valid = function (e) {
        var number = $("#form_number").val();

        var number0 = number;

        if (patt1.test(number) == false) {
            $("#form_number").addClass("error");
            return false;
        } else {
            $("#form_number").removeClass("error");
        }

        if (number.length > 11)
            number = number.substr(0, 11);
        if (number.length > 7)
            number = number.substr(0, 7) + ' ' + number.substr(7);
        if (number.length > 3)
            number = number.substr(0, 3) + ' ' + number.substr(3);
        if (number.length == 0)
            number = '请输入号码';

        $("#show_number").text(number);

        if (number0.length >= 7) {
            get_prod(number0);
        } else if (number0.length < 7) {
            $("#show_carrier").text('');
            $("#prod").html('');
        }

        return true;
    };

    var set_prod = function (ret) {
        $("#prod").html("");
        for (var i in ret.prod) {
            var lb = $("<div class='radio'></div>")
                .append($("<label></label>")
                    .append($("<input name='product_group' type='radio'/>").addClass('m-bot15').attr('value', ret.prod[i]['offer']))
                    .append($("<strong></strong>").text(ret.prod[i]['name']))
                    .append($("<span> / 面值</span>"))
                    .append($("<span></span>").text('' + ret.prod[i]['face'] + '元'))
                    .append($("<span> / 采购价格</span>"))
                    .append($("<span></span>").text(ret.prod[i]['value'] + '元'))
            );


            $("#prod").append(lb);
        }

        $("#show_carrier").text(ret.name);
    };

    var get_prod = function (number0) {

        if (number0.substr(0, 7) == last_head) {
            set_prod(last_prod);
        } else {
            $.get('/charge/data/single/product?m=' + number0).done(function (data) {
                var ret = JSON.parse(data);
                if (ret && ret.status && ret.status == 'ok') {
                    set_prod(ret);
                    last_head = number0.substring(0, 7);
                    last_prod = ret;
                }
            });
        }
    };

    $("#form_number").keyup(valid).change(valid);


    $("#act_charge").click(function (e) {

        var number = $("#form_number").val();

        if (patt2.test(number) == false) {
            $("#form_number").addClass("error");
            $("#for_number").text("请输入正确的手机号码");
            return false;
        } else {
            $("#form_number").removeClass("error");
            $("#for_number").text("");
        }

        var prod = $('input[name=product_group]:checked').val();
        if (!prod || prod.length == 0) {
            alert("请选择充值产品");
            return;
        }

        //////////
        $("#act_charge").attr('disabled', 'true');
        var data = {number: number, prod: prod};
        $.post('/charge/data/single', JSON.stringify(data)).done(function (data) {
            console.debug(data);

            var m = JSON.parse(data);
            alert(m.msg);
        }).always(function () {
            $("#act_charge").removeAttr('disabled');
        });
    });
})