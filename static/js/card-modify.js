$(function () {

    var fun_modify = function () {

        var box_id = $('#box_id').val();
        var card_id = $('#card_id').val();
        var password = $('#password').val();

        if (box_id == '' || card_id == '' || password == '') {
            alert('请输入');
            return;
        }
        var body = JSON.stringify({
            box_id: box_id,
            card_id: card_id,
            password: password
        });

        $.post('/card/modify', body).done(function (data) {
            var result = JSON.parse(data);
            console.info(data);
            alert(result.msg);
            window.location.replace('/card/query')
        }).fail(function (data) {
            alert('error');
        });
    };

    $('#act_modify').click(fun_modify);
});