$(function () {
    var getQueryStringByName = function (name) {

        var result = location.search.match(new RegExp("[\?\&]" + name + "=([^\&]+)", "i"));

        if (result == null || result.length < 1) {

            return "";

        }
        return result[1];
    }
    var CARD_TYPE = getQueryStringByName('card_type');

    var do_modify = function () {

        var box_id = $('#box_id').val();
        var card_id = $('#card_id').val();
        var password = $('#password').val();
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
            }
            else if (CARD_TYPE == 'SINOPEC') {
                var password_table = /^\d{20}$/g;
                if (!password_table.test(password)) {
                    alert('输入有误,密码必须是20位数字!!!');
                    return;
                }
            }
        }

        var body = JSON.stringify({
            box_id: box_id,
            card_id: card_id,
            password: password,
            no_modify: no_modify
        });

        console.info(body);

        $.post('/card/modify', body).done(function (data) {
            var result = JSON.parse(data);

            alert(result.msg);
            $('#myModal').modal('hide');

        }).fail(function (data) {
            alert('error');
        });
    };

    $('#act_modify').click(do_modify);

    var set_modify = function (event) {

        if ($(this).prop('checked')) {
            $('#password').val('').prop('disabled', true);
        } else {
            $('#password').prop('disabled', false);
        }
    };

    $('#no_modify').change(set_modify);
});
